import test from 'node:test';
import assert from 'node:assert/strict';
import {seleccionarFuentes} from '../lib/fuentes-doctrina.js';
import {consultarGroqDoctrina,MODELO_GROQ} from '../lib/groq-doctrina.js';
const clases=['bibliografia','tradicion','docencia','doctrina','normativa','ritual'];
const fuentes=clases.map((clase,i)=>({version_id:String(i),sha256:'hash',clase,pagina:1,titulo:clase,fragmento:'Deber de cubrir un cargo.',relevancia:1}));
const permisos=new Map(fuentes.map(f=>[f.version_id,f.sha256]));
test('selección respeta Reglamento, Doctrina, Docencia, Tradición y reserva Bibliografía',()=>{
 assert.deepEqual(seleccionarFuentes(fuentes,permisos).map(f=>f.clase),['normativa','doctrina','docencia','tradicion']);
 assert.deepEqual(seleccionarFuentes(fuentes,permisos,{bibliografia:true}).map(f=>f.clase),['bibliografia']);
});
test('no confunde categoría ritual con Reglamento ni usa fuentes sin coincidencias o permiso',()=>{
 assert.equal(seleccionarFuentes(fuentes.map(f=>({...f,relevancia:0})),permisos).length,0);
 assert.equal(seleccionarFuentes(fuentes,new Map()).length,0);
 assert.equal(seleccionarFuentes(fuentes.filter(f=>f.clase==='ritual'),permisos).length,0);
});
for(const escenario of ['suficiente','insuficiente','sin_principales','error']){
 test('bibliografía como respaldo: '+escenario,async()=>{
  const envios=[],finalizadas=[];
  const rpc=async(accion,datos)=>{
   if(accion==='texto_buscar')return {resultados:escenario==='sin_principales'?fuentes.filter(f=>f.clase==='bibliografia'):fuentes};
   if(accion==='texto_llm_listar')return {autorizaciones:fuentes.map(f=>({...f,autorizado:true,modelo:MODELO_GROQ}))};
   if(accion==='texto_llm_finalizar')finalizadas.push(datos);
   return {ok:true,id:'reserva'};
  };
  const fetchImpl=async(_url,op)=>{
   const solicitud=JSON.parse(op.body);
   if(solicitud.tools)return {ok:true,text:async()=>JSON.stringify({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{type:'function',function:{name:'buscar_biblioteca',arguments:JSON.stringify({consultas:['cargo']})}}]}}]})};
   const expediente=JSON.parse(solicitud.messages[1].content);
   envios.push(expediente.fuentes.map(f=>f.clase));
   const suficiente=escenario!=='insuficiente'||envios.length===2;
   return {ok:escenario!=='error',status:500,text:async()=>JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({respuesta:'Fundamento del caso ['+expediente.fuentes[0].referencia+'].',referencias:[expediente.fuentes[0].referencia],base_suficiente:suficiente})}}]})};
  };
  const resultado=await consultarGroqDoctrina({pregunta:'¿Qué deber existe al cubrir un cargo?',consulta:'cargo'},{rpc,fetchImpl,env:{GROQ_API_KEY:'fixture',GROQ_ZDR_CONFIRMADO:'true'}});
  assert.equal(envios.length,escenario==='insuficiente'?2:1);
  if(escenario==='insuficiente')assert.deepEqual(envios[1],['bibliografia']);
  if(escenario==='sin_principales')assert.deepEqual(envios[0],['bibliografia']);
  if(escenario==='suficiente')assert.ok(!envios[0].includes('bibliografia'));
  assert.equal(resultado.generativo,escenario!=='error');
  assert.equal(finalizadas.length,1);
 });
}

test('un pasaje sin identificador o huella nunca queda autorizado por coincidencia de undefined',()=>{assert.equal(seleccionarFuentes([{fragmento:'Texto',clase:'normativa'}],new Map()).length,0);});

test('selecciona fundamentos de deber, calificación y competencia aunque procedan del mismo libro',()=>{const candidatas=Array.from({length:6},(_,i)=>({...fuentes[4],pagina:i+1,relevancia:6-i,busquedas:[i<4?0:i-3]}));const elegidas=seleccionarFuentes(candidatas,permisos);assert.deepEqual(elegidas.slice(0,3).map(f=>f.busquedas[0]),[0,1,2]);});
