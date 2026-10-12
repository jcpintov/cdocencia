'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createDocenciaRecoveryService,PUBLIC_RESPONSE,TOKEN_TTL_MS}=require('../docencia-recovery-service.cjs');
const context={networkKey:'synthetic-network-key'};
function harness({exists=true,limited=false,failMail=false,clock=20000000}={}) {
  const records=new Map(),messages=[],calls=[];
  let savedPasswordHash=null;
  const service=createDocenciaRecoveryService({
    accounts:{async findByEmail(email){calls.push('lookup');return exists?{id:'synthetic-id',email}:null;}},
    tokens:{
      async issue({userId,tokenHash,expiresAt}){calls.push('issue');records.set(tokenHash,{userId,expiresAt,used:false});},
      async revoke({tokenHash}){calls.push('revoke');records.delete(tokenHash);},
      async consumeAndChangePassword({tokenHash,passwordHash,now}) {
        calls.push('consume');const r=records.get(tokenHash);
        if(!r || r.used || now>=r.expiresAt) return false;
        r.used=true;savedPasswordHash=passwordHash;return true;
      }
    },
    mailer:{async send(message){calls.push('send');if(failMail)throw Error('synthetic failure');messages.push(message);}},
    limiter:{async allow(){calls.push('limit');return !limited;}},
    hashPassword:async password=>'synthetic-bcrypt-'+password.length,
    publicOrigin:'https://preview.example.test',now:()=>clock
  });
  function token(){return new URL(messages[0].text.match(/https:\/\/\S+/)[0]).searchParams.get('token');}
  return {service,records,messages,calls,token,get savedPasswordHash(){return savedPasswordHash;}};
}
test('request never enumerates accounts or returns tokens',async()=>{
  const known=harness(),unknown=harness({exists:false});
  const a=await known.service.request({email:'member@example.test'},context);
  const b=await unknown.service.request({email:'other@example.test'},context);
  assert.deepEqual(a,b);assert.deepEqual(a,PUBLIC_RESPONSE);
  assert.equal(JSON.stringify(a).includes('token'),false);
  assert.equal(known.messages.length,1);assert.equal(unknown.messages.length,0);
});
test('raw token is sent only by mail; persistence sees SHA-256',async()=>{
  const h=harness();await h.service.request({email:'MEMBER@example.test'},context);
  const token=h.token();assert.match(token,/^[A-Za-z0-9_-]{43}$/);
  const hash=crypto.createHash('sha256').update(token).digest('hex');
  assert.equal(h.records.has(hash),true);assert.equal(h.records.has(token),false);
  assert.equal(h.messages[0].to,'member@example.test');
  assert.equal(new URL(h.messages[0].text.match(/https:\/\/\S+/)[0]).pathname,'/docencia-restablecer.html');
});
test('tokens expire after thirty minutes',async()=>{
  const h=harness();await h.service.request({email:'member@example.test'},context);
  const hash=crypto.createHash('sha256').update(h.token()).digest('hex');
  assert.equal(h.records.get(hash).expiresAt,20000000+TOKEN_TTL_MS);
  h.records.get(hash).expiresAt=20000000;
  assert.deepEqual(await h.service.confirm({token:h.token(),newPassword:'SyntheticExamplePassword123!'},context),{ok:false});
});
test('valid reset succeeds once only',async()=>{
  const h=harness();await h.service.request({email:'member@example.test'},context);
  const args={token:h.token(),newPassword:'SyntheticExamplePassword123!'};
  assert.deepEqual(await h.service.confirm(args,context),{ok:true});
  assert.deepEqual(await h.service.confirm(args,context),{ok:false});
  assert.equal(h.savedPasswordHash,'synthetic-bcrypt-28');
});
test('untrusted or absent request context and invalid tokens fail closed',async()=>{
  const h=harness();
  assert.deepEqual(await h.service.request({email:'invalid'},context),PUBLIC_RESPONSE);
  assert.deepEqual(await h.service.request({email:'member@example.test'},{networkKey:''}),PUBLIC_RESPONSE);
  assert.deepEqual(await h.service.confirm({token:'invalid',newPassword:'SyntheticExamplePassword123!'},context),{ok:false});
  assert.deepEqual(await h.service.confirm({token:'A'.repeat(43),newPassword:'short'},context),{ok:false});
  assert.equal(h.records.size,0);assert.equal(h.messages.length,0);
});
test('rate limits prevent account lookup and delivery',async()=>{
  const h=harness({limited:true});await h.service.request({email:'member@example.test'},context);
  assert.equal(h.calls.includes('lookup'),false);assert.equal(h.messages.length,0);
});
test('failed mail delivery revokes token and hides account state',async()=>{
  const h=harness({failMail:true});
  assert.deepEqual(await h.service.request({email:'member@example.test'},context),PUBLIC_RESPONSE);
  assert.equal(h.records.size,0);assert.equal(h.calls.includes('revoke'),true);
});
test('trusted recovery origin must use HTTPS without credentials',()=>{
  const deps={accounts:{findByEmail(){}},tokens:{issue(){},revoke(){},consumeAndChangePassword(){}},
    mailer:{send(){}},limiter:{allow(){}},hashPassword(){},now:()=>0};
  assert.throws(()=>createDocenciaRecoveryService({...deps,publicOrigin:'http://preview.example.test'}));
  assert.throws(()=>createDocenciaRecoveryService({...deps,publicOrigin:'https://user:pass@preview.example.test'}));
});
test('malformed token does not reach the hashing or persistence adapter',async()=>{
  const h=harness();
  assert.deepEqual(await h.service.confirm({token:'invalid',newPassword:'SyntheticExamplePassword123!'},context),{ok:false});
  assert.equal(h.calls.length,0);
});
