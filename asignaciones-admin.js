/* Asignación y correo bajo control exclusivo del Superadmin. */
(function(){
 let datos={usuarios:[],catalogo:[],asignaciones:[]},seleccion=null,ocupado=false,consulta=0,vista=null;
 const $=id=>document.getElementById(id);
 const estado=(texto,error=false)=>{const el=$('asignacionesEstado');if(el){el.textContent=texto;el.setAttribute('role',error?'alert':'status');}};
 const hoy=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 function mas21(fecha){const d=new Date(fecha+'T12:00:00Z');if(Number.isNaN(d.getTime()))return '';d.setUTCDate(d.getUTCDate()+21);return d.toISOString().slice(0,10);}
 const fecha=v=>v?new Date(v+'T12:00:00Z').toLocaleDateString('es-CL',{timeZone:'UTC'}):'—';
 const actual=()=>datos.asignaciones.find(a=>a.id===seleccion);
 function botones(){
  const vigente=actual()?.vigente===true;
  $('btnAsignarTrabajo').disabled=ocupado||!!seleccion;
  ['btnModificarAsignacion','btnEliminarAsignacion','btnCorreoAsignacion'].forEach(id=>$(id).disabled=ocupado||!vigente);
  $('asignacionCampos').disabled=ocupado;
  $('btnNuevaAsignacion').disabled=ocupado;
  $('btnActualizarAsignaciones').disabled=ocupado;
 }
 async function api(payload){
  const {data:{session}}=await sbApp.auth.getSession();
  if(!session?.access_token)throw new Error('La sesión venció. Inicie sesión nuevamente.');
  const r=await fetch('/api/admin-asignaciones',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify(payload),signal:AbortSignal.timeout(45000)});
  const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.error||'No se pudo completar la operación. Actualice antes de reintentar.');return d;
 }
 function opciones(){
  const usuario=$('asignacionUsuario'),tema=$('asignacionTema');
  const valorUsuario=usuario.value,valorTema=tema.value;
  usuario.replaceChildren(new Option('Seleccione un hermano',''));
  datos.usuarios.forEach(u=>usuario.add(new Option(u.nombre.toLocaleUpperCase('es-CL'),u.id)));
  usuario.value=valorUsuario;
  tema.replaceChildren(new Option('Seleccione un tema del programa',''));
  for(const area of datos.catalogo.filter(u=>tipoUnidadDocencia(u.codigo)==='area')){
   const grupo=document.createElement('optgroup');grupo.label=area.detalle;
   datos.catalogo.filter(t=>t.codigo.startsWith(area.codigo.slice(0,4))&&tipoUnidadDocencia(t.codigo)==='tema').forEach(t=>{
    const previa=datos.asignaciones.find(a=>a.vigente&&a.codigo===t.codigo);
    const opcion=new Option(t.codigo+' · '+t.detalle+(previa?' — Asignado a '+previa.nombre:''),t.codigo);
    opcion.disabled=!!previa&&previa.id!==seleccion;grupo.appendChild(opcion);
   });tema.appendChild(grupo);
  }
  tema.value=valorTema;
 }
 function contexto(){
  const codigo=$('asignacionTema').value;
  const item=c=>datos.catalogo.find(x=>x.codigo===c)?.detalle||'—';
  $('asignacionUnidad').textContent=codigo?item(codigo.slice(0,6)+'00'):'—';
  $('asignacionSubunidad').textContent=codigo?item(codigo.slice(0,7)+'0'):'—';
  $('asignacionCodigo').textContent=codigo||'—';
  const previa=datos.asignaciones.find(a=>a.vigente&&a.codigo===codigo);
  $('asignacionDisponibilidad').textContent=previa?'Asignado previamente a '+previa.nombre+(previa.id===seleccion?' (asignación seleccionada).':'.'):codigo?'Tema disponible para asignar.':'Los temas asignados se muestran deshabilitados e identifican al hermano responsable.';
 }
 function render(){
  opciones();const cuerpo=$('asignacionesBody');cuerpo.replaceChildren();
  const lista=datos.asignaciones.filter(a=>$('asignacionesVerAnuladas').checked||a.vigente);
  $('asignacionesConteo').textContent=datos.asignaciones.filter(a=>a.vigente).length+' asignaciones vigentes · '+datos.catalogo.filter(x=>tipoUnidadDocencia(x.codigo)==='tema').length+' temas en el catálogo';
  if(!lista.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.textContent='No hay asignaciones para mostrar.';tr.appendChild(td);cuerpo.appendChild(tr);}
  lista.forEach(a=>{
   const tr=document.createElement('tr');if(a.id===seleccion)tr.className='asignacion-seleccionada';
   const textos=[a.nombre,a.codigo+' · '+a.tema,fecha(a.fecha_asignacion),fecha(a.fecha_entrega)+' · 23:30',a.vigente?'Vigente':'Anulada'];
   textos.forEach((x,i)=>{const td=document.createElement('td');td.textContent=x;if(i===4){const s=document.createElement('small');s.className='asignacion-correo-estado';const c=a.correos?.[0];s.textContent=!c?'Sin correo enviado':c.estado==='enviado'?'Correo aceptado por SMTP':c.estado==='preparado'?'Envío en curso / por confirmar':'Correo sin confirmación';td.appendChild(s);}tr.appendChild(td);});
   const td=document.createElement('td'),b=document.createElement('button');b.type='button';b.className='admin-link-btn';b.textContent='Seleccionar';b.disabled=ocupado||!a.vigente;b.setAttribute('aria-label','Seleccionar '+a.codigo+' de '+a.nombre);b.onclick=()=>seleccionar(a.id);td.appendChild(b);tr.appendChild(td);cuerpo.appendChild(tr);
  });contexto();botones();
 }
 function seleccionar(id){
  seleccion=id;const a=actual();opciones();
  $('asignacionUsuario').value=a.usuario_id;$('asignacionTema').value=a.codigo;
  $('asignacionFecha').value=a.fecha_asignacion;$('asignacionEntrega').value=a.fecha_entrega;
  $('asignacionModo').textContent='Modificar asignación · '+a.codigo;
  render();estado('Asignación seleccionada. Modificar conserva la fecha de entrega salvo que usted la cambie.');
  $('asignacionUsuario').focus();
 }
 window.nuevaAsignacionDocente=function(){
  if(ocupado)return;seleccion=null;vista=null;
  $('asignacionForm').reset();$('asignacionFecha').value=hoy();$('asignacionEntrega').value=mas21(hoy());
  $('asignacionModo').textContent='Nueva asignación';render();
 };
 window.cargarAsignacionesAdmin=async function(){
  if(!usuarioActual?.es_admin)return;
  const n=++consulta;ocupado=true;botones();estado('Consultando padrón, catálogo y asignaciones…');
  try{
   const r=await api({action:'listar'});if(n!==consulta||!usuarioActual?.es_admin)return;
   datos=r.data;if(seleccion&&!actual()?.vigente)seleccion=null;
   opciones();render();if(!$('asignacionFecha').value&&!seleccion){$('asignacionFecha').value=hoy();$('asignacionEntrega').value=mas21(hoy());}
   estado('Asignaciones actualizadas. Guardar o modificar nunca envía correos.');
  }catch(e){if(n===consulta)estado(e.message,true);}
  finally{if(n===consulta){ocupado=false;botones();}}
 };
 async function guardar(action){
  if(ocupado)return;
  if(action!=='eliminar'&&!$('asignacionForm').reportValidity())return;
  const a=actual();if(action!=='crear'&&!a)return;
  if(action==='eliminar'&&!confirm('¿Anular esta asignación y liberar el tema? Se conservará el historial. No se enviará correo.'))return;
  ocupado=true;botones();estado('Guardando…');
  try{
   const r=await api({action,id:a?.id,version:a?.version,usuario_id:$('asignacionUsuario').value,codigo:$('asignacionTema').value,fecha_asignacion:$('asignacionFecha').value,fecha_entrega:$('asignacionEntrega').value});
   seleccion=r.data.vigente?r.data.id:null;
   await window.cargarAsignacionesAdmin();
   if(seleccion&&actual())seleccionar(seleccion);
   estado(action==='eliminar'?'Asignación anulada. Tema liberado; historial conservado.':'Asignación guardada. No se ha enviado ningún correo.');
  }catch(e){estado(e.message,true);}
  finally{ocupado=false;botones();}
 }
 window.guardarAsignacionDocente=()=>guardar('crear');
 window.modificarAsignacionDocente=()=>guardar('modificar');
 window.eliminarAsignacionDocente=()=>guardar('eliminar');
 window.recalcularEntregaAsignacion=function(){const f=$('asignacionFecha').value;if(f)$('asignacionEntrega').value=mas21(f);};
 window.cambioFechaAsignacion=function(){if(!seleccion)window.recalcularEntregaAsignacion();};
 window.cambioTemaAsignacion=contexto;
 window.renderizarAsignacionesDocentes=render;
 window.abrirCorreoAsignacion=async function(){
  if(ocupado||!actual())return;ocupado=true;botones();estado('Preparando vista previa del correo…');
  try{
   const a=actual(),r=await api({action:'vista_correo',id:a.id,version:a.version});
   if(!usuarioActual?.es_admin)return;
   vista={...r,id:a.id,version:a.version,intento:crypto.randomUUID()};
   $('correoAsignacionDestino').textContent=r.correo.to;
   $('correoAsignacionAsunto').textContent=r.correo.subject;
   $('correoAsignacionVista').srcdoc=r.correo.html;
   $('correoAsignacionReenvio').checked=false;
   const pendiente=r.asignacion.correos.find(c=>c.estado==='preparado');
   $('correoAsignacionReenvioLabel').hidden=!r.asignacion.correos.length;
   $('btnEnviarCorreoAsignacion').disabled=!!pendiente;
   $('btnCerrarIntentoAsignacion').hidden=!pendiente;
   $('correoAsignacionEstado').textContent=pendiente?'Hay un intento pendiente. Revise si llegó antes de habilitar un nuevo envío.':r.asignacion.correos.length?'Ya hubo un intento. Para reenviar, marque expresamente la casilla.':'Vista previa. El correo solo se enviará al pulsar Enviar correo.';
   $('dialogCorreoAsignacion').showModal();estado('Vista previa preparada. Todavía no se ha enviado correo.');
  }catch(e){estado(e.message,true);}finally{ocupado=false;botones();}
 };
 window.enviarCorreoAsignacion=async function(){
  if(ocupado||!vista)return;
  const previo=vista.asignacion.correos.length>0;
  if(previo&&!$('correoAsignacionReenvio').checked){$('correoAsignacionEstado').textContent='Debe confirmar expresamente el reenvío.';return;}
  ocupado=true;botones();$('btnEnviarCorreoAsignacion').disabled=true;$('btnCerrarCorreoAsignacion').disabled=true;
  const v=vista;let mensaje='';
  try{const r=await api({action:'enviar',id:v.id,version:v.version,intento:v.intento,reenviar:previo,confirmado:true});mensaje=r.mensaje;}
  catch(e){mensaje=e.message;}
  finally{
   vista=null;$('dialogCorreoAsignacion').close();$('correoAsignacionVista').srcdoc='';
   $('btnCerrarCorreoAsignacion').disabled=false;ocupado=false;
   await window.cargarAsignacionesAdmin();estado(mensaje,true);
  }
 };
 window.cerrarIntentoCorreoAsignacion=async function(){
  if(ocupado||!vista)return;
  const c=vista.asignacion.correos.find(x=>x.estado==='preparado');
  if(!c||!confirm('¿Revisó si el correo fue recibido? Se marcará este intento como SIN CONFIRMAR. Esto no enviará otro correo.'))return;
  ocupado=true;$('btnCerrarIntentoAsignacion').disabled=true;
  try{await api({action:'cerrar_intento',id:vista.id,version:vista.version,intento:c.id,confirmado:true});$('dialogCorreoAsignacion').close();vista=null;await window.cargarAsignacionesAdmin();estado('Intento marcado sin confirmar. Un reenvío requiere abrir Correo y confirmarlo expresamente.');}
  catch(e){$('correoAsignacionEstado').textContent=e.message;}
  finally{ocupado=false;$('btnCerrarIntentoAsignacion').disabled=false;botones();}
 };
 window.cerrarCorreoAsignacion=function(){if(!ocupado){$('dialogCorreoAsignacion').close();$('correoAsignacionVista').srcdoc='';vista=null;}};
 window.limpiarAsignacionesAdmin=function(){
  ++consulta;datos={usuarios:[],catalogo:[],asignaciones:[]};seleccion=null;vista=null;ocupado=false;
  $('dialogCorreoAsignacion')?.close();if($('correoAsignacionVista'))$('correoAsignacionVista').srcdoc='';
  for(const id of ['asignacionesBody','asignacionUsuario','asignacionTema'])$(id)?.replaceChildren();
  if($('asignacionForm'))$('asignacionForm').reset();
 };
 document.addEventListener('DOMContentLoaded',()=>{
  $('dialogCorreoAsignacion')?.addEventListener('cancel',e=>{if(ocupado)e.preventDefault();else window.cerrarCorreoAsignacion();});
 });
})();
