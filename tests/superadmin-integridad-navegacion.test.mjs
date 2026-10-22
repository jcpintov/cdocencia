import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const migration=readFileSync(new URL('../supabase/migrations/20261022_padron_columna_filtrada_lectura_autenticada.sql',import.meta.url),'utf8');

const vistas=[
 ['resumen','tabNavResumen','adminSeccionResumen','Resumen ejecutivo'],
 ['usuarios','tabNavUsuarios','adminSeccionUsuarios','Usuarios y padrón'],
 ['cargar','tabNavCargar','adminSeccionCarga','Archivos originales'],
 ['gestion_trabajos','tabNavGestionTrabajos','adminSeccionGestionTrabajos','Trabajos y cuestionarios'],
 ['presencial','tabNavPresencial','adminSeccionPresencial','Cámara presencial'],
 ['muro_general','tabNavMuroGeneral','adminSeccionMuroGeneral','Muro docente'],
 ['metricas','tabNavMetricas','adminSeccionMetricas','Avance de los maestros'],
 ['editor_doctrina','tabNavEditorDoctrina','adminSeccionEditorDoctrina','Contenido institucional'],
 ['tenidas','tabNavTenidas','adminSeccionTenidas','Calendario de tenidas'],
 ['asignaciones','tabNavAsignaciones','adminSeccionAsignaciones','Asignación de trabajos'],
 ['doctrina','tabNavDoctrina','adminSeccionDoctrina','Doctrina y Reglamentos'],
 ['accesos','tabNavAccesos','adminSeccionAccesos','Bitácora de accesos']
];
const nav=app.slice(app.indexOf('function cambiarSubseccionAdmin(seccion) {'),app.indexOf('/* ==========================================================================\n   ASOCIACIÓN DIRECTA DE ARCHIVO ORIGINAL'));
test('12 secciones con una sola vista y un botón activo en cada navegación',()=>{
 const nodes=new Map(),calls=[];
 const get=id=>{
  if(!nodes.has(id)){
   const classes=new Set(),attrs={};
   nodes.set(id,{classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)},setAttribute:(k,v)=>attrs[k]=v,removeAttribute:k=>delete attrs[k],textContent:'',value:'',attrs,classes,focus(){}});
  }
  return nodes.get(id);
 };
 const ctx={document:{getElementById:get,activeElement:{}},window:{matchMedia:()=>({matches:false}),cargarAsignacionesAdmin:()=>calls.push('asignaciones'),cargarCalendarioTenidas:()=>calls.push('tenidas')},
  listaModulos:[],cargarResumenAdmin:()=>calls.push('resumen'),cargarListadoUsuariosAdmin:()=>calls.push('usuarios'),cargarGestionTrabajosAdmin:()=>calls.push('gestion_trabajos'),cargarMuroGeneralAdmin:()=>calls.push('muro_general'),cargarEditorDoctrinaAdmin:()=>calls.push('editor_doctrina'),cargarBitacoraAccesos:()=>calls.push('accesos'),cargarBibliotecaDoctrina:()=>{calls.push('doctrina')},cargarMetricasAvance:()=>calls.push('metricas')};
 runInNewContext(nav,ctx);
 for(const [key,button,panel,title] of vistas){
  runInNewContext('cambiarSubseccionAdmin('+JSON.stringify(key)+')',ctx);
  assert.equal(get(button).classes.has('active'),true,key+' tiene botón activo');
  assert.equal(get(button).attrs['aria-current'],'page',key+' tiene aria-current');
  assert.equal(get(panel).classes.has('hidden'),false,key+' es visible');
  assert.equal(get('adminVistaActual').textContent,title,key+' actualiza encabezado');
  assert.equal(vistas.filter(([,b])=>get(b).classes.has('active')).length,1,'solo un botón activo');
  assert.equal(vistas.filter(([, ,p])=>!get(p).classes.has('hidden')).length,1,'solo un panel visible');
 }
 const before=get('adminVistaActual').textContent;
 runInNewContext('cambiarSubseccionAdmin("inexistente")',ctx);
 assert.equal(get('adminVistaActual').textContent,before,'solicitud inválida no redirige');
 assert.ok(calls.includes('usuarios')&&calls.includes('asignaciones')&&calls.includes('doctrina'));
});

