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
 // Sin reserva auditable no enviar: evita mensajes imposibles de rastrear.
 const {error:reservaError}=await admin.from('auditoria_correos').insert(datos);
 if(reservaError){
  console.error('AUDITORIA_CORREO_INSERT',reservaError.code||'error');
  throw Object.assign(new Error('No se pudo reservar la auditoría del correo; envío no ejecutado'),{code:'AUDITORIA_NO_DISPONIBLE'});
 }
 try{
  const r=await transport.sendMail(correo);
  const {error:actualizaError}=await admin.from('auditoria_correos').update({
   estado:correos(r.accepted).length?'aceptado_smtp':'incierto',actualizado_en:new Date().toISOString(),
   aceptados_smtp:correos(r.accepted),rechazados_smtp:correos(r.rejected),
   message_id:r.messageId||null
  }).eq('id',id);
  if(actualizaError)console.error('AUDITORIA_CORREO_UPDATE',actualizaError.code||'error');
  return r;
 }catch(e){
  try{const {error}=await admin.from('auditoria_correos').update({
   estado:'error',actualizado_en:new Date().toISOString(),
   error_codigo:String(e?.code||'SMTP_ERROR').slice(0,80),error_detalle:detalleError(e)
  }).eq('id',id);if(error)console.error('AUDITORIA_CORREO_ERROR_UPDATE',error.code||'error');}
  catch{console.error('AUDITORIA_CORREO_ERROR_UPDATE_FAILED');}
  throw e;
 }
}
