'use strict';
// Private SMTP adapter. Not an HTTP route or connected to operational recovery.
function loadOflSmtpConfig(env) {
  if (!env || typeof env !== 'object') throw new TypeError('Environment required');
  if (env.VERCEL_ENV === 'production' || env.RECOVERY_MODE === 'production') throw new Error('Production recovery disabled');
  if (env.VERCEL_ENV && env.VERCEL_ENV !== 'preview') throw new Error('Preview only');
  if (!['local','preview'].includes(env.RECOVERY_MODE)) throw new Error('Invalid recovery mode');
  if (env.VERCEL_ENV === 'preview' && env.RECOVERY_MODE !== 'preview') throw new Error('Preview mode required');
  if (env.SMTP_HOST !== 'mail.ofl.cl' || String(env.SMTP_PORT) !== '465' || String(env.SMTP_SECURE) !== 'true') throw new Error('Invalid TLS endpoint');
  if (env.SMTP_USER !== 'no-reply@ofl.cl' || env.SMTP_FROM !== 'no-reply@ofl.cl') throw new Error('Invalid mailbox');
  if (typeof env.SMTP_PASSWORD !== 'string' || !env.SMTP_PASSWORD.length) throw new Error('SMTP password missing');
  return {host:'mail.ofl.cl',port:465,secure:true,from:'no-reply@ofl.cl',auth:{user:'no-reply@ofl.cl',pass:env.SMTP_PASSWORD}};
}
async function sendRecoveryMail({config,mail,createTransport}) {
  if (!config || typeof createTransport !== 'function') throw new TypeError('Transport required');
  if (!mail || typeof mail.to !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.to) ||
      typeof mail.subject !== 'string' || !mail.subject || typeof mail.text !== 'string' || !mail.text) throw new TypeError('Invalid message');
  const transport=createTransport({host:config.host,port:config.port,secure:config.secure,auth:config.auth,tls:{rejectUnauthorized:true}});
  if (!transport || typeof transport.sendMail !== 'function') throw new TypeError('Invalid transport');
  await transport.sendMail({from:config.from,to:mail.to,subject:mail.subject,text:mail.text});
  return true;
}
module.exports={loadOflSmtpConfig,sendRecoveryMail};
