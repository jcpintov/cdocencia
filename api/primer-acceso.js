import { createClient } from '@supabase/supabase-js';
import { randomInt } from 'node:crypto';
import nodemailer from 'nodemailer';

const message = 'Si el correo corresponde a una cuenta pendiente, recibirá instrucciones de activación.';
const reply = (res, status, body) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
};
const passwordValid = value => typeof value === 'string' && value.length >= 8 && value.length <= 128
  && (value.match(/[A-Za-z0-9]/g) || []).length >= 6 && /[^A-Za-z0-9]/.test(value);

export default async function handler(req, res) {
  if (req.method !== 'POST') return reply(res, 405, { error: 'Método no permitido' });
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return reply(res, 400, { error: 'Correo inválido' });
  }
  // El piloto se limita a la cuenta de prueba hasta concluir la validación E2E.
  // Para habilitar el padrón se requiere una decisión explícita en el entorno de producción.
  if (process.env.PRIMER_ACCESO_GENERAL_ENABLED !== 'true' && email !== 'dummy@ofl.cl') {
    if (req.body?.accion === 'solicitar') return reply(res, 200, { mensaje: message });
    if (req.body?.accion === 'confirmar') return reply(res, 400, { error: 'Código inválido o vencido' });
    return reply(res, 400, { error: 'Acción inválida' });
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return reply(res, 503, { error: 'Servicio no configurado' });
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  if (req.body?.accion === 'solicitar') {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      return reply(res, 503, { error: 'Correo institucional no configurado' });
    }
    const code = String(randomInt(0, 100000000)).padStart(8, '0');
    try {
      const { data: issued, error } = await admin.rpc('primer_acceso_emitir', { p_email: email, p_codigo: code });
      if (error) throw error;
      if (issued) {
        const transport = nodemailer.createTransport({
          host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465),
          secure: process.env.SMTP_SECURE !== 'false', connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        });
        await transport.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER, to: email,
          subject: 'Cámara de Docencia: código de primer acceso',
          text: 'Código: ' + code + '\nVálido durante 15 minutos. Si no lo solicitó, ignore este mensaje.'
        });
      }
      return reply(res, 200, { mensaje: message });
    } catch (err) {
      console.error('Primer acceso: error de emisión', err?.code || err?.name || 'unknown');
      return reply(res, 503, { error: 'Servicio temporalmente no disponible' });
    }
  }
  if (req.body?.accion === 'confirmar') {
    const code = typeof req.body.codigo === 'string' ? req.body.codigo : '';
    if (!/^\d{8}$/.test(code)) return reply(res, 400, { error: 'Código inválido' });
    if (!passwordValid(req.body.clave)) return reply(res, 400, { error: 'Contraseña no cumple los requisitos' });
    let authId;
    try {
      const { data: profileId, error: verifyError } = await admin.rpc('primer_acceso_verificar', { p_email: email, p_codigo: code });
      if (verifyError) throw verifyError;
      if (!profileId) return reply(res, 400, { error: 'Código inválido o vencido' });
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email, password: req.body.clave, email_confirm: true
      });
      if (createError || !created?.user?.id) return reply(res, 409, { error: 'No se pudo activar la cuenta. Contacte al administrador.' });
      authId = created.user.id;
      const { data: linked, error: linkError } = await admin.from('usuarios')
        .update({ auth_user_id: authId, debe_cambiar_clave: false, clave_hash: null })
        .eq('id', profileId).is('auth_user_id', null).select('id').maybeSingle();
      if (linkError || !linked) throw new Error('link_failed');
      // El OTP se elimina solo cuando Supabase Auth quedó vinculado al perfil.
      // Ante un fallo de Auth, el mismo código puede reintentarse dentro de sus 15 minutos.
      // Una cuenta vinculada no puede volver a validar el código, aunque falle esta limpieza.
      const { error: cleanupError } = await admin.from('primer_acceso_codigos')
        .delete().eq('usuario_id', profileId);
      if (cleanupError) console.error('Primer acceso: limpieza de código pendiente');
      return reply(res, 200, { mensaje: 'Cuenta activada. Ya puede iniciar sesión.' });
    } catch (err) {
      if (authId) {
        const { error: rollbackError } = await admin.auth.admin.deleteUser(authId);
        if (rollbackError) console.error('Primer acceso: reversión Auth requiere revisión');
      }
      console.error('Primer acceso: confirmación fallida', err?.message === 'link_failed' ? 'link_failed' : err?.code || 'unknown');
      return reply(res, 503, { error: 'No se pudo completar la activación' });
    }
  }
  return reply(res, 400, { error: 'Acción inválida' });
}
