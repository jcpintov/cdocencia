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

// Control de token activo de recuperación
let tokenRecuperacionActivo = null;

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
   AUXILIARES
   ========================================================================== */
function formatearAutorMasonico(autor) {
  if (!autor) return "Cámara de Docencia";
  if (autor.includes("Q.·.H.·.") || autor.includes("Q.H.")) return autor;
  return `Q.·.H.·. ${autor}`;
}

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
   VALIDACIÓN DE SEGURIDAD Y GENERADOR DE CONTRASEÑA
   ========================================================================== */
function validarSeguridadClave(clave) {
  if (!clave || clave.length < 7) {
    return "La contraseña debe tener al menos 7 caracteres en total.";
  }
  const alfanumericos = (clave.match(/[a-zA-Z0-9]/g) || []).length;
  if (alfanumericos < 6) {
    return "La contraseña debe contener al menos 6 caracteres normales (letras o números).";
  }
  const tieneSimbolo = /[^a-zA-Z0-9]/.test(clave);
  if (!tieneSimbolo) {
    return "La contraseña debe incluir al menos 1 símbolo especial (ej: ! @ # $ % * ?).";
  }
  return null;
}

function generarClaveAleatoriaSegura() {
  // Usar criptografía del navegador; jamás Math.random() para credenciales.
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Se necesita HTTPS y un navegador con generador criptográfico.');
  }
  const letras = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const simbolos = '!@#$%*?';
  const elegir = (longitud) => {
    const numeros = new Uint32Array(1);
    const limite = Math.floor(0x100000000 / longitud) * longitud;
    do { crypto.getRandomValues(numeros); } while (numeros[0] >= limite);
    return numeros[0] % longitud;
  };
  const caracteres = Array.from({ length: 14 }, () => letras[elegir(letras.length)]);
  caracteres.push(simbolos[elegir(simbolos.length)], simbolos[elegir(simbolos.length)]);
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = elegir(i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join('');
}

function alternarVisibilidadClaveLogin() {
  const input = document.getElementById('inputClave');
  const btn = document.getElementById('btnToggleVerClave');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.innerText = '🙈';
    btn.title = 'Ocultar contraseña';
  } else {
    input.type = 'password';
    btn.innerText = '👁️';
    btn.title = 'Mostrar contraseña';
  }
}

/* ==========================================================================
   AUTENTICACIÓN Y ENTORNO
   ========================================================================== */
async function iniciarSesion() {
  const email = document.getElementById('inputEmail').value.trim().toLowerCase();
  const clave = document.getElementById('inputClave').value.trim();
  const err = document.getElementById('errorLogin');

  if (!email || !clave) {
    err.innerText = "Por favor ingrese su correo y contraseña.";
    return;
  }

  err.innerText = "Verificando credenciales...";

  try {
    const { data, error } = await sbApp.rpc('autenticar_usuario', {
      p_email: email,
      p_clave: clave
    });

    if (error || !data || data.length === 0) {
      err.innerText = "Correo o contraseña no válidos.";
      return;
    }

    usuarioActual = data[0];
    sessionStorage.setItem('camara_usuario_sesion', JSON.stringify(usuarioActual));

    err.innerText = "";
    registrarIngresoAuditoria(usuarioActual);
    configurarEntornoUsuario();
  } catch (ex) {
    err.innerText = "Error de conexión: " + ex.message;
  }
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
  document.getElementById('btnCambiarMiClave').classList.remove('hidden');

  if (usuarioActual.es_admin) {
    document.getElementById('seccionAdmin').classList.remove('hidden');
    document.getElementById('seccionDocencia').classList.add('hidden');
    document.getElementById('seccionBienvenida').classList.add('hidden');
    document.getElementById('seccionCatalogoTrabajos').classList.add('hidden');
    document.getElementById('seccionDocenciaInstitucional').classList.add('hidden');
    document.getElementById('seccionMuroUsuarios').classList.add('hidden');
    // La consola administrativa es el único entorno SUPERADMIN.
    // No se exige otro cambio si la contraseña personal ya fue establecida.
    if (usuarioActual.debe_cambiar_clave) {
      document.getElementById('modalCambioClaveObligatorio').classList.remove('hidden');
      return;
    }
    cargarDatosAdmin();
  } else {
    document.getElementById('modalSigilo').classList.remove('hidden');
  }
}

function aceptarSigilo() {
  document.getElementById('modalSigilo').classList.add('hidden');

  if (usuarioActual.debe_cambiar_clave) {
    document.getElementById('modalCambioClaveObligatorio').classList.remove('hidden');
    return;
  }

  const nombreLimpio = usuarioActual.nombre.replace(/(Q[\.·\s]*H[\.·\s]*)+/gi, '').trim();
  document.getElementById('bienvenidaNombreQH').innerText = `Q.·.H.·. ${nombreLimpio}`;
  document.getElementById('seccionBienvenida').classList.remove('hidden');
}

async function guardarNuevaClaveObligatoria() {
  const error = document.getElementById('errorCambioClave');
  const clave = document.getElementById('nuevaClaveInput');
  const repetir = document.getElementById('repetirClaveInput');
  if (clave) clave.value = '';
  if (repetir) repetir.value = '';
  if (error) error.textContent = 'Cambio de contraseña suspendido temporalmente por seguridad. No se permite continuar con una contraseña provisional hasta activar el reemplazo autenticado.';
}

function cerrarSesion() {
  // Limpiar información doctrinal local y cancelar extracciones pendientes antes de ceder la sesión.
  limpiarRecepcionDoctrina(true);
  limpiarConsultaDoctrina();
  if (temporizadorInactividad) clearTimeout(temporizadorInactividad);
  if (temporizadorLecturaId) clearTimeout(temporizadorLecturaId);
  usuarioActual = null;
  moduloActual = null;
  misProgresos = {};
  respuestasMarcadas = {};
  archivoBase64Pendiente = null;
  sessionStorage.removeItem('camara_usuario_sesion');

  document.getElementById('errorLogin').innerText = '';
  document.getElementById('inputEmail').value = '';
  document.getElementById('inputClave').value = '';
  document.getElementById('inputClave').type = 'password';
  const btnEye = document.getElementById('btnToggleVerClave');
  if (btnEye) btnEye.innerText = '👁️';

  document.getElementById('seccionDocencia').classList.add('hidden');
  document.getElementById('seccionBienvenida').classList.add('hidden');
  document.getElementById('seccionCatalogoTrabajos').classList.add('hidden');
  document.getElementById('seccionDocenciaInstitucional').classList.add('hidden');
  document.getElementById('seccionMuroUsuarios').classList.add('hidden');
  document.getElementById('seccionAdmin').classList.add('hidden');
  document.getElementById('modalSigilo').classList.add('hidden');
  document.getElementById('modalCambioClaveObligatorio').classList.add('hidden');
  document.getElementById('modalCambiarMiClave').classList.add('hidden');
  document.getElementById('modalAdminClaveHermano').classList.add('hidden');
  document.getElementById('modalAdminUsuario').classList.add('hidden');
  document.getElementById('modalRecuperarClave').classList.add('hidden');
  document.getElementById('modalResetearConToken').classList.add('hidden');
  document.getElementById('modalMisAvances').classList.add('hidden');
  document.getElementById('modalCertificado').classList.add('hidden');
  document.getElementById('modalAuditoriaModulo').classList.add('hidden');
  document.getElementById('modalParametrosHermano').classList.add('hidden');
  document.getElementById('modalConfirmarAccion').classList.add('hidden');
  document.getElementById('btnSalir').classList.add('hidden');
  document.getElementById('btnCambiarMiClave').classList.add('hidden');
  document.getElementById('seccionLogin').classList.remove('hidden');
}

/* ==========================================================================
   CAMBIO DE CLAVE PROPIA VOLUNTARIO
   ========================================================================== */
function abrirModalCambioClaveUsuario() {
  document.getElementById('inputMiClaveNueva').value = '';
  document.getElementById('errorMiCambioClave').innerText = '';
  document.getElementById('modalCambiarMiClave').classList.remove('hidden');
}

function autogenerarEnInputMiClave() {
  const estado = document.getElementById('errorMiCambioClave');
  if (estado) estado.textContent = 'Generación y cambio de contraseña temporalmente deshabilitados mientras se migra la autenticación.';
}

async function guardarMiNuevaClave() {
  const clave = document.getElementById('inputMiClaveNueva');
  const estado = document.getElementById('errorMiCambioClave');
  if (clave) clave.value = '';
  if (estado) estado.textContent = 'Cambio de contraseña suspendido por seguridad. Esta operación requiere Supabase Auth con identidad verificada.';
}

/* ==========================================================================
   SUPERADMIN: MÓDULO ADMINISTRAR USUARIOS
   ========================================================================== */
let secuenciaCargaPadronAdmin = 0;
async function cargarListadoUsuariosAdmin() {
  // Nunca interpolar datos del padrón en HTML ni en onclick: origen no confiable.
  if (!usuarioActual?.es_admin) return;
  const tbody = document.getElementById('tablaUsuariosAdminBody');
  if (!tbody) return;
  const secuenciaActual = ++secuenciaCargaPadronAdmin;
  const mensaje = (texto) => {
    tbody.replaceChildren();
    const fila = tbody.insertRow();
    const celda = fila.insertCell();
    celda.colSpan = 5;
    celda.className = 'td-loading';
    celda.textContent = texto;
  };
  mensaje('Consultando padrón de usuarios...');
  const { data: usuarios, error } = await sbApp
    .from('usuarios')
    .select('id, nombre, email, es_admin, debe_cambiar_clave')
    .order('nombre', { ascending: true });
  if (secuenciaActual !== secuenciaCargaPadronAdmin || !usuarioActual?.es_admin) return;
  if (error) {
    mensaje('No fue posible consultar el padrón. Verifica la sesión y los permisos.');
    console.error('Error al obtener usuarios:', error);
    return;
  }
  if (!usuarios?.length) {
    mensaje('No se encontraron usuarios registrados.');
    return;
  }
  tbody.replaceChildren();
  usuarios.forEach(u => {
    const fila = tbody.insertRow();
    const nombre = String(u.nombre || 'Hermano');
    const correo = String(u.email || '');
    const nombreCelda = fila.insertCell();
    const fuerte = document.createElement('strong');
    fuerte.textContent = nombre;
    nombreCelda.appendChild(fuerte);

    const emailCelda = fila.insertCell();
    emailCelda.className = 'admin-email-cell';
    emailCelda.textContent = correo;

    const rolCelda = fila.insertCell();
    const rol = document.createElement('span');
    rol.className = u.es_admin ? 'admin-role-superadmin' : 'admin-role-user';
    rol.textContent = u.es_admin ? 'Superadmin' : 'Maestro';
    rolCelda.appendChild(rol);

    const claveCelda = fila.insertCell();
    const clave = document.createElement('span');
    clave.className = u.debe_cambiar_clave ? 'admin-clave-pendiente' : 'admin-clave-ok';
    clave.textContent = u.debe_cambiar_clave ? 'Requiere cambio' : 'Al día';
    claveCelda.appendChild(clave);

    const accionesCelda = fila.insertCell();
    const acciones = document.createElement('div');
    acciones.className = 'admin-acciones-seguras';
    accionesCelda.appendChild(acciones);
    if (u.es_admin || u.id === usuarioActual?.id) {
      const protegido = document.createElement('span');
      protegido.className = 'admin-profile-protected';
      protegido.textContent = 'Perfil protegido';
      acciones.appendChild(protegido);
      return;
    }
    const anadirBoton = (texto, callback, clase) => {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'admin-link-btn' + (clase ? ' ' + clase : '');
      boton.textContent = texto;
      boton.addEventListener('click', callback);
      acciones.appendChild(boton);
    };
    anadirBoton('Editar', () => abrirModalEditarUsuario(u.id, nombre, correo, false));
    anadirBoton('Cambiar clave', () => abrirModalAdminClaveHermano(u.id, nombre));
    anadirBoton('Eliminar', () => confirmarEliminarUsuario(u.id, nombre), 'admin-action-delete');
  });
}

