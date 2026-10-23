import {createHash} from 'node:crypto';
import {MEMORIA_BASE} from './memoria-base.js';

export async function listarConversaciones(admin,actor,{estado='todos',desde=0}={}){
 let q=admin.from('agente_casos').select('id,pregunta,respuesta,fuentes,conversacion,estado,creado_en,revisado_en',{count:'exact'}).eq('actor',actor);
 if(estado!=='todos')q=q.eq('estado',estado);
 const {data,error,count}=await q.order('creado_en',{ascending:false}).order('id').range(desde,desde+49);
 if(error||!Array.isArray(data))throw Error('conversaciones_no_disponibles');
 return {conversaciones:data,total:count??data.length,hay_mas:count!=null?desde+data.length<count:data.length===50};
}
export async function exportarMemoriaAprobada(admin,actor){
 const casos=[];let bytes=0;
 for(let desde=0;desde<10000;desde+=50){
  const {data,error}=await admin.from('agente_casos').select('id,pregunta,respuesta,fuentes,conversacion,revisado_en').eq('actor',actor).eq('estado','revisado').order('id').range(desde,desde+49);
  if(error||!Array.isArray(data))throw Error('memoria_no_disponible');
  bytes+=Buffer.byteLength(JSON.stringify(data),'utf8');if(bytes>3000000)throw Error('exportacion_demasiado_extensa');
  casos.push(...data);
  if(data.length<50)return {schema_version:1,revision_editorial:MEMORIA_BASE.revision,criterios:MEMORIA_BASE.criterios,persistencia_casos:true,total_revisados:casos.length,casos,alcance:'Conversaciones aprobadas como antecedentes. No constituyen fuentes normativas ni entrenamiento de los pesos del modelo.'};
 }
 throw Error('exportacion_demasiado_extensa');
}

export async function cargarMemoriaSesion(admin,actor,habilitada){
 const base={schema_version:1,revision_editorial:MEMORIA_BASE.revision,criterios:MEMORIA_BASE.criterios,persistencia_casos:habilitada,casos:[],alcance:'Casos revisados más recientes; los demás permanecen guardados y consultables por búsqueda.'};
 if(!habilitada)return base;
 const {data,error,count}=await admin.from('agente_casos').select('id,pregunta,respuesta,fuentes,revisado_en',{count:'exact'}).eq('actor',actor).eq('estado','revisado').order('revisado_en',{ascending:false}).limit(100);
 if(error)throw Error('memoria_no_disponible');
 const casos=data||[];
 return {...base,casos,total_revisados:count??casos.length,revision:createHash('sha256').update(JSON.stringify({editorial:MEMORIA_BASE.revision,casos})).digest('hex')};
}

// Una respuesta guardada es candidata, no doctrina ni aprendizaje aprobado.
export async function guardarCasoCandidato(admin,actor,entrada,informe){
 if(!informe?.generativo)return null;
 const respuesta=informe.secciones.map(s=>s.texto).join('\n\n').slice(0,5000);
 const fuentes=(informe.fuentes||[]).map(({version_id,sha256,pagina})=>({version_id,sha256,pagina}));
 const conversacion=[...(entrada.conversacion||entrada.historial||[]),{role:'user',content:entrada.pregunta},{role:'assistant',content:respuesta}];
 const huella=createHash('sha256').update(JSON.stringify({pregunta:entrada.pregunta,respuesta,fuentes,conversacion})).digest('hex');
 const {data,error}=await admin.from('agente_casos').upsert({actor,huella,pregunta:entrada.pregunta,respuesta,fuentes,conversacion},{onConflict:'actor,huella',ignoreDuplicates:true}).select('id').maybeSingle();
 if(error)throw Error('memoria_no_disponible');
 if(data?.id)return data.id;
 const existente=await admin.from('agente_casos').select('id').eq('actor',actor).eq('huella',huella).maybeSingle();
 if(existente.error)throw Error('memoria_no_disponible');
 return existente.data?.id||null;
}

export async function recuperarCasosRevisados(admin,actor,pregunta){
 // Solo letras del planteamiento: OR léxico sin aceptar operadores del cliente.
 const consulta=[...new Set((pregunta.match(/[\p{L}]{4,}/gu)||[]).map(p=>p.toLowerCase()))].slice(0,8).join(' | ');
 if(!consulta)return [];
 const {data,error}=await admin.from('agente_casos').select('id,pregunta,respuesta,fuentes').eq('actor',actor).eq('estado','revisado').textSearch('indice',consulta,{config:'spanish'}).order('revisado_en',{ascending:false}).limit(3);
 if(error)throw Error('memoria_no_disponible');
 return data||[];
}

export function filtrarCasosVigentes(casos,permisos){
 return (Array.isArray(casos)?casos:[]).filter(c=>c&&typeof c.pregunta==='string'&&typeof c.respuesta==='string'&&Array.isArray(c.fuentes)&&c.fuentes.length>0&&c.fuentes.every(f=>f&&permisos.get(f.version_id)===f.sha256&&typeof f.sha256==='string'))
  .slice(0,3).map(c=>({pregunta:c.pregunta.slice(0,600),interpretacion_revisada:c.respuesta.slice(0,1200),fuentes:c.fuentes.map(({version_id,sha256,pagina})=>({version_id,sha256,pagina})),alcance:'Caso previo revisado por el administrador. No constituye norma ni prueba de los hechos del caso actual; verificar de nuevo contra las fuentes actuales.'}));
}
