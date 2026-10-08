if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
}

const SUPABASE_URL = "https://pwnnpjygnviyzyyvfxnq.supabase.co";
const SUPABASE_KEY = "sb_publishable_NExezuss4il3RPgO8Vifxw_pspbe5wF"; 

// Inicialización forzando apikey y Authorization Bearer para evitar error 401
const sbApp = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    }
  }
});

let usuarioActual = null;
let listaModulos = [];
let moduloActual = null;
let misProgresos = {};
let tamanoBase = 19;

// Control de preguntas paso a paso
let indicePreguntaActiva = 0;
let respuestasMarcadas = {};
let moduloAuditando = null;

// Archivo binario en espera de ser adjuntado en Superadmin
let archivoBase64Pendiente = null;

// Cámara Presencial Interactiva (Estado)
let estadoMesasPresencial = [];

// Callback auxiliar para modalConfirmarAccion
let accionConfirmadaCallback = null;

// Temporizador silencioso de lectura (120 segundos)
let temporizadorLecturaId = null;

// Temporizador de inactividad estricto (5 minutos)
let temporizadorInactividad = null;
const TIEMPO_INACTIVIDAD_MS = 5 * 60 * 1000;

function reiniciarTemporizadorInactividad() {
  if (temporizadorInactividad) clearTimeout(temporizadorInactividad);
  if (usuarioActual) {
    temporizadorInactividad = setTimeout(() => {
      alert("Por motivos de seguridad, la sesión se ha cerrado tras 5 minutos de inactividad.");
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

  registrarIngresoAuditoria(usuarioActual);
  configurarEntornoUsuario();
}

async function registrarIngresoAuditoria(usuario) {
  let ipDetectada = "No determinada";
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    if (res.ok) {
      const data = await res.json();
      ipDetectada = data.ip || ipDetectada;
    }
  } catch (e) {
    console.warn("No se pudo obtener IP externa:", e);
  }

  await sbApp.from('registro_accesos').insert({
    usuario_id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    ip_origen: ipDetectada
  });
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
    document.getElementById('seccionMuroUsuarios').classList.add('hidden');
    cargarDatosAdmin();
  } else {
    document.getElementById('modalSigilo').classList.remove('hidden');
  }
}

function aceptarSigilo() {
  document.getElementById('modalSigilo').classList.add('hidden');
  const nombreLimpio = usuarioActual.nombre.replace(/(Q[\.·\s]*H[\.·\s]*)+/gi, '').trim();
  document.getElementById('bienvenidaNombreQH').innerText = `Q.·.H.·. ${nombreLimpio}`;
  document.getElementById('seccionBienvenida').classList.remove('hidden');
}

async function irACatalogoDocencia() {
  document.getElementById('seccionBienvenida').classList.add('hidden');
  document.getElementById('seccionDocenciaInstitucional').classList.add('hidden');
  document.getElementById('seccionMuroUsuarios').classList.add('hidden');
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

  // Controlar visibilidad del botón Muro y Foro en Home según avance
  const btnMuroHome = document.getElementById('btnMuroHome');
  const tieneCompletados = Object.values(misProgresos).some(p => p && p.completado === true);
  if (btnMuroHome) {
    if (tieneCompletados) {
      btnMuroHome.classList.remove('hidden');
    } else {
      btnMuroHome.classList.add('hidden');
    }
  }

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
          <p class="grid-card-autor">${m.autor ? formatearAutorMasonico(m.autor) : "Cámara de Docencia"}</p>
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
  document.getElementById('seccionMuroUsuarios').classList.add('hidden');
  document.getElementById('seccionDocencia').classList.remove('hidden');
  document.getElementById('contadorModulos').innerText = `${listaModulos.length} TEMAS`;
  renderizarSidebar();
  seleccionarModulo(idModulo);
}

function volverACatalogo() {
  if (temporizadorLecturaId) clearTimeout(temporizadorLecturaId);
  document.getElementById('seccionDocencia').classList.add('hidden');
  document.getElementById('seccionDocenciaInstitucional').classList.add('hidden');
  document.getElementById('seccionMuroUsuarios').classList.add('hidden');
  renderizarCatalogoTrabajos();
}

function cerrarSesion() {
  if (temporizadorInactividad) clearTimeout(temporizadorInactividad);
  if (temporizadorLecturaId) clearTimeout(temporizadorLecturaId);
  usuarioActual = null;
  moduloActual = null;
  misProgresos = {};
  respuestasMarcadas = {};
  archivoBase64Pendiente = null;
  sessionStorage.removeItem('camara_usuario_sesion');

  document.getElementById('seccionDocencia').classList.add('hidden');
  document.getElementById('seccionBienvenida').classList.add('hidden');
  document.getElementById('seccionCatalogoTrabajos').classList.add('hidden');
  document.getElementById('seccionDocenciaInstitucional').classList.add('hidden');
  document.getElementById('seccionMuroUsuarios').classList.add('hidden');
  document.getElementById('seccionAdmin').classList.add('hidden');
  document.getElementById('modalSigilo').classList.add('hidden');
  document.getElementById('modalMisAvances').classList.add('hidden');
  document.getElementById('modalCertificado').classList.add('hidden');
  document.getElementById('modalAuditoriaModulo').classList.add('hidden');
  document.getElementById('modalParametrosHermano').classList.add('hidden');
  document.getElementById('modalEditarReflexionAdmin').classList.add('hidden');
  document.getElementById('modalEditarComentarioForo').classList.add('hidden');
  document.getElementById('modalAuditoriaComentario').classList.add('hidden');
  document.getElementById('modalConfirmarAccion').classList.add('hidden');
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
    subtitulo: "La Cámara de Docencia como Escuela de Formación Activa",
    texto: "La Plataforma de Docencia para la Cámara de Maestros es un espacio reservado para los Maestros Masones de la R.·.L.·. Orestes Frödden Lorenzen N° 146. Está concebida como un entorno asíncrono para el análisis conceptual y moral de los trazados de instrucción previa a cada Tenida."
  },
  {
    titulo: "2. Objetivos Principales",
    subtitulo: "Compromiso Moral y Coherencia Doctrinal",
    texto: "Fomentar el estudio riguroso de la docencia del Tercer Grado, verificar la asimilación conceptual de los símbolos y deberes éticos, y consolidar un repositorio de reflexiones que fortalezca la vida interior del taller."
  },
  {
    titulo: "3. Metodología Docente en Tres Fases",
    subtitulo: "Lectura, Diagnóstico Simbólico y Consagración",
    texto: "Fase I: Lectura atenta con tiempo mínimo de análisis reflexivo.\nFase II: Examen formativo de 8 preguntas que culmina en un dilema ético profundo.\nFase III: Consagración de la reflexión personal y acceso al Muro."
  },
  {
    titulo: "4. La Trascendencia de la Maestría",
    subtitulo: "Deber, Coherencia y Rectitud en el Mundo y en el Taller",
    texto: "La Maestría no constituye una investidura de privilegio ni un reposo en la senda, sino la asunción consciente de una responsabilidad inextinguible. Ser Maestro es erigirse en centro de unión y modelo de templanza; es juzgarse con rigor antes de corregir al semejante, amparar con lealtad el honor del hermano ausente y custodiar en la intimidad de la conciencia el juramento consagrado sobre el Ara."
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
  document.getElementById('seccionDocencia').classList.add('hidden');
  document.getElementById('seccionMuroUsuarios').classList.add('hidden');
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
   MURO Y FORO DE REFLEXIONES (DEDUPLICACIÓN EXACTA Y FORMULARIOS INDIVIDUALES)
   ========================================================================== */
async function mostrarMuroReflexionesUsuarios() {
  document.getElementById('seccionDocencia').classList.add('hidden');
  document.getElementById('seccionCatalogoTrabajos').classList.add('hidden');
  document.getElementById('seccionDocenciaInstitucional').classList.add('hidden');
  
  const cont = document.getElementById('contenedorMuroUsuariosDirecto');
  cont.innerHTML = "<p class='td-loading'>Recuperando aportes de la Cámara...</p>";
  document.getElementById('seccionMuroUsuarios').classList.remove('hidden');

  await refrescarProgresosUsuario();

  const { data: aportes, error } = await sbApp
    .from('progreso_maestro')
    .select('id, reflexion, completado_en, modulo_id, usuario_id, usuarios(nombre), modulos(numero_orden, titulo)')
    .eq('completado', true)
    .not('reflexion', 'is', null)
    .order('completado_en', { ascending: false });

  cont.innerHTML = "";

  if (error || !aportes) {
    cont.innerHTML = "<p style='color: var(--error);'>Error al cargar las reflexiones de la Cámara.</p>";
    return;
  }

  // Traer comentarios activos y deduplicar por id
  let comentariosMap = {};
  const { data: comentariosData } = await sbApp
    .from('comentarios_muro')
    .select('id, progreso_id, usuario_id, contenido, contenido_original, editado, editado_en, creado_en, usuarios(nombre)')
    .eq('activo', true)
    .order('creado_en', { ascending: true });

  if (comentariosData) {
    const idsProcesados = new Set();
    comentariosData.forEach(c => {
      if (idsProcesados.has(c.id)) return;
      idsProcesados.add(c.id);

      if (!comentariosMap[c.progreso_id]) comentariosMap[c.progreso_id] = [];
      comentariosMap[c.progreso_id].push(c);
    });
  }

  // Deduplicar reflexiones por (usuario_id + modulo_id)
  const reflexionesPorModulo = {};
  const clavesReflexionVistas = new Set();

  aportes.forEach(a => {
    if (!a.modulo_id || !a.reflexion || a.reflexion.trim() === "") return;
    const claveUnica = `${a.usuario_id}_${a.modulo_id}`;
    if (clavesReflexionVistas.has(claveUnica)) return;
    clavesReflexionVistas.add(claveUnica);

    if (!reflexionesPorModulo[a.modulo_id]) reflexionesPorModulo[a.modulo_id] = [];
    reflexionesPorModulo[a.modulo_id].push(a);
  });

  const modulosCompletadosUsuario = [];
  const modulosPendientesUsuario = [];

  listaModulos.forEach(m => {
    const prog = misProgresos[m.id];
    if (prog && prog.completado) {
      modulosCompletadosUsuario.push({
        ...m,
        fechaCompletado: prog.completado_en ? new Date(prog.completado_en).getTime() : 0
      });
    } else {
      modulosPendientesUsuario.push(m);
    }
  });

  modulosCompletadosUsuario.sort((a, b) => b.fechaCompletado - a.fechaCompletado);

  if (modulosCompletadosUsuario.length === 0) {
    cont.innerHTML = `
      <div style="background: rgba(153, 120, 57, 0.08); border-left: 4px solid var(--accent-gold); padding: 20px; border-radius: 6px;">
        <h3 style="color: var(--accent-gold-dark); margin-bottom: 8px;">Aportes bajo Reserva Docente</h3>
        <p style="margin: 0; font-family: var(--font-ui); font-size: 0.95rem; color: var(--text-main);">
          Q.·.H.·., para acceder a las reflexiones y comentarios vertidos por los Hermanos de la Cámara, debe completar el estudio de los temas correspondientes y consagrar su reflexión personal en la Fase III.
        </p>
      </div>
    `;
    return;
  }

  modulosCompletadosUsuario.forEach(m => {
    const items = reflexionesPorModulo[m.id] || [];
    let reflexionesHtml = "";

    if (items.length === 0) {
      reflexionesHtml = "<p style='font-style: italic; color: var(--text-muted); font-size: 0.9rem;'>No hay reflexiones adicionales en este tema.</p>";
    } else {
      reflexionesHtml = items.map(it => {
        const fechaTxt = it.completado_en 
          ? new Date(it.completado_en).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
          : "";
        
        const comentariosDeEstaReflexion = comentariosMap[it.id] || [];
        let comentariosHtml = comentariosDeEstaReflexion.map(c => {
          const cFecha = c.creado_en 
            ? new Date(c.creado_en).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : "";
          const esAutorComentario = (c.usuario_id === usuarioActual.id);
          const editadoTag = c.editado ? ` <span style="font-size: 0.72rem; color: var(--accent-gold); font-style: italic;">(editado)</span>` : "";

          let botonesComentario = "";
          if (esAutorComentario) {
            botonesComentario += `<button class="foro-comentario-btn" onclick="abrirModalEditarComentario('${c.id}', '${encodeURIComponent(c.contenido)}')">✏️ Editar</button>`;
          }
          if (usuarioActual.es_admin) {
            botonesComentario += `<button class="foro-comentario-btn" onclick="abrirAuditoriaComentario('${c.id}', '${encodeURIComponent(c.contenido_original || c.contenido)}', '${(c.usuarios?.nombre || '').replace(/'/g, "\\'")}', '${cFecha}')">🔍 Huella</button>`;
            botonesComentario += `<button class="foro-comentario-btn" style="color: var(--error);" onclick="eliminarComentarioForo('${c.id}')">🗑️</button>`;
          }

          return `
            <div class="foro-comentario-item">
              <div class="foro-comentario-header">
                <span class="foro-comentario-autor">Aporte del Q.·.H.·. ${c.usuarios?.nombre || "Hermano"}</span>
                <span class="foro-comentario-fecha">${cFecha}${editadoTag}</span>
              </div>
              <div class="foro-comentario-cuerpo">${c.contenido}</div>
              ${botonesComentario ? `<div class="foro-comentario-acciones">${botonesComentario}</div>` : ''}
            </div>
          `;
        }).join('');

        return `
          <div class="reflexion-item" style="margin-bottom: 20px; border-left: 3px solid var(--accent-gold); padding: 18px 20px; border-radius: 0 6px 6px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span class="reflexion-autor">${it.usuarios?.nombre || "Hermano Maestro"}</span>
              <span style="font-size: 0.78rem; color: var(--text-muted); font-family: var(--font-ui);">${fechaTxt}</span>
            </div>
            <div style="font-size: 1rem; line-height: 1.6; font-style: italic; margin-bottom: 8px;">"${it.reflexion}"</div>
            
            <button class="foro-btn-toggle-comentar" onclick="toggleFormularioComentario('${it.id}')">
              💬 Comentarios (${comentariosDeEstaReflexion.length})
            </button>

            <div id="caja_comentario_${it.id}" class="foro-comentar-caja hidden">
              <textarea id="input_comentario_${it.id}" name="input_comentario_${it.id}" rows="3" class="foro-comentar-input" placeholder="Escriba su comentario aquí..."></textarea>
              <div style="display: flex; justify-content: flex-end; gap: 8px;">
                <button class="btn-secondary" style="padding: 6px 12px; font-size: 0.85rem;" onclick="toggleFormularioComentario('${it.id}')">Cancelar</button>
                <button class="btn-primary" style="padding: 6px 14px; font-size: 0.85rem; width: auto;" onclick="enviarComentarioForo('${it.id}', '${m.id}')">Publicar</button>
              </div>
            </div>

            <div class="foro-comentarios-wrapper" id="lista_comentarios_${it.id}">
              ${comentariosHtml}
            </div>
          </div>
        `;
      }).join('');
    }

    cont.innerHTML += `
      <div style="margin-bottom: 34px;">
        <div style="border-bottom: 2px solid var(--accent-gold); padding-bottom: 6px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <span class="muro-trabajo-orden">Trabajo N° ${m.numero_orden}</span>
            <h3 class="muro-trabajo-titulo" style="margin: 2px 0 0 0; font-family: var(--font-reading);">${m.titulo}</h3>
          </div>
          <span style="font-size: 0.8rem; color: var(--success); font-weight: 700; text-transform: uppercase;">✓ Desbloqueado</span>
        </div>
        ${reflexionesHtml}
      </div>
    `;
  });

  if (modulosPendientesUsuario.length > 0) {
    let pendientesListado = modulosPendientesUsuario.map(m => `Trabajo ${m.numero_orden}: ${m.titulo}`).join(' • ');
    cont.innerHTML += `
      <div style="margin-top: 30px; background: rgba(0,0,0,0.03); border: 1px dashed var(--border-color); padding: 18px; border-radius: 6px; font-family: var(--font-ui); font-size: 0.88rem; color: var(--text-muted);">
        <strong>🔒 Trabajos con aportes en reserva docente hasta su completación:</strong><br>
        <span style="font-style: italic;">${pendientesListado}</span>
      </div>
    `;
  }
}

/* ==========================================================================
   GESTIÓN DE COMENTARIOS DEL FORO (HILOS, EDICIÓN Y AUDITORÍA INMUTABLE)
   ========================================================================== */
function toggleFormularioComentario(progresoId) {
  const caja = document.getElementById(`caja_comentario_${progresoId}`);
  if (caja) {
    caja.classList.toggle('hidden');
    if (!caja.classList.contains('hidden')) {
      const txt = document.getElementById(`input_comentario_${progresoId}`);
      if (txt) txt.focus();
    }
  }
}

async function enviarComentarioForo(progresoId, moduloId) {
  const input = document.getElementById(`input_comentario_${progresoId}`);
  if (!input) return;

  const texto = input.value.trim();
  if (texto.length < 5) {
    alert("Q.·.H.·., favor ingrese un comentario con contenido.");
    return;
  }

  let ipDetectada = "No determinada";
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    if (res.ok) {
      const data = await res.json();
      ipDetectada = data.ip || ipDetectada;
    }
  } catch (e) {
    console.warn("No se pudo obtener IP:", e);
  }

  const { error } = await sbApp.from('comentarios_muro').insert({
    progreso_id: progresoId,
    modulo_id: moduloId,
    usuario_id: usuarioActual.id,
    contenido: texto,
    contenido_original: texto,
    ip_origen: ipDetectada,
    activo: true
  });

  if (error) {
    alert("Error al registrar comentario: " + error.message);
  } else {
    input.value = "";
    toggleFormularioComentario(progresoId);
    await mostrarMuroReflexionesUsuarios();
  }
}

function abrirModalEditarComentario(comentarioId, textoCodificado) {
  const texto = decodeURIComponent(textoCodificado);
  document.getElementById('editComentarioId').value = comentarioId;
  document.getElementById('textareaEditarComentario').value = texto;
  document.getElementById('modalEditarComentarioForo').classList.remove('hidden');
}

async function guardarEdicionComentarioModal() {
  const id = document.getElementById('editComentarioId').value;
  const texto = document.getElementById('textareaEditarComentario').value.trim();

  if (texto.length < 5) {
    alert("El texto no puede quedar vacío.");
    return;
  }

  const { error } = await sbApp.from('comentarios_muro').update({
    contenido: texto,
    editado: true,
    editado_en: new Date().toISOString()
  }).eq('id', id);

  if (error) {
    alert("Error al editar comentario: " + error.message);
  } else {
    cerrarModalUniversalDirecto('modalEditarComentarioForo');
    await mostrarMuroReflexionesUsuarios();
  }
}

function abrirAuditoriaComentario(comentarioId, textoOriginalCodificado, autor, fecha) {
  const textoOriginal = decodeURIComponent(textoOriginalCodificado);
  document.getElementById('auditoriaComentarioMeta').innerText = `Autor: ${autor} | Emisión: ${fecha}`;
  document.getElementById('auditoriaTextoOriginal').innerText = textoOriginal;
  document.getElementById('modalAuditoriaComentario').classList.remove('hidden');
}

function eliminarComentarioForo(comentarioId) {
  abrirModalConfirmacion(
    "Eliminar Comentario",
    "¿Está seguro de eliminar este comentario? Dejará de ser visible para los Hermanos, pero su huella original permanecerá auditada.",
    async () => {
      try {
        const { error } = await sbApp
          .from('comentarios_muro')
          .update({ activo: false })
          .eq('id', comentarioId);

        if (error) {
          alert("Error al eliminar: " + error.message);
        } else {
          await mostrarMuroReflexionesUsuarios();
        }
      } catch (err) {
        alert("Error de conexión: " + err.message);
      }
    }
  );
}

/* ==========================================================================
   RENDERIZADO DE TRAZADO CON PÁRRAFOS Y SUBTÍTULOS DESTACADOS
   ========================================================================== */
function renderizarTrazadoEnriquecido(textoBruto) {
  if (!textoBruto) return "";
  const parrafos = textoBruto.split(/\n\s*\n/);
  return parrafos.map(p => {
    let limpio = p.trim();
    if (!limpio) return "";
    
    const esTitulo = /^(I{1,3}|IV|V|VI{0,3}|IX|X|\d+)\.?\s+[A-ZÁÉÍÓÚ\s]{4,}$/m.test(limpio) ||
                     (limpio.length < 90 && limpio.endsWith(':')) ||
                     (limpio.length < 80 && limpio === limpio.toUpperCase() && !limpio.includes('. '));

    if (esTitulo) {
      return `<h3 class="trazado-subtitulo">${limpio}</h3>`;
    }
    return `<p class="trazado-parrafo">${limpio.replace(/\n/g, ' ')}</p>`;
  }).join('');
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
  
  document.getElementById('vistaTexto').innerHTML = renderizarTrazadoEnriquecido(moduloActual.contenido_trazado);

  const tabPdf = document.getElementById('tabPdf');
  const framePdf = document.getElementById('framePdf');
  const btnDescargar = document.getElementById('btnDescargarTrazado');

  let rutaArchivo = moduloActual.archivo_pdf_base64 || moduloActual.archivo_url;

  if (rutaArchivo && rutaArchivo.trim() !== "") {
    btnDescargar.href = rutaArchivo;
    
    const esWord = rutaArchivo.startsWith('data:application/vnd.openxmlformats') || rutaArchivo.endsWith('.docx');
    const extension = esWord ? '.docx' : '.pdf';
    btnDescargar.download = `Trabajo_${moduloActual.numero_orden}_${moduloActual.titulo.replace(/[\s\W]+/g, '_')}${extension}`;
    btnDescargar.classList.remove('hidden');

    if (!esWord && (rutaArchivo.startsWith('data:application/pdf') || rutaArchivo.endsWith('.pdf'))) {
      tabPdf.classList.remove('hidden');
      framePdf.src = rutaArchivo;
    } else {
      tabPdf.classList.add('hidden');
      cambiarVistaDocencia('texto');
    }
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
  }, 120000);
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

  let opcionesHtml = p.opciones.map(op => {
    const inputId = `preg_opt_${indicePreguntaActiva}_${op.letra}`;
    return `
      <label class="opcion-label" id="label_paso_${op.letra}" for="${inputId}" onclick="evaluarRespuestaPasoAPaso('${op.letra}', '${p.respuesta_correcta}')">
        <input type="radio" id="${inputId}" name="preg_paso_radio_${indicePreguntaActiva}" value="${op.letra}">
        <span><strong>${op.letra})</strong> ${op.texto}</span>
      </label>
    `;
  }).join('');

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

  sbApp.from('progreso_maestro')
    .update({ leido: true })
    .eq('usuario_id', usuarioActual.id)
    .eq('modulo_id', moduloActual.id);

  respuestasMarcadas[indicePreguntaActiva] = letraSeleccionada;

  const radios = document.querySelectorAll(`input[name="preg_paso_radio_${indicePreguntaActiva}"]`);
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

  const totalPreguntas = moduloActual.preguntas_json?.preguntas || 8;
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
   FASE III: REFLEXIÓN Y MURO DEL TEMA
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
    .select('id, reflexion, completado_en, modulo_id, usuario_id, usuarios(nombre)')
    .eq('modulo_id', moduloActual.id)
    .eq('completado', true)
    .not('reflexion', 'is', null);

  contenedor.innerHTML = "";
  if (!error && data && data.length > 0) {
    let comentariosMap = {};
    const { data: comentariosData } = await sbApp
      .from('comentarios_muro')
      .select('id, progreso_id, usuario_id, contenido, contenido_original, editado, editado_en, creado_en, usuarios(nombre)')
      .eq('modulo_id', moduloActual.id)
      .eq('activo', true)
      .order('creado_en', { ascending: true });

    if (comentariosData) {
      const idsProcesados = new Set();
      comentariosData.forEach(c => {
        if (idsProcesados.has(c.id)) return;
        idsProcesados.add(c.id);

        if (!comentariosMap[c.progreso_id]) comentariosMap[c.progreso_id] = [];
        comentariosMap[c.progreso_id].push(c);
      });
    }

    const usuariosVistos = new Set();

    data.forEach(item => {
      if (!item.reflexion || item.reflexion.trim() === "" || item.modulo_id !== moduloActual.id) return;
      if (usuariosVistos.has(item.usuario_id)) return;
      usuariosVistos.add(item.usuario_id);

      const coms = comentariosMap[item.id] || [];
      let comsHtml = coms.map(c => {
        const cFecha = c.creado_en 
          ? new Date(c.creado_en).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : "";
        const esAutor = (c.usuario_id === usuarioActual.id);
        const editadoTag = c.editado ? ` <span style="font-size: 0.72rem; color: var(--accent-gold); font-style: italic;">(editado)</span>` : "";

        let botonesComentario = "";
        if (esAutor) {
          botonesComentario += `<button class="foro-comentario-btn" onclick="abrirModalEditarComentario('${c.id}', '${encodeURIComponent(c.contenido)}')">✏️ Editar</button>`;
        }
        if (usuarioActual.es_admin) {
          botonesComentario += `<button class="foro-comentario-btn" onclick="abrirAuditoriaComentario('${c.id}', '${encodeURIComponent(c.contenido_original || c.contenido)}', '${(c.usuarios?.nombre || '').replace(/'/g, "\\'")}', '${cFecha}')">🔍 Huella</button>`;
          botonesComentario += `<button class="foro-comentario-btn" style="color: var(--error);" onclick="eliminarComentarioForo('${c.id}')">🗑️</button>`;
        }

        return `
          <div class="foro-comentario-item">
            <div class="foro-comentario-header">
              <span class="foro-comentario-autor">Aporte del Q.·.H.·. ${c.usuarios?.nombre || "Hermano"}</span>
              <span class="foro-comentario-fecha">${cFecha}${editadoTag}</span>
            </div>
            <div class="foro-comentario-cuerpo">${c.contenido}</div>
            ${botonesComentario ? `<div class="foro-comentario-acciones">${botonesComentario}</div>` : ''}
          </div>
        `;
      }).join('');

      contenedor.innerHTML += `
        <div class="reflexion-item" style="margin-bottom: 20px;">
          <div class="reflexion-autor">${item.usuarios?.nombre || "Hermano Maestro"}</div>
          <div style="font-style: italic; margin-bottom: 8px;">"${item.reflexion}"</div>
          
          <button class="foro-btn-toggle-comentar" onclick="toggleFormularioComentario('${item.id}')">
            💬 Comentarios (${coms.length})
          </button>

          <div id="caja_comentario_${item.id}" class="foro-comentar-caja hidden">
            <textarea id="input_comentario_${item.id}" name="input_comentario_${item.id}" rows="3" class="foro-comentar-input" placeholder="Escriba su comentario aquí..."></textarea>
            <div style="display: flex; justify-content: flex-end; gap: 8px;">
              <button class="btn-secondary" style="padding: 6px 12px; font-size: 0.85rem;" onclick="toggleFormularioComentario('${item.id}')">Cancelar</button>
              <button class="btn-primary" style="padding: 6px 14px; font-size: 0.85rem; width: auto;" onclick="enviarComentarioForo('${item.id}', '${moduloActual.id}')">Publicar</button>
            </div>
          </div>

          <div class="foro-comentarios-wrapper" id="lista_comentarios_${item.id}">
            ${comsHtml}
          </div>
        </div>
      `;
    });
  } else {
    contenedor.innerHTML = "<p style='color: var(--text-muted); font-style: italic;'>Aún no hay reflexiones consagradas en este trabajo.</p>";
  }
}

