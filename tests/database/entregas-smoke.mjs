// PostgreSQL aislado; sin Supabase real ni envío de correos.
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {PGlite}=createRequire(process.env.QA_SQL_ROOT+'/package.json')('@electric-sql/pglite');
const db=new PGlite();
const superadmin='11111111-1111-4111-8111-111111111111',administrador='22222222-2222-4222-8222-222222222222',user='33333333-3333-4333-8333-333333333333',eliminado='44444444-4444-4444-8444-444444444444';
const rpc=async(action,data={},actor=administrador)=>(await db.query('select admin_asignaciones_docentes($1,$2,$3::jsonb) r',[actor,action,JSON.stringify(data)])).rows[0].r;
const recordar=async(action,data={})=>(await db.query('select docencia_recordatorios_servicio($1,$2::jsonb) r',[action,JSON.stringify(data)])).rows[0].r;
const hoy=(await db.query("select (now() at time zone 'America/Santiago')::date::text d")).rows[0].d;
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema doctrina;
 create function auth.role() returns text language sql as $$select current_setting('request.jwt.claim.role',true)$$;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz default now(),deleted_at timestamptz,banned_until timestamptz,raw_app_meta_data jsonb default '{}');
 create table usuarios(id uuid primary key,auth_user_id uuid,email text,nombre text,es_admin boolean,cuenta_eliminada boolean default false,rol text);
 create table doctrina.superadmins(auth_user_id uuid primary key,activo boolean);
 create table unidades_docencia(codigo text primary key,detalle text,orden int,activo boolean default true);
 create table modulos(id uuid primary key default gen_random_uuid(),titulo text,autor text,numero_orden integer,unidad_codigo text,activo boolean default true,creado_en timestamptz default now());
 create table modulos_temas(modulo_id uuid references modulos(id),codigo text references unidades_docencia(codigo));
 grant usage on schema auth to service_role;
 grant select on usuarios,unidades_docencia,modulos,modulos_temas to service_role;
 select set_config('request.jwt.claim.role','service_role',false);`);
 for(const [id,rol] of [[superadmin,'SUPERADMIN'],[administrador,'ADMIN'],[user,'USER'],[eliminado,'USER']]){
  const email=rol==='SUPERADMIN'?'jpintov@gmail.com':id+'@example.invalid';
  await db.query('insert into auth.users(id,email) values($1,$2)',[id,email]);
  await db.query('insert into usuarios(id,auth_user_id,email,nombre,es_admin,rol,cuenta_eliminada) values($1,$1,$2,$3,$4,$5,$6)',[id,email,id===eliminado?'Eliminado':rol,rol!=='USER',rol,id===eliminado]);
 }
 await db.query('insert into doctrina.superadmins values($1,true)',[superadmin]);
 await db.exec("insert into unidades_docencia(codigo,detalle,orden) values('INCI011A','Tema A',1),('INCI011B','Tema B',2)");
 const roles=await readFile('supabase/migrations/20261023171810_rol_administrador.sql','utf8');
 await db.exec(roles.slice(roles.indexOf('CREATE OR REPLACE FUNCTION doctrina.rol_verificado'),roles.indexOf('CREATE OR REPLACE FUNCTION public.es_superadmin_actual')));
 for(const file of ['asignaciones_docentes.sql','recordatorios_asignaciones.sql','avisos_publicacion.sql','asignaciones_fecha_subida.sql'])await db.exec(await readFile('sql/'+file,'utf8'));
 await db.exec(await readFile('supabase/migrations/20261023223532_observaciones_entregas_manuales.sql','utf8'));
 await db.exec(`alter table modulos add column contenido_trazado text,add column preguntas_json jsonb,add column archivo_pdf_base64 text;grant insert on modulos,modulos_temas to service_role;`);
 await db.exec(await readFile('supabase/migrations/20261023223535_trabajos_nuevos_borradores.sql','utf8'));
 // Privilegios reales de service_role y RLS; no se prueban las escrituras como superusuario.
 await db.exec('set role service_role');
 let lista=await rpc('listar');assert.equal(lista.usuarios.length,1);assert.equal(lista.usuarios[0].observacion,'');
 await rpc('observacion',{usuario_id:user,version:0,observacion:'Excusado temporalmente. <script>texto</script>'});
 lista=await rpc('listar');assert.equal(lista.usuarios[0].observacion_version,1);assert.match(lista.usuarios[0].observacion,/Excusado/);
 await assert.rejects(()=>rpc('observacion',{usuario_id:user,version:0,observacion:'Desactualizada'}),/cambió/);
 for(const id of [superadmin,administrador,eliminado])await assert.rejects(()=>rpc('observacion',{usuario_id:id,version:0,observacion:'No'}),/no disponible/);
 await assert.rejects(()=>rpc('observacion',{usuario_id:user,version:1,observacion:'x'.repeat(501)}),/inválida/);
 await assert.rejects(()=>rpc('observacion',{usuario_id:user,version:1,observacion:'No'},user),/Acceso denegado/);
 await rpc('observacion',{usuario_id:user,version:1,observacion:''},superadmin);
 assert.equal((await rpc('listar')).usuarios[0].observacion,'');
 const crear=codigo=>rpc('crear',{usuario_id:user,codigo,fecha_asignacion:'2020-01-01',fecha_entrega:'2020-02-01'});
 let a=await crear('INCI011A');const b=await crear('INCI011B');
 const correo={to:a.email,subject:'QA',text:'QA',html:'<p>QA</p>'};
 async function solicitar(asig){const intento=crypto.randomUUID();await rpc('reservar_correo',{id:asig.id,version:asig.version,intento,reenviar:false,correo});await rpc('finalizar_correo',{id:asig.id,version:asig.version,intento,estado:'enviado'});return intento;}
 const solicitud=await solicitar(a);await solicitar(b);
 assert.equal((await recordar('candidatos')).length,2);
 const intento=crypto.randomUUID();assert.equal((await recordar('reservar',{id:a.id,version:a.version,intento,solicitud_id:solicitud,correo})).enviar,true);
 const entregar=extra=>rpc('entregar',{id:a.id,version:a.version,confirmado:true,fecha_entrega_real:hoy,nota:'Recibido por correo',...extra});
 await assert.rejects(()=>entregar({confirmado:false}),/Confirme/);
 await assert.rejects(()=>entregar({fecha_entrega_real:'2099-01-01'}),/fecha efectiva/);
 await assert.rejects(()=>entregar({fecha_entrega_real:'2019-01-01'}),/fecha efectiva/);
 await assert.rejects(()=>entregar({nota:'x'.repeat(501)}),/fecha efectiva/);
 a=await entregar();assert.equal(a.entregado_el,hoy);assert.equal(a.entregado_por,administrador);assert.ok(a.entrega_registrada_en);assert.equal(a.version,2);assert.equal(a.recordatorio.entregado,true);assert.equal(a.recordatorio.publicado,false);assert.equal(a.recordatorio.estado,'entregado');
 assert.equal((await recordar('candidatos')).length,1);assert.equal((await recordar('confirmar',{id:a.id,intento})).enviar,false,'Reserva anterior no puede enviar tras registrar entrega');
 await assert.rejects(()=>rpc('reabrir',{id:a.id,version:1,confirmado:true}),/cambió/);
 await assert.rejects(()=>rpc('modificar',{id:a.id,version:a.version,usuario_id:user,codigo:a.codigo,fecha_asignacion:'2020-01-01',fecha_entrega:'2020-02-01'}),/Reabra/);
 a=await rpc('reabrir',{id:a.id,version:a.version,confirmado:true});assert.equal(a.entregado_el,null);assert.equal(a.fecha_entrega,'2020-02-01');assert.equal(a.recordatorio.estado,'pendiente');assert.equal((await recordar('candidatos')).length,2);
 const siguiente=crypto.randomUUID();assert.equal((await recordar('reservar',{id:a.id,version:a.version,intento:siguiente,solicitud_id:solicitud,correo})).enviar,true);
 assert.equal((await recordar('confirmar',{id:a.id,intento:siguiente})).enviar,true);
 await assert.rejects(()=>entregar(),/correo en curso/);
 await recordar('finalizar',{id:a.id,intento:siguiente,estado:'enviado'});
 a=await entregar();a=await rpc('reabrir',{id:a.id,version:a.version,confirmado:true});assert.equal(a.recordatorio.estado,'enviado');assert.ok(!(await recordar('candidatos')).some(x=>x.id===a.id),'Reabrir no duplica recordatorio ya enviado');
 const m=crypto.randomUUID();await db.exec('reset role');await db.query("insert into modulos(id,titulo,autor,numero_orden,unidad_codigo) values($1,'Publicación','USER',1,'INCI011B')",[m]);await db.exec('set role service_role');
 const publicado=(await rpc('listar')).asignaciones.find(x=>x.id===b.id);assert.equal(publicado.recordatorio.entregado,true);assert.equal(publicado.recordatorio.publicado,true);
 await assert.rejects(()=>rpc('entregar',{id:b.id,version:b.version,confirmado:true,fecha_entrega_real:hoy,nota:''}),/publicado/);
 assert.equal((await db.query('select count(*)::int n from docencia_publicaciones_correos')).rows[0].n,1,'Solo publicar genera aviso al autor');
 assert.ok((await db.query('select count(*)::int n from docencia_asignaciones_historial where accion in ($1,$2)',['entregar','reabrir'])).rows[0].n>=4);
 const draft=crypto.randomUUID(),baseTexto='La fraternidad exige escuchar y actuar con justicia. '.repeat(12),preguntas={preguntas:Array.from({length:8},(_,i)=>({enunciado:'Pregunta '+i,opciones:[],sustento:'La fraternidad exige escuchar',respuesta_correcta:'A',retroalimentacion:'Revisión docente'}))};
 const borr=async(accion,datos={},actor=administrador)=>(await db.query('select admin_borradores_docentes($1,$2,$3::jsonb) r',[actor,accion,JSON.stringify(datos)])).rows[0].r;
 const original={nombre:'trabajo.pdf',data_url:'data:application/pdf;base64,JVBERi0=',sha256:'a'.repeat(64)};
 await borr('crear',{id:draft,original,extraccion:{texto_original:baseTexto,separados:[]},texto:baseTexto});
 assert.equal((await borr('listar')).borradores.length,1);assert.equal((await borr('listar',{},superadmin)).borradores.length,0);
 await assert.rejects(()=>borr('obtener',{id:draft},superadmin),/no disponible/);await assert.rejects(()=>borr('listar',{},user),/requerida/);
 let d=await borr('obtener',{id:draft});assert.equal(d.original.data_url,original.data_url);
 const ficha={titulo:'Trabajo nuevo',autor:'USER',numero_orden:10,codigo:'INCI011A'};
 await borr('guardar',{id:draft,revision:1,ficha,texto:baseTexto,preguntas:null});d=await borr('obtener',{id:draft});assert.equal(d.revision,2);
 await assert.rejects(()=>borr('publicar',{id:draft,revision:2,confirmado:true}),/ocho preguntas/);
 const tarea=crypto.randomUUID();await borr('reservar_ia',{id:draft,revision:2,intento:tarea,confirmado:true});
 await assert.rejects(()=>borr('reservar_ia',{id:draft,revision:2,intento:crypto.randomUUID(),confirmado:true}),/en curso/);
 await borr('finalizar_ia',{id:draft,revision:2,intento:tarea,preguntas,preguntas_hash:'b'.repeat(64)});d=await borr('obtener',{id:draft});assert.equal(d.preguntas.preguntas.length,8);
 await borr('guardar',{id:draft,revision:d.revision,ficha,texto:baseTexto+'Nueva reflexión.',preguntas,preguntas_hash:'b'.repeat(64)});d=await borr('obtener',{id:draft});assert.equal(d.preguntas,null,'Editar texto invalida cuestionario');
 await assert.rejects(()=>borr('guardar',{id:draft,revision:1,ficha,texto:baseTexto,preguntas:null}),/cambió/);
 await borr('guardar',{id:draft,revision:d.revision,ficha,texto:d.texto,preguntas,preguntas_hash:'c'.repeat(64)});d=await borr('obtener',{id:draft});
 await assert.rejects(()=>borr('publicar',{id:draft,revision:d.revision,confirmado:false}),/Revise/);
 assert.equal((await borr('publicar',{id:draft,revision:d.revision,confirmado:true})).publicado,true);assert.equal((await borr('publicar',{id:draft,revision:d.revision,confirmado:true})).repetido,true);
 assert.equal((await db.query('select count(*)::int n from modulos where id=$1',[draft])).rows[0].n,1);assert.equal((await db.query('select archivo_pdf_base64 from modulos where id=$1',[draft])).rows[0].archivo_pdf_base64,original.data_url);assert.equal((await borr('listar')).borradores.length,0);
 const quota=crypto.randomUUID();await borr('crear',{id:quota,original,extraccion:{texto_original:baseTexto,separados:[]},texto:baseTexto});
 for(let n=0;n<9;n++){const intento=crypto.randomUUID();await borr('reservar_ia',{id:quota,revision:1,intento,confirmado:true});await borr('finalizar_ia',{id:quota,revision:1,intento,preguntas:null});}
 await assert.rejects(()=>borr('reservar_ia',{id:quota,revision:1,intento:crypto.randomUUID(),confirmado:true}),/Límite de generación/);
 console.log('PASS PostgreSQL borradores: privados por actor, texto invalida preguntas, revisión concurrente, publicación explícita e idempotente y original intacto.');
 await db.exec('reset role');
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);
  await assert.rejects(()=>db.query('select * from docencia_observaciones'),/permission denied/);
  await assert.rejects(()=>db.query('select * from docencia_borradores'),/permission denied/);
  await assert.rejects(()=>rpc('listar'),/permission denied/);
  await db.exec('reset role');
 }
 console.log('PASS PostgreSQL: observaciones privadas, concurrencia, permisos, entrega/reapertura, publicación, cancelación antes de SMTP y no duplicar recordatorios.');
}finally{await db.close();}
