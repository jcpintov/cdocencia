#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const handler=require('../api/security/session.js');
const AUTH_ADMIN='11111111-2222-4333-8444-555555555555';
const AUTH_USER='bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
const LEGACY='99999999-8888-4777-8666-555555555555';
const keys=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY'];
const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
const fetchOriginal=global.fetch;
let mode='admin', requests=[];
const bearer='Bearer eyJhbGciOi.e30.ValidSignature';
const response=()=>({statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v},
 end(body){this.body=JSON.parse(body)}});
const call=async(auth=bearer,method='GET')=>{
 const res=response();
 await handler({method,headers:auth?{authorization:auth}:{}},res);
 return res;
};
global.fetch=async (url,options)=>{
 requests.push({url:String(url),options});
 if(String(url).endsWith('/auth/v1/user')){
  if(mode==='badtoken')return {ok:false,status:401};
  const id=['user','forged'].includes(mode)?AUTH_USER:AUTH_ADMIN;
  return {ok:true,json:async()=>({id,email:'usuario@ofl.cl',
    email_confirmed_at:mode==='unconfirmed'?null:'2026-10-12T00:00:00Z'})};
 }
 if(!String(url).endsWith('/rest/v1/rpc/maestro_identidad_actual'))
   throw Error('El servidor no debe consultar otras rutas REST');
 if(mode==='backenderror')return {ok:false,status:503};
 if(mode==='empty')return {ok:true,json:async()=>[]};
 return {ok:true,json:async()=>[{
   auth_user_id: mode==='forged'?AUTH_ADMIN:['user'].includes(mode)?AUTH_USER:AUTH_ADMIN,
   legacy_user_id:LEGACY,
   rol:mode==='user'?'USER':mode==='unknownrole'?'ADMIN':'SUPERADMIN'
 }]};
};
(async()=>{
 assert.equal((await call(bearer,'POST')).statusCode,405);
 assert.equal((await call(null)).statusCode,401);
 assert.equal((await call('Bearer invalid')).statusCode,401);
 assert.equal((await call()).statusCode,503);
 Object.assign(process.env,{SUPABASE_URL:'https://unit-test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'safe-public-test-key'});
 mode='admin';requests=[];
 let result=await call();
 assert.equal(result.statusCode,200);
 assert.equal(result.body.role,'SUPERADMIN');
 assert.equal(requests.length,2);
 assert.equal(requests[1].options.method,'POST');
 assert.equal(requests[1].options.body,'{}');
 assert.equal(requests[1].options.headers.apikey,'safe-public-test-key');
 assert.equal(result.headers['Cache-Control'],'no-store, max-age=0');
 assert(!JSON.stringify(result).includes('service_role'));
 mode='user';result=await call();assert.equal(result.body.role,'USER');
 mode='forged';assert.equal((await call()).statusCode,403);
 mode='unknownrole';assert.equal((await call()).statusCode,403);
 mode='empty';assert.equal((await call()).statusCode,403);
 mode='unconfirmed';assert.equal((await call()).statusCode,401);
 mode='badtoken';assert.equal((await call()).statusCode,401);
 mode='backenderror';assert.equal((await call()).statusCode,502);
 process.env.SUPABASE_URL='http://unit-test.supabase.co';
 assert.equal((await call()).statusCode,503);
 console.log('PASS: roles JWT/RPC comprobados, 401/403/502/503, sin clave de servicio');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{
 for(const k of keys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k]}
 global.fetch=fetchOriginal;
});
