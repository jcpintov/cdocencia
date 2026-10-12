'use strict';
// Private PostgreSQL adapter for the Docencia recovery service.
// Requires a trusted backend connection; never bundle this file into the browser.
// STAGING CONTRACT ONLY: docencia_private schema must be reviewed and installed separately.
function createDocenciaPgAdapters(db) {
  if (!db || typeof db.query!=='function') throw new TypeError('Privileged PostgreSQL query interface required');
  const accounts=Object.freeze({
    async findByEmail(email) {
      const r=await db.query(
        'select id, email from public.usuarios where lower(btrim(email))=$1 limit 1',[email]);
      return r.rows[0]||null;
    }
  });
  const tokens=Object.freeze({
    async issue({userId,tokenHash,expiresAt}) {
      await db.query(
        'insert into docencia_private.password_reset_tokens(user_id,token_hash,expires_at) values($1,$2,$3)',
        [userId,tokenHash,new Date(expiresAt)]);
    },
    async revoke({tokenHash}) {
      await db.query('delete from docencia_private.password_reset_tokens where token_hash=$1',[tokenHash]);
    },
    async consumeAndChangePassword({tokenHash,passwordHash}) {
      const r=await db.query(
        'select docencia_private.consume_reset_token($1,$2) as ok',[tokenHash,passwordHash]);
      return r.rows[0]?.ok===true;
    }
  });
  // Existing Docencia login verifies pgcrypto bcrypt with crypt(pass, stored_hash).
  // Hashing with extensions.gen_salt('bf',12) preserves the existing verifier.
  async function hashPassword(password) {
    const r=await db.query(
      "select extensions.crypt($1::text, extensions.gen_salt('bf',12)) as digest",[password]);
    const digest=r.rows[0]?.digest;
    if (typeof digest!=='string' || !/^\$2a\$[0-9]{2}\$[./A-Za-z0-9]{53}$/.test(digest))
      throw new Error('Invalid private password digest');
    return digest;
  }
  return Object.freeze({accounts,tokens,hashPassword});
}
module.exports={createDocenciaPgAdapters};
