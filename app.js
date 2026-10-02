if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
}

const SUPABASE_URL = "https://pwnnpjygnviyzyyvfxnq.supabase.co";
const SUPABASE_KEY = "sb_publishable_NExezuss4il3RPgO8Vifxw_pspbe5wF"; 

const sbApp = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let usuarioActual = null;
let listaModulos = [];
let moduloActual = null;
let misProgresos = {};
let tamanoBase = 19;

// Control de preguntas paso a paso
let indicePreguntaActiva = 0;
let respuestasMarcadas = {};
let pdfBase64Cargado = null;
let moduloAuditando = null;

// Temporizador silencioso de lectura (120 segundos)
let temporizadorLecturaId = null;

// Temporizador de inactividad estricto (5 minutos)
let temporizadorInactividad = null;
const TIEMPO_INACTIVIDAD_MS = 5 * 60 * 1000;

function reiniciarTemporizadorInactividad() {
  if (temporizadorInactividad) clearTimeout(temporizadorInactividad);
  if (usuarioActual) {
    temporizadorInactividad = setTimeout(() => {
      alert("Por motivos de seguridad y sigilo masónico, la sesión se ha cerrado tras 5 minutos de inactividad.");
      cerrarSesion();
    }, TIEMPO_INACTIVIDAD_MS);
  }
}

['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
  window.addEventListener(evt, reiniciarTemporizadorInactividad, { passive: true });
});

/* ==========================================================================
   LUMINOSIDAD Y TEMAS
   ========================================================================== */
function inicializarLuminosidad() {
  const temaGuardado = localStorage.getItem('camara_tema') || 'dia';
  aplicarTema(temaGuardado);
}

function alternarTemaLuminosidad() {
  const body = document.body;
  if (body.classList.contains('theme-nocturno')) {
    aplicarTema('dia');
  } else if (body.classList.contains('theme-sepia')) {
    aplicarTema('nocturno');
  } else {
    aplicarTema('sepia');
  }
}

function aplicarTema(tema) {
  const body = document.body;
  const btn = document.getElementById('btnTema');
  body.classList.remove('theme-sepia', 'theme-nocturno');

  if (tema === 'sepia') {
    body.classList.add('theme-sepia');
    btn.innerText = '📜';
    btn.title = 'Modo Sepia (clic para Nocturno)';
  } else if (tema === 'nocturno') {
    body.classList.add('theme-nocturno');
    btn.innerText = '🌙';
    btn.title = 'Modo Nocturno (clic para Día)';
  } else {
    btn.innerText = '☀️';
    btn.title = 'Modo Día (clic para Sepia)';
    tema = 'dia';
  }
  localStorage.setItem('camara_tema', tema);
}

function cambiarTamanoFuente(delta) {
  tamanoBase = Math.min(Math.max(tamanoBase + delta, 16), 28);
  document.body.style.fontSize = tamanoBase + 'px';
}

/* ==========================================================================
   AUTENTICACIÓN Y ENTORNO
   ========================================================================== */
async function iniciarSesion() {
  const email = document.getElementById('inputEmail').value.trim().toLowerCase();
  const clave = document.getElementById('inputClave').value.trim();
  const err = document.getElementById('errorLogin');

  if (clave !== "OFL.146!") {
    err.innerText = "Credencial de paso no válida.";
    return;
  }

  err.innerText = "Verificando en padrón...";

  const { data, error } = await sbApp
    .from('usuarios')
    .select('*')
    .eq('email', email)
    .limit(1);

  if (error || !data || data.length === 0) {
    err.innerText = "El correo no figura en el padrón de la Cámara.";
    return;
  }

  usuarioActual = data[0];
  sessionStorage.setItem('camara_usuario_sesion', JSON.stringify(usuarioActual));
  configurarEntornoUsuario();
}

function recuperarSesionGuardada() {
  const guardada = sessionStorage.getItem('camara_usuario_sesion');
  if (guardada) {
    try {
      usuarioActual = JSON.parse(guardada);
      configurarEntornoUsuario();
    } catch (e) {
      sessionStorage.removeItem('camara_usuario_sesion');
    }
  }
}

function configurarEntornoUsuario() {
  reiniciarTemporizadorInactividad();
  document.getElementById('seccionLogin').classList.add('hidden');
  document.getElementById('btnSalir').classList.remove('hidden');

  if (usuarioActual.es_admin) {
    document.getElementById('seccionAdmin').classList.remove('hidden');
    document.getElementById('seccionDocencia').classList.add('hidden');
    document.getElementById('seccionBienvenida').classList.add('hidden');
    document.getElementById('seccionCatalogoTrabajos').classList.add('hidden');
    document.getElementById('seccionDocenciaInstitucional').classList.add('hidden');
    cargarDatosAdmin();
  } else {
    document.getElementById('modalSigilo').classList.remove('hidden');
  }
}

function aceptarSigilo() {
  document.getElementById('modalSigilo').classList.add('hidden');
  const nombreLimpio = usuarioActual.nombre.replace(/(Q[\.·\s]*H[\.·\s]*)+/gi, '').trim();
  document.getElementById('bienvenidaNombreQH').innerText = `Bienvenido, Q.·.H.·. ${nombreLimpio}`;
  document.getElementById('seccionBienvenida').classList.remove('hidden');
}

async function irACatalogoDocencia() {
  document.getElementById('seccionBienvenida').classList.add('hidden');
  document.getElementById('seccionDocenciaInstitucional').classList.add('hidden');
  await renderizarCatalogoTrabajos();
}

async function renderizarCatalogoTrabajos() {
  const { data: dataModulos, error } = await sbApp
    .from('modulos')
    .select('*')
    .eq('activo', true)
    .order('numero_orden', { ascending: false });

  if (error || !dataModulos) return;

  await refrescarProgresosUsuario();

  const noLeidos = [];
  const leidos = [];

  dataModulos.forEach(m => {
    const prog = misProgresos[m.id];
    if (prog && prog.leido) {
      leidos.push(m);
    } else {
      noLeidos.push(m);
    }
  });

  leidos.sort((a, b) => a.numero_orden - b.numero_orden);
  listaModulos = [...noLeidos, ...leidos];

  document.getElementById('catalogoContadorModulos').innerText = `${listaModulos.length} temas disponibles`;

  const grid = document.getElementById('gridTrabajosBienvenida');
  grid.innerHTML = "";

  listaModulos.forEach(m => {
    const prog = misProgresos[m.id];
    let badgeHtml = `<span class="badge-estado badge-pen">Pendiente</span>`;
    if (prog && prog.completado) {
      badgeHtml = `<span class="badge-estado badge-ok">✓ Completado</span>`;
    } else if (prog && prog.leido) {
      badgeHtml = `<span class="badge-estado" style="background:#FEF3C7;color:#92400E;">En Curso</span>`;
    }

    const fechaCreacion = m.creado_en 
      ? new Date(m.creado_en).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : "Consagrado";

    grid.innerHTML += `
      <div class="card-trabajo-grid">
        <div>
          <div class="grid-card-meta">
            <span class="grid-card-orden">Trabajo N° ${m.numero_orden}</span>
            <span>📅 ${fechaCreacion}</span>
          </div>
          <h4 class="grid-card-titulo">${m.titulo}</h4>
          <p class="grid-card-autor">${m.autor ? formatearAutorMasonico(m.autor) : "Cámara del Medio"}</p>
        </div>
        <div class="grid-card-footer">
          ${badgeHtml}
          <button class="btn-grid-ir" onclick="entrarADocenciaConModulo('${m.id}')">
            Ir ➔
          </button>
        </div>
      </div>
    `;
  });

  document.getElementById('seccionCatalogoTrabajos').classList.remove('hidden');
}

function entrarADocenciaConModulo(idModulo) {
  document.getElementById('seccionCatalogoTrabajos').classList.add('hidden');
  document.getElementById('seccionDocenciaInstitucional').classList.add('hidden');
  document.getElementById('seccionDocencia').classList.remove('hidden');
  document.getElementById('contadorModulos').innerText = `${listaModulos.length} temas`;
  renderizarSidebar();
  seleccionarModulo(idModulo);
}

function volverACatalogo() {
  if (temporizadorLecturaId) clearTimeout(temporizadorLecturaId);
  document.getElementById('seccionDocencia').classList.add('hidden');
  document.getElementById('seccionDocenciaInstitucional').classList.add('hidden');
  renderizarCatalogoTrabajos();
}

