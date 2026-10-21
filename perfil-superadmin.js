(function(){
 const $=id=>document.getElementById(id);let solicitud=null,version=0,ocupado=false;
 window.cerrarPerfilSuperadmin=()=>{version++;solicitud=null;$('perfilSuperadminCodigo').value='';$('perfilSuperadminNombre').value='';$('perfilSuperadminEmail').value='';$('perfilSuperadminEstado').textContent='';$('perfilSuperadminDialogo').close();};
 window.abrirPerfilSuperadmin=async()=>{
  if(!usuarioActual?.es_admin)return;solicitud=null;version++;
  $('perfilSuperadminNombre').value=usuarioActual.nombre||'';$('perfilSuperadminEmail').value=usuarioActual.email||'';
  $('perfilSuperadminNombre').disabled=false;$('perfilSuperadminEmail').disabled=false;
  $('perfilSuperadminCodigo').value='';$('perfilSuperadminEstado').textContent='';$('perfilSuperadminRecuperar').hidden=true;
  $('perfilSuperadminDialogo').showModal();
  await window.accionPerfilSuperadmin('pendiente');
 };
 window.accionPerfilSuperadmin=async action=>{
  if(ocupado||!usuarioActual?.es_admin)return;
  if(!['solicitar','pendiente'].includes(action)&&!solicitud){$('perfilSuperadminEstado').textContent='Solicite primero un código.';return;}
  if(action==='solicitar'&&(!String($('perfilSuperadminNombre').value).trim()||!$('perfilSuperadminEmail').checkValidity()))return;
  const actor=usuarioActual.id,revision=version;ocupado=true;
  const botones=[...$('perfilSuperadminDialogo').querySelectorAll('button')];botones.forEach(b=>b.disabled=true);
  try{
   const {data:{session}}=await sbApp.auth.getSession();if(!session?.access_token)throw Error('Sesión vencida');
   const r=await fetch('/api/admin-perfil',{method:'POST',signal:AbortSignal.timeout?.(45000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({action,id:solicitud,nombre:$('perfilSuperadminNombre').value,email:$('perfilSuperadminEmail').value,codigo:$('perfilSuperadminCodigo').value})});
   const d=await r.json();if(version!==revision||usuarioActual?.id!==actor)return;
   if(!r.ok||!d.ok){$('perfilSuperadminRecuperar').hidden=!d.recuperable;throw Error(d.error||'No se pudo completar el cambio');}
   if(action==='pendiente'){if(d.pendiente){solicitud=d.id;$('perfilSuperadminNombre').value=d.nombre;$('perfilSuperadminEmail').value=d.email_nuevo;$('perfilSuperadminNombre').disabled=true;$('perfilSuperadminEmail').disabled=true;$('perfilSuperadminRecuperar').hidden=d.estado==='enviado';$('perfilSuperadminEstado').textContent=d.estado==='enviado'?'Existe una solicitud pendiente. Ingrese el código enviado al correo anterior.':'Existe un cambio ya autorizado pendiente de completar. Use Recuperar cambio pendiente.';}return;}
   if(action==='solicitar'){solicitud=d.id;$('perfilSuperadminNombre').disabled=true;$('perfilSuperadminEmail').disabled=true;$('perfilSuperadminEstado').textContent=d.mensaje;}
   else{usuarioActual.nombre=d.nombre;usuarioActual.email=d.email;sessionStorage.setItem('camara_usuario_sesion',JSON.stringify(usuarioActual));$('perfilSuperadminCodigo').value='';solicitud=null;$('perfilSuperadminNombre').disabled=false;$('perfilSuperadminEmail').disabled=false;$('perfilSuperadminEstado').textContent='Perfil actualizado. Su identidad y permisos de Superadmin se conservan.';try{await sbApp.auth.refreshSession();}catch{}}
  }catch(e){if(version===revision)$('perfilSuperadminEstado').textContent=(e.name==='AbortError'||e.name==='TimeoutError')?'La conexión se interrumpió. Cierre y vuelva a abrir Mi perfil para recuperar la solicitud antes de repetir el cambio.':e.message;}
  finally{ocupado=false;botones.forEach(b=>b.disabled=false);}
 };
 $('perfilSuperadminDialogo').addEventListener('cancel',e=>{e.preventDefault();if(!ocupado)window.cerrarPerfilSuperadmin();});
})();
