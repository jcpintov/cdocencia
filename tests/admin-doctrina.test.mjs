import {listarConversaciones,exportarMemoriaAprobada} from '../lib/memoria-casos.js';
const permisosSource=readFileSync(new URL('../lib/roles-admin.js',import.meta.url),'utf8').replace(/^export /gm,'');
import {consultarGroqDoctrina as consultarGroqReal} from '../lib/groq-doctrina.js';
import {prepararConsultaAgente,informeConsultaDoctrina} from '../lib/agente-doctrina.js';
import {readFileSync} from 'node:fs';
import {createContext,Script} from 'node:vm';
import {createHash} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
const raw=readFileSync(new URL('../api/admin-doctrina.js',import.meta.url),'utf8');
const source=raw.replace("const {consultarGroqDoctrina}=await import('../lib/groq-doctrina.js');",'').replace("const {prepararConsultaAgente}=await import('../lib/agente-doctrina.js');",'').replace(/^import .*;$/gm,'').replace('export default async function handler','async function handler');
const actor='11111111-1111-4111-8111-111111111111';
function setup(o={}){
 const calls=[];const pdf=Buffer.from('%PDF-1.4\nExample synthetic fixture\n%%EOF');
 const storage={createSignedUploadUrl:async path=>{calls.push(['upload',path]);return {data:{token:'signed-test'}};},download:async()=>({data:new Blob([o.badPDF?'invalid':pdf])}),createSignedUrl:async()=>{calls.push(['sign']);return {data:{signedUrl:'https://example.supabase.co/storage/v1/object/sign/a'}};}};
 const casosQ={delete(){calls.push(['delete']);return this;},maybeSingle:async()=>({data:o.casoAjeno?null:{id:actor},error:o.falloEliminar?{code:'network'}:null}),select(){return this;},eq(k,v){calls.push(['filtro',k,v]);return this;},order(){return this;},range:async()=>({data:o.falloCasos?null:o.casos||[],error:o.falloCasos?{code:'network'}:null,count:(o.casos||[]).length})};
 const admin={from:tabla=>tabla==='agente_casos'?casosQ:({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:'profile',rol:o.rol,es_admin:!o.notAdmin,email:o.rol==='ADMIN'?'delegado@example.invalid':'jpintov@gmail.com'}})})})}),rpc:async(name,args)=>{calls.push(['rpc',args.p_accion]);return {data:args.p_accion==='listar'?{documentos:[],inventario:[]}:args.p_accion==='obtener'?(o.missing?null:{path:'path',bytes:pdf.length,sha256:o.badHash?'0'.repeat(64):createHash('sha256').update(pdf).digest('hex')}):{version_id:'v'}};},storage:{getBucket:async()=>({data:{public:!!o.publicBucket}}),from:()=>storage}};
 const client={auth:{getUser:async()=>({data:{user:{id:actor,email:o.foreign?'other@example.invalid':o.rol==='ADMIN'?'delegado@example.invalid':'jpintov@gmail.com'}},error:o.invalidAuth?{}:null})}};
 const ctx=createContext({createClient:(_u,k)=>k==='service'?admin:client,process:{env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'service',DOCTRINA_MEMORIA_CASOS_ENABLED:o.memoria?'true':'false'}},listarConversaciones,exportarMemoriaAprobada,randomUUID:()=>actor,createHash,Buffer,prepararConsultaAgente,informeConsultaDoctrina,consultarGroqDoctrina:(entrada,options)=>consultarGroqReal(entrada,{...options,env:{}})});
 const handler=new Script(permisosSource+source+'\nhandler').runInContext(ctx);
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

