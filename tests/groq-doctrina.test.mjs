import test from 'node:test';
import assert from 'node:assert/strict';
import {consultarGroqDoctrina,validarRespuestaGroq,seleccionarFuentes,MODELO_GROQ} from '../lib/groq-doctrina.js';
const entrada={pregunta:'¿Qué simboliza la acacia?',consulta:'acacia',consultaAmpliada:'acacia OR inmortalidad',antecedentes:'Alegación del consultante'};
const fuente={titulo:'Fuente sintética',clase:'doctrina',version_id:'v',version:1,pagina:3,sha256:'abc',estado_texto:'indexado',fragmento:'La acacia representa un símbolo de inmortalidad.'};
const resultado=()=>({respuesta:'La acacia representa un símbolo de continuidad [F1].',referencias:['F1'],base_suficiente:true});

test('repregunta lee páginas en paralelo, una vez por turno, y vuelve a leer en el turno siguiente',async()=>{
 const fuentes=[{...fuente,pagina:1},{...fuente,pagina:2}];
 let activas=0,maximas=0,lecturas=0;
 const rpc=async(a,d)=>{
  if(a==='texto_contexto')return {paginas:fuentes};
  if(a==='texto_llm_listar')return {autorizaciones:[{...fuente,autorizado:true,modelo:MODELO_GROQ}]};
  if(a==='texto_pagina'){
   lecturas++;maximas=Math.max(maximas,++activas);
   await new Promise(resolve=>setImmediate(resolve));activas--;
   return {sha256:fuente.sha256,pagina:{numero:d.pagina,texto:fuente.fragmento}};
  }
  return {ok:true,id:'reserva'};
 };
 const pregunta={...entrada,pregunta:'Amplía ese símbolo',historial:[{role:'user',content:'Consulta anterior'}],fuentesPrevias:fuentes};
 const fetchImpl=async(_u,o)=>{
  assert.equal(JSON.parse(o.body).tools,undefined);
  return {ok:true,text:async()=>JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(resultado())}}]})};
 };
 const opciones={rpc,fetchImpl,env:{GROQ_API_KEY:'fixture',GROQ_ZDR_CONFIRMADO:'true'}};
 assert.equal((await consultarGroqDoctrina(pregunta,opciones)).generativo,true);
 assert.equal(lecturas,2);assert.equal(maximas,2);
 assert.equal((await consultarGroqDoctrina(pregunta,opciones)).generativo,true);
 assert.equal(lecturas,4);
});
function entorno(op={}){
 const llamadas=[],env={GROQ_API_KEY:'clave-sintetica',GROQ_ZDR_CONFIRMADO:'true',...op.env};
 let envios=0,validaciones=0,body;
 const rpc=async(accion,datos)=>{llamadas.push([accion,datos]);
  if(accion==='texto_buscar')return {resultados:op.sinFuentes?[]:[fuente],cobertura:{vigentes:36,consultables:1,pendientes:35}};
  if(accion==='texto_llm_listar')return {autorizaciones:op.sinPermiso?[]:[{version_id:'v',sha256:op.huellaDistinta?'otra':'abc',autorizado:true,modelo:MODELO_GROQ},...(op.autorizadas||[])]};
  if(accion==='texto_llm_reservar')return {ok:!op.limite,id:'reserva'};
  if(accion==='texto_llm_validar')return {ok:++validaciones!==(op.revocarEn||0)};
  return {ok:true};
 };
 const fetchImpl=async(url,options)=>{assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');const solicitud=JSON.parse(options.body);
  if(solicitud.tools)return {ok:true,text:async()=>JSON.stringify({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{id:'busqueda',type:'function',function:{name:'buscar_biblioteca',arguments:JSON.stringify({consultas:['acacia','acacia OR inmortalidad']})}}]}}]})};
  envios++;body=solicitud;if(op.error)throw new Error('Error privado: clave-sintetica');
  return {ok:!op.status,status:op.status||200,text:async()=>op.raw||JSON.stringify({choices:[{finish_reason:op.truncada?'length':'stop',message:{content:JSON.stringify(op.respuesta||resultado())}}]})};
 };
 return {run:()=>consultarGroqDoctrina({...entrada,...op.entrada},{rpc,env,fetchImpl}),llamadas,get envios(){return envios},get body(){return body}};
}

