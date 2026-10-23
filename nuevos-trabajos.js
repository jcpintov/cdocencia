/* Borradores privados: el original no se modifica y publicar siempre es explícito. */
(function(){
 const $=id=>document.getElementById(id);let borrador=null,ocupado=false,versionUI=0,controlador=null,idArchivo=null;
 const msg=t=>$('nuevoTrabajoEstado').textContent=t;
 function bloquear(v){ocupado=v;$('nuevoTrabajoFormulario').querySelectorAll('input,textarea,select,button').forEach(e=>e.disabled=v);$('btnCerrarNuevoTrabajo').disabled=v;}
 async function api(datos){
  const actor=usuarioActual,n=versionUI;const {data:{session}}=await sbApp.auth.getSession();
  if(!actor?.es_admin||usuarioActual!==actor||!session?.access_token)throw Error('La sesión venció. Inicie sesión nuevamente.');
  const c=new AbortController();controlador=c;const timer=setTimeout(()=>c.abort(),100000);
  try{const r=await fetch('/api/admin-trabajos',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify(datos),signal:c.signal});const d=await r.json().catch(()=>{throw Error('El servidor no entregó una respuesta válida.');});
   if(n!==versionUI||usuarioActual!==actor)throw Error('La sesión o la vista cambió.');if(!r.ok||!d.ok)throw Error(d.error||'No fue posible completar el paso.');return d;
  }finally{clearTimeout(timer);if(controlador===c)controlador=null;}
 }
 function preguntasDesdeCampos(){
  const preguntas=[];for(const el of $('nuevoTrabajoPreguntas').children){const i=Number(el.dataset.indice),get=k=>el.querySelector('[data-campo="'+k+'"]').value;preguntas.push({enunciado:get('enunciado'),opciones:['A','B','C','D'].map(letra=>({letra,texto:get(letra)})),respuesta_correcta:get('correcta'),retroalimentacion:get('retro'),sustento:get('sustento'),tipo:i===7?'etica':'comprension'});}return preguntas.length?{preguntas}:null;
 }
 function campos(){
  const autor=$('nuevoTrabajoAutor').value.trim();let texto=$('nuevoTrabajoTexto').value.trim();
  if(autor&&typeof normalizarCierreTrabajo==='function'){texto=normalizarCierreTrabajo(texto,autor);$('nuevoTrabajoTexto').value=texto;}
  return {ficha:{titulo:$('nuevoTrabajoTitulo').value.trim(),autor,codigo:$('nuevoTrabajoCodigo').value,numero_orden:Number($('nuevoTrabajoOrden').value)},texto,preguntas:preguntasDesdeCampos()};
 }
 function mostrar(d){
  if(!d||typeof d.texto!=='string'||!d.original?.data_url||!Number.isInteger(d.revision))throw Error('El servidor entregó un borrador incompleto.');
  borrador=d;$('nuevoTrabajoEdicion').hidden=false;$('nuevoTrabajoTitulo').value=d.ficha.titulo||'';$('nuevoTrabajoAutor').value=d.ficha.autor||'';$('nuevoTrabajoOrden').value=d.ficha.numero_orden||1;$('nuevoTrabajoCodigo').value=d.ficha.codigo||'';$('nuevoTrabajoTexto').value=d.texto;
  $('nuevoTrabajoExtraido').textContent=d.extraccion.texto_original||'';
  $('nuevoTrabajoSeparados').textContent=(d.extraccion.separados||[]).map(s=>s.motivo+(s.pagina?' · página '+s.pagina:'')+'\n'+s.texto).join('\n\n')||'No se detectaron fragmentos para separar. Revise el original.';
  $('nuevoTrabajoOriginalNombre').textContent='Original conservado: '+d.original.nombre;
  $('nuevoTrabajoPreguntas').replaceChildren();$('nuevoTrabajoRevisado').checked=false;
  for(const [i,p] of (d.preguntas?.preguntas||[]).entries()){
   const seccion=document.createElement('section');seccion.className='nuevo-trabajo-pregunta';seccion.dataset.indice=i;const h=document.createElement('h3');h.textContent='Pregunta '+(i+1)+(i===7?' · Dilema ético':'');seccion.appendChild(h);
   function campo(etiqueta,clave,valor,tipo='textarea',max=1200){const label=document.createElement('label'),el=document.createElement(tipo);el.id='nuevoPregunta'+i+clave;el.name=el.id;el.dataset.campo=clave;label.htmlFor=el.id;label.textContent=etiqueta;el.value=valor||'';if(tipo==='textarea'){el.rows=2;el.maxLength=max;}seccion.append(label,el);return el;}
   campo('Enunciado','enunciado',p.enunciado);for(const op of p.opciones)campo('Alternativa '+op.letra,op.letra,op.texto,'textarea',700);
   const correcta=campo('Respuesta correcta','correcta','', 'select');for(const letra of ['A','B','C','D'])correcta.add(new Option(letra,letra));correcta.value=p.respuesta_correcta;
   campo('Retroalimentación','retro',p.retroalimentacion);campo('Sustento literal del texto','sustento',p.sustento,'textarea',450);$('nuevoTrabajoPreguntas').appendChild(seccion);
  }
  $('nuevoTrabajoPreguntasEstado').textContent=d.preguntas?.preguntas?.length===8?'Ocho preguntas listas para revisar y editar.':'No hay preguntas vigentes. Guarde el texto y genere las ocho preguntas.';
 }
 async function catalogo(){
  const {data,error}=await sbApp.from('unidades_docencia').select('codigo,detalle').eq('activo',true).order('orden');if(error||!Array.isArray(data))throw Error('No fue posible cargar los temas. Reabra el formulario.');
  $('nuevoTrabajoCodigo').replaceChildren(new Option('Seleccione un tema',''));for(const t of data.filter(t=>/^(INCI|INST|FILO|ETIC)[0-9]{2}[0-9A-Z][A-Z1-9]$/.test(t.codigo)))$('nuevoTrabajoCodigo').add(new Option(t.codigo+' · '+t.detalle,t.codigo));
 }
 window.cargarBorradoresTrabajos=async function(){
  if(!usuarioActual?.es_admin)return;const n=versionUI,lista=$('nuevosTrabajosBorradores');lista.replaceChildren();
  try{const r=await api({action:'nuevo_listar'});if(n!==versionUI)return;if(!Array.isArray(r.borradores))throw Error('Lista incompleta');
   for(const b of r.borradores){const boton=document.createElement('button');boton.type='button';boton.className='admin-link-btn';boton.textContent='Continuar borrador · '+(b.ficha.titulo||'Sin título');boton.onclick=()=>window.abrirNuevoTrabajo(b.id);lista.appendChild(boton);}
   if(!r.borradores.length)lista.textContent='No tiene borradores pendientes.';
  }catch(e){if(n===versionUI)lista.textContent=e.message;}
 };
 window.abrirNuevoTrabajo=async function(id=null){
  if(!usuarioActual?.es_admin||ocupado)return;++versionUI;const n=versionUI;borrador=null;idArchivo=null;$('nuevoTrabajoFormulario').reset();$('nuevoTrabajoEdicion').hidden=true;$('nuevoTrabajoPreguntas').replaceChildren();msg('Adjunte un original PDF o Word DOCX de hasta 2 MB.');$('dialogNuevoTrabajo').showModal();bloquear(true);
  try{await catalogo();if(n!==versionUI)return;if(id){const r=await api({action:'nuevo_obtener',id});mostrar(r.borrador);msg('Borrador recuperado. El original permanece intacto.');}}
  catch(e){if(n===versionUI)msg(e.message);}finally{if(n===versionUI)bloquear(false);}
 };
 window.cerrarNuevoTrabajo=function(){if(ocupado)return;if(borrador&&!confirm('¿Cerrar la revisión? El último borrador guardado se conserva; los cambios sin guardar se perderán.'))return;++versionUI;$('dialogNuevoTrabajo').close();borrador=null;idArchivo=null;void window.cargarBorradoresTrabajos();};
 async function guardar(){
  if(!borrador)throw Error('Prepare primero el original.');const datos=campos();const r=await api({action:'nuevo_guardar',id:borrador.id,revision:borrador.revision,...datos});mostrar(r.borrador);return r.borrador;
 }
 window.accionNuevoTrabajo=async function(accion){
  if(ocupado||!usuarioActual?.es_admin)return;const n=versionUI;bloquear(true);msg('Procesando…');
  try{
   if(accion==='preparar'){
    const file=$('nuevoTrabajoArchivo').files[0];if(!file||file.size>2097152||!/^.+\.(pdf|docx)$/i.test(file.name))throw Error('Adjunte PDF o DOCX de hasta 2 MB.');
    if(borrador)throw Error('Este borrador ya tiene un original. Cierre y use Subir trabajo nuevo para crear otro.');
    const bytes=new Uint8Array(await file.arrayBuffer());let bin='';for(let i=0;i<bytes.length;i+=8192)bin+=String.fromCharCode(...bytes.subarray(i,i+8192));idArchivo ||= crypto.randomUUID();
    const r=await api({action:'nuevo_preparar',id:idArchivo,nombre:file.name,base64:btoa(bin)});mostrar(r.borrador);if(typeof listaModulos!=='undefined'&&Array.isArray(listaModulos))$('nuevoTrabajoOrden').value=Math.min(999,Math.max(0,...listaModulos.map(m=>Number(m.numero_orden)||0))+1);msg('Original conservado. Revise el texto limpio y los fragmentos separados.');
   }else if(accion==='guardar'){await guardar();msg('Borrador guardado. No está publicado.');}
   else if(accion==='generar'){
    if(usuarioActual?.rol==='ADMIN')throw Error('Las funciones de IA están reservadas a Superadmin');
    if(!$('nuevoTrabajoAutorizarIA').checked)throw Error('Marque la autorización para enviar el texto revisado a Groq.');
    await guardar();msg('Generando ocho preguntas a partir del texto guardado…');const r=await api({action:'nuevo_generar',id:borrador.id,revision:borrador.revision,confirmado:true});mostrar(r.borrador);msg('Ocho preguntas generadas. Revise alternativas, respuesta y sustento antes de publicar.');
   }else if(accion==='publicar'){
    if(!$('nuevoTrabajoRevisado').checked)throw Error('Confirme la revisión del texto y las ocho preguntas.');
    if(!confirm('¿Publicar este trabajo y habilitar su original a los usuarios? La publicación puede registrar la entrega del trabajo asignado y habilitar el aviso al autor.'))return;
    await guardar();if(!borrador.preguntas)throw Error('El texto cambió: se invalidaron las preguntas. Genérelas nuevamente antes de publicar.');
    const r=await api({action:'nuevo_publicar',id:borrador.id,revision:borrador.revision,confirmado:true});if(!r.publicado)throw Error('El servidor no confirmó la publicación. Actualice la lista.');
    $('dialogNuevoTrabajo').close();borrador=null;idArchivo=null;await cargarGestionTrabajosAdmin();await cargarDatosAdmin();void window.cargarAsignacionesAdmin?.();void window.notificarPublicacionesAdmin?.();void window.cargarBorradoresTrabajos();document.getElementById('gestionTrabajosEstado').textContent='Trabajo publicado con su texto, ocho preguntas y original intacto. El aviso al autor seguirá la revisión automática.';
   }
  }catch(e){if(n===versionUI)msg(e.name==='AbortError'?'Se agotó el tiempo. Actualice el borrador antes de reintentar; el último avance guardado se conserva.':e.message);}
  finally{if(n===versionUI)bloquear(false);}
 };
 window.descargarOriginalNuevoTrabajo=function(){
  if(!borrador||!usuarioActual?.es_admin)return;const original=borrador.original;const bin=atob(original.data_url.split(',')[1]),bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes]));const a=document.createElement('a');a.href=url;a.download=original.nombre;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 window.limpiarNuevosTrabajos=function(){++versionUI;controlador?.abort();controlador=null;borrador=null;idArchivo=null;ocupado=false;$('dialogNuevoTrabajo')?.close();$('nuevoTrabajoFormulario')?.reset();for(const id of ['nuevoTrabajoPreguntas','nuevoTrabajoSeparados','nuevoTrabajoExtraido','nuevoTrabajoOriginalNombre','nuevoTrabajoEstado','nuevoTrabajoPreguntasEstado','nuevosTrabajosBorradores'])$(id)?.replaceChildren();};
 document.addEventListener('DOMContentLoaded',()=>{$('dialogNuevoTrabajo')?.addEventListener('cancel',e=>{e.preventDefault();window.cerrarNuevoTrabajo();});});
})();
