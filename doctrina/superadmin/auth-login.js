/* Separate Supabase Auth sign-in for Doctrina. No Docencia credentials or roles. */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    const trigger=document.getElementById('doctrina-auth-login');
    if (!trigger || document.getElementById('doctrina-auth-modal')) return;
    const css=document.createElement('style');css.textContent=`
#doctrina-auth-modal[hidden]{display:none!important}
#doctrina-auth-modal{position:fixed;inset:0;z-index:9003;background:#030a12c9;backdrop-filter:blur(10px);display:grid;place-items:center;padding:18px;font-family:Inter,system-ui,sans-serif}
#doctrina-auth-modal .da-dialog{position:relative;width:min(460px,100%);padding:clamp(28px,5vw,44px);border:1px solid #d0a56d66;border-radius:23px;background:radial-gradient(circle at 85% 0%,#39414a 0%,transparent 42%),linear-gradient(145deg,#1c3549,#0d1825 72%);box-shadow:0 30px 100px #000a;color:#f6f1e8}
#doctrina-auth-modal .da-mark{width:53px;height:53px;border:1px solid #caa774;border-radius:15px;display:grid;place-items:center;color:#e8c795;font:600 28px Georgia,serif;margin-bottom:28px}
#doctrina-auth-modal .da-eyebrow{font-size:10px;font-weight:800;letter-spacing:.24em;text-transform:uppercase;color:#e3bd8b;margin:0 0 12px}
#doctrina-auth-modal h2{font:500 34px Georgia,serif;letter-spacing:-.025em;line-height:1.13;margin:0 0 12px}
#doctrina-auth-modal .da-desc{font-size:13px;color:#aebcc9;line-height:1.7;margin:0 0 28px}
#doctrina-auth-modal label{display:block;color:#cbd3dc;font-size:12px;font-weight:600;margin-bottom:8px}
#doctrina-auth-modal input{display:block;width:100%;box-sizing:border-box;padding:15px;background:#071421;border:1px solid #627081;border-radius:10px;color:#fff;font:14px Inter,system-ui;margin-top:9px}
#doctrina-auth-modal .da-submit{display:block;width:100%;padding:15px;border:0;border-radius:10px;background:linear-gradient(100deg,#c89d65,#ecd1a5);color:#192738;font:800 13px Inter,system-ui;margin-top:20px;cursor:pointer}
#doctrina-auth-modal .da-close{position:absolute;right:19px;top:18px;background:transparent;border:0;color:#e9e4df;font-size:23px;cursor:pointer}
#doctrina-auth-modal .da-foot{border-top:1px solid #ffffff20;padding-top:17px;margin-top:24px;color:#8da0b2;font-size:11px;line-height:1.5}
#doctrina-auth-modal :focus-visible,#doctrina-auth-login:focus-visible{outline:2px solid #f0ca92;outline-offset:3px}
`;document.head.append(css);
    const modal=document.createElement('div');modal.id='doctrina-auth-modal';modal.hidden=true;
    const dialog=document.createElement('section');dialog.className='da-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Acceso seguro a Doctrina');
    const mark=document.createElement('div');mark.className='da-mark';mark.textContent='D';
    const eyebrow=document.createElement('p');eyebrow.className='da-eyebrow';eyebrow.textContent='OFL 146 · Identidad institucional';
    const title=document.createElement('h2');title.textContent='El conocimiento merece resguardo.';
    const desc=document.createElement('p');desc.className='da-desc';desc.textContent='Accede al espacio de gobierno de Doctrina mediante un enlace privado enviado a tu correo autorizado.';
    const form=document.createElement('form');form.setAttribute('aria-label','Ingreso independiente Doctrina');
    const label=document.createElement('label');label.textContent='CORREO ELECTRÓNICO';
    const email=document.createElement('input');email.type='email';email.id='doctrina-login-email';email.name='email';email.required=true;email.autocomplete='email';email.placeholder='jpintov@gmail.com';email.value='jpintov@gmail.com';email.readOnly=true;label.append(email);
    const send=document.createElement('button');send.className='da-submit';send.type='submit';send.textContent='Solicitar acceso seguro  →';
    const close=document.createElement('button');close.className='da-close';close.type='button';close.textContent='×';close.setAttribute('aria-label','Cerrar acceso');
    const status=document.createElement('p');status.setAttribute('role','status');status.style.cssText='font-size:12px;line-height:1.5';
    const foot=document.createElement('p');foot.className='da-foot';foot.textContent='Acceso protegido por Supabase Auth · Permisos verificados en el servidor · Independiente de Docencia';
    function hide(){modal.hidden=true;trigger.focus();}
    close.addEventListener('click',hide);
    modal.addEventListener('click',e=>{if(e.target===modal)hide();});
    modal.addEventListener('keydown',e=>{if(e.key==='Escape')hide();if(e.key==='Tab'){const focusable=[close,email,send];const i=focusable.indexOf(document.activeElement);if(e.shiftKey&&i===0){e.preventDefault();send.focus();}else if(!e.shiftKey&&i===2){e.preventDefault();close.focus();}}});
    trigger.addEventListener('click',()=>{modal.hidden=false;email.focus();});
    form.append(label,send,status);dialog.append(close,mark,eyebrow,title,desc,form,foot);modal.append(dialog);document.body.append(modal);
    form.addEventListener('submit',async function(event){
      event.preventDefault();
      const client = typeof sbApp !== 'undefined' ? sbApp : null;
      if (!client?.auth?.signInWithOtp) {status.textContent='Servicio de autenticación no disponible.';return;}
      send.disabled=true;status.textContent='Solicitando enlace…';
      try {
        const {error}=await client.auth.signInWithOtp({email:email.value.trim(),options:{shouldCreateUser:false,emailRedirectTo:window.location.origin+window.location.pathname}});
        status.textContent=error?'No fue posible solicitar el acceso.':'Si el correo está habilitado, recibirás un enlace de acceso.';
      } catch (_) {status.textContent='No fue posible solicitar el acceso.';}
      finally {send.disabled=false;}
    });
  });
})();
