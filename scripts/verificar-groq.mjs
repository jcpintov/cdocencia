// Prueba explícita con datos inventados; no consulta la base ni imprime credenciales.
import {consultarGroqDoctrina,MODELO_GROQ} from '../lib/groq-doctrina.js';
import {verificarCasoDoctrina} from './verificar-caso-doctrina.mjs';
import {buscarBibliotecaConGroq} from '../lib/busqueda-groq.js';
if(process.env.GROQ_PRUEBA_SINTETICA!=='true'&&process.env.VERCEL_ENV!=='production'){
 console.log('GROQ_SYNTHETIC_CHECK_SKIP');
}else{
 const fuente={titulo:'Documento sintético de comprobación',clase:'docencia',version_id:'sintetico',version:1,pagina:1,sha256:'sintetico',fragmento:'Ejercicio ficticio: el círculo de estudio inicia a las 20:00. Su duración prevista es de sesenta minutos. Este texto no contiene disposiciones masónicas ni datos personales.'};
 const rpc=async accion=>{
  if(accion==='texto_buscar')return {resultados:[fuente],cobertura:{vigentes:1,consultables:1,pendientes:0}};
  if(accion==='texto_llm_listar')return {autorizaciones:[{...fuente,autorizado:true,modelo:MODELO_GROQ}]};
  return {ok:true,id:'prueba-sintetica-sin-registro'};
 };
 try{
  const busquedas=[];
  await buscarBibliotecaConGroq({pregunta:'que dise la constitusion sobre inisiasion?',antecedentes:''},{modelo:MODELO_GROQ,env:process.env,fetchImpl:fetch,rpc:async(_a,d)=>{busquedas.push(d.consulta);return {resultados:[]};}});
  if(!busquedas.some(q=>/iniciación|admisión/i.test(q)))throw Error('normalizacion_sintetica');
  console.log('GROQ_SEARCH_SYNTHETIC_OK consultas='+JSON.stringify(busquedas));
  const r=await consultarGroqDoctrina({pregunta:'Según el ejercicio ficticio, ¿a qué hora empieza y cuánto dura la actividad?',consulta:'círculo estudio',antecedentes:''},{rpc,fetchImpl:async(url,options)=>{
   const response=await fetch(url,options),raw=await response.text();
   let diagnostico={status:response.status};
   try{const j=JSON.parse(raw),choice=j.choices?.[0];diagnostico.finish=choice?.finish_reason;
    try{const payload=JSON.parse(choice?.message?.content||'');diagnostico.campos=Object.keys(payload);diagnostico.longitud=payload.respuesta?.length;diagnostico.referencias=payload.referencias;diagnostico.base_suficiente=payload.base_suficiente;diagnostico.citadas=[...(payload.respuesta||'').matchAll(/\bF\d+\b/g)].map(x=>x[0]);diagnostico.secciones=payload.secciones?.map(s=>({titulo:s.titulo,caracteres:s.texto?.length,referencias:s.referencias,referencia_en_texto:/\bF\d+\b/.test(s.texto||'')}));}catch{diagnostico.formato='json_invalido';}
   }catch{diagnostico.formato='respuesta_invalida';}
   console.log('GROQ_SYNTHETIC_DIAGNOSTIC '+JSON.stringify(diagnostico));
   return {ok:response.ok,status:response.status,text:async()=>raw};
  }});
  if(!r.generativo){console.error('GROQ_SYNTHETIC_CHECK_FAIL: '+r.aviso);process.exitCode=1;}
  else if(!r.secciones.some(s=>s.texto.includes('20:00'))||!r.secciones.some(s=>/sesenta|60/.test(s.texto))){console.error('GROQ_SYNTHETIC_CHECK_FAIL: contenido sintético esperado ausente');process.exitCode=1;}
  else console.log('GROQ_SYNTHETIC_CHECK_OK model='+r.modelo+' sections='+r.secciones.length+' references='+r.fuentes.length);
 }catch{console.error('GROQ_SYNTHETIC_CHECK_FAIL: no se pudo completar la prueba');process.exitCode=1;}
}

try { await verificarCasoDoctrina(); } catch(e) { console.error(e.message); process.exitCode=1; }
