import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const api=readFileSync(new URL('../api/admin-trabajos.js',import.meta.url),'utf8');
const sql=readFileSync(new URL('../sql/20261018_superadmin_operaciones_atomicas.sql',import.meta.url),'utf8');
test('el borrado no se efectúa desde navegador sino por API y con vista de impacto',()=>{
 const start=app.indexOf('async function eliminarModuloYReordenar(');
 const end=app.indexOf('/* ==========',start);
 const block=app.slice(start,end);
 assert.ok(start>0&&end>start);
 assert.match(block,/action:'impacto'/);
 assert.match(block,/action:'eliminar'/);
 assert.match(block,/confirmacion:'ELIMINAR '/);
 assert.doesNotMatch(block,/\.from\('modulos'\)|\.from\('progreso_maestro'\)/);
 assert.match(block,/abrirModalConfirmacion/);
});
test('backend asegura identidad, cuenta y acción destructiva confirmada',()=>{
 assert.match(api,/auth\.getUser\(token\)/);
 assert.match(api,/perfil\?\.es_admin/);
 assert.match(api,/jpintov@gmail\.com/);
 assert.match(api,/ELIMINAR '\+anterior\.numero_orden/);
 assert.match(api,/rpc\('admin_eliminar_modulo_seguro'/);
 assert.match(api,/rpc\('admin_configurar_temas_modulo'/);
 assert.match(api,/\['editar','preguntas','impacto','eliminar','vinculos'\]/);
});
test('borrado y renumeración son transaccionales y respetan UNIQUE',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.admin_eliminar_modulo_seguro/);
 assert.match(sql,/DELETE FROM public\.modulos WHERE id=p_modulo_id/);
 assert.match(sql,/numero_orden=numero_orden\+1000000/);
 assert.match(sql,/row_number\(\) OVER\(ORDER BY numero_orden,id\)/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.admin_eliminar_modulo_seguro\(uuid\) FROM PUBLIC, anon, authenticated/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.admin_eliminar_modulo_seguro\(uuid\) TO service_role/);
});
test('vínculos múltiples: mantener exactamente códigos válidos en una sola operación',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.admin_configurar_temas_modulo/);
 assert.match(sql,/p_principal=ANY\(p_codigos\)/);
 assert.match(sql,/DELETE FROM public\.modulos_temas WHERE modulo_id=p_modulo_id/);
 assert.match(sql,/INSERT INTO public\.modulos_temas\(modulo_id,codigo\)/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.admin_configurar_temas_modulo\(uuid,text,text\[\]\) FROM PUBLIC, anon, authenticated/);
 assert.match(api,/new Set\(codigos\)\.size!==codigos\.length/);
});
test('UI permite filtrar y marcar temas sin sobrescribir hasta pulsar Guardar',()=>{
 assert.match(html,/id="editModTemasFiltro"/);
 assert.match(html,/id="editModTemasLista"/);
 assert.match(html,/id="btnGuardarVinculosTrabajo"[^>]+disabled/);
 assert.match(app,/function filtrarTemasEditorTrabajo\(\)/);
 assert.match(app,/async function guardarVinculosEditorTrabajo\(\)/);
 assert.match(app,/\.from\('modulos_temas'\)\s*\.select\('codigo'\)/);
 assert.match(app,/checkbox\.checked=seleccionados\.has\(t\.codigo\)/);
 assert.match(app,/action:'vinculos'/);
});
