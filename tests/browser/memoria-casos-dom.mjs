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
 assert.equal(s.document.getElementById('doctrinaMemoriaEstado'),null,'La memoria se conserva sin textos de relleno');
 console.log('PASS JSON de sesión: carga inicial, reutilización local y recuperación después de limpiar la sesión.');
}finally{s.close();}

const archivo=new JSDOM(await readFile('index.html','utf8'),{url:'https://fixture.invalid',runScripts:'outside-only'}),a=archivo.window;
try{
 a.usuarioActual={id:'actor',es_admin:true};a.confirm=()=>true;let estado='candidato',blob,descargas=0,eliminado=false,falloEliminar=false,lecturasMemoria=0;
 a.vaciarMemoriaSesionLocal=()=>{};a.cargarMemoriaAgenteSesion=async()=>{lecturasMemoria++};a.Blob=Blob;a.URL.createObjectURL=b=>{blob=b;return 'blob:fixture';};a.URL.revokeObjectURL=()=>{};a.HTMLAnchorElement.prototype.click=()=>descargas++;
 const caso={id:'11111111-1111-4111-8111-111111111111',pregunta:'<script>Pregunta</script>',respuesta:'Respuesta',fuentes:[],creado_en:'2026-10-23T12:00:00Z',conversacion:[{role:'user',content:'Primera pregunta'},{role:'assistant',content:'<img src=x>Respuesta'}]};
 a.peticionDoctrina=async(action)=>{if(action==='caso_eliminar'){if(falloEliminar)throw Error('Fallo del servidor');eliminado=true;return {eliminado:true};}if(action==='caso_aprobar')estado='revisado';if(action==='caso_retirar')estado='retirado';if(action==='memoria_exportar')return {memoria:{schema_version:1,casos:estado==='revisado'&&!eliminado?[caso]:[]}};return {conversaciones:eliminado?[]:[{...caso,estado}],total:eliminado?0:1,hay_mas:false};};
 a.eval(await readFile('conversaciones-doctrina.js','utf8'));await a.cargarConversacionesDoctrina();
 const lista=a.document.getElementById('doctrinaCasosLista');assert.equal(lista.querySelectorAll('script,img').length,0);assert.match(lista.textContent,/Primera pregunta/);assert.match(lista.textContent,/Pendiente/);
 await lista.querySelector('button').onclick();assert.equal(estado,'revisado');assert.match(lista.textContent,/Aprobada/);
 await a.descargarMemoriaAprobada();assert.equal(descargas,1);assert.equal(JSON.parse(await blob.text()).casos.length,1);
 await lista.querySelector('button').onclick();assert.equal(estado,'retirado');await a.descargarMemoriaAprobada();assert.equal(JSON.parse(await blob.text()).casos.length,0);
 a.confirm=()=>false;await lista.querySelector('.btn-eliminar-registro').onclick();assert.equal(eliminado,false);
 a.confirm=()=>true;falloEliminar=true;await lista.querySelector('.btn-eliminar-registro').onclick();assert.equal(eliminado,false);assert.match(a.document.getElementById('doctrinaCasosEstado').textContent,/Fallo/);assert.equal(lista.querySelector('.btn-eliminar-registro').disabled,false);
 falloEliminar=false;await lista.querySelector('button').onclick();assert.equal(estado,'revisado');const recargas=lecturasMemoria;await lista.querySelector('.btn-eliminar-registro').onclick();assert.equal(eliminado,true);assert.equal(lista.children.length,0);assert.equal(lecturasMemoria,recargas+1);
 await a.descargarMemoriaAprobada();assert.equal(JSON.parse(await blob.text()).casos.length,0);
 eliminado=false;estado='retirado';await a.cargarConversacionesDoctrina();const viejo=lista.querySelector('.btn-eliminar-registro');a.limpiarConversacionesDoctrina();a.usuarioActual=null;await viejo.onclick();assert.equal(lista.children.length,0);assert.equal(estado,'retirado');
 console.log('PASS archivo: diálogo completo, aprobación, retiro, JSON solo aprobado, XSS y limpieza de sesión.');
}finally{a.close();}
