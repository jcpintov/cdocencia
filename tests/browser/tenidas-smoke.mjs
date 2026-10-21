import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(process.env.QA_PLAYWRIGHT_ROOT+'/package.json')('playwright');
const root=resolve('.'),rows=[];
let incierto=false,conflicto=false;
const stub='<script>window.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:null}}),getSession:async()=>({data:{session:{access_token:"fixture"}}}),onAuthStateChange:()=>{},signOut:async()=>({})}})};</script>';
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/api/admin-tenidas'){
  let raw='';for await(const x of req)raw+=x;const b=JSON.parse(raw);res.setHeader('Content-Type','application/json');
  if(b.action==='listar'){res.end(JSON.stringify({ok:true,trabajos:rows.filter(r=>r.activo&&r.fecha.startsWith(b.mes)),autores:['Q.·.H.·. Autor del padrón']}));return;}
  if(conflicto){res.writeHead(409).end(JSON.stringify({error:'El registro cambió en otra ventana.'}));return;}
  let r=rows.find(r=>r.id===b.id);
  if(b.action==='guardar'){
   if(!r){r={...b,version:1,activo:true};rows.push(r);}else if(r.version===b.version)Object.assign(r,b,{version:r.version+1});
   if(incierto){incierto=false;res.writeHead(503).end(JSON.stringify({error:'Confirmación interrumpida'}));return;}
   res.end(JSON.stringify({ok:true,trabajo:r}));return;
  }
  if(b.action==='eliminar'){r.activo=false;r.version++;res.end(JSON.stringify({ok:true}));return;}
 }
 const file=path==='/'?'/index.html':path;let content=await readFile(root+file);
 if(file==='/index.html')content=Buffer.from(content.toString().replace(/<body[^>]*>/,m=>m+stub));
 res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[extname(file)]||'application/octet-stream');res.end(content);
 }catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,...(process.env.QA_CHROMIUM_PATH?{executablePath:process.env.QA_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('https://**/*',r=>r.abort());await page.goto('http://127.0.0.1:'+server.address().port);
 await page.evaluate(()=>{usuarioActual={id:'admin',es_admin:true};document.getElementById('seccionLogin').classList.add('hidden');document.getElementById('seccionAdmin').classList.remove('hidden');cambiarSubseccionAdmin('tenidas');});
 await page.locator('#tenidasEstado').filter({hasText:'Calendario actualizado'}).waitFor();
 await page.locator('#tenidasMes').fill('2026-11');await page.locator('#tenidasMes').dispatchEvent('change');
 await page.locator('#tenidasTituloMes').filter({hasText:'noviembre'}).waitFor();
 assert.equal(await page.locator('.tenidas-numero').count(),30);
 await page.locator('#tenidasNuevo').click();
 assert.equal(await page.locator('#tenidasHora').inputValue(),'20:00');await page.locator('#tenidasHora').fill('19:30');
 await page.locator('#tenidasFecha').fill('2026-11-10');await page.locator('#tenidasGrado').selectOption('3');
 await page.locator('#tenidasTema').fill('La Acacia');await page.locator('#tenidasAutor').fill('Sergio Vera Norambuena');
 incierto=true;await page.locator('#tenidasGuardar').click();
 await page.locator('#tenidasFormularioEstado').filter({hasText:'Los datos del formulario se conservan'}).waitFor();
 assert.equal(await page.locator('#tenidasTema').inputValue(),'La Acacia');assert.equal(rows.length,1);
 await page.locator('#tenidasGuardar').click();await page.locator('#tenidasDialogo').waitFor({state:'hidden'});
 await page.locator('#tenidasLista').getByText('La Acacia',{exact:true}).waitFor();assert.equal(rows.length,1);
 await page.locator('#tenidasLista').getByRole('button',{name:'Modificar La Acacia',exact:true}).click();
 await page.locator('#tenidasGrado').selectOption('2');await page.locator('#tenidasTema').fill('Simbolismo del Compañero');
 conflicto=true;await page.locator('#tenidasGuardar').click();
 await page.locator('#tenidasFormularioEstado').filter({hasText:'otra ventana'}).waitFor();assert.equal(await page.locator('#tenidasTema').inputValue(),'Simbolismo del Compañero');
 conflicto=false;await page.locator('#tenidasGuardar').click();await page.locator('#tenidasDialogo').waitFor({state:'hidden'});
 await page.locator('#tenidasLista').getByText('Simbolismo del Compañero',{exact:true}).waitFor();
 assert.equal(rows[0].grado,2);assert.equal(rows[0].hora,'19:30');
 await page.locator('#tenidasGradoFiltro').selectOption('1');await page.locator('#tenidasLista').getByText('No hay trabajos registrados para esta selección.').waitFor();
 await page.locator('[data-dia="2026-11-10"]').click();
 assert.equal(await page.locator('#tenidasDialogo').isVisible(),true,'Día sin trabajos del grado filtrado permite agregar');
 assert.equal(await page.locator('#tenidasGrado').inputValue(),'1');
 await page.locator('#tenidasCancelar').click();
 await page.locator('#tenidasGradoFiltro').selectOption('todos');
 await page.locator('#tenidasAnterior').click();await page.locator('#tenidasTituloMes').filter({hasText:'octubre'}).waitFor();
 await page.locator('#tenidasSiguiente').click();await page.locator('#tenidasLista').getByText('Simbolismo del Compañero',{exact:true}).waitFor();
 if(process.env.QA_HILOS_CAPTURE)console.log('TENIDAS_ESCRITORIO:'+(await page.screenshot({type:'jpeg',quality:60})).toString('base64'));
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Calendario móvil sin desborde');
 await page.locator('[data-dia="2026-11-10"]').click();
 await page.locator('#tenidasLista').getByRole('button',{name:'Modificar Simbolismo del Compañero',exact:true}).click();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Formulario móvil sin desborde');
 if(process.env.QA_HILOS_CAPTURE)console.log('TENIDAS_MOVIL:'+(await page.screenshot({type:'jpeg',quality:60})).toString('base64'));
 await page.locator('#tenidasEliminar').click();await page.locator('#tenidasDialogo').waitFor({state:'hidden'});
 await page.locator('#tenidasLista').getByText('No hay trabajos registrados para esta selección.').waitFor();assert.equal(rows[0].activo,false);
 await page.locator('[data-dia="2026-11-20"]').click();assert.equal(await page.locator('#tenidasFecha').inputValue(),'2026-11-20');
 await page.locator('#tenidasCancelar').click();await page.evaluate(()=>cerrarSesion());
 assert.equal(await page.locator('#seccionLogin').isVisible(),true);assert.equal(await page.locator('#tenidasDialogo').evaluate(d=>d.open),false);
 assert.deepEqual(errors,[]);
 console.log('PASS calendario: mes, grados, tema, autor, alta idempotente, edición, conflicto, filtros, navegación, móvil, eliminación lógica y cierre de sesión.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
