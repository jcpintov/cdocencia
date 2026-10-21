import { generarCorreoRecordatorio } from './correo-recordatorio.js';
import {generarCorreoCalendario} from './correo-calendario.js';
import { generarCorreoPublicacion } from './correo-publicacion.js';
// La reserva durable precede a SMTP. Un resultado incierto nunca se reintenta.
export const procesarRecordatorios=opciones=>procesar({...opciones,rpcNombre:'docencia_recordatorios_servicio',generarCorreo:generarCorreoRecordatorio});
export const procesarPublicaciones=opciones=>procesar({...opciones,rpcNombre:'docencia_publicaciones_servicio',generarCorreo:generarCorreoPublicacion});
export const procesarCalendario=opciones=>procesar({...opciones,rpcNombre:'calendario_recordatorios_servicio',generarCorreo:generarCorreoCalendario});
async function procesar({admin,transport,from,randomUUID,now=Date.now,rpcNombre,generarCorreo}) {
 const rpc=async(p_accion,p_datos={})=>{const r=await admin.rpc(rpcNombre,{p_accion,p_datos});if(r.error)throw new Error('No se pudo registrar el estado del recordatorio');return r.data;};
 const candidatos=await rpc('candidatos');
 const resumen={evaluados:0,enviados:0,omitidos:0,inciertos:0,errores:0};
 const inicio=now();let siguiente=0;
 async function worker(){
  while(siguiente<candidatos.length&&now()-inicio<230000){
   const a=candidatos[siguiente++];resumen.evaluados++;
   let id,reservado=false;
   try{
    const correo=generarCorreo(a);id=randomUUID();
    const reserva=await rpc('reservar',{id:a.id,version:a.version,intento:id,solicitud_id:a.recordatorio?.solicitud_id,correo});
    if(!reserva?.enviar){resumen.omitidos++;continue;}
    reservado=true;
    const permiso=await rpc('confirmar',{id:a.id,intento:id});
    if(!permiso?.enviar){resumen.omitidos++;continue;}
    const r=await transport.sendMail({...correo,from});
    if(!Array.isArray(r.accepted)||!r.accepted.some(v=>String(v).toLowerCase()===String(correo.to).toLowerCase()))throw new Error('SMTP no confirmó al destinatario');
    const fin=await rpc('finalizar',{id:a.id,intento:id,estado:'enviado',copia_estado:r.accepted.some(v=>String(v).toLowerCase()===correo.bcc)?'aceptada':'sin_confirmar',message_id:r.messageId||null});
    if(!fin?.ok)throw new Error('No se confirmó el registro del envío');
    resumen.enviados++;
   }catch{
    if(reservado){resumen.inciertos++;try{await rpc('finalizar',{id:a.id,intento:id,estado:'incierto'});}catch{}}
    else resumen.errores++;
   }
  }
 }
 await Promise.all(Array.from({length:Math.min(4,candidatos.length)},()=>worker()));
 return resumen;
}