function abrirModalCrearUsuario() {
  document.getElementById('modalAdminUsuarioTitulo').innerText = '👤 Nuevo Hermano en Padrón';
  document.getElementById('adminUsuarioTargetId').value = '';
  document.getElementById('adminUsuarioNombre').value = '';
  document.getElementById('adminUsuarioEmail').value = '';
  document.getElementById('adminUsuarioClave').value = 'OFL.146!';
  document.getElementById('adminUsuarioEsAdmin').checked = false;
  document.getElementById('grupoClaveCreacion').classList.remove('hidden');
  document.getElementById('errorAdminUsuario').innerText = '';
  document.getElementById('modalAdminUsuario').classList.remove('hidden');
}

function autogenerarClaveNuevoUsuario() {
  const p = generarClaveAleatoriaSegura();
  document.getElementById('adminUsuarioClave').value = p;
  navigator.clipboard.writeText(p);
  alert("Contraseña copiada al portapapeles: " + p);
}

function abrirModalEditarUsuario(id, nombre, email, esAdmin) {
  // La edición de Superadmin requiere un flujo propio que no modifique es_admin.
  if (esAdmin === true || esAdmin === 'true' || id === usuarioActual?.id) {
    alert('La cuenta Superadmin no se modifica desde el padrón. Esta medida protege sus permisos.');
    return;
  }
  document.getElementById('modalAdminUsuarioTitulo').innerText = '✏️ Editar Datos de Usuario';
  document.getElementById('adminUsuarioTargetId').value = id;
  document.getElementById('adminUsuarioNombre').value = nombre;
  document.getElementById('adminUsuarioEmail').value = email;
  document.getElementById('adminUsuarioEsAdmin').checked = (esAdmin === true || esAdmin === 'true');
  document.getElementById('grupoClaveCreacion').classList.add('hidden');
  document.getElementById('errorAdminUsuario').innerText = '';
  document.getElementById('modalAdminUsuario').classList.remove('hidden');
}

async function guardarAdminUsuario() {
  const estado = document.getElementById('errorAdminUsuario');
  if (estado) estado.textContent = 'Altas y modificaciones en mantenimiento de seguridad. Los permisos de las funciones antiguas están revocados; no se ha modificado ningún usuario.';
}

function confirmarEliminarUsuario(targetId, nombre) {
  const aviso = 'La eliminación de usuarios está suspendida mientras se completa la migración a Supabase Auth. No se ha eliminado ningún registro.';
  // La ruta legacy carece de autorización verificada; no solicitar confirmación
  // de una operación que el servidor no permitirá ejecutar.
  const estado = document.getElementById('resumenSuperadminEstado');
  if (estado) estado.textContent = aviso;
  alert(aviso);
}

function abrirModalAdminClaveHermano(targetId, nombreHermano) {
  document.getElementById('adminTargetHermanoId').value = targetId;
  document.getElementById('adminHermanoNombreSpan').innerText = nombreHermano;
  document.getElementById('inputAdminClaveHermano').value = '';
  document.getElementById('chkForzarCambioAdmin').checked = true;
  document.getElementById('errorAdminClaveHermano').innerText = '';
  document.getElementById('modalAdminClaveHermano').classList.remove('hidden');
}

async function autogenerarAdminClaveHermano() {
  const input = document.getElementById('inputAdminClaveHermano');
  const estado = document.getElementById('errorAdminClaveHermano');
  if (!usuarioActual?.es_admin || !input) return;
  try {
    const clave = generarClaveAleatoriaSegura();
    input.value = clave;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(clave);
      if (estado) estado.textContent = 'Clave segura generada y copiada. Guárdala por un canal confidencial.';
    } else {
      if (estado) estado.textContent = 'Clave segura generada; cópiala manualmente desde el campo protegido.';
    }
  } catch (error) {
    if (input.value) {
      if (estado) estado.textContent = 'Clave generada, pero el portapapeles no está disponible. Copia la clave manualmente desde el campo protegido.';
    } else if (estado) estado.textContent = 'No fue posible generar una clave criptográficamente segura.';
  }
}

async function guardarAdminClaveHermano() {
  const entrada = document.getElementById('inputAdminClaveHermano');
  const estado = document.getElementById('errorAdminClaveHermano');
  if (entrada) entrada.value = '';
  if (estado) estado.textContent = 'Asignación de contraseñas suspendida. Requiere validación de identidad en Supabase Auth.';
}

/* ==========================================================================
   RECUPERACIÓN Y RESTABLECIMIENTO POR TOKEN
   ========================================================================== */
function abrirModalRecuperarClave() {
  document.getElementById('recuperarEmailInput').value = '';
  document.getElementById('recuperarStatusMsg').innerHTML = '';
  document.getElementById('modalRecuperarClave').classList.remove('hidden');
}

async function enviarSolicitudRecuperacion() {
  const estado = document.getElementById('recuperarStatusMsg');
  const entrada = document.getElementById('recuperarEmailInput');
  if (entrada) entrada.value = '';
  if (estado) estado.textContent = 'La recuperación heredada está deshabilitada por seguridad. No se genera ningún enlace de restablecimiento. La recuperación se reactivará mediante un correo verificado en Supabase Auth.';
}

function verificarTokenUrl() {
  // Los tokens antiguos ya no son válidos. No mostrarlos ni copiarlos al DOM.
  const parametros = new URLSearchParams(window.location.search);
  if (!parametros.has('token')) return;
  tokenRecuperacionActivo = null;
  parametros.delete('token');
  const query = parametros.toString();
  const destino = window.location.pathname + (query ? '?' + query : '') + window.location.hash;
  window.history.replaceState({}, document.title, destino);
  const error = document.getElementById('errorLogin');
  if (error) error.textContent = 'Este enlace de recuperación ya no es válido. El restablecimiento seguro está en mantenimiento.';
}

async function guardarResetConToken() {
  tokenRecuperacionActivo = null;
  const entrada = document.getElementById('tokenNuevaClave');
  const confirmar = document.getElementById('tokenRepetirClave');
  if (entrada) entrada.value = '';
  if (confirmar) confirmar.value = '';
  const error = document.getElementById('errorResetToken');
  if (error) error.textContent = 'Restablecimiento por token antiguo deshabilitado por seguridad.';
}

/* ==========================================================================
   CATÁLOGO DE TRABAJOS Y ENTORNO
   ========================================================================== */
function volverAInicioPortal() {
  ['seccionCatalogoTrabajos','seccionDocencia','seccionDocenciaInstitucional','seccionMuroUsuarios'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.classList.add('hidden');
  });
  const inicio=document.getElementById('seccionBienvenida');
  if(inicio)inicio.classList.remove('hidden');
}

async function irACatalogoDocencia() {
  document.getElementById('seccionBienvenida').classList.add('hidden');
  document.getElementById('seccionDocenciaInstitucional').classList.add('hidden');
  document.getElementById('seccionMuroUsuarios').classList.add('hidden');
  await renderizarCatalogoTrabajos();
}

