'use strict';
// Private server-side Docencia recovery contract. Not an HTTP route or deployed handler.
const crypto=require('node:crypto');
const TOKEN_TTL_MS=30*60*1000;
const PUBLIC_RESPONSE=Object.freeze({message:'Si el correo está registrado, recibirá instrucciones.'});
const REJECTED_RESPONSE=Object.freeze({ok:false});
const VALID_EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_TOKEN=/^[A-Za-z0-9_-]{43}$/;

function createDocenciaRecoveryService({accounts,tokens,mailer,limiter,hashPassword,publicOrigin,now=Date.now}) {
  if (!accounts || typeof accounts.findByEmail!=='function' ||
      !tokens || typeof tokens.issue!=='function' || typeof tokens.revoke!=='function' || typeof tokens.consumeAndChangePassword!=='function' ||
      !mailer || typeof mailer.send!=='function' || !limiter || typeof limiter.allow!=='function' ||
      typeof hashPassword!=='function' || typeof now!=='function') throw new TypeError('Required server services missing');
  const origin=new URL(publicOrigin);
  if (origin.protocol!=='https:' || origin.username || origin.password || origin.search || origin.hash) throw new TypeError('Trusted HTTPS origin required');
  const hashToken=value=>crypto.createHash('sha256').update(value,'utf8').digest('hex');

  // The trusted HTTP adapter supplies networkKey, NEVER the untrusted request body.
  async function request({email},context) {
    const normalized=typeof email==='string'?email.trim().toLowerCase():'';
    if (!VALID_EMAIL.test(normalized) || normalized.length>254 ||
        !context || typeof context.networkKey!=='string' || !context.networkKey) return PUBLIC_RESPONSE;
    try {
      if (!await limiter.allow({action:'request',networkKey:context.networkKey,email:normalized})) return PUBLIC_RESPONSE;
      const account=await accounts.findByEmail(normalized);
      if (!account || !account.id || !account.email) return PUBLIC_RESPONSE;
      const token=crypto.randomBytes(32).toString('base64url');
      const tokenHash=hashToken(token);
      await tokens.issue({userId:account.id,tokenHash,expiresAt:now()+TOKEN_TTL_MS});
      const link=new URL('/recuperar',origin);
      link.searchParams.set('token',token);
      try {
        await mailer.send({to:account.email,subject:'Recuperación de acceso a Docencia',
          text:'Si solicitó recuperar su acceso, use este enlace (vigente durante 30 minutos): '+link.toString()});
      } catch (_) {
        await tokens.revoke({tokenHash});
      }
    } catch (_) {
      // Fail closed: public output must not indicate whether the account exists.
    }
    return PUBLIC_RESPONSE;
  }

  async function confirm({token,newPassword},context) {
    if (typeof token!=='string' || !VALID_TOKEN.test(token) ||
        typeof newPassword!=='string' || newPassword.length<12 || newPassword.length>128 ||
        !context || typeof context.networkKey!=='string' || !context.networkKey) return REJECTED_RESPONSE;
    try {
      if (!await limiter.allow({action:'confirm',networkKey:context.networkKey})) return REJECTED_RESPONSE;
      // The adapter must hash server-side using bcrypt compatible with legacy Docencia crypt().
      const passwordHash=await hashPassword(newPassword);
      if (typeof passwordHash!=='string' || !passwordHash) return REJECTED_RESPONSE;
      // REQUIRED adapter contract: atomic consume + password update in one DB transaction,
      // checking that token is unused and unexpired; failures roll back both operations.
      const changed=await tokens.consumeAndChangePassword({tokenHash:hashToken(token),passwordHash,now:now()});
      return changed===true?{ok:true}:REJECTED_RESPONSE;
    } catch (_) { return REJECTED_RESPONSE; }
  }
  return Object.freeze({request,confirm});
}
module.exports={createDocenciaRecoveryService,PUBLIC_RESPONSE,TOKEN_TTL_MS};
