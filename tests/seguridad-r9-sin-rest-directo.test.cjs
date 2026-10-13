#!/usr/bin/env node
'use strict';
/**
 * R9 security contracts are backend facts verified separately in Supabase.
 * This test guards accidental reintroduction of direct untrusted REST paths.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const qa=fs.readFileSync('qa/auth-roles.html','utf8');
const api=fs.readFileSync('api/security/session.js','utf8');
const app=fs.readFileSync('app.js','utf8');

const script=qa.slice(qa.lastIndexOf('<script>')+8,qa.lastIndexOf('</script>'));
new vm.Script(script,{filename:'qa/auth-roles.html'});
new vm.Script(api,{filename:'api/security/session.js'});
new vm.Script(app,{filename:'app.js'});

for(const tabla of ['usuarios','modulos','progreso_maestro','comentarios_muro','registro_accesos','config_segura']){
  assert(!qa.includes(".from('"+tabla+"')"),'No acceso directo en QA/Auth: '+tabla);
}

const required=[
 'maestro_identidad_actual','maestro_padron_superadmin',
 'maestro_admin_trabajos_editor','maestro_admin_resumen_docencia',
 'maestro_modulos_activos','maestro_mis_progresos',
 'maestro_trabajo_estudio','maestro_publicar_comentario',
 'maestro_registrar_ingreso_auth'
];
for(const rpc of required){
  assert(qa.includes(rpc),'Falta ruta autenticada: '+rpc);
}
assert(qa.includes("if(registro.error||registro.data!==true)"),'Sin fail-closed de auditoría');
assert(qa.includes("if(profile.role!==expected)"),'Sin comprobación de rol esperado');
assert(api.includes('rpc/maestro_identidad_actual'),'La API no consulta perfil por JWT');
assert(!api.includes('SUPABASE_SERVICE_ROLE_KEY'),'La API de sesión no requiere service_role');
assert(!qa.includes('document.cookie'),'Sin credenciales en cookies en QA');
assert(!qa.includes('sessionStorage.setItem'),'Sin JWT en sessionStorage de QA');
assert(!qa.includes('localStorage.setItem'),'Sin JWT en localStorage de QA');

console.log('PASS R9: QA usa RPC autenticadas, backend JWT sin clave de servicio, auditoría fail-closed');