function cerrarSesion() {
  if (temporizadorInactividad) clearTimeout(temporizadorInactividad);
  if (temporizadorLecturaId) clearTimeout(temporizadorLecturaId);
  usuarioActual = null;
  moduloActual = null;
  misProgresos = {};
  respuestasMarcadas = {};
  sessionStorage.removeItem('camara_usuario_sesion');

  document.getElementById('seccionDocencia').classList.add('hidden');
  document.getElementById('seccionBienvenida').classList.add('hidden');
  document.getElementById('seccionCatalogoTrabajos').classList.add('hidden');
  document.getElementById('seccionDocenciaInstitucional').classList.add('hidden');
  document.getElementById('seccionAdmin').classList.add('hidden');
  document.getElementById('modalSigilo').classList.add('hidden');
  document.getElementById('modalMisAvances').classList.add('hidden');
  document.getElementById('modalCertificado').classList.add('hidden');
  document.getElementById('modalVerReflexion').classList.add('hidden');
  document.getElementById('modalAuditoriaModulo').classList.add('hidden');
  document.getElementById('modalParametrosHermano').classList.add('hidden');
  document.getElementById('btnSalir').classList.add('hidden');
  document.getElementById('seccionLogin').classList.remove('hidden');
  document.getElementById('inputEmail').value = '';
  document.getElementById('inputClave').value = '';
}

/* ==========================================================================
   SECCIÓN INSTITUCIONAL: DOCENCIA PARA MAESTROS
   ========================================================================== */
const DOCTRINA_DEFAULT = [
  {
    titulo: "1. Descripción General",
    subtitulo: "La Cámara del Medio como Escuela de Formación Activa",
    texto: "La Plataforma de Docencia para la Cámara del Medio es un espacio reservado para los Maestros Masones de la R.·.L.·. Orestes Frödden Lorenzen N° 146. Está concebida como un entorno asíncrono para el análisis conceptual y moral de los trazados de instrucción previa a cada Tenida."
  },
  {
    titulo: "2. Objetivos Principales",
    subtitulo: "Compromiso Moral y Coherencia Doctrinal",
    texto: "Fomentar el estudio riguroso de la docencia del Tercer Grado, verificar la asimilación conceptual de los símbolos y deberes éticos, y consolidar un repositorio de reflexiones fraternas que fortalezca la vida interior del taller."
  },
  {
    titulo: "3. Metodología Docente en Tres Fases",
    subtitulo: "Lectura, Diagnóstico Simbólico y Consagración",
    texto: "Fase I: Lectura atenta con tiempo mínimo de análisis reflexivo.\nFase II: Examen formativo de 8 preguntas que culmina en un dilema ético profundo.\nFase III: Consagración de la reflexión personal y acceso al Muro fraterno."
  },
  {
    titulo: "4. Importancia de la Maestría",
    subtitulo: "El Deber Masónico en la Vida Profana y Logial",
    texto: "Ser Maestro no es ostentar un rango, sino encarnar la rectitud moral, el amparo al Hermano ausente y la fidelidad inquebrantable a la palabra empeñada sobre el Ara."
  }
];

async function obtenerDoctrinaBD() {
  try {
    const { data } = await sbApp
      .from('config_segura')
      .select('valor')
      .eq('clave', 'doctrina_docencia_maestros')
      .maybeSingle();

    if (data && data.valor) {
      return JSON.parse(data.valor);
    }
  } catch (e) {
    console.warn("Usando doctrina local:", e);
  }
  return DOCTRINA_DEFAULT;
}

async function mostrarDocenciaParaMaestros() {
  document.getElementById('seccionCatalogoTrabajos').classList.add('hidden');
  const cont = document.getElementById('contenidoInstitucionalDocencia');
  cont.innerHTML = "<p class='td-loading'>Consultando fundamentos doctrinales...</p>";
  document.getElementById('seccionDocenciaInstitucional').classList.remove('hidden');

  const bloques = await obtenerDoctrinaBD();
  cont.innerHTML = "";

  bloques.forEach(b => {
    cont.innerHTML += `
      <div class="institucional-bloque">
        <h2>${b.titulo}</h2>
        <h3>${b.subtitulo}</h3>
        <p style="white-space: pre-line;">${b.texto}</p>
      </div>
    `;
  });
}

/* ==========================================================================
   ENTORNO DOCENTE Y LECTURA CON TEMPORIZADOR SILENCIOSO (2 MINUTOS)
   ========================================================================== */
async function refrescarProgresosUsuario() {
  const { data: dataProgreso } = await sbApp
    .from('progreso_maestro')
    .select('*')
    .eq('usuario_id', usuarioActual.id);

  misProgresos = {};
  if (dataProgreso) {
    dataProgreso.forEach(p => { 
      misProgresos[p.modulo_id] = p; 
    });
  }
}

function renderizarSidebar() {
  const contenedor = document.getElementById('listaModulosNav');
  contenedor.innerHTML = "";

  listaModulos.forEach(m => {
    const prog = misProgresos[m.id];
    let badgeHtml = `<span class="badge-estado badge-pen">Pendiente</span>`;
    if (prog && prog.completado) {
      badgeHtml = `<span class="badge-estado badge-ok">✓ Completado</span>`;
    } else if (prog && prog.leido) {
      badgeHtml = `<span class="badge-estado" style="background:#FEF3C7;color:#92400E;">En Curso</span>`;
    }

    contenedor.innerHTML += `
      <div class="modulo-nav-item" id="nav_mod_${m.id}" onclick="seleccionarModulo('${m.id}')">
        <div class="nav-item-header">
          <span class="nav-item-num">Trabajo ${m.numero_orden}</span>
          ${badgeHtml}
        </div>
        <div class="nav-item-title">${m.titulo}</div>
      </div>
    `;
  });
}

