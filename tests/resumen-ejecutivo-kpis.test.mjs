import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../asignaciones-admin.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../ui-v2.css',import.meta.url),'utf8');

test('Resumen Ejecutivo contiene seis KPI y trabajos se divide en tres',()=>{
 const m=html.match(/<section id="adminSeccionResumen"[\s\S]*?<div class="admin-kpi-grid admin-kpi-grid-resumen"[^>]*>([\s\S]*?)<\/div>\s*<p id="resumenAdminEstado"/);
 assert.ok(m,'se encuentra el Resumen Ejecutivo');
 const b=m[1];
 const esperado=['kpiUsuarios','kpiResumenAsignados','kpiResumenEntregados','kpiResumenPendientes','kpiCompletados','kpiComentarios'];
 assert.deepEqual([...b.matchAll(/<strong id="([^"]+)">/g)].map(x=>x[1]),esperado);
 assert.equal((b.match(/class="admin-kpi admin-kpi-accion"/g)||[]).length,6);
 assert.doesNotMatch(b,/id="kpiModulos"/);
});

test('no cambia los KPI del cronograma de trabajos por equivocación',()=>{
 const m=html.match(/id="cronogramaTrabajosAdmin"[\s\S]*?<div class="admin-kpi-grid">([\s\S]*?)<\/div>\s*<div class="cronograma-filtros"/);
 assert.ok(m,'cronograma original localizado');
 const ids=[...m[1].matchAll(/<strong id="([^"]+)">/g)].map(x=>x[1]);
 assert.deepEqual(ids,['kpiTrabajosAsignados','kpiTrabajosPendientes','kpiTrabajosVencidos','kpiTrabajosPublicados']);
});

test('Resumen cuenta reflexiones, comentarios y respuestas del Muro autorizado, sin Dummy',()=>{
 const fn=app.slice(app.indexOf('async function cargarResumenAdmin()'));
 assert.match(fn,/sbApp\.rpc\('muro_docente_autorizado',\s*\{\s*p_modulo:\s*null\s*\}\)/);
 assert.match(fn,/muro\.data\.aportes/);
 assert.match(fn,/muro\.data\.comentarios/);
 assert.match(fn,/aportesUnicos\.size/);
 assert.match(fn,/dummy@ofl\.cl/);
 assert.match(fn,/kpiResumenAsignados/);
});

test('casillas del resumen equilibradas, tres columnas y dos en pantallas estrechas',()=>{
 assert.match(css,/#adminSeccionResumen > \.admin-kpi-grid-resumen\s*\{[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:960px\)\s*\{\s*#adminSeccionResumen > \.admin-kpi-grid-resumen\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test('Asignados, Entregados y Pendientes toman cifras de asignaciones vigentes y publicación real',()=>{
 const cache=new Map();
 function get(id){
  if(!cache.has(id))cache.set(id,{textContent:'',value:id==='cronogramaFiltro'?'publicados':'',items:[],replaceChildren(){this.items=[];},appendChild(x){this.items.push(x);},setAttribute(){}});
  return cache.get(id);
 }
 const document={
  getElementById:get,
  createElement(tag){return {tag,children:[],appendChild(x){this.children.push(x);},setAttribute(){}};},
  addEventListener(){}
 };
 const window={};
 const code=js.replace(/\}\)\(\);\s*$/,"window.__testInject=(asignaciones,cargados=true)=>{datos={usuarios:[],catalogo:[],asignaciones};datosCargados=cargados;};\n})();");
 assert.notEqual(code,js);
 runInNewContext(code,{window,document,Intl,Date,Math});
 const muestra=[
  {id:'a',vigente:true,recordatorio:{publicado:true},codigo:'FILO012F',nombre:'A',tema:'A',fecha_asignacion:'2026-10-20',fecha_entrega:'2026-12-02'},
  {id:'b',vigente:true,recordatorio:{publicado:false},codigo:'FILO012E',nombre:'B',tema:'B',fecha_asignacion:'2026-10-20',fecha_entrega:'2026-12-03'},
  {id:'c',vigente:true,codigo:'FILO012D',nombre:'C',tema:'C',fecha_asignacion:'2026-10-20',fecha_entrega:'2026-12-04'},
  {id:'d',vigente:false,recordatorio:{publicado:true},codigo:'FILO012C',nombre:'D',tema:'D',fecha_asignacion:'2026-10-20',fecha_entrega:'2026-12-05'}
 ];
 window.__testInject(muestra);
 window.renderizarCronogramaAdmin();
 assert.equal(get('kpiResumenAsignados').textContent,'3');
 assert.equal(get('kpiResumenEntregados').textContent,'1');
 assert.equal(get('kpiResumenPendientes').textContent,'2');
 assert.equal(get('cronogramaLista').items.length,1,'filtro de publicados continúa operativo');
 window.__testInject(muestra,false);
 window.renderizarCronogramaAdmin();
 assert.equal(get('kpiResumenAsignados').textContent,'—');
 assert.equal(get('kpiResumenEntregados').textContent,'—');
 assert.equal(get('kpiResumenPendientes').textContent,'—');
});
