import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {esOperador,esSuperadmin} from '../lib/roles-admin.js';
const identity={id:'actor',email:'admin@example.invalid'};
const profile={id:'p',email:identity.email,rol:'ADMIN',es_admin:true,cuenta_eliminada:false};
test('Administrador puede operar pero no adquiere potestades de Superadmin',()=>{
 assert.equal(esOperador(profile,identity),true);assert.equal(esSuperadmin(profile,identity),false);
 for(const p of [{...profile,rol:'USER'},{...profile,es_admin:false},{...profile,cuenta_eliminada:true},{...profile,email:'otro@example.invalid'}])assert.equal(esOperador(p,identity),false);
 assert.equal(esOperador({...profile,rol:'USER',es_admin:false},{...identity,user_metadata:{rol:'SUPERADMIN',superadmin_principal:true}}),false);
 assert.equal(esSuperadmin({...profile,rol:'SUPERADMIN'},identity),false);
 assert.equal(esSuperadmin({...profile,rol:'SUPERADMIN'},{...identity,app_metadata:{superadmin_principal:true}}),true);
});
const source=readFileSync(new URL('../server/admin-roles.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace('export default async function handler','async function handler');
const payload={id:'22222222-2222-4222-8222-222222222222',rol:'ADMIN',rol_actual:'USER',motivo:'Responsable de docencia'};
function setup({rol='SUPERADMIN',rpcError=null,fail=false,lento=false}={}){
 const calls=[];const user={id:'actor',email:'jpintov@gmail.com'};
 const client={auth:{getUser:async()=>lento?new Promise(()=>{}):({data:{user}})}};
 const admin={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{...profile,email:user.email,rol,es_admin:rol!=='USER'}})})})}),rpc:async(name,args)=>{calls.push([name,args]);if(fail)throw Error('SECRET');return {data:{id:payload.id,rol:payload.rol},error:rpcError};}};
 const ctx={esSuperadmin,createClient:(_url,key)=>key==='key'?client:admin,AbortController,setTimeout:(fn,ms)=>setTimeout(fn,lento?15:ms),clearTimeout,process:{env:{SUPABASE_URL:'https://fixture.invalid',SUPABASE_PUBLISHABLE_KEY:'key',SUPABASE_SERVICE_ROLE_KEY:'secret'}}};runInNewContext(source,ctx);
 async function request(body=payload,{method='POST',token='Bearer test'}={}){const r={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(b){this.body=b;return this;}};await ctx.handler({method,headers:{authorization:token},body},r);return r;}
 return {request,calls};
}
test('roles: 400/401/405/422 y ningún cambio con entrada inválida',async()=>{
 const s=setup();assert.equal((await s.request('{')).code,400);assert.equal((await s.request([])).code,400);
 assert.equal((await s.request(payload,{token:''})).code,401);assert.equal((await s.request(payload,{method:'GET'})).code,405);
 for(const b of [{...payload,rol:'SUPERADMIN'},{...payload,rol_actual:'SUPERADMIN'},{...payload,id:'invalid'},{...payload,motivo:''}])assert.equal((await s.request(b)).code,422);
 assert.equal(s.calls.length,0);
});
test('roles: solo Superadmin alcanza la mutación y el actor procede de Auth',async()=>{
 for(const rol of ['ADMIN','USER']){const s=setup({rol});assert.equal((await s.request()).code,403);assert.equal(s.calls.length,0);}
 const s=setup(),r=await s.request({...payload,p_actor:'intruso',es_admin:true});assert.equal(r.code,200);assert.equal(s.calls[0][1].p_actor,'actor');
 assert.equal(r.headers['Cache-Control'],'no-store');assert.match(r.headers['Server-Timing'],/^roles;dur=\d+/);
});
test('roles: conflictos y fallos de servidor no filtran detalles ni anuncian éxito',async()=>{
 for(const [code,status] of [['42501',403],['22023',422],['P0002',404],['40001',409],['XX000',503]]){
  const r=await setup({rpcError:{code,message:'SECRET'}}).request();assert.equal(r.code,status);assert.equal(r.body.ok,undefined);assert.doesNotMatch(JSON.stringify(r.body),/SECRET/);
 }
 assert.equal((await setup({fail:true}).request()).code,503);
});

test('roles: servidor sin respuesta termina en 504 con plazo total acotado',async()=>{const inicio=performance.now();const s=setup({lento:true});assert.equal((await s.request()).code,504);assert.equal(s.calls.length,0);assert.ok(performance.now()-inicio<1000);});
