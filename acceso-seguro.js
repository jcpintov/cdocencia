(() => {
  'use strict';
  const SUPABASE_URL='https://pwnnpjygnviyzyyvfxnq.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY='sb_publishable_NExezuss4il3RPgO8Vifxw_pspbe5wF';
  let client=null, busy=false, trabajos=[], guardandoTrabajo=false, accesosBitacora=[];
  let supervisionDocenciaDatos=[];
  let misProgresosAuth=[], catalogoMiDocencia=[], comentarioEditandoId=null, operacionDocencia=false;
  const el=id=>document.getElementById(id);
  const status=texto=>{el('status').textContent=texto};
  const show=(role)=>{
    el('result').hidden=!role;
    el('panelDocenciaAuth').hidden=role!=='USER';
    el('interaccionMiDocenciaAuth').hidden=true;
    el('selectTrabajoMiDocenciaAuth').replaceChildren();
    el('resumenMiDocenciaAuth').replaceChildren();
    el('listaComentariosMiDocenciaAuth').replaceChildren();
    el('lecturaTrabajoMiDocenciaAuth').replaceChildren();
    el('contenidoComentarioAuth').value='';
    el('estadoMiDocenciaAuth').textContent='Sin consulta activa.';
    misProgresosAuth=[];catalogoMiDocencia=[];
    comentarioEditandoId=null;operacionDocencia=false;
    el('padronSuperadminLab').hidden=role!=='SUPERADMIN';
    el('indicadoresMigracionAuth').replaceChildren();
    el('estadoMigracionAuth').textContent='Sin diagnóstico de migración.';
    el('supervisionDocenciaAdmin').hidden=role!=='SUPERADMIN';
    el('tablaSupervisionContenedor').hidden=true;
    el('cuerpoSupervisionDocencia').replaceChildren();
    el('indicadoresSupervisionDocencia').replaceChildren();
    el('filtrarSupervisionDocencia').value='';
    el('estadoSupervisionDocencia').textContent='Sin consulta realizada.';
    supervisionDocenciaDatos=[];
    el('editorDocenteAuth').hidden=role!=='SUPERADMIN';
    el('bitacoraAdminAuth').hidden=role!=='SUPERADMIN';
    accesosBitacora=[];
    el('bitacoraResumenAuth').replaceChildren();
    el('estadoBitacoraAuth').textContent='Bitácora no consultada.';
    el('editorFormularioAuth').hidden=true;
    el('editorModuloSelector').replaceChildren();
    el('preguntasContenidoAuth').replaceChildren();
    trabajos=[];
    el('estadoEditorAuth').textContent='Consulta no realizada. Ningún documento ha cambiado.';
    el('tablaPadron').hidden=true;
    el('padronBody').replaceChildren();
    el('estadoPadron').textContent='Padrón aún no consultado.';
    el('confirmed').textContent=role?'Sí':'—';
    el('role').textContent=role||'—';
    el('permissions').textContent=role==='SUPERADMIN'
      ? 'SUPERADMIN: gestión y supervisión; sin participación en Docencia (operaciones heredadas en mantenimiento)'
      : role==='USER'?'Solo funciones de Maestro; sin administración':'—';
  };
  const setBusy=valor=>{
    busy=valor;el('verify').disabled=valor;
    el('logout').disabled=valor||!client;el('account').disabled=valor;
  };
  async function signOut(){
    try{if(client)await client.auth.signOut({scope:'local'})}
    finally{client=null;el('password').value='';show(null);el('logout').disabled=true}
  }
  el('form').addEventListener('submit',async event=>{
    event.preventDefault();
    if(busy)return;
    if(!window.supabase?.createClient){status('El módulo seguro de autenticación no está disponible.');return}
    const email=String(el('account').value||'').trim().toLowerCase();
    if(email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      status('Escriba un correo electrónico válido.');return;
    }
    const password=el('password').value;
    setBusy(true);show(null);
    try{
      if(client)await client.auth.signOut({scope:'local'});
      client=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
        auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
      });
      status('Verificando credenciales con Supabase Auth...');
      const {data,error}=await client.auth.signInWithPassword({email,password});
      el('password').value='';
      if(error||!data?.session?.access_token){status('No se pudo iniciar sesión con Supabase Auth. Comprueba las credenciales.');return}
      const response=await fetch('/api/security/session',{
        method:'GET',cache:'no-store',
        headers:{Authorization:'Bearer '+data.session.access_token}
      });
      const profile=await response.json().catch(()=>({}));
      if(!response.ok||!['SUPERADMIN','USER'].includes(profile.role)){
        await signOut();
        status(response.status===503?'Servidor de verificación pendiente de configuración.':
          'La sesión fue autenticada, pero no se autorizó el perfil institucional.');
        return;
      }
      // El servidor determina el rol desde auth.uid() y la vinculación UUID.
      // NUNCA inferir privilegios por el dominio o la dirección de correo.
      // Auditar solo una identidad Auth confirmada, derivada en servidor;
      // nunca insertar eventos con un usuario_id aportado por el navegador.
      const registro=await client.rpc('maestro_registrar_ingreso_auth');
      if(registro.error||registro.data!==true){
        await signOut();
        status('Auditoría de acceso no disponible. Sesión cerrada de forma segura.');
        return;
      }
      show(profile.role);
      status('Identidad, rol y auditoría de ingreso verificados con Supabase Auth.');
    }catch(_){status('Error de comunicación. No se ha modificado ningún usuario.')}
    finally{el('password').value='';setBusy(false);el('logout').disabled=!client}
  });
  el('consultarPadron').addEventListener('click',async()=>{
    if(busy||!client||el('role').textContent!=='SUPERADMIN')return;
    const boton=el('consultarPadron'),estado=el('estadoPadron');
    boton.disabled=true;
    estado.textContent='Verificando autorización de lectura con Supabase Auth...';
    el('tablaPadron').hidden=true;
    el('padronBody').replaceChildren();
    try{
      const {data,error}=await client.rpc('maestro_padron_superadmin');
      if(error||!Array.isArray(data)){
        estado.textContent='El servidor denegó la consulta o no pudo verificar la sesión.';
        return;
      }
      const confirmacion=await client.rpc('maestro_identidad_actual');
      if(confirmacion.error||confirmacion.data?.length!==1||confirmacion.data[0].rol!=='SUPERADMIN'){
        estado.textContent='Consulta cancelada: ya no se reconoce el rol Superadmin.';
        return;
      }
      const tbody=el('padronBody');
      for(const p of data){
        const tr=document.createElement('tr');
        [p.nombre||'',p.email||'',p.es_admin?'SUPERADMIN':'USER',p.auth_vinculada?'Vinculada':'Pendiente'].forEach(value=>{
          const td=document.createElement('td');td.textContent=String(value);tr.appendChild(td);
        });
        tbody.appendChild(tr);
      }
      el('tablaPadron').hidden=false;
      estado.textContent=data.length+' registros visibles mediante función autenticada de solo lectura. Ninguna fila fue modificada.';
    }catch(_){estado.textContent='Error de conexión al comprobar el padrón.'}
    finally{boton.disabled=false}
  });

  el('consultarMigracionAuth').addEventListener('click',async()=>{
    if(busy||!client||el('role').textContent!=='SUPERADMIN')return;
    const actual=client,btn=el('consultarMigracionAuth'),estado=el('estadoMigracionAuth');
    btn.disabled=true;
    estado.textContent='Comprobando correspondencia entre padrón y Supabase Auth...';
    el('indicadoresMigracionAuth').replaceChildren();
    try {
      if(!await superadminActual())throw new Error('role');
      const {data,error}=await actual.rpc('maestro_admin_estado_migracion');
      if(actual!==client||el('role').textContent!=='SUPERADMIN')return;
      if(error||!Array.isArray(data)||data.length!==1)throw new Error('denied');
      const x=data[0];
      for(const [texto,valor] of [
        ['Usuarios de padrón',x.usuarios_padron],
        ['Identidades Auth',x.identidades_auth],
        ['Vinculados y confirmados',x.padron_vinculado_confirmado],
        ['Pendientes de migración',x.usuarios_pendientes],
        ['Superadmins confirmados',x.superadmins_confirmados],
        ['Correos duplicados',x.correos_duplicados]
      ]) {
        const item=document.createElement('div');
        item.className='mi-docencia-indicador';
        const numero=document.createElement('strong');
        numero.textContent=String(valor??'—');
        const etiqueta=document.createElement('span');
        etiqueta.textContent=texto;
        item.append(numero,etiqueta);
        el('indicadoresMigracionAuth').appendChild(item);
      }
      estado.textContent='Resumen agregado, sin correos, contraseñas ni modificación de perfiles.';
    }catch(_){
      if(actual===client)estado.textContent='No se pudo consultar la migración con los permisos actuales.';
    }finally{btn.disabled=false}
  });

  // Una sesión verificable no equivale a autorización para modificar por
  // simple visibilidad del botón: las RPC verifican auth.uid() otra vez.
  async function superadminActual() {
    if(!client||el('role').textContent!=='SUPERADMIN')return false;
    const resultado=await client.rpc('maestro_identidad_actual');
    return !resultado.error&&resultado.data?.length===1&&
      resultado.data[0].rol==='SUPERADMIN';
  }
  const nodo=(padre,tag,clase,texto)=>{
    const n=document.createElement(tag);
    if(clase)n.className=clase;
    if(texto!==undefined)n.textContent=String(texto??'');
    if(padre)padre.appendChild(n);
    return n;
  };
  function dibujarPreguntas(trabajo) {
    const cont=el('preguntasContenidoAuth');
    cont.replaceChildren();
    const preguntas=trabajo?.preguntas_json?.preguntas;
    if(!Array.isArray(preguntas)||preguntas.length!==8){
      nodo(cont,'p','','Este trabajo no contiene una batería válida de ocho preguntas.');
      el('guardarPreguntasAuth').disabled=true;
      return;
    }
    el('guardarPreguntasAuth').disabled=false;
    preguntas.forEach((p,i)=>{
      const card=nodo(cont,'article','qa-question');
      nodo(card,'h3','', 'Pregunta '+(i+1));
      const grupo=(titulo,id,valor,select=false)=>{
        const bloque=nodo(card,'div','');
        const label=nodo(bloque,'label','',titulo);
        label.htmlFor=id;
        const input=nodo(bloque,select?'select':'input','');
        input.id=id;
        if(select){
          for(const c of ['A','B','C','D']){
            const option=nodo(input,'option','',c);
            option.value=c;
          }
        }else{
          input.type='text';input.maxLength=3000;
        }
        input.value=String(valor??'');
        return input;
      };
      grupo('Enunciado', 'qa_p_'+i+'_enunciado',p.enunciado);
      const opciones=nodo(card,'div','qa-option-grid');
      for(const letra of ['A','B','C','D']){
        const op=p.opciones?.find(o=>o.letra===letra);
        const label=nodo(opciones,'label','', 'Alternativa '+letra);
        const input=nodo(opciones,'input','');
        input.id='qa_p_'+i+'_op_'+letra;
        input.type='text';input.maxLength=3000;
        input.value=String(op?.texto||'');
        label.htmlFor=input.id;
      }
      grupo('Respuesta correcta','qa_p_'+i+'_correcta',p.respuesta_correcta||'A',true);
      grupo('Retroalimentación','qa_p_'+i+'_retro',p.retroalimentacion);
    });
  }
  function seleccionarTrabajoAuth(){
    const m=trabajos.find(x=>x.id===el('editorModuloSelector').value);
    if(!m){el('editorFormularioAuth').hidden=true;return}
    el('editorFormularioAuth').hidden=false;
    el('editorTitulo').value=m.titulo||'';
    el('editorAutor').value=m.autor||'';
    el('editorTexto').value=m.contenido_trazado||'';
    dibujarPreguntas(m);
  }
  el('cargarTrabajosAuth').addEventListener('click',async()=>{
    if(busy||guardandoTrabajo)return;
    const boton=el('cargarTrabajosAuth'),estado=el('estadoEditorAuth');
    boton.disabled=true;
    estado.textContent='Validando identidad y consultando trabajos...';
    try{
      if(!await superadminActual()){estado.textContent='Consulta denegada: se requiere Superadmin vigente.';return}
      // El servidor valida el rol SUPERADMIN y devuelve solo los campos editoriales.
      // No consultar directamente la tabla modulos desde el cliente.
      const {data,error}=await client.rpc('maestro_admin_trabajos_editor');
      if(error||!Array.isArray(data)){estado.textContent='No fue posible recuperar los trabajos.';return}
      trabajos=data;
      const selector=el('editorModuloSelector'),anterior=selector.value;
      selector.replaceChildren();
      data.forEach(m=>{
        const op=nodo(selector,'option','','Trabajo '+m.numero_orden+': '+(m.titulo||''));
        op.value=m.id;
      });
      if(data.some(m=>m.id===anterior))selector.value=anterior;
      seleccionarTrabajoAuth();
      estado.textContent=data.length+' trabajos listados. No se ha modificado contenido.';
    }catch(_){estado.textContent='Error de conexión al consultar trabajos.'}
    finally{boton.disabled=false}
  });
  el('editorModuloSelector').addEventListener('change',seleccionarTrabajoAuth);
  async function ejecutarGuardado(nombre,payload,mensaje){
    const estado=el('estadoEditorAuth');
    if(guardandoTrabajo||busy)return false;
    if(!await superadminActual()){estado.textContent='Guardado denegado: sesión Superadmin no vigente.';return false}
    if(!window.confirm('CONFIRMAR CAMBIO REAL: se actualizará un trabajo docente compartido en Supabase y se registrará en auditoría. ¿Continuar?')){
      estado.textContent='Operación cancelada: no hubo cambios.';
      return false;
    }
    guardandoTrabajo=true;
    el('guardarTextoAuth').disabled=true;el('guardarPreguntasAuth').disabled=true;
    try{
      const {data,error}=await client.rpc(nombre,payload);
      if(error||data!==true){
        estado.textContent='El servidor rechazó la modificación. Verifica los campos y los permisos.';
        return false;
      }
      estado.textContent=mensaje+' Auditoría registrada por identidad Auth.';
      return true;
    }catch(_){estado.textContent='Error de comunicación: verificar el estado antes de reintentar.';return false}
    finally{
      guardandoTrabajo=false;el('guardarTextoAuth').disabled=false;
      el('guardarPreguntasAuth').disabled=false;
    }
  }
  el('guardarTextoAuth').addEventListener('click',async()=>{
    const id=el('editorModuloSelector').value;
    const m=trabajos.find(x=>x.id===id);
    if(!m)return;
    const titulo=el('editorTitulo').value.trim(),autor=el('editorAutor').value.trim();
    const texto=el('editorTexto').value;
    if(titulo.length<3||titulo.length>180||texto.trim().length<20||texto.length>300000){
      el('estadoEditorAuth').textContent='Comprueba extensión del título y del texto.';
      return;
    }
    const ok=await ejecutarGuardado('maestro_admin_editar_trabajo',{
      p_modulo_id:id,p_titulo:titulo,p_autor:autor,p_contenido_trazado:texto
    },'Título y texto docente actualizados.');
    if(ok){Object.assign(m,{titulo,autor,contenido_trazado:texto});
      el('editorModuloSelector').selectedOptions[0].textContent=
        'Trabajo '+m.numero_orden+': '+titulo;
    }
  });
  el('guardarPreguntasAuth').addEventListener('click',async()=>{
    const id=el('editorModuloSelector').value;
    const m=trabajos.find(x=>x.id===id);
    if(!m||m.preguntas_json?.preguntas?.length!==8)return;
    const preguntas=m.preguntas_json.preguntas.map((base,i)=>({
      ...base,
      enunciado:el('qa_p_'+i+'_enunciado').value.trim(),
      respuesta_correcta:el('qa_p_'+i+'_correcta').value,
      retroalimentacion:el('qa_p_'+i+'_retro').value.trim(),
      opciones:['A','B','C','D'].map(letra=>({
        letra,texto:el('qa_p_'+i+'_op_'+letra).value.trim()
      }))
    }));
    const valido=preguntas.every(p=>p.enunciado.length>=5&&
      ['A','B','C','D'].includes(p.respuesta_correcta)&&
      p.opciones.every(o=>o.texto.length>=2));
    if(!valido){el('estadoEditorAuth').textContent='Existen enunciados o alternativas incompletas.';return}
    const ok=await ejecutarGuardado('maestro_admin_actualizar_preguntas',{
      p_modulo_id:id,p_bateria:{preguntas}
    },'Las ocho preguntas fueron actualizadas.');
    if(ok)m.preguntas_json={...m.preguntas_json,preguntas};
  });


  function pintarResumenBitacora(){
    if(el('role').textContent!=='SUPERADMIN')return;
    const omitir=[
      el('ocultarGmailAuth').checked?'jpintov@gmail.com':null,
      el('ocultarHotmailAuth').checked?'jpintov@hotmail.com':null
    ].filter(Boolean);
    const visibles=accesosBitacora.filter(r=>
      !omitir.includes(String(r.email||'').toLowerCase().trim()));
    const destino=el('bitacoraResumenAuth');
    destino.replaceChildren();
    const resumen=document.createElement('p');
    resumen.textContent=visibles.length+' accesos visibles de '+
      accesosBitacora.length+' registros consultados. Los filtros no eliminan datos históricos.';
    destino.appendChild(resumen);
    el('estadoBitacoraAuth').textContent=visibles.length
      ? 'Resumen de accesos actualizado.' : 'Sin registros visibles con estos filtros.';
  }
  el('cargarBitacoraAuth').addEventListener('click',async()=>{
    if(busy||guardandoTrabajo)return;
    const boton=el('cargarBitacoraAuth');
    boton.disabled=true;
    el('estadoBitacoraAuth').textContent='Consultando registros autorizados...';
    try{
      if(!await superadminActual()){
        el('estadoBitacoraAuth').textContent='Acceso denegado: se requiere Superadmin.';
        return;
      }
      const {data,error}=await client.rpc('maestro_admin_bitacora');
      if(error||!Array.isArray(data)){
        el('estadoBitacoraAuth').textContent='No fue posible consultar la bitácora.';
        return;
      }
      accesosBitacora=data;
      pintarResumenBitacora();
    }catch(_){el('estadoBitacoraAuth').textContent='Error de conexión al consultar accesos.'}
    finally{boton.disabled=false}
  });
  el('ocultarGmailAuth').addEventListener('change',pintarResumenBitacora);
  el('ocultarHotmailAuth').addEventListener('change',pintarResumenBitacora);


  function obtenerTrabajoMiDocencia(){
    const id=el('selectTrabajoMiDocenciaAuth').value;
    const progreso=misProgresosAuth.find(p=>p.modulo_id===id);
    const modulo=catalogoMiDocencia.find(m=>m.modulo_id===id);
    return {id,progreso,modulo};
  }
  function cancelarEdicionMiDocencia(){
    comentarioEditandoId=null;
    el('contenidoComentarioAuth').value='';
    el('cancelarEdicionComentarioAuth').hidden=true;
    el('guardarComentarioAuth').textContent='Publicar comentario — con confirmación';
    el('modoComentarioAuth').textContent=
      'Solo podrá comentar los trabajos que haya completado. La publicación exige confirmación.';
  }
  function panelKpiDocencia(titulo,valor){
    const bloque=document.createElement('div');
    bloque.className='mi-docencia-kpi';
    const numero=document.createElement('strong');
    numero.textContent=String(valor);
    const etiqueta=document.createElement('span');
    etiqueta.textContent=titulo;
    bloque.append(numero,etiqueta);
    el('resumenMiDocenciaAuth').appendChild(bloque);
  }
  async function verificarIdentidadDocencia(){
    if(!client||el('role').textContent!=='USER')return false;
    const {data,error}=await client.rpc('maestro_identidad_actual');
    return !error&&data?.length===1&&data[0].rol===el('role').textContent;
  }
  el('cargarMiDocenciaAuth').addEventListener('click',async()=>{
    if(busy||operacionDocencia||!client)return;
    const actual=client, boton=el('cargarMiDocenciaAuth'), estado=el('estadoMiDocenciaAuth');
    boton.disabled=true;estado.textContent='Consultando exclusivamente avances de esta identidad...';
    try{
      if(!await verificarIdentidadDocencia())throw new Error('not_authorized');
      const [rp,rm]=await Promise.all([
        actual.rpc('maestro_mis_progresos'),
        actual.rpc('maestro_modulos_activos')
      ]);
      if(actual!==client)return;
      if(rp.error||rm.error||!Array.isArray(rp.data)||!Array.isArray(rm.data))
        throw new Error('read_error');
      misProgresosAuth=rp.data;
      catalogoMiDocencia=rm.data;
      const select=el('selectTrabajoMiDocenciaAuth');
      select.replaceChildren();
      for(const m of catalogoMiDocencia){
        const op=document.createElement('option');
        op.value=m.modulo_id;
        op.textContent='Trabajo '+m.numero_orden+': '+(m.titulo||'');
        select.appendChild(op);
      }
      el('resumenMiDocenciaAuth').replaceChildren();
      panelKpiDocencia('Trabajos activos',catalogoMiDocencia.length);
      panelKpiDocencia('Trabajos leídos',misProgresosAuth.filter(p=>p.leido).length);
      panelKpiDocencia('Trabajos concluidos',misProgresosAuth.filter(p=>p.completado).length);
      el('interaccionMiDocenciaAuth').hidden=!catalogoMiDocencia.length;
      el('listaComentariosMiDocenciaAuth').replaceChildren();
      el('lecturaTrabajoMiDocenciaAuth').replaceChildren();
      cancelarEdicionMiDocencia();
      estado.textContent='Consulta completada. Solo se muestran avances vinculados a su identidad autenticada.';
    }catch(_){estado.textContent='No fue posible verificar y consultar sus avances; no se ha modificado nada.'}
    finally{boton.disabled=false}
  });
  async function cargarComentariosMiDocencia(){
    const {id,progreso}=obtenerTrabajoMiDocencia(),destino=el('listaComentariosMiDocenciaAuth');
    destino.replaceChildren();
    cancelarEdicionMiDocencia();
    if(!progreso?.completado&&el('role').textContent!=='SUPERADMIN'){
      const aviso=document.createElement('p');
      aviso.textContent='Los comentarios permanecen bajo reserva docente hasta completar el trabajo.';
      destino.appendChild(aviso);
      return;
    }
    const actual=client;
    try{
      const {data,error}=await actual.rpc('maestro_comentarios_modulo',{p_modulo_id:id});
      if(actual!==client||id!==el('selectTrabajoMiDocenciaAuth').value)return;
      if(error||!Array.isArray(data))throw new Error('read_failed');
      const encabezado=document.createElement('p');
      encabezado.textContent=data.length+' comentarios autorizados en este trabajo.';
      destino.appendChild(encabezado);
      for(const c of data){
        const card=document.createElement('article');
        card.className='mi-docencia-comentario';
        const autor=document.createElement('strong');
        autor.textContent=c.autor_nombre||'Hermano Maestro';
        const fecha=document.createElement('span');
        const date=c.creado_en?new Date(c.creado_en):null;
        fecha.textContent=date&&!Number.isNaN(date.getTime())
          ? ' · '+date.toLocaleDateString('es-CL'):'';
        const cuerpo=document.createElement('p');
        cuerpo.textContent=c.contenido||'';
        card.append(autor,fecha,cuerpo);
        if(c.es_autor){
          const editar=document.createElement('button');
          editar.type='button';editar.className='secondary';
          editar.textContent='Editar mi comentario';
          editar.addEventListener('click',()=>{
            comentarioEditandoId=c.comentario_id;
            el('contenidoComentarioAuth').value=c.contenido||'';
            el('guardarComentarioAuth').textContent='Guardar mi edición — con confirmación';
            el('cancelarEdicionComentarioAuth').hidden=false;
            el('modoComentarioAuth').textContent='El original permanece conservado. Solo puede editar comentarios propios.';
            el('contenidoComentarioAuth').focus();
          });
          card.appendChild(editar);
        }
        destino.appendChild(card);
      }
    }catch(_){
      const aviso=document.createElement('p');
      aviso.textContent='No fue posible consultar los comentarios. Verifique la sesión.';
      destino.appendChild(aviso);
    }
  }
  el('leerTrabajoMiDocenciaAuth').addEventListener('click',async()=>{
    if(busy||operacionDocencia||!client||el('role').textContent!=='USER')return;
    const {id}=obtenerTrabajoMiDocencia();
    const destino=el('lecturaTrabajoMiDocenciaAuth');
    destino.replaceChildren();
    if(!id)return;
    const actual=client;
    const boton=el('leerTrabajoMiDocenciaAuth');
    boton.disabled=true;
    const crear=(tag,texto,padre)=>{
      const nodo=document.createElement(tag);
      if(texto!==undefined)nodo.textContent=String(texto??'');
      if(padre)padre.appendChild(nodo);
      return nodo;
    };
    crear('p','Cargando únicamente el texto y las preguntas autorizadas...',destino);
    try {
      if(!await verificarIdentidadDocencia())throw new Error('identity');
      const {data,error}=await actual.rpc('maestro_trabajo_estudio',{p_modulo_id:id});
      if(actual!==client||el('role').textContent!=='USER'||el('selectTrabajoMiDocenciaAuth').value!==id)return;
      if(error||!Array.isArray(data)||data.length!==1)throw new Error('not_authorized');
      const t=data[0];
      destino.replaceChildren();
      const titulo=crear('h3','Trabajo '+t.numero_orden+': '+(t.titulo||''),destino);
      titulo.className='mi-docencia-titulo-estudio';
      crear('p',t.autor?'Autor: '+t.autor:'',destino);
      const texto=crear('div',t.contenido_trazado||'',destino);
      texto.className='mi-docencia-texto-estudio';
      const preguntas=Array.isArray(t.preguntas)?t.preguntas:[];
      crear('h4','Interrogantes para el estudio ('+preguntas.length+')',destino);
      preguntas.forEach((p,indice)=>{
        const tarjeta=crear('article',undefined,destino);
        tarjeta.className='mi-docencia-pregunta-estudio';
        crear('p','Pregunta '+(indice+1)+': '+(p.enunciado||''),tarjeta);
        const lista=crear('ul',undefined,tarjeta);
        (Array.isArray(p.opciones)?p.opciones:[]).forEach(op=>{
          crear('li',(op.letra||'')+'. '+(op.texto||''),lista);
        });
      });
      crear('p','Las soluciones y la retroalimentación interna no se incluyen en esta consulta.',destino);
    }catch(_){
      if(actual===client&&el('selectTrabajoMiDocenciaAuth').value===id){
        destino.replaceChildren();
        crear('p','No fue posible recuperar el trabajo con el permiso actual.',destino);
      }
    }finally{boton.disabled=false}
  });
  el('verComentariosMiDocenciaAuth').addEventListener('click',cargarComentariosMiDocencia);
  el('selectTrabajoMiDocenciaAuth').addEventListener('change',()=>{
    el('lecturaTrabajoMiDocenciaAuth').replaceChildren();
    el('listaComentariosMiDocenciaAuth').replaceChildren();
    cancelarEdicionMiDocencia();
  });
  el('cancelarEdicionComentarioAuth').addEventListener('click',cancelarEdicionMiDocencia);
  el('marcarLecturaAuth').addEventListener('click',async()=>{
    if(busy||operacionDocencia||!client)return;
    const {id}=obtenerTrabajoMiDocencia();
    if(!id||!window.confirm('Este cambio marcará como leído un trabajo REAL de su perfil. ¿Confirmar?'))return;
    const actual=client;operacionDocencia=true;
    let lecturaRegistrada=false;
    try{
      if(!await verificarIdentidadDocencia())throw new Error('not_authorized');
      const {data,error}=await actual.rpc('maestro_marcar_lectura',{p_modulo_id:id});
      if(actual!==client)return;
      if(error||data!==true)throw new Error('write_failed');
      el('estadoMiDocenciaAuth').textContent='Lectura registrada para su propio perfil.';
      lecturaRegistrada=true;
    }catch(_){el('estadoMiDocenciaAuth').textContent='La lectura no pudo registrarse. No se dará por confirmada.'}
    finally{
      operacionDocencia=false;
      if(lecturaRegistrada&&actual===client)el('cargarMiDocenciaAuth').click();
    }
  });
  el('guardarComentarioAuth').addEventListener('click',async()=>{
    if(busy||operacionDocencia||!client)return;
    const {id,progreso}=obtenerTrabajoMiDocencia();
    const texto=el('contenidoComentarioAuth').value.trim();
    const statusNode=el('estadoMiDocenciaAuth');
    if(!progreso?.completado||texto.length<5||texto.length>1500){
      statusNode.textContent='Debe haber completado el trabajo y escribir un comentario de 5 a 1500 caracteres.';
      return;
    }
    const editando=comentarioEditandoId;
    if(!window.confirm(editando
      ? 'CONFIRMAR EDICIÓN REAL de su comentario; el original se conservará. ¿Continuar?'
      : 'CONFIRMAR PUBLICACIÓN REAL en la Cámara de Maestros. ¿Continuar?'))return;
    operacionDocencia=true;const actual=client;
    try{
      if(!await verificarIdentidadDocencia())throw new Error('not_authorized');
      const {data,error}=editando
        ?await actual.rpc('maestro_editar_comentario_propio',{p_comentario_id:editando,p_contenido:texto})
        :await actual.rpc('maestro_publicar_comentario',{p_progreso_id:progreso.progreso_id,p_contenido:texto});
      if(actual!==client)return;
      if(error||(!editando&&!data)||(editando&&data!==true))throw new Error('write_failed');
      statusNode.textContent=editando?'Comentario propio actualizado.':'Comentario publicado con identidad verificada.';
      cancelarEdicionMiDocencia();
      await cargarComentariosMiDocencia();
    }catch(_){statusNode.textContent='El servidor rechazó la operación o falló la conexión; revise antes de reintentar.'}
    finally{operacionDocencia=false}
  });


  function dibujarSupervisionDocencia(){
    if(el('role').textContent!=='SUPERADMIN')return;
    const filtro=el('filtrarSupervisionDocencia').value.trim().toLocaleLowerCase('es-CL');
    const filas=supervisionDocenciaDatos.filter(u=>
      (String(u.nombre||'')+' '+String(u.email||'')).toLocaleLowerCase('es-CL').includes(filtro));
    const tbody=el('cuerpoSupervisionDocencia');
    tbody.replaceChildren();
    for(const u of filas){
      const tr=document.createElement('tr');
      const nombre=document.createElement('td');
      const titulo=document.createElement('strong');
      titulo.textContent=u.nombre||'Maestro';
      const email=document.createElement('span');
      email.textContent=u.email||'';
      nombre.append(titulo,email);
      tr.appendChild(nombre);
      const disponibles=Math.max(0,Number(u.trabajos_disponibles)||0);
      for(const valor of [u.trabajos_leidos,u.trabajos_completados]){
        const td=document.createElement('td');
        td.textContent=String(Math.max(0,Number(valor)||0))+' / '+String(disponibles);
        tr.appendChild(td);
      }
      const fecha=document.createElement('td');
      const d=u.ultima_conclusion?new Date(u.ultima_conclusion):null;
      fecha.textContent=d&&!Number.isNaN(d.getTime())?d.toLocaleDateString('es-CL'):'—';
      tr.appendChild(fecha);
      tbody.appendChild(tr);
    }
    el('tablaSupervisionContenedor').hidden=false;
    el('estadoSupervisionDocencia').textContent=
      'Consulta de solo lectura: '+filas.length+' de '+supervisionDocenciaDatos.length+
      ' Maestros. Ningún avance administrativo se ha creado.';
  }
  el('consultarSupervisionDocencia').addEventListener('click',async()=>{
    if(busy||guardandoTrabajo||operacionDocencia)return;
    const btn=el('consultarSupervisionDocencia');
    btn.disabled=true;
    el('estadoSupervisionDocencia').textContent='Autenticando supervisor y preparando resumen...';
    const current=client;
    try{
      if(!await superadminActual())throw new Error('sin_rol_superadmin');
      const {data,error}=await current.rpc('maestro_admin_resumen_docencia');
      if(current!==client)return;
      if(error||!Array.isArray(data))throw new Error('no_disponible');
      supervisionDocenciaDatos=data;
      const box=el('indicadoresSupervisionDocencia');
      box.replaceChildren();
      const resumen=[
        ['Maestros',data.length],
        ['Trabajos activos',data.length?Number(data[0].trabajos_disponibles)||0:0],
        ['Lecturas registradas',data.reduce((t,u)=>t+(Number(u.trabajos_leidos)||0),0)],
        ['Trabajos concluidos',data.reduce((t,u)=>t+(Number(u.trabajos_completados)||0),0)]
      ];
      for(const [etiqueta,valor] of resumen){
        const card=document.createElement('article');
        const cantidad=document.createElement('strong');
        cantidad.textContent=String(valor);
        const label=document.createElement('span');
        label.textContent=etiqueta;
        card.append(cantidad,label);
        box.appendChild(card);
      }
      dibujarSupervisionDocencia();
    }catch(_){
      el('estadoSupervisionDocencia').textContent=
        'No fue posible autorizar el resumen. Verifique el rol y la conexión.';
    }finally{btn.disabled=false}
  });
  el('filtrarSupervisionDocencia').addEventListener('input',dibujarSupervisionDocencia);

  el('logout').addEventListener('click',async()=>{await signOut();status('Sesión cerrada.');});
  window.addEventListener('pagehide',()=>{if(client)client.auth.signOut({scope:'local'}).catch(()=>{})});
})();
