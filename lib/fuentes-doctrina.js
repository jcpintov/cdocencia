/* Jerarquía editorial: normativa se conserva como categoría de almacenamiento. */
export const PRIORIDAD_DOCTRINA = Object.freeze({
  normativa: 0,
  reglamento: 0,
  doctrina: 1,
  docencia: 2,
  tradicion: 3,
  bibliografia: 4
});

export function seleccionarFuentes(candidatas, permisos, {bibliografia = false} = {}) {
  const autorizadas = candidatas.filter(f =>
    f?.fragmento?.trim() && typeof f.version_id === 'string' &&
    typeof f.sha256 === 'string' && permisos.has(f.version_id) && permisos.get(f.version_id) === f.sha256 &&
    (f.relevancia == null || f.relevancia > 0) &&
    (bibliografia ? f.clase === 'bibliografia' : PRIORIDAD_DOCTRINA[f.clase] < 4)
  );
  const unicas = [...new Map(autorizadas.map(f => [`${f.version_id}:${f.pagina}`, f])).values()];
  unicas.sort((a, b) => PRIORIDAD_DOCTRINA[a.clase] - PRIORIDAD_DOCTRINA[b.clase] ||
    Number(b.relevancia || 0) - Number(a.relevancia || 0));

  const elegidas = [];
  const porDocumento = new Map();
  const cubiertas = new Set();
  while (elegidas.length < 6) {
    const disponibles = unicas.filter(f => !elegidas.includes(f) && (porDocumento.get(f.version_id) || 0) < 4);
    if (!disponibles.length) break;
    disponibles.sort((a,b) => PRIORIDAD_DOCTRINA[a.clase] - PRIORIDAD_DOCTRINA[b.clase] ||
      Number((b.busquedas || []).some(i => !cubiertas.has(i))) - Number((a.busquedas || []).some(i => !cubiertas.has(i))) ||
      Number(b.relevancia || 0) - Number(a.relevancia || 0));
    const fuente = disponibles[0];
    elegidas.push(fuente);
    porDocumento.set(fuente.version_id, (porDocumento.get(fuente.version_id) || 0) + 1);
    (fuente.busquedas || []).forEach(i => cubiertas.add(i));
  }
  return elegidas.map((fuente, i) => ({
    ...fuente, referencia: `F${i + 1}`, fragmento: fuente.fragmento.slice(0, 1500)
  }));
}
