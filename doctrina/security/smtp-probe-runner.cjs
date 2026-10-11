'use strict';
// Manual, non-HTTP runner. Never invoked during build or on import.
// Requires all Preview-only environment variables and explicit SMTP_PROBE_EXECUTE=YES.
const {runSmtpProbe}=require('./smtp-probe-preview.cjs');
async function main() {
  if (process.env.SMTP_PROBE_EXECUTE !== 'YES') throw new Error('Explicit execution flag required');
  if (process.env.VERCEL_ENV !== 'preview' || process.env.RECOVERY_MODE !== 'preview') throw new Error('Preview-only runner');
  const nodemailer=require('nodemailer');
  const result=await runSmtpProbe({env:process.env,createTransport:options=>nodemailer.createTransport({...options,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000})});
  process.stdout.write(JSON.stringify({ok:result.ok,environment:result.environment})+'\n');
}
if (require.main===module) main().catch(()=>{process.stderr.write('SMTP probe failed; consult private execution logs.\n');process.exitCode=1;});
module.exports={main};
