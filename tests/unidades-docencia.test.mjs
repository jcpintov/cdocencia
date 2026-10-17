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
  app.slice(inicio, fin) + '\n({construirDirectorioUnidadesDocencia,escaparTextoHTMLDocencia})',
  { console }
);

const unidades = [
  {codigo:'U01',detalle:'Simbología de la Maestría',orden:1},
  {codigo:'U02',detalle:'Compromiso ético',orden:2},
  {codigo:'U03',detalle:'Unidad aún pendiente',orden:3}
];
const trabajos = [
  {id:'aaaa-0001',titulo:'Título primero',numero_orden:1,unidad_codigo:'U01'},
  {id:'bbbb-0002',titulo:'Título segundo',numero_orden:2,unidad_codigo:'U01'},
  {id:'cccc-0003',titulo:'Obligaciones',numero_orden:3,unidad_codigo:'U02'},
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

test('directorio generado por códigos: uno vincula tema, varios muestran tarjetas', () => {
  const rendered = directory.construirDirectorioUnidadesDocencia(unidades,trabajos);
  assert.match(rendered,/Simbología de la Maestría/);
  assert.match(rendered,/Compromiso ético/);
  assert.match(rendered,/Unidad aún pendiente/);
  assert.match(rendered,/2 trabajos/);
  assert.match(rendered,/1 trabajo/);
  assert.match(rendered,/0 trabajos/);
  assert.equal((rendered.match(/class="catalogo-unidad-varias"/g)||[]).length,1);
  assert.equal((rendered.match(/data-modulo-id="/g)||[]).length,3);
  assert.equal((rendered.match(/<strong>/g)||[]).length,3);
  assert.doesNotMatch(rendered,/Trabajo no clasificado/);
  assert.match(rendered,/Todavía no hay trabajos publicados/);
});

test('directorio no crea vínculos falsos ni HTML ejecutable', () => {
  assert.equal(directory.construirDirectorioUnidadesDocencia([],trabajos),'');
  const malicious=directory.construirDirectorioUnidadesDocencia(
    [{codigo:'A1',detalle:'<script>alert(1)</script>',orden:1}],
    [{id:'z',unidad_codigo:'A1',titulo:'<img src=x onerror=alert(1)>',numero_orden:7}]);
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
      document,moduloAuditando:{id:'test-work'},consultarUnidadesDocencia:async()=>unidades
    });
  await loaded.cargarUnidadesEditorTrabajo('U02','test-work');
  assert.equal(controls.editModUnidadDetalle.value,'U02');
  assert.equal(controls.editModUnidadCodigo.value,'U02');
  assert.equal(controls.editModUnidadDetalle.dataset.cargado,'true');
  controls.editModUnidadDetalle.value='U01';
  loaded.actualizarCodigoUnidadEditor();
  assert.equal(controls.editModUnidadCodigo.value,'U01');

  const failed=runInNewContext(app.slice(start,end)+
    '\n({cargarUnidadesEditorTrabajo,actualizarCodigoUnidadEditor})',{
      document,moduloAuditando:{id:'test-work'},consultarUnidadesDocencia:async()=>null
    });
  await failed.cargarUnidadesEditorTrabajo('U02','test-work');
  assert.equal(controls.editModUnidadDetalle.dataset.cargado,'false');
  assert.equal(controls.editModUnidadCodigo.value,'U02');
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
