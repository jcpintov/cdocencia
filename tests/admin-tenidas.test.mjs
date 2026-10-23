const permisosSource=readFileSync(new URL('../lib/roles-admin.js',import.meta.url),'utf8').replace(/^export /gm,'');
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const raw=readFileSync(new URL('../api/admin-tenidas.js',import.meta.url),'utf8');
const code=raw.replace(/^import .*;$/gm,'').replace('export default async function handler','async function handler');
const id='12345678-1234-4234-8234-123456789abc';
function setup(options={}){
 const rows=options.rows||[],calls=[];
 const admin={from(table){let value=null,mode='read',filters=[];const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},neq(){return q;},gte(){return q;},lte(){return q;},order(){return q;},insert(v){mode='insert';value=v;return q;},update(v){mode='update';value=v;return q;},maybeSingle(){return execute(true);},single(){return execute(true);},then(a,b){return execute(false).then(a,b);}};
  async function execute(single){
   if(table==='usuarios')return {data:single?{id:'actor',rol:options.rol,es_admin:options.admin!==false,email:options.email||'jpintov@gmail.com'}:[{nombre:'Autor del padrón'}]};
   calls.push(mode);
   if(options.error)return {data:null,error:{code:'network'}};
   let row=rows.find(r=>filters.every(([k,v])=>r[k]===v));
   if(mode==='insert'){row={version:1,activo:true,...value};rows.push(row);}
   if(mode==='update'&&row)Object.assign(row,value);
   return {data:single?row||null:rows.filter(r=>r.activo)};
  }return q;}};
 let n=0;const ctx={process:{env:{SUPABASE_URL:'url',SUPABASE_PUBLISHABLE_KEY:'key',SUPABASE_SERVICE_ROLE_KEY:'secret'}},createClient:()=>++n%2===1?{auth:{getUser:async()=>({data:{user:{id:'auth',email:options.email||'jpintov@gmail.com'}}})}}:admin};
 runInNewContext(permisosSource+code,ctx);return {handler:ctx.handler,rows,calls};
}
async function call(ctx,body,headers={authorization:'Bearer fixture'}){const res={setHeader(){},status(s){this.code=s;return this;},json(b){this.body=b;return this;}};await ctx.handler({method:'POST',headers,body},res);return res;}
const payload={action:'guardar',id,version:0,fecha:'2026-11-10',grado:3,tema:'La Acacia',autor:'Sergio Vera'};
test('calendario es exclusivo de Superadmin y requiere token',async()=>{
 assert.equal((await call(setup(),payload,{})).code,401);
 assert.equal((await call(setup({admin:false}),payload)).code,403);
 assert.equal((await call(setup({email:'otro@example.invalid'}),payload)).code,403);
});
test('crear y reintentar conserva un único trabajo con los campos solicitados',async()=>{
 const ctx=setup();assert.equal((await call(ctx,payload)).code,201);assert.equal((await call(ctx,payload)).code,200);
 assert.equal(ctx.rows.length,1);assert.equal(ctx.rows[0].grado,3);assert.equal(ctx.rows[0].autor,'Sergio Vera');
});
test('rechaza fecha inexistente, grado inválido, autor vacío y tema excesivo',async()=>{
 for(const change of [{fecha:'2026-02-30'},{grado:4},{autor:' '},{tema:'x'.repeat(251)}]){const ctx=setup();assert.equal((await call(ctx,{...payload,...change})).code,422);assert.equal(ctx.rows.length,0);}
});
test('modificar confirma fila y protege versión contra cambios de otra pestaña',async()=>{
 const ctx=setup();await call(ctx,payload);
 assert.equal((await call(ctx,{...payload,version:1,tema:'Nuevo tema'})).code,200);
 assert.equal(ctx.rows[0].version,2);
 assert.equal((await call(ctx,{...payload,version:1,tema:'Nuevo tema'})).code,200);
 assert.equal((await call(ctx,{...payload,version:1,tema:'Cambio ajeno'})).code,409);
});
test('eliminación lógica idempotente conserva el registro histórico',async()=>{
 const ctx=setup();await call(ctx,payload);
 assert.equal((await call(ctx,{action:'eliminar',id,version:1})).code,200);
 assert.equal((await call(ctx,{action:'eliminar',id,version:1})).code,200);
 assert.equal(ctx.rows[0].activo,false);assert.equal(ctx.rows.length,1);
});
test('listado incluye autores y falla explícitamente ante error de base',async()=>{
 const ctx=setup();await call(ctx,payload);
 const res=await call(ctx,{action:'listar',mes:'2026-11'});assert.equal(res.code,200);assert.equal(res.body.autores[0],'Autor del padrón');
 assert.equal((await call(setup({error:true}),{action:'listar',mes:'2026-11'})).code,503);
 assert.equal((await call(setup(),{action:'listar',mes:'2026-13'})).code,422);
});
test('horario predeterminado 20:00, editable y validado',async()=>{
 const predeterminado=setup();assert.equal((await call(predeterminado,payload)).code,201);assert.equal(predeterminado.rows[0].hora,'20:00');
 const editable=setup();assert.equal((await call(editable,{...payload,hora:'19:30'})).code,201);assert.equal(editable.rows[0].hora,'19:30');
 for(const hora of ['24:00','20:60','x',''])assert.equal((await call(setup(),{...payload,hora})).code,422);
});

test('Administrador delegado puede gestionar calendario',async()=>{const s=setup({rol:'ADMIN',email:'delegado@example.invalid'});assert.equal((await call(s,payload)).code,201);});
