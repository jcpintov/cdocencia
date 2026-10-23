const permisosSource=readFileSync(new URL('../lib/roles-admin.js',import.meta.url),'utf8').replace(/^export /gm,'');
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
          if (fields === 'id,email,es_admin,rol,cuenta_eliminada') {
            return { eq: () => ({ maybeSingle: async () => ({
              data: { id: 'admin-profile', email: options.rol==='ADMIN'?options.authEmail:'jpintov@gmail.com', rol:options.rol, es_admin: options.isAdmin ?? true },
              error: null
            }) }) };
          }
          if (fields === 'id,email,es_admin,auth_user_id,rol,cuenta_eliminada') {
            return { eq: () => ({ maybeSingle: async () => {
              calls.push('target');
              return {data:options.targetMissing?null:{
                id:'22345678-1234-4234-8234-123456789abc',
                email:'persona@example.invalid',es_admin:options.targetAdmin??false,
                auth_user_id:options.targetLinked?'auth-linked':null
              },error:null};
            } }) };
          }
          return { ilike: () => ({ limit: async () => {
            calls.push('lookup');
            return { data: options.duplicate ? [{id:'exists'}] : options.lookupOwn ? [{id:'22345678-1234-4234-8234-123456789abc'}]: [], error: null };
          } }) };
        },
        insert(payload) {
          calls.push('insert');
          assert.equal(payload.auth_user_id, null);
          assert.equal(payload.clave_hash, null);
          assert.equal(payload.es_admin, false);
          return { select: () => ({ single: async () => ({ data: { id: 'new', nombre: payload.nombre, email: payload.email }, error: null }) }) };
        },
        update(payload) {
          calls.push('update');
          assert.deepEqual(Object.keys(payload).sort(),['email','nombre']);
          return {eq(){return this;},select:()=>({maybeSingle:async()=>({data:{id:'22345678-1234-4234-8234-123456789abc',...payload},error:null})})};
        }
      };
    }
  };
  const publicClient = { auth: { getUser: async () => ({ data: identity, error: null }) } };
  const ctx = createContext({
    createClient: (_url, key) => key === 'test-publishable' ? publicClient : admin,
    process: { env: { SUPABASE_URL:'https://example.invalid', SUPABASE_PUBLISHABLE_KEY:'test-publishable', SUPABASE_SERVICE_ROLE_KEY:'test-server-key' } }
  });
  const handler = new Script(permisosSource + code + '\nhandler;').runInContext(ctx);
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
test('permite ampliar el padrón incluso después de los 26 integrantes', async () => {
  const s=setup({count:26});
  const r=await s.request({action:'crear',nombre:'Nombre Prueba',email:'test@example.invalid'});
  assert.equal(r.statusCode,201);
  assert.equal(r.body.ok,true);
  assert.deepEqual(s.calls,['lookup','insert']);
});
test('permite registrar integrante sin enviar invitación ni crear credenciales', async () => {
  const s=setup({count:25});
  const r=await s.request({action:'crear',nombre:'Nombre Prueba',email:'test@example.invalid'});
  assert.equal(r.statusCode,201);
  assert.equal(r.body.ok,true);
  assert.deepEqual(s.calls,['lookup','insert']);
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

const idEdicion='22345678-1234-4234-8234-123456789abc';
test('alta normaliza prefijo QH una sola vez',async()=>{
  const s=setup();
  const r=await s.request({action:'crear',nombre:'Q.·.H.·. Nombre Prueba',email:'test@example.invalid'});
  assert.equal(r.statusCode,201);
  assert.equal(r.body.usuario.nombre,'Q.·.H.·. Nombre Prueba');
});
test('nombre sin tratamiento queda normalizado automáticamente',async()=>{
  const s=setup();
  const r=await s.request({action:'crear',nombre:'Orson Corvalán Nehme',email:'nueva@example.invalid'});
  assert.equal(r.statusCode,201);
  assert.equal(r.body.usuario.nombre,'Q.·.H.·. Orson Corvalán Nehme');
});
test('superadmin edita nombre y correo de integrante no vinculado',async()=>{
  const s=setup({lookupOwn:true});
  const r=await s.request({action:'editar',id:idEdicion,nombre:'Q.·.H.·. Orson Corvalán Nehme',email:'persona@example.invalid'});
  assert.equal(r.statusCode,200);
  assert.equal(r.body.usuario.nombre,'Q.·.H.·. Orson Corvalán Nehme');
  assert.deepEqual(s.calls,['target','lookup','update']);
});
test('rechaza cambios de correo de usuario vinculado a Auth',async()=>{
  const s=setup({targetLinked:true});
  const r=await s.request({action:'editar',id:idEdicion,nombre:'Nombre Nuevo',email:'otro@example.invalid'});
  assert.equal(r.statusCode,422);
  assert.deepEqual(s.calls,['target']);
});
test('no permite edición de perfil administrativo',async()=>{
  const s=setup({targetAdmin:true});
  const r=await s.request({action:'editar',id:idEdicion,nombre:'Nombre Nuevo',email:'persona@example.invalid'});
  assert.equal(r.statusCode,403);
  assert.deepEqual(s.calls,['target']);
});
test('rechaza edición de un correo ocupado por otro integrante',async()=>{
  const s=setup({duplicate:true});
  const r=await s.request({action:'editar',id:idEdicion,nombre:'Nombre Nuevo',email:'persona@example.invalid'});
  assert.equal(r.statusCode,409);
  assert.deepEqual(s.calls,['target','lookup']);
});

test('Administrador crea y edita usuarios ordinarios, pero protege cuentas administrativas',async()=>{const s=setup({rol:'ADMIN',authEmail:'delegado@example.invalid'});assert.equal((await s.request({action:'crear',nombre:'Nombre Prueba',email:'test@example.invalid'})).statusCode,201);assert.equal((await s.request({action:'editar',id:idEdicion,nombre:'Nombre Prueba',email:'persona@example.invalid'})).statusCode,200);const protegido=setup({rol:'ADMIN',authEmail:'delegado@example.invalid',targetAdmin:true});assert.equal((await protegido.request({action:'editar',id:idEdicion,nombre:'Nombre Prueba',email:'persona@example.invalid'})).statusCode,403);assert.deepEqual(protegido.calls,['target']);});
