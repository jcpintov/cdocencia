#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const handler = require('../api/security/session.js');

const authUID = '11111111-2222-4333-8444-555555555555';
const anotherUID = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
const legacyUID = '99999999-8888-4777-8666-555555555555';
const vars=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SERVICE_ROLE_KEY','SUPERADMIN_AUTH_USER_ID'];
const before=Object.fromEntries(vars.map(v=>[v,process.env[v]]));
const oldFetch=global.fetch;
const oldAbortSignal=global.AbortSignal;
function req(authorization,method='GET'){return {method,headers: authorization?{authorization}:{}};}
function response(){
 return {statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v},end(body){this.body=JSON.parse(body);}};
}
async function hit(request){const res=response();await handler(request,res);return res;}
function stub(uid,admin,verified=true,dbOK=true) {
 const calls=[];
 global.fetch=async(url,options)=>{
  calls.push({url:String(url),options});
  if(String(url).includes('/auth/v1/user')) {
   return {ok:true,json:async()=>({id:uid,email:'usuario@ofl.cl',email_confirmed_at:verified?'2026-10-12T00:00:00Z':null})};
  }
  return dbOK?{ok:true,json:async()=>[{id:legacyUID,email:'usuario@ofl.cl',es_admin:admin}]}:{ok:false,status:503};
 };
 return calls;
}
(async()=>{
  assert.equal((await hit(req('Bearer e30.e30.valid','POST'))).statusCode,405);
  assert.equal((await hit(req())).statusCode,401);
  assert.equal((await hit(req('Bearer 123'))).statusCode,401);
  assert.equal((await hit(req('Bearer e30.e30.valid'))).statusCode,503);
  Object.assign(process.env,{
   SUPABASE_URL:'https://unit-test.supabase.co',
   SUPABASE_PUBLISHABLE_KEY:'public-test-key',
   SUPABASE_SERVICE_ROLE_KEY:'server-only-test-secret',
   SUPERADMIN_AUTH_USER_ID:authUID
  });
  let calls=stub(authUID,true);
  let result=await hit(req('Bearer e30.e30.valid'));
  assert.equal(result.statusCode,200);
  assert.equal(result.body.role,'SUPERADMIN');
  assert(!JSON.stringify(result.body).includes('server-only-test-secret'));
  assert.equal(calls.length,2);
  assert.equal(calls[0].options.headers.apikey,'public-test-key');
  assert.equal(calls[1].options.headers.apikey,'server-only-test-secret');
  assert.equal(result.headers['Cache-Control'],'no-store, max-age=0');

  stub(anotherUID,false);
  result=await hit(req('Bearer e30.e30.valid'));
  assert.equal(result.statusCode,200);
  assert.equal(result.body.role,'USER');

  stub(anotherUID,true);
  assert.equal((await hit(req('Bearer e30.e30.valid'))).statusCode,403);

  stub(authUID,false);
  assert.equal((await hit(req('Bearer e30.e30.valid'))).statusCode,403);

  stub(authUID,true,false);
  assert.equal((await hit(req('Bearer e30.e30.valid'))).statusCode,401);

  stub(authUID,true,true,false);
  assert.equal((await hit(req('Bearer e30.e30.valid'))).statusCode,502);

  process.env.SUPABASE_URL='http://unit-test.supabase.co';
  assert.equal((await hit(req('Bearer e30.e30.valid'))).statusCode,503);
  console.log('PASS: sesión servidor, rol único, fallo cerrado, no secretos ni acceso anónimo');
})().catch(err=>{console.error(err);process.exitCode=1;}).finally(()=>{
 for(const v of vars){if(before[v]===undefined)delete process.env[v];else process.env[v]=before[v];}
 global.fetch=oldFetch;global.AbortSignal=oldAbortSignal;
});
