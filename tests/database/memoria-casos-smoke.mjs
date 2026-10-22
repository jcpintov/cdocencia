// Base PostgreSQL local y efímera; no accede a Supabase.
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {PGlite}=createRequire(process.env.QA_SQL_ROOT+'/package.json')('@electric-sql/pglite');
const db=new PGlite();
try{
 await db.exec('CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
 await db.exec(await readFile('sql/agente_casos_revisados.sql','utf8'));
 const actor='11111111-1111-4111-8111-111111111111';
 await db.query('INSERT INTO auth.users VALUES ($1)',[actor]);
 const r=await db.query("INSERT INTO public.agente_casos(actor,huella,pregunta,respuesta,fuentes) VALUES ($1,$2,'Estudio de tolerancia','Interpretación de prueba',$3) RETURNING id,estado",[actor,'a'.repeat(64),JSON.stringify([{version_id:'v',sha256:'h',pagina:1}])]);
 assert.equal(r.rows[0].estado,'candidato');
 const acl=await db.query("SELECT relrowsecurity AS rls, has_table_privilege('anon','public.agente_casos','SELECT') AS anon, has_table_privilege('authenticated','public.agente_casos','SELECT') AS auth FROM pg_class WHERE oid='public.agente_casos'::regclass");
 assert.equal(acl.rows[0].rls,true);assert.equal(acl.rows[0].anon,false);assert.equal(acl.rows[0].auth,false);
 let encontrados=await db.query("SELECT id FROM public.agente_casos WHERE estado='revisado' AND indice @@ to_tsquery('spanish','tolerancia | estudio')");assert.equal(encontrados.rows.length,0);
 await db.query("UPDATE public.agente_casos SET estado='revisado',revisado_en=now() WHERE id=$1",[r.rows[0].id]);
 encontrados=await db.query("SELECT id FROM public.agente_casos WHERE estado='revisado' AND indice @@ to_tsquery('spanish','tolerancia | estudio')");assert.equal(encontrados.rows.length,1);
 await db.query("UPDATE public.agente_casos SET estado='retirado' WHERE id=$1",[r.rows[0].id]);
 encontrados=await db.query("SELECT id FROM public.agente_casos WHERE estado='revisado'");assert.equal(encontrados.rows.length,0);
 console.log('PASS memoria PostgreSQL aislada: candidata, revisión, recuperación, retiro y ACL sin acceso cliente.');
}finally{await db.close();}
