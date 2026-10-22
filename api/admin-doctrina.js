import { createClient } from '@supabase/supabase-js';
import { randomUUID, createHash } from 'node:crypto';
const BUCKET='doctrina-originales-privados';
const MAX=50*1024*1024;
const clases=['normativa','doctrina','ritual','tradicion','bibliografia','docencia'];
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const reply=(res,status,data)=>{res.setHeader('Cache-Control','no-store');return res.status(status).json(data);};
export default async function handler(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return reply(res,405,{error:'Método no permitido'});}
 const {SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:key,SUPABASE_SERVICE_ROLE_KEY:secret}=process.env;
 if(!url||!key||!secret)return reply(res,503,{error:'Biblioteca no configurada'});
 const token=/^Bearer (.+)$/i.exec(req.headers?.authorization||'')?.[1];
 if(!token)return reply(res,401,{error:'Sesión requerida'});
 try{
  const options={auth:{persistSession:false,autoRefreshToken:false}};
  const client=createClient(url,key,options);
  const {data:identity,error:authError}=await client.auth.getUser(token);
  const user=identity?.user;
  if(authError||!user?.id)return reply(res,401,{error:'Sesión no válida'});
  const admin=createClient(url,secret,options);
  const {data:perfil,error:profileError}=await admin.from('usuarios').select('id,email,es_admin').eq('auth_user_id',user.id).maybeSingle();
  if(profileError||!perfil?.es_admin||(String(user.email||'').toLowerCase()!=='jpintov@gmail.com'&&user.app_metadata?.superadmin_principal!==true)||String(perfil.email||'').toLowerCase()!==String(user.email||'').toLowerCase())return reply(res,403,{error:'Acceso exclusivo de Superadmin'});
  const {action,...datos}=req.body||{};
  if(!['listar','preparar','registrar','descargar','visualizar','revisar','retirar','restaurar','clasificar','texto_extraer','texto_pagina','texto_revisar_pagina','texto_aprobar','texto_buscar','agente_consultar','llm_listar','llm_autorizar','llm_revocar','llm_autorizar_biblioteca'].includes(action))return reply(res,422,{error:'Acción inválida'});
  const rpc=async(accion,payload={})=>{
   const {data,error}=await admin.rpc(accion.startsWith('texto_')?'doctrina_texto_superadmin':'doctrina_gestion_superadmin',{p_actor:user.id,p_accion:accion,p_datos:payload});
   if(error){
    // Nunca descartar el código de Supabase: diferencia conflicto, permisos
    // y conectividad, sin enviar detalles internos al navegador.
    const fallo=new Error('Operación documental no completada');
    fallo.codigoDb=String(error.code||'DESCONOCIDO').slice(0,24);
    fallo.operacion=accion;
    throw fallo;
   }
   return data;
  };
  if(['llm_listar','llm_autorizar','llm_revocar','llm_autorizar_biblioteca'].includes(action)){
   if(action==='llm_autorizar_biblioteca'){
    if(datos.confirmacion!==true)return reply(res,422,{error:'Se requiere autorización expresa de la biblioteca para Groq'});
    return reply(res,200,{ok:true,...await rpc('texto_llm_autorizar_biblioteca',{confirmacion:true})});
   }
   if(action!=='llm_listar'&&!uuid(datos.id))return reply(res,422,{error:'Versión no válida'});
   if(action==='llm_autorizar'&&datos.confirmacion!==true)return reply(res,422,{error:'Confirme la autorización de envío a Groq'});
   return reply(res,200,{ok:true,...await rpc('texto_'+action,{id:datos.id})});
  }
  if(action==='clasificar'){
   if(!uuid(datos.id)||!clases.includes(datos.clase)||!clases.includes(datos.clase_actual))return reply(res,422,{error:'Clasificación no válida'});
   return reply(res,200,{ok:true,...await rpc('clasificar',{id:datos.id,clase:datos.clase,clase_actual:datos.clase_actual})});
  }
  if(action==='agente_consultar'){
   const {prepararConsultaAgente}=await import('../lib/agente-doctrina.js');
   let entrada;try{entrada=prepararConsultaAgente(datos);}catch(e){return reply(res,422,{error:e.message});}
   const {consultarGroqDoctrina}=await import('../lib/groq-doctrina.js');
   return reply(res,200,{ok:true,informe:await consultarGroqDoctrina(entrada,{rpc})});
  }
  if(action==='texto_buscar'){if(typeof datos.consulta!=='string'||datos.consulta.trim().length<3||datos.consulta.length>250)return reply(res,422,{error:'Escriba una consulta de 3 a 250 caracteres'});return reply(res,200,{ok:true,...await rpc(action,{consulta:datos.consulta})});}
  if(['texto_pagina','texto_revisar_pagina','texto_aprobar'].includes(action)){
   if(!uuid(datos.id)||!Number.isInteger(datos.pagina)||datos.pagina<1||datos.pagina>600)return reply(res,422,{error:'Página no válida'});
   if(action==='texto_revisar_pagina'&&(typeof datos.texto!=='string'||(!datos.texto.trim()&&datos.pagina_sin_texto!==true)||datos.texto.length>40000||(datos.pagina_sin_texto===true&&datos.texto.trim().length>0)))return reply(res,422,{error:'Texto de página no válido'});
   return reply(res,200,{ok:true,...await rpc(action,{id:datos.id,pagina:datos.pagina,texto:datos.texto,pagina_sin_texto:datos.pagina_sin_texto===true})});
  }
  if(action==='listar')return reply(res,200,{ok:true,...await rpc('listar')});
  const {data:bucket,error:bucketError}=await admin.storage.getBucket(BUCKET);
  if(bucketError||!bucket||bucket.public!==false)return reply(res,503,{error:'El almacenamiento privado no está disponible'});
  const storage=admin.storage.from(BUCKET);
  if(action==='preparar'||action==='registrar'){
   if(typeof datos.titulo!=='string'||datos.titulo.trim().length<3||datos.titulo.length>250||!clases.includes(datos.clase)||!Number.isSafeInteger(datos.bytes)||datos.bytes<1||datos.bytes>MAX)return reply(res,422,{error:'Revise título, categoría y tamaño (máximo 50 MB)'});
  }
  if(action==='preparar'){
   const path=`superadmin/${user.id}/${randomUUID()}.pdf`;
   const {data,error}=await storage.createSignedUploadUrl(path,{upsert:false});
   if(error||!data?.token)return reply(res,503,{error:'No se pudo preparar la carga'});
   return reply(res,200,{ok:true,path,token:data.token});
  }
  if(action==='registrar'){
   if(typeof datos.path!=='string'||!new RegExp(`^superadmin/${user.id}/[0-9a-f-]{36}\\.pdf$`).test(datos.path)||typeof datos.sha256!=='string'||!/^[0-9a-f]{64}$/.test(datos.sha256))return reply(res,422,{error:'Referencia de archivo inválida'});
   const {data:blob,error}=await storage.download(datos.path);
   if(error||!blob)return reply(res,409,{error:'El original no está disponible. Reintente la carga.'});
   if(blob.size!==datos.bytes||blob.size>MAX)return reply(res,422,{error:'El tamaño del original no coincide'});
   const bytes=Buffer.from(await blob.arrayBuffer());
   if(bytes.subarray(0,5).toString()!=='%PDF-'||createHash('sha256').update(bytes).digest('hex')!==datos.sha256)return reply(res,422,{error:'El original no es PDF o su integridad no coincide'});
   const result=await rpc('registrar',datos);
   return reply(res,200,{ok:true,...result});
  }
  if(!uuid(datos.id))return reply(res,422,{error:'Documento inválido'});
  if(action==='retirar'||action==='restaurar')return reply(res,200,{ok:true,...await rpc(action,{id:datos.id})});
  if(action==='revisar'&&(!['aprobar','devolver'].includes(datos.decision)||typeof datos.nota!=='string'||datos.nota.length>2000))return reply(res,422,{error:'Revisión inválida'});
  const version=await rpc('obtener',{id:datos.id});
  if(!version)return reply(res,404,{error:'Documento no encontrado'});
  const {data:blob,error:downloadError}=await storage.download(version.path);
  if(downloadError||!blob)return reply(res,409,{error:'No se encontró el original'});
  if(blob.size!==Number(version.bytes)||blob.size>MAX)return reply(res,409,{error:'Integridad del original pendiente de revisión'});
  if(createHash('sha256').update(Buffer.from(await blob.arrayBuffer())).digest('hex')!==version.sha256)return reply(res,409,{error:'La integridad del original no coincide'});
  if(action==='texto_extraer'){const {extraerDoctrina}=await import('../lib/extraer-doctrina.js');const extraido=await extraerDoctrina(Buffer.from(await blob.arrayBuffer()));return reply(res,200,{ok:true,...await rpc('texto_guardar',{id:datos.id,sha256:version.sha256,motor:extraido.motor,paginas:extraido.paginas})});}
  if(action==='revisar')return reply(res,200,{ok:true,...await rpc('revisar',{id:datos.id,decision:datos.decision,nota:datos.nota})});
  const {data,error}=await storage.createSignedUrl(version.path,60,{download:action==='descargar'});
  if(error||!data?.signedUrl)return reply(res,503,{error:'No se pudo habilitar la descarga'});
  return reply(res,200,{ok:true,url:data.signedUrl,expira_segundos:60});
 }catch(fallo){
  const codigo=String(fallo?.codigoDb||'INDETERMINADO').slice(0,24);
  const accion=String(req.body?.action||'').replace(/[^a-z_]/gi,'').slice(0,36);
  const referencia=randomUUID().slice(0,8);
  // Solo metadatos técnicos, sin nombres de documentos, fragmentos, correo ni tokens.
  console.error('[admin-doctrina] fallo de operación',{referencia,accion,codigo});
  if(accion==='clasificar'){
   if(codigo==='40001')return reply(res,409,{error:'La categoría cambió desde la última actualización. Actualice la biblioteca antes de guardar.',referencia});
   if(['22023','22P02','23514'].includes(codigo))return reply(res,422,{error:'La categoría o la versión del documento no es válida. Actualice la biblioteca y vuelva a intentarlo.',referencia});
   if(codigo==='42501')return reply(res,403,{error:'No se autorizó modificar la categoría con la sesión actual.',referencia});
   if(codigo==='57014')return reply(res,503,{error:'La base documental no respondió a tiempo. Verifique si la categoría cambió antes de reintentar.',referencia});
   return reply(res,503,{error:'No se pudo guardar la categoría. Código de diagnóstico '+codigo+'. Referencia '+referencia+'. La clasificación original se conserva.',referencia});
  }
  return reply(res,503,{error:'No fue posible completar la operación documental. Referencia '+referencia+'.',referencia});
 }
}

