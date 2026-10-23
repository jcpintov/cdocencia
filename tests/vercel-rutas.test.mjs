import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import handler from '../api/admin-usuarios.js';
test('Vercel mantiene doce funciones y conserva las URL públicas de informes y roles',()=>{
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));
 assert.equal(readdirSync(new URL('../api',import.meta.url)).filter(f=>f.endsWith('.js')).length,12);
 for(const operacion of ['informes','roles'])assert.ok(config.rewrites.some(r=>r.source==='/api/admin-'+operacion&&r.destination==='/api/admin-usuarios?operacion='+operacion));
 assert.equal(config.functions['api/admin-usuarios.js'].maxDuration,30);
});
test('el despachador conserva autenticación y respuesta privada de cada handler',async()=>{
 for(const operacion of ['informes','roles']){
  const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(data){this.body=data;return this;}};
  await handler({method:'POST',headers:{},query:{operacion},body:{action:'crear',rol:'SUPERADMIN'}},res);
  assert.equal(res.code,401);assert.equal(res.headers['Cache-Control'],'no-store');
  assert.match(res.headers['Server-Timing'],operacion==='roles'?/^roles;dur=/:/^informe;dur=/);
 }
});
