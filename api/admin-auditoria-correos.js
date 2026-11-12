import {createClient} from '@supabase/supabase-js';
import {esSuperadmin} from '../lib/roles-admin.js';
const fecha=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T12:00:00Z'));
const partes=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
function inicioChile(dia){
 const objetivo=Date.parse(dia+'T00:00:00Z');let resultado=objetivo+4*3600000;
 // Ajuste iterativo para cambios de horario de verano e invierno.
 for(let i=0;i<4;i++){
  const p=Object.fromEntries(partes.formatToParts(new Date(resultado)).filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));
  const local=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);
  resultado+=objetivo-local;
 }
 return new Date(resultado).toISOString();
}
function diaSiguiente(dia){return new Date(Date.parse(dia+'T12:00:00Z')+86400000).toISOString().slice(0,10);}
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Método no permitido'});}
 const token=/^Bearer (.+)$/i.exec(req.headers.authorization||'')?.[1];
 if(!token)return res.status(401).json({error:'Sesión requerida'});
 const {SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:key,SUPABASE_SERVICE_ROLE_KEY:secret}=process.env;
 if(!url||!key||!secret)return res.status(503).json({error:'Servicio no configurado'});
 try{
  const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:identidad,error:authError}=await auth.auth.getUser(token);
  if(authError||!identidad?.user)return res.status(401).json({error:'Sesión caducada'});
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:perfil,error:perfilError}=await admin.from('usuarios').select('id,email,es_admin,rol,cuenta_eliminada').eq('auth_user_id',identidad.user.id).maybeSingle();
  if(perfilError||!esSuperadmin(perfil,identidad.user))return res.status(403).json({error:'Acceso exclusivo del Superadmin'});
  let b=req.body;if(typeof b==='string')b=JSON.parse(b);
  if(!b||typeof b!=='object'||Array.isArray(b))return res.status(400).json({error:'Solicitud inválida'});
  const {desde,hasta,estado,tipo,busqueda}=b;
  if((desde&&!fecha(desde))||(hasta&&!fecha(hasta))||(desde&&hasta&&desde>hasta))return res.status(422).json({error:'Período inválido'});
  if(desde&&hasta&&(Date.parse(hasta)-Date.parse(desde)>366*86400000))return res.status(422).json({error:'Máximo 366 días'});
  if(estado&&!['pendiente','aceptado_smtp','error','incierto'].includes(estado))return res.status(422).json({error:'Estado inválido'});
  if(tipo&&(typeof tipo!=='string'||tipo.length>80))return res.status(422).json({error:'Tipo inválido'});
  if(busqueda&&(typeof busqueda!=='string'||busqueda.length>120))return res.status(422).json({error:'Búsqueda demasiado larga'});
  let q=admin.from('auditoria_correos').select('id,creado_en,remitente,destinatarios,cc,cco,asunto,tipo,origen_id,intento_id,estado,aceptados_smtp,rechazados_smtp,message_id,error_codigo,error_detalle',{count:'exact'});
  if(desde)q=q.gte('creado_en',inicioChile(desde));
  if(hasta)q=q.lt('creado_en',inicioChile(diaSiguiente(hasta)));
  if(estado)q=q.eq('estado',estado);
  if(tipo)q=q.eq('tipo',tipo);
  // La búsqueda textual se realiza solo sobre el conjunto recuperado (sin interpolar filtros SQL).
  const {data,error,count}=await q.order('creado_en',{ascending:false}).limit(2000);
  if(error)throw error;
  const needle=String(busqueda||'').trim().toLocaleLowerCase('es-CL');
  const filas=needle?data.filter(f=>[f.remitente,f.asunto,...f.destinatarios,...f.cc,...f.cco].some(v=>String(v||'').toLocaleLowerCase('es-CL').includes(needle))):data;
  return res.status(200).json({ok:true,generado_en:new Date().toISOString(),filas,total:count,limitado:count>2000});
 }catch(e){console.error('AUDITORIA_CORREOS_QUERY',e?.code||'error');return res.status(503).json({error:'No fue posible consultar la auditoría'});}
}
