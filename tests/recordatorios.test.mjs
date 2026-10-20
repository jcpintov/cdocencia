import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {Buffer} from 'node:buffer';
import {timingSafeEqual} from 'node:crypto';
import {generarCorreoRecordatorio} from '../lib/correo-recordatorio.js';
import {procesarRecordatorios} from '../lib/procesar-recordatorios.js';
const a={id:'a',version:2,nombre:'Q.·.H.·. José Pérez',email:'jose@example.invalid',tema:'La acacia',codigo:'INCI011A',fecha_entrega:'2026-11-10',recordatorio:{solicitud_id:'solicitud',solicitud_enviada_en:'2026-10-21T01:00:00Z'}};
test('recordatorio respeta nombre y tema en mayúsculas, fecha local, espacios y frase final',()=>{
 const c=generarCorreoRecordatorio(a);
 assert.ok(c.text.startsWith('V.·.M.·. \nJOSÉ PÉREZ:\n\n\n\nJunto'));
 assert.match(c.text,/solicitud enviada el 20 de octubre de 2026/);
 assert.match(c.html,/<strong>LA ACACIA<\/strong>/);
 assert.match(c.text,/10 de noviembre de 2026, hasta las 23:30 horas\./);
 assert.ok(!c.text.includes('Chile'));
 assert.match(c.text,/Cámara\.\n\nSi ya envió su trabajo, agradeceré hacer caso omiso de esta comunicación\./);
 assert.ok(c.text.endsWith('Julio César Pinto,\n\nORADOR - RL OFL 146'));
 assert.equal(c.bcc,'jpintov@gmail.com');
});
test('sin fecha real de solicitud no se inventa un recordatorio',()=>{
 assert.throws(()=>generarCorreoRecordatorio({...a,recordatorio:{}}),/envío confirmado/);
 assert.throws(()=>generarCorreoRecordatorio({...a,recordatorio:{solicitud_enviada_en:'fecha falsa'}}),/envío confirmado/);
 const c=generarCorreoRecordatorio({...a,nombre:'<img src=x>',tema:'<script>m</script>'});assert.ok(!c.html.toLowerCase().includes('<script>'));assert.match(c.html,/&lt;IMG/);
});
function fixture({duplicado=false,publicado=false,smtpFalla=false,registroFalla=false,copia=true}={}){
 const calls=[],reservados=new Set();let contador=0;
 const admin={rpc:async(_fn,{p_accion,p_datos})=>{
  calls.push({action:p_accion,data:p_datos});
  if(p_accion==='candidatos')return {data:duplicado?[a,a]:[a]};
  if(p_accion==='reservar'){if(reservados.has(p_datos.id))return {data:{enviar:false}};reservados.add(p_datos.id);return {data:{enviar:true}};}
  if(p_accion==='confirmar')return {data:{enviar:!publicado}};
  if(p_accion==='finalizar'&&registroFalla)return {error:{message:'network'}};
  return {data:{ok:true}};
 }};
 const transport={sendMail:async msg=>{calls.push({action:'SMTP',msg});if(smtpFalla)throw Error('timeout');return {accepted:copia?[a.email,'jpintov@gmail.com']:[a.email],messageId:'qa'};}};
 return {calls,run:()=>procesarRecordatorios({admin,transport,from:'qa@example.invalid',randomUUID:()=>String(++contador)})};
}
test('concurrencia e invocaciones repetidas no duplican un recordatorio ni su CCO',async()=>{
 const s=fixture({duplicado:true});const r=await s.run();assert.equal(r.enviados,1);assert.equal(r.omitidos,1);
 assert.equal(s.calls.filter(x=>x.action==='SMTP').length,1);assert.equal(s.calls.find(x=>x.action==='SMTP').msg.bcc,'jpintov@gmail.com');
 assert.equal(s.calls.find(x=>x.action==='finalizar').data.copia_estado,'aceptada');
 await s.run();assert.equal(s.calls.filter(x=>x.action==='SMTP').length,1);
});
test('publicación detectada justo antes del envío impide SMTP',async()=>{
 const s=fixture({publicado:true});const r=await s.run();assert.equal(r.enviados,0);assert.equal(r.omitidos,1);assert.ok(!s.calls.some(x=>x.action==='SMTP'));
});
test('SMTP incierto y fallo al registrar no disparan reenvíos',async()=>{
 for(const opciones of [{smtpFalla:true},{registroFalla:true}]){
  const s=fixture(opciones);const r=await s.run();assert.equal(r.inciertos,1);assert.equal(s.calls.filter(x=>x.action==='SMTP').length,1);assert.equal(s.calls.at(-1).data.estado,'incierto');
  await s.run();assert.equal(s.calls.filter(x=>x.action==='SMTP').length,1);
 }
});
test('CCO rechazada se registra sin reenviar al destinatario principal',async()=>{
 const s=fixture({copia:false});const r=await s.run();assert.equal(r.enviados,1);assert.equal(s.calls.at(-1).data.copia_estado,'sin_confirmar');
});
const source=readFileSync(new URL('../api/cron-recordatorios.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export default async function handler','async function handler');
test('cron rechaza llamadas sin secreto y previews, sin consultar datos ni enviar',async()=>{
 let calls=0;const ctx={Buffer,timingSafeEqual,process:{env:{CRON_SECRET:'qa-secret',VERCEL_ENV:'production'}},createClient:()=>{calls++;throw Error('no permitido');}};
 runInNewContext(source,ctx);
 const req=async(headers={},method='GET')=>{const r={setHeader(){},status(s){this.code=s;return this;},json(b){this.body=b;return this;}};await ctx.handler({headers,method},r);return r;};
 assert.equal((await req()).code,401);assert.equal((await req({authorization:'Bearer incorrecto'})).code,401);assert.equal((await req({},'POST')).code,405);
 ctx.process.env.VERCEL_ENV='preview';assert.equal((await req({authorization:'Bearer qa-secret'})).code,403);assert.equal(calls,0);
});
test('sin SMTP completo no se reserva ni se intenta el envío',async()=>{
 let calls=0;const ctx={Buffer,timingSafeEqual,process:{env:{CRON_SECRET:'qa',VERCEL_ENV:'production'}},createClient:()=>{calls++;}};runInNewContext(source,ctx);
 const r={setHeader(){},status(s){this.code=s;return this;},json(b){return b;}};await ctx.handler({method:'GET',headers:{authorization:'Bearer qa'}},r);assert.equal(r.code,503);assert.equal(calls,0);
});
