import {createClient} from '@supabase/supabase-js';
import {leerPaginas,maestrosVigentes,resumirAvances,resumirActividad} from '../lib/informes-ejecutivos.js';

function responder(res,status,data,inicio){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Server-Timing','informe;dur='+Math.max(0,Date.now()-inicio));
 return res.status(status).json(data);
}
// El plazo cubre autenticación y todas las páginas de lectura, no cada página por separado.
export function crearHandlerInformes({cliente=createClient,plazoMs=20000}={}){
 return async function handler(req,res){
  const inicio=Date.now(),reply=(s,d)=>responder(res,s,d,inicio);
  if(req.method!=='POST'){res.setHeader('Allow','POST');return reply(405,{error:'Método no permitido'});}
  const token=/^Bearer (.+)$/i.exec(req.headers.authorization||'')?.[1];
  if(!token)return reply(401,{error:'Sesión requerida'});
  let b=req.body;
  if(typeof b==='string'){try{b=JSON.parse(b);}catch{return reply(400,{error:'Solicitud inválida'});}}
  if(!b||typeof b!=='object'||Array.isArray(b))return reply(400,{error:'Solicitud inválida'});
  if(!['asignaciones','avances','actividad'].includes(b.tipo))return reply(422,{error:'Informe no admitido'});
  const {SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:key,SUPABASE_SERVICE_ROLE_KEY:secret}=process.env;
  if(!url||!key||!secret)return reply(503,{error:'Informes temporalmente no disponibles'});
  const controlador=new AbortController();let timer;
  try{
   const limite=new Promise((_,rechazar)=>{timer=setTimeout(()=>{
    controlador.abort();rechazar(Object.assign(new Error('Plazo agotado'),{code:'INFORME_TIMEOUT'}));
   },plazoMs);});
   const tarea=(async()=>{
    const signal=controlador.signal;
    const opciones={auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal})}};
    const auth=cliente(url,key,opciones);
    const {data:identidad,error:authError}=await auth.auth.getUser(token);
    signal.throwIfAborted();
    if(authError?.status>=500||authError?.name==='AuthRetryableFetchError')throw new Error('Identidad temporalmente no disponible');
    if(authError||!identidad?.user)return {status:401,body:{error:'Sesión no válida'}};
    const actor=identidad.user,email=String(actor.email||'').trim().toLowerCase();
    if(email!=='jpintov@gmail.com'&&actor.app_metadata?.superadmin_principal!==true)return {status:403,body:{error:'Operación exclusiva de Superadmin'}};
    const admin=cliente(url,secret,opciones);
    const {data:perfil,error:perfilError}=await admin.from('usuarios').select('id,email,es_admin,cuenta_eliminada').eq('auth_user_id',actor.id).maybeSingle().abortSignal(signal);
    if(perfilError)throw new Error('No fue posible comprobar el perfil');
    if(!perfil?.es_admin||perfil.cuenta_eliminada||String(perfil.email||'').trim().toLowerCase()!==email)return {status:403,body:{error:'Operación exclusiva de Superadmin'}};
    const usuarios=await leerPaginas(()=>admin.from('usuarios').select('id,nombre,email,es_admin,cuenta_eliminada').order('id'),{signal});
    const maestros=maestrosVigentes(usuarios),ids=new Set(maestros.map(u=>u.id));
    const corte=new Date().toISOString();let data;
    if(b.tipo==='asignaciones'){
     const {data:lista,error}=await admin.rpc('admin_asignaciones_docentes',{p_actor:actor.id,p_accion:'listar',p_datos:{}}).abortSignal(signal);
     if(error||!Array.isArray(lista?.asignaciones))throw new Error('Respuesta de asignaciones inválida');
     data={filas:lista.asignaciones.filter(a=>a.vigente&&ids.has(a.usuario_id)).map(a=>({nombre:a.nombre,codigo:a.codigo,trabajo:a.tema,fecha_asignacion:a.fecha_asignacion,fecha_entrega:a.fecha_entrega}))};
    }else if(b.tipo==='avances'){
     const [modulos,progresos]=await Promise.all([
      leerPaginas(()=>admin.from('modulos').select('id').eq('activo',true).order('id'),{signal}),
      leerPaginas(()=>admin.from('progreso_maestro').select('id,usuario_id,modulo_id,leido,completado').order('id'),{signal})
     ]);
     data={filas:resumirAvances(maestros,modulos,progresos)};
    }else{
     const accesos=await leerPaginas(()=>admin.from('registro_accesos').select('id,usuario_id,creado_en').lte('creado_en',corte).order('id'),{signal});
     data=resumirActividad(maestros,accesos);
    }
    signal.throwIfAborted();
    return {status:200,body:{ok:true,tipo:b.tipo,generado_en:corte,data}};
   })();
   const resultado=await Promise.race([tarea,limite]);return reply(resultado.status,resultado.body);
  }catch(e){
   const timeout=e.code==='INFORME_TIMEOUT'||controlador.signal.aborted;
   return reply(timeout?504:503,{error:timeout?'El servidor superó el tiempo de espera. Intente nuevamente.':'No fue posible obtener el informe completo. Intente nuevamente.'});
  }finally{clearTimeout(timer);controlador.abort();}
 };
}
export default crearHandlerInformes();
