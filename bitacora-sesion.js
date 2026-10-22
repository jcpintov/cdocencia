/* Bitácora por pestaña: registrar IP y actividad desde el servidor.
   Una falla de registro no interrumpe Docencia ni provoca nuevas sesiones falsas. */
(function(){
 'use strict';
 let id=null,token=null,timer=null,busy=false,generacion=0,interaccion=Date.now();
 let previoActivo=false,pendienteInicio=true,pausadaPorAuth=false,ultimoAviso='';
 const activo=()=>document.visibilityState==='visible'&&Date.now()-interaccion<60000;
 const avisar=(codigo)=>{
  if(ultimoAviso===codigo)return;
  ultimoAviso=codigo;
  // El identificador diagnóstico nunca incluye IP, credenciales ni respuestas privadas.
  console.warn('Bitácora: '+(codigo==='auth'?'sesión de registro no válida; seguimiento pausado hasta renovar la autenticación.':'registro pendiente; se reintentará cuando haya conexión.'));
 };
 function limpiar(){
  if(timer)clearInterval(timer);
  timer=null;id=null;token=null;busy=false;pendienteInicio=true;previoActivo=false;
 }
 async function sesionVigente(forzar=false){
  const {data,error}=await sbApp.auth.getSession();
  let sesion=data?.session;
  if(error||!sesion?.access_token)return null;
  // Refrescar antes de consumir tokens caducados, no enviar peticiones inútiles 401.
  const caduca=Number(sesion.expires_at);
  if(forzar||(caduca>0&&caduca*1000<Date.now()+45000)){
   if(typeof sbApp.auth.refreshSession!=='function')return forzar?null:sesion;
   const renovada=await sbApp.auth.refreshSession();
   if(renovada.error||!renovada.data?.session?.access_token)return null;
   sesion=renovada.data.session;
  }
  return sesion;
 }
 async function solicitud(accion,sesionId,accessToken,estaActivo,keepalive){
  const res=await fetch('/api/bitacora-sesion',{
   method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+accessToken},
   body:JSON.stringify({accion,sesion:sesionId,activo:estaActivo}),
   keepalive,signal:keepalive?undefined:AbortSignal.timeout(10000)
  });
  // No asumir éxito HTTP 200 si el servidor declara rechazo.
  const respuesta=await res.json().catch(()=>({}));
  return {ok:res.ok&&respuesta.ok===true,status:res.status,data:respuesta};
 }
 async function enviar(accion,keepalive=false){
  if(!id||busy||pausadaPorAuth)return false;
  const esperado=generacion,sid=id,estaActivo=previoActivo&&activo();
  busy=true;
  try{
   const sesion=await sesionVigente();
   if(esperado!==generacion)return false;
   if(!sesion){pausadaPorAuth=true;avisar('auth');return false;}
   token=sesion.access_token;
   let r=await solicitud(accion,sid,token,estaActivo,keepalive);
   if(r.status===401&&!keepalive){
    // Único reintento tras renovar credenciales: evita tormentas de 401.
    const renovada=await sesionVigente(true);
    if(esperado!==generacion)return false;
    if(renovada?.access_token){
     token=renovada.access_token;
     r=await solicitud(accion,sid,token,estaActivo,false);
    }
   }
   if(esperado!==generacion)return false;
   if(r.status===401||r.status===403){
    pausadaPorAuth=true;avisar('auth');return false;
   }
   if(!r.ok){avisar('red');return false;}
   ultimoAviso='';
   previoActivo=activo();
   if(r.data.cerrada&&accion!=='cerrar'){
    id=crypto.randomUUID();previoActivo=false;pendienteInicio=true;
    return false;
   }
   return true;
  }catch{
   if(esperado===generacion)avisar('red');
   return false;
  }finally{if(esperado===generacion)busy=false;}
 }
 async function pulso(){
  if(!id||pausadaPorAuth)return;
  if(pendienteInicio){
   pendienteInicio=!(await enviar('iniciar'));
   if(pendienteInicio)return;
  }
  await enviar('latido');
 }
 window.iniciarBitacoraSesion=async function(){
  if(id||pausadaPorAuth)return;
  const actual=++generacion;
  try{
   const sesion=await sesionVigente();
   if(actual!==generacion||!sesion?.access_token)return;
   token=sesion.access_token;id=crypto.randomUUID();interaccion=Date.now();
   previoActivo=false;pendienteInicio=true;
   pendienteInicio=!(await enviar('iniciar'));
   if(actual!==generacion||!id)return;
   timer=setInterval(()=>void pulso(),30000);
  }catch{avisar('red');}
 };
 window.cerrarBitacoraSesion=function(){
  const sid=id,accessToken=token,estaActivo=previoActivo&&activo();
  ++generacion;limpiar();pausadaPorAuth=false;ultimoAviso='';
  if(!sid||!accessToken)return Promise.resolve(false);
  // Se debe esperar este cierre antes de revocar la sesión en Auth.
  // En pagehide seguirá siendo best effort, pero logout explícito espera al servidor.
  return solicitud('cerrar',sid,accessToken,estaActivo,true)
   .then(r=>r.ok).catch(()=>false);
 };
 ['pointerdown','keydown','scroll','touchstart','mousemove'].forEach(e=>
  window.addEventListener(e,()=>{interaccion=Date.now();},{passive:true}));
 document.addEventListener('visibilitychange',()=>{if(id)void pulso();});
 window.addEventListener('pagehide',event=>{
  if(!id)return;
  if(event.persisted){void enviar('latido',true);return;}
  void window.cerrarBitacoraSesion();
 });
 window.addEventListener('pageshow',()=>{if(!id&&!pausadaPorAuth)void window.iniciarBitacoraSesion();});
 sbApp.auth.onAuthStateChange((evento,session)=>{
  if(evento==='SIGNED_OUT'){
   // Un cierre explícito ya envió su evento. No duplicar ni enviar tokens revocados.
   ++generacion;limpiar();pausadaPorAuth=false;return;
  }
  if(session?.access_token){
   const cambiado=token!==session.access_token;
   token=session.access_token;
   if(cambiado||evento==='SIGNED_IN'||evento==='TOKEN_REFRESHED'){
    pausadaPorAuth=false;
    if(id&&pendienteInicio)void pulso();
    else if(!id&&evento==='SIGNED_IN')queueMicrotask(()=>void window.iniciarBitacoraSesion());
   }
  }
 });
})();
