/* Seguimiento por pestaña; nunca impide estudiar si la bitácora falla. */
(function(){
 let id=null,token=null,timer=null,busy=false,generacion=0,interaccion=Date.now(),previoActivo=false;
 const activo=()=>document.visibilityState==='visible'&&Date.now()-interaccion<60000;
 async function enviar(accion,keepalive=false){
  if(!id||!token||busy)return false;
  const esperado=generacion;busy=true;
  const ahora=activo();
  try{
   const res=await fetch('/api/bitacora-sesion',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
    body:JSON.stringify({accion,sesion:id,activo:previoActivo&&ahora}),
    keepalive,signal:keepalive?undefined:AbortSignal.timeout(10000)
   });
   const data=await res.json();
   if(!res.ok||!data.ok)throw new Error('registro');
   if(esperado!==generacion)return false;
   previoActivo=ahora;
   if(data.cerrada&&accion!=='cerrar'){id=crypto.randomUUID();previoActivo=false;pendienteInicio=true;return false;}
   return true;
  }catch{if(esperado===generacion)console.warn('Bitácora: registro pendiente; se reintentará.');return false;}
  finally{if(esperado===generacion)busy=false;}
 }
 let pendienteInicio=true;
 async function pulso(){
  if(!id)return;
  if(pendienteInicio){
   pendienteInicio=!(await enviar('iniciar'));
   if(pendienteInicio)return;
  }
  await enviar('latido');
 }
 window.iniciarBitacoraSesion=async function(){
  if(id)return;
  const actual=++generacion;
  try{
   const {data:{session}}=await sbApp.auth.getSession();
   if(actual!==generacion||!session?.access_token)return;
   token=session.access_token;id=crypto.randomUUID();interaccion=Date.now();
   previoActivo=false;pendienteInicio=true;
   pendienteInicio=!(await enviar('iniciar'));
   timer=setInterval(()=>void pulso(),30000);
  }catch{console.warn('Bitácora: no se pudo iniciar el seguimiento.');}
 };
 window.cerrarBitacoraSesion=function(){
  if(timer)clearInterval(timer);timer=null;
  // Capturar el cierre antes de borrar la identidad o revocar la sesión.
  if(id&&token)void fetch('/api/bitacora-sesion',{method:'POST',
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
   body:JSON.stringify({accion:'cerrar',sesion:id,activo:previoActivo&&activo()}),keepalive:true}).catch(()=>{});
  ++generacion;id=null;token=null;busy=false;pendienteInicio=true;previoActivo=false;
 };
 ['pointerdown','keydown','scroll','touchstart','mousemove'].forEach(e=>
  window.addEventListener(e,()=>{interaccion=Date.now();},{passive:true}));
 document.addEventListener('visibilitychange',()=>{if(id)void pulso();});
 window.addEventListener('pagehide',()=>{if(id)void enviar('latido',true);});
 sbApp.auth.onAuthStateChange((_event,session)=>{
  if(session?.access_token)token=session.access_token;
  else if(id)window.cerrarBitacoraSesion();
 });
})();
