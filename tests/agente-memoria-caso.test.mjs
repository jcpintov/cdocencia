import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const ui=readFileSync(new URL('../doctrina-admin.js',import.meta.url),'utf8');
const source=ui.slice(ui.indexOf('function antecedentesCasoDoctrina('),ui.indexOf('async function consultarAgenteDoctrina()'));
const memoria=runInNewContext(source+';antecedentesCasoDoctrina');

test('conserva planteamiento y corrección reciente sin aprender afirmaciones del asistente como hechos',()=>{
 const historial=[{role:'user',content:'Caso inicial: sustitución temporal de un cargo.'},{role:'assistant',content:'NORMA INVENTADA QUE NO DEBE APRENDERSE'}];
 for(let i=0;i<8;i++)historial.push({role:'user',content:`Precisión ${i}: `+'antecedente '.repeat(100)});
 historial.push({role:'user',content:'Corrección final: ocurrió dentro de una tenida, no en una elección.'});
 const m=memoria(historial);
 assert.ok(m.includes('sustitución temporal'));
 assert.ok(m.includes('Corrección final'));
 assert.ok(!m.includes('NORMA INVENTADA'));
 assert.ok(m.includes('No son fuentes doctrinales'));
 assert.ok(m.length<=3000);
 assert.equal(memoria([]),'');
});
