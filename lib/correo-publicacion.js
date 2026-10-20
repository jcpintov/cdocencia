import {escapar} from './correo-asignacion.js';
export function generarCorreoPublicacion(a){
 const nombre=String(a.nombre||'').replace(/^\s*(?:Q[.·:\s]*H[.·:\s]*|V[.·:\s]*M[.·:\s]*)+/iu,'').trim();
 const tema=String(a.tema||'').toLocaleUpperCase('es-CL');
 const inicio='QH, '+nombre+', tu trabajo de docencia '+tema+', '+a.codigo+' ha sido publicado. Puedes revisarlo aquí: ';
 const text=inicio+'cmaestros.ofl.cl\n\nFraternalmente,\nOFL.CL';
 const html='<!doctype html><html lang="es"><head><meta charset="UTF-8"></head><body style="font-family:Calibri,Arial,sans-serif;font-size:16px;line-height:1.5;color:#182d3c;margin:24px"><p>'+escapar(inicio)+'<a href="https://cmaestros.ofl.cl">cmaestros.ofl.cl</a></p><p>Fraternalmente,<br>OFL.CL</p></body></html>';
 return {to:a.email,bcc:'jpintov@gmail.com',subject:'Trabajo de docencia publicado — '+a.codigo,text,html};
}
