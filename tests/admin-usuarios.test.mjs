import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const raw = readFileSync(new URL('../api/admin-usuarios.js', import.meta.url), 'utf8');
const code = raw.replace(/^import\s+.*?;\s*$/gm, '')
  .replace('export default async function handler', 'async function handler');
assert.notEqual(raw, code);

function setup(options = {}) {
  const calls = [];
  const identity = { user: { id: 'auth-admin', email: options.authEmail ?? 'jpintov@gmail.com' } };
  const admin = {
    from(table) {
      assert.equal(table, 'usuarios');
      return {
        select(fields, opts) {
          if (opts?.head) {
            return { eq: () => ({ neq: async () => {
              calls.push('count');
              return { count: options.count ?? 26, error: null };
            } }) };
          }
          if (fields === 'id,email,es_admin') {
            return { eq: () => ({ maybeSingle: async () => ({
              data: { id: 'admin-profile', email: 'jpintov@gmail.com', es_admin: options.isAdmin ?? true },
              error: null
            }) }) };
          }
          return { ilike: () => ({ limit: async () => {
            calls.push('lookup');
            return { data: options.duplicate ? [{id:'exists'}] : [], error: null };
          } }) };
        },
        insert(payload) {
          calls.push('insert');
          assert.equal(payload.auth_user_id, null);
          assert.equal(payload.clave_hash, null);
          assert.equal(payload.es_admin, false);
          return { select: () => ({ single: async () => ({ data: { id: 'new', nombre: payload.nombre, email: payload.email }, error: null }) }) };
        }
      };
    }
  };
  const publicClient = { auth: { getUser: async () => ({ data: identity, error: null }) } };
  const ctx = createContext({
    createClient: (_url, key) => key === 'test-publishable' ? publicClient : admin,
    process: { env: { SUPABASE_URL:'https://example.invalid', SUPABASE_PUBLISHABLE_KEY:'test-publishable', SUPABASE_SERVICE_ROLE_KEY:'test-server-key' } }
  });
  const handler = new Script(code + '\nhandler;').runInContext(ctx);
  async function request(body, token='Bearer test') {
    const res = {
      statusCode: null, body: null,
      setHeader() { return this; },
      status(n) { this.statusCode=n; return this; },
      json(v) { this.body=v; return this; }
    };
    await handler({ method: 'POST', headers: { authorization: token }, body }, res);
    return res;
  }
  return { calls, request };
}

test('deniega solicitudes sin sesión', async () => {
  const s=setup();
  assert.equal((await s.request({action:'crear'},'')).statusCode,401);
  assert.deepEqual(s.calls,[]);
});
test('deniega identidades ajenas a la cuenta superadmin', async () => {
  const s=setup({authEmail:'otra@example.invalid'});
  assert.equal((await s.request({action:'crear',nombre:'Nombre Prueba',email:'test@example.invalid'})).statusCode,403);
  assert.deepEqual(s.calls,[]);
});
test('padrón lleno rechaza nuevos integrantes', async () => {
  const s=setup({count:26});
  const r=await s.request({action:'crear',nombre:'Nombre Prueba',email:'test@example.invalid'});
  assert.equal(r.statusCode,409);
  assert.deepEqual(s.calls,['lookup','count']);
});
test('permite registrar integrante cuando hay cupo, sin crear credenciales', async () => {
  const s=setup({count:25});
  const r=await s.request({action:'crear',nombre:'Nombre Prueba',email:'test@example.invalid'});
  assert.equal(r.statusCode,201);
  assert.equal(r.body.ok,true);
  assert.deepEqual(s.calls,['lookup','count','insert']);
});
test('no reintroduce acción antigua de activación', async () => {
  const s=setup();
  assert.equal((await s.request({action:'activar',usuario_id:'x'})).statusCode,400);
  assert.deepEqual(s.calls,[]);
});
test('no permite duplicar correos existentes', async () => {
  const s=setup({duplicate:true,count:25});
  assert.equal((await s.request({action:'crear',nombre:'Nombre Prueba',email:'test@example.invalid'})).statusCode,409);
  assert.deepEqual(s.calls,['lookup']);
});
