import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchGroqConLimite,esperaGroq,errorProveedorGroq} from '../lib/groq-proveedor.js';

test('un Retry-After de 90 segundos devuelve el control sin esperar ni reenviar',async()=>{
 let envios=0,esperas=0;
 const r=await fetchGroqConLimite('fixture',{}, {fetchImpl:async()=>{envios++;return {status:429,headers:{get:()=>'90'}};},esperar:async()=>{esperas++;}});
 assert.equal(envios,1);assert.equal(esperas,0);
 const e=errorProveedorGroq(r);assert.equal(e.status,429);assert.equal(e.reintentar_en,90);assert.match(e.message,/conserva/);
});

test('interpreta Retry-After como fecha y no reenvía una solicitud cancelada',async()=>{
 assert.equal(esperaGroq({headers:{get:()=>new Date(30000).toUTCString()}},0),30);
 const controller=new AbortController();let envios=0;
 await assert.rejects(fetchGroqConLimite('fixture',{signal:controller.signal},{fetchImpl:async()=>{envios++;return {status:429,headers:{get:()=>'.1'}};},esperar:async()=>controller.abort()}));
 assert.equal(envios,1);
});
test('una revocación durante la espera impide reenviar documentos',async()=>{
 let envios=0;
 await assert.rejects(fetchGroqConLimite('fixture',{}, {fetchImpl:async()=>{envios++;return {status:429,headers:{get:()=>'.001'}};},validar:async()=>false}),/autorización/);
 assert.equal(envios,1);
});
test('un límite prolongado no bloquea la consulta ni inicia reintentos ilimitados',async()=>{
 let envios=0;const r=await fetchGroqConLimite('fixture',{}, {fetchImpl:async()=>{envios++;return {status:429,headers:{get:()=>'120'}};}});
 assert.equal(r.status,429);assert.equal(envios,1);
});

 test('espera una vez el límite de una consulta real y revalida permisos',async()=>{let n=0,validaciones=0;const esperas=[];const r=await fetchGroqConLimite('fixture',{}, {fetchImpl:async()=>++n===1?new Response('',{status:429,headers:{'retry-after':'39'}}):new Response('ok'),esperar:async ms=>esperas.push(ms),validar:async()=>{validaciones++;return true;}});assert.equal(r.status,200);assert.equal(n,2);assert.equal(validaciones,1);assert.deepEqual(esperas,[43000]);});
 test('un contexto demasiado grande tiene un error propio y no se presenta como espera temporal',()=>{const e=errorProveedorGroq(new Response('',{status:413}));assert.equal(e.codigo,'GROQ_CONTEXTO_EXCEDIDO');assert.equal(e.status,413);assert.equal(e.reintentar_en,undefined);});
