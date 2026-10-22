// Respeta la espera indicada por el proveedor, con un único reintento acotado.
// No reenvía documentos si cambió su autorización durante la espera.
export async function fetchGroqConLimite(url,options,{fetchImpl,validar}) {
 let r=await fetchImpl(url,options);
 const segundos=Number(r.headers?.get?.('retry-after'));
 if(r.status===429 && segundos>0 && segundos<=35){
  await new Promise(resolve=>setTimeout(resolve,Math.ceil(segundos*1000)+250));
  if(validar && !(await validar()))throw Error('Cambió la autorización documental.');
  r=await fetchImpl(url,{...options,signal:AbortSignal.timeout(30000)});
 }
 return r;
}
