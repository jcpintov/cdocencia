#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { validarManifiesto } = require('../scripts/validar-manifiesto-doctrina.cjs');
function ficha() {
  return {
    titulo: 'Obra doctrinal de prueba', archivo_original: 'texto-test.pdf', bytes: 1024,
    mime: 'application/pdf', sha256: 'a'.repeat(64),
    fuente_tipo: 'literatura_reaa_confiable',
    emisor_autor: 'Autor registrado',
    institucion_editorial: 'Editorial identificada',
    referencia_fuente: 'Registro verificable de biblioteca especializada',
    fundamento_confiabilidad: 'Obra relacionada al Rito Escocés Antiguo y Aceptado, con fuente editorial contrastable.',
    licencia_derechos: 'Pendiente de comprobación',
    grado_minimo: 'M', contexto_grado: 'maestro',
    revision_procedencia: 'pendiente', revision_correlacion: 'pendiente',
    revision_respuestas: 'pendiente', revision_seguridad: 'pendiente',
    estado: 'solo_catalogo', publicacion_permitida: false, respuestas_habilitadas: false,
    autorizacion_procesamiento_externo: false, objeto_storage: null
  };
}
function lote(docs) { return {formato:'doctrina-manifiesto-v1', transferencia_realizada:false, documentos:docs}; }
const bien = validarManifiesto(lote([ficha()]));
assert.equal(bien.valido_para_cuarentena, true);
assert.equal(bien.habilita_publicacion, false);
assert.equal(bien.dictamen, 'PREINGESTA LOCAL, NO PUBLICABLE');

for (const [campo,valor] of [
 ['fuente_tipo','desconocido'], ['sha256','corto'], ['estado','vigente'],
 ['publicacion_permitida',true], ['autorizacion_procesamiento_externo',true],
 ['respuestas_habilitadas',true], ['revision_procedencia','verificada'],
 ['revision_correlacion','verificada'], ['objeto_storage','bucket/objeto.pdf'],
 ['grado_minimo','A'], ['referencia_fuente',''], ['fundamento_confiabilidad',''],
 ['mime','application/javascript'], ['archivo_original','malware.exe']
]) {
 const d=ficha(); d[campo]=valor;
 const result=validarManifiesto(lote([d]));
 assert.equal(result.valido_para_cuarentena,false,campo+' debe rechazar la preingesta');
 assert.equal(result.habilita_publicacion,false);
}
const duplicado=validarManifiesto(lote([ficha(),ficha()]));
assert.equal(duplicado.valido_para_cuarentena,false,'no aceptar duplicados');
assert.equal(validarManifiesto(lote([])).valido_para_cuarentena,false);
assert.equal(validarManifiesto({formato:'inventado',transferencia_realizada:true,documentos:[ficha()]}).valido_para_cuarentena,false);
console.log('PASS: manifiesto estricto, fuente confiable declarada, deduplicación y publicación siempre cerrada');
