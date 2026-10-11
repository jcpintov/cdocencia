'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { issue, consume, createMail, PUBLIC_RESPONSE, TTL_MS } = require('../recovery-smtp-lab.cjs');
test('tokens are unique and only hashes are retained', () => {
  const a=issue({email:'User@Example.cl',now:1000});
  const b=issue({email:'User@Example.cl',now:1000});
  assert.notEqual(a.token,b.token);
  assert.equal(a.record.email,'user@example.cl');
  assert.equal(a.record.tokenHash.length,64);
  assert.equal(JSON.stringify(a.record).includes(a.token),false);
});
test('token can be consumed exactly once', () => {
  const {token,record}=issue({email:'test@example.cl',now:1000});
  assert.equal(consume(record,'wrong',1001),false);
  assert.equal(consume(record,token,1001),true);
  assert.equal(consume(record,token,1002),false);
});
test('expired token cannot be consumed', () => {
  const {token,record}=issue({email:'test@example.cl',now:1000});
  assert.equal(consume(record,token,1000+TTL_MS),false);
});
test('mail contains token but public response never does', () => {
  const {token}=issue({email:'test@example.cl'});
  const mail=createMail({to:'test@example.cl',token,origin:'https://example.cl'});
  assert.match(mail.text,/recuperar\?token=/);
  assert.equal(JSON.stringify(PUBLIC_RESPONSE).includes(token),false);
});
