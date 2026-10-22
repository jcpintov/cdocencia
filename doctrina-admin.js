/* Biblioteca reservada a Superadmin. No contiene documentos ni claves. */
let bibliotecaDoctrina = {documentos:[],inventario:[]};
let consultaBibliotecaDoctrina = 0;
let consultaBusquedaTextoDoctrina = 0;
let consultaAgenteDoctrina = 0;
let controladorAgenteDoctrina = null;
let consultaPermisosGroq = 0;
let cargaDoctrinaPendiente = null;
function limpiarBibliotecaDoctrina(){
 consultaBibliotecaDoctrina++;consultaBusquedaTextoDoctrina++;consultaPermisosGroq++;invalidarAgenteDoctrina();
 document.getElementById('doctrinaAgenteFormulario')?.reset();
 const salidaAgente=document.getElementById('doctrinaAgenteResultado');if(salidaAgente)salidaAgente.setAttribute('aria-busy','false');
 const consultar=document.getElementById('doctrinaAgenteConsultar');if(consultar)consultar.disabled=false;
 cerrarVisorDoctrina();
 cerrarTextoDoctrina(true);
 bibliotecaDoctrina={documentos:[],inventario:[]};cargaDoctrinaPendiente=null;
 document.getElementById('doctrinaRevisionDialogo')?.close();
 document.getElementById('doctrinaFormulario')?.reset();
 for(const id of ['doctrinaDocumentos','doctrinaInventario','doctrinaBusquedaResultados','doctrinaAgenteResultado','doctrinaGroqPermisos'])document.getElementById(id)?.replaceChildren();
}
async function peticionDoctrina(action,datos={},signal){
 if(!usuarioActual?.es_admin)throw new Error('Acceso exclusivo de Superadmin');
 const {data,error}=await sbApp.auth.getSession();
 if(error||!data?.session?.access_token)throw new Error('Sesión vencida. Inicie sesión nuevamente.');
 const response=await fetch('/api/admin-doctrina',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({action,...datos}),signal});
 const result=await response.json();
 if(!response.ok||!result.ok)throw new Error(result.error||'No se pudo completar la operación');
 return result;
}
async function cargarBibliotecaDoctrina(){
 if(!usuarioActual?.es_admin)return;
 invalidarAgenteDoctrina();
 const consulta=++consultaBibliotecaDoctrina;
 const estado=document.getElementById('doctrinaEstado');
 const boton=document.getElementById('doctrinaActualizar');
 estado.textContent='Consultando biblioteca e inventario…';boton.disabled=true;
 try{
  const result=await peticionDoctrina('listar');
  if(consulta!==consultaBibliotecaDoctrina||!usuarioActual?.es_admin)return;
  if(!Array.isArray(result.documentos)||!Array.isArray(result.inventario))throw new Error('Respuesta documental incompleta');
  bibliotecaDoctrina=result;renderizarBibliotecaDoctrina();
  estado.textContent=`${result.documentos.length} originales incorporados; ${result.inventario.length} registros del inventario. Acceso solo Superadmin.`;
 }catch(error){if(consulta===consultaBibliotecaDoctrina)estado.textContent=error.message;}
 finally{if(consulta===consultaBibliotecaDoctrina)boton.disabled=false;}
}
function renderizarBibliotecaDoctrina(){
 if(!usuarioActual?.es_admin)return;
 const buscar=normalizarBusquedaAdmin(document.getElementById('doctrinaBuscar')?.value||'');
 for(const tipo of ['documentos','inventario']){
  const cont=document.getElementById(tipo==='documentos'?'doctrinaDocumentos':'doctrinaInventario');cont.replaceChildren();
  const filas=bibliotecaDoctrina[tipo].filter(d=>tipo!=='documentos'||d.estado!=='retirado'||document.getElementById('doctrinaMostrarRetirados')?.checked).filter(d=>normalizarBusquedaAdmin(`${d.titulo||d.archivo} ${d.clase}`).includes(buscar));
  if(!filas.length){const p=document.createElement('p');p.className='admin-empty-state';p.textContent=buscar?'Sin coincidencias para esta búsqueda.':tipo==='documentos'?'Todavía no hay originales incorporados.':'No hay registros en el inventario.';cont.appendChild(p);}
  filas.forEach(d=>{
   const card=document.createElement('article');const eliminado=(d.original_estado||d.estado)==='retirado',verificado=tipo==='documentos'?d.estado==='vigente'&&d.revision==='listo':d.estado==='archivo_verificado'&&!eliminado;card.className='doctrina-documento doctrina-tarjeta '+(eliminado?'doctrina-eliminado':verificado?'doctrina-verificado':'doctrina-pendiente');
   const titulo=document.createElement('h4');titulo.textContent=d.titulo||d.archivo;
   const detalle=document.createElement('p');detalle.textContent=tipo==='documentos'?`${d.clase} · ${d.estado} · ${d.revision||'sin versión'} · ${Math.ceil((d.bytes||0)/1024)} KB`:`${d.clase} · ${d.estado} · ${d.grado_validado?'Grado revisado':'Grado pendiente'} · ${d.derechos_verificados?'Derechos revisados':'Derechos pendientes'}`;
   const estadoVisual=document.createElement('span');estadoVisual.className='doctrina-estado';estadoVisual.textContent=eliminado?'Eliminado':verificado?'Verificado':'Pendiente';titulo.appendChild(estadoVisual);
   card.append(titulo,detalle);
   if(tipo==='documentos'&&d.extraccion_estado){const textoEstado=document.createElement('p');textoEstado.className='doctrina-extraccion-estado';textoEstado.textContent='Texto: '+d.extraccion_estado+(d.paginas?' · '+d.paginas+' páginas':'')+(d.paginas_pendientes!=null?' · '+d.paginas_pendientes+' por revisar':'');card.appendChild(textoEstado);}
   if(tipo==='documentos'&&d.version_id){
    const acciones=document.createElement('div');acciones.className='doctrina-acciones';
    const agregar=(texto,fn)=>{const b=document.createElement('button');b.type='button';b.className='btn-secondary';b.textContent=texto;b.addEventListener('click',()=>fn(b));acciones.appendChild(b);};
    if(d.estado==='retirado'){
     card.querySelector('button')?.remove();agregar('Restaurar',b=>cambiarRetiroDoctrina(d,'restaurar',b));
    }else{
     agregar('Descargar original',b=>descargarOriginalDoctrina(d.version_id,b));
     if(d.estado==='vigente')agregar('Texto por páginas',()=>abrirTextoDoctrina(d));
     agregar('Consultar original',b=>abrirVisorDoctrina(d,b));
     agregar('Revisión',()=>abrirRevisionDoctrina(d));
     agregar('Eliminar',b=>cambiarRetiroDoctrina(d,'retirar',b));
    }
    if(d.nota_revision){const nota=document.createElement('p');nota.textContent='Observaciones: '+d.nota_revision;card.appendChild(nota);}
    card.appendChild(acciones);
   }
   cont.appendChild(card);
  });
 }
}
async function descargarOriginalDoctrina(id,boton){
 boton.disabled=true;
 try{const result=await peticionDoctrina('descargar',{id});
  if(!usuarioActual?.es_admin)return;
  const url=new URL(result.url);
  const origen=new URL(SUPABASE_URL).origin;
  if(url.protocol!=='https:'||url.origin!==origen||!url.pathname.startsWith('/storage/v1/object/sign/'))throw new Error('Referencia de descarga no válida');
  const enlace=document.createElement('a');enlace.href=url.href;enlace.target='_blank';enlace.rel='noopener noreferrer';enlace.textContent='Descargar';document.body.appendChild(enlace);enlace.click();enlace.remove();
 }catch(error){document.getElementById('doctrinaEstado').textContent=error.message;}
 finally{boton.disabled=false;}
}
async function incorporarOriginalDoctrina(){
 if(!usuarioActual?.es_admin)return;
 const boton=document.getElementById('doctrinaIncorporar');if(boton.disabled)return;
 const estado=document.getElementById('doctrinaCargaEstado');
 const file=document.getElementById('doctrinaArchivo').files[0];
 const titulo=document.getElementById('doctrinaTitulo').value.trim();
 const clase=document.getElementById('doctrinaClase').value;
 if(!file||!file.name.toLowerCase().endsWith('.pdf')||file.size<1||file.size>50*1024*1024||titulo.length<3){estado.textContent='Seleccione un PDF de hasta 50 MB y un título válido.';return;}
 const actor=usuarioActual.id;boton.disabled=true;
 try{
  estado.textContent='Verificando el original…';
  const bytes=await file.arrayBuffer();
  if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new Error('El archivo seleccionado no tiene cabecera PDF.');
  const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  const datos={titulo,clase,bytes:file.size,sha256};
  if(!cargaDoctrinaPendiente||cargaDoctrinaPendiente.sha256!==sha256){
   const preparada=await peticionDoctrina('preparar',datos);
   estado.textContent='Subiendo original al almacenamiento privado…';
   const {error}=await sbApp.storage.from('doctrina-originales-privados').uploadToSignedUrl(preparada.path,preparada.token,file,{contentType:'application/pdf'});
   if(error)throw new Error('No se pudo subir el original. Reintente la carga.');
   cargaDoctrinaPendiente={path:preparada.path,sha256};
  }
  if(!usuarioActual?.es_admin||usuarioActual.id!==actor)throw new Error('La sesión cambió. Vuelva a iniciar la operación.');
  estado.textContent='Comprobando integridad y registrando el borrador…';
  await peticionDoctrina('registrar',{...datos,path:cargaDoctrinaPendiente.path});
  cargaDoctrinaPendiente=null;document.getElementById('doctrinaFormulario').reset();
  estado.textContent='Original incorporado para revisión. No se ha publicado a participantes.';
  await cargarBibliotecaDoctrina();
 }catch(error){estado.textContent=error.message+(cargaDoctrinaPendiente?' El archivo ya está cargado; puede reintentar el registro.':'');}
 finally{boton.disabled=false;}
}


