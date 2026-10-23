import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('nombre de usuario normal activa modal para editar por id y no habilita perfil especial',()=>{
 const tramo=app.slice(app.indexOf('function renderizarPadronAdmin()'),app.indexOf('async function cargarListadoUsuariosAdmin()'));
 assert.match(tramo,/className='admin-usuario-nombre-btn'/);
 assert.match(tramo,/addEventListener\('click',\(\)=>abrirModalEditarUsuario\(u\.id\)\)/);
 assert.match(tramo,/!u\.es_admin/);
 assert.match(tramo,/renderizarAdministradoresAdmin\(\)/);
});
test('editor reutiliza el modal de alta y protege el correo vinculado a Auth',()=>{
 const tramo=app.slice(app.indexOf('function abrirModalCrearUsuario()'),app.indexOf('function confirmarEliminarUsuario()'));
 assert.match(tramo,/function abrirModalEditarUsuario\(id\)/);
 assert.match(tramo,/adminUsuarioTargetId/);
 assert.match(tramo,/readOnly = !!u\.auth_user_id/);
 assert.match(tramo,/action: editar\?'editar':'crear'/);
 assert.match(html,/id="adminUsuarioEmailInfo"/);
 assert.match(html,/id="btnGuardarUsuarioAdmin"/);
});
test('publicación del comentario usa RPC y conserva texto si el servidor falla',()=>{
 const tramo=app.slice(app.indexOf('async function enviarComentarioForo('),app.indexOf('function abrirModalEditarComentario('));
 assert.match(tramo,/sbApp\.rpc\('maestro_publicar_comentario'/);
 assert.match(tramo,/p_progreso_id: progresoId/);
 assert.match(tramo,/if \(error \|\| !comentarioId\)/);
 assert.doesNotMatch(tramo,/from\('comentarios_muro'\)\.insert/);
 assert.doesNotMatch(tramo,/api\.ipify\.org/);
 const atFailure=tramo.slice(tramo.indexOf('if (error || !comentarioId)'),tramo.indexOf('} else {',tramo.indexOf('if (error || !comentarioId)')));
 assert.doesNotMatch(atFailure,/input\.value\s*=\s*""/);
});
