import test from 'node:test';
import assert from 'node:assert/strict';
import {guardarCasoCandidato,recuperarCasosRevisados,filtrarCasosVigentes,cargarMemoriaSesion,listarConversaciones,exportarMemoriaAprobada} from '../lib/memoria-casos.js';

test('archivo conserva el diálogo, queda pendiente y acepta respuestas sin fuentes sin usarlas como norma',async()=>{
 let fila;const admin={from:()=>({upsert:v=>{fila=v;return {select:()=>({maybeSingle:async()=>({data:{id:'caso'}})})};}})};
 const historial=[{role:'user',content:'Planteamiento inicial'},{role:'assistant',content:'Respuesta inicial'}];
 await guardarCasoCandidato(admin,'actor',{pregunta:'Mi precisión',conversacion:historial},{generativo:true,secciones:[{texto:'Respuesta final'}],fuentes:[]});
 assert.equal(fila.conversacion.length,4);assert.equal(fila.conversacion[0].content,'Planteamiento inicial');assert.equal(fila.estado,undefined);assert.equal(filtrarCasosVigentes([fila],new Map()).length,0);
});
test('listado y JSON aprobado mantienen el actor y rechazan páginas fallidas',async()=>{
 const filtros=[],filas=Array.from({length:501},(_,id)=>({id,pregunta:'Pregunta',conversacion:[]}));let a=0,b=49;
 const q={select:()=>q,eq:(...x)=>{filtros.push(x);return q;},order:()=>q,range:async(x,y)=>{a=x;b=y;return {data:filas.slice(a,b+1),count:filas.length};}};
 const admin={from:()=>q};const lista=await listarConversaciones(admin,'actor',{estado:'candidato',desde:50});assert.equal(lista.conversaciones.length,50);assert.equal(lista.hay_mas,true);
 const memoria=await exportarMemoriaAprobada(admin,'actor');assert.equal(memoria.casos.length,501);assert.ok(filtros.some(x=>x[0]==='estado'&&x[1]==='revisado'));assert.ok(filtros.every(x=>x[0]!=='actor'||x[1]==='actor'));
 q.range=async()=>({error:{message:'PRIVATE'}});await assert.rejects(()=>exportarMemoriaAprobada(admin,'actor'),/memoria_no_disponible/);
});

test('el JSON de sesión se reconstruye sin escribir ni vaciar los recuerdos persistidos',async()=>{
 let lecturas=0;
 const casos=[{id:'caso',pregunta:'Caso revisado',respuesta:'Conclusión',fuentes:[]}];
 const q={select:()=>q,eq:()=>q,order:()=>q,limit:async()=>{lecturas++;return {data:casos,count:1};}};
 const admin={from:()=>q};
 const primera=await cargarMemoriaSesion(admin,'actor',true);
 const segunda=await cargarMemoriaSesion(admin,'actor',true);
 assert.equal(primera.schema_version,1);assert.equal(primera.casos[0].id,'caso');
 assert.equal(segunda.revision,primera.revision);assert.equal(lecturas,2);
 assert.ok(primera.criterios.some(c=>c.id==='fidelidad-conceptual'));
 const desactivada=await cargarMemoriaSesion(admin,'actor',false);
 assert.equal(desactivada.persistencia_casos,false);assert.equal(lecturas,2);
});

test('guardar una respuesta no la aprueba ni permite copiar el estado desde el cliente',async()=>{
 let fila,op;
 const admin={from:()=>({upsert:(v,o)=>{fila=v;op=o;return {select:()=>({maybeSingle:async()=>({data:{id:'caso'}})})};}})};
 const id=await guardarCasoCandidato(admin,'actor',{pregunta:'Consulta sintética',estado:'revisado'},{generativo:true,secciones:[{texto:'Interpretación sintética'}],fuentes:[{version_id:'v',sha256:'hash',pagina:1}]});
 assert.equal(id,'caso');assert.equal(fila.actor,'actor');assert.equal(fila.estado,undefined);
 assert.equal(fila.huella.length,64);assert.equal(op.ignoreDuplicates,true);
 assert.equal(await guardarCasoCandidato(admin,'actor',{}, {generativo:false}),null);
});

test('la búsqueda persistente está limitada al actor y a casos revisados',async()=>{
 const filtros=[];
 const q={select:()=>q,eq:(...a)=>{filtros.push(a);return q;},textSearch:()=>q,order:()=>q,limit:async n=>{assert.equal(n,3);return {data:[]};}};
 await recuperarCasosRevisados({from:()=>q},'actor','Pregunta del caso sintético');
 assert.deepEqual(filtros,[['actor','actor'],['estado','revisado']]);
});

test('no reutiliza casos con documentos revocados o versiones distintas y marca su alcance',()=>{
 const caso={pregunta:'Caso',respuesta:'Interpretación previa',fuentes:[{version_id:'v',sha256:'h',pagina:1}]};
 assert.equal(filtrarCasosVigentes([caso],new Map()).length,0);
 assert.equal(filtrarCasosVigentes([caso],new Map([['v','otra']])).length,0);
 const [r]=filtrarCasosVigentes([caso],new Map([['v','h']]));
 assert.match(r.alcance,/No constituye norma/);assert.equal(r.interpretacion_revisada,caso.respuesta);
});
