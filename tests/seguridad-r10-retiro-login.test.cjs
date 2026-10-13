#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8');
const sourceSQL=fs.readFileSync('docs/sql/R10_CORTE_LEGACY_AUTENTICAR_USUARIO_APLICADO_20261013.sql','utf8');
const guide=fs.readFileSync('docs/CHECKPOINT_R10_CORTE_LOGIN_LEGACY_20261013.md','utf8');
new vm.Script(app,{filename:'app.js'});
assert(!/\.rpc\s*\(\s*['"]autenticar_usuario['"]/.test(app),
  'No se permite intentar el inicio de sesión heredado');
assert(sourceSQL.includes('REVOKE EXECUTE ON FUNCTION public.autenticar_usuario(text,text)'),
  'El historial de corte debe registrar la firma exacta');
assert(guide.includes('anon')&&guide.includes('authenticated')&&guide.includes('service_role'),
  'El checkpoint debe recoger privilegios y consecuencia funcional');

const start=app.indexOf('async function iniciarSesion() {');
const end=app.indexOf('\nasync function registrarIngresoAuditoria(',start);
assert(start>0&&end>start,'Conservar el hook de login sin ejecutar RPC legacy');
const nodes={inputClave:{value:'contra-no-debe-enviarse'},errorLogin:{innerText:''}};
const ctx={
 document:{getElementById:(id)=>nodes[id]||null},
 sessionStorage:{removeItem(k){assert.equal(k,'camara_usuario_sesion')}},
 usuarioActual:{id:'FORGED',es_admin:true}
};
vm.createContext(ctx);
vm.runInContext(app.slice(start,end),ctx);
(async()=>{
 await vm.runInContext('iniciarSesion()',ctx);
 assert.equal(nodes.inputClave.value,'','La contraseña debe borrarse');
 assert.equal(ctx.usuarioActual,null,'No se puede conservar rol heredado');
 assert(nodes.errorLogin.innerText.includes('Supabase Auth'),'Debe informar el nuevo mecanismo');
 console.log('PASS R10: login legacy sin llamadas RPC, contraseña limpia y rol local invalidado');
})().catch(e=>{console.error(e);process.exitCode=1});