/* ==========================================================================
   MIS AVANCES E INFORME PDF LIMPIO (300 DPI, SIN CORTES)
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
        @page { size: letter portrait; margin: 12mm 15mm; }
        body { margin: 0; padding: 0; font-family: 'Inter', system-ui, sans-serif; color: #1A202C; background: #FFFFFF; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .informe-carta { width: 100%; box-shadow: none !important; padding: 0 !important; }
        .informe-header-box { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .informe-brand p { font-size: 8.5pt; line-height: 1.35; margin: 0; font-weight: 700; color: #152433; }
        .img-emblema-discreto { height: 52px; object-fit: contain; }
        .informe-meta-header { text-align: right; font-size: 8pt; color: #718096; }
        .informe-hr { border: 0; height: 2px; background: #152433; margin: 8px 0 14px 0; }
        .informe-constancia { font-size: 9.5pt; line-height: 1.5; margin-bottom: 16px; }
        .informe-kpis-flex { display: flex; gap: 12px; margin-bottom: 18px; }
        .kpi-card-flex { flex: 1; background: #F7FAFC; border: 1px solid #CBD5E0; border-radius: 4px; padding: 8px; text-align: center; }
        .kpi-valor { font-size: 15pt; font-weight: 700; color: #152433; }
        .kpi-label { font-size: 7.5pt; color: #718096; text-transform: uppercase; }
        .informe-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 16px; }
        .informe-table th { background: #EDF2F7; border: 1px solid #CBD5E0; padding: 6px 8px; text-align: left; }
        .informe-table td { border: 1px solid #E2E8F0; padding: 6px 8px; vertical-align: top; }
        .informe-pie-doc { border-top: 1px solid #CBD5E0; padding-top: 8px; font-size: 7.5pt; color: #A0AEC0; display: flex; justify-content: space-between; }
        .no-print { display: none !important; }
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
   CERTIFICADO OFICIAL A4: SIMETRÍA Y EXPORTACIÓN VECTORIAL
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

function abrirModalConfirmacion(titulo, mensaje, callback) {
  document.getElementById('modalConfirmarTitulo').innerText = titulo;
  document.getElementById('modalConfirmarMensaje').innerText = mensaje;
  accionConfirmadaCallback = callback;
  
  const btn = document.getElementById('btnEjecutarConfirmacion');
  btn.onclick = () => {
    cerrarModalUniversalDirecto('modalConfirmarAccion');
    if (accionConfirmadaCallback) accionConfirmadaCallback();
  };

  document.getElementById('modalConfirmarAccion').classList.remove('hidden');
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    ['modalCertificado', 'modalMisAvances', 'modalAuditoriaModulo', 'modalParametrosHermano', 'modalEditarReflexionAdmin', 'modalEditarComentarioForo', 'modalAuditoriaComentario', 'modalConfirmarAccion'].forEach(id => {
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
   CONSOLA SUPERADMIN: CARGA Y SUBSECCIONES
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
  
  const selectPresencialMod = document.getElementById('selectOrigenTrabajoPresencial');
  if (selectPresencialMod) {
    selectPresencialMod.innerHTML = `<option value="aleatorio">🎲 Todos los Trabajos (Aleatorio)</option>`;
  }

  const selectAdjunto = document.getElementById('selectModuloParaArchivo');
  if (selectAdjunto) {
    selectAdjunto.innerHTML = "";
  }

  listaModulos.forEach(m => {
    selectMetricas.innerHTML += `<option value="${m.id}">Trabajo ${m.numero_orden}: ${m.titulo}</option>`;
    if (selectPresencialMod) {
      selectPresencialMod.innerHTML += `<option value="${m.id}">Trabajo ${m.numero_orden}: ${m.titulo}</option>`;
    }
    if (selectAdjunto) {
      selectAdjunto.innerHTML += `<option value="${m.id}">Trabajo ${m.numero_orden}: ${m.titulo}</option>`;
    }
  });

  if (selectAdjunto && listaModulos.length > 0) {
    verificarEstadoArchivoModulo(selectAdjunto.value || listaModulos[0].id);
  }

  cambiarSubseccionAdmin('cargar');
}

function cambiarSubseccionAdmin(seccion) {
  const btns = ['tabNavCargar', 'tabNavGestionTrabajos', 'tabNavPresencial', 'tabNavMuroGeneral', 'tabNavMetricas', 'tabNavEditorDoctrina', 'tabNavAccesos'];
  const secs = ['adminSeccionCarga', 'adminSeccionGestionTrabajos', 'adminSeccionPresencial', 'adminSeccionMuroGeneral', 'adminSeccionMetricas', 'adminSeccionEditorDoctrina', 'adminSeccionAccesos'];

  btns.forEach(b => document.getElementById(b)?.classList.remove('active'));
  secs.forEach(s => document.getElementById(s)?.classList.add('hidden'));

  if (seccion === 'cargar') {
    document.getElementById('tabNavCargar').classList.add('active');
    document.getElementById('adminSeccionCarga').classList.remove('hidden');
  } else if (seccion === 'gestion_trabajos') {
    document.getElementById('tabNavGestionTrabajos').classList.add('active');
    document.getElementById('adminSeccionGestionTrabajos').classList.remove('hidden');
    cargarGestionTrabajosAdmin();
  } else if (seccion === 'presencial') {
    document.getElementById('tabNavPresencial').classList.add('active');
    document.getElementById('adminSeccionPresencial').classList.remove('hidden');
  } else if (seccion === 'muro_general') {
    document.getElementById('tabNavMuroGeneral').classList.add('active');
    document.getElementById('adminSeccionMuroGeneral').classList.remove('hidden');
    cargarMuroGeneralAdmin();
  } else if (seccion === 'editor_doctrina') {
    document.getElementById('tabNavEditorDoctrina').classList.add('active');
    document.getElementById('adminSeccionEditorDoctrina').classList.remove('hidden');
    cargarEditorDoctrinaAdmin();
  } else if (seccion === 'accesos') {
    document.getElementById('tabNavAccesos').classList.add('active');
    document.getElementById('adminSeccionAccesos').classList.remove('hidden');
    cargarBitacoraAccesos();
  } else {
    document.getElementById('tabNavMetricas').classList.add('active');
    document.getElementById('adminSeccionMetricas').classList.remove('hidden');
    if (listaModulos.length > 0) {
      const select = document.getElementById('selectMetricasModulo');
      cargarMetricasAvance(select.value || listaModulos[0].id);
    }
  }
}

/* ==========================================================================
   ASOCIACIÓN DIRECTA DE ARCHIVO ORIGINAL (PDF / DOCX) EN SUPERADMIN
   ========================================================================== */
