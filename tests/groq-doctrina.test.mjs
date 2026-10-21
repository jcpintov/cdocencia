import test from 'node:test';
import assert from 'node:assert/strict';
import {consultarGroqDoctrina,validarRespuestaGroq,MODELO_GROQ,TITULOS} from '../lib/groq-doctrina.js';
const entrada={pregunta:'¿Qué simboliza la acacia?',consulta:'acacia',antecedentes:'Alegación del consultante'};
const fuente={titulo:'Fuente sintética',clase:'doctrina',version_id:'v',version:1,pagina:3,sha256:'abc',fragmento:'La acacia simboliza la inmortalidad.'};
const resultado=()=>({secciones:TITULOS.map(titulo=>({titulo,texto:'Análisis condicionado a los antecedentes documentales.',referencias:['F1']}))});
function entorno(op={}){
 const llamadas=[],env={GROQ_API_KEY:'clave-sintetica',GROQ_ZDR_CONFIRMADO:'true',...op.env};let envios=0,validaciones=0,body;
 const rpc=async(accion,datos)=>{llamadas.push([accion,datos]);
  if(accion==='texto_buscar')return {resultados:op.sinFuentes?[]:[fuente],cobertura:{vigentes:2,consultables:1,pendientes:1}};
  if(accion==='texto_llm_listar')return {autorizaciones:op.sinPermiso?[]:[{version_id:'v',sha256:op.huellaDistinta?'otra':'abc',autorizado:true,modelo:MODELO_GROQ}]};
  if(accion==='texto_llm_reservar')return {ok:!op.limite,id:'id-reserva'};
  if(accion==='texto_llm_validar')return {ok:++validaciones!==(op.revocarEn||0)};
  return {ok:true};
 };
 const fetchImpl=async(url,options)=>{envios++;assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');body=JSON.parse(options.body);if(op.error)throw new Error('Error privado: clave-sintetica');return {ok:!op.status,status:op.status||200,text:async()=>op.raw||JSON.stringify({choices:[{finish_reason:op.truncada?'length':'stop',message:{content:JSON.stringify(op.respuesta||resultado())}}]})};};
 return {run:()=>consultarGroqDoctrina(entrada,{rpc,env,fetchImpl}),llamadas,get envios(){return envios;},get body(){return body;}};
}
for(const op of [{env:{GROQ_API_KEY:''}},{env:{GROQ_ZDR_CONFIRMADO:'false'}},{sinPermiso:true},{sinFuentes:true},{huellaDistinta:true},{limite:true},{revocarEn:1}])test('no envía si falta configuración, permiso, evidencia o reserva: '+JSON.stringify(op),async()=>{const s=entorno(op),r=await s.run();assert.equal(r.generativo,false);assert.equal(s.envios,0);});
test('envía solo pasajes autorizados y publica informe con referencias verificadas',async()=>{
 const s=entorno(),r=await s.run();assert.equal(r.generativo,true);assert.equal(r.modelo,MODELO_GROQ);assert.equal(s.envios,1);assert.equal(s.body.tools,undefined);assert.equal(s.body.model,MODELO_GROQ);assert.equal(s.body.response_format.json_schema.strict,true);assert.equal(JSON.stringify(s.body).includes('clave-sintetica'),false);assert.equal(s.llamadas.at(-1)[1].estado,'completado');assert.match(r.secciones[7].texto,/\[F1\]/);
});
for(const op of [{status:429},{status:500},{error:true},{raw:'no json'},{truncada:true},{revocarEn:2}])test('fallo, cuota o revocación no publica análisis ni reintenta: '+JSON.stringify(op),async()=>{const s=entorno(op),r=await s.run();assert.equal(r.generativo,false);assert.equal(s.envios,1);assert.ok(r.fuentes.length);assert.equal(JSON.stringify(r).includes('clave-sintetica'),false);});
test('rechaza referencias inventadas, campos incompletos y citas manuales',()=>{
 const f=[{referencia:'F1'}];assert.throws(()=>validarRespuestaGroq({},f));
 for(const cambio of [{referencias:['F99']},{referencias:[]},{texto:'Inventado [F99]'}]){const r=resultado();Object.assign(r.secciones[7],cambio);assert.throws(()=>validarRespuestaGroq(r,f));}
});
test('expediente excesivo no sale del servidor',async()=>{const s=entorno();const original=fuente.fragmento;fuente.fragmento='漢'.repeat(1000);const larga={...entrada,pregunta:'漢'.repeat(2000),antecedentes:'漢'.repeat(3000)};let enviado=false;const r=await consultarGroqDoctrina(larga,{env:{GROQ_API_KEY:'x',GROQ_ZDR_CONFIRMADO:'true'},rpc:async(a)=>a==='texto_buscar'?{resultados:[fuente]}:{autorizaciones:[{...fuente,autorizado:true,modelo:MODELO_GROQ}]},fetchImpl:async()=>{enviado=true;}});fuente.fragmento=original;assert.equal(enviado,false);assert.equal(r.generativo,false);});
