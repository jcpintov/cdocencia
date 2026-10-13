#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('qa/auth-roles.html','utf8');
const adminContract=fs.readFileSync('docs/CONTRATO_FUNCIONAL_SUPERADMIN_v1.md','utf8');
const sql=fs.readFileSync('docs/sql/R7_2_BLOQUEO_PARTICIPACION_SUPERADMIN_APLICADO.sql','utf8');

const start=html.indexOf('<script>\n(() => {');
const end=html.indexOf('</script>',start);
assert(start>=0&&end>start,'No existe script QA');
new vm.Script(html.slice(start+'<script>'.length,end),{filename:'qa/auth-roles.html'});

for(const id of [
 'supervisionDocenciaAdmin','consultarSupervisionDocencia',
 'estadoSupervisionDocencia','indicadoresSupervisionDocencia',
 'tablaSupervisionContenedor','filtrarSupervisionDocencia',
 'tablaSupervisionDocencia','cuerpoSupervisionDocencia'
]){
  assert.equal(html.split('id="'+id+'"').length,2,'ID ausente/duplicado: '+id);
}

assert(adminContract.includes('SUPERADMIN no participa en Docencia'));
assert(html.includes("el('supervisionDocenciaAdmin').hidden=role!=='SUPERADMIN'"));
assert(html.includes("el('panelDocenciaAuth').hidden=role!=='USER'"));
assert(html.includes("await superadminActual()"),'Autorizar identidad antes de consultar');
assert(html.includes("current.rpc('maestro_admin_resumen_docencia')"),
 'Consumir solo la función que excluye al supervisor');
assert(html.includes("current!==client"),'Descartar solicitudes de sesión anterior');
assert(html.includes("titulo.textContent=u.nombre||'Maestro'"),
 'Nombres de usuarios se muestran como texto');
assert(html.includes("email.textContent=u.email||''"),
 'Correos de usuarios se muestran como texto');
const panelScript=html.slice(html.indexOf('function dibujarSupervisionDocencia()'),
    html.indexOf("el('logout').addEventListener"));
assert(!panelScript.includes('.innerHTML'),
 'Ningún nombre/correo desde la BD puede interpretarse como HTML');
assert(!panelScript.includes(".from('progreso_maestro')"),
 'No acceder a progresos por REST desde QA');
assert(!panelScript.includes(".from('usuarios')"),
 'No leer padrón directamente desde QA');

for(const name of ['trg_no_superadmin_progreso','trg_no_superadmin_comentarios'])
 assert(sql.includes(name));
assert(sql.includes('NEW.usuario_id'));
assert(sql.includes('u.es_admin IS TRUE'));
console.log('PASS: supervisión administrativa Auth, vista solo lectura y separación formativa USER');
