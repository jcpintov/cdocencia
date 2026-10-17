import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../ui-v2.css',import.meta.url),'utf8');
const sql=readFileSync(new URL('../sql/20261017_reemplazo_programa_cuatro_areas_y_asociaciones.sql',import.meta.url),'utf8');
const inicio=app.indexOf('async function consultarUnidadesDocencia()');
const fin=app.indexOf('async function renderizarCatalogoTrabajos()',inicio);
assert.ok(inicio>=0 && fin>inicio);
const code=app.slice(inicio,fin);
const lib=runInNewContext(code+'\n({tipoUnidadDocencia,padresCodigoDocencia,construirClasificacionTarjetaDocencia,construirDirectorioUnidadesDocencia})',{console});
const unidades=[
 {codigo:'INCI000',detalle:'CONTENIDO INICIÁTICO',orden:1},
 {codigo:'INCI0100',detalle:'UNIDAD 1: BASAMENTOS DOCTRINARIOS',orden:2},
 {codigo:'INCI0120',detalle:'1.2 LA EXALTACIÓN',orden:3},
 {codigo:'INCI012B',detalle:'Significado de la Exaltación',orden:4},
 {codigo:'INCI0130',detalle:'1.3 LAS VIRTUDES DEL GRADO DE MAESTRO',orden:5},
 {codigo:'INCI013A',detalle:'Celo',orden:6},
 {codigo:'INCI013B',detalle:'Fervor',orden:7},
 {codigo:'INCI013C',detalle:'Constancia',orden:8},
 {codigo:'INCI0200',detalle:'UNIDAD 2: CONOCIMIENTO SIMBÓLICO-INICIÁTICO',orden:9},
 {codigo:'INCI02A0',detalle:'2.10 RITUAL DE APERTURA Y CLAUSURA',orden:10},
 {codigo:'INCI02AA',detalle:'La Acacia me es conocida',orden:11},
 {codigo:'INST000',detalle:'CONTENIDO INSTITUCIONAL',orden:12},
 {codigo:'INST0100',detalle:'UNIDAD 1: HISTORIA DE LA MASONERÍA',orden:13},
 {codigo:'INST0110',detalle:'1.1 HISTORIA DE LA MASONERÍA',orden:14},
 {codigo:'INST011A',detalle:'Origen del Grado de Maestro',orden:15},
 {codigo:'FILO000',detalle:'CONTENIDO FILOSÓFICO',orden:16},
 {codigo:'ETIC000',detalle:'CONTENIDO ÉTICO',orden:17}
];
const objetivos=[
 {codigo:'INCI000',objetivo_general:'Establecer en el conocimiento del Maestro los contenidos fundamentales.'},
 {codigo:'INST000',objetivo_general:'Investigar los orígenes del Grado.'},
 {codigo:'FILO000',objetivo_general:'Construir una concepción personal.'},
 {codigo:'ETIC000',objetivo_general:'Identificar la dimensión ética.'}
];
const modulos=[
 {id:'m1',numero_orden:1,titulo:'CELO FERVOR Y CONSTANCIA.',unidad_codigo:'INCI013A',codigos_tematicos:['INCI013A','INCI013B','INCI013C']},
 {id:'m6',numero_orden:6,titulo:'SIGNIFICADO DE LA EXALTACIÓN',unidad_codigo:'INCI012B',codigos_tematicos:['INCI012B']}
];
test('175 códigos únicos, cuatro áreas, 8 unidades, 24 subunidades y 139 temas',()=>{
 const x=[...sql.matchAll(/^\s*\('((?:INCI|INST|FILO|ETIC)[0-9A-Z]{3,4})','(?:''|[^'])*',(\d+),true\)[,;]?$/gm)];
 assert.equal(x.length,175);
 const codes=x.map(a=>a[1]);assert.equal(new Set(codes).size,175);
 assert.deepEqual(codes.filter(c=>lib.tipoUnidadDocencia(c)==='area'),['INCI000','INST000','FILO000','ETIC000']);
 for(const [tipo,n] of [['unidad',8],['subunidad',24],['tema',139]])assert.equal(codes.filter(c=>lib.tipoUnidadDocencia(c)===tipo).length,n);
 assert.equal(codes.at(-1),'ETIC021F');
});
test('identifica jerarquía y códigos alfanuméricos de décima subunidad',()=>{
 assert.equal(lib.tipoUnidadDocencia('INCI000'),'area');
 assert.equal(lib.tipoUnidadDocencia('INCI02A0'),'subunidad');
 assert.equal(lib.tipoUnidadDocencia('INCI02AA'),'tema');
 assert.equal(lib.tipoUnidadDocencia('DOC12B'),'desconocido');
 const padres=lib.padresCodigoDocencia('INCI02AA');
 assert.equal(padres.area,'INCI000');
 assert.equal(padres.unidad,'INCI0200');
 assert.equal(padres.subunidad,'INCI02A0');
});
test('la tarjeta usa unidad, subunidad y tres códigos clicables si procede',()=>{
 const r=lib.construirClasificacionTarjetaDocencia(['INCI013A','INCI013B','INCI013C'],new Map(unidades.map(u=>[u.codigo,u])));
 assert.match(r,/UNIDAD 1: BASAMENTOS DOCTRINARIOS/);
 assert.match(r,/1\.3 LAS VIRTUDES DEL GRADO DE MAESTRO/);
 assert.equal((r.match(/class="grid-card-codigo-enlace"/g)||[]).length,3);
 assert.equal(lib.construirClasificacionTarjetaDocencia([],new Map()),'');
});
test('cuatro tarjetas de área presentan objetivos y bloques de temas',()=>{
 const r=lib.construirDirectorioUnidadesDocencia(unidades,modulos,objetivos);
 assert.equal((r.match(/class="docencia-area-presentacion"/g)||[]).length,4);
 assert.equal((r.match(/class="docencia-tarjeta-area"/g)||[]).length,4);
 for(const o of objetivos)assert.ok(r.includes(o.objetivo_general));
 assert.match(r,/class="docencia-grid-unidades"/);
 assert.match(r,/class="docencia-grid-subunidades"/);
 assert.match(r,/class="docencia-grid-temas"/);
 assert.doesNotMatch(r,/<ul|<li/);
});
test('un trabajo enlazado a tres temas queda accesible por tres códigos',()=>{
 const r=lib.construirDirectorioUnidadesDocencia(unidades,modulos,objetivos);
 for(const c of ['INCI013A','INCI013B','INCI013C']){
  const p=r.indexOf('data-codigo-docencia="'+c+'"');
  assert.ok(p>=0,c);
  assert.match(r.slice(p,p+600),/data-modulo-id="m1"/);
 }
 assert.match(r,/Tema por desarrollar/);
});
test('los objetivos y títulos no ejecutan HTML inyectado',()=>{
 const r=lib.construirDirectorioUnidadesDocencia(
 [{codigo:'INCI000',detalle:'<script>0</script>',orden:1}],[],
 [{codigo:'INCI000',objetivo_general:'<img onerror=alert(1)>'}]);
 assert.doesNotMatch(r,/<script>|<img/);
 assert.match(r,/&lt;script&gt;/);
 assert.match(r,/&lt;img/);
});
test('código lleva al bloque correcto con área, unidad, subunidad y tema abiertos',()=>{
 const focus=[];
 function el(n){const set=new Set();return {open:false,classList:{contains:x=>set.has(x),add:x=>set.add(x),remove:x=>set.delete(x)},hasAttribute:()=>true,setAttribute(){},scrollIntoView(){},focus(){focus.push(n)}}}
 const area=el('area'),unit=el('unit'),sub=el('sub'),topic=el('topic');
 const map={
 '.docencia-tarjeta-area[data-codigo-docencia="INCI000"]':area,
 '.docencia-tarjeta-unidad[data-codigo-docencia="INCI0100"]':unit,
 '.docencia-tarjeta-subunidad[data-codigo-docencia="INCI0120"]':sub,
 '.docencia-tarjeta-tema[data-codigo-docencia="INCI012B"]':topic};
 const obj={querySelectorAll:()=>[],querySelector:k=>map[k]||null};
 const ctx={console,document:{getElementById:k=>k==='catalogoUnidadesContenido'?obj:{classList:{contains:()=>false}}}};
 const fn=runInNewContext(code+'\nabrirProgramaDocencia;',ctx);
 fn('INCI012B');
 assert.equal(area.open,true);assert.equal(unit.open,true);assert.equal(sub.open,true);
 assert.ok(topic.classList.contains('docencia-enfoque'));assert.equal(focus[0],'topic');
});
test('editor y base de datos preservan vinculación y seguridad',()=>{
 assert.match(app,/tipo==='area'/);
 assert.match(app,/tipo==='tema'/);
 assert.match(html,/id="editModUnidadCodigo"[^>]*readonly/);
 assert.match(css,/#seccionContenidoDocente \\.docencia-areas-grid/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.areas_docencia/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.modulos_temas/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON public\.modulos_temas FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/\(1,'INCI013A'\),\(1,'INCI013B'\),\(1,'INCI013C'\)/);
});