function verificarEstadoArchivoModulo(moduloId) {
  const m = listaModulos.find(mod => mod.id === moduloId);
  const pEstado = document.getElementById('estadoArchivoActual');
  if (!m || !pEstado) return;

  if (m.archivo_pdf_base64 || m.archivo_url) {
    pEstado.innerHTML = `<span style="color: var(--success); font-weight: 600;">✓ Este trabajo ya cuenta con un archivo asociado listo para descarga. Subir uno nuevo lo reemplazará.</span>`;
  } else {
    pEstado.innerHTML = `<span style="color: var(--text-muted); font-style: italic;">Este trabajo aún no tiene archivo asociado (descarga inactiva para los Hermanos).</span>`;
  }
}

function procesarArchivoParaAdjuntar(event) {
  const file = event.target.files[0];
  const status = document.getElementById('archivoAdjuntoStatus');
  archivoBase64Pendiente = null;

  if (!file) {
    status.innerText = "";
    return;
  }

  status.innerText = `Leyendo "${file.name}"...`;

  const reader = new FileReader();
  reader.onload = function(e) {
    archivoBase64Pendiente = e.target.result;
    status.innerText = `✓ "${file.name}" procesado (${(file.size / 1024).toFixed(1)} KB). Listo para guardar.`;
  };
  reader.onerror = function() {
    status.innerText = "Error al leer el archivo en el navegador.";
  };
  reader.readAsDataURL(file);
}

