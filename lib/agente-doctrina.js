/* Preparación de consultas: pregunta natural y recuperación léxica ampliada.
   El índice permanece en Supabase; no se envían archivos ni datos a proveedores
   externos desde este módulo. */
const SIN_CARGA=new Set('acerca ahora alguna algunos ante antes cuando cómo cual cuáles debe deben donde durante ello ellos entre esta estas esto estos fuera haber hacia hasta hay haya hizo incluso la las lo los más menos mismo mucho nada ningún ninguna otro otra para pero por porque puede pueden qué que quien quienes sin sobre sus también tiene tienen toda todas todo todos una unas uno unos usted ustedes del desde como ante muy ser será serían está están han con fue sido cada caso lugar manera forma hecho hechos maestro maestros masónico masónica masónicos masónicas grado grados logia tenida'.normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(' '));
const RELACIONADOS={
 cargo:['oficio','oficial','funcion','funciones','reemplazo','deber'],
 niega:['negativa','rehusar','excusar','obediencia','obligacion'],
 negarse:['negativa','rehusar','excusar','obediencia','obligacion'],
 cubrir:['reemplazo','subrogacion','oficial','cargo'],
 saludar:['saludo','fraternidad','iniciado','ceremonia'],
 iniciacion:['iniciación','profano','candidato','admisión'],
 iniciados:['iniciación','fraternidad','recibimiento'],
 falta:['disciplina','responsabilidad','deber','obligacion'],
 juramento:['promesa','deber','obligacion','compromiso'],
 sancion:['falta','disciplina','tribunal','reglamento']
};
function limpiarTermino(v){return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
export function derivarBusquedaDoctrinal(pregunta){
 const palabras=String(pregunta||'').match(/[\p{L}]{4,}/gu)||[];
 const filtradas=[...new Set(palabras.map(t=>t.toLowerCase()).filter(t=>!SIN_CARGA.has(limpiarTermino(t))))].slice(0,7);
 const relacionadas=filtradas.flatMap(t=>RELACIONADOS[limpiarTermino(t)]||[]);
 return [...new Set([...filtradas,...relacionadas])].slice(0,12).join(' OR ').slice(0,240);
}
export function prepararConsultaAgente(datos){
 const pregunta=typeof datos?.pregunta==='string'?datos.pregunta.trim():'';
 const consulta=typeof datos?.consulta==='string'?datos.consulta.trim():'';
 const antecedentes=typeof datos?.antecedentes==='string'?datos.antecedentes.trim():'';
 const historial=datos?.historial ?? [];
 if(!Array.isArray(historial)||historial.length>12||historial.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||!m.content.trim()||m.content.length>5000)||historial.reduce((n,m)=>n+m.content.length,0)>20000)throw Error('La conversación supera el contexto permitido. Inicia una nueva conversación.');
 if(pregunta.length<(historial.length?1:10)||pregunta.length>2000||consulta.length>250||antecedentes.length>3000)throw new Error('Revise la pregunta (10 a 2000 caracteres), la búsqueda complementaria (hasta 250) y los antecedentes (hasta 3000).');
 const consultaAmpliada=derivarBusquedaDoctrinal(pregunta);
 // Groq interpreta la pregunta completa y decide las búsquedas documentales.
 return {pregunta,consulta:consulta||consultaAmpliada,consultaAmpliada,antecedentes,historial:historial.map(({role,content})=>({role,content}))};
}
export function informeConsultaDoctrina(entrada,recuperacion){
 const fuentes=(recuperacion?.resultados||[]).slice(0,50).map((f,i)=>({referencia:`F${i+1}`,titulo:f.titulo,clase:f.clase||'sin clasificar',version_id:f.version_id,version:f.version,sha256:f.sha256,pagina:f.pagina,fragmento:f.fragmento,estado_texto:f.estado_texto||'sin verificar'}));
 const cobertura=recuperacion?.cobertura||null;
 const sinFuentes=!fuentes.length;
 const mensaje=sinFuentes?'Todavía no hay pasajes consultables que sustenten una respuesta a esta pregunta. Compruebe el estado de indexación, el OCR y las autorizaciones documentales. No es posible determinar una obligación masónica a partir de una búsqueda vacía.':`Se encontraron ${fuentes.length} pasajes relacionados. Puede contrastarlos en sus originales; el análisis generativo requiere fuentes autorizadas y un proveedor disponible.`;
 return {modo:'documental_local',generativo:false,pregunta:entrada.pregunta,consulta:entrada.consulta,cobertura,fuentes,secciones:[{titulo:sinFuentes?'Sin respaldo documental recuperado':'Fuentes documentales disponibles',texto:mensaje}]};
}

// Valora coincidencias de la pregunta original, antes de expandir sinónimos.
export function puntuarPasajeDoctrinal(pregunta,fuente){
 const tokens=[...new Set((String(pregunta).match(/[\p{L}]{4,}/gu)||[]).map(limpiarTermino).filter(t=>!SIN_CARGA.has(t)))];
 const texto=limpiarTermino((fuente.titulo||'')+' '+(fuente.fragmento||''));
 return tokens.reduce((total,t)=>total+(texto.includes(t)?1:0),0)/Math.max(1,tokens.length);
}

// Conserva el planteamiento inicial y las intervenciones recientes. Los códigos
// de fuente históricos no sustituyen las fuentes verificadas del turno actual.
export function contextoConversacion(historial=[],maximo=6000) {
 const mensajes=historial.length>5?[historial[0],...historial.slice(-4)]:historial;
 const porMensaje=Math.floor(maximo/Math.max(1,mensajes.length));
 return mensajes.map(({role,content})=>({role,content:content.length<=porMensaje?content:content.slice(0,Math.floor(porMensaje/3))+' […] '+content.slice(-Math.floor(porMensaje*2/3)+6)}));
}