test('las fuentes de una memoria revisada se reservan y una memoria revocada no se envía',async()=>{
 const memoria={pregunta:'Caso previo',respuesta:'RECUERDO_REVISADO',fuentes:[{version_id:'m',sha256:'memoria',pagina:2}]};
 const s=entorno({entrada:{casosRevisados:[memoria]},autorizadas:[{version_id:'m',sha256:'memoria',autorizado:true,modelo:MODELO_GROQ}]});
 assert.equal((await s.run()).generativo,true);
 assert.ok(s.body.messages[1].content.includes('RECUERDO_REVISADO'));
 assert.ok(s.llamadas.find(([a])=>a==='texto_llm_reservar')[1].fuentes.some(f=>f.version_id==='m'));
 const revocada=entorno({entrada:{casosRevisados:[memoria]}});await revocada.run();
 assert.ok(!revocada.body.messages[1].content.includes('RECUERDO_REVISADO'));
});
for(const op of [{env:{GROQ_API_KEY:''}},{env:{GROQ_ZDR_CONFIRMADO:'false'}},{sinPermiso:true},{sinFuentes:true},{huellaDistinta:true},{limite:true},{revocarEn:1}])
 test('bloquea salida externa sin configuración, evidencia, permiso o reserva: '+JSON.stringify(op),async()=>{const s=entorno(op),r=await s.run();assert.equal(r.generativo,false);assert.equal(s.envios,0)});
test('consulta biblioteca ampliada y genera una respuesta fluida con citas verificadas',async()=>{
 const s=entorno(),r=await s.run();
 assert.equal(r.generativo,true);
 assert.equal(r.base_suficiente,true);
 assert.equal(r.modelo,MODELO_GROQ);
 assert.equal(s.envios,1);
 assert.equal(s.body.tools,undefined);
 assert.equal(s.body.response_format.json_schema.strict,true);
 assert.equal(s.body.messages[1].content.includes('clave-sintetica'),false);
 assert.equal(s.llamadas.filter(x=>x[0]==='texto_buscar').length,2);
 assert.equal(s.llamadas.at(-1)[1].estado,'completado');
 assert.equal(r.secciones.length,1);
 assert.equal(r.secciones[0].titulo,'Respuesta');
 assert.match(r.secciones[0].texto,/\[F1\]/);
});

test('una respuesta de fundamento parcial conserva explícitamente ese alcance',async()=>{
 const r=await entorno({respuesta:{...resultado(),base_suficiente:false}}).run();
 assert.equal(r.generativo,true);assert.equal(r.base_suficiente,false);
});
for(const op of [{status:429},{status:500},{error:true},{raw:'no json'},{truncada:true},{revocarEn:2}])
 test('no publica resultados fallidos ni reintenta a espaldas del Superadmin: '+JSON.stringify(op),async()=>{const s=entorno(op),r=await s.run();assert.equal(r.generativo,false);assert.equal(s.envios,1);assert.ok(r.fuentes.length);assert.equal(JSON.stringify(r).includes('clave-sintetica'),false)});
test('rechaza referencias inventadas, campos ausentes o sin citas en el análisis',()=>{
 assert.throws(()=>validarRespuestaGroq({},[{referencia:'F1'}]));
 for(const cambia of [{referencias:['F99']},{referencias:[]},{respuesta:'La fuente F99 exige algo.'},{respuesta:'No consta ningún deber',referencias:[]},{base_suficiente:undefined},{respuesta:'x'.repeat(5001)}]){
  const x={...resultado(),...cambia};
  if(cambia.fundamentos){x.referencias=['F1']}
  assert.throws(()=>validarRespuestaGroq(x,[{referencia:'F1'}]));
 }
});
test('no envía expediente superior al límite',async()=>{
 const larga={...entrada,pregunta:'漢'.repeat(2000),antecedentes:'漢'.repeat(3000)};
 const fuentes=Array.from({length:6},(_,i)=>({...fuente,version_id:'v'+i}));
 const rpc=async(action,datos)=>action==='texto_buscar'?{resultados:fuentes}:action==='texto_pagina'?{sha256:'abc',pagina:{numero:datos.pagina,texto:'漢'.repeat(6500)}}:action==='texto_llm_listar'?{autorizaciones:fuentes.map(f=>({...f,modelo:MODELO_GROQ,autorizado:true}))}:{ok:true,id:'reserva'};
 let enviado=false;
 const r=await consultarGroqDoctrina(larga,{rpc,env:{GROQ_API_KEY:'x',GROQ_ZDR_CONFIRMADO:'true'},fetchImpl:async(_url,op)=>{if(JSON.parse(op.body).tools)return {ok:true,text:async()=>JSON.stringify({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{id:'busqueda',type:'function',function:{name:'buscar_biblioteca',arguments:'{"consultas":["acacia"]}'}}]}}]})};enviado=true}});
 assert.equal(enviado,false);assert.equal(r.generativo,false);
});

