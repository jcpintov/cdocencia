import test from 'node:test';
import assert from 'node:assert/strict';
import {validarFicha,dividirTrabajo,extraerTrabajo,coincidenciasTrabajo,validarRevision,validarOratoria,generarOratoriaRevisada,pedirJSONTrabajos,exportarOratoria,ROL_ORADOR,promptOrador} from '../lib/trabajos-tenida.js';
import JSZip from 'jszip';
const ficha={tema:'Trabajo sobre la escucha',autor:'Autor de prueba',tenida:'Tenida ordinaria',fecha:'2026-10-22',grado:1,tipo:'ordinaria',uso_ia:'no_informada',nota_ia:''};

test('corrige una oratoria fuera de rango una vez y no reintenta un límite de proveedor',async()=>{
 let llamadas=0;
 const r=await generarOratoriaRevisada(ficha,{}, {pedir:async prompt=>{
  llamadas++;if(llamadas===2)assert.match(prompt,/Revisión obligatoria/);
  return {texto:Array(llamadas===1?100:350).fill('Reflexión').join(' ')};
 }});
 assert.equal(r.palabras,350);assert.equal(llamadas,2);
 llamadas=0;
 await assert.rejects(generarOratoriaRevisada(ficha,{}, {pedir:async()=>{llamadas++;throw Object.assign(Error('Límite'),{status:429});}}),/Límite/);
 assert.equal(llamadas,1);
});

test('una revisión sin pasajes verificables no se presenta como revisión terminada',()=>{
 assert.throws(()=>validarRevision({sintesis:'Resumen sin evidencia comprobable.',pasajes:['Pasaje inventado que no consta en el texto.'],observaciones:[]},{numero:1,texto:'El bloque original examina una idea diferente.'}),/pasaje verificable/);
});

