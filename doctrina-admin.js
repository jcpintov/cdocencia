/* Biblioteca reservada a Superadmin. No contiene documentos ni claves. */
let bibliotecaDoctrina = {documentos:[],inventario:[]};
let consultaBibliotecaDoctrina = 0;
let cargaDoctrinaPendiente = null;
function limpiarBibliotecaDoctrina(){
 consultaBibliotecaDoctrina++;
 bibliotecaDoctrina={documentos:[],inventario:[]};cargaDoctrinaPendiente=null;
 document.getElementById('doctrinaFormulario')?.reset();
 for(const id of ['doctrinaDocumentos','doctrinaInventario'])document.getElementById(id)?.replaceChildren();
}
async function peticionDoctrina(action,datos={}){
 if(!usuarioActual?.es_admin)throw new Error('Acceso exclusivo de Superadmin');
 const {data,error}=await sbApp.auth.getSession();
 if(error||!data?.session?.access_token)throw new Error('Sesión vencida. Inicie sesión nuevamente.');
 const response=await fetch('/api/admin-doctrina',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({action,...datos})});
 const result=await response.json();
 if(!response.ok||!result.ok)throw new Error(result.error||'No se pudo completar la operación');
 return result;
}
async function cargarBibliotecaDoctrina(){
 if(!usuarioActual?.es_admin)return;
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
  const filas=bibliotecaDoctrina[tipo].filter(d=>normalizarBusquedaAdmin(`${d.titulo||d.archivo} ${d.clase}`).includes(buscar));
  if(!filas.length){const p=document.createElement('p');p.className='admin-empty-state';p.textContent=buscar?'Sin coincidencias para esta búsqueda.':tipo==='documentos'?'Todavía no hay originales incorporados.':'No hay registros en el inventario.';cont.appendChild(p);}
  filas.forEach(d=>{
   const card=document.createElement('article');card.className='doctrina-documento';
   const titulo=document.createElement('h4');titulo.textContent=d.titulo||d.archivo;
   const detalle=document.createElement('p');detalle.textContent=tipo==='documentos'?`${d.clase} · ${d.estado} · ${d.revision||'sin versión'} · ${Math.ceil((d.bytes||0)/1024)} KB`:`${d.clase} · ${d.estado} · ${d.grado_validado?'Grado revisado':'Grado pendiente'} · ${d.derechos_verificados?'Derechos revisados':'Derechos pendientes'}`;
   card.append(titulo,detalle);
   if(tipo==='documentos'&&d.version_id){const boton=document.createElement('button');boton.type='button';boton.className='admin-link-btn';boton.textContent='Descargar original';boton.addEventListener('click',()=>descargarOriginalDoctrina(d.version_id,boton));card.appendChild(boton);}
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
