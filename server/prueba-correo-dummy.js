import {createClient} from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import {esSuperadmin} from '../lib/roles-admin.js';
import {enviarConAuditoria} from '../lib/auditoria-correos.js';

const DESTINATARIOS=Object.freeze(['fotos.jpintov@gmail.com','peritajes.jpintov@gmail.com']);
const TIPO='prueba_smtp_dummy';
const ESPERA_MINUTOS=15;

export async function pruebaCorreoDummy(req,res){
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('Allow','POST');
 if(req.method!=='POST')return res.status(405).json({error:'Método no permitido'});
 const token=/^Bearer (.+)$/i.exec(req.headers.authorization||'')?.[1];
 if(!token)return res.status(401).json({error:'Sesión requerida'});
 const {SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:publicKey,SUPABASE_SERVICE_ROLE_KEY:secret}=process.env;
 if(!url||!publicKey||!secret)return res.status(503).json({error:'Servicio de autenticación no configurado'});
 try{
  const auth=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:identity,error:identityError}=await auth.auth.getUser(token);
  if(identityError||!identity?.user?.id)return res.status(401).json({error:'Sesión inválida'});
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:profile,error:profileError}=await admin.from('usuarios').select('id,email,es_admin,rol,cuenta_eliminada').eq('auth_user_id',identity.user.id).maybeSingle();
  if(profileError||!esSuperadmin(profile,identity.user))return res.status(403).json({error:'Acceso exclusivo del Superadmin'});
  if(process.env.VERCEL_ENV!=='production')return res.status(503).json({error:'Prueba habilitada solo en producción'});
  const {SMTP_HOST:host,SMTP_USER:user,SMTP_PASSWORD:pass,SMTP_FROM:from}=process.env;
  if(!host||!user||!pass)return res.status(503).json({error:'SMTP no configurado'});
  const desde=new Date(Date.now()-ESPERA_MINUTOS*60000).toISOString();
  const {data:recientes,error:checkError}=await admin.from('auditoria_correos').select('id,estado').eq('tipo',TIPO).gte('creado_en',desde).limit(1);
  if(checkError)return res.status(503).json({error:'No fue posible comprobar el límite de envíos'});
  if(recientes?.length)return res.status(429).json({error:'Ya se realizó un intento de prueba en los últimos 15 minutos'});
  const transport=nodemailer.createTransport({
   host,port:Number(process.env.SMTP_PORT||465),
   secure:process.env.SMTP_SECURE!=='false',
   connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,
   auth:{user,pass}
  });
  const ahora=new Date().toISOString();
  const correo={
   from:from||user,to:DESTINATARIOS,
   subject:'[PRUEBA] SMTP Cámara de Docencia · '+ahora.slice(0,16).replace('T',' '),
   text:'Prueba técnica autorizada del correo institucional de cmaestros.ofl.cl. Destinatarios exclusivos: las dos cuentas Dummy. No corresponde a ninguna asignación, recordatorio ni actividad docente.\nFecha UTC: '+ahora+'\n',
   headers:{'X-Docencia-Test':'smtp-dummy-superadmin'}
  };
  const result=await enviarConAuditoria({admin,transport,correo,tipo:TIPO});
  return res.status(200).json({
   ok:true,aceptados_smtp:result.accepted||[],rechazados_smtp:result.rejected||[],
   message_id:result.messageId||null,nota:'Aceptación SMTP; la entrega a bandeja se verifica en los destinatarios.'
  });
 }catch(e){
  console.error('PRUEBA_SMTP_DUMMY',e?.code||'error');
  return res.status(e?.code==='AUDITORIA_NO_DISPONIBLE'?503:502).json({error:'No fue posible completar el envío SMTP auditado'});
 }
}
