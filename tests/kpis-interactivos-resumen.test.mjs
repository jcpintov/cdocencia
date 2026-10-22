import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const asignaciones=readFileSync(new URL('../asignaciones-admin.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../ui-v2.css',import.meta.url),'utf8');

const kpis=[
 ['usuarios','kpiUsuarios','Usuarios','usuarios'],
 ['asignados','kpiResumenAsignados','Asignados','asignaciones'],
 ['entregados','kpiResumenEntregados','Entregados','asignaciones'],
 ['pendientes','kpiResumenPendientes','Pendientes','asignaciones'],
 ['completados','kpiCompletados','Completados','metricas'],
 ['comentarios','kpiComentarios','Comentarios','muro_general']
];
test('los seis KPI del resumen son botones reales accesibles por ratón, tacto y teclado',()=>{
 const section=html.slice(html.indexOf('id="adminSeccionResumen"'),html.indexOf('id="cronogramaTrabajosAdmin"'));
 for(const [key,id,title] of kpis){
  const re=new RegExp('<button[^>]*class="admin-kpi admin-kpi-accion"[^>]*onclick="abrirDetalleKpiResumen\\(\\x27'+key+'\\x27\\)"[^>]*>\\s*<span>'+title+'</span>\\s*<strong id="'+id+'">');
  assert.match(section,re,'KPI '+key+' con botón y cantidad');
 }
 assert.equal((section.match(/class="admin-kpi admin-kpi-accion"/g)||[]).length,6);
 assert.match(css,/\.admin-kpi-accion:focus-visible/);
});

test('cada KPI navega a su destino; las asignaciones reciben filtro antes de cargar',()=>{
 const source=app.slice(app.indexOf('function abrirDetalleKpiResumen('),app.indexOf('async function cargarResumenAdmin()'));
 const actor={es_admin:true},filter={value:'indeterminado'},anuladas={checked:true};
 const focus=[],views=[];
 const ctx={
  usuarioActual:actor,
  document:{getElementById:id=>id==='asignacionesEstadoFiltro'?filter:id==='asignacionesVerAnuladas'?anuladas:
   id==='adminVistaActual'?{focus:()=>focus.push('foco'),scrollIntoView:()=>focus.push('scroll')}:null},
  cambiarSubseccionAdmin:dest=>views.push({dest,filtro:filter.value,anuladas:anuladas.checked})
 };
 runInNewContext(source,ctx);
 for(const [key,,,destination] of kpis){
  filter.value='indeterminado';anuladas.checked=true;
  ctx.abrirDetalleKpiResumen(key);
  assert.equal(views.at(-1).dest,destination,key);
  if(destination==='asignaciones'){
   assert.equal(views.at(-1).filtro,key==='entregados'?'entregados':key==='pendientes'?'pendientes':'todos');
   assert.equal(views.at(-1).anuladas,false);
  }
 }
 assert.equal(views.length,6);
 assert.equal(focus.length,12);
 ctx.abrirDetalleKpiResumen('no_existe');
 assert.equal(views.length,6);
 ctx.usuarioActual={es_admin:false};
 ctx.abrirDetalleKpiResumen('usuarios');
 assert.equal(views.length,6,'usuario no administrativo no puede usar el atajo');
});

test('en Asignaciones hay filtros por vigencia y por publicación del trabajo',()=>{
 assert.match(html,/id="asignacionesEstadoFiltro"/);
 for(const key of ['todos','entregados','pendientes'])assert.match(html,new RegExp('<option value="'+key+'">'));
 assert.match(asignaciones,/if\(filtro==='entregados'\)return a\.vigente&&estadoTrabajo\(a\)==='Publicado'/);
 assert.match(asignaciones,/if\(filtro==='pendientes'\)return a\.vigente&&estadoTrabajo\(a\)!=='Publicado'/);
 assert.match(asignaciones,/if\(\$\('asignacionesEstadoFiltro'\)\)\$\('asignacionesEstadoFiltro'\)\.value='todos'/);
 assert.match(asignaciones,/recordatorio\?\.publicado/);
});

test('clic de Comentarios muestra efectivamente comentarios y respuestas, no solo reflexiones',async()=>{
 const source=app.slice(app.indexOf('async function cargarMuroGeneralAdmin() {'),app.indexOf('function imprimirMuroGeneralPDF()'));
 class Elemento{
  constructor(tag){this.tag=tag;this.children=[];this.className='';this.textContent='';this.attrs={};}
  appendChild(el){this.children.push(el);return el;}
  replaceChildren(){this.children=[];}
 }
 const nodes=new Map();
 const get=id=>{if(!nodes.has(id))nodes.set(id,new Elemento('div'));return nodes.get(id)};
 const actor={id:'superadmin',es_admin:true};
 const aportes=[{id:'progreso-1',reflexion:'Pensamiento de prueba',completado_en:'2026-10-01T12:00:00Z',modulos:{numero_orden:3,titulo:'La acacia'},usuarios:{nombre:'Christian Rubio'}}];
 const comentarios=[
  {id:'comentario-1',progreso_id:'progreso-1',contenido:'Aporte crítico',creado_en:'2026-10-03T12:00:00Z',usuarios:{nombre:'Julio Pinto'},comentario_padre_id:null},
  {id:'comentario-2',progreso_id:'progreso-1',contenido:'Respuesta a Christian',creado_en:'2026-10-04T12:00:00Z',usuarios:{nombre:'Julio Pinto'},comentario_padre_id:'comentario-1'}
 ];
 const ctx={usuarioActual:actor,Map,Date,document:{getElementById:get,createElement:tag=>new Elemento(tag)},
  sbApp:{rpc:async()=>({data:{aportes,comentarios},error:null})},
  formatearNombreHermano:x=>'Q.·.H.·. '+x
 };
 runInNewContext(source,ctx);
 await ctx.cargarMuroGeneralAdmin();
 assert.equal(get('contenedorMuroGeneralAdmin').children.length,1);
 assert.equal(get('muroAdminInteraccionesLista').children.length,2);
 assert.match(get('muroAdminInteraccionesEstado').textContent,/1 reflexiones y 2 comentarios\/respuestas/);
 const rendered=get('muroAdminInteraccionesLista').children;
 assert.match(rendered[0].children[0].children[0].textContent,/Respuesta · Trabajo 3/);
 assert.equal(rendered[0].children[1].textContent,'Respuesta a Christian');
 assert.equal(rendered[1].children[1].textContent,'Aporte crítico');
 assert.doesNotMatch(source,/innerHTML\s*\+=/);
});

test('la numeración de los KPI originales se conserva y no se duplica el contador',()=>{
 const source=app.slice(app.indexOf('async function cargarResumenAdmin()'),app.indexOf('async function eliminarCuentaDummy(',app.indexOf('async function cargarResumenAdmin()')));
 for(const [,id] of kpis)assert.match(source,new RegExp(id));
 assert.match(source,/muro\.data\.comentarios/);
 assert.match(source,/muro\.data\.aportes/);
 assert.match(asignaciones,/kpiResumenEntregados/);
});
