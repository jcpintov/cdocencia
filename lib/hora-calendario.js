export function esHoraAvisoCalendario(ahora=new Date()){
 const partes=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Santiago',hour:'2-digit',hourCycle:'h23'}).formatToParts(ahora);
 return partes.find(p=>p.type==='hour')?.value==='08';
}
