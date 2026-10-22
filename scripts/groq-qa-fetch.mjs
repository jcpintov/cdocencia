import {esperaGroq} from '../lib/groq-proveedor.js';
// Exclusivo de comprobaciones con datos inventados durante el build.
// Cada paso conserva su resultado y espera la cuota sin reiniciar el release.
export async function fetchGroqQA(url,options,{fetchImpl=fetch,esperar=ms=>new Promise(r=>setTimeout(r,ms)),log=console.log}={}){
 for(let intento=0;intento<3;intento++){
  const r=await fetchImpl(url,{...options,signal:AbortSignal.timeout(60000)});
  const segundos=esperaGroq(r);
  if(r.status!==429||intento===2||!segundos||segundos>300)return r;
  log('GROQ_QA_ESPERA_CUOTA segundos='+Math.ceil(segundos));
  await r.body?.cancel?.();
  await esperar(Math.ceil(segundos*1000)+1000);
 }
}
