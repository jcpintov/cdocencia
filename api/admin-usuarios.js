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
    .select('id,email,es_admin')
    .eq('auth_user_id', identity.user.id)
    .maybeSingle();
  if (profileError || !profile?.es_admin ||
      String(identity.user.email || '').toLowerCase() !== 'jpintov@gmail.com' ||
      String(profile.email || '').toLowerCase() !== 'jpintov@gmail.com') {
    return reply(res, 403, { error: 'Sin autorización' });
  }

  const { action } = req.body || {};
  if (action !== 'crear') return reply(res, 400, { error: 'Acción no admitida' });
  if (action === 'crear') {
    const nombre = String(req.body?.nombre || '').trim().replace(/\s+/g, ' ');
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (nombre.length < 3 || nombre.length > 150 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
        email.includes('candidatosincorreo')) {
      return reply(res, 422, { error: 'Verifique el nombre y el correo electrónico real del usuario' });
    }
    const { data: existing, error: lookupError } = await admin.from('usuarios')
      .select('id').ilike('email', email).limit(1);
    if (lookupError) return reply(res, 503, { error: 'No se pudo verificar el padrón' });
    if (existing?.length) return reply(res, 409, { error: 'El correo ya está registrado' });
    // La ampliación del padrón está autorizada; se mantienen las validaciones
    // de identidad Superadmin y la unicidad del correo en la base de datos.
    const { data: created, error: insertError } = await admin.from('usuarios')
      .insert({ nombre, email, es_admin: false, debe_cambiar_clave: true,
        auth_user_id: null, clave_hash: null, terminos_aceptados: false })
      .select('id,nombre,email').single();
    if (insertError) return reply(res, insertError.code === '23505' ? 409 : 503,
      { error: insertError.code === '23505' ? 'El correo ya está registrado' : 'No se pudo registrar el usuario' });
    return reply(res, 201, { ok: true, usuario: created, estado: 'Pendiente de primer acceso' });
  }
  return reply(res, 400, { error: 'Acción no admitida' });
}
