let cambioRolPendiente=null;
function limpiarRolesAdmin(){cambioRolPendiente=null;const d=document.getElementById('cambioRolDialogo');if(d){d.close();document.getElementById('cambioRolUsuario').textContent='';document.getElementById('cambioRolMotivo').value='';document.getElementById('cambioRolEstado').textContent='';}}
function abrirCambioRol(id,rol){
 if(!esSuperadminSesion())return;
 const u=padronUsuariosAdmin.find(x=>x.id===id);
 if(!u||u.rol==='SUPERADMIN'||!u.auth_user_id)return;
 cambioRolPendiente={id,rol,rol_actual:u.rol||'USER',actor:usuarioActual.id};
 let d=document.getElementById('cambioRolDialogo');
 if(!d){d=document.createElement('dialog');d.id='cambioRolDialogo';d.setAttribute('aria-labelledby','cambioRolTitulo');d.innerHTML='<h2 id="cambioRolTitulo">Cambiar rol</h2><p id="cambioRolUsuario"></p><p>Administrador puede gestionar usuarios y docencia. Los roles, las cuentas administrativas y la configuración de seguridad pertenecen a Superadmin.</p><label for="cambioRolMotivo">Motivo del cambio</label><textarea id="cambioRolMotivo" minlength="5" maxlength="500"></textarea><p id="cambioRolEstado" role="status" aria-live="polite"></p><div class="doctrina-acciones"><button id="cambioRolCancelar" type="button" class="btn-secondary">Cancelar</button><button id="cambioRolGuardar" type="button" class="btn-primary">Confirmar cambio</button></div>';document.body.appendChild(d);document.getElementById('cambioRolCancelar').onclick=()=>{cambioRolPendiente=null;d.close();};document.getElementById('cambioRolGuardar').onclick=guardarCambioRol;}
 document.getElementById('cambioRolUsuario').textContent=u.nombre+' · '+u.email+' → '+(rol==='ADMIN'?'Administrador':'Usuario');
 document.getElementById('cambioRolMotivo').value='';document.getElementById('cambioRolEstado').textContent='';d.showModal();
}
async function guardarCambioRol(){
 const c=cambioRolPendiente;if(!c||!esSuperadminSesion()||usuarioActual.id!==c.actor)return;
 const motivo=document.getElementById('cambioRolMotivo').value.trim(),estado=document.getElementById('cambioRolEstado'),b=document.getElementById('cambioRolGuardar');
 if(motivo.length<5||motivo.length>500){estado.textContent='Ingrese un motivo de 5 a 500 caracteres.';return;}
 b.disabled=true;
 try{
  const {data,error}=await sbApp.auth.getSession();if(error||!data?.session?.access_token)throw new Error('Sesión no disponible');
  if(cambioRolPendiente!==c||usuarioActual?.id!==c.actor)return;
  const r=await fetch('/api/admin-roles',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({id:c.id,rol:c.rol,rol_actual:c.rol_actual,motivo})});
  const resultado=await r.json();if(!r.ok||!resultado.ok)throw new Error(resultado.error||'No se pudo cambiar el rol');
  if(usuarioActual?.id!==c.actor)return;
  cambioRolPendiente=null;document.getElementById('cambioRolDialogo').close();await cargarListadoUsuariosAdmin();
 }catch(e){if(usuarioActual?.id===c.actor)estado.textContent=e.message;}
 finally{b.disabled=false;}
}
