import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {generarCorreoAsignacion} from '../lib/correo-asignacion.js';
const registro={id:'12345678-1234-4234-8234-123456789abc',version:1,nombre:'Q.·.H.·. José Pérez',email:'jose@example.invalid',tema:'El concepto Hirámico del Taller',codigo:'INCI011A',unidad:'UNIDAD 1: BASAMENTOS DOCTRINARIOS',subunidad:'1.1 CONCEPTOS FUNDAMENTALES DEL GRADO',fecha_entrega:'2026-11-10',correos:[]};
const intento='22345678-1234-4234-8234-123456789abc';
test('plantilla conserva tratamiento, mayúsculas, espacios, firma y lineamientos aprobados',()=>{
 const c=generarCorreoAsignacion(registro);
 assert.ok(c.text.startsWith('V.·.M.·. \nJOSÉ PÉREZ:\n\n\n\nJunto'));
 assert.ok(c.html.includes('<strong>EL CONCEPTO HIRÁMICO DEL TALLER</strong>'));
 assert.match(c.text,/10 de noviembre de 2026, hasta las 23:30 horas de Chile/);
 assert.ok(c.text.endsWith('Julio César Pinto,\n\nORADOR - RL OFL 146'));
 assert.match(c.text,/Calibri, tamaño 12/);assert.match(c.text,/Interlineado: 1,5/);
 assert.match(c.text,/la plataforma empleada y el prompt o consulta utilizado/);
});
test('nombres y temas no insertan HTML en la vista previa',()=>{
 const c=generarCorreoAsignacion({...registro,nombre:'<img src=x>',tema:'<script>alert(1)</script>'});
 assert.ok(!c.html.toLowerCase().includes('<script>'));assert.ok(c.html.includes('&lt;IMG'));
});
const raw=readFileSync(new URL('../api/admin-asignaciones.js',import.meta.url),'utf8');
const source=raw.replace(/^import .*;\n/gm,'').replace('export default async function handler','async function handler');
function setup({email='jpintov@gmail.com',admin=true,failSend=false,failFinish=false,reserva=true}={}){
 const calls=[];
 const ctx={generarCorreoAsignacion,process:{env:{SUPABASE_URL:'url',SUPABASE_PUBLISHABLE_KEY:'key',SUPABASE_SERVICE_ROLE_KEY:'secret',SMTP_HOST:'host',SMTP_USER:'user',SMTP_PASSWORD:'secret'}},
 createClient:(_url,key)=>key==='key'?{auth:{getUser:async()=>({data:{user:{id:intento,email}},error:null})}}:
 {from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{email,es_admin:admin},error:null})})})}),
 rpc:async(_fn,{p_accion,p_datos})=>{calls.push({action:p_accion,data:p_datos});
 if(failFinish&&p_accion==='finalizar_correo')return {error:{code:'network'}};
 return {data:p_accion==='vista_correo'?registro:p_accion==='reservar_correo'?{enviar:reserva}:{ok:true},error:null};}},
 nodemailer:{createTransport:()=>({sendMail:async msg=>{calls.push({action:'sendMail',msg});if(failSend)throw Error('timeout');return {accepted:[registro.email],messageId:'accepted'};}})}};
 runInNewContext(source,ctx);
 async function request(body,authorization='Bearer valid'){
 const res={setHeader(){},status(s){this.code=s;return this;},json(d){this.body=d;return this;}};
 await ctx.handler({method:'POST',headers:{authorization},body},res);return res;
 }
 return {calls,request};
}
test('anónimo y usuario ordinario no escriben ni envían',async()=>{
 const a=setup();assert.equal((await a.request({action:'listar'},'')).code,401);assert.equal(a.calls.length,0);
 const b=setup({email:'otro@example.invalid'});assert.equal((await b.request({action:'listar'})).code,403);assert.equal(b.calls.length,0);
 const c=setup({admin:false});assert.equal((await c.request({action:'listar'})).code,403);
});
test('crear y modificar no envían correo; fecha editable va a servidor',async()=>{
 for(const action of ['crear','modificar']){
 const s=setup();const r=await s.request({action,id:registro.id,version:1,usuario_id:intento,codigo:'INCI011A',fecha_asignacion:'2026-10-21',fecha_entrega:'2026-11-11'});
 assert.equal(r.code,200);assert.equal(s.calls.length,1);assert.equal(s.calls[0].data.fecha_asignacion,'2026-10-21');
 }
});
test('vista previa no reserva ni envía correo',async()=>{
 const s=setup();assert.equal((await s.request({action:'vista_correo',id:registro.id,version:1})).code,200);
 assert.deepEqual(s.calls.map(c=>c.action),['vista_correo']);
});
const envio={action:'enviar',id:registro.id,version:1,intento,confirmado:true,reenviar:false};
test('requiere acción manual confirmada y usa destinatario del padrón',async()=>{
 const s=setup();assert.equal((await s.request({...envio,confirmado:false})).code,422);assert.equal(s.calls.length,0);
 const r=await s.request({...envio,to:'intruso@example.invalid'});assert.equal(r.code,200);
 assert.deepEqual(s.calls.map(c=>c.action),['vista_correo','reservar_correo','sendMail','finalizar_correo']);
 assert.equal(s.calls.find(c=>c.action==='sendMail').msg.to,registro.email);
});
test('repetir identificador no vuelve a enviar',async()=>{
 const s=setup({reserva:false});const r=await s.request(envio);assert.equal(r.body.repetido,true);assert.ok(!s.calls.some(c=>c.action==='sendMail'));
});
test('fallo de SMTP queda incierto sin reintento automático',async()=>{
 const s=setup({failSend:true});assert.equal((await s.request(envio)).code,503);
 assert.equal(s.calls.filter(c=>c.action==='sendMail').length,1);assert.equal(s.calls.at(-1).data.estado,'incierto');
});
test('SMTP aceptado sin registro final no se anuncia como envío confirmado',async()=>{
 const s=setup({failFinish:true});const r=await s.request(envio);assert.equal(r.code,503);assert.match(r.body.error,/aceptó el correo/);
});
test('fechas inexistentes y plazo anterior no llegan a la base',async()=>{
 for(const [fecha_asignacion,fecha_entrega] of [['2026-02-30','2026-03-20'],['2026-10-20','2026-10-19']]){
 const s=setup();assert.equal((await s.request({action:'crear',usuario_id:intento,codigo:'INCI011A',fecha_asignacion,fecha_entrega})).code,422);assert.equal(s.calls.length,0);
 }
});
