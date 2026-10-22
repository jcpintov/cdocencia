// Comparación aislada con latencia artificial. No usa credenciales ni red.
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {consultarGroqDoctrina} from '../lib/groq-doctrina.js';
let anterior=execFileSync('git',['show','HEAD:lib/groq-doctrina.js'],{encoding:'utf8'});
anterior=anterior.replace(/from '([.][^']+)'/g,(_m,p)=>`from '${new URL('../lib/'+p,import.meta.url).href}'`);
const base=await import('data:text/javascript;base64,'+Buffer.from(anterior).toString('base64'));
const demora=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const fuentes=Array.from({length:6},(_,i)=>({titulo:'Documento sintético',clase:'doctrina',version_id:'fixture',version:1,sha256:'fixture',pagina:i+1,fragmento:'Texto sintético de estudio y cooperación.'}));
async function medir(fn){
 let paginas=0,metricas;
 const rpc=async(a,d)=>{
  if(a==='texto_pagina'){paginas++;await demora(25);return {sha256:'fixture',pagina:{numero:d.pagina,texto:fuentes[0].fragmento}};}
  if(a==='texto_contexto')return {paginas:fuentes};
  if(a==='texto_llm_listar')return {autorizaciones:[{...fuentes[0],autorizado:true,modelo:'openai/gpt-oss-120b'}]};
  return {ok:true,id:'fixture'};
 };
 const fetchImpl=async()=>{await demora(10);return {ok:true,text:async()=>JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({respuesta:'El pasaje sintético fundamenta esta respuesta [F1].',referencias:['F1'],base_suficiente:true})}}]})};};
 const inicio=performance.now();
 const r=await fn({pregunta:'¿Cómo se aplica al mismo caso?',historial:[{role:'user',content:'Caso sintético anterior'}],fuentesPrevias:fuentes},{rpc,fetchImpl,env:{GROQ_API_KEY:'fixture',GROQ_ZDR_CONFIRMADO:'true'},onMetrics:m=>metricas=m});
 if(!r.generativo)throw Error('Falló la respuesta sintética');
 return {ms:Math.round(performance.now()-inicio),lecturas_paginas:paginas,metricas};
}
const antes=await medir(base.consultarGroqDoctrina),despues=await medir(consultarGroqDoctrina);
console.log(JSON.stringify({tipo:'simulación: 25 ms por lectura y 10 ms de proveedor',antes,despues},null,2));
