'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../floating-tab.js'), 'utf8');

test('Superadmin button identifies the panel it controls', () => {
  assert.match(source, /tab\.setAttribute\('aria-controls','doctrina-superadmin-panel'\)/);
});

test('opening and closing the panel updates aria-expanded', () => {
  assert.match(source, /panel\.hidden=false;tab\.setAttribute\('aria-expanded','true'\)/);
  assert.match(source, /panel\.hidden=true;tab\.setAttribute\('aria-expanded','false'\)/);
});

test('Escape closes the panel and restores focus without bypassing authorization', () => {
  assert.match(source, /event\.key==='Escape'&&!panel\.hidden/);
  assert.match(source, /if\(!tab\.hidden\)tab\.focus\(\)/);
  assert.match(source, /client\.auth\.getUser\(\)/);
  assert.match(source, /doctrina_es_superadmin/);
});

test('authorization reset also resets expanded state', () => {
  assert.match(source, /function hide\(\)[^\n]*aria-expanded','false'/);
});
