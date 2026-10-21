import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../comentarios-hilos.js',import.meta.url),'utf8');
function render(comments,user={id:'u',es_admin:false}){
 const ctx={window:{},document:{addEventListener(){}},usuarioActual:user,formatearNombreHermano:n=>'Q.·.H.·. '+String(n||'Hermano').replace(/^(Q\.·\.H\.·\.\s*)+/,'')};
 runInNewContext(source,ctx);return ctx.window.renderizarHilosComentarios(comments,'p','m');
}
const c=(id,padre=null,extra={})=>({id,comentario_padre_id:padre,progreso_id:'p',usuario_id:'u',contenido:'Texto '+id,usuarios:{nombre:'Hermano'},creado_en:'2026-10-21T12:00:00Z',...extra});
test('conserva raíces anteriores y ordena respuestas debajo de su padre',()=>{
 const html=render([c('c','b'),c('a'),c('b','a'),c('d')]);
 assert.ok(html.indexOf('id="comentario_item_a"')<html.indexOf('id="comentario_item_b"'));
 assert.ok(html.indexOf('id="comentario_item_b"')<html.indexOf('id="comentario_item_c"'));
 assert.equal((html.match(/class="foro-comentario-item /g)||[]).length,4);
 assert.match(html,/data-padre-id="b"/);
});
test('escapa nombres, texto y atributos, permite editar solamente aportes propios',()=>{
 const html=render([c('x',null,{contenido:'<img src=x onerror="alert(1)">',usuarios:{nombre:'<script>alert(1)</script>'},usuario_id:'otro'})]);
 assert.doesNotMatch(html,/<img|<script|data-hilo-accion="editar"/);
 assert.match(html,/&lt;img/);assert.match(html,/data-hilo-accion="responder"/);
 assert.match(render([c('x')]),/Editar mi comentario/);
});
test('autor administrativo no recibe controles de participación',()=>{
 const html=render([c('x')],{id:'admin',es_admin:true});
 assert.doesNotMatch(html,/data-hilo-accion="responder"|Publicar respuesta/);
});
test('padre retirado no oculta respuestas ni expone su contenido',()=>{
 const html=render([c('b','a'),c('a',null,{activo:false,contenido:'Texto retirado'})]);
 assert.match(html,/Comentario anterior no disponible/);assert.match(html,/Texto b/);assert.doesNotMatch(html,/Texto retirado/);
});
test('duplicados, ciclos y conversación extensa no cuelgan el renderizado',()=>{
 const html=render([c('a','b'),c('b','a'),c('a','b'),c('ajeno',null,{progreso_id:'otro'})]);
 assert.equal((html.match(/class="foro-comentario-item /g)||[]).length,2);assert.doesNotMatch(html,/Texto ajeno/);
 const largos=Array.from({length:1800},(_,i)=>c('n'+i,i?'n'+(i-1):null));
 assert.equal((render(largos).match(/class="foro-comentario-item /g)||[]).length,1800);
 assert.doesNotMatch(render(largos),/--hilo-nivel:4/);
});
test('KPI usa cada id de comentario sin excluir respuestas ni duplicar ids',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const kpi=app.slice(app.indexOf('async function cargarResumenAdmin()'));
 assert.match(kpi,/new Set\(/);assert.match(kpi,/muro\.data\.comentarios\.filter\(c=>c\?\.id\)/);
 assert.doesNotMatch(kpi,/comentario_padre_id/);
});

test('plazo de confirmación libera UI y absorbe una respuesta tardía',async()=>{
 const a=source.indexOf(' function esperarConfirmacion('),b=source.indexOf(' const fecha =',a);
 const ctx={setTimeout,clearTimeout};runInNewContext(source.slice(a,b),ctx);
 let resolve;const pending=new Promise(r=>resolve=r);
 await assert.rejects(ctx.esperarConfirmacion(pending,1),/tardó demasiado/);
 resolve('guardado después del plazo');
 assert.equal(await ctx.esperarConfirmacion(Promise.resolve('confirmado'),100),'confirmado');
});
