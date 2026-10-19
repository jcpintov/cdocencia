import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const src=app.slice(app.indexOf('let consultaGestionTrabajosAdmin ='),app.indexOf('async function cargarUnidadesEditorTrabajo'));
test('búsqueda combina palabras y tolera tildes, mayúsculas y códigos',()=>{
 const ctx={};runInNewContext(src,ctx);
 const trabajos=[{numero_orden:6,titulo:'La exaltación',autor:'Hugo Tapia',unidad_codigo:'INCI012B'},{numero_orden:1,titulo:'La virtud',autor:'Otro autor'}];
 assert.equal(ctx.filtrarTrabajosGestionAdmin(trabajos,'EXALTACION hugo').length,1);
 assert.equal(ctx.filtrarTrabajosGestionAdmin(trabajos,'inci012b')[0].numero_orden,6);
 assert.equal(ctx.filtrarTrabajosGestionAdmin(trabajos,'  ').length,2);
 assert.equal(ctx.filtrarTrabajosGestionAdmin(trabajos,'inexistente').length,0);
});
function contexto(respuestas){
 const nodes={listaGestionTrabajosAdmin:{attrs:{},setAttribute(k,v){this.attrs[k]=v;}},gestionTrabajosEstado:{textContent:''},btnActualizarTrabajosAdmin:{disabled:false}};
 const ctx={listaModulos:[{id:'anterior'}],document:{getElementById:id=>nodes[id]},sbApp:{from:()=>({select:()=>({eq:()=>({order:()=>respuestas.shift()})})})}};
 runInNewContext(src,ctx);ctx.renderizarGestionTrabajosAdmin=()=>{};
 return {ctx,nodes};
}
test('error no borra datos anteriores y habilita reintento',async()=>{
 const {ctx,nodes}=contexto([Promise.resolve({data:null,error:{message:'fallo'}})]);
 await ctx.cargarGestionTrabajosAdmin();
 assert.equal(ctx.listaModulos[0].id,'anterior');
 assert.match(nodes.gestionTrabajosEstado.textContent,/No se pudo actualizar/);
 assert.equal(nodes.btnActualizarTrabajosAdmin.disabled,false);
 assert.equal(nodes.listaGestionTrabajosAdmin.attrs['aria-busy'],'false');
});
test('una consulta antigua no sobrescribe la lista más reciente',async()=>{
 let resolver;const antigua=new Promise(r=>resolver=r);
 const {ctx,nodes}=contexto([antigua,Promise.resolve({data:[{id:'nuevo'}],error:null})]);
 const primera=ctx.cargarGestionTrabajosAdmin();await ctx.cargarGestionTrabajosAdmin();
 resolver({data:[{id:'viejo'}],error:null});await primera;
 assert.equal(ctx.listaModulos[0].id,'nuevo');
 assert.equal(nodes.gestionTrabajosEstado.textContent,'Lista actualizada.');
});
