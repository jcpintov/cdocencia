// Navegador -> HTTP -> extracción DOCX real -> borrador sintético -> IA simulada.
import {createServer} from 'node:http';import {readFile,mkdir} from 'node:fs/promises';import {resolve,extname} from 'node:path';import {createRequire} from 'node:module';import assert from 'node:assert/strict';
import {Document,Paragraph,Packer} from 'docx';import {gestionarNuevoTrabajo} from '../../server/nuevos-trabajos.js';
const {chromium}=createRequire(process.env.QA_PLAYWRIGHT_ROOT+'/package.json')('playwright');
const actor={id:'11111111-1111-4111-8111-111111111111',email:'admin@example.invalid'},mapa=new Map(),modulos=[];let publicaciones=0,generaciones=0,modo='ok';
const texto='La fraternidad exige escuchar con respeto, actuar con justicia y asumir la responsabilidad de nuestras decisiones. '.repeat(12);
const original=await Packer.toBuffer(new Document({sections:[{children:[new Paragraph('EL TRABAJO FRATERNAL'),new Paragraph(texto),new Paragraph('BIBLIOGRAFÍA'),new Paragraph('Autor. Editorial. 2020.')]}]}));
const admin={rpc:async(_fn,{p_accion:a,p_datos:d})=>{let b=mapa.get(d.id);if(a==='listar')return {data:{borradores:[...mapa.values()].filter(b=>b.estado==='borrador')}};
 if(a==='crear'){b={...d,actor:actor.id,revision:1,estado:'borrador'};mapa.set(b.id,b);return {data:{id:b.id,revision:1}};}
 if(!b)return {error:{code:'P0002',message:'No disponible'}};
 if(a==='obtener')return {data:structuredClone(b)};
 if(a==='guardar'){const diferente=b.texto!==d.texto;Object.assign(b,{ficha:d.ficha,texto:d.texto,preguntas:diferente?null:d.preguntas,preguntas_hash:diferente?null:d.preguntas_hash,revision:b.revision+1});}
 if(a==='finalizar_ia'&&d.preguntas)Object.assign(b,{preguntas:d.preguntas,preguntas_hash:d.preguntas_hash,revision:b.revision+1});
 if(a==='publicar'){if(b.estado!=='publicado'){publicaciones++;b.estado='publicado';modulos.push({id:b.id,numero_orden:b.ficha.numero_orden,titulo:b.ficha.titulo,autor:b.ficha.autor,unidad_codigo:b.ficha.codigo,contenido_trazado:b.texto,preguntas_json:b.preguntas,activo:true,archivo_pdf_base64:b.original.data_url});}return {data:{publicado:true,id:b.id}};}
 return {data:{id:b.id,revision:b.revision,reservado:true}};
}};
const generar=async()=>{generaciones++;if(modo==='ia_falla')throw Error('Fallo controlado de IA');return {preguntas:Array.from({length:8},(_,i)=>({enunciado:'¿Cómo aplicar la responsabilidad fraternal en la situación '+(i+1)+'?',opciones:['A','B','C','D'].map((letra,j)=>({letra,texto:'Alternativa '+j})),respuesta_correcta:'B',retroalimentacion:'El respeto y la responsabilidad orientan la conducta del maestro.',sustento:'La fraternidad exige escuchar con respeto, actuar con justicia'}))};};
const stub=`<script>window.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:null}}),getSession:async()=>({data:{session:{access_token:'fixture'}}}),onAuthStateChange:()=>{},signOut:async()=>({})},from:tabla=>{const q={};for(const m of ['select','eq','order','limit','neq','in'])q[m]=()=>q;q.then=ok=>(tabla==='modulos'?fetch('/fixture/modulos').then(r=>r.json()).then(data=>({data})):Promise.resolve({data:tabla==='unidades_docencia'?[{codigo:'INCI011A',detalle:'Tema fraternal'}]:[]})).then(ok);return q;}})};</script>`;
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/fixture/modulos'){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(modulos));return;}
 if(path==='/api/admin-trabajos'){
  let raw='';for await(const t of req)raw+=t;const b=JSON.parse(raw);
  if(modo==='json'){res.writeHead(500,{'Content-Type':'text/html'}).end('<html>Error</html>');return;}
  if(modo==='500'){res.writeHead(500,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Error controlado del servidor'}));return;}
  const r=await gestionarNuevoTrabajo(b,{admin,actor,generar});res.writeHead(r.status,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(r.body));return;
 }
 if(path.startsWith('/api/')){res.writeHead(200,{'Content-Type':'application/json'}).end('{"ok":true}');return;}
 let content=await readFile(resolve('.')+(path==='/'?'/index.html':path));if(path==='/')content=Buffer.from(content.toString().replace(/<body[^>]*>/,m=>m+stub));res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[extname(path)]||'application/octet-stream');if(path==='/')res.setHeader('Content-Type','text/html');res.end(content);
 }catch(e){console.error(e.message);res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,...(process.env.QA_CHROMIUM_PATH?{executablePath:process.env.QA_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.route('https://**/*',r=>r.abort());
 await page.goto('http://127.0.0.1:'+server.address().port);await page.evaluate(()=>{usuarioActual={id:'admin',es_admin:true};document.getElementById('seccionLogin').classList.add('hidden');document.getElementById('seccionAdmin').classList.remove('hidden');cambiarSubseccionAdmin('gestion_trabajos');});
 // El nombre interno de la subsección se obtiene del panel existente, sin depender de red real.
 await page.evaluate(()=>{document.getElementById('adminSeccionGestionTrabajos').classList.remove('hidden');});
 await page.getByRole('button',{name:'Subir trabajo nuevo',exact:true}).click();const dialog=page.locator('#dialogNuevoTrabajo');await dialog.waitFor();
 await page.locator('#nuevoTrabajoArchivo').setInputFiles({name:'fraternidad.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:original});await page.getByRole('button',{name:'Preparar original y texto',exact:true}).click();await page.locator('#nuevoTrabajoEdicion').waitFor();
 assert.equal(mapa.size,1);assert.equal(publicaciones,0);assert.equal(generaciones,0);assert.doesNotMatch(await page.locator('#nuevoTrabajoTexto').inputValue(),/BIBLIOGRAFÍA/);assert.match(await page.locator('#nuevoTrabajoSeparados').textContent(),/BIBLIOGRAFÍA/);
 await page.locator('#nuevoTrabajoTitulo').fill('La responsabilidad fraternal');await page.locator('#nuevoTrabajoAutor').fill('Juan Pérez');await page.locator('#nuevoTrabajoOrden').fill('7');await page.locator('#nuevoTrabajoCodigo').selectOption('INCI011A');
 await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.locator('#nuevoTrabajoEstado').filter({hasText:'Borrador guardado'}).waitFor();assert.equal(publicaciones,0);
 const pendiente=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar original intacto'}).click();const archivo=await pendiente;assert.deepEqual(await readFile(await archivo.path()),original);
 await page.getByRole('button',{name:'Generar las ocho preguntas'}).click();assert.match(await page.locator('#nuevoTrabajoEstado').textContent(),/autorización/);assert.equal(generaciones,0);
 await page.locator('#nuevoTrabajoAutorizarIA').check();modo='ia_falla';await page.getByRole('button',{name:'Generar las ocho preguntas'}).click();await page.locator('#nuevoTrabajoEstado').filter({hasText:'borrador se conserva'}).waitFor();assert.equal(mapa.size,1);assert.equal(publicaciones,0);
 modo='ok';await page.getByRole('button',{name:'Generar las ocho preguntas'}).click();await page.locator('.nuevo-trabajo-pregunta').nth(7).waitFor();assert.equal(await page.locator('.nuevo-trabajo-pregunta').count(),8);assert.match(await page.locator('.nuevo-trabajo-pregunta h3').last().textContent(),/Dilema ético/);
 await page.locator('#nuevoPregunta0enunciado').fill('¿Cómo se vincula la responsabilidad con una conducta fraternal?');await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.locator('#nuevoTrabajoEstado').filter({hasText:'Borrador guardado'}).waitFor();
 await page.locator('#btnCerrarNuevoTrabajo').click();await dialog.waitFor({state:'hidden'});await page.locator('.nuevos-trabajos-borradores summary').click();await page.getByRole('button',{name:'Continuar borrador · La responsabilidad fraternal'}).click();await page.locator('.nuevo-trabajo-pregunta').nth(7).waitFor();assert.match(await page.locator('#nuevoPregunta0enunciado').inputValue(),/vincula/);
 for(const width of [1440,390]){await page.setViewportSize({width,height:900});assert.ok(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1));}
 await mkdir('tmp/nuevos-trabajos-qa',{recursive:true});await page.screenshot({path:'tmp/nuevos-trabajos-qa/modal-movil.png'});
 await page.getByRole('button',{name:'Publicar trabajo revisado'}).click();assert.equal(publicaciones,0);assert.match(await page.locator('#nuevoTrabajoEstado').textContent(),/Confirme/);
 // Cambiar el texto invalida las ocho preguntas al guardar.
 await page.locator('#nuevoTrabajoTexto').fill(texto+'\nUna reflexión final adicional.');await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.locator('#nuevoTrabajoEstado').filter({hasText:'Borrador guardado'}).waitFor();assert.equal(await page.locator('.nuevo-trabajo-pregunta').count(),0);
 await page.locator('#nuevoTrabajoAutorizarIA').check();await page.getByRole('button',{name:'Generar las ocho preguntas'}).click();await page.locator('.nuevo-trabajo-pregunta').nth(7).waitFor();
 modo='json';await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.locator('#nuevoTrabajoEstado').filter({hasText:'respuesta válida'}).waitFor();assert.equal(await page.locator('.nuevo-trabajo-pregunta').count(),8);
 modo='500';await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.locator('#nuevoTrabajoEstado').filter({hasText:'Error controlado'}).waitFor();assert.equal(await page.locator('.nuevo-trabajo-pregunta').count(),8);
 modo='ok';await page.locator('#nuevoTrabajoRevisado').check();await page.getByRole('button',{name:'Publicar trabajo revisado'}).click();await dialog.waitFor({state:'hidden'});assert.equal(publicaciones,1);assert.equal(modulos[0].preguntas_json.preguntas.length,8);assert.equal(modulos[0].archivo_pdf_base64.split(',')[1],original.toString('base64'));await page.waitForFunction(()=>document.getElementById('selectModuloParaArchivo').options.length===1);assert.match(await page.locator('#estadoArchivoActual').textContent(),/original|asociado|archivo/i);
 await page.evaluate(()=>{limpiarNuevosTrabajos();usuarioActual=null;});assert.equal(await page.locator('#nuevoTrabajoExtraido').textContent(),'');assert.equal(await page.locator('#nuevoTrabajoTexto').inputValue(),'');assert.deepEqual(errors,[]);
 console.log('PASS navegador: DOCX real, limpieza revisable, borrador recuperable, original byte a byte, consentimiento IA, ocho preguntas editables, fallo IA/500, móvil, invalidación por texto, publicación explícita y limpieza de sesión.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
