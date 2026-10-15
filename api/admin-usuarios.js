import { createClient } from '@supabase/supabase-js';

function reply(res, status, message) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(message);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return reply(res, 405, { error: 'Método no permitido' });
  }

  const url = process.env.SUPABASE_URL;
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publicKey || !serviceKey) {
    return reply(res, 503, { error: 'Servicio de administración no configurado' });
  }

  const token = /^Bearer (.+)$/i.exec(req.headers.authorization || '')?.[1];
  if (!token) return reply(res, 401, { error: 'Sesión requerida' });

  const client = createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: identity, error: identityError } = await client.auth.getUser(token);
  if (identityError || !identity?.user?.id) {
    return reply(res, 401, { error: 'Sesión no válida' });
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: profile, error: profileError } = await admin.from('usuarios')
    .select('id,es_admin')
    .eq('auth_user_id', identity.user.id)
    .maybeSingle();
  if (profileError || !profile?.es_admin) {
    return reply(res, 403, { error: 'Sin autorización' });
  }

  const { action, usuario_id } = req.body || {};
  if (action !== 'activar') return reply(res, 400, { error: 'Acción no admitida' });
  if (typeof usuario_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(usuario_id)) {
    return reply(res, 400, { error: 'Identificador inválido' });
  }
  const { data: target, error: targetError } = await admin.from('usuarios')
    .select('id,email,nombre,es_admin,auth_user_id')
    .eq('id', usuario_id)
    .maybeSingle();
  if (targetError || !target) return reply(res, 404, { error: 'Usuario no encontrado' });
  if (target.es_admin || target.auth_user_id) {
    return reply(res, 409, { error: 'Cuenta vinculada o protegida' });
  }
  const email = String(target.email || '').trim().toLowerCase();
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || email.length > 254 ||
      email.includes('candidatosincorreo')) {
    return reply(res, 422, { error: 'Dirección de correo pendiente de verificación' });
  }
  // No crear cuentas ni enviar correos durante operaciones administrativas.
  // El alta y el código de verificación se gestionarán al primer inicio de sesión.
  return reply(res, 501, {
    error: 'Activación por primer acceso pendiente de implementación; no se envió correo'
  });
}