function abrirRevisionDoctrina(d){
 const modal=document.getElementById('doctrinaRevisionDialogo');
 document.getElementById('doctrinaRevisionId').value=d.version_id;
 document.getElementById('doctrinaRevisionTitulo').textContent=d.titulo;
 document.getElementById('doctrinaRevisionNota').value=d.nota_revision||'';
 document.getElementById('doctrinaRevisionEstado').textContent='Estado: '+d.estado+'. La aprobación mantiene el acceso exclusivo de Superadmin.';
 modal.showModal();
}
async function guardarRevisionDoctrina(decision){
 const estado=document.getElementById('doctrinaRevisionEstado');
 const botones=[...document.querySelectorAll('#doctrinaRevisionDialogo button')];
 if(botones.some(b=>b.disabled))return;
 botones.forEach(b=>b.disabled=true);
 try{
  await peticionDoctrina('revisar',{id:document.getElementById('doctrinaRevisionId').value,decision,nota:document.getElementById('doctrinaRevisionNota').value.trim()});
  document.getElementById('doctrinaRevisionDialogo').close();await cargarBibliotecaDoctrina();
 }catch(e){estado.textContent=e.message;}finally{botones.forEach(b=>b.disabled=false);}
}
async function cambiarRetiroDoctrina(d,action,boton){
 if(action==='retirar'&&!confirm('¿Eliminar «'+d.titulo+'» de la biblioteca activa? Podrá recuperarlo en Mostrar eliminados.'))return;
 boton.disabled=true;
 try{await peticionDoctrina(action,{id:d.version_id});await cargarBibliotecaDoctrina();}
 catch(e){document.getElementById('doctrinaEstado').textContent=e.message;}
 finally{boton.disabled=false;}
}

