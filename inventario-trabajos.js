(function(){
 const $=id=>document.getElementById(id);let vista=null,ocupado=false,version=0;
 async function api(body){const {data:{session}}=await sbApp.auth.getSession();if(!session?.access_token)throw Error('Sesión vencida');const r=await fetch('/api/admin-trabajos',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});const d=await r.json();if(!r.ok)throw Error(d.error||d.mensaje||'No se pudo completar la operación');return d;}
 const mensaje=t=>$('inventarioEstado').textContent=t;
 const bloquearSeleccion=v=>$('inventarioExclusiones').querySelectorAll('input').forEach(c=>c.disabled=v);
 window.abrirInventarioTrabajos=async function(){
  if(ocupado)return;vista=null;const n=++version;$('inventarioEnviar').disabled=true;$('inventarioVista').srcdoc='';$('inventarioExclusiones').replaceChildren();$('inventarioDialog').showModal();ocupado=true;mensaje('Consultando padrón y trabajos disponibles…');
  try{const r=await api({action:'inventario_preparar',id:crypto.randomUUID(),excluir_ids:[]});if(n!==version||!usuarioActual)return;
   for(const u of r.destinatarios){const label=document.createElement('label'),c=document.createElement('input');c.type='checkbox';c.value=u.id;c.setAttribute('aria-label','Excluir a '+u.nombre);c.onchange=()=>{vista=null;$('inventarioEnviar').disabled=true;mensaje('Cambió la selección. Actualice la vista previa.');};label.append(c,document.createTextNode(' '+u.nombre));$('inventarioExclusiones').appendChild(label);}
   mostrar(r);
  }catch(e){if(n===version)mensaje(e.message);}finally{if(n===version)ocupado=false;}
 };
 function mostrar(r){vista=r;$('inventarioVista').srcdoc=r.correo.html;$('inventarioResumen').textContent=r.correo.subject+' · '+r.trabajos.length+' trabajos · '+r.correo.bcc.length+' casillas en copia oculta · Remitente: '+r.correo.from+' · Excluidos: '+(r.excluidos.map(x=>x.nombre).join(', ')||'ninguno');$('inventarioEnviar').disabled=false;mensaje('Vista previa preparada. Todavía no se ha enviado correo.');}
 window.actualizarInventarioTrabajos=async function(){if(ocupado)return;ocupado=true;bloquearSeleccion(true);vista=null;const n=++version;$('inventarioEnviar').disabled=true;mensaje('Actualizando vista previa…');try{const r=await api({action:'inventario_preparar',id:crypto.randomUUID(),excluir_ids:[...$('inventarioExclusiones').querySelectorAll('input:checked')].map(c=>c.value)});if(n===version&&usuarioActual)mostrar(r);}catch(e){if(n===version)mensaje(e.message);}finally{if(n===version){ocupado=false;bloquearSeleccion(false);}}};
 window.enviarInventarioTrabajos=async function(){if(ocupado||!vista)return;if(!confirm('¿Enviar el inventario aprobado a '+vista.correo.bcc.length+' casillas en copia oculta?'))return;ocupado=true;bloquearSeleccion(true);const id=vista.id;vista=null;$('inventarioEnviar').disabled=true;mensaje('Enviando. No cierre esta ventana ni repita la operación.');try{const r=await api({action:'inventario_enviar',id,confirmado:true});mensaje(r.mensaje+' Casillas aceptadas: '+r.aceptados+'.');}catch(e){mensaje(e.message);}finally{ocupado=false;bloquearSeleccion(false);}};
 window.cerrarInventarioTrabajos=function(){if(ocupado)return;++version;vista=null;$('inventarioDialog').close();$('inventarioVista').srcdoc='';$('inventarioExclusiones').replaceChildren();};
 window.limpiarInventarioTrabajos=function(){++version;vista=null;ocupado=false;$('inventarioDialog')?.close();if($('inventarioVista'))$('inventarioVista').srcdoc='';$('inventarioExclusiones')?.replaceChildren();};
 document.addEventListener('DOMContentLoaded',()=>$('inventarioDialog')?.addEventListener('cancel',e=>{e.preventDefault();window.cerrarInventarioTrabajos();}));
})();
