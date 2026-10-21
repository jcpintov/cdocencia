/* Informe documental local: no transmite contenido ni ejecuta instrucciones de las fuentes. */
export function prepararConsultaAgente(datos){
 const pregunta=typeof datos.pregunta==='string'?datos.pregunta.trim():'';
 const consulta=typeof datos.consulta==='string'?datos.consulta.trim():'';
 const antecedentes=typeof datos.antecedentes==='string'?datos.antecedentes.trim():'';
 if(pregunta.length<10||pregunta.length>2000||consulta.length<3||consulta.length>250||antecedentes.length>3000)throw new Error('Revise la pregunta (10 a 2000 caracteres), los términos de búsqueda (3 a 250) y los antecedentes (hasta 3000).');
 return {pregunta,consulta,antecedentes};
}
export function informeConsultaDoctrina(entrada,recuperacion){
 const fuentes=(recuperacion.resultados||[]).slice(0,50).map((f,i)=>({referencia:`F${i+1}`,titulo:f.titulo,clase:f.clase||'sin clasificar',version_id:f.version_id,version:f.version,sha256:f.sha256,pagina:f.pagina,fragmento:f.fragmento}));
 const cobertura=recuperacion.cobertura;
 const secciones=[
  {titulo:'Alcance',texto:`Consulta: ${entrada.pregunta}\nInforme documental local sobre coincidencias en textos aprobados. No realiza una interpretación institucional ni una decisión disciplinaria.`},
  {titulo:'Antecedentes aportados',texto:entrada.antecedentes?`Alegaciones del consultante, sin verificación independiente:\n${entrada.antecedentes}`:'No se aportaron antecedentes del caso. No se presumen hechos.'},
  {titulo:'Fuentes y vigencia',texto:fuentes.length?`Se recuperaron ${fuentes.length} pasajes. Las referencias corresponden a la versión vigente con extracción aprobada al consultar. El número de página corresponde al PDF. Revise el contexto en el original.`:'No se encontraron pasajes coincidentes en el corpus consultable.'},
  {titulo:'Tradición y límites',texto:'La clasificación de un documento no acredita por sí sola competencia normativa. La tradición aporta contexto; la bibliografía y la doctrina no sustituyen una disposición institucional competente y vigente.'},
  {titulo:'Hipótesis',texto:'No se formulan hipótesis automáticamente a partir de coincidencias textuales.'},
  {titulo:'Examen doctrinal y ético',texto:'Pendiente de análisis: identifique el sujeto, el deber, la competencia, las condiciones y excepciones aplicables. Los extractos se ofrecen como antecedentes, sin deducir obligaciones.'},
  {titulo:'Objeciones y contraste',texto:'Contraste los pasajes con el documento completo, las excepciones y las disposiciones posteriores. La búsqueda léxica puede omitir sinónimos y no determina contradicciones ni derogaciones.'},
  {titulo:'Conclusión condicionada',texto:fuentes.length?'Hay antecedentes textuales para revisar. No se puede afirmar que resuelvan la consulta sin examinar su contexto y aplicabilidad.':'Indeterminado: no hay respaldo recuperado suficiente para resolver la consulta. La ausencia de coincidencias no demuestra ausencia de una disposición.'},
  {titulo:'Nivel de evidencia',texto:'Evidencia documental recuperada, sin inferencia semántica ni validación independiente de los hechos. Hasta 50 pasajes; el resultado no garantiza exhaustividad.'},
  {titulo:'Preguntas pendientes',texto:'¿Qué hechos están acreditados? ¿Qué órgano tiene competencia? ¿Qué disposición y artículo se aplican? ¿Existen excepciones, fuentes contrapuestas o versiones posteriores?'}
 ];
 return {modo:'documental_local',generativo:false,pregunta:entrada.pregunta,consulta:entrada.consulta,cobertura,fuentes,secciones};
}
