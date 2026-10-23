import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createHmac} from 'node:crypto';
const source=readFileSync(new URL('../api/admin-perfil.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace('export default async function handler','async function handler');
const id='11111111-1111-4111-8111-111111111111';
function perfil(opciones={}){
 const calls=[],emails=[],updates=[];const cambio={id,email_anterior:'jpintov@gmail.com',nombre:'Julio César Pinto',email_nuevo:'nuevo@example.invalid'};
 const user={id,email:opciones.email||'jpintov@gmail.com',app_metadata:opciones.metadata||{}};
 const admin={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:'perfil',es_admin:opciones.admin!==false,email:user.email}})})})}),rpc:async(_n,{p_accion,p_datos})=>{calls.push({accion:p_accion,datos:p_datos});if(opciones.codigoInvalido&&p_accion==='validar')return {data:{error:'Código inválido o vencido'}};if(opciones.falloFinal&&p_accion==='finalizar')return {error:{code:'network'}};return {data:cambio};},auth:{admin:{updateUserById:async(...args)=>{updates.push(args);return opciones.falloAuth?{error:{code:'conflict'}}:{data:{user}};}}}};
 const ctx={process:{env:{SUPABASE_URL:'url',SUPABASE_PUBLISHABLE_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'service',SMTP_HOST:'host',SMTP_USER:'from@example.invalid',SMTP_PASSWORD:'fixture'}},createClient:(_u,k)=>k==='public'?{auth:{getUser:async()=>({data:{user}})}}:admin,createHmac,randomUUID:()=>id,randomInt:()=>12345678,nodemailer:{createTransport:()=>({sendMail:async m=>{emails.push(m);return {accepted:opciones.falloSMTP?[]:[cambio.email_anterior]};}})}};
 runInNewContext(source,ctx);
 return {calls,emails,updates,request:async(body,token='Bearer fixture')=>{const r={setHeader(){},status(s){this.code=s;return this;},json(b){this.body=b;return this;}};await ctx.handler({method:'POST',headers:{authorization:token},body},r);return r;}};
}
test('perfil requiere identidad Superadmin verificada, no acepta user_metadata como rol',async()=>{
 assert.equal((await perfil().request({action:'solicitar'},'')).code,401);
 assert.equal((await perfil({email:'otro@example.invalid'}).request({action:'pendiente'})).code,403);
 assert.equal((await perfil({admin:false}).request({action:'pendiente'})).code,403);
});
test('código se envía al correo previo y no modifica Auth antes de confirmarlo',async()=>{
 const s=perfil();const r=await s.request({action:'solicitar',nombre:'Julio César Pinto',email:'nuevo@example.invalid'});
 assert.equal(r.code,200);assert.equal(s.emails[0].to,'jpintov@gmail.com');assert.equal(s.updates.length,0);assert.deepEqual(s.calls.map(c=>c.accion),['solicitar','habilitar']);assert.equal(s.calls[0].datos.hash.length,64);assert.ok(!JSON.stringify(r.body).includes('12345678'));
});
test('SMTP sin aceptación invalida el desafío y conserva perfil',async()=>{
 const s=perfil({falloSMTP:true});assert.equal((await s.request({action:'solicitar',nombre:'Nombre',email:'nuevo@example.invalid'})).code,503);assert.equal(s.calls.at(-1).accion,'fallido');assert.equal(s.updates.length,0);
});
test('código rechazado no cambia identidad',async()=>{
 const s=perfil({codigoInvalido:true});assert.equal((await s.request({action:'confirmar',id,codigo:'12345678'})).code,503);assert.equal(s.updates.length,0);
});
test('confirmación conserva metadatos de servidor y finaliza solo después de Auth',async()=>{
 const s=perfil({metadata:{otro:'conservar'}});assert.equal((await s.request({action:'confirmar',id,codigo:'12345678'})).code,200);assert.equal(s.updates[0][1].app_metadata.superadmin_principal,true);assert.equal(s.updates[0][1].app_metadata.otro,'conservar');assert.equal(s.calls.at(-1).accion,'finalizar');
});
test('confirmación SQL incierta queda recuperable y no revierte Auth a ciegas',async()=>{
 const s=perfil({falloFinal:true});const r=await s.request({action:'confirmar',id,codigo:'12345678'});assert.equal(r.code,503);assert.equal(r.body.recuperable,true);assert.equal(s.updates.length,1);assert.equal(s.calls.at(-1).accion,'recuperacion');
});
test('recuperación usa la autorización durable y permite el correo ya cambiado',async()=>{
 const s=perfil({email:'nuevo@example.invalid',metadata:{superadmin_principal:true}});assert.equal((await s.request({action:'recuperar',id})).code,200);assert.equal(s.updates.length,0);assert.deepEqual(s.calls.map(c=>c.accion),['recuperar','finalizar']);
});
const dummySource=readFileSync(new URL('../api/admin-usuarios.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace('export default async function handler','async function handler');
function dummy({email='dummy@ofl.cl',es_admin=false,falloAuth=false}={}){
 const target={id,email,es_admin,auth_user_id:'dummy-auth',cuenta_eliminada:false},calls=[];
 const admin={from(){let perfil=false;const q={select(){return q;},eq(k){if(k==='auth_user_id')perfil=true;return q;},update(v){calls.push(['update',v]);Object.assign(target,v);return q;},maybeSingle:async()=>({data:perfil?{id:'admin',email:'jpintov@gmail.com',es_admin:true}:target})};return q;},auth:{admin:{deleteUser:async(...args)=>{calls.push(['delete',...args]);return falloAuth?{error:{status:500}}:{};}}}};
 const ctx={process:{env:{SUPABASE_URL:'url',SUPABASE_PUBLISHABLE_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'service'}},createClient:(_u,k)=>k==='public'?{auth:{getUser:async()=>({data:{user:{id:'admin-auth',email:'jpintov@gmail.com'}}})}}:admin};runInNewContext(dummySource,ctx);
 return {calls,target,request:async()=>{const r={setHeader(){},status(s){this.code=s;return this;},json(v){this.body=v;return this;}};await ctx.handler({method:'POST',headers:{authorization:'Bearer fixture'},body:{action:'eliminar_dummy',id}},r);return r;}};
}
test('acción antigua de cuenta de prueba está retirada y no elimina otras cuentas',async()=>{
 const s=dummy();assert.equal((await s.request()).code,400);assert.equal(s.calls.length,0);
});
