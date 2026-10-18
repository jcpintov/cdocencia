import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const ui=readFileSync(new URL('../ui-v2.css',import.meta.url),'utf8');
test('ningún rol muestra selector día sepia noche',()=>{
 assert.doesNotMatch(html,/id="btnTema"|alternarTemaLuminosidad/);
 assert.doesNotMatch(app,/alternarTemaLuminosidad|inicializarLuminosidad|function aplicarTema|camara_tema/);
});
test('Superadmin tipografía compacta iconos pequeños sin animación excesiva',()=>{
 const block=ui.slice(ui.indexOf('/* Superadmin: consola de gestión sobria'));
 assert.match(block,/#seccionAdmin \.admin-side-btn/);
 assert.match(block,/font-size:\.86rem/);
 assert.match(block,/font:500 \.91rem/);
 assert.match(block,/transition:none/);
 assert.match(block,/transform:none/);
 assert.match(block,/@media\(max-width:600px\)/);
});
