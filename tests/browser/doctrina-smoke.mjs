import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(process.env.QA_PLAYWRIGHT_ROOT+'/package.json')('playwright');
const root=resolve('.');let fail=false;
const doc={id:'documento',version_id:'11111111-1111-4111-8111-111111111111',titulo:'Principios de la Masonería',clase:'normativa',estado:'borrador',revision:'revision',bytes:400,nota_revision:''};
const stub='<script>window.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:null}}),getSession:async()=>({data:{session:{access_token:"fixture"}}}),onAuthStateChange:()=>{},signOut:async()=>({})}})};</script>';
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/api/admin-doctrina'){
  let raw='';for await(const x of req)raw+=x;const b=JSON.parse(raw);res.setHeader('Content-Type','application/json');
  if(b.action==='visualizar'){res.end(JSON.stringify({ok:true,url:'https://pwnnpjygnviyzyyvfxnq.supabase.co/storage/v1/object/sign/doctrina-originales-privados/fixture.pdf?token=fixture'}));return;}
  if(fail){res.writeHead(503).end(JSON.stringify({error:'Error de prueba'}));return;}
  if(b.action==='revisar')Object.assign(doc,{estado:b.decision==='aprobar'?'vigente':'borrador',revision:b.decision==='aprobar'?'listo':'revision',nota_revision:b.nota});
  if(b.action==='retirar')doc.estado='retirado';
  if(b.action==='restaurar'){doc.estado='borrador';doc.revision='revision';}
  res.end(JSON.stringify({ok:true,documentos:[doc],inventario:[]}));return;
 }
 const file=path==='/'?'/index.html':path;let content=await readFile(root+file);
 if(file==='/index.html')content=Buffer.from(content.toString().replace(/<body[^>]*>/,m=>m+stub));
 res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[extname(file)]||'application/octet-stream');res.end(content);
 }catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.route('https://**/*',r=>r.abort());await page.goto('http://127.0.0.1:'+server.address().port);
 await page.evaluate(()=>{usuarioActual={id:'admin',es_admin:true};document.getElementById('seccionLogin').classList.add('hidden');document.getElementById('seccionAdmin').classList.remove('hidden');cambiarSubseccionAdmin('doctrina');});
 await page.locator('#doctrinaEstado').filter({hasText:'1 originales'}).waitFor();
 await page.getByRole('button',{name:'Revisión',exact:true}).click();await page.locator('#doctrinaRevisionNota').fill('Original comprobado');fail=true;
 await page.getByRole('button',{name:'Aprobar como vigente'}).click();await page.locator('#doctrinaRevisionEstado').filter({hasText:'Error de prueba'}).waitFor();assert.equal(await page.locator('#doctrinaRevisionNota').inputValue(),'Original comprobado');fail=false;
 await page.getByRole('button',{name:'Aprobar como vigente'}).click();await page.locator('#doctrinaRevisionDialogo').waitFor({state:'hidden'});await page.locator('.doctrina-documento').filter({hasText:'vigente'}).waitFor();
 await page.getByRole('button',{name:'Eliminar',exact:true}).click();await page.locator('.doctrina-documento').waitFor({state:'hidden'});
 await page.getByLabel('Mostrar eliminados',{exact:true}).check();await page.getByRole('button',{name:'Restaurar',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Descargar original'}).count(),0);
 await page.getByRole('button',{name:'Restaurar',exact:true}).click();await page.getByRole('button',{name:'Revisión',exact:true}).waitFor();
 for(const viewport of [{width:1440,height:950},{width:390,height:844}]){
  await page.setViewportSize(viewport);await page.getByRole('button',{name:'Revisión',exact:true}).click();
  assert.ok(await page.locator('#doctrinaRevisionDialogo').isVisible());
  const colors=await page.locator('#adminSeccionDoctrina label').first().evaluate(e=>({fg:getComputedStyle(e).color,bg:getComputedStyle(e.closest('section')).backgroundColor}));
  const luminance=rgb=>rgb.match(/\d+/g).map(Number).map(v=>{const c=v/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
  const a=luminance(colors.fg),b=luminance(colors.bg);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,'Texto y fondo deben mantener contraste AA');
  assert.ok(await page.locator('#doctrinaRevisionDialogo').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 }
 await page.getByRole('button',{name:'Consultar original',exact:true}).click();
 await page.locator('#doctrinaVisorEstado').filter({hasText:'Original verificado'}).waitFor();
 await page.locator('#doctrinaVisorPagina').fill('3');await page.getByRole('button',{name:'Ir a página',exact:true}).click();
 assert.ok((await page.locator('#doctrinaVisorMarco').getAttribute('src')).endsWith('#page=3'));
 await page.getByRole('button',{name:'Cerrar consulta',exact:true}).click();assert.equal(await page.locator('#doctrinaVisorMarco').getAttribute('src'),null);
 assert.deepEqual(errors,[]);console.log('DOCTRINA: revisión, error con datos conservados, eliminación/restauración y contraste escritorio/móvil PASS');
}finally{await browser.close();await new Promise(r=>server.close(r));}
