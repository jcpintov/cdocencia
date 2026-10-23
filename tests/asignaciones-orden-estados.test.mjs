import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../asignaciones-admin.js',import.meta.url),'utf8');
function reglas(now){
 const FixedDate=class extends Date{constructor(...args){super(...(args.length?args:[now]));}};
 return runInNewContext(source.slice(source.indexOf(' const hoy='),source.indexOf(' function mas21'))+source.slice(source.indexOf(' function estaEntregado('),source.indexOf(' window.renderizarCronogramaAdmin='))+'\n({estadoTrabajo,ordenarAsignaciones})',{Date:FixedDate,Intl});
}
const trabajo=(codigo,entrega,subida)=>({codigo,nombre:codigo,vigente:true,fecha_entrega:entrega,recordatorio:{publicado:!!subida,trabajos_publicados:subida?[{fecha_subida:subida}]:[]}});
test('rojo comienza a medianoche del vencimiento en Santiago, verde prevalece sobre vencimiento',()=>{
 const a=trabajo('HOY','2026-10-22');assert.equal(reglas('2026-10-22T02:59:59Z').estadoTrabajo(a),'Pendiente');
 const r=reglas('2026-10-22T03:00:00Z');assert.equal(r.estadoTrabajo(a),'Vencido');assert.equal(r.estadoTrabajo(trabajo('FUTURO','2026-10-23')),'Pendiente');assert.equal(r.estadoTrabajo(trabajo('SUBIDO','2026-10-01','2026-10-21T20:00:00Z')),'Publicado');
});
test('pendientes por entrega ascendente, publicados al final por subida descendente, anuladas últimas',()=>{
 const {ordenarAsignaciones}=reglas('2026-10-21T15:00:00Z');
 const list=[trabajo('SUBIDO_ANTIGUO','2026-12-30','2026-10-19T14:00:00Z'),trabajo('FUTURO','2026-11-10'),trabajo('SUBIDO_RECIENTE','2026-10-01','2026-10-21T14:00:00Z'),trabajo('VENCIDO','2026-10-20'),{...trabajo('ANULADA','2026-10-01'),vigente:false},trabajo('HOY','2026-10-21')];
 assert.deepEqual(list.sort(ordenarAsignaciones).map(a=>a.codigo),['VENCIDO','HOY','FUTURO','SUBIDO_RECIENTE','SUBIDO_ANTIGUO','ANULADA']);
});

test('entrega manual prevalece sobre atraso, publicado conserva su identidad y entregados quedan al final',()=>{
 const r=reglas('2026-10-23T12:00:00Z');const manual={...trabajo('MANUAL','2026-10-01'),entregado_el:'2026-10-22',entrega_registrada_en:'2026-10-22T18:00:00Z'};
 assert.equal(r.estadoTrabajo(manual),'Entregado');assert.equal(r.estadoTrabajo({...manual,recordatorio:{publicado:true}}),'Publicado');
 assert.deepEqual([manual,trabajo('PENDIENTE','2026-10-24')].sort(r.ordenarAsignaciones).map(a=>a.codigo),['PENDIENTE','MANUAL']);
});
