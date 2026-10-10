/* Cámara de Docencia — mejora de accesibilidad sin intervenir en permisos ni sesiones. */
(function () {
  'use strict';
  function prepararAccesibilidad() {
    document.querySelectorAll('.modulo-nav-item').forEach(function (item) {
      if (!item.hasAttribute('tabindex')) item.setAttribute('tabindex', '0');
      if (!item.hasAttribute('role')) item.setAttribute('role', 'button');
      if (item.dataset.uiV2Keyboard) return;
      item.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          item.click();
        }
      });
      item.dataset.uiV2Keyboard = '1';
    });
  }
  /* La autorización del muro queda exclusivamente a cargo de app.js.
     No observar ni alterar dinámicamente la clase hidden de controles protegidos. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', prepararAccesibilidad, { once: true });
  } else {
    prepararAccesibilidad();
  }
})();


/* Bienvenida institucional: presentación y consultas de solo lectura. */
(function(){
  'use strict';
  const frases=[
    'El verdadero progreso masónico consiste en transformar el conocimiento en una conducta más justa y más fraterna.',
    'La búsqueda de la verdad comienza con la disposición a examinar nuestras propias certezas.',
    'El perfeccionamiento moral se demuestra en los actos cotidianos.',
    'La virtud adquiere sentido cuando el conocimiento se convierte en servicio.',
    'La fraternidad se fortalece mediante el respeto, la escucha y la reflexión.',
    'Cada trabajo compartido es una oportunidad de aprender y de enseñar.',
    'El estudio ilumina el juicio; la experiencia orienta la prudencia.',
    'La libertad de pensamiento exige responsabilidad en nuestras conclusiones.',
    'El diálogo sincero nos permite reconocer lo que todavía ignoramos.',
    'El trabajo interior es una tarea constante, nunca una obra terminada.',
    'La tolerancia comienza por comprender antes de juzgar.',
    'La sabiduría no se mide solo por lo aprendido, sino por lo que hacemos con ello.'
  ];
  let anterior=-1;
  function fraseNueva(){
    let n=Math.floor(Math.random()*frases.length);
    if(n===anterior)n=(n+1)%frases.length;
    anterior=n;
    const el=document.getElementById('portal-frase');
    if(el)el.textContent='“'+frases[n]+'”';
  }
  function textoSeguro(value){return String(value==null?'':value);}
  const iconos=['templo','escuadra_compas','libro_abierto','mallete_piedra','columnas','rama_olivo','plomada','mallete','paleta','planos_compas','sol','luna_estrellas','pavimento_mosaico','acacia','saludo_fraterno','pergamino'];
  function iconoModulo(modulo){
    const t=String(modulo.titulo||'').toLocaleLowerCase('es');
    if(/escuadra|compás|compas/.test(t))return 'escuadra_compas';
    if(/ritual|exaltaci[oó]n|templo/.test(t))return 'templo';
    if(/juramento|obligaci[oó]n/.test(t))return 'pergamino';
    if(/libro|lectura|escritura/.test(t))return 'libro_abierto';
    if(/columna/.test(t))return 'columnas';
    if(/piedra|pulir/.test(t))return 'mallete_piedra';
    if(/acacia/.test(t))return 'acacia';
    if(/plomada/.test(t))return 'plomada';
    if(/luz|sol/.test(t))return 'sol';
    if(/luna/.test(t))return 'luna_estrellas';
    const seed=String(modulo.id||modulo.numero_orden||t);
    let hash=0;for(let i=0;i<seed.length;i++)hash=(hash*31+seed.charCodeAt(i))>>>0;
    return iconos[hash%iconos.length];
  }
  function item(modulo){
    const btn=document.createElement('button');
    btn.type='button';btn.className='portal-item';
    const img=document.createElement('img');
    img.className='portal-item-icon';
    img.src='imgs/iconos/'+iconoModulo(modulo)+'.webp';
    img.alt='';img.loading='lazy';img.decoding='async';
    img.addEventListener('error',()=>{img.hidden=true;btn.classList.add('sin-icono');},{once:true});
    const titulo=document.createElement('strong');
    titulo.textContent=textoSeguro(modulo.titulo)||'Trabajo de la Cámara';
    const flecha=document.createElement('span');flecha.className='portal-item-arrow';flecha.textContent='›';flecha.setAttribute('aria-hidden','true');
    btn.append(img,titulo,flecha);
    btn.addEventListener('click',async function(){
      if(typeof window.irACatalogoDocencia!=='function')return;
      await window.irACatalogoDocencia();
      if(typeof window.entrarADocenciaConModulo==='function')window.entrarADocenciaConModulo(modulo.id);
    });
    return btn;
  }
  async function poblarPaneles(){
    if(typeof sbApp==='undefined')return;
    const recientes=document.getElementById('portal-trabajos-recientes');
    const destacados=document.getElementById('portal-temas-destacados');
    if(!recientes||!destacados)return;
    try{
      const res=await sbApp.from('modulos').select('id,titulo,numero_orden').eq('activo',true).order('numero_orden',{ascending:false});
      if(res.error)throw res.error;
      const modulos=res.data||[];
      recientes.replaceChildren();
      if(!modulos.length){recientes.textContent='No hay trabajos publicados disponibles.';destacados.textContent='No hay temas disponibles.';return;}
      modulos.slice(0,4).forEach(m=>recientes.appendChild(item(m)));
      const ids=new Set(modulos.map(m=>String(m.id)));
      const conteos=new Map();
      const [progresos,comentarios]=await Promise.all([
        sbApp.from('progreso_maestro').select('id,modulo_id').eq('completado',true),
        sbApp.from('comentarios_muro').select('progreso_id').eq('activo',true)
      ]);
      if(progresos.error||comentarios.error)throw new Error('Participación no disponible');
      const progresoModulo=new Map();
      (progresos.data||[]).forEach(p=>{
        if(!ids.has(String(p.modulo_id)))return;
        progresoModulo.set(String(p.id),String(p.modulo_id));
        conteos.set(String(p.modulo_id),(conteos.get(String(p.modulo_id))||0)+1);
      });
      (comentarios.data||[]).forEach(c=>{
        const mid=progresoModulo.get(String(c.progreso_id));
        if(mid)conteos.set(mid,(conteos.get(mid)||0)+1);
      });
      destacados.replaceChildren();
      const ordenados=[...modulos].sort((a,b)=>(conteos.get(String(b.id))||0)-(conteos.get(String(a.id))||0));
      ordenados.slice(0,4).forEach(m=>destacados.appendChild(item(m)));
    }catch(e){
      if(!recientes.children.length)recientes.textContent='No fue posible cargar los trabajos.';
      destacados.textContent='La clasificación por participación no está disponible en este momento.';
    }
  }
  function iniciar(){
    const bienvenida=document.getElementById('seccionBienvenida');
    if(!bienvenida)return;
    let visible=false;
    const observer=new MutationObserver(function(){
      const ahora=!bienvenida.classList.contains('hidden');
      if(ahora&&!visible){fraseNueva();poblarPaneles();}
      visible=ahora;
    });
    observer.observe(bienvenida,{attributes:true,attributeFilter:['class']});
    if(!bienvenida.classList.contains('hidden')){visible=true;fraseNueva();poblarPaneles();}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);
  else iniciar();
})();

/* Medición exacta del encabezado para evitar recorte del HERO. */
(function(){
  function sincronizarEncabezado(){
    const header=document.querySelector('body > header');
    if(!header)return;
    const aplicar=()=>document.documentElement.style.setProperty('--doc-header-height',header.getBoundingClientRect().height+'px');
    aplicar();
    if(typeof ResizeObserver!=='undefined')new ResizeObserver(aplicar).observe(header);
    else window.addEventListener('resize',aplicar,{passive:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sincronizarEncabezado);
  else sincronizarEncabezado();
})();
