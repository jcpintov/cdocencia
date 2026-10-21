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
  if(profileError||!perfil?.es_admin||String(user.email||'').toLowerCase()!=='jpintov@gmail.com'||String(perfil.email||'').toLowerCase()!=='jpintov@gmail.com')return reply(res,403,{error:'Acceso exclusivo de Superadmin'});
  const {action,...datos}=req.body||{};
  if(!['listar','preparar','registrar','descargar','revisar','retirar','restaurar'].includes(action))return reply(res,422,{error:'Acción inválida'});
  const rpc=async(accion,payload={})=>{
   const {data,error}=await admin.rpc('doctrina_gestion_superadmin',{p_actor:user.id,p_accion:accion,p_datos:payload});
   if(error)throw new Error('database');return data;
  };
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
  if(action==='revisar')return reply(res,200,{ok:true,...await rpc('revisar',{id:datos.id,decision:datos.decision,nota:datos.nota})});
  const {data,error}=await storage.createSignedUrl(version.path,60,{download:true});
  if(error||!data?.signedUrl)return reply(res,503,{error:'No se pudo habilitar la descarga'});
  return reply(res,200,{ok:true,url:data.signedUrl,expira_segundos:60});
 }catch{return reply(res,503,{error:'No fue posible completar la operación documental. Reintente.'});}
}

