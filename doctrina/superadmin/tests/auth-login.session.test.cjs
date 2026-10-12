'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../auth-login.js'),'utf8');
function setup({authorized=true,existingSession=true}={}){
  const elements=new Map();
  function el(tag){return {tag,hidden:false,children:[],listeners:{},style:{},
    setAttribute(){},addEventListener(name,fn){this.listeners[name]=fn;},
    append(...nodes){this.children.push(...nodes);},focus(){this.focused=true;}};}
  const login=el('button'),entry=el('button');login.id='doctrina-auth-login';entry.id='doctrina-auth-entry';
  elements.set(login.id,login);elements.set(entry.id,entry);
  const document={head:el('head'),body:el('body'),listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},
    getElementById(id){return elements.get(id)||null;},
    createElement(tag){const node=el(tag);Object.defineProperty(node,'id',{get(){return this._id;},set(v){this._id=v;elements.set(v,this);}});return node;}};
  const counters={verified:0,opened:0,otp:0};
  const window={DoctrinaSuperadminShell:{
    async refreshFromSupabase(){counters.verified++;return authorized;},
    open(){counters.opened++;return true;}},location:{origin:'https://preview.example.test',pathname:'/'}};
  const sbApp={auth:{
    async getUser(){return {data:{user:existingSession?{email:'jpintov@gmail.com'}:null}};},
    async signInWithOtp(){counters.otp++;return {error:null};}
  }};
  vm.runInNewContext(source,{window,document,sbApp,console});
  document.listeners.DOMContentLoaded();
  return {login,entry,elements,counters};
}
test('Admin entry reuses an already verified server-authorized session',async()=>{
  const x=setup();await x.login.listeners.click();
  assert.equal(x.counters.verified,1);
  assert.equal(x.counters.opened,1);
  assert.equal(x.counters.otp,0);
  assert.equal(x.elements.get('doctrina-auth-modal').hidden,true);
});
test('owner without server authorization never opens privileged dialog',async()=>{
  const x=setup({authorized:false});await x.login.listeners.click();
  assert.equal(x.counters.verified,1);
  assert.equal(x.counters.opened,0);
  assert.equal(x.counters.otp,0);
  assert.equal(x.elements.get('doctrina-auth-modal').hidden,false);
});
test('login-screen entry cannot open Admin modal outside the Admin console',async()=>{
  const x=setup();await x.entry.listeners.click();
  assert.equal(x.counters.verified,0);
  assert.equal(x.counters.opened,0);
  assert.equal(x.counters.otp,0);
});
test('unauthenticated user sees the login dialog without granting privileges',async()=>{
  const x=setup({existingSession:false});await x.login.listeners.click();
  assert.equal(x.counters.opened,0);
  assert.equal(x.elements.get('doctrina-auth-modal').hidden,false);
});
