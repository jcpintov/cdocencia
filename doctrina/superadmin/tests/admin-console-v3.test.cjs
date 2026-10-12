'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'admin-console-v3.css'),'utf8');
const shell=fs.readFileSync(path.join(root,'doctrina/superadmin/floating-tab.js'),'utf8');
const auth=fs.readFileSync(path.join(root,'doctrina/superadmin/auth-login.js'),'utf8');
test('new Admin console stylesheet loads after legacy styles',()=>{
  assert.match(html,/<link rel="stylesheet" href="admin-console-v3\.css">/);
  assert.ok(html.indexOf('admin-console-v3.css')>html.indexOf('ui-v2.css'));
  assert.match(html,/Administración Docencia/);
});
test('Admin theme is scoped and responsive without leaking into Docencia screens',()=>{
  assert.match(css,/#seccionAdmin\.admin-layout\s*\{/);
  assert.match(css,/#seccionAdmin \.sidebar-admin\s*\{/);
  assert.match(css,/#seccionAdmin \.admin-main-content/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.doesNotMatch(css,/\bbody\s*\{/);
  assert.doesNotMatch(css,/\bhtml\s*\{/);
});
test('Superadmin launcher mounts in Admin menu and opens modal only for verified identity',()=>{
  assert.match(shell,/adminSection\.querySelector\('\.admin-menu-list'\)/);
  assert.match(shell,/panel\.setAttribute\('role','dialog'\)/);
  assert.match(shell,/panel\.setAttribute\('aria-modal','true'\)/);
  assert.match(shell,/if\(tab\.hidden\|\|!authorizedClient\)return false/);
  assert.doesNotMatch(shell,/\.rpc\('doctrina_admin_cambiar'/);
});
test('live Supabase Auth session can enter the privileged dialog without requesting OTP again',()=>{
  assert.match(auth,/client\.auth\.getUser\(\)/);
  assert.match(auth,/await shell\.refreshFromSupabase\(client\)&&shell\.open\(\)/);
  assert.match(auth,/shouldCreateUser:false/);
});
