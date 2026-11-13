/**
 * Alternancia reversible de la portada. No despliega ni publica por sí sola.
 * Uso: node scripts/landing-mode.mjs --check|--restore|--maintenance
 * --restore: recupera el HTML completo original del resguardo privado embebido.
 * --maintenance: repone la plantilla temporal, sin tocar a1.html.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

const raiz=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const leer=r=>readFileSync(resolve(raiz,r),'utf8');
const rutaIndex=resolve(raiz,'index.html');
export function extraerLandingOriginal(fuente){
 const m=fuente.match(/^const LANDING_ORIGINAL_RESGUARDADO = ("(?:\\.|[^"\\])*");/);
 if(!m)throw Error('No está el resguardo del landing original');
 const html=JSON.parse(m[1]);
 for(const marca of ['id="seccionLogin"','id="seccionAdmin"','id="dialogInformeEjecutivo"','informes-admin.js','auditoria-correos-admin.js'])
  if(!html.includes(marca))throw Error('El resguardo original está incompleto: '+marca);
 if(/Plataforma temporalmente fuera de Servicio/i.test(html))throw Error('Resguardo original confundido con mantenimiento');
 return html;
}
export function validarParidad({actual,original,mantenimiento,acceso}){
 if(!acceso.includes('operacion=landing')||!acceso.includes('getSession()'))
  throw Error('a1.html perdió el ingreso administrativo autorizado');
 if(!mantenimiento.includes('Plataforma temporalmente fuera de Servicio'))
  throw Error('No se conservó la plantilla de mantenimiento');
 const modo=actual===mantenimiento?'mantenimiento':actual===original?'operativo':'desconocido';
 if(modo==='desconocido')throw Error('La portada actual difiere de los dos resguardos. No sobrescribir automáticamente.');
 return modo;
}
export function cambiarLanding(modo,{base=raiz}={}){
 const leerEn=r=>readFileSync(resolve(base,r),'utf8');
 const original=extraerLandingOriginal(leerEn('api/admin-usuarios.js'));
 const mantenimiento=leerEn('config/landing-mantenimiento.html');
 const acceso=leerEn('a1.html'),actual=leerEn('index.html');
 const estado=validarParidad({actual,original,mantenimiento,acceso});
 if(modo==='--check')return {estado,originalConservado:true,accesoResguardado:true};
 if(modo!=='--restore'&&modo!=='--maintenance')throw Error('Use --check, --restore o --maintenance');
 const destino=modo==='--restore'?original:mantenimiento;
 if(actual!==destino)writeFileSync(resolve(base,'index.html'),destino,'utf8');
 return {antes:estado,despues:modo==='--restore'?'operativo':'mantenimiento',a1SinCambios:true};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(cambiarLanding(process.argv[2]||'--check')));}
 catch(e){console.error('LANDING:',e.message);process.exitCode=1;}
}
