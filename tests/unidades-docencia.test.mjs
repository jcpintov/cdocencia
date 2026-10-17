import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../ui-v2.css', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../sql/20261017_unidades_docencia_catalogo.sql', import.meta.url), 'utf8');

const inicio = app.indexOf('async function consultarUnidadesDocencia()');
const fin = app.indexOf('async function renderizarCatalogoTrabajos()', inicio);
assert.ok(inicio >= 0 && fin > inicio);
const directory = runInNewContext(
  app.slice(inicio, fin) + '\n({construirDirectorioUnidadesDocencia,escaparTextoHTMLDocencia,tipoUnidadDocencia})',
  { console }
);

const unidades = [
  {codigo:'DOC100',detalle:'UNIDAD I: BASAMENTOS DOCTRINARIOS',orden:1},
  {codigo:'DOC110',detalle:'1.1 CONCEPTOS FUNDAMENTALES DEL GRADO',orden:2},
  {codigo:'DOC11A',detalle:'El concepto Hirámico del Taller',orden:3},
  {codigo:'DOC11B',detalle:'El Jefe de Obra según el modelo de Hiram',orden:4},
  {codigo:'DOC120',detalle:'1.2 LA EXALTACIÓN',orden:5},
  {codigo:'DOC12B',detalle:'Significado de la Exaltación',orden:6},
  {codigo:'DOC200',detalle:'UNIDAD II: CONOCIMIENTO SIMBÓLICO-INICIÁTICO',orden:7},
  {codigo:'DOC210',detalle:'2.1 RETEJADOR EN EL GRADO DE MAESTRO',orden:8},
  {codigo:'DOC21A',detalle:'La Batería',orden:9}
];
const trabajos = [
  {id:'aaaa-0001',titulo:'Título primero',numero_orden:1,unidad_codigo:'DOC11A'},
  {id:'bbbb-0002',titulo:'Título segundo',numero_orden:2,unidad_codigo:'DOC11A'},
  {id:'cccc-0003',titulo:'Significado de la Exaltación',numero_orden:3,unidad_codigo:'DOC12B'},
  {id:'dddd-0004',titulo:'Trabajo no clasificado',numero_orden:4,unidad_codigo:null}
];

test('base de datos: catálogo privado autenticado y códigos alfanuméricos', () => {
  assert.match(migration,/CREATE TABLE IF NOT EXISTS public\.unidades_docencia/);
  assert.match(migration,/codigo varchar\(40\) PRIMARY KEY/);
  assert.match(migration,/\^\[A-Z0-9\]\+\$/);
  assert.match(migration,/ENABLE ROW LEVEL SECURITY/);
  assert.match(migration,/FOR SELECT TO authenticated/);
  assert.match(migration,/unidad_codigo varchar\(40\)/);
  assert.match(migration,/GRANT UPDATE \(unidad_codigo\)/);
  assert.doesNotMatch(migration,/INSERT INTO public\.unidades_docencia/);
});

test('editor: unidad detalle desplegable y código autocompletado de solo lectura', () => {
  assert.match(html,/<label for="editModUnidadDetalle">Detalle:<\/label>/);
  assert.match(html,/id="editModUnidadDetalle"[^>]*onchange="actualizarCodigoUnidadEditor\(\)"/);
  assert.match(html,/id="editModUnidadCodigo"[^>]*readonly/);
  assert.match(app,/void cargarUnidadesEditorTrabajo\(moduloAuditando\.unidad_codigo \|\| '', moduloAuditando\.id\)/);
  assert.match(app,/cambios\.unidad_codigo = selectorUnidad\.value \|\| null/);
  assert.match(app,/if \(selectorUnidad\?\.dataset\.cargado === 'true'\)/);
});

