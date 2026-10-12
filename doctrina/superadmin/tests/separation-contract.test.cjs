'use strict';
// Static regression guard: Doctrina Superadmin must not inherit Docencia's legacy role.
// No database credentials, privileged tokens, or user records are used by these tests.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const shell=source('floating-tab.js');
const bootstrap=source('bootstrap.js');
const login=source('auth-login.js');
const all=[shell,bootstrap,login];

test('superadmin access is verified by server RPC and authenticated identity',()=>{
  assert.match(shell,/client\.rpc\(['"]doctrina_es_superadmin['"]\)/);
  assert.match(shell,/client\.auth\.getUser\(\)/);
  assert.match(shell,/after\?\.user\?\.id\s*!==\s*userId/);
});
test('login does not create an account implicitly',()=>{
  assert.match(login,/shouldCreateUser\s*:\s*false/);
});
test('bootstrap delegates only to the separate superadmin shell',()=>{
  assert.match(bootstrap,/window\.DoctrinaSuperadminShell/);
});
test('superadmin UI does not use legacy Docencia roles or browser-stored grants',()=>{
  const forbidden=/(?:localStorage|sessionStorage|service_role|admin_crear_usuario|admin_eliminar_usuario|\.from\(\s*['"]usuarios['"])/i;
  for(const text of all) assert.doesNotMatch(text,forbidden);
});
test('superadmin UI does not invoke legacy Docencia administration RPCs',()=>{
  for(const text of all) assert.doesNotMatch(text,/\.rpc\(\s*['"]admin_(?:crear|eliminar|editar|cambiar)/);
});
