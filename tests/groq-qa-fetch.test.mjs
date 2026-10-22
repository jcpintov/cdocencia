import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchGroqQA} from '../scripts/groq-qa-fetch.mjs';
test('QA espera cuota indicada y renueva solo el plazo de la petición sintética',async()=>{
 const esperas=[];let n=0;const signal=AbortSignal.abort();
 const r=await fetchGroqQA('https://fixture.invalid',{signal},{log:()=>{},esperar:async ms=>esperas.push(ms),fetchImpl:async(_u,o)=>{assert.equal(o.signal.aborted,false);return ++n===1?new Response('',{status:429,headers:{'retry-after':'83'}}):new Response('ok');}});
 assert.equal(await r.text(),'ok');assert.deepEqual(esperas,[84000]);assert.equal(n,2);
});
test('QA no reintenta rechazos de herramientas ni cuotas largas o sin plazo',async()=>{
 for(const [status,headers] of [[400,{}],[429,{}],[429,{'retry-after':'301'}]]){
  let n=0;const r=await fetchGroqQA('https://fixture.invalid',{}, {log:()=>{},esperar:async()=>assert.fail('no esperar'),fetchImpl:async()=>{n++;return new Response('',{status,headers});}});assert.equal(r.status,status);assert.equal(n,1);
 }
});
test('QA limita a tres solicitudes incluso si el proveedor mantiene 429',async()=>{
 let n=0;await fetchGroqQA('https://fixture.invalid',{}, {log:()=>{},esperar:async()=>{},fetchImpl:async()=>{n++;return new Response('',{status:429,headers:{'retry-after':'1'}});}});assert.equal(n,3);
});
