import {readFileSync} from 'node:fs';
import {createContext,Script} from 'node:vm';
import {createHash} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
const raw=readFileSync(new URL('../api/admin-doctrina.js',import.meta.url),'utf8');
const source=raw.replace(/^import .*;$/gm,'').replace('export default async function handler','async function handler');
const actor='11111111-1111-4111-8111-111111111111';
function setup(o={}){
 const calls=[];const pdf=Buffer.from('%PDF-1.4\nExample synthetic fixture\n%%EOF');
 const storage={createSignedUploadUrl:async path=>{calls.push(['upload',path]);return {data:{token:'signed-test'}};},download:async()=>({data:new Blob([o.badPDF?'invalid':pdf])}),createSignedUrl:async()=>{calls.push(['sign']);return {data:{signedUrl:'https://example.supabase.co/storage/v1/object/sign/a'}};}};
 const admin={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:'profile',es_admin:!o.notAdmin,email:'jpintov@gmail.com'}})})})}),rpc:async(name,args)=>{calls.push(['rpc',args.p_accion]);return {data:args.p_accion==='listar'?{documentos:[],inventario:[]}:args.p_accion==='obtener'?(o.missing?null:{path:'path',bytes:pdf.length,sha256:o.badHash?'0'.repeat(64):createHash('sha256').update(pdf).digest('hex')}):{version_id:'v'}};},storage:{getBucket:async()=>({data:{public:!!o.publicBucket}}),from:()=>storage}};
 const client={auth:{getUser:async()=>({data:{user:{id:actor,email:o.foreign?'other@example.invalid':'jpintov@gmail.com'}},error:o.invalidAuth?{}:null})}};
 const ctx=createContext({createClient:(_u,k)=>k==='service'?admin:client,process:{env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'service'}},randomUUID:()=>actor,createHash,Buffer});
 const handler=new Script(source+'\nhandler').runInContext(ctx);
 const request=async(body={},auth='Bearer valid',method='POST')=>{const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(v){this.body=v;return this;}};await handler({method,body,headers:{authorization:auth}},res);return res;};
 return {request,calls,pdf};
}
test('deniega solicitudes sin sesión y evita acceso documental',async()=>{const s=setup();assert.equal((await s.request({action:'listar'},'')).code,401);assert.equal(s.calls.length,0);});
for(const option of ['notAdmin','foreign'])test('deniega identidad sin privilegio: '+option,async()=>{const s=setup({[option]:true});assert.equal((await s.request({action:'listar'})).code,403);assert.equal(s.calls.length,0);});
test('lista inventario solo después de verificar identidad',async()=>{const s=setup();const r=await s.request({action:'listar'});assert.equal(r.code,200);assert.equal(r.body.documentos.length,0);assert.deepEqual(s.calls,[['rpc','listar']]);});
test('almacenamiento público bloquea operaciones de archivos',async()=>{const s=setup({publicBucket:true});assert.equal((await s.request({action:'preparar',titulo:'Prueba',clase:'normativa',bytes:10})).code,503);assert.equal(s.calls.length,0);});
test('no admite archivos de más de 50 MB',async()=>{const s=setup();assert.equal((await s.request({action:'preparar',titulo:'Prueba',clase:'normativa',bytes:52428801})).code,422);assert.equal(s.calls.length,0);});
test('genera ruta propia sin aceptar rutas del cliente',async()=>{const s=setup();const r=await s.request({action:'preparar',titulo:'Prueba',clase:'normativa',bytes:10,path:'otra/ruta'});assert.equal(r.code,200);assert.equal(r.body.path,`superadmin/${actor}/${actor}.pdf`);});
test('registrar comprueba bytes y hash en servidor antes de insertar',async()=>{const s=setup();const r=await s.request({action:'registrar',titulo:'Prueba',clase:'normativa',bytes:s.pdf.length,sha256:createHash('sha256').update(s.pdf).digest('hex'),path:`superadmin/${actor}/${actor}.pdf`});assert.equal(r.code,200);assert.deepEqual(s.calls,[['rpc','registrar']]);});
test('hash distinto no registra documento',async()=>{const s=setup();const r=await s.request({action:'registrar',titulo:'Prueba',clase:'normativa',bytes:s.pdf.length,sha256:'0'.repeat(64),path:`superadmin/${actor}/${actor}.pdf`});assert.equal(r.code,422);assert.equal(s.calls.length,0);});
test('ruta ajena no se descarga ni registra',async()=>{const s=setup();assert.equal((await s.request({action:'registrar',titulo:'Prueba',clase:'normativa',bytes:10,sha256:'0'.repeat(64),path:'otro.pdf'})).code,422);assert.equal(s.calls.length,0);});
test('descarga verifica integridad antes de firmar URL de 60 segundos',async()=>{const s=setup();const r=await s.request({action:'descargar',id:actor});assert.equal(r.code,200);assert.equal(r.body.expira_segundos,60);assert.deepEqual(s.calls,[['rpc','obtener'],['sign']]);});
test('original alterado no obtiene URL firmada',async()=>{const s=setup({badHash:true});assert.equal((await s.request({action:'descargar',id:actor})).code,409);assert.deepEqual(s.calls,[['rpc','obtener']]);});
test('métodos y publicación no están habilitados',async()=>{const s=setup();assert.equal((await s.request({},'', 'GET')).code,405);assert.equal((await s.request({action:'publicar'})).code,422);});

