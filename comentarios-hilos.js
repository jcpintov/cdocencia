/* Hilos de USERS. Identidad, permisos y persistencia se validan en Supabase. */
(function () {
 'use strict';
 const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const nombre = value => formatearNombreHermano(value, 'Hermano');
 const pendientes = new Set();
 window.mostrarEstadoHilos = function(contenedor, mensaje) {
  let estado=contenedor.querySelector('[data-estado-hilos]');
  if(!estado){estado=document.createElement('p');estado.dataset.estadoHilos='';estado.className='hilo-estado';estado.setAttribute('role','status');estado.setAttribute('aria-live','polite');contenedor.prepend(estado);}
  estado.textContent=mensaje;
 };
 function esperarConfirmacion(operacion, plazo = 20000) {
  let timer;
  const limite = new Promise((_resolve,reject) => {
   timer = setTimeout(() => reject(new Error('La conexión tardó demasiado. Reintente para confirmar el guardado sin duplicar la respuesta.')), plazo);
  });
  return Promise.race([operacion, limite]).finally(() => clearTimeout(timer));
 }
 const fecha = value => {
  const d = new Date(value || '');
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('es-CL', {dateStyle:'short',timeStyle:'short'});
 };

 window.renderizarHilosComentarios = function (comentarios, progresoId, moduloId, ambito = 'trabajo') {
  const prefijo = ambito === 'general' ? 'general_' : '';
  const nodes = new Map();
  for (const c of comentarios || []) {
   if (!c?.id || nodes.has(c.id) || c.activo === false || c.progreso_id !== progresoId) continue;
   nodes.set(c.id, {...c, hijos:[]});
  }
  const roots = [], faltantes = new Map();
  for (const c of nodes.values()) {
   const p = nodes.get(c.comentario_padre_id);
   if (p && p.id !== c.id) p.hijos.push(c);
   else if (c.comentario_padre_id && c.comentario_padre_id !== c.id) {
    if (!faltantes.has(c.comentario_padre_id)) {
     const aviso = {id:'ausente-'+c.comentario_padre_id,ausente:true,hijos:[]};
     faltantes.set(c.comentario_padre_id,aviso);roots.push(aviso);
    }
    faltantes.get(c.comentario_padre_id).hijos.push(c);
   } else roots.push(c);
  }
  const orden = (a,b) => String(a.creado_en || '').localeCompare(String(b.creado_en || '')) || String(a.id).localeCompare(String(b.id));
  const visitados = new Set(), html = [];
  // Pila explícita: una conversación larga no desborda la pila del navegador.
  const recorrer = semillas => {
   const stack = [...semillas].sort(orden).reverse().map(c=>({c,nivel:0,padre:null}));
   while(stack.length) {
    const {c,nivel,padre}=stack.pop();
    if(visitados.has(c.id))continue;
    visitados.add(c.id);
    if(c.ausente) html.push('<div class="hilo-contexto-ausente">Comentario anterior no disponible. Sus respuestas se conservan.</div>');
    else {
     const autor = nombre(c.usuarios?.nombre), propio = c.usuario_id === usuarioActual?.id;
     const puedeResponder = !!usuarioActual && !usuarioActual.es_admin;
     const contexto = padre && !padre.ausente ? 'En respuesta a '+nombre(padre.usuarios?.nombre) : c.comentario_padre_id ? 'Respuesta al comentario anterior' : '';
     html.push(`<article class="foro-comentario-item hilo-comentario${nivel?' hilo-respuesta':''}" id="${prefijo}comentario_item_${e(c.id)}" data-comentario-id="${e(c.id)}" data-padre-id="${e(c.comentario_padre_id || '')}" style="--hilo-nivel:${Math.min(nivel,3)}" tabindex="-1" aria-label="Comentario de ${e(autor)}">
      <div class="foro-comentario-header"><span class="foro-comentario-autor">${e(autor)}</span><time class="foro-comentario-fecha">${e(fecha(c.creado_en))}${c.editado?' · editado':''}</time></div>
      ${contexto?'<p class="hilo-contexto">'+e(contexto)+'</p>':''}
      <div class="foro-comentario-cuerpo" id="${prefijo}comentario_cuerpo_${e(c.id)}">${e(c.contenido)}</div>
      <div class="foro-comentario-acciones">
       ${puedeResponder?`<button type="button" class="foro-comentario-btn" data-hilo-accion="responder" data-hilo-id="${e(c.id)}" aria-expanded="false" aria-controls="${prefijo}hilo_form_${e(c.id)}" data-hilo-form="${prefijo}hilo_form_${e(c.id)}">Responder</button>`:''}
       ${propio?`<button type="button" class="foro-comentario-btn" data-hilo-accion="editar" data-hilo-id="${e(c.id)}" data-hilo-texto="${e(c.contenido)}">Editar mi comentario</button>`:''}
      </div>
      ${puedeResponder?`<form class="hilo-formulario hidden" id="${prefijo}hilo_form_${e(c.id)}" data-padre="${e(c.id)}" data-progreso="${e(progresoId)}" data-modulo="${e(moduloId)}">
       <label for="${prefijo}hilo_texto_${e(c.id)}">Responder a ${e(autor)}</label>
       <textarea id="${prefijo}hilo_texto_${e(c.id)}" name="respuesta" rows="3" minlength="5" maxlength="1500" required aria-describedby="${prefijo}hilo_ayuda_${e(c.id)} ${prefijo}hilo_estado_${e(c.id)}"></textarea>
       <p class="hilo-ayuda" id="${prefijo}hilo_ayuda_${e(c.id)}">Entre 5 y 1500 caracteres.</p>
       <p class="hilo-estado" id="${prefijo}hilo_estado_${e(c.id)}" role="status" aria-live="polite"></p>
       <div class="hilo-form-acciones"><button type="button" class="btn-secondary" data-hilo-accion="cancelar" data-hilo-id="${e(c.id)}" data-hilo-form="${prefijo}hilo_form_${e(c.id)}">Cancelar</button><button type="submit" class="btn-primary">Publicar respuesta</button></div>
      </form>`:''}
     </article>`);
    }
    [...c.hijos].sort(orden).reverse().forEach(h=>stack.push({c:h,nivel:nivel+1,padre:c}));
   }
  };
  recorrer(roots);
  // Respaldo ante datos antiguos inconsistentes: no ocultar aportes ni entrar en ciclos.
  recorrer([...nodes.values()].filter(c=>!visitados.has(c.id)));
  return html.join('');
 };

 window.capturarBorradoresComentarios = function (contenedor) {
  return [...contenedor.querySelectorAll('.hilo-formulario, .foro-comentar-caja')].map(form=>({
   id:form.id,texto:form.querySelector('textarea')?.value || '',abierto:!form.classList.contains('hidden'),
   solicitud:form.dataset.solicitud || '',contenidoSolicitud:form.dataset.contenidoSolicitud || ''
  }));
 };
 window.restaurarBorradoresComentarios = function (contenedor, borradores) {
  for(const b of borradores || []) {
   const form=document.getElementById(b.id);
   if(!form || !contenedor.contains(form))continue;
   const input=form.querySelector('textarea');if(input)input.value=b.texto;
   form.classList.toggle('hidden',!b.abierto);
   form.dataset.solicitud=b.solicitud;form.dataset.contenidoSolicitud=b.contenidoSolicitud;
   const toggle=document.querySelector('[data-hilo-accion="responder"][aria-controls="'+form.id+'"]');
   if(toggle)toggle.setAttribute('aria-expanded',String(b.abierto));
  }
 };

 function mostrarFormulario(formId, abierto) {
  const form=document.getElementById(formId);
  if(!form)return;
  const toggle=document.querySelector('[data-hilo-accion="responder"][aria-controls="'+form.id+'"]');
  form.classList.toggle('hidden',!abierto);
  toggle?.setAttribute('aria-expanded',String(abierto));
  if(abierto)form.querySelector('textarea')?.focus();else toggle?.focus();
 }
 document.addEventListener('click',event=>{
  const btn=event.target.closest('button[data-hilo-accion]');if(!btn)return;
  const id=btn.dataset.hiloId;
  if(btn.dataset.hiloAccion==='editar')abrirModalEditarComentario(id,encodeURIComponent(btn.dataset.hiloTexto));
  else mostrarFormulario(btn.dataset.hiloForm,btn.dataset.hiloAccion==='responder');
 });
 document.addEventListener('submit',event=>{
  const form=event.target.closest('form.hilo-formulario');if(!form)return;
  event.preventDefault();void publicarRespuesta(form);
 });
 async function publicarRespuesta(form) {
  if(pendientes.has(form.dataset.padre))return;
  const input=form.querySelector('textarea'), estado=form.querySelector('.hilo-estado');
  const texto=input.value.trim();
  if(texto.length<5 || texto.length>1500){estado.textContent='Escriba entre 5 y 1500 caracteres.';input.focus();return;}
  if(!usuarioActual || usuarioActual.es_admin){estado.textContent='Ingrese con su cuenta de participante.';return;}
  const actor=usuarioActual, padre=form.dataset.padre, boton=form.querySelector('[type="submit"]');
  let guardada=false;
  pendientes.add(padre);boton.disabled=true;input.readOnly=true;estado.textContent='Publicando respuesta…';
  try {
   if(!form.dataset.solicitud){form.dataset.solicitud=crypto.randomUUID();form.dataset.contenidoSolicitud=texto;}
   if(form.dataset.contenidoSolicitud!==texto)throw Error('El intento anterior no se pudo confirmar. Reintente con el texto anterior o actualice el muro para comprobar si fue publicado.');
   const {data,error}=await esperarConfirmacion(sbApp.rpc('maestro_responder_comentario',{
    p_comentario_padre_id:padre,p_contenido:texto,p_solicitud_id:form.dataset.solicitud
   }));
   if(error || !data) {
    // Una denegación confirmada no pudo insertar; permite corregir el texto.
    if(error && ['22023','42501','23514'].includes(error.code)){delete form.dataset.solicitud;delete form.dataset.contenidoSolicitud;}
    throw Error(error?.message || 'No se pudo confirmar el guardado. Reintente para comprobarlo sin duplicar la respuesta.');
   }
   guardada=true;
   if(usuarioActual!==actor)return;
   input.value='';delete form.dataset.solicitud;delete form.dataset.contenidoSolicitud;
   form.classList.add('hidden');
   estado.textContent='Respuesta publicada.';
   const muroGeneral=document.getElementById('seccionMuroUsuarios');
   if(!muroGeneral.classList.contains('hidden'))await mostrarMuroReflexionesUsuarios();
   else if(moduloActual?.id===form.dataset.modulo && !document.getElementById('seccionDocencia').classList.contains('hidden'))await cargarMuroReflexiones();
   const destino=!muroGeneral.classList.contains('hidden')?document.getElementById('contenedorMuroUsuariosDirecto'):document.getElementById('contenedorMuro');
   const publicado=destino.querySelector('[data-comentario-id="'+data+'"]');
   if(destino.getClientRects().length)window.mostrarEstadoHilos(destino,publicado?'Respuesta publicada.':'Respuesta guardada. Vuelva a abrir el muro para ver la actualización.');
   if(publicado && publicado.getClientRects().length) {publicado.focus({preventScroll:true});publicado.scrollIntoView({block:'nearest',behavior:'smooth'});}
  } catch(error) {
   if(usuarioActual===actor) {
    estado.textContent=guardada?'Respuesta guardada. No se pudo actualizar el muro; vuelva a abrirlo.':(error.message || 'No se pudo publicar.')+' Su texto se conserva.';
    if(guardada) {
     const contenedor=form.closest('#contenedorMuro, #contenedorMuroUsuariosDirecto');
     if(contenedor?.getClientRects().length)window.mostrarEstadoHilos(contenedor,estado.textContent);
    }
   }
  } finally {
   pendientes.delete(padre);boton.disabled=false;input.readOnly=false;
  }
 }
})();
