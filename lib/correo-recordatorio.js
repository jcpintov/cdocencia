import { escapar } from './correo-asignacion.js';
const fechaLarga = (valor, zona) => new Intl.DateTimeFormat('es-CL', {day:'numeric',month:'long',year:'numeric',timeZone:zona}).format(new Date(valor));
export function generarCorreoRecordatorio(a) {
 const envio=a.recordatorio?.solicitud_enviada_en;
 if(!envio||Number.isNaN(Date.parse(envio)))throw new Error('La solicitud original no tiene un envío confirmado.');
 const nombre=String(a.nombre||'').replace(/^\s*(?:Q[.·:\s]*H[.·:\s]*|V[.·:\s]*M[.·:\s]*)+/iu,'').trim().toLocaleUpperCase('es-CL');
 const tema=String(a.tema||'').toLocaleUpperCase('es-CL');
 const saludo='Junto con saludar fraternalmente, le recordamos la solicitud enviada el '+fechaLarga(envio,'America/Santiago')+', para preparar el siguiente trabajo del programa de Docencia del Tercer Grado:';
 const datos=[['Tema',tema],['Código',a.codigo],['Fecha de entrega comprometida',fechaLarga(a.fecha_entrega+'T12:00:00Z','UTC')+', hasta las 23:30 horas.']];
 const parrafos=[
  'A la fecha, el trabajo se encuentra pendiente de publicación en nuestra plataforma. Agradeceré nos informe sobre su avance y, si requiere un plazo adicional, nos indique una nueva fecha estimada de entrega.',
  'Desde ya quedo agradecido de su disposición y aporte al trabajo formativo de la Cámara.',
  'Si ya envió su trabajo, agradeceré hacer caso omiso de esta comunicación.'
 ];
 const text='V.·.M.·. \n'+nombre+':\n\n\n\n'+saludo+'\n\n'+datos.map(([k,v])=>k+': '+v).join('\n')+'\n\n'+parrafos.join('\n\n')+'\n\n\n\nFraternalmente,\n\nJulio César Pinto,\n\nORADOR - RL OFL 146';
 const html='<!doctype html><html lang="es"><head><meta charset="UTF-8"></head><body style="font-family:Calibri,Arial,sans-serif;font-size:16px;line-height:1.5;color:#182d3c;margin:24px">'+
 '<p style="margin:0">V.·.M.·.&nbsp;<br>'+escapar(nombre)+':</p><div style="height:32px"></div><p style="margin:0 0 24px">'+escapar(saludo)+'</p><p style="margin:0 0 24px">'+
 datos.map(([k,v])=>'<strong>'+k+':</strong> '+(k==='Tema'?'<strong>'+escapar(v)+'</strong>':escapar(v))).join('<br>')+'</p>'+parrafos.map(p=>'<p style="margin:0 0 24px">'+escapar(p)+'</p>').join('')+
 '<div style="height:8px"></div><p style="margin:0 0 24px">Fraternalmente,</p><p style="margin:0 0 24px"><strong>Julio César Pinto,</strong></p><p style="margin:0">ORADOR - RL OFL 146</p></body></html>';
 return {to:a.email,bcc:'jpintov@gmail.com',subject:'Recordatorio de trabajo de Docencia — '+a.codigo,text,html};
}