let solicitudVisorDoctrina=0;
let urlVisorDoctrina=null;
function cerrarVisorDoctrina(){
 solicitudVisorDoctrina++;urlVisorDoctrina=null;
 document.getElementById('doctrinaVisorMarco')?.removeAttribute('src');
 document.getElementById('doctrinaVisorDialogo')?.close();
}
async function abrirVisorDoctrina(d,boton){
 const solicitud=++solicitudVisorDoctrina,actor=usuarioActual?.id;
 const modal=document.getElementById('doctrinaVisorDialogo');
 document.getElementById('doctrinaVisorTitulo').textContent=d.titulo;
 document.getElementById('doctrinaVisorEstado').textContent='Verificando integridad y abriendo el PDF…';
 document.getElementById('doctrinaVisorPagina').value='1';
 document.getElementById('doctrinaVisorMarco').removeAttribute('src');urlVisorDoctrina=null;
 if(!modal.open)modal.showModal();boton.disabled=true;
 try{
  const result=await peticionDoctrina('visualizar',{id:d.version_id});
  if(solicitud!==solicitudVisorDoctrina||!usuarioActual?.es_admin||usuarioActual.id!==actor)return;
  const url=new URL(result.url),origen=new URL(SUPABASE_URL).origin;
  if(url.protocol!=='https:'||url.origin!==origen||!url.pathname.startsWith('/storage/v1/object/sign/'))throw new Error('Referencia de consulta no válida');
  urlVisorDoctrina=url.href;
  document.getElementById('doctrinaVisorMarco').src=urlVisorDoctrina+'#page=1';
  document.getElementById('doctrinaVisorEstado').textContent='Original verificado · '+d.estado+'. Si el visor no se muestra, use Descargar original. Para volver a cargarlo después de un minuto, cierre y abra la consulta.';
 }catch(e){if(solicitud===solicitudVisorDoctrina)document.getElementById('doctrinaVisorEstado').textContent=e.message;}
 finally{boton.disabled=false;}
}
function irPaginaVisorDoctrina(){
 const pagina=Number(document.getElementById('doctrinaVisorPagina').value);
 if(!urlVisorDoctrina||!Number.isSafeInteger(pagina)||pagina<1||pagina>10000)return;
 document.getElementById('doctrinaVisorMarco').src=urlVisorDoctrina+'#page='+pagina;
}
document.getElementById('doctrinaVisorDialogo')?.addEventListener('cancel',e=>{e.preventDefault();cerrarVisorDoctrina();});

