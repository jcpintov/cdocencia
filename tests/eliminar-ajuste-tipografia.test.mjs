import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
test('A+ y A- no aparecen en el encabezado ni llaman a función eliminada',()=>{
 const cabecera=html.slice(html.indexOf('<header>'),html.indexOf('</header>'));
 assert.doesNotMatch(cabecera,/font-btn|cambiarTamanoFuente|>A\+<|>A-</);
 assert.doesNotMatch(cabecera,/alternarTemaLuminosidad|btnTema/);
 assert.match(cabecera,/cerrarSesion\(\)/);
});
test('función y estado de aumento de texto completamente retirados',()=>{
 assert.doesNotMatch(app,/cambiarTamanoFuente|tamanoBase|body\.style\.fontSize/);
 assert.doesNotMatch(css,/\.font-btn/);
 assert.match(css,/\.icon-btn/);
});
