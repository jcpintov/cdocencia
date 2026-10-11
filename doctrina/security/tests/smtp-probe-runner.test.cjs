'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {main}=require('../smtp-probe-runner.cjs');
test('runner does not send without explicit execution flag',async()=>{
  const original=process.env.SMTP_PROBE_EXECUTE;
  try { delete process.env.SMTP_PROBE_EXECUTE; await assert.rejects(main(),/Explicit execution flag required/); }
  finally { if(original===undefined) delete process.env.SMTP_PROBE_EXECUTE; else process.env.SMTP_PROBE_EXECUTE=original; }
});
test('runner rejects production before loading SMTP dependency',async()=>{
  const prior={flag:process.env.SMTP_PROBE_EXECUTE,vercel:process.env.VERCEL_ENV};
  try { process.env.SMTP_PROBE_EXECUTE='YES';process.env.VERCEL_ENV='production';await assert.rejects(main(),/Preview-only runner/); }
  finally { for(const [k,v] of [['SMTP_PROBE_EXECUTE',prior.flag],['VERCEL_ENV',prior.vercel]]){if(v===undefined)delete process.env[k];else process.env[k]=v;} }
});