async function seleccionarModulo(idModulo) {
  if (temporizadorLecturaId) clearTimeout(temporizadorLecturaId);

  moduloActual = listaModulos.find(m => m.id === idModulo);
  if (!moduloActual) return;

  document.querySelectorAll('.modulo-nav-item').forEach(el => el.classList.remove('active'));
  const activeNav = document.getElementById(`nav_mod_${idModulo}`);
  if (activeNav) activeNav.classList.add('active');

  respuestasMarcadas = {};
  indicePreguntaActiva = 0;
  document.getElementById('textoReflexion').value = "";
  document.getElementById('contenedorMuro').innerHTML = "";

  document.getElementById('temaNumero').innerText = "Trabajo " + moduloActual.numero_orden;
  document.getElementById('temaTitulo').innerText = moduloActual.titulo;
  document.getElementById('temaAutor').innerText = moduloActual.autor ? "Autor: " + formatearAutorMasonico(moduloActual.autor) : "";
  document.getElementById('vistaTexto').innerText = moduloActual.contenido_trazado;

  const tabPdf = document.getElementById('tabPdf');
  const framePdf = document.getElementById('framePdf');
  const btnDescargar = document.getElementById('btnDescargarTrazado');

  let rutaPdf = moduloActual.archivo_pdf_base64 || moduloActual.archivo_url;

  if (rutaPdf) {
    tabPdf.classList.remove('hidden');
    framePdf.src = rutaPdf;
    btnDescargar.href = rutaPdf;
    btnDescargar.target = "_blank";
    btnDescargar.classList.remove('hidden');
  } else {
    tabPdf.classList.add('hidden');
    btnDescargar.classList.add('hidden');
    cambiarVistaDocencia('texto');
  }

  await evaluarEstadoFasesModulo();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cambiarVistaDocencia(tipo) {
  const tabTexto = document.getElementById('tabTexto');
  const tabPdf = document.getElementById('tabPdf');
  const vistaTexto = document.getElementById('vistaTexto');
  const vistaPdf = document.getElementById('vistaPdf');

  if (tipo === 'pdf') {
    tabTexto.classList.remove('active');
    tabPdf.classList.add('active');
    vistaTexto.classList.add('hidden');
    vistaPdf.classList.remove('hidden');
  } else {
    tabPdf.classList.remove('active');
    tabTexto.classList.add('active');
    vistaPdf.classList.add('hidden');
    vistaTexto.classList.remove('hidden');
  }
}

async function evaluarEstadoFasesModulo() {
  const prog = misProgresos[moduloActual.id];
  const contConfLectura = document.getElementById('contenedorConfirmarLectura');
  const btnConfLectura = document.getElementById('btnConfirmarLectura');
  const bloqueFaseDos = document.getElementById('bloqueFaseDos');
  const bloqueFaseTres = document.getElementById('bloqueFaseTres');
  const btnCert = document.getElementById('btnVerCertificado');
  const txtRef = document.getElementById('textoReflexion');
  const btnConsagrar = document.getElementById('btnConsagrarReflexion');
  const btnEditar = document.getElementById('btnEditarReflexion');

  if (prog && prog.completado) {
    contConfLectura.classList.add('hidden');
    bloqueFaseDos.classList.add('hidden');
    bloqueFaseTres.classList.remove('hidden');
    btnCert.classList.remove('hidden');

    txtRef.value = prog.reflexion || "";
    txtRef.disabled = true;
    btnConsagrar.classList.add('hidden');
    btnEditar.classList.remove('hidden');
    document.getElementById('tituloFaseTres').innerText = "Mi Reflexión Consagrada";

    await cargarMuroReflexiones();
    return;
  }

  if (prog && prog.leido) {
    contConfLectura.classList.add('hidden');
    bloqueFaseDos.classList.remove('hidden');
    bloqueFaseTres.classList.add('hidden');
    btnCert.classList.add('hidden');
    inicializarCuestionarioPasoAPaso();
    return;
  }

  // PRIMERA VEZ: BLOQUEO SILENCIOSO DE 2 MINUTOS (120 SEGUNDOS)
  contConfLectura.classList.remove('hidden');
  bloqueFaseDos.classList.add('hidden');
  bloqueFaseTres.classList.add('hidden');
  btnCert.classList.add('hidden');

  btnConfLectura.disabled = true;
  btnConfLectura.innerText = "Lectura atenta en curso...";
  btnConfLectura.style.opacity = "0.6";
  btnConfLectura.style.cursor = "not-allowed";

  temporizadorLecturaId = setTimeout(() => {
    btnConfLectura.disabled = false;
    btnConfLectura.innerText = "Confirmo lectura";
    btnConfLectura.style.opacity = "1";
    btnConfLectura.style.cursor = "pointer";
  }, 120000); // 2 minutos exactos
}

async function confirmarLecturaFaseUno() {
  const btn = document.getElementById('btnConfirmarLectura');
  btn.disabled = true;
  btn.innerText = "Registrando lectura...";

  try {
    const { data: existente } = await sbApp
      .from('progreso_maestro')
      .select('id')
      .eq('usuario_id', usuarioActual.id)
      .eq('modulo_id', moduloActual.id)
      .maybeSingle();

    if (existente) {
      await sbApp.from('progreso_maestro').update({ leido: true }).eq('id', existente.id);
    } else {
      await sbApp.from('progreso_maestro').insert({
        usuario_id: usuarioActual.id,
        modulo_id: moduloActual.id,
        leido: true,
        reflexion: "",
        completado: false
      });
    }

    await refrescarProgresosUsuario();
    renderizarSidebar();

    document.getElementById('contenedorConfirmarLectura').classList.add('hidden');
    const bloqueFaseDos = document.getElementById('bloqueFaseDos');
    bloqueFaseDos.classList.remove('hidden');
    inicializarCuestionarioPasoAPaso();
    bloqueFaseDos.scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    alert("Error al confirmar lectura: " + e.message);
  } finally {
    btn.disabled = false;
    btn.innerText = "Confirmo lectura";
  }
}

/* ==========================================================================
   FASE II: CUESTIONARIO PEDAGÓGICO DE 8 PREGUNTAS
   ========================================================================== */
function inicializarCuestionarioPasoAPaso() {
  respuestasMarcadas = {};
  indicePreguntaActiva = 0;
  renderizarPreguntaActual();
}

function renderizarPreguntaActual() {
  const cont = document.getElementById('contenedorPreguntaPaso');
  const btnSiguiente = document.getElementById('btnSiguientePregunta');
  const btnFinalizar = document.getElementById('btnFinalizarCuestionario');
  btnSiguiente.classList.add('hidden');
  btnFinalizar.classList.add('hidden');

  const preguntas = moduloActual.preguntas_json?.preguntas || [];
  if (preguntas.length === 0) {
    cont.innerHTML = "<p style='color: var(--text-muted); font-style: italic;'>No hay interrogantes formuladas para este trabajo.</p>";
    btnFinalizar.classList.remove('hidden');
    return;
  }

  const p = preguntas[indicePreguntaActiva];
  const total = preguntas.length;
  const esPreguntaEtica = (indicePreguntaActiva === total - 1);

  let opcionesHtml = p.opciones.map(op => `
    <label class="opcion-label" id="label_paso_${op.letra}" onclick="evaluarRespuestaPasoAPaso('${op.letra}', '${p.respuesta_correcta}')">
      <input type="radio" name="preg_paso_radio" value="${op.letra}">
      <span><strong>${op.letra})</strong> ${op.texto}</span>
    </label>
  `).join('');

  const etiquetaPregunta = esPreguntaEtica 
    ? `Pregunta 8 de ${total} — Dilema e Interrogante Ética`
    : `Pregunta ${indicePreguntaActiva + 1} de ${total}`;

  cont.innerHTML = `
    <div class="pregunta-paso-card" style="${esPreguntaEtica ? 'border-left-color: var(--accent-gold); background: rgba(153,120,57,0.06);' : ''}">
      <p style="font-size: 0.85rem; font-weight: 700; color: var(--accent-gold-dark); text-transform: uppercase; margin-bottom: 6px;">
        ${etiquetaPregunta}
      </p>
      <p style="font-weight: 600; margin-bottom: 14px;">${p.enunciado}</p>
      ${opcionesHtml}
      <div class="feedback-box" id="feedback_paso_box">
        <div style="font-weight: 700; margin-bottom: 6px;" id="feedback_paso_titulo"></div>
        <div id="feedback_paso_texto">${p.retroalimentacion}</div>
      </div>
    </div>
  `;
}

async function evaluarRespuestaPasoAPaso(letraSeleccionada, letraCorrecta) {
  if (respuestasMarcadas[indicePreguntaActiva]) return;

  // REGLA: Si responde preguntas, es porque leyó el trabajo
  sbApp.from('progreso_maestro')
    .update({ leido: true })
    .eq('usuario_id', usuarioActual.id)
    .eq('modulo_id', moduloActual.id);

  respuestasMarcadas[indicePreguntaActiva] = letraSeleccionada;

  const radios = document.querySelectorAll(`input[name="preg_paso_radio"]`);
  radios.forEach(r => r.disabled = true);

  const labelSeleccionado = document.getElementById(`label_paso_${letraSeleccionada}`);
  const labelCorrecto = document.getElementById(`label_paso_${letraCorrecta}`);
  const feedbackBox = document.getElementById(`feedback_paso_box`);
  const feedbackTitulo = document.getElementById(`feedback_paso_titulo`);

  if (letraSeleccionada === letraCorrecta) {
    labelSeleccionado.classList.add('opcion-correcta');
    feedbackTitulo.innerHTML = `<span style="color: var(--success);">✓ Respuesta Correcta</span>`;
  } else {
    labelSeleccionado.classList.add('opcion-erronea');
    labelCorrecto?.classList.add('opcion-correcta');
    feedbackTitulo.innerHTML = `<span style="color: var(--error);">✗ Seleccionada: ${letraSeleccionada}</span> | Correcta: <strong>${letraCorrecta}</strong>`;
  }

  feedbackBox.style.display = "block";

  const totalPreguntas = moduloActual.preguntas_json?.preguntas?.length || 8;
  if (indicePreguntaActiva < totalPreguntas - 1) {
    document.getElementById('btnSiguientePregunta').classList.remove('hidden');
  } else {
    document.getElementById('btnFinalizarCuestionario').classList.remove('hidden');
  }
}

function avanzarSiguientePregunta() {
  indicePreguntaActiva++;
  renderizarPreguntaActual();
}

async function finalizarCuestionarioFaseDos() {
  const btnFinalizar = document.getElementById('btnFinalizarCuestionario');
  btnFinalizar.disabled = true;
  btnFinalizar.innerText = "Registrando respuestas...";

  try {
    const { data: existente } = await sbApp
      .from('progreso_maestro')
      .select('id')
      .eq('usuario_id', usuarioActual.id)
      .eq('modulo_id', moduloActual.id)
      .maybeSingle();

    const payload = {
      respuestas_evaluacion: respuestasMarcadas,
      intentos_preguntas: Object.keys(respuestasMarcadas).length,
      leido: true
    };

    if (existente) {
      await sbApp.from('progreso_maestro').update(payload).eq('id', existente.id);
    } else {
      await sbApp.from('progreso_maestro').insert({
        usuario_id: usuarioActual.id,
        modulo_id: moduloActual.id,
        reflexion: "",
        completado: false,
        ...payload
      });
    }

    await refrescarProgresosUsuario();
    renderizarSidebar();

    document.getElementById('bloqueFaseDos').classList.add('hidden');
    
    const faseTres = document.getElementById('bloqueFaseTres');
    const bloqueMuro = document.getElementById('bloqueMuro');
    const btnConsagrar = document.getElementById('btnConsagrarReflexion');
    const txtReflexion = document.getElementById('textoReflexion');

    faseTres.classList.remove('hidden');
    bloqueMuro.classList.add('hidden');
    btnConsagrar.classList.remove('hidden');
    btnConsagrar.innerText = "Enviar Reflexión y Desbloquear Muro";
    txtReflexion.disabled = false;
    txtReflexion.value = "";

    faseTres.scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    alert("Error al registrar respuestas: " + e.message);
  } finally {
    btnFinalizar.disabled = false;
    btnFinalizar.innerText = "Finalizar";
  }
}

/* ==========================================================================
   FASE III: REFLEXIÓN Y MURO DE REFLEXIONES
   ========================================================================== */
function contarPalabras() {
  const texto = document.getElementById('textoReflexion').value.trim();
  const cant = texto === "" ? 0 : texto.split(/\s+/).length;
  const el = document.getElementById('contadorPalabras');
  el.innerText = `Palabras: ${cant} / 200`;
  el.style.color = cant > 200 ? "var(--error)" : "var(--text-muted)";
}

async function guardarReflexionYCompletar() {
  const texto = document.getElementById('textoReflexion').value.trim();
  const cant = texto === "" ? 0 : texto.split(/\s+/).length;

  if (cant < 15) {
    alert("Q.·.H.·., favor expanda su reflexión (mínimo 15 palabras).");
    return;
  }
  if (cant > 200) {
    alert("Su reflexión supera las 200 palabras reglamentarias.");
    return;
  }

  const { data: existente } = await sbApp
    .from('progreso_maestro')
    .select('id')
    .eq('usuario_id', usuarioActual.id)
    .eq('modulo_id', moduloActual.id)
    .maybeSingle();

  const payload = {
    respuestas_evaluacion: respuestasMarcadas,
    reflexion: texto,
    leido: true,
    completado: true,
    completado_en: new Date().toISOString()
  };

  let error = null;
  if (existente) {
    const res = await sbApp.from('progreso_maestro').update(payload).eq('id', existente.id);
    error = res.error;
  } else {
    const res = await sbApp.from('progreso_maestro').insert({
      usuario_id: usuarioActual.id,
      modulo_id: moduloActual.id,
      ...payload
    });
    error = res.error;
  }

  if (error) {
    alert("Error al guardar reflexión: " + error.message);
    return;
  }

  alert("Módulo completado con éxito. Se ha desbloqueado el Muro de Reflexiones y su Certificado Oficial.");
  await refrescarProgresosUsuario();
  renderizarSidebar();
  await evaluarEstadoFasesModulo();
}

function habilitarEdicionReflexion() {
  const txtRef = document.getElementById('textoReflexion');
  const btnConsagrar = document.getElementById('btnConsagrarReflexion');
  const btnEditar = document.getElementById('btnEditarReflexion');

  txtRef.disabled = false;
  txtRef.focus();
  btnConsagrar.classList.remove('hidden');
  btnConsagrar.innerText = "Guardar Modificación de Reflexión";
  btnEditar.classList.add('hidden');
}

async function cargarMuroReflexiones() {
  const contenedor = document.getElementById('contenedorMuro');
  contenedor.innerHTML = "<p style='color: var(--text-muted); font-style: italic;'>Cargando aportes de la Cámara...</p>";

  const { data, error } = await sbApp
    .from('progreso_maestro')
    .select('reflexion, completado_en, modulo_id, usuarios(nombre)')
    .eq('modulo_id', moduloActual.id)
    .eq('completado', true)
    .not('reflexion', 'is', null);

  contenedor.innerHTML = "";
  if (!error && data && data.length > 0) {
    data.forEach(item => {
      if (item.reflexion && item.reflexion.trim() !== "" && item.modulo_id === moduloActual.id) {
        contenedor.innerHTML += `
          <div class="reflexion-item" style="cursor: pointer;" onclick="abrirModalReflexionElegante('${(item.usuarios?.nombre || "Hermano Maestro").replace(/'/g, "\\'")}', '${item.reflexion.replace(/'/g, "\\'")}')">
            <div class="reflexion-autor">${item.usuarios?.nombre || "Hermano Maestro"}</div>
            <div>"${item.reflexion}"</div>
          </div>
        `;
      }
    });
  } else {
    contenedor.innerHTML = "<p style='color: var(--text-muted); font-style: italic;'>Aún no hay reflexiones consagradas en este trabajo.</p>";
  }
}

function abrirModalReflexionElegante(autor, texto) {
  document.getElementById('modalReflexionAutor').innerText = `Reflexión de ${autor}`;
  document.getElementById('modalReflexionTexto').innerText = `"${texto}"`;
  document.getElementById('modalVerReflexion').classList.remove('hidden');
}

/* ==========================================================================
   MIS AVANCES E IMPRESIÓN LIMPIA DE INFORME PDF (300 DPI, SIN CORTES)
   ========================================================================== */
async function abrirModalMisAvances(usuarioObjetivoId = null) {
  const idTarget = usuarioObjetivoId || usuarioActual.id;
  
  const { data: usuarioData } = await sbApp
    .from('usuarios')
    .select('*')
    .eq('id', idTarget)
    .single();

  if (!usuarioData) return;

  const { data: progresos } = await sbApp
    .from('progreso_maestro')
    .select('*, modulos(numero_orden, titulo)')
    .eq('usuario_id', idTarget);

  const progMap = {};
  if (progresos) progresos.forEach(p => { progMap[p.modulo_id] = p; });

  const totalModulos = listaModulos.length || 1;
  let totalLeidos = 0;
  let totalCompletados = 0;

  listaModulos.forEach(m => {
    const p = progMap[m.id];
    if (p && p.leido) totalLeidos++;
    if (p && p.completado) totalCompletados++;
  });

  const pctLectura = Math.round((totalLeidos / totalModulos) * 100);

  const d = new Date();
  document.getElementById('informeFechaHoraEmision').innerText = `EMISIÓN: ${d.toLocaleDateString('es-CL')} ${d.toLocaleTimeString('es-CL')}`;
  
  const nombreLimpio = usuarioData.nombre.replace(/(Q[\.·\s]*H[\.·\s]*)+/gi, '').trim();
  document.getElementById('informeNombreHermano').innerText = nombreLimpio;

  document.getElementById('kpiLecturaPct').innerText = `${pctLectura}%`;
  document.getElementById('kpiExamenesAprob').innerText = `${totalCompletados} / ${totalModulos}`;
  document.getElementById('kpiAportesConsag').innerText = `${totalCompletados}`;

  const tablaCuerpo = document.getElementById('informeDetalleCuerpo');
  tablaCuerpo.innerHTML = "";

  const contCerts = document.getElementById('contenedorBotonesCertificados');
  contCerts.innerHTML = "";

  listaModulos.forEach(m => {
    const p = progMap[m.id];
    const leidoTxt = (p && p.leido) ? "✓ Confirmada" : "—";
    const examenTxt = (p && p.completado) ? "✓ 8/8 Finalizado" : (p && p.intentos_preguntas ? `${p.intentos_preguntas}/8` : "—");
    const reflexTxt = (p && p.reflexion) ? `"${p.reflexion}"` : "<em>Sin aporte consagrado</em>";

    tablaCuerpo.innerHTML += `
      <tr>
        <td><strong>Trabajo ${m.numero_orden}:</strong> ${m.titulo}</td>
        <td>${leidoTxt}</td>
        <td>${examenTxt}</td>
        <td style="font-size: 0.8rem;">${reflexTxt}</td>
      </tr>
    `;

    if (p && p.completado) {
      contCerts.innerHTML += `
        <button class="btn-cert-descargar" style="font-size: 0.8rem; padding: 6px 12px;" onclick="cerrarModalMisAvances(); abrirModalCertificado('${m.id}', '${idTarget}')">
          📜 Certificado Trabajo ${m.numero_orden}
        </button>
      `;
    }
  });

  if (contCerts.innerHTML === "") {
    contCerts.innerHTML = "<span style='font-size: 0.85rem; color: #718096;'>Aún no ha obtenido certificados oficiales.</span>";
  }

  document.getElementById('informeCodigoVerif').innerText = `ID REGISTRO: ${usuarioData.id.slice(0, 8)}-${Date.now().toString().slice(-6)}`;
  document.getElementById('modalMisAvances').classList.remove('hidden');
}

function cerrarModalMisAvances() {
  document.getElementById('modalMisAvances').classList.add('hidden');
}

/* MOTOR DE IMPRESIÓN NATIVO EN FORMATO CARTA (SOLUCIÓN DEFINITIVA A CORTES) */
function imprimirInformeAvanceNativo() {
  const original = document.getElementById('documentoInformeAvance');
  const nombreLimpio = document.getElementById('informeNombreHermano').innerText.replace(/\s+/g, '_');

  const ventanaPrint = window.open('', '_blank', 'width=850,height=1100');
  ventanaPrint.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Informe_Docente_${nombreLimpio}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        @page {
          size: letter portrait;
          margin: 12mm 15mm;
        }
        body {
          margin: 0;
          padding: 0;
          font-family: 'Inter', system-ui, sans-serif;
          color: #1A202C;
          background: #FFFFFF;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .informe-carta {
          width: 100%;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .informe-header-box {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .informe-brand p {
          font-size: 8.5pt;
          line-height: 1.35;
          margin: 0;
          font-weight: 700;
          color: #152433;
        }
        .img-emblema-discreto {
          height: 52px;
          object-fit: contain;
        }
        .informe-meta-header {
          text-align: right;
          font-size: 8pt;
          color: #718096;
        }
        .informe-hr {
          border: 0;
          height: 2px;
          background: #152433;
          margin: 8px 0 14px 0;
        }
        .informe-constancia {
          font-size: 9.5pt;
          line-height: 1.5;
          margin-bottom: 16px;
        }
        .informe-kpis-flex {
          display: flex;
          gap: 12px;
          margin-bottom: 18px;
        }
        .kpi-card-flex {
          flex: 1;
          background: #F7FAFC;
          border: 1px solid #CBD5E0;
          border-radius: 4px;
          padding: 8px;
          text-align: center;
        }
        .kpi-valor {
          font-size: 15pt;
          font-weight: 700;
          color: #152433;
        }
        .kpi-label {
          font-size: 7.5pt;
          color: #718096;
          text-transform: uppercase;
        }
        .informe-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 8.5pt;
          margin-bottom: 16px;
        }
        .informe-table th {
          background: #EDF2F7;
          border: 1px solid #CBD5E0;
          padding: 6px 8px;
          text-align: left;
        }
        .informe-table td {
          border: 1px solid #E2E8F0;
          padding: 6px 8px;
          vertical-align: top;
        }
        .informe-pie-doc {
          border-top: 1px solid #CBD5E0;
          padding-top: 8px;
          font-size: 7.5pt;
          color: #A0AEC0;
          display: flex;
          justify-content: space-between;
        }
        .no-print {
          display: none !important;
        }
      </style>
    </head>
    <body>
      ${original.outerHTML}
      <script>
        window.onload = function() {
          const noprint = document.querySelector('.no-print');
          if (noprint) noprint.style.display = 'none';
          window.print();
          setTimeout(() => window.close(), 1000);
        };
      <\/script>
    </body>
    </html>
  `);
  ventanaPrint.document.close();
}

/* ==========================================================================
   CERTIFICADO OFICIAL A4
   ========================================================================== */
async function abrirModalCertificado(moduloId = null, usuarioId = null) {
  const modTarget = moduloId ? listaModulos.find(m => m.id === moduloId) : moduloActual;
  const userTarget = usuarioId ? (await sbApp.from('usuarios').select('*').eq('id', usuarioId).single()).data : usuarioActual;

  const { data: prog } = await sbApp
    .from('progreso_maestro')
    .select('*')
    .eq('usuario_id', userTarget.id)
    .eq('modulo_id', modTarget.id)
    .maybeSingle();

  const reflexionExacta = prog?.reflexion || "";
  const nombreLimpio = userTarget.nombre.replace(/(Q[\.·\s]*H[\.·\s]*)+/gi, '').trim();

  document.getElementById('certNombreHermano').innerText = nombreLimpio;
  document.getElementById('certTituloPlancha').innerText = `"${modTarget.titulo}"`;
  document.getElementById('certAutorPlancha').innerText = modTarget.autor ? "Autor: " + formatearAutorMasonico(modTarget.autor) : "";
  document.getElementById('certTextoReflexion').innerText = `"${reflexionExacta}"`;

  const d = new Date();
  document.getElementById('certFechaEmision').innerText = `Talagante, ${d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}`;

  document.getElementById('modalCertificado').classList.remove('hidden');
}

function cerrarModalCertificado() {
  document.getElementById('modalCertificado').classList.add('hidden');
}

function cerrarModalUniversal(event, modalId) {
  if (event.target.id === modalId) {
    document.getElementById(modalId).classList.add('hidden');
  }
}

function cerrarModalUniversalDirecto(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add('hidden');
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    ['modalCertificado', 'modalMisAvances', 'modalAuditoriaModulo', 'modalParametrosHermano', 'modalSigilo', 'modalVerReflexion'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.classList.contains('hidden')) el.classList.add('hidden');
    });
  }
});

function descargarCertificadoPDF() {
  const original = document.getElementById('documentoCertificado');
  const clon = original.cloneNode(true);
  const contenedorTemp = document.createElement('div');
  contenedorTemp.style.position = 'fixed';
  contenedorTemp.style.top = '0';
  contenedorTemp.style.left = '-9999px';
  contenedorTemp.style.width = '800px';
  contenedorTemp.appendChild(clon);
  document.body.appendChild(contenedorTemp);

  const opciones = {
    margin: [6, 6, 6, 6],
    filename: `Certificado_${moduloActual?.titulo?.replace(/\s+/g, '_') || 'Docencia'}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, scrollY: 0, scrollX: 0 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(opciones).from(clon).save().then(() => {
    document.body.removeChild(contenedorTemp);
  });
}

/* ==========================================================================
   CONSOLA SUPERADMIN: GESTIÓN DE TRABAJOS Y AUDITORÍA
   ========================================================================== */
async function cargarDatosAdmin() {
  const { data: mods } = await sbApp
    .from('modulos')
    .select('*')
    .eq('activo', true)
    .order('numero_orden', { ascending: true });

  listaModulos = mods || [];
  
  const selectMetricas = document.getElementById('selectMetricasModulo');
  selectMetricas.innerHTML = "";
  listaModulos.forEach(m => {
    selectMetricas.innerHTML += `<option value="${m.id}">Trabajo ${m.numero_orden}: ${m.titulo}</option>`;
  });

  const inputOrden = document.getElementById('adminOrden');
  if (inputOrden) {
    inputOrden.value = listaModulos.length + 1;
  }

  cambiarSubseccionAdmin('cargar');
}

function cambiarSubseccionAdmin(seccion) {
  const btns = ['tabNavCargar', 'tabNavGestionTrabajos', 'tabNavMuroGeneral', 'tabNavMetricas', 'tabNavEditorDoctrina'];
  const secs = ['adminSeccionCarga', 'adminSeccionGestionTrabajos', 'adminSeccionMuroGeneral', 'adminSeccionMetricas', 'adminSeccionEditorDoctrina'];

  btns.forEach(b => document.getElementById(b)?.classList.remove('active'));
  secs.forEach(s => document.getElementById(s)?.classList.add('hidden'));

  if (seccion === 'cargar') {
    document.getElementById('tabNavCargar').classList.add('active');
    document.getElementById('adminSeccionCarga').classList.remove('hidden');
  } else if (seccion === 'gestion_trabajos') {
    document.getElementById('tabNavGestionTrabajos').classList.add('active');
    document.getElementById('adminSeccionGestionTrabajos').classList.remove('hidden');
    cargarGestionTrabajosAdmin();
  } else if (seccion === 'muro_general') {
    document.getElementById('tabNavMuroGeneral').classList.add('active');
    document.getElementById('adminSeccionMuroGeneral').classList.remove('hidden');
    cargarMuroGeneralAdmin();
  } else if (seccion === 'editor_doctrina') {
    document.getElementById('tabNavEditorDoctrina').classList.add('active');
    document.getElementById('adminSeccionEditorDoctrina').classList.remove('hidden');
    cargarEditorDoctrinaAdmin();
  } else {
    document.getElementById('tabNavMetricas').classList.add('active');
    document.getElementById('adminSeccionMetricas').classList.remove('hidden');
    if (listaModulos.length > 0) {
      const select = document.getElementById('selectMetricasModulo');
      cargarMetricasAvance(select.value || listaModulos[0].id);
    }
  }
}

async function cargarGestionTrabajosAdmin() {
  const cont = document.getElementById('listaGestionTrabajosAdmin');
  cont.innerHTML = "<p class='td-loading'>Cargando trabajos...</p>";

  const { data: mods } = await sbApp
    .from('modulos')
    .select('*')
    .eq('activo', true)
    .order('numero_orden', { ascending: true });

  listaModulos = mods || [];
  cont.innerHTML = "";

  listaModulos.forEach(m => {
    cont.innerHTML += `
      <div class="card" style="padding: 18px 24px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: gap: 12px;">
        <div>
          <span style="font-size: 0.8rem; font-weight: 700; color: var(--accent-gold-dark);">TRABAJO N° ${m.numero_orden}</span>
          <h4 style="margin: 4px 0;">${m.titulo}</h4>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">${m.autor || "Cámara del Medio"}</p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="admin-link-btn" onclick="abrirAuditoriaModulo('${m.id}')">🔍 Auditar / Editar 8 Preguntas</button>
          <button class="admin-link-btn" style="color: var(--error); border-color: var(--error);" onclick="eliminarModuloYReordenar('${m.id}')">🗑️️ Eliminar</button>
        </div>
      </div>
    `;
  });
}

function abrirAuditoriaModulo(moduloId) {
  moduloAuditando = listaModulos.find(m => m.id === moduloId);
  if (!moduloAuditando) return;

  document.getElementById('editModOrden').value = moduloAuditando.numero_orden;
  document.getElementById('editModTitulo').value = moduloAuditando.titulo;
  document.getElementById('editModAutor').value = moduloAuditando.autor || "";
  document.getElementById('editModTexto').value = moduloAuditando.contenido_trazado || "";

  const contPreguntas = document.getElementById('cuerpoPreguntasAuditoria');
  contPreguntas.innerHTML = "";

  const preguntas = moduloAuditando.preguntas_json?.preguntas || [];
  preguntas.forEach((p, idx) => {
    const esEtica = (idx === preguntas.length - 1);
    let opcionesTxt = p.opciones.map(o => `<div>• <strong>${o.letra})</strong> ${o.texto}</div>`).join('');
    contPreguntas.innerHTML += `
      <div style="padding: 14px; margin-bottom: 12px; background: rgba(0,0,0,0.03); border-left: 3px solid ${esEtica ? 'var(--accent-gold)' : 'var(--primary)'}; border-radius: 4px;">
        <p><strong>${esEtica ? 'Pregunta 8 (Dilema Ético)' : `Pregunta ${p.numero}`}:</strong> ${p.enunciado}</p>
        <div style="margin: 8px 0; font-size: 0.9rem;">${opcionesTxt}</div>
        <p style="color: var(--success); font-weight: 600; font-size: 0.85rem;">Respuesta Correcta: ${p.respuesta_correcta}</p>
        <p style="font-style: italic; color: var(--text-muted); font-size: 0.85rem;">Retroalimentación: ${p.retroalimentacion}</p>
      </div>
    `;
  });

  document.getElementById('modalAuditoriaModulo').classList.remove('hidden');
}

async function guardarEdicionModuloAdmin() {
  if (!moduloAuditando) return;

  const nuevoOrden = parseInt(document.getElementById('editModOrden').value);
  const nuevoTitulo = document.getElementById('editModTitulo').value.trim();
  const nuevoAutor = document.getElementById('editModAutor').value.trim();
  const nuevoTexto = document.getElementById('editModTexto').value.trim();

  if (!nuevoTitulo || !nuevoTexto) {
    alert("El título y el texto no pueden quedar vacíos.");
    return;
  }

  const { error } = await sbApp
    .from('modulos')
    .update({
      numero_orden: nuevoOrden,
      titulo: nuevoTitulo,
      autor: nuevoAutor,
      contenido_trazado: nuevoTexto
    })
    .eq('id', moduloAuditando.id);

  if (error) {
    alert("Error al actualizar: " + error.message);
  } else {
    alert("Trabajo actualizado con éxito.");
    cerrarModalUniversalDirecto('modalAuditoriaModulo');
    await cargarDatosAdmin();
    cargarGestionTrabajosAdmin();
  }
}

async function eliminarModuloYReordenar(moduloId) {
  if (!confirm("¿Está seguro de eliminar este trabajo? Los trabajos restantes se renumerarán automáticamente (1, 2, 3...).")) return;

  await sbApp.from('progreso_maestro').delete().eq('modulo_id', moduloId);
  await sbApp.from('modulos').delete().eq('id', moduloId);

  const { data: restantes } = await sbApp
    .from('modulos')
    .select('id')
    .eq('activo', true)
    .order('numero_orden', { ascending: true });

  if (restantes) {
    for (let i = 0; i < restantes.length; i++) {
      await sbApp.from('modulos').update({ numero_orden: i + 1 }).eq('id', restantes[i].id);
    }
  }

  alert("Trabajo eliminado y correlativo reestructurado.");
  await cargarDatosAdmin();
  cargarGestionTrabajosAdmin();
}

/* ==========================================================================
   MATRIZ DE AVANCE Y EDITOR DE PARÁMETROS DEL HERMANO (SUPERADMIN)
   ========================================================================== */
async function cargarMetricasAvance(moduloId) {
  const tbody = document.getElementById('tablaMetricasBody');
  tbody.innerHTML = `<tr><td colspan="6" class="td-loading">Consultando registros...</td></tr>`;

  const { data: usuarios } = await sbApp
    .from('usuarios')
    .select('id, nombre, es_admin')
    .order('nombre', { ascending: true });

  const { data: progresos } = await sbApp
    .from('progreso_maestro')
    .select('*')
    .eq('modulo_id', moduloId);

  const mapProg = {};
  if (progresos) progresos.forEach(p => { mapProg[p.usuario_id] = p; });

  tbody.innerHTML = "";

  usuarios.forEach(u => {
    if (u.es_admin) return;

    const prog = mapProg[u.id];

    const leidoHtml = prog && prog.leido
      ? `<span style="color: var(--success); font-weight: 600;">✓ Sí leyó</span>`
      : `<span style="color: var(--text-muted);">— Pendiente</span>`;

    let evalHtml = `<span style="color: var(--text-muted);">Sin intentos</span>`;
    if (prog) {
      const resp = prog.respuestas_evaluacion ? Object.keys(prog.respuestas_evaluacion).length : (prog.intentos_preguntas || 0);
      if (resp >= 8) evalHtml = `<span style="color: var(--success); font-weight: 600;">✓ 8/8 Finalizado</span>`;
      else if (resp > 0) evalHtml = `<span style="color: #B27B10; font-weight: 600;">En curso (${resp}/8)</span>`;
    }

    let reflexHtml = `<span style="color: var(--text-muted);">Pendiente</span>`;
    let fechaHtml = `<span style="color: var(--text-muted);">—</span>`;

    if (prog && prog.completado) {
      reflexHtml = `<span style="color: var(--success); font-weight: 700;">✓ Consagrado</span>`;
      if (prog.completado_en) {
        const d = new Date(prog.completado_en);
        fechaHtml = d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      }
    }

    tbody.innerHTML += `
      <tr>
        <td>
          <a href="javascript:void(0)" onclick="abrirModalMisAvances('${u.id}')" style="color: var(--primary); font-weight: 700; text-decoration: underline;">
            ${u.nombre || "Hermano"}
          </a>
        </td>
        <td>${leidoHtml}</td>
        <td>${evalHtml}</td>
        <td>${reflexHtml}</td>
        <td>${fechaHtml}</td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="admin-link-btn" onclick="abrirEditorParametrosHermano('${u.id}', '${moduloId}', '${(u.nombre || '').replace(/'/g, "\\'")}')">⚙️ Parámetros</button>
            <button class="admin-link-btn" onclick="abrirModalMisAvances('${u.id}')">📄 Ficha</button>
          </div>
        </td>
      </tr>
    `;
  });
}

function recargarMetricasActuales() {
  const select = document.getElementById('selectMetricasModulo');
  if (select && select.value) cargarMetricasAvance(select.value);
}

async function abrirEditorParametrosHermano(usuarioId, moduloId, nombreHermano) {
  document.getElementById('subParamHermano').innerText = `Hermano: ${nombreHermano}`;
  document.getElementById('paramUsuarioId').value = usuarioId;
  document.getElementById('paramModuloId').value = moduloId;

  const { data: prog } = await sbApp
    .from('progreso_maestro')
    .select('*')
    .eq('usuario_id', usuarioId)
    .eq('modulo_id', moduloId)
    .maybeSingle();

  document.getElementById('paramProgresoId').value = prog ? prog.id : "";
  document.getElementById('paramLeido').value = (prog && prog.leido) ? "true" : "false";
  
  if (prog && prog.completado_en) {
    const d = new Date(prog.completado_en);
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
    document.getElementById('paramFecha').value = localISOTime;
  } else {
    document.getElementById('paramFecha').value = "";
  }

  document.getElementById('paramIntentos').value = prog ? (prog.intentos_preguntas || 0) : 0;
  document.getElementById('paramReflexion').value = prog ? (prog.reflexion || "") : "";

  document.getElementById('modalParametrosHermano').classList.remove('hidden');
}

async function guardarParametrosHermanoBD() {
  const progresoId = document.getElementById('paramProgresoId').value;
  const usuarioId = document.getElementById('paramUsuarioId').value;
  const moduloId = document.getElementById('paramModuloId').value;
  const leido = document.getElementById('paramLeido').value === "true";
  const fechaVal = document.getElementById('paramFecha').value;
  const intentos = parseInt(document.getElementById('paramIntentos').value) || 0;
  const reflexion = document.getElementById('paramReflexion').value.trim();

  const completado = reflexion.length >= 15;
  const completado_en = fechaVal ? new Date(fechaVal).toISOString() : (completado ? new Date().toISOString() : null);

  const payload = {
    usuario_id: usuarioId,
    modulo_id: moduloId,
    leido: leido,
    intentos_preguntas: intentos,
    reflexion: reflexion,
    completado: completado,
    completado_en: completado_en
  };

  let error = null;
  if (progresoId) {
    const res = await sbApp.from('progreso_maestro').update(payload).eq('id', progresoId);
    error = res.error;
  } else {
    const res = await sbApp.from('progreso_maestro').insert(payload);
    error = res.error;
  }

  if (error) {
    alert("Error al actualizar parámetros: " + error.message);
  } else {
    alert("Parámetros actualizados con éxito.");
    cerrarModalUniversalDirecto('modalParametrosHermano');
    recargarMetricasActuales();
  }
}

/* ==========================================================================
   EDITOR GRANULAR DE DOCTRINA INSTITUCIONAL (SUPERADMIN)
   ========================================================================== */
let bloquesDoctrinaAdmin = [];

async function cargarEditorDoctrinaAdmin() {
  bloquesDoctrinaAdmin = await obtenerDoctrinaBD();
  renderizarFormularioDoctrinaAdmin();
}

function renderizarFormularioDoctrinaAdmin() {
  const cont = document.getElementById('contenedorEditorDoctrinaAdmin');
  cont.innerHTML = "";

  bloquesDoctrinaAdmin.forEach((b, idx) => {
    cont.innerHTML += `
      <div class="bloque-doctrina-card">
        <div class="bloque-doctrina-header">
          <strong style="color: var(--accent-gold-dark);">Bloque ${idx + 1}</strong>
          <button class="admin-link-btn" style="color: var(--error); border-color: var(--error);" onclick="eliminarBloqueDoctrinaAdmin(${idx})">🗑️ Eliminar Bloque</button>
        </div>
        <div class="form-group">
          <label>Título:</label>
          <input type="text" value="${b.titulo.replace(/"/g, '&quot;')}" oninput="bloquesDoctrinaAdmin[${idx}].titulo = this.value">
        </div>
        <div class="form-group">
          <label>Subtítulo:</label>
          <input type="text" value="${b.subtitulo.replace(/"/g, '&quot;')}" oninput="bloquesDoctrinaAdmin[${idx}].subtitulo = this.value">
        </div>
        <div class="form-group">
          <label>Texto Doctrinal:</label>
          <textarea rows="4" oninput="bloquesDoctrinaAdmin[${idx}].texto = this.value">${b.texto}</textarea>
        </div>
      </div>
    `;
  });
}

function agregarBloqueDoctrinaAdmin() {
  bloquesDoctrinaAdmin.push({
    titulo: `Nuevo Título ${bloquesDoctrinaAdmin.length + 1}`,
    subtitulo: "Subtítulo descriptivo",
    texto: "Ingrese aquí el contenido doctrinal correspondiente."
  });
  renderizarFormularioDoctrinaAdmin();
}

function eliminarBloqueDoctrinaAdmin(idx) {
  if (!confirm("¿Está seguro de eliminar este bloque doctrinal?")) return;
  bloquesDoctrinaAdmin.splice(idx, 1);
  renderizarFormularioDoctrinaAdmin();
}

async function guardarDoctrinaAdmin() {
  const jsonStr = JSON.stringify(bloquesDoctrinaAdmin);
  const { error } = await sbApp
    .from('config_segura')
    .upsert({ clave: 'doctrina_docencia_maestros', valor: jsonStr });

  if (error) {
    alert("Error al guardar: " + error.message);
  } else {
    alert("Contenidos de 'Docencia para Maestros' guardados exitosamente.");
  }
}

/* ==========================================================================
   MURO GENERAL Y MODERACIÓN SUPERADMIN
   ========================================================================== */
async function cargarMuroGeneralAdmin() {
  const contenedor = document.getElementById('contenedorMuroGeneralAdmin');
  contenedor.innerHTML = "<p class='td-loading'>Consultando todas las reflexiones...</p>";

  const { data: aportes, error } = await sbApp
    .from('progreso_maestro')
    .select('id, reflexion, completado_en, modulo_id, usuarios(nombre), modulos(numero_orden, titulo)')
    .eq('completado', true)
    .not('reflexion', 'is', null)
    .order('modulo_id');

  contenedor.innerHTML = "";

  if (error || !aportes || aportes.length === 0) {
    contenedor.innerHTML = "<p style='color: var(--text-muted); font-style: italic;'>No hay reflexiones consagradas en la Cámara.</p>";
    return;
  }

  const grupos = {};
  aportes.forEach(a => {
    const modKey = `Trabajo ${a.modulos?.numero_orden || '?'}: ${a.modulos?.titulo || 'Sin título'}`;
    if (!grupos[modKey]) grupos[modKey] = [];
    grupos[modKey].push(a);
  });

  for (const [tituloModulo, items] of Object.entries(grupos)) {
    let itemsHtml = items.map(it => `
      <div class="reflexion-item" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 14px;">
        <div style="flex: 1; cursor: pointer;" onclick="abrirModalReflexionElegante('${(it.usuarios?.nombre || "Hermano").replace(/'/g, "\\'")}', '${it.reflexion.replace(/'/g, "\\'")}')">
          <div class="reflexion-autor">${it.usuarios?.nombre || "Hermano"}</div>
          <div style="font-size: 0.95rem;">"${it.reflexion}"</div>
        </div>
        <div style="display: flex; gap: 6px;">
          <button class="admin-link-btn" onclick="editarReflexionSuperadmin('${it.id}', '${it.reflexion.replace(/'/g, "\\'")}')">✏️ Editar</button>
          <button class="admin-link-btn" style="color: var(--error); border-color: var(--error);" onclick="eliminarReflexionSuperadmin('${it.id}')">🗑️️ Eliminar</button>
        </div>
      </div>
    `).join('');

    contenedor.innerHTML += `
      <div style="margin-bottom: 28px;">
        <h3 style="font-size: 1.15rem; color: var(--accent-gold-dark); margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">
          ${tituloModulo}
        </h3>
        ${itemsHtml}
      </div>
    `;
  }
}

async function editarReflexionSuperadmin(progresoId, textoActual) {
  const nuevo = prompt("Modificar la reflexión consagrada:", textoActual);
  if (nuevo === null) return;
  if (nuevo.trim() === "") {
    alert("El texto no puede quedar vacío.");
    return;
  }

  const { error } = await sbApp
    .from('progreso_maestro')
    .update({ reflexion: nuevo.trim() })
    .eq('id', progresoId);

  if (error) alert("Error al editar: " + error.message);
  else cargarMuroGeneralAdmin();
}

async function eliminarReflexionSuperadmin(progresoId) {
  if (!confirm("¿Está seguro de eliminar esta reflexión? El estado del Hermano pasará a incompleto para que pueda consagrarla nuevamente.")) return;

  const { error } = await sbApp
    .from('progreso_maestro')
    .update({ reflexion: "", completado: false })
    .eq('id', progresoId);

  if (error) alert("Error al eliminar: " + error.message);
  else cargarMuroGeneralAdmin();
}

async function exportarRespaldoCompletoJSON() {
  const { data: mods } = await sbApp.from('modulos').select('*');
  const { data: progs } = await sbApp.from('progreso_maestro').select('*');
  const { data: usrs } = await sbApp.from('usuarios').select('id, nombre, email, activo, es_admin');

  const respaldo = {
    fecha: new Date().toISOString(),
    modulos: mods,
    usuarios: usrs,
    progresos: progs
  };

  const blob = new Blob([JSON.stringify(respaldo, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `backup_docencia_camara_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
}

/* ==========================================================================
   CARGA PURA Y PROCESAMIENTO CON GEMINI
   ========================================================================== */
function formatearAutorMasonico(nombreCrudo) {
  if (!nombreCrudo) return 'Cámara del Medio';
  let nombreLimpio = nombreCrudo.replace(/(Q[\.·\s]*H[\.·\s]*)+/gi, '').trim();
  return `Q.·.H.·. ${nombreLimpio}`;
}

function depurarTextoPlancha(textoBruto) {
  if (!textoBruto) return "";
  let t = textoBruto.normalize("NFC");

  t = t.replace(/é%ca/gi, "ética")
       .replace(/colec%vas/gi, "colectivas")
       .replace(/en%dad/gi, "entidad")
       .replace(/É%ca/gi, "Ética")
       .replace(/puni%vos/gi, "punitivos")
       .replace(/fana%zantes/gi, "fanatizantes")
       .replace(/é%cos/gi, "éticos")
       .replace(/ins%tución/gi, "institución")
       .replace(/iniciá%ca/gi, "iniciática")
       .replace(/prác%ca/gi, "práctica")
       .replace(/gra%ficante/gi, "gratificante")
       .replace(/par%cipación/gi, "participación")
       .replace(/au%éntico/gi, "auténtico")
       .replace(/ac%tud/gi, "actitud")
       .replace(/sa%sfacción/gi, "satisfacción")
       .replace(/sen%do/gi, "sentido")
       .replace(/q\s*ue\b/gi, "que");

  let lineas = t.split(/\r?\n/);
  let lineasFiltradas = [];

  for (let linea of lineas) {
    let l = linea.trim();
    if (/^[-–—]?\s*(p[aá]g\.?|p[aá]gina)?\s*\d+\s*[-–—]?$/i.test(l)) continue;
    if (/^(https?:\/\/|www\.)\S+$/i.test(l)) continue;
    if (/^\d+\s+(ib[ií]d|op\.\s*cit|ob\.\s*cit|cfr|ver)\b/i.test(l)) continue;

    let lineaLimpia = linea.replace(/\.\s*\d+\s+([A-ZÁÉÍÓÚ])/g, '. $1')
                           .replace(/([a-záéíóú])\s+\d+\s+([a-záéíóú])/gi, '$1 $2')
                           .replace(/Masónica\s+\d+\s+/g, 'Masónica ');
    lineasFiltradas.push(lineaLimpia);
  }

  return lineasFiltradas.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function leerArchivoPlancha(event) {
  const file = event.target.files[0];
  if (!file) return;

  const status = document.getElementById('archivoStatus');
  status.innerText = "Extrayendo y depurando texto...";

  const inputTitulo = document.getElementById('adminTitulo');
  if (!inputTitulo.value) inputTitulo.value = file.name.replace(/\.[^/.]+$/, "");

  if (file.type === "application/pdf" || file.name.endsWith('.pdf')) {
    const b64Reader = new FileReader();
    b64Reader.onload = function(e) { pdfBase64Cargado = e.target.result; };
    b64Reader.readAsDataURL(file);
  } else {
    pdfBase64Cargado = null;
  }

  const reader = new FileReader();

  if (file.name.endsWith('.docx')) {
    reader.onload = function(e) {
      mammoth.extractRawText({ arrayBuffer: e.target.result })
        .then(function(result) {
          document.getElementById('adminTexto').value = depurarTextoPlancha(result.value);
          status.innerText = "Word depurado con éxito.";
        });
    };
    reader.readAsArrayBuffer(file);
  } else if (file.name.endsWith('.pdf')) {
    reader.onload = async function(e) {
      try {
        const typedarray = new Uint8Array(e.target.result);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        let fullText = "";
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map(item => item.str).join(' ') + "\n\n";
        }
        document.getElementById('adminTexto').value = depurarTextoPlancha(fullText);
        status.innerText = `PDF depurado con éxito (${pdf.numPages} págs).`;
      } catch (err) {
        status.innerText = "Error PDF: " + err.message;
      }
    };
    reader.readAsArrayBuffer(file);
  }
}

async function obtenerGeminiKeySegura() {
  try {
    const { data, error } = await sbApp
      .from('config_segura')
      .select('valor')
      .eq('clave', 'gemini_api_key')
      .single();

    if (!error && data) return data.valor;
  } catch (e) {
    console.warn("No se pudo obtener la clave protegida:", e);
  }
  return null;
}

async function generarModuloConIA() {
  const titulo = document.getElementById('adminTitulo').value.trim();
  const autorInput = document.getElementById('adminAutor').value.trim();
  const autorFinal = formatearAutorMasonico(autorInput);
  const orden = parseInt(document.getElementById('adminOrden').value);
  const texto = document.getElementById('adminTexto').value.trim();
  const status = document.getElementById('adminStatus');

  if (!titulo || !texto) {
    alert("Complete el título y el texto depurado.");
    return;
  }

  status.innerHTML = "<em>Procesando trazado con Gemini (batería de 8 preguntas exigentes)...</em>";

  const apiKey = await obtenerGeminiKeySegura();
  if (!apiKey) {
    status.innerHTML = `<span style="color: var(--error);">No se encontró la credencial protegida en Supabase.</span>`;
    return;
  }

  const promptSistema = `
Eres un pedagogo e instructor especializado en la Cámara del Medio (Tercer Grado de la Masonería).
Analiza el siguiente trazado doctrinal depurado considerando el programa de docencia y el rigor de la Maestría.

Genera exactamente:
1. "resumen_formativo": Síntesis sobria de las enseñanzas doctrinales centrales (máximo 150 palabras).
2. "conclusion_enlace": Reflexión que conecte las virtudes expuestas con la práctica de la Maestría (120-180 palabras).
3. "preguntas": Arreglo de exactamente 8 preguntas pedagógicas de selección múltiple sobre los conceptos del trazado:
   - Preguntas 1 a 7: Evaluación formativa de conceptos simbólicos y rituales. No deben ser obvias; deben obligar a la lectura reflexiva.
   - Pregunta 8 (OBLIGATORIA): Un dilema ético profundo que interpele directamente la conciencia del Maestro, cuya respuesta correcta y retroalimentación sirvan de puente formativo para su reflexión personal.
   Cada pregunta debe contener:
   - "numero": (1 a 8)
   - "enunciado": Texto claro y reflexivo.
   - "opciones": 4 alternativas ("letra": "A","B","C","D" y "texto").
   - "respuesta_correcta": Letra de la opción verdadera.
   - "retroalimentacion": Justificación fraterna y docente.

REGLA ESTRICTA: Tu respuesta debe ser exclusivamente un JSON válido:
{
  "resumen_formativo": "...",
  "conclusion_enlace": "...",
  "preguntas": [
    {
      "numero": 1,
      "enunciado": "...",
      "opciones": [
        {"letra": "A", "texto": "..."},
        {"letra": "B", "texto": "..."},
        {"letra": "C", "texto": "..."},
        {"letra": "D", "texto": "..."}
      ],
      "respuesta_correcta": "A",
      "retroalimentacion": "..."
    }
  ]
}
`;

  try {
    const respuesta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'x-goog-api-key': apiKey 
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: promptSistema + "\n\n--- TEXTO DE LA PLANCHA ---\n" + texto }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
      })
    });

    const data = await respuesta.json();

    if (data.error) {
      status.innerHTML = `<span style="color: var(--error);">Error API: ${data.error.message}</span>`;
      return;
    }

    let contenidoTexto = data.candidates[0].content.parts[0].text;
    contenidoTexto = contenidoTexto.replace(/```json/gi, '').replace(/```/gi, '').trim();
    const jsonResultado = JSON.parse(contenidoTexto);

    const { error } = await sbApp.from('modulos').insert({
      numero_orden: orden,
      titulo: titulo,
      autor: autorFinal,
      contenido_trazado: texto,
      resumen_formativo: jsonResultado.resumen_formativo,
      conclusion_enlace: jsonResultado.conclusion_enlace,
      preguntas_json: jsonResultado,
      archivo_pdf_base64: pdfBase64Cargado,
      activo: true
    });

    if (error) {
      status.innerText = "Error BD: " + error.message;
    } else {
      status.innerHTML = `<span style="color: var(--success);">¡Trabajo consagrado con éxito con su batería de 8 preguntas!</span>`;
      cargarDatosAdmin();
    }
  } catch (err) {
    status.innerHTML = `<span style="color: var(--error);">Error en procesamiento: ${err.message}</span>`;
  }
}

/* ==========================================================================
   INICIALIZACIÓN AL CARGAR EL DOM
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  inicializarLuminosidad();
  recuperarSesionGuardada();
});
