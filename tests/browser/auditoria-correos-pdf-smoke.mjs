import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
import {extractText} from 'unpdf';
const require=createRequire(process.env.QA_PLAYWRIGHT_ROOT+'/package.json');
const {chromium}=require('playwright');
const fecha='2026-11-13T03:33:19.616Z';
const historico=Array.from({length:13},(_,i)=>({
 id:'historic-'+i,creado_en:'2026-10-2'+(i%9)+'T14:00:00Z',
 remitente:'No registrado en origen',destinatarios:['maestro'+i+'@example.invalid'],
 cc:[],cco:[],asunto:'Solicitud de trabajo docente · código '+(i+1)+' · Asunto amplio para comprobar paginación',
 tipo:'asignacion',fuente:'docencia_asignaciones_correos',estado:'historico_enviado',
 message_id:'<historic-'+i+'@ofl.cl>',intento_id:'historic-'+i,origen_id:'asignacion-'+i,
 aceptados_smtp:[],rechazados_smtp:[],extracto:Array.from({length:10},(_,n)=>'Línea '+(n+1)+' del mensaje '+(i+1)+' para confirmar el detalle legible').join('\n')
}));
const nuevo={id:'test-audit',creado_en:fecha,remitente:'no-reply@ofl.cl',
 destinatarios:['fotos.jpintov@gmail.com','peritajes.jpintov@gmail.com'],cc:[],cco:[],
 asunto:'[PRUEBA] SMTP Cámara de Docencia',tipo:'prueba_smtp_dummy',
 fuente:'auditoria_correos',estado:'aceptado_smtp',message_id:'<test-verified@ofl.cl>',intento_id:null,origen_id:null,
 aceptados_smtp:['fotos.jpintov@gmail.com','peritajes.jpintov@gmail.com'],rechazados_smtp:[],extracto:null
};
const fixture=[nuevo,...historico];
const pageHtml=`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<script>var usuarioActual={es_admin:true,rol:'SUPERADMIN'};var sbApp={auth:{getSession:async()=>({data:{session:{access_token:'fixture-only'}}})}};</script>
<script src="/html2pdf.js"></script></head><body>
<div class="informes-ejecutivos-acciones"></div>
<script src="/auditoria-correos-admin.js"></script></body></html>`;
const server=createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/api/admin-auditoria-correos'){
   let json='';for await(const piece of req)json+=piece;
   assert.equal(req.method,'POST');assert.match(req.headers.authorization||'',/Bearer fixture-only/);
   res.setHeader('Content-Type','application/json');
   res.end(JSON.stringify({ok:true,filas:fixture,limitado:false,generado_en:fecha,total:fixture.length}));return;
  }
  if(path==='/'){res.setHeader('Content-Type','text/html');res.end(pageHtml);return;}
  const file=path==='/html2pdf.js'?
   process.env.QA_PLAYWRIGHT_ROOT+'/node_modules/html2pdf.js/dist/html2pdf.bundle.min.js':
   resolve('.')+path;
  const content=await readFile(file);
  res.setHeader('Content-Type',({'.js':'application/javascript','.css':'text/css','.ttf':'font/ttf'})[extname(file)]||'application/octet-stream');
  res.end(content);
 }catch(e){console.error(e);res.writeHead(404).end();}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const browser=await chromium.launch({headless:true,...(process.env.QA_CHROMIUM_PATH?{executablePath:process.env.QA_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{})});
await mkdir('tmp/auditoria-pdf-qa',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.locator('#btnAuditoriaCorreos').click();
 await page.locator('#auditoriaEstadoVista').filter({hasText:'14 registros mostrados'}).waitFor();
 assert.equal(await page.locator('#auditoriaTabla tbody tr').count(),14);
 assert.equal(await page.locator('#auditoriaFechaEmision').inputValue(),new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
 assert.ok(await page.locator('#auditoriaCorreosDialogo').evaluate(el=>Math.abs(el.getBoundingClientRect().left+el.getBoundingClientRect().width/2-innerWidth/2)<3),'Modal centrado');
 const download=page.waitForEvent('download',{timeout:60000});
 await page.locator('#auditoriaPdf').click();
 const archivo=await download;
 assert.match(archivo.suggestedFilename(),/^auditoria-correos-\d{4}-\d{2}-\d{2}\.pdf$/);
 const archivoPdf='tmp/auditoria-pdf-qa/auditoria.pdf';await archivo.saveAs(archivoPdf);
 const datos=await extractText(new Uint8Array(await readFile(archivoPdf)),{mergePages:false});
 assert.ok(datos.totalPages>=2&&datos.totalPages<=20,'Paginación PDF razonable');
 const paginas=datos.text;
 const texto=paginas.join(' ');
 assert.equal(paginas.length,datos.totalPages);
 for(const pagina of paginas){
  assert.match(pagina,/AUDITORÍA DE CORREOS/,'Membrete en todas las páginas');
  assert.match(pagina,/Documento privado/,'Pie en todas las páginas');
 }
 assert.match(texto,/REGISTRO 14/);
 assert.match(texto,/Remitente/);
 assert.match(texto,/Asunto/);
 assert.match(texto,/Estado SMTP/);
 assert.match(texto,/Línea 10 del mensaje 1/,'Incluye décima línea del cuerpo');
 assert.match(texto,/Línea 10 del mensaje 13/,'Incluye décima línea del último histórico');
 assert.match(texto,/Contenido no almacenado/,'No inventa el cuerpo para nueva auditoría');
 assert.match(texto,/Enviado según historial/,'Distingue historial SMTP');
 assert.match(texto,/test-verified@ofl.cl/,'Incluye identificador SMTP');
 assert.equal(errors.length,0,'Sin errores JS: '+errors.join(' | '));
 await page.setViewportSize({width:390,height:844});
 const dlg=page.locator('#auditoriaCorreosDialogo');
 assert.ok(await dlg.evaluate(el=>el.getBoundingClientRect().width<=innerWidth),'Modal cabe en móvil');
 console.log(JSON.stringify({ok:true,registros:fixture.length,paginas:datos.totalPages,pdf:archivoPdf}));
}finally{await browser.close();server.close();}
