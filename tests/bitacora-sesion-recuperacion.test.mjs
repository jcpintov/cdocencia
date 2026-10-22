import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const script=readFileSync(new URL('../bitacora-sesion.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sid='c75cd826-340d-49d5-a621-fc6ff0c235ab';
function escenario({rechazar=0,caducidad=null,segundaSesionInvalida=false}={}){
 let now=100000,intervalo=null,authHandler=null,refrescados=0;
 const requests=[],warnings=[];
 let access='token-inicial';
 const session=()=>({access_token:access,...(caducidad===null?{}:{expires_at:caducidad})});
 const win={addEventListener(){}};
 const doc={visibilityState:'visible',addEventListener(){}};
 const ctx={
  window:win,document:doc,
  console:{warn:v=>warnings.push(String(v))},
  Date:{now:()=>now},Promise,AbortSignal:{timeout:()=>undefined},
  crypto:{randomUUID:()=>sid},
  queueMicrotask:fn=>fn(),
  setInterval:fn=>{intervalo=fn;return 1;},
  clearInterval:()=>{intervalo=null;},
  sbApp:{auth:{
   getSession:async()=>({data:{session:segundaSesionInvalida?null:session()},error:null}),
   refreshSession:async()=>{
    refrescados++;access='token-renovado';
    authHandler?.('TOKEN_REFRESHED',session());
    return {data:{session:session()},error:null};
   },
   onAuthStateChange:fn=>{authHandler=fn;}
  }},
  fetch:async(url,options)=>{
   assert.equal(url,'/api/bitacora-sesion');
   const body=JSON.parse(options.body);
   requests.push({body,token:options.headers.Authorization,statusIndex:requests.length,keepalive:options.keepalive});
   const status=requests.length<=rechazar?401:200;
   return {status,ok:status===200,json:async()=>status===200?{ok:true,cerrada:false}:{error:'credencial vencida'}};
  }
 };
 runInNewContext(script,ctx);
 return {win,requests,warnings,
  get refreshes(){return refrescados},
  tick:async()=>{await intervalo?.();},
  close:async()=>await win.cerrarBitacoraSesion(),
  advance:ms=>{now+=ms;}
 };
}
test('bitácora renueva una credencial rechazada y conserva el mismo UUID de sesión',async()=>{
 const v=escenario({rechazar:1});
 await v.win.iniciarBitacoraSesion();
 assert.equal(v.requests.length,2);
 assert.deepEqual(v.requests.map(x=>x.body.accion),['iniciar','iniciar']);
 assert.equal(v.requests[0].body.sesion,v.requests[1].body.sesion);
 assert.deepEqual(v.requests.map(x=>x.token),['Bearer token-inicial','Bearer token-renovado']);
 assert.equal(v.refreshes,1);
 await v.tick();
 assert.equal(v.requests[2].body.accion,'latido');
 assert.equal(v.requests[2].token,'Bearer token-renovado');
 assert.ok(!v.warnings.some(x=>x.includes('seguimiento pausado')));
});
test('si el servidor rechaza dos tokens, la bitácora se pausa y evita tormentas de 401',async()=>{
 const v=escenario({rechazar:100});
 await v.win.iniciarBitacoraSesion();
 assert.equal(v.requests.length,2);
 assert.equal(v.refreshes,1);
 await v.tick();await v.tick();
 assert.equal(v.requests.length,2,'sin bucle de solicitudes rechazadas');
 assert.equal(v.warnings.filter(x=>x.includes('seguimiento pausado')).length,1);
});
test('un token próximo a vencer se refresca antes del primer POST',async()=>{
 const v=escenario({caducidad:110});
 await v.win.iniciarBitacoraSesion();
 assert.ok(v.refreshes>=1);
 assert.equal(v.requests[0].token,'Bearer token-renovado');
});
test('una pestaña sin sesión no envía solicitudes ni fabrica entradas',async()=>{
 const v=escenario({segundaSesionInvalida:true});
 await v.win.iniciarBitacoraSesion();
 assert.equal(v.requests.length,0);
});
test('cierre explícito envía el último token y un solo cierre',async()=>{
 const v=escenario();await v.win.iniciarBitacoraSesion();
 const resultado=await v.close();
 assert.equal(resultado,true);
 assert.equal(v.requests.at(-1).body.accion,'cerrar');
 assert.equal(v.requests.at(-1).keepalive,true);
 const n=v.requests.length;
 await v.close();assert.equal(v.requests.length,n);
});
test('signOut en la app espera el cierre acotado antes de revocar la sesión',()=>{
 const fn=app.slice(app.indexOf('function cerrarSesion() {'),app.indexOf('\n/* ==========================================================================',app.indexOf('function cerrarSesion() {')));
 assert.match(fn,/const cierreRegistrado=Promise\.resolve\(window\.cerrarBitacoraSesion\?\.\(\)\)/);
 assert.match(fn,/await Promise\.race\(\[\s*cierreRegistrado,/);
 assert.match(fn,/await sbApp\.auth\.signOut\(\)/);
 assert.doesNotMatch(fn,/void sbApp\.auth\.signOut\(\)\.catch/);
});
test('bitácora administrativa expone ingreso, IP, última actividad, cierre y duración',()=>{
 const block=html.slice(html.indexOf('id="adminSeccionAccesos"'),html.indexOf('<!-- MODAL: CONFIRMACIÓN',html.indexOf('id="adminSeccionAccesos"')));
 for(const col of ['IP de origen','Última actividad','Cierre de sesión','Tiempo activo estimado','Estado'])assert.ok(block.includes(col));
 assert.match(block,/id="bitacoraAdminEstado"/);
 assert.match(block,/colspan="8"/);
 const fn=app.slice(app.indexOf('async function cargarBitacoraAccesos('),app.indexOf('/* ==========================================================================\n   CÁMARA INTERACTIVA PRESENCIAL'));
 assert.match(fn,/r\.cerrado_en/);
 assert.match(fn,/cierreCell/);
 assert.match(fn,/r\.segundos_activos/);
 assert.match(fn,/filter\(r=>r\.ip_origen\)/);
 assert.match(fn,/r\.ultimo_latido_en/);
 assert.doesNotMatch(fn,/colspan="7"/);
});
