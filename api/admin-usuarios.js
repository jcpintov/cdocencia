import informes from '../server/admin-informes.js';
import gestionarRoles from '../server/admin-roles.js';
import {esOperador} from '../lib/roles-admin.js';
import { createClient } from '@supabase/supabase-js';

function normalizarNombreHermano(valor) {
  const nombre=String(valor||'').trim().replace(/\s+/g,' ')
    .replace(/^(?:\s*Q\s*[.·:]*\s*H\s*[.·:]*\s*)+/iu,'').trim();
  return nombre ? 'Q.·.H.·. '+nombre : '';
}

function reply(res, status, message) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(message);
}

export default async function handler(req, res) {
  if(req.query?.operacion==='informes')return informes(req,res);
  if(req.query?.operacion==='roles')return gestionarRoles(req,res);
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
    .select('id,email,es_admin,rol,cuenta_eliminada')
    .eq('auth_user_id', identity.user.id)
    .maybeSingle();
  if(profileError||!esOperador(profile,identity.user))return reply(res,403,{error:'Se requiere administración docente'});

  const { action } = req.body || {};
  if (!['crear','editar'].includes(action)) return reply(res, 400, { error: 'Acción no admitida' });
  if (action === 'crear' || action === 'editar') {
    const nombre = normalizarNombreHermano(req.body?.nombre);
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (nombre.length < 3 || nombre.length > 150 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
        email.includes('candidatosincorreo')) {
      return reply(res, 422, { error: 'Verifique el nombre y el correo electrónico real del usuario' });
    }
    let destino=null;
    if(action==='editar'){
      const id=req.body?.id;
      if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
        return reply(res,422,{error:'Seleccione un integrante válido'});
      const {data,error}=await admin.from('usuarios')
        .select('id,email,es_admin,auth_user_id,rol,cuenta_eliminada').eq('id',id).maybeSingle();
      if(error)return reply(res,503,{error:'No se pudo verificar el integrante'});
      if(!data)return reply(res,404,{error:'Integrante no encontrado'});
      if(data.cuenta_eliminada)return reply(res,404,{error:'Integrante no encontrado'});
      if(data.es_admin||['ADMIN','SUPERADMIN'].includes(data.rol))
        return reply(res,403,{error:'Las cuentas administrativas y de prueba están protegidas'});
      if(String(data.email).toLowerCase()==='dummy@ofl.cl'&&email!=='dummy@ofl.cl')return reply(res,422,{error:'La cuenta Dummy conserva su correo de prueba; puede editar el nombre o eliminar la cuenta'});
      if(data.auth_user_id&&email!==String(data.email).toLowerCase())
        return reply(res,422,{error:'Correo vinculado a Auth: no se modifica desde el padrón. Puede actualizar el nombre.'});
      destino=data;
    }
    const { data: existing, error: lookupError } = await admin.from('usuarios')
      .select('id').ilike('email', email).limit(2);
    if (lookupError) return reply(res, 503, { error: 'No se pudo verificar el padrón' });
    if (existing?.some(u=>u.id!==destino?.id)) return reply(res, 409, { error: 'El correo ya está registrado' });
    if(action==='editar'){
      const {data:updated,error:updateError}=await admin.from('usuarios')
        .update({nombre,email}).eq('id',destino.id).eq('email',destino.email)
        .eq('es_admin',false).select('id,nombre,email').maybeSingle();
      if(updateError)return reply(res,updateError.code==='23505'?409:503,
        {error:updateError.code==='23505'?'El correo ya está registrado':'No se pudo actualizar el integrante'});
      if(!updated)return reply(res,409,{error:'El registro cambió: actualice el padrón antes de guardar'});
      return reply(res,200,{ok:true,usuario:updated,estado:'Perfil actualizado'});
    }
    // El padrón puede ampliarse; solo se permite crear usuarios ordinarios sin credenciales.
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