test('las conclusiones ordinarias no reciben el arco de bienvenida ceremonial',()=>{
 const ordinaria=promptOrador(ficha);
 assert.ok(!ordinaria.includes(ROL_ORADOR.calidad_ceremonial.arco));
 assert.ok(ordinaria.includes(ROL_ORADOR.calidad_conclusiones.fidelidad));
 assert.ok(ordinaria.includes(ROL_ORADOR.calidad_conclusiones.criterio));
 assert.ok(ordinaria.includes(ROL_ORADOR.calidad_conclusiones.rigor));
 assert.ok(ordinaria.includes(ROL_ORADOR.calidad_conclusiones.cierre));
 assert.ok(ordinaria.includes(ROL_ORADOR.ejemplos_criticos_conclusiones[0].aprender));
 const ceremonial=promptOrador({...ficha,tipo:'iniciacion'});
 assert.ok(ceremonial.includes(ROL_ORADOR.calidad_ceremonial.arco));
 assert.ok(!ceremonial.includes(ROL_ORADOR.ejemplos_criticos_conclusiones[0].aprender));
});
test('ficha exige tema, autor, fecha y grado sin nombre de tenida duplicado',()=>{
 assert.equal(validarFicha(ficha).tema,ficha.tema);
 for(const k of ['tema','autor','fecha'])assert.throws(()=>validarFicha({...ficha,[k]:''}));
 const {tenida,...sinTenida}=ficha;
 assert.equal(validarFicha(sinTenida).grado,1);
 assert.equal(validarFicha(sinTenida).tenida,'Grado 1 · Aprendiz');
 assert.equal(validarFicha({...sinTenida,grado:2}).tenida,'Grado 2 · Compañero');
 assert.equal(validarFicha({...sinTenida,grado:3}).tenida,'Grado 3 · Maestro');
 assert.throws(()=>validarFicha({...ficha,fecha:'2026-02-30'}));
 assert.throws(()=>validarFicha({...ficha,tipo:'exaltacion',homenajeados:'Hermano'}));
 assert.throws(()=>validarFicha({...ficha,tipo:'iniciacion',homenajeados:''}));
 assert.equal(validarFicha({...ficha,tipo:'iniciacion',homenajeados:'Hermano de prueba'}).grado,1);
});
test('divide sin perder ni duplicar texto y conserva ubicaciones',()=>{
 const texto='Una reflexión con tildes y símbolos. '.repeat(900);const b=dividirTrabajo(texto);assert.equal(b.map(b=>b.texto).join(''),texto);assert.ok(b.every(b=>b.texto.length<=8000));b.forEach(b=>assert.equal(texto.slice(b.inicio,b.fin),b.texto));
});
test('coincidencia textual se distingue de semejanza temática y nunca prueba plagio',()=>{
 const cita='El trabajo de escuchar al otro requiere una disposición constante de la conciencia y una voluntad fraternal que permita comprender sus razones antes de emitir un juicio definitivo';
 const r=coincidenciasTrabajo(cita,[{titulo:'Principios',pagina:2,fragmento:cita.toUpperCase()}]);assert.equal(r.length,1);assert.match(r[0].advertencia,/No acredita plagio/);
 assert.equal(coincidenciasTrabajo('La escucha fraterna es importante para el aprendizaje',[{fragmento:cita}]).length,0);
});
test('descarta pasajes y acusaciones cuyo texto no existe en el trabajo',()=>{
 const bloque={numero:1,texto:'La escucha requiere paciencia y disposición para aprender de nuestros hermanos.'};
 const r=validarRevision({sintesis:'Reflexión sobre la escucha y el aprendizaje.',pasajes:[bloque.texto,'Una cita inventada por el modelo.'],observaciones:[{tipo:'contenido',pasaje:'El autor inventado odia a todos.',explicacion:'Acusación sin respaldo'}]},bloque);assert.equal(r.pasajes.length,1);assert.equal(r.observaciones.length,0);
 assert.throws(()=>validarRevision({sintesis:'x'.repeat(451),pasajes:[],observaciones:[]},bloque));
});
test('oratoria conserva el rango aproximado de tres minutos',()=>{
 const r=validarOratoria({texto:Array(350).fill('reflexión').join(' ')});assert.equal(r.palabras,350);assert.equal(r.minutos,3);
 for(const n of [314,386])assert.throws(()=>validarOratoria({texto:Array(n).fill('palabra').join(' ')}));
 assert.ok(ROL_ORADOR.calidad_ceremonial.unidad.includes('párrafo'));assert.equal(ROL_ORADOR.ceremonias.exaltacion.grado,3);
});
test('no envía textos cuando cambian permisos ni acepta respuestas truncadas',async()=>{
 let llamadas=0;const env={GROQ_API_KEY:'fixture',GROQ_ZDR_CONFIRMADO:'true'};
 await assert.rejects(()=>pedirJSONTrabajos('rol',{}, {env,validar:async()=>false,fetchImpl:async()=>{llamadas++;}}));assert.equal(llamadas,0);
 await assert.rejects(()=>pedirJSONTrabajos('rol',{}, {env,fetchImpl:async()=>({ok:true,json:async()=>({choices:[{finish_reason:'length',message:{content:'{}'}}]})})}),/incompleta/);
});
test('Word exporta solo la oratoria en carta Calibri 12 e interlineado simple; extracción DOCX no inventa páginas',async()=>{
 const texto=Array(350).fill('Reflexión').join(' ');const bytes=await exportarOratoria({datos:{ficha,oratoria:{texto},revision_bloques:[{sintesis:'INFORME PRIVADO NO EXPORTAR'}]}});
 const zip=await JSZip.loadAsync(bytes),xml=await zip.file('word/document.xml').async('string'),styles=await zip.file('word/styles.xml').async('string');
 assert.match(xml,/w:w="12240" w:h="15840"/);assert.match(xml,/w:line="240"/);assert.match(styles,/Calibri/);assert.match(styles,/w:sz w:val="24"/);assert.ok(!xml.includes('INFORME PRIVADO'));
 const e=await extraerTrabajo(bytes,'docx');assert.equal(e.paginas,null);assert.equal(e.exceso_paginas,null);assert.ok(e.texto.includes('Reflexión'));assert.match(e.avisos[0],/visualmente/);
});
test('rechaza documentos ilegibles y contenido excesivo sin truncarlo',async()=>{
 await assert.rejects(()=>extraerTrabajo(Buffer.from('no pdf'),'pdf'),/PDF válido/);
 const z=new JSZip();z.file('word/document.xml','<x/>');await assert.rejects(async()=>extraerTrabajo(await z.generateAsync({type:'nodebuffer'}),'docx'));
});
