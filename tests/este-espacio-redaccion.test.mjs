import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('<section class="espacio-recorrido"');
const end=html.indexOf('</section>',start);
const recorrido=html.slice(start,end);

test('las tres etapas mantienen títulos y orden original',()=>{
  const labels=['Leer y comprender','Profundizar','Reflexionar y compartir'];
  let pos=-1;
  for(const label of labels){
    const next=recorrido.indexOf('<h3>'+label+'</h3>');
    assert.ok(next>pos,label);
    pos=next;
  }
});
test('los textos son claros y consistentes con las acciones reales',()=>{
  assert.match(recorrido,/Lea el trazado con atención, identifique sus ideas principales y confirme su lectura\./);
  assert.match(recorrido,/Responda las preguntas del cuestionario formativo\./);
  assert.match(recorrido,/Elabore su reflexión personal y, al completar el trabajo, participe en el Muro Docente\./);
  assert.doesNotMatch(recorrido,/las ocho preguntas|Foro Docente/);
});