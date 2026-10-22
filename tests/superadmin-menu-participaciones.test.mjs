import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('eliminada la leyenda lateral redundante en las vistas de usuario y Superadmin',()=>{
 assert.doesNotMatch(html,/<span>DOCENCIA PARA MAESTROS<\/span>/);
 assert.doesNotMatch(html,/admin-brand-eyebrow">DOCENCIA PARA MAESTROS/);
 assert.match(html,/<h3>Consola Superadmin<\/h3>/);
});

test('menú de Superadmin conserva los grupos y el orden solicitado',()=>{
 const sidebar=html.slice(html.indexOf('<nav class="admin-menu-list"'),html.indexOf('</nav>',html.indexOf('<nav class="admin-menu-list"')));
 const grupos=[...sidebar.matchAll(/admin-menu-label">([^<]+)<\/p>/g)].map(m=>m[1]);
 assert.deepEqual(grupos,['Vista general','Gestión docente','Participación y seguimiento']);
 const esperado=[['tabNavResumen','tabNavTenidas'],['tabNavAsignaciones','tabNavCargar','tabNavDoctrina','tabNavEditorDoctrina','tabNavGestionTrabajos','tabNavUsuarios'],['tabNavMuroGeneral','tabNavMetricas','tabNavAccesos','tabNavPresencial']];
 const bloques=sidebar.split('<div class="admin-menu-group">').slice(1);
 assert.deepEqual(bloques.map(b=>[...b.matchAll(/id="(tabNav\w+)"/g)].map(m=>m[1])),esperado);
 const pie=html.slice(html.indexOf('<div class="admin-side-footer">'),html.indexOf('<div class="admin-links-bottom"'));
 assert.ok(pie.indexOf('Mi perfil')<pie.indexOf('Cerrar sesión'));
});

test('Herramientas externas comienza con acceso directo a ChatGPT',()=>{
 const footer=html.slice(html.indexOf('<div class="admin-links-bottom"'),html.indexOf('</details>',html.indexOf('<div class="admin-links-bottom"')));
 const enlace='<a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" class="admin-nav-link-ext">';
 assert.match(footer,/\bChatGPT<\/span>/);
 assert.ok(footer.includes(enlace),'enlace directo al portal ChatGPT');
 assert.ok(footer.indexOf(enlace)<footer.indexOf('https://github.com/jcpintov/cdocencia'));
 assert.doesNotMatch(footer,/adminEnlaceConversacion|adminConfigurarConversacion|configurarConversacionDesarrollo|abrirConversacionDesarrollo/);
 assert.doesNotMatch(app,/CONVERSACION_ADMIN_STORAGE|configurarConversacionDesarrollo|abrirConversacionDesarrollo/);
});

test('KPI Comentarios contabiliza cada reflexión y comentario/respuesta visible una sola vez',async()=>{
 const fragment=app.slice(app.indexOf('async function cargarResumenAdmin()'));
 const vals=new Map();
 const get=id=>{if(!vals.has(id))vals.set(id,{textContent:''});return vals.get(id);};
 const ap=[{id:'ref1'},{id:'ref2'},{id:'ref2'}];
 const cm=[{id:'com1'},{id:'respuesta1'},{id:'com1'}];
 const called=[];
 const sbApp={
  from(table){
   return {select(){
    if(table==='usuarios')return Promise.resolve({data:[
     {id:'u1',es_admin:false,email:'maestro@example.invalid'},
     {id:'u2',es_admin:false,email:'dummy@ofl.cl'},
     {id:'u3',es_admin:true,email:'admin@example.invalid'}
    ],error:null});
    if(table==='progreso_maestro')return {eq:()=>Promise.resolve({data:[{usuario_id:'u1',completado:true},{usuario_id:'u3',completado:true}],error:null})};
    throw Error('tabla no esperada');
   }};
  },
  rpc(name,args){
   called.push({name,args});
   return Promise.resolve({data:{aportes:ap,comentarios:cm},error:null});
  }
 };
 const ctx={document:{getElementById:get},window:{cargarCronogramaAdmin(){}},sbApp,Promise,Set,String,Array,Error};
 runInNewContext(fragment,ctx);
 await ctx.cargarResumenAdmin();
 assert.equal(get('kpiComentarios').textContent,'4');
 assert.equal(get('kpiUsuarios').textContent,'1');
 assert.equal(get('kpiCompletados').textContent,'1');
 assert.equal(called[0].name,'muro_docente_autorizado');
 assert.equal(called[0].args.p_modulo,null);
 assert.match(get('resumenAdminEstado').textContent,/Indicadores actualizados/);
});
