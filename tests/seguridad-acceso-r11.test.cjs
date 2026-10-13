#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const js=fs.readFileSync('acceso-seguro.js','utf8');
const html=fs.readFileSync('acceso-seguro.html','utf8');
const root=fs.readFileSync('index.html','utf8');
const cfg=JSON.parse(fs.readFileSync('vercel.json','utf8'));
new vm.Script(js,{filename:'acceso-seguro.js'});

assert(html.includes('src="./acceso-seguro.js"'));
assert(html.includes('href="./acceso-seguro.css"'));
assert(!/<script\s*>/i.test(html),'La pantalla no puede incluir scripts inline');
assert(!/<style\s*>/i.test(html),'La pantalla no puede incluir style inline');
assert(html.includes('Content-Security-Policy'));
assert(root.includes('href="./acceso-seguro.html"'));
assert(!root.includes('onsubmit="event.preventDefault(); iniciarSesion();"'));
assert(!js.includes('.from('),'El acceso Auth usa solo RPC con validación servidor');
assert(!js.includes('innerHTML'),'Todo texto externo debe usar textContent');
assert(!js.includes('email.endsWith('),'No conceder roles basados en dominio email');
assert(!js.includes('sessionStorage.setItem'));
assert(!js.includes('localStorage.setItem'));
assert(!js.includes('SUPABASE_SERVICE_ROLE_KEY'));
const headers=cfg.headers.find(v=>v.source==='/acceso-seguro.html');
assert(headers,'Cabeceras de seguridad faltantes');
const vals=Object.fromEntries(headers.headers.map(h=>[h.key,h.value]));
assert(vals['Content-Security-Policy'].includes("frame-ancestors 'none'"));
assert(vals['Content-Security-Policy'].includes("object-src 'none'"));
assert(vals['Content-Security-Policy'].includes("script-src 'self'"));
assert(vals['Cache-Control'].includes('no-store'));
assert.equal(vals['X-Frame-Options'],'DENY');

function mockNode(id){
 return {id,value:'',hidden:true,disabled:false,textContent:'',className:'',style:{},children:[],listeners:{},
  addEventListener(type,cb){this.listeners[type]=cb},
  replaceChildren(...items){this.children=items},
  appendChild(x){this.children.push(x)},
  append(...items){this.children.push(...items)},
  setAttribute(){},
  classList:{add(){},remove(){}}
 };
}
function environment(opts={}){
 const nodes=new Map();
 const el=id=>{if(!nodes.has(id))nodes.set(id,mockNode(id));return nodes.get(id)};
 const events=[];
 const settings={role:'USER',apiStatus:200,auditFail:false,authFail:false,...opts};
 const window={
   addEventListener(){}, confirm(){return true},
   supabase:{createClient(){
     events.push('createClient');
     return {
       auth:{
         signInWithPassword:async({email})=>{
           events.push('auth:'+email);
           return settings.authFail
             ? {data:null,error:{message:'Invalid'}}
             : {data:{session:{access_token:'eyJhbGci.eyJzdWI.sig'}},error:null};
         },
         signOut:async()=>{events.push('signOut')}
       },
       rpc:async(name)=>{
         events.push('rpc:'+name);
         if(name==='maestro_registrar_ingreso_auth')
           return settings.auditFail ? {data:null,error:{message:'fail'}} : {data:true,error:null};
         throw new Error('RPC no esperada: '+name);
       }
     };
   }}
 };
 const document={getElementById:el,createElement:id=>mockNode(id)};
 const fetch=async(url)=>{
   events.push('fetch:'+url);
   return {ok:settings.apiStatus===200,status:settings.apiStatus,
      json:async()=>({role:settings.role})};
 };
 const ctx={window,document,fetch,console};
 vm.createContext(ctx);
 vm.runInContext(js,ctx,{timeout:4000});
 return {el,events,settings,submit:async(email)=>{
   el('account').value=email;
   el('password').value='SOLO_PARA_PRUEBA';
   const cb=el('form').listeners.submit;
   assert.equal(typeof cb,'function');
   await cb({preventDefault(){}});
 }};
}

(async()=>{
 const admin=environment({role:'SUPERADMIN'});
 await admin.submit('jpintov@gmail.com');
 assert.equal(admin.el('role').textContent,'SUPERADMIN');
 assert.equal(admin.el('padronSuperadminLab').hidden,false);
 assert.equal(admin.el('panelDocenciaAuth').hidden,true);
 assert.equal(admin.el('password').value,'');
 assert.equal(admin.events.filter(e=>e==='rpc:maestro_registrar_ingreso_auth').length,1);

 const user=environment({role:'USER'});
 await user.submit('jpintov@hotmail.com');
 assert.equal(user.el('role').textContent,'USER');
 assert.equal(user.el('panelDocenciaAuth').hidden,false);
 assert.equal(user.el('padronSuperadminLab').hidden,true);
 assert.equal(user.el('password').value,'');

 const future=environment({role:'USER'});
 await future.submit('nuevo.maestro@otra-logia.cl');
 assert.equal(future.el('role').textContent,'USER',
  'No debe depender del dominio del correo, solo del rol del servidor');

 const blocked=environment({role:null,apiStatus:403});
 await blocked.submit('sin-vinculo@example.com');
 assert.equal(blocked.el('result').hidden,true);
 assert(blocked.events.includes('signOut'));
 assert(!blocked.events.includes('rpc:maestro_registrar_ingreso_auth'));

 const audit=environment({role:'USER',auditFail:true});
 await audit.submit('jpintov@hotmail.com');
 assert.equal(audit.el('result').hidden,true);
 assert(audit.events.includes('signOut'));
 assert.equal(audit.el('password').value,'');

 const invalid=environment();
 await invalid.submit('no-es-correo');
 assert(!invalid.events.some(e=>e.startsWith('auth:')));
 assert.equal(invalid.el('password').value,'',
   'No retener contraseñas si el correo es inválido');
 console.log('PASS R11: SUPERADMIN, USER, dominio libre, acceso denegado, auditoría fail-closed, CSP y navegación');
})().catch(error=>{console.error(error);process.exitCode=1});
