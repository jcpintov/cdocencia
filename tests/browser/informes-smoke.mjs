// HTTP + navegador + PDF reales; base y credenciales completamente sintéticas.
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {crearHandlerInformes} from '../../api/admin-informes.js';
const require=createRequire(process.env.QA_PLAYWRIGHT_ROOT+'/package.json'),{chromium}=require('playwright');
const catalogo=JSON.parse(await readFile('tests/browser/catalogo-fixture.json','utf8')).catalogo;
const usuarios=Array.from({length:26},(_,i)=>({id:'u'+i,nombre:i===0?'Álvaro Pérez':i===1?'José <script>alert(1)</script>':'Hermano '+String(i+1).padStart(2,'0'),email:'user'+i+'@example.invalid',es_admin:false,auth_user_id:'auth'+i,cuenta_eliminada:false}));
const administrador={id:'admin',nombre:'Julio César',email:'jpintov@gmail.com',es_admin:true,auth_user_id:'auth-admin'};
let asignaciones=[0,1].map((i)=>({id:'a'+i,usuario_id:'u0',nombre:usuarios[0].nombre,email:usuarios[0].email,codigo:i?'INCI011B':'INCI011A',tema:'Un tema con título largo para comprobar el formato del documento',vigente:true,version:1,fecha_asignacion:'2026-10-20',fecha_entrega:'2026-11-10',correos:[],recordatorio:{publicado:false,estado:'sin_solicitud'}}));
const progresos=[{id:'p1',usuario_id:'u0',modulo_id:'m1',leido:true,completado:true}];
const tablas={usuarios:[...usuarios,administrador],modulos:[{id:'m1',activo:true}],progreso_maestro:progresos,registro_accesos:Array.from({length:1101},(_,i)=>({id:i,usuario_id:'u0',creado_en:'2026-10-20T12:00:00Z'}))};
process.env.SUPABASE_URL='https://fixture.invalid';process.env.SUPABASE_PUBLISHABLE_KEY='key';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-only';
const cliente=(_url,key)=>key==='key'?{auth:{getUser:async()=>({data:{user:{id:'auth-admin',email:administrador.email}}})}}:{
 from(tabla){let single=false,a=0,b=499;const q={};for(const k of ['select','eq','order','lte'])q[k]=()=>q;q.maybeSingle=()=>{single=true;return q;};q.range=(x,y)=>{a=x;b=y;return q;};q.abortSignal=()=>q;q.then=(ok,bad)=>Promise.resolve({data:single?administrador:tablas[tabla].slice(a,b+1)}).then(ok,bad);return q;},
 rpc:()=>({abortSignal:async()=>({data:{asignaciones}})})
};
const handler=crearHandlerInformes({cliente});
const stub=`<script>window.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:null}}),getSession:async()=>({data:{session:{access_token:'fixture-only'}}}),onAuthStateChange:()=>{},signOut:async()=>({})},from:()=>{const q={};for(const k of ['select','eq','order','limit','in'])q[k]=()=>q;q.then=(ok)=>Promise.resolve({data:[]}).then(ok);return q;},rpc:async()=>({data:{aportes:[],comentarios:[]}})})};</script>`;
let modo='ok';
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/api/bitacora-sesion'){res.setHeader('Content-Type','application/json');res.end('{"ok":true}');return;}
 if(pathname==='/api/admin-informes'){
  let raw='';for await(const x of req)raw+=x;req.body=JSON.parse(raw);
  if(modo==='json'){res.setHeader('Content-Type','text/html');res.end('<html>respuesta inválida</html>');return;}
  if(modo==='incompleto'){res.setHeader('Content-Type','application/json');res.end('{"ok":true}');return;}
  if(modo==='lento'){await new Promise(r=>setTimeout(r,150));}
  if([400,401,403,500,503].includes(modo)){res.writeHead(modo,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Error controlado HTTP '+modo}));return;}
  res.status=function(c){res.statusCode=c;return res;};res.json=function(d){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(d));return res;};await handler(req,res);return;
 }
 if(pathname==='/api/admin-asignaciones'){
  let raw='';for await(const x of req)raw+=x;const b=JSON.parse(raw);let r;
  if(b.action==='listar')r={ok:true,data:{usuarios,catalogo,asignaciones}};
  else if(b.action==='vista_recordatorio')r={ok:true,asignacion:asignaciones.find(a=>a.id===b.id),correo:null};
  else if(b.action==='eliminar'){const a=asignaciones.find(a=>a.id===b.id);a.vigente=false;r={ok:true,data:a};}
  else throw Error('Acción no prevista');res.setHeader('Content-Type','application/json');res.end(JSON.stringify(r));return;
 }
 const path=pathname==='/'?'/index.html':pathname;
 let content=await readFile(resolve('.')+path);if(path==='/index.html')content=Buffer.from(content.toString().replace(/<body[^>]*>/,m=>m+stub));
 res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[extname(path)]||'application/octet-stream');res.end(content);
 }catch(e){console.error(e.message);res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.QA_CHROMIUM_PATH?{executablePath:process.env.QA_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{})});
