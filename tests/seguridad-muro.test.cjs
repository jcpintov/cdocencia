#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8');
new vm.Script(app,{filename:'app.js'});
function bloque(desde,hasta) {
 const a=app.indexOf(desde),b=app.indexOf(hasta,a+desde.length);
 assert(a>=0&&b>a,'Rutina esperada: '+desde);
 return app.slice(a,b);
}
const rutas=[
 ['async function mostrarMuroReflexionesUsuarios() {','/* =========================================================================='],
 ['async function cargarMuroReflexiones() {','/* =========================================================================='],
 ['async function cargarMuroGeneralAdmin() {','function imprimirMuroGeneralPDF()'],
 ['async function cargarEditorDoctrinaAdmin() {','/* ==========================================================================']
];
for(const [inicio,fin] of rutas){
 const src=bloque(inicio,fin);
 assert(!/\.innerHTML\s*[+]?=/.test(src),'No se permite innerHTML con datos del usuario: '+inicio);
 assert(!src.includes('onclick='),'Los eventos deben ser listeners: '+inicio);
 assert(src.includes('textContent') || src.includes('crearTarjetaEditorDoctrina'),
   'El contenido debe renderizarse como texto: '+inicio);
}
const inicio=app.indexOf('function escaparHtmlTexto(texto) {');
const fin=app.indexOf('/* ==========================================================================',inicio);
assert(inicio>=0&&fin>inicio);
const env={};
vm.createContext(env);
vm.runInContext(app.slice(inicio,fin),env);
const render=vm.runInContext('renderizarTrazadoEnriquecido',env);
const payload='<img src=x onerror="alert(1)">& <script>alert(2)</script>';
const salida=render('INTRODUCCIÓN\n\n'+payload);
assert(salida.includes('&lt;img'));
assert(salida.includes('&lt;script'));
assert(!salida.includes('<img')&&!salida.includes('<script'));
assert(salida.includes('&amp;'));
const save=bloque('async function guardarDoctrinaAdmin() {','/* ==========================================================================');
assert(save.includes("card.querySelector('.doctrina-edit-titulo')"),
  'Debe asociar campos con cada tarjeta, incluso tras borrar tarjetas intermedias');
console.log('PASS: muros, editor y trazados no renderizan HTML de usuarios; guardado estable');