let versionTextoDoctrina=null,consultaTextoDoctrina=0,paginaTextoCargada=null,textoPaginaBase='';
function cerrarTextoDoctrina(forzar=false){if(!forzar&&document.getElementById('doctrinaTextoContenido').value!==textoPaginaBase&&!confirm('Hay cambios sin guardar. ¿Cerrar y descartarlos?'))return;consultaTextoDoctrina++;versionTextoDoctrina=null;document.getElementById('doctrinaTextoContenido').value='';document.getElementById('doctrinaTextoDialogo').close();}
async function abrirTextoDoctrina(d){
 paginaTextoCargada=null;textoPaginaBase='';document.getElementById('doctrinaTextoContenido').value='';versionTextoDoctrina=d.version_id;document.getElementById('doctrinaTextoTitulo').textContent=d.titulo;
 document.getElementById('doctrinaTextoPagina').value=1;document.getElementById('doctrinaTextoDialogo').showModal();await accionTextoDoctrina('texto_pagina');
}
async function accionTextoDoctrina(action){
 if(!versionTextoDoctrina||!usuarioActual?.es_admin)return;
 if(action==='texto_pagina'&&document.getElementById('doctrinaTextoContenido').value!==textoPaginaBase&&!confirm('Hay cambios sin guardar. ¿Cargar otra página y descartarlos?'))return;
 if(action==='texto_revisar_pagina'&&Number(document.getElementById('doctrinaTextoPagina').value)!==paginaTextoCargada){document.getElementById('doctrinaTextoEstado').textContent='Cargue la página seleccionada antes de revisarla.';return;}
 const id=versionTextoDoctrina,consulta=++consultaTextoDoctrina,actor=usuarioActual.id;
 const botones=[...document.querySelectorAll('#doctrinaTextoDialogo button')];botones.forEach(b=>b.disabled=true);
 const estado=document.getElementById('doctrinaTextoEstado');estado.textContent='Procesando…';
 try{
  const r=await peticionDoctrina(action,{id,pagina:Number(document.getElementById('doctrinaTextoPagina').value),texto:document.getElementById('doctrinaTextoContenido').value,pagina_sin_texto:document.getElementById('doctrinaTextoSinTexto').checked});
  if(consulta!==consultaTextoDoctrina||versionTextoDoctrina!==id||usuarioActual?.id!==actor)return;
  document.getElementById('doctrinaTextoExtraer').hidden=!!r.extraido;
  if(!r.extraido){document.getElementById('doctrinaTextoContenido').value='';estado.textContent='Aún no hay texto extraído. Extraer texto no aprueba su contenido ni modifica el original.';return;}
  document.getElementById('doctrinaTextoSinTexto').checked=r.pagina.pagina_sin_texto===true;
  paginaTextoCargada=r.pagina.numero;document.getElementById('doctrinaTextoPagina').value=r.pagina.numero;
  textoPaginaBase=r.pagina.texto;document.getElementById('doctrinaTextoContenido').value=r.pagina.texto;document.getElementById('doctrinaTextoPagina').max=r.total_paginas;
  estado.textContent=r.estado+' · '+r.total_paginas+' páginas · '+r.pendientes+' pendientes de revisión.'+(r.pagina.requiere_ocr?' Esta página tiene poco o ningún texto detectable: contraste con el PDF antes de transcribirla o marcarla sin texto.':'');
 }catch(e){if(consulta===consultaTextoDoctrina)estado.textContent=e.message+' El texto escrito se conserva.';}
 finally{botones.forEach(b=>b.disabled=false);}
}
async function buscarTextoDoctrina(){
 const solicitud=consultaBibliotecaDoctrina,busqueda=++consultaBusquedaTextoDoctrina,actor=usuarioActual?.id;
 const resultados=document.getElementById('doctrinaBusquedaResultados');resultados.replaceChildren();
 try{
  const r=await peticionDoctrina('texto_buscar',{consulta:document.getElementById('doctrinaConsultaTexto').value.trim()});
  if(!usuarioActual?.es_admin||usuarioActual.id!==actor||consultaBibliotecaDoctrina!==solicitud||consultaBusquedaTextoDoctrina!==busqueda)return;
  if(r.cobertura){const aviso=document.createElement('p');aviso.className='admin-empty-state';aviso.textContent=`Cobertura: ${r.cobertura.consultables} de ${r.cobertura.vigentes} originales vigentes consultables. ${r.cobertura.pendientes} pendientes de extracción o aprobación del texto. Las coincidencias no constituyen una conclusión doctrinaria.`;resultados.appendChild(aviso);}
  for(const item of r.resultados){const articulo=document.createElement('article');articulo.className='doctrina-documento';const titulo=document.createElement('h4');titulo.textContent=item.titulo+' · página '+item.pagina+' · versión '+item.version;const texto=document.createElement('p');texto.textContent=item.fragmento;articulo.append(titulo,texto);const boton=document.createElement('button');boton.type='button';boton.className='btn-secondary';boton.textContent='Consultar original';boton.onclick=async()=>{await abrirVisorDoctrina({version_id:item.version_id,titulo:item.titulo,estado:'vigente'},boton);document.getElementById('doctrinaVisorPagina').value=item.pagina;irPaginaVisorDoctrina();};articulo.appendChild(boton);resultados.appendChild(articulo);}
  if(!r.resultados.length){const vacio=document.createElement('p');vacio.textContent='Sin coincidencias en textos revisados y aprobados. Esto no demuestra que el tema esté ausente de los originales pendientes.';resultados.appendChild(vacio);}
 }catch(e){if(usuarioActual?.id===actor&&consultaBibliotecaDoctrina===solicitud&&consultaBusquedaTextoDoctrina===busqueda)resultados.textContent=e.message;}
}
document.getElementById('doctrinaTextoDialogo')?.addEventListener('cancel',e=>{e.preventDefault();cerrarTextoDoctrina();});

