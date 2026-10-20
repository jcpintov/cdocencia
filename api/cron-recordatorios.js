import {createClient} from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import {randomUUID,timingSafeEqual} from 'node:crypto';
import {procesarRecordatorios,procesarPublicaciones} from '../lib/procesar-recordatorios.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Método no permitido'});}
 const secreto=process.env.CRON_SECRET,recibido=req.headers.authorization||'';
 const esperado='Bearer '+(secreto||'');
 if(!secreto||Buffer.byteLength(recibido)!==Buffer.byteLength(esperado)||!timingSafeEqual(Buffer.from(recibido),Buffer.from(esperado)))return res.status(401).json({error:'No autorizado'});
 if(process.env.VERCEL_ENV!=='production')return res.status(403).json({error:'Disponible solo en producción'});
 const {SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:key,SMTP_HOST:host,SMTP_USER:user,SMTP_PASSWORD:pass}=process.env;
 if(!url||!key||!host||!user||!pass)return res.status(503).json({error:'Servicio no configurado. No se intentó enviar.'});
 try{
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const transport=nodemailer.createTransport({host,port:Number(process.env.SMTP_PORT||465),secure:process.env.SMTP_SECURE!=='false',connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,auth:{user,pass}});
  const opciones={admin,transport,from:process.env.SMTP_FROM||user,randomUUID};
  const [resultado,publicaciones]=await Promise.all([procesarRecordatorios(opciones),procesarPublicaciones(opciones)]);
  return res.status(resultado.errores||resultado.inciertos||publicaciones.errores||publicaciones.inciertos?503:200).json({ok:!resultado.errores&&!resultado.inciertos&&!publicaciones.errores&&!publicaciones.inciertos,...resultado,publicaciones});
 }catch{return res.status(503).json({error:'No se pudo completar la revisión. No se repetirá un envío registrado.'});}
}
