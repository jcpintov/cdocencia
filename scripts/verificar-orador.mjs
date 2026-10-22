// Muestra sintética: comprueba al proveedor y el formato, no acredita fidelidad a trabajos reales.
import {generarOratoriaRevisada} from '../lib/trabajos-tenida.js';
import {fetchGroqQA} from './groq-qa-fetch.mjs';
if(process.env.VERCEL_ENV==='production'){
 const ficha={tema:'Bienvenida a un nuevo Aprendiz',autor:'Autor de prueba',tenida:'Tenida de iniciación de prueba',fecha:'2026-10-22',grado:1,tipo:'iniciacion',homenajeados:'Hermano de prueba'};
 const muestra={ficha,trabajo_completo_revisado:[{numero:1,sintesis:'El trabajo propone la escucha como disposición activa para aprender, reconocer los límites del propio juicio y practicar la fraternidad. La piedra bruta expresa un esfuerzo personal permanente, acompañado por los hermanos. La bienvenida compromete también a la Logia a ofrecer escucha y apoyo.',pasajes:['Escuchar no exige renunciar al juicio propio: exige dar al otro la oportunidad de ser comprendido.']}],contraste:[{texto:'Contexto sintético de prueba: respeto a la conciencia, trabajo sobre sí mismo y acompañamiento fraternal. No se dispone de artículos ni citas normativas para esta muestra.'}],precision_del_orador:'Mantener como hilo la escucha que permite el encuentro fraternal. Un solo símbolo: la piedra bruta. Acogida personal y aclamación de júbilo al cierre.'};
 try{
  const r=await generarOratoriaRevisada(ficha,muestra,{fetchImpl:fetchGroqQA});
  if(!/aclamaci[oó]n de j[uú]bilo/i.test(r.texto))throw Error('Falta aclamación ceremonial');
  console.log('ORADOR_PROVIDER_SAMPLE_OK palabras='+r.palabras+' minutos='+r.minutos);
  // No registrar el texto: los indicadores bastan para comprobar la muestra.
 }catch(e){console.error('ORADOR_PROVIDER_SAMPLE_FAIL '+e.message);process.exitCode=1;}
}