test('revisión valida decisión y observaciones antes de consultar el original',async()=>{const s=setup();assert.equal((await s.request({action:'revisar',id:actor,decision:'publicar',nota:''})).code,422);assert.equal(s.calls.length,0);});
test('aprobar exige integridad del PDF y registra la revisión sin enlace público',async()=>{const s=setup();assert.equal((await s.request({action:'revisar',id:actor,decision:'aprobar',nota:'Revisado'})).code,200);assert.deepEqual(s.calls,[['rpc','obtener'],['rpc','revisar']]);});
test('PDF alterado impide aprobar',async()=>{const s=setup({badHash:true});assert.equal((await s.request({action:'revisar',id:actor,decision:'aprobar',nota:''})).code,409);assert.deepEqual(s.calls,[['rpc','obtener']]);});
test('retiro y restauración solo aceptan identificadores de versión y nunca borran bytes',async()=>{const s=setup();assert.equal((await s.request({action:'retirar',id:'otra/ruta'})).code,422);assert.equal((await s.request({action:'retirar',id:actor})).code,200);assert.equal((await s.request({action:'restaurar',id:actor})).code,200);assert.deepEqual(s.calls,[['rpc','retirar'],['rpc','restaurar']]);});
for(const action of ['revisar','retirar','restaurar'])test(action+' rechaza identidad ajena',async()=>{const s=setup({foreign:true});assert.equal((await s.request({action,id:actor,decision:'aprobar',nota:''})).code,403);assert.equal(s.calls.length,0);});

test('visor verifica integridad y entrega acceso temporal exclusivo Superadmin',async()=>{const s=setup();const r=await s.request({action:'visualizar',id:actor});assert.equal(r.code,200);assert.equal(r.body.expira_segundos,60);assert.deepEqual(s.calls,[['rpc','obtener'],['sign']]);});
test('visor rechaza PDF alterado e identidad ajena',async()=>{const a=setup({badHash:true});assert.equal((await a.request({action:'visualizar',id:actor})).code,409);const b=setup({foreign:true});assert.equal((await b.request({action:'visualizar',id:actor})).code,403);});
test('búsqueda de textos valida consulta y usa exclusivamente la función protegida',async()=>{const s=setup();assert.equal((await s.request({action:'texto_buscar',consulta:'x'})).code,422);assert.equal((await s.request({action:'texto_buscar',consulta:'acacia'})).code,200);assert.deepEqual(s.calls,[['rpc','texto_buscar']]);});
test('no permite inyectar extracciones ni guardar texto en una página inválida',async()=>{const s=setup();assert.equal((await s.request({action:'texto_guardar',id:actor,paginas:[]})).code,422);assert.equal((await s.request({action:'texto_revisar_pagina',id:actor,pagina:0,texto:'Texto'})).code,422);assert.equal((await s.request({action:'texto_revisar_pagina',id:actor,pagina:1,texto:'No está vacía',pagina_sin_texto:true})).code,422);assert.equal(s.calls.length,0);});
test('una extracción no comienza si falla la integridad del original',async()=>{const s=setup({badHash:true});assert.equal((await s.request({action:'texto_extraer',id:actor})).code,409);assert.deepEqual(s.calls,[['rpc','obtener']]);});

test('agente mantiene la autorización previa y solo consulta fuentes mediante RPC protegida',async()=>{
 const ajeno=setup({foreign:true});assert.equal((await ajeno.request({action:'agente_consultar',pregunta:'Consulta suficientemente larga',consulta:'acacia'})).code,403);assert.equal(ajeno.calls.length,0);
 const s=setup();assert.equal((await s.request({action:'agente_consultar',pregunta:'corta',consulta:'acacia'})).code,422);assert.equal(s.calls.length,0);
 const r=await s.request({action:'agente_consultar',pregunta:'¿Qué representa la acacia?',consulta:'acacia',antecedentes:'Caso aportado'});assert.equal(r.code,200);assert.equal(r.body.informe.generativo,false);assert.deepEqual(s.calls,[]);
});

test('permisos Groq requieren confirmación explícita e identidad Superadmin',async()=>{
 const s=setup();assert.equal((await s.request({action:'llm_autorizar',id:actor})).code,422);assert.equal(s.calls.length,0);
 assert.equal((await s.request({action:'llm_autorizar',id:actor,confirmacion:true})).code,200);assert.deepEqual(s.calls,[['rpc','texto_llm_autorizar']]);
 assert.equal((await setup({foreign:true}).request({action:'llm_listar'})).code,403);
});


