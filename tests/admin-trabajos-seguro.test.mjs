import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const api=readFileSync(new URL('../api/admin-trabajos.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
test('Superadmin usa identidad Auth verificada en servidor, nunca trust de rol cliente',()=>{
 assert.match(api,/auth\.getUser\(token\)/);
 assert.match(api,/eq\('auth_user_id',identity\.user\.id\)/);
 assert.match(api,/esOperador\(perfil,identity.user\)/);
 assert.match(readFileSync(new URL('../lib/roles-admin.js',import.meta.url),'utf8'),/jpintov@gmail\.com/);
 assert.match(api,/SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(api,/Se requiere administración docente/);
});
test('solo admite editar y preguntas con validación de número, campos y catálogo',()=>{
 assert.match(api,/\['editar','preguntas'\]/);
 assert.match(api,/Number\.isInteger\(numero_orden\)/);
 assert.match(api,/preguntas\.preguntas\.length!==8/);
 assert.match(api,/from\('unidades_docencia'\)/);
 assert.match(api,/Ya existe un trabajo con ese número de orden/);
});
test('la edición conserva los vínculos adicionales al mover el código principal',()=>{
 assert.match(api,/from\('modulos_temas'\)/);
 assert.match(api,/\.upsert\(\{modulo_id:id,codigo:principal\}/);
 assert.match(api,/\.delete\(\)\.eq\('modulo_id',id\)\.eq\('codigo',anterior\.unidad_codigo\)/);
});
test('el navegador ya no intenta UPDATE directo sobre modulos',()=>{
 const start=app.indexOf('async function guardarTodasPreguntasAuditoria()');
 const end=app.indexOf('function eliminarModuloYReordenar(',start);
 const block=app.slice(start,end);
 assert.ok(start>0&&end>start);
 assert.doesNotMatch(block,/\.from\('modulos'\)/);
 assert.match(block,/solicitarGuardadoTrabajoSuperadmin/);
 assert.match(app,/fetch\('\/api\/admin-trabajos'/);
 assert.match(app,/structuredClone\(moduloAuditando\.preguntas_json/);
});