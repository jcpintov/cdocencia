-- Prueba transaccional: no envía correos y revierte todas las filas de prueba.
begin;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$
declare actor uuid;usuario uuid;v_codigo text;v_codigo2 text;correo_id uuid;recordatorio_id uuid;asig jsonb;otra jsonb;ctx jsonb;msg jsonb;v jsonb;modulo uuid;aviso_id uuid;aviso_intento uuid;
begin
 select auth_user_id into actor from public.usuarios where es_admin and lower(email)='jpintov@gmail.com';
 select id into usuario from public.usuarios where not es_admin and lower(email)<>'dummy@ofl.cl' limit 1;
 select t.codigo into v_codigo from public.unidades_docencia t where t.activo and t.codigo~'^(INCI|INST|FILO|ETIC)[0-9]{2}[0-9A-Z][A-Z1-9]$'
  and not exists(select 1 from public.modulos m where m.activo and(m.unidad_codigo=t.codigo or exists(select 1 from public.modulos_temas mt where mt.modulo_id=m.id and mt.codigo=t.codigo))) limit 1;
 select t.codigo into v_codigo2 from public.unidades_docencia t where t.activo and t.codigo<>v_codigo and t.codigo~'^(INCI|INST|FILO|ETIC)[0-9]{2}[0-9A-Z][A-Z1-9]$'
  and not exists(select 1 from public.modulos m where m.activo and(m.unidad_codigo=t.codigo or exists(select 1 from public.modulos_temas mt where mt.modulo_id=m.id and mt.codigo=t.codigo))) limit 1;
 asig:=public.admin_asignaciones_docentes(actor,'crear',jsonb_build_object('usuario_id',usuario,'codigo',v_codigo,'fecha_asignacion',current_date-40,'fecha_entrega',current_date-15));
 assert asig->'recordatorio'->>'estado'='sin_solicitud','Sin solicitud no debe programarse';
 correo_id:=gen_random_uuid();msg:=jsonb_build_object('to',asig->>'email','subject','QA','text','QA','html','<p>QA</p>');
 perform public.admin_asignaciones_docentes(actor,'reservar_correo',jsonb_build_object('id',asig->>'id','version',1,'intento',correo_id,'reenviar',false,'correo',msg));
 perform public.admin_asignaciones_docentes(actor,'finalizar_correo',jsonb_build_object('id',asig->>'id','version',1,'intento',correo_id,'estado','enviado','copia_estado','aceptada'));
 ctx:=public.docencia_asignacion_contexto((asig->>'id')::uuid);
 assert ctx->'recordatorio'->>'estado'='pendiente','Debe ser elegible tras siete días';
 assert ctx->'recordatorio'->>'solicitud_enviada_en' is not null,'Debe conservar fecha real de envío';
 assert ctx->'correos'->0->>'copia_estado'='aceptada','CCO registrada';
 asig:=public.admin_asignaciones_docentes(actor,'modificar',jsonb_build_object('id',asig->>'id','version',1,'usuario_id',usuario,'codigo',v_codigo,'fecha_asignacion',current_date-40,'fecha_entrega',current_date+5));
 assert asig->'recordatorio'->>'estado'='programado','Fecha comprometida editable recalcula programación';
 assert (asig->'recordatorio'->>'programado_para')::timestamptz=((current_date+12)+time '23:30') at time zone 'America/Santiago','Programación con horario local';
 assert asig->'recordatorio'->>'solicitud_enviada_en' is not null,'Editar plazo conserva solicitud';
 v:=public.docencia_recordatorios_servicio('reservar',jsonb_build_object('id',asig->>'id','version',2,'intento',gen_random_uuid(),'solicitud_id',correo_id,'correo',msg));
 assert (v->>'enviar')::boolean=false,'Antes de siete días no se reserva';
 asig:=public.admin_asignaciones_docentes(actor,'modificar',jsonb_build_object('id',asig->>'id','version',2,'usuario_id',usuario,'codigo',v_codigo,'fecha_asignacion',current_date-40,'fecha_entrega',current_date-15));
 recordatorio_id:=gen_random_uuid();v:=public.docencia_recordatorios_servicio('reservar',jsonb_build_object('id',asig->>'id','version',3,'intento',recordatorio_id,'solicitud_id',correo_id,'correo',msg));
 assert (v->>'enviar')::boolean=true,'Primera reserva permitida';
 v:=public.docencia_recordatorios_servicio('reservar',jsonb_build_object('id',asig->>'id','version',3,'intento',gen_random_uuid(),'solicitud_id',correo_id,'correo',msg));
 assert (v->>'enviar')::boolean=false,'Reserva duplicada impedida';
 begin
  perform public.admin_asignaciones_docentes(actor,'modificar',jsonb_build_object('id',asig->>'id','version',3,'usuario_id',usuario,'codigo',v_codigo,'fecha_asignacion',current_date-40,'fecha_entrega',current_date+5));
  raise exception 'No bloqueó modificación durante reserva';
 exception when sqlstate '55000' then null;end;
 v:=public.docencia_recordatorios_servicio('confirmar',jsonb_build_object('id',asig->>'id','intento',recordatorio_id));assert (v->>'enviar')::boolean=true;
 v:=public.docencia_recordatorios_servicio('confirmar',jsonb_build_object('id',asig->>'id','intento',recordatorio_id));assert (v->>'enviar')::boolean=false,'No autoriza dos envíos';
 perform public.docencia_recordatorios_servicio('finalizar',jsonb_build_object('id',asig->>'id','intento',recordatorio_id,'estado','enviado','copia_estado','aceptada'));
 ctx:=public.docencia_asignacion_contexto((asig->>'id')::uuid);assert ctx->'recordatorio'->>'estado'='enviado';assert ctx->'recordatorio'->>'copia_estado'='aceptada';
 -- Segundo caso: publicación entre reserva y SMTP detiene el recordatorio.
 otra:=public.admin_asignaciones_docentes(actor,'crear',jsonb_build_object('usuario_id',usuario,'codigo',v_codigo2,'fecha_asignacion',current_date-40,'fecha_entrega',current_date-15));
 correo_id:=gen_random_uuid();
 perform public.admin_asignaciones_docentes(actor,'reservar_correo',jsonb_build_object('id',otra->>'id','version',1,'intento',correo_id,'reenviar',false,'correo',msg));
 perform public.admin_asignaciones_docentes(actor,'finalizar_correo',jsonb_build_object('id',otra->>'id','version',1,'intento',correo_id,'estado','enviado'));
 recordatorio_id:=gen_random_uuid();v:=public.docencia_recordatorios_servicio('reservar',jsonb_build_object('id',otra->>'id','version',1,'intento',recordatorio_id,'solicitud_id',correo_id,'correo',msg));assert (v->>'enviar')::boolean=true;
 select id into modulo from public.modulos where activo limit 1;
 insert into public.modulos_temas(modulo_id,codigo) values(modulo,v_codigo2);
 v:=public.docencia_recordatorios_servicio('confirmar',jsonb_build_object('id',otra->>'id','intento',recordatorio_id));assert (v->>'enviar')::boolean=false,'Publicación debe impedir SMTP';
 ctx:=public.docencia_asignacion_contexto((otra->>'id')::uuid);assert (ctx->'recordatorio'->>'publicado')::boolean=true;assert ctx->'recordatorio'->>'estado'='cancelado';
 -- Recuperación manual de un proceso interrumpido: no dispara un nuevo correo.
 update public.docencia_asignaciones_recordatorios set estado='preparado',creado_en=now()-interval '3 minutes' where asignacion_id=(otra->>'id')::uuid;
 perform public.admin_asignaciones_docentes(actor,'cerrar_recordatorio',jsonb_build_object('id',otra->>'id','version',1,'intento',recordatorio_id));
 ctx:=public.docencia_asignacion_contexto((otra->>'id')::uuid);assert ctx->'recordatorio'->>'estado'='incierto';
 -- Publicación: autor correcto, cola única y aceptación de la copia, sin SMTP.
 update public.modulos set autor='AUTOR NO IDENTIFICADO QA' where id=modulo;
 assert (select count(*) from public.docencia_publicaciones_correos)=0,'No inventa destinatarios';
 update public.modulos set autor=(select nombre from public.usuarios where id=usuario) where id=modulo;
 select id into aviso_id from public.docencia_publicaciones_correos where modulo_id=modulo and usuario_id=usuario and codigo=v_codigo2;
 assert aviso_id is not null,'Publicación de tema asignado encola aviso al autor';
 update public.modulos set autor=autor where id=modulo;
 assert (select count(*) from public.docencia_publicaciones_correos where modulo_id=modulo)=1,'Editar no duplica aviso';
 aviso_intento:=gen_random_uuid();
 v:=public.docencia_publicaciones_servicio('reservar',jsonb_build_object('id',aviso_id,'intento',aviso_intento,'correo',msg));assert (v->>'enviar')::boolean=true;
 v:=public.docencia_publicaciones_servicio('reservar',jsonb_build_object('id',aviso_id,'intento',gen_random_uuid(),'correo',msg));assert (v->>'enviar')::boolean=false;
 v:=public.docencia_publicaciones_servicio('confirmar',jsonb_build_object('id',aviso_id,'intento',aviso_intento));assert (v->>'enviar')::boolean=true;
 perform public.docencia_publicaciones_servicio('finalizar',jsonb_build_object('id',aviso_id,'intento',aviso_intento,'estado','enviado','copia_estado','aceptada'));
 ctx:=public.docencia_asignacion_contexto((otra->>'id')::uuid);assert ctx->'avisos_publicacion'->0->>'estado'='enviado';
 assert public.docencia_nombre_autor('Q.·.H.·. José  Pérez')=public.docencia_nombre_autor('JOSE PEREZ');
 assert not has_table_privilege('anon','public.docencia_asignaciones_recordatorios','SELECT');
 assert not has_function_privilege('authenticated','public.docencia_recordatorios_servicio(text,jsonb)','EXECUTE');
end $$;
rollback;
select jsonb_build_object('asignaciones',(select count(*) from public.docencia_asignaciones),'recordatorios',(select count(*) from public.docencia_asignaciones_recordatorios),'avisos_publicacion',(select count(*) from public.docencia_publicaciones_correos),'correos',(select count(*) from public.docencia_asignaciones_correos)) as filas_finales;
