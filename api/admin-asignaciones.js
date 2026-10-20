import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { generarCorreoAsignacion } from '../lib/correo-asignacion.js';
import { generarCorreoRecordatorio } from '../lib/correo-recordatorio.js';

const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const fecha=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
function reply(res,status,data){res.setHeader('Cache-Control','no-store');return res.status(status).json(data);}
function fallo(e){const x=new Error(e?.message||'No fue posible completar la operación');x.code=e?.code;return x;}
export default async function handler(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return reply(res,405,{error:'Método no permitido'});}
 try{
  const {SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:key,SUPABASE_SERVICE_ROLE_KEY:secret}=process.env;
  if(!url||!key||!secret)return reply(res,503,{error:'Asignaciones no disponibles'});
  const token=/^Bearer (.+)$/i.exec(req.headers.authorization||'')?.[1];
  if(!token)return reply(res,401,{error:'Sesión requerida'});
  const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:identity,error:authError}=await auth.auth.getUser(token);
  if(authError||!identity?.user)return reply(res,401,{error:'Sesión no válida'});
  if(String(identity.user.email||'').toLowerCase()!=='jpintov@gmail.com')return reply(res,403,{error:'Operación exclusiva de Superadmin'});
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:perfil,error:perfilError}=await admin.from('usuarios').select('id,email,es_admin').eq('auth_user_id',identity.user.id).maybeSingle();
  if(perfilError||!perfil?.es_admin||String(perfil.email||'').toLowerCase()!=='jpintov@gmail.com')return reply(res,403,{error:'Operación exclusiva de Superadmin'});
  let b=req.body;
  if(typeof b==='string'){try{b=JSON.parse(b);}catch{return reply(res,400,{error:'Solicitud inválida'});}}
  b=b||{};
  if(!['listar','crear','modificar','eliminar','vista_correo','vista_recordatorio','enviar','cerrar_intento'].includes(b.action))return reply(res,422,{error:'Acción no admitida'});
  const action=b.action;
  if(action!=='listar'&&action!=='crear'&&(!uuid(b.id)||!Number.isInteger(b.version)||b.version<1))return reply(res,422,{error:'Seleccione una asignación actualizada'});
  if(['crear','modificar'].includes(action)&&(!uuid(b.usuario_id)||!fecha(b.fecha_asignacion)||!fecha(b.fecha_entrega)||b.fecha_entrega<b.fecha_asignacion||typeof b.codigo!=='string'))return reply(res,422,{error:'Revise integrante, tema y fechas'});
  if(action==='enviar'&&(b.confirmado!==true||!uuid(b.intento)||typeof b.reenviar!=='boolean'))return reply(res,422,{error:'Confirme expresamente el envío desde Correo'});
  if(action==='cerrar_intento'&&(!uuid(b.intento)||b.confirmado!==true))return reply(res,422,{error:'Confirme la revisión del intento de correo'});
  const rpc=async(accion,datos={})=>{
   const r=await admin.rpc('admin_asignaciones_docentes',{p_actor:identity.user.id,p_accion:accion,p_datos:datos});
   if(r.error)throw fallo(r.error);return r.data;
  };
  const datos={id:b.id,version:b.version,usuario_id:b.usuario_id,codigo:b.codigo,fecha_asignacion:b.fecha_asignacion,fecha_entrega:b.fecha_entrega};
  if(action==='vista_correo'||action==='vista_recordatorio'||action==='enviar'){
   const asignacion=await rpc('vista_correo',{id:b.id,version:b.version});
   if(action==='vista_recordatorio')return reply(res,200,{ok:true,asignacion,correo:asignacion.recordatorio?.solicitud_enviada_en?generarCorreoRecordatorio(asignacion):null});
   const correo=generarCorreoAsignacion(asignacion);
   if(action==='vista_correo')return reply(res,200,{ok:true,correo,asignacion});
   const {SMTP_HOST:host,SMTP_USER:user,SMTP_PASSWORD:pass}=process.env;
   if(!host||!user||!pass)return reply(res,503,{error:'Correo institucional no configurado. No se intentó el envío.'});
   const reserva=await rpc('reservar_correo',{id:b.id,version:b.version,intento:b.intento,reenviar:b.reenviar,correo});
   if(!reserva?.enviar)return reply(res,200,{ok:true,repetido:true,mensaje:'Este intento ya fue registrado. Actualice para consultar su estado; no se repitió el envío.'});
   let enviado=false;
   try{
    const transport=nodemailer.createTransport({host,port:Number(process.env.SMTP_PORT||465),secure:process.env.SMTP_SECURE!=='false',connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,auth:{user,pass}});
    const resultado=await transport.sendMail({...correo,from:process.env.SMTP_FROM||user});
    if(!Array.isArray(resultado.accepted)||!resultado.accepted.some(x=>String(x).toLowerCase()===String(correo.to).toLowerCase()))throw new Error('destinatario_no_aceptado');
    enviado=true;
    const copiaAceptada=resultado.accepted.some(x=>String(x).toLowerCase()===correo.bcc);
    const cierre=await rpc('finalizar_correo',{id:b.id,version:b.version,intento:b.intento,estado:'enviado',copia_estado:copiaAceptada?'aceptada':'sin_confirmar',message_id:resultado.messageId||null});
    if(!cierre?.ok)throw new Error('estado_no_confirmado');
    return reply(res,200,{ok:true,mensaje:copiaAceptada?'Correo y copia oculta aceptados por el servidor de envío. Estado registrado.':'Correo aceptado por el servidor de envío. La copia oculta no fue confirmada; revise su buzón antes de reenviar.'});
   }catch{
    try{await rpc('finalizar_correo',{id:b.id,version:b.version,intento:b.intento,estado:'incierto'});}catch{}
    return reply(res,503,{error:enviado?'El servidor aceptó el correo, pero no se pudo confirmar su registro. Revise antes de reenviar.':'No se pudo confirmar el envío. No se reintentará automáticamente; revise antes de reenviar.'});
   }
  }
  const resultado=await rpc(action,action==='listar'?{}:action==='cerrar_intento'?{id:b.id,version:b.version,intento:b.intento}:datos);
  return reply(res,200,{ok:true,data:resultado});
 }catch(e){
  if(e.code==='23505')return reply(res,409,{error:'El tema ya está asignado o tiene un envío en curso. Actualice para consultar a quién corresponde.'});
  const status=e.code==='42501'?403:e.code==='40001'||e.code==='55000'?409:e.code==='P0002'?404:['22023','22007','22P02','22008','23503'].includes(e.code)?422:503;
  return reply(res,status,{error:status===503?'Servicio temporalmente no disponible. Los datos anteriores se conservan.':e.message});
 }
}