async function guardarArchivoOriginalEnBD() {
  const selectModulo = document.getElementById('selectModuloParaArchivo');
  const moduloId = selectModulo ? selectModulo.value : null;
  const status = document.getElementById('adminAdjuntoStatus');

  if (!moduloId) {
    alert("Seleccione un trabajo.");
    return;
  }

  if (!archivoBase64Pendiente) {
    alert("Seleccione primero un archivo PDF o Word.");
    return;
  }

  status.innerHTML = "<em>Guardando archivo en la base de datos...</em>";

  const { error } = await sbApp
    .from('modulos')
    .update({ archivo_pdf_base64: archivoBase64Pendiente })
    .eq('id', moduloId);

  if (error) {
    status.innerHTML = `<span style="color: var(--error);">Error al guardar: ${error.message}</span>`;
  } else {
    status.innerHTML = `<span style="color: var(--success);">¡Archivo original asociado con éxito! La descarga ha quedado habilitada para los Hermanos.</span>`;
    
    const m = listaModulos.find(mod => mod.id === moduloId);
    if (m) m.archivo_pdf_base64 = archivoBase64Pendiente;

    document.getElementById('archivoDocAdjunto').value = '';
    document.getElementById('archivoAdjuntoStatus').innerText = '';
    archivoBase64Pendiente = null;
    verificarEstadoArchivoModulo(moduloId);
  }
}

