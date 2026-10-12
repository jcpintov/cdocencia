'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createDocenciaPgAdapters}=require('../docencia-recovery-pg-adapter.cjs');
function createDb() {
  const calls=[];
  const db={async query(sql,args=[]) {
    calls.push({sql,args});
    if (sql.includes('as digest')) return {rows:[{digest:'$2a$12$'+'A'.repeat(53)}]};
    if (sql.includes('consume_reset_token')) return {rows:[{ok:true}]};
    if (sql.includes('from public.usuarios')) return {rows:[{id:'synthetic-id',email:'member@example.test'}]};
    return {rows:[],rowCount:1};
  }};
  return {db,calls};
}
test('adapter uses parameterized queries only and never embeds user input in SQL',async()=>{
  const {db,calls}=createDb();const a=createDocenciaPgAdapters(db);
  await a.accounts.findByEmail('member@example.test');
  await a.tokens.issue({userId:'synthetic-id',tokenHash:'a'.repeat(64),expiresAt:1700000000000});
  await a.tokens.revoke({tokenHash:'a'.repeat(64)});
  assert.equal(await a.tokens.consumeAndChangePassword({tokenHash:'a'.repeat(64),passwordHash:'$2a$12$'+'A'.repeat(53)}),true);
  assert.equal(calls.length,4);
  for(const c of calls) {assert.match(c.sql,/\$1/);assert.equal(c.sql.includes('member@example.test'),false);assert.equal(c.sql.includes('synthetic-id'),false);}
  assert.ok(calls[1].args[2] instanceof Date);
  assert.match(calls[3].sql,/docencia_private\.consume_reset_token\(\$1,\$2\)/);
});
test('password digest stays compatible with existing pgcrypto bcrypt login',async()=>{
  const {db,calls}=createDb();const a=createDocenciaPgAdapters(db);
  assert.match(await a.hashPassword('SyntheticExamplePassword123!'),/^\$2a\$/);
  assert.match(calls[0].sql,/extensions\.crypt\(\$1::text, extensions\.gen_salt\('bf',12\)\)/);
  assert.equal(calls[0].args[0],'SyntheticExamplePassword123!');
});
test('invalid server digest fails closed',async()=>{
  const bad={query:async()=>({rows:[{digest:'plaintext'}]})};
  await assert.rejects(createDocenciaPgAdapters(bad).hashPassword('SyntheticExamplePassword123!'));
  assert.throws(()=>createDocenciaPgAdapters(null));
});
