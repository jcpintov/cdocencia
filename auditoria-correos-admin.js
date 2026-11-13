/* Panel privado de auditoría de correos. El servidor valida nuevamente el rol. */
(function(){
 'use strict';
 let filas=[],generado='',limitado=false,abierto=false,fechaEmision='',exportando=false;
 const hoyChile=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 function cambiarFecha(){
  const input=$('auditoriaFechaEmision');
  if(!autorizado()){input.value=fechaEmision;return;}
  const nueva=input.value;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(nueva)){input.value=fechaEmision;return;}
  if(nueva===fechaEmision)return;
  if(!window.confirm('La fecha '+nueva+' es diferente de la fecha actual ('+hoyChile()+'). ¿Confirma la nueva fecha de emisión del informe?')){
   input.value=fechaEmision;return;
  }
  fechaEmision=nueva;
 }
 const $=id=>document.getElementById(id);
 const autorizado=()=>typeof usuarioActual!=='undefined'&&usuarioActual?.es_admin===true&&usuarioActual?.rol!=='ADMIN';
 const fmt=v=>v?new Intl.DateTimeFormat('es-CL',{dateStyle:'short',timeStyle:'medium',timeZone:'America/Santiago'}).format(new Date(v)):'—';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function montar(){
  if($('auditoriaCorreosDialogo'))return;
  const d=document.createElement('dialog');d.id='auditoriaCorreosDialogo';d.className='auditoria-correos-dialogo';
  if(!document.getElementById('auditoriaCorreosCss')){const css=document.createElement('link');css.id='auditoriaCorreosCss';css.rel='stylesheet';css.href='/auditoria-correos-modal.css?v=20261113';document.head.appendChild(css);}
  d.setAttribute('aria-labelledby','auditoriaCorreosTitulo');
  d.innerHTML=`<div class="auditoria-contenedor"><header class="auditoria-cabecera"><div><span class="auditoria-etiqueta">Control administrativo · Superadmin</span><h2 id="auditoriaCorreosTitulo">Auditoría de correos</h2><p>Registro de envíos y aceptación SMTP. La aceptación del servidor no acredita entrega al buzón.</p></div><button id="auditoriaCerrarSuperior" type="button" aria-label="Cerrar auditoría" class="auditoria-cerrar-x">×</button></header><div class="auditoria-cuerpo"><section class="auditoria-bloque"><h3>Filtros de consulta</h3>
<form id="auditoriaCorreosFiltros" class="auditoria-filtros">
<label>Desde <input type="date" id="auditoriaDesde"></label><label>Hasta <input type="date" id="auditoriaHasta"></label>
<label>Estado <select id="auditoriaEstado"><option value="">Todos</option><option value="aceptado_smtp">Aceptado SMTP</option><option value="error">Error</option><option value="pendiente">Pendiente</option><option value="incierto">Incierto</option><option value="historico_enviado">Enviado histórico</option></select></label>
<label>Tipo <select id="auditoriaTipo"><option value="">Todos</option><option value="asignacion">Asignación</option><option value="recordatorio">Recordatorio</option><option value="calendario">Calendario</option><option value="publicacion">Publicación</option><option value="inventario">Inventario</option><option value="codigo_perfil">Código de autorización</option><option value="prueba_smtp_dummy">Prueba SMTP Dummy</option></select></label>
<label class="auditoria-buscar">Buscar <input id="auditoriaBuscar" maxlength="120" placeholder="Correo, remitente o asunto"></label>
<button type="submit" class="auditoria-boton-primario">Consultar</button></form></section>
<section class="auditoria-bloque auditoria-emision"><label for="auditoriaFechaEmision">Fecha de emisión del informe <input type="date" id="auditoriaFechaEmision"></label><small>Modifica únicamente la fecha declarada del informe; no cambia las fechas reales de envío y generación.</small></section>
<p id="auditoriaEstadoVista" role="status" aria-live="polite" class="auditoria-estado"></p>
<div class="auditoria-tabla-marco" role="region" aria-label="Registros de auditoría" tabindex="0"><table id="auditoriaTabla"><thead><tr><th>Fecha y hora (Chile)</th><th>Remitente</th><th>Para / CC / CCO</th><th>Asunto</th><th>Extracto (10 líneas)</th><th>Tipo</th><th>Estado SMTP</th><th>ID / referencia</th></tr></thead><tbody></tbody></table></div>
</div><footer class="auditoria-pie"><span>Descargas locales · Acceso reservado</span><div class="auditoria-acciones">
<button type="button" id="auditoriaCsv" disabled>Exportar CSV</button><button type="button" id="auditoriaPdf" disabled>Exportar PDF</button><button type="button" id="auditoriaCerrar" class="auditoria-boton-primario">Cerrar</button></div></footer></div>`;
  document.body.appendChild(d);
  $('auditoriaCerrarSuperior').onclick=()=>d.close();
  $('auditoriaCerrar').onclick=()=>d.close();
  d.addEventListener('close',()=>{abierto=false;filas=[];});
  $('auditoriaCorreosFiltros').onsubmit=e=>{e.preventDefault();consultar();};
  $('auditoriaCsv').onclick=exportarCsv;
  $('auditoriaPdf').onclick=exportarPdf;
  $('auditoriaFechaEmision').addEventListener('change',cambiarFecha);
  const hoy=new Date(),fechaChile=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(hoy);
  $('auditoriaHasta').value=fechaChile;
  $('auditoriaDesde').value=''; // Sin fecha inicial: incluye los correos históricos
  fechaEmision=fechaChile;$('auditoriaFechaEmision').value=fechaEmision;
 }
 async function consultar(){
  if(!autorizado())return;
  const estado=$('auditoriaEstadoVista');estado.textContent='Consultando registros…';
  $('auditoriaCsv').disabled=true;$('auditoriaPdf').disabled=true;
  try{
   const {data:{session}}=await sbApp.auth.getSession();
   if(!session?.access_token)throw Error('Sesión vencida');
   const body={desde:$('auditoriaDesde').value,hasta:$('auditoriaHasta').value,estado:$('auditoriaEstado').value,tipo:$('auditoriaTipo').value,busqueda:$('auditoriaBuscar').value};
   const r=await fetch('/api/admin-auditoria-correos',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify(body),cache:'no-store'});
   const data=await r.json();if(!r.ok)throw Error(data.error||'Error de consulta');
   filas=data.filas;generado=data.generado_en;limitado=data.limitado;
   const tbody=$('auditoriaTabla').querySelector('tbody');tbody.replaceChildren();
   for(const f of filas){
    const tr=document.createElement('tr');
    const vals=[fmt(f.creado_en),f.remitente,[...f.destinatarios.map(x=>'Para: '+x),...f.cc.map(x=>'CC: '+x),...f.cco.map(x=>'CCO: '+x)].join(' | '),f.asunto,f.extracto||'Contenido no almacenado',f.tipo,f.estado==='historico_enviado'?'Enviado histórico (SMTP no verificable)':f.estado,(f.intento_id||f.id)+(f.origen_id?' / '+f.origen_id:'')];
    for(const v of vals){const td=document.createElement('td');td.textContent=v;tr.appendChild(td);}tbody.appendChild(tr);
   }
   estado.textContent=filas.length+' registros mostrados.'+(limitado?' Se alcanzó el máximo de 2.000: acote el período.':'');
   $('auditoriaCsv').disabled=!filas.length;$('auditoriaPdf').disabled=!filas.length;
  }catch(e){estado.textContent=e.message;filas=[];}
 }
 function datosTabla(){return [['Fecha y hora (Chile)','Remitente','Para','CC','CCO','Asunto','Extracto 10 líneas','Tipo','Estado','ID','Origen','ID SMTP','Error','Fuente'],
 ...filas.map(f=>[fmt(f.creado_en),f.remitente,f.destinatarios.join('; '),f.cc.join('; '),f.cco.join('; '),f.asunto,f.extracto||'Contenido no almacenado',f.tipo,f.estado,f.intento_id||f.id,f.origen_id||'',f.message_id||'',f.error_codigo||'',f.fuente||''])];}
 function exportarCsv(){
  if(!autorizado())return;
  const cabecera=[['Fecha de emisión declarada',fechaEmision],['Fecha y hora real de generación',fmt(generado)],[]];
  const seguro=v=>{const t=String(v??'');return /^[\s]*[=+@-]/.test(t)?"'"+t:t;};
  const texto='\uFEFF'+[...cabecera,...datosTabla()].map(row=>row.map(v=>'"'+seguro(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([texto],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='auditoria-correos-'+fechaEmision+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 async function exportarPdf(){
  if(!autorizado()||exportando||!filas.length)return;
  if(typeof html2pdf!=='function'){$('auditoriaEstadoVista').textContent='Generador PDF no disponible';return;}
  exportando=true;$('auditoriaPdf').disabled=true;
  const estado=$('auditoriaEstadoVista');
  estado.textContent='Generando PDF de '+filas.length+' registros…';
  try{
   // La librería html2pdf incluye jsPDF. Se extrae la instancia, pero todo el
   // contenido se dibuja como TEXTO real: seleccionable, buscable y sin capturas.
   const canvas=document.createElement('canvas');canvas.width=40;canvas.height=1;
   const pdf=await html2pdf().set({margin:0,jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}})
     .from(canvas,'canvas').toPdf().get('pdf');
   for(const [nombre,estilo] of [['Regular','normal'],['Bold','bold']]){
    const respuesta=await fetch('/assets/fonts/Docencia-'+nombre+'.ttf',{cache:'force-cache'});
    if(!respuesta.ok)throw Error('No fue posible cargar la tipografía del informe');
    const bytes=new Uint8Array(await respuesta.arrayBuffer());
    let binario='';for(let i=0;i<bytes.length;i+=8192)binario+=String.fromCharCode(...bytes.subarray(i,i+8192));
    const archivo='Docencia-'+nombre+'.ttf';
    pdf.addFileToVFS(archivo,btoa(binario));pdf.addFont(archivo,'Docencia',estilo);
   }
   pdf.setProperties({title:'Auditoría de correos · OFL 146',subject:'Registro institucional de correos',author:'Cámara de Docencia · OFL 146'});
   const izquierda=15,ancho=180,limite=274;
   let y=0,numero=0;
   function pagina(){
    if(numero)pdf.addPage();
    numero++;
    pdf.setFillColor(255,255,255);pdf.rect(0,0,210,297,'F');
    pdf.setFillColor(22,55,73);pdf.rect(0,0,210,22,'F');
    pdf.setTextColor(255,255,255);pdf.setFont('Docencia','bold');pdf.setFontSize(13);
    pdf.text('AUDITORÍA DE CORREOS · OFL 146',izquierda,14);
    pdf.setTextColor(38,62,77);pdf.setFont('Docencia','normal');pdf.setFontSize(8);
    pdf.text('Fecha de emisión: '+fechaEmision+'   |   Generado: '+fmt(generado)+'   |   Registros: '+filas.length,izquierda,29);
    y=36;
   }
   function asegurar(alto){if(y+alto>limite)pagina();}
   function linea(etiqueta,valor){
    const contenido=etiqueta+': '+String(valor==null||valor===''?'—':valor);
    pdf.setFont('Docencia','normal');pdf.setFontSize(8.6);pdf.setTextColor(31,54,69);
    const partes=pdf.splitTextToSize(contenido,ancho-10);
    const alto=Math.max(1,partes.length)*4.35+1.8;
    asegurar(alto);
    pdf.text(partes,izquierda+4,y+4.1,{lineHeightFactor:1.12});y+=alto;
   }
   function extracto(texto){
    pdf.setFont('Docencia','bold');pdf.setFontSize(8.2);pdf.setTextColor(45,79,97);
    asegurar(9);pdf.text('PRIMERAS 10 LÍNEAS DEL CORREO',izquierda+4,y+4);y+=7;
    pdf.setFont('Docencia','normal');pdf.setFontSize(8.1);pdf.setTextColor(36,58,69);
    const fragmento=String(texto||'Contenido no almacenado en la auditoría');
    for(const lineaTexto of fragmento.split(/\r?\n/)){
     const partes=pdf.splitTextToSize(lineaTexto||' ',ancho-16);
     for(const p of partes){asegurar(4.3);pdf.text(p,izquierda+8,y+3.2);y+=4.3;}
    }
    y+=3;
   }
   pagina();
   pdf.setFont('Docencia','normal');pdf.setFontSize(8);pdf.setTextColor(86,105,119);
   const advertencia='La aceptación SMTP no garantiza entrega al buzón. Los registros históricos se muestran según las asignaciones; no acreditan una comprobación SMTP individual.';
   const aviso=pdf.splitTextToSize(advertencia,ancho);
   pdf.text(aviso,izquierda,y+3);y+=aviso.length*4+7;
   for(const [i,f] of filas.entries()){
    // Empezar cada ficha en una sola página cuando el espacio disponible sea reducido.
    asegurar(45);
    pdf.setFillColor(231,240,245);pdf.setDrawColor(196,213,224);pdf.rect(izquierda,y,ancho,9,'FD');
    pdf.setTextColor(30,65,85);pdf.setFont('Docencia','bold');pdf.setFontSize(9.1);
    pdf.text('REGISTRO '+(i+1)+' · '+fmt(f.creado_en),izquierda+4,y+6);y+=11;
    linea('Remitente',f.remitente||'No registrado');
    linea('Destinatarios',(f.destinatarios||[]).join('; '));
    if((f.cc||[]).length)linea('CC',f.cc.join('; '));
    if((f.cco||[]).length)linea('CCO',f.cco.join('; '));
    linea('Asunto',f.asunto);
    linea('Estado SMTP',f.estado==='historico_enviado'?'Enviado según historial; aceptación SMTP no verificable':f.estado);
    linea('Tipo y origen',f.tipo+' / '+(f.fuente||'auditoria_correos'));
    linea('Identificador SMTP',f.message_id||'No registrado');
    linea('ID de intento',f.intento_id||f.id);
    if(f.origen_id)linea('Referencia de origen',f.origen_id);
    if((f.aceptados_smtp||[]).length)linea('Aceptados SMTP',f.aceptados_smtp.join('; '));
    if((f.rechazados_smtp||[]).length)linea('Rechazados SMTP',f.rechazados_smtp.join('; '));
    if(f.error_codigo)linea('Error',f.error_codigo+' '+(f.error_detalle||''));
    extracto(f.extracto);
    asegurar(5);pdf.setDrawColor(217,229,233);pdf.line(izquierda,y,izquierda+ancho,y);y+=6;
   }
   const total=pdf.internal.getNumberOfPages();
   for(let n=1;n<=total;n++){
    pdf.setPage(n);pdf.setDrawColor(210,220,226);pdf.line(izquierda,282,izquierda+ancho,282);
    pdf.setTextColor(97,113,123);pdf.setFont('Docencia','normal');pdf.setFontSize(7.5);
    pdf.text('Documento privado · '+n+' / '+total,izquierda,288);
    pdf.text('Cámara de Docencia · Talagante',195,288,{align:'right'});
   }
   pdf.save('auditoria-correos-'+fechaEmision+'.pdf');
   estado.textContent='PDF generado correctamente: '+filas.length+' registros, '+total+' páginas.';
  }catch(e){
   estado.textContent='No fue posible generar el PDF: '+String(e?.message||'error').slice(0,140);
  }finally{exportando=false;$('auditoriaPdf').disabled=!filas.length;}
 }
 function insertarAcceso(){
  const container=document.querySelector('.informes-ejecutivos-acciones');
  if(!container)return;
  let boton=$('btnAuditoriaCorreos');
  if(!boton){boton=document.createElement('button');boton.type='button';boton.id='btnAuditoriaCorreos';boton.className='btn-secondary hidden';boton.textContent='Auditoría de correos';container.appendChild(boton);boton.onclick=()=>{if(!autorizado())return;montar();fechaEmision=hoyChile();$('auditoriaFechaEmision').value=fechaEmision;$('auditoriaCorreosDialogo').showModal();abierto=true;consultar();};}
  boton.classList.toggle('hidden',!autorizado());
 }
 document.addEventListener('DOMContentLoaded',insertarAcceso);
 document.addEventListener('click',()=>queueMicrotask(insertarAcceso));
})();
