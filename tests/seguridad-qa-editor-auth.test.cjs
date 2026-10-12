#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('qa/auth-roles.html','utf8');
const app = fs.readFileSync('app.js','utf8');
const start = html.indexOf('<script>\n(() => {');
const end = html.indexOf('</script>',start);
assert(start >= 0 && end > start,'Debe existir script local del laboratorio');
new vm.Script(html.slice(start+'<script>'.length,end),{filename:'qa/auth-roles.html'});
new vm.Script(app,{filename:'app.js'});

for(const id of [
 'editorDocenteAuth','editorFormularioAuth','editorModuloSelector','editorTitulo',
 'editorAutor','editorTexto','cargarTrabajosAuth','guardarTextoAuth','guardarPreguntasAuth',
 'preguntasContenidoAuth','estadoEditorAuth'
]) {
 assert.equal(html.split('id="'+id+'"').length,2,'ID único: '+id);
}
assert(html.includes("el('editorDocenteAuth').hidden=role!=='SUPERADMIN'"));
assert(html.includes("resultado.data[0].rol==='SUPERADMIN'"));
assert(html.includes("await client.rpc('maestro_identidad_actual')"));
assert(html.includes("await client.rpc(nombre,payload)"));
assert(html.includes("window.confirm('CONFIRMAR CAMBIO REAL:"));
assert(html.includes("'maestro_admin_editar_trabajo'"));
assert(html.includes("'maestro_admin_actualizar_preguntas'"));
assert(html.includes("p_bateria:{preguntas}"));
assert(html.includes("auth:{persistSession:false"),'Token de QA no se persiste');
assert(!html.includes('localStorage.setItem('),'No persistir JWT en localStorage');
assert(!html.includes('sessionStorage.setItem('),'No persistir JWT en sessionStorage');

const editor=html.slice(html.indexOf('function dibujarPreguntas('),html.indexOf("el('logout').addEventListener"));
assert(!editor.includes('.innerHTML'),'El editor no debe interpretar contenido como HTML');
assert(editor.includes("n.textContent=String(texto??'')"));
assert(editor.includes("input.value=String(valor??'')"));
assert(editor.includes("preguntas.length!==8"),'Batería limitada a ocho preguntas');
assert(html.includes("el('padronSuperadminLab').hidden=role!=='SUPERADMIN'"));

const blocked=['admin_crear_usuario','admin_editar_usuario','admin_eliminar_usuario',
 'admin_cambiar_clave','cambiar_clave_usuario',
 'solicitar_recuperacion_clave','resetear_clave_con_token'];
for(const name of blocked)
 assert(!app.includes("sbApp.rpc('"+name+"'"),'No reabrir RPC legacy: '+name);
for(const id of ['bitacoraAdminAuth','cargarBitacoraAuth','ocultarGmailAuth','ocultarHotmailAuth','estadoBitacoraAuth']) {
  assert.equal(html.split('id="'+id+'"').length,2,'ID bitácora único: '+id);
}
assert(html.includes("el('bitacoraAdminAuth').hidden=role!=='SUPERADMIN'"));
assert(html.includes("await client.rpc('maestro_admin_bitacora')"));
assert(html.includes("el('ocultarGmailAuth').checked"));
assert(html.includes("el('ocultarHotmailAuth').checked"));
assert(html.includes('Los filtros no eliminan datos históricos.'));
assert(!html.includes("client.from('registro_accesos')"),
  'Bitácora debe consultarse mediante RPC autenticada');

assert(!html.includes('tabNavDoctrinaReglamentos'),
 'El laboratorio de Auth no debe exponer el módulo doctrinal');

console.log('PASS: formulario QA Superadmin, doble autorización y ocho preguntas; sin JS inseguro ni persistencia de JWT');
