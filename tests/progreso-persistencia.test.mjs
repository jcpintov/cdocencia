import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const source=app.slice(app.indexOf('async function guardarProgresoDocente('),app.indexOf('async function confirmarLecturaFaseUno('));
function ctx({consultaError=null,error=null,data={id:'p',modulo_id:'m',leido:true},anterior={id:'p'},isAdmin=false}={}){
 const writes=[];
 const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:anterior,error:consultaError}),
 update:p=>{writes.push(p);return query;},insert:p=>{writes.push(p);return query;},single:async()=>({data,error})};
 const c={usuarioActual:{id:'u',es_admin:isAdmin},moduloActual:{id:'m'},misProgresos:{m:{id:'p',leido:false}},
 sbApp:{from:()=>query}};runInNewContext(source,c);return {c,writes};
}
test('fallo de lectura no intenta escritura ni anuncia avance',async()=>{
 const {c,writes}=ctx({consultaError:{code:'network'}});
 await assert.rejects(c.guardarProgresoDocente({leido:true}),/consultar/);
 assert.equal(writes.length,0);assert.equal(c.misProgresos.m.leido,false);
});
test('error de escritura y cero filas conservan cache',async()=>{
 for(const options of [{error:{code:'42501'},data:null},{data:null}]){
 const {c}=ctx(options);await assert.rejects(c.guardarProgresoDocente({leido:true}),/guardar/);
 assert.equal(c.misProgresos.m.leido,false);
 }
});
test('guardado confirmado actualiza cache y evita borrados al confirmar lectura',async()=>{
 const {c,writes}=ctx();await c.guardarProgresoDocente({leido:true});
 assert.equal(c.misProgresos.m.leido,true);assert.deepEqual(Object.keys(writes[0]),['leido']);
});
test('Superadmin no participa de progreso',async()=>{
 const {c,writes}=ctx({isAdmin:true});await assert.rejects(c.guardarProgresoDocente({leido:true}),/docente/);
 assert.equal(writes.length,0);
});
test('exige ocho respuestas válidas, conserva posibilidad de errores formativos',()=>{
 const {c}=ctx();const preguntas=Array.from({length:8},()=>({}));
 assert.equal(c.cuestionarioRespondido({0:'A'},preguntas),false);
 assert.equal(c.cuestionarioRespondido(Object.fromEntries(preguntas.map((_,i)=>[i,'B'])),preguntas),true);
 assert.equal(c.cuestionarioRespondido({},[]),false);
});
test('navegación del cuestionario compara longitud numérica',()=>{
 const fn=app.slice(app.indexOf('function evaluarRespuestaPasoAPaso'),app.indexOf('function avanzarSiguientePregunta'));
 assert.match(fn,/preguntas\?\.length/);
});
