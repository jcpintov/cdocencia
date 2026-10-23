import {esOperador} from '../lib/roles-admin.js';
import { createClient } from '@supabase/supabase-js';

function respond(res,status,data) {
  res.setHeader('Cache-Control','no-store');
  return res.status(status).json(data);
}
const validText=(v,max)=>typeof v==='string' && v.trim().length>0 && v.length<=max;
export default async function handler(req,res) {
  if(req.method!=='POST'){
    res.setHeader('Allow','POST');
    return respond(res,405,{error:'Método no permitido'});
  }
  const {SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:publicKey,SUPABASE_SERVICE_ROLE_KEY:serviceKey}=process.env;
  if(!url||!publicKey||!serviceKey)return respond(res,503,{error:'Administración no configurada'});
  const token=/^Bearer (.+)$/i.exec(req.headers.authorization||'')?.[1];
  if(!token)return respond(res,401,{error:'Sesión requerida'});
  const authClient=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:identity,error:identityError}=await authClient.auth.getUser(token);
  if(identityError||!identity?.user?.id)return respond(res,401,{error:'Sesión no válida'});
  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:perfil,error:perfilError}=await admin.from('usuarios').select('id,email,es_admin,rol,cuenta_eliminada')
    .eq('auth_user_id',identity.user.id).maybeSingle();
  if(perfilError||!esOperador(perfil,identity.user))return respond(res,403,{error:'Se requiere administración docente'});
  const {action,id}=req.body||{};
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(id||'')))
    return respond(res,422,{error:'Identificador de trabajo inválido'});
  if(!['editar','preguntas'].includes(action))
    return respond(res,422,{error:'Acción no admitida'});
  const {data:anterior,error:findError}=await admin.from('modulos')
    .select('id,unidad_codigo').eq('id',id).maybeSingle();
  if(findError)return respond(res,503,{error:'No fue posible consultar el trabajo'});
  if(!anterior)return respond(res,404,{error:'Trabajo no encontrado'});

  if(action==='preguntas'){
    const preguntas=req.body.preguntas_json;
    if(!preguntas||!Array.isArray(preguntas.preguntas)||preguntas.preguntas.length!==8)
      return respond(res,422,{error:'Se requieren ocho preguntas'});
    for(const p of preguntas.preguntas){
      if(!validText(p.enunciado,3000)||!['A','B','C','D'].includes(p.respuesta_correcta)||
        !Array.isArray(p.opciones)||p.opciones.length!==4||
        !['A','B','C','D'].every((letra,i)=>p.opciones[i].letra===letra&&validText(p.opciones[i].texto,2000))||
        typeof p.retroalimentacion!=='string'||p.retroalimentacion.length>3000)
        return respond(res,422,{error:'Revise el contenido de las preguntas'});
    }
    const {error}=await admin.from('modulos').update({preguntas_json:preguntas}).eq('id',id);
    return error?respond(res,503,{error:'No se pudieron guardar las preguntas'}):
      respond(res,200,{ok:true});
  }

  const {numero_orden,titulo,autor,contenido_trazado,unidad_codigo}=req.body||{};
  if(!Number.isInteger(numero_orden)||numero_orden<1||numero_orden>999||
    !validText(titulo,250)||!validText(autor,250)||
    !validText(contenido_trazado,1500000)||
    !(unidad_codigo===null||unidad_codigo===undefined||
      /^(INCI|INST|FILO|ETIC)[0-9]{2}[0-9A-Z]{2}$/.test(unidad_codigo)))
    return respond(res,422,{error:'Verifique el número, encabezado, texto y código'});
  const principal=unidad_codigo===undefined?anterior.unidad_codigo:unidad_codigo;
  if(principal){
    const {data:tema,error:temaError}=await admin.from('unidades_docencia')
      .select('codigo').eq('codigo',principal).eq('activo',true).maybeSingle();
    if(temaError||!tema)return respond(res,422,{error:'El código docente no existe o no está activo'});
  }
  const {data:orden,error:ordenError}=await admin.from('modulos')
    .select('id').eq('numero_orden',numero_orden).neq('id',id).limit(1);
  if(ordenError)return respond(res,503,{error:'No se pudo comprobar el número de orden'});
  if(orden?.length)return respond(res,409,{error:'Ya existe un trabajo con ese número de orden'});
  const payload={numero_orden,titulo:titulo.trim(),autor:autor.trim(),contenido_trazado};
  if(unidad_codigo!==undefined)payload.unidad_codigo=unidad_codigo;
  const {error:updateError}=await admin.from('modulos').update(payload).eq('id',id);
  if(updateError)return respond(res,503,{error:'No se pudo guardar el trabajo'});

  // Cambiar la asociación principal sin borrar vínculos adicionales ya establecidos.
  if(principal && principal!==anterior.unidad_codigo){
    const {error:linkError}=await admin.from('modulos_temas')
      .upsert({modulo_id:id,codigo:principal},{onConflict:'modulo_id,codigo'});
    if(linkError)return respond(res,500,{error:'Trabajo guardado, pero falló la asociación temática; revise los vínculos'});
    if(anterior.unidad_codigo){
      const {error:removeError}=await admin.from('modulos_temas')
        .delete().eq('modulo_id',id).eq('codigo',anterior.unidad_codigo);
      if(removeError)return respond(res,500,{error:'Trabajo guardado, pero no se pudo retirar el vínculo principal anterior'});
    }
  }
  return respond(res,200,{ok:true,unidad_codigo:principal});
}

