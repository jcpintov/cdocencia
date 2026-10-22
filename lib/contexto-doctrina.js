import {createHash} from 'node:crypto';
// Contexto estable antes de preguntar: principios completos y mapa documental.
// Los artículos completos se leen por página, sin exigir coincidencias léxicas.
export async function cargarContextoDoctrina({rpc}) {
 const r=await rpc('texto_contexto',{});
 if(!Array.isArray(r?.paginas)||!r.paginas.length)return null;
 const paginas=r.paginas;
 const documentos=[...new Map(paginas.map(p=>[p.version_id,{id:p.version_id,titulo:p.titulo,clase:p.clase}])).values()];
 documentos.forEach((d,i)=>d.codigo='D'+(i+1));
 const porId=new Map(documentos.map(d=>[d.id,d.codigo]));
 const principios=paginas.filter(p=>p.titulo==='PRINCIPIOS DE LA MASONERÍA').map(p=>p.fragmento).join('\n');
 const catalogo=documentos.map(d=>`${d.codigo}: ${d.titulo} (${d.clase})`).join('\n');
 const mapa=paginas.filter(p=>p.clase==='normativa' && /CONSTITUCIÓN|JUSTICIA/.test(p.titulo)).flatMap(p=>{
  const articulos=[...p.fragmento.matchAll(/^(?:Art[íi]culo|Art\.)\s*\d+(?:\.\d+)?[^\n]{0,100}/gm)].map(m=>m[0].replace(/^(?:Artículo|Art\.)\s*/, '').slice(0,/Venerable|VENERABLE/.test(m[0])?64:12));
  return articulos.length ? [`${porId.get(p.version_id)} p${p.pagina}: ${articulos.join('; ')}`] : [];
 }).join('\n');
 const nucleo=paginas.filter(p=>p.version_id==='adce9f1f-c193-42f1-83fa-9600a9154a29' && [6,14,28,84,85,104].includes(p.pagina)).map(p=>({documento:porId.get(p.version_id),pagina:p.pagina,texto:p.fragmento.slice(0,900)}));
 const ambiente={principios,nucleo,catalogo,mapa_normativo:mapa};
 const fuentes=paginas.map(({version_id,sha256,pagina})=>({version_id,sha256,pagina}));
 const reserva=await rpc('texto_llm_reservar',{fuentes,hash:createHash('sha256').update(JSON.stringify(ambiente)).digest('hex')});
 if(!reserva?.ok)throw Error(reserva?.mensaje||'No se pudo preparar el contexto documental.');
 return {ambiente,paginas,documentos,fuentes,reserva};
}
