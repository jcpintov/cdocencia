#!/usr/bin/env node
'use strict';
// Validación local de un manifiesto de preingesta de Doctrina OFL146.
// No transfiere archivos ni determina autenticidad; nunca publica contenido.
const fs = require('node:fs');
const allowedSources = new Set(['oficial_gran_logia_chile', 'literatura_reaa_confiable']);
const reviews = ['revision_procedencia','revision_correlacion','revision_respuestas','revision_seguridad'];

function validarManifiesto(manifiesto) {
  const errores = [], alertas = [];
  if (!manifiesto || manifiesto.formato !== 'doctrina-manifiesto-v1')
    errores.push('Formato de manifiesto incompatible');
  if (manifiesto?.transferencia_realizada !== false)
    errores.push('El manifiesto debe declarar transferencia_realizada=false');
  const docs = Array.isArray(manifiesto?.documentos) ? manifiesto.documentos : [];
  if (!docs.length) errores.push('No hay documentos para preingesta');
  const hashes = new Set();
  for (const [i,d] of docs.entries()) {
    const p = 'Documento ' + (i+1) + ': ';
    if (!d || typeof d !== 'object') { errores.push(p+'estructura inválida'); continue; }
    if (!/\.pdf$/i.test(d.archivo_original || '') || d.mime !== 'application/pdf')
      errores.push(p+'solo se admite PDF declarado');
    if (!Number.isSafeInteger(d.bytes) || d.bytes <= 0 || d.bytes > 128 * 1024 * 1024)
      errores.push(p+'bytes inválidos o fuera de límite');
    if (!/^[0-9a-f]{64}$/.test(d.sha256 || '')) errores.push(p+'SHA-256 inválido');
    else if (hashes.has(d.sha256)) errores.push(p+'duplicado exacto dentro del lote');
    else hashes.add(d.sha256);
    if (!allowedSources.has(d.fuente_tipo))
      errores.push(p+'tipo de fuente no admitido');
    for (const [clave,min] of [['emisor_autor',3],['institucion_editorial',3],['referencia_fuente',8],['fundamento_confiabilidad',30]]) {
      if (typeof d[clave] !== 'string' || d[clave].trim().length < min)
        errores.push(p+'falta '+clave+' verificable');
    }
    if (d.grado_minimo !== 'M')
      errores.push(p+'audiencia debe permanecer unificada en Maestros');
    if (!['general','aprendiz','companero','maestro','mixto'].includes(d.contexto_grado))
      errores.push(p+'contexto temático inválido');
    if (d.estado !== 'solo_catalogo' || d.publicacion_permitida !== false ||
        d.autorizacion_procesamiento_externo !== false || d.respuestas_habilitadas !== false ||
        d.objeto_storage !== null) errores.push(p+'violación de cuarentena o uso externo');
    for (const campo of reviews) {
      if (d[campo] !== 'pendiente') errores.push(p+campo+' debe iniciar pendiente');
    }
    if (!d.licencia_derechos || /pendiente/i.test(d.licencia_derechos)) {
      alertas.push(p+'derechos requieren comprobación individual');
    }
    alertas.push(p+'fuente declarada sin verificación institucional; revisión humana obligatoria');
  }
  return { valido_para_cuarentena: errores.length === 0, habilita_publicacion: false,
    documentos: docs.length, errores, alertas,
    dictamen: errores.length ? 'RECHAZAR PREINGESTA' : 'PREINGESTA LOCAL, NO PUBLICABLE' };
}
if (require.main === module) {
  const archivo = process.argv[2];
  if (!archivo) {
    process.stderr.write('Uso: node scripts/validar-manifiesto-doctrina.cjs <manifiesto.json>\n');
    process.exitCode = 2;
  } else {
    try {
      const r = validarManifiesto(JSON.parse(fs.readFileSync(archivo, 'utf8')));
      process.stdout.write(JSON.stringify(r, null, 2) + '\n');
      if (!r.valido_para_cuarentena) process.exitCode = 1;
    } catch (e) {
      process.stderr.write('No se pudo validar el manifiesto: ' + e.message + '\n');
      process.exitCode = 2;
    }
  }
}
module.exports = { validarManifiesto };
