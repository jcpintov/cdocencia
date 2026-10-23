import {createClient} from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import {randomInt,randomUUID,createHmac} from 'node:crypto';
export default async function handler(req,res){
 const reply=(s,b)=>{res.setHeader('Cache-Control','no-store');return res.status(s).json(b);};
 if(req.method!=='POST')return reply(405,{error:'Método no permitido'});
 const token=/^Bearer (.+)$/i.exec(req.headers.authorization||'')?.[1];if(!token)return reply(401,{error:'Sesión requerida'});
 const env=process.env;
 if(!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY||!env.SUPABASE_SERVICE_ROLE_KEY||!env.SMTP_PASSWORD)return reply(503,{error:'Perfil no configurado'});
 const options={auth:{persistSession:false,autoRefreshToken:false}};
 try{
  const client=createClient(env.SUPABASE_URL,env.SUPABASE_PUBLISHABLE_KEY,options);
  const {data,error}=await client.auth.getUser(token),user=data?.user;
  if(error||!user?.id)return reply(401,{error:'Sesión no válida'});
  const admin=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,options);
  const {data:perfil,error:pe}=await admin.from('usuarios').select('id,es_admin,email,rol,cuenta_eliminada').eq('auth_user_id',user.id).maybeSingle();
  if(pe||!perfil?.es_admin||perfil.cuenta_eliminada===true||(perfil.rol&&perfil.rol!=='SUPERADMIN')||(String(user.email).toLowerCase()!=='jpintov@gmail.com'&&user.app_metadata?.superadmin_principal!==true))return reply(403,{error:'Acceso exclusivo de Superadmin'});
  const b=req.body||{};
  const rpc=async(accion,datos)=>{const r=await admin.rpc('superadmin_perfil_codigo',{p_actor:user.id,p_accion:accion,p_datos:datos});if(r.error)throw Error('No se pudo registrar el cambio');if(r.data?.error)throw Error(r.data.error);return r.data;};
  const hash=(id,codigo)=>createHmac('sha256',env.SMTP_PASSWORD).update('superadmin-perfil:'+user.id+':'+id+':'+codigo).digest('hex');
  if(b.action==='pendiente')return reply(200,{ok:true,...await rpc('pendiente',{})});
  if(b.action==='solicitar'){
   const nombre=String(b.nombre||'').trim().replace(/\s+/g,' '),email=String(b.email||'').trim().toLowerCase();
   if(nombre.length<3||nombre.length>150||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply(422,{error:'Revise nombre y correo'});
   if(!env.SMTP_HOST||!env.SMTP_USER)return reply(503,{error:'Correo institucional no configurado'});
   const id=randomUUID(),codigo=String(randomInt(0,100000000)).padStart(8,'0');
   const cambio=await rpc('solicitar',{id,nombre,email,hash:hash(id,codigo)});
   try{
    const transport=nodemailer.createTransport({host:env.SMTP_HOST,port:Number(env.SMTP_PORT||465),secure:env.SMTP_SECURE!=='false',connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,auth:{user:env.SMTP_USER,pass:env.SMTP_PASSWORD}});
    const envio=await transport.sendMail({from:env.SMTP_FROM||env.SMTP_USER,to:cambio.email_anterior,subject:'OFL.CL · Autorización de cambio de perfil Superadmin',text:`Se solicitó cambiar su perfil de Superadmin.\n\nNombre: ${nombre}\nCorreo propuesto: ${email}\n\nCódigo de autorización: ${codigo}\n\nVálido por 10 minutos y hasta cinco intentos. Si no solicitó este cambio, no comparta el código.\n\nOFL.CL`});
    if(!envio.accepted?.some(x=>String(x).toLowerCase()===cambio.email_anterior.toLowerCase()))throw Error('SMTP no confirmó al destinatario');
    await rpc('habilitar',{id});
   }catch{await rpc('fallido',{id});return reply(503,{error:'No se confirmó el envío del código. El perfil no ha cambiado.'});}
   return reply(200,{ok:true,id,mensaje:'Código enviado al correo actual. El perfil aún no se modifica.'});
  }
  if(!['confirmar','recuperar'].includes(b.action)||typeof b.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.id))return reply(422,{error:'Solicitud no válida'});
  if(b.action==='confirmar'&&(typeof b.codigo!=='string'||!/^\d{8}$/.test(b.codigo)))return reply(422,{error:'Código no válido'});
  const cambio=await rpc(b.action==='confirmar'?'validar':'recuperar',{id:b.id,...(b.action==='confirmar'?{hash:hash(b.id,b.codigo)}:{})});
  if(b.action==='confirmar'||String(user.email).toLowerCase()!==cambio.email_nuevo.toLowerCase()){
   const r=await admin.auth.admin.updateUserById(user.id,{email:cambio.email_nuevo,email_confirm:true,app_metadata:{...user.app_metadata,superadmin_principal:true}});
   if(r.error){await rpc('fallido',{id:b.id});return reply(409,{error:'No se pudo actualizar el correo de acceso. Solicite un código nuevo.'});}
  }
  try{await rpc('finalizar',{id:b.id});}
  catch{
   // Un fallo de transporte no prueba que la transacción no se haya confirmado.
   // Conservar la autorización permite recuperar idempotentemente; no se revierte Auth a ciegas.
   try{await rpc('recuperacion',{id:b.id});}catch{}
   return reply(503,{error:'Cambio ya autorizado pendiente de sincronización. Use Recuperar cambio pendiente.',recuperable:true});
  }
  return reply(200,{ok:true,nombre:cambio.nombre,email:cambio.email_nuevo});
 }catch(e){return reply(503,{error:e.message||'No se pudo completar el cambio'});}
}
