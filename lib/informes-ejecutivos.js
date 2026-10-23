// Lecturas completas y ordenadas: nunca interpretar una página parcial como ausencia.
export async function leerPaginas(crearConsulta,{signal,tamano=500,maximo=100000}={}){
 const filas=[];
 for(let desde=0;desde<maximo;desde+=tamano){
  signal?.throwIfAborted();
  const {data,error}=await crearConsulta().range(desde,desde+tamano-1).abortSignal(signal);
  if(error)throw Object.assign(new Error('Lectura no disponible'),{code:error.code});
  if(!Array.isArray(data))throw new Error('Respuesta de datos inválida');
  filas.push(...data);
  if(data.length<tamano)return filas;
 }
 throw new Error('El informe supera el tamaño permitido; no se entregan datos parciales');
}
export function maestrosVigentes(usuarios){
 return usuarios.filter(u=>!u.es_admin&&!u.cuenta_eliminada&&String(u.email||'').trim().toLowerCase()!=='dummy@ofl.cl')
  .sort((a,b)=>String(a.nombre||'').localeCompare(String(b.nombre||''),'es'));
}
export function resumirAvances(usuarios,modulos,progresos){
 const vigentes=new Set(modulos.map(m=>m.id));
 const porUsuario=new Map();
 for(const p of progresos){
  if(!vigentes.has(p.modulo_id))continue;
  if(!porUsuario.has(p.usuario_id))porUsuario.set(p.usuario_id,new Map());
  const mapa=porUsuario.get(p.usuario_id),previo=mapa.get(p.modulo_id);
  // Un módulo cuenta una sola vez aunque existan registros históricos duplicados.
  mapa.set(p.modulo_id,{leido:!!(p.leido||previo?.leido),completado:!!(p.completado||previo?.completado)});
 }
 return maestrosVigentes(usuarios).map(u=>{
  const avances=[...(porUsuario.get(u.id)?.values()||[])];
  const completados=avances.filter(p=>p.completado).length;
  return {nombre:u.nombre,total:modulos.length,leidos:avances.filter(p=>p.leido||p.completado).length,
   completados,pendientes:modulos.length-completados,porcentaje:modulos.length?Math.round(completados/modulos.length*100):0};
 });
}
export function resumirActividad(usuarios,accesos){
 const mapa=new Map();
 for(const a of accesos){
  const tiempo=Date.parse(a.creado_en);if(!Number.isFinite(tiempo))throw new Error('Registro de acceso sin fecha verificable');
  const previo=mapa.get(a.usuario_id)||{ingresos:0,ultimo:null};previo.ingresos++;
  if(!previo.ultimo||tiempo>Date.parse(previo.ultimo))previo.ultimo=a.creado_en;
  mapa.set(a.usuario_id,previo);
 }
 const filas=maestrosVigentes(usuarios).map(u=>({nombre:u.nombre,...(mapa.get(u.id)||{ingresos:0,ultimo:null})}));
 return {con_actividad:filas.filter(f=>f.ingresos>0),sin_actividad:filas.filter(f=>f.ingresos===0)};
}
