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
  panel.append(title,close,info); document.head.append(style);document.body.append(tab,panel);
  // Consultar RPC del servidor con sesión Auth válida. Fallo = denegación.
  // La función SQL pública doctrina_es_superadmin() valida auth.uid() en servidor.
  let revision = 0;
  function hide() { revision += 1; tab.hidden = true; panel.hidden = true; }
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
      return true;
    } catch (_) { if (current === revision) hide(); return false; }
  }
  window.DoctrinaSuperadminShell=Object.freeze({
    refreshFromSupabase: refreshFromSupabase,
    hide: hide
  });
})();
