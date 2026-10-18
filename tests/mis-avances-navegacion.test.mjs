import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../ui-v2.css',import.meta.url),'utf8');
const start=html.indexOf('id="modalMisAvances"');
const end=html.indexOf('<!-- MODAL: CERTIFICADO OFICIAL A4 -->',start);
const modal=html.slice(start,end);
test('informe conserva descarga y salida con navegación de botones amplios',()=>{
  for(const s of ['inicio','detalle','certificados'])assert.match(modal,new RegExp('desplazarInformeAvances\\(\\x27'+s+'\\x27\\)'));
  assert.match(modal,/imprimirInformeAvanceNativo\(\)/);
  assert.match(modal,/cerrarModalMisAvances\(\)/);
  assert.match(modal,/id="tituloDetalleAvances"/);
});
test('función mueve el contenedor del informe, no el body ni el documento impreso',()=>{
  const a=app.indexOf('function desplazarInformeAvances(seccion)');
  const b=app.indexOf('async function abrirModalMisAvances(',a);
  assert.ok(a>0&&b>a);
  let moved;
  const wrapper={scrollTop:30,scrollTo:pos=>{moved=pos;},getBoundingClientRect:()=>({top:100})};
  const detail={getBoundingClientRect:()=>({top:380})};
  const modalElement={classList:{contains:()=>false},querySelector:()=>wrapper};
  const nodes={modalMisAvances:modalElement,tituloDetalleAvances:detail};
  const fn=runInNewContext(app.slice(a,b)+'\ndesplazarInformeAvances',{document:{getElementById:id=>nodes[id]}});
  fn('detalle');
  assert.equal(moved.top,228);
  assert.equal(moved.behavior,'smooth');
});
test('scrollbar visible y fichas en móvil mantienen formato imprimible intacto',()=>{
  assert.match(css,/#modalMisAvances \.modal-certificado-wrapper::\-webkit-scrollbar/);
  assert.match(css,/scrollbar-width:auto/);
  assert.match(css,/@media\(max-width:750px\)/);
  assert.match(css,/#modalMisAvances \.informe-table td:nth-child\(4\)::before/);
  assert.match(app,/const original = document.getElementById\('documentoInformeAvance'\)/);
  assert.match(css,/#modalMisAvances \.avances-nav-btn/);
});
