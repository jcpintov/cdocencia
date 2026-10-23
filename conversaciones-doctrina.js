let revisionConversaciones=0,conversacionesCargadas=0;
function limpiarConversacionesDoctrina(){revisionConversaciones++;conversacionesCargadas=0;document.getElementById('doctrinaCasosLista')?.replaceChildren();const e=document.getElementById('doctrinaCasosEstado');if(e)e.textContent='';document.getElementById('doctrinaCasosMas')?.classList.add('hidden');}
async function cargarConversacionesDoctrina(mas=false){
 if(!usuarioActual?.es_admin)return;
 const actor=usuarioActual,n=++revisionConversaciones,lista=document.getElementById('doctrinaCasosLista'),estado=document.getElementById('doctrinaCasosEstado'),botonMas=document.getElementById('doctrinaCasosMas');
 const vigente=()=>usuarioActual===actor&&n===revisionConversaciones;
 if(!mas){conversacionesCargadas=0;lista.replaceChildren();}estado.textContent='Consultando conversaciones…';botonMas.disabled=true;
 try{
  const r=await peticionDoctrina('casos_listar',{estado:document.getElementById('doctrinaCasosFiltro').value,desde:conversacionesCargadas});
  if(!vigente())return;if(!Array.isArray(r.conversaciones))throw Error('El servidor entregó una lista incompleta');
  for(const caso of r.conversaciones){
   const ficha=document.createElement('details');ficha.className='doctrina-caso';const titulo=document.createElement('summary');
   titulo.textContent=({candidato:'Pendiente',revisado:'Aprobada',retirado:'Retirada'}[caso.estado]||'Pendiente')+' · '+String(caso.pregunta||'Conversación').slice(0,180);ficha.appendChild(titulo);
   const fecha=document.createElement('p');fecha.textContent='Guardada: '+new Date(caso.creado_en).toLocaleString('es-CL',{timeZone:'America/Santiago'});ficha.appendChild(fecha);
   const mensajes=Array.isArray(caso.conversacion)&&caso.conversacion.length?caso.conversacion:[{role:'user',content:caso.pregunta},{role:'assistant',content:caso.respuesta}];
   for(const m of mensajes){const p=document.createElement('p');p.className='doctrina-caso-mensaje';p.textContent=(m.role==='assistant'?'Asistente: ':'Consultante: ')+String(m.content||'');ficha.appendChild(p);}
   const fuentes=document.createElement('p');fuentes.textContent='Referencias de la respuesta: '+(caso.fuentes||[]).map(f=>'versión '+f.version_id+' · página '+f.pagina+' · SHA '+f.sha256).join('; ');if(!caso.fuentes?.length)fuentes.textContent='Sin referencias documentales en esta respuesta.';ficha.appendChild(fuentes);
   const b=document.createElement('button');b.type='button';b.className='btn-secondary';b.textContent=caso.estado==='revisado'?'Retirar del JSON':'Aprobar para el JSON';
   const actual=()=>usuarioActual===actor&&lista.contains(ficha);
   b.onclick=async()=>{
    if(!actual()||!confirm(caso.estado==='revisado'?'¿Retirar esta conversación de la memoria JSON?':'¿Aprueba esta conversación después de revisar su contenido y las fuentes citadas?'))return;
    b.disabled=true;eliminar.disabled=true;
    try{await peticionDoctrina(caso.estado==='revisado'?'caso_retirar':'caso_aprobar',{id:caso.id,confirmacion:true});if(!actual())return;vaciarMemoriaSesionLocal();await cargarMemoriaAgenteSesion();if(actual())await cargarConversacionesDoctrina();}
    catch(e){if(actual()){estado.textContent=e.message;b.disabled=false;eliminar.disabled=false;}}
   };
   const eliminar=document.createElement('button');eliminar.type='button';eliminar.className='btn-secondary btn-eliminar-registro';eliminar.textContent='Eliminar registro';
   eliminar.onclick=async()=>{
    if(!actual()||!confirm('¿Eliminar definitivamente esta conversación guardada? Se quitará del listado y de la memoria JSON. Esta acción no se puede deshacer.'))return;
    b.disabled=true;eliminar.disabled=true;
    try{const r=await peticionDoctrina('caso_eliminar',{id:caso.id,confirmacion:true});if(!actual())return;if(r.eliminado!==true)throw Error('El servidor no confirmó la eliminación');vaciarMemoriaSesionLocal();await cargarMemoriaAgenteSesion();if(actual())await cargarConversacionesDoctrina();}
    catch(e){if(actual()){estado.textContent=e.message;b.disabled=false;eliminar.disabled=false;}}
   };
   const acciones=document.createElement('div');acciones.className='doctrina-caso-acciones';acciones.append(b,eliminar);ficha.appendChild(acciones);lista.appendChild(ficha);
  }
  conversacionesCargadas+=r.conversaciones.length;estado.textContent=conversacionesCargadas+' de '+r.total+' conversaciones. Solo las aprobadas forman parte del JSON.';botonMas.classList.toggle('hidden',!r.hay_mas);
 }catch(e){if(vigente())estado.textContent=e.message;}
 finally{if(vigente())botonMas.disabled=false;}
}
async function descargarMemoriaAprobada(){
 if(!usuarioActual?.es_admin)return;const actor=usuarioActual,n=revisionConversaciones,e=document.getElementById('doctrinaCasosEstado');e.textContent='Preparando JSON aprobado…';
 try{const r=await peticionDoctrina('memoria_exportar');if(usuarioActual!==actor||n!==revisionConversaciones)return;
  if(r.memoria?.schema_version!==1||!Array.isArray(r.memoria.casos))throw Error('Memoria JSON incompleta');
  const url=URL.createObjectURL(new Blob([JSON.stringify(r.memoria,null,2)],{type:'application/json;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='memoria-doctrina-aprobada.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);e.textContent='JSON descargado con '+r.memoria.casos.length+' conversaciones aprobadas.';
 }catch(error){if(usuarioActual===actor&&n===revisionConversaciones)e.textContent=error.message;}
}
