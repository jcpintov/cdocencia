const permisosSource=readFileSync(new URL('../lib/roles-admin.js',import.meta.url),'utf8').replace(/^export /gm,'');
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
import {createHash} from 'node:crypto';
import * as helpers from '../lib/trabajos-tenida.js';
const actor='11111111-1111-4111-8111-111111111111';
const source=readFileSync(new URL('../api/admin-orador.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace('export default async function handler','async function handler');
function entorno(o={}){
 const llamadas=[];let enviado=false;
 const datos={ficha:{tema:'La escucha fraterna',grado:1},extraccion:{bloques:[{numero:1,texto:'Texto del trabajo con una reflexión suficientemente extensa.'}],texto:'Texto reservado'},revision_bloques:[]};
 const w={id:actor,revision:1,bloqueo:actor,datos};
 const rpc=async(_name,a)=>{llamadas.push(a.p_accion);if(a.p_accion==='iniciar'&&o.stale)return {error:{code:'40001'}};return {data:a.p_accion==='listar'?{trabajos:[]}:a.p_accion==='guardar'?{...w,datos:a.p_datos.datos,revision:2}:w};};
 const admin={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{rol:o.rol,es_admin:!o.noAdmin,email:o.other?'other@example.invalid':o.rol==='ADMIN'?'delegado@example.invalid':'jpintov@gmail.com'}})})})}),rpc,storage:{getBucket:async()=>({data:{public:!!o.publicBucket}}),from:()=>({createSignedUploadUrl:async()=>({data:{token:'fixture'}})})}};
 const cliente={auth:{getUser:async()=>({data:{user:{id:actor,email:o.other?'other@example.invalid':o.rol==='ADMIN'?'delegado@example.invalid':'jpintov@gmail.com'}},error:o.invalid?{}:null})}};
 const ctx=createContext({...helpers,createClient:(_u,k)=>k==='secret'?admin:cliente,process:{env:{SUPABASE_URL:'https://fixture.invalid',SUPABASE_PUBLISHABLE_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'secret'}},randomUUID:()=>actor,createHash,Buffer,structuredClone,prepararConsultaAgente:()=>{},consultarGroqDoctrina:async()=>{enviado=true;}});
 const handler=new Script(permisosSource+source+'\nhandler').runInContext(ctx);
 const request=async(body,authorization='Bearer fixture')=>{const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(v){this.body=v;return this;}};await handler({method:'POST',headers:{authorization},body},res);return res;};
 return {request,llamadas,get enviado(){return enviado;}};
}
test('orador deniega acceso sin sesión, con sesión inválida o identidad ajena antes de RPC',async()=>{
 for(const [o,token,code]of [[{},'',401],[{invalid:true},'Bearer fixture',401],[{noAdmin:true},'Bearer fixture',403],[{other:true},'Bearer fixture',403]]){const s=entorno(o);assert.equal((await s.request({action:'listar'},token)).code,code);assert.equal(s.llamadas.length,0);}
});
test('el cliente no puede inyectar extracción, informe ni oratoria mediante acciones no admitidas',async()=>{
 const s=entorno();for(const action of ['guardar','iniciar','texto_guardar'])assert.equal((await s.request({action,id:actor,datos:{oratoria:'inventada'}})).code,422);assert.equal(s.llamadas.length,0);
});
test('rechaza generar sin revisión y decisión humana, libera bloqueo sin llamar al modelo',async()=>{
 const s=entorno();const r=await s.request({action:'generar',id:actor,revision:1});assert.equal(r.code,422);assert.match(r.body.error,/Revise el informe/);assert.equal(s.enviado,false);assert.deepEqual(s.llamadas,['obtener','iniciar','liberar']);
});
test('rechaza revisión concurrente sin sobrescribir progreso',async()=>{
 const s=entorno({stale:true});const r=await s.request({action:'revisar',id:actor,revision:1});assert.equal(r.code,422);assert.deepEqual(s.llamadas,['obtener','iniciar']);
});
test('no devuelve texto completo ni bloques privados al listar un trabajo para pantalla',async()=>{
 const s=entorno();const r=await s.request({action:'obtener',id:actor});assert.equal(r.code,200);assert.ok(!JSON.stringify(r.body).includes('Texto reservado'));assert.equal(r.body.trabajo.bloques_total,1);assert.equal(r.headers['Cache-Control'],'no-store');
});

test('Administrador puede listar sus trabajos del Orador',async()=>{const s=entorno({rol:'ADMIN'});assert.equal((await s.request({action:'listar'})).code,200);assert.deepEqual(s.llamadas,['listar']);});
