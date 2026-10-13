#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('qa/auth-roles.html','utf8');
const inicio=html.lastIndexOf('<script>'),fin=html.lastIndexOf('</script>');
assert(inicio>0&&fin>inicio);
new vm.Script(html.slice(inicio+8,fin),{filename:'qa/auth-roles.html'});
const desde="el('leerTrabajoMiDocenciaAuth').addEventListener('click',async()=>{";
const hasta="  el('verComentariosMiDocenciaAuth').addEventListener('click',cargarComentariosMiDocencia);";
const a=html.indexOf(desde),b=html.indexOf(hasta,a);
assert(a>=0&&b>a,'La vista USER debe leer por RPC sin acceso directo a tablas');
const codigo=html.slice(a,b);
assert(codigo.includes("actual.rpc('maestro_trabajo_estudio',{p_modulo_id:id})"));
assert(codigo.includes("if(!await verificarIdentidadDocencia())"));
assert(!codigo.includes('innerHTML')&&!codigo.includes('.from('));
assert(!codigo.includes('respuesta_correcta')&&!codigo.includes('retroalimentacion'));

class Nodo{
 constructor(tipo){this.tipo=tipo;this.children=[];this.textContent='';this.className='';this.disabled=false;this.listeners={}}
 appendChild(hijo){this.children.push(hijo);return hijo}
 replaceChildren(...children){this.children=children}
 addEventListener(tipo,callback){this.listeners[tipo]=callback}
}
const nodos={
 leerTrabajoMiDocenciaAuth:new Nodo('button'),
 lecturaTrabajoMiDocenciaAuth:new Nodo('div'),
 selectTrabajoMiDocenciaAuth:new Nodo('select'),
 role:new Nodo('span')
};
nodos.selectTrabajoMiDocenciaAuth.value='11111111-2222-4333-8444-555555555555';
nodos.role.textContent='USER';
const peligro='<img src=x onerror=alert(1)>';
let peticiones=0;
const cliente={
 async rpc(rpc,parametros){
  peticiones++;
  assert.equal(rpc,'maestro_trabajo_estudio');
  assert.equal(parametros.p_modulo_id,nodos.selectTrabajoMiDocenciaAuth.value);
  return {data:[{
   numero_orden:1,titulo:peligro,autor:'Autor seguro',
   contenido_trazado:peligro,
   preguntas:[{enunciado:peligro,opciones:[{letra:'A',texto:peligro}]}]
  }],error:null};
 }
};
const entorno={
 el:id=>nodos[id],
 busy:false,operacionDocencia:false,client:cliente,
 obtenerTrabajoMiDocencia:()=>({id:nodos.selectTrabajoMiDocenciaAuth.value}),
 verificarIdentidadDocencia:async()=>true,
 document:{createElement:tipo=>new Nodo(tipo)},
 String,Array
};
vm.createContext(entorno);
vm.runInContext(codigo,entorno);
function contenidos(arbol){
 let lista=[arbol.textContent];
 for(const hijo of arbol.children)lista.push(...contenidos(hijo));
 return lista;
}
(async()=>{
 assert.equal(typeof nodos.leerTrabajoMiDocenciaAuth.listeners.click,'function');
 await nodos.leerTrabajoMiDocenciaAuth.listeners.click();
 assert.equal(peticiones,1);
 assert.equal(nodos.leerTrabajoMiDocenciaAuth.disabled,false);
 assert(contenidos(nodos.lecturaTrabajoMiDocenciaAuth).filter(x=>x.includes(peligro)).length>=3,
  'El texto malicioso debe quedar contenido en nodos de texto');
 assert(!JSON.stringify(nodos.lecturaTrabajoMiDocenciaAuth).includes('innerHTML'));
 nodos.role.textContent='SUPERADMIN';
 await nodos.leerTrabajoMiDocenciaAuth.listeners.click();
 assert.equal(peticiones,1,'El SUPERADMIN no debe iniciar petición docente');
 console.log('PASS: lectura autenticada, XSS neutralizado por textContent y SUPERADMIN sin participación');
})().catch(error=>{console.error(error);process.exitCode=1});
