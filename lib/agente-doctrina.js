/* Preparación de consultas: pregunta natural y recuperación léxica ampliada.
   El índice permanece en Supabase; no se envían archivos ni datos a proveedores
   externos desde este módulo. */
const SIN_CARGA=new Set('acerca ahora alguna algunos ante antes cuando cómo cual cuáles debe deben donde durante ello ellos entre esta estas esto estos fuera haber hacia hasta hay haya hizo incluso la las lo los más menos mismo mucho nada ningún ninguna otro otra para pero por porque puede pueden qué que quien quienes sin sobre sus también tiene tienen toda todas todo todos una unas uno unos usted ustedes del desde como ante muy ser será serían está están han con fue sido cada caso lugar manera forma hecho hechos maestro maestros masónico masónica masónicos masónicas grado grados logia tenida'.split(' '));
const RELACIONADOS={
 cargo:['oficio','oficial','funcion','funciones','reemplazo','deber'],
 niega:['negativa','rehusar','excusar','obediencia','obligacion'],
 negarse:['negativa','rehusar','excusar','obediencia','obligacion'],
 cubrir:['reemplazo','subrogacion','oficial','cargo'],
 saludar:['saludo','fraternidad','iniciado','ceremonia'],
 iniciados:['iniciacion','fraternidad','recibimiento'],
 falta:['disciplina','responsabilidad','deber','obligacion'],
 juramento:['promesa','deber','obligacion','compromiso'],
 sancion:['falta','disciplina','tribunal','reglamento']
};
function limpiarTermino(v){return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
export function derivarBusquedaDoctrinal(pregunta){
 const palabras=String(pregunta||'').match(/[\p{L}]{4,}/gu)||[];
 const filtradas=[...new Set(palabras.map(limpiarTermino).filter(t=>!SIN_CARGA.has(t)))].slice(0,7);
 const relacionadas=filtradas.flatMap(t=>RELACIONADOS[t]||[]);
 return [...new Set([...filtradas,...relacionadas])].slice(0,12).join(' OR ').slice(0,240);
}
export function prepararConsultaAgente(datos){
 const pregunta=typeof datos?.pregunta==='string'?datos.pregunta.trim():'';
 const consulta=typeof datos?.consulta==='string'?datos.consulta.trim():'';
 const antecedentes=typeof datos?.antecedentes==='string'?datos.antecedentes.trim():'';
 if(pregunta.length<10||pregunta.length>2000||consulta.length>250||antecedentes.length>3000)throw new Error('Revise la pregunta (10 a 2000 caracteres), la búsqueda complementaria (hasta 250) y los antecedentes (hasta 3000).');
 const consultaAmpliada=derivarBusquedaDoctrinal(pregunta);
 if(!consulta && !consultaAmpliada)throw new Error('La pregunta necesita al menos un concepto concreto para localizar fuentes.');
 return {pregunta,consulta:consulta||consultaAmpliada,consultaAmpliada,antecedentes};
}
export function informeConsultaDoctrina(entrada,recuperacion){
 const fuentes=(recuperacion?.resultados||[]).slice(0,50).map((f,i)=>({referencia:`F${i+1}`,titulo:f.titulo,clase:f.clase||'sin clasificar',version_id:f.version_id,version:f.version,sha256:f.sha256,pagina:f.pagina,fragmento:f.fragmento,estado_texto:f.estado_texto||'sin verificar'}));
 const cobertura=recuperacion?.cobertura||null;
 const sinFuentes=!fuentes.length;
 const mensaje=sinFuentes?'Todavía no hay pasajes consultables que sustenten una respuesta a esta pregunta. Compruebe el estado de indexación, el OCR y las autorizaciones documentales. No es posible determinar una obligación masónica a partir de una búsqueda vacía.':`Se encontraron ${fuentes.length} pasajes relacionados. Puede contrastarlos en sus originales; el análisis generativo requiere fuentes autorizadas y un proveedor disponible.`;
 return {modo:'documental_local',generativo:false,pregunta:entrada.pregunta,consulta:entrada.consulta,cobertura,fuentes,secciones:[{titulo:sinFuentes?'Sin respaldo documental recuperado':'Fuentes documentales disponibles',texto:mensaje}]};
}
