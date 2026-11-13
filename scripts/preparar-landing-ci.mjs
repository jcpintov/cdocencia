// Solo CI: restaura temporalmente la interfaz completa desde la copia resguardada.
// No modifica el repositorio ni la versión desplegada.
import {readFileSync,writeFileSync} from 'node:fs';
const fuente=readFileSync(new URL('../api/admin-usuarios.js',import.meta.url),'utf8');
const m=fuente.match(/^const LANDING_ORIGINAL_RESGUARDADO = ("(?:\\.|[^"\\])*");/);
if(!m)throw Error('No se encontró el landing original resguardado');
const html=JSON.parse(m[1]);
if(!html.includes('id="dialogInformeEjecutivo"')||!html.includes('id="encabezadoWorkspaceUsuario"'))
 throw Error('La copia resguardada está incompleta; se detienen las pruebas');
writeFileSync(new URL('../index.html',import.meta.url),html,'utf8');
console.log('CI: landing original recuperado para pruebas; la portada de producción no cambia.');
