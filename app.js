/* ==========================================================================
   CONFIGURACIÓN Y VARIABLES GLOBALES
   ========================================================================== */
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
}

const SUPABASE_URL = "https://pwnnpjygnviyzyyvfxnq.supabase.co";
const SUPABASE_KEY = "sb_publishable_NExezuss4il3RPgO8Vifxw_pspbe5wF"; 
const GEMINI_API_KEY = "AQ.Ab8RN6KkSJ4RhmWB_KIloRGdf33nk4gdN_onygONXcjPP1rOTQ";    

const sbApp = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let usuarioActual = null;
let listaModulos = [];
let moduloActual = null;
let misProgresos = {};
let tamanoBase = 19;
let respuestasMarcadas = {};
let pdfBase64Cargado = null;

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
   AUTENTICACIÓN Y SEGREGACIÓN DE ROLES
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
  document.getElementById('seccionLogin').classList.add('hidden');
  document.getElementById('btnSalir').classList.remove('hidden');

  // Segregación: Superadmin exclusivo para administración técnica y pedagógica
  if (usuarioActual.es_admin) {
    document.getElementById('seccionAdmin').classList.remove('hidden');
    document.getElementById('seccionDocencia').classList.add('hidden');
    cargarDatosAdmin();
  } else {
    document.getElementById('modalSigilo').classList.remove('hidden');
  }
}

function aceptarSigilo() {
  document.getElementById('modalSigilo').classList.add('hidden');
  cargarTodosLosModulos();
}

function cerrarSesion() {
  usuarioActual = null;
  moduloActual = null;
  misProgresos = {};
  respuestasMarcadas = {};
  document.getElementById('seccionDocencia').classList.add('hidden');
  document.getElementById('seccionAdmin').classList.add('hidden');
  document.getElementById('modalSigilo').classList.add('hidden');
  document.getElementById('btnSalir').classList.add('hidden');
  document.getElementById('seccionLogin').classList.remove('hidden');
  document.getElementById('inputEmail').value = '';
  document.getElementById('inputClave').value = '';
}

/* ==========================================================================
   NAVEGACIÓN SUPERADMIN
   ========================================================================== */
function cambiarSubseccionAdmin(seccion) {
  const tabCarga = document.getElementById('tabNavCargar');
  const tabMetricas = document.getElementById('tabNavMetricas');
  const secCarga = document.getElementById('adminSeccionCarga');
  const secMetricas = document.getElementById('adminSeccionMetricas');

  if (seccion === 'cargar') {
    tabCarga.classList.add('active');
    tabMetricas.classList.remove('active');
    secCarga.classList.remove('hidden');
    secMetricas.classList.add('hidden');
  } else {
    tabMetricas.classList.add('active');
    tabCarga.classList.remove('active');
    secMetricas.classList.remove('hidden');
    secCarga.classList.add('hidden');
    if (listaModulos.length > 0) {
      const select = document.getElementById('selectMetricasModulo');
      cargarMetricasAvance(select.value || listaModulos[0].id);
    }
  }
}

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
    selectMetricas.innerHTML += `<option value="${m.id}">Módulo ${m.numero_orden}: ${m.titulo}</option>`;
  });

  const inputOrden = document.getElementById('adminOrden');
  if (inputOrden) {
    inputOrden.value = listaModulos.length + 1;
  }

  cambiarSubseccionAdmin('cargar');
}

/* ==========================================================================
   ENTORNO DOCENTE PARA HERMANOS
   ========================================================================== */
async function cargarTodosLosModulos() {
  document.getElementById('seccionDocencia').classList.remove('hidden');

  const { data: dataModulos, error } = await sbApp
    .from('modulos')
    .select('*')
    .eq('activo', true)
    .order('numero_orden', { ascending: true });

  if (error || !dataModulos || dataModulos.length === 0) {
    document.getElementById('temaTitulo').innerText = "No hay planchas consagradas actualmente.";
    return;
  }

  listaModulos = dataModulos;
  document.getElementById('contadorModulos').innerText = `${listaModulos.length} temas`;

  await refrescarProgresosUsuario();
  renderizarSidebar();
  seleccionarModulo(listaModulos[0].id);
}

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
    const estaCompletado = misProgresos[m.id] && misProgresos[m.id].completado;
    const badgeHtml = estaCompletado
      ? `<span class="badge-estado badge-ok">✓ Completado</span>`
      : `<span class="badge-estado badge-pen">Pendiente</span>`;

    contenedor.innerHTML += `
      <div class="modulo-nav-item" id="nav_mod_${m.id}" onclick="seleccionarModulo('${m.id}')">
        <div class="nav-item-header">
          <span class="nav-item-num">Módulo ${m.numero_orden}</span>
          ${badgeHtml}
        </div>
        <div class="nav-item-title">${m.titulo}</div>
      </div>
    `;
  });
}

