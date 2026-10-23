import test from 'node:test';import assert from 'node:assert/strict';
import {Document,Paragraph,TextRun,FootnoteReferenceRun,Header,Footer,Packer} from 'docx';
import {limpiarTextoDocente,extraerOriginalNuevo,validarCuestionarioNuevo,generarCuestionarioNuevo,hashTexto} from '../lib/nuevos-trabajos.js';
import {gestionarNuevoTrabajo} from '../server/nuevos-trabajos.js';
const id='12345678-1234-4234-8234-123456789abc',actor={id:'22345678-1234-4234-8234-123456789abc'},texto='La fraternidad exige escuchar y actuar con justicia, responsabilidad y respeto. '.repeat(12);
const ps=()=>({preguntas:Array.from({length:8},(_,i)=>({enunciado:'¿Qué expresa el principio de fraternidad en el caso '+(i+1)+'?',opciones:['A','B','C','D'].map((letra,j)=>({letra,texto:'Alternativa '+j})),respuesta_correcta:'A',retroalimentacion:'Escuchar exige respeto y responsabilidad ante los demás.',sustento:'La fraternidad exige escuchar y actuar con justicia'}))});
test('limpieza separa encabezados y paginación, no borra el cuerpo ni citas dentro del argumento',()=>{
 const paginas=[1,2,3].map(numero=>({numero,texto:'TALLER DE ESTUDIO\n'+texto+'\nComo señaló Kant (1785), la dignidad importa.\n'+numero}));const r=limpiarTextoDocente(paginas);
 assert.doesNotMatch(r.texto,/TALLER DE ESTUDIO/);assert.match(r.texto,/Kant \(1785\)/);assert.equal(r.separados.filter(s=>s.motivo==='Número de página').length,3);assert.equal(r.separados.filter(s=>s.motivo.includes('repetido')).length,3);
 const b=limpiarTextoDocente([{numero:1,texto:texto+'\nBIBLIOGRAFÍA\nKant, I. (1785). Fundamentación.'}]);assert.doesNotMatch(b.texto,/BIBLIOGRAFÍA/);assert.match(b.separados.at(-1).texto,/Kant/);
 const interno=limpiarTextoDocente([{numero:1,texto:'BIBLIOGRAFÍA\n'+texto+'\nCONCLUSIONES\nEl estudio continúa.'}]);assert.match(interno.texto,/CONCLUSIONES/);
});
test('DOCX real conserva bytes y extrae cuerpo separando notas, encabezados, pies y bibliografía',async()=>{
 const doc=new Document({footnotes:{1:{children:[new Paragraph('Nota privada al pie: autor, 2020.')] }},sections:[{headers:{default:new Header({children:[new Paragraph('ENCABEZADO INSTITUCIONAL')]})},footers:{default:new Footer({children:[new Paragraph('PIE REPETIDO')]})},children:[new Paragraph({children:[new TextRun(texto),new FootnoteReferenceRun(1)]}),new Paragraph('BIBLIOGRAFÍA'),new Paragraph('Autor. Editorial, 2020.')]}]});
 const bytes=await Packer.toBuffer(doc),antes=hashTexto(bytes);const r=await extraerOriginalNuevo(bytes,'docx');assert.equal(hashTexto(bytes),antes);assert.match(r.texto,/fraternidad/);assert.doesNotMatch(r.texto,/Nota privada|BIBLIOGRAFÍA|ENCABEZADO INSTITUCIONAL/);assert.ok(r.separados.some(s=>s.texto.includes('Nota privada')));assert.ok(r.separados.some(s=>s.texto.includes('ENCABEZADO')));
 await assert.rejects(()=>extraerOriginalNuevo(Buffer.from('mal'), 'pdf'),/PDF válido/);await assert.rejects(()=>extraerOriginalNuevo(bytes,'exe'),/PDF o/);
});
test('valida ocho preguntas únicas, cuatro alternativas y sustento literal; rechaza HTML y fuentes inventadas',()=>{
 assert.equal(validarCuestionarioNuevo(ps(),texto).preguntas[7].tipo,'etica');
 for(const editar of [p=>p.preguntas.pop(),p=>p.preguntas[0].sustento='Pasaje inexistente suficientemente largo',p=>p.preguntas[0].opciones[1].texto=p.preguntas[0].opciones[0].texto,p=>p.preguntas[0].respuesta_correcta='E',p=>p.preguntas[1].enunciado=p.preguntas[0].enunciado,p=>p.preguntas[0].enunciado='<img src=x onerror=alert(1)>']){const p=ps();editar(p);assert.throws(()=>validarCuestionarioNuevo(p,texto));}
});
test('Groq usa esquema y solo texto revisado; respuesta truncada, sin sustento o permisos cambiados no se acepta',async()=>{
 let enviado;const env={GROQ_API_KEY:'fixture-only',GROQ_ZDR_CONFIRMADO:'true'},datos={titulo:'Fraternidad',autor:'Autor'};
 const fetchImpl=async(_url,op)=>{enviado=JSON.parse(op.body);return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(ps())}}]})};};
 assert.equal((await generarCuestionarioNuevo(texto,datos,{env,fetchImpl})).preguntas.length,8);assert.equal(enviado.model,'openai/gpt-oss-120b');assert.equal(enviado.response_format.type,'json_schema');assert.equal(JSON.parse(enviado.messages[1].content).texto,texto);
 await assert.rejects(()=>generarCuestionarioNuevo(texto,datos,{env:{},fetchImpl}),/no está habilitado/);
 await assert.rejects(()=>generarCuestionarioNuevo(texto,datos,{env,fetchImpl,validar:async()=>false}),/cambió/);
 await assert.rejects(()=>generarCuestionarioNuevo(texto,datos,{env,fetchImpl:async()=>({ok:false,status:429,headers:{get:()=> '10'}})}),e=>e.status===429&&e.reintentar_en===10);
 await assert.rejects(()=>generarCuestionarioNuevo(texto,datos,{env,fetchImpl:async()=>({ok:true,json:async()=>({choices:[{finish_reason:'length'}]})})}),/incompleta/);
 let n=0;await assert.rejects(()=>generarCuestionarioNuevo(texto,datos,{env,fetchImpl,validar:async()=>++n===1}),/Cambió/);
});
function fixture(){
 let b={id,revision:1,estado:'borrador',texto,ficha:{titulo:'Título',autor:'Autor',numero_orden:1,codigo:'INCI011A'},original:{nombre:'a.pdf'},extraccion:{}},calls=[];
 const admin={rpc:async(_fn,{p_actor,p_accion,p_datos:d})=>{assert.equal(p_actor,actor.id);calls.push(p_accion);
 if(p_accion==='obtener')return {data:structuredClone(b)};
 if(p_accion==='guardar'){b={...b,...d,revision:b.revision+1};}
 if(p_accion==='finalizar_ia'&&d.preguntas){b={...b,preguntas:d.preguntas,preguntas_hash:d.preguntas_hash,revision:b.revision+1};}
 if(p_accion==='publicar')return {data:{publicado:true}};
 return {data:{id,revision:b.revision,reservado:true}};}};
 return {admin,calls,get:()=>b,run:d=>gestionarNuevoTrabajo(d,{admin,actor,generar:async()=>ps()})};
}
test('servidor: guardar, generar y publicar son pasos explícitos; no publica al generar y cambiar texto invalida preguntas',async()=>{
 const s=fixture();assert.equal((await s.run({action:'nuevo_generar',id,revision:1,confirmado:false})).status,422);assert.ok(!s.calls.includes('reservar_ia'));
 assert.equal((await s.run({action:'nuevo_generar',id,revision:1,confirmado:true})).status,200);assert.ok(!s.calls.includes('publicar'));assert.equal(s.get().preguntas.preguntas.length,8);
 assert.equal((await s.run({action:'nuevo_publicar',id,revision:2,confirmado:false})).status,422);
 assert.equal((await s.run({action:'nuevo_publicar',id,revision:2,confirmado:true})).status,200);
 const r=await s.run({action:'nuevo_guardar',id,revision:2,ficha:s.get().ficha,texto:texto+'Cambio.',preguntas:ps()});assert.equal(r.status,200);assert.equal(s.get().preguntas,null);
 assert.equal((await s.run({action:'nuevo_publicar',id,revision:3,confirmado:true})).status,422);
});
test('servidor: archivo inválido/tamaño, revisión y fallos de datos nunca publican',async()=>{
 const s=fixture();assert.equal((await s.run({action:'nuevo_preparar',id,nombre:'a.exe',base64:'YQ=='})).status,422);assert.equal((await s.run({action:'nuevo_preparar',id,nombre:'a.pdf',base64:'A'.repeat(2800000)})).status,422);
 assert.equal((await s.run({action:'nuevo_guardar',id,revision:0})).status,422);
 assert.equal((await s.run({action:'nuevo_generar',id,revision:20,confirmado:true})).status,409);
 const r=await gestionarNuevoTrabajo({action:'nuevo_obtener',id},{actor,admin:{rpc:async()=>({error:{code:'P0002',message:'Borrador no disponible'}})}});assert.equal(r.status,404);assert.ok(!s.calls.includes('publicar'));
});

