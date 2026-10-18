import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../ui-v2.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('el refinamiento se limita al bloque de clasificación temática en Trabajos',()=>{
 const block=css.slice(css.indexOf('/* Refinamiento de metadatos temáticos: nota discreta'));
 assert.match(block,/#seccionCatalogoTrabajos \.grid-card-unidad\s*\{/);
 assert.match(block,/font-size:\.72rem/);
 assert.match(block,/font-size:\.71rem/);
 assert.match(block,/font-size:\.69rem/);
 assert.match(block,/background:rgba\(232,240,246,\.34\)/);
 assert.doesNotMatch(block,/#seccionContenidoDocente|header-workspace|\.grid-card-titulo/);
});
test('la tarjeta conserva el lector y la jerarquía original',()=>{
 assert.match(html,/id="gridTrabajosBienvenida"/);
 assert.match(html,/id="seccionContenidoDocente"/);
 assert.match(css,/#seccionCatalogoTrabajos \.grid-card-codigo-enlace:focus-visible/);
});