test('respeta jerarquía aunque una fuente inferior tenga más coincidencias',()=>{
 const documentos=[{...fuente,version_id:'reg',clase:'normativa',relevancia:0.1},{...fuente,version_id:'caso',clase:'docencia',relevancia:1}];
 const permisos=new Map(documentos.map(f=>[f.version_id,f.sha256]));
 assert.equal(seleccionarFuentes(documentos,permisos)[0].version_id,'reg');
});

test('presenta la referencia explícita del modelo aunque no la repita en la prosa',()=>{const secciones=validarRespuestaGroq({respuesta:'La actividad comienza a las 20:00.',referencias:['F1'],base_suficiente:true},[{referencia:'F1'}]);assert.match(secciones[0].texto,/20:00/);assert.match(secciones[0].texto,/\[F1\]/);});

test('presenta las referencias estructuradas que faltan sin eliminar citas existentes',()=>{
 const s=validarRespuestaGroq({respuesta:'Corresponde examinar el deber [F3].',referencias:['F2','F3'],base_suficiente:true},[{referencia:'F2'},{referencia:'F3'}]);
 assert.match(s[0].texto,/\[F3\]/);assert.match(s[0].texto,/Fuentes: \[F2\]/);
});

test('una corrección con fuentes previas vuelve al planificador antes de responder',async()=>{
 let planificaciones=0;const consultas=[];
 const rpc=async(a,d)=>{
  if(a==='texto_contexto')return {paginas:[fuente]};
  if(a==='texto_llm_listar')return {autorizaciones:[{...fuente,autorizado:true,modelo:MODELO_GROQ}]};
  if(a==='texto_buscar'){consultas.push(d.consulta);return {resultados:[fuente]};}
  if(a==='texto_pagina')return {sha256:fuente.sha256,pagina:{numero:d.pagina,texto:fuente.fragmento}};
  return {ok:true,id:'reserva'};
 };
 const fetchImpl=async(_u,o)=>{
  const b=JSON.parse(o.body);
  if(b.tools){planificaciones++;return {ok:true,text:async()=>JSON.stringify({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{type:'function',function:{name:'buscar_biblioteca',arguments:JSON.stringify({consultas:['capacidad OR impedimento']})}}]}}]})};}
  return {ok:true,text:async()=>JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(resultado())}}]})};
 };
 const r=await consultarGroqDoctrina({...entrada,pregunta:'Corrijo: no se negó, no pudo asistir.',historial:[{role:'user',content:'El hermano se negó.'}],fuentesPrevias:[fuente]},{rpc,fetchImpl,env:{GROQ_API_KEY:'fixture',GROQ_ZDR_CONFIRMADO:'true'}});
 assert.equal(r.generativo,true);assert.equal(planificaciones,1);assert.ok(consultas.includes('capacidad OR impedimento'));
});

test('seis páginas extensas caben en el presupuesto sin perder referencias y marcan sus recortes',async()=>{
 let cuerpo;
 const paginas=Array.from({length:6},(_,i)=>({...fuente,pagina:i+1}));
 const rpc=async(a,d)=>{
  if(a==='texto_buscar')return {resultados:paginas};
  if(a==='texto_llm_listar')return {autorizaciones:[{...fuente,autorizado:true,modelo:MODELO_GROQ}]};
  if(a==='texto_pagina')return {sha256:'abc',pagina:{numero:d.pagina,texto:'Contenido documental extenso. '.repeat(250)}};
  return {ok:true,id:'reserva'};
 };
 const fetchImpl=async(_u,o)=>{const b=JSON.parse(o.body);if(b.tools)return {ok:true,text:async()=>JSON.stringify({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{type:'function',function:{name:'buscar_biblioteca',arguments:'{"consultas":["acacia"]}'}}]}}]})};cuerpo=b;return {ok:true,text:async()=>JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(resultado())}}]})};};
 const r=await consultarGroqDoctrina(entrada,{rpc,fetchImpl,env:{GROQ_API_KEY:'fixture',GROQ_ZDR_CONFIRMADO:'true'}});
 assert.equal(r.generativo,true);assert.ok(Buffer.byteLength(cuerpo.messages.map(m=>m.content).join(''))<=22000);
 const e=JSON.parse(cuerpo.messages[1].content);assert.equal(e.fuentes.length,6);assert.ok(e.fuentes.every(f=>f.fragmento.endsWith(' […]')));assert.equal(e.pregunta,entrada.pregunta);
});
