'use strict';
/**
 * Doctrina–Docencia: verificación de sesión preparada para el corte a Supabase Auth.
 * SOLO LECTURA. No confía en es_admin, email ni p_admin_id del navegador.
 *
 * Configuración requerida exclusivamente en servidor:
 *   SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY,
 *   Supabase Auth y RPC de identidad sin clave de servicio.
 *
 * En ausencia de configuración: 503 (fail closed). No modifica la sesión
 * de autenticación heredada ni habilita acciones administrativas.
 */
const ALLOWED_ORIGIN_SUFFIX = '.supabase.co';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function reply(res, code, payload) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Vary', 'Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

function config() {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  try {
    const origin = new URL(url);
    if (origin.protocol !== 'https:' || !origin.hostname.endsWith(ALLOWED_ORIGIN_SUFFIX) ||
        origin.username || origin.password || origin.port || origin.pathname !== '/') return null;
    return { url: origin.origin, publishableKey };
  } catch (_) { return null; }
}

async function getJson(url, options) {
  const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(8000) });
  if (!response.ok) return { ok: false, status: response.status };
  return { ok: true, data: await response.json() };
}

async function handler(req, res) {
  if (req.method !== 'GET') return reply(res, 405, {error: 'method_not_allowed'});
  const authorization = req.headers?.authorization || '';
  const match = /^Bearer (\S+)$/.exec(authorization);
  if (!match || !TOKEN.test(match[1]) || match[1].length > 12000)
    return reply(res, 401, {error: 'authentication_required'});
  const conf = config();
  if (!conf) return reply(res, 503, {error: 'auth_transition_not_configured'});
  try {
    const authResponse = await getJson(conf.url + '/auth/v1/user', {
      headers: { apikey: conf.publishableKey, Authorization: 'Bearer ' + match[1] }
    });
    if (!authResponse.ok || !UUID.test(authResponse.data?.id || '') ||
        typeof authResponse.data?.email !== 'string' || !authResponse.data?.email_confirmed_at) {
      return reply(res, 401, {error: 'invalid_session'});
    }
    const identity = await fetch(conf.url + '/rest/v1/rpc/maestro_identidad_actual', {
      method: 'POST',
      headers: { apikey: conf.publishableKey, Authorization: 'Bearer ' + match[1],
        'Content-Type': 'application/json' },
      body: '{}', redirect: 'error', signal: AbortSignal.timeout(8000)
    });
    if (!identity.ok) return reply(res, 502, {error: 'identity_service_unavailable'});
    const profiles = await identity.json();
    if (!Array.isArray(profiles) || profiles.length !== 1)
      return reply(res, 403, {error: 'member_not_authorized'});
    const profile = profiles[0];
    if (!UUID.test(profile?.auth_user_id || '') || !UUID.test(profile?.legacy_user_id || '') ||
        profile.auth_user_id.toLowerCase() !== authResponse.data.id.toLowerCase() ||
        !['USER', 'SUPERADMIN'].includes(profile.rol))
      return reply(res, 403, {error: 'role_mapping_not_authorized'});
    return reply(res, 200, {
      authenticated: true, role: profile.rol, auth_user_id: profile.auth_user_id,
      legacy_user_id: profile.legacy_user_id
    });
  } catch (_) {
    return reply(res, 502, {error: 'authentication_service_unavailable'});
  }
}
module.exports = handler;
