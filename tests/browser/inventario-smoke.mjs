import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {generarCorreoInventario,htmlCorreoInventario} from '../../lib/correo-inventario.js';
const {chromium}=createRequire(process.env.QA_PLAYWRIGHT_ROOT+'/package.json')('playwright');
const index=await readFile('index.html','utf8'),script=await readFile('inventario-trabajos.js','utf8');
const dialog=index.slice(index.indexOf('<dialog id="inventarioDialog"'),index.indexOf('</dialog>',index.indexOf('<dialog id="inventarioDialog"'))+9);
const usuarios=[{id:'11111111-1111-4111-8111-111111111111',nombre:'Hermano Uno',email:'uno@example.invalid'},{id:'22222222-2222-4222-8222-222222222222',nombre:'Enzo de prueba',email:'excluido@example.invalid'}];
const trabajos=[{id:'m',titulo:'Trabajo sintético',autor:'Autor',fecha:'2026-10-25',fecha_entregada:true}];let enviados=0,ultimo;
const server=createServer(async(req,res)=>{
 res.setHeader('Content-Type',req.url==='/api/admin-trabajos'?'application/json':'text/html');
 if(req.url==='/api/admin-trabajos'){
  let raw='';for await(const x of req)raw+=x;const body=JSON.parse(raw);
  if(body.action==='inventario_preparar'){const destinatarios=usuarios.filter(u=>!body.excluir_ids.includes(u.id));ultimo={ok:true,id:body.id,destinatarios,excluidos:usuarios.filter(u=>body.excluir_ids.includes(u.id)),trabajos,correo:generarCorreoInventario(trabajos,destinatarios)};return res.end(JSON.stringify(ultimo));}
  if(body.action==='inventario_editar'){assert.equal(body.id,ultimo.id);ultimo.correo={...ultimo.correo,subject:body.asunto,text:body.texto,html:htmlCorreoInventario(body.texto)};return res.end(JSON.stringify(ultimo));}
  assert.equal(body.id,ultimo.id);assert.equal(body.confirmado,true);assert.deepEqual(ultimo.correo.bcc,['uno@example.invalid']);assert.match(ultimo.correo.text,/Edición revisada/);enviados++;return res.end(JSON.stringify({ok:true,aceptados:1,mensaje:'Correo aceptado por el servidor SMTP para todas las casillas.'}));
 }
 res.end('<!doctype html><meta charset="utf-8">'+dialog+'<script>let usuarioActual={id:"fixture",es_admin:true};const sbApp={auth:{getSession:async()=>({data:{session:{access_token:"fixture"}}})}};</script><script>'+script+'</script>');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto('http://127.0.0.1:'+server.address().port);await page.evaluate(()=>abrirInventarioTrabajos());await page.locator('#inventarioResumen').filter({hasText:'2 casillas'}).waitFor();
 const original=await page.locator('#inventarioTexto').inputValue();await page.locator('#inventarioAsunto').fill('Asunto ajustado');await page.locator('#inventarioTexto').fill(original+'\n\nEdición revisada');assert.equal(await page.locator('#inventarioEnviar').isDisabled(),true);
 await page.getByRole('button',{name:'Aplicar cambios a vista previa'}).click();await page.locator('#inventarioResumen').filter({hasText:'Asunto ajustado'}).waitFor();assert.match(await page.frameLocator('#inventarioVista').locator('body').textContent(),/Edición revisada/);
 await page.locator('details').click();await page.getByRole('checkbox',{name:'Excluir a Enzo de prueba'}).check();assert.equal(await page.locator('#inventarioEnviar').isDisabled(),true);
 await page.getByRole('button',{name:'Actualizar vista previa'}).click();await page.locator('#inventarioResumen').filter({hasText:'1 casillas'}).waitFor();assert.match(await page.locator('#inventarioResumen').textContent(),/Enzo de prueba/);
 assert.match(await page.frameLocator('#inventarioVista').locator('body').textContent(),/VV∴MM∴/);
 assert.match(await page.frameLocator('#inventarioVista').locator('body').textContent(),/Edición revisada/);assert.equal(await page.locator('#inventarioAsunto').inputValue(),'Asunto ajustado');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Enviar correo de inventario'}).click();await page.locator('#inventarioEstado').filter({hasText:'Casillas aceptadas: 1'}).waitFor();assert.equal(enviados,1);assert.equal(await page.locator('#inventarioEnviar').isDisabled(),true);
 await page.evaluate(()=>limpiarInventarioTrabajos());assert.equal(await page.locator('#inventarioDialog').isVisible(),false);assert.equal(await page.locator('#inventarioExclusiones input').count(),0);
 assert.equal(await page.locator('#inventarioTexto').inputValue(),'');assert.equal(await page.locator('#inventarioAsunto').inputValue(),'');
 console.log('PASS inventario: edición de asunto y cuerpo, vista previa, exclusión conserva edición, CCO, confirmación, envío único y limpieza de sesión; correo sintético sin SMTP real');
}finally{await browser.close();await new Promise(r=>server.close(r));}
