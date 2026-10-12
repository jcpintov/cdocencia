#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const app=fs.readFileSync('app.js','utf8');
new vm.Script(app,{filename:'app.js'});
const start=app.indexOf('function validarSeguridadClave(clave) {');
const end=app.indexOf('function alternarVisibilidadClaveLogin()',start);
const generator=app.slice(start,end);
assert(start>=0&&end>start);
assert(!generator.includes('Math.random() *'),'No recurrir a Math.random para credenciales');
const context={crypto:webcrypto};
vm.createContext(context);
vm.runInContext(generator,context);
const vals=new Set();
for(let i=0;i<120;i++){
 const clave=vm.runInContext('generarClaveAleatoriaSegura()',context);
 assert.equal(clave.length,16);
 assert.equal(vm.runInContext('validarSeguridadClave('+JSON.stringify(clave)+')',context),null);
 assert.match(clave,/[!@#$%*?]/);
 vals.add(clave);
}
assert.equal(vals.size,120,'No duplicar claves en una muestra básica');
const autostart=app.indexOf('async function autogenerarAdminClaveHermano() {');
const autoend=app.indexOf('async function guardarAdminClaveHermano()',autostart);
const source=app.slice(autostart,autoend);
assert(source.includes('if (!usuarioActual?.es_admin || !input) return'));
assert(!source.includes('alert('),'No divulgar claves en alertas');
console.log('PASS: claves de 16 caracteres, crypto.getRandomValues, validación y no exposición en alertas');
