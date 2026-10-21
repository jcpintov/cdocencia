// Recorridos aislados: ninguna credencial, correo o escritura de producción.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(process.env.QA_PLAYWRIGHT_ROOT+'/package.json')('playwright');
const root=resolve('.');
const catalogo=JSON.parse(await readFile('tests/browser/catalogo-fixture.json','utf8')).catalogo;
const bootstrap=()=>{
 window.qa={fail:false,delay:0,writeFail:false,progress:null,restoreFail:false,authCalls:0,updateFail:false,recovery:false,comments:[],replyFail:false,replyUncertain:false,editFail:false,replyCalls:0};
 const user={id:'u1',nombre:'Hermano de Prueba',email:'prueba@example.invalid',es_admin:false,debe_cambiar_clave:false};
 const module={id:'m1',numero_orden:1,titulo:'La Acacia',autor:'Autor de Prueba',unidad_codigo:'INCI011A',contenido_trazado:'Texto de prueba para la lectura docente.',resumen_formativo:'Resumen.',conclusion_enlace:'Conclusión.',preguntas_json:{preguntas:Array.from({length:8},(_,i)=>({enunciado:'Interrogante '+(i+1),opciones:['A','B','C','D'].map(letra=>({letra,texto:'Opción '+letra})),respuesta_correcta:'A',retroalimentacion:'Fundamento de la respuesta.'}))}};
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 function from(table){let changes=null,single=false;const q={};
  for(const k of ['select','eq','order','limit','in','neq','not','is'])q[k]=()=>q;
  q.maybeSingle=q.single=()=>{single=true;return q;};
  q.update=q.insert=v=>{changes=v;return q;};
  q.then=(ok,bad)=>(async()=>{
   if(table==='modulos'){await sleep(window.qa.delay);if(window.qa.fail)return {error:{status:503},data:null};return {data:[module]};}
   if(table==='usuarios')return {data:single?user:[user]};
   if(table==='unidades_docencia')return {data:window.qaCatalogo};
   if(table==='config_segura')return {data:null};
   if(table==='progreso_maestro'){
    if(changes){if(window.qa.writeFail)return {data:null,error:{code:'network'}};window.qa.progress={id:'p1',usuario_id:'u1',modulo_id:'m1',...window.qa.progress,...changes};}
    return {data:single?window.qa.progress:(window.qa.progress?[window.qa.progress]:[])};
   }
   return {data:[]};
  })().then(ok,bad);return q;
 }
 async function rpc(name,args){
  if(name==='muro_docente_autorizado')return {data:{
   aportes:qa.progress?.completado?[{...qa.progress,usuarios:{nombre:user.nombre}}]:[],
   comentarios:qa.progress?.completado?[{id:'c0',progreso_id:'p1',modulo_id:'m1',usuario_id:'u2',contenido:'Comentario inicial de otro hermano.',usuarios:{nombre:'Otro Hermano'},creado_en:'2026-10-21T12:00:00Z'},...qa.comments]:[]
  }};
  if(name==='maestro_responder_comentario'){
   qa.replyCalls++;await sleep(30);
   if(qa.replyFail)return {data:null,error:{message:'Conexión interrumpida'}};
   const existing=qa.comments.find(c=>c.solicitud_id===args.p_solicitud_id);
   if(existing)return {data:existing.id};
   const comment={id:'r'+(qa.comments.length+1),progreso_id:'p1',modulo_id:'m1',usuario_id:'u1',comentario_padre_id:args.p_comentario_padre_id,contenido:args.p_contenido,solicitud_id:args.p_solicitud_id,usuarios:{nombre:user.nombre},creado_en:new Date().toISOString()};
   qa.comments.push(comment);
   if(qa.replyUncertain){qa.replyUncertain=false;return {data:null,error:{message:'Respuesta del servidor interrumpida'}};}
   return {data:comment.id};
  }
  if(name==='maestro_editar_comentario_propio'){
   if(qa.editFail)return {data:null,error:{message:'No se pudo guardar la edición'}};
   const c=qa.comments.find(c=>c.id===args.p_comentario_id&&c.usuario_id==='u1');
   if(!c)return {data:null,error:{message:'Comentario ajeno'}};
   c.contenido=args.p_contenido;c.editado=true;return {data:true};
  }
  return {data:[]};
 }
 window.supabase={createClient:()=>({from,rpc,auth:{
  getUser:async()=>{if(window.qa.restoreFail)throw Error('Network error');return {data:{user:null}};},
  getSession:async()=>({data:{session:window.qa.recovery?{access_token:'fixture'}:null}}),
  onAuthStateChange:()=>{},signOut:async()=>({}),
  signInWithPassword:async()=>{window.qa.authCalls++;await sleep(50);return {data:{user:{id:'auth1'}}};},
  updateUser:async()=>{if(window.qa.updateFail)throw Error('Network error');return {data:{}};},
  exchangeCodeForSession:async()=>({data:{session:null},error:{message:'expired'}})
 }})};
 const originalTimeout=window.setTimeout;
 window.setTimeout=(fn,ms,...args)=>originalTimeout(fn,ms===120000?1:ms,...args);
};
const stub='<script>window.qaCatalogo='+JSON.stringify(catalogo)+';('+bootstrap.toString()+')();</script>';
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end('{"ok":true}');return;}
 let content=await readFile(root+(path==='/'?'/index.html':path));
 if(path==='/'||path.endsWith('.html'))content=Buffer.from(content.toString().replace(/<body[^>]*>/,m=>m+stub));
 res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[extname(path==='/'?'/index.html':path)]||'application/octet-stream');res.end(content);
 }catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{console.log('DIALOG QA: '+d.message());return d.accept();});
 await page.route('https://**/*',r=>r.abort());
 const visible=async id=>assert.equal(await page.locator('#'+id).isVisible(),true,id);
 const nav=async(section,name)=>{const menu=page.locator('#'+section+' .portal-menu');if(await menu.count())await menu.evaluate(el=>el.open=true);await page.locator('#'+section).getByRole('button',{name,exact:true}).click();};
 await page.goto(url);
 await page.locator('#inputEmail').fill('prueba@example.invalid');await page.locator('#inputClave').fill('Prueba123!');
 await page.locator('#inputClave').press('Enter');
 await page.locator('#modalSigilo').waitFor({state:'visible'});
 assert.equal(await page.locator('#inputClave').inputValue(),'');
 assert.equal(await page.evaluate(()=>qa.authCalls),1);
 await page.locator('#modalSigilo button').click();await visible('seccionBienvenida');
 assert.equal(await page.locator('#seccionAdmin').isVisible(),false);
 await nav('seccionBienvenida','Este Espacio');await visible('seccionDocenciaInstitucional');
 await nav('seccionDocenciaInstitucional','Contenido Docente');
 await page.locator('#contenidoDocenteConteo').filter({hasText:'139'}).waitFor();
 await page.getByRole('button',{name:'Mostrar todos los temas',exact:true}).click();
 assert.equal(await page.locator('.docencia-tarjeta-tema').count(),139);
 await nav('seccionContenidoDocente','Trabajos de la Cámara');await page.locator('.btn-grid-ir').waitFor();
 await page.locator('.btn-grid-ir').click();await visible('seccionDocencia');
 await page.locator('#btnConfirmarLectura').click();await visible('bloqueFaseDos');
 for(let i=0;i<8;i++){
  await page.locator('#label_paso_A').click();
  if(i<7)await page.locator('#btnSiguientePregunta').click();
 }
 await page.locator('#btnFinalizarCuestionario').click();await visible('bloqueFaseTres');
 const reflection='Esta reflexión de prueba contiene las palabras necesarias para verificar que la conexión interrumpida no elimina el aporte del hermano.';
 await page.locator('#textoReflexion').fill(reflection);
 await page.evaluate(()=>qa.writeFail=true);await page.locator('#btnConsagrarReflexion').click();
 assert.equal(await page.locator('#textoReflexion').inputValue(),reflection);
 assert.equal(await page.locator('#btnConsagrarReflexion').isEnabled(),true);
 assert.notEqual(await page.evaluate(()=>qa.progress.completado),true);
 await page.evaluate(()=>qa.writeFail=false);await page.locator('#btnConsagrarReflexion').click();
 await page.locator('#bloqueMuro').waitFor({state:'visible'});
 assert.equal(await page.evaluate(()=>qa.progress.completado),true);
 // Hilos: respuesta, respuesta a respuesta, edición y preservación de borradores.
 await page.locator('#comentario_item_c0 [data-hilo-accion="responder"]').click();
 await page.locator('#hilo_texto_c0').fill('Respuesta de prueba que debe conservarse ante una caída de conexión.');
 await page.locator('#hilo_form_c0 [data-hilo-accion="cancelar"]').click();
 assert.equal(await page.locator('#hilo_form_c0').isVisible(),false);
 await page.locator('#comentario_item_c0 [data-hilo-accion="responder"]').click();
 assert.match(await page.locator('#hilo_texto_c0').inputValue(),/conservarse/);
 await page.evaluate(()=>qa.replyFail=true);
 await page.locator('#hilo_form_c0 [type="submit"]').click();
 await page.locator('#hilo_estado_c0').filter({hasText:'Su texto se conserva'}).waitFor();
 assert.equal(await page.locator('#hilo_form_c0 [type="submit"]').isEnabled(),true);
 assert.equal(await page.evaluate(()=>qa.comments.length),0);
 await page.evaluate(()=>qa.replyFail=false);
 await page.locator('#hilo_form_c0 [type="submit"]').click();
 await page.locator('#comentario_item_r1').waitFor();
 assert.equal(await page.locator('#comentario_item_r1').getAttribute('data-padre-id'),'c0');
 assert.equal(await page.locator('#comentario_item_c0 [data-hilo-accion="editar"]').count(),0);
 // Se perdió la confirmación, pero el reintento conserva el mismo identificador.
 await page.locator('#comentario_item_r1 [data-hilo-accion="responder"]').click();
 await page.locator('#hilo_texto_r1').fill('Respuesta anidada con confirmación interrumpida.');
 await page.evaluate(()=>qa.replyUncertain=true);
 await page.locator('#hilo_form_r1 [type="submit"]').click();
 await page.locator('#hilo_estado_r1').filter({hasText:'Su texto se conserva'}).waitFor();
 assert.equal(await page.evaluate(()=>qa.comments.length),2);
 await page.locator('#hilo_form_r1 [type="submit"]').click();
 await page.locator('#comentario_item_r2').waitFor();
 assert.equal(await page.evaluate(()=>qa.comments.length),2);
 assert.equal(await page.locator('#comentario_item_r2').count(),1);
 assert.equal(await page.locator('#comentario_item_r2').getAttribute('data-padre-id'),'r1');
 // Abrir otro borrador y editar un comentario no debe borrarlo.
 await page.locator('#comentario_item_c0 [data-hilo-accion="responder"]').click();
 await page.locator('#hilo_texto_c0').fill('Otro borrador que no debe desaparecer durante una edición.');
 await page.locator('#comentario_item_r1 [data-hilo-accion="editar"]').click();
 await page.locator('#textareaEditarComentario').fill('Respuesta propia editada desde el formulario.');
 await page.evaluate(()=>qa.editFail=true);
 await page.locator('#btnGuardarEdicionComentario').click();
 await page.locator('#estadoEditarComentario').filter({hasText:'Su texto se conserva'}).waitFor();
 assert.equal(await page.locator('#btnGuardarEdicionComentario').isEnabled(),true);
 await page.evaluate(()=>qa.editFail=false);await page.locator('#btnGuardarEdicionComentario').click();
 await page.locator('#modalEditarComentarioForo').waitFor({state:'hidden'});
 await page.locator('#comentario_cuerpo_r1').filter({hasText:'Respuesta propia editada'}).waitFor();
 assert.match(await page.locator('#hilo_texto_c0').inputValue(),/Otro borrador/);
 assert.equal(await page.locator('#hilo_form_c0').isVisible(),true);
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Hilos legibles en móvil sin desborde');
 await page.setViewportSize({width:1440,height:900});
 await page.evaluate(()=>volverAInicioPortal());await visible('seccionBienvenida');
 // Un catálogo caído conserva navegación y reintento visibles.
 await page.evaluate(()=>qa.fail=true);await nav('seccionBienvenida','Trabajos de la Cámara');
 await page.getByRole('button',{name:'Reintentar',exact:true}).waitFor();
 await page.evaluate(()=>qa.fail=false);await page.getByRole('button',{name:'Reintentar',exact:true}).click();
 await page.waitForFunction(()=>document.getElementById('seccionCatalogoTrabajos').getAttribute('aria-busy')==='false');
 assert.equal(await page.locator('[data-estado-catalogo]:visible').count(),0);
 await nav('seccionCatalogoTrabajos','Muro Docente');
 await page.locator('#contenedorMuroUsuariosDirecto #comentario_item_r2').waitFor();
 await page.locator('#comentario_item_r2 [data-hilo-accion="responder"]').click();
 await page.locator('#hilo_texto_r2').fill('Respuesta escrita desde el muro docente general.');
 await page.locator('#hilo_form_r2 [type="submit"]').click();
 await page.locator('#contenedorMuroUsuariosDirecto #comentario_item_r3').waitFor();
 assert.equal(await page.locator('#comentario_item_r3').getAttribute('data-padre-id'),'r2');
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Muro general sin desborde en móvil');
 await page.setViewportSize({width:1440,height:900});
 // La respuesta tardía no revierte el destino elegido.
 await page.evaluate(()=>{qa.delay=300;void irAContenidoDocente();volverAInicioPortal();});
 await page.waitForTimeout(500);await visible('seccionBienvenida');
 assert.equal(await page.locator('#seccionContenidoDocente').isVisible(),false);
 await page.setViewportSize({width:390,height:844});
 for(const section of ['seccionBienvenida','seccionContenidoDocente','seccionCatalogoTrabajos']){
  if(section==='seccionContenidoDocente')await page.evaluate(()=>irAContenidoDocente());
  if(section==='seccionCatalogoTrabajos')await page.evaluate(()=>irACatalogoDocencia());
  await visible(section);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Sin desborde horizontal: '+section);
 }
 await page.evaluate(()=>{qa.delay=300;void irAContenidoDocente();cerrarSesion();});
 await page.waitForTimeout(500);await visible('seccionLogin');
 assert.equal(await page.locator('#seccionContenidoDocente').isVisible(),false);
 // Fallos de recuperación: nunca dejan el botón deshabilitado.
 await page.goto(url+'/recuperar.html');
 await page.locator('#requestSection').waitFor({state:'visible'});
 assert.equal(await page.getByRole('link',{name:'Volver al ingreso de Cámara de Docencia'}).getAttribute('href'),'/');
 await page.evaluate(()=>{qa.recovery=true;ready();qa.updateFail=true;});
 await page.locator('#password').fill('Prueba123!');await page.locator('#confirm').fill('Prueba123!');
 await page.locator('#submit').click();
 await page.locator('#status').filter({hasText:'No se pudo confirmar'}).waitFor();
 assert.equal(await page.locator('#submit').isEnabled(),true);
 assert.equal(await page.locator('#password').inputValue(),'Prueba123!');
 await page.evaluate(()=>qa.updateFail=false);await page.locator('#submit').click();
 await page.locator('#status').filter({hasText:'Contraseña actualizada'}).waitFor();
 assert.equal(await page.locator('#form').isVisible(),false);
 assert.deepEqual(errors,[]);
 console.log('PASS: ingreso, programa, lectura, cuestionario, reflexión, hilos en ambos muros, respuesta anidada, reintento sin duplicado, edición propia, borradores, móvil, navegación y recuperación.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