async function contrastarPaginaTextoDoctrina(boton){
 if(!versionTextoDoctrina)return;
 await abrirVisorDoctrina({version_id:versionTextoDoctrina,titulo:document.getElementById('doctrinaTextoTitulo').textContent,estado:'vigente'},boton);
 document.getElementById('doctrinaVisorPagina').value=paginaTextoCargada||1;irPaginaVisorDoctrina();
}

function invalidarAgenteDoctrina(){
 consultaAgenteDoctrina++;controladorAgenteDoctrina?.abort();controladorAgenteDoctrina=null;
 const salida=document.getElementById('doctrinaAgenteResultado');salida?.replaceChildren();salida?.setAttribute('aria-busy','false');
 const boton=document.getElementById('doctrinaAgenteConsultar');if(boton)boton.disabled=false;
}
async function consultarAgenteDoctrina(){
 controladorAgenteDoctrina?.abort();
 const controlador=new AbortController();controladorAgenteDoctrina=controlador;
 const espera=setTimeout(()=>controlador.abort(),45000);
 const turno=++consultaAgenteDoctrina,biblioteca=consultaBibliotecaDoctrina,actor=usuarioActual?.id;
 const salida=document.getElementById('doctrinaAgenteResultado'),boton=document.getElementById('doctrinaAgenteConsultar');
 const vigente=()=>usuarioActual?.es_admin&&usuarioActual.id===actor&&turno===consultaAgenteDoctrina&&biblioteca===consultaBibliotecaDoctrina;
 salida.replaceChildren();salida.textContent='Consultando textos aprobados…';salida.setAttribute('aria-busy','true');boton.disabled=true;
 try{
  const r=await peticionDoctrina('agente_consultar',{pregunta:document.getElementById('doctrinaAgentePregunta').value,consulta:document.getElementById('doctrinaAgenteTerminos').value,antecedentes:document.getElementById('doctrinaAgenteAntecedentes').value},controlador.signal);
  if(!vigente())return;
  salida.replaceChildren();const informe=r.informe;
  if(informe.aviso){const aviso=document.createElement('p');aviso.textContent=informe.aviso;salida.appendChild(aviso);}
  if(informe.cobertura){const p=document.createElement('p');p.textContent=`Cobertura: ${informe.cobertura.consultables} de ${informe.cobertura.vigentes} originales vigentes; ${informe.cobertura.pendientes} pendientes.`;salida.appendChild(p);}
  for(const seccion of informe.secciones){const h=document.createElement('h4'),p=document.createElement('p');h.textContent=seccion.titulo;p.textContent=seccion.texto;p.style.whiteSpace='pre-wrap';salida.append(h,p);}
  for(const fuente of informe.fuentes){const a=document.createElement('article');a.className='doctrina-documento';const h=document.createElement('h4'),p=document.createElement('p'),huella=document.createElement('p'),b=document.createElement('button');h.textContent=`[${fuente.referencia}] ${fuente.titulo} · ${fuente.clase} · página PDF ${fuente.pagina} · versión ${fuente.version}`;p.textContent=fuente.fragmento;huella.textContent='SHA-256: '+fuente.sha256;huella.style.overflowWrap='anywhere';b.type='button';b.className='btn-secondary';b.textContent='Contrastar original';b.onclick=async()=>{await abrirVisorDoctrina({version_id:fuente.version_id,titulo:fuente.titulo,estado:'vigente'},b);if(!vigente())return;document.getElementById('doctrinaVisorPagina').value=fuente.pagina;irPaginaVisorDoctrina();};a.append(h,p,huella,b);salida.appendChild(a);}
 }catch(e){if(vigente())salida.textContent=e.name==='AbortError'?'La consulta superó el tiempo de espera. Puede reintentar; la pregunta se conserva.':e.message;}
 finally{clearTimeout(espera);if(controladorAgenteDoctrina===controlador)controladorAgenteDoctrina=null;if(vigente()){boton.disabled=false;salida.setAttribute('aria-busy','false');}}
}