/* ==========================================================================
   BITÁCORA DE ACCESOS E HISTORIAL POR FECHA
   ========================================================================== */
async function cargarBitacoraAccesos(filtroUsuarioId = null) {
  const tbody = document.getElementById('tablaAccesosBody');
  tbody.innerHTML = `<tr><td colspan="4" class="td-loading">Consultando registros...</td></tr>`;

  const selectFiltro = document.getElementById('filtroUsuarioAcceso');
  if (selectFiltro && selectFiltro.options.length <= 1) {
    const { data: usrs } = await sbApp.from('usuarios').select('id, nombre').order('nombre', { ascending: true });
    if (usrs) {
      usrs.forEach(u => {
        selectFiltro.innerHTML += `<option value="${u.id}">${u.nombre}</option>`;
      });
    }
  }

  let query = sbApp
    .from('registro_accesos')
    .select('*')
    .order('creado_en', { ascending: false })
    .limit(100);

  const filtroActual = filtroUsuarioId || (selectFiltro ? selectFiltro.value : 'todos');
  if (filtroActual && filtroActual !== 'todos') {
    query = query.eq('usuario_id', filtroActual);
  }

  const { data: registros, error } = await query;

  tbody.innerHTML = "";

  if (error || !registros || registros.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); font-style: italic;">No hay ingresos registrados para el criterio seleccionado.</td></tr>`;
    return;
  }

  registros.forEach(r => {
    const d = new Date(r.creado_en);
    const fechaTxt = d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const horaTxt = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    tbody.innerHTML += `
      <tr>
        <td style="white-space: nowrap;"><strong>${fechaTxt}</strong> <span style="font-size: 0.8rem; color: var(--text-muted);">${horaTxt}</span></td>
        <td><span style="font-weight: 600;">${r.nombre || "Hermano"}</span></td>
        <td style="font-family: monospace; font-size: 0.88rem;">${r.email}</td>
        <td><span style="background: rgba(153,120,57,0.1); color: var(--accent-gold-dark); padding: 3px 8px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">${r.ip_origen || "—"}</span></td>
      </tr>
    `;
  });
}

/* ==========================================================================
   CÁMARA INTERACTIVA PRESENCIAL: GRUPOS, DILEMAS, TABLERO Y GUÍA DOCTRINAL
   ========================================================================== */
