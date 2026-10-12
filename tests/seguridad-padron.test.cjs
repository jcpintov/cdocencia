#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app=fs.readFileSync('app.js','utf8');
const start=app.indexOf('let secuenciaCargaPadronAdmin = 0;');
const end=app.indexOf('function abrirModalCrearUsuario',start);
assert(start>0 && end>start,'Rutina segura del padrón encontrada');
const fuente=app.slice(start,end);
assert(!fuente.includes('innerHTML'),'No insertar datos del padrón mediante HTML');
assert(!fuente.includes('onclick='),'No generar onclick dinámicos');

function element(tag='div'){
 return {tag,className:'',textContent:'',children:[],listeners:{},
  appendChild(n){this.children.push(n);return n},
  addEventListener(ev,cb){this.listeners[ev]=cb},
  insertCell(){const c=element('td');this.children.push(c);return c}};
}
const tbody=element('tbody');tbody.replaceChildren=function(){this.children=[]};
tbody.insertRow=function(){const r=element('tr');this.children.push(r);return r};
const malicious=`<img src=x onerror="alert(1)"> <script>alert(2)</script>`;
const users=[
 {id:'super',nombre:'Superadmin',email:'privado@ofl.cl',es_admin:true,debe_cambiar_clave:false},
 {id:'normal',nombre:malicious,email:'maestro@example.cl',es_admin:false,debe_cambiar_clave:true}
];
const calls=[];
const sbApp={from(table){assert.equal(table,'usuarios');return {
 select(){return this},order(){return this},
 then(resolve,reject){return Promise.resolve({data:users,error:null}).then(resolve,reject)}
}}};
const ctx={document:{getElementById: id=>id==='tablaUsuariosAdminBody'?tbody:null,createElement:element},
 sbApp,usuarioActual:{id:'super',es_admin:true},
 abrirModalEditarUsuario:(...args)=>calls.push(['editar',...args]),
 abrirModalAdminClaveHermano:(...args)=>calls.push(['clave',...args]),
 confirmarEliminarUsuario:(...args)=>calls.push(['eliminar',...args]),
 console};
vm.createContext(ctx);
vm.runInContext(fuente,ctx);
(async()=>{
 await vm.runInContext('cargarListadoUsuariosAdmin()',ctx);
 assert.equal(tbody.children.length,2);
 const superActions=tbody.children[0].children[4].children[0];
 assert.equal(superActions.children.length,1,'Superadmin protegido sin acciones de cambio');
 const userRow=tbody.children[1];
 assert.equal(userRow.children[0].children[0].textContent,malicious,'El texto HTML no se interpreta');
 assert.equal(userRow.children[4].children[0].children.length,3);
 userRow.children[4].children[0].children[0].listeners.click();
 assert.deepEqual(calls[0],['editar','normal',malicious,'maestro@example.cl',false]);
 ctx.usuarioActual.es_admin=false;
 await vm.runInContext('cargarListadoUsuariosAdmin()',ctx);
 assert.equal(tbody.children.length,2,'USER no altera vista administrativa');
 console.log('PASS: padrón sin XSS, botones seguros y protección Superadmin');
})().catch(e=>{console.error(e);process.exitCode=1});
