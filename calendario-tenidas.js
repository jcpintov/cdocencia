/* Agenda exclusiva de Superadmin, con recordatorios privados de calendario. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const grados={1:'Aprendiz',2:'Compañero',3:'Maestro'};
 function hoy(){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const val=t=>p.find(x=>x.type===t).value;return `${val('year')}-${val('month')}-${val('day')}`;}
 let mes=hoy().slice(0,7),trabajos=[],autores=[],dia=null,generacion=0,ocupado=false,cargado=null;
 const activo=()=>usuarioActual?.es_admin===true;
 async function solicitar(body){
  if(!activo())throw Error('Acceso exclusivo de Superadmin.');
  const {data,error}=await sbApp.auth.getSession();
  if(error||!data?.session?.access_token)throw Error('La sesión venció. Vuelva a ingresar.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
   const r=await fetch('/api/admin-tenidas',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify(body),signal:controller.signal,cache:'no-store'});
   const b=await r.json();if(!r.ok||!b.ok)throw Error(b.error||'No se pudo confirmar la operación.');return b;
  }catch(error){if(error.name==='AbortError')throw Error('La conexión tardó demasiado. Su formulario se conserva; actualice o reintente para confirmar el registro.');throw error;}
  finally{clearTimeout(timer);}
 }
 window.cargarCalendarioTenidas=async function(){
  if(!activo())return;
  const version=++generacion,actor=usuarioActual,consulta=mes;
  $('tenidasMes').value=mes;$('tenidasEstado').textContent='Cargando calendario…';
  try{
   const data=await solicitar({action:'listar',mes:consulta});
   if(version!==generacion||actor!==usuarioActual)return;
   trabajos=data.trabajos.sort((a,b)=>a.fecha.localeCompare(b.fecha)||String(a.hora||'20:00').localeCompare(String(b.hora||'20:00')));autores=data.autores;cargado=consulta;
   $('tenidasAutores').innerHTML=autores.map(a=>`<option value="${e(a)}"></option>`).join('');
   renderizar();$('tenidasEstado').textContent='Calendario actualizado.';return true;
  }catch(error){if(version===generacion&&actor===usuarioActual){if(cargado!==mes){trabajos=[];renderizar();}$('tenidasEstado').textContent=error.message;}return false;}
 };
 function renderizar(){
  const filtro=$('tenidasGradoFiltro').value,visibles=trabajos.filter(t=>filtro==='todos'||String(t.grado)===filtro);
  const [y,m]=mes.split('-').map(Number),inicio=(new Date(Date.UTC(y,m-1,1)).getUTCDay()+6)%7,total=new Date(Date.UTC(y,m,0)).getUTCDate();
  $('tenidasTituloMes').textContent=new Date(Date.UTC(y,m-1,15)).toLocaleDateString('es-CL',{month:'long',year:'numeric',timeZone:'UTC'});
  const feriados=window.feriadosCalendarioChile?.(y);
  $('tenidasFeriadosEstado').textContent=feriados?'Chile · '+y:'Feriados de este año pendientes de actualización';
  let html=Array.from({length:inicio},()=>'<div class="tenidas-dia-vacio" aria-hidden="true"></div>').join('');
  for(let n=1;n<=total;n++){
   const fecha=mes+'-'+String(n).padStart(2,'0'),items=visibles.filter(t=>t.fecha===fecha),feriado=feriados?.[fecha],finSemana=[0,6].includes(new Date(Date.UTC(y,m-1,n)).getUTCDay());
   html+=`<div class="tenidas-dia${finSemana?' tenidas-fin-semana':''}${feriado?' tenidas-feriado':''}${fecha===hoy()?' tenidas-hoy':''}${fecha===dia?' tenidas-seleccionado':''}"><button type="button" class="tenidas-numero" data-dia="${fecha}" title="${e(feriado||'')}" aria-label="${e(fecha)}${feriado?': '+e(feriado):''}: ${items.length} trabajos${items.length?'':'. Agregar trabajo'}">${n}<span class="tenidas-cantidad">${items.length||''}</span></button>${items.map(t=>`<button type="button" class="tenida-mini" data-trabajo="${e(t.id)}" title="${e(grados[t.grado]+': '+t.tema+' — '+t.autor)}"><span>${e((t.hora||'20:00').slice(0,5))} · ${t.grado}°</span> ${e(t.tema)}</button>`).join('')}</div>`;
  }
  $('tenidasCuadricula').innerHTML=html;
  const agenda=visibles.filter(t=>!dia||t.fecha===dia);
  $('tenidasAgendaTitulo').textContent=dia?'Trabajos del '+dia.split('-').reverse().join('-'):'Trabajos del mes';
  $('tenidasVerMes').hidden=!dia;
  $('tenidasConteo').textContent=visibles.length+' trabajo'+(visibles.length===1?'':'s')+' programado'+(visibles.length===1?'':'s');
  $('tenidasLista').innerHTML=agenda.length?agenda.map(t=>`<li><div><time datetime="${t.fecha}">${t.fecha.split('-').reverse().join('-')} · ${e((t.hora||'20:00').slice(0,5))} h</time><span class="tenidas-grado">${t.grado}° · ${grados[t.grado]}</span><h3>${e(t.tema)}</h3><p>Autor: ${e(t.autor)}</p></div><button type="button" class="btn-secondary" data-trabajo="${e(t.id)}" aria-label="Modificar ${e(t.tema)}">Modificar</button></li>`).join(''):'<li class="tenidas-sin-registros">No hay trabajos registrados para esta selección.</li>';
 }
 function abrir(trabajo=null,fecha=null){
  if(!activo()||ocupado)return;
  const f=$('tenidasFormulario');f.reset();
  f.dataset.id=trabajo?.id||crypto.randomUUID();f.dataset.version=String(trabajo?.version||0);
  $('tenidasFecha').value=trabajo?.fecha||fecha||(mes===hoy().slice(0,7)?hoy():mes+'-01');
  $('tenidasHora').value=(trabajo?.hora||'20:00').slice(0,5);
  $('tenidasGrado').value=trabajo?String(trabajo.grado):($('tenidasGradoFiltro').value==='todos'?'':$('tenidasGradoFiltro').value);$('tenidasTema').value=trabajo?.tema||'';$('tenidasAutor').value=trabajo?.autor||'';
  $('tenidasDialogoTitulo').textContent=trabajo?'Modificar trabajo de tenida':'Agregar trabajo de tenida';
  $('tenidasEliminar').hidden=!trabajo;$('tenidasFormularioEstado').textContent='';
  $('tenidasDialogo').showModal();$('tenidasFecha').focus();
 }
 function mover(delta){const [y,m]=mes.split('-').map(Number);const fecha=new Date(Date.UTC(y,m-1+delta,1));mes=fecha.toISOString().slice(0,7);dia=null;void window.cargarCalendarioTenidas();}
 async function guardar(eliminar=false){
  if(ocupado||!activo())return;
  const f=$('tenidasFormulario');if(!eliminar&&!f.reportValidity())return;
  if(eliminar&&!confirm('¿Eliminar este trabajo del calendario de tenidas?'))return;
  const actor=usuarioActual,body={action:eliminar?'eliminar':'guardar',id:f.dataset.id,version:Number(f.dataset.version)};
  if(!eliminar)Object.assign(body,{fecha:$('tenidasFecha').value,hora:$('tenidasHora').value,grado:Number($('tenidasGrado').value),tema:$('tenidasTema').value.trim(),autor:$('tenidasAutor').value.trim()});
  ocupado=true;f.querySelectorAll('button,input,select').forEach(c=>c.disabled=true);$('tenidasFormularioEstado').textContent=eliminar?'Eliminando registro…':'Guardando trabajo…';
  try{
   const data=await solicitar(body);if(usuarioActual!==actor)return;
   if(data.trabajo){f.dataset.version=String(data.trabajo.version);if(!eliminar)mes=data.trabajo.fecha.slice(0,7);}
   $('tenidasDialogo').close();dia=null;const actualizado=await window.cargarCalendarioTenidas();
   if(usuarioActual===actor)$('tenidasEstado').textContent=(eliminar?'Trabajo eliminado del calendario.':'Trabajo guardado en el calendario.')+(actualizado?'':' Pulse Actualizar para consultar los cambios.');
  }catch(error){if(usuarioActual===actor)$('tenidasFormularioEstado').textContent=error.message+' Los datos del formulario se conservan.';}
  finally{ocupado=false;f.querySelectorAll('button,input,select').forEach(c=>c.disabled=false);}
 }
 window.limpiarCalendarioTenidas=()=>{generacion++;trabajos=[];autores=[];cargado=null;dia=null;mes=hoy().slice(0,7);$('tenidasDialogo')?.close();$('tenidasFormulario')?.reset();['tenidasLista','tenidasCuadricula','tenidasAutores'].forEach(id=>{if($(id))$(id).replaceChildren();});};
 $('tenidasAnterior').addEventListener('click',()=>mover(-1));$('tenidasSiguiente').addEventListener('click',()=>mover(1));
 $('tenidasHoy').addEventListener('click',()=>{mes=hoy().slice(0,7);dia=null;void window.cargarCalendarioTenidas();});
 $('tenidasMes').addEventListener('change',event=>{if(/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)){mes=event.target.value;dia=null;void window.cargarCalendarioTenidas();}});
 $('tenidasGradoFiltro').addEventListener('change',()=>{dia=null;renderizar();});
 $('tenidasNuevo').addEventListener('click',()=>abrir());$('tenidasActualizar').addEventListener('click',()=>window.cargarCalendarioTenidas());
 $('tenidasVerMes').addEventListener('click',()=>{dia=null;renderizar();});
 $('adminSeccionTenidas').addEventListener('click',event=>{
  const btn=event.target.closest('button');if(!btn)return;
  if(btn.dataset.trabajo)abrir(trabajos.find(t=>t.id===btn.dataset.trabajo));
  if(btn.dataset.dia){if(trabajos.some(t=>t.fecha===btn.dataset.dia&&($('tenidasGradoFiltro').value==='todos'||String(t.grado)===$('tenidasGradoFiltro').value))){dia=btn.dataset.dia;renderizar();$('tenidasAgendaTitulo').scrollIntoView({block:'nearest',behavior:'smooth'});}else abrir(null,btn.dataset.dia);}
 });
 $('tenidasFormulario').addEventListener('submit',event=>{event.preventDefault();void guardar();});
 $('tenidasEliminar').addEventListener('click',()=>guardar(true));$('tenidasCancelar').addEventListener('click',()=>{if(!ocupado)$('tenidasDialogo').close();});
 $('tenidasDialogo').addEventListener('cancel',event=>{if(ocupado)event.preventDefault();});
})();
