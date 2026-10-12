#!/usr/bin/env node
'use strict';

// Pruebas de regresión sin dependencias ni conexión a Supabase.
// Ejecutar desde la raíz: node tests/doctrina-politica.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const app = fs.readFileSync('app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
new vm.Script(app, { filename: 'app.js' }); // validación sintáctica completa

const start = app.indexOf('function normalizarConsultaDoctrinal(texto) {');
const end = app.indexOf('function limpiarConsultaDoctrina() {', start);
assert(start >= 0 && end > start, 'Deben existir los clasificadores temáticos');
const identificar = vm.runInNewContext(
  app.slice(start, end) + '\nidentificarContextoDoctrinal;',
  {}
);

function etiquetas(query) { return [...identificar(query)]; }
assert(etiquetas('iniciación de aprendices').some(t => t.includes('Aprendiz')));
assert(etiquetas('aumento de salario y compañero').some(t => t.includes('Compañero')));
assert(etiquetas('exaltación a maestro').some(t => t.includes('Maestro')));
assert.equal(etiquetas('conducta, virtud y justicia').length, 0);
assert.equal(etiquetas('iniciación, aumento y exaltación').length, 3);

// El módulo normativo-administrativo está únicamente dentro de la consola Superadmin.
const admin = html.indexOf('id="seccionAdmin"');
const analisis = html.indexOf('id="adminSeccionDoctrinaReglamentos"');
const nav = html.indexOf('id="tabNavDoctrinaReglamentos"');
assert(admin >= 0 && nav > admin && analisis > admin, 'Panel y botón deben residir en Superadmin');
assert.equal(html.split('id="tabNavDoctrinaReglamentos"').length, 2, 'Botón único');
assert(html.includes('>\n          Doctrina y Reglamentos\n'), 'Rótulo aprobado');
assert(app.includes("if (!usuarioActual?.es_admin) return;"), 'Guard local de consulta');
assert(app.includes("if (!usuarioActual?.es_admin) {"), 'Guard de navegación administrativa');

// Ya no hay selector de grado mínimo; todos los usuarios son Maestros.
assert(!html.includes('id="doctrinaGrado"'));
assert(html.includes('id="doctrinaContextoGrado"'));
assert(app.includes("grado_minimo: 'M'"));
assert(app.includes("contexto_grado: document.getElementById('doctrinaContextoGrado')"));
assert(app.includes('autorizacion_procesamiento_externo: false'));
assert(app.includes("pdfjsLib.getDocument({data: new Uint8Array(await archivo.arrayBuffer())})"));

// La consulta local no solicita objetos de Supabase.
const consultarStart = app.indexOf('async function consultarDoctrinaReglamentos() {');
const consultarEnd = app.indexOf('function cambiarSubseccionAdmin(seccion)', consultarStart);
const consultar = app.slice(consultarStart, consultarEnd);
assert(consultar.length > 0 && !consultar.includes("sbApp.from(") && !consultar.includes("sbApp.rpc("));
console.log('PASS: sintaxis, grado contextual, exclusividad UI Superadmin y consulta local sin Supabase');
