import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const normal=app.slice(app.indexOf('function normalizarBusquedaAdmin('),app.indexOf('function filtrarTrabajosGestionAdmin('));
const filtro=app.slice(app.indexOf('function filtrarPadronAdmin('),app.indexOf('function renderizarPadronAdmin('));
const ctx={};runInNewContext(normal+filtro,ctx);
const usuarios=[{nombre:'José Pérez',email:'jose@example.invalid',auth_user_id:'a'}, {nombre:'Ana',email:'ana@example.invalid',auth_user_id:null}, {nombre:'Admin',email:'admin@example.invalid',es_admin:true,auth_user_id:'b'}, {nombre:'Prueba',email:'dummy@ofl.cl',auth_user_id:'c'}];
test('busca nombre y correo sin distinguir tildes ni mayúsculas',()=>{
 assert.equal(ctx.filtrarPadronAdmin(usuarios,'JOSE PEREZ').length,1);
 assert.equal(ctx.filtrarPadronAdmin(usuarios,'ana@example').length,1);
 assert.equal(ctx.filtrarPadronAdmin(usuarios,'sin coincidencias').length,0);
});
test('listado de usuarios excluye administradores y cuentas de prueba sin alterar padrón',()=>{
 assert.equal(ctx.filtrarPadronAdmin(usuarios,'','activos').length,1);
 assert.equal(ctx.filtrarPadronAdmin(usuarios,'','pendientes').length,1);
 assert.equal(ctx.filtrarPadronAdmin(usuarios,'','especiales').length,0);
 assert.equal(ctx.filtrarPadronAdmin(usuarios,'','todos').length,2);
 assert.equal(usuarios.length,4);
});
