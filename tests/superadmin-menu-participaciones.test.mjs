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

test('Usuarios y padrón encabeza Gestión docente, después de Vista general',()=>{
 const sidebar=html.slice(html.indexOf('<nav class="admin-menu-list"'),html.indexOf('</nav>',html.indexOf('<nav class="admin-menu-list"')));
 const vista=sidebar.indexOf('>Vista general</p>');
 const docente=sidebar.indexOf('>Gestión docente</p>');
 const usuarios=sidebar.indexOf('id="tabNavUsuarios"');
 const asignaciones=sidebar.indexOf('id="tabNavAsignaciones"');
 assert.ok(vista>=0&&docente>vista&&usuarios>docente&&asignaciones>usuarios);
 assert.ok(!sidebar.slice(vista,docente).includes('id="tabNavUsuarios"'));
});

test('Herramientas externas comienza con vínculo configurable a esta conversación',()=>{
 const footer=html.slice(html.indexOf('<div class="admin-links-bottom"'),html.indexOf('</details>',html.indexOf('<div class="admin-links-bottom"')));
 assert.ok(footer.indexOf('id="adminEnlaceConversacion"')>0);
 assert.ok(footer.indexOf('id="adminEnlaceConversacion"')<footer.indexOf('https://github.com/jcpintov/cdocencia'));
 assert.match(footer,/onclick="abrirConversacionDesarrollo\(event\)"/);
 assert.match(footer,/id="adminConfigurarConversacion"/);
 assert.match(footer,/rel="noopener noreferrer"/);
});

test('el enlace acepta solo URL privada real de ChatGPT y nunca fabrica identificadores',()=>{
 const a=app.indexOf('const CONVERSACION_ADMIN_STORAGE=');
 const b=app.indexOf('async function cargarResumenAdmin()',a);
 assert.ok(a>0&&b>a);
 const storage=new Map();
 const calls=[];
 const ctx={
  URL,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},
  usuarioActual:{es_admin:true},
  document:{getElementById:id=>({textContent:'',href:''})},
  window:{
   prompt:()=> 'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc',
   alert:x=>calls.push({alert:x}),open:(...args)=>calls.push({open:args})
  }
 };
 const x=runInNewContext(app.slice(a,b)+'\n({validarUrlConversacionDesarrollo,configurarConversacionDesarrollo,abrirConversacionDesarrollo})',ctx);
 const valid='https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc';
 assert.equal(x.validarUrlConversacionDesarrollo(valid),valid);
 assert.equal(x.validarUrlConversacionDesarrollo('https://evil.example/c/12345678-1234-1234-1234-123456789abc'),null);
 assert.equal(x.validarUrlConversacionDesarrollo('https://chatgpt.com/'),null);
 assert.equal(x.validarUrlConversacionDesarrollo('javascript:alert(1)'),null);
 let stopped=false;
 x.abrirConversacionDesarrollo({preventDefault(){stopped=true}});
 assert.equal(stopped,true);
 assert.equal(calls.length,1);
 assert.equal(calls[0].open[0],valid);
 assert.equal(calls[0].open[2],'noopener,noreferrer');
 assert.equal([...storage.values()][0],valid);
 ctx.usuarioActual.es_admin=false;
 x.abrirConversacionDesarrollo({preventDefault(){}});
 assert.equal(calls.length,1,'usuarios comunes no abren el enlace administrativo');
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