async function generarDinamicaPresencial() {
  const numMesas = parseInt(document.getElementById('numMesasPresencial').value) || 4;
  const tipoDinamica = document.getElementById('selectTipoDinamicaPresencial').value;
  const origenMod = document.getElementById('selectOrigenTrabajoPresencial').value;

  const nombresMesas = ["Mesa Oriente", "Mesa Occidente", "Mesa Mediodía", "Mesa Septentrión", "Mesa del Ara"];
  estadoMesasPresencial = [];

  for (let i = 0; i < numMesas; i++) {
    estadoMesasPresencial.push({
      id: i,
      nombre: nombresMesas[i] || `Mesa ${i + 1}`,
      puntos: 100
    });
  }

  let modulosDisponibles = listaModulos;
  if (origenMod !== "aleatorio") {
    modulosDisponibles = listaModulos.filter(m => m.id === origenMod);
  }
  if (modulosDisponibles.length === 0) modulosDisponibles = listaModulos;

  const dilemasDisponibles = [];
  modulosDisponibles.forEach(m => {
    const pregs = m.preguntas_json?.preguntas || [];
    if (pregs.length >= 8) {
      const p8 = pregs[7];
      const opcionCorrectaObj = p8.opciones?.find(o => o.letra === p8.respuesta_correcta);
      dilemasDisponibles.push({
        origen: `Trabajo N° ${m.numero_orden}: ${m.titulo}`,
        enunciado: p8.enunciado,
        opcionCorrecta: opcionCorrectaObj ? `${p8.respuesta_correcta}) ${opcionCorrectaObj.texto}` : p8.respuesta_correcta,
        retro: p8.retroalimentacion || "Criterio ético para el análisis del caso."
      });
    }
  });

  let moduloRef = modulosDisponibles[Math.floor(Math.random() * modulosDisponibles.length)];
  let tituloDinamica = "";
  let cuerpoDilema = "";
  let pautaModerador = "";

  if (tipoDinamica === "1") {
    tituloDinamica = "⚖️ Dinámica 1: El Tribunal de la Conciencia y los Dos Defensores";
    const d = dilemasDisponibles[Math.floor(Math.random() * dilemasDisponibles.length)] || {
      origen: moduloRef ? `Trabajo N° ${moduloRef.numero_orden}: ${moduloRef.titulo}` : "Docencia del Grado",
      enunciado: "Un Hermano solicita apoyo financiero urgente para un negocio riesgoso invocando el secreto del grado.",
      opcionCorrecta: "Preservar el bienestar familiar y brindar apoyo técnico sin comprometer la subsistencia del hogar.",
      retro: "La solidaridad no debe vulnerar la prudencia ni los deberes con la familia y la ley moral."
    };

    cuerpoDilema = `
      <strong>Insumo Docente:</strong> ${d.origen}<br><br>
      <strong>Dilema Ético Planteado:</strong><br>
      "${d.enunciado}"<br><br>
      <em>Consigna para las Mesas:</em> En 5 minutos, un integrante defiende el deber estricto, otro la indulgencia y el grupo redacta un veredicto de consenso.
    `;

    pautaModerador = `
      <strong>Línea Recomendada:</strong> ${d.opcionCorrecta}<br>
      <strong>Fundamento:</strong> ${d.retro}<br><br>
      <strong>Pregunta Guía:</strong> <em>"¿Puede considerarse correcta una solicitud que traslada irresponsablemente el riesgo material a un hermano?"</em>
    `;
  } else if (tipoDinamica === "2") {
    tituloDinamica = "🎭 Dinámica 2: El Coloquio de las Máscaras Cruzadas (Aporte Anónimo)";
    const { data: reflexionesMuro } = await sbApp
      .from('progreso_maestro')
      .select('reflexion')
      .eq('completado', true)
      .not('reflexion', 'is', null)
      .limit(20);

    let refTexto = "El secreto es saber callar ante la provocación y responder únicamente con el trabajo bien hecho.";
    if (reflexionesMuro && reflexionesMuro.length > 0) {
      const azar = reflexionesMuro[Math.floor(Math.random() * reflexionesMuro.length)];
      if (azar.reflexion) refTexto = azar.reflexion;
    }

    cuerpoDilema = `
      <strong>Reflexión Extraída del Muro:</strong><br>
      "${refTexto}"<br><br>
      <em>Consigna para las Mesas:</em> Encuentren el punto ciego de esta postura y preparen una refutación ante el resto del taller.
    `;

    pautaModerador = `
      <strong>Línea Recomendada:</strong> El silencio es prudencia frente al ataque vano, pero es perjudicial si permite la consumación de una injusticia contra un tercero.<br>
      <strong>Pregunta Guía:</strong> <em>"¿Dónde termina la discreción y dónde comienza la complicidad del silencio?"</em>
    `;
  } else if (tipoDinamica === "3") {
    tituloDinamica = "⚡ Dinámica 3: La Piedra de Toque (Dilema Rápido y Contra-Ataque)";
    cuerpoDilema = `
      <strong>Situación Planteada:</strong><br>
      "En un entorno externo, un integrante del taller es atacado con calumnias sobre su vida privada. ¿Cómo interviene usted en el acto sin desvelar la filiación institucional?"<br><br>
      <em>Consigna:</em> 3 minutos de debate en mesa. Un portavoz expone la estrategia en 60 segundos; las otras mesas pueden objetar.
    `;

    pautaModerador = `
      <strong>Línea Recomendada:</strong> Defender la honra de la persona en base a principios de justicia y presunción de inocencia, sin mencionar la institución.<br>
      <strong>Fundamento:</strong> Actuar con rectitud sin exponer reservas institucionales.
    `;
  } else if (tipoDinamica === "cierre_trivial") {
    tituloDinamica = "🏆 Cierre: Pregunta de Análisis";
    cuerpoDilema = `
      <strong>Interrogante Relámpago:</strong><br>
      "¿Cuál es la diferencia entre el Secreto del Maestro y el Silencio del Aprendiz frente a una crisis pública?"<br><br>
      <em>Consigna:</em> Respuesta de 30 segundos por mesa. El razonamiento más lúcido gana +20 puntos.
    `;

    pautaModerador = `
      <strong>Clave:</strong> El Aprendiz guarda silencio como disciplina interior de escucha; el Maestro custodia el secreto por prudencia activa y discernimiento moral.
    `;
  } else {
    tituloDinamica = "🚨 Cierre: Plan de Contingencia (60 Segundos)";
    cuerpoDilema = `
      <strong>Situación Inesperada:</strong><br>
      "A minutos de abrir la sesión, se corta el suministro eléctrico, faltan dos oficiales y un visitante profano espera en pasos perdidos por error. ¿Cuál es el plan inmediato de su mesa?"<br><br>
      <em>Consigna:</em> 60 segundos para exponer la solución más rápida y ordenada.
    `;

    pautaModerador = `
      <strong>Solución Óptima:</strong> Encender luminarias de reserva, cubrir los puestos vacantes con los asistentes disponibles y comisionar a un Maestro para orientar y trasladar al visitante al exterior.
    `;
  }

  const pautaHtml = `
    <div class="pauta-moderador-box">
      <button class="pauta-moderador-toggle" onclick="togglePautaModerador()">
        👁️ Ver Pauta / Clave del Moderador
      </button>
      <div id="cuerpoPautaModerador" class="pauta-moderador-contenido hidden">
        ${pautaModerador}
      </div>
    </div>
  `;

  document.getElementById('tituloDinamicaActiva').innerHTML = tituloDinamica;
  document.getElementById('dilemaDinamicaActiva').innerHTML = cuerpoDilema + pautaHtml;

  renderizarTableroMesasPresencial();
  document.getElementById('contenedorDinamicaEnVivo').classList.remove('hidden');
}

function togglePautaModerador() {
  const p = document.getElementById('cuerpoPautaModerador');
  if (p) {
    p.classList.toggle('hidden');
  }
}

function renderizarTableroMesasPresencial() {
  const cont = document.getElementById('mesasTrabajoDinamica');
  cont.innerHTML = "";

  estadoMesasPresencial.forEach(m => {
    cont.innerHTML += `
      <div class="mesa-card" id="card_mesa_${m.id}">
        <div>
          <div class="mesa-header">
            <h4 style="margin: 0; color: var(--primary);">${m.nombre}</h4>
            <span class="mesa-puntos-box" id="pts_mesa_${m.id}">${m.puntos} Pts</span>
          </div>
          <div style="margin-bottom: 12px;">
            <input type="text" placeholder="Anotar integrantes presentes..." style="font-size: 0.8rem; padding: 6px 8px; border: 1px dashed var(--border-color); background: transparent;">
          </div>
        </div>
        <div class="mesa-acciones-puntos">
          <div class="btn-puntos-fila">
            <button class="btn-pt-bono" onclick="modificarPuntosMesa(${m.id}, 15)">+15 Precisión</button>
            <button class="btn-pt-bono" onclick="modificarPuntosMesa(${m.id}, 20)">+20 Aporte Lúcido</button>
          </div>
          <div class="btn-puntos-fila">
            <button class="btn-pt-sancion" onclick="modificarPuntosMesa(${m.id}, -10)">-10 Divagación</button>
            <button class="btn-pt-sancion" onclick="modificarPuntosMesa(${m.id}, -15)">-15 Sin Acuerdo</button>
          </div>
        </div>
      </div>
    `;
  });
}

function modificarPuntosMesa(mesaId, delta) {
  const mesa = estadoMesasPresencial.find(m => m.id === mesaId);
  if (!mesa) return;
  mesa.puntos += delta;
  document.getElementById(`pts_mesa_${mesaId}`).innerText = `${mesa.puntos} Pts`;
}

/* ==========================================================================
   GESTIÓN DIRECTA DE TRABAJOS (BOTONES ALINEADOS A LA DERECHA)
   ========================================================================== */
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
      <div class="card card-gestion-trabajo">
        <div class="gestion-trabajo-info">
          <span class="gestion-trabajo-orden">TRABAJO N° ${m.numero_orden}</span>
          <h4 class="gestion-trabajo-titulo">${m.titulo}</h4>
          <p class="gestion-trabajo-autor">${m.autor ? formatearAutorMasonico(m.autor) : "Cámara de Docencia"}</p>
        </div>
        <div class="gestion-trabajo-botones">
          <button class="admin-link-btn" onclick="abrirAuditoriaModulo('${m.id}')">🔍 Auditar / Editar 8 Preguntas</button>
          <button class="admin-link-btn btn-eliminar-trabajo" onclick="eliminarModuloYReordenar('${m.id}')">🗑️ Eliminar</button>
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

  renderizarEditorPreguntasAuditoria();
  document.getElementById('modalAuditoriaModulo').classList.remove('hidden');
}

