/* Cámara de Docencia — UI v2. Complemento visual; no altera login, RPC ni políticas RLS. */
(function(){
 'use strict';
 function actualizarAccesoMuro(){
   // Contrato vigente de app.js: Muro visible solo si existe al menos un progreso completado.
   var boton=document.getElementById('btnMuroHome');
   if(!boton||typeof misProgresos==='undefined')return;
   var permitido=Object.values(misProgresos||{}).some(function(p){return p&&p.completado===true;});
   boton.classList.toggle('hidden',!permitido);
   boton.setAttribute('aria-hidden',String(!permitido));
 }
 function mejorarNavegacion(){
   document.querySelectorAll('.modulo-nav-item').forEach(function(item){
     if(!item.hasAttribute('tabindex'))item.setAttribute('tabindex','0');
     if(!item.hasAttribute('role'))item.setAttribute('role','button');
     if(!item.dataset.uiV2Keyboard){
       item.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();item.click();}});
       item.dataset.uiV2Keyboard='1';
     }
   });
 }
 function prepararDocumento(){
   var enlace=document.getElementById('btnDescargarTrazado');
   if(!enlace)return;
   enlace.textContent='Abrir / descargar trabajo original';
   enlace.setAttribute('target','_blank');
   enlace.setAttribute('rel','noopener noreferrer');
   // El atributo download obliga descarga directa; se retira para permitir nueva pestaña.
   enlace.removeAttribute('download');
   if(!enlace.dataset.uiV2Click){
     enlace.addEventListener('click',function(e){
       enlace.removeAttribute('download'); // app.js puede reponerlo al seleccionar otro trabajo.
       var url=enlace.getAttribute('href')||'';
       if(!url||url==='#'){e.preventDefault();return;}
       // Navegadores bloquean data: URL en pestañas nuevas. Para PDFs base64 se usa blob:.
       if(url.startsWith('data:application/pdf;base64,')){
         try{
           var binary=atob(url.slice(url.indexOf(',')+1));
           var bytes=new Uint8Array(binary.length);
           for(var i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
           var blob=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
           enlace.href=blob;
           setTimeout(function(){URL.revokeObjectURL(blob);},120000);
         }catch(err){e.preventDefault();alert('No se pudo abrir el PDF. Intente nuevamente.');}
       }
     });
     enlace.dataset.uiV2Click='1';
   }
 }
 function actualizar(){actualizarAccesoMuro();mejorarNavegacion();prepararDocumento();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',actualizar);else actualizar();
 // Reaccionar a los cambios dinámicos de pantalla sin sustituir funciones originales.
 var observer=new MutationObserver(function(){
   if(observer._scheduled)return;
   observer._scheduled=true;
   requestAnimationFrame(function(){observer._scheduled=false;actualizar();});
 });
 document.addEventListener('DOMContentLoaded',function(){observer.observe(document.body,{childList:true,subtree:true});});
})();
