import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const extract=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)+1));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const node=()=>({hidden:false,textContent:'',dataset:{},children:[],attrs:{},classList:{add(){},remove(){}},setAttribute(k,v){this.attrs[k]=v;},replaceChildren(){this.children=[];},append(x){this.children.push(x);},prepend(x){this.children.unshift(x);},addEventListener(){}});
function catalogContext(result){const section=node();section.querySelector=()=>section.children[0]||null;
 const c={versionNavegacion:0,usuarioActual:{id:'u'},document:{getElementById:()=>section,createElement:()=>node()},
 mensajeErrorServicio:()=> 'Servicio temporalmente no disponible.',sbApp:{from:()=>({select(){return this;},eq(){return this;},order:()=>result})}};
 runInNewContext(extract('async function renderizarCatalogoTrabajos(', 'function entrarADocenciaConModulo('),c);return {c,section};
}
test('catálogo caído muestra reintento y libera estado de carga',async()=>{
 const {c,section}=catalogContext(Promise.resolve({error:{status:503}}));
 assert.equal(await c.renderizarCatalogoTrabajos(),false);
 assert.match(section.children[0].textContent,/no disponible/);
 assert.equal(section.children[0].children[0].textContent,'Reintentar');
 assert.equal(section.attrs['aria-busy'],'false');
});
test('respuesta del catálogo invalidada al navegar no altera el destino',async()=>{
 const d=deferred();const {c,section}=catalogContext(d.promise);
 const pending=c.renderizarCatalogoTrabajos();c.versionNavegacion++;
 d.resolve({data:[]});assert.equal(await pending,false);
 assert.equal(section.children[0].children.length,0);
});
function restorationContext(getUser){const messages=node();let configured=0,removed=0;
 const c={versionSesion:0,usuarioActual:null,sbApp:{auth:{getUser}},sessionStorage:{removeItem(){removed++;},setItem(){}},document:{getElementById:()=>messages},mensajeErrorServicio:()=> 'Compruebe su conexión.',configurarEntornoUsuario(){configured++;}};
 runInNewContext(extract('async function recuperarSesionGuardada()', '// Encabezado compartido'),c);
 return {c,messages,counts:()=>({configured,removed})};
}
test('restauración rechazada mantiene ingreso utilizable sin rechazo sin manejar',async()=>{
 const {c,messages,counts}=restorationContext(async()=>{throw Error('network');});
 await c.recuperarSesionGuardada();assert.equal(counts().configured,0);assert.match(messages.innerText,/conexión/);
});
test('restauración tardía después de salir no vuelve a abrir sesión',async()=>{
 const d=deferred();const {c,counts}=restorationContext(()=>d.promise);
 const pending=c.recuperarSesionGuardada();c.versionSesion++;
 d.resolve({data:{user:{id:'old'}}});await pending;
 assert.equal(counts().configured,0);assert.equal(c.usuarioActual,null);
});
