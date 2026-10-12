#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync('app.js','utf8');
const html = fs.readFileSync('index.html','utf8');
new vm.Script(app,{filename:'app.js'});
const revoked=[
 'admin_crear_usuario','admin_editar_usuario','admin_eliminar_usuario',
 'admin_cambiar_clave','cambiar_clave_usuario',
 'solicitar_recuperacion_clave','resetear_clave_con_token'
];
for(const name of revoked) {
  assert(!app.includes("sbApp.rpc('"+name+"'"),'RPC legacy revocada invocada en cliente: '+name);
}
assert(app.includes("sbApp.rpc('autenticar_usuario'"),'No cambiar login legacy sin migrar 27 cuentas');
const start=app.indexOf('function recuperarSesionGuardada() {');
const end=app.indexOf('function configurarEntornoUsuario()',start);
assert(start>=0 && end>start);
const restored=app.slice(start,end);
assert(!restored.includes('JSON.parse('),'No confiar en identidad serializada');
assert(restored.includes("sessionStorage.removeItem('camara_usuario_sesion')"));
assert(!/sessionStorage\.setItem\(['"]camara_usuario_sesion/.test(app),
 'No persistir identidad ni privilegio administrativo');
assert(app.includes('function verificarTokenUrl()'));
assert(!app.includes("sbApp.rpc('solicitar_recuperacion_clave'"));
assert(!app.includes("sbApp.rpc('resetear_clave_con_token'"));
assert(html.includes('admin-mantenimiento-alerta'),'Mostrar mantenimiento en consola');
assert(html.includes('qa/auth-roles.html'),'Permitir prueba aislada de Auth');
assert(html.includes('id="tabNavDoctrinaReglamentos"'));
assert(html.indexOf('id="tabNavDoctrinaReglamentos"')>html.indexOf('id="seccionAdmin"'),
 'No mostrar herramienta doctrinal en la interfaz de USER');
console.log('PASS: 7 RPC revocadas fuera del cliente, sin rol persistido, mantenimiento e interfaz separada');