async function seleccionarModulo(idModulo) {
  moduloActual = listaModulos.find(m => m.id === idModulo);
  if (!moduloActual) return;

  document.querySelectorAll('.modulo-nav-item').forEach(el => el.classList.remove('active'));
  const activeNav = document.getElementById(`nav_mod_${idModulo}`);
  if (activeNav) activeNav.classList.add('active');

  respuestasMarcadas = {};
  document.getElementById('textoReflexion').value = "";
  document.getElementById('contenedorMuro').innerHTML = "";

  document.getElementById('temaNumero').innerText = "Módulo " + moduloActual.numero_orden;
  document.getElementById('temaTitulo').innerText = moduloActual.titulo;
  document.getElementById('temaAutor').innerText = moduloActual.autor ? "Autor: " + formatearAutorMasonico(moduloActual.autor) : "";
  document.getElementById('vistaTexto').innerText = moduloActual.contenido_trazado;

  await registrarLecturaSilenciosa(moduloActual.id);

  const tabPdf = document.getElementById('tabPdf');
  const framePdf = document.getElementById('framePdf');
  const btnDescargar = document.getElementById('btnDescargarTrazado');

  if (moduloActual.archivo_pdf_base64) {
    tabPdf.classList.remove('hidden');
    framePdf.src = moduloActual.archivo_pdf_base64;
    btnDescargar.href = moduloActual.archivo_pdf_base64;
    btnDescargar.download = `${moduloActual.titulo}.pdf`;
    btnDescargar.classList.remove('hidden');
  } else {
    tabPdf.classList.add('hidden');
    btnDescargar.classList.add('hidden');
    cambiarVistaDocencia('texto');
  }

  renderizarPreguntasInteractivas(moduloActual.preguntas_json.preguntas || []);
  await verificarProgresoExistente();
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

/* ==========================================================================
   PERSISTENCIA RESILIENTE (SIN UPSERT ON_CONFLICT -> CERO ERROR 400)
   ========================================================================== */
async function registrarLecturaSilenciosa(moduloId) {
  if (!usuarioActual) return;
  try {
    const { data: existente } = await sbApp
      .from('progreso_maestro')
      .select('id')
      .eq('usuario_id', usuarioActual.id)
      .eq('modulo_id', moduloId)
      .maybeSingle();

    if (existente) {
      await sbApp
        .from('progreso_maestro')
        .update({ leido: true })
        .eq('id', existente.id);
    } else {
      await sbApp
        .from('progreso_maestro')
        .insert({
          usuario_id: usuarioActual.id,
          modulo_id: moduloId,
          leido: true
        });
    }
  } catch (e) {
    console.warn("Métrica lectura:", e);
  }
}

function renderizarPreguntasInteractivas(preguntas) {
  const cont = document.getElementById('contenedorPreguntas');
  cont.innerHTML = "";

  if (!preguntas || preguntas.length === 0) {
    cont.innerHTML = "<p style='color: var(--text-muted); font-style: italic;'>No hay interrogantes registradas para esta plancha.</p>";
    return;
  }

  preguntas.forEach((p, idx) => {
    let opcionesHtml = p.opciones.map(op => `
      <label class="opcion-label" id="label_${idx}_${op.letra}" onclick="evaluarRespuestaInmediata(${idx}, '${op.letra}', '${p.respuesta_correcta}')">
        <input type="radio" name="preg_${idx}" value="${op.letra}">
        <span><strong>${op.letra})</strong> ${op.texto}</span>
      </label>
    `).join('');

    cont.innerHTML += `
      <div class="pregunta-card" id="card_preg_${idx}">
        <p style="font-weight: 600; margin-bottom: 14px;">${idx + 1}. ${p.enunciado}</p>
        ${opcionesHtml}
        <div class="feedback-box" id="feedback_${idx}">
          <div style="font-weight: 700; margin-bottom: 6px;" id="feedback_titulo_${idx}"></div>
          <div id="feedback_texto_${idx}">${p.retroalimentacion}</div>
        </div>
      </div>
    `;
  });
}

async function evaluarRespuestaInmediata(idxPregunta, letraSeleccionada, letraCorrecta) {
  if (respuestasMarcadas[idxPregunta]) return;

  respuestasMarcadas[idxPregunta] = letraSeleccionada;

  const radios = document.querySelectorAll(`input[name="preg_${idxPregunta}"]`);
  radios.forEach(r => r.disabled = true);

  const labelSeleccionado = document.getElementById(`label_${idxPregunta}_${letraSeleccionada}`);
  const labelCorrecto = document.getElementById(`label_${idxPregunta}_${letraCorrecta}`);
  const feedbackBox = document.getElementById(`feedback_${idxPregunta}`);
  const feedbackTitulo = document.getElementById(`feedback_titulo_${idxPregunta}`);

  if (letraSeleccionada === letraCorrecta) {
    labelSeleccionado.classList.add('opcion-correcta');
    feedbackTitulo.innerHTML = `<span style="color: var(--success);">✓ Respuesta Correcta</span>`;
  } else {
    labelSeleccionado.classList.add('opcion-erronea');
    labelCorrecto.classList.add('opcion-correcta');
    feedbackTitulo.innerHTML = `<span style="color: var(--error);">✗ Seleccionada: ${letraSeleccionada}</span> | Respuesta Correcta: <strong>${letraCorrecta}</strong>`;
  }

  feedbackBox.style.display = "block";

  try {
    const { data: existente } = await sbApp
      .from('progreso_maestro')
      .select('id')
      .eq('usuario_id', usuarioActual.id)
      .eq('modulo_id', moduloActual.id)
      .maybeSingle();

    const payload = {
      respuestas_evaluacion: respuestasMarcadas,
      intentos_preguntas: Object.keys(respuestasMarcadas).length
    };

    if (existente) {
      await sbApp.from('progreso_maestro').update(payload).eq('id', existente.id);
    } else {
      await sbApp.from('progreso_maestro').insert({
        usuario_id: usuarioActual.id,
        modulo_id: moduloActual.id,
        ...payload
      });
    }
  } catch (e) {
    console.warn("Intento examen:", e);
  }

  const totalPreguntas = moduloActual.preguntas_json.preguntas ? moduloActual.preguntas_json.preguntas.length : 6;
  if (Object.keys(respuestasMarcadas).length === totalPreguntas) {
    const faseTres = document.getElementById('bloqueFaseTres');
    faseTres.classList.remove('hidden');
    faseTres.scrollIntoView({ behavior: 'smooth' });
  }
}

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

  if (cant === 0) {
    alert("Por favor ingrese su reflexión antes de continuar.");
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
    alert("Error al consagrar su reflexión: " + error.message);
    return;
  }

  alert("Módulo completado con éxito. Se ha desbloqueado el Muro Fraterno y su Certificado.");
  await refrescarProgresosUsuario();
  renderizarSidebar();
  await verificarProgresoExistente();
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

async function verificarProgresoExistente() {
  const { data } = await sbApp
    .from('progreso_maestro')
    .select('*')
    .eq('usuario_id', usuarioActual.id)
    .eq('modulo_id', moduloActual.id)
    .limit(1);

  const bloqueFaseDos = document.getElementById('bloqueFaseDos');
  const faseTres = document.getElementById('bloqueFaseTres');
  const txtRef = document.getElementById('textoReflexion');
  const btnConsagrar = document.getElementById('btnConsagrarReflexion');
  const btnEditar = document.getElementById('btnEditarReflexion');
  const btnCert = document.getElementById('btnVerCertificado');

  if (data && data.length > 0 && data[0].completado && data[0].modulo_id === moduloActual.id) {
    bloqueFaseDos.classList.add('hidden');
    faseTres.classList.remove('hidden');
    btnCert.classList.remove('hidden');

    txtRef.value = data[0].reflexion || "";
    txtRef.disabled = true;
    btnConsagrar.classList.add('hidden');
    btnEditar.classList.remove('hidden');

    document.getElementById('tituloFaseTres').innerText = "Mi Reflexión Consagrada";
    document.getElementById('descFaseTres').innerText = "Usted ya consagró su aporte docente en este trazado:";

    await cargarMuroReflexiones();
  } else {
    bloqueFaseDos.classList.remove('hidden');
    faseTres.classList.add('hidden');
    btnCert.classList.add('hidden');
    txtRef.value = "";
    txtRef.disabled = false;
    btnConsagrar.classList.remove('hidden');
    btnConsagrar.innerText = "Consagrar Reflexión y Desbloquear Muro";
    btnEditar.classList.add('hidden');
    document.getElementById('tituloFaseTres').innerText = "Aporte Personal a la Cámara";
  }
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
          <div class="reflexion-item">
            <div class="reflexion-autor">${item.usuarios?.nombre || "Hermano Maestro"}</div>
            <div>"${item.reflexion}"</div>
          </div>
        `;
      }
    });
  } else {
    contenedor.innerHTML = "<p style='color: var(--text-muted); font-style: italic;'>Aún no hay reflexiones consagradas en esta plancha.</p>";
  }
}

/* ==========================================================================
   CERTIFICADO OFICIAL: TRATAMIENTO SOLEMNE Y TIMBRE SVG
   ========================================================================== */
function abrirModalCertificado() {
  const modal = document.getElementById('modalCertificado');
  
  // Garantizar asignación de logo.svg relativo al mismo host
  const imgTimbre = document.querySelector('.timbre-estampa');
  if (imgTimbre && (!imgTimbre.getAttribute('src') || imgTimbre.getAttribute('src').includes('timbre.png'))) {
    imgTimbre.src = "logo.svg";
  }

  const progActual = misProgresos[moduloActual.id];
  const reflexionExacta = (progActual && progActual.reflexion) ? progActual.reflexion : "";

  // Venerable Maestro con nombre limpio sin duplicar tratamientos
  const nombreLimpio = (usuarioActual.nombre || "Maestro Masón").replace(/(Q[\.·\s]*H[\.·\s]*)+/gi, '').trim();
  document.getElementById('certNombreHermano').innerText = nombreLimpio;
  
  document.getElementById('certTituloPlancha').innerText = `"${moduloActual.titulo}"`;
  document.getElementById('certAutorPlancha').innerText = moduloActual.autor ? "Autor: " + formatearAutorMasonico(moduloActual.autor) : "";
  document.getElementById('certTextoReflexion').innerText = `"${reflexionExacta}"`;

  const d = new Date();
  document.getElementById('certFechaEmision').innerText = `Talagante, ${d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}`;

  modal.classList.remove('hidden');
}

function cerrarModalCertificado() {
  document.getElementById('modalCertificado').classList.add('hidden');
}

function descargarCertificadoPDF() {
  const elemento = document.getElementById('documentoCertificado');
  const opciones = {
    margin: 0,
    filename: `Certificado_${moduloActual.titulo.replace(/\s+/g, '_')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  html2pdf().set(opciones).from(elemento).save();
}

/* ==========================================================================
   MÉTRICAS DEL SUPERADMIN
   ========================================================================== */
async function cargarMetricasAvance(moduloId) {
  const tbody = document.getElementById('tablaMetricasBody');
  tbody.innerHTML = `<tr><td colspan="7" class="td-loading">Consultando registros...</td></tr>`;

  const { data: usuarios } = await sbApp
    .from('usuarios')
    .select('id, nombre, email, es_admin')
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
      if (resp >= 6) evalHtml = `<span style="color: var(--success); font-weight: 600;">✓ 6/6 Respondidas</span>`;
      else if (resp > 0) evalHtml = `<span style="color: #B27B10; font-weight: 600;">En curso (${resp}/6)</span>`;
    }

    let consagradoHtml = `<span style="color: var(--text-muted);">Pendiente</span>`;
    let fechaHtml = `<span style="color: var(--text-muted);">—</span>`;

    if (prog && prog.completado) {
      consagradoHtml = `<span style="color: var(--success); font-weight: 700;">✓ Consagrado</span>`;
      if (prog.completado_en) {
        const d = new Date(prog.completado_en);
        fechaHtml = d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      }
    }

    const accionVer = prog && prog.reflexion
      ? `<button class="admin-link-btn" onclick="alert('Reflexión de ${u.nombre}:\\n\\n${prog.reflexion.replace(/'/g, "\\'")}')">Ver Aporte</button>`
      : `<span style="color: var(--text-muted);">—</span>`;

    tbody.innerHTML += `
      <tr>
        <td><strong>${u.nombre || "Hermano"}</strong></td>
        <td style="font-family: monospace; font-size: 0.85rem;">${u.email}</td>
        <td>${leidoHtml}</td>
        <td>${evalHtml}</td>
        <td>${consagradoHtml}</td>
        <td>${fechaHtml}</td>
        <td>${accionVer}</td>
      </tr>
    `;
  });
}

