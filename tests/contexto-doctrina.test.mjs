import test from 'node:test';
import assert from 'node:assert/strict';
import {cargarContextoDoctrina} from '../lib/contexto-doctrina.js';
import {buscarBibliotecaConGroq} from '../lib/busqueda-groq.js';
const paginas=[{titulo:'PRINCIPIOS DE LA MASONERÍA',clase:'doctrina',version_id:'p',sha256:'h',pagina:1,fragmento:'Se deben ayuda y asistencia.'},...[84,85].map(pagina=>({titulo:'CONSTITUCIÓN Y REGLAMENTO GENERAL',clase:'normativa',version_id:'c',sha256:'h',pagina,fragmento:pagina===84?'Artículo 26.11.- Corresponde al Venerable Maestro:':'Designar cargos pro tempore y mantener el orden.'}))];
test('precarga principios y mapa antes de buscar y exige reserva documental',async()=>{
 const acciones=[];const c=await cargarContextoDoctrina({rpc:async(a,d)=>{acciones.push(a);if(a==='texto_contexto')return {paginas};assert.equal(d.fuentes.length,3);return {ok:true,id:'r'};}});
 assert.match(c.ambiente.principios,/ayuda/);assert.match(c.ambiente.mapa_normativo,/26.11/);assert.deepEqual(acciones,['texto_contexto','texto_llm_reservar']);
 await assert.rejects(cargarContextoDoctrina({rpc:async a=>a==='texto_contexto'?{paginas}:{ok:false,mensaje:'Sin permiso'}}),/Sin permiso/);
});
test('lee página y continuación elegidas por IA sin ejecutar búsqueda por palabras',async()=>{
 const contexto=await cargarContextoDoctrina({rpc:async a=>a==='texto_contexto'?{paginas}:{ok:true,id:'r'}});
 const d=contexto.documentos.find(d=>d.id==='c');const acciones=[];
 const r=await buscarBibliotecaConGroq({pregunta:'¿Qué debe hacer quien preside?',antecedentes:''},{contexto,env:{GROQ_API_KEY:'fixture'},modelo:'fixture',rpc:async a=>{acciones.push(a);if(a==='texto_pagina')return {};return {ok:true};},fetchImpl:async(_u,op)=>{
  assert.match(JSON.parse(op.body).messages[1].content,/Se deben ayuda/);
  return {ok:true,text:async()=>JSON.stringify({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{type:'function',function:{name:'buscar_biblioteca',arguments:JSON.stringify({consultas:['orden'],es_caso_conducta:true,paginas:[{documento:d.codigo,pagina:84}]})}}]}}]})};
 }});
 assert.ok(!acciones.includes('texto_buscar'));assert.ok(r.recuperadas[0].resultados.some(p=>p.pagina===85));
});

test('un mapa extenso se acota antes de llamar a Groq sin alterar la consulta ni el catálogo',async()=>{
 const pregunta='requisitos exaltacion';let enviado;
 const contexto={reserva:{id:'r'},ambiente:{principios:'Ayuda y asistencia.',catalogo:'D1 Constitución',mapa_normativo:'D1 p1: Artículo 1\n'.repeat(5000)},documentos:[],paginas:[]};
 await buscarBibliotecaConGroq({pregunta},{contexto,env:{GROQ_API_KEY:'fixture'},modelo:'fixture',rpc:async()=>({ok:true,resultados:[]}),fetchImpl:async(_u,o)=>{enviado=JSON.parse(o.body);return {ok:true,text:async()=>JSON.stringify({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{type:'function',function:{name:'buscar_biblioteca',arguments:'{"consultas":["exaltación"]}'}}]}}]})};}});
 assert.ok(Buffer.byteLength(JSON.stringify(enviado.messages))<=22000);
 assert.equal(JSON.parse(enviado.messages.at(-1).content).pregunta,pregunta);
 const a=JSON.parse(enviado.messages[1].content).ambiente_documental;assert.equal(a.catalogo,'D1 Constitución');assert.match(a.mapa_normativo,/Mapa parcial/);assert.equal(contexto.ambiente.mapa_normativo.length,90000);
});
