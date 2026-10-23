import test from 'node:test';
import assert from 'node:assert/strict';
import {crearHandlerInformes} from '../api/admin-informes.js';
import {leerPaginas,resumirAvances,resumirActividad} from '../lib/informes-ejecutivos.js';

const usuarios=[{id:'u1',nombre:'Ana',email:'ana@example.invalid'},{id:'u2',nombre:'José',email:'jose@example.invalid'},
 {id:'admin',nombre:'Admin',es_admin:true},{id:'baja',nombre:'Archivado',cuenta_eliminada:true}];
const modulos=[{id:'m1'},{id:'m2'}];
test('avance incluye usuarios sin progreso, deduplica y excluye módulos inactivos y administradores',()=>{
 const filas=resumirAvances(usuarios,modulos,[{usuario_id:'u1',modulo_id:'m1',completado:true},{usuario_id:'u1',modulo_id:'m1',leido:true},{usuario_id:'u1',modulo_id:'viejo',completado:true}]);
 assert.deepEqual(filas,[{nombre:'Ana',total:2,leidos:1,completados:1,pendientes:1,porcentaje:50},{nombre:'José',total:2,leidos:0,completados:0,pendientes:2,porcentaje:0}]);
});
test('actividad usa todo el historial y clasifica ausencia de registros sin inventar actividad',()=>{
 const r=resumirActividad(usuarios,[{usuario_id:'u1',creado_en:'2025-01-01T10:00:00Z'},{usuario_id:'u1',creado_en:'2026-10-20T10:00:00Z'},{usuario_id:'admin',creado_en:'2026-10-20T10:00:00Z'}]);
 assert.equal(r.con_actividad.length,1);assert.equal(r.con_actividad[0].ingresos,2);assert.equal(r.con_actividad[0].ultimo,'2026-10-20T10:00:00Z');assert.equal(r.sin_actividad[0].nombre,'José');
});
test('paginación recupera más de 1000 registros y rechaza una página fallida',async()=>{
 const filas=Array.from({length:1101},(_,id)=>({id}));let n=0;
 const crear=()=>({range:(a,b)=>({abortSignal:async()=>{n++;return {data:filas.slice(a,b+1)};}})});
 assert.equal((await leerPaginas(crear)).length,1101);assert.equal(n,3);
 await assert.rejects(leerPaginas(()=>({range:()=>({abortSignal:async()=>({error:{code:'42501'}})})})),/Lectura/);
 await assert.rejects(leerPaginas(()=>({range:()=>({abortSignal:async()=>({data:{}})})})),/inválida/);
});
function contexto({email='jpintov@gmail.com',perfil=true,rol,authError=false,fallo=false,lento=false,incompleto=false}={}){
 let llamadas=0;
 const tablas={usuarios,modulos,progreso_maestro:[],registro_accesos:[{usuario_id:'u1',creado_en:'2026-10-20T10:00:00Z'}]};
 const cliente=(_url,key)=>key==='key'?{auth:{getUser:async()=>lento?new Promise(()=>{}):({data:{user:{id:'auth-admin',email}},error:authError?{}:null})}}:{
  from(tabla){let solo=false,desde=0,hasta=499;const q={};
   for(const metodo of ['select','eq','order','lte'])q[metodo]=()=>q;
   q.maybeSingle=()=>{solo=true;return q;};q.range=(a,b)=>{desde=a;hasta=b;return q;};q.abortSignal=()=>q;
   q.then=(ok,bad)=>Promise.resolve().then(()=>{llamadas++;if(fallo&&!solo)return {error:{code:'internal',message:'DATOS PRIVADOS'}};return {data:solo?{email,es_admin:perfil,rol}:incompleto?null:tablas[tabla].slice(desde,hasta+1)};}).then(ok,bad);return q;
  },
  rpc(){return {abortSignal:async()=>({data:{asignaciones:[{vigente:true,usuario_id:'u1',nombre:'Ana',codigo:'INCI011A',tema:'Tema',fecha_asignacion:'2026-10-01',fecha_entrega:'2026-10-22'},{vigente:false,usuario_id:'u2'}]}})};}
 };
 const handler=crearHandlerInformes({cliente,plazoMs:25});
 async function request(body={tipo:'actividad'},headers={authorization:'Bearer prueba'},method='POST'){
  const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(d){this.body=d;return this;}};
  const inicio=performance.now();await handler({method,headers,body},res);res.ms=performance.now()-inicio;return res;
 }
 return {handler,request,llamadas:()=>llamadas};
}
// Entorno sintético sin credenciales; las funciones reciben un cliente aislado.
process.env.SUPABASE_URL='https://fixture.invalid';process.env.SUPABASE_PUBLISHABLE_KEY='key';process.env.SUPABASE_SERVICE_ROLE_KEY='secret-fixture';
test('servidor: 400,401,403,405,422 y rechazo sin lecturas indebidas',async()=>{
 const c=contexto();assert.equal((await c.request('{')).code,400);assert.equal((await c.request([])).code,400);
 assert.equal((await c.request({},{})).code,401);assert.equal((await c.request({tipo:'otro'})).code,422);
 assert.equal((await c.request({},undefined,'GET')).code,405);
 assert.equal(c.llamadas(),0);
 assert.equal((await contexto({email:'user@example.invalid'}).request()).code,403);
 assert.equal((await contexto({perfil:false}).request()).code,403);
 assert.equal((await contexto({authError:true}).request()).code,401);
});
test('tres informes: respuesta 200 válida, privada, sin correos ni ID de Auth y Server-Timing',async()=>{
 for(const tipo of ['asignaciones','avances','actividad']){
  const r=await contexto().request({tipo});assert.equal(r.code,200);assert.equal(r.body.tipo,tipo);assert.ok(r.body.generado_en);
  assert.equal(r.headers['Cache-Control'],'no-store');assert.match(r.headers['Server-Timing'],/^informe;dur=\d+/);
  assert.ok(r.ms<1000);assert.doesNotMatch(JSON.stringify(r.body),/secret-fixture|auth-admin|example.invalid/);
  if(tipo==='asignaciones')assert.equal(r.body.data.filas.length,1);
 }
});
test('fallos 5xx y respuestas incompletas nunca generan informe parcial',async()=>{
 for(const opciones of [{fallo:true},{incompleto:true}]){
  const r=await contexto(opciones).request();assert.equal(r.code,503);assert.equal(r.body.data,undefined);assert.doesNotMatch(JSON.stringify(r.body),/DATOS PRIVADOS/);
 }
});
test('tiempo máximo cubre servidor de identidad que no responde: devuelve 504 en plazo acotado',async()=>{
 const r=await contexto({lento:true}).request();assert.equal(r.code,504);assert.ok(r.ms>=20&&r.ms<1000,'Plazo medido: '+r.ms);
});

test('Administrador delegado puede obtener los tres informes',async()=>{for(const tipo of ['actividad','avances','asignaciones'])assert.equal((await contexto({email:'delegado@example.invalid',rol:'ADMIN'}).request({tipo})).code,200);});
