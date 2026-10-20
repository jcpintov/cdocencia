export const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function jerarquia(valor){
 const original=String(valor||'');
 if(original!==original.toLocaleUpperCase('es-CL'))return original;
 return original.toLocaleLowerCase('es-CL')
  .replace(/(^|:\s*|^\d+(?:\.\d+)*\s+)([a-záéíóúñ])/gu,(_m,p,c)=>p+c.toLocaleUpperCase('es-CL'))
  .replace(/\bgrado\b/gu,'Grado').replace(/\bhiram\b/gu,'Hiram').replace(/\bchile\b/gu,'Chile');
}
export function generarCorreoAsignacion(a) {
 const nombre=String(a.nombre||'').replace(/^\s*(?:Q[.·:\s]*H[.·:\s]*|V[.·:\s]*M[.·:\s]*)+/iu,'').trim().toLocaleUpperCase('es-CL');
 const tema=String(a.tema||'').toLocaleUpperCase('es-CL');
 const fecha=new Intl.DateTimeFormat('es-CL',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(a.fecha_entrega+'T12:00:00Z'));
 const plazo=fecha+', hasta las 23:30 horas.';
 const saludo='Junto con saludar fraternalmente, y de acuerdo al programa de Docencia del Tercer Grado, le solicitamos preparar el siguiente trabajo para contribuir al estudio y la reflexión de nuestra Cámara de Maestros:';
 const gracias='Desde ya quedo agradecido de su disposición y aporte al trabajo formativo de la Cámara.';
 const lineamientos=[
 ['Extensión','hasta 4 planas tamaño carta.'],
 ['Fuente','Calibri, tamaño 12.'],
 ['Interlineado','1,5.'],
 ['Fuentes y citas','las fuentes utilizadas y las citas deberán identificarse a pie de página.'],
 ['Uso de inteligencia artificial','está permitido. Si utiliza estas herramientas, deberá indicar a pie de página la plataforma empleada y el prompt o consulta utilizado.']
 ];
 const datos=[['Tema',tema],['Unidad',jerarquia(a.unidad)],['Subunidad',jerarquia(a.subunidad)],['Código',a.codigo],['Fecha de entrega',plazo]];
 const text='V.·.M.·. \n'+nombre+':\n\n\n\n'+saludo+'\n\n'+datos.map(([k,v])=>k+': '+v).join('\n')+
 '\n\nPara su elaboración, considere los siguientes lineamientos:\n\n'+lineamientos.map(([k,v])=>'- '+k+': '+v).join('\n')+
 '\n\n\n\n'+gracias+'\n\nFraternalmente,\n\nJulio César Pinto,\n\nORADOR - RL OFL 146';
 const html='<!doctype html><html lang="es"><head><meta charset="UTF-8"></head><body style="font-family:Calibri,Arial,sans-serif;font-size:16px;line-height:1.5;color:#182d3c;margin:24px">'+
 '<p style="margin:0">V.·.M.·.&nbsp;<br>'+escapar(nombre)+':</p><div style="height:32px"></div>'+
 '<p style="margin:0 0 24px">'+saludo+'</p><p style="margin:0 0 24px">'+
 datos.map(([k,v])=>'<strong>'+k+':</strong> '+(k==='Tema'?'<strong>'+escapar(v)+'</strong>':escapar(v))).join('<br>')+'</p>'+
 '<p style="margin:0 0 12px">Para su elaboración, considere los siguientes lineamientos:</p><ul style="margin:0;padding-left:24px">'+
 lineamientos.map(([k,v])=>'<li><strong>'+k+':</strong> '+v+'</li>').join('')+'</ul><div style="height:32px"></div>'+
 '<p style="margin:0 0 24px">'+gracias+'</p><p style="margin:0 0 24px">Fraternalmente,</p>'+
 '<p style="margin:0 0 24px"><strong>Julio César Pinto,</strong></p><p style="margin:0">ORADOR - RL OFL 146</p></body></html>';
 return {to:a.email,bcc:'jpintov@gmail.com',subject:'Solicitud de trabajo docente · '+a.codigo+' · '+tema,text,html};
}
