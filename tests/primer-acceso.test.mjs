import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

// Pruebas sin red: se ejecuta el handler real con dependencias simuladas.
const raw = readFileSync(new URL('../api/primer-acceso.js', import.meta.url), 'utf8');
const source = raw.replace(/^import\s+.*?;\s*$/gm, '')
  .replace('export default async function handler', 'async function handler');
assert.notEqual(source, raw, 'El handler debe poder aislarse para pruebas');

function setup(options = {}) {
  const calls = [];
  const admin = {
    rpc: async (name, args) => {
      calls.push(name);
      if (name === 'primer_acceso_cancelar') {
        assert.equal(args.p_email, 'dummy@ofl.cl');
        assert.equal(args.p_codigo, '12345678');
        if (options.cancelThrow) throw new Error('cancel mock failure');
        return { data: true, error: options.cancelFail ? { code: 'mock' } : null };
      }
      return name === 'primer_acceso_emitir'
        ? { data: options.issued ?? false, error: null }
        : { data: options.profileId ?? null, error: null };
    },
    auth: { admin: {
      createUser: async () => {
        calls.push('createUser');
        return { data: { user: { id: 'auth-test' } }, error: null };
      },
      deleteUser: async () => {
        calls.push('deleteUser');
        return { error: null };
      }
    }},
    from: (name) => {
      assert.ok(['usuarios', 'primer_acceso_codigos'].includes(name));
      if (name === 'usuarios') return {
        update: () => ({
          eq: () => ({
            is: () => ({
              select: () => ({
                maybeSingle: async () => {
                  calls.push('link');
                  return { data: options.linkFail ? null : { id: 'profile-test' }, error: null };
                }
              })
            })
          })
        })
      };
      return {
        delete: () => ({
          eq: async () => {
            calls.push('cleanup');
            return { error: null };
          }
        })
      };
    }
  };
  const env = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    SMTP_HOST: 'test.invalid',
    SMTP_USER: 'test@example.invalid',
    SMTP_PASSWORD: 'test-password'
  };
  if (options.generalEnabled) env.PRIMER_ACCESO_GENERAL_ENABLED = 'true';
  const ctx = createContext({
    process: { env }, createClient: () => admin,
    randomInt: () => 12345678,
    nodemailer: { createTransport: () => ({
      sendMail: async () => {
        calls.push('sendMail');
        if (options.smtpFail) throw new Error('SMTP mock failure');
      }
    }) },
    console: { error() {} }
  });
  const handler = new Script(source + '\nhandler;', { filename: 'api/primer-acceso.js' }).runInContext(ctx);
  async function request(body, method = 'POST') {
    const res = {
      code: null, body: null,
      setHeader() { return this; },
      status(code) { this.code = code; return this; },
      json(payload) { this.body = payload; return this; }
    };
    await handler({ method, body }, res);
    return res;
  }
  return { calls, request };
}

test('rechaza métodos distintos de POST', async () => {
  const s = setup();
  assert.equal((await s.request({}, 'GET')).code, 405);
});
test('rechaza correo incorrecto antes de consultar Supabase', async () => {
  const s = setup();
  assert.equal((await s.request({ email: 'incorrecto', accion: 'solicitar' })).code, 400);
  assert.equal(s.calls.length, 0);
});
test('piloto: correo ajeno recibe respuesta uniforme sin consultar base', async () => {
  const s = setup({ issued: false });
  const r = await s.request({ email: 'desconocido@example.invalid', accion: 'solicitar' });
  assert.equal(r.code, 200);
  assert.deepEqual(s.calls, []);
});
test('piloto: deniega confirmación para otros correos sin crear Auth', async () => {
  const s = setup({ profileId: 'profile-test' });
  const r = await s.request({ email: 'otra-cuenta@example.invalid', accion: 'confirmar', codigo: '12345678', clave: 'Maestro#2026' });
  assert.equal(r.code, 400);
  assert.deepEqual(s.calls, []);
});
test('habilitación general requiere opción explícita del servidor', async () => {
  const s = setup({ issued: false, generalEnabled: true });
  const r = await s.request({ email: 'desconocido@example.invalid', accion: 'solicitar' });
  assert.equal(r.code, 200);
  assert.deepEqual(s.calls, ['primer_acceso_emitir']);
});
test('correo inscrito genera solo correo mediante el servidor', async () => {
  const s = setup({ issued: true });
  const r = await s.request({ email: 'dummy@ofl.cl', accion: 'solicitar' });
  assert.equal(r.code, 200);
  assert.deepEqual(s.calls, ['primer_acceso_emitir', 'sendMail']);
});
test('no crea cuenta con código inválido', async () => {
  const s = setup();
  const r = await s.request({ email: 'dummy@ofl.cl', accion: 'confirmar', codigo: '00000000', clave: 'Maestro#2026' });
  assert.equal(r.code, 400);
  assert.deepEqual(s.calls, ['primer_acceso_verificar']);
});
test('activa cuenta después de verificar y luego limpia el código', async () => {
  const s = setup({ profileId: 'profile-test' });
  const r = await s.request({ email: 'dummy@ofl.cl', accion: 'confirmar', codigo: '12345678', clave: 'Maestro#2026' });
  assert.equal(r.code, 200);
  assert.deepEqual(s.calls, ['primer_acceso_verificar', 'createUser', 'link', 'cleanup']);
});
test('revierte Auth si no puede vincular perfil', async () => {
  const s = setup({ profileId: 'profile-test', linkFail: true });
  const r = await s.request({ email: 'dummy@ofl.cl', accion: 'confirmar', codigo: '12345678', clave: 'Maestro#2026' });
  assert.equal(r.code, 503);
  assert.deepEqual(s.calls, ['primer_acceso_verificar', 'createUser', 'link', 'deleteUser']);
});
test('fallo SMTP no se reporta como correo entregado', async () => {
  const s = setup({ issued: true, smtpFail: true });
  const r = await s.request({ email: 'dummy@ofl.cl', accion: 'solicitar' });
  assert.equal(r.code, 503);
  assert.deepEqual(s.calls, ['primer_acceso_emitir', 'sendMail', 'primer_acceso_cancelar']);
});

for (const failure of ['cancelFail', 'cancelThrow']) {
  test(`fallo de revocación ${failure} conserva respuesta controlada`, async () => {
    const s = setup({ issued: true, smtpFail: true, [failure]: true });
    const r = await s.request({ email: 'dummy@ofl.cl', accion: 'solicitar' });
    assert.equal(r.code, 503);
    assert.deepEqual(s.calls, ['primer_acceso_emitir', 'sendMail', 'primer_acceso_cancelar']);
    assert.equal(JSON.stringify(r.body).includes('12345678'), false);
  });
}
