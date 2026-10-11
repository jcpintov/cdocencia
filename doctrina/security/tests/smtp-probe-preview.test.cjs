'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {runSmtpProbe}=require('../smtp-probe-preview.cjs');
const env={VERCEL_ENV:'preview',RECOVERY_MODE:'preview',SMTP_HOST:'mail.ofl.cl',SMTP_PORT:'465',SMTP_SECURE:'true',SMTP_USER:'no-reply@ofl.cl',SMTP_FROM:'no-reply@ofl.cl',SMTP_PASSWORD:'synthetic-test-only',SMTP_TEST_TO:'jpintov@gmail.com'};
test('preview probe sends only to authorized recipient using mock',async()=>{
  let message;
  const result=await runSmtpProbe({env,now:new Date('2026-10-11T00:00:00Z'),createTransport:()=>({sendMail:async mail=>{message=mail;}})});
  assert.equal(result.ok,true);
  assert.equal(message.to,'jpintov@gmail.com');
  assert.match(message.text,/No se ha restablecido ninguna contraseña/);
});
test('probe refuses production',async()=>assert.rejects(runSmtpProbe({env:{...env,VERCEL_ENV:'production'},createTransport:()=>({sendMail:async()=>{}})})));
test('probe refuses unapproved recipient',async()=>assert.rejects(runSmtpProbe({env:{...env,SMTP_TEST_TO:'other@example.com'},createTransport:()=>({sendMail:async()=>{}})})));
test('probe refuses missing preview mode',async()=>assert.rejects(runSmtpProbe({env:{...env,RECOVERY_MODE:'local'},createTransport:()=>({sendMail:async()=>{}})})));
