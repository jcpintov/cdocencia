// Respeta la espera indicada por el proveedor, con un único reintento acotado.
// No reenvía documentos si cambió su autorización durante la espera.
export function esperaGroq(response,ahora=Date.now()){
 const valor=response.headers?.get?.('retry-after');
 if(valor==null||valor==='')return null;
 const segundos=Number(valor);
 const espera=Number.isFinite(segundos)?segundos:(Date.parse(valor)-ahora)/1000;
 return Number.isFinite(espera)&&espera>0?Math.min(86400,espera):null;
}
export function errorProveedorGroq(response){
 const limitado=response.status===429,segundos=esperaGroq(response);
 if(response.status===413)return Object.assign(new Error('El contexto documental supera el tamaño admitido por el proveedor. Acorta los antecedentes o inicia una nueva conversación; tu pregunta se conserva.'),{codigo:'GROQ_CONTEXTO_EXCEDIDO',status:413});
 return Object.assign(new Error(limitado?
  'Groq alcanzó su límite temporal.'+(segundos?` Espere al menos ${Math.ceil(segundos)} segundos antes de reanudar.`:' Espere antes de reanudar; el proveedor no indicó un plazo.')+' El avance guardado se conserva.':
  'El proveedor de IA no pudo completar este paso. El avance guardado se conserva.'),
  {codigo:limitado?'GROQ_LIMITE':'GROQ_SERVICIO',status:limitado?429:503,reintentar_en:limitado?Math.ceil(segundos||15):undefined});
}
export async function fetchGroqConLimite(url,options,{fetchImpl,validar,esperar=ms=>new Promise(resolve=>setTimeout(resolve,ms))}) {
 if(options.signal?.aborted)throw options.signal.reason;
 let r=await fetchImpl(url,options);
 const segundos=esperaGroq(r);
 // Una sola espera acotada permite completar búsqueda y respuesta en el plan gratuito.
 if(r.status===429 && segundos>0 && segundos<=59){
  await esperar(Math.min(60000,Math.ceil(segundos*1000)+4000));
  if(options.signal?.aborted)throw options.signal.reason;
  if(validar && !(await validar()))throw Error('Cambió la autorización documental.');
  r=await fetchImpl(url,{...options,signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000)});
 }
 return r;
}
