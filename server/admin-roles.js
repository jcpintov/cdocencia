import {createClient} from '@supabase/supabase-js';
import {esSuperadmin} from '../lib/roles-admin.js';

export default async function handler(req,res){
 const inicio=Date.now();
 const reply=(s,d)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Server-Timing','roles;dur='+(Date.now()-inicio));return res.status(s).json(d);};
 if(req.method!=='POST'){res.setHeader('Allow','POST');return reply(405,{error:'Método no permitido'});}
 const token=/^Bearer (.+)$/i.exec(req.headers.authorization||'')?.[1];
 if(!token)return reply(401,{error:'Sesión requerida'});
 let b=req.body;if(typeof b==='string'){try{b=JSON.parse(b);}catch{return reply(400,{error:'Solicitud inválida'});}}
 if(!b||typeof b!=='object'||Array.isArray(b))return reply(400,{error:'Solicitud inválida'});
 if(!['ADMIN','USER'].includes(b.rol)||!['ADMIN','USER'].includes(b.rol_actual)||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.id||'')||
  typeof b.motivo!=='string'||b.motivo.trim().length<5||b.motivo.length>500)
  return reply(422,{error:'Revise el usuario, el rol y el motivo del cambio'});
 const {SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:key,SUPABASE_SERVICE_ROLE_KEY:secret}=process.env;
 if(!url||!key||!secret)return reply(503,{error:'Administración de roles no disponible'});
 const controller=new AbortController();let timer;
 const limite=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Plazo agotado'));},15000);});
 try{
  const tarea=(async()=>{
  const reply=(status,data)=>({status,data});
  const opts={auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:controller.signal})}};
  const {data:identity,error}=await createClient(url,key,opts).auth.getUser(token);
  if(error?.status>=500||error?.name==='AuthRetryableFetchError')throw new Error('Identidad no disponible');
  controller.signal.throwIfAborted();
  if(error||!identity?.user?.id)return reply(401,{error:'Sesión no válida'});
  const admin=createClient(url,secret,opts);
  const {data:perfil,error:pe}=await admin.from('usuarios').select('id,email,es_admin,rol,cuenta_eliminada').eq('auth_user_id',identity.user.id).maybeSingle();
  controller.signal.throwIfAborted();if(pe)throw pe;
  if(!esSuperadmin(perfil,identity.user))return reply(403,{error:'Solo Superadmin puede cambiar roles'});
  const {data,error:re}=await admin.rpc('admin_gestionar_rol',{p_actor:identity.user.id,p_usuario:b.id,p_rol:b.rol,p_rol_actual:b.rol_actual,p_motivo:b.motivo.trim()});
  if(re){const status={'42501':403,'22023':422,'P0002':404,'40001':409}[re.code];if(status)return reply(status,{error:status===409?'El rol cambió. Actualice el padrón.':status===403?'Cuenta protegida o permiso insuficiente':status===404?'Usuario no disponible':'Se requiere una cuenta activa y vinculada a Auth'});throw re;}
  return reply(200,{ok:true,usuario:data});
  })();
  const resultado=await Promise.race([tarea,limite]);return reply(resultado.status,resultado.data);
 }catch{return reply(controller.signal.aborted?504:503,{error:controller.signal.aborted?'El servidor superó el tiempo de espera':'No se pudo cambiar el rol'});}
 finally{clearTimeout(timer);controller.abort();}
}
