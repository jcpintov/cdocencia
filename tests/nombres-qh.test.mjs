import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const funcs=['limpiarTratamientoHermano','formatearNombreHermano','formatearAutorMasonico'];
const bodies=funcs.map(fn=>{
  const match=app.match(new RegExp('function '+fn+'\\([^\\n]+\\) \\{[\\s\\S]*?\\n\\}'));
  assert.ok(match,fn+' se encuentra en app.js');
  return match[0];
});
const formatters=runInNewContext(bodies.join('\n')+';({limpiarTratamientoHermano,formatearNombreHermano,formatearAutorMasonico});');

test('trata nombre sin abreviatura institucional exactamente una vez',()=>{
  assert.equal(formatters.formatearNombreHermano('Christian Rubio P.'),'Q.·.H.·. Christian Rubio P.');
});
test('no repite prefijo ya registrado y elimina reiteraciones históricas',()=>{
  for(const nombre of [
    'Q.·.H.·. Christian Rubio P.',
    'Q.·.H.·. Q.·.H.·. Christian Rubio P.',
    'Q.H. Christian Rubio P.',
    'QH Christian Rubio P.',
    'Q. H. Christian Rubio P.'
  ])assert.equal(formatters.formatearNombreHermano(nombre),'Q.·.H.·. Christian Rubio P.');
});
test('formatea con limpieza de espacios y tolera nombres de usuarios sin prefijo',()=>{
  assert.equal(formatters.formatearNombreHermano('  Q.·.H.·.   Julio   Pinto V. '),'Q.·.H.·. Julio Pinto V.');
  assert.equal(formatters.formatearAutorMasonico(null),'Cámara de Docencia');
});
test('dos vistas del Muro comparten hilos y tratamiento institucional',()=>{
 assert.equal((app.match(/window\.renderizarHilosComentarios\?\./g)||[]).length,2);
 const hilos=readFileSync(new URL('../comentarios-hilos.js',import.meta.url),'utf8');
 assert.match(hilos,/formatearNombreHermano/);
});
test('Muro General no reitera tratamiento en pantalla ni PDF',()=>{
 const sec=app.slice(app.indexOf('async function cargarMuroGeneralAdmin()'),app.indexOf('function imprimirMuroGeneralPDF()'));
 assert.match(sec,/formatearNombreHermano\(r\.usuarios\?\.nombre\)/);
 assert.doesNotMatch(sec,/Q\.·\.H\.·\. \$\{r\.usuarios\?\.nombre/);
 assert.match(sec,/String\(r\.reflexion\|\|''\)/);
 assert.doesNotMatch(sec,/innerHTML\s*\+=/);
});
test('certificado ofrece un solo tratamiento y el informe conserva su tratamiento exterior',()=>{
 assert.match(app,/certNombreHermano'\)\.innerText = formatearNombreHermano\(nombreLimpio\)/);
 assert.match(app,/informeNombreHermano'\)\.innerText = nombreLimpio/);
});