function renderizarEditorPreguntasAuditoria() {
  const contPreguntas = document.getElementById('cuerpoPreguntasAuditoria');
  contPreguntas.innerHTML = "";

  const preguntas = moduloAuditando.preguntas_json?.preguntas || [];
  preguntas.forEach((p, idx) => {
    const esEtica = (idx === preguntas.length - 1);
    
    let opcionesInputs = ['A', 'B', 'C', 'D'].map(letra => {
      const opObj = p.opciones?.find(o => o.letra === letra) || { letra: letra, texto: "" };
      return `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <strong style="width: 20px;">${letra})</strong>
          <input type="text" id="edit_p_${idx}_op_${letra}" name="edit_p_${idx}_op_${letra}" value="${opObj.texto.replace(/"/g, '&quot;')}" style="flex: 1; padding: 6px 10px; font-size: 0.9rem;">
        </div>
      `;
    }).join('');

    contPreguntas.innerHTML += `
      <div class="bloque-doctrina-card" style="margin-bottom: 16px; border-left-color: ${esEtica ? 'var(--accent-gold)' : 'var(--primary)'};">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <strong style="color: var(--accent-gold-dark);">${esEtica ? 'Pregunta 8 (Dilema Ético)' : `Pregunta ${idx + 1}`}</strong>
          <div style="display: flex; align-items: center; gap: 8px;">
            <label for="edit_p_${idx}_correcta" style="font-size: 0.85rem; font-weight: 700;">Respuesta Correcta:</label>
            <select id="edit_p_${idx}_correcta" name="edit_p_${idx}_correcta" style="width: 70px; padding: 4px 8px;">
              <option value="A" ${p.respuesta_correcta === 'A' ? 'selected' : ''}>A</option>
              <option value="B" ${p.respuesta_correcta === 'B' ? 'selected' : ''}>B</option>
              <option value="C" ${p.respuesta_correcta === 'C' ? 'selected' : ''}>C</option>
              <option value="D" ${p.respuesta_correcta === 'D' ? 'selected' : ''}>D</option>
            </select>
          </div>
        </div>
        <div class="form-group" style="margin-bottom: 10px;">
          <label for="edit_p_${idx}_enunciado">Enunciado:</label>
          <input type="text" id="edit_p_${idx}_enunciado" name="edit_p_${idx}_enunciado" value="${(p.enunciado || '').replace(/"/g, '&quot;')}" style="font-size: 0.95rem;">
        </div>
        <div style="margin-bottom: 10px;">
          <span style="font-size: 0.85rem; font-weight: 600; display: block; margin-bottom: 4px;">Alternativas:</span>
          ${opcionesInputs}
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label for="edit_p_${idx}_retro">Retroalimentación:</label>
          <input type="text" id="edit_p_${idx}_retro" name="edit_p_${idx}_retro" value="${(p.retroalimentacion || '').replace(/"/g, '&quot;')}" style="font-size: 0.9rem;">
        </div>
      </div>
    `;
  });
}

async function guardarTodasPreguntasAuditoria() {
  if (!moduloAuditando) return;

  const preguntas = moduloAuditando.preguntas_json?.preguntas || [];
  preguntas.forEach((p, idx) => {
    p.enunciado = document.getElementById(`edit_p_${idx}_enunciado`).value.trim();
    p.respuesta_correcta = document.getElementById(`edit_p_${idx}_correcta`).value;
    p.retroalimentacion = document.getElementById(`edit_p_${idx}_retro`).value.trim();
    p.opciones = ['A', 'B', 'C', 'D'].map(letra => ({
      letra: letra,
      texto: document.getElementById(`edit_p_${idx}_op_${letra}`).value.trim()
    }));
  });

  const nuevoJson = {
    ...moduloAuditando.preguntas_json,
    preguntas: preguntas
  };

  const { error } = await sbApp
    .from('modulos')
    .update({ preguntas_json: nuevoJson })
    .eq('id', moduloAuditando.id);

  if (error) {
    alert("Error al actualizar preguntas: " + error.message);
  } else {
    moduloAuditando.preguntas_json = nuevoJson;
    alert("Batería de 8 preguntas actualizada exitosamente.");
  }
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
    alert("Error al actualizar trabajo: " + error.message);
  } else {
    moduloAuditando.titulo = nuevoTitulo;
    moduloAuditando.autor = nuevoAutor;
    moduloAuditando.numero_orden = nuevoOrden;
    moduloAuditando.contenido_trazado = nuevoTexto;
    alert("Título, encabezado y texto guardados exitosamente.");
    await cargarDatosAdmin();
    cargarGestionTrabajosAdmin();
  }
}

