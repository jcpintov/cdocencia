import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchGroqConLimite,esperaGroq,errorProveedorGroq} from '../lib/groq-proveedor.js';

test('un Retry-After de 30 segundos devuelve el control sin esperar ni reenviar',async()=>{
 let envios=0,esperas=0;
 const r=await fetchGroqConLimite('fixture',{}, {fetchImpl:async()=>{envios++;return {status:429,headers:{get:()=>'30'}};},esperar:async()=>{esperas++;}});
 assert.equal(envios,1);assert.equal(esperas,0);
 const e=errorProveedorGroq(r);assert.equal(e.status,429);assert.equal(e.reintentar_en,30);assert.match(e.message,/conserva/);
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
