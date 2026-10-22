/* Solicitud manual y seguimiento del recordatorio automático. */
(function(){
 let datos={usuarios:[],catalogo:[],asignaciones:[]},seleccion=null,ocupado=false,consulta=0,vista=null,datosCargados=false;
 const $=id=>document.getElementById(id);
 const estado=(texto,error=false)=>{for(const id of ['asignacionesEstado','asignacionModalEstado']){const el=$(id);if(el){el.textContent=texto;el.setAttribute('role',error?'alert':'status');}}};
 const hoy=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 function mas21(fecha){const d=new Date(fecha+'T12:00:00Z');if(Number.isNaN(d.getTime()))return '';d.setUTCDate(d.getUTCDate()+21);return d.toISOString().slice(0,10);}
 const fecha=v=>v?new Date(v+'T12:00:00Z').toLocaleDateString('es-CL',{timeZone:'UTC'}):'—';
 const actual=()=>datos.asignaciones.find(a=>a.id===seleccion);
 const instante=v=>v?new Date(v).toLocaleString('es-CL',{timeZone:'America/Santiago',dateStyle:'long',timeStyle:'short'}):'—';
 const estadosRecordatorio={sin_solicitud:'No programado: falta un correo de solicitud confirmado.',solicitud_pendiente:'En espera: hay una solicitud en curso o sin confirmar.',programado:'Programado para la primera revisión diaria después de cumplir siete días de atraso.',pendiente:'Plazo cumplido. Se revisará en la próxima ejecución diaria.',publicado:'Sin recordatorio: el tema ya está publicado en Docencia.',preparado:'Recordatorio reservado. Si este estado persiste, revise antes de intervenir.',enviando:'Envío en curso o por confirmar. No se repetirá automáticamente.',enviado:'Recordatorio aceptado por el servidor de correo.',incierto:'Envío sin confirmación. Revise el buzón; no se repetirá automáticamente.',cancelado:'Recordatorio cancelado antes del envío por cambio de condiciones.',anulada:'Asignación anulada. No se enviará recordatorio.'};
 function seguimiento(){
  const a=actual(),r=a?.recordatorio;
  $('asignacionRecordatorioPanel').hidden=!a;
  $('btnRevisarRecordatorioAsignacion').hidden=!a||!['preparado','enviando'].includes(r?.estado);
  $('opcionesAsignacionTitulo').textContent=a?'Opciones · '+a.codigo+' · '+a.nombre:'Nueva asignación';
  if(!a)return;
  $('asignacionRecordatorioEstado').textContent=estadosRecordatorio[r?.estado]||'Actualice para consultar el seguimiento.';
  $('asignacionSolicitudEnviada').textContent=instante(r?.solicitud_enviada_en);
  $('asignacionRecordatorioFecha').textContent=instante(r?.programado_para);
  $('asignacionRecordatorioResultado').textContent=r?.finalizado_en?instante(r.finalizado_en)+(r.copia_estado==='aceptada'?' · CCO aceptada':r.estado==='enviado'?' · CCO sin confirmar':''):'Sin envío finalizado';
  const avisos=a.avisos_publicacion||[],aviso=avisos[0];
  const estadosAviso={pendiente:'Aviso al autor pendiente de envío automático.',preparado:'Aviso al autor reservado.',enviando:'Aviso al autor en curso o por confirmar.',enviado:'Aviso de publicación enviado al autor.',incierto:'Aviso al autor sin confirmación. No se repetirá automáticamente.',cancelado:'Aviso al autor cancelado por cambio de condiciones.'};
  $('asignacionPublicacionAviso').textContent=aviso?(estadosAviso[aviso.estado]||aviso.estado)+(aviso.finalizado_en?' '+instante(aviso.finalizado_en):'')+(aviso.copia_estado==='aceptada'?' · CCO aceptada':''):'El aviso de publicación se registra al publicar un trabajo asignado cuyo autor coincide inequívocamente con el padrón.';
  $('asignacionPublicacionEstado').textContent=r?.publicado?'Publicado: '+(r.trabajos_publicados||[]).map(m=>m.titulo).join('; '):'Tema pendiente de publicación en Docencia.';
 }
 async function vistaRecordatorio(){
  const a=actual();if(!a)return;
  $('asignacionRecordatorioVista').srcdoc='';
  $('asignacionRecordatorioPreviewEstado').textContent='Preparando texto…';
  try{const r=await api({action:'vista_recordatorio',id:a.id,version:a.version});
   if(!usuarioActual?.es_admin||seleccion!==a.id||actual()?.version!==a.version)return;
   const i=datos.asignaciones.findIndex(x=>x.id===a.id);datos.asignaciones[i]=r.asignacion;seguimiento();
   $('asignacionRecordatorioVista').srcdoc=r.correo?.html||'';
   $('asignacionRecordatorioVista').hidden=!r.correo;
   $('asignacionRecordatorioPreviewEstado').textContent=r.correo?'Texto que utilizará el envío automático si se mantienen las condiciones.':'La vista previa estará disponible después de enviar la solicitud inicial.';
  }catch(e){if(seleccion===a.id)$('asignacionRecordatorioPreviewEstado').textContent=e.message;}
 }

 function estadoTrabajo(a){
  if(a.recordatorio?.publicado)return 'Publicado';
  return a.fecha_entrega<=hoy()?'Vencido':'Pendiente';
 }
 function fechaSubida(a){
  return Math.max(0,...(a.recordatorio?.trabajos_publicados||[]).map(m=>Date.parse(m.fecha_subida)||0));
 }
 function ordenarAsignaciones(a,b){
  if(a.vigente!==b.vigente)return a.vigente?-1:1;
  const publicadoA=!!a.recordatorio?.publicado,publicadoB=!!b.recordatorio?.publicado;
  if(publicadoA!==publicadoB)return publicadoA?1:-1;
  return (publicadoA?fechaSubida(b)-fechaSubida(a):a.fecha_entrega.localeCompare(b.fecha_entrega))||a.nombre.localeCompare(b.nombre,'es')||a.codigo.localeCompare(b.codigo);
 }
 window.renderizarCronogramaAdmin=function(){
  const lista=$('cronogramaLista');if(!lista)return;lista.replaceChildren();
  const todas=datos.asignaciones.filter(a=>a.vigente),pendientes=todas.filter(a=>estadoTrabajo(a)!=='Publicado');
  for(const [id,n] of [['kpiTrabajosAsignados',todas.length],['kpiTrabajosPendientes',pendientes.length],['kpiTrabajosVencidos',todas.filter(a=>estadoTrabajo(a)==='Vencido').length],['kpiTrabajosPublicados',todas.length-pendientes.length]])$(id).textContent=datosCargados?String(n):'—';
  // Resumen Ejecutivo: entregado equivale a publicado, sin estados duplicados.
  const entregados=todas.filter(a=>a.recordatorio?.publicado===true).length;
  for(const [id,n] of [['kpiResumenAsignados',todas.length],['kpiResumenEntregados',entregados],['kpiResumenPendientes',todas.length-entregados]]){
   const campo=$(id);if(campo)campo.textContent=datosCargados?n.toLocaleString('es-CL'):'—';
  }
  const filtro=$('cronogramaFiltro').value,fechaHoy=hoy(),limite=new Date(fechaHoy+'T12:00:00Z');limite.setUTCDate(limite.getUTCDate()+7);
  const fin=limite.toISOString().slice(0,10);
  const visibles=todas.filter(a=>filtro==='todos'||filtro==='publicados'&&estadoTrabajo(a)==='Publicado'||filtro==='vencidos'&&estadoTrabajo(a)==='Vencido'||filtro==='proximos'&&estadoTrabajo(a)!=='Publicado'&&a.fecha_entrega>=fechaHoy&&a.fecha_entrega<=fin).sort(ordenarAsignaciones);
  visibles.forEach(a=>{
   const li=document.createElement('li'),estadoActual=estadoTrabajo(a);li.className='cronograma-item cronograma-'+estadoActual.toLowerCase();
   const fechaEl=document.createElement('time');fechaEl.dateTime=a.fecha_entrega;fechaEl.textContent=fecha(a.fecha_entrega)+' · 23:30 h';li.appendChild(fechaEl);
   const bloque=document.createElement('div'),titulo=document.createElement('h3');titulo.textContent=a.codigo+' · '+a.tema;bloque.appendChild(titulo);
   const persona=document.createElement('p');persona.textContent=a.nombre;bloque.appendChild(persona);
   const fechas=document.createElement('p');fechas.className='cronograma-meta';fechas.textContent='Asignación: '+fecha(a.fecha_asignacion)+' · Entrega: '+fecha(a.fecha_entrega);bloque.appendChild(fechas);
   if(fechaSubida(a)){const subida=document.createElement('p');subida.className='cronograma-meta';subida.textContent='Subido: '+instante(new Date(fechaSubida(a)).toISOString());bloque.appendChild(subida);}
   const avance=document.createElement('progress'),inicio=Date.parse(a.fecha_asignacion+'T00:00:00Z'),duracion=Math.max(86400000,Date.parse(a.fecha_entrega+'T00:00:00Z')-inicio);
   avance.max=100;avance.value=Math.max(0,Math.min(100,Math.round((Date.parse(fechaHoy+'T00:00:00Z')-inicio)/duracion*100)));avance.setAttribute('aria-label','Plazo transcurrido para '+a.codigo);bloque.appendChild(avance);
   const estadoEl=document.createElement('p');estadoEl.className='cronograma-meta';estadoEl.textContent=estadoActual+' · '+(estadosRecordatorio[a.recordatorio?.estado]||'Seguimiento automático')+(a.avisos_publicacion?.[0]?' · Aviso de publicación: '+a.avisos_publicacion[0].estado:'');bloque.appendChild(estadoEl);li.appendChild(bloque);
   const b=document.createElement('button');b.type='button';b.className='admin-link-btn';b.textContent='Ver opciones';b.setAttribute('aria-label','Abrir opciones de '+a.codigo+' de '+a.nombre);b.disabled=ocupado;b.onclick=()=>seleccionar(a.id);li.appendChild(b);lista.appendChild(li);
  });
  $('cronogramaEstado').textContent=!datosCargados?'Sin datos actualizados. Pulse Actualizar cronograma.':!todas.length?'Todavía no hay trabajos asignados.':!visibles.length?'No hay trabajos que coincidan con este filtro.':visibles.length+' trabajos · actualizado '+new Date().toLocaleTimeString('es-CL',{timeZone:'America/Santiago',hour:'2-digit',minute:'2-digit'});
 };
 window.notificarPublicacionesAdmin=async function(){
  if(!usuarioActual?.es_admin)return;
  try{await api({action:'procesar_publicaciones'});}catch{estado('Publicación guardada. El aviso al autor permanece registrado para la revisión automática.');}
 };
 window.cargarCronogramaAdmin=()=>window.cargarAsignacionesAdmin();
 function botones(){
  const vigente=actual()?.vigente===true;
  $('btnAsignarTrabajo').disabled=ocupado||!!seleccion;
  ['btnModificarAsignacion','btnEliminarAsignacion','btnCorreoAsignacion'].forEach(id=>$(id).disabled=ocupado||!vigente);
  $('asignacionCampos').disabled=ocupado;
  $('btnNuevaAsignacion').disabled=ocupado;
  $('btnActualizarAsignaciones').disabled=ocupado;
  $('btnAbrirNuevaAsignacion').disabled=ocupado;
  document.querySelectorAll('#asignacionesBody button[data-vigente]').forEach(b=>b.disabled=ocupado||b.dataset.vigente!=='true');
  $('btnCerrarOpcionesAsignacion').disabled=ocupado;
  $('btnAsignarTrabajo').hidden=!!seleccion;
  ['btnModificarAsignacion','btnEliminarAsignacion','btnCorreoAsignacion'].forEach(id=>$(id).hidden=!seleccion);
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
  const filtro=$('asignacionesEstadoFiltro')?.value||'todos';
  const vigentes=datos.asignaciones.filter(a=>a.vigente);
  const lista=datos.asignaciones.filter(a=>{
   if(filtro==='entregados')return a.vigente&&estadoTrabajo(a)==='Publicado';
   if(filtro==='pendientes')return a.vigente&&estadoTrabajo(a)!=='Publicado';
   return a.vigente||$('asignacionesVerAnuladas').checked;
  }).sort(ordenarAsignaciones);
  $('asignacionesConteo').textContent=lista.length+' de '+vigentes.length+' asignaciones vigentes'+
   (filtro==='entregados'?' · entregadas/publicadas':filtro==='pendientes'?' · pendientes de publicación':' · todas')+
   ' · '+datos.catalogo.filter(x=>tipoUnidadDocencia(x.codigo)==='tema').length+' temas del catálogo';
  if(!lista.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;
   td.textContent=filtro==='entregados'?'Todavía no hay asignaciones entregadas y publicadas.':filtro==='pendientes'?'No quedan trabajos pendientes de publicación.':'No hay asignaciones para mostrar.';
   tr.appendChild(td);cuerpo.appendChild(tr);}
  lista.forEach(a=>{
   const tr=document.createElement('tr');tr.className='asignacion-fila asignacion-'+(a.vigente?estadoTrabajo(a).toLowerCase():'anulada');if(a.id===seleccion)tr.classList.add('asignacion-seleccionada');
   const textos=[a.nombre,a.codigo+' · '+a.tema,fecha(a.fecha_asignacion),fecha(a.fecha_entrega)+' · 23:30',a.vigente?estadoTrabajo(a):'Anulada'];
   textos.forEach((x,i)=>{const td=document.createElement('td');td.textContent=x;if(i===4){const s=document.createElement('small');s.className='asignacion-correo-estado';const c=a.correos?.[0];s.textContent=!c?'Sin correo enviado':c.estado==='enviado'?'Correo aceptado por SMTP · CCO '+(c.copia_estado==='aceptada'?'aceptada':'sin confirmar'):c.estado==='preparado'?'Envío en curso / por confirmar':'Correo sin confirmación';td.appendChild(s);const rs=document.createElement('small');rs.className='asignacion-correo-estado';rs.textContent=a.recordatorio?.estado==='enviado'?'Recordatorio enviado':a.recordatorio?.publicado?'Publicado · sin recordatorio':a.recordatorio?.estado==='incierto'?'Recordatorio sin confirmar':a.recordatorio?.estado==='sin_solicitud'?'Recordatorio: falta solicitud':'Recordatorio automático';td.appendChild(rs);}tr.appendChild(td);});
   const td=document.createElement('td'),b=document.createElement('button');b.type='button';b.className='admin-link-btn';b.textContent='Ver opciones';b.dataset.vigente=String(a.vigente);b.disabled=ocupado||!a.vigente;b.setAttribute('aria-label','Ver opciones de '+a.codigo+' de '+a.nombre);b.onclick=()=>seleccionar(a.id);td.appendChild(b);tr.appendChild(td);cuerpo.appendChild(tr);
  });contexto();botones();seguimiento();window.renderizarCronogramaAdmin();
 }
 function seleccionar(id){
  if(ocupado)return;
  seleccion=id;const a=actual();opciones();
  $('asignacionUsuario').value=a.usuario_id;$('asignacionTema').value=a.codigo;
  $('asignacionFecha').value=a.fecha_asignacion;$('asignacionEntrega').value=a.fecha_entrega;
  $('asignacionModo').textContent='Modificar asignación · '+a.codigo;
  render();estado('Asignación seleccionada. Modificar conserva la fecha de entrega salvo que usted la cambie.');
  if(!$('dialogOpcionesAsignacion').open)$('dialogOpcionesAsignacion').showModal();
  $('asignacionUsuario').focus();vistaRecordatorio();
 }
 window.nuevaAsignacionDocente=function(){
  if(ocupado)return;seleccion=null;vista=null;
  $('asignacionForm').reset();$('asignacionFecha').value=hoy();$('asignacionEntrega').value=mas21(hoy());
  $('asignacionModo').textContent='Nueva asignación';$('asignacionRecordatorioVista').srcdoc='';$('asignacionRecordatorioDetalle').open=false;render();estado('Complete hermano, tema y fechas para asignar.');
 };
 window.abrirNuevaAsignacionDocente=function(){if(ocupado)return;window.nuevaAsignacionDocente();if(!$('dialogOpcionesAsignacion').open)$('dialogOpcionesAsignacion').showModal();$('asignacionUsuario').focus();};
 window.cerrarOpcionesAsignacion=function(){if(ocupado)return;$('dialogOpcionesAsignacion').close();$('asignacionRecordatorioVista').srcdoc='';};
 window.cargarAsignacionesAdmin=async function(){
  if(!usuarioActual?.es_admin)return;
  const n=++consulta;ocupado=true;botones();estado('Consultando padrón, catálogo y asignaciones…');
  try{
   const r=await api({action:'listar'});if(n!==consulta||!usuarioActual?.es_admin)return;
   datos=r.data;datosCargados=true;if(seleccion&&!actual()?.vigente)seleccion=null;
   opciones();render();if(!$('asignacionFecha').value&&!seleccion){$('asignacionFecha').value=hoy();$('asignacionEntrega').value=mas21(hoy());}
   estado('Asignaciones actualizadas. Guardar o modificar nunca envía correos.');
  }catch(e){if(n===consulta){estado(e.message,true);$('cronogramaEstado').textContent='No se pudo actualizar el cronograma. '+e.message;}}
  finally{if(n===consulta){ocupado=false;botones();window.renderizarCronogramaAdmin();}}
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
   if(action==='eliminar'){$('dialogOpcionesAsignacion').close();}
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
  if(ocupado||!actual())return;
  const guardada=actual();
  if($('asignacionUsuario').value!==guardada.usuario_id||$('asignacionTema').value!==guardada.codigo||$('asignacionFecha').value!==guardada.fecha_asignacion||$('asignacionEntrega').value!==guardada.fecha_entrega){
   estado('Hay cambios sin guardar. Pulse Modificar antes de preparar el correo.',true);return;
  }
  ocupado=true;botones();estado('Preparando vista previa del correo…');
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
 window.cerrarIntentoRecordatorioAsignacion=async function(){
  const a=actual(),r=a?.recordatorio;if(ocupado||!r?.id||!confirm('¿Revisó el buzón y la copia oculta? Se marcará el recordatorio SIN CONFIRMAR y no se enviará otro automáticamente.'))return;
  ocupado=true;botones();$('btnRevisarRecordatorioAsignacion').disabled=true;
  try{await api({action:'cerrar_recordatorio',id:a.id,version:a.version,intento:r.id,confirmado:true});await window.cargarAsignacionesAdmin();estado('Recordatorio marcado sin confirmar. No se enviará otro automáticamente.');}
  catch(e){estado(e.message,true);}finally{ocupado=false;$('btnRevisarRecordatorioAsignacion').disabled=false;botones();}
 };
 window.cerrarCorreoAsignacion=function(){if(!ocupado){$('dialogCorreoAsignacion').close();$('correoAsignacionVista').srcdoc='';vista=null;}};
 window.limpiarAsignacionesAdmin=function(){
  ++consulta;datosCargados=false;datos={usuarios:[],catalogo:[],asignaciones:[]};seleccion=null;vista=null;ocupado=false;
  $('dialogOpcionesAsignacion')?.close();if($('asignacionRecordatorioVista'))$('asignacionRecordatorioVista').srcdoc='';
  $('dialogCorreoAsignacion')?.close();if($('correoAsignacionVista'))$('correoAsignacionVista').srcdoc='';
  if($('asignacionesEstadoFiltro'))$('asignacionesEstadoFiltro').value='todos';
  if($('asignacionesVerAnuladas'))$('asignacionesVerAnuladas').checked=false;
  for(const id of ['asignacionesBody','asignacionUsuario','asignacionTema'])$(id)?.replaceChildren();
  if($('asignacionForm'))$('asignacionForm').reset();
  window.renderizarCronogramaAdmin();
 };
 document.addEventListener('DOMContentLoaded',()=>{
  $('dialogOpcionesAsignacion')?.addEventListener('cancel',e=>{if(ocupado)e.preventDefault();else window.cerrarOpcionesAsignacion();});
  $('dialogCorreoAsignacion')?.addEventListener('cancel',e=>{if(ocupado)e.preventDefault();else window.cerrarCorreoAsignacion();});
 });
})();