function recargarMetricasActuales() {
  const select = document.getElementById('selectMetricasModulo');
  if (select && select.value) cargarMetricasAvance(select.value);
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
   CARGA PURA Y GENERADOR CON FALLBACK SQL INTELIGENTE
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

function generarSQLContingencia(orden, titulo, autor, texto) {
  const textoEscapado = texto.replace(/'/g, "''");
  const tituloEscapado = titulo.replace(/'/g, "''");
  const autorEscapado = autor.replace(/'/g, "''");

  return `-- CONSULTA SQL GENERADA AUTOMÁTICAMENTE ANTE SATURACIÓN DE GEMINI API
INSERT INTO modulos (
  numero_orden,
  titulo,
  autor,
  contenido_trazado,
  resumen_formativo,
  conclusion_enlace,
  preguntas_json,
  activo
) VALUES (
  ${orden},
  '${tituloEscapado}',
  '${autorEscapado}',
  '${textoEscapado}',
  'Resumen formativo pendiente de revisión doctrinal.',
  'Reflexión sobre las virtudes del Tercer Grado correspondiente a esta plancha.',
  '{"preguntas": [
    {
      "numero": 1,
      "enunciado": "¿Cuál es la enseñanza central transmitida en esta plancha de instrucción?",
      "opciones": [
        {"letra": "A", "texto": "La observancia rigurosa de los deberes y virtudes del Tercer Grado."},
        {"letra": "B", "texto": "La asimilación meramente formal del ritual sin compromiso moral."},
        {"letra": "C", "texto": "La subordinación jerárquica sin juicio reflexivo."},
        {"letra": "D", "texto": "La divulgación externa de los secretos de la Orden."}
      ],
      "respuesta_correcta": "A",
      "retroalimentacion": "La docencia de la Cámara exige encarnar conscientemente los deberes éticos asumidos sobre el Ara."
    },
    {
      "numero": 2,
      "enunciado": "¿Qué actitud debe guardar el Maestro frente a los compromisos de honor?",
      "opciones": [
        {"letra": "A", "texto": "Mantener fidelidad inquebrantable a la palabra empeñada."},
        {"letra": "B", "texto": "Relativizarlos según la conveniencia de las circunstancias."},
        {"letra": "C", "texto": "Supeditar su honor al escrutinio del mundo profano."},
        {"letra": "D", "texto": "Delegar su cumplimiento en los demás Hermanos."}
      ],
      "respuesta_correcta": "A",
      "retroalimentacion": "El honor personal es el bien inmutable que sustenta el juramento masónico."
    },
    {
      "numero": 3,
      "enunciado": "¿Cómo se manifiesta la rectitud masónica en los momentos de soledad?",
      "opciones": [
        {"letra": "A", "texto": "En obrar con probidad cuando nadie nos vigila y sólo la conciencia testigua."},
        {"letra": "B", "texto": "En esperar reconocimiento público para actuar con justicia."},
        {"letra": "C", "texto": "En evitar involucrarse ante injusticias evidentes."},
        {"letra": "D", "texto": "En buscar la aprobación de la mayoría."}
      ],
      "respuesta_correcta": "A",
      "retroalimentacion": "La verdadera maestría se prueba en la rectitud espontánea gobernada por la propia conciencia."
    },
    {
      "numero": 4,
      "enunciado": "¿Qué deber impone el Tercer Grado respecto al Hermano que se encuentra ausente?",
      "opciones": [
        {"letra": "A", "texto": "Amparar su buen nombre y no tolerar difamaciones ni juicios sumarios."},
        {"letra": "B", "texto": "Asumir que su silencio equivale a desinterés en el Taller."},
        {"letra": "C", "texto": "Comentar libremente sus dificultades con terceros."},
        {"letra": "D", "texto": "Imponerle sanciones inmediatas."}
      ],
      "respuesta_correcta": "A",
      "retroalimentacion": "El amparo al ausente es una de las cláusulas más solemnes y protectoras de la fraternidad."
    },
    {
      "numero": 5,
      "enunciado": "¿Cuál es el propósito del examen de las herramientas y símbolos en la maestría?",
      "opciones": [
        {"letra": "A", "texto": "Transformar la especulación intelectual en conducta viva y coherencia moral."},
        {"letra": "B", "texto": "Aprender de memoria fórmulas sin aplicación cotidiana."},
        {"letra": "C", "texto": "Establecer privilegios sobre los grados precedentes."},
        {"letra": "D", "texto": "Obtener jerarquía administrativa."}
      ],
      "respuesta_correcta": "A",
      "retroalimentacion": "Las herramientas del arte son guías de rectitud práctica para la vida profana y logial."
    },
    {
      "numero": 6,
      "enunciado": "¿Qué virtud permite transformar el celo y el fervor en una obra perdurable?",
      "opciones": [
        {"letra": "A", "texto": "La constancia perseverante a lo largo del tiempo."},
        {"letra": "B", "texto": "El entusiasmo efímero durante las ceremonias."},
        {"letra": "C", "texto": "La elocuencia discursiva entre columnas."},
        {"letra": "D", "texto": "La ambición de cargos en el Cuadro Lógico."}
      ],
      "respuesta_correcta": "A",
      "retroalimentacion": "Como la gota constante que labra la roca, la constancia consolida el perfeccionamiento moral."
    }
  ]}',
  true
);`;
}

function copiarSQLFallback() {
  const area = document.getElementById('sqlFallbackArea');
  area.select();
  navigator.clipboard.writeText(area.value).then(() => {
    alert("Consulta SQL copiada al portapapeles. Péguela en el SQL Editor de Supabase.");
  });
}

async function generarModuloConIA() {
  const titulo = document.getElementById('adminTitulo').value.trim();
  const autorInput = document.getElementById('adminAutor').value.trim();
  const autorFinal = formatearAutorMasonico(autorInput);
  const orden = parseInt(document.getElementById('adminOrden').value);
  const texto = document.getElementById('adminTexto').value.trim();
  const status = document.getElementById('adminStatus');
  const fallbackBox = document.getElementById('contenedorFallbackSQL');
  const fallbackArea = document.getElementById('sqlFallbackArea');

  if (!titulo || !texto) {
    alert("Complete el título y el texto depurado.");
    return;
  }

  fallbackBox.classList.add('hidden');
  status.innerHTML = "<em>Procesando trazado con Gemini (analizando simbolismo y formulando 6 interrogantes)...</em>";

  const promptSistema = `
Eres un pedagogo e instructor especializado en la Cámara del Medio (Tercer Grado de la Masonería).
Analiza el siguiente trazado masónico depurado. Enfócate en el contenido ético, deberes, símbolos y virtudes del Tercer Grado.

Genera exactamente:
1. "resumen_formativo": Síntesis sobria de las ideas doctrinales centrales (máximo 150 palabras).
2. "conclusion_enlace": Una reflexión armónica que enlace los deberes y virtudes expuestas (120-180 palabras).
3. "preguntas": Arreglo de exactamente 6 preguntas pedagógicas de selección múltiple sobre los conceptos del trazado. Cada pregunta debe contener:
   - "numero": (1 a 6)
   - "enunciado": Texto claro y reflexivo.
   - "opciones": 4 opciones con campos "letra" (A, B, C, D) y "texto".
   - "respuesta_correcta": Letra de la opción verdadera.
   - "retroalimentacion": Breve explicación fraterna y docente de por qué esa es la respuesta.

REGLA ESTRICTA: Tu respuesta debe ser exclusivamente un JSON válido sin texto previo ni posterior, cumpliendo esta estructura:
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
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: promptSistema + "\n\n--- TEXTO DE LA PLANCHA ---\n" + texto }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
      })
    });

    const data = await respuesta.json();

    if (data.error) {
      status.innerHTML = `<span style="color: var(--error);">Servidores de Google saturados (${data.error.message}). Se ha generado la consulta SQL de contingencia directa.</span>`;
      fallbackArea.value = generarSQLContingencia(orden, titulo, autorFinal, texto);
      fallbackBox.classList.remove('hidden');
      fallbackBox.scrollIntoView({ behavior: 'smooth' });
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
      status.innerHTML = `<span style="color: var(--success);">¡Plancha procesada y consagrada con éxito!</span>`;
      cargarDatosAdmin();
    }
  } catch (err) {
    status.innerHTML = `<span style="color: var(--error);">Error en el canal de IA: ${err.message}. Se activó la contingencia SQL.</span>`;
    fallbackArea.value = generarSQLContingencia(orden, titulo, autorFinal, texto);
    fallbackBox.classList.remove('hidden');
    fallbackBox.scrollIntoView({ behavior: 'smooth' });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  inicializarLuminosidad();
});
