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
  for (const fuente of unicas) {
    const cantidad = porDocumento.get(fuente.version_id) || 0;
    if (cantidad >= 3) continue;
    elegidas.push(fuente);
    porDocumento.set(fuente.version_id, cantidad + 1);
    if (elegidas.length === 6) break;
  }
  return elegidas.map((fuente, i) => ({
    ...fuente, referencia: `F${i + 1}`, fragmento: fuente.fragmento.slice(0, 1500)
  }));
}
