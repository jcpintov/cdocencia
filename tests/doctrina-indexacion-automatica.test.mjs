import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261021_doctrina_indexacion_sin_revision_obligatoria.sql',import.meta.url),'utf8');
const api=readFileSync(new URL('../api/admin-doctrina.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const ui=readFileSync(new URL('../doctrina-admin.js',import.meta.url),'utf8');
test('extracción automática recibe estado indexado distinto a aprobación humana',()=>{
 assert.match(sql,/ADD CONSTRAINT textos_extraidos_estado_check[\s\S]*'indexado'/);
 assert.match(sql,/''indexado'',p_actor/);
 assert.match(sql,/estado in \(''indexado'',''revision'',''aprobado''\)/);
 assert.match(sql,/texto_llm_autorizar_biblioteca/);
 assert.match(sql,/coalesce\(\(p->>''requiere_ocr''\)::boolean,false\)=false/);
});
test('el acceso documental permanece exclusivo de Superadmin y servicio Groq autorizado',()=>{
 assert.match(api,/admin\.from\('usuarios'\)/);
 assert.match(api,/superadmin_principal/);
 assert.match(api,/datos\.confirmacion!==true/);
 assert.match(api,/rpc\('texto_llm_autorizar_biblioteca',\{confirmacion:true\}\)/);
 assert.match(sql,/autorizacion_procesamiento_externo=true/);
});
test('el usuario no está obligado a revisar cada página para consultar Groq',()=>{
 assert.match(html,/id="doctrinaPrepararGroq"/);
 assert.doesNotMatch(html,/id="doctrinaAgenteTerminos"[^>]*required/);
 assert.match(ui,/async function prepararBibliotecaGroq\(/);
 assert.match(ui,/peticionDoctrina\('texto_extraer',\{id:item\.version_id\}\)/);
 assert.match(ui,/peticionDoctrina\('llm_autorizar_biblioteca',\{confirmacion:true\}\)/);
 const flujo=ui.slice(ui.indexOf('async function prepararBibliotecaGroq()'),ui.indexOf('async function cargarAutorizacionesGroq()'));
 assert.doesNotMatch(flujo,/texto_revisar_pagina|texto_aprobar/);
});
