const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'..','floating-tab.js'),'utf8');
function setup() {
  const elements = new Map();
  function el(tag) {return {tag,hidden:false,children:[],listeners:{},style:{},setAttribute(){},addEventListener(name,fn){this.listeners[name]=fn;},append(...items){this.children.push(...items);},focus(){}};}
  const document = {head:el('head'),body:el('body'),getElementById(id){return elements.get(id)||null;},createElement(tag){const item=el(tag);Object.defineProperty(item,'id',{set(id){elements.set(id,item);},get(){return [...elements].find(([,v])=>v===item)?.[0];}});return item;}};
  const window = {};
  vm.runInNewContext(source,{document,window});
  return {shell:window.DoctrinaSuperadminShell,tab:elements.get('doctrina-superadmin-tab'),panel:elements.get('doctrina-superadmin-panel')};
}
function client(id,authorized=true) {return {auth:{getUser:async()=>({data:{user:{id}}})},rpc:async()=>({data:authorized})};}
test('default deny',()=>{const x=setup();assert.equal(x.tab.hidden,true);assert.equal(x.panel.hidden,true);});
test('rejects missing client',async()=>{const x=setup();assert.equal(await x.shell.refreshFromSupabase(null),false);assert.equal(x.tab.hidden,true);});
test('rejects non-admin',async()=>{const x=setup();assert.equal(await x.shell.refreshFromSupabase(client('user',false)),false);assert.equal(x.tab.hidden,true);});
test('permits server-confirmed identity',async()=>{const x=setup();assert.equal(await x.shell.refreshFromSupabase(client('admin')),true);assert.equal(x.tab.hidden,false);});
test('revocation hides immediately',async()=>{const x=setup();await x.shell.refreshFromSupabase(client('admin'));x.shell.hide();assert.equal(x.tab.hidden,true);assert.equal(x.panel.hidden,true);});
test('stale RPC response cannot reopen tab',async()=>{const x=setup();let finish;let started;const rpcStarted=new Promise(resolve=>started=resolve);const c={auth:{getUser:async()=>({data:{user:{id:'admin'}}})},rpc:()=>new Promise(resolve=>{finish=resolve;started();})};const pending=x.shell.refreshFromSupabase(c);await rpcStarted;x.shell.hide();finish({data:true});assert.equal(await pending,false);assert.equal(x.tab.hidden,true);});
test('changed identity denies access',async()=>{const x=setup();let n=0;const c={auth:{getUser:async()=>({data:{user:{id:++n===1?'admin':'other'}}})},rpc:async()=>({data:true})};assert.equal(await x.shell.refreshFromSupabase(c),false);assert.equal(x.tab.hidden,true);});

test('rejects absent authenticated user',async()=>{const x=setup();const c={auth:{getUser:async()=>({data:{user:null}})},rpc:async()=>({data:true})};assert.equal(await x.shell.refreshFromSupabase(c),false);assert.equal(x.tab.hidden,true);});
test('rejects RPC error',async()=>{const x=setup();const c={auth:{getUser:async()=>({data:{user:{id:'admin'}}})},rpc:async()=>({data:true,error:{message:'denied'}})};assert.equal(await x.shell.refreshFromSupabase(c),false);assert.equal(x.tab.hidden,true);});
test('revoked authorization closes previously visible tab',async()=>{const x=setup();await x.shell.refreshFromSupabase(client('admin'));assert.equal(x.tab.hidden,false);assert.equal(await x.shell.refreshFromSupabase(client('admin',false)),false);assert.equal(x.tab.hidden,true);});
test('network failure denies access',async()=>{const x=setup();const c={auth:{getUser:async()=>({data:{user:{id:'admin'}}})},rpc:async()=>{throw Error('offline');}};assert.equal(await x.shell.refreshFromSupabase(c),false);assert.equal(x.tab.hidden,true);});
