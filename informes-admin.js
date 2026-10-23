/* Informes privados: datos nuevos por apertura, sin reutilizar listas truncadas de pantalla. */
(function(){
 const $=id=>document.getElementById(id);
 const titulos={asignaciones:'Trabajos asignados',avances:'Avance de los maestros',actividad:'Actividad de acceso'};
 let solicitud=0,controlador=null,exportando=false,informe=null,origen=null;
 let fuentesPDF=null;
 async function cargarFuentesPDF(){
  if(!fuentesPDF)fuentesPDF=Promise.all(['Regular','Bold'].map(async estilo=>{
   const respuesta=await fetch('/assets/fonts/Docencia-'+estilo+'.ttf',{signal:AbortSignal.timeout(10000)});
   if(!respuesta.ok)throw Error('No fue posible cargar la tipografía PDF');
   const bytes=new Uint8Array(await respuesta.arrayBuffer());let binario='';
   for(let i=0;i<bytes.length;i+=8192)binario+=String.fromCharCode(...bytes.subarray(i,i+8192));
   return {estilo,base64:btoa(binario)};
  })).catch(e=>{fuentesPDF=null;throw e;});
  return fuentesPDF;
 }
 const fecha=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v)?v.slice(0,10):'—';
 const instante=v=>v?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v))+' '+new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)):'Sin registros';
 function texto(tag,valor){const el=document.createElement(tag);el.textContent=String(valor??'—');return el;}
 function tabla(destino,titulo,columnas,filas){
  const seccion=document.createElement('section');seccion.className='informe-bloque';
  if(titulo)seccion.appendChild(texto('h3',titulo));
  const table=document.createElement('table'),head=document.createElement('thead'),tr=document.createElement('tr');
  columnas.forEach(c=>{const th=texto('th',c);th.scope='col';tr.appendChild(th);});head.appendChild(tr);table.appendChild(head);
  const body=document.createElement('tbody');
  for(const fila of filas){const row=document.createElement('tr');fila.forEach(v=>row.appendChild(texto('td',v)));body.appendChild(row);}
  if(!filas.length){const row=document.createElement('tr'),td=texto('td','No hay registros para este informe.');td.colSpan=columnas.length;row.appendChild(td);body.appendChild(row);}
  table.appendChild(body);seccion.appendChild(table);destino.appendChild(seccion);
 }
 function validar(r,tipo){
  if(r?.ok!==true||r.tipo!==tipo||!Number.isFinite(Date.parse(r.generado_en))||!r.data)throw Error('El servidor entregó una respuesta incompleta. Intente nuevamente.');
  const grupos=tipo==='actividad'?[r.data.con_actividad,r.data.sin_actividad]:[r.data.filas];
  if(grupos.some(f=>!Array.isArray(f)||f.some(x=>!x||typeof x.nombre!=='string')))throw Error('El servidor entregó una respuesta incompleta. Intente nuevamente.');
  if(tipo==='asignaciones'&&r.data.filas.some(f=>!f.codigo||typeof f.trabajo!=='string'||fecha(f.fecha_asignacion)==='—'||fecha(f.fecha_entrega)==='—'))throw Error('El informe contiene asignaciones incompletas.');
  if(tipo==='avances'&&r.data.filas.some(f=>['total','leidos','completados','pendientes','porcentaje'].some(k=>!Number.isFinite(f[k]))))throw Error('El informe contiene avances incompletos.');
  if(tipo==='actividad'&&grupos.flat().some(f=>!Number.isInteger(f.ingresos)||f.ingresos<0||(f.ingresos>0&&!Number.isFinite(Date.parse(f.ultimo)))))throw Error('El informe contiene actividad incompleta.');
 }
 function presentar(r){
  const doc=$('informeEjecutivoContenido');doc.replaceChildren();
  doc.appendChild(texto('p','DOCENCIA MASÓNICA DE TERCER GRADO'));
  doc.appendChild(texto('h2',titulos[r.tipo]));
  doc.appendChild(texto('p','Emitido: '+instante(r.generado_en)+' · America/Santiago'));
  doc.appendChild(texto('p','Padrón docente vigente · excluye Superadmin y cuentas eliminadas.'));
  const d=r.data;
  if(r.tipo==='asignaciones'){
   doc.appendChild(texto('p',d.filas.length+' trabajos con asignación vigente. Fechas en formato año-mes-día; entrega hasta las 23:30 h.'));
   tabla(doc,'',['Nombre','Código','Trabajo','Fecha de asignación','Fecha de entrega'],d.filas.map(f=>[f.nombre,f.codigo,f.trabajo,fecha(f.fecha_asignacion),fecha(f.fecha_entrega)]));
  }else if(r.tipo==='avances'){
   doc.appendChild(texto('p',d.filas.length+' maestros · avance sobre los trabajos docentes activos.'));
   tabla(doc,'',['Nombre','Trabajos activos','Leídos','Completados','Pendientes','Avance'],d.filas.map(f=>[f.nombre,f.total,f.leidos,f.completados,f.pendientes,f.total?f.porcentaje+' %':'Sin trabajos activos']));
  }else{
   doc.appendChild(texto('p','Historial disponible hasta la emisión. Actividad = al menos un ingreso registrado; no implica tiempo de lectura ni aprendizaje.'));
   doc.appendChild(texto('p',d.con_actividad.length+' con actividad · '+d.sin_actividad.length+' sin actividad registrada.'));
   tabla(doc,'Usuarios con actividad',['Nombre','Ingresos registrados','Último ingreso'],d.con_actividad.map(f=>[f.nombre,f.ingresos,instante(f.ultimo)]));
   tabla(doc,'Usuarios sin actividad registrada',['Nombre'],d.sin_actividad.map(f=>[f.nombre]));
  }
 }
 window.abrirInformeEjecutivo=async function(tipo){
  if(!usuarioActual?.es_admin||!titulos[tipo]||exportando)return;
  controlador?.abort();controlador=new AbortController();const signal=controlador.signal,n=++solicitud,actor=usuarioActual;
  informe=null;origen=document.activeElement;
  $('informeEjecutivoContenido').replaceChildren();$('btnDescargarInformeEjecutivo').disabled=true;
  $('informeEjecutivoTitulo').textContent=titulos[tipo];$('informeEjecutivoEstado').textContent='Consultando informe completo…';
  $('informeEjecutivoContenido').setAttribute('aria-busy','true');
  const dialogo=$('dialogInformeEjecutivo');if(!dialogo.open)dialogo.showModal();
  const peticionActual=controlador;const timer=setTimeout(()=>peticionActual.abort(),25000);
  try{
   const {data:{session}}=await sbApp.auth.getSession();
   if(!session?.access_token)throw Error('La sesión venció. Inicie sesión nuevamente.');
   if(n!==solicitud||usuarioActual!==actor)return;
   const res=await fetch('/api/admin-informes',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({tipo}),signal});
   const r=await res.json().catch(()=>{throw Error('El servidor no entregó una respuesta válida. Intente nuevamente.');});
   if(!res.ok)throw Error(r.error||'No fue posible cargar el informe (HTTP '+res.status+').');
   validar(r,tipo);
   if(n!==solicitud||usuarioActual!==actor)return;
   presentar(r);informe=r;$('btnDescargarInformeEjecutivo').disabled=false;
   $('informeEjecutivoEstado').textContent='Vista previa lista para descargar.';
  }catch(e){
   if(n===solicitud&&usuarioActual===actor)$('informeEjecutivoEstado').textContent=signal.aborted?'Se agotó el tiempo de espera. Cierre y vuelva a abrir el informe.':e.message;
  }finally{clearTimeout(timer);if(n===solicitud)$('informeEjecutivoContenido').setAttribute('aria-busy','false');}
 };
 window.cerrarInformeEjecutivo=function(){
  if(exportando)return;
  ++solicitud;controlador?.abort();controlador=null;informe=null;
  $('dialogInformeEjecutivo')?.close();$('informeEjecutivoContenido')?.replaceChildren();
  if($('informeEjecutivoEstado'))$('informeEjecutivoEstado').textContent='';
  if($('btnDescargarInformeEjecutivo'))$('btnDescargarInformeEjecutivo').disabled=true;
  origen?.focus?.({preventScroll:true});
 };
 window.limpiarInformesAdmin=function(){
  ++solicitud;controlador?.abort();informe=null;
  $('dialogInformeEjecutivo')?.close();$('informeEjecutivoContenido')?.replaceChildren();
 };
 function dibujarInformePDF(pdf,r){
  const ancho=277,izq=10,fin=193;let y=12;
  const limpiar=()=>{pdf.setFillColor(255,255,255);pdf.rect(0,0,297,210,'F');};limpiar();
  function pagina(){pdf.addPage();limpiar();y=12;}
  function linea(valor,tamano=10,negrita=false){
   pdf.setFont('Docencia',negrita?'bold':'normal');pdf.setFontSize(tamano);pdf.setTextColor(28,48,64);
   const lineas=pdf.splitTextToSize(String(valor),ancho),alto=tamano*.42;
   for(const l of lineas){if(y+alto>fin)pagina();pdf.text(l,izq,y);y+=alto;}
   y+=3;
  }
  linea('DOCENCIA MASÓNICA DE TERCER GRADO',10);
  linea(titulos[r.tipo],18,true);
  linea('Emitido: '+instante(r.generado_en)+' - America/Santiago',9);
  linea('Padrón docente vigente. Excluye Superadmin y cuentas eliminadas.',9);
  function tablaPDF(titulo,columnas,anchos,filas){
   if(y+25>fin)pagina();
   if(titulo)linea(titulo,12,true);
   function cabecera(){
    pdf.setFont('Docencia','bold');pdf.setFontSize(9);pdf.setDrawColor(184,201,214);pdf.setTextColor(28,48,64);let x=izq;
    const lineas=columnas.map((c,i)=>pdf.splitTextToSize(c,anchos[i]-5)),alto=Math.max(...lineas.map(l=>l.length))*4+6;
    columnas.forEach((c,i)=>{pdf.setFillColor(234,240,245);pdf.rect(x,y,anchos[i],alto,'FD');pdf.text(lineas[i],x+2.5,y+5);x+=anchos[i];});y+=alto;
   }
   cabecera();
   if(!filas.length){linea('No hay registros para este informe.',9);return;}
   for(const fila of filas){
    pdf.setFont('Docencia','normal');pdf.setFontSize(9);
    const celdas=fila.map((c,i)=>pdf.splitTextToSize(String(c??'—'),anchos[i]-5));
    const alto=Math.max(...celdas.map(c=>c.length))*4+4;
    if(y+alto>fin){pagina();if(titulo)linea(titulo+' (continuación)',12,true);cabecera();pdf.setFont('Docencia','normal');}
    let x=izq;
    celdas.forEach((c,i)=>{pdf.setFillColor(255,255,255);pdf.rect(x,y,anchos[i],alto,'FD');pdf.text(c,x+2.5,y+5);x+=anchos[i];});y+=alto;
   }
   y+=7;
  }
  const d=r.data;
  if(r.tipo==='asignaciones'){
   linea(d.filas.length+' trabajos con asignación vigente. Entrega hasta las 23:30 h.',9);
   tablaPDF('',['Nombre','Código','Trabajo','Fecha asignación','Fecha entrega'],[57,27,111,41,41],d.filas.map(f=>[f.nombre,f.codigo,f.trabajo,fecha(f.fecha_asignacion),fecha(f.fecha_entrega)]));
  }else if(r.tipo==='avances'){
   linea(d.filas.length+' maestros. Avance sobre los trabajos docentes activos.',9);
   tablaPDF('',['Nombre','Trabajos activos','Leídos','Completados','Pendientes','Avance'],[87,38,38,38,38,38],d.filas.map(f=>[f.nombre,f.total,f.leidos,f.completados,f.pendientes,f.total?f.porcentaje+' %':'Sin trabajos activos']));
  }else{
   linea('Historial disponible hasta la emisión. Actividad = al menos un ingreso registrado; no implica aprendizaje.',9);
   linea(d.con_actividad.length+' con actividad - '+d.sin_actividad.length+' sin actividad registrada.',9);
   tablaPDF('Usuarios con actividad',['Nombre','Ingresos registrados','Último ingreso'],[137,60,80],d.con_actividad.map(f=>[f.nombre,f.ingresos,instante(f.ultimo)]));
   tablaPDF('Usuarios sin actividad registrada',['Nombre'],[277],d.sin_actividad.map(f=>[f.nombre]));
  }
 }
 window.descargarInformeEjecutivoPDF=async function(){
  if(!usuarioActual?.es_admin||!informe||exportando)return;
  if(typeof html2pdf!=='function'){$('informeEjecutivoEstado').textContent='No se cargó el generador PDF. Recargue la página e intente nuevamente.';return;}
  exportando=true;const n=solicitud,actor=usuarioActual,datos=informe;
  $('btnDescargarInformeEjecutivo').disabled=true;$('btnCerrarInformeEjecutivo').disabled=true;
  $('informeEjecutivoEstado').textContent='Preparando descarga PDF…';
  try{
   // La biblioteca existente proporciona jsPDF. Se dibujan textos y tablas,
   // sin rasterizar la vista previa ni depender de su desplazamiento en pantalla.
   const canvas=document.createElement('canvas');canvas.width=100;canvas.height=1;
   canvas.getContext('2d').fillStyle='#ffffff';canvas.getContext('2d').fillRect(0,0,100,1);
   const pdf=await html2pdf().set({margin:0,jsPDF:{unit:'mm',format:'a4',orientation:'landscape'}}).from(canvas,'canvas').toPdf().get('pdf');
   for(const fuente of await cargarFuentesPDF()){
    const archivo='Docencia-'+fuente.estilo+'.ttf';pdf.addFileToVFS(archivo,fuente.base64);
    pdf.addFont(archivo,'Docencia',fuente.estilo==='Bold'?'bold':'normal');
   }
   dibujarInformePDF(pdf,datos);
   if(n!==solicitud||usuarioActual!==actor||!usuarioActual?.es_admin)return;
   const total=pdf.internal.getNumberOfPages();
   for(let pagina=1;pagina<=total;pagina++){pdf.setPage(pagina);pdf.setFontSize(8);pdf.setTextColor(80);pdf.text('Documento privado · '+pagina+' / '+total,10,204);}
   pdf.save('informe-'+datos.tipo+'-'+datos.generado_en.slice(0,10)+'.pdf');
   $('informeEjecutivoEstado').textContent='Descarga PDF preparada.';
  }catch{
   if(n===solicitud)$('informeEjecutivoEstado').textContent='No fue posible generar el PDF. La vista previa sigue disponible; intente nuevamente.';
  }finally{exportando=false;$('btnCerrarInformeEjecutivo').disabled=false;$('btnDescargarInformeEjecutivo').disabled=!informe;}
 };
 document.addEventListener('DOMContentLoaded',()=>{
  const dialogo=$('dialogInformeEjecutivo');
  dialogo?.addEventListener('cancel',e=>{e.preventDefault();window.cerrarInformeEjecutivo();});
  dialogo?.addEventListener('click',e=>{if(e.target===dialogo){const r=dialogo.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)window.cerrarInformeEjecutivo();}});
 });
})();
