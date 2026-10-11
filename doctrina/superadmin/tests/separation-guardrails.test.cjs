'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const docencia = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'doctrina/superadmin/floating-tab.js'), 'utf8');
const bootstrap = fs.readFileSync(path.join(root, 'doctrina/superadmin/bootstrap.js'), 'utf8');

test('Docencia does not invoke Doctrina administrative RPCs', () => {
  for (const rpc of ['doctrina_es_superadmin', 'doctrina_admin_cambiar']) {
    assert.equal(docencia.includes(rpc), false, 'unexpected Doctrina RPC in Docencia: ' + rpc);
  }
});

test('Superadmin does not invoke legacy Docencia administration RPCs', () => {
  for (const rpc of ['admin_crear_usuario', 'admin_editar_usuario', 'admin_eliminar_usuario', 'admin_cambiar_clave', 'cambiar_clave_usuario', 'solicitar_recuperacion_clave']) {
    assert.equal(shell.includes(rpc) || bootstrap.includes(rpc), false, 'legacy RPC in Superadmin: ' + rpc);
  }
});

test('Superadmin checks server identity and authorization', () => {
  assert.match(shell, /auth\.getUser\(/);
  assert.match(shell, /rpc\(['"]doctrina_es_superadmin['"]\)/);
  assert.match(shell, /data !== true/);
});

test('Superadmin does not trust legacy browser session as authority', () => {
  assert.doesNotMatch(shell, /localStorage\.(?:getItem|setItem)\(/);
  assert.doesNotMatch(shell, /sessionStorage\.(?:getItem|setItem)\(/);
});
