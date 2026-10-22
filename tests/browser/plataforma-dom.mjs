// Flujos DOM aislados: sin cuentas reales, SMTP, almacenamiento ni despliegues.
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {JSDOM}=createRequire(process.env.QA_DOM_ROOT+'/package.json')('jsdom');
const html=await readFile('index.html','utf8');
function entorno(){const dom=new JSDOM(html,{url:'https://fixture.example.invalid',runScripts:'outside-only'}),w=dom.window;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.usuarioActual={id:'admin',nombre:'Julio César',email:'jpintov@gmail.com',es_admin:true};w.sbApp={auth:{getSession:async()=>({data:{session:{access_token:'fixture'}}}),refreshSession:async()=>({})}};w.SUPABASE_URL='https://fixture.supabase.co';w.normalizarBusquedaAdmin=s=>s.toLowerCase();return {dom,w};}
{
 const {dom,w}=entorno();let calls=[];
 w.fetch=async(_url,req)=>{const b=JSON.parse(req.body);calls.push(b);return {ok:true,json:async()=>b.action==='pendiente'?{ok:true,pendiente:false}:b.action==='solicitar'?{ok:true,id:'challenge',mensaje:'Enviado al correo actual'}:{ok:true,nombre:'Nombre Nuevo',email:'nuevo@example.invalid'}};};
 w.eval(await readFile('perfil-superadmin.js','utf8'));await w.abrirPerfilSuperadmin();
 w.document.getElementById('perfilSuperadminNombre').value='Nombre Nuevo';w.document.getElementById('perfilSuperadminEmail').value='nuevo@example.invalid';await w.accionPerfilSuperadmin('solicitar');
 assert.equal(w.usuarioActual.email,'jpintov@gmail.com');assert.equal(w.document.getElementById('perfilSuperadminEmail').disabled,true);
 w.document.getElementById('perfilSuperadminCodigo').value='12345678';await w.accionPerfilSuperadmin('confirmar');assert.equal(w.usuarioActual.email,'nuevo@example.invalid');assert.equal(w.document.getElementById('perfilSuperadminCodigo').value,'');assert.equal(calls.at(-1).id,'challenge');
 w.cerrarPerfilSuperadmin();assert.equal(w.document.getElementById('perfilSuperadminDialogo').open,false);dom.window.close();
}
{
 const {dom,w}=entorno();const calls=[];
 w.fetch=async(_url,req)=>{const b=JSON.parse(req.body);calls.push(b);return {ok:true,json:async()=>b.action==='texto_buscar'?{ok:true,cobertura:{vigentes:3,consultables:1,pendientes:2},resultados:[{titulo:'<script>fuente</script>',version_id:'v',version:1,pagina:1,fragmento:'<img src=x onerror=alert(1)>'}]}:{ok:true,extraido:true,estado:'revision',total_paginas:2,pendientes:1,pagina:{numero:b.pagina||1,texto:b.texto||'Texto de la página',requiere_ocr:false,revisada:false}}};};
 w.eval(await readFile('doctrina-admin.js','utf8'));await w.abrirTextoDoctrina({version_id:'v',titulo:'Fuente de prueba'});
 w.document.getElementById('doctrinaTextoPagina').value=2;const count=calls.length;await w.accionTextoDoctrina('texto_revisar_pagina');assert.equal(calls.length,count,'No guarda texto en una página que no se cargó');
 await w.accionTextoDoctrina('texto_pagina');w.document.getElementById('doctrinaTextoContenido').value='Corrección contrastada';await w.accionTextoDoctrina('texto_revisar_pagina');assert.equal(calls.at(-1).pagina,2);assert.equal(calls.at(-1).texto,'Corrección contrastada');
 w.document.getElementById('doctrinaConsultaTexto').value='prueba';await w.buscarTextoDoctrina();assert.equal(w.document.querySelectorAll('#doctrinaBusquedaResultados script,#doctrinaBusquedaResultados img').length,0);assert.ok(w.document.getElementById('doctrinaBusquedaResultados').textContent.includes('página 1'));assert.match(w.document.getElementById('doctrinaBusquedaResultados').textContent,/1 de 3 originales vigentes consultables/);assert.match(w.document.getElementById('doctrinaBusquedaResultados').textContent,/2 pendientes/);
 w.limpiarBibliotecaDoctrina();assert.equal(w.document.getElementById('doctrinaTextoContenido').value,'');assert.equal(w.document.getElementById('doctrinaBusquedaResultados').textContent,'');dom.window.close();
}
{
 const {dom,w}=entorno();let resolver;
 w.eval(await readFile('doctrina-admin.js','utf8'));
 const informe={generativo:true,cobertura:{vigentes:3,consultables:1,pendientes:2},secciones:[{titulo:'Conclusión condicionada',texto:'<img src=x onerror=alert(1)>'}],fuentes:[{referencia:'F1',titulo:'<script>privado</script>',clase:'doctrina',pagina:2,version:1,sha256:'abc'}]};
 w.fetch=async()=>({ok:true,json:async()=>({ok:true,informe})});
 w.document.getElementById('doctrinaAgentePregunta').value='¿Qué representa la acacia?';await w.consultarAgenteDoctrina();
 const salida=w.document.getElementById('doctrinaAgenteResultado'),hilo=w.document.getElementById('doctrinaConversacion');assert.match(hilo.textContent,/F1/);assert.match(hilo.textContent,/página 2/);assert.equal(hilo.querySelectorAll('script,img').length,0);assert.equal(salida.getAttribute('aria-busy'),'false');
 assert.equal(w.document.getElementById('doctrinaAgentePregunta').value,'');
 let repregunta;
 w.fetch=async(_u,req)=>{repregunta=JSON.parse(req.body);return {ok:true,json:async()=>({ok:true,informe})};};
 w.document.getElementById('doctrinaAgentePregunta').value='Sí';await w.consultarAgenteDoctrina();
 assert.equal(repregunta.pregunta,'Sí');assert.equal(repregunta.historial.length,2);assert.match(repregunta.historial[0].content,/acacia/);assert.equal(hilo.querySelectorAll('.doctrina-turno').length,2);
 w.document.getElementById('doctrinaAgentePregunta').value='Aclaro un antecedente';
 w.fetch=()=>new Promise(r=>{resolver=r;});const pendiente=w.consultarAgenteDoctrina();await new Promise(r=>setTimeout(r,0));w.limpiarBibliotecaDoctrina();w.usuarioActual=null;resolver({ok:true,json:async()=>({ok:true,informe})});await pendiente;
 assert.equal(salida.textContent,'');assert.equal(hilo.textContent,'');assert.equal(w.document.getElementById('doctrinaAgentePregunta').value,'');assert.equal(w.document.getElementById('doctrinaAgenteConsultar').disabled,false);dom.window.close();
}
{
 const {dom,w}=entorno();
 w.eval(await readFile('doctrina-admin.js','utf8'));
 const form=w.document.getElementById('doctrinaAgenteFormulario');
 assert.equal(form.querySelectorAll('textarea,input').length,1);
 assert.equal(w.document.getElementById('doctrinaBibliotecaPanel').open,false);
 assert.equal(w.document.getElementById('doctrinaIndexacionPanel').open,false);
 let envios=0;form.requestSubmit=()=>envios++;
 const campo=w.document.getElementById('doctrinaAgentePregunta');
 campo.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
 campo.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',shiftKey:true,bubbles:true,cancelable:true}));
 campo.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true}));
 assert.equal(envios,1,'Mayús+Enter y composición no envían consultas');
 campo.value='¿Qué deber existe al cubrir un cargo?';
 w.fetch=async()=>({ok:false,json:async()=>({error:'Servicio temporalmente no disponible'})});
 await w.consultarAgenteDoctrina();
 assert.match(w.document.getElementById('doctrinaAgenteResultado').textContent,/temporalmente/);
 assert.equal(campo.value,'¿Qué deber existe al cubrir un cargo?');
 assert.equal(w.document.getElementById('doctrinaAgenteConsultar').textContent,'Consultar');
 assert.equal(w.document.getElementById('doctrinaAgenteConsultar').disabled,false);
 dom.window.close();
}
console.log('PASS DOM: perfil con código previo, datos bloqueados hasta confirmar, revisión por página correcta, resultados seguros y limpieza de sesión.');