function eliminarModuloYReordenar(moduloId) {
  abrirModalConfirmacion(
    "Eliminar Trabajo",
    "¿Está seguro de eliminar este trabajo? Todos los módulos restantes se renumerarán correlativamente (1, 2, 3...).",
    async () => {
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

      await cargarDatosAdmin();
      cargarGestionTrabajosAdmin();
    }
  );
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
   EDITOR DE DOCTRINA CON REORDENAMIENTO Y BLOQUES DINÁMICOS
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
          <div class="bloque-doctrina-acciones">
            <button class="admin-link-btn" onclick="moverBloqueDoctrinaAdmin(${idx}, -1)" ${idx === 0 ? 'disabled style="opacity:0.4;"' : ''}>⬆ Subir</button>
            <button class="admin-link-btn" onclick="moverBloqueDoctrinaAdmin(${idx}, 1)" ${idx === bloquesDoctrinaAdmin.length - 1 ? 'disabled style="opacity:0.4;"' : ''}>⬇ Bajar</button>
            <button class="admin-link-btn" style="color: var(--error); border-color: var(--error);" onclick="eliminarBloqueDoctrinaAdmin(${idx})">🗑️ Eliminar</button>
          </div>
        </div>
        <div class="form-group">
          <label for="doc_tit_${idx}">Título:</label>
          <input type="text" id="doc_tit_${idx}" name="doc_tit_${idx}" value="${(b.titulo || '').replace(/"/g, '&quot;')}" oninput="bloquesDoctrinaAdmin[${idx}].titulo = this.value">
        </div>
        <div class="form-group">
          <label for="doc_sub_${idx}">Subtítulo:</label>
          <input type="text" id="doc_sub_${idx}" name="doc_sub_${idx}" value="${(b.subtitulo || '').replace(/"/g, '&quot;')}" oninput="bloquesDoctrinaAdmin[${idx}].subtitulo = this.value">
        </div>
        <div class="form-group">
          <label for="doc_txt_${idx}">Texto Doctrinal:</label>
          <textarea id="doc_txt_${idx}" name="doc_txt_${idx}" rows="4" oninput="bloquesDoctrinaAdmin[${idx}].texto = this.value">${b.texto || ''}</textarea>
        </div>
      </div>
    `;
  });
}

function moverBloqueDoctrinaAdmin(idx, direccion) {
  const nuevoIdx = idx + direccion;
  if (nuevoIdx < 0 || nuevoIdx >= bloquesDoctrinaAdmin.length) return;
  const temp = bloquesDoctrinaAdmin[idx];
  bloquesDoctrinaAdmin[idx] = bloquesDoctrinaAdmin[nuevoIdx];
  bloquesDoctrinaAdmin[nuevoIdx] = temp;
  renderizarFormularioDoctrinaAdmin();
}

function agregarBloqueDoctrinaAdmin() {
  bloquesDoctrinaAdmin.push({
    titulo: `${bloquesDoctrinaAdmin.length + 1}. Nuevo Título`,
    subtitulo: "Subtítulo descriptivo",
    texto: "Ingrese aquí el contenido doctrinal correspondiente."
  });
  renderizarFormularioDoctrinaAdmin();
}

function eliminarBloqueDoctrinaAdmin(idx) {
  abrirModalConfirmacion(
    "Eliminar Bloque Doctrinal",
    "¿Está seguro de eliminar este bloque de 'Docencia para Maestros'?",
    () => {
      bloquesDoctrinaAdmin.splice(idx, 1);
      renderizarFormularioDoctrinaAdmin();
    }
  );
}

async function guardarDoctrinaAdmin() {
  const jsonStr = JSON.stringify(bloquesDoctrinaAdmin);
  const { error } = await sbApp
    .from('config_segura')
    .upsert({ clave: 'doctrina_docencia_maestros', valor: jsonStr });

  if (error) {
    alert("Error al guardar doctrina: " + error.message);
  } else {
    alert("Contenidos de 'Docencia para Maestros' guardados exitosamente.");
  }
}

/* ==========================================================================
   MURO GENERAL SUPERADMIN: GESTIÓN CON MODALES EXCLUSIVOS
   ========================================================================== */
async function cargarMuroGeneralAdmin() {
  const contenedor = document.getElementById('contenedorMuroGeneralAdmin');
  contenedor.innerHTML = "<p class='td-loading'>Consultando todas las reflexiones...</p>";

  const d = new Date();
  document.getElementById('muroAdminFechaEmision').innerText = `EMISIÓN: ${d.toLocaleDateString('es-CL')} ${d.toLocaleTimeString('es-CL')}`;

  const { data: aportes, error } = await sbApp
    .from('progreso_maestro')
    .select('id, reflexion, completado_en, modulo_id, usuarios(nombre), modulos(numero_orden, titulo)')
    .eq('completado', true)
    .not('reflexion', 'is', null)
    .order('completado_en', { ascending: false });

  contenedor.innerHTML = "";

  if (error || !aportes || aportes.length === 0) {
    contenedor.innerHTML = "<p style='color: var(--text-muted); font-style: italic;'>No hay reflexiones consagradas en la Cámara.</p>";
    return;
  }

  let comentariosMap = {};
  const { data: comentariosData } = await sbApp
    .from('comentarios_muro')
    .select('id, progreso_id, usuario_id, contenido, contenido_original, editado, creado_en, usuarios(nombre)')
    .eq('activo', true)
    .order('creado_en', { ascending: true });

  if (comentariosData) {
    const idsProcesados = new Set();
    comentariosData.forEach(c => {
      if (idsProcesados.has(c.id)) return;
      idsProcesados.add(c.id);

      if (!comentariosMap[c.progreso_id]) comentariosMap[c.progreso_id] = [];
      comentariosMap[c.progreso_id].push(c);
    });
  }

  const grupos = {};
  aportes.forEach(a => {
    const modKey = `Trabajo ${a.modulos?.numero_orden || '?'}: ${a.modulos?.titulo || 'Sin título'}`;
    if (!grupos[modKey]) grupos[modKey] = [];
    grupos[modKey].push(a);
  });

  for (const [tituloModulo, items] of Object.entries(grupos)) {
    let itemsHtml = items.map(it => {
      const fechaCons = it.completado_en 
        ? new Date(it.completado_en).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : "";
      
      const coms = comentariosMap[it.id] || [];
      let comsAdminHtml = coms.map(c => {
        const cFecha = c.creado_en 
          ? new Date(c.creado_en).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : "";
        return `
          <div class="foro-comentario-item" style="margin-top: 6px;">
            <div class="foro-comentario-header">
              <span class="foro-comentario-autor">Aporte del Q.·.H.·. ${c.usuarios?.nombre || "Hermano"}</span>
              <span class="foro-comentario-fecha">${cFecha}</span>
            </div>
            <div class="foro-comentario-cuerpo">${c.contenido}</div>
            <div class="foro-comentario-acciones">
              <button class="foro-comentario-btn" onclick="abrirAuditoriaComentario('${c.id}', '${encodeURIComponent(c.contenido_original || c.contenido)}', '${(c.usuarios?.nombre || '').replace(/'/g, "\\'")}', '${cFecha}')">🔍 Ver Huella Original</button>
              <button class="foro-comentario-btn" style="color: var(--error);" onclick="eliminarComentarioForo('${c.id}')">🗑️ Eliminar</button>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="reflexion-item" style="margin-bottom: 16px; border-left: 3px solid var(--accent-gold); padding: 14px; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 14px;">
            <div style="flex: 1;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span class="reflexion-autor">${it.usuarios?.nombre || "Hermano"}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted);">${fechaCons}</span>
              </div>
              <div style="font-size: 0.95rem; font-style: italic;">"${it.reflexion}"</div>
            </div>
            <div style="display: flex; gap: 6px;" class="no-print">
              <button class="admin-link-btn" onclick="abrirModalEditarReflexionAdmin('${it.id}', '${encodeURIComponent(it.reflexion)}')">✏️</button>
              <button class="admin-link-btn" style="color: var(--error); border-color: var(--error);" onclick="eliminarReflexionSuperadmin('${it.id}')">🗑️</button>
            </div>
          </div>
          ${coms.length > 0 ? `<div class="foro-comentarios-wrapper" style="margin-top: 10px;">${comsAdminHtml}</div>` : ''}
        </div>
      `;
    }).join('');

    contenedor.innerHTML += `
      <div style="margin-bottom: 24px;">
        <h3 class="muro-trabajo-titulo" style="font-size: 1.15rem; margin-bottom: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">
          ${tituloModulo}
        </h3>
        ${itemsHtml}
      </div>
    `;
  }
}

function abrirModalEditarReflexionAdmin(progresoId, textoCodificado) {
  const textoDecodificado = decodeURIComponent(textoCodificado);
  document.getElementById('editReflexionProgresoId').value = progresoId;
  document.getElementById('textareaEditarReflexionAdmin').value = textoDecodificado;
  document.getElementById('modalEditarReflexionAdmin').classList.remove('hidden');
}

async function guardarEdicionReflexionModalAdmin() {
  const progresoId = document.getElementById('editReflexionProgresoId').value;
  const nuevoTexto = document.getElementById('textareaEditarReflexionAdmin').value.trim();

  if (!nuevoTexto) {
    alert("El texto de la reflexión no puede quedar vacío.");
    return;
  }

  const { error } = await sbApp
    .from('progreso_maestro')
    .update({ reflexion: nuevoTexto })
    .eq('id', progresoId);

  if (error) {
    alert("Error al actualizar reflexión: " + error.message);
  } else {
    cerrarModalUniversalDirecto('modalEditarReflexionAdmin');
    cargarMuroGeneralAdmin();
  }
}

function eliminarReflexionSuperadmin(progresoId) {
  abrirModalConfirmacion(
    "Eliminar Reflexión",
    "¿Está seguro de eliminar esta reflexión? El estado del Hermano cambiará a pendiente para permitirle consagrar un nuevo aporte.",
    async () => {
      const { error } = await sbApp
        .from('progreso_maestro')
        .update({ reflexion: "", completado: false })
        .eq('id', progresoId);

      if (error) alert("Error al eliminar: " + error.message);
      else cargarMuroGeneralAdmin();
    }
  );
}

function imprimirMuroGeneralPDF() {
  const original = document.getElementById('documentoMuroGeneralImprimible');

  const ventanaPrint = window.open('', '_blank', 'width=850,height=1100');
  ventanaPrint.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Recopilacion_Muro_Docencia_OFL146</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        @page { size: letter portrait; margin: 12mm 15mm; }
        body { margin: 0; padding: 0; font-family: 'Inter', system-ui, sans-serif; color: #1A202C; background: #FFFFFF; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .informe-header-box { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .informe-brand p { font-size: 8.5pt; line-height: 1.35; margin: 0; font-weight: 700; color: #152433; }
        .img-emblema-discreto { height: 50px; object-fit: contain; }
        .informe-meta-header { text-align: right; font-size: 8pt; color: #718096; }
        .informe-hr { border: 0; height: 2px; background: #152433; margin: 8px 0 14px 0; }
        .reflexion-item { margin-bottom: 10px; padding: 10px 14px; border-left: 3px solid #997839; background: #F8F9FA; border-radius: 3px; }
        .reflexion-autor { font-weight: 700; font-size: 8.5pt; color: #785C25; }
        .no-print { display: none !important; }
        h3 { font-size: 10.5pt; color: #152433; margin: 14px 0 6px 0; border-bottom: 1px solid #CBD5E0; padding-bottom: 3px; }
      </style>
    </head>
    <body>
      ${original.innerHTML}
      <script>
        window.onload = function() {
          const noprint = document.querySelectorAll('.no-print');
          noprint.forEach(el => el.style.display = 'none');
          window.print();
          setTimeout(() => window.close(), 1000);
        };
      <\/script>
    </body>
    </html>
  `);
  ventanaPrint.document.close();
}

async function exportarRespaldoCompletoJSON() {
  const { data: mods } = await sbApp.from('modulos').select('*');
  const { data: progs } = await sbApp.from('progreso_maestro').select('*');
  const { data: usrs } = await sbApp.from('usuarios').select('id, nombre, email, es_admin');

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

function formatearAutorMasonico(nombreCrudo) {
  if (!nombreCrudo) return 'Cámara de Docencia';
  let nombreLimpio = nombreCrudo.replace(/(Q[\.·\s]*H[\.·\s]*)+/gi, '').trim();
  return `Q.·.H.·. ${nombreLimpio}`;
}

/* ==========================================================================
   INICIALIZACIÓN AL CARGAR EL DOM
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  inicializarLuminosidad();
  recuperarSesionGuardada();
});
