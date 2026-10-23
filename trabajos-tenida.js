let reintentoOradorHasta=0;
/* Trabajos y conclusiones privados. No persiste textos en caché del navegador. */
let trabajoTenidaActual=null,trabajosPeticion=0,trabajosOcupado=false,trabajosCarga=null;
function limpiarTrabajosTenida(){
 trabajosPeticion++;trabajoTenidaActual=null;trabajosOcupado=false;trabajosCarga=null;reintentoOradorHasta=0;
 for(const id of ['trabajosLista','trabajosDetalle','trabajosEstado'])document.getElementById(id)?.replaceChildren();
 document.getElementById('trabajosFormulario')?.reset();
 const enviar=document.querySelector('#trabajosFormulario button[type=submit]');if(enviar)enviar.disabled=false;
 if(document.getElementById('trabajosFormulario'))document.getElementById('trabajosFormulario').hidden=true;
}
async function peticionTrabajos(action,datos={},binario=false){
 if(['revisar','contrastar','generar'].includes(action)&&Date.now()<reintentoOradorHasta)throw Error('Groq sigue en espera. Reanude en '+Math.ceil((reintentoOradorHasta-Date.now())/1000)+' segundos. El avance se conserva.');
 if((!usuarioActual?.es_admin||usuarioActual?.rol==='ADMIN'))throw Error('Acceso exclusivo de Superadmin');
 const {data,error}=await sbApp.auth.getSession();if(error||!data?.session?.access_token)throw Error('Sesión vencida. Inicie sesión nuevamente.');
 const r=await fetch('/api/admin-orador',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({action,...datos})});
 if(binario&&r.ok)return r.blob();
 const result=await r.json();if(!r.ok||!result.ok){
  if(result.codigo==='GROQ_LIMITE')reintentoOradorHasta=Date.now()+Math.max(1,Math.min(86400,Number(result.reintentar_en)||15))*1000;
  const etapa={contrastar:'Contraste documental',generar:'Generación de oratoria',decision:'Decisión del Orador',revisar:'Revisión del trabajo'}[result.etapa];
  const referencia=typeof result.referencia==='string'&&/^[0-9a-f-]{36}$/i.test(result.referencia)?` Referencia: ${result.referencia}.`:'';
  throw Error((etapa?etapa+': ':'')+(result.error||'No se pudo completar el paso.')+referencia);
 }return result;
}
function elementoTrabajo(tag,texto,clase){const e=document.createElement(tag);if(texto!==undefined)e.textContent=texto;if(clase)e.className=clase;return e;}
function botonTrabajo(texto,fn,primario=false){const b=elementoTrabajo('button',texto,primario?'btn-primary':'btn-secondary');b.type='button';b.onclick=fn;return b;}
async function cargarTrabajosTenida(){
 if((!usuarioActual?.es_admin||usuarioActual?.rol==='ADMIN')||trabajosOcupado)return;
 const peticion=++trabajosPeticion;const estado=document.getElementById('trabajosEstado');estado.textContent='Cargando trabajos…';
 try{const r=await peticionTrabajos('listar');if(peticion!==trabajosPeticion)return;
  const lista=document.getElementById('trabajosLista');lista.replaceChildren();
  if(!r.trabajos.length)lista.append(elementoTrabajo('p','Aún no hay trabajos incorporados.'));
  r.trabajos.forEach(w=>{const b=botonTrabajo(w.ficha.tema,()=>abrirTrabajoTenida(w.id));b.append(elementoTrabajo('small',`${w.ficha.autor} · ${w.ficha.fecha} · ${w.ficha.grado}°`));lista.append(b);});estado.textContent='';
 }catch(e){if(peticion===trabajosPeticion)estado.textContent=e.message;}
}
function cambiarTipoTrabajo(tipo){const f=document.getElementById('trabajosFormulario');const ceremonial=tipo!=='ordinaria';document.getElementById('trabajosHomenajeados').hidden=!ceremonial;f.elements.homenajeados.required=ceremonial;const grado={iniciacion:'1',aumento:'2',exaltacion:'3'}[tipo];if(grado)f.elements.grado.value=grado;}
function nuevoTrabajoTenida(){if(trabajosOcupado)return;trabajosPeticion++;trabajoTenidaActual=null;trabajosCarga=null;document.getElementById('trabajosDetalle').replaceChildren();const f=document.getElementById('trabajosFormulario');f.hidden=false;f.reset();cambiarTipoTrabajo('ordinaria');f.elements.tema.focus();}
async function subirTrabajoTenida(){
 if(trabajosOcupado)return;const f=document.getElementById('trabajosFormulario');if(!f.reportValidity())return;
 const file=f.elements.archivo.files[0],extension=file?.name.split('.').pop().toLowerCase();
 const estado=document.getElementById('trabajosEstado');if(!file||!['pdf','docx'].includes(extension)||file.size>10485760){estado.textContent='Adjunte PDF o DOCX de hasta 10 MB.';return;}
 const ficha=Object.fromEntries(['tema','autor','fecha','tipo','uso_ia','nota_ia','homenajeados'].map(k=>[k,f.elements[k].value]));ficha.grado=Number(f.elements.grado.value);
 const datos={ficha,extension,bytes:file.size,autoriza_ia:f.elements.autoriza_ia.checked};
 const peticion=++trabajosPeticion;trabajosOcupado=true;f.querySelector('button[type=submit]').disabled=true;estado.textContent='Guardando el original privado y extrayendo el texto completo…';
 try{
  if(!trabajosCarga||trabajosCarga.file!==file){
   const inicio=await peticionTrabajos('preparar',datos);
   if(peticion!==trabajosPeticion)return;
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join('');
   const {error}=await sbApp.storage.from('trabajos-tenida-privados').uploadToSignedUrl(inicio.path,inicio.token,file,{contentType:extension==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
   if(peticion!==trabajosPeticion)return;
   if(error)throw Error('No se pudo cargar el original. Reintente.');trabajosCarga={file,path:inicio.path,sha256:hash};
  }
  const r=await peticionTrabajos('registrar',{...datos,path:trabajosCarga.path,sha256:trabajosCarga.sha256});if(peticion!==trabajosPeticion)return;
  trabajoTenidaActual=r.trabajo;trabajosCarga=null;f.reset();f.hidden=true;renderizarTrabajoTenida();estado.textContent='Original guardado. Puede iniciar la revisión.';
 }catch(e){if(peticion===trabajosPeticion)estado.textContent=e.message;}
 finally{if(peticion===trabajosPeticion){trabajosOcupado=false;f.querySelector('button[type=submit]').disabled=false;}}
}
async function abrirTrabajoTenida(id){
 if(trabajosOcupado)return;const p=++trabajosPeticion;const estado=document.getElementById('trabajosEstado');estado.textContent='Abriendo trabajo…';
 try{const r=await peticionTrabajos('obtener',{id});if(p!==trabajosPeticion)return;trabajoTenidaActual=r.trabajo;document.getElementById('trabajosFormulario').hidden=true;renderizarTrabajoTenida();estado.textContent='';}catch(e){if(p===trabajosPeticion)estado.textContent=e.message;}
}
async function pasoTrabajoTenida(action,datos={}){
 if(trabajosOcupado||!trabajoTenidaActual)return;
 const p=++trabajosPeticion;trabajosOcupado=true;
 const estado=document.getElementById('trabajosEstado');
 try{
  do{
   estado.textContent=action==='revisar'?`Revisando bloque ${trabajoTenidaActual.datos.revision_bloques.length+1} de ${trabajoTenidaActual.bloques_total}…`:action==='generar'?'Elaborando las conclusiones del Orador…':action==='contrastar'?'Contrastando el trabajo con la biblioteca…':'Guardando…';
   document.getElementById('trabajosDetalle').querySelectorAll('button').forEach(b=>b.disabled=true);
   const r=await peticionTrabajos(action,{id:trabajoTenidaActual.id,revision:trabajoTenidaActual.revision,...datos});if(p!==trabajosPeticion)return;
   trabajoTenidaActual=r.trabajo;renderizarTrabajoTenida();
  }while(action==='revisar'&&trabajoTenidaActual.datos.revision_bloques.length<trabajoTenidaActual.bloques_total);
  estado.textContent=action==='revisar'?'Revisión de todos los bloques guardada. Continúe con el contraste documental.':action==='contrastar'?'Contraste guardado. Revise el informe y guarde su decisión para habilitar la oratoria.':action==='decision'?(trabajoTenidaActual.datos.decision?.decision==='continuar'?'Decisión guardada. Ya puede elaborar el texto del Orador.':'Decisión guardada: se requieren correcciones antes de elaborar la oratoria.'):action==='generar'?'Oratoria generada y guardada. Puede revisarla y editarla en «Texto del Orador».':'Paso guardado.';
 }catch(e){if(p===trabajosPeticion)estado.textContent=e.message;}
 finally{if(p===trabajosPeticion){trabajosOcupado=false;document.getElementById('trabajosDetalle').querySelectorAll('button').forEach(b=>b.disabled=false);}}
}
async function descargarTrabajoTenida(tipo){
 if(!trabajoTenidaActual)return;const id=trabajoTenidaActual.id,p=trabajosPeticion;
 try{
  if(tipo==='original'){const r=await peticionTrabajos('original',{id});if(p!==trabajosPeticion)return;const u=new URL(r.url);if(u.protocol!=='https:')throw Error('URL inválida');window.open(u.href,'_blank','noopener,noreferrer');return;}
  const blob=tipo==='informe'?new Blob([informeTrabajoTenida(trabajoTenidaActual)],{type:'text/plain;charset=utf-8'}):await peticionTrabajos('exportar',{id},true);
  if(p!==trabajosPeticion)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=tipo==='informe'?'Revision_del_trabajo.txt':'Conclusiones_del_Orador.docx';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(e){if(p===trabajosPeticion)document.getElementById('trabajosEstado').textContent=e.message;}
}
function informeTrabajoTenida(w){
 const d=w.datos,e=d.extraccion;
 return [`REVISIÓN PRIVADA DEL TRABAJO — separada de la oratoria`,`${d.ficha.tema}\n${d.ficha.autor} · ${d.ficha.fecha} · Grado ${d.ficha.grado}`,`SÍNTESIS Y EVIDENCIA POR BLOQUE`,...d.revision_bloques.flatMap(b=>[`Bloque ${b.numero}: ${b.sintesis}`,...(b.pasajes||[]).map(p=>`Pasaje verificado: «${p}»`)]),`1. Coincidencias / posible plagio\nContraste limitado al contexto documental disponible y autorizado, sin búsqueda web ni certificación de originalidad.`,...d.revision_bloques.flatMap(b=>b.coincidencias.map(c=>`Bloque ${b.numero} · ${c.titulo}, p. ${c.pagina}\n«${c.pasaje_normalizado}»\n${c.advertencia}`)),`2. Citas y atribuciones`,...d.revision_bloques.flatMap(b=>b.observaciones.filter(o=>o.tipo==='citas').map(o=>`Bloque ${b.numero}: «${o.pasaje}»\n${o.explicacion}`)),`3. Extensión\n${e.palabras} palabras · ${e.minutos} min estimados a 117 palabras/min · ${e.paginas===null?'Páginas DOCX pendientes de contraste visual':e.paginas+' páginas PDF'}\n${e.exceso_paginas||e.exceso_tiempo?'Supera al menos uno de los umbrales (8 páginas / 25 minutos).':'Sin exceso verificable de tiempo'+(e.paginas===null?'; páginas por comprobar.': ' o páginas.')}`,`4. Asistencia de IA\nDeclaración: ${d.ficha.uso_ia}. ${d.ficha.nota_ia}\nNo se puede determinar autoría de IA por estilo ni concluir ausencia de uso.`,...d.revision_bloques.flatMap(b=>b.observaciones.filter(o=>o.tipo==='ia').map(o=>`Bloque ${b.numero}: «${o.pasaje}»\n${o.explicacion}`)),`5. Adecuación al grado y a los principios`,...d.revision_bloques.flatMap(b=>b.observaciones.filter(o=>o.tipo==='contenido').map(o=>`Bloque ${b.numero}: «${o.pasaje}»\n${o.explicacion}`)),`6. Argumentación y posibles falacias`,...d.revision_bloques.flatMap(b=>b.observaciones.filter(o=>o.tipo==='argumentacion').map(o=>`Bloque ${b.numero}: «${o.pasaje}»\n${o.explicacion}`)),...e.avisos,`COBERTURA: ${d.revision_bloques.length}/${w.bloques_total} bloques revisados. Los aspectos sin observaciones requieren igualmente revisión humana.`,d.contraste?'CONTRASTE DOCUMENTAL\n'+d.contraste.secciones.map(s=>s.texto).join('\n'):'Contraste documental pendiente.',...(d.contraste?.fuentes||[]).map(f=>`${f.referencia}: ${f.titulo}, p. ${f.pagina} · versión ${f.version_id}`),d.decision?`DECISIÓN DEL ORADOR: ${d.decision.decision}\n${d.decision.nota}`:'Decisión humana pendiente.'].join('\n\n');
}
function renderizarTrabajoTenida(){
 const w=trabajoTenidaActual;if(!w)return;const d=w.datos,e=d.extraccion,cont=document.getElementById('trabajosDetalle');cont.replaceChildren();
 const cab=elementoTrabajo('header',undefined,'trabajos-ficha');cab.append(elementoTrabajo('h3',d.ficha.tema),elementoTrabajo('p',`${d.ficha.autor} · ${d.ficha.fecha} · Grado ${d.ficha.grado}`),elementoTrabajo('p',`${e.palabras} palabras · ${e.minutos} min de lectura estimada${e.paginas===null?' · páginas Word por comprobar':' · '+e.paginas+' páginas'}`),botonTrabajo('Descargar original',()=>descargarTrabajoTenida('original')));cont.append(cab);
 const review=elementoTrabajo('section',undefined,'trabajos-entrega');review.append(elementoTrabajo('h4','1. Revisión del trabajo'));
 const informe=elementoTrabajo('details');informe.open=!!d.contraste&&!d.decision;informe.append(elementoTrabajo('summary',`Informe privado · ${d.revision_bloques.length}/${w.bloques_total} bloques revisados`),elementoTrabajo('div',informeTrabajoTenida(w),'trabajos-informe'));review.append(informe,botonTrabajo('Descargar informe separado',()=>descargarTrabajoTenida('informe')));
 if(d.revision_bloques.length<w.bloques_total)review.append(botonTrabajo(d.revision_bloques.length?'Reanudar revisión':'Revisar trabajo',()=>pasoTrabajoTenida('revisar'),true));
 else if(!d.contraste)review.append(botonTrabajo('Contrastar con la biblioteca',()=>pasoTrabajoTenida('contrastar'),true));
 else{
  const f=elementoTrabajo('form');const label=elementoTrabajo('label','Precisiones del Orador después de revisar el informe');const nota=elementoTrabajo('textarea');nota.rows=3;nota.minLength=5;nota.maxLength=3000;nota.required=true;nota.value=d.decision?.nota||'';label.append(nota);
  const select=elementoTrabajo('select');select.setAttribute('aria-label','Decisión sobre el trabajo');for(const [v,t]of [['continuar','Revisado: elaborar conclusiones'],['corregir','Solicitar correcciones antes de elaborar']]){const o=elementoTrabajo('option',t);o.value=v;select.append(o);}select.value=d.decision?.decision||'continuar';
  const guardar=elementoTrabajo('button','Guardar decisión para continuar','btn-secondary');guardar.type='submit';f.append(label,select,guardar);f.onsubmit=ev=>{ev.preventDefault();if(f.reportValidity())pasoTrabajoTenida('decision',{decision:select.value,nota:nota.value});};review.append(f);
 }cont.append(review);
 const oral=elementoTrabajo('section',undefined,'trabajos-entrega trabajos-oratoria');oral.append(elementoTrabajo('h4',d.ficha.tipo==='ordinaria'?'2. Conclusiones del Orador':'2. Bienvenida al grado'));
 if(!d.oratoria){oral.append(elementoTrabajo('p','Unas 350 palabras · aproximadamente 3 minutos.'));if(d.decision?.decision==='continuar')oral.append(botonTrabajo('Elaborar texto del Orador',()=>pasoTrabajoTenida('generar'),true));else oral.append(elementoTrabajo('p',!d.contraste?'La oratoria todavía no se ha generado. Complete primero el contraste con la biblioteca.':d.decision?.decision==='corregir'?'La elaboración está detenida por su decisión de solicitar correcciones.':'La oratoria todavía no se ha generado. Revise el informe, complete las precisiones (mínimo 5 caracteres) y pulse «Guardar decisión para continuar». Después podrá elaborar el texto.'));}
 else{
  oral.append(elementoTrabajo('p',`${d.oratoria.palabras} palabras · ${d.oratoria.minutos} min · ${d.oratoria.estado==='borrador'?'Borrador para revisión':'Revisado por el Orador'}`));
  const label=elementoTrabajo('label','Texto del Orador');const editor=elementoTrabajo('textarea');editor.rows=18;editor.value=d.oratoria.texto;label.append(editor);oral.append(label);
  const actions=elementoTrabajo('div',undefined,'doctrina-acciones');actions.append(botonTrabajo('Guardar texto revisado',()=>pasoTrabajoTenida('editar',{texto:editor.value}),true),botonTrabajo('Descargar Word · carta, Calibri 12',()=>descargarTrabajoTenida('oratoria')),botonTrabajo('Volver a elaborar',()=>pasoTrabajoTenida('generar')));oral.append(actions,elementoTrabajo('p','El Word descarga la última versión guardada. Revise nombres, fidelidad al trabajo y disposición de la página antes de su lectura.','trabajos-ayuda'));
 }cont.append(oral);
}
