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
  function item(modulo,extra){
    const btn=document.createElement('button');
    btn.type='button';btn.className='portal-item';
    const titulo=document.createElement('strong');
    titulo.textContent=textoSeguro(modulo.titulo)||'Trabajo de la Cámara';
    const sub=document.createElement('span');sub.textContent=extra||'Abrir trabajo de la Cámara';
    btn.append(titulo,sub);
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
      modulos.slice(0,4).forEach(m=>recientes.appendChild(item(m,'Trabajo disponible para estudio')));
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
      ordenados.slice(0,4).forEach(m=>destacados.appendChild(item(m,(conteos.get(String(m.id))||0)+' aportes y comentarios registrados')));
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
