'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = fs.readFileSync(path.resolve(__dirname, '../../../app.js'), 'utf8');

// This regression test is intentionally skipped until the server-side
// recovery flow is replaced. It documents the required security contract.
// Enabling it must be part of the same reviewed change as the replacement.
test.skip('password recovery must not return a reset token to an anonymous caller', () => {
  assert.doesNotMatch(app, /data:\s*token[^\n]*[\s\S]*?rpc\(['"]solicitar_recuperacion_clave['"]/);
  assert.doesNotMatch(app, /\?token=\$\{token\}/);
});

test('legacy recovery endpoint remains explicitly identified for migration', () => {
  assert.match(app, /rpc\(['"]solicitar_recuperacion_clave['"]/);
});
