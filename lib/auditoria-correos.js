// Registro server-side. La respuesta SMTP confirma aceptación, no entrega final.
import {randomUUID} from 'node:crypto';
const correos=v=>v==null?[]:(Array.isArray(v)?v:[v]).flatMap(x=>String(x).split(',')).map(s=>s.trim()).filter(Boolean);
const detalleError=e=>String(e?.message||'Error de envío').replace(/[\r\n]/g,' ').slice(0,400);
export async function enviarConAuditoria({admin,transport,correo,tipo,origenId=null,intentoId=null}){
 const id=randomUUID(),datos={
  id,remitente:String(correo.from||process.env.SMTP_FROM||process.env.SMTP_USER||''),
  destinatarios:correos(correo.to),cc:correos(correo.cc),cco:correos(correo.bcc),
  asunto:String(correo.subject||'').slice(0,700),tipo:String(tipo),
  origen_id:origenId==null?null:String(origenId),
  intento_id:intentoId==null?null:String(intentoId),estado:'pendiente'
 };
 // Ante errores de registro no bloquear la entrega ni reintentar un mensaje.
 let registrado=false;
 try{const {error}=await admin.from('auditoria_correos').insert(datos);if(error)throw error;registrado=true;}
 catch(e){console.error('AUDITORIA_CORREO_INSERT',e?.code||'error');}
 try{
  const r=await transport.sendMail(correo);
  if(registrado){
   const {error}=await admin.from('auditoria_correos').update({
    estado:'aceptado_smtp',actualizado_en:new Date().toISOString(),
    aceptados_smtp:correos(r.accepted),rechazados_smtp:correos(r.rejected),
    message_id:r.messageId||null
   }).eq('id',id);
   if(error)console.error('AUDITORIA_CORREO_UPDATE',error.code||'error');
  }
  return r;
 }catch(e){
  if(registrado){
   try{const {error}=await admin.from('auditoria_correos').update({
    estado:'error',actualizado_en:new Date().toISOString(),
    error_codigo:String(e?.code||'SMTP_ERROR').slice(0,80),error_detalle:detalleError(e)
   }).eq('id',id);if(error)console.error('AUDITORIA_CORREO_ERROR_UPDATE',error.code||'error');}
   catch{console.error('AUDITORIA_CORREO_ERROR_UPDATE_FAILED');}
  }
  throw e;
 }
}
