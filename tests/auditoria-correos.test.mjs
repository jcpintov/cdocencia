import test from 'node:test';
import assert from 'node:assert/strict';
import {enviarConAuditoria} from '../lib/auditoria-correos.js';
import {readFileSync} from 'node:fs';
import {esSuperadmin} from '../lib/roles-admin.js';

function simulacion({insertError=null,resultado={accepted:['destino@ejemplo.cl'],rejected:[],messageId:'<test@example.cl>'},smtpError=null}={}){
 const operaciones=[];let envios=0;
 const admin={from(nombre){assert.equal(nombre,'auditoria_correos');return {
  async insert(valor){operaciones.push(['insert',valor]);return {error:insertError};},
  update(valor){return {eq:async(c,id)=>{assert.equal(c,'id');operaciones.push(['update',valor,id]);return {error:null};}};}
 };}};
 const transport={async sendMail(correo){envios++;if(smtpError)throw smtpError;return resultado;}};
 const correo={from:'emisor@ejemplo.cl',to:'destino@ejemplo.cl',bcc:'copia@ejemplo.cl',subject:'Prueba sin contenido sensible',text:'Cuerpo privado que no debe almacenarse'};
 return {admin,transport,correo,operaciones,get envios(){return envios;}};
}
test('reserva metadatos antes de SMTP, sin cuerpo ni secretos',async()=>{
 const f=simulacion();
 const respuesta=await enviarConAuditoria({...f,tipo:'asignacion',origenId:'x1',intentoId:'y1'});
 assert.equal(respuesta.accepted[0],'destino@ejemplo.cl');
 assert.equal(f.envios,1);
 assert.deepEqual(f.operaciones.map(x=>x[0]),['insert','update']);
 const registro=f.operaciones[0][1];
 assert.equal(registro.remitente,'emisor@ejemplo.cl');
 assert.deepEqual(registro.cco,['copia@ejemplo.cl']);
 assert.equal(registro.tipo,'asignacion');assert.equal(registro.origen_id,'x1');
 assert.equal(JSON.stringify(registro).includes('Cuerpo privado'),false);
 assert.equal(f.operaciones[1][1].estado,'aceptado_smtp');
});
test('si la reserva de auditoría falla, no se intenta el correo',async()=>{
 const f=simulacion({insertError:{code:'42P01'}});
 const old=console.error;console.error=()=>{};
 try{await assert.rejects(enviarConAuditoria({...f,tipo:'inventario'}),/auditoría/);}
 finally{console.error=old;}
 assert.equal(f.envios,0);
});
test('un fallo SMTP se registra como error sin reintento',async()=>{
 const f=simulacion({smtpError:Object.assign(new Error('servidor no disponible'),{code:'ETIMEDOUT'})});
 await assert.rejects(enviarConAuditoria({...f,tipo:'calendario'}),/servidor no disponible/);
 assert.equal(f.envios,1);
 assert.equal(f.operaciones[1][1].estado,'error');
 assert.equal(f.operaciones[1][1].error_codigo,'ETIMEDOUT');
});
test('SMTP sin destinatarios aceptados no se declara aceptado',async()=>{
 const f=simulacion({resultado:{accepted:[],rejected:['destino@ejemplo.cl'],messageId:'x'}});
 await enviarConAuditoria({...f,tipo:'recordatorio'});
 assert.equal(f.operaciones[1][1].estado,'incierto');
});
test('solo Superadmin habilitado puede consultar auditoría',()=>{
 const actor={id:'123',email:'jpintov@gmail.com'};
 const perfil={es_admin:true,rol:'SUPERADMIN',email:actor.email,cuenta_eliminada:false};
 assert.equal(esSuperadmin(perfil,actor),true);
 assert.equal(esSuperadmin({...perfil,rol:'ADMIN'},actor),false);
 assert.equal(esSuperadmin({...perfil,es_admin:false},actor),false);
 assert.equal(esSuperadmin({...perfil,cuenta_eliminada:true},actor),false);
 assert.equal(esSuperadmin({...perfil,email:'otro@ejemplo.cl'},actor),false);
});
test('los cuatro informes contemplan fecha de emisión y trazabilidad',()=>{
 const archivo=readFileSync(new URL('../informes-admin.js',import.meta.url),'utf8');
 const audit=readFileSync(new URL('../auditoria-correos-admin.js',import.meta.url),'utf8');
 for(const tipo of ['asignaciones','avances','actividad'])assert.ok(archivo.includes(tipo));
 assert.match(archivo,/fechaEmisionDeclarada=fechaEmisionAceptada=hoyChile\(\)/);
 assert.match(archivo,/window\.confirm\(/);
 assert.match(archivo,/GENERADO REALMENTE/);
 assert.match(audit,/auditoriaFechaEmision/);
 assert.match(audit,/window\.confirm\(/);
 assert.match(audit,/Fecha y hora real de generación/);
});

test('a1.html mantiene acceso privado sin sustituir la portada pública de mantenimiento',()=>{
 const acceso=readFileSync(new URL('../a1.html',import.meta.url),'utf8');
 const portada=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(acceso,/admin-usuarios\?operacion=landing/);
 assert.match(acceso,/getSession\\(\\)/);
 assert.match(acceso,/Acceso reservado a administración/);
 assert.match(portada,/Plataforma temporalmente fuera de Servicio/);
 assert.doesNotMatch(portada,/auditoria-correos-admin\\.js/);
});
