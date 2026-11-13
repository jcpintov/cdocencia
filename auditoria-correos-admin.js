/* Panel privado de auditoría de correos. El servidor valida nuevamente el rol. */
(function(){
 'use strict';
 let filas=[],generado='',limitado=false,abierto=false,fechaEmision='';
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
<label>Estado <select id="auditoriaEstado"><option value="">Todos</option><option value="aceptado_smtp">Aceptado SMTP</option><option value="error">Error</option><option value="pendiente">Pendiente</option><option value="incierto">Incierto</option></select></label>
<label>Tipo <select id="auditoriaTipo"><option value="">Todos</option><option value="asignacion">Asignación</option><option value="recordatorio">Recordatorio</option><option value="calendario">Calendario</option><option value="publicacion">Publicación</option><option value="inventario">Inventario</option><option value="codigo_perfil">Código de autorización</option><option value="prueba_smtp_dummy">Prueba SMTP Dummy</option></select></label>
<label class="auditoria-buscar">Buscar <input id="auditoriaBuscar" maxlength="120" placeholder="Correo, remitente o asunto"></label>
<button type="submit" class="auditoria-boton-primario">Consultar</button></form></section>
<section class="auditoria-bloque auditoria-emision"><label for="auditoriaFechaEmision">Fecha de emisión del informe <input type="date" id="auditoriaFechaEmision"></label><small>Modifica únicamente la fecha declarada del informe; no cambia las fechas reales de envío y generación.</small></section>
<p id="auditoriaEstadoVista" role="status" aria-live="polite" class="auditoria-estado"></p>
<div class="auditoria-tabla-marco" role="region" aria-label="Registros de auditoría" tabindex="0"><table id="auditoriaTabla"><thead><tr><th>Fecha y hora (Chile)</th><th>Remitente</th><th>Para / CC / CCO</th><th>Asunto</th><th>Tipo</th><th>Estado</th><th>ID / referencia</th></tr></thead><tbody></tbody></table></div>
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
  $('auditoriaDesde').value=fechaChile.slice(0,8)+'01';
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
    const vals=[fmt(f.creado_en),f.remitente,[...f.destinatarios.map(x=>'Para: '+x),...f.cc.map(x=>'CC: '+x),...f.cco.map(x=>'CCO: '+x)].join(' | '),f.asunto,f.tipo,f.estado,(f.intento_id||f.id)+(f.origen_id?' / '+f.origen_id:'')];
    for(const v of vals){const td=document.createElement('td');td.textContent=v;tr.appendChild(td);}tbody.appendChild(tr);
   }
   estado.textContent=filas.length+' registros mostrados.'+(limitado?' Se alcanzó el máximo de 2.000: acote el período.':'');
   $('auditoriaCsv').disabled=!filas.length;$('auditoriaPdf').disabled=!filas.length;
  }catch(e){estado.textContent=e.message;filas=[];}
 }
 function datosTabla(){return [['Fecha y hora (Chile)','Remitente','Para','CC','CCO','Asunto','Tipo','Estado','ID','Origen','ID SMTP','Error'],
 ...filas.map(f=>[fmt(f.creado_en),f.remitente,f.destinatarios.join('; '),f.cc.join('; '),f.cco.join('; '),f.asunto,f.tipo,f.estado,f.intento_id||f.id,f.origen_id||'',f.message_id||'',f.error_codigo||''])];}
 function exportarCsv(){
  if(!autorizado())return;
  const cabecera=[['Fecha de emisión declarada',fechaEmision],['Fecha y hora real de generación',fmt(generado)],[]];
  const seguro=v=>{const t=String(v??'');return /^[\s]*[=+@-]/.test(t)?"'"+t:t;};
  const texto='\uFEFF'+[...cabecera,...datosTabla()].map(row=>row.map(v=>'"'+seguro(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([texto],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='auditoria-correos-'+fechaEmision+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 async function exportarPdf(){
  if(!autorizado())return;
  if(typeof html2pdf!=='function'){$('auditoriaEstadoVista').textContent='Generador PDF no disponible';return;}
  const area=document.createElement('div');area.style.cssText='font-family:Arial;color:#152d3c;padding:20px;font-size:9px';
  area.innerHTML='<h2>AUDITORÍA DE CORREOS — OFL 146</h2><p>Fecha de emisión: '+esc(fechaEmision)+' · Generado realmente: '+esc(fmt(generado))+' · Registros: '+filas.length+'</p><p>«Aceptado SMTP» no equivale a entrega verificada.</p>';
  const table=document.createElement('table');table.style.cssText='border-collapse:collapse;width:100%';
  for(const [i,row] of datosTabla().entries()){
   const tr=document.createElement('tr');
   // PDF compacto: fecha, remitente, destinatario, asunto, tipo, estado.
   for(const v of [row[0],row[1],row[2],row[5],row[6],row[7]]){
    const cell=document.createElement(i?'td':'th');cell.textContent=v;cell.style.cssText='border:1px solid #ccc;padding:4px;overflow-wrap:anywhere';tr.appendChild(cell);
   }table.appendChild(tr);
  }
  area.appendChild(table);
  try{await html2pdf().set({margin:5,filename:'auditoria-correos-'+fechaEmision+'.pdf',html2canvas:{scale:1.5},jsPDF:{unit:'mm',format:'a4',orientation:'landscape'},pagebreak:{mode:['css','legacy']}}).from(area).save();}
  catch{$('auditoriaEstadoVista').textContent='No fue posible generar el PDF';}
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
