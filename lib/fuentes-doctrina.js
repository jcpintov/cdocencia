/* Jerarquía editorial: normativa se conserva como categoría de almacenamiento. */
export const PRIORIDAD_DOCTRINA = Object.freeze({
  normativa: 0,
  reglamento: 0,
  doctrina: 1,
  docencia: 2,
  tradicion: 3,
  bibliografia: 4
});

// Las divisiones corresponden a esta versión verificada del original, no a
// cualquier PDF futuro que comparta su título. La página 5 contiene ambas secciones.
export function prioridadNormativa(f) {
  if (!['normativa','reglamento'].includes(f.clase)) return 0;
  if (Number.isInteger(f.prioridad_normativa)) return f.prioridad_normativa;
  const t=String(f.titulo||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(f.version_id==='adce9f1f-c193-42f1-83fa-9600a9154a29')
    return f.pagina>=4 && f.pagina<=5 ? 0 : f.pagina>=6 && f.pagina<=21 ? 1 : 2;
  if (/principios/.test(t) && !/constitucion|reglamento/.test(t)) return 0;
  if (/constitucion/.test(t) && !/reglamento general/.test(t)) return 1;
  if (/reglamento general/.test(t)) return 2;
  if (/justicia/.test(t)) return 3;
  return 4;
}
const autoridad=(a,b)=>PRIORIDAD_DOCTRINA[a.clase]-PRIORIDAD_DOCTRINA[b.clase] || prioridadNormativa(a)-prioridadNormativa(b);

export function seleccionarFuentes(candidatas, permisos, {bibliografia = false} = {}) {
  const autorizadas = candidatas.filter(f =>
    f?.fragmento?.trim() && typeof f.version_id === 'string' &&
    typeof f.sha256 === 'string' && permisos.has(f.version_id) && permisos.get(f.version_id) === f.sha256 &&
    (f.relevancia == null || f.relevancia > 0) &&
    (bibliografia ? f.clase === 'bibliografia' : PRIORIDAD_DOCTRINA[f.clase] < 4)
  );
  const unicas = [...new Map(autorizadas.map(f => [`${f.version_id}:${f.pagina}`, f])).values()];
  unicas.sort((a, b) => autoridad(a,b) ||
    Number(b.relevancia || 0) - Number(a.relevancia || 0));

  const elegidas = [];
  const porDocumento = new Map();
  const cubiertas = new Set();
  const porNivel = new Map();
  const nivel = f => `${f.version_id}:${prioridadNormativa(f)}`;
  const clasificada = f => Number.isInteger(f.prioridad_normativa) || f.version_id==='adce9f1f-c193-42f1-83fa-9600a9154a29';
  while (elegidas.length < 6) {
    const disponibles = unicas.filter(f => !elegidas.includes(f) && (porDocumento.get(f.version_id) || 0) < 6 &&
      (!clasificada(f) || (porNivel.get(nivel(f)) || 0) < 2));
    if (!disponibles.length) break;
    disponibles.sort((a,b) => autoridad(a,b) ||
      Number((b.busquedas || []).some(i => !cubiertas.has(i))) - Number((a.busquedas || []).some(i => !cubiertas.has(i))) ||
      Number(b.relevancia || 0) - Number(a.relevancia || 0));
    const fuente = disponibles[0];
    elegidas.push(fuente);
    porNivel.set(nivel(fuente), (porNivel.get(nivel(fuente)) || 0) + 1);
    porDocumento.set(fuente.version_id, (porDocumento.get(fuente.version_id) || 0) + 1);
    (fuente.busquedas || []).forEach(i => cubiertas.add(i));
  }
  return elegidas.map((fuente, i) => ({
    ...fuente, referencia: `F${i + 1}`, fragmento: fuente.fragmento.slice(0, 1500)
  }));
}
