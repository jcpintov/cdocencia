/* Separate Supabase Auth sign-in for Doctrina. No Docencia credentials or roles. */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('doctrina-auth-login')) return;
    const trigger = document.createElement('button');
    trigger.id = 'doctrina-auth-login';
    trigger.type = 'button';
    trigger.textContent = 'Acceso Doctrina';
    trigger.setAttribute('aria-label', 'Acceso autenticado a Doctrina');
    trigger.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:8999;padding:8px 12px;border-radius:8px;background:#18334b;color:white;border:1px solid #b48b55;cursor:pointer';
    const form = document.createElement('form');
    form.hidden = true;
    form.setAttribute('aria-label', 'Ingreso independiente Doctrina');
    form.style.cssText = 'position:fixed;right:12px;bottom:54px;z-index:9002;padding:16px;background:#101d2a;color:white;border:1px solid #b48b55;border-radius:8px;max-width:320px';
    const label = document.createElement('label');label.textContent='Correo electrónico';
    const email = document.createElement('input');email.type='email';email.required=true;email.autocomplete='email';email.style.width='100%';label.append(email);
    const send = document.createElement('button');send.type='submit';send.textContent='Enviar enlace de acceso';
    const close = document.createElement('button');close.type='button';close.textContent='Cerrar';
    const status = document.createElement('p');status.setAttribute('role','status');
    close.addEventListener('click',()=>{form.hidden=true;});
    trigger.addEventListener('click',()=>{form.hidden=!form.hidden;if(!form.hidden)email.focus();});
    form.addEventListener('submit',async function(event){
      event.preventDefault();
      const client = typeof sbApp !== 'undefined' ? sbApp : null;
      if (!client?.auth?.signInWithOtp) {status.textContent='Servicio de autenticación no disponible.';return;}
      send.disabled=true;status.textContent='Solicitando enlace…';
      try {
        const {error}=await client.auth.signInWithOtp({email:email.value.trim(),options:{shouldCreateUser:false}});
        status.textContent=error?'No fue posible solicitar el acceso.':'Si el correo está habilitado, recibirás un enlace de acceso.';
      } catch (_) {status.textContent='No fue posible solicitar el acceso.';}
      finally {send.disabled=false;}
    });
    form.append(label,send,close,status);document.body.append(trigger,form);
  });
})();
