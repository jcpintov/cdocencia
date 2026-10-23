// PostgreSQL aislado: comprueba la migración completa, RLS y la delegación sin cuentas reales.
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {PGlite}=createRequire(process.env.QA_SQL_ROOT+'/package.json')('@electric-sql/pglite');
const db=new PGlite();
const principal='11111111-1111-4111-8111-111111111111',delegado='22222222-2222-4222-8222-222222222222',otro='33333333-3333-4333-8333-333333333333';
const rol=async(id)=>(await db.query('select doctrina.rol_verificado($1) as rol',[id])).rows[0].rol;
const cambiar=async(actor,id,nuevo,actual)=>(await db.query('select public.admin_gestionar_rol($1,$2,$3,$4,$5) as r',[actor,id,nuevo,actual,'Responsable docente de prueba'])).rows[0].r;
const claims=async(id,role='service_role')=>db.query("select set_config('request.jwt.claim.role',$1,false),set_config('request.jwt.claim.sub',$2,false)",[role,id]);
try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
 CREATE SCHEMA auth;CREATE SCHEMA doctrina;CREATE SCHEMA storage;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$SELECT current_setting('request.jwt.claim.role',true)$$;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz DEFAULT now(),deleted_at timestamptz,banned_until timestamptz,raw_app_meta_data jsonb DEFAULT '{}');
 CREATE TABLE usuarios(id uuid PRIMARY KEY,auth_user_id uuid,email text,nombre text,es_admin boolean NOT NULL DEFAULT false,cuenta_eliminada boolean NOT NULL DEFAULT false,debe_cambiar_clave boolean DEFAULT false);
 CREATE TABLE doctrina.superadmins(auth_user_id uuid PRIMARY KEY,activo boolean);
 CREATE FUNCTION public.es_superadmin_actual() RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
 ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
 CREATE POLICY usuarios_lectura_admin ON usuarios FOR SELECT TO authenticated USING(public.es_superadmin_actual());
 CREATE TABLE modulos(id uuid PRIMARY KEY,numero_orden int,titulo text,autor text,contenido_trazado text,preguntas_json jsonb,activo boolean);
 CREATE TABLE progreso_maestro(id uuid,usuario_id uuid,modulo_id uuid,leido boolean,completado boolean,completado_en timestamptz);
 CREATE TABLE registro_accesos(id uuid,usuario_id uuid,fecha_acceso timestamptz,creado_en timestamptz,nombre text,email text,ip_origen text);
 CREATE TABLE config_segura(id uuid,clave text);
 ALTER TABLE config_segura ENABLE ROW LEVEL SECURITY;
 CREATE POLICY config_solo_superadmin ON config_segura FOR SELECT TO authenticated USING(public.es_superadmin_actual());
 GRANT SELECT ON usuarios,config_segura TO authenticated;
 CREATE TABLE doctrina.versiones(id uuid);
 CREATE TABLE doctrina.textos_extraidos(id uuid);
 CREATE TABLE doctrina.trabajos_tenida(id uuid);
 CREATE TABLE docencia_asignaciones(id uuid,usuario_id uuid,codigo text,fecha_asignacion date,fecha_entrega date,vigente boolean,creado_en timestamptz);
 CREATE TABLE unidades_docencia(codigo text,detalle text,orden int,activo boolean);
 CREATE FUNCTION docencia_asignacion_contexto(uuid) RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;
 INSERT INTO config_segura VALUES(gen_random_uuid(),'no delegable');`);
 for(const [id,email,admin] of [[principal,'jpintov@gmail.com',true],[delegado,'delegado@example.invalid',false],[otro,'otro@example.invalid',false]]){
  await db.query('insert into auth.users(id,email) values($1,$2)',[id,email]);
  await db.query('insert into usuarios(id,auth_user_id,email,nombre,es_admin) values($1,$1,$2,$2,$3)',[id,email,admin]);
 }
 await db.query('insert into doctrina.superadmins values($1,true)',[principal]);
 await db.exec(await readFile('supabase/migrations/20261023171810_rol_administrador.sql','utf8'));
 assert.equal(await rol(principal),'SUPERADMIN');assert.equal(await rol(delegado),'USER');
 await claims(principal);
 assert.equal((await cambiar(principal,delegado,'ADMIN','USER')).rol,'ADMIN');assert.equal(await rol(delegado),'ADMIN');
 assert.equal((await db.query('select count(*)::int n from doctrina.auditoria_roles')).rows[0].n,1);
 await assert.rejects(()=>cambiar(delegado,otro,'ADMIN','USER'),/Superadmin requerido/);
 await assert.rejects(()=>cambiar(principal,principal,'USER','ADMIN'),/Cuenta protegida/);
 await assert.rejects(()=>cambiar(principal,otro,'SUPERADMIN','USER'),/Datos inválidos/);
 await assert.rejects(()=>cambiar(principal,delegado,'USER','USER'),/Rol desactualizado/);
 await claims(delegado,'authenticated');
 await db.exec('SET ROLE authenticated');
 assert.equal((await db.query('select count(*)::int n from usuarios')).rows[0].n,3);
 assert.equal((await db.query('select count(*)::int n from config_segura')).rows[0].n,0);
 assert.equal((await db.query('select public.es_superadmin_actual() v,public.es_operador_actual() op')).rows[0].v,false);
 await assert.rejects(()=>db.query('select admin_gestionar_rol($1,$2,$3,$4,$5)',[delegado,otro,'ADMIN','USER','Intrusión']),/permission denied/);
 await db.exec('RESET ROLE');
 // Incluso si una futura concesión de columnas fuese errónea, el trigger niega el autoascenso.
 await assert.rejects(()=>db.query("update usuarios set rol='SUPERADMIN',es_admin=true where id=$1",[delegado]),/Rol protegido/);
 await claims(delegado);
 for(const fn of ['doctrina_gestion_superadmin','doctrina_texto_superadmin','trabajos_tenida_superadmin','admin_asignaciones_docentes']){
  await assert.rejects(()=>db.query(`select public.${fn}($1,'listar','{}')`,[otro]),/Acceso denegado/);
 }
 for(const action of ['texto_llm_autorizar','texto_llm_revocar','texto_llm_autorizar_biblioteca'])await assert.rejects(()=>db.query('select doctrina_texto_superadmin($1,$2,$3)',[delegado,action,'{}']),/exclusiva de Superadmin/);
 const listado=(await db.query("select admin_asignaciones_docentes($1,'listar','{}') r",[delegado])).rows[0].r;
 assert.equal(listado.usuarios.length,1);assert.equal(listado.usuarios[0].id,otro);
 await claims(principal);await cambiar(principal,delegado,'USER','ADMIN');assert.equal(await rol(delegado),'USER');
 await assert.rejects(()=>db.query("select admin_asignaciones_docentes($1,'listar','{}')",[delegado]),/Acceso denegado/);
 await db.query('update auth.users set banned_until=now()+interval \'1 day\' where id=$1',[otro]);
 await assert.rejects(()=>cambiar(principal,otro,'ADMIN','USER'),/Cuenta sin activar/);
 assert.equal((await db.query('select count(*)::int n from doctrina.auditoria_roles')).rows[0].n,2);
 // Ampliación: rol previo a Auth y primer acceso con OTP, sin privilegios antes de activar.
 await db.exec(await readFile('sql/agente_casos_revisados.sql','utf8'));
 await db.exec(`CREATE SCHEMA extensions;
 CREATE FUNCTION extensions.crypt(text,text) RETURNS text LANGUAGE sql AS $$SELECT 'fixture:'||$1$$;
 CREATE FUNCTION extensions.gen_salt(text) RETURNS text LANGUAGE sql AS $$SELECT 'fixture'$$;
 CREATE TABLE primer_acceso_codigos(usuario_id uuid PRIMARY KEY,codigo_hash text,expira_en timestamptz,enviado_en timestamptz,intentos int,solicitudes int,ventana_inicio timestamptz);`);
 await db.exec(await readFile('supabase/migrations/20261023190542_conversaciones_admin_pendiente.sql','utf8'));
 const pendiente='44444444-4444-4444-8444-444444444444';
 await db.query("INSERT INTO usuarios(id,email,nombre) VALUES($1,'pendiente@example.invalid','Pendiente')",[pendiente]);
 assert.equal((await cambiar(principal,pendiente,'ADMIN','USER')).rol,'ADMIN');
 assert.equal(await rol(pendiente),null);
 assert.equal((await db.query("SELECT primer_acceso_emitir('pendiente@example.invalid','12345678') r")).rows[0].r,true);
 assert.equal((await db.query("SELECT primer_acceso_verificar('pendiente@example.invalid','12345678') r")).rows[0].r,pendiente);
 assert.equal((await db.query("SELECT primer_acceso_cancelar('pendiente@example.invalid','00000000') r")).rows[0].r,false);
 assert.equal((await db.query("SELECT primer_acceso_cancelar('pendiente@example.invalid','12345678') r")).rows[0].r,true);
 assert.equal((await db.query("SELECT primer_acceso_verificar('pendiente@example.invalid','12345678') r")).rows[0].r,null);
 await db.query("INSERT INTO auth.users(id,email) VALUES($1,'pendiente@example.invalid')",[pendiente]);
 await db.query('UPDATE usuarios SET auth_user_id=$1 WHERE id=$1',[pendiente]);assert.equal(await rol(pendiente),'ADMIN');
 await assert.rejects(()=>cambiar(pendiente,otro,'ADMIN','USER'),/Superadmin requerido/);
 await db.query("INSERT INTO agente_casos(actor,huella,pregunta,respuesta,fuentes,conversacion) VALUES($1,$2,'Una pregunta','Una respuesta','[]',$3)",[principal,'b'.repeat(64),JSON.stringify([{role:'user',content:'Una pregunta'},{role:'assistant',content:'Una respuesta'}])]);
 assert.equal((await db.query('SELECT estado FROM agente_casos')).rows[0].estado,'candidato');
 console.log('Roles PostgreSQL OK: migración, delegación, revocación inmediata, RLS, auditoría y protección de Superadmin.');
}finally{await db.close();}