test('autorización global exige confirmación y sesión privilegiada',async()=>{
 const s=setup();assert.equal((await s.request({action:'llm_autorizar_biblioteca'})).code,422);
 assert.equal(s.calls.length,0);
 const r=await s.request({action:'llm_autorizar_biblioteca',confirmacion:true});
 assert.equal(r.code,200);assert.deepEqual(s.calls,[['rpc','texto_llm_autorizar_biblioteca']]);
 const no=setup({foreign:true});assert.equal((await no.request({action:'llm_autorizar_biblioteca',confirmacion:true})).code,403);
});

test('reclasifica mediante RPC protegida y valida categorías e identidad',async()=>{
 const s=setup();assert.equal((await s.request({action:'clasificar',id:actor,clase:'doctrina',clase_actual:'docencia'})).code,200);assert.deepEqual(s.calls,[['rpc','clasificar']]);
 const i=setup();assert.equal((await i.request({action:'clasificar',id:actor,clase:'inventada',clase_actual:'docencia'})).code,422);assert.equal(i.calls.length,0);
 const f=setup({foreign:true});assert.equal((await f.request({action:'clasificar',id:actor,clase:'doctrina',clase_actual:'docencia'})).code,403);assert.equal(f.calls.length,0);
});

test('Administrador accede a biblioteca pero no puede cambiar autorizaciones externas',async()=>{const s=setup({rol:'ADMIN'});assert.equal((await s.request({action:'listar'})).code,200);for(const action of ['llm_autorizar','llm_revocar','llm_autorizar_biblioteca'])assert.equal((await s.request({action,confirmacion:true,id:actor})).code,403);assert.deepEqual(s.calls,[['rpc','listar']]);});

test('archivo: filtra por actor verificado y solo exporta casos aprobados',async()=>{const s=setup({memoria:true,casos:[{id:actor,estado:'candidato'}]});assert.equal((await s.request({action:'casos_listar',actor:'intruso',estado:'candidato'})).code,200);assert.ok(s.calls.some(c=>c[0]==='filtro'&&c[1]==='actor'&&c[2]===actor));assert.equal((await s.request({action:'memoria_exportar'})).code,200);assert.ok(s.calls.some(c=>c[1]==='estado'&&c[2]==='revisado'));});
test('archivo: rechaza filtros inválidos y falla explícitamente sin generar JSON parcial',async()=>{assert.equal((await setup().request({action:'casos_listar'})).code,503);for(const datos of [{estado:'otro'},{desde:-1},{desde:'0'}])assert.equal((await setup({memoria:true}).request({action:'casos_listar',...datos})).code,422);assert.equal((await setup({memoria:true,falloCasos:true}).request({action:'memoria_exportar'})).code,503);});


test('eliminar conversación exige sesión, permisos, memoria habilitada y confirmación',async()=>{
 const datos={action:'caso_eliminar',id:actor,confirmacion:true};
 assert.equal((await setup({memoria:true}).request(datos,'')).code,401);
 for(const o of [{notAdmin:true},{foreign:true}])assert.equal((await setup({memoria:true,...o}).request(datos)).code,403);
 assert.equal((await setup().request(datos)).code,503);
 for(const d of [{id:'inválido',confirmacion:true},{id:actor},{id:actor,confirmacion:'true'}]){const s=setup({memoria:true});assert.equal((await s.request({action:'caso_eliminar',...d})).code,422);assert.equal(s.calls.length,0);}
});
test('eliminar conversación filtra por propietario verificado, nunca por actor enviado',async()=>{
 for(const rol of ['SUPERADMIN','ADMIN']){
  const s=setup({memoria:true,rol});const r=await s.request({action:'caso_eliminar',id:actor,actor:'intruso',confirmacion:true});
  assert.equal(r.code,200);assert.equal(r.body.eliminado,true);assert.deepEqual(s.calls,[['delete'],['filtro','id',actor],['filtro','actor',actor]]);
 }
 assert.equal((await setup({memoria:true,casoAjeno:true}).request({action:'caso_eliminar',id:actor,confirmacion:true})).code,404);
 assert.equal((await setup({memoria:true,falloEliminar:true}).request({action:'caso_eliminar',id:actor,confirmacion:true})).code,503);
});
