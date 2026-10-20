// Prueba local aislada: no usa credenciales, Supabase ni SMTP reales.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(process.env.QA_PLAYWRIGHT_ROOT+'/package.json');
const {chromium}=require('playwright');
const root=resolve('.');
const fixture=JSON.parse(await readFile('tests/browser/catalogo-fixture.json','utf8'));
const user={id:'12345678-1234-4234-8234-123456789abc',nombre:'José Pérez',email:'jose@example.invalid'};
let assignments=[],rpcCalls=[],mailCount=0;
const makeContext=a=>({...a,nombre:user.nombre,email:user.email,tema:fixture.catalogo.find(t=>t.codigo===a.codigo).detalle,unidad:'UNIDAD 1: BASAMENTOS DOCTRINARIOS',subunidad:'1.1 CONCEPTOS FUNDAMENTALES DEL GRADO',correos:[],recordatorio:{estado:'sin_solicitud',programado_para:a.fecha_entrega+'T23:30:00-03:00',solicitud_enviada_en:null,publicado:false,trabajos_publicados:[],...a.recordatorio}});
const stub=`<script>window.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:null},error:null}),getSession:async()=>({data:{session:{access_token:'qa-no-secret'}}}),onAuthStateChange:()=>{},signOut:async()=>({})}})};</script>`;
const server=createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/api/admin-asignaciones'){
   let raw='';for await(const x of req)raw+=x;const b=JSON.parse(raw);rpcCalls.push(b);
   let result;
   if(b.action==='listar')result={ok:true,data:{usuarios:[user],catalogo:fixture.catalogo,asignaciones:assignments}};
   else if(b.action==='crear'){
    const a=makeContext({...b,id:'22345678-1234-4234-8234-123456789abc',version:1,vigente:true});assignments.push(a);result={ok:true,data:a};
   }else if(b.action==='modificar'){
    const i=assignments.findIndex(a=>a.id===b.id);assignments[i]=makeContext({...assignments[i],...b,version:b.version+1});result={ok:true,data:assignments[i]};
   }else if(b.action==='eliminar'){
    const a=assignments.find(a=>a.id===b.id);a.vigente=false;a.version++;result={ok:true,data:a};
   }else if(b.action==='vista_recordatorio'){
    const a=assignments.find(a=>a.id===b.id);const {generarCorreoRecordatorio}=await import('../../lib/correo-recordatorio.js');result={ok:true,asignacion:a,correo:a.recordatorio.solicitud_enviada_en?generarCorreoRecordatorio(a):null};
   }else if(b.action==='vista_correo'){
    const a=assignments.find(a=>a.id===b.id);const {generarCorreoAsignacion}=await import('../../lib/correo-asignacion.js');result={ok:true,correo:generarCorreoAsignacion(a),asignacion:a};
   }else{mailCount++;throw Error('Ningún envío está permitido en QA visual');}
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
  }
  const path=pathname==='/'?'/index.html':pathname;
  if(path.includes('..')){res.writeHead(400).end();return;}
  let content=await readFile(root+path);
  if(path==='/index.html')content=Buffer.from(content.toString().replace('<body oncontextmenu="return false;">','<body oncontextmenu="return false;">'+stub));
  res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[extname(path)]||'application/octet-stream');res.end(content);
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.route('https://**/*',r=>r.abort());
 await page.goto(url);await page.waitForLoadState('domcontentloaded');
 await page.evaluate(()=>{usuarioActual={id:'admin-fixture',es_admin:true};document.getElementById('seccionLogin').classList.add('hidden');document.getElementById('seccionAdmin').classList.remove('hidden');cambiarSubseccionAdmin('asignaciones');});
 await page.locator('#asignacionesEstado').filter({hasText:'Asignaciones actualizadas. Guardar o modificar nunca envía correos.'}).waitFor();
 await page.getByRole('button',{name:'Nueva asignación',exact:true}).click();
 assert.equal(await page.locator('#dialogOpcionesAsignacion').isVisible(),true);
 assert.equal(await page.locator('#asignacionTema option').count(),140);
 assert.match(await page.locator('#asignacionFecha').inputValue(),/^\d{4}-\d{2}-\d{2}$/);
 await page.getByLabel('Hermano',{exact:true}).selectOption(user.id);
 await page.getByLabel('Trabajo por preparar').selectOption('INCI011A');
 await page.getByLabel('Fecha de asignación',{exact:true}).fill('2026-10-20');
 await page.getByLabel('Fecha de asignación',{exact:true}).press('Tab');
 assert.equal(await page.locator('#asignacionEntrega').inputValue(),'2026-11-10');
 await page.getByRole('button',{name:'Asignar',exact:true}).click();
 await page.locator('#asignacionModalEstado').filter({hasText:'Asignación guardada. No se ha enviado ningún correo.'}).waitFor();
 assert.equal(assignments.length,1);assert.equal(mailCount,0);
 await page.getByRole('button',{name:'Limpiar selección / Nueva asignación'}).click();
 assert.equal(await page.locator('#asignacionTema option[value="INCI011A"]').isDisabled(),true);
 assert.match(await page.locator('#asignacionTema option[value="INCI011A"]').textContent(),/José Pérez/);
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await page.getByRole('button',{name:'Ver opciones de INCI011A de José Pérez'}).click();
 await page.getByLabel('Fecha de asignación',{exact:true}).fill('2026-10-21');await page.getByLabel('Fecha de asignación',{exact:true}).press('Tab');
 assert.equal(await page.locator('#asignacionEntrega').inputValue(),'2026-11-10');
 await page.getByRole('button',{name:'Correo',exact:true}).click();
 await page.locator('#asignacionModalEstado').filter({hasText:'Hay cambios sin guardar. Pulse Modificar antes de preparar el correo.'}).waitFor();
 assert.equal(await page.locator('#dialogCorreoAsignacion').isVisible(),false);
 assert.equal(await page.locator('#dialogOpcionesAsignacion').isVisible(),true);
 await page.getByRole('button',{name:'Modificar',exact:true}).click();await page.locator('#asignacionModalEstado').filter({hasText:'Asignación guardada. No se ha enviado ningún correo.'}).waitFor();
 assert.equal(assignments[0].fecha_asignacion,'2026-10-21');assert.equal(mailCount,0);
 await page.getByRole('button',{name:'Correo',exact:true}).click();
 await page.locator('#dialogCorreoAsignacion').waitFor();await page.frameLocator('#correoAsignacionVista').getByText('JOSÉ PÉREZ:',{exact:false}).waitFor();
 assert.equal(mailCount,0);assert.equal(rpcCalls.filter(c=>c.action==='enviar').length,0);
 await page.getByRole('button',{name:'Volver',exact:true}).click();
 assert.match(await page.locator('#dialogCorreoAsignacion').textContent(),/CCO: jpintov@gmail.com/);
 await page.getByLabel('Fecha de entrega comprometida · 23:30 h',{exact:true}).fill('2026-11-17');
 await page.getByRole('button',{name:'Modificar',exact:true}).click();await page.locator('#asignacionModalEstado').filter({hasText:'Asignación guardada. No se ha enviado ningún correo.'}).waitFor();
 assert.equal(assignments[0].fecha_entrega,'2026-11-17');
 assert.match(await page.locator('#asignacionRecordatorioEstado').textContent(),/falta un correo de solicitud/);
 // Simula un envío original confirmado; sigue sin utilizar SMTP.
 assignments[0].avisos_publicacion=[{id:'qa-aviso',estado:'enviado',finalizado_en:'2026-10-20T18:00:00Z',copia_estado:'aceptada'}];
 assignments[0].recordatorio={estado:'programado',programado_para:'2026-11-25T02:30:00Z',solicitud_enviada_en:'2026-10-20T17:00:00Z',publicado:false,trabajos_publicados:[]};
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await page.evaluate(()=>cargarCronogramaAdmin());
 await page.getByRole('button',{name:'Ver opciones de INCI011A de José Pérez'}).click();
 await page.locator('#asignacionRecordatorioDetalle summary').click();
 await page.locator('#asignacionRecordatorioPreviewEstado').filter({hasText:'Texto que utilizará'}).waitFor();
 await page.frameLocator('#asignacionRecordatorioVista').getByText('Si ya envió su trabajo, agradeceré hacer caso omiso de esta comunicación.',{exact:true}).waitFor();
 assert.match(await page.locator('#asignacionPublicacionAviso').textContent(),/Aviso de publicación enviado al autor/);
 const recordatorioTexto=await page.frameLocator('#asignacionRecordatorioVista').locator('body').textContent();assert.ok(!recordatorioTexto.includes('Chile'));assert.ok(recordatorioTexto.includes('20 de octubre de 2026'));
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});const layout=await page.locator('#dialogOpcionesAsignacion').evaluate(d=>({scroll:d.scrollWidth,client:d.clientWidth}));assert.ok(layout.scroll<=layout.client+1,'Modal sin recorte horizontal a '+width);
 }
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await page.evaluate(()=>{document.getElementById('adminSeccionAsignaciones').classList.add('hidden');document.getElementById('adminSeccionResumen').classList.remove('hidden');renderizarCronogramaAdmin();});
 assert.equal(await page.locator('#kpiTrabajosAsignados').textContent(),'1');assert.equal(await page.locator('#cronogramaLista li').count(),1);
 await page.getByRole('button',{name:'Abrir opciones de INCI011A de José Pérez'}).click();assert.equal(await page.locator('#dialogOpcionesAsignacion').isVisible(),true);
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await page.evaluate(()=>{document.getElementById('adminSeccionResumen').classList.add('hidden');document.getElementById('adminSeccionAsignaciones').classList.remove('hidden');});
 await page.getByRole('button',{name:'Ver opciones de INCI011A de José Pérez'}).click();
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Eliminar',exact:true}).click();
 await page.locator('#asignacionesEstado').filter({hasText:'Asignación anulada. Tema liberado; historial conservado.'}).waitFor();
 assert.equal(assignments[0].vigente,false);assert.equal(mailCount,0);
 await page.getByRole('button',{name:'Nueva asignación',exact:true}).click();
 assert.equal(await page.locator('#asignacionTema option[value="INCI011A"]').isDisabled(),false);
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 console.log('PASS interfaz: modal escritorio/móvil, fecha comprometida editable, CCO, recordatorio sin botón, cronograma KPI y vistas previas sin envío');
 await page.evaluate(data=>{
  document.getElementById('seccionAdmin').classList.add('hidden');
  document.getElementById('seccionContenidoDocente').classList.remove('hidden');
  renderizarDirectorioUnidadesDocencia(data.catalogo,[],data.objetivos);
 },fixture);
 for(const [width,height] of [[1440,900],[390,844]]){
  await page.setViewportSize({width,height});
  await page.getByRole('button',{name:'Mostrar todos los temas',exact:true}).click();
  assert.equal(await page.locator('.docencia-tarjeta-tema').count(),139);
  const ultimo=page.locator('.docencia-tarjeta-tema').last();await ultimo.scrollIntoViewIfNeeded();
  const box=await ultimo.boundingBox();assert.ok(box&&box.y>=0&&box.y+box.height<=height+1);
  const layout=await page.evaluate(()=>({ancho:document.documentElement.scrollWidth,ventana:innerWidth,scroll:getComputedStyle(document.body).overflowY}));
  assert.ok(layout.ancho<=width+1);assert.equal(layout.scroll,'auto');
  console.log('PASS catálogo '+width+'px: 139 temas y último tema íntegramente accesible');
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
