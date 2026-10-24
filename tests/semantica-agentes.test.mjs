import {palabras} from '../lib/trabajos-tenida.js';
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {SEMANTICA_COMUN,CRITICA_ARGUMENTAL,SEMANTICA_CONSULTAS,SEMANTICA_ORATORIA,senalesSemanticas,puedeReutilizarFuentes} from '../lib/semantica-agentes.js';
import {prepararConsultaAgente,contextoConversacion} from '../lib/agente-doctrina.js';
import {buscarBibliotecaConGroq} from '../lib/busqueda-groq.js';
import {validarRevision,validarApoyosOratoria,generarOratoriaRevisada,promptOrador,pedirJSONTrabajos} from '../lib/trabajos-tenida.js';
const ficha={tipo:'ordinaria',grado:3},pasaje='La tolerancia exige escuchar razones antes de juzgar una conducta.',bloques=[{numero:1,sintesis:'La tolerancia exige juicio fundado.',pasajes:[pasaje],observaciones_argumentales:[]}];
test('mantiene errores, negaciones, modalidades y cuantificadores sin reescribir hechos',()=>{
 for(const pregunta of ['No todos los maestros deben ocupar un cargo.','Ningún maestro debe ocupar un cargo.','¿No pudo asistir o se negó a asistir?','Si ocurriera una ausencia, ¿qué pasaría?','Que dise la constitusion sobre la inisiasion?'])assert.equal(prepararConsultaAgente({pregunta}).pregunta,pregunta);
 assert.equal(senalesSemanticas('No dije que se negara; me refería a que no pudo.').correccion,true);
 assert.equal(senalesSemanticas('Supongamos una ausencia.').hipotesis,true);
 assert.equal(senalesSemanticas('No cambiemos de tema.').cambio_de_tema,false);
});
test('solo reutiliza fuentes en continuaciones claras; corrección o nuevo asunto obliga a buscar',()=>{
 const historial=[{role:'user',content:'El caso anterior'}];
 assert.equal(puedeReutilizarFuentes({pregunta:'Amplía ese argumento',historial}),true);
 for(const pregunta of ['Corrijo: no se negó, estaba enfermo.','Otro tema: ¿qué representa la acacia?','Otra pregunta: ¿cómo se elige un cargo?','¿Cuáles son las reglas electorales?'])assert.equal(puedeReutilizarFuentes({pregunta,historial}),false);
});
test('conserva correcciones intermedias en contexto acotado, sin favorecer una respuesta antigua',()=>{
 const historial=Array.from({length:12},(_,i)=>({role:i%2?'assistant':'user',content:i===2?'Corrijo: no fue una negativa; no pudo asistir.':'Turno '+i+' '+('contenido '.repeat(250))}));
 const r=contextoConversacion(historial,2000);assert.equal(r.length,12);assert.match(r[2].content,/no fue una negativa/);assert.ok(r.reduce((n,m)=>n+m.content.length,0)<=2000);assert.match(r[0].content,/\[…\]/);assert.deepEqual(historial[2],{role:'user',content:'Corrijo: no fue una negativa; no pudo asistir.'});
});
test('planificador recibe el texto original, señales no vinculantes y reglas de semántica/falacias',async()=>{
 let cuerpo;await buscarBibliotecaConGroq({pregunta:'Corrijo: no quiso no significa que no pudo.',historial:[],antecedentes:''},{modelo:'fixture',env:{GROQ_API_KEY:'fixture'},rpc:async()=>({resultados:[]}),fetchImpl:async(_u,o)=>{cuerpo=JSON.parse(o.body);return {ok:true,text:async()=>JSON.stringify({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{type:'function',function:{name:'buscar_biblioteca',arguments:JSON.stringify({consultas:['capacidad OR voluntad']})}}]}}]})};}});
 assert.ok(cuerpo.messages[0].content.includes(SEMANTICA_COMUN));assert.ok(cuerpo.messages[0].content.includes(CRITICA_ARGUMENTAL));const d=JSON.parse(cuerpo.messages.at(-1).content);assert.equal(d.senales_orientativas.correccion,true);assert.match(d.pregunta,/no pudo/);
});
test('revisión registra posible falacia con evidencia y descarta pasajes inventados',()=>{
 const texto='Mi propuesta es verdadera porque quien la critica es una mala persona.';
 const observacion={tipo:'argumentacion',pasaje:texto,explicacion:'Posible ad hominem: la descalificación de quien critica no demuestra la conclusión. Examine las razones de la propuesta.'};
 const r=validarRevision({sintesis:'Se intenta justificar una propuesta mediante una descalificación.',pasajes:[texto],observaciones:[observacion,{...observacion,pasaje:'Todos los maestros piensan igual y por eso tengo razón.'}]},{texto});assert.equal(r.observaciones.length,1);assert.equal(r.observaciones[0].tipo,'argumentacion');
});
test('criterios cubren familias de falacias y evitan falsos positivos por autoridad, tradición o metáfora',()=>{
 for(const tipo of ['afirmación del consecuente','negación del antecedente','circularidad','equívoco','composición','falso dilema','generalización','falsa causa','pendiente','hombre de paja','ad hominem','carga de la prueba'])assert.ok(CRITICA_ARGUMENTAL.includes(tipo));
 assert.match(CRITICA_ARGUMENTAL,/no son falaces por sí mismas/);assert.match(CRITICA_ARGUMENTAL,/conclusión falsa puede tener inferencia válida/);assert.match(CRITICA_ARGUMENTAL,/reformulación/);
 assert.match(SEMANTICA_CONSULTAS,/ausencia de documentos recuperados/);assert.match(SEMANTICA_ORATORIA,/no atribuyas/i);
});
test('oratoria requiere apoyos verificables cuando recibe un trabajo revisado y no cambia su extensión',async()=>{
 assert.deepEqual(validarApoyosOratoria([{bloque:1,pasaje}],bloques),[{bloque:1,pasaje}]);assert.throws(()=>validarApoyosOratoria([{bloque:2,pasaje}],bloques),/no coincide/);assert.throws(()=>validarApoyosOratoria([],bloques),/Falta respaldo/);assert.throws(()=>validarApoyosOratoria([{bloque:1,pasaje:'Todos deben aceptar la propuesta sin examinarla.'}],[{numero:1,pasajes:['No todos deben aceptar la propuesta sin examinarla.']}]),/no coincide/);
 let n=0;const r=await generarOratoriaRevisada(ficha,{trabajo_completo_revisado:bloques},{pedir:async prompt=>{n++;assert.ok(prompt.includes(SEMANTICA_ORATORIA));assert.ok(prompt.includes(CRITICA_ARGUMENTAL));return {texto:Array(350).fill('Reflexión').join(' '),...(n===2?{apoyos:[{bloque:1,pasaje}]}:{})};}});assert.equal(n,2);assert.equal(r.palabras,palabras(r.texto));assert.equal(r.apoyos[0].pasaje,pasaje);
});
test('criterios compartidos no se duplican en la petición al proveedor',async()=>{
 await pedirJSONTrabajos(promptOrador(ficha),{}, {env:{GROQ_API_KEY:'fixture',GROQ_ZDR_CONFIRMADO:'true'},fetchImpl:async(_u,o)=>{const p=JSON.parse(o.body).messages[0].content;assert.equal(p.split(SEMANTICA_COMUN).length-1,1);assert.equal(p.split(CRITICA_ARGUMENTAL).length-1,1);return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:'{"texto":"fixture"}'}}]})};}});
});
test('observaciones argumentales pasan a conclusiones y aparecen en el informe privado',async()=>{
 const api=await readFile('api/admin-orador.js','utf8'),ui=await readFile('trabajos-tenida.js','utf8');assert.match(api,/observaciones_argumentales:/);assert.match(ui,/6\. Argumentación y posibles falacias/);
});
