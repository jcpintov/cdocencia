import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import nodemailer from 'nodemailer';
import {generarCorreoInventario} from '../lib/correo-inventario.js';
import {gestionarInventario} from '../server/inventario-trabajos.js';
const actor={id:randomUUID()},uno={id:randomUUID(),nombre:'Hermano Uno',email:'uno@example.invalid'},enzo={id:randomUUID(),nombre:'Enzo de prueba',email:'excluido@example.invalid'};
const trabajos=[{id:'viejo',titulo:'Antiguo',autor:'Autor',fecha:'2026-10-01',fecha_entregada:true},{id:'nuevo',titulo:'Nuevo <script>',autor:'Autor',fecha:'2026-10-25',fecha_entregada:false}];
test('correo aprobado conserva asunto, firma, enlace, orden y privacidad CCO',async()=>{
 const c=generarCorreoInventario(trabajos,[uno,uno]);assert.equal(c.from,'no-reply@ofl.cl');assert.equal(c.bcc.length,1);assert.match(c.subject,/^OFL 146: Nuevo trabajo de docencia disponible\.$/);assert.ok(c.text.indexOf('Nuevo')<c.text.indexOf('Antiguo'));assert.match(c.text,/VV∴MM∴/);assert.match(c.text,/uds y sus familias/);assert.match(c.text,/PLATAFORMA DE DOCENCIA PARA MAESTROS \/ RL OFL N°146/);assert.doesNotMatch(c.html,/<script>/);
 const r=await nodemailer.createTransport({name:'smtp-fixture',version:'1',send(mail,done){mail.message.keepBcc=false;mail.message.build((e,buffer)=>done(e,{envelope:mail.message.getEnvelope(),message:buffer}));}}).sendMail(c);assert.deepEqual(r.envelope.to,[uno.email]);assert.doesNotMatch(r.message.toString().split('\r\n\r\n')[0],/Bcc:|uno@example/);
});
function entorno(){
 const tablas={usuarios:[uno,enzo],modulos:[{id:'m',activo:true,titulo:'Trabajo',autor:'Autor',creado_en:'2026-10-25',unidad_codigo:'X',contenido_trazado:'Texto',preguntas_json:{preguntas:Array(8).fill({})}}],docencia_asignaciones:[],docencia_inventarios_correo:[]};
 const admin={from(t){const filtros=[];let op='select',valor,single=false;const q={select(){return q;},eq(k,v){filtros.push([k,v]);return q;},insert(v){op='insert';valor=v;return q;},update(v){op='update';valor=v;return q;},maybeSingle(){single=true;return q;},then(ok,bad){let filas=tablas[t].filter(r=>filtros.every(([k,v])=>r[k]===v));if(op==='insert'){if(tablas[t].some(r=>r.id===valor.id))return Promise.resolve({error:{code:'23505'}}).then(ok,bad);tablas[t].push({estado:'preparado',...valor});filas=[valor];}if(op==='update')filas.forEach(r=>Object.assign(r,valor));return Promise.resolve({data:single?filas[0]||null:filas}).then(ok,bad);}};return q;}};
 return {admin,actor,tablas,env:{SMTP_HOST:'fixture',SMTP_USER:'fixture',SMTP_PASSWORD:'fixture'}};
}
test('excepción es por envío y CAS impide doble envío, incluso concurrente',async()=>{
 const e=entorno(),id=randomUUID();e.tablas.usuarios.forEach(x=>x.es_admin=false);
 let enviados=0;e.transport={sendMail:async c=>{enviados++;assert.deepEqual(c.bcc,[uno.email]);return {accepted:c.bcc,rejected:[],messageId:'fixture'};}};
 const r=await gestionarInventario({action:'inventario_preparar',id,excluir_ids:[enzo.id]},e);assert.equal(r.status,200);assert.deepEqual(r.body.excluidos.map(x=>x.id),[enzo.id]);
 const resultados=await Promise.all([1,2].map(()=>gestionarInventario({action:'inventario_enviar',id,confirmado:true},e)));assert.deepEqual(resultados.map(r=>r.status).sort(),[200,409]);assert.equal(enviados,1);assert.equal(e.tablas.docencia_inventarios_correo[0].estado,'enviado');
 const siguiente=await gestionarInventario({action:'inventario_preparar',id:randomUUID()},e);assert.equal(siguiente.body.correo.bcc.length,2);
});
test('sin confirmación o autor ajeno no se envía; SMTP incierto nunca se reintenta',async()=>{
 const e=entorno(),id=randomUUID();e.tablas.usuarios.forEach(x=>x.es_admin=false);await gestionarInventario({action:'inventario_preparar',id},e);let n=0;e.transport={sendMail:async()=>{n++;throw Error('desconexión');}};
 assert.equal((await gestionarInventario({action:'inventario_enviar',id},e)).status,422);
 assert.equal((await gestionarInventario({action:'inventario_enviar',id,confirmado:true},{...e,actor:{id:randomUUID()}})).status,409);
 assert.equal((await gestionarInventario({action:'inventario_enviar',id,confirmado:true},e)).status,503);
 assert.equal((await gestionarInventario({action:'inventario_enviar',id,confirmado:true},e)).status,409);assert.equal(n,1);assert.equal(e.tablas.docencia_inventarios_correo[0].estado,'incierto');
});
