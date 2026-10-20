import { createClient } from '@supabase/supabase-js';
import { isIP } from 'node:net';
function reply(res,status,body){
 res.setHeader('Cache-Control','no-store');
 return res.status(status).json(body);
}
export function ipServidor(headers,vercel){
 if(!vercel)return null;
 const raw=headers['x-vercel-forwarded-for']||headers['x-forwarded-for'];
 const ip=typeof raw==='string'?raw.split(',')[0].trim():'';
 return isIP(ip)?ip:null;
}
export default async function handler(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return reply(res,405,{error:'Método no permitido'});}
 try{
  const {SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:key,SUPABASE_SERVICE_ROLE_KEY:secret}=process.env;
  if(!url||!key||!secret)return reply(res,503,{error:'Bitácora no disponible'});
  const token=/^Bearer (.+)$/i.exec(req.headers.authorization||'')?.[1];
  if(!token)return reply(res,401,{error:'Sesión requerida'});
  let body=req.body;
  if(typeof body==='string'){try{body=JSON.parse(body);}catch{return reply(res,400,{error:'Solicitud inválida'});}}
  const {accion,sesion,activo}=body||{};
  if(!['iniciar','latido','cerrar'].includes(accion)||typeof sesion!=='string'||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sesion)||
    typeof activo!=='boolean')return reply(res,422,{error:'Solicitud inválida'});
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await client.auth.getUser(token);
  if(error||!data?.user?.id)return reply(res,401,{error:'Sesión no válida'});
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:resultado,error:saveError}=await admin.rpc('bitacora_sesion_servidor',{
   p_actor:data.user.id,p_accion:accion,p_sesion:sesion,
   p_ip:ipServidor(req.headers,process.env.VERCEL==='1'),p_activo:activo
  });
  if(saveError)return reply(res,saveError.code==='42501'?403:503,{error:'No se pudo registrar la sesión'});
  return reply(res,200,{ok:true,...resultado});
 }catch{return reply(res,503,{error:'Bitácora temporalmente no disponible'});}
}
