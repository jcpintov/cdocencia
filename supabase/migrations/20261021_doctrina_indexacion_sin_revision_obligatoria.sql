-- Doctrina: la extracción legible queda indexada, sin revisión manual obligatoria.
-- Solo un Superadmin autenticado mediante la API existente puede iniciar
-- extracciones y autorizar el envío de pasajes a Groq. Los PDF continúan privados.
BEGIN;
ALTER TABLE doctrina.textos_extraidos DROP CONSTRAINT textos_extraidos_estado_check;
ALTER TABLE doctrina.textos_extraidos ADD CONSTRAINT textos_extraidos_estado_check
 CHECK (estado IN ('revision','aprobado','indexado'));

DO $mig$
DECLARE f text; old_insert text; new_insert text; previo text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO f
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='doctrina_texto_superadmin';
 IF f IS NULL THEN RAISE EXCEPTION 'La RPC de Doctrina no existe'; END IF;
 old_insert := 'insert into doctrina.textos_extraidos(version_id,sha256,motor,paginas,total_paginas,creado_por) values(v.id,v.sha256,p_datos->>''motor'',p_datos->''paginas'',jsonb_array_length(p_datos->''paginas''),p_actor) on conflict(version_id) do nothing;';
 new_insert := 'insert into doctrina.textos_extraidos(version_id,sha256,motor,paginas,total_paginas,estado,creado_por) values(v.id,v.sha256,p_datos->>''motor'',p_datos->''paginas'',jsonb_array_length(p_datos->''paginas''),''indexado'',p_actor) on conflict(version_id) do nothing;';
 IF position(old_insert in f)=0 THEN RAISE EXCEPTION 'Contrato de guardado de extracción cambió'; END IF;
 f:=replace(f,old_insert,new_insert);

 -- Una extracción indexada es consultable, incluso antes de revisar página
 -- a página. La revisión humana continúa siendo opcional y trazable.
 IF position('t.estado=''aprobado''' in f)=0 THEN RAISE EXCEPTION 'Contrato de estados de consulta cambió'; END IF;
 f:=replace(f,'t.estado=''aprobado''','t.estado in (''indexado'',''revision'',''aprobado'')');

 -- Páginas sin texto legible u OCR pendiente no se usan como evidencia.
 previo:='and to_tsvector(''spanish'',p->>''texto'') @@ websearch_to_tsquery';
 IF position(previo in f)=0 THEN RAISE EXCEPTION 'Contrato de páginas de búsqueda cambió'; END IF;
 f:=replace(f,previo,
  'and length(btrim(coalesce(p->>''texto'','''')))>=20 and coalesce((p->>''requiere_ocr'')::boolean,false)=false '||previo);

 -- Mantener el indicador heredado y agregar uno semánticamente preciso.
 f:=replace(f,'''texto_aprobado'',coalesce(t.estado in (''indexado'',''revision'',''aprobado'') and t.sha256=fuente.sha256,false)',
 '''texto_aprobado'',coalesce(t.estado in (''indexado'',''revision'',''aprobado'') and t.sha256=fuente.sha256,false),''texto_indexado'',coalesce(t.estado in (''indexado'',''revision'',''aprobado'') and t.sha256=fuente.sha256,false)');

 -- Permiso masivo explícito, limitado a textos indexados de versiones vigentes.
 previo := 'if p_accion=''texto_llm_listar'' then';
 IF position(previo in f)=0 THEN RAISE EXCEPTION 'Contrato de permisos cambió'; END IF;
 f:=replace(f,previo, $body$
if p_accion='texto_llm_autorizar_biblioteca' then
  if p_datos->>'confirmacion' is distinct from 'true' then raise exception 'Se requiere autorización expresa'; end if;
  insert into doctrina.llm_autorizaciones(version_id,sha256,proveedor,modelo,autorizado,actor)
  select v2.id,v2.sha256,'groq','openai/gpt-oss-120b',true,p_actor
  from doctrina.documentos d
  join doctrina.versiones v2 on v2.documento_id=d.id
  join doctrina.textos_extraidos t on t.version_id=v2.id
   and t.sha256=v2.sha256 and t.estado in ('indexado','revision','aprobado')
  where d.estado='vigente'
   and v2.numero=(select max(v3.numero) from doctrina.versiones v3 where v3.documento_id=d.id)
   and exists(select 1 from jsonb_array_elements(t.paginas) p
     where length(btrim(coalesce(p->>'texto','')))>=20
     and not coalesce((p->>'requiere_ocr')::boolean,false))
  on conflict(version_id) do update set sha256=excluded.sha256,proveedor='groq',
   modelo='openai/gpt-oss-120b',autorizado=true,actor=p_actor,
   revision=gen_random_uuid(),actualizado_en=now();

  insert into doctrina.llm_autorizaciones_historial(version_id,actor,autorizado,proveedor,modelo,sha256)
  select a.version_id,p_actor,true,a.proveedor,a.modelo,a.sha256
  from doctrina.llm_autorizaciones a
  join doctrina.versiones v2 on v2.id=a.version_id and v2.sha256=a.sha256
  join doctrina.documentos d on d.id=v2.documento_id and d.estado='vigente'
  where a.autorizado and a.actor=p_actor
   and v2.numero=(select max(v3.numero) from doctrina.versiones v3 where v3.documento_id=d.id);

  update doctrina.documentos d set autorizacion_procesamiento_externo=true
  where d.estado='vigente' and exists(
   select 1 from doctrina.versiones v2 join doctrina.llm_autorizaciones a on a.version_id=v2.id
   where v2.documento_id=d.id and a.autorizado and a.sha256=v2.sha256
    and v2.numero=(select max(v3.numero) from doctrina.versiones v3 where v3.documento_id=d.id));
  return jsonb_build_object('ok',true,'autorizados',(
   select count(*) from doctrina.llm_autorizaciones a join doctrina.versiones v2 on v2.id=a.version_id
   join doctrina.documentos d on d.id=v2.documento_id
   where d.estado='vigente' and a.autorizado and a.sha256=v2.sha256));
elsif p_accion='texto_llm_listar' then
$body$);
 f:=replace(f,'select d.titulo,d.clase,fuente.id as version_id',
   'select d.titulo,d.clase,t.estado as estado_texto,fuente.id as version_id');
 EXECUTE f;
END $mig$;
COMMIT;
