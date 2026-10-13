#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const app = fs.readFileSync('app.js','utf8');
const qa = fs.readFileSync('qa/auth-roles.html','utf8');
const adminContract = fs.readFileSync('docs/CONTRATO_FUNCIONAL_SUPERADMIN_v1.md','utf8');
const userContract = fs.readFileSync('docs/CONTRATO_FUNCIONAL_USER_MAESTRO_v1.md','utf8');
const dbMigration = fs.readFileSync('docs/sql/R7_2_BLOQUEO_PARTICIPACION_SUPERADMIN_APLICADO.sql','utf8');
const r7Functions = fs.readFileSync('docs/sql/R7_FUNCIONES_AUTH_DOCENCIA_VERIFICADAS_20261012.sql','utf8');

new vm.Script(app,{filename:'app.js'});
const start = qa.indexOf('<script>\n(() => {'), end = qa.indexOf('</script>',start);
assert(start >= 0 && end > start);
new vm.Script(qa.slice(start+'<script>'.length,end),{filename:'qa/auth-roles.html'});

assert(adminContract.includes('SUPERADMIN no participa en Docencia'));
assert(userContract.includes('Solo `USER` participa en Docencia'));
assert(qa.includes("el('panelDocenciaAuth').hidden=role!=='USER'"),
  'La interfaz de participación debe estar oculta para SUPERADMIN');
assert(qa.includes("el('role').textContent!=='USER'"),
  'Las operaciones de participante deben validar el rol USER');
assert(qa.includes("data[0].rol===el('role').textContent"),
  'La UI debe contrastar identidad con el servidor');
const enter = app.indexOf('function entrarADocenciaConModulo(');
const after = app.slice(enter,enter+350);
assert(enter>=0 && after.includes('usuarioActual.es_admin) return'),
  'La navegación legacy de SUPERADMIN no puede entrar a clases');

for(const name of [
 'trg_no_superadmin_progreso','trg_no_superadmin_comentarios'
]) assert(dbMigration.includes('CREATE TRIGGER '+name),'Falta trigger: '+name);
assert(dbMigration.includes('NEW.usuario_id'),'La regla debe validar al titular real de la fila');
assert(dbMigration.includes('u.es_admin IS TRUE'),'La exclusión usa el rol respaldado por BD');
assert(dbMigration.includes('BEFORE INSERT OR UPDATE'),'Se protegen altas y cambios de atribución');
assert(dbMigration.includes('SECURITY DEFINER SET search_path='),
  'Validación interna separada del cliente');

const eight = [
 'maestro_modulos_activos','maestro_mis_progresos','maestro_marcar_lectura',
 'maestro_comentarios_modulo','maestro_publicar_comentario',
 'maestro_editar_comentario_propio','maestro_registrar_evaluacion',
 'maestro_consagrar_reflexion'
];
for(const name of eight){
 const marker='FUNCTION public.'+name+'(';
 assert(r7Functions.includes(marker),'Función R7 ausente: '+name);
}
console.log('PASS: roles SUPERADMIN/USER separados en UI, contratos y barreras SQL de avance/comentarios');