await mkdir('tmp/informes-qa',{recursive:true});
const tiempos=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('https://**/*',async r=>{if(r.request().url().includes('/html2pdf.js/0.10.1/'))return r.fulfill({body:await readFile(process.env.QA_PLAYWRIGHT_ROOT+'/node_modules/html2pdf.js/dist/html2pdf.bundle.min.js'),contentType:'application/javascript'});return r.abort();});
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForLoadState('domcontentloaded');
 await page.evaluate(()=>{usuarioActual={id:'admin',nombre:'Julio César',email:'jpintov@gmail.com',es_admin:true};document.getElementById('seccionLogin').classList.add('hidden');document.getElementById('seccionAdmin').classList.remove('hidden');});
 const dialog=page.locator('#dialogInformeEjecutivo'),estado=page.locator('#informeEjecutivoEstado');
 for(const tipo of ['asignaciones','avances','actividad']){
  const inicio=performance.now();await page.evaluate(t=>abrirInformeEjecutivo(t),tipo);await estado.filter({hasText:'Vista previa lista'}).waitFor();
  tiempos.push({tipo,vista_ms:Math.round(performance.now()-inicio)});assert.equal(await dialog.isVisible(),true);
  assert.equal(await page.locator('#informeEjecutivoContenido script').count(),0);
  if(tipo==='actividad'){assert.match(await page.locator('#informeEjecutivoContenido').textContent(),/1101/);assert.match(await page.locator('#informeEjecutivoContenido').textContent(),/25 sin actividad/);}
  const pdfInicio=performance.now(),descarga=page.waitForEvent('download');await page.locator('#btnDescargarInformeEjecutivo').click();const file=await descarga;
  assert.equal(file.suggestedFilename(),'informe-'+tipo+'-'+new Date().toISOString().slice(0,10)+'.pdf');await file.saveAs('tmp/informes-qa/'+tipo+'.pdf');tiempos.at(-1).pdf_ms=Math.round(performance.now()-pdfInicio);
  await page.locator('#btnCerrarInformeEjecutivo').click();assert.equal(await dialog.isVisible(),false);
  assert.equal(await page.locator('#adminSeccionResumen').isVisible(),true);
 }
 for(const fallo of [400,401,403,500,503,'json','incompleto']){
  modo=fallo;await page.evaluate(()=>abrirInformeEjecutivo('actividad'));assert.equal(await page.locator('#btnDescargarInformeEjecutivo').isDisabled(),true);assert.equal(await page.locator('#informeEjecutivoContenido').textContent(),'');assert.doesNotMatch(await estado.textContent(),/lista para descargar/);await page.locator('#btnCerrarInformeEjecutivo').click();
 }
 modo='lento';await page.evaluate(()=>{void abrirInformeEjecutivo('actividad');});await page.locator('#btnCerrarInformeEjecutivo').click();await page.waitForTimeout(200);assert.equal(await dialog.isVisible(),false);assert.equal(await page.locator('#informeEjecutivoContenido').textContent(),'');
 modo='ok';await page.setViewportSize({width:390,height:844});await page.evaluate(()=>abrirInformeEjecutivo('actividad'));
 assert.ok(await page.locator('#btnDescargarInformeEjecutivo').isVisible());assert.ok(await page.locator('#informeEjecutivoContenido').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'La vista previa cabe en móvil');assert.ok(await page.locator('.informe-tabla-scroll').first().evaluate(e=>e.scrollWidth>e.clientWidth),'La tabla ancha conserva desplazamiento propio');await page.screenshot({path:'tmp/informes-qa/modal-movil.png'});await page.locator('#btnCerrarInformeEjecutivo').click();
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>{cambiarSubseccionAdmin('asignaciones');});await page.locator('#asignacionesPadronBody tr').nth(25).waitFor();
 assert.equal(await page.locator('#asignacionesPadronBody tr').count(),26);assert.match(await page.locator('#asignacionesPadronConteo').textContent(),/1 con trabajo · 25 sin trabajo/);
 assert.equal(await page.locator('#asignacionesPadronBody script').count(),0);
 await page.getByRole('button',{name:'Asignar trabajo a Hermano 03',exact:true}).click();assert.equal(await page.locator('#asignacionUsuario').inputValue(),'u2');await page.locator('#btnCerrarOpcionesAsignacion').click();
 await page.getByRole('button',{name:'Editar INCI011A de Álvaro Pérez',exact:true}).click();assert.equal(await page.locator('#asignacionTema').inputValue(),'INCI011A');await page.locator('#btnCerrarOpcionesAsignacion').click();
 await page.getByRole('button',{name:'Eliminar asignación INCI011A de Álvaro Pérez',exact:true}).click();await page.waitForFunction(()=>!document.getElementById('dialogOpcionesAsignacion').open);assert.equal(asignaciones[0].vigente,false);
 assert.equal(await page.locator('#adminSeccionAsignaciones').isVisible(),true);
 await page.evaluate(()=>{cambiarSubseccionAdmin('usuarios');});await page.evaluate(padron=>{padronUsuariosAdmin=padron;renderizarPadronAdmin();},[...usuarios,administrador]);
 assert.equal(await page.locator('#tablaUsuariosAdminBody tr').count(),26);assert.equal(await page.locator('#tablaAdministradoresBody tr').count(),1);assert.doesNotMatch(await page.locator('#tablaUsuariosAdminBody').textContent(),/Julio César/);
 await page.screenshot({path:'tmp/informes-qa/padrones.png'});
 // Recorrido del rol delegado: error controlado, otorgamiento y revocación desde el padrón.
 let errorRol=true;const cambiosRol=[];
 await page.route('**/api/admin-roles',async route=>{const body=route.request().postDataJSON();cambiosRol.push(body);if(errorRol)return route.fulfill({status:500,json:{error:'Error controlado del servidor'}});await page.evaluate(b=>{const u=padronUsuariosAdmin.find(x=>x.id===b.id);u.rol=b.rol;u.es_admin=b.rol==='ADMIN';},body);return route.fulfill({json:{ok:true,usuario:{id:body.id,rol:body.rol}}});});
 await page.evaluate(()=>{cargarListadoUsuariosAdmin=async()=>renderizarPadronAdmin();});
 await page.getByRole('button',{name:'Hacer administrador',exact:true}).first().click();
 await page.locator('#cambioRolMotivo').fill('Responsable docente designado');await page.locator('#cambioRolGuardar').click();
 await page.locator('#cambioRolEstado').filter({hasText:'Error controlado'}).waitFor();assert.equal(await page.locator('#cambioRolDialogo').isVisible(),true);
 errorRol=false;await page.locator('#cambioRolGuardar').click();await page.waitForFunction(()=>!document.getElementById('cambioRolDialogo').open);
 assert.equal(await page.locator('#tablaAdministradoresBody tr').count(),2);assert.match(await page.locator('#tablaAdministradoresBody').textContent(),/Administrador/);
 await page.getByRole('button',{name:'Retirar rol',exact:true}).click();await page.locator('#cambioRolMotivo').fill('Fin de la responsabilidad');await page.locator('#cambioRolGuardar').click();await page.waitForFunction(()=>!document.getElementById('cambioRolDialogo').open);
 assert.equal(await page.locator('#tablaAdministradoresBody tr').count(),1);assert.equal(cambiosRol.at(-1).rol,'USER');assert.equal(cambiosRol.at(-1).rol_actual,'ADMIN');
 await page.evaluate(()=>{usuarioActual={id:'delegado',rol:'ADMIN',es_admin:true};renderizarPadronAdmin();});
 assert.equal(await page.getByRole('button',{name:'Hacer administrador',exact:true}).count(),0);
 await page.evaluate(()=>abrirCambioRol('u0','ADMIN'));assert.equal(await page.locator('#cambioRolDialogo').isVisible(),false);
 await page.evaluate(()=>{usuarioActual={id:'admin',es_admin:true,rol:'SUPERADMIN'};});

 await page.evaluate(()=>{usuarioActual={es_admin:true};registrarIngresoAuditoria=async()=>{};cargarDatosAdmin=async()=>{};reiniciarTemporizadorInactividad=()=>{};cargarMemoriaAgenteSesion=async()=>{};cambiarSubseccionAdmin=()=>{};configurarEntornoUsuario();});assert.equal(await page.locator('#btnCambiarMiClave').isVisible(),false);
 await page.evaluate(()=>{usuarioActual={id:'delegado',es_admin:true,rol:'ADMIN'};configurarEntornoUsuario();});assert.equal(await page.locator('#btnCambiarMiClave').isVisible(),true);assert.equal(await page.locator('#tabNavEditorDoctrina').isVisible(),false);assert.equal(await page.locator('.admin-perfil-btn').isVisible(),false);assert.equal(await page.locator('#adminConsolaTitulo').textContent(),'Consola Administrador');
 await page.evaluate(()=>{usuarioActual={es_admin:false};configurarEntornoUsuario();});assert.equal(await page.locator('#btnCambiarMiClave').isVisible(),true);
 assert.deepEqual(errors,[]);console.log('PASS HTTP/navegador: tres modales, tres PDF descargados, 4xx/5xx, JSON inválido, respuesta incompleta, cierre tardío, móvil, asignar/editar/eliminar y dos padrones.');console.log('TIEMPOS_QA '+JSON.stringify(tiempos));
}finally{await browser.close();await new Promise(r=>server.close(r));}
