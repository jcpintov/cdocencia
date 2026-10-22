import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('../doctrina-admin.js',import.meta.url),'utf8');
test('Doctrina existe únicamente dentro de la consola Superadmin',()=>{
 const adminStart=html.indexOf('id="seccionAdmin"');
 assert.ok(html.indexOf('id="tabNavDoctrina"')>adminStart);
 assert.ok(html.indexOf('id="adminSeccionDoctrina"')>adminStart);
 assert.equal((html.match(/id="tabNavDoctrina"/g)||[]).length,1);
 assert.match(app,/doctrina:\s*\['tabNavDoctrina',\s*'Doctrina y Reglamentos',\s*'adminSeccionDoctrina'\]/);
 assert.match(app,/limpiarBibliotecaDoctrina\(\)/);
});
test('datos remotos se presentan como texto y no se publica automáticamente',()=>{
 assert.doesNotMatch(ui,/\.innerHTML/);
 assert.match(ui,/titulo.textContent=d.titulo\|\|d.archivo/);
 assert.match(ui,/No se ha publicado a participantes/);
 assert.match(ui,/crypto.subtle.digest\('SHA-256'/);
 assert.match(ui,/uploadToSignedUrl/);
 assert.match(ui,/url.origin!==origen/);
});

