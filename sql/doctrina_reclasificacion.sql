BEGIN;
DO $migration$
DECLARE definicion text; rama text;
BEGIN
 SELECT pg_get_functiondef('public.doctrina_gestion_superadmin(uuid,text,jsonb)'::regprocedure) INTO definicion;
 IF position('p_accion=''clasificar''' in definicion)>0 THEN RETURN; END IF;
 rama := $branch$
 elsif p_accion='clasificar' then
   if coalesce(p_datos->>'clase','') not in ('normativa','doctrina','docencia','tradicion','ritual','bibliografia') then raise exception 'Categoría inválida' using errcode='22023'; end if;
   select d.id,v.id,jsonb_build_object('anterior',d.clase,'sha256',v.sha256) into v_doc,v_version,v_result
   from doctrina.documentos d join doctrina.versiones v on v.documento_id=d.id
   where v.id=(p_datos->>'id')::uuid and v.numero=(select max(v2.numero) from doctrina.versiones v2 where v2.documento_id=d.id) for update of d;
   if not found then raise exception 'Versión documental no disponible'; end if;
   if v_result->>'anterior' is distinct from p_datos->>'clase_actual' then raise exception 'La categoría cambió. Actualice la biblioteca' using errcode='40001'; end if;
   if v_result->>'anterior'=p_datos->>'clase' then return jsonb_build_object('documento_id',v_doc,'clase',p_datos->>'clase','sin_cambios',true); end if;
   update doctrina.documentos set clase=p_datos->>'clase' where id=v_doc;
   update doctrina.ingesta_documental set clase_propuesta=p_datos->>'clase' where sha256=v_result->>'sha256';
   insert into doctrina.revision_historial(version_id,actor,accion,decision,nota)
   values(v_version,p_actor,'clasificar',p_datos->>'clase',jsonb_build_object('anterior',v_result->>'anterior','nueva',p_datos->>'clase')::text);
   return jsonb_build_object('documento_id',v_doc,'clase',p_datos->>'clase','anterior',v_result->>'anterior');
$branch$;
 IF position(' elsif p_accion=''obtener'' then' in definicion)=0 THEN RAISE EXCEPTION 'No se encontró el punto de ampliación'; END IF;
 EXECUTE replace(definicion,' elsif p_accion=''obtener'' then',rama||' elsif p_accion=''obtener'' then');
END $migration$;
COMMIT;
