'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const shell = fs.readFileSync(path.join(__dirname, '..', 'floating-tab.js'), 'utf8');
const start = shell.indexOf('style.textContent = `');
const end = shell.indexOf('`;', start + 21);
assert.ok(start !== -1 && end > start, 'Debe existir la hoja de estilos del panel');
const css = shell.slice(start + 'style.textContent = `'.length, end);
const final = css.indexOf('/* Final editorial overrides: only Doctrina Superadmin visual scope. */');
const legacy = css.indexOf('#doctrina-superadmin-panel .ds-activity time{color:#aebdca');

test('Los estilos editoriales finales se aplican después de los heredados', () => {
  assert.ok(legacy !== -1, 'Falta el estilo heredado esperado');
  assert.ok(final > legacy, 'Los overrides editoriales deben ir al final');
});
test('La corrección mantiene formularios legibles en el panel Superadmin', () => {
  const tail = css.slice(final);
  assert.match(tail, /#doctrina-superadmin-panel input,#doctrina-superadmin-panel select,#doctrina-superadmin-panel textarea\{background:#fff;color:#142a40;border-color:#cfc9c0\}/);
  assert.match(tail, /#doctrina-superadmin-panel label\{color:#405369\}/);
  assert.match(tail, /#doctrina-superadmin-panel \.ds-table th\{color:#526174;border-bottom-color:#ddd6cd\}/);
});
test('La hoja de estilos no aplica reglas globales a Docencia', () => {
  for (const line of css.split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('/*') || s.startsWith('*') || s.startsWith('@') || s.startsWith('}')) continue;
    assert.ok(s.startsWith('#doctrina-superadmin-panel') || s.startsWith('#doctrina-superadmin-tab'),
      'Selector fuera del panel Superadmin: ' + s.slice(0, 90));
  }
});
