import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {JSDOM}=createRequire(process.env.QA_DOM_ROOT+'/package.json')('jsdom');
const dom=new JSDOM('<div id="salida"></div>',{runScripts:'outside-only'}),w=dom.window;
try{
 const ui=await readFile('doctrina-admin.js','utf8');
 w.eval(ui.slice(ui.indexOf('function ofrecerAprendizajeDoctrina('),ui.indexOf('async function consultarAgenteDoctrina()')));
 let vigente=true;const acciones=[];
 w.confirm=()=>true;w.peticionDoctrina=async(a,d)=>{acciones.push([a,d]);return {ok:true};};
 w.vaciarMemoriaSesionLocal=()=>{};w.cargarMemoriaAgenteSesion=async()=>{};
 const salida=w.document.getElementById('salida');
 w.ofrecerAprendizajeDoctrina('11111111-1111-4111-8111-111111111111',salida,()=>vigente);
 const boton=salida.querySelector('button');assert.match(salida.textContent,/candidato/);
 await boton.onclick();assert.equal(acciones[0][0],'caso_aprobar');assert.equal(acciones[0][1].confirmacion,true);
 assert.match(boton.textContent,/Retirar/);
 await boton.onclick();assert.equal(acciones[1][0],'caso_retirar');
 vigente=false;await boton.onclick();assert.equal(acciones.length,2);
 console.log('PASS DOM memoria: aprobación explícita, retiro e invalidación de sesión.');
}finally{w.close();}

const sesion=new JSDOM('<form id="doctrinaAgenteFormulario"></form>',{runScripts:'outside-only'}),s=sesion.window;
try{
 const ui=await readFile('doctrina-admin.js','utf8');
 s.eval(ui.slice(0,ui.indexOf('let reintentoAgenteHasta=')));
 s.usuarioActual={id:'actor',es_admin:true};let lecturas=0;
 s.peticionDoctrina=async action=>{
  assert.equal(action,'memoria_sesion');lecturas++;
  return {ok:true,memoria:{schema_version:1,criterios:[{id:'criterio'}],casos:[{id:'caso-guardado'}],persistencia_casos:true}};
 };
 assert.equal((await s.cargarMemoriaAgenteSesion()).casos[0].id,'caso-guardado');
 await s.cargarMemoriaAgenteSesion();assert.equal(lecturas,1);
 s.vaciarMemoriaSesionLocal();
 assert.equal((await s.cargarMemoriaAgenteSesion()).casos[0].id,'caso-guardado');assert.equal(lecturas,2);
 assert.match(s.document.getElementById('doctrinaMemoriaEstado').textContent,/conserva entre sesiones/);
 console.log('PASS JSON de sesión: carga inicial, reutilización local y recuperación después de limpiar la sesión.');
}finally{s.close();}
