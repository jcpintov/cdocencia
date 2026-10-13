#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('qa/auth-roles.html','utf8');
const script=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
new vm.Script(script,{filename:'qa/auth-roles.html'});
const start=html.indexOf("el('consultarMigracionAuth').addEventListener('click',async()=>{");
const end=html.indexOf("  // Una sesión verificable no equivale a autorización",start);
assert(start>0&&end>start);
const source=html.slice(start,end);
assert(source.includes("if(!await superadminActual())"));
assert(source.includes("actual.rpc('maestro_admin_estado_migracion')"));
assert(!source.includes('innerHTML')&&!source.includes('.from('));
assert(!source.includes('email')&&!source.includes('clave_hash')&&!source.includes('token_recuperacion'));

class Node{
 constructor(tag){this.tag=tag;this.children=[];this.textContent='';this.listeners={};this.disabled=false}
 append(...children){this.children.push(...children)}
 appendChild(node){this.children.push(node)}
 replaceChildren(...children){this.children=children}
 addEventListener(type,cb){this.listeners[type]=cb}
}
const elements={
 role:new Node('span'),
 consultarMigracionAuth:new Node('button'),
 estadoMigracionAuth:new Node('p'),
 indicadoresMigracionAuth:new Node('div')
};
elements.role.textContent='SUPERADMIN';
const el=id=>elements[id];
let calls=0;
const client={async rpc(name){
 calls++;assert.equal(name,'maestro_admin_estado_migracion');
 return {data:[{usuarios_padron:27,identidades_auth:3,padron_vinculado_confirmado:2,
  usuarios_pendientes:25,superadmins_confirmados:1,correos_duplicados:0}],error:null};
}};
const ctx={el,client,busy:false,superadminActual:async()=>true,
 document:{createElement:tag=>new Node(tag)},String,Array};
vm.createContext(ctx);
vm.runInContext(source,ctx);
const run=elements.consultarMigracionAuth.listeners.click;
(async()=>{
 assert.equal(typeof run,'function');
 await run();
 assert.equal(calls,1);
 assert.equal(elements.indicadoresMigracionAuth.children.length,6);
 assert.equal(elements.consultarMigracionAuth.disabled,false);
 const valores=elements.indicadoresMigracionAuth.children.map(n=>n.children[0].textContent);
 assert(valores.includes('25'));
 elements.role.textContent='USER';
 await run();
 assert.equal(calls,1,'USER no puede iniciar consulta de migración');
 console.log('PASS: diagnóstico agregado, supervisor exclusivo y UI sin HTML ni datos individuales');
})().catch(error=>{console.error(error);process.exitCode=1});
