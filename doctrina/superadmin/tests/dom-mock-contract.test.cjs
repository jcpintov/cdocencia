'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const mock=fs.readFileSync(path.join(__dirname,'floating-tab.test.cjs'),'utf8');
const shell=fs.readFileSync(path.join(__dirname,'..','floating-tab.js'),'utf8');
test('DOM mock supports document-level keyboard events',()=>{
  assert.match(mock,/const document = \{[^\n]*addEventListener\(name,fn\)\{this\.listeners\[name\]=fn;\}/);
});
test('Superadmin Escape listener remains local to its own panel',()=>{
  assert.match(shell,/document\.addEventListener\('keydown'/);
  assert.match(shell,/event\.key==='Escape'&&!panel\.hidden/);
  assert.match(shell,/panel\.hidden=true;tab\.setAttribute\('aria-expanded','false'\)/);
});
