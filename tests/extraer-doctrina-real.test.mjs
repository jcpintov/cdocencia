import test from 'node:test';
import assert from 'node:assert/strict';
import {extraerDoctrina} from '../lib/extraer-doctrina.js';
function pdfSintetico(){
 const stream='BT /F1 12 Tf 72 720 Td (Texto sintetico de prueba) Tj ET';
 const objetos=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 let pdf='%PDF-1.4\n',offsets=[0];objetos.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=Buffer.byteLength(pdf);pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return Buffer.from(pdf);
}
test('motor PDF real extrae una página sintética sin aprobarla ni alterar el texto original',async()=>{
 const r=await extraerDoctrina(pdfSintetico());assert.equal(r.total_paginas,1);assert.match(r.paginas[0].texto,/Texto sintetico de prueba/);assert.equal(r.paginas[0].texto,r.paginas[0].texto_original);assert.equal(r.paginas[0].revisada,false);assert.equal(r.requieren_ocr,0);
});
