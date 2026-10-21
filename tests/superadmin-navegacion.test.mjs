import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const source=app.slice(app.indexOf('function cambiarSubseccionAdmin('),app.indexOf('/* ==========================================================================\n   ASOCIACIÓN DIRECTA'));
const sidebar=html.match(/<aside class="sidebar-admin">[\s\S]*?<\/aside>/)[0];
test('herramientas externas quedan después de gestión y salida, con pestaña segura',()=>{
 assert.ok(sidebar.indexOf('admin-links-bottom')>sidebar.indexOf('cerrarSesion()'));
 assert.ok(sidebar.indexOf('cerrarSesion()')>sidebar.indexOf('tabNavAccesos'));
 assert.equal((sidebar.match(/rel="noopener noreferrer"/g)||[]).length,3);
 assert.match(sidebar,/Esta conversación de desarrollo/);
 assert.match(sidebar,/aria-label="Administración de la plataforma"/);
});
test('navegación sincroniza vista, título y accesibilidad; en móvil devuelve el foco al contenido',()=>{
 const nodes=new Map();
 const get=id=>{
  if(!nodes.has(id)){const attrs={};const classes=new Set();nodes.set(id,{textContent:'',open:true,classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},setAttribute:(k,v)=>attrs[k]=v,removeAttribute:k=>delete attrs[k],attrs,classes,contains:()=>true,focus:()=>{focused=id;}});}
  return nodes.get(id);
 };
 let focused='';let loads=0;
 const ctx={document:{getElementById:get,activeElement:{}},window:{matchMedia:()=>({matches:true})},cargarResumenAdmin:()=>loads++,cargarListadoUsuariosAdmin:()=>loads++};
 runInNewContext(source+';cambiarSubseccionAdmin("usuarios");',ctx);
 assert.equal(get('adminVistaActual').textContent,'Usuarios y padrón');
 assert.equal(get('tabNavUsuarios').attrs['aria-current'],'page');
 assert.equal(get('adminNavegacion').open,false);
 assert.equal(focused,'adminVistaActual');
 assert.equal(loads,1);
 runInNewContext('cambiarSubseccionAdmin("resumen");',ctx);
 assert.equal(get('tabNavUsuarios').attrs['aria-current'],undefined);
 assert.equal(get('tabNavResumen').attrs['aria-current'],'page');
 assert.equal(get('adminSeccionResumen').classes.has('hidden'),false);
 runInNewContext('cambiarSubseccionAdmin("inexistente");',ctx);
 assert.equal(loads,2);
 assert.equal(get('adminVistaActual').textContent,'Resumen ejecutivo');
});
