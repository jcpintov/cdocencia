// Prueba explícita con datos inventados; no consulta la base ni imprime credenciales.
import {consultarGroqDoctrina,MODELO_GROQ} from '../lib/groq-doctrina.js';
if(process.env.GROQ_PRUEBA_SINTETICA!=='true'){
 console.log('GROQ_SYNTHETIC_CHECK_SKIP');
}else{
 const fuente={titulo:'Documento sintético de comprobación',clase:'docencia',version_id:'sintetico',version:1,pagina:1,sha256:'sintetico',fragmento:'Ejercicio ficticio: el círculo de estudio inicia a las 20:00. Su duración prevista es de sesenta minutos. Este texto no contiene disposiciones masónicas ni datos personales.'};
 const rpc=async accion=>{
  if(accion==='texto_buscar')return {resultados:[fuente],cobertura:{vigentes:1,consultables:1,pendientes:0}};
  if(accion==='texto_llm_listar')return {autorizaciones:[{...fuente,autorizado:true,modelo:MODELO_GROQ}]};
  return {ok:true,id:'prueba-sintetica-sin-registro'};
 };
 try{
  const r=await consultarGroqDoctrina({pregunta:'Según el ejercicio ficticio, ¿a qué hora empieza y cuánto dura la actividad?',consulta:'círculo estudio',antecedentes:''},{rpc});
  if(!r.generativo){console.error('GROQ_SYNTHETIC_CHECK_FAIL: '+r.aviso);process.exitCode=1;}
  else if(!r.secciones.some(s=>s.texto.includes('20:00'))||!r.secciones.some(s=>/sesenta|60/.test(s.texto))){console.error('GROQ_SYNTHETIC_CHECK_FAIL: contenido sintético esperado ausente');process.exitCode=1;}
  else console.log('GROQ_SYNTHETIC_CHECK_OK model='+r.modelo+' sections='+r.secciones.length+' references='+r.fuentes.length);
 }catch{console.error('GROQ_SYNTHETIC_CHECK_FAIL: no se pudo completar la prueba');process.exitCode=1;}
}
