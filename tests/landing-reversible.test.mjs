import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {cambiarLanding,extraerLandingOriginal} from '../scripts/landing-mode.mjs';
const leer=r=>r==='index.html'?execFileSync('git',['show','HEAD:index.html'],{encoding:'utf8'}):readFileSync(new URL('../'+r,import.meta.url),'utf8');

test('el landing completo puede restaurarse y luego volver a mantenimiento sin afectar a1',()=>{
 const temp=mkdtempSync(join(tmpdir(),'docencia-landing-'));
 try{
  for(const p of ['index.html','a1.html','api/admin-usuarios.js','config/landing-mantenimiento.html']){
   const destino=join(temp,p);mkdirSync(dirname(destino),{recursive:true});
   writeFileSync(destino,leer(p));
  }
  const a1=readFileSync(join(temp,'a1.html'),'utf8');
  assert.equal(cambiarLanding('--check',{base:temp}).estado,'mantenimiento');
  const resultado=cambiarLanding('--restore',{base:temp});
  assert.equal(resultado.despues,'operativo');
  assert.equal(cambiarLanding('--check',{base:temp}).estado,'operativo');
  const restaurado=readFileSync(join(temp,'index.html'),'utf8');
  assert.equal(restaurado,extraerLandingOriginal(leer('api/admin-usuarios.js')));
  assert.match(restaurado,/id="seccionAdmin"/);
  assert.match(restaurado,/auditoria-correos-admin\.js/);
  assert.equal(cambiarLanding('--maintenance',{base:temp}).despues,'mantenimiento');
  assert.equal(readFileSync(join(temp,'index.html'),'utf8'),leer('index.html'));
  assert.equal(readFileSync(join(temp,'a1.html'),'utf8'),a1);
 }finally{rmSync(temp,{recursive:true,force:true});}
});
test('impide restaurar cuando index contiene cambios desconocidos',()=>{
 const temp=mkdtempSync(join(tmpdir(),'docencia-landing-'));
 try{
  for(const p of ['index.html','a1.html','api/admin-usuarios.js','config/landing-mantenimiento.html']){
   const destino=join(temp,p);mkdirSync(dirname(destino),{recursive:true});writeFileSync(destino,leer(p));
  }
  writeFileSync(join(temp,'index.html'),'<!doctype html><title>Personalizado</title>');
  assert.throws(()=>cambiarLanding('--restore',{base:temp}),/No sobrescribir/);
 }finally{rmSync(temp,{recursive:true,force:true});}
});