test('finalizar la carga asíncrona de trabajos no navega a resumen',async()=>{
 const extract=app.slice(app.indexOf('async function cargarDatosAdmin() {'),app.indexOf('function cambiarSubseccionAdmin(seccion) {'));
 let terminar;
 const pending=new Promise(resolve=>{terminar=resolve});
 const actor={es_admin:true,id:'superadmin'};
 const ctx={usuarioActual:actor,listaModulos:[],document:{getElementById:()=>null},
  sbApp:{from:()=>({select:()=>({eq:()=>({order:()=>pending})})})},verificarEstadoArchivoModulo:()=>{throw Error('no selectores')},
  cambiarSubseccionAdmin:()=>{throw Error('Una carga tardía no puede cambiar de sección')}};
 runInNewContext(extract,ctx);
 const carga=ctx.cargarDatosAdmin();
 terminar({data:[],error:null});
 await carga;
 assert.equal(ctx.usuarioActual,actor);
});

test('modal superpuesto cierra solamente al pulsar el fondo y no navega',()=>{
 const code=app.slice(app.indexOf('function cerrarModalUniversal(event, modalId) {'),app.indexOf('function abrirModalConfirmacion('));
 const box={tagName:'DIV',classList:{added:[],add(x){this.added.push(x)}}};
 const ctx={document:{getElementById:()=>box}};
 runInNewContext(code,ctx);
 ctx.cerrarModalUniversal({target:{id:'interno'}},'modalAuditoriaModulo');
 assert.deepEqual(box.classList.added,[]);
 ctx.cerrarModalUniversal({target:box},'modalAuditoriaModulo');
 assert.deepEqual(box.classList.added,['hidden']);
 assert.doesNotMatch(code,/cambiarSubseccionAdmin\s*\(/);
});

test('diálogos nativos cierran desde telón sin saltar de sección ni perder validaciones',()=>{
 assert.match(ui,/function prepararCierreExteriorDialogos\(/);
 assert.match(ui,/event\.target!==dialog/);
 assert.match(ui,/dialog\.dispatchEvent\(cancelar\)/);
 assert.match(ui,/cerrarTextoDoctrina\?\.\(\)/);
 assert.match(ui,/cerrarVisorDoctrina\?\.\(\)/);
 assert.doesNotMatch(ui.slice(ui.indexOf('function prepararCierreExteriorDialogos(')),/cambiarSubseccionAdmin\s*\(/);
 assert.match(html,/id="modalAuditoriaModulo"[^>]*onclick="cerrarModalUniversal\(event, 'modalAuditoriaModulo'\)"/);
});

test('la restauración no solicita /auth/v1/user sin sesión local',async()=>{
 const restore=app.slice(app.indexOf('async function recuperarSesionGuardada() {'),app.indexOf('// Encabezado compartido',app.indexOf('async function recuperarSesionGuardada() {')));
 let getUserCalls=0,removed=false;
 const ctx={versionSesion:0,sessionStorage:{removeItem(){removed=true}},sbApp:{auth:{
  getSession:async()=>({data:{session:null},error:null}),
  getUser:async()=>{getUserCalls++;throw Error('No consultar auth sin sesión')}
 }},document:{getElementById:()=>({})}};
 runInNewContext(restore,ctx);
 await ctx.recuperarSesionGuardada();
 assert.equal(getUserCalls,0);
 assert.ok(removed);
});

test('padrón: otorgar solamente SELECT de la columna usada como filtro y preservar RLS',()=>{
 assert.match(migration,/GRANT SELECT\s*\(\s*cuenta_eliminada\s*\)\s*ON\s+TABLE\s+public\.usuarios\s+TO\s+authenticated/i);
 assert.doesNotMatch(migration,/GRANT\s+SELECT\s+ON\s+(TABLE\s+)?public\.usuarios/i);
 assert.doesNotMatch(migration,/DISABLE ROW LEVEL SECURITY|TO anon|GRANT\s+SELECT\s*\([^)]*(?:clave_hash|token_recuperacion)/i);
 const fetch=app.slice(app.indexOf('async function cargarListadoUsuariosAdmin()'),app.indexOf('function abrirModalCrearUsuario()'));
 assert.match(fetch,/\.eq\('cuenta_eliminada',false\)/);
 assert.match(fetch,/error\?\.status===403/);
});

test('instrucción obsoleta de revisión manual obligatoria fue eliminada',()=>{
 assert.doesNotMatch(html,/Contraste cada página con el PDF antes de marcarla revisada/);
 assert.match(html,/El texto legible se indexa sin revisión página por página/);
});
