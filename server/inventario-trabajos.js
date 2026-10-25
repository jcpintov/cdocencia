import nodemailer from 'nodemailer';
import {generarCorreoInventario} from '../lib/correo-inventario.js';
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v||'');
export async function gestionarInventario(body,{admin,actor,env=process.env,transport}){
 const responder=(status,data)=>({status,body:data});
 const id=body.id;if(!uuid(id))return responder(422,{error:'Identificador inválido'});
 if(body.action==='inventario_preparar'){
  const excluir=body.excluir_ids||[];
  if(!Array.isArray(excluir)||excluir.length>100||excluir.some(x=>!uuid(x)))return responder(422,{error:'Exclusiones inválidas'});
  const [u,m,a]=await Promise.all([
   admin.from('usuarios').select('id,nombre,email,es_admin,cuenta_eliminada').eq('es_admin',false),
   admin.from('modulos').select('id,titulo,autor,creado_en,unidad_codigo,contenido_trazado,preguntas_json').eq('activo',true),
   admin.from('docencia_asignaciones').select('codigo,entregado_el').eq('vigente',true)
  ]);
  if(u.error||m.error||a.error)return responder(503,{error:'No fue posible consultar el inventario y padrón'});
  const elegibles=u.data.filter(x=>!x.cuenta_eliminada&&x.email?.toLowerCase()!=='dummy@ofl.cl');
  if(excluir.some(id=>!elegibles.some(x=>x.id===id)))return responder(422,{error:'La exclusión no pertenece al padrón'});
  const destinatarios=elegibles.filter(x=>!excluir.includes(x.id));
  if(destinatarios.some(x=>!/^\S+@\S+\.\S+$/.test(x.email||'')))return responder(422,{error:'Hay casillas inválidas en el padrón'});
  const trabajos=m.data.filter(x=>x.contenido_trazado?.trim()&&x.preguntas_json?.preguntas?.length===8).map(x=>{
   const entrega=a.data.find(a=>a.codigo===x.unidad_codigo)?.entregado_el;
   return {id:x.id,titulo:x.titulo,autor:x.autor,fecha:entrega||x.creado_en,fecha_entregada:!!entrega};
  }).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  if(!destinatarios.length||!trabajos.length)return responder(422,{error:'No hay destinatarios o trabajos disponibles'});
  const correo=generarCorreoInventario(trabajos,destinatarios),contenido={correo,trabajos,destinatarios,excluidos:elegibles.filter(x=>excluir.includes(x.id)).map(({id,nombre})=>({id,nombre}))};
  const r=await admin.from('docencia_inventarios_correo').insert({id,actor:actor.id,contenido});
  if(r.error)return responder(409,{error:'No se pudo preparar este envío. Use una vista previa nueva.'});
  return responder(200,{ok:true,id,...contenido});
 }
 if(body.action!=='inventario_enviar'||body.confirmado!==true)return responder(422,{error:'Se requiere confirmar la vista previa'});
 if(!env.SMTP_HOST||!env.SMTP_USER||!env.SMTP_PASSWORD)return responder(503,{error:'Correo no configurado; no se intentó enviar'});
 const r=await admin.from('docencia_inventarios_correo').update({estado:'enviando'}).eq('id',id).eq('actor',actor.id).eq('estado','preparado').select('contenido').maybeSingle();
 if(r.error||!r.data)return responder(409,{error:'Este envío ya fue iniciado o no está disponible. No se repetirá.'});
 const correo=r.data.contenido.correo;
 try{
  transport??=nodemailer.createTransport({host:env.SMTP_HOST,port:Number(env.SMTP_PORT||465),secure:env.SMTP_SECURE!=='false',connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,auth:{user:env.SMTP_USER,pass:env.SMTP_PASSWORD}});
  const enviado=await transport.sendMail(correo),aceptados=new Set((enviado.accepted||[]).map(x=>String(x).toLowerCase())),rechazados=(enviado.rejected||[]).length;
  const completo=correo.bcc.every(x=>aceptados.has(x));
  const guardado=await admin.from('docencia_inventarios_correo').update({estado:completo?'enviado':'incierto',aceptados:aceptados.size,rechazados,message_id:enviado.messageId,finalizado_en:new Date().toISOString()}).eq('id',id).eq('estado','enviando');
  return responder(completo&&!guardado.error?200:503,{ok:completo&&!guardado.error,id,aceptados:aceptados.size,rechazados,mensaje:completo?'Correo aceptado por el servidor SMTP para todas las casillas.':'Envío sin confirmación completa. Revise antes de repetir.'});
 }catch{
  await admin.from('docencia_inventarios_correo').update({estado:'incierto',finalizado_en:new Date().toISOString()}).eq('id',id).eq('estado','enviando');
  return responder(503,{error:'Envío sin confirmación. No se repetirá automáticamente; revise el correo y el registro.'});
 }
}
