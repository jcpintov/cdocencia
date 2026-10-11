/* Superadmin UI shell. No credentials, privileges or data are stored client-side. */
(function () {
  'use strict';
  if (document.getElementById('doctrina-superadmin-tab')) return;
  const style = document.createElement('style');
  style.textContent = `
#doctrina-superadmin-tab,#doctrina-superadmin-panel{font-family:Inter,system-ui,sans-serif}
#doctrina-superadmin-tab{position:fixed;right:0;top:43%;z-index:9000;background:linear-gradient(145deg,#1c3448,#0b1825);color:#f5e8d5;border:1px solid #c39a61;border-right:0;border-radius:14px 0 0 14px;padding:18px 12px;writing-mode:vertical-rl;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;font-size:11px;font-weight:800;box-shadow:0 12px 35px #0005}
#doctrina-superadmin-panel{position:fixed;right:0;top:0;height:100dvh;width:min(960px,100vw);background:#0b1420;color:#edf1f5;z-index:9001;box-shadow:-20px 0 90px #0009;box-sizing:border-box;overflow:auto}
#doctrina-superadmin-panel[hidden],#doctrina-superadmin-tab[hidden],#doctrina-superadmin-panel [hidden]{display:none!important}
#doctrina-superadmin-panel *{box-sizing:border-box}
#doctrina-superadmin-panel .ds-header{padding:28px 36px;background:radial-gradient(ellipse at 90% 0%,#3b3b39 0%,transparent 45%),linear-gradient(120deg,#1b3549,#101c2b 70%);border-bottom:1px solid #ffffff20;display:flex;justify-content:space-between;gap:20px;align-items:center}
#doctrina-superadmin-panel .ds-eyebrow{color:#d6b381;letter-spacing:.22em;font-size:10px;font-weight:800;text-transform:uppercase;margin:0 0 10px}
#doctrina-superadmin-panel h2{font:500 clamp(24px,3vw,35px) Georgia,serif;letter-spacing:-.025em;margin:0}
#doctrina-superadmin-panel h3{font-size:17px;font-weight:650;margin:0 0 18px}
#doctrina-superadmin-panel .ds-sub{color:#9faebd;margin:10px 0 0;font-size:13px}
#doctrina-superadmin-panel button{cursor:pointer}
#doctrina-superadmin-panel .ds-close,#doctrina-superadmin-panel .ds-secondary{background:#ffffff0b;border:1px solid #ffffff25;color:#e9edf3;border-radius:9px;padding:10px 15px}
#doctrina-superadmin-panel .ds-content{padding:28px 36px 40px}
#doctrina-superadmin-panel .ds-nav{display:flex;gap:8px;border-bottom:1px solid #ffffff1c;margin-bottom:24px;overflow-x:auto}
#doctrina-superadmin-panel .ds-nav button{background:transparent;border:0;border-bottom:2px solid transparent;color:#9caab9;padding:13px 17px;font-weight:650;white-space:nowrap}
#doctrina-superadmin-panel .ds-nav button[aria-selected=true]{color:#edc78f;border-bottom-color:#d6a86c}
/* Editorial executive styling: visual-only, no permission changes */
#doctrina-superadmin-panel{background:#f6f3ee;color:#152538}
#doctrina-superadmin-panel .ds-header{background:linear-gradient(115deg,#102439,#20384c);border-bottom:3px solid #ad8659}
#doctrina-superadmin-panel .ds-content{background:#f6f3ee}
#doctrina-superadmin-panel .ds-nav{border-bottom:1px solid #d8d3ca}
#doctrina-superadmin-panel .ds-nav button{color:#526174}
#doctrina-superadmin-panel .ds-nav button[aria-selected=true]{color:#78552e;border-bottom-color:#a47b4d}
#doctrina-superadmin-panel .ds-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:20px}
#doctrina-superadmin-panel .ds-kpi,#doctrina-superadmin-panel .ds-card{background:#fff;border:1px solid #e2ddd5;border-radius:12px;padding:22px;box-shadow:0 5px 22px #14253b0a}
#doctrina-superadmin-panel .ds-kpi span{color:#526174;font-size:12px}
#doctrina-superadmin-panel .ds-kpi strong{display:block;color:#173149;font:500 36px Georgia,serif;margin-top:9px}
#doctrina-superadmin-panel .ds-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}
#doctrina-superadmin-panel .ds-table{width:100%;border-collapse:collapse;font-size:13px}
#doctrina-superadmin-panel h3{font:600 19px Georgia,serif;color:#142a40}
#doctrina-superadmin-panel .ds-note,#doctrina-superadmin-panel .ds-activity,#doctrina-superadmin-panel .ds-activity time{color:#526174}
#doctrina-superadmin-panel label{color:#405369}
#doctrina-superadmin-panel input,#doctrina-superadmin-panel select,#doctrina-superadmin-panel textarea{background:#fff;color:#142a40;border-color:#cfc9c0}
#doctrina-superadmin-panel .ds-table td{border-bottom-color:#e7e2db}
#doctrina-superadmin-panel .ds-table th{text-align:left;color:#9bafc0;font-weight:600;border-bottom:1px solid #ffffff23;padding:10px 7px}
#doctrina-superadmin-panel .ds-table td{border-bottom:1px solid #ffffff13;padding:12px 7px;overflow-wrap:anywhere}
#doctrina-superadmin-panel .ds-chip{display:inline-block;border-radius:50px;padding:5px 9px;background:#1d5547;color:#b9f3dc;font-size:11px}
#doctrina-superadmin-panel .ds-chip.off{background:#473c35;color:#e7b9a3}
#doctrina-superadmin-panel label{display:block;color:#aebccc;font-size:12px;margin:14px 0 6px}
#doctrina-superadmin-panel input,#doctrina-superadmin-panel select,#doctrina-superadmin-panel textarea{width:100%;background:#0b1622;border:1px solid #425369;border-radius:9px;padding:12px;color:#fff;font:inherit}
#doctrina-superadmin-panel textarea{min-height:100px;resize:vertical}
#doctrina-superadmin-panel .ds-primary{background:linear-gradient(110deg,#c79d65,#e5c493);color:#152332;border:0;border-radius:9px;padding:12px 18px;font-weight:800;margin-top:14px}
#doctrina-superadmin-panel .ds-note{color:#9bafc0;font-size:12px;line-height:1.6}
#doctrina-superadmin-panel .ds-activity{padding:12px 0;border-bottom:1px solid #ffffff15;font-size:12px;line-height:1.5}
#doctrina-superadmin-panel .ds-activity time{color:#aebdca;display:block;margin-top:4px}
/* Final editorial overrides: only Doctrina Superadmin visual scope. */
#doctrina-superadmin-panel .ds-note,#doctrina-superadmin-panel .ds-activity,#doctrina-superadmin-panel .ds-activity time{color:#526174}
#doctrina-superadmin-panel label{color:#405369}
#doctrina-superadmin-panel input,#doctrina-superadmin-panel select,#doctrina-superadmin-panel textarea{background:#fff;color:#142a40;border-color:#cfc9c0}
#doctrina-superadmin-panel .ds-table th{color:#526174;border-bottom-color:#ddd6cd}
#doctrina-superadmin-panel .ds-table td,#doctrina-superadmin-panel .ds-activity{border-bottom-color:#e7e2db}
#doctrina-superadmin-panel :focus-visible{outline:2px solid #e8c18b;outline-offset:3px}
@media(max-width:680px){#doctrina-superadmin-panel .ds-header{padding:22px}#doctrina-superadmin-panel .ds-content{padding:20px}#doctrina-superadmin-panel .ds-kpis{grid-template-columns:1fr 1fr}#doctrina-superadmin-panel .ds-grid{grid-template-columns:1fr}#doctrina-superadmin-panel .ds-kpi strong{font-size:27px}}
`;
  const tab = document.createElement('button'); tab.id='doctrina-superadmin-tab'; tab.type='button'; tab.textContent='Superadmin'; tab.hidden=true; tab.setAttribute('aria-controls','doctrina-superadmin-panel'); tab.setAttribute('aria-expanded','false');
  const panel = document.createElement('aside'); panel.id='doctrina-superadmin-panel'; panel.hidden=true; panel.setAttribute('aria-label','Superadmin Doctrina');
  const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;};
  const header=el('header','ds-header');
  const brand=el('div');brand.append(el('p','ds-eyebrow','OFL 146 · Plataforma Doctrina'),el('h2','','Centro de administración'),el('p','ds-sub','Gobierno, accesos y trazabilidad institucional'));
  const close=el('button','ds-close','Cerrar ✕');close.type='button';close.setAttribute('aria-label','Cerrar panel');
  header.append(brand,close);
  const content=el('div','ds-content');const nav=el('nav','ds-nav');nav.setAttribute('aria-label','Secciones de administración');
  const views={};const buttons={};
  [['dashboard','Dashboard'],['users','Usuarios y permisos'],['audit','Auditoría']].forEach(([key,name])=>{
    const btn=el('button','',name);btn.type='button';btn.setAttribute('aria-selected',key==='dashboard'?'true':'false');nav.append(btn);buttons[key]=btn;
    const view=el('section');view.hidden=key!=='dashboard';views[key]=view;
    btn.addEventListener('click',()=>{Object.keys(views).forEach(k=>{views[k].hidden=k!==key;buttons[k].setAttribute('aria-selected',String(k===key));});});
  });
  const kpis=el('div','ds-kpis');
  const kpi=(label)=>{const card=el('article','ds-kpi');const value=el('strong','','—');card.append(el('span','',label),value);kpis.append(card);return value;};
  const totalKpi=kpi('Superadmins registrados'),activeKpi=kpi('Accesos activos'),auditKpi=kpi('Eventos recientes');
  const grid=el('div','ds-grid');const overview=el('article','ds-card');overview.append(el('h3','','Estado de la plataforma'),el('p','ds-note','Los indicadores muestran únicamente información real de las funciones administrativas autorizadas. No representan el total de miembros de Docencia.'));
  const recent=el('article','ds-card');recent.append(el('h3','','Actividad reciente'));const recentList=el('div');recent.append(recentList);grid.append(overview,recent);views.dashboard.append(kpis,grid);
  const userCard=el('article','ds-card');userCard.append(el('h3','','Administradores autorizados'));const list=el('div');userCard.append(list);
  const formCard=el('article','ds-card');formCard.append(el('h3','','Gestionar autorización'),el('p','ds-note','Solo cuentas verificadas en Supabase Auth. Los cambios requieren fundamento y confirmación.'));
  const form=el('form');const email=el('input');email.type='email';email.id='doctrina-admin-email';email.name='admin_email';email.required=true;email.autocomplete='off';
  const emailLabel=el('label','','Correo electrónico');emailLabel.append(email);
  const choice=el('select');choice.id='doctrina-admin-operation';choice.name='admin_operation';[['true','Activar acceso'],['false','Revocar acceso']].forEach(([v,t])=>{const o=el('option','',t);o.value=v;choice.append(o);});
  const choiceLabel=el('label','','Operación');choiceLabel.append(choice);
  const motive=el('textarea');motive.id='doctrina-admin-reason';motive.name='admin_reason';motive.required=true;motive.minLength=10;motive.maxLength=1000;
  const motiveLabel=el('label','','Fundamento documentado (mínimo 10 caracteres)');motiveLabel.append(motive);
  const apply=el('button','ds-primary','Confirmar operación');apply.type='submit';const feedback=el('p','ds-note');feedback.setAttribute('role','status');
  form.append(emailLabel,choiceLabel,motiveLabel,apply,feedback);formCard.append(form);
  const usersGrid=el('div','ds-grid');usersGrid.append(userCard,formCard);views.users.append(usersGrid);
  const auditCard=el('article','ds-card');auditCard.append(el('h3','','Bitácora de autorizaciones'));const audit=el('div');auditCard.append(audit);views.audit.append(auditCard);
  const reload=el('button','ds-secondary','↻ Actualizar datos');reload.type='button';reload.style.marginBottom='16px';
  content.append(nav,reload,views.dashboard,views.users,views.audit);panel.append(header,content);document.head.append(style);document.body.append(tab,panel);
  let authorizedClient=null;let generation=0;
  close.addEventListener('click',()=>{panel.hidden=true;tab.setAttribute('aria-expanded','false');tab.focus();});
  tab.addEventListener('click',()=>{if(tab.hidden)return;panel.hidden=false;tab.setAttribute('aria-expanded','true');close.focus();});
  document.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&!panel.hidden){panel.hidden=true;tab.setAttribute('aria-expanded','false');if(!tab.hidden)tab.focus();}});
  function resetAdmin(){generation++;authorizedClient=null;list.replaceChildren();audit.replaceChildren();recentList.replaceChildren();totalKpi.textContent=activeKpi.textContent=auditKpi.textContent='—';feedback.textContent='';}
  async function loadAdmin(){
    const client=authorizedClient;const current=generation;if(!client)return;
    reload.disabled=true;
    try{
      const [users,logs]=await Promise.all([client.rpc('doctrina_admin_listar'),client.rpc('doctrina_admin_auditoria')]);
      if(client!==authorizedClient||current!==generation)return;
      list.replaceChildren();audit.replaceChildren();recentList.replaceChildren();
      if(users.error||logs.error){feedback.textContent='Datos no disponibles: se requiere instalar y autorizar las funciones administrativas del servidor.';return;}
      const rows=Array.isArray(users.data)?users.data:[];const events=Array.isArray(logs.data)?logs.data:[];
      totalKpi.textContent=String(rows.length);activeKpi.textContent=String(rows.filter(x=>x.activo).length);auditKpi.textContent=String(events.length);
      const table=el('table','ds-table');const thead=el('thead');const headRow=el('tr');
      ['Cuenta','Estado'].forEach(t=>headRow.append(el('th','',t)));thead.append(headRow);const tbody=el('tbody');
      rows.forEach(u=>{const tr=el('tr');tr.append(el('td','',u.email||'Cuenta'));const td=el('td');td.append(el('span','ds-chip'+(u.activo?'':' off'),u.activo?'Activo':'Inactivo'));tr.append(td);tbody.append(tr);});
      table.append(thead,tbody);list.append(table);if(!rows.length)list.append(el('p','ds-note','Sin registros.'));
      events.forEach((a,i)=>{const line=el('div','ds-activity');line.append(el('strong','',a.accion||'Evento'),document.createTextNode(' · '+(a.motivo||'')));const when=el('time','',a.fecha?new Date(a.fecha).toLocaleString('es-CL'):'');line.append(when);audit.append(line);if(i<3)recentList.append(line.cloneNode(true));});
      if(!events.length){audit.append(el('p','ds-note','Sin eventos registrados.'));recentList.append(el('p','ds-note','Sin actividad reciente.'));}
      feedback.textContent='Datos actualizados.';
    }catch(_){if(current===generation)feedback.textContent='No fue posible recuperar la información.';}
    finally{if(current===generation)reload.disabled=false;}
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
  function hide() { revision += 1; tab.hidden = true; panel.hidden = true; tab.setAttribute('aria-expanded','false'); resetAdmin(); }
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
      authorizedClient=client;void loadAdmin();
      return true;
    } catch (_) { if (current === revision) hide(); return false; }
  }
  window.DoctrinaSuperadminShell=Object.freeze({
    refreshFromSupabase: refreshFromSupabase,
    hide: hide
  });
})();
