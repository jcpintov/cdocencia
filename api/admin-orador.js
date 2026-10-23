import {esOperador} from '../lib/roles-admin.js';
import {createClient} from '@supabase/supabase-js';
import {randomUUID,createHash} from 'node:crypto';
import {validarFicha,extraerTrabajo,coincidenciasTrabajo,pedirJSONTrabajos,validarRevision,validarOratoria,generarOratoriaRevisada,exportarOratoria,promptOrador,ROL_ORADOR} from '../lib/trabajos-tenida.js';
import {prepararConsultaAgente} from '../lib/agente-doctrina.js';
import {consultarGroqDoctrina} from '../lib/groq-doctrina.js';
const BUCKET='trabajos-tenida-privados',MAX=10485760;
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const reply=(res,status,data)=>{res.setHeader('Cache-Control','no-store');return res.status(status).json(data);};
const visible=w=>({id:w.id,revision:w.revision,datos:{...w.datos,extraccion:{...w.datos.extraccion,texto:undefined,bloques:undefined}},bloques_total:w.datos.extraccion.bloques.length});
export default async function handler(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return reply(res,405,{error:'Método no permitido'});}
 const token=/^Bearer (.+)$/i.exec(req.headers?.authorization||'')?.[1];if(!token)return reply(res,401,{error:'Sesión requerida'});
 const {SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:key,SUPABASE_SERVICE_ROLE_KEY:secret}=process.env;
 if(!url||!key||!secret)return reply(res,503,{error:'Servicio no configurado'});
 let trabajo,rpc;
 try{
  const options={auth:{persistSession:false,autoRefreshToken:false}};
  const {data,error}=await createClient(url,key,options).auth.getUser(token),user=data?.user;
  if(error||!user?.id)return reply(res,401,{error:'Sesión no válida'});
  const admin=createClient(url,secret,options);
  const {data:perfil,error:pe}=await admin.from('usuarios').select('id,email,es_admin,rol,cuenta_eliminada').eq('auth_user_id',user.id).maybeSingle();
  if(pe||!esOperador(perfil,user))return reply(res,403,{error:'Se requiere administración docente'});
  rpc=async(accion,datos={})=>{const {data,error}=await admin.rpc('trabajos_tenida_superadmin',{p_actor:user.id,p_accion:accion,p_datos:datos});if(error)throw Error(error.code==='40001'?'El trabajo cambió o ya se está procesando. Actualícelo antes de continuar.':'No se pudo guardar el paso. Reintente.');return data;};
  const documental=async(accion,datos={})=>{const {data,error}=await admin.rpc('doctrina_texto_superadmin',{p_actor:user.id,p_accion:accion,p_datos:datos});if(error)throw Error('No se pudo consultar la biblioteca autorizada.');return data;};
  const {action,...d}=req.body||{};
  if(!['listar','preparar','registrar','obtener','original','revisar','contrastar','decision','generar','editar','exportar'].includes(action))return reply(res,422,{error:'Acción inválida'});
  if(action==='listar')return reply(res,200,{ok:true,...await rpc('listar')});
  if(['preparar','registrar'].includes(action)){
   const ficha=validarFicha(d.ficha||{});
   if(!['pdf','docx'].includes(d.extension)||!Number.isSafeInteger(d.bytes)||d.bytes<1||d.bytes>MAX||d.autoriza_ia!==true)return reply(res,422,{error:'Adjunte PDF o DOCX de hasta 10 MB y autorice su análisis privado con Groq.'});
   const {data:bucket,error}=await admin.storage.getBucket(BUCKET);if(error||bucket?.public!==false)throw Error('El almacenamiento privado no está disponible.');
   const storage=admin.storage.from(BUCKET);
   if(action==='preparar'){
    const path=`superadmin/${user.id}/${randomUUID()}.${d.extension}`;
    const {data,error}=await storage.createSignedUploadUrl(path,{upsert:false});if(error||!data?.token)throw Error('No se pudo preparar la carga.');
    return reply(res,200,{ok:true,path,token:data.token});
   }
   if(typeof d.path!=='string'||!new RegExp(`^superadmin/${user.id}/[0-9a-f-]{36}[.]${d.extension}$`).test(d.path)||!/^[0-9a-f]{64}$/.test(d.sha256||''))return reply(res,422,{error:'Referencia de original inválida'});
   const {data:blob,error:de}=await storage.download(d.path);if(de||!blob||blob.size!==d.bytes||blob.size>MAX)throw Error('El original no está disponible o su tamaño no coincide.');
   const bytes=Buffer.from(await blob.arrayBuffer());
   if(createHash('sha256').update(bytes).digest('hex')!==d.sha256)throw Error('La integridad del original no coincide.');
   const extraccion=await extraerTrabajo(bytes,d.extension);
   const w=await rpc('registrar',{path:d.path,sha256:d.sha256,bytes:d.bytes,datos:{ficha,extension:d.extension,extraccion,revision_bloques:[],autorizacion:{proveedor:'Groq',modelo:'openai/gpt-oss-120b',fecha:new Date().toISOString()},rol_version:ROL_ORADOR.version}});
   return reply(res,200,{ok:true,trabajo:visible(w)});
  }
  if(!uuid(d.id))return reply(res,422,{error:'Trabajo inválido'});
  const w=await rpc('obtener',{id:d.id});if(!w)throw Error('Trabajo no encontrado.');
  if(action==='obtener')return reply(res,200,{ok:true,trabajo:visible(w)});
  if(action==='original'){
   const {data,error}=await admin.storage.from(BUCKET).createSignedUrl(w.path,60,{download:true});if(error)throw Error('No se pudo descargar el original.');return reply(res,200,{ok:true,url:data.signedUrl});
  }
  if(action==='exportar'){
   const bytes=await exportarOratoria(w);res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.wordprocessingml.document');res.setHeader('Content-Disposition','attachment; filename="Conclusiones_del_Orador.docx"');return res.status(200).send(bytes);
  }
  if(!Number.isSafeInteger(d.revision))return reply(res,422,{error:'Actualice el trabajo antes de continuar'});
  trabajo=await rpc('iniciar',{id:d.id,revision:d.revision});
  const datos=structuredClone(trabajo.datos),e=datos.extraccion;
  const revisado=datos.revision_bloques.length===e.bloques.length;
  if(action==='revisar'){
   if(revisado)throw Error('La revisión de todos los bloques ya está completa.');
   const bloque=e.bloques[datos.revision_bloques.length];
   const contexto=await documental('texto_contexto');
   const paginas=contexto?.paginas||[];
   const coincidencias=coincidenciasTrabajo(bloque.texto,paginas);
   const principios=paginas.filter(p=>p.titulo==='PRINCIPIOS DE LA MASONERÍA');
   const fuentes=[...new Map([...principios,...coincidencias.map(c=>paginas.find(p=>p.version_id===c.version_id&&p.pagina===c.pagina))].filter(Boolean).map(p=>[p.version_id+':'+p.pagina,p])).values()];
   if(!fuentes.length)throw Error('Habilite los principios en la biblioteca antes de revisar el trabajo.');
   const reserva=await documental('texto_llm_reservar',{fuentes:fuentes.map(({version_id,sha256,pagina})=>({version_id,sha256,pagina})),hash:createHash('sha256').update(bloque.texto).digest('hex')});
   if(!reserva?.ok)throw Error(reserva?.mensaje||'No se pudo autorizar el análisis.');
   let estado='fallido';try{
    const r=await pedirJSONTrabajos(`Eres un revisor docente masónico. Revisa únicamente este bloque del trabajo, no juzgues el documento completo. Criterios: ${JSON.stringify(ROL_ORADOR.revision)}. Devuelve {"sintesis":"tesis y conexión con el conjunto, máximo 450 caracteres", "pasajes":["de una a tres citas EXACTAS del bloque, de 20 a 600 caracteres, que respalden la síntesis"], "observaciones":[{"tipo":"citas|ia|contenido|argumentacion","pasaje":"cita EXACTA que requiere examen","explicacion":"observación contextualizada, sin veredicto ni porcentaje de autoría"}]}. En observaciones de argumentacion, cita el pasaje exacto y explica premisas, conclusión, defecto inferencial, posible falacia y corrección; no diagnostiques falacias por palabras aisladas ni por discrepar del autor. Si no hay observaciones fundamentadas usa []. Nunca atribuyas autoría IA a partir del estilo. No califiques contenidos simbólicos de grados superiores como adecuados para grados inferiores.`,{ficha:datos.ficha,bloque:bloque.numero,total:e.bloques.length,texto:bloque.texto,principios:principios.map(p=>p.fragmento).join('\n'),coincidencias},{validar:async()=> (await documental('texto_llm_validar',{id:reserva.id})).ok});
    datos.revision_bloques.push({...validarRevision(r,bloque),coincidencias});estado='completado';
   }finally{await documental('texto_llm_finalizar',{id:reserva.id,estado});}
  }else if(action==='contrastar'){
   if(!revisado)throw Error('Complete primero la revisión de todos los bloques.');
   const resumen=datos.revision_bloques.map(b=>`Bloque ${b.numero}: ${b.sintesis}`).join('\n');
   const prefijo=`Contrasta las ideas de este trabajo para grado ${datos.ficha.grado}, tema ${datos.ficha.tema}, con principios, Constitución, reglamento general, justicia, otros reglamentos, doctrina, docencia y tradición. Indica solo las precisiones necesarias para sus conclusiones, sin desarrollar otro tema. No atribuyas al autor ideas ajenas.\n`;
   const entrada=prepararConsultaAgente({pregunta:prefijo+resumen.slice(0,2000-prefijo.length),antecedentes:resumen.slice(2000-prefijo.length)});
   const contraste=await consultarGroqDoctrina(entrada,{rpc:documental});
   if(!contraste.generativo||!contraste.fuentes?.length)throw Error(contraste.aviso||'No se pudo completar el contraste documental. Reintente.');
   datos.contraste=contraste;delete datos.decision;delete datos.oratoria;
  }else if(action==='decision'){
   if(!revisado||!datos.contraste)throw Error('Complete la revisión y el contraste antes de aprobar la elaboración.');
   if(!['continuar','corregir'].includes(d.decision)||typeof d.nota!=='string'||d.nota.trim().length<5||d.nota.length>3000)throw Error('Registre una decisión y sus precisiones (5–3000 caracteres).');
   datos.decision={decision:d.decision,nota:d.nota.trim(),fecha:new Date().toISOString(),revision:trabajo.revision};delete datos.oratoria;
  }else if(action==='generar'){
   if(!revisado||!datos.contraste||datos.decision?.decision!=='continuar')throw Error('Revise el informe y autorice la elaboración antes de generar conclusiones.');
   const fuentes=datos.contraste.fuentes;
   const reserva=await documental('texto_llm_reservar',{fuentes:fuentes.map(({version_id,sha256,pagina})=>({version_id,sha256,pagina})),hash:createHash('sha256').update(JSON.stringify(datos.contraste)).digest('hex')});
   if(!reserva?.ok)throw Error(reserva?.mensaje||'No se pudo validar el contraste documental.');
   let estado='fallido';try{
    const r=await generarOratoriaRevisada(datos.ficha,{ficha:datos.ficha,trabajo_completo_revisado:datos.revision_bloques.map(({numero,sintesis,pasajes,observaciones})=>({numero,sintesis,pasajes:pasajes.slice(0,1).map(p=>p.slice(0,300)),observaciones_argumentales:(observaciones||[]).filter(o=>o.tipo==='argumentacion')})),contraste:datos.contraste.secciones,precision_del_orador:datos.decision.nota},{validar:async()=> (await documental('texto_llm_validar',{id:reserva.id})).ok});
    datos.oratoria={...r,estado:'borrador',fuentes,creado_en:new Date().toISOString()};estado='completado';
   }finally{await documental('texto_llm_finalizar',{id:reserva.id,estado});}
  }else if(action==='editar'){
   if(!datos.oratoria)throw Error('Primero genere las conclusiones.');
   datos.oratoria={...datos.oratoria,...validarOratoria({texto:d.texto}),estado:'revisado_por_orador',editado_en:new Date().toISOString()};
  }
  const guardado=await rpc('guardar',{id:trabajo.id,revision:trabajo.revision,bloqueo:trabajo.bloqueo,datos,paso:action});trabajo=null;
  return reply(res,200,{ok:true,trabajo:visible(guardado)});
 }catch(error){
  if(trabajo&&rpc)try{await rpc('liberar',{id:trabajo.id,bloqueo:trabajo.bloqueo});}catch{}
  // No registrar texto privado, respuestas ni credenciales del proveedor.
  const mensaje=typeof error.message==='string'&&error.message.length<300?error.message:'No se pudo completar el paso. El avance guardado se conserva.';
  const etapa=['revisar','contrastar','decision','generar','editar'].includes(req.body?.action)?req.body.action:'solicitud';
  const referencia=randomUUID();
  // Diagnóstico correlacionable sin texto del trabajo, respuesta de IA ni credenciales.
  console.warn('ORADOR_PASO_FALLIDO',JSON.stringify({etapa,referencia}));
  const status=[429,503].includes(error.status)?error.status:422;
  if(status===429)res.setHeader('Retry-After',String(error.reintentar_en||15));
  return reply(res,status,{error:mensaje,etapa,referencia,codigo:error.codigo,reintentar_en:error.reintentar_en});
 }
}
