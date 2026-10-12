#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8');
new vm.Script(app,{filename:'app.js'});
const begin=app.indexOf('function renderizarEditorPreguntasAuditoria() {');
const end=app.indexOf('async function guardarTodasPreguntasAuditoria()',begin);
assert(begin>=0&&end>begin,'Debe existir editor de interrogantes');
const fn=app.slice(begin,end);
assert(!fn.includes('innerHTML'),'Prohibido interpolar texto en HTML');
class Node {
 constructor(tag){this.tag=tag;this.children=[];this.className='';this.textContent='';this.id='';this.name='';this.value='';this.style={};}
 appendChild(node){this.children.push(node);return node}
 append(...items){this.children.push(...items)}
 replaceChildren(...items){this.children=items}
}
const raiz=new Node('div');
const doc={createElement:tag=>new Node(tag),getElementById:id=>id==='cuerpoPreguntasAuditoria'?raiz:null};
const textoPeligroso='"><img src=x onerror=alert(1)>';
const preguntas=Array.from({length:8},(_,i)=>({
 enunciado:textoPeligroso,retroalimentacion:textoPeligroso,
 respuesta_correcta:i%2?'C':'A',
 opciones:['A','B','C','D'].map(letra=>({letra,texto:textoPeligroso}))
}));
const ctx={document:doc,usuarioActual:{es_admin:true},moduloAuditando:{preguntas_json:{preguntas}}};
vm.createContext(ctx);
vm.runInContext(fn,ctx);
vm.runInContext('renderizarEditorPreguntasAuditoria()',ctx);
function all(node){return [node,...node.children.flatMap(all)]}
const nodes=all(raiz);
const inputs=nodes.filter(n=>n.tag==='input'),selects=nodes.filter(n=>n.tag==='select');
assert.equal(raiz.children.length,8,'Debe conservar las ocho preguntas');
assert.equal(inputs.length,48,'Cada pregunta necesita 6 campos editables');
assert.equal(selects.length,8);
assert(inputs.every(n=>n.value===textoPeligroso),'No transformar ni interpretar contenido');
assert(!nodes.some(n=>n.tag==='img'),'No inyectar etiquetas');
assert.equal(new Set(inputs.map(n=>n.id)).size,48,'IDs únicos');
assert.equal(selects[1].value,'C');
ctx.usuarioActual.es_admin=false;
const original=raiz.children.length;
vm.runInContext('renderizarEditorPreguntasAuditoria()',ctx);
assert.equal(raiz.children.length,original,'USER no accede al editor');
console.log('PASS: 8 preguntas, 48 inputs, valores intactos y no XSS/rol USER');
