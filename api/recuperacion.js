import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { createHash } from 'node:crypto';

const generic = 'Solicitud recibida. Si la dirección ingresada es válida, recibirá un correo electrónico con las instrucciones correspondientes.';
const sha = value => createHash('sha256').update(value).digest('hex');
const json = (res, status, body) => res.status(status).setHeader('Cache-Control', 'no-store').json(body);
const emailValid = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
const configKeys = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASSWORD','SMTP_FROM','RECOVERY_HASH_PEPPER'];

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });
  if (configKeys.some(k => !process.env[k])) return json(res, 503, { error: 'Servicio temporalmente no disponible' });
  const { action, email: rawEmail, code, password } = req.body || {};
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!emailValid(email)) return json(res, 400, { error: 'Correo inválido' });
  if (action !== 'request' && action !== 'confirm') return json(res, 400, { error: 'Operación inválida' });
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const pepper = process.env.RECOVERY_HASH_PEPPER;
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const quota = async (key, max, minutes) => {
    const { data, error } = await db.rpc('recuperacion_consumir_cupo_servidor', {
      p_clave: sha(pepper + ':' + key), p_maximo: max, p_ventana: minutes + ' minutes'
    });
    if (error) throw error;
    return data === true;
  };
  try {
    if (!await quota('ip:' + ip, 12, 60)) return json(res, 429, { error: 'Demasiadas solicitudes. Inténtelo más tarde.' });
    if (action === 'request') {
      if (!await quota('request:' + email, 3, 60)) return json(res, 200, { message: generic });
      const { data, error } = await db.rpc('recuperacion_emitir_servidor', { p_email: email });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      const found = result?.encontrado === true;
      const body = found
        ? 'Su código de recuperación es: ' + result.codigo + '\nCaduca en 15 minutos. Si no lo solicitó, ignore este mensaje.'
        : 'Su dirección de correo electrónico no se encuentra registrada. Póngase en contacto con el administrador.';
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      });
      await transport.sendMail({
        from: process.env.SMTP_FROM, to: email,
        subject: 'Cámara de Docencia — acceso a su cuenta',
        text: body
      });
      return json(res, 200, { message: generic });
    }
    if (typeof code !== 'string' || !/^\d{8}$/.test(code)
      || typeof password !== 'string' || password.length < 10 || password.length > 128)
      return json(res, 400, { error: 'Código o contraseña inválidos' });
    if (!await quota('confirm:' + email, 5, 60)) return json(res, 429, { error: 'Demasiados intentos. Solicite un nuevo código más tarde.' });
    const { data, error } = await db.rpc('recuperacion_confirmar_servidor', {
      p_email: email, p_codigo: code, p_nueva_clave: password
    });
    if (error) throw error;
    return data === true
      ? json(res, 200, { ok: true })
      : json(res, 400, { error: 'Código inválido o vencido' });
  } catch (err) {
    console.error('Recovery error:', err?.code || err?.name || 'unknown');
    return json(res, 503, { error: 'Servicio temporalmente no disponible' });
  }
}