function pdfSintetico(){
 const partes=['%PDF-1.4\n'],offsets=[0];
 const objetos=[`<< /Type /Catalog /Pages 2 0 R >>`,`<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>`,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>`,null,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>`,null,`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`];
 for(const [indice,pagina] of [[3,1],[5,2]]){const lineas=['TALLER FRATERNAL',...Array.from({length:8},(_,i)=>'La responsabilidad exige justicia y respeto en el estudio '+pagina+' caso '+i+'.'),String(pagina)];const stream='BT /F1 11 Tf 50 750 Td '+lineas.map((l,i)=>(i?'0 -22 Td ':'')+'('+l+') Tj').join(' ')+' ET';objetos[indice]='<< /Length '+Buffer.byteLength(stream)+' >>\nstream\n'+stream+'\nendstream';}
 for(let i=0;i<objetos.length;i++){offsets.push(Buffer.byteLength(partes.join('')));partes.push((i+1)+' 0 obj\n'+objetos[i]+'\nendobj\n');}
 const xref=Buffer.byteLength(partes.join(''));partes.push('xref\n0 8\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF');return Buffer.from(partes.join(''));
}
test('PDF real de dos páginas: extracción completa y separación de encabezados sin OCR inventado',async()=>{
 const r=await extraerOriginalNuevo(pdfSintetico(),'pdf');assert.equal(r.paginas,2);assert.match(r.texto,/estudio 1 caso 7/);assert.match(r.texto,/estudio 2 caso 7/);assert.doesNotMatch(r.texto,/TALLER FRATERNAL/);assert.equal(r.separados.filter(s=>s.motivo==='Número de página').length,2);
});

