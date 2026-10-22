import test from 'node:test';
import assert from 'node:assert/strict';
import {buscarBibliotecaConGroq} from '../lib/busqueda-groq.js';
const entrada={pregunta:'que dise la constitusion sobre inisiasion?',antecedentes:''};
const tool=consultas=>({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{id:'call',type:'function',function:{name:'buscar_biblioteca',arguments:JSON.stringify({consultas})}}]}}]});
function entorno(respuesta){const consultas=[];return {consultas,rpc:async(a,d)=>{assert.equal(a,'texto_buscar');consultas.push(d.consulta);return {resultados:[]};},env:{GROQ_API_KEY:'fixture'},modelo:'openai/gpt-oss-120b',fetchImpl:async(_url,op)=>{const b=JSON.parse(op.body);assert.equal(b.tools[0].function.name,'buscar_biblioteca');assert.match(b.messages[1].content,/inisiasion/);return {ok:true,text:async()=>JSON.stringify(respuesta)};}};}
test('ejecuta las búsquedas decididas por Groq y conserva la pregunta original con errores',async()=>{const s=entorno(tool(['iniciación','admisión OR profano']));await buscarBibliotecaConGroq(entrada,s);assert.deepEqual(s.consultas,['iniciación','admisión OR profano']);assert.equal(entrada.pregunta,'que dise la constitusion sobre inisiasion?');});
for(const respuesta of [tool([]),tool(['a']),tool(['x'.repeat(251)]),tool(['uno','dos','tres','cuatro']),{choices:[{finish_reason:'stop',message:{content:'Respuesta inventada'}}]}, {choices:[{finish_reason:'tool_calls',message:{tool_calls:[{type:'function',function:{name:'ejecutar_sql',arguments:'{}'}}]}}]}]){
 test('no ejecuta herramientas o argumentos inválidos: '+JSON.stringify(respuesta).slice(0,80),async()=>{const s=entorno(respuesta);await assert.rejects(buscarBibliotecaConGroq(entrada,s));assert.equal(s.consultas.length,0);});
}

test('abre una frase sin resultados en conceptos alternativos antes de detenerse',async()=>{const s=entorno(tool(['ausencia prolongada injustificada']));await buscarBibliotecaConGroq(entrada,s);assert.deepEqual(s.consultas,['ausencia prolongada injustificada','ausencia OR prolongada OR injustificada']);});

test('en un caso de conducta contrasta calificación y competencia, además de los hechos',async()=>{const respuesta=tool(['asistencia OR excusa']);respuesta.choices[0].message.tool_calls[0].function.arguments=JSON.stringify({consultas:['asistencia OR excusa'],es_caso_conducta:true});const s=entorno(respuesta);await buscarBibliotecaConGroq(entrada,s);assert.ok(s.consultas.includes('incumplimiento deber'));assert.ok(s.consultas.includes('tribunal competencia'));});