test('directorio: unidades, subunidades destacadas y temas en orden', () => {
  const rendered = directory.construirDirectorioUnidadesDocencia(unidades,trabajos);
  assert.match(rendered,/UNIDAD I: BASAMENTOS DOCTRINARIOS/);
  assert.match(rendered,/1\.1 CONCEPTOS FUNDAMENTALES DEL GRADO/);
  assert.match(rendered,/UNIDAD II: CONOCIMIENTO SIMBÓLICO-INICIÁTICO/);
  assert.match(rendered,/El concepto Hirámico del Taller/);
  assert.match(rendered,/La Batería/);
  assert.match(rendered,/2 trabajos/);
  assert.match(rendered,/1 trabajo/);
  assert.match(rendered,/0 trabajos/);
  assert.equal((rendered.match(/class="catalogo-unidad-grupo"/g)||[]).length,2);
  assert.equal((rendered.match(/class="catalogo-subunidad"/g)||[]).length,3);
  assert.equal((rendered.match(/class="catalogo-unidad-varias"/g)||[]).length,1);
  assert.equal((rendered.match(/data-modulo-id="/g)||[]).length,3);
  assert.equal((rendered.match(/class="catalogo-tema-enlace"/g)||[]).length,1);
  assert.match(rendered,/class="catalogo-tema-item pendiente"/);
  assert.doesNotMatch(rendered,/Trabajo no clasificado/);
  assert.ok(rendered.indexOf('DOC100') < rendered.indexOf('DOC110'));
  assert.ok(rendered.indexOf('DOC110') < rendered.indexOf('DOC11A'));
  assert.ok(rendered.indexOf('DOC200') < rendered.indexOf('DOC210'));
});

test('directorio no crea vínculos falsos ni HTML ejecutable', () => {
  assert.equal(directory.construirDirectorioUnidadesDocencia([],trabajos),'');
  const malicious=directory.construirDirectorioUnidadesDocencia(
    [{codigo:'DOC100',detalle:'<script>alert(1)</script>',orden:1},
     {codigo:'DOC110',detalle:'Subunidad',orden:2},
     {codigo:'DOC11A',detalle:'<img src=x onerror=alert(1)>',orden:3}],
    [{id:'z',unidad_codigo:'DOC11A',titulo:'<img src=x onerror=alert(1)>',numero_orden:7}]);
  assert.doesNotMatch(malicious,/<script>|<img/);
  assert.match(malicious,/&lt;script&gt;/);
  assert.match(malicious,/&lt;img/);
});

test('selección de unidad autocompleta código y conserva valor si falla lectura', async () => {
  function elm() {return {
    dataset:{}, disabled:false, value:'', textContent:'', children:[],
    appendChild(child){this.children.push(child)},
    replaceChildren(){this.children=[]}
  }}
  const controls = {editModUnidadDetalle:elm(),editModUnidadCodigo:elm(),editModUnidadEstado:elm()};
  const document = {getElementById(id){return controls[id]},createElement(){return elm()}};
  const start=app.indexOf('async function cargarUnidadesEditorTrabajo(');
  const end=app.indexOf('function abrirAuditoriaModulo(',start);
  assert.ok(start>=0&&end>start);
  const loaded=runInNewContext(app.slice(start,end)+
    '\n({cargarUnidadesEditorTrabajo,actualizarCodigoUnidadEditor})',{
      document,moduloAuditando:{id:'test-work'},tipoUnidadDocencia:directory.tipoUnidadDocencia,consultarUnidadesDocencia:async()=>unidades
    });
  await loaded.cargarUnidadesEditorTrabajo('DOC12B','test-work');
  assert.equal(controls.editModUnidadDetalle.value,'DOC12B');
  assert.equal(controls.editModUnidadCodigo.value,'DOC12B');
  assert.equal(controls.editModUnidadDetalle.dataset.cargado,'true');
  controls.editModUnidadDetalle.value='DOC11A';
  loaded.actualizarCodigoUnidadEditor();
  assert.equal(controls.editModUnidadCodigo.value,'DOC11A');

  const failed=runInNewContext(app.slice(start,end)+
    '\n({cargarUnidadesEditorTrabajo,actualizarCodigoUnidadEditor})',{
      document,moduloAuditando:{id:'test-work'},tipoUnidadDocencia:directory.tipoUnidadDocencia,consultarUnidadesDocencia:async()=>null
    });
  await failed.cargarUnidadesEditorTrabajo('DOC12B','test-work');
  assert.equal(controls.editModUnidadDetalle.dataset.cargado,'false');
  assert.equal(controls.editModUnidadCodigo.value,'DOC12B');
});

test('presentación: código encima de unidad, directorio final responsivo', () => {
  assert.match(html,/id="gridTrabajosBienvenida"[\s\S]*id="catalogoDirectorioUnidades"/);
  assert.match(app,/class="grid-card-unidad"/);
  assert.match(app,/class="grid-card-codigo"/);
  assert.match(app,/class="grid-card-detalle"/);
  assert.match(app,/renderizarDirectorioUnidadesDocencia\(unidades, listaModulos\)/);
  assert.match(app,/if \(listaModulos\.some\(mod => mod\.id === id\)\) entrarADocenciaConModulo\(id\)/);
  assert.match(css,/#seccionCatalogoTrabajos \.catalogo-directorio-lista/);
  assert.match(css,/#modalAuditoriaModulo \.admin-unidad-campos/);
});

test('catálogo oficial CSV: 112 entradas ordenadas, 2 unidades, 17 subunidades, 93 temas',()=>{
  const sql=readFileSync(new URL('../sql/20261017_carga_catalogo_oficial_docencia.sql',import.meta.url),'utf8');
  const entradas=[...sql.matchAll(/^\s*\('([A-Z0-9]+)','((?:''|[^'])*)',(\d+),true\),?$/gm)];
  assert.equal(entradas.length,112);
  const codigos=entradas.map(x=>x[1]);
  assert.equal(new Set(codigos).size,112);
  assert.equal(codigos[0],'DOC100');
  assert.equal(codigos.at(-1),'DOC2D8');
  assert.equal(codigos.includes('DOC2A0'),true);
  assert.equal(codigos.includes('DOC2D8'),true);
  assert.equal(codigos.includes('DOC12B'),true);
  assert.match(sql,/La regularidad con fuente de reconocimiento y territorialidad docente/);
  assert.match(sql,/La Escuadra sobre el Compas/);
  const tipo=directory.tipoUnidadDocencia;
  assert.equal(codigos.filter(x=>tipo(x)==='unidad').length,2);
  assert.equal(codigos.filter(x=>tipo(x)==='subunidad').length,17);
  assert.equal(codigos.filter(x=>tipo(x)==='tema').length,93);
  assert.equal(entradas.every((x,i)=>Number(x[3])===i+1),true);
});
