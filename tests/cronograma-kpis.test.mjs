import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../asignaciones-admin.js',import.meta.url),'utf8');

test('el cronograma contiene únicamente los KPI Asignados y Entregados',()=>{
 const match=html.match(/<section id="cronogramaTrabajosAdmin"[\s\S]*?<div class="admin-kpi-grid"[^>]*>([\s\S]*?)<\/div>\s*<div class="cronograma-filtros">/);
 assert.ok(match,'bloque KPI encontrado');
 const kpis=match[1];
 assert.equal((kpis.match(/class="admin-kpi"/g)||[]).length,2);
 assert.match(kpis,/<span>Asignados<\/span><strong id="kpiTrabajosAsignados">/);
 assert.match(kpis,/<span>Entregados<\/span><strong id="kpiTrabajosEntregados">/);
 assert.doesNotMatch(kpis,/kpiTrabajosPendientes|kpiTrabajosVencidos|kpiTrabajosPublicados/);
});

test('Entregados cuenta solo trabajos publicados con asignación vigente',()=>{
 const nodos=new Map();
 const get=id=>{
  if(!nodos.has(id))nodos.set(id,{textContent:'',value:id==='cronogramaFiltro'?'publicados':'',items:[],replaceChildren(){this.items=[];},appendChild(x){this.items.push(x);},setAttribute(){}});
  return nodos.get(id);
 };
 const doc={getElementById:get,createElement(tag){return {tag,children:[],appendChild(x){this.children.push(x);},setAttribute(){}};},addEventListener(){}};
 const win={};
 const inyectado=js.replace(/\}\)\(\);\s*$/,"window.__datosTest=(asignaciones,cargados=true)=>{datos={usuarios:[],catalogo:[],asignaciones};datosCargados=cargados;};\n})();");
 assert.notEqual(inyectado,js);
 runInNewContext(inyectado,{document:doc,window:win,Intl,Date,Math});
 const datos=[
  {id:'a',vigente:true,recordatorio:{publicado:true},codigo:'FILO012F',nombre:'A',tema:'Tema A',fecha_asignacion:'2026-10-20',fecha_entrega:'2026-12-02'},
  {id:'b',vigente:true,recordatorio:{publicado:false},codigo:'FILO012E',nombre:'B',tema:'Tema B',fecha_asignacion:'2026-10-20',fecha_entrega:'2026-12-03'},
  {id:'c',vigente:true,codigo:'FILO012D',nombre:'C',tema:'Tema C',fecha_asignacion:'2026-10-20',fecha_entrega:'2026-12-04'},
  {id:'d',vigente:false,recordatorio:{publicado:true},codigo:'FILO012C',nombre:'D',tema:'Tema D',fecha_asignacion:'2026-10-20',fecha_entrega:'2026-12-05'}
 ];
 win.__datosTest(datos);
 win.renderizarCronogramaAdmin();
 assert.equal(get('kpiTrabajosAsignados').textContent,'3');
 assert.equal(get('kpiTrabajosEntregados').textContent,'1');
 assert.equal(get('cronogramaLista').items.length,1,'se conserva filtro de publicados');
 win.__datosTest(datos,false);
 win.renderizarCronogramaAdmin();
 assert.equal(get('kpiTrabajosAsignados').textContent,'—');
 assert.equal(get('kpiTrabajosEntregados').textContent,'—');
});
