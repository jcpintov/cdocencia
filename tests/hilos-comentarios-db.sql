-- Prueba transaccional real. No envía correos ni deja cuentas, trabajos o aportes.
begin;
create temporary table qa_hilos_resultado(resultado jsonb);
do $$
declare actor uuid; actor_auth uuid; otro uuid; admin_auth uuid;
 modulo uuid:=gen_random_uuid(); modulo2 uuid:=gen_random_uuid(); progreso uuid:=gen_random_uuid(); progreso_otro uuid:=gen_random_uuid();
 raiz uuid; hijo uuid; nieto uuid; repetido uuid; solicitud uuid:=gen_random_uuid(); total integer; bloqueado boolean; payload jsonb;
begin
 select id,auth_user_id into actor,actor_auth from public.usuarios where lower(email)='dummy@ofl.cl' and not es_admin and auth_user_id is not null;
 select id into otro from public.usuarios where id<>actor and not es_admin limit 1;
 select auth_user_id into admin_auth from public.usuarios where es_admin and auth_user_id is not null limit 1;
 if actor is null or otro is null or admin_auth is null then raise exception 'Faltan perfiles existentes para la prueba'; end if;
 insert into public.modulos(id,numero_orden,titulo,contenido_trazado,activo,preguntas_json)
 values(modulo,(select coalesce(max(numero_orden),0)+1 from public.modulos),'QA hilo transaccional','Texto sintético de prueba',true,'{"preguntas":[]}'::jsonb);
 insert into public.modulos(id,numero_orden,titulo,contenido_trazado,activo,preguntas_json)
 values(modulo2,(select coalesce(max(numero_orden),0)+1 from public.modulos),'QA reserva transaccional','Texto sintético de prueba',true,'{"preguntas":[]}'::jsonb);
 insert into public.progreso_maestro(id,usuario_id,modulo_id,leido,completado,reflexion) values
 (progreso,actor,modulo,true,true,'Reflexión sintética exclusivamente para una prueba revertida de los hilos docentes.'),
 (progreso_otro,otro,modulo,true,true,'Aporte sintético de otro participante para comprobar las respuestas del hilo.');
 insert into public.comentarios_muro(progreso_id,modulo_id,usuario_id,contenido,contenido_original,activo)
 values(progreso_otro,modulo,otro,'Comentario inicial de prueba','Comentario inicial de prueba',true) returning id into raiz;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor_auth,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 hijo:=public.maestro_responder_comentario(raiz,'Respuesta sintética de prueba',solicitud);
 repetido:=public.maestro_responder_comentario(raiz,'Respuesta sintética de prueba',solicitud);
 if hijo<>repetido then raise exception 'El reintento duplicó la respuesta'; end if;
 nieto:=public.maestro_responder_comentario(hijo,'Respuesta anidada de prueba',gen_random_uuid());
 payload:=public.muro_docente_autorizado(modulo);
 if not exists(select 1 from jsonb_array_elements(payload->'comentarios') c where c->>'id'=nieto::text and c->>'comentario_padre_id'=hijo::text)
 then raise exception 'La consulta autorizada no conservó el parentesco'; end if;
 if jsonb_array_length(payload->'comentarios')<>3 then raise exception 'Recuento de aportes incorrecto'; end if;
 if not public.maestro_editar_comentario_propio(hijo,'Respuesta propia editada de prueba') then raise exception 'Edición propia no confirmada'; end if;
 bloqueado:=false;begin perform public.maestro_editar_comentario_propio(raiz,'Intento ajeno que debe rechazarse');exception when insufficient_privilege then bloqueado:=true;end;
 if not bloqueado then raise exception 'Permitió editar el comentario ajeno'; end if;
 bloqueado:=false;begin update public.comentarios_muro set comentario_padre_id=nieto where id=hijo;exception when insufficient_privilege then bloqueado:=true;end;
 if not bloqueado then raise exception 'Permitió trasladar o ciclar el hilo'; end if;
 bloqueado:=false;begin perform public.maestro_responder_comentario(raiz,'Cambio del texto ya publicado',solicitud);exception when invalid_parameter_value then bloqueado:=true;end;
 if not bloqueado then raise exception 'Reutilización de solicitud incompatible'; end if;
 execute 'reset role';
 -- Una inserción directa tampoco puede mezclar trabajos o reflexiones.
 bloqueado:=false;begin
  insert into public.comentarios_muro(progreso_id,modulo_id,usuario_id,contenido,contenido_original,activo,comentario_padre_id)
  values(progreso,modulo2,actor,'Cruce no admitido','Cruce no admitido',true,raiz);
 exception when check_violation or foreign_key_violation then bloqueado:=true;end;
 if not bloqueado then raise exception 'Permitió cruzar trabajo/reflexión'; end if;
 update public.comentarios_muro set activo=false where id=raiz;
 execute 'set local role authenticated';
 bloqueado:=false;begin perform public.maestro_responder_comentario(raiz,'Respuesta a origen retirado',gen_random_uuid());exception when insufficient_privilege then bloqueado:=true;end;
 if not bloqueado then raise exception 'Permitió responder a origen inactivo'; end if;
 execute 'reset role';
 update public.comentarios_muro set activo=true where id=raiz;
 update public.progreso_maestro set completado=false where id=progreso;
 execute 'set local role authenticated';
 bloqueado:=false;begin perform public.maestro_responder_comentario(raiz,'Respuesta sin completar trabajo',gen_random_uuid());exception when insufficient_privilege then bloqueado:=true;end;
 if not bloqueado then raise exception 'Permitió responder sin completar el trabajo'; end if;
 bloqueado:=false;begin
  insert into public.comentarios_muro(progreso_id,modulo_id,usuario_id,contenido,contenido_original,activo,comentario_padre_id)
  values(progreso_otro,modulo,actor,'Inserción directa no autorizada','Inserción directa no autorizada',true,raiz);
 exception when check_violation or insufficient_privilege then bloqueado:=true;end;
 if not bloqueado then raise exception 'La inserción directa eludió reserva docente'; end if;
 execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_auth,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 bloqueado:=false;begin perform public.maestro_responder_comentario(raiz,'Superadmin no participa del hilo',gen_random_uuid());exception when insufficient_privilege then bloqueado:=true;end;
 if not bloqueado then raise exception 'Superadmin pudo participar'; end if;
 execute 'reset role';
 if has_function_privilege('anon','public.maestro_responder_comentario(uuid,text,uuid)','execute') then raise exception 'RPC accesible sin sesión'; end if;
 select count(*) into total from public.comentarios_muro where modulo_id=modulo;
 insert into qa_hilos_resultado values(jsonb_build_object('estado','PASS','comentarios_totales',total,'hilos_anidados',true,'idempotencia',true,'edicion_propia',true,'reserva_y_roles',true,'cruces_y_ciclos_bloqueados',true,'reversion','rollback'));
end $$;
select * from qa_hilos_resultado;
rollback;
