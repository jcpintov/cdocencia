#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const js=fs.readFileSync('acceso-seguro.js','utf8');
const html=fs.readFileSync('acceso-seguro.html','utf8');
new vm.Script(js,{filename:'acceso-seguro.js'});
assert(!js.includes('.from('),'La interfaz solo llama a RPC con Auth');
assert(!js.includes('innerHTML'),'Nunca interpolar contenido aportado por usuarios');
assert(!js.includes('SUPABASE_SERVICE_ROLE_KEY'));
assert(js.includes("client.rpc('maestro_admin_vincular_auth'") ||
       js.includes("actual.rpc('maestro_admin_vincular_auth'"));
assert(js.includes("getAuthenticatorAssuranceLevel"));
assert(js.includes("challengeAndVerify"));
assert(js.includes("segundoFactorActivo"));
assert(html.includes('id="seguridadMFAAdmin"'));
assert(html.includes('id="panelVinculacionAuth"'));

const mockNode=id=>({
 id,value:'',textContent:'',src:'',hidden:true,disabled:false,
 style:{},children:[],listeners:{},
 addEventListener(k,cb){this.listeners[k]=cb},
 replaceChildren(...items){this.children=items},
 appendChild(item){this.children.push(item)},
 append(...items){this.children.push(...items)},
 scrollIntoView(){},
 classList:{add(){},remove(){}}
});

function environment({role='SUPERADMIN',existingFactor=false,confirm=true}={}){
 const nodes=new Map();
 const el=id=>{
   if(!nodes.has(id))nodes.set(id,mockNode(id));
   return nodes.get(id);
 };
 const calls=[];
 let aal='aal1';
 const auth={
   async signInWithPassword(){return {data:{session:{access_token:'a.b.c'}},error:null}},
   async signOut(){calls.push('logout')},
   mfa:{
     async getAuthenticatorAssuranceLevel(){return {data:{currentLevel:aal},error:null}},
     async listFactors(){return {data:{totp:existingFactor?[{id:'verified',status:'verified'}]:[]},error:null}},
     async enroll(){
       calls.push('enroll');
       return {data:{id:'new',totp:{qr_code:'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='}},error:null};
     },
     async challengeAndVerify({factorId,code}){
       calls.push('verify:'+factorId);
       if(code!=='123456')return {error:{message:'bad_code'},data:null};
       aal='aal2';return {data:{},error:null};
     }
   }
 };
 const client={
   auth,
   async rpc(name){
     calls.push('rpc:'+name);
     if(name==='maestro_registrar_ingreso_auth')return {data:true,error:null};
     if(name==='maestro_identidad_actual')return {data:[{rol:role}],error:null};
     if(name==='maestro_padron_superadmin'){
       return {data:[{id:'46d76cae-9e64-4361-afa6-32147f064428',
         nombre:'Test Maestro',email:'maestro@example.cl',es_admin:false,
         auth_vinculada:false}],error:null};
     }
     if(name==='maestro_admin_vincular_auth')
       return {data:aal==='aal2',error:null};
     throw Error('RPC inesperada: '+name);
   }
 };
 const window={
   addEventListener(){},
   confirm(){calls.push('confirm');return confirm},
   supabase:{createClient(){return client}}
 };
 const document={getElementById:el,createElement:mockNode};
 const fetch=async()=>({ok:true,status:200,json:async()=>({role})});
 const context={window,document,fetch,console};
 vm.createContext(context);
 vm.runInContext(js,context);
 return {
   el,calls,
   aal:()=>aal,
   async click(id){const action=el(id).listeners.click;assert.equal(typeof action,'function');await action()},
   async login(){
     el('account').value=role==='SUPERADMIN'?'jpintov@gmail.com':'jpintov@hotmail.com';
     el('password').value='not-a-real-password';
     await el('form').listeners.submit({preventDefault(){}});
   },
   async selectPending(){
     await this.click('consultarPadron');
     const btn=el('padronBody').children[0].children[4].children[0];
     assert.equal(typeof btn.listeners.click,'function');
     await btn.listeners.click();
     el('motivoVinculacionAuth').value='Identidad confirmada por la Cámara de Maestros';
   }
 };
}
(async()=>{
  const admin=environment();
  await admin.login(); await admin.selectPending();
  assert.equal(admin.el('seguridadMFAAdmin').hidden,false);
  await admin.click('confirmarVinculacionAuth');
  assert(!admin.calls.includes('rpc:maestro_admin_vincular_auth'));

  await admin.click('iniciarMFAAdmin');
  assert.equal(admin.el('qrMFAAdmin').hidden,false);
  assert.equal(admin.el('panelCodigoMFA').hidden,false);
  admin.el('codigoMFAAdmin').value='12a456';
  await admin.click('verificarMFAAdmin');
  assert.equal(admin.aal(),'aal1');
  assert(!admin.calls.some(v=>v.startsWith('verify:')));
  admin.el('codigoMFAAdmin').value='123456';
  await admin.click('verificarMFAAdmin');
  assert.equal(admin.aal(),'aal2');
  assert.equal(admin.el('qrMFAAdmin').src,'');
  await admin.click('confirmarVinculacionAuth');
  assert(admin.calls.includes('rpc:maestro_admin_vincular_auth'));
  assert(admin.calls.includes('confirm'));
  await admin.click('logout');
  assert.equal(admin.el('seguridadMFAAdmin').hidden,true);
  assert.equal(admin.el('qrMFAAdmin').src,'');

  const previous=environment({existingFactor:true});
  await previous.login();
  await previous.click('iniciarMFAAdmin');
  assert(!previous.calls.includes('enroll'),'No duplicar factor TOTP verificado');
  assert.equal(previous.el('panelCodigoMFA').hidden,false);
  previous.el('codigoMFAAdmin').value='123456';
  await previous.click('verificarMFAAdmin');
  assert.equal(previous.aal(),'aal2');

  const user=environment({role:'USER'});
  await user.login();
  assert.equal(user.el('seguridadMFAAdmin').hidden,true);
  await user.click('confirmarVinculacionAuth');
  assert(!user.calls.includes('rpc:maestro_admin_vincular_auth'));

  console.log('PASS R12: MFA, AAL2, denegación USER, vinculación consentida y limpieza QR');
})().catch(err=>{console.error(err);process.exitCode=1});
