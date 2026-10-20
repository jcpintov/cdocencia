import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {isIP} from 'node:net';
const raw=readFileSync(new URL('../api/bitacora-sesion.js',import.meta.url),'utf8');
const source=raw.replace(/^import .*;\n/gm,'').replace('export function ipServidor','function ipServidor').replace('export default async function handler','async function handler');
const sid='12345678-1234-4234-8234-123456789abc';
function setup({identity=true,saveError=null}={}){
 const calls=[];
 const ctx={isIP,process:{env:{VERCEL:'1',SUPABASE_URL:'url',SUPABASE_PUBLISHABLE_KEY:'key',SUPABASE_SERVICE_ROLE_KEY:'secret'}},
 createClient:(_url,key)=>key==='key'?{auth:{getUser:async()=>({data:identity?{user:{id:'real-actor'}}:null,error:null})}}:
 {rpc:async(name,args)=>{calls.push({name,args});return {data:{id:sid,cerrada:false},error:saveError};}}};
 runInNewContext(source,ctx);
 async function request(body,headers={authorization:'Bearer valid','x-vercel-forwarded-for':'203.0.113.5'},method='POST'){
  const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.code=s;return this;},json(x){this.body=x;return this;}};
  await ctx.handler({method,headers,body},res);return res;
 }
 return {ctx,calls,request};
}
test('IP solo proviene de encabezado Vercel válido',()=>{
 const {ctx}=setup();
 assert.equal(ctx.ipServidor({'x-vercel-forwarded-for':'2001:db8::1'},true),'2001:db8::1');
 assert.equal(ctx.ipServidor({'x-forwarded-for':'203.0.113.5, 10.0.0.1'},true),'203.0.113.5');
 assert.equal(ctx.ipServidor({'x-forwarded-for':'texto'},true),null);
 assert.equal(ctx.ipServidor({'x-forwarded-for':'203.0.113.5'},false),null);
});
test('identidad del token y no del cuerpo; IP suministrada ignorada',async()=>{
 const {calls,request}=setup();
 const r=await request({accion:'iniciar',sesion:sid,activo:false,p_actor:'ajeno',ip:'1.1.1.1'});
 assert.equal(r.code,200);assert.equal(r.headers['Cache-Control'],'no-store');
 assert.equal(calls[0].args.p_actor,'real-actor');assert.equal(calls[0].args.p_ip,'203.0.113.5');
});
test('rechaza anónimo y sesión vencida sin escribir',async()=>{
 const s=setup();assert.equal((await s.request({},{})).code,401);assert.equal(s.calls.length,0);
 const x=setup({identity:false});assert.equal((await x.request({accion:'iniciar',sesion:sid,activo:false})).code,401);
 assert.equal(x.calls.length,0);
});
test('valida acción, UUID, actividad y método',async()=>{
 for(const body of [{accion:'borrar',sesion:sid,activo:false},{accion:'iniciar',sesion:'ajeno',activo:false},{accion:'iniciar',sesion:sid,activo:30}]){
 const s=setup();assert.equal((await s.request(body)).code,422);assert.equal(s.calls.length,0);
 }
 assert.equal((await setup().request({},undefined,'GET')).code,405);
});
test('no informa éxito cuando base de datos rechaza',async()=>{
 const r=await setup({saveError:{code:'42501'}}).request({accion:'latido',sesion:sid,activo:true});
 assert.equal(r.code,403);assert.equal(r.body.ok,undefined);
});
const browser=readFileSync(new URL('../bitacora-sesion.js',import.meta.url),'utf8');
function navegador(failStart=false){
 let tick=()=>{},now=100000,n=0;
 const calls=[],events={},docEvents={};
 const doc={visibilityState:'visible',addEventListener:(e,fn)=>docEvents[e]=fn};
 const win={addEventListener:(e,fn)=>events[e]=fn};
 const ctx={window:win,document:doc,console:{warn(){}},crypto:{randomUUID:()=>sid},AbortSignal:{timeout:()=>undefined},
 Date:{now:()=>now},setInterval:fn=>{tick=fn;return 1;},clearInterval:()=>{},
 sbApp:{auth:{getSession:async()=>({data:{session:{access_token:'token'}}}),onAuthStateChange:()=>{}}},
 fetch:async(_url,opts)=>{const body=JSON.parse(opts.body);calls.push(body);const fail=failStart&&n++===0;return {ok:!fail,json:async()=>fail?{}:{ok:true,id:sid,cerrada:false}};}};
 runInNewContext(browser,ctx);
 return {win,doc,calls,events,docEvents,advance:ms=>{now+=ms;},tick:async()=>{tick();for(let i=0;i<20;i++)await Promise.resolve();}};
}
test('reintenta inicio con mismo UUID sin bloquear docencia',async()=>{
 const s=navegador(true);await s.win.iniciarBitacoraSesion();await s.tick();
 assert.equal(s.calls[0].accion,'iniciar');assert.equal(s.calls[1].accion,'iniciar');
 assert.equal(s.calls[0].sesion,s.calls[1].sesion);assert.equal(s.calls[2].accion,'latido');
});
test('pestaña oculta y falta de interacción no contabilizan actividad',async()=>{
 const s=navegador();await s.win.iniciarBitacoraSesion();s.advance(30000);await s.tick();
 assert.equal(s.calls.at(-1).activo,true);
 s.doc.visibilityState='hidden';await s.tick();assert.equal(s.calls.at(-1).activo,false);
 s.doc.visibilityState='visible';s.advance(90000);await s.tick();assert.equal(s.calls.at(-1).activo,false);
});
test('cierre usa token capturado y limpia seguimiento',async()=>{
 const s=navegador();await s.win.iniciarBitacoraSesion();s.win.cerrarBitacoraSesion();
 assert.equal(s.calls.at(-1).accion,'cerrar');const n=s.calls.length;await s.tick();assert.equal(s.calls.length,n);
});
