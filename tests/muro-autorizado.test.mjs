import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=app.indexOf('async function cargarMuroReflexiones()');
const src=app.slice(start,app.indexOf('/* ==========================================================================',start+20));
const escapeStart=app.indexOf('function escaparTextoHTMLDocencia');
const escapeSource=app.slice(escapeStart,app.indexOf('\n}',escapeStart)+2);
const formatSource=app.slice(app.indexOf('function limpiarTratamientoHermano(nombre)'),app.indexOf('function validarSeguridadClave('));
test('muro muestra aportes ajenos por RPC sin consultar respuestas privadas',async()=>{
 const cont={innerHTML:''};const calls=[];
 const ctx={document:{getElementById:()=>cont},moduloActual:{id:'m'},usuarioActual:{id:'u',es_admin:false},
 sbApp:{rpc:async(name,args)=>{calls.push({name,args});return {data:{aportes:[{id:'p',modulo_id:'m',usuario_id:'otro',reflexion:'<img src=x onerror=alert(1)>',usuarios:{nombre:'<b>Otro</b>'}}],comentarios:[]},error:null};}}};
 runInNewContext(escapeSource+'\n'+formatSource+'\n'+src,ctx);await ctx.cargarMuroReflexiones();
 assert.equal(calls[0].name,'muro_docente_autorizado');assert.equal(calls[0].args.p_modulo,'m');
 assert.ok(cont.innerHTML.includes('&lt;img'));assert.ok(!cont.innerHTML.includes('<img'));
 assert.ok(cont.innerHTML.includes('&lt;b&gt;Otro'));
});
test('error de permisos o red se presenta como error y permite reintento',async()=>{
 const cont={innerHTML:''};const ctx={document:{getElementById:()=>cont},moduloActual:{id:'m'},
 sbApp:{rpc:async()=>({data:null,error:{code:'42501'}})}};
 runInNewContext(src,ctx);await ctx.cargarMuroReflexiones();assert.match(cont.innerHTML,/No se pudo cargar/);
});
test('consulta pública no incluye email ni respuestas de evaluación',()=>{
 const sql=readFileSync(new URL('../sql/20261020_muro_docente_autorizado.sql',import.meta.url),'utf8');
 assert.doesNotMatch(sql,/respuestas_evaluacion|u\.email/);
 assert.match(sql,/revoke all[\s\S]*from public,anon/);
});
