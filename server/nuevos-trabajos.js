import {createHash,randomUUID} from 'node:crypto';
import {extraerOriginalNuevo,validarCuestionarioNuevo,generarCuestionarioNuevo,hashTexto} from '../lib/nuevos-trabajos.js';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const fallo=mensaje=>Object.assign(new Error(mensaje),{status:422});
export async function gestionarNuevoTrabajo(b,{admin,actor,extraer=extraerOriginalNuevo,generar=generarCuestionarioNuevo}){
 const rpc=async(accion,datos={})=>{const r=await admin.rpc('admin_borradores_docentes',{p_actor:actor.id,p_accion:accion,p_datos:datos});if(r.error)throw Object.assign(new Error(r.error.message),{code:r.error.code});return r.data;};
 try{
  if(!['nuevo_listar','nuevo_preparar','nuevo_obtener','nuevo_guardar','nuevo_generar','nuevo_publicar'].includes(b.action))throw fallo('Acción no admitida');
  if(b.action==='nuevo_listar')return {status:200,body:{ok:true,...await rpc('listar')}};
  if(!uuid(b.id))throw fallo('Identificador de borrador inválido');
  if(b.action==='nuevo_preparar'){
   if(typeof b.nombre!=='string'||b.nombre.length>250||!/^.+\.(pdf|docx)$/i.test(b.nombre)||typeof b.base64!=='string'||b.base64.length>2796204||(b.base64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(b.base64)))throw fallo('Adjunte un PDF o DOCX de hasta 2 MB');
   const bytes=Buffer.from(b.base64,'base64');if(bytes.length<20||bytes.length>2097152||bytes.toString('base64')!==b.base64)throw fallo('Archivo inválido o demasiado grande');
   const extension=b.nombre.split('.').at(-1).toLowerCase();let extraccion;
   try{extraccion=await extraer(bytes,extension);}catch(e){throw fallo(e.message||'No fue posible extraer el original');}
   if(typeof extraccion.texto!=='string'||extraccion.texto.length<200||extraccion.texto.length>60000||Buffer.byteLength(JSON.stringify(extraccion),'utf8')>1000000)throw fallo('Revise la extracción: el texto limpio debe tener de 200 a 60.000 caracteres y los anexos no superar 1 MB.');
   const original={nombre:b.nombre,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,data_url:'data:'+(extension==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document')+';base64,'+b.base64};
   await rpc('crear',{id:b.id,original,extraccion,texto:extraccion.texto,ficha:{titulo:b.nombre.replace(/\.(pdf|docx)$/i,''),autor:'',codigo:'',numero_orden:1}});
   return {status:200,body:{ok:true,borrador:await rpc('obtener',{id:b.id})}};
  }
  let guardado=await rpc('obtener',{id:b.id});
  if(b.action==='nuevo_obtener')return {status:200,body:{ok:true,borrador:guardado}};
  if(!Number.isInteger(b.revision)||b.revision<1)throw fallo('Actualice el borrador antes de continuar');
  if(b.action==='nuevo_guardar'){
   const f=b.ficha;
   if(!f||!Number.isInteger(f.numero_orden)||f.numero_orden<1||f.numero_orden>999||typeof f.titulo!=='string'||f.titulo.trim().length<2||f.titulo.length>250||typeof f.autor!=='string'||f.autor.trim().length<2||f.autor.length>250||typeof f.codigo!=='string'||!/^(INCI|INST|FILO|ETIC)[0-9]{2}[0-9A-Z][A-Z1-9]$/.test(f.codigo)||typeof b.texto!=='string'||b.texto.trim().length<200||b.texto.length>60000)throw fallo('Revise título, autor, número, código y texto (200 a 60.000 caracteres)');
   if(/[<>]/.test(f.titulo+f.autor))throw fallo('Título y autor deben ser texto sin etiquetas HTML');
   const texto=b.texto.trim();let preguntas=null;if(texto===guardado.texto&&b.preguntas){try{preguntas=validarCuestionarioNuevo(b.preguntas,texto);}catch(e){throw fallo(e.message);}}
   await rpc('guardar',{id:b.id,revision:b.revision,ficha:{titulo:f.titulo.trim(),autor:f.autor.trim(),codigo:f.codigo,numero_orden:f.numero_orden},texto,preguntas,preguntas_hash:preguntas?hashTexto(texto):null});
  }else if(b.action==='nuevo_generar'){
   if(b.confirmado!==true)throw fallo('Autorice el envío de este texto a Groq');
   if(guardado.estado!=='borrador'||guardado.revision!==b.revision)throw Object.assign(Error('El borrador cambió. Actualícelo.'),{status:409});
   const intento=randomUUID();await rpc('reservar_ia',{id:b.id,revision:b.revision,intento,confirmado:true});let preguntas;
   const validar=async()=>{const d=await rpc('obtener',{id:b.id});return d.estado==='borrador'&&d.revision===b.revision;};
   try{preguntas=await generar(guardado.texto,guardado.ficha,{validar});preguntas=validarCuestionarioNuevo(preguntas,guardado.texto);}
   catch(e){try{await rpc('finalizar_ia',{id:b.id,revision:b.revision,intento,preguntas:null});}catch{}throw e;}
   await rpc('finalizar_ia',{id:b.id,revision:b.revision,intento,preguntas,preguntas_hash:hashTexto(guardado.texto)});
  }else if(b.action==='nuevo_publicar'){
   if(b.confirmado!==true)throw fallo('Confirme que revisó el texto y las ocho preguntas');
   if(guardado.estado!=='publicado'){
    if(guardado.preguntas_hash!==hashTexto(guardado.texto))throw fallo('El texto cambió. Genere o revise nuevamente las preguntas');
    validarCuestionarioNuevo(guardado.preguntas,guardado.texto);
   }
   const data=await rpc('publicar',{id:b.id,revision:b.revision,confirmado:true});return {status:200,body:{ok:true,...data}};
  }
  guardado=await rpc('obtener',{id:b.id});return {status:200,body:{ok:true,borrador:guardado}};
 }catch(e){
  const status=e.status||(['40001','55000','23505'].includes(e.code)?409:e.code==='42501'?403:e.code==='P0002'?404:['22023','23514','22P02'].includes(e.code)?422:503);
  return {status,body:{error:status===503?'No se pudo completar el paso. El borrador se conserva; actualice antes de reintentar.':e.message,reintentar_en:e.reintentar_en}};
 }
}
