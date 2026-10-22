// Prueba privada, activada solo para una entrega. No imprime originales ni respuestas.
import {createClient} from '@supabase/supabase-js';
import {consultarGroqDoctrina} from '../lib/groq-doctrina.js';
export async function verificarCasoDoctrina() {
 if (process.env.DOCTRINA_QA_CASO !== 'true') return;
 const {SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY} = process.env;
 const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
 const {data:actor,error} = await admin.from('usuarios').select('auth_user_id').eq('email','jpintov@gmail.com').eq('es_admin',true).single();
 if(error || !actor?.auth_user_id) throw Error('CASO_QA_IDENTIDAD');
 const rpc = async (accion, datos = {}) => {
  const {data,error} = await admin.rpc('doctrina_texto_superadmin',{p_actor:actor.auth_user_id,p_accion:accion,p_datos:datos});
  if(error){console.log('CASO_QA_RPC_ERROR '+JSON.stringify({accion,codigo:error.code}));throw Error('CASO_QA_RPC_' + (error.code || 'error'));}
  return data;
 };
 const informe = await consultarGroqDoctrina({pregunta:'que pasa si no asisto por varios meses a la logia y no me excuso',antecedentes:''},{rpc,fetchImpl:async(url,op)=>{
  const r=await fetch(url,op);
  if(r.ok){const j=await r.clone().json().catch(()=>({}));const c=j.choices?.[0];const f=c?.message?.tool_calls?.[0]?.function;let a;try{a=JSON.parse(f?.arguments||'{}');}catch{}console.log('CASO_QA_ETAPA '+JSON.stringify({finish:c?.finish_reason,herramienta:f?.name,campos:a?Object.keys(a):[],consultas:a?.consultas?.length,conducta:a?.es_caso_conducta}));}
  if(!r.ok){const raw=await r.clone().json().catch(()=>({}));const mensaje=String(raw.error?.message||'');console.log('CASO_QA_PROVEEDOR '+JSON.stringify({status:r.status,codigo:raw.error?.code,limites:mensaje.match(/(?:Limit|Used|Requested)[: ]+[0-9]+/gi),reintento:r.headers.get('retry-after')}));}
  return r;
 }});
 if(!informe.generativo) throw Error('CASO_QA_SIN_RESPUESTA: '+informe.aviso);
 const texto = informe.secciones.map(s=>s.texto).join('\n');
 console.log('DOCTRINA_CASO_DIAGNOSTICO '+JSON.stringify({generativo:informe.generativo,deber:/deber|obligaci[oó]n|incumplimiento/i.test(texto),competencia:/tribunal|[oó]rgano jurisdiccional/i.test(texto),clases:informe.fuentes.map(f=>f.clase)}));
 if(!/deber|obligaci[oó]n|incumplimiento/i.test(texto) || !/tribunal|[oó]rgano jurisdiccional/i.test(texto) ||
    !informe.fuentes.some(f=>f.clase==='normativa')) throw Error('CASO_QA_FUNDAMENTO_INCOMPLETO');
 console.log('DOCTRINA_CASO_REAL_OK generativo=true fundamento_normativo=true deber=true competencia=true referencias='+informe.fuentes.length);
}
