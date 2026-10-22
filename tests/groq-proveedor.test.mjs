import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchGroqConLimite} from '../lib/groq-proveedor.js';
test('una revocación durante la espera impide reenviar documentos',async()=>{
 let envios=0;
 await assert.rejects(fetchGroqConLimite('fixture',{}, {fetchImpl:async()=>{envios++;return {status:429,headers:{get:()=>'.001'}};},validar:async()=>false}),/autorización/);
 assert.equal(envios,1);
});
test('un límite prolongado no bloquea la consulta ni inicia reintentos ilimitados',async()=>{
 let envios=0;const r=await fetchGroqConLimite('fixture',{}, {fetchImpl:async()=>{envios++;return {status:429,headers:{get:()=>'120'}};}});
 assert.equal(r.status,429);assert.equal(envios,1);
});