let doctrinaPreparacionActiva=false;
async function prepararBibliotecaGroq(){
 if(!usuarioActual?.es_admin||doctrinaPreparacionActiva)return;
 if(!confirm('Se extraerá e indexará automáticamente el texto de los originales vigentes. Después se autorizarán sus pasajes legibles para consultas con Groq. Los PDF permanecerán privados. ¿Continuar?'))return;
 doctrinaPreparacionActiva=true;
 const actor=usuarioActual.id;
 const boton=document.getElementById('doctrinaPrepararGroq');
 const estado=document.getElementById('doctrinaPrepararEstado');
 if(boton)boton.disabled=true;
 const informar=mensaje=>{if(estado&&usuarioActual?.id===actor)estado.textContent=mensaje;};
 const errores=[];
 try{
  const lista=await peticionDoctrina('llm_listar');
  const vigentes=lista.autorizaciones||[];
  let extraidos=0,omitidos=0;
  const pendientes=vigentes.filter(x=>!x.texto_indexado&&!x.texto_aprobado);
  informar('Biblioteca: '+vigentes.length+' originales vigentes. '+pendientes.length+' pendientes de extracción.');
  for(let i=0;i<pendientes.length;i++){
   if(!usuarioActual?.es_admin||usuarioActual.id!==actor){informar('Preparación interrumpida por cambio de sesión.');return;}
   const item=pendientes[i];
   informar('Extrayendo '+(i+1)+' de '+pendientes.length+': '+item.titulo);
   try{
    const resultado=await peticionDoctrina('texto_extraer',{id:item.version_id});
    if(resultado.extraido)extraidos++;else{omitidos++;errores.push(item.titulo+': extracción sin contenido consultable');}
   }catch(e){omitidos++;errores.push(item.titulo+': '+String(e.message||'no se pudo extraer').slice(0,100));}
  }
  informar('Indexación terminada. Habilitando pasajes legibles de los originales vigentes para Groq…');
  const autorizacion=await peticionDoctrina('llm_autorizar_biblioteca',{confirmacion:true});
  const activos=Number(autorizacion.autorizados||0);
  informar('Biblioteca: '+activos+' versiones autorizadas para Groq; '+extraidos+' extracciones nuevas; '+omitidos+' originales requieren atención.'+(errores.length?' Pendientes: '+errores.slice(0,5).join(' | '):''));
  await cargarAutorizacionesGroq();
 }catch(e){informar('No se completó la preparación: '+e.message+'. El progreso extraído permanece y puede reanudarse.');}
 finally{doctrinaPreparacionActiva=false;if(boton)boton.disabled=false;}
}

