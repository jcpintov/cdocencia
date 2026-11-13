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
  if(!autorizado()||exportando)return;
  if(typeof html2pdf!=='function'){$('auditoriaEstadoVista').textContent='Generador PDF no disponible';return;}
  if(!filas.length)return;
  exportando=true;$('auditoriaPdf').disabled=true;
  const estado=$('auditoriaEstadoVista');estado.textContent='Preparando PDF de '+filas.length+' registros…';
  // Se usa una ficha por correo; una tabla extensa en A4 recorta asunto, cuerpo e identificadores.
  const area=document.createElement('div');
  area.style.cssText='box-sizing:border-box;width:730px;background:#fff;color:#1c3342;font:11px/1.45 Arial,sans-serif;padding:10px';
  const cab=document.createElement('header');
  cab.style.cssText='border-bottom:3px solid #b3914f;padding:4px 0 13px;margin-bottom:12px';
  const titulo=document.createElement('h1');titulo.textContent='AUDITORÍA DE CORREOS · OFL 146';
  titulo.style.cssText='font-size:18px;margin:0 0 8px;color:#183749';
  const detalles=document.createElement('p');detalles.textContent='Fecha de emisión: '+fechaEmision+'  ·  Generado: '+fmt(generado)+'  ·  Registros: '+filas.length;
  detalles.style.cssText='font-size:10px;margin:0 0 6px';
  const advert=document.createElement('p');advert.textContent='«Aceptado SMTP» no acredita entrega al buzón. Los envíos históricos conservan el estado registrado en asignaciones y no constituyen una verificación SMTP independiente.';
  advert.style.cssText='font-size:10px;margin:0;color:#607585';
  cab.append(titulo,detalles,advert);area.appendChild(cab);
  const agrega=(elemento,etiqueta,valor)=>{
   const fila=document.createElement('div');fila.style.cssText='margin:3px 0;overflow-wrap:anywhere;word-break:break-word';
   const nombre=document.createElement('strong');nombre.textContent=etiqueta+': ';
   const dato=document.createElement('span');dato.textContent=String(valor??'—')||'—';
   fila.append(nombre,dato);elemento.appendChild(fila);
  };
  filas.forEach((f,i)=>{
   const ficha=document.createElement('section');
   ficha.className='auditoria-pdf-ficha';
   ficha.style.cssText='page-break-inside:avoid;break-inside:avoid;border:1px solid #cad7de;border-radius:5px;margin:0 0 12px;padding:11px 13px;max-width:100%;box-sizing:border-box';
   const h=document.createElement('h2');h.textContent='REGISTRO '+(i+1)+' · '+fmt(f.creado_en);
   h.style.cssText='font-size:12px;background:#e9f0f3;color:#224154;padding:7px;margin:-11px -13px 8px';
   ficha.appendChild(h);
   agrega(ficha,'Remitente',f.remitente||'No registrado');
   agrega(ficha,'Para',(f.destinatarios||[]).join('; '));
   if((f.cc||[]).length)agrega(ficha,'CC',f.cc.join('; '));
   if((f.cco||[]).length)agrega(ficha,'CCO',f.cco.join('; '));
   agrega(ficha,'Asunto',f.asunto);
   agrega(ficha,'Estado SMTP',f.estado==='historico_enviado'?'Enviado según historial; aceptación SMTP no verificable':f.estado);
   agrega(ficha,'Tipo / origen',f.tipo+' · '+(f.fuente||'auditoria_correos'));
   agrega(ficha,'ID de mensaje SMTP',f.message_id||'No registrado');
   agrega(ficha,'ID de intento',f.intento_id||f.id);
   if(f.origen_id)agrega(ficha,'Referencia',f.origen_id);
   if((f.aceptados_smtp||[]).length)agrega(ficha,'Aceptados SMTP',f.aceptados_smtp.join('; '));
   if((f.rechazados_smtp||[]).length)agrega(ficha,'Rechazados SMTP',f.rechazados_smtp.join('; '));
   if(f.error_codigo)agrega(ficha,'Error',f.error_codigo+' '+(f.error_detalle||''));
   const subtitulo=document.createElement('p');subtitulo.textContent='PRIMERAS 10 LÍNEAS DEL CORREO';
   subtitulo.style.cssText='font-size:10px;font-weight:bold;color:#305367;margin:9px 0 3px';
   const cuerpo=document.createElement('pre');
   cuerpo.textContent=f.extracto||'Contenido no almacenado en la auditoría';
   cuerpo.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;font:10px/1.45 Arial,sans-serif;margin:0;padding:8px;background:#f5f8fa;border:1px solid #e4edf0';
   ficha.append(subtitulo,cuerpo);area.appendChild(ficha);
  });
  try{
   await html2pdf().set({margin:[10,10,12,10],filename:'auditoria-correos-'+fechaEmision+'.pdf',
    image:{type:'jpeg',quality:.97},html2canvas:{scale:1.6,useCORS:true},
    jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},
    pagebreak:{mode:['css','legacy'],avoid:['.auditoria-pdf-ficha']}
   }).from(area).save();
   estado.textContent='PDF generado: '+filas.length+' registros.';
  }catch(e){estado.textContent='No fue posible generar el PDF. '+String(e?.message||'').slice(0,110);}
  finally{exportando=false;$('auditoriaPdf').disabled=!filas.length;}
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
