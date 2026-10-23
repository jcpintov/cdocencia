import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../ui-v2.css',import.meta.url),'utf8');

const begin=app.indexOf('function obtenerNombreFirmaTrabajo(autor) {');
const end=app.indexOf('/* ==========================================================================',begin);
assert.ok(begin>=0&&end>begin,'El editor conserva normalización y renderer independientes');
const {normalizarCierreTrabajo,renderizarTrazadoEnriquecido}=runInNewContext(
  app.slice(begin,end)+'\n({normalizarCierreTrabajo,renderizarTrazadoEnriquecido})',{});

const pie=(nombre)=>'\n\nS.·.F.·.U.·.\n\n'+nombre+'\n\n';

test('normaliza 5 cierres existentes, retira trato Q.·.H.·. y es idempotente',()=>{
  for(const nombre of ['Juan Eduardo Iturriaga Osses','Edinson Arancibia Oro','Christian Rubio Palma','Ricardo Pérez González','Claudio Hernández Díaz']){
    for(const hueco of ['\n','\n\n']){
      const origen='Primer párrafo.\n\nSegundo párrafo.\n\nS.·.F.·.U.·.'+hueco+nombre;
      const esperado='Primer párrafo.\n\nSegundo párrafo.'+pie(nombre);
      const normal=normalizarCierreTrabajo(origen,'Q.·.H.·. '+nombre);
      assert.equal(normal,esperado);
      assert.equal(normalizarCierreTrabajo(normal,'Q.·.H.·. '+nombre),normal);
    }
  }
});

test('agrega firma de autor cuando el trabajo solo termina con el saludo',()=>{
  const origen='Reflexión final.\n\nS.·.F.·.U.·.';
  const resultado=normalizarCierreTrabajo(origen,'Hugo Adolfo Tapia Romero');
  assert.equal(resultado,'Reflexión final.'+pie('Hugo Adolfo Tapia Romero'));
  assert.equal(normalizarCierreTrabajo(resultado,'Hugo Adolfo Tapia Romero'),resultado);
});

test('no destruye párrafos ni contenido, respeta CRLF y espacios finales',()=>{
  const origen='Título\r\n\r\nPrimer texto sin cambios.  \r\n\r\nSegundo párrafo.\r\n\r\nS:.F:.U:.\r\nRicardo Pérez González\r\n';
  const esperado='Título\n\nPrimer texto sin cambios.\n\nSegundo párrafo.'+pie('Ricardo Pérez González');
  assert.equal(normalizarCierreTrabajo(origen,'Q.·.H.·. Ricardo Pérez González'),esperado);
});

test('autor es obligatorio y nunca guarda únicamente la firma',()=>{
  assert.throws(()=>normalizarCierreTrabajo('Cuerpo',''),/nombre del autor/);
  assert.throws(()=>normalizarCierreTrabajo('S.·.F.·.U.·.','Autor'),/contenido/);
});

test('renderizado presenta firma por separado y escapa el autor',()=>{
  const entrada=normalizarCierreTrabajo('Cuerpo de prueba.\n\nOtra idea.','Autora <prueba>');
  const vista=renderizarTrazadoEnriquecido(entrada);
  assert.match(vista,/class="trazado-cierre"/);
  assert.match(vista,/class="trazado-saludo">S\.·\.F\.·\.U\.·\.<\/p>/);
  assert.match(vista,/class="trazado-firma">Autora &lt;prueba&gt;<\/p>/);
  assert.equal((vista.match(/class="trazado-cierre"/g)||[]).length,1);
});

test('guardado usa normalizador, no trim() sobre texto, y conserva controles UI',()=>{
  const guardado=app.slice(app.indexOf('async function guardarEdicionModuloAdmin()'),app.indexOf('function eliminarModuloYReordenar('));
  assert.match(guardado,/normalizarCierreTrabajo\(campoTexto\.value, nuevoAutor\)/);
  assert.doesNotMatch(guardado,/getElementById\('editModTexto'\)\.value\.trim\(\)/);
  assert.match(html,/onclick="normalizarPieEditorTrabajo\(\)"/);
  assert.match(html,/id="editModTexto"[^>]*rows="14"/);
  assert.match(css,/#seccionDocencia \.trazado-cierre/);
});

test('texto de originales nunca ejecuta etiquetas HTML en el lector',()=>{
 const html=renderizarTrazadoEnriquecido('<img src=x onerror=alert(1)>\n\nCuerpo <script>alert(1)</script>');assert.doesNotMatch(html,/<img|<script/);assert.match(html,/&lt;img/);
});
