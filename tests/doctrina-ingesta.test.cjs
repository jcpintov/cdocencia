#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const app = fs.readFileSync('app.js','utf8');
new vm.Script(app,{filename:'app.js'});
const start = app.indexOf('let manifiestoDoctrinaPendiente = [];');
const end = app.indexOf('/* ==========================================================================\n   DOCTRINA Y REGLAMENTOS',start);
assert(start>0&&end>start,'Bloque de recepción doctrinal local localizado');

function tablaFake(){
 return {rows:[],replaceChildren(){this.rows=[];},insertRow(){
   const row={cells:[],insertCell(){
     const c={textContent:'',title:'',colSpan:1};
     this.cells.push(c); return c;
   }};
   this.rows.push(row); return row;
 }};
}
const bytesPdf=Buffer.from('%PDF-1.7\nContenido del documento de prueba');
const archivo=(name,buffer)=>({name,size:buffer.length,type:'application/pdf',
  async arrayBuffer(){return buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength)}});
const elems={
 doctrinaArchivos:{files:[
   archivo('normativa.pdf',bytesPdf), archivo('duplicado.pdf',bytesPdf),
   archivo('engaño.pdf',Buffer.from('No es PDF')), archivo('malware.docx',bytesPdf)
 ],value:'seleccionado'},
 tablaRecepcionDoctrina:tablaFake(),
 estadoRecepcionDoctrina:{textContent:''},
 btnExportarManifiestoDoctrina:{disabled:true},
 doctrinaFuenteTipo:{value:'oficial_gran_logia_chile'},
 doctrinaEmisorAutor:{value:'Entidad emisora oficial'},
 doctrinaInstitucion:{value:'Institución emisora'},
 doctrinaReferenciaFuente:{value:'Archivo de documentos institucionales, ref. 2026'},
 doctrinaEdicion:{value:'edición cotejable'},
 doctrinaFechaFuente:{value:'2026'},
 doctrinaFundamento:{value:'Documento oficial pendiente de contraste con un registro institucional identificable.'},
 doctrinaDerechos:{value:'Derechos institucionales pendientes de verificación'},
 doctrinaClase:{value:'normativa'},
 doctrinaContextoGrado:{value:'general'},
 doctrinaClasificacion:{value:'reservado'},
 doctrinaAutorizaExterno:{checked:true},
 doctrinaReferencia:{value:'Lote de prueba'}
};
const contexto={
 document:{getElementById:id=>elems[id]||null},
 usuarioActual:{es_admin:true},
 crypto:webcrypto,
 Uint8Array,console
};
vm.createContext(contexto);
vm.runInContext(app.slice(start,end),contexto);
const test=vm.runInContext('({prepararLoteDoctrinal,limpiarRecepcionDoctrina,obtener:()=>manifiestoDoctrinaPendiente})',contexto);
(async()=>{
 await test.prepararLoteDoctrinal();
 const lote=[...test.obtener()];
 assert.equal(lote.length,1,'Solo un PDF único válido');
 assert.equal(elems.tablaRecepcionDoctrina.rows.length,4);
 assert.equal(elems.btnExportarManifiestoDoctrina.disabled,false);
 const d=lote[0];
 assert.equal(d.fuente_tipo,'oficial_gran_logia_chile');
 assert.equal(d.grado_minimo,'M');
 assert.equal(d.estado,'solo_catalogo');
 assert.equal(d.autorizacion_procesamiento_externo,false);
 assert.equal(d.autorizacion_externa_solicitada_lote,true);
 assert.equal(d.publicacion_permitida,false);
 assert.equal(d.respuestas_habilitadas,false);
 assert.equal(d.revision_procedencia,'pendiente');
 assert.equal(d.revision_correlacion,'pendiente');
 assert.equal(d.revision_respuestas,'pendiente');
 assert.equal(d.revision_seguridad,'pendiente');
 assert.match(d.sha256,/^[0-9a-f]{64}$/);

 elems.doctrinaFuenteTipo.value='';
 await test.prepararLoteDoctrinal();
 assert.equal(test.obtener().length,0,'La falta de fuente impide preingesta');
 assert.equal(elems.btnExportarManifiestoDoctrina.disabled,true);

 elems.doctrinaFuenteTipo.value='literatura_reaa_confiable';
 contexto.usuarioActual.es_admin=false;
 await test.prepararLoteDoctrinal();
 assert.equal(test.obtener().length,0,'USER no puede preparar');
 contexto.usuarioActual.es_admin=true;
 test.limpiarRecepcionDoctrina(true);
 assert.equal(elems.doctrinaEmisorAutor.value,'');
 assert.equal(elems.doctrinaFuenteTipo.value,'');
 assert.equal(elems.doctrinaAutorizaExterno.checked,false);
 assert.equal(elems.doctrinaArchivos.value,'');
 assert.equal(test.obtener().length,0);
 console.log('PASS: procedencia obligatoria, PDF verificado, duplicados, guard USER, cuarentena, limpieza de sesión');
})().catch(e=>{console.error(e);process.exitCode=1;});