function obtenerIconoTrabajo(titulo) {
  const t=String(titulo||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const reglas=[
    [/escuadra|compas|geometr|herramientas/, 'escuadra_compas'],
    [/exaltacion|tercer grado|ritual|templo|ceremonia/, 'templo'],
    [/juramento|obligacion|promesa|compromiso|constitucion|reglamento/, 'pergamino'],
    [/columna|jakin|boaz/, 'columnas'],
    [/piedra|cubic|desbast|perfeccionamiento/, 'mallete_piedra'],
    [/acacia|inmortalidad/, 'acacia'],
    [/plomada|rectitud|vertical/, 'plomada'],
    [/nivel|igualdad|fraternidad|hermandad/, 'saludo_fraterno'],
    [/pavimento|mosaico|dualidad/, 'pavimento_mosaico'],
    [/luz|sol|iluminacion/, 'sol'],
    [/luna|noche|estrella/, 'luna_estrellas'],
    [/plancha|trazado|arquitectura|plano/, 'planos_compas'],
    [/libro|lectura|conocimiento|sabiduria|verdad|estudio|docencia/, 'libro_abierto'],
    [/moral|etica|virtud|servicio|tolerancia/, 'rama_olivo'],
    [/trabajo|labor|voluntad|esfuerzo/, 'mallete'],
    [/construccion|argamasa|union/, 'paleta']
  ];
  for(const [re,icono] of reglas)if(re.test(t))return icono;
  return 'libro_abierto';
}

async function renderizarCatalogoTrabajos() {
  const { data: dataModulos, error } = await sbApp
    .from('modulos')
    .select('*')
    .eq('activo', true)
    .order('numero_orden', { ascending: false });

  if (error || !dataModulos) return;

  await refrescarProgresosUsuario();

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
          <div class="grid-card-cuerpo">
            <img class="grid-card-icono" src="imgs/iconos/${obtenerIconoTrabajo(m.titulo)}.webp" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'">
            <div class="grid-card-textos">
              <h4 class="grid-card-titulo">${m.titulo}</h4>
              <p class="grid-card-autor">${m.autor ? formatearAutorMasonico(m.autor) : "Cámara de Docencia"}</p>
            </div>
          </div>
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
   MURO Y FORO DE REFLEXIONES
   ========================================================================== */
async function mostrarMuroReflexionesUsuarios() {
  const usuarioId = usuarioActual?.id;
  if (!usuarioId) return;
  document.getElementById('seccionDocencia')?.classList.add('hidden');
  document.getElementById('seccionCatalogoTrabajos')?.classList.add('hidden');
  document.getElementById('seccionDocenciaInstitucional')?.classList.add('hidden');
  const cont = document.getElementById('contenedorMuroUsuariosDirecto');
  if (!cont) return;
  const crear = (padre, tag, clase, contenido) => {
    const nodo = document.createElement(tag);
    if (clase) nodo.className = clase;
    if (contenido !== undefined) nodo.textContent = String(contenido ?? '');
    if (padre) padre.appendChild(nodo);
    return nodo;
  };
  const boton = (padre, texto, clase, ejecutar) => {
    const b = crear(padre, 'button', clase, texto);
    b.type = 'button';
    b.addEventListener('click', ejecutar);
    return b;
  };
  cont.replaceChildren();
  crear(cont, 'p', 'td-loading', 'Recuperando aportes de la Cámara...');
  document.getElementById('seccionMuroUsuarios')?.classList.remove('hidden');

  await refrescarProgresosUsuario();
  if (usuarioActual?.id !== usuarioId) return;
  const { data: aportes, error } = await sbApp
    .from('progreso_maestro')
    .select('id, reflexion, completado_en, modulo_id, usuario_id, usuarios(nombre), modulos(numero_orden, titulo)')
    .eq('completado', true)
    .not('reflexion', 'is', null)
    .order('completado_en', { ascending: false });
  if (usuarioActual?.id !== usuarioId) return;
  if (error || !aportes) {
    cont.replaceChildren();
    crear(cont, 'p', 'text-instruccion', 'Error al cargar las reflexiones de la Cámara.');
    return;
  }
  const { data: comentariosData, error: errorComentarios } = await sbApp
    .from('comentarios_muro')
    .select('id, progreso_id, usuario_id, contenido, contenido_original, editado, editado_en, creado_en, usuarios(nombre)')
    .eq('activo', true)
    .order('creado_en', { ascending: true });
  if (usuarioActual?.id !== usuarioId) return;
  if (errorComentarios) {
    cont.replaceChildren();
    crear(cont, 'p', 'text-instruccion', 'No fue posible consultar los comentarios.');
    return;
  }
  const comentariosMap = new Map();
  const idsComentario = new Set();
  (comentariosData || []).forEach(c => {
    if (idsComentario.has(c.id)) return;
    idsComentario.add(c.id);
    if (!comentariosMap.has(c.progreso_id)) comentariosMap.set(c.progreso_id, []);
    comentariosMap.get(c.progreso_id).push(c);
  });
  const reflexionesPorModulo = new Map();
  const clavesVistas = new Set();
  aportes.forEach(aporte => {
    if (!aporte.modulo_id || !aporte.reflexion?.trim()) return;
    const clave = String(aporte.usuario_id) + '/' + String(aporte.modulo_id);
    if (clavesVistas.has(clave)) return;
    clavesVistas.add(clave);
    if (!reflexionesPorModulo.has(aporte.modulo_id)) reflexionesPorModulo.set(aporte.modulo_id, []);
    reflexionesPorModulo.get(aporte.modulo_id).push(aporte);
  });
  const completados = [], pendientes = [];
  listaModulos.forEach(m => {
    const progreso = misProgresos[m.id];
    if (progreso?.completado) completados.push({
      ...m, fechaCompletado: progreso.completado_en ? new Date(progreso.completado_en).getTime() : 0
    });
    else pendientes.push(m);
  });
  completados.sort((x,y) => y.fechaCompletado - x.fechaCompletado);
  cont.replaceChildren();
  if (!completados.length) {
    const aviso = crear(cont, 'div', 'muro-reserva-docente');
    crear(aviso,'h3','', 'Aportes bajo Reserva Docente');
    crear(aviso,'p','',
      'Para acceder a las reflexiones de la Cámara, complete los trabajos correspondientes y consagre su reflexión en la Fase III.');
    return;
  }
  completados.forEach(m => {
    const grupo = crear(cont, 'section', 'muro-modulo-grupo');
    const cabecera = crear(grupo, 'header', 'muro-modulo-cabecera');
    const datos = crear(cabecera, 'div', '');
    crear(datos,'span','muro-trabajo-orden','Trabajo N° ' + m.numero_orden);
    crear(datos,'h3','muro-trabajo-titulo',m.titulo || 'Trabajo docente');
    crear(cabecera,'span','muro-modulo-estado','Desbloqueado');
    const aportesModulo = reflexionesPorModulo.get(m.id) || [];
    if (!aportesModulo.length) crear(grupo,'p','text-instruccion','No hay reflexiones adicionales en este tema.');
    aportesModulo.forEach(it => {
      const articulo = crear(grupo,'article','reflexion-item muro-reflexion-usuario');
      const header = crear(articulo,'div','muro-reflexion-header');
      crear(header,'span','reflexion-autor',it.usuarios?.nombre || 'Hermano Maestro');
      crear(header,'span','muro-reflexion-fecha',it.completado_en
        ? new Date(it.completado_en).toLocaleDateString('es-CL') : '');
      crear(articulo,'div','muro-reflexion-texto','"' + it.reflexion + '"');
      const lista = comentariosMap.get(it.id) || [];
      boton(articulo,'Comentarios (' + lista.length + ')','foro-btn-toggle-comentar',
        ()=>toggleFormularioComentario(it.id));
      const caja = crear(articulo,'div','foro-comentar-caja hidden');
      caja.id = 'caja_comentario_' + it.id;
      const textarea = crear(caja,'textarea','foro-comentar-input');
      textarea.rows=3;textarea.id='input_comentario_' + it.id;
      textarea.name=textarea.id;
      textarea.placeholder='Escriba su comentario aquí...';
      const formActions = crear(caja,'div','foro-comentar-acciones');
      boton(formActions,'Cancelar','btn-secondary',()=>toggleFormularioComentario(it.id));
      boton(formActions,'Publicar','btn-primary',()=>enviarComentarioForo(it.id,m.id));
      const comentarios = crear(articulo,'div','foro-comentarios-wrapper');
      comentarios.id='lista_comentarios_' + it.id;
      lista.forEach(c => {
        const fecha=c.creado_en?new Date(c.creado_en).toLocaleDateString('es-CL',
          {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';
        const comentario=crear(comentarios,'article','foro-comentario-item');
        comentario.id='comentario_item_' + c.id;
        const encabezado=crear(comentario,'div','foro-comentario-header');
        crear(encabezado,'span','foro-comentario-autor',
          'Aporte del Q.·.H.·. ' + (c.usuarios?.nombre || 'Hermano'));
        const fechaNodo=crear(encabezado,'span','foro-comentario-fecha',fecha);
        if(c.editado)crear(fechaNodo,'span','foro-etiqueta-editado',' (editado)');
        const cuerpo=crear(comentario,'div','foro-comentario-cuerpo',c.contenido || '');
        cuerpo.id='comentario_cuerpo_' + c.id;
        const esAutor = c.usuario_id === usuarioId;
        if (esAutor || usuarioActual?.es_admin) {
          const acciones = crear(comentario,'div','foro-comentario-acciones');
          if(esAutor)boton(acciones,'Editar','foro-comentario-btn',
            ()=>abrirModalEditarComentario(c.id,encodeURIComponent(c.contenido || '')));
          if(usuarioActual?.es_admin) {
            boton(acciones,'Huella','foro-comentario-btn',()=>abrirAuditoriaComentario(
              c.id,encodeURIComponent(c.contenido_original || c.contenido || ''),
              c.usuarios?.nombre || 'Hermano',fecha));
            boton(acciones,'Eliminar','foro-comentario-btn foro-accion-eliminar',
              ()=>eliminarComentarioForo(c.id));
          }
        }
      });
    });
  });
  if (pendientes.length) {
    const reserva = crear(cont,'div','muro-modulo-pendientes');
    crear(reserva,'strong','',
      'Trabajos con aportes en reserva docente hasta su completación:');
    crear(reserva,'span','',
      pendientes.map(m=>'Trabajo ' + m.numero_orden + ': ' + m.titulo).join(' • '));
  }
}

/* ==========================================================================
   GESTIÓN DE COMENTARIOS DEL FORO
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
    
    const seccionMuroUsuarios = document.getElementById('seccionMuroUsuarios');
    if (seccionMuroUsuarios && !seccionMuroUsuarios.classList.contains('hidden')) {
      await mostrarMuroReflexionesUsuarios();
    } else {
      await cargarMuroReflexiones();
    }
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
    
    const cuerpoEl = document.getElementById(`comentario_cuerpo_${id}`);
    if (cuerpoEl) {
      cuerpoEl.innerText = texto;
    }

    const seccionMuroUsuarios = document.getElementById('seccionMuroUsuarios');
    if (seccionMuroUsuarios && !seccionMuroUsuarios.classList.contains('hidden')) {
      await mostrarMuroReflexionesUsuarios();
    } else if (moduloActual) {
      await cargarMuroReflexiones();
    }
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
          return;
        }

        const nodo = document.getElementById(`comentario_item_${comentarioId}`);
        if (nodo) {
          nodo.remove();
        }

        const seccionMuroUsuarios = document.getElementById('seccionMuroUsuarios');
        const seccionAdmin = document.getElementById('seccionAdmin');

        if (seccionMuroUsuarios && !seccionMuroUsuarios.classList.contains('hidden')) {
          await mostrarMuroReflexionesUsuarios();
        } else if (seccionAdmin && !seccionAdmin.classList.contains('hidden')) {
          await cargarMuroGeneralAdmin();
        } else if (moduloActual) {
          await cargarMuroReflexiones();
        }
      } catch (err) {
        alert("Error de conexión: " + err.message);
      }
    }
  );
}

/* ==========================================================================
   RENDERIZADO DE TRAZADO
   ========================================================================== */
function escaparHtmlTexto(texto) {
  return String(texto ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

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
      return `<h3 class="trazado-subtitulo">${escaparHtmlTexto(limpio)}</h3>`;
    }
    return `<p class="trazado-parrafo">${escaparHtmlTexto(limpio.replace(/\n/g, ' '))}</p>`;
  }).join('');
}

/* ==========================================================================
   ENTORNO DOCENTE Y LECTURA CON TEMPORIZADOR
   ========================================================================== */
async function refrescarProgresosUsuario() {
  const usuarioId = usuarioActual?.id;
  if (!usuarioId) return;
  const { data: dataProgreso, error } = await sbApp
    .from('progreso_maestro')
    .select('*')
    .eq('usuario_id', usuarioId);
  // Una respuesta demorada de una sesión anterior nunca debe sobrescribir
  // el progreso de quien inicia sesión después.
  if (usuarioActual?.id !== usuarioId) return;
  if (error) {
    console.error('No fue posible actualizar progresos de la sesión:', error);
    return;
  }
  const siguientes = {};
  (dataProgreso || []).forEach(p => { siguientes[p.modulo_id] = p; });
  misProgresos = siguientes;
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
          <span class="nav-item-num">Trabajo ${m.numero_orden}</span>${badgeHtml}
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
    // Convertir documentos data: a blob: para abrirlos en una pestaña nueva.
    // Revocar la URL anterior al seleccionar otro trabajo para evitar fugas de memoria.
    if (btnDescargar.dataset.objectUrl) {
      URL.revokeObjectURL(btnDescargar.dataset.objectUrl);
      delete btnDescargar.dataset.objectUrl;
    }
    let enlaceDocumento = rutaArchivo;
    if (rutaArchivo.startsWith('data:')) {
      try {
        const coma = rutaArchivo.indexOf(',');
        const cabecera = rutaArchivo.slice(5, coma);
        const mime = cabecera.split(';')[0] || 'application/octet-stream';
        const contenido = rutaArchivo.slice(coma + 1);
        const binario = cabecera.includes(';base64') ? atob(contenido) : decodeURIComponent(contenido);
        const bytes = Uint8Array.from(binario, c => c.charCodeAt(0));
        enlaceDocumento = URL.createObjectURL(new Blob([bytes], { type: mime }));
        btnDescargar.dataset.objectUrl = enlaceDocumento;
      } catch (errorDocumento) {
        console.error('No fue posible preparar el documento original.', errorDocumento);
        enlaceDocumento = '';
      }
    }
    if (enlaceDocumento) btnDescargar.href = enlaceDocumento;
    else btnDescargar.removeAttribute('href');
    btnDescargar.target = '_blank';
    btnDescargar.rel = 'noopener noreferrer';
    
    const esWord = rutaArchivo.startsWith('data:application/vnd.openxmlformats') || rutaArchivo.endsWith('.docx');
    const extension = esWord ? '.docx' : '.pdf';
    btnDescargar.removeAttribute('download'); // Abrir en pestaña nueva, permitir guardar desde el navegador.
    btnDescargar.classList.toggle('hidden', !enlaceDocumento);

    if (!esWord && (rutaArchivo.startsWith('data:application/pdf') || rutaArchivo.endsWith('.pdf'))) {
      tabPdf.classList.add('hidden'); // Visor original retirado por decisión institucional.
      framePdf.removeAttribute('src');
      cambiarVistaDocencia('texto');
    } else {
      tabPdf.classList.add('hidden');
      cambiarVistaDocencia('texto');
    }
  } else {
    tabPdf.classList.add('hidden');
    btnDescargar.classList.add('hidden');
    btnDescargar.removeAttribute('href');
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
   FASE II: CUESTIONARIO DE 8 PREGUNTAS
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
        <span><strong>${op.letra}) </strong>${op.texto}</span>
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
  const moduloId = moduloActual?.id;
  if (!contenedor || !moduloId || !usuarioActual) return;
  const estado = document.createElement('p');
  estado.className = 'td-loading';
  estado.textContent = 'Cargando aportes de la Cámara...';
  contenedor.replaceChildren(estado);
  const { data, error } = await sbApp
    .from('progreso_maestro')
    .select('id, reflexion, completado_en, modulo_id, usuario_id, usuarios(nombre)')
    .eq('modulo_id', moduloId)
    .eq('completado', true)
    .not('reflexion', 'is', null);
  if (moduloActual?.id !== moduloId || !usuarioActual) return;
  if (error) {
    estado.textContent = 'No fue posible obtener las reflexiones de este trabajo.';
    return;
  }
  const { data: comentariosData, error: errorComentarios } = await sbApp
    .from('comentarios_muro')
    .select('id, progreso_id, usuario_id, contenido, contenido_original, editado, editado_en, creado_en, usuarios(nombre)')
    .eq('modulo_id', moduloId)
    .eq('activo', true)
    .order('creado_en', { ascending: true });
  if (moduloActual?.id !== moduloId || !usuarioActual) return;
  if (errorComentarios) {
    estado.textContent = 'No fue posible verificar los comentarios de este trabajo.';
    return;
  }
  contenedor.replaceChildren();
  const comentarios = new Map();
  const idsComentarios = new Set();
  (comentariosData || []).forEach(c => {
    if (idsComentarios.has(c.id)) return;
    idsComentarios.add(c.id);
    if (!comentarios.has(c.progreso_id)) comentarios.set(c.progreso_id, []);
    comentarios.get(c.progreso_id).push(c);
  });
  const crear = (tag, clase, texto, padre) => {
    const nodo = document.createElement(tag);
    if (clase) nodo.className = clase;
    if (texto !== undefined) nodo.textContent = String(texto ?? '');
    if (padre) padre.appendChild(nodo);
    return nodo;
  };
  const crearBoton = (texto, clase, padre, evento) => {
    const boton = crear('button', clase, texto, padre);
    boton.type = 'button';
    boton.addEventListener('click', evento);
    return boton;
  };
  const usuariosVistos = new Set();
  (data || []).forEach(item => {
    if (!item.reflexion?.trim() || item.modulo_id !== moduloId ||
        usuariosVistos.has(item.usuario_id)) return;
    usuariosVistos.add(item.usuario_id);
    const lista = comentarios.get(item.id) || [];
    const articulo = crear('article', 'reflexion-item', undefined, contenedor);
    articulo.style.marginBottom = '20px';
    crear('div', 'reflexion-autor', item.usuarios?.nombre || 'Hermano Maestro', articulo);
    const reflexion = crear('div', 'reflexion-texto-seguro', '"' + item.reflexion + '"', articulo);
    reflexion.style.fontStyle = 'italic';
    reflexion.style.marginBottom = '8px';
    crearBoton('Comentarios (' + lista.length + ')', 'foro-btn-toggle-comentar', articulo,
      () => toggleFormularioComentario(item.id));
    const caja = crear('div', 'foro-comentar-caja hidden', undefined, articulo);
    caja.id = 'caja_comentario_' + item.id;
    const area = crear('textarea', 'foro-comentar-input', undefined, caja);
    area.id = 'input_comentario_' + item.id;
    area.name = area.id;
    area.rows = 3;
    area.placeholder = 'Escriba su comentario aquí...';
    const accionesFormulario = crear('div', 'foro-comentar-acciones', undefined, caja);
    crearBoton('Cancelar', 'btn-secondary', accionesFormulario,
      () => toggleFormularioComentario(item.id));
    crearBoton('Publicar', 'btn-primary', accionesFormulario,
      () => enviarComentarioForo(item.id, moduloId));
    const listaNodo = crear('div', 'foro-comentarios-wrapper', undefined, articulo);
    listaNodo.id = 'lista_comentarios_' + item.id;
    lista.forEach(c => {
      const fecha = c.creado_en
        ? new Date(c.creado_en).toLocaleDateString('es-CL',
          { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '';
      const comentario = crear('article', 'foro-comentario-item', undefined, listaNodo);
      comentario.id = 'comentario_item_' + c.id;
      const cabecera = crear('div', 'foro-comentario-header', undefined, comentario);
      crear('span', 'foro-comentario-autor',
        'Aporte del Q.·.H.·. ' + (c.usuarios?.nombre || 'Hermano'), cabecera);
      const fechaNodo = crear('span', 'foro-comentario-fecha', fecha, cabecera);
      if (c.editado) crear('span', 'foro-etiqueta-editado', ' (editado)', fechaNodo);
      const cuerpo = crear('div', 'foro-comentario-cuerpo', c.contenido || '', comentario);
      cuerpo.id = 'comentario_cuerpo_' + c.id;
      const esAutor = c.usuario_id === usuarioActual.id;
      if (esAutor || usuarioActual.es_admin) {
        const accionesComentario = crear('div', 'foro-comentario-acciones', undefined, comentario);
        if (esAutor) crearBoton('Editar', 'foro-comentario-btn', accionesComentario,
          () => abrirModalEditarComentario(c.id, encodeURIComponent(c.contenido || '')));
        if (usuarioActual.es_admin) {
          crearBoton('Huella', 'foro-comentario-btn', accionesComentario,
            () => abrirAuditoriaComentario(c.id,
              encodeURIComponent(c.contenido_original || c.contenido || ''),
              c.usuarios?.nombre || 'Hermano', fecha));
          crearBoton('Eliminar', 'foro-comentario-btn foro-accion-eliminar',
            accionesComentario, () => eliminarComentarioForo(c.id));
        }
      }
    });
  });
  if (!usuariosVistos.size) crear('p', 'text-instruccion',
    'Aún no hay reflexiones consagradas en este trabajo.', contenedor);
}

/* ==========================================================================
   MIS AVANCES E INFORME
   ========================================================================== */
async function abrirModalMisAvances(usuarioObjetivoId = null) {
  const idTarget = usuarioObjetivoId || usuarioActual.id;
  
  const { data: usuarioData } = await sbApp
    .from('usuarios')
    .select('id,nombre,email,es_admin,terminos_aceptados,creado_en,debe_cambiar_clave')
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
   CERTIFICADO OFICIAL A4
   ========================================================================== */
async function abrirModalCertificado(moduloId = null, usuarioId = null) {
  const modTarget = moduloId ? listaModulos.find(m => m.id === moduloId) : moduloActual;
  const userTarget = usuarioId ? (await sbApp.from('usuarios').select('id,nombre,email,es_admin,terminos_aceptados,creado_en,debe_cambiar_clave').eq('id', usuarioId).single()).data : usuarioActual;

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
    const modalObligatorio = document.getElementById('modalCambioClaveObligatorio');
    if (modalObligatorio && !modalObligatorio.classList.contains('hidden')) {
      return;
    }

    ['modalCertificado', 'modalMisAvances', 'modalAuditoriaModulo', 'modalParametrosHermano', 'modalEditarComentarioForo', 'modalAuditoriaComentario', 'modalConfirmarAccion', 'modalRecuperarClave', 'modalCambiarMiClave', 'modalAdminClaveHermano', 'modalAdminUsuario'].forEach(id => {
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
   CONSOLA SUPERADMIN
   ========================================================================== */
async function cargarDatosAdmin() {
  const { data: mods } = await sbApp
    .from('modulos')
    .select('*')
    .eq('activo', true)
    .order('numero_orden', { ascending: true });

  listaModulos = mods || [];
  
  const selectMetricas = document.getElementById('selectMetricasModulo');
  if (selectMetricas) {
    selectMetricas.innerHTML = "";
    listaModulos.forEach(m => {
      selectMetricas.innerHTML += `<option value="${m.id}">Trabajo ${m.numero_orden}: ${m.titulo}</option>`;
    });
  }
  
  const selectPresencialMod = document.getElementById('selectOrigenTrabajoPresencial');
  if (selectPresencialMod) {
    selectPresencialMod.innerHTML = `<option value="aleatorio">🎲 Todos los Trabajos (Aleatorio)</option>`;
    listaModulos.forEach(m => {
      selectPresencialMod.innerHTML += `<option value="${m.id}">Trabajo ${m.numero_orden}: ${m.titulo}</option>`;
    });
  }

  const selectAdjunto = document.getElementById('selectModuloParaArchivo');
  if (selectAdjunto) {
    selectAdjunto.innerHTML = "";
    listaModulos.forEach(m => {
      selectAdjunto.innerHTML += `<option value="${m.id}">Trabajo ${m.numero_orden}: ${m.titulo}</option>`;
    });
    if (listaModulos.length > 0) {
      verificarEstadoArchivoModulo(selectAdjunto.value || listaModulos[0].id);
    }
  }

  cambiarSubseccionAdmin('resumen');
}

let secuenciaResumenSuperadmin = 0;
async function cargarResumenSuperadmin() {
  const secuenciaActual = ++secuenciaResumenSuperadmin;
  const estado = document.getElementById('resumenSuperadminEstado');
  const escribir = (id, valor) => {
    const nodo = document.getElementById(id);
    if (nodo) nodo.textContent = String(valor);
  };
  const ids = ['resumenKpiUsuarios', 'resumenKpiTrabajos', 'resumenKpiAccesos', 'resumenKpiHistorial'];
  ids.forEach(id => escribir(id, '…'));
  if (estado) estado.textContent = 'Consultando indicadores...';
  // La portada es exclusivamente informativa; ninguna consulta altera registros.
  const excluirCuentas = 'email.is.null,and(email.not.ilike.jpintov@gmail.com,email.not.ilike.jpintov@hotmail.com)';
  try {
    const consultas = await Promise.all([
      sbApp.from('usuarios').select('id', { count: 'exact', head: true })
        .eq('es_admin', false).or(excluirCuentas),
      sbApp.from('modulos').select('id', { count: 'exact', head: true }).eq('activo', true),
      sbApp.from('registro_accesos').select('id', { count: 'exact', head: true }).or(excluirCuentas),
      sbApp.from('registro_accesos').select('id', { count: 'exact', head: true })
    ]);
    if (secuenciaActual !== secuenciaResumenSuperadmin) return;
    let fallos = 0;
    consultas.forEach((resultado, i) => {
      const valor = resultado.error ? '—' : Number(resultado.count || 0).toLocaleString('es-CL');
      if (resultado.error) { fallos++; console.error('Indicador Superadmin no disponible:', resultado.error); }
      escribir(ids[i], valor);
    });
    if (estado) estado.textContent = fallos
      ? 'Algunos indicadores no están disponibles. Compruebe los permisos de lectura antes de publicar.'
      : 'Datos de lectura: las cuentas de prueba se excluyen solo de los indicadores de usuarios. La auditoría íntegra se conserva.';
  } catch (error) {
    if (secuenciaActual !== secuenciaResumenSuperadmin) return;
    ids.forEach(id => escribir(id, '—'));
    if (estado) estado.textContent = 'No fue posible cargar los indicadores.';
    console.error('Error en resumen de Superadmin:', error);
  }
}

/* ==========================================================================
   DOCTRINA DOCUMENTAL — RECEPCIÓN LOCAL SIN TRANSFERENCIA DE ARCHIVOS
   ========================================================================== */
let manifiestoDoctrinaPendiente = [];
let secuenciaRecepcionDoctrina = 0;

function limpiarRecepcionDoctrina(limpiarMetadatos = false) {
  ++secuenciaRecepcionDoctrina;
  manifiestoDoctrinaPendiente = [];
  const input = document.getElementById('doctrinaArchivos');
  if (input) input.value = '';
  if (limpiarMetadatos) {
    const ids = ['doctrinaEmisorAutor','doctrinaInstitucion','doctrinaReferenciaFuente',
      'doctrinaEdicion','doctrinaFechaFuente','doctrinaFundamento','doctrinaDerechos','doctrinaReferencia'];
    ids.forEach(id => {
      const nodo = document.getElementById(id);
      if (nodo) nodo.value = '';
    });
    const tipo = document.getElementById('doctrinaFuenteTipo');
    if (tipo) tipo.value = '';
    const externo = document.getElementById('doctrinaAutorizaExterno');
    if (externo) externo.checked = false;
  }
  const tabla = document.getElementById('tablaRecepcionDoctrina');
  if (tabla) {
    tabla.replaceChildren();
    const row = tabla.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 4;
    cell.textContent = 'Selecciona archivos para iniciar la recepción local.';
  }
  const exportar = document.getElementById('btnExportarManifiestoDoctrina');
  if (exportar) exportar.disabled = true;
  const estado = document.getElementById('estadoRecepcionDoctrina');
  if (estado) estado.textContent = 'Recepción local reiniciada. Ningún archivo fue transferido.';
}

async function prepararLoteDoctrinal() {
  if (!usuarioActual?.es_admin) return; // Identidad real se valida en servidor antes de transferir.
  const input = document.getElementById('doctrinaArchivos');
  const tabla = document.getElementById('tablaRecepcionDoctrina');
  const estado = document.getElementById('estadoRecepcionDoctrina');
  const exportar = document.getElementById('btnExportarManifiestoDoctrina');
  if (!input || !tabla || !estado) return;
  const archivos = Array.from(input.files || []);
  const secuenciaActual = ++secuenciaRecepcionDoctrina;
  manifiestoDoctrinaPendiente = [];
  if (exportar) exportar.disabled = true;
  tabla.replaceChildren();
  if (!archivos.length) {
    estado.textContent = 'Selecciona al menos un archivo antes de preparar el lote.';
    return;
  }
  if (!globalThis.crypto?.subtle) {
    estado.textContent = 'La verificación SHA-256 requiere un contexto HTTPS compatible.';
    return;
  }
  const etiquetasPermitidas = /\.pdf$/i;
  const maximo = 128 * 1024 * 1024; // Soporta el original normativo del lote (~95 MiB) solo para catalogación local.
  const texto = id => (document.getElementById(id)?.value || '').trim();
  const fuenteTipo = texto('doctrinaFuenteTipo');
  const fuentesAdmitidas = ['oficial_gran_logia_chile', 'literatura_reaa_confiable'];
  const emisor = texto('doctrinaEmisorAutor');
  const institucion = texto('doctrinaInstitucion');
  const referencia = texto('doctrinaReferenciaFuente');
  const fundamento = texto('doctrinaFundamento');
  if (!fuentesAdmitidas.includes(fuenteTipo) || emisor.length < 3 ||
      institucion.length < 3 || referencia.length < 8 || fundamento.length < 30) {
    estado.textContent = 'Complete procedencia oficial o literaria REAA, emisor, institución, referencia verificable y fundamento de confiabilidad (30 caracteres mínimo). No se ha preparado ningún archivo.';
    return;
  }
  const metadatos = {
    fuente_tipo: fuenteTipo, // PROCEDENCIA DECLARADA: nunca equivale a fuente verificada.
    emisor_autor: emisor,
    institucion_editorial: institucion,
    referencia_fuente: referencia,
    identificador_edicion: texto('doctrinaEdicion'),
    fecha_fuente: texto('doctrinaFechaFuente'),
    fundamento_confiabilidad: fundamento,
    licencia_derechos: texto('doctrinaDerechos') || 'Pendiente de verificar por el Superadmin',
    revision_procedencia: 'pendiente',
    revision_correlacion: 'pendiente',
    revision_respuestas: 'pendiente',
    revision_seguridad: 'pendiente',
    clase: document.getElementById('doctrinaClase')?.value || 'doctrina',
    grado_minimo: 'M', // Compatibilidad de esquema. TODOS los usuarios son Maestros; NO usar para controlar acceso.
    contexto_grado: document.getElementById('doctrinaContextoGrado')?.value || 'general',
    clasificacion_acceso: document.getElementById('doctrinaClasificacion')?.value || 'reservado',
    autorizacion_procesamiento_externo: false, // Exige aprobación verificable por documento; nunca heredar autorización del lote.
    autorizacion_externa_solicitada_lote: Boolean(document.getElementById('doctrinaAutorizaExterno')?.checked),
    referencia_origen: (document.getElementById('doctrinaReferencia')?.value || '').trim()
  };
  estado.textContent = 'Preparando ' + archivos.length + ' archivo(s), sin transferencia de datos...';
  let rechazados = 0;
  const hashesPreparados = new Set();
  for (const archivo of archivos) {
    if (secuenciaActual !== secuenciaRecepcionDoctrina) return;
    const fila = tabla.insertRow();
    fila.insertCell().textContent = archivo.name;
    fila.insertCell().textContent = (archivo.size / (1024 * 1024)).toLocaleString('es-CL', { maximumFractionDigits: 2 }) + ' MB';
    const celdaHash = fila.insertCell();
    const celdaEstado = fila.insertCell();
    if (!etiquetasPermitidas.test(archivo.name) || archivo.size < 1 || archivo.size > maximo) {
      celdaHash.textContent = '—';
      celdaEstado.textContent = 'No admitido: extensión distinta de PDF o tamaño fuera del límite (1 a 128 MB)';
      rechazados++;
      continue;
    }
    try {
      const contenido = await archivo.arrayBuffer();
      if (secuenciaActual !== secuenciaRecepcionDoctrina) return;
      const cabecera = new Uint8Array(contenido, 0, Math.min(5, contenido.byteLength));
      if (String.fromCharCode(...cabecera) !== '%PDF-') {
        celdaHash.textContent = '—';
        celdaEstado.textContent = 'Rechazado: cabecera PDF inválida';
        rechazados++;
        continue;
      }
      const huella = await crypto.subtle.digest('SHA-256', contenido);
      if (secuenciaActual !== secuenciaRecepcionDoctrina) return;
      const sha256 = Array.from(new Uint8Array(huella), b => b.toString(16).padStart(2, '0')).join('');
      if (hashesPreparados.has(sha256)) {
        celdaHash.textContent = sha256;
        celdaEstado.textContent = 'Duplicado exacto en este lote; omitido';
        rechazados++;
        continue;
      }
      hashesPreparados.add(sha256);
      celdaHash.textContent = sha256;
      celdaHash.title = sha256;
      celdaEstado.textContent = 'Preingesta local · fuente NO verificada';
      manifiestoDoctrinaPendiente.push({
        titulo: archivo.name.replace(/\.[^.]+$/, ''),
        archivo_original: archivo.name,
        bytes: archivo.size,
        mime: 'application/pdf',
        sha256,
        ...metadatos,
        estado: 'solo_catalogo',
        formato_pdf_cabecera: true,
        fuente_confirmada: false,
        integridad_objeto_storage_verificada: false,
        grado_validado: false,
        derechos_verificados: false,
        publicacion_permitida: false,
        respuestas_habilitadas: false,
        pendiente_revision_institucional: true,
        objeto_storage: null
      });
    } catch (error) {
      if (secuenciaActual !== secuenciaRecepcionDoctrina) return;
      celdaHash.textContent = '—';
      celdaEstado.textContent = 'No fue posible verificar el original';
      rechazados++;
      console.error('Error al verificar original:', error);
    }
  }
  if (secuenciaActual !== secuenciaRecepcionDoctrina) return;
  if (exportar) exportar.disabled = !manifiestoDoctrinaPendiente.length;
  estado.textContent = manifiestoDoctrinaPendiente.length + ' archivo(s) preparado(s); ' +
    rechazados + ' rechazado(s). Ningún original ha sido subido ni enviado a servicios externos.';
}

function exportarManifiestoDoctrina() {
  if (!usuarioActual?.es_admin) return;
  if (!manifiestoDoctrinaPendiente.length) {
    document.getElementById('estadoRecepcionDoctrina').textContent = 'Prepara archivos válidos antes de exportar.';
    return;
  }
  const exportacion = {
    formato: 'doctrina-manifiesto-v1',
    generado_en: new Date().toISOString(),
    destino_previsto: 'Supabase Storage privado — pendiente de autorización y políticas',
    transferencia_realizada: false,
    documentos: manifiestoDoctrinaPendiente
  };
  const bytes = new Blob([JSON.stringify(exportacion, null, 2)], { type: 'application/json;charset=utf-8' });
  const enlace = URL.createObjectURL(bytes);
  const a = document.createElement('a');
  a.href = enlace;
  a.download = 'doctrina-manifiesto-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(enlace);
  document.getElementById('estadoRecepcionDoctrina').textContent =
    'Manifiesto exportado (solo metadatos y SHA-256). Los archivos originales siguen en el navegador.';
}


/* ==========================================================================
   DOCTRINA Y REGLAMENTOS — CONSULTA LOCAL SOLO SUPERADMIN
   El contexto de grado NO controla accesos. No hay conexión a Storage ni LLM.
   ========================================================================== */
let secuenciaConsultaDoctrina = 0;

function normalizarConsultaDoctrinal(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

function identificarContextoDoctrinal(consulta) {
  const texto = normalizarConsultaDoctrinal(consulta);
  const contextos = [];
  if (/(^|[^a-z])(iniciacion(?:es)?|iniciado(?:s)?|aprendiz|aprendices|primer grado|piedra bruta)(?=$|[^a-z])/.test(texto)) {
    contextos.push('Iniciación / Aprendiz (primer grado)');
  }
  if (/(^|[^a-z])(aumento(?:s)?|companero(?:s)?|segundo grado)(?=$|[^a-z])/.test(texto)) {
    contextos.push('Aumento / Compañero (segundo grado)');
  }
  if (/(^|[^a-z])(exaltacion(?:es)?|maestro(?:s)?|maestria|tercer grado|camara del medio)(?=$|[^a-z])/.test(texto)) {
    contextos.push('Exaltación / Maestro (tercer grado)');
  }
  return contextos;
}

function limpiarConsultaDoctrina() {
  ++secuenciaConsultaDoctrina;
  const entrada = document.getElementById('inputConsultaDoctrina');
  const archivos = document.getElementById('inputArchivosConsultaDoctrina');
  if (entrada) entrada.value = '';
  if (archivos) archivos.value = '';
  const resultados = document.getElementById('resultadosConsultaDoctrina');
  if (resultados) resultados.replaceChildren();
  const contexto = document.getElementById('contextoConsultaDoctrina');
  if (contexto) contexto.textContent = 'Sin una consulta activa. El grado es contexto temático, no un permiso.';
  const estado = document.getElementById('estadoConsultaDoctrina');
  if (estado) estado.textContent = 'Selecciona archivos PDF para iniciar una consulta local.';
  const boton = document.getElementById('btnConsultarDoctrina');
  if (boton) boton.disabled = false;
}

async function consultarDoctrinaReglamentos() {
  if (!usuarioActual?.es_admin) return; // Protección de interfaz: NO reemplaza autorización de servidor.
  const consulta = document.getElementById('inputConsultaDoctrina')?.value.trim() || '';
  const archivos = Array.from(document.getElementById('inputArchivosConsultaDoctrina')?.files || []);
  const contexto = document.getElementById('contextoConsultaDoctrina');
  const estado = document.getElementById('estadoConsultaDoctrina');
  const resultados = document.getElementById('resultadosConsultaDoctrina');
  const boton = document.getElementById('btnConsultarDoctrina');
  if (!estado || !resultados) return;
  const secuenciaActual = ++secuenciaConsultaDoctrina;
  resultados.replaceChildren();
  const etiquetas = identificarContextoDoctrinal(consulta);
  if (contexto) contexto.textContent = etiquetas.length
    ? 'Tema relacionado: ' + etiquetas.join(' · ') + '. Sin restricciones por grado.'
    : 'Tema transversal / sin grado específico detectado. Todos los usuarios ordinarios son Maestros.';
  if (consulta.length < 3 || !archivos.length) {
    estado.textContent = 'Escribe una consulta de al menos tres caracteres y selecciona uno o más PDF.';
    return;
  }
  if (!window.pdfjsLib) {
    estado.textContent = 'El lector PDF no está disponible. Comprueba la carga de PDF.js.';
    return;
  }
  const palabrasVacias = new Set(['para', 'sobre', 'como', 'donde', 'desde', 'entre', 'hasta', 'esta', 'este', 'esto', 'estos', 'estas', 'aquellos', 'aquellas', 'cuando', 'cual', 'cuales', 'cuanto', 'mas', 'sus', 'con', 'por', 'que', 'del', 'las', 'los', 'una', 'unos', 'unas', 'el', 'la', 'un', 'y', 'o', 'en', 'de', 'al', 'es', 'se', 'su', 'mi']);
  const palabras = [...new Set(normalizarConsultaDoctrinal(consulta)
    .split(/[^a-z0-9]+/).filter(p => p.length >= 3 && !palabrasVacias.has(p)))].slice(0, 10);
  if (!palabras.length) {
    estado.textContent = 'La consulta debe incluir al menos un término significativo.';
    return;
  }
  if (boton) boton.disabled = true;
  let totalCoincidencias = 0, paginasExaminadas = 0, documentosSinTexto = 0, documentosAnalizados = 0;
  const advertencias = [];
  try {
    const maxDocs = Math.min(archivos.length, 10);
    for (const archivo of archivos.slice(0, maxDocs)) {
      if (secuenciaActual !== secuenciaConsultaDoctrina || !usuarioActual?.es_admin) return;
      if (!/\.pdf$/i.test(archivo.name) || archivo.size < 1 || archivo.size > 128 * 1024 * 1024) {
        advertencias.push(archivo.name + ': formato o tamaño no admitido.');
        continue;
      }
      estado.textContent = 'Buscando en ' + archivo.name + ' (sin transferir el archivo)...';
      let pdf;
      try {
        pdf = await window.pdfjsLib.getDocument({data: new Uint8Array(await archivo.arrayBuffer())}).promise;
        if (secuenciaActual !== secuenciaConsultaDoctrina) return;
        documentosAnalizados++;
        let paginasConTexto = 0, coincidenciasArchivo = 0;
        for (let pagina = 1; pagina <= pdf.numPages; pagina++) {
          if (secuenciaActual !== secuenciaConsultaDoctrina || !usuarioActual?.es_admin) return;
          const paginaPdf = await pdf.getPage(pagina);
          const contenido = await paginaPdf.getTextContent();
          const textoOriginal = contenido.items.map(i => i.str || '').join(' ').replace(/\s+/g, ' ').trim();
          paginasExaminadas++;
          if (!textoOriginal) continue;
          paginasConTexto++;
          const textoNormal = normalizarConsultaDoctrinal(textoOriginal);
          const encontradas = palabras.filter(p => textoNormal.includes(p));
          if (!encontradas.length) continue;
          totalCoincidencias++;
          coincidenciasArchivo++;
          if (totalCoincidencias <= 35) {
            const primera = textoNormal.indexOf(encontradas[0]);
            const inicio = Math.max(0, primera - 130);
            const resumen = textoOriginal.slice(inicio, inicio + 330);
            const item = document.createElement('article');
            item.className = 'doctrina-consulta-hallazgo';
            const titulo = document.createElement('h3');
            titulo.textContent = archivo.name + ' · página PDF ' + pagina;
            const meta = document.createElement('small');
            meta.textContent = 'Términos detectados: ' + encontradas.join(', ');
            const pasaje = document.createElement('p');
            pasaje.textContent = (inicio ? '…' : '') + resumen + (inicio + 330 < textoOriginal.length ? '…' : '');
            item.append(titulo, meta, pasaje);
            resultados.appendChild(item);
          }
          if (coincidenciasArchivo >= 15) break; // límite de resultados por archivo
        }
        if (!paginasConTexto) {
          documentosSinTexto++;
          advertencias.push(archivo.name + ': PDF sin texto extraíble; requerirá OCR supervisado.');
        }
      } catch (error) {
        advertencias.push(archivo.name + ': error al interpretar el PDF.');
        console.error('Lectura PDF doctrinal local:', error);
      } finally {
        try { await pdf?.destroy(); } catch (_) {}
      }
    }
    if (secuenciaActual !== secuenciaConsultaDoctrina) return;
    estado.textContent = documentosAnalizados + ' documento(s) analizado(s), ' +
      paginasExaminadas + ' páginas examinadas, ' + totalCoincidencias + ' coincidencia(s) por página. ' +
      (totalCoincidencias > 35 ? 'Se muestran las primeras 35 coincidencias. ' : '') +
      (documentosSinTexto ? documentosSinTexto + ' PDF sin texto extraíble. ' : '') +
      (archivos.length > 10 ? 'Se procesaron solo los primeros 10 archivos. ' : '') +
      (advertencias.length ? 'Observaciones: ' + advertencias.join(' ') : 'Resultados locales, sin publicación ni envío externo.');
    if (!totalCoincidencias) {
      const mensaje = document.createElement('p');
      mensaje.textContent = 'Sin coincidencias textuales. La ausencia de resultados no demuestra que la materia no esté en los documentos.';
      resultados.appendChild(mensaje);
    }
  } finally {
    if (secuenciaActual === secuenciaConsultaDoctrina && boton) boton.disabled = false;
  }
}

function cambiarSubseccionAdmin(seccion) {
  // Control de interfaz únicamente. La autorización de operaciones remotas se valida en servidor.
  if (!usuarioActual?.es_admin) {
    document.getElementById('seccionAdmin')?.classList.add('hidden');
    return;
  }
  const btns = ['tabNavResumen', 'tabNavUsuarios', 'tabNavCargar', 'tabNavGestionTrabajos', 'tabNavPresencial', 'tabNavMuroGeneral', 'tabNavMetricas', 'tabNavDoctrinaReglamentos', 'tabNavDoctrinaDocumental', 'tabNavEditorDoctrina', 'tabNavAccesos'];
  const secs = ['adminSeccionResumen', 'adminSeccionUsuarios', 'adminSeccionCarga', 'adminSeccionGestionTrabajos', 'adminSeccionPresencial', 'adminSeccionMuroGeneral', 'adminSeccionMetricas', 'adminSeccionDoctrinaReglamentos', 'adminSeccionDoctrinaDocumental', 'adminSeccionEditorDoctrina', 'adminSeccionAccesos'];

  btns.forEach(b => document.getElementById(b)?.classList.remove('active'));
  secs.forEach(s => document.getElementById(s)?.classList.add('hidden'));

  if (seccion === 'resumen') {
    document.getElementById('tabNavResumen')?.classList.add('active');
    document.getElementById('adminSeccionResumen')?.classList.remove('hidden');
    cargarResumenSuperadmin();
  } else if (seccion === 'usuarios') {
    document.getElementById('tabNavUsuarios')?.classList.add('active');
    document.getElementById('adminSeccionUsuarios')?.classList.remove('hidden');
    cargarListadoUsuariosAdmin();
  } else if (seccion === 'cargar') {
    document.getElementById('tabNavCargar')?.classList.add('active');
    document.getElementById('adminSeccionCarga')?.classList.remove('hidden');
  } else if (seccion === 'gestion_trabajos') {
    document.getElementById('tabNavGestionTrabajos')?.classList.add('active');
    document.getElementById('adminSeccionGestionTrabajos')?.classList.remove('hidden');
    cargarGestionTrabajosAdmin();
  } else if (seccion === 'presencial') {
    document.getElementById('tabNavPresencial')?.classList.add('active');
    document.getElementById('adminSeccionPresencial')?.classList.remove('hidden');
  } else if (seccion === 'muro_general') {
    document.getElementById('tabNavMuroGeneral')?.classList.add('active');
    document.getElementById('adminSeccionMuroGeneral')?.classList.remove('hidden');
    cargarMuroGeneralAdmin();
  } else if (seccion === 'doctrina_reglamentos') {
    document.getElementById('tabNavDoctrinaReglamentos')?.classList.add('active');
    document.getElementById('adminSeccionDoctrinaReglamentos')?.classList.remove('hidden');
  } else if (seccion === 'doctrina_documental') {
    document.getElementById('tabNavDoctrinaDocumental')?.classList.add('active');
    document.getElementById('adminSeccionDoctrinaDocumental')?.classList.remove('hidden');
  } else if (seccion === 'editor_doctrina') {
    document.getElementById('tabNavEditorDoctrina')?.classList.add('active');
    document.getElementById('adminSeccionEditorDoctrina')?.classList.remove('hidden');
    cargarEditorDoctrinaAdmin();
  } else if (seccion === 'accesos') {
    document.getElementById('tabNavAccesos')?.classList.add('active');
    document.getElementById('adminSeccionAccesos')?.classList.remove('hidden');
    cargarBitacoraAccesos();
  } else {
    document.getElementById('tabNavMetricas')?.classList.add('active');
    document.getElementById('adminSeccionMetricas')?.classList.remove('hidden');
    if (listaModulos.length > 0) {
      const select = document.getElementById('selectMetricasModulo');
      cargarMetricasAvance(select.value || listaModulos[0].id);
    }
  }
}

/* ==========================================================================
   ASOCIACIÓN DIRECTA DE ARCHIVO ORIGINAL
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
   BITÁCORA DE ACCESOS
   ========================================================================== */
let secuenciaConsultaBitacora = 0;
async function cargarBitacoraAccesos(filtroUsuarioId = null) {
  const secuenciaActual = ++secuenciaConsultaBitacora;
  const tbody = document.getElementById('tablaAccesosBody');
  const selectFiltro = document.getElementById('filtroUsuarioAcceso');
  const cuentasOcultas = [
    document.getElementById('ocultarGmailBitacora')?.checked ? 'jpintov@gmail.com' : null,
    document.getElementById('ocultarHotmailBitacora')?.checked ? 'jpintov@hotmail.com' : null
  ].filter(Boolean);
  const resumen = document.getElementById('resumenBitacoraAccesos');
  const periodo = document.getElementById('periodoBitacora')?.value || 'todo';
  const dias = periodo === '7' ? 7 : (periodo === '30' ? 30 : null);
  const actualizarIndicador = (id, valor) => {
    const nodo = document.getElementById(id);
    if (nodo) nodo.textContent = String(valor);
  };
  ['kpiBitacoraAccesos', 'kpiBitacoraUsuarios', 'kpiBitacoraUltimo'].forEach(id => actualizarIndicador(id, '…'));
  actualizarIndicador('kpiBitacoraOcultas', cuentasOcultas.length);

  tbody.replaceChildren();
  const estado = (mensaje) => {
    tbody.replaceChildren();
    const tr = tbody.insertRow();
    const td = tr.insertCell();
    td.colSpan = 4;
    td.textContent = mensaje;
  };
  estado('Consultando registros...');
  if (selectFiltro) {
    const seleccionAnterior = selectFiltro.value;
    selectFiltro.replaceChildren(new Option('Todos los usuarios', 'todos'));

    const { data: usrs, error: errorUsuarios } = await sbApp.from('usuarios').select('id, nombre, email').order('nombre', { ascending: true });
    if (secuenciaActual !== secuenciaConsultaBitacora) return;
    if (!errorUsuarios && usrs) {
      usrs.forEach(u => {
        if (cuentasOcultas.includes((u.email || '').trim().toLowerCase())) return;
        selectFiltro.add(new Option(u.nombre, u.id));
      });
    }
    if ([...selectFiltro.options].some(o => o.value === seleccionAnterior)) selectFiltro.value = seleccionAnterior;
  }
  // El filtro se ejecuta antes de limitar la consulta: no se pierden accesos
  // de usuarios por la abundancia de pruebas administrativas.
  const filtroActual = filtroUsuarioId && [...(selectFiltro?.options || [])].some(o => o.value === filtroUsuarioId) ? filtroUsuarioId : (selectFiltro?.value || 'todos');
  let query = sbApp.from('registro_accesos')
    .select('usuario_id,nombre,email,ip_origen,creado_en', { count: 'exact' })
    .order('creado_en', { ascending: false }).limit(100);
  if (filtroActual !== 'todos') query = query.eq('usuario_id', filtroActual);
  if (dias) query = query.gte('creado_en', new Date(Date.now() - dias * 86400000).toISOString());
  // Una sola expresión PostgREST: conserva correos NULL y aplica TODAS
  // las exclusiones antes de limitar a los últimos 100 ingresos.
  if (cuentasOcultas.length) {
    const condiciones = cuentasOcultas.map(correo => 'email.not.ilike.' + correo);
    query = query.or('email.is.null,' + (
      condiciones.length === 1 ? condiciones[0] : 'and(' + condiciones.join(',') + ')'
    ));
  }
  const { data: registros, error, count } = await query;
  if (secuenciaActual !== secuenciaConsultaBitacora) return;
  if (error) {
    estado('No fue posible consultar la bitácora.');
    ['kpiBitacoraAccesos', 'kpiBitacoraUsuarios', 'kpiBitacoraUltimo'].forEach(id => actualizarIndicador(id, '—'));
    if (resumen) resumen.textContent = 'Error al consultar los accesos. No se modificó ningún registro.';
    console.error('Error de bitácora:', error);
    return;
  }
  const total = Number.isFinite(count) ? count : registros?.length || 0;
  const identidades = new Set(
    (registros || []).map(r => r.usuario_id || (r.email || '').trim().toLowerCase()).filter(Boolean)
  );
  actualizarIndicador('kpiBitacoraAccesos', total.toLocaleString('es-CL'));
  actualizarIndicador('kpiBitacoraUsuarios', identidades.size.toLocaleString('es-CL'));
  const notaUsuarios = document.getElementById('kpiBitacoraUsuariosNota');
  if (notaUsuarios) notaUsuarios.textContent = total > (registros?.length || 0)
    ? 'Usuarios distintos en los 100 accesos más recientes (muestra)'
    : 'Usuarios distintos en todos los accesos filtrados';
  const ultimaFecha = registros?.[0]?.creado_en ? new Date(registros[0].creado_en) : null;
  actualizarIndicador('kpiBitacoraUltimo', ultimaFecha && !Number.isNaN(ultimaFecha.getTime())
    ? ultimaFecha.toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : 'Sin ingresos');
  if (resumen) resumen.textContent = (cuentasOcultas.length ? 'Cuentas ocultas: ' + cuentasOcultas.join(', ') + '. ' : 'Vista completa · sin cuentas ocultas. ') +
    total.toLocaleString('es-CL') + ' accesos en el período; mostrando hasta 100 registros recientes. Los datos históricos permanecen intactos.';
  if (!registros?.length) {
    estado(cuentasOcultas.length ? 'No hay accesos de usuarios para los filtros seleccionados. Los accesos ocultos se conservan en el historial.' : 'No hay ingresos registrados para el criterio seleccionado.');
    return;
  }
  tbody.replaceChildren();
  registros.forEach(r => {
    const tr = tbody.insertRow();
    const d = new Date(r.creado_en);
    const fecha = tr.insertCell();
    fecha.textContent = Number.isNaN(d.getTime()) ? 'Fecha no disponible' : d.toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'medium' });
    tr.insertCell().textContent = r.nombre || 'Hermano';
    tr.insertCell().textContent = r.email || '—';
    tr.insertCell().textContent = r.ip_origen || '—';
  });
}

/* ==========================================================================
   CÁMARA INTERACTIVA PRESENCIAL
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
  if (p) p.classList.toggle('hidden');
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
   GESTIÓN DIRECTA DE TRABAJOS
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
   MATRIZ DE AVANCE
   ========================================================================== */
async function cargarMetricasAvance(moduloId) {
  const tbody = document.getElementById('tablaMetricasBody');
  tbody.innerHTML = `<tr><td colspan="6" class="td-loading">Consultando registros...</td></tr>`;

  const { data: usuarios } = await sbApp
    .from('usuarios')
    .select('id, nombre, email')
    .order('nombre', { ascending: true });

  const { data: progresos } = await sbApp
    .from('progreso_maestro')
    .select('*')
    .eq('modulo_id', moduloId);

  tbody.innerHTML = "";

  if (!usuarios || usuarios.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); font-style: italic;">No hay usuarios registrados en el padrón.</td></tr>`;
    return;
  }

  const progMap = {};
  if (progresos) progresos.forEach(p => { progMap[p.usuario_id] = p; });

  usuarios.forEach(u => {
    const p = progMap[u.id];
    const leido = (p && p.leido);
    const completado = (p && p.completado);
    const preguntas = (p && p.intentos_preguntas !== undefined) ? `${p.intentos_preguntas}/8` : '—';
    const reflexion = (p && p.reflexion) ? `"${p.reflexion.slice(0, 70)}..."` : '—';
    const fecha = (p && p.completado_en) 
      ? new Date(p.completado_en).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) 
      : '—';

    const pId = p ? p.id : '';
    const nombreEscapado = (u.nombre || '').replace(/'/g, "\\'");

    tbody.innerHTML += `
      <tr>
        <td>
          <a href="javascript:void(0)" onclick="abrirModalMisAvances('${u.id}')" style="font-weight: 600; color: var(--primary);">
            ${u.nombre || 'Hermano'}
          </a>
        </td>
        <td>${leido ? '<span style="color: var(--success); font-weight: 600;">✓ Leído</span>' : '<span style="color: var(--text-muted);">Pendiente</span>'}</td>
        <td>${completado ? '<span style="color: var(--success); font-weight: 600;">8/8 ✓</span>' : preguntas}</td>
        <td style="font-size: 0.82rem; font-style: italic;">${reflexion}</td>
        <td>${fecha}</td>
        <td>
          <button class="admin-link-btn" onclick="abrirModalParametrosHermano('${pId}', '${u.id}', '${moduloId}', '${nombreEscapado}')">⚙️ Modificar</button>
        </td>
      </tr>
    `;
  });
}

function recargarMetricasActuales() {
  const sel = document.getElementById('selectMetricasModulo');
  if (sel) cargarMetricasAvance(sel.value);
}

function abrirModalParametrosHermano(progresoId, usuarioId, moduloId, nombreHermano) {
  document.getElementById('subParamHermano').innerText = `Modificando avance para: ${nombreHermano}`;
  document.getElementById('paramProgresoId').value = progresoId || '';
  document.getElementById('paramUsuarioId').value = usuarioId;
  document.getElementById('paramModuloId').value = moduloId;

  const prog = misProgresos[moduloId];
  if (prog && prog.usuario_id === usuarioId) {
    document.getElementById('paramLeido').value = prog.leido ? 'true' : 'false';
    document.getElementById('paramIntentos').value = prog.intentos_preguntas || 0;
    document.getElementById('paramReflexion').value = prog.reflexion || '';
    if (prog.completado_en) {
      document.getElementById('paramFecha').value = new Date(prog.completado_en).toISOString().slice(0, 16);
    }
  } else {
    document.getElementById('paramLeido').value = 'false';
    document.getElementById('paramIntentos').value = 0;
    document.getElementById('paramReflexion').value = '';
    document.getElementById('paramFecha').value = '';
  }

  document.getElementById('modalParametrosHermano').classList.remove('hidden');
}

async function guardarParametrosHermanoBD() {
  const progresoId = document.getElementById('paramProgresoId').value;
  const usuarioId = document.getElementById('paramUsuarioId').value;
  const moduloId = document.getElementById('paramModuloId').value;
  const leido = document.getElementById('paramLeido').value === 'true';
  const intentos = parseInt(document.getElementById('paramIntentos').value) || 0;
  const reflexion = document.getElementById('paramReflexion').value.trim();
  const fechaInput = document.getElementById('paramFecha').value;
  const completado = (intentos >= 8 && reflexion.length >= 15);

  const payload = {
    usuario_id: usuarioId,
    modulo_id: moduloId,
    leido: leido,
    intentos_preguntas: intentos,
    reflexion: reflexion,
    completado: completado,
    completado_en: fechaInput ? new Date(fechaInput).toISOString() : (completado ? new Date().toISOString() : null)
  };

  try {
    if (progresoId) {
      await sbApp.from('progreso_maestro').update(payload).eq('id', progresoId);
    } else {
      await sbApp.from('progreso_maestro').insert(payload);
    }
    alert("Parámetros actualizados exitosamente.");
    cerrarModalUniversalDirecto('modalParametrosHermano');
    recargarMetricasActuales();
  } catch (err) {
    alert("Error al actualizar: " + err.message);
  }
}

async function exportarRespaldoCompletoJSON() {
  // Solo interfaz temporal; el backend debe verificar identidad autorizada.
  if (!usuarioActual?.es_admin) return;
  try {
    const { data: usuarios } = await sbApp.from('usuarios').select('id,nombre,email,es_admin,terminos_aceptados,creado_en,debe_cambiar_clave');
    const { data: modulos } = await sbApp.from('modulos').select('*');
    const { data: progresos } = await sbApp.from('progreso_maestro').select('*');
    const { data: comentarios } = await sbApp.from('comentarios_muro').select('*');
    if (!usuarioActual?.es_admin) return;

    const backup = {
      timestamp: new Date().toISOString(),
      usuarios,
      modulos,
      progresos,
      comentarios
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `Backup_Camara_Docencia_${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchor.click();
    dlAnchor.remove();
  } catch (ex) {
    alert("Error al generar respaldo: " + ex.message);
  }
}

/* ==========================================================================
   MURO GENERAL ADMIN
   ========================================================================== */
async function cargarMuroGeneralAdmin() {
  if (!usuarioActual?.es_admin) return;
  const cont = document.getElementById('contenedorMuroGeneralAdmin');
  if (!cont) return;
  cont.replaceChildren();
  const inicio = document.createElement('p');
  inicio.className = 'td-loading';
  inicio.textContent = 'Cargando muro general...';
  cont.appendChild(inicio);
  const fecha = document.getElementById('muroAdminFechaEmision');
  if (fecha) fecha.textContent = 'EMISIÓN: ' + new Date().toLocaleDateString('es-CL');
  const { data: reflexiones, error } = await sbApp
    .from('progreso_maestro')
    .select('*, usuarios(nombre), modulos(numero_orden, titulo)')
    .eq('completado', true)
    .not('reflexion', 'is', null)
    .order('completado_en', { ascending: false });
  if (!usuarioActual?.es_admin) return;
  cont.replaceChildren();
  if (error || !reflexiones?.length) {
    const vacio = document.createElement('p');
    vacio.className = 'text-instruccion';
    vacio.textContent = error ? 'No fue posible obtener las reflexiones.' : 'No hay reflexiones consagradas.';
    cont.appendChild(vacio);
    return;
  }
  reflexiones.forEach(r => {
    const articulo = document.createElement('article');
    articulo.className = 'reflexion-item';
    articulo.style.marginBottom = '16px';
    const cabecera = document.createElement('div');
    cabecera.className = 'muro-admin-fila';
    const titulo = document.createElement('strong');
    titulo.textContent = 'Trabajo ' + (r.modulos?.numero_orden ?? '—') +
      ': ' + (r.modulos?.titulo || 'Trazado');
    const emitido = document.createElement('span');
    emitido.className = 'muro-admin-fecha';
    emitido.textContent = r.completado_en
      ? new Date(r.completado_en).toLocaleDateString('es-CL') : '';
    cabecera.append(titulo, emitido);
    articulo.appendChild(cabecera);
    const texto = document.createElement('p');
    texto.className = 'muro-admin-reflexion';
    texto.textContent = '"' + (r.reflexion || '') + '"';
    articulo.appendChild(texto);
    const autor = document.createElement('span');
    autor.className = 'reflexion-autor';
    autor.textContent = 'Q.·.H.·. ' + (r.usuarios?.nombre || 'Hermano');
    articulo.appendChild(autor);
    cont.appendChild(articulo);
  });
}

function imprimirMuroGeneralPDF() {
  const original = document.getElementById('documentoMuroGeneralImprimible');
  const ventanaPrint = window.open('', '_blank', 'width=850,height=1100');
  ventanaPrint.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Muro_General_Reflexiones</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        @page { size: letter portrait; margin: 12mm 15mm; }
        body { margin: 0; padding: 0; font-family: 'Inter', system-ui, sans-serif; color: #1A202C; background: #FFFFFF; }
        .reflexion-item { border-left: 3px solid #152433; padding: 10px 14px; margin-bottom: 12px; }
        .reflexion-autor { font-size: 8pt; font-weight: 700; color: #785C25; }
      </style>
    </head>
    <body>
      ${original.innerHTML}
      <script>
        window.onload = function() {
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
   EDITOR DE DOCTRINA ADMIN
   ========================================================================== */
let secuenciaEditorDoctrina = 0;

function crearTarjetaEditorDoctrina(bloque, numero) {
  const id = ++secuenciaEditorDoctrina;
  const card = document.createElement('div');
  card.className = 'bloque-doctrina-card';
  card.id = 'bloque_doc_' + id;
  const header = document.createElement('div');
  header.className = 'bloque-doctrina-header';
  const encabezado = document.createElement('strong');
  encabezado.textContent = numero ? 'Bloque N° ' + numero : 'Nuevo Bloque';
  header.appendChild(encabezado);
  const eliminar = document.createElement('button');
  eliminar.type = 'button';
  eliminar.className = 'admin-link-btn admin-action-delete';
  eliminar.textContent = 'Eliminar';
  eliminar.addEventListener('click', () => card.remove());
  header.appendChild(eliminar);
  card.appendChild(header);
  const campo = (titulo, clase, contenido, multilinea) => {
    const grupo = document.createElement('div');
    grupo.className = 'form-group';
    const etiqueta = document.createElement('label');
    etiqueta.textContent = titulo + ':';
    etiqueta.htmlFor = 'doc_' + clase + '_' + id;
    const input = document.createElement(multilinea ? 'textarea' : 'input');
    input.id = etiqueta.htmlFor;
    input.className = 'doctrina-edit-' + clase;
    if (multilinea) input.rows = 4;
    else input.type = 'text';
    input.value = String(contenido ?? '');
    grupo.append(etiqueta, input);
    card.appendChild(grupo);
  };
  campo('Título', 'titulo', bloque.titulo || '', false);
  campo('Subtítulo', 'subtitulo', bloque.subtitulo || '', false);
  campo('Texto', 'texto', bloque.texto || '', true);
  return card;
}

async function cargarEditorDoctrinaAdmin() {
  if (!usuarioActual?.es_admin) return;
  const cont = document.getElementById('contenedorEditorDoctrinaAdmin');
  if (!cont) return;
  cont.replaceChildren();
  const espera = document.createElement('p');
  espera.className = 'td-loading';
  espera.textContent = 'Cargando docencia institucional...';
  cont.appendChild(espera);
  const bloques = await obtenerDoctrinaBD();
  if (!usuarioActual?.es_admin) return;
  cont.replaceChildren();
  (bloques || []).forEach((b, idx) => cont.appendChild(crearTarjetaEditorDoctrina(b, idx + 1)));
}

function agregarBloqueDoctrinaAdmin() {
  if (!usuarioActual?.es_admin) return;
  const cont = document.getElementById('contenedorEditorDoctrinaAdmin');
  if (!cont) return;
  cont.appendChild(crearTarjetaEditorDoctrina({
    titulo: 'Nuevo Título', subtitulo: 'Nuevo Subtítulo',
    texto: 'Escriba aquí los fundamentos doctrinales...'
  }, null));
}

function eliminarBloqueDoctrinaAdmin(idx) {
  // Compatibilidad con llamadas anteriores; las nuevas tarjetas usan listener seguro.
  document.getElementById('bloque_doc_' + idx)?.remove();
}

async function guardarDoctrinaAdmin() {
  if (!usuarioActual?.es_admin) return;
  const cont = document.getElementById('contenedorEditorDoctrinaAdmin');
  if (!cont) return;
  const cards = cont.querySelectorAll('.bloque-doctrina-card');
  const bloques = [];
  cards.forEach(card => {
    const tit = card.querySelector('.doctrina-edit-titulo')?.value.trim();
    const sub = card.querySelector('.doctrina-edit-subtitulo')?.value.trim();
    const txt = card.querySelector('.doctrina-edit-texto')?.value.trim();
    if (tit && txt) bloques.push({ titulo: tit, subtitulo: sub || '', texto: txt });
  });
  const { error } = await sbApp
    .from('config_segura')
    .upsert({ clave: 'doctrina_docencia_maestros', valor: JSON.stringify(bloques) },
      { onConflict: 'clave' });
  if (error) {
    alert('No fue posible guardar la docencia institucional: ' + error.message);
  } else {
    alert('Docencia institucional actualizada.');
  }
}

/* ==========================================================================
   INICIALIZACIÓN AL CARGAR LA PÁGINA
   ========================================================================== */
window.addEventListener('DOMContentLoaded', () => {
  inicializarLuminosidad();
  verificarTokenUrl();
  recuperarSesionGuardada();
});
