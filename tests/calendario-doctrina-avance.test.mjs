import test from 'node:test';
import assert from 'node:assert/strict';
import {generarCorreoCalendario} from '../lib/correo-calendario.js';
import {procesarCalendario} from '../lib/procesar-recordatorios.js';
import {extraerDoctrina} from '../lib/extraer-doctrina.js';
test('correo de calendario usa destinatario fijo, horario y contenido escapado',()=>{
 const r=generarCorreoCalendario({fecha:'2026-11-10',grado:3,tema:'<script>alert(1)</script>',autor:'Autor',hora:'20:30:00'});
 assert.equal(r.to,'jpintov@gmail.com');assert.match(r.text,/Horario: 20:30 horas/);assert.match(r.text,/en cinco días/);assert.match(r.subject,/Maestro/);assert.ok(!r.html.includes('<script>'));
});
test('calendario no repite SMTP cuando la reserva durable ya existe',async()=>{
 let envios=0;const admin={rpc:async(_n,{p_accion})=>({data:p_accion==='candidatos'?[{id:'e',version:1,fecha:'2026-11-10',grado:3,tema:'Tema',autor:'Autor'}]:{enviar:false}})};
 const r=await procesarCalendario({admin,transport:{sendMail:async()=>{envios++;}},from:'fixture@example.invalid',randomUUID:()=> 'fixture'});assert.equal(envios,0);assert.equal(r.omitidos,1);
});
function parser(paginas){let destruido=false;return {cargar:async()=>({getDocumentProxy:async(_b,opciones)=>{assert.equal(opciones.isEvalSupported,false);return {numPages:paginas.length,loadingTask:{destroy:async()=>{destruido=true;}},getPage:async n=>({getTextContent:async()=>({items:paginas[n-1]}),cleanup(){}})}}}),destruido:()=>destruido};}
test('extracción conserva números y saltos por página sin aprobarlas',async()=>{
 const p=parser([[{str:'Texto suficiente para una página',hasEOL:true},{str:'Segunda línea'}],[]]);const r=await extraerDoctrina(new Uint8Array([1]),p);
 assert.equal(r.total_paginas,2);assert.match(r.paginas[0].texto,/página\nSegunda línea/);assert.equal(r.paginas[1].numero,2);assert.equal(r.paginas[1].requiere_ocr,true);assert.equal(r.paginas[0].revisada,false);assert.equal(p.destruido(),true);
});
test('extracción rechaza documentos excesivos y libera el documento',async()=>{
 const p=parser(Array.from({length:601},()=>[]));await assert.rejects(()=>extraerDoctrina(new Uint8Array([1]),p),/600 páginas/);assert.equal(p.destruido(),true);
 const grande=parser([[{str:'a'.repeat(40001)}]]);await assert.rejects(()=>extraerDoctrina(new Uint8Array([1]),grande),/límite/);assert.equal(grande.destruido(),true);
});
import {esHoraAvisoCalendario} from '../lib/hora-calendario.js';
test('avisos a las 08:00 de Santiago en horario de verano e invierno, sin segunda ejecución',()=>{
 assert.equal(esHoraAvisoCalendario(new Date('2026-11-10T11:00:00Z')),true);
 assert.equal(esHoraAvisoCalendario(new Date('2026-11-10T12:00:00Z')),false);
 assert.equal(esHoraAvisoCalendario(new Date('2026-07-10T12:00:00Z')),true);
 assert.equal(esHoraAvisoCalendario(new Date('2026-07-10T11:00:00Z')),false);
});
