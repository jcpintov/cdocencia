const escapar=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function generarCorreoCalendario(evento){
 const fecha=new Date(evento.fecha+'T12:00:00Z').toLocaleDateString('es-CL',{dateStyle:'long',timeZone:'UTC'});
 const grado=({1:'Aprendiz',2:'Compañero',3:'Maestro'})[evento.grado];
 const subject=`Recordatorio de tenida · ${fecha} · ${grado}`;
 const text=`Julio César:\n\nLe recuerdo que en cinco días está programada la siguiente tenida:\n\nFecha: ${fecha}\nHorario: ${(evento.hora||'20:00').slice(0,5)} horas\nGrado: ${grado}\nTema: ${evento.tema}\nAutor: ${evento.autor}\n\nPuede revisar el calendario en cmaestros.ofl.cl.\n\nFraternalmente,\nOFL.CL`;
 return {to:'jpintov@gmail.com',subject,text,html:'<div style="font-family:Calibri,Arial,sans-serif;color:#172b3a;background:#fff;line-height:1.6">'+text.split('\n\n').map(p=>'<p>'+escapar(p).replace(/\n/g,'<br>')+'</p>').join('')+'</div>'};
}
