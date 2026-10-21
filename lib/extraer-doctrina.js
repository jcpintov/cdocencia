// Extracción local de texto; no realiza OCR ni envía originales a servicios externos.
export async function extraerDoctrina(bytes,{cargar=()=>import('unpdf')}={}){
 const {getDocumentProxy}=await cargar();
 const pdf=await getDocumentProxy(new Uint8Array(bytes),{isEvalSupported:false,useWorkerFetch:false,disableAutoFetch:true});
 try{
  if(!Number.isSafeInteger(pdf.numPages)||pdf.numPages<1||pdf.numPages>600)throw Error('El PDF excede el límite de 600 páginas de esta extracción.');
  const paginas=[];let caracteres=0;
  for(let numero=1;numero<=pdf.numPages;numero++){
   const pagina=await pdf.getPage(numero);
   const contenido=await pagina.getTextContent();
   const texto=contenido.items.map(i=>typeof i.str==='string'?i.str+(i.hasEOL?'\n':' '):'').join('').replace(/\u0000/g,'').trim();
   caracteres+=texto.length;
   if(texto.length>40000||caracteres>1500000)throw Error('El texto supera el límite de extracción; procese este original por partes.');
   paginas.push({numero,texto,texto_original:texto,revisada:false,requiere_ocr:texto.length<20,pagina_sin_texto:false});
   pagina.cleanup?.();
  }
  return {paginas,total_paginas:pdf.numPages,caracteres,requieren_ocr:paginas.filter(p=>p.requiere_ocr).length,motor:'unpdf-1.9.1'};
 }finally{await pdf.loadingTask.destroy();}
}
