/* Superadmin UI shell. No credentials, privileges or data are stored client-side. */
(function () {
  'use strict';
  if (document.getElementById('doctrina-superadmin-tab')) return;
  const style = document.createElement('style');
  style.textContent = '#doctrina-superadmin-tab{position:fixed;right:0;top:45%;z-index:9000;background:#18334b;color:#fff;border:1px solid #b48b55;border-radius:10px 0 0 10px;padding:12px 9px;writing-mode:vertical-rl;cursor:pointer;font:600 12px system-ui}#doctrina-superadmin-panel{position:fixed;right:0;top:0;height:100dvh;width:min(390px,100vw);background:#101d2a;color:#f5f5f5;z-index:9001;box-shadow:-10px 0 30px #0005;padding:24px;box-sizing:border-box;font:14px system-ui}#doctrina-superadmin-panel[hidden],#doctrina-superadmin-tab[hidden]{display:none}#doctrina-superadmin-panel button{cursor:pointer}';
  const tab = document.createElement('button'); tab.id='doctrina-superadmin-tab'; tab.type='button'; tab.textContent='Superadmin'; tab.hidden=true;
  const panel = document.createElement('aside'); panel.id='doctrina-superadmin-panel'; panel.hidden=true; panel.setAttribute('aria-label','Superadmin Doctrina');
  const title=document.createElement('h2'); title.textContent='Superadmin · Doctrina';
  const close=document.createElement('button');close.type='button';close.textContent='Cerrar';
  const info=document.createElement('p');info.textContent='Acceso reservado. Sin autorización del servidor no se habilitan funciones administrativas.';
  close.addEventListener('click',()=>{panel.hidden=true;tab.focus();});
  tab.addEventListener('click',()=>{if(tab.hidden)return;panel.hidden=false;close.focus();});
  const adminArea=document.createElement('section');
  const heading=document.createElement('h3');heading.textContent='Gestión de accesos';
  const list=document.createElement('div');list.setAttribute('aria-live','polite');
  const audit=document.createElement('div');audit.setAttribute('aria-live','polite');
  const form=document.createElement('form');
  const email=document.createElement('input');email.type='email';email.required=true;email.placeholder='Correo verificado';email.setAttribute('aria-label','Correo de usuario');
  const motive=document.createElement('textarea');motive.required=true;motive.minLength=10;motive.maxLength=1000;motive.placeholder='Fundamento (mínimo 10 caracteres)';motive.setAttribute('aria-label','Fundamento de autorización');
  const choice=document.createElement('select');choice.setAttribute('aria-label','Operación');
  [['true','Activar'],['false','Revocar']].forEach(([value,label])=>{const option=document.createElement('option');option.value=value;option.textContent=label;choice.append(option);});
  const apply=document.createElement('button');apply.type='submit';apply.textContent='Aplicar cambio';
  const reload=document.createElement('button');reload.type='button';reload.textContent='Actualizar';
  const feedback=document.createElement('p');feedback.setAttribute('role','status');
  form.append(email,choice,motive,apply);adminArea.append(heading,reload,list,form,feedback,audit);
  panel.append(title,close,info,adminArea);document.head.append(style);document.body.append(tab,panel);
  adminArea.hidden=true;
  let authorizedClient=null;
  function resetAdmin(){authorizedClient=null;adminArea.hidden=true;list.replaceChildren();audit.replaceChildren();feedback.textContent='';}
  async function loadAdmin(){
    const client=authorizedClient;
    if(!client)return;
    const [users,logs]=await Promise.all([client.rpc('doctrina_admin_listar'),client.rpc('doctrina_admin_auditoria')]);
    if(client!==authorizedClient)return;
    list.replaceChildren();audit.replaceChildren();
    if(users.error||logs.error){feedback.textContent='Funciones administrativas no disponibles o acceso denegado.';return;}
    for(const u of users.data||[]){const line=document.createElement('p');line.textContent=(u.email||'Cuenta')+' — '+(u.activo?'Activo':'Inactivo');list.append(line);}
    const auditHeading=document.createElement('h3');auditHeading.textContent='Últimas acciones';audit.append(auditHeading);
    for(const a of logs.data||[]){const line=document.createElement('p');line.textContent=new Date(a.fecha).toLocaleString()+' · '+a.accion+' · '+a.motivo;audit.append(line);}
    feedback.textContent='Información actualizada.';
  }
  reload.addEventListener('click',()=>{void loadAdmin();});
  form.addEventListener('submit',async(event)=>{
    event.preventDefault();const client=authorizedClient;if(!client)return;
    const operation=choice.value==='true';
    if(!window.confirm((operation?'Activar':'Revocar')+' acceso Superadmin a '+email.value.trim()+'?'))return;
    apply.disabled=true;feedback.textContent='Procesando solicitud…';
    try{
      const {data,error}=await client.rpc('doctrina_admin_cambiar',{p_email:email.value.trim(),p_activo:operation,p_motivo:motive.value.trim()});
      if(client!==authorizedClient)return;
      if(error||data!==true){feedback.textContent='Operación denegada o no disponible.';return;}
      feedback.textContent='Operación registrada.';motive.value='';await loadAdmin();
    }catch(_){feedback.textContent='No fue posible completar la operación.';}
    finally{apply.disabled=false;}
  });
  // Consultar RPC del servidor con sesión Auth válida. Fallo = denegación.
  // La función SQL pública doctrina_es_superadmin() valida auth.uid() en servidor.
  let revision = 0;
  function hide() { revision += 1; tab.hidden = true; panel.hidden = true; resetAdmin(); }
  async function refreshFromSupabase(client) {
    hide();
    const current = revision;
    if (!client || !client.auth || typeof client.auth.getUser !== 'function' || typeof client.rpc !== 'function') return false;
    try {
      const {data: userData, error: userError} = await client.auth.getUser();
      if (current !== revision || userError || !userData?.user?.id) return false;
      const userId = userData.user.id;
      const {data, error} = await client.rpc('doctrina_es_superadmin');
      if (current !== revision || error || data !== true) return false;
      const {data: after, error: afterError} = await client.auth.getUser();
      if (current !== revision || afterError || after?.user?.id !== userId) return false;
      tab.hidden = false;
      authorizedClient=client;adminArea.hidden=false;void loadAdmin();
      return true;
    } catch (_) { if (current === revision) hide(); return false; }
  }
  window.DoctrinaSuperadminShell=Object.freeze({
    refreshFromSupabase: refreshFromSupabase,
    hide: hide
  });
})();