async function cargarAutorizacionesGroq(){
 const turno=++consultaPermisosGroq,actor=usuarioActual?.id,salida=document.getElementById('doctrinaGroqPermisos');salida.textContent='Consultando permisos…';
 try{const r=await peticionDoctrina('llm_listar');if(turno!==consultaPermisosGroq||!usuarioActual?.es_admin||usuarioActual.id!==actor)return;salida.replaceChildren();
  for(const item of r.autorizaciones){const fila=document.createElement('article');fila.className='doctrina-documento';const p=document.createElement('p'),b=document.createElement('button');p.textContent=`${item.titulo} · versión ${item.version} · ${item.autorizado?'Autorizado para Groq':'Sin autorización para Groq'}`;b.type='button';b.className='btn-secondary';b.textContent=item.autorizado?'Revocar permiso':'Autorizar fragmentos';b.disabled=!item.autorizado&&!item.texto_aprobado;
   b.onclick=async()=>{if(!item.autorizado&&!confirm(`¿Autoriza enviar fragmentos de «${item.titulo}», versión ${item.version}, a Groq usando GPT-OSS 120B? El proveedor recibirá también la pregunta y los antecedentes de cada consulta.`))return;b.disabled=true;try{await peticionDoctrina(item.autorizado?'llm_revocar':'llm_autorizar',{id:item.version_id,confirmacion:!item.autorizado});if(turno===consultaPermisosGroq&&usuarioActual?.id===actor){invalidarAgenteDoctrina();await cargarAutorizacionesGroq();}}catch(e){if(turno===consultaPermisosGroq&&usuarioActual?.id===actor){p.textContent=e.message;b.disabled=false;}}};fila.append(p,b);salida.appendChild(fila);}
  if(!r.autorizaciones.length)salida.textContent='No hay originales vigentes para autorizar.';
 }catch(e){if(turno===consultaPermisosGroq&&usuarioActual?.id===actor)salida.textContent=e.message;}
}
