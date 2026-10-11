'use strict';
// Preview-only SMTP probe. Not a password-recovery endpoint.
// Deliberately no public HTTP handler: invoke only from an authenticated, isolated test runner.
const { loadOflSmtpConfig, sendRecoveryMail } = require('./smtp-ofl-adapter.cjs');
async function runSmtpProbe({ env, createTransport, now = new Date() }) {
  if (!env || env.VERCEL_ENV !== 'preview' || env.RECOVERY_MODE !== 'preview') throw new Error('Preview-only probe');
  if (env.SMTP_TEST_TO !== 'jpintov@gmail.com') throw new Error('Unauthorized test recipient');
  const config = loadOflSmtpConfig(env);
  const mail = {
    to: 'jpintov@gmail.com',
    subject: 'Doctrina–Docencia | Prueba SMTP laboratorio',
    text: 'Prueba técnica del laboratorio SMTP. Fecha UTC: ' + now.toISOString() + '. No se ha restablecido ninguna contraseña.'
  };
  await sendRecoveryMail({config,mail,createTransport});
  return { ok: true, recipient: 'jpintov@gmail.com', environment: 'preview' };
}
module.exports = {runSmtpProbe};
