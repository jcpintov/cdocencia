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

  // Registrar auditoría de acceso e IP
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
    texto: "Fomentar el estudio riguroso de la docencia del Tercer Grado, verificar la asimilación conceptual de los símbolos y deberes éticos, y consolidar un repositorio de reflexiones fraternas que fortalezca la vida interior del taller."
  },
  {
    titulo: "3. Metodología Docente en Tres Fases",
    subtitulo: "Lectura, Diagnóstico Simbólico y Consagración",
    texto: "Fase I: Lectura atenta con tiempo mínimo de análisis reflexivo.\nFase II: Examen formativo de 8 preguntas que culmina en un dilema ético profundo.\nFase III: Consagración de la reflexión personal y acceso al Muro fraterno."
  },
  {
    titulo: "4. La Trascendencia de la Maestría",
    subtitulo: "Deber, Coherencia y Rectitud en el Mundo y en el Taller",
    texto: "La Maestría no constituye una investidura de privilegio ni un reposo en la senda, sino la asunción consciente de una responsabilidad inextinguible. Ser Maestro es erigirse en centro de unión y modelo de templanza; es juzgarse con rigor antes de corregir al semejante, amparar con lealtad el honor del hermano ausente y custodiar en la intimidad de la conciencia el juramento consagrado sobre el Ara. La plenitud del grado se valida únicamente cuando la luz adquirida en la Cámara se transforma en rectitud insobornable frente a las vicisitudes de la vida profana."
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
   MURO Y FORO DE REFLEXIONES (CON COMENTARIOS ANIDADOS)
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

  // Traer comentarios existentes de public.comentarios_muro
  let comentariosMap = {};
  const { data: comentariosData } = await sbApp
    .from('comentarios_muro')
    .select('id, progreso_id, usuario_id, contenido, contenido_original, editado, editado_en, creado_en, usuarios(nombre)')
    .eq('activo', true)
    .order('creado_en', { ascending: true });

  if (comentariosData) {
    comentariosData.forEach(c => {
      if (!comentariosMap[c.progreso_id]) comentariosMap[c.progreso_id] = [];
      comentariosMap[c.progreso_id].push(c);
    });
  }

  const reflexionesPorModulo = {};
  aportes.forEach(a => {
    if (!a.modulo_id || !a.reflexion || a.reflexion.trim() === "") return;
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
          Q.·.H.·., para acceder a las reflexiones y debates vertidos por los Hermanos de la Cámara, debe completar el estudio de los temas correspondientes y consagrar su reflexión personal en la Fase III.
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
              💬 Aportar a esta Reflexión (${comentariosDeEstaReflexion.length})
            </button>

            <div id="caja_comentario_${it.id}" class="foro-comentar-caja hidden">
              <textarea id="input_comentario_${it.id}" rows="3" class="foro-comentar-input" placeholder="Escriba su aporte fraternal aquí..."></textarea>
              <div style="display: flex; justify-content: flex-end; gap: 8px;">
                <button class="btn-secondary" style="padding: 6px 12px; font-size: 0.85rem;" onclick="toggleFormularioComentario('${it.id}')">Cancelar</button>
                <button class="btn-primary" style="padding: 6px 14px; font-size: 0.85rem; width: auto;" onclick="enviarComentarioForo('${it.id}', '${m.id}')">Publicar Aporte</button>
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
    alert("Q.·.H.·., favor ingrese un aporte con contenido.");
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
    contenido_original: texto, // Huella inmutable permanente
    ip_origen: ipDetectada,
    activo: true
  });

  if (error) {
    alert("Error al registrar aporte: " + error.message);
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
    alert("Error al editar aporte: " + error.message);
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
    "Eliminar Aporte del Foro",
    "¿Está seguro de eliminar este aporte? Dejará de ser visible para los Hermanos, pero su huella original permanecerá auditada.",
    async () => {
      const { error } = await sbApp.from('comentarios_muro').update({ activo: false }).eq('id', comentarioId);
      if (error) alert("Error al eliminar: " + error.message);
      else await mostrarMuroReflexionesUsuarios();
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
