import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const blocks=JSON.parse(readFileSync(new URL('../data/fundamentos-institucionales-20261018.json',import.meta.url),'utf8'));
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('introducción sin numerar, cuatro fundamentos y cierre aprobado',()=>{
 assert.equal(blocks.length,6);
 assert.deepEqual(blocks.map(x=>x.tipo),['introduccion','fundamento','fundamento','fundamento','fundamento','cierre']);
 assert.equal(blocks[0].titulo,'Propósito y sentido de la docencia');
 assert.equal(blocks.at(-1).titulo,'Invitación a la reflexión');
 for(const b of blocks)assert.ok(b.texto.length>100 && !b.titulo.startsWith('1. '));
});
test('texto íntegro y elementos consensuados',()=>{
 const all=blocks.map(x=>x.texto).join(' ');
 for(const q of ['plataforma digital de aprendizaje asincrónico','Muro Docente',
 'comprender, examinar para discernir','Grandes Logias']) {
   if(q==='Grandes Logias') assert.doesNotMatch(all,/Grandes Logias/);
   else assert.ok(all.includes(q),q);
 }
 assert.match(all,/concordancia con el programa de docencia vigente de la Gran Logia de Chile/);
});
test('renderización segura con párrafos, negritas e índice navegable',()=>{
 assert.match(app,/numeroFundamento\+\+/);
 assert.match(app,/espacio-tipo-/);
 assert.match(app,/document\.createTextNode\(fragmento\)/);
 assert.match(app,/paragraph\.appendChild\(strong\)/);
 assert.match(app,/prefers-reduced-motion: reduce/);
 assert.match(html,/Fundamentos institucionales de este espacio docente/);
 assert.doesNotMatch(html,/id="espacioFundamentosTitulo">Propósito y sentido/);
});