test('API de nuevos trabajos autentica antes de cargar el procesador y fija el actor del servidor',async()=>{
 const {readFile}=await import('node:fs/promises'),{runInNewContext}=await import('node:vm'),{esOperador}=await import('../lib/roles-admin.js');
 const raw=await readFile('api/admin-trabajos.js','utf8');const source=raw.replace(/^import .*;$/gm,'').replace("const {gestionarNuevoTrabajo}=await import('../server/nuevos-trabajos.js');","const {gestionarNuevoTrabajo}=hooks;").replace('export default async function handler','async function handler')+'\nhandler';
 async function ejecutar({token='Bearer fixture',rol='ADMIN',body={action:'nuevo_listar',actor:'intruso'}}={}){
  const calls=[];const perfil={email:'delegado@example.invalid',rol,es_admin:rol==='ADMIN'};
  const h=runInNewContext(source,{esOperador,process:{env:{SUPABASE_URL:'fixture',SUPABASE_PUBLISHABLE_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'service'}},createClient:(_url,key)=>key==='public'?{auth:{getUser:async()=>({data:{user:{id:actor.id,email:perfil.email}}})}}:{from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:perfil})})})})},hooks:{gestionarNuevoTrabajo:async(b,o)=>{calls.push(o.actor.id);return {status:200,body:{ok:true}};}}});
  const res={setHeader(){},status(c){this.code=c;return this;},json(v){this.body=v;return this;}};await h({method:'POST',headers:{authorization:token},body},res);return {res,calls};
 }
 for(const opt of [{token:''},{rol:'USER'}]){const r=await ejecutar(opt);assert.equal(r.calls.length,0);assert.ok([401,403].includes(r.res.code));}
 const ok=await ejecutar();assert.equal(ok.res.code,200);assert.deepEqual(ok.calls,[actor.id]);assert.equal((await ejecutar({body:'{incorrecto'})).res.code,400);
});
