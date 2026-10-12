#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('qa/auth-roles.html','utf8');
const app = fs.readFileSync('app.js','utf8');
const start = html.indexOf('<script>\n(() => {');
const end = html.indexOf('</script>',start);
assert(start > 0 && end > start,'Script de laboratorio disponible');
const qaScript=html.slice(start+'<script>'.length,end);
new vm.Script(qaScript,{filename:'qa/auth-roles.html'});
new vm.Script(app,{filename:'app.js'});

const elements=[
 'panelDocenciaAuth','cargarMiDocenciaAuth','estadoMiDocenciaAuth',
 'resumenMiDocenciaAuth','interaccionMiDocenciaAuth','selectTrabajoMiDocenciaAuth',
 'verComentariosMiDocenciaAuth','marcarLecturaAuth','listaComentariosMiDocenciaAuth',
 'contenidoComentarioAuth','guardarComentarioAuth','cancelarEdicionComentarioAuth',
 'modoComentarioAuth'
];
for(const id of elements){
 assert.equal(html.split('id="'+id+'"').length,2,'ID único: '+id);
}
assert(qaScript.includes("el('panelDocenciaAuth').hidden=!role"),'Ningún acceso sin sesión');
for(const rpc of [
 'maestro_identidad_actual','maestro_mis_progresos','maestro_modulos_activos',
 'maestro_comentarios_modulo','maestro_marcar_lectura','maestro_publicar_comentario',
 'maestro_editar_comentario_propio'
])assert(qaScript.includes("'"+rpc+"'"),'RPC autenticada requerida: '+rpc);
assert(qaScript.includes("!await verificarIdentidadDocencia()"),'Perfil revalidado antes de escribir');
assert(qaScript.includes("data[0].rol===el('role').textContent"),
 'No aceptar roles diferentes entre cliente y servidor');
assert(qaScript.includes("!progreso?.completado"),'Reserva docente antes de comentar');
assert(qaScript.includes("progreso.progreso_id"),'Solo progreso propio desde Auth');
assert(qaScript.includes("p_modulo_id:id"),'Consultar módulo seleccionado');
assert(qaScript.includes("c.es_autor"),'Solo permitir edición del propio comentario');
assert(qaScript.includes("window.confirm("),'Confirmación de escrituras reales');
assert(qaScript.includes("let lecturaRegistrada=false"),'Refrescar solo después de registrar lectura');
assert(qaScript.includes("if(lecturaRegistrada&&actual===client)"),
 'Refresco después de liberar bloqueo');
const ix=qaScript.indexOf('function obtenerTrabajoMiDocencia()');
const ui=qaScript.slice(ix);
assert(!ui.includes('.innerHTML'),'Nunca interpretar comentarios como HTML');
assert(ui.includes("cuerpo.textContent=c.contenido||''"),'Comentarios se renderizan como texto');
assert(!ui.includes(".from('progreso_maestro')"),'QA no consulta la tabla de progresos');
assert(!ui.includes(".from('comentarios_muro')"),'QA no consulta la tabla de comentarios');
assert(!html.includes("localStorage.setItem("));
assert(!html.includes("sessionStorage.setItem("));
assert(!html.includes('Doctrina y Reglamentos</button>'),'No crear botón doctrinal USER');
console.log('PASS: pantalla Auth de avances propios, reserva docente, comentario propio y confirmación');
