/* Feriados nacionales de Chile, 2026–2027. Sin llamadas a servicios externos.
   Fuentes: Gobierno de Chile (calendario 2026), leyes 19.668, 20.299 y 20.983;
   calendario litúrgico de la Conferencia Episcopal. No incluye feriados regionales. */
(function(){
 const comunes={'01-01':'Año Nuevo','05-01':'Día del Trabajo','05-21':'Día de las Glorias Navales','07-16':'Día de la Virgen del Carmen','08-15':'Asunción de la Virgen','09-18':'Independencia Nacional','09-19':'Día de las Glorias del Ejército','11-01':'Día de Todos los Santos','12-08':'Inmaculada Concepción','12-25':'Navidad'};
 const variables={2026:{'04-03':'Viernes Santo','04-04':'Sábado Santo','06-21':'Día Nacional de los Pueblos Indígenas','06-29':'San Pedro y San Pablo','10-12':'Encuentro de Dos Mundos','10-31':'Día Nacional de las Iglesias Evangélicas y Protestantes'},2027:{'03-26':'Viernes Santo','03-27':'Sábado Santo','06-21':'Día Nacional de los Pueblos Indígenas','06-28':'San Pedro y San Pablo','09-17':'Feriado adicional de Fiestas Patrias','10-11':'Encuentro de Dos Mundos','10-31':'Día Nacional de las Iglesias Evangélicas y Protestantes'}};
 window.feriadosCalendarioChile=year=>variables[year]?Object.fromEntries(Object.entries({...comunes,...variables[year]}).map(([dia,nombre])=>[year+'-'+dia,nombre])):null;
})();
