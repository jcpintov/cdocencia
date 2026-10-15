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

  // Por seguridad, las operaciones de escritura permanecerán bloqueadas
  // hasta validar las credenciales de servidor y el flujo de invitaciones.
  return reply(res, 501, { error: 'Activación de cuentas pendiente de habilitación' });
}
