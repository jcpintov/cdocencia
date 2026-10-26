(function(){
 const $=id=>document.getElementById(id);let vista=null,ocupado=false,version=0,personalizado=false,sucio=false;
 const mensaje=t=>$('inventarioEstado').textContent=t;
 async function api(body){const {data:{session}}=await sbApp.auth.getSession();if(!session?.access_token)throw Error('Sesión vencida');const r=await fetch('/api/admin-trabajos',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});const d=await r.json();if(!r.ok)throw Error(d.error||d.mensaje||'No se pudo completar la operación');return d;}
 function bloquear(v){ocupado=v;$('inventarioExclusiones').querySelectorAll('input').forEach(c=>c.disabled=v);for(const id of ['inventarioAsunto','inventarioTexto'])$(id).disabled=v;}
 function mostrar(r){vista=r;sucio=false;$('inventarioAsunto').value=r.correo.subject;$('inventarioTexto').value=r.correo.text;$('inventarioVista').srcdoc=r.correo.html;$('inventarioResumen').textContent=r.correo.subject+' · '+r.trabajos.length+' trabajos · '+r.correo.bcc.length+' casillas en copia oculta · Remitente: '+r.correo.from+' · Excluidos: '+(r.excluidos.map(x=>x.nombre).join(', ')||'ninguno');$('inventarioEnviar').disabled=false;mensaje('Vista previa preparada. Todavía no se ha enviado correo.');}
 window.marcarEdicionInventario=function(){personalizado=true;sucio=true;$('inventarioEnviar').disabled=true;mensaje('Hay cambios sin aplicar. Aplique los cambios a la vista previa antes de enviar.');};
 window.abrirInventarioTrabajos=async function(){
  if(ocupado)return;vista=null;personalizado=false;sucio=false;const n=++version;$('inventarioEnviar').disabled=true;$('inventarioVista').srcdoc='';$('inventarioExclusiones').replaceChildren();$('inventarioAsunto').value='';$('inventarioTexto').value='';$('inventarioDialog').showModal();bloquear(true);mensaje('Consultando padrón y trabajos disponibles…');
  try{const r=await api({action:'inventario_preparar',id:crypto.randomUUID(),excluir_ids:[]});if(n!==version||!usuarioActual)return;
   for(const u of r.destinatarios){const label=document.createElement('label'),c=document.createElement('input');c.type='checkbox';c.value=u.id;c.disabled=true;c.setAttribute('aria-label','Excluir a '+u.nombre);c.onchange=()=>{vista=null;$('inventarioEnviar').disabled=true;mensaje('Cambió la selección. Actualice la vista previa.');};label.append(c,document.createTextNode(' '+u.nombre));$('inventarioExclusiones').appendChild(label);}
   mostrar(r);
  }catch(e){if(n===version)mensaje(e.message);}finally{if(n===version)bloquear(false);}
 };
 window.actualizarInventarioTrabajos=async function(){
  if(ocupado)return;const asunto=$('inventarioAsunto').value,texto=$('inventarioTexto').value,conservar=personalizado;bloquear(true);vista=null;const n=++version;$('inventarioEnviar').disabled=true;mensaje('Actualizando vista previa…');
  try{let r=await api({action:'inventario_preparar',id:crypto.randomUUID(),excluir_ids:[...$('inventarioExclusiones').querySelectorAll('input:checked')].map(c=>c.value)});if(n!==version||!usuarioActual)return;if(conservar)r=await api({action:'inventario_editar',id:r.id,asunto,texto});if(n===version&&usuarioActual)mostrar(r);}catch(e){if(n===version)mensaje(e.message);}finally{if(n===version)bloquear(false);}
 };
 window.aplicarEdicionInventario=async function(){
  if(ocupado)return;if(!vista){mensaje('Actualice la vista previa para confirmar primero los destinatarios.');return;}const id=vista.id,n=++version;bloquear(true);$('inventarioEnviar').disabled=true;mensaje('Aplicando cambios a la vista previa…');
  try{const r=await api({action:'inventario_editar',id,asunto:$('inventarioAsunto').value,texto:$('inventarioTexto').value});if(n===version&&usuarioActual)mostrar(r);}catch(e){if(n===version)mensaje(e.message);}finally{if(n===version)bloquear(false);}
 };
 window.enviarInventarioTrabajos=async function(){
  if(ocupado||!vista||sucio)return;if(!confirm('¿Enviar el inventario aprobado a '+vista.correo.bcc.length+' casillas en copia oculta?'))return;bloquear(true);const id=vista.id,n=version;vista=null;$('inventarioEnviar').disabled=true;mensaje('Enviando. No cierre esta ventana ni repita la operación.');
  try{const r=await api({action:'inventario_enviar',id,confirmado:true});if(n===version&&usuarioActual)mensaje(r.mensaje+' Casillas aceptadas: '+r.aceptados+'.');}catch(e){if(n===version)mensaje(e.message);}finally{if(n===version)bloquear(false);}
 };
 window.limpiarInventarioTrabajos=function(){++version;vista=null;ocupado=false;personalizado=false;sucio=false;$('inventarioDialog')?.close();for(const id of ['inventarioAsunto','inventarioTexto'])if($(id))$(id).value='';if($('inventarioVista'))$('inventarioVista').srcdoc='';$('inventarioExclusiones')?.replaceChildren();};
 window.cerrarInventarioTrabajos=function(){if(!ocupado)window.limpiarInventarioTrabajos();};
 document.addEventListener('DOMContentLoaded',()=>$('inventarioDialog')?.addEventListener('cancel',e=>{e.preventDefault();window.cerrarInventarioTrabajos();}));
})();
