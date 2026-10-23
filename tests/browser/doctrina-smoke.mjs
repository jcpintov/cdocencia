import {prepararConsultaAgente,informeConsultaDoctrina} from '../../lib/agente-doctrina.js';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(process.env.QA_PLAYWRIGHT_ROOT+'/package.json')('playwright');
const casos=[];
const root=resolve('.');let fail=false,extraido=false,textoAprobado=false,groqAutorizado=false;
const paginas=[{numero:1,texto:'La Acacia representa la inmortalidad.',revisada:false,requiere_ocr:false},{numero:2,texto:'',revisada:false,requiere_ocr:true}];
const doc={id:'documento',version_id:'11111111-1111-4111-8111-111111111111',titulo:'Principios de la Masonería',clase:'normativa',estado:'borrador',revision:'revision',bytes:400,nota_revision:''};
const stub='<script>window.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:null}}),getSession:async()=>({data:{session:{access_token:"fixture"}}}),onAuthStateChange:()=>{},signOut:async()=>({})}})};</script>';
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/api/admin-perfil'){
  let raw='';for await(const x of req)raw+=x;const b=JSON.parse(raw);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(b.action==='pendiente'?{ok:true,pendiente:false}:b.action==='solicitar'?{ok:true,id:'fixture-cambio',mensaje:'Código enviado al correo actual'}:{ok:true,nombre:'Nombre Actualizado',email:'nuevo@example.invalid'}));return;
 }
 if(path==='/api/admin-doctrina'){
  let raw='';for await(const x of req)raw+=x;const b=JSON.parse(raw);res.setHeader('Content-Type','application/json');
  if(b.action==='visualizar'){res.end(JSON.stringify({ok:true,url:'https://pwnnpjygnviyzyyvfxnq.supabase.co/storage/v1/object/sign/doctrina-originales-privados/fixture.pdf?token=fixture'}));return;}
  if(fail){res.writeHead(503).end(JSON.stringify({error:'Error de prueba'}));return;}
  if(b.action==='llm_listar'){res.end(JSON.stringify({ok:true,autorizaciones:[{version_id:doc.version_id,titulo:doc.titulo,version:1,autorizado:groqAutorizado,texto_aprobado:textoAprobado}]}));return;}
  if(b.action==='llm_autorizar'||b.action==='llm_revocar'){groqAutorizado=b.action==='llm_autorizar';res.end(JSON.stringify({ok:true}));return;}
  if(b.action==='casos_listar'){const filas=casos.filter(c=>b.estado==='todos'||c.estado===b.estado);res.end(JSON.stringify({ok:true,conversaciones:filas,total:filas.length,hay_mas:false}));return;}
  if(b.action==='memoria_exportar'){res.end(JSON.stringify({ok:true,memoria:{schema_version:1,casos:casos.filter(c=>c.estado==='revisado')}}));return;}
  if(b.action==='memoria_sesion'){res.end(JSON.stringify({ok:true,memoria:{schema_version:1,criterios:[],casos:casos.filter(c=>c.estado==='revisado')}}));return;}
  if(b.action==='caso_aprobar'||b.action==='caso_retirar'){casos.find(c=>c.id===b.id).estado=b.action==='caso_aprobar'?'revisado':'retirado';res.end(JSON.stringify({ok:true}));return;}
  if(b.action==='agente_consultar'){const respuesta='La acacia representa la inmortalidad [F1].',id='00000000-0000-4000-8000-'+String(casos.length+1).padStart(12,'0');casos.push({id,pregunta:b.pregunta,respuesta,estado:'candidato',creado_en:new Date().toISOString(),fuentes:[{version_id:doc.version_id,sha256:'a'.repeat(64),pagina:1}],conversacion:[...(b.conversacion||[]),{role:'user',content:b.pregunta},{role:'assistant',content:respuesta}]});res.end(JSON.stringify({ok:true,informe:{generativo:true,caso_memoria_id:id,secciones:[{titulo:'Respuesta',texto:respuesta}],fuentes:[{referencia:'F1',titulo:doc.titulo,clase:doc.clase,version_id:doc.version_id,pagina:1,fragmento:paginas[0].texto}]}}));return;}

  if(b.action.startsWith('texto_')){
   if(b.action==='texto_buscar'){res.end(JSON.stringify({ok:true,resultados:textoAprobado?[{titulo:doc.titulo,version_id:doc.version_id,version:1,pagina:1,fragmento:paginas[0].texto}]:[]}));return;}
   if(b.action==='texto_extraer')extraido=true;
   if(b.action==='texto_revisar_pagina')Object.assign(paginas[b.pagina-1],{texto:b.texto,revisada:true,requiere_ocr:false,pagina_sin_texto:b.pagina_sin_texto});
   if(b.action==='texto_aprobar'){if(paginas.some(p=>!p.revisada)){res.writeHead(409).end(JSON.stringify({error:'Hay páginas pendientes de revisión'}));return;}textoAprobado=true;}
   res.end(JSON.stringify({ok:true,extraido,estado:textoAprobado?'aprobado':'revision',total_paginas:2,pendientes:paginas.filter(p=>!p.revisada).length,pagina:paginas[(b.pagina||1)-1]}));return;
  }
  if(b.action==='revisar')Object.assign(doc,{estado:b.decision==='aprobar'?'vigente':'borrador',revision:b.decision==='aprobar'?'listo':'revision',nota_revision:b.nota});
  if(b.action==='retirar')doc.estado='retirado';
  if(b.action==='restaurar'){doc.estado='borrador';doc.revision='revision';}
  res.end(JSON.stringify({ok:true,documentos:[doc],inventario:[]}));return;
 }
 const file=path==='/'?'/index.html':path;let content=await readFile(root+file);
 if(file==='/index.html')content=Buffer.from(content.toString().replace(/<body[^>]*>/,m=>m+stub));
 res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[extname(file)]||'application/octet-stream');res.end(content);
 }catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,...(process.env.QA_CHROMIUM_PATH?{executablePath:process.env.QA_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.route('https://**/*',r=>r.abort());await page.goto('http://127.0.0.1:'+server.address().port);
 await page.evaluate(()=>{usuarioActual={id:'admin',es_admin:true};document.getElementById('seccionLogin').classList.add('hidden');document.getElementById('seccionAdmin').classList.remove('hidden');cambiarSubseccionAdmin('doctrina');});
 await page.locator('#doctrinaBibliotecaPanel > summary').click();await page.locator('#doctrinaEstado').filter({hasText:'1 originales'}).waitFor();
 // Una biblioteca amplia no debe repetir identificadores ni dejar selectores anónimos.
 const etiquetaChequeo=await page.evaluate(()=>{
  const actual=bibliotecaDoctrina;
  try{
   bibliotecaDoctrina={...actual,documentos:Array.from({length:36},(_,i)=>({
    ...actual.documentos[0],
    id:'documento-qa-'+i,
    version_id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),
    titulo:'Original de prueba '+(i+1)
   }))};
   renderizarBibliotecaDoctrina();
   const selects=[...document.querySelectorAll('#doctrinaDocumentos .doctrina-clasificacion select')];
   const todos=selects.every(sel=>sel.id&&sel.name&&sel.labels?.length===1&&sel.labels[0].control===sel);
   return {cantidad:selects.length,unicos:new Set(selects.map(sel=>sel.id)).size,
    nombresUnicos:new Set(selects.map(sel=>sel.name)).size,todos};
  }finally{bibliotecaDoctrina=actual;renderizarBibliotecaDoctrina();}
 });
 assert.deepEqual(etiquetaChequeo,{cantidad:36,unicos:36,nombresUnicos:36,todos:true});
 assert.ok(await page.locator('#doctrinaBibliotecaPanel #doctrinaActualizar').count());
 assert.equal(await page.locator('.doctrina-cabecera #doctrinaActualizar').count(),0);
 await page.getByRole('button',{name:'Revisión',exact:true}).click();await page.locator('#doctrinaRevisionNota').fill('Original comprobado');fail=true;
 await page.getByRole('button',{name:'Aprobar como vigente'}).click();await page.locator('#doctrinaRevisionEstado').filter({hasText:'Error de prueba'}).waitFor();assert.equal(await page.locator('#doctrinaRevisionNota').inputValue(),'Original comprobado');fail=false;
 await page.getByRole('button',{name:'Aprobar como vigente'}).click();await page.locator('#doctrinaRevisionDialogo').waitFor({state:'hidden'});await page.locator('.doctrina-documento').filter({hasText:'vigente'}).waitFor();
 const tarjeta=page.locator('#doctrinaDocumentos .doctrina-tarjeta');
 assert.equal(await tarjeta.evaluate(e=>getComputedStyle(e).borderLeftColor),'rgb(51, 130, 87)');
 assert.equal(new Set(await tarjeta.locator('.doctrina-acciones button').evaluateAll(bs=>bs.map(b=>b.getBoundingClientRect().top))).size,1);
 await page.getByRole('button',{name:'Eliminar',exact:true}).click();await page.locator('.doctrina-documento').waitFor({state:'hidden'});
 await page.getByLabel('Mostrar eliminados',{exact:true}).check();await page.getByRole('button',{name:'Restaurar',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Descargar original'}).count(),0);
 await page.getByRole('button',{name:'Restaurar',exact:true}).click();await page.getByRole('button',{name:'Revisión',exact:true}).waitFor();
 for(const viewport of [{width:1440,height:950},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  const conversacionLayout=await page.locator('.doctrina-chat').evaluate(chat=>{
   const form=chat.querySelector('#doctrinaAgenteFormulario');
   const c=chat.getBoundingClientRect(),f=form.getBoundingClientRect();
   const border=parseFloat(getComputedStyle(form).borderLeftWidth);
   return {dentro:f.left>=c.left-1&&f.right<=c.right+1,
     bordeSimple:border===0,
     sinDesborde:chat.scrollWidth<=chat.clientWidth+2};
  });
  assert.ok(conversacionLayout.dentro&&conversacionLayout.bordeSimple&&conversacionLayout.sinDesborde,
   'Compositor no debe desbordar ni dibujar doble borde en '+viewport.width+'px: '+JSON.stringify(conversacionLayout));
  await page.getByRole('button',{name:'Revisión',exact:true}).click();
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
 await page.getByRole('button',{name:'Revisión',exact:true}).click();await page.getByRole('button',{name:'Aprobar como vigente',exact:true}).click();await page.locator('#doctrinaRevisionDialogo').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Texto por páginas',exact:true}).click();await page.locator('#doctrinaTextoEstado').filter({hasText:'Aún no hay texto'}).waitFor();
 await page.getByRole('button',{name:'Extraer texto',exact:true}).click();await page.locator('#doctrinaTextoEstado').filter({hasText:'2 pendientes'}).waitFor();
 await page.getByRole('button',{name:'Aprobar extracción revisada',exact:true}).click();await page.locator('#doctrinaTextoEstado').filter({hasText:'Hay páginas pendientes'}).waitFor();
 await page.getByRole('button',{name:'Guardar página revisada',exact:true}).click();await page.locator('#doctrinaTextoEstado').filter({hasText:'1 pendientes'}).waitFor();
 await page.getByRole('button',{name:'Contrastar página con PDF',exact:true}).click();await page.locator('#doctrinaVisorEstado').filter({hasText:'Original verificado'}).waitFor();assert.ok((await page.locator('#doctrinaVisorMarco').getAttribute('src')).endsWith('#page=1'));await page.getByRole('button',{name:'Cerrar consulta',exact:true}).click();
 await page.locator('#doctrinaTextoPagina').fill('2');await page.getByRole('button',{name:'Cargar página',exact:true}).click();await page.locator('#doctrinaTextoEstado').filter({hasText:'poco o ningún texto'}).waitFor();
 await page.locator('#doctrinaTextoSinTexto').check();await page.getByRole('button',{name:'Guardar página revisada',exact:true}).click();await page.locator('#doctrinaTextoEstado').filter({hasText:'0 pendientes'}).waitFor();
 await page.getByRole('button',{name:'Aprobar extracción revisada',exact:true}).click();await page.locator('#doctrinaTextoEstado').filter({hasText:'aprobado'}).waitFor();assert.ok(await page.locator('#doctrinaTextoDialogo').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
 await page.getByRole('button',{name:'Cerrar texto',exact:true}).click();await page.locator('#doctrinaIndexacionPanel > summary').click();await page.locator('#doctrinaConsultaTexto').fill('acacia');await page.getByRole('button',{name:'Buscar con referencias',exact:true}).click();await page.locator('#doctrinaBusquedaResultados').filter({hasText:'página 1'}).waitFor();
 for(const viewport of [{width:1440,height:950},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  const previos=await page.locator('#doctrinaConversacion .doctrina-mensaje-asistente').count();
  await page.locator('#doctrinaAgentePregunta').fill('¿Qué representa la acacia?');
  await page.locator('#doctrinaAgenteConsultar').click();
  const respuestaActual=page.locator('#doctrinaConversacion .doctrina-mensaje-asistente').nth(previos);
  await respuestaActual.filter({hasText:'La acacia'}).waitFor();
  assert.match(await respuestaActual.innerText(),/F1/);
  assert.ok(await page.locator('#doctrinaAgenteFormulario').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  await respuestaActual.locator('summary').click();await respuestaActual.getByRole('button',{name:'Ver fuente',exact:true}).click();await page.locator('#doctrinaVisorEstado').filter({hasText:'Original verificado'}).waitFor();assert.ok((await page.locator('#doctrinaVisorMarco').getAttribute('src')).endsWith('#page=1'));await page.getByRole('button',{name:'Cerrar consulta',exact:true}).click();
 }
 assert.equal(await page.getByText('Tu consulta',{exact:true}).count(),0);
 await page.locator('#doctrinaConversacionesPanel > summary').click();await page.locator('#doctrinaCasosEstado').filter({hasText:'2 de 2'}).waitFor();
 await page.locator('#doctrinaCasosLista > details').last().locator('summary').click();await page.locator('#doctrinaCasosLista').getByRole('button',{name:'Aprobar para el JSON',exact:true}).last().click();await page.locator('#doctrinaCasosLista summary').filter({hasText:'Aprobada'}).waitFor();
 const descarga=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar JSON aprobado',exact:true}).click();const archivo=await descarga;const memoria=JSON.parse(await readFile(await archivo.path(),'utf8'));assert.equal(memoria.casos.length,1);assert.equal(memoria.casos[0].conversacion.length,4);
 await page.locator('#doctrinaCasosLista > details').last().locator('summary').click();assert.ok(await page.locator('#doctrinaCasosLista').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await page.screenshot({path:'tmp/informes-qa/conversaciones-movil.png'});
 await page.locator('#doctrinaCasosLista').getByRole('button',{name:'Retirar del JSON',exact:true}).click();await page.locator('#doctrinaCasosLista').getByText(/^Retirada/).waitFor();assert.equal(casos.filter(c=>c.estado==='revisado').length,0);
 await page.getByText('Autorizaciones documentales para Groq',{exact:true}).click();await page.getByRole('button',{name:'Revisar autorizaciones',exact:true}).click();await page.getByRole('button',{name:'Autorizar fragmentos',exact:true}).click();await page.getByRole('button',{name:'Revocar permiso',exact:true}).waitFor();assert.match(await page.locator('#doctrinaGroqPermisos').innerText(),/Autorizado para Groq/);await page.getByRole('button',{name:'Revocar permiso',exact:true}).click();await page.getByRole('button',{name:'Autorizar fragmentos',exact:true}).waitFor();
 await page.setViewportSize({width:1440,height:950});
 const footer=await page.locator('#seccionAdmin .admin-side-footer').evaluate(el=>{
  const perfil=el.querySelector('.admin-perfil-btn'),salida=el.querySelector('.admin-logout');
  const pb=perfil.getBoundingClientRect(),sb=salida.getBoundingClientRect();
  const cs=getComputedStyle(perfil);
  const rgb=v=>v.match(/\d+/g).slice(0,3).map(Number).map(x=>x/255);
  const luminance=v=>rgb(v).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
  const a=luminance(cs.color),b=luminance(cs.backgroundColor);
  return {sameWidth:Math.abs(pb.width-sb.width)<1,left:Math.abs(pb.left-sb.left)<1,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),within:pb.right<=el.getBoundingClientRect().right+1};
 });
 assert.ok(footer.sameWidth&&footer.left&&footer.contrast>=4.5&&footer.within,'Acciones de cuenta legibles y alineadas: '+JSON.stringify(footer));
 const gap=await page.locator('#seccionAdmin .admin-links-bottom').evaluate(el=>({
  label:el.querySelector('.admin-menu-label')?.textContent?.trim(),
  separated:getComputedStyle(el).borderTopWidth!=='0px'
 }));
 assert.equal(gap.label,'Herramientas externas');assert.ok(gap.separated);
 await page.getByRole('button',{name:'Mi perfil',exact:true}).click();await page.locator('#perfilSuperadminSolicitar').waitFor({state:'visible'});
 await page.locator('#perfilSuperadminNombre').fill('Nombre Actualizado');await page.locator('#perfilSuperadminEmail').fill('nuevo@example.invalid');await page.locator('#perfilSuperadminSolicitar').click();await page.locator('#perfilSuperadminEstado').filter({hasText:'Código enviado'}).waitFor();assert.equal(await page.locator('#perfilSuperadminEmail').isDisabled(),true);
 await page.locator('#perfilSuperadminCodigo').fill('12345678');await page.locator('#perfilSuperadminConfirmar').click();await page.locator('#perfilSuperadminEstado').filter({hasText:'Perfil actualizado'}).waitFor();
 await page.setViewportSize({width:390,height:844});assert.ok(await page.locator('#perfilSuperadminDialogo').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await page.locator('#perfilSuperadminCerrar').click();assert.equal(await page.locator('#perfilSuperadminCodigo').inputValue(),'');
 await page.evaluate(()=>abrirModalCrearUsuario());assert.equal(await page.locator('#adminUsuarioEmail').inputValue(),'');await page.locator('#modalAdminUsuario').getByRole('button',{name:'Cancelar',exact:true}).click();
 assert.deepEqual(errors,[]);console.log('PASS DOCTRINA y perfil: extracción por página, contraste PDF, páginas vacías verificadas, aprobación, búsqueda citada, OTP, limpieza, alta de usuario vacía y escritorio/móvil');
}finally{await browser.close();await new Promise(r=>server.close(r));}
