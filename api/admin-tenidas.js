import {createClient} from '@supabase/supabase-js';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
function fechaValida(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T12:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v;}
const texto=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const campos='id,fecha,grado,tema,autor,version,activo';
const iguales=(a,b)=>a&&['fecha','grado','tema','autor'].every(k=>a[k]===b[k]);
export default async function handler(req,res){
 const reply=(s,b)=>{res.setHeader('Cache-Control','no-store');return res.status(s).json(b);};
 if(req.method!=='POST'){res.setHeader('Allow','POST');return reply(405,{error:'Método no permitido'});}
 const token=/^Bearer (.+)$/i.exec(req.headers.authorization||'')?.[1];
 if(!token)return reply(401,{error:'Sesión requerida'});
 const {SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:key,SUPABASE_SERVICE_ROLE_KEY:service}=process.env;
 if(!url||!key||!service)return reply(503,{error:'Calendario no configurado'});
 try{
  const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:identity,error:authError}=await auth.auth.getUser(token);
  if(authError||!identity?.user?.id)return reply(401,{error:'Sesión no válida'});
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:actor,error:actorError}=await admin.from('usuarios').select('id,email,es_admin').eq('auth_user_id',identity.user.id).maybeSingle();
  if(actorError||!actor?.es_admin||String(actor.email).toLowerCase()!=='jpintov@gmail.com'||String(identity.user.email).toLowerCase()!=='jpintov@gmail.com')return reply(403,{error:'Acceso exclusivo de Superadmin'});
  const b=req.body||{};
  if(b.action==='listar'){
   if(typeof b.mes!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(b.mes)||!fechaValida(b.mes+'-01'))return reply(422,{error:'Seleccione un mes válido'});
   const [y,m]=b.mes.split('-').map(Number),hasta=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);
   const [trabajos,autores]=await Promise.all([
    admin.from('calendario_tenidas').select(campos).eq('activo',true).gte('fecha',b.mes+'-01').lte('fecha',hasta).order('fecha').order('creado_en'),
    admin.from('usuarios').select('nombre').neq('email','dummy@ofl.cl').order('nombre')
   ]);
   if(trabajos.error||autores.error||!Array.isArray(trabajos.data)||!Array.isArray(autores.data))return reply(503,{error:'No se pudo cargar el calendario. Vuelva a intentar.'});
   return reply(200,{ok:true,trabajos:trabajos.data,autores:[...new Set(autores.data.map(a=>a.nombre).filter(Boolean))]});
  }
  if(!['guardar','eliminar'].includes(b.action))return reply(400,{error:'Acción no admitida'});
  if(!uuid(b.id)||!Number.isInteger(b.version)||b.version<0)return reply(422,{error:'Registro o versión no válidos'});
  if(b.action==='guardar'&&(!fechaValida(b.fecha)||![1,2,3].includes(b.grado)||!texto(b.tema,250)||!texto(b.autor,180)))return reply(422,{error:'Revise la fecha, el grado, el tema y el autor'});
  const payload=b.action==='guardar'?{fecha:b.fecha,grado:b.grado,tema:b.tema.trim(),autor:b.autor.trim()}:null;
  const {data:previo,error:lookup}=await admin.from('calendario_tenidas').select(campos).eq('id',b.id).maybeSingle();
  if(lookup)return reply(503,{error:'No se pudo comprobar el registro'});
  if(b.action==='guardar'&&b.version===0){
   if(previo)return previo.activo&&previo.version===1&&iguales(previo,payload)?reply(200,{ok:true,trabajo:previo}):reply(409,{error:'El registro ya existe. Actualice el calendario.'});
   const {data,error}=await admin.from('calendario_tenidas').insert({id:b.id,...payload,creado_por:actor.id}).select(campos).single();
   if(error||!data)return reply(error?.code==='23505'?409:503,{error:'No se pudo confirmar el registro. Actualice o reintente sin crear otro formulario.'});
   return reply(201,{ok:true,trabajo:data});
  }
  if(!previo)return reply(404,{error:'Trabajo no encontrado'});
  if(b.action==='eliminar'&&!previo.activo)return reply(200,{ok:true});
  if(b.action==='guardar'&&previo.activo&&previo.version===b.version+1&&iguales(previo,payload))return reply(200,{ok:true,trabajo:previo});
  if(!previo.activo||previo.version!==b.version)return reply(409,{error:'El registro cambió en otra ventana. Actualice el calendario antes de editar.'});
  const {data,error}=await admin.from('calendario_tenidas').update({...payload,activo:b.action!=='eliminar',version:b.version+1,actualizado_en:new Date().toISOString()}).eq('id',b.id).eq('version',b.version).eq('activo',true).select(campos).maybeSingle();
  if(error)return reply(503,{error:'No se pudo confirmar el cambio. Actualice o vuelva a intentar.'});
  if(!data)return reply(409,{error:'El registro cambió. Actualice el calendario.'});
  return reply(200,{ok:true,trabajo:data});
 }catch{return reply(503,{error:'No se pudo confirmar la operación. Revise su conexión y actualice el calendario.'});}
}
