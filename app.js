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

// Temporizador de inactividad (15 minutos)
let temporizadorInactividad = null;
const TIEMPO_INACTIVIDAD_MS = 15 * 60 * 1000;

function reiniciarTemporizadorInactividad() {
  if (temporizadorInactividad) clearTimeout(temporizadorInactividad);
  if (usuarioActual) {
    temporizadorInactividad = setTimeout(() => {
      alert("Por motivos de seguridad, la sesión se ha cerrado tras 15 minutos de inactividad.");
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
  if (!clave || clave.length < 8) {
    return "La contraseña debe tener al menos 8 caracteres en total.";
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
  // Generador criptográfico del navegador; Math.random no es apto para claves.
  const letras = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const numeros = '23456789';
  const simbolos = '!@#$%*?';
  const caracteres = letras + numeros + simbolos;
  const elegir = grupo => {
    const limite = 256 - (256 % grupo.length);
    const buffer = new Uint8Array(1);
    do { crypto.getRandomValues(buffer); } while (buffer[0] >= limite);
    return grupo[buffer[0] % grupo.length];
  };
  const clave = [elegir(letras), elegir(numeros), elegir(simbolos)];
  while (clave.length < 12) clave.push(elegir(caracteres));
  for (let i = clave.length - 1; i > 0; i--) {
    const limite = 256 - (256 % (i + 1));
    const buffer = new Uint8Array(1);
    do { crypto.getRandomValues(buffer); } while (buffer[0] >= limite);
    const j = buffer[0] % (i + 1);
    [clave[i], clave[j]] = [clave[j], clave[i]];
  }
  return clave.join('');
}

function alternarVisibilidadClaveLogin() {
  const input = document.getElementById('inputClave');
  const btn = document.getElementById('btnToggleVerClave');
  if (!input || !btn) return;
  const visible = input.type === 'password';
  input.type = visible ? 'text' : 'password';
  btn.textContent = visible ? '🙈' : '👁️';
  btn.title = visible ? 'Ocultar contraseña' : 'Mostrar contraseña';
  btn.setAttribute('aria-label', btn.title);
  btn.setAttribute('aria-pressed', String(visible));
}

/* ==========================================================================
   AUTENTICACIÓN Y ENTORNO
   ========================================================================== */
function mensajeErrorServicio(error, contexto = 'operación') {
  const estado = Number(error?.status || error?.statusCode || 0);
  const codigo = String(error?.code || '');
  if (typeof navigator !== 'undefined' && navigator.onLine === false)
    return 'Sin conexión a Internet. Compruebe su red y vuelva a intentar.';
  if (estado === 400 || estado === 401 || /invalid_credentials|invalid_grant/i.test(codigo))
    return 'Credenciales o solicitud no válidas. Revise los datos ingresados.';
  if (estado === 402)
    return 'Servicio temporalmente no disponible por una restricción de cuenta. Contacte al administrador.';
  if (estado === 403)
    return 'Acceso no autorizado para esta cuenta. Contacte al administrador.';
  if (estado === 404)
    return 'No se encontró el servicio solicitado. Contacte al administrador.';
  if (estado === 408 || estado === 504)
    return 'La conexión tardó demasiado. Vuelva a intentar.';
  if (estado === 409)
    return 'La información cambió durante la operación. Actualice y vuelva a intentar.';
  if (estado === 429)
    return 'Demasiados intentos. Espere unos minutos antes de volver a intentar.';
  if (estado >= 500 || /fetch|network|timeout/i.test(String(error?.message || '')))
    return 'Servicio temporalmente no disponible. Intente nuevamente más tarde.';
  return 'No fue posible completar la ' + contexto + '. Intente nuevamente.';
}

async function iniciarSesion() {
  const email = document.getElementById('inputEmail').value.trim().toLowerCase();
  const clave = document.getElementById('inputClave').value;
  const err = document.getElementById('errorLogin');

  if (!email || !clave) {
    err.innerText = "Por favor ingrese su correo y contraseña.";
    return;
  }

  err.innerText = "Verificando credenciales...";

  try {
    const { data, error } = await sbApp.auth.signInWithPassword({ email, password: clave });

    if (error) {
      err.innerText = mensajeErrorServicio(error, 'autenticación');
      console.error('Error de autenticación:', error.code || 'sin código');
      return;
    }
    if (!data?.user) {
      err.innerText = "Correo o contraseña no válidos.";
      return;
    }

    const { data: perfil, error: errorPerfil } = await sbApp.from('usuarios')
      .select('id,nombre,email,es_admin,debe_cambiar_clave')
      .eq('auth_user_id', data.user.id).maybeSingle();
    if (errorPerfil || !perfil) {
      await sbApp.auth.signOut();
      err.innerText = 'Perfil no disponible. Contacte al administrador.';
      return;
    }
    usuarioActual = perfil;
    sessionStorage.setItem('camara_usuario_sesion', JSON.stringify(usuarioActual));

    err.innerText = "";
    registrarIngresoAuditoria(usuarioActual);
    configurarEntornoUsuario();
  } catch (ex) {
    err.innerText = mensajeErrorServicio(ex, 'autenticación');
  }
}

async function registrarIngresoAuditoria() {
  // La identidad y fecha se determinan exclusivamente en el servidor.
  const { error } = await sbApp.rpc('registrar_acceso_autenticado');
  if (error) console.warn('No fue posible registrar el acceso:', error.code || 'sin código');
}

async function recuperarSesionGuardada() {
  const { data, error } = await sbApp.auth.getUser();
  if (error || !data?.user) {
    sessionStorage.removeItem('camara_usuario_sesion');
    return;
  }
  const { data: perfil, error: perfilError } = await sbApp.from('usuarios')
    .select('id,nombre,email,es_admin,debe_cambiar_clave')
    .eq('auth_user_id', data.user.id).maybeSingle();
  if (perfilError || !perfil) {
    sessionStorage.removeItem('camara_usuario_sesion');
    return;
  }
  usuarioActual = perfil;
  sessionStorage.setItem('camara_usuario_sesion', JSON.stringify(perfil));
  configurarEntornoUsuario();
}

function configurarEntornoUsuario() {
  reiniciarTemporizadorInactividad();
  document.getElementById('seccionLogin').classList.add('hidden');
  document.getElementById('btnSalir').classList.remove('hidden');
  document.getElementById('btnCambiarMiClave').classList.remove('hidden');

  if (usuarioActual.es_admin) {
    if (usuarioActual.debe_cambiar_clave) {
      document.getElementById('seccionAdmin').classList.add('hidden');
      document.getElementById('modalCambioClaveObligatorio').classList.remove('hidden');
      return;
    }
    document.getElementById('seccionAdmin').classList.remove('hidden');
    document.getElementById('seccionDocencia').classList.add('hidden');
    document.getElementById('seccionBienvenida').classList.add('hidden');
    document.getElementById('seccionCatalogoTrabajos').classList.add('hidden');
    document.getElementById('seccionDocenciaInstitucional').classList.add('hidden');
    document.getElementById('seccionMuroUsuarios').classList.add('hidden');
    cargarDatosAdmin();
    cambiarSubseccionAdmin('resumen');
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
  const c1 = document.getElementById('nuevaClaveInput').value;
  const c2 = document.getElementById('repetirClaveInput').value;
  const err = document.getElementById('errorCambioClave');

  if (c1 !== c2) {
    err.innerText = "Las contraseñas no coinciden.";
    return;
  }

  const falloSeguridad = validarSeguridadClave(c1);
  if (falloSeguridad) {
    err.innerText = falloSeguridad;
    return;
  }

  err.innerText = "Actualizando su contraseña...";

  try {
    const { error } = await sbApp.auth.updateUser({ password: c1 });

    if (error) {
      err.innerText = "Error: " + error.message;
      return;
    }

    // El indicador se actualiza mediante política de fila propia; nunca concede roles.
    const { data: authActual, error: authError } = await sbApp.auth.getUser();
    if (authError || !authActual?.user?.id) {
      err.innerText = 'Contraseña cambiada. No fue posible verificar la sesión; vuelva a iniciar sesión.';
      return;
    }
    const { data: perfilActualizado, error: flagError } = await sbApp.from('usuarios')
      .update({ debe_cambiar_clave: false })
      .eq('auth_user_id', authActual.user.id)
      .select('id,debe_cambiar_clave')
      .maybeSingle();
    if (flagError || !perfilActualizado || perfilActualizado.debe_cambiar_clave !== false) {
      err.innerText = 'Contraseña cambiada. No se pudo confirmar el indicador; contacte al administrador.';
      return;
    }
    usuarioActual.debe_cambiar_clave = false;
    sessionStorage.setItem('camara_usuario_sesion', JSON.stringify(usuarioActual));

    document.getElementById('modalCambioClaveObligatorio').classList.add('hidden');
    if (usuarioActual.es_admin) {
      configurarEntornoUsuario();
    } else {
      const nombreLimpio = usuarioActual.nombre.replace(/(Q[\.·\s]*H[\.·\s]*)+/gi, '').trim();
      document.getElementById('bienvenidaNombreQH').innerText = `Q.·.H.·. ${nombreLimpio}`;
      document.getElementById('seccionBienvenida').classList.remove('hidden');
    }
  } catch (ex) {
    err.innerText = "Error: " + ex.message;
  }
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
  void sbApp.auth.signOut();

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
  const p = generarClaveAleatoriaSegura();
  const input = document.getElementById('inputMiClaveNueva');
  input.value = p;
  navigator.clipboard.writeText(p);
  alert("Contraseña generada y copiada al portapapeles: " + p);
}

async function guardarMiNuevaClave() {
  const clave = document.getElementById('inputMiClaveNueva').value;
  const err = document.getElementById('errorMiCambioClave');
  const fallo = validarSeguridadClave(clave);
  if (fallo) {
    err.innerText = fallo;
    return;
  }

  err.innerText = "Guardando...";

  try {
    const { error } = await sbApp.auth.updateUser({ password: clave });

    if (error) {
      err.innerText = "Error: " + error.message;
    } else {
      alert("Contraseña actualizada con éxito.");
      cerrarModalUniversalDirecto('modalCambiarMiClave');
    }
  } catch (ex) {
    err.innerText = "Error: " + ex.message;
  }
}

/* ==========================================================================
   SUPERADMIN: MÓDULO ADMINISTRAR USUARIOS
   ========================================================================== */
async function cargarListadoUsuariosAdmin() {
  const tbody = document.getElementById('tablaUsuariosAdminBody');
  tbody.innerHTML = `<tr><td colspan="6" class="td-loading">Consultando padrón de usuarios...</td></tr>`;

  const { data: usuarios, error } = await sbApp
    .from('usuarios')
    .select('id, nombre, email, es_admin, debe_cambiar_clave, auth_user_id')
    .order('nombre', { ascending: true });

  tbody.innerHTML = '';

  if (error || !usuarios || usuarios.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); font-style: italic;">No se encontraron usuarios registrados.</td></tr>`;
    return;
  }

  const cuposOcupados = usuarios.filter(u => !u.es_admin &&
    String(u.email || '').trim().toLowerCase() !== 'dummy@ofl.cl').length;
  const botonAgregar = document.getElementById('btnAgregarUsuarioAdmin');
  if (botonAgregar) {
    botonAgregar.disabled = cuposOcupados >= 26;
    botonAgregar.title = cuposOcupados >= 26 ? 'Padrón completo: 26 integrantes' : 'Agregar integrante';
  }
  const estadoCupos = document.getElementById('adminCupoUsuarios');
  if (estadoCupos) estadoCupos.textContent = `${cuposOcupados}/26 integrantes`;

  usuarios.forEach(u => {
    const tr = document.createElement('tr');
    const celda = (texto, className = '') => {
      const td = document.createElement('td');
      if (className) td.className = className;
      td.textContent = texto;
      tr.appendChild(td);
      return td;
    };
    const nombre = celda(u.nombre || 'Hermano');
    nombre.style.fontWeight = '700';
    const correo = celda(u.email || '');
    correo.style.fontFamily = 'monospace';
    correo.style.fontSize = '0.88rem';
    celda(u.es_admin ? 'Superadmin' : 'Hermano');
    celda(u.debe_cambiar_clave ? 'Requiere cambio' : 'Al día');
    celda(u.auth_user_id ? 'Vinculado' : 'Pendiente de activación');
    celda('Administración protegida', 'admin-accion-pendiente');
    tbody.appendChild(tr);
  });
}

function abrirModalCrearUsuario() {
  if (!usuarioActual?.es_admin || document.getElementById('btnAgregarUsuarioAdmin')?.disabled) return;
  document.getElementById('modalAdminUsuarioTitulo').textContent = 'Agregar usuario al padrón';
  document.getElementById('adminUsuarioTargetId').value = '';
  document.getElementById('adminUsuarioNombre').value = '';
  document.getElementById('adminUsuarioEmail').value = '';
  document.getElementById('errorAdminUsuario').textContent = '';
  document.getElementById('modalAdminUsuario').classList.remove('hidden');
  document.getElementById('adminUsuarioNombre').focus();
}

async function guardarAdminUsuario() {
  const err = document.getElementById('errorAdminUsuario');
  const nombre = document.getElementById('adminUsuarioNombre').value.trim();
  const email = document.getElementById('adminUsuarioEmail').value.trim().toLowerCase();
  if (!usuarioActual?.es_admin) return;
  if (nombre.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    err.textContent = 'Ingrese un nombre y un correo electrónico válido.';
    return;
  }
  const { data: sessionData, error: sessionError } = await sbApp.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (sessionError || !token) { err.textContent = 'Sesión vencida. Vuelva a iniciar sesión.'; return; }
  const button = document.querySelector('#modalAdminUsuario button[onclick="guardarAdminUsuario()"]');
  if (button) button.disabled = true;
  err.textContent = 'Registrando usuario...';
  try {
    const response = await fetch('/api/admin-usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ action: 'crear', nombre, email })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      err.textContent = result.error || 'No se pudo registrar el usuario.';
      return;
    }
    document.getElementById('modalAdminUsuario').classList.add('hidden');
    await cargarListadoUsuariosAdmin();
    alert('Usuario incorporado al padrón. No se envió invitación ni se asignó contraseña.');
  } catch {
    err.textContent = 'No fue posible conectar con el servicio de administración.';
  } finally {
    if (button) button.disabled = false;
  }
}

function confirmarEliminarUsuario() {
  alert('Eliminación temporalmente deshabilitada para proteger las identidades y el historial docente.');
}

function abrirModalAdminClaveHermano(targetId, nombreHermano) {
  document.getElementById('adminTargetHermanoId').value = targetId;
  document.getElementById('adminHermanoNombreSpan').innerText = nombreHermano;
  document.getElementById('inputAdminClaveHermano').value = '';
  document.getElementById('chkForzarCambioAdmin').checked = true;
  document.getElementById('errorAdminClaveHermano').innerText = '';
  document.getElementById('modalAdminClaveHermano').classList.remove('hidden');
}

function autogenerarAdminClaveHermano() {
  const p = generarClaveAleatoriaSegura();
  const input = document.getElementById('inputAdminClaveHermano');
  input.value = p;
  navigator.clipboard.writeText(p);
  alert("Contraseña copiada al portapapeles: " + p);
}

async function guardarAdminClaveHermano() {
  document.getElementById('errorAdminClaveHermano').innerText =
    'Cambio administrativo de contraseña no disponible hasta integrar Supabase Auth. Utilice la recuperación individual verificada.';
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
  const statusMsg = document.getElementById('recuperarStatusMsg');
  const email = document.getElementById('recuperarEmailInput').value.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    statusMsg.textContent = 'Ingrese un correo electrónico válido.';
    return;
  }
  statusMsg.textContent = 'Enviando solicitud...';
  try {
    const { error } = await sbApp.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/recuperar.html'
    });
    if (error) {
      statusMsg.textContent = 'No fue posible enviar la solicitud. Inténtelo más tarde.';
      return;
    }
    statusMsg.textContent = 'Solicitud recibida. Si su cuenta está habilitada, recibirá un enlace de recuperación. Revise también el correo no deseado.';
  } catch {
    statusMsg.textContent = 'Servicio temporalmente no disponible.';
  }
}

function verificarTokenUrl() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (token) {
    tokenRecuperacionActivo = token;
    document.getElementById('modalResetearConToken').classList.remove('hidden');
  }
}

async function guardarResetConToken() {
  const c1 = document.getElementById('tokenNuevaClave').value;
  const c2 = document.getElementById('tokenRepetirClave').value;
  const err = document.getElementById('errorResetToken');

  if (c1 !== c2) {
    err.innerText = "Las contraseñas no coinciden.";
    return;
  }

  const falloSeguridad = validarSeguridadClave(c1);
  if (falloSeguridad) {
    err.innerText = falloSeguridad;
    return;
  }

  err.innerText = "Restableciendo contraseña...";

  try {
    const { error } = await sbApp.rpc('resetear_clave_con_token', {
      p_token: tokenRecuperacionActivo,
      p_nueva_clave: c1
    });

    if (error) {
      err.innerText = "Error: " + error.message;
      return;
    }

    alert("Contraseña restablecida con éxito. Ingrese con sus nuevas credenciales.");
    window.history.replaceState({}, document.title, window.location.pathname);
    document.getElementById('modalResetearConToken').classList.add('hidden');
    tokenRecuperacionActivo = null;
  } catch (ex) {
    err.innerText = "Error: " + ex.message;
  }
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

// Catálogo de unidades facilitado por Superadmin.
// No asigna códigos por parecido de títulos: solo usa vínculos guardados en DB.
async function consultarUnidadesDocencia() {
  const { data, error } = await sbApp
    .from('unidades_docencia')
    .select('codigo,detalle,orden,activo')
    .eq('activo', true)
    .order('orden', { ascending: true })
    .order('codigo', { ascending: true });
  if (error) {
    console.warn('No se pudo leer el catálogo de unidades:', error.message);
    return null;
  }
  return Array.isArray(data) ? data : [];
}

function escaparTextoHTMLDocencia(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[caracter]);
}

// Jerarquía del plan oficial: DOC100 = unidad, DOC110 = subunidad,
// DOC11A = tema. DOC2A0 y DOC2A1 se interpretan igual, sin depender
// de que el cuarto carácter del código sea numérico.
function tipoUnidadDocencia(codigo) {
  const valor = String(codigo || '').toUpperCase();
  if (/^DOC[0-9]00$/.test(valor)) return 'unidad';
  if (/^DOC[0-9][0-9A-Z]0$/.test(valor)) return 'subunidad';
  return 'tema';
}

// Catálogo visual: unidades, subunidades y fichas de temas (no una lista plana).
// Cada vínculo surge de unidad_codigo de un trabajo activo en Supabase.
function construirDirectorioUnidadesDocencia(unidades, trabajos) {
  if (!Array.isArray(unidades) || !unidades.length) return '';

  const ordenadas = [...unidades].sort((a,b) => Number(a.orden) - Number(b.orden));
  const codigosValidos = new Set(ordenadas.map(x => String(x.codigo)));
  const porCodigo = new Map();
  for (const trabajo of Array.isArray(trabajos) ? trabajos : []) {
    const codigo = String(trabajo.unidad_codigo || '');
    if (!codigosValidos.has(codigo)) continue;
    if (!porCodigo.has(codigo)) porCodigo.set(codigo, []);
    porCodigo.get(codigo).push(trabajo);
  }
  for (const items of porCodigo.values()) {
    items.sort((a,b) => Number(a.numero_orden) - Number(b.numero_orden));
  }

  const escapar = escaparTextoHTMLDocencia;
  const asociados = codigo => porCodigo.get(codigo) || [];
  const total = n => n + (n === 1 ? ' trabajo disponible' : ' trabajos disponibles');
  const tarjetaTrabajo = trabajo =>
    '<button class="docencia-tarjeta-trabajo" type="button" data-modulo-id="' +
      escapar(trabajo.id) + '">' +
      '<span class="docencia-trabajo-numero">Trabajo N.º ' + escapar(trabajo.numero_orden) + '</span>' +
      '<strong>' + escapar(trabajo.titulo) + '</strong>' +
      '<span class="docencia-trabajo-acceso">Abrir trabajo <span aria-hidden="true">↗</span></span>' +
    '</button>';

  const tarjetasAsociadas = codigo => {
    const publicados = asociados(codigo);
    if (!publicados.length) return '';
    return '<div class="docencia-grid-trabajos">' +
      publicados.map(tarjetaTrabajo).join('') + '</div>';
  };

  const tarjetaTema = tema => {
    const publicados = asociados(tema.codigo);
    const etiqueta = '<span class="docencia-tema-codigo">' + escapar(tema.codigo) + '</span>';
    let cuerpo;
    if (publicados.length === 1) {
      // Solo un tema publicado es negrita y botón hacia su trabajo.
      cuerpo = '<button type="button" class="docencia-tema-enlace" data-modulo-id="' +
        escapar(publicados[0].id) + '">' +
        '<strong class="docencia-tema-titulo">' + escapar(tema.detalle) + '</strong>' +
        '<span class="docencia-tema-acceso">Ver trabajo <span aria-hidden="true">↗</span></span>' +
        '</button>';
    } else if (publicados.length > 1) {
      cuerpo = '<strong class="docencia-tema-titulo">' + escapar(tema.detalle) + '</strong>' +
        tarjetasAsociadas(tema.codigo);
    } else {
      cuerpo = '<span class="docencia-tema-titulo">' + escapar(tema.detalle) + '</span>' +
        '<span class="docencia-tema-pendiente">Aún sin trabajo</span>';
    }
    return '<article class="docencia-tarjeta-tema ' +
      (publicados.length ? 'disponible' : 'pendiente') +
      '" data-codigo-docencia="' + escapar(tema.codigo) + '" tabindex="-1">' +
      etiqueta + cuerpo + '</article>';
  };

  const raices = ordenadas.filter(x => tipoUnidadDocencia(x.codigo) === 'unidad');
  return raices.map((unidad,i) => {
    const prefijo = unidad.codigo.slice(0,4);
    const subunidades = ordenadas.filter(x =>
      tipoUnidadDocencia(x.codigo) === 'subunidad' && x.codigo.slice(0,4) === prefijo);

    const subTarjetas = subunidades.map(sub => {
      const temas = ordenadas.filter(x => tipoUnidadDocencia(x.codigo) === 'tema' &&
        x.codigo.slice(0,5) + '0' === sub.codigo);
      const cantidad = asociados(sub.codigo).length +
        temas.reduce((n,x) => n + asociados(x.codigo).length,0);

      return '<details class="catalogo-subunidad docencia-tarjeta-subunidad" ' +
        'data-codigo-docencia="' + escapar(sub.codigo) + '" ' + (cantidad ? 'open' : '') + '>' +
        '<summary class="catalogo-subunidad-titulo">' +
          '<span class="catalogo-subunidad-codigo">' + escapar(sub.codigo) + '</span>' +
          '<strong>' + escapar(sub.detalle) + '</strong>' +
          '<span class="catalogo-unidad-total">' + total(cantidad) + '</span>' +
          '<span class="catalogo-plegable-icono" aria-hidden="true">⌄</span>' +
        '</summary>' +
        '<div class="catalogo-subunidad-contenido">' +
          tarjetasAsociadas(sub.codigo) +
          '<div class="docencia-grid-temas">' + temas.map(tarjetaTema).join('') + '</div>' +
        '</div></details>';
    }).join('');

    const cantidadUnidad = asociados(unidad.codigo).length +
      subunidades.reduce((n,sub) => {
        const temas = ordenadas.filter(x => tipoUnidadDocencia(x.codigo) === 'tema' &&
          x.codigo.slice(0,5) + '0' === sub.codigo);
        return n + asociados(sub.codigo).length +
          temas.reduce((total,x) => total + asociados(x.codigo).length,0);
      },0);

    return '<details class="catalogo-unidad-grupo docencia-tarjeta-unidad" ' +
      'data-codigo-docencia="' + escapar(unidad.codigo) + '" ' + (i === 0 ? 'open' : '') + '>' +
      '<summary class="catalogo-unidad-titulo">' +
        '<span class="catalogo-unidad-codigo">' + escapar(unidad.codigo) + '</span>' +
        '<strong>' + escapar(unidad.detalle) + '</strong>' +
        '<span class="catalogo-unidad-total">' + total(cantidadUnidad) + '</span>' +
        '<span class="catalogo-plegable-icono" aria-hidden="true">⌄</span>' +
      '</summary>' +
      '<div class="catalogo-unidad-contenido">' + tarjetasAsociadas(unidad.codigo) +
        '<div class="docencia-grid-subunidades">' + subTarjetas + '</div>' +
      '</div></details>';
  }).join('');
}

function renderizarDirectorioUnidadesDocencia(unidades, trabajos) {
  const seccion = document.getElementById('catalogoDirectorioUnidades');
  const contenedor = document.getElementById('catalogoUnidadesContenido');
  if (!seccion || !contenedor) return;
  if (!Array.isArray(unidades) || !unidades.length) {
    contenedor.replaceChildren();
    seccion.classList.add('hidden');
    return;
  }
  contenedor.innerHTML = construirDirectorioUnidadesDocencia(unidades, trabajos);
  seccion.classList.remove('hidden');
  // Delegación: solo IDs ya cargados en el catálogo permiten abrir un trabajo.
  contenedor.onclick = evento => {
    const boton = evento.target.closest('button[data-modulo-id]');
    if (!boton || !contenedor.contains(boton)) return;
    const id = boton.dataset.moduloId;
    if (listaModulos.some(mod => mod.id === id)) entrarADocenciaConModulo(id);
  };
}

// La tarjeta muestra el código del trabajo, la unidad matriz y su subunidad.
// La relación se resuelve por los códigos oficiales: DOC12B -> DOC100 / DOC120.
function construirClasificacionTarjetaDocencia(codigoAsignado, unidadesPorCodigo) {
  const codigo = String(codigoAsignado || '').trim().toUpperCase();
  if (!codigo || !unidadesPorCodigo.has(codigo)) return '';

  const tipo = tipoUnidadDocencia(codigo);
  const codigoUnidad = codigo.slice(0, 4) + '00';
  const codigoSubunidad = tipo === 'unidad' ? null : codigo.slice(0, 5) + '0';
  const unidad = unidadesPorCodigo.get(codigoUnidad);
  const subunidad = codigoSubunidad ? unidadesPorCodigo.get(codigoSubunidad) : null;

  // No deducir un nombre de unidad si el catálogo está incompleto.
  if (!unidad || (codigoSubunidad && !subunidad)) return '';

  const escapar = escaparTextoHTMLDocencia;
  return '<div class="grid-card-unidad">' +
    '<div class="grid-card-linea-unidad">' +
      '<strong class="grid-card-unidad-nombre">' + escapar(unidad.detalle) + '</strong>' +
    '</div>' +
    (subunidad
      ? '<div class="grid-card-subunidad">' + escapar(subunidad.detalle) + '</div>'
      : '') +
    '<button type="button" class="grid-card-codigo-enlace" data-codigo-docencia="' +
      escapar(codigo) + '" aria-label="Ver código ' + escapar(codigo) +
      ' en el programa de Docencia">' + escapar(codigo) +
      '<span aria-hidden="true"> ↗</span></button>' +
  '</div>';
}

// El código de la tarjeta conduce al programa docente, no al lector del trabajo.
// Abre su unidad/subunidad, enfoca la tarjeta del tema y desplaza a esa sección.
function abrirProgramaDocencia(codigoSolicitado) {
  const codigo = String(codigoSolicitado || '').trim().toUpperCase();
  if (!/^DOC[0-9A-Z]{3}$/.test(codigo)) return;

  const seccion = document.getElementById('catalogoDirectorioUnidades');
  const contenido = document.getElementById('catalogoUnidadesContenido');
  if (!seccion || !contenido || seccion.classList.contains('hidden')) return;

  contenido.querySelectorAll('.docencia-enfoque')
    .forEach(elemento => elemento.classList.remove('docencia-enfoque'));

  const codigoUnidad = codigo.slice(0,4) + '00';
  const codigoSub = tipoUnidadDocencia(codigo) === 'unidad'
    ? null : codigo.slice(0,5) + '0';
  const buscar = (clase,valor) =>
    contenido.querySelector('.' + clase + '[data-codigo-docencia="' + valor + '"]');
  const unidad = buscar('docencia-tarjeta-unidad',codigoUnidad);
  const subunidad = codigoSub ? buscar('docencia-tarjeta-subunidad',codigoSub) : null;
  if (unidad) unidad.open = true;
  if (subunidad) subunidad.open = true;

  const destino = buscar('docencia-tarjeta-tema',codigo) ||
    buscar('docencia-tarjeta-subunidad',codigo) ||
    buscar('docencia-tarjeta-unidad',codigo) || unidad || seccion;
  destino.classList.add('docencia-enfoque');
  if (!destino.hasAttribute('tabindex')) destino.setAttribute('tabindex','-1');
  destino.scrollIntoView({behavior:'smooth',block:'center'});
  destino.focus({preventScroll:true});
}

async function renderizarCatalogoTrabajos() {
  const { data: dataModulos, error } = await sbApp
    .from('modulos')
    .select('*')
    .eq('activo', true)
    .order('numero_orden', { ascending: false });

  if (error || !dataModulos) return;

  await refrescarProgresosUsuario();
  const unidades = await consultarUnidadesDocencia();
  const unidadesPorCodigo = new Map((unidades || []).map(u => [u.codigo, u]));

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
  grid.onclick = event => {
    const boton = event.target.closest('button[data-codigo-docencia]');
    if (!boton || !grid.contains(boton)) return;
    abrirProgramaDocencia(boton.dataset.codigoDocencia);
  };

  listaModulos.forEach(m => {
    const prog = misProgresos[m.id];
    let badgeHtml = `<span class="badge-estado badge-pen">Pendiente</span>`;
    if (prog && prog.completado) {
      badgeHtml = `<span class="badge-estado badge-ok">✓ Completado</span>`;
    } else if (prog && prog.leido) {
      badgeHtml = `<span class="badge-estado" style="background:#FEF3C7;color:#92400E;">En Curso</span>`;
    }

    const bloqueUnidad = construirClasificacionTarjetaDocencia(m.unidad_codigo, unidadesPorCodigo);

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
          ${bloqueUnidad}
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

  renderizarDirectorioUnidadesDocencia(unidades, listaModulos);
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
  ['seccionBienvenida', 'seccionCatalogoTrabajos', 'seccionDocencia', 'seccionMuroUsuarios']
    .forEach(id => document.getElementById(id)?.classList.add('hidden'));

  const seccion = document.getElementById('seccionDocenciaInstitucional');
  const cont = document.getElementById('contenidoInstitucionalDocencia');
  const indice = document.getElementById('espacioIndice');
  if (!seccion || !cont || !indice) return;

  seccion.classList.remove('hidden');
  cont.innerHTML = "<p class='td-loading'>Consultando contenidos…</p>";
  indice.innerHTML = "<p>Preparando índice…</p>";

  // Los textos siguen siendo los bloques configurados por el Superadmin.
  // Solo cambia la presentación y se genera el índice con títulos reales.
  const respuesta = await obtenerDoctrinaBD();
  const bloques = Array.isArray(respuesta)
    ? respuesta.filter(b => b && typeof b === 'object' && !Array.isArray(b))
    : [];
  const visibles = bloques.length ? bloques : DOCTRINA_DEFAULT;
  cont.replaceChildren();
  indice.replaceChildren();

  visibles.forEach((b, i) => {
    const id = 'espacio-bloque-' + (i + 1);
    const titulo = String(b.titulo || 'Fundamento ' + (i + 1));
    const card = document.createElement('section');
    card.id = id;
    card.className = 'institucional-bloque espacio-bloque';
    card.tabIndex = -1;
    card.setAttribute('aria-labelledby', id + '-titulo');

    const numero = document.createElement('span');
    numero.className = 'espacio-bloque-numero';
    numero.textContent = String(i + 1).padStart(2, '0');
    numero.setAttribute('aria-hidden', 'true');

    const title = document.createElement('h3');
    title.id = id + '-titulo';
    title.textContent = titulo;
    const subtitle = document.createElement('h4');
    subtitle.textContent = String(b.subtitulo || '');
    const paragraph = document.createElement('p');
    paragraph.className = 'espacio-bloque-texto';
    paragraph.textContent = String(b.texto || '');
    card.append(numero, title);
    if (subtitle.textContent.trim()) card.appendChild(subtitle);
    card.appendChild(paragraph);
    cont.appendChild(card);

    const enlace = document.createElement('button');
    enlace.type = 'button';
    enlace.className = 'espacio-indice-link';
    enlace.textContent = titulo;
    enlace.setAttribute('aria-label', 'Ir a ' + titulo);
    enlace.addEventListener('click', () => {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      card.focus({ preventScroll: true });
    });
    indice.appendChild(enlace);
  });
}

/* ==========================================================================
   MURO Y FORO DE REFLEXIONES
   ========================================================================== */
async function mostrarMuroReflexionesUsuarios() {
  await refrescarProgresosUsuario();
  const accesoMuro = Object.values(misProgresos).some(p => p?.completado === true);
  if (!usuarioActual || usuarioActual.es_admin || !accesoMuro) {
    alert('El Muro y Foro se habilita al completar al menos un trabajo de la Cámara.');
    return;
  }
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
            const nombreEscapado = (c.usuarios?.nombre || '').replace(/'/g, "\\'");
            botonesComentario += `<button class="foro-comentario-btn" onclick="abrirAuditoriaComentario('${c.id}', '${encodeURIComponent(c.contenido_original || c.contenido)}', '${nombreEscapado}', '${cFecha}')">🔍 Huella</button>`;
            botonesComentario += `<button class="foro-comentario-btn" style="color: var(--error);" onclick="eliminarComentarioForo('${c.id}')">🗑️</button>`;
          }

          return `
            <div class="foro-comentario-item" id="comentario_item_${c.id}">
              <div class="foro-comentario-header">
                <span class="foro-comentario-autor">Aporte del Q.·.H.·. ${c.usuarios?.nombre || "Hermano"}</span>
                <span class="foro-comentario-fecha">${cFecha}${editadoTag}</span>
              </div>
              <div class="foro-comentario-cuerpo" id="comentario_cuerpo_${c.id}">${c.contenido}</div>${botonesComentario ? `<div class="foro-comentario-acciones">${botonesComentario}</div>` : ''}
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
    const pendientesListado = modulosPendientesUsuario.map(m => 'Trabajo ' + m.numero_orden + ': ' + m.titulo).join(' • ');
    const aviso = document.createElement('div');
    aviso.style.cssText = 'margin-top:30px;background:rgba(0,0,0,0.03);border:1px dashed var(--border-color);padding:18px;border-radius:6px;font-family:var(--font-ui);font-size:0.88rem;color:var(--text-muted)';
    const titulo = document.createElement('strong');
    titulo.textContent = '🔒 Trabajos con aportes en reserva docente hasta su completación:';
    const detalle = document.createElement('span');
    detalle.style.fontStyle = 'italic';
    detalle.textContent = pendientesListado;
    aviso.append(titulo, document.createElement('br'), detalle);
    cont.appendChild(aviso);
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
function obtenerNombreFirmaTrabajo(autor) {
  // El tratamiento fraternal no es parte del nombre de firma.
  return String(autor || '').trim().replace(/^Q[.:·\s]+H[.:·\s]+/iu, '').trim();
}

function normalizarCierreTrabajo(texto, autor) {
  const nombre = obtenerNombreFirmaTrabajo(autor);
  if (!nombre) throw new Error('Ingrese el nombre del autor antes de guardar.');

  // Solo normalizar finales de línea y el bloque de firma;
  // preservar la puntuación y todos los párrafos originales.
  const lineas = String(texto || '').replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n').split('\n');
  while (lineas.length && !lineas[lineas.length - 1].trim()) lineas.pop();

  const esSigla = linea => /^S[.:·]+F[.:·]+U[.:·]+$/iu.test((linea || '').trim());
  const ultimo = (lineas[lineas.length - 1] || '').trim();
  if (ultimo === nombre || ultimo === String(autor || '').trim()) {
    let previo = lineas.length - 2;
    while (previo >= 0 && !lineas[previo].trim()) previo--;
    if (previo >= 0 && esSigla(lineas[previo])) lineas.length = previo;
  } else if (esSigla(ultimo)) {
    lineas.pop();
  }

  while (lineas.length && !lineas[lineas.length - 1].trim()) lineas.pop();
  const contenido = lineas.join('\n').trimEnd();
  if (!contenido) throw new Error('El contenido del trabajo no puede quedar vacío.');

  // Línea libre antes del saludo, entre el saludo y el autor, y al final.
  return contenido + '\n\nS.·.F.·.U.·.\n\n' + nombre + '\n\n';
}

function normalizarPieEditorTrabajo() {
  const campo = document.getElementById('editModTexto');
  const autor = document.getElementById('editModAutor')?.value;
  if (!campo) return;
  try {
    campo.value = normalizarCierreTrabajo(campo.value, autor);
    campo.focus();
    campo.setSelectionRange(campo.value.length, campo.value.length);
  } catch (error) {
    alert(error.message);
  }
}

function renderizarTrazadoEnriquecido(textoBruto) {
  if (!textoBruto) return '';
  const texto = String(textoBruto).replace(/\r\n?/g, '\n');
  const cierre = /(?:^|\n+)[ \t]*S[.:·]+F[.:·]+U[.:·]+[ \t]*\n+([^\n]+?)[ \t\n]*$/iu.exec(texto);
  const cuerpo = cierre ? texto.slice(0, cierre.index).trimEnd() : texto;
  const parrafos = cuerpo.split(/\n\s*\n/);
  const html = parrafos.map(p => {
    const limpio = p.trim();
    if (!limpio) return '';

    const esTitulo = /^(I{1,3}|IV|V|VI{0,3}|IX|X|\d+)\.?\s+[A-ZÁÉÍÓÚ\s]{4,}$/m.test(limpio) ||
                     (limpio.length < 90 && limpio.endsWith(':')) ||
                     (limpio.length < 80 && limpio === limpio.toUpperCase() && !limpio.includes('. '));

    if (esTitulo) return '<h3 class="trazado-subtitulo">' + limpio + '</h3>';
    return '<p class="trazado-parrafo">' + limpio.replace(/\n/g, ' ') + '</p>';
  }).join('');

  if (!cierre) return html;
  const escaparHtml = valor => valor.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  return html + '<div class="trazado-cierre" aria-label="Cierre y firma del trabajo">' +
    '<p class="trazado-saludo">S.·.F.·.U.·.</p>' +
    '<p class="trazado-firma">' + escaparHtml(cierre[1].trim()) + '</p>' +
    '</div>';
}

/* ==========================================================================
   ENTORNO DOCENTE Y LECTURA CON TEMPORIZADOR
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

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'modulo-nav-item';
    item.id = 'nav_mod_' + m.id;
    item.addEventListener('click', () => seleccionarModulo(m.id));
    const header = document.createElement('div');
    header.className = 'nav-item-header';
    const num = document.createElement('span');
    num.className = 'nav-item-num';
    num.textContent = 'Trabajo ' + m.numero_orden;
    const badge = document.createElement('span');
    badge.className = 'badge-estado ' + (prog?.completado ? 'badge-ok' : prog?.leido ? '' : 'badge-pen');
    badge.textContent = prog?.completado ? '✓ Completado' : prog?.leido ? 'En Curso' : 'Pendiente';
    if (prog?.leido && !prog?.completado) badge.style.cssText = 'background:#FEF3C7;color:#92400E';
    header.append(num, badge);
    const title = document.createElement('div');
    title.className = 'nav-item-title';
    title.textContent = String(m.titulo || '');
    item.append(header, title);
    contenedor.appendChild(item);
  });
}

async function seleccionarModulo(idModulo) {
  if (temporizadorLecturaId) clearTimeout(temporizadorLecturaId);

  moduloActual = listaModulos.find(m => m.id === idModulo);
  if (!moduloActual) return;

  document.querySelectorAll('.modulo-nav-item').forEach(el => {
    el.classList.remove('active');
    el.removeAttribute('aria-current');
  });
  const activeNav = document.getElementById(`nav_mod_${idModulo}`);
  if (activeNav) {
    activeNav.classList.add('active');
    activeNav.setAttribute('aria-current', 'page');
  }
  const actualEnSidebar = document.getElementById('sidebarTrabajoActual');
  if (actualEnSidebar) actualEnSidebar.textContent = 'En lectura: Trabajo ' + moduloActual.numero_orden;

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
          const nombreEscapado = (c.usuarios?.nombre || '').replace(/'/g, "\\'");
          botonesComentario += `<button class="foro-comentario-btn" onclick="abrirAuditoriaComentario('${c.id}', '${encodeURIComponent(c.contenido_original || c.contenido)}', '${nombreEscapado}', '${cFecha}')">🔍 Huella</button>`;
          botonesComentario += `<button class="foro-comentario-btn" style="color: var(--error);" onclick="eliminarComentarioForo('${c.id}')">🗑️</button>`;
        }

        return `
          <div class="foro-comentario-item" id="comentario_item_${c.id}">
            <div class="foro-comentario-header">
              <span class="foro-comentario-autor">Aporte del Q.·.H.·. ${c.usuarios?.nombre || "Hermano"}</span>
              <span class="foro-comentario-fecha">${cFecha}${editadoTag}</span>
            </div>
            <div class="foro-comentario-cuerpo" id="comentario_cuerpo_${c.id}">${c.contenido}</div>${botonesComentario ? `<div class="foro-comentario-acciones">${botonesComentario}</div>` : ''}
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
   MIS AVANCES E INFORME
   ========================================================================== */
async function abrirModalMisAvances(usuarioObjetivoId = null) {
  const idTarget = usuarioObjetivoId || usuarioActual.id;
  
  const { data: usuarioData } = await sbApp
    .from('usuarios')
    .select('id,nombre,email,es_admin,debe_cambiar_clave,auth_user_id')
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

    const tr = document.createElement('tr');
    const trabajo = document.createElement('td');
    const etiqueta = document.createElement('strong');
    etiqueta.textContent = 'Trabajo ' + m.numero_orden + ':';
    trabajo.append(etiqueta, document.createTextNode(' ' + String(m.titulo || '')));
    const lectura = document.createElement('td');
    lectura.textContent = leidoTxt;
    const examen = document.createElement('td');
    examen.textContent = examenTxt;
    const reflexion = document.createElement('td');
    reflexion.style.fontSize = '0.8rem';
    reflexion.textContent = p && p.reflexion ? String(p.reflexion) : 'Sin aporte consagrado';
    if (!p?.reflexion) reflexion.style.fontStyle = 'italic';
    tr.append(trabajo, lectura, examen, reflexion);
    tablaCuerpo.appendChild(tr);

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
  const userTarget = usuarioId ? (await sbApp.from('usuarios').select('id,nombre,email,es_admin,debe_cambiar_clave,auth_user_id').eq('id', usuarioId).single()).data : usuarioActual;

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
      const option = document.createElement('option');
      option.value = String(m.id);
      option.textContent = 'Trabajo ' + m.numero_orden + ': ' + m.titulo;
      selectMetricas.appendChild(option);
    });
  }
  
  const selectPresencialMod = document.getElementById('selectOrigenTrabajoPresencial');
  if (selectPresencialMod) {
    selectPresencialMod.innerHTML = `<option value="aleatorio">🎲 Todos los Trabajos (Aleatorio)</option>`;
    listaModulos.forEach(m => {
      const option = document.createElement('option');
      option.value = String(m.id);
      option.textContent = 'Trabajo ' + m.numero_orden + ': ' + m.titulo;
      selectPresencialMod.appendChild(option);
    });
  }

  const selectAdjunto = document.getElementById('selectModuloParaArchivo');
  if (selectAdjunto) {
    selectAdjunto.innerHTML = "";
    listaModulos.forEach(m => {
      const option = document.createElement('option');
      option.value = String(m.id);
      option.textContent = 'Trabajo ' + m.numero_orden + ': ' + m.titulo;
      selectAdjunto.appendChild(option);
    });
    if (listaModulos.length > 0) {
      verificarEstadoArchivoModulo(selectAdjunto.value || listaModulos[0].id);
    }
  }

  cambiarSubseccionAdmin('resumen');
}

function cambiarSubseccionAdmin(seccion) {
  const btns = ['tabNavResumen', 'tabNavUsuarios', 'tabNavCargar', 'tabNavGestionTrabajos', 'tabNavPresencial', 'tabNavMuroGeneral', 'tabNavMetricas', 'tabNavEditorDoctrina', 'tabNavAccesos'];
  const secs = ['adminSeccionResumen', 'adminSeccionUsuarios', 'adminSeccionCarga', 'adminSeccionGestionTrabajos', 'adminSeccionPresencial', 'adminSeccionMuroGeneral', 'adminSeccionMetricas', 'adminSeccionEditorDoctrina', 'adminSeccionAccesos'];

  btns.forEach(b => document.getElementById(b)?.classList.remove('active'));
  secs.forEach(s => document.getElementById(s)?.classList.add('hidden'));

  if (seccion === 'resumen') {
    document.getElementById('tabNavResumen')?.classList.add('active');
    document.getElementById('adminSeccionResumen')?.classList.remove('hidden');
    cargarResumenAdmin();
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
async function cargarBitacoraAccesos(filtroUsuarioId = null) {
  const tbody = document.getElementById('tablaAccesosBody');
  tbody.innerHTML = `<tr><td colspan="4" class="td-loading">Consultando registros...</td></tr>`;

  const selectFiltro = document.getElementById('filtroUsuarioAcceso');
  if (selectFiltro && selectFiltro.options.length <= 1) {
    const { data: usrs } = await sbApp.from('usuarios').select('id, nombre').order('nombre', { ascending: true });
    if (usrs) {
      usrs.forEach(u => {
        const option = document.createElement('option');
        option.value = String(u.id);
        option.textContent = String(u.nombre || '');
        selectFiltro.appendChild(option);
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

  const ocultarAdmin = document.getElementById('ocultarAdminAccesos')?.checked === true;
  let registrosVisibles = registros;
  if (ocultarAdmin) {
    const { data: admins, error: adminError } = await sbApp.from('usuarios').select('id,email,es_admin');
    if (adminError) {
      tbody.innerHTML = '<tr><td colspan="4">No fue posible aplicar el filtro de administrador.</td></tr>';
      return;
    }
    const idsAdmin = new Set((admins || [])
      .filter(u => u.es_admin === true || String(u.email || '').trim().toLowerCase() === 'dummy@ofl.cl')
      .map(u => u.id));
    registrosVisibles = registros.filter(r => !idsAdmin.has(r.usuario_id));
  }
  if (!registrosVisibles.length) {
    tbody.innerHTML = '<tr><td colspan="4">Sin registros para el filtro seleccionado.</td></tr>';
    return;
  }
  registrosVisibles.forEach(r => {
    const d = new Date(r.creado_en);
    const fechaTxt = d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const horaTxt = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const tr = document.createElement('tr');
    const dateCell = document.createElement('td');
    dateCell.style.whiteSpace = 'nowrap';
    const strong = document.createElement('strong');
    strong.textContent = fechaTxt;
    const time = document.createElement('span');
    time.style.cssText = 'font-size:0.8rem;color:var(--text-muted)';
    time.textContent = ' ' + horaTxt;
    dateCell.append(strong, time);
    const nameCell = document.createElement('td');
    const name = document.createElement('span');
    name.style.fontWeight = '600';
    name.textContent = String(r.nombre || 'Hermano');
    nameCell.appendChild(name);
    const emailCell = document.createElement('td');
    emailCell.style.cssText = 'font-family:monospace;font-size:0.88rem';
    emailCell.textContent = String(r.email || '');
    const ipCell = document.createElement('td');
    const ip = document.createElement('span');
    ip.style.cssText = 'background:rgba(153,120,57,0.1);color:var(--accent-gold-dark);padding:3px 8px;border-radius:4px;font-family:monospace;font-size:0.85rem';
    ip.textContent = String(r.ip_origen || '—');
    ipCell.appendChild(ip);
    tr.append(dateCell, nameCell, emailCell, ipCell);
    tbody.appendChild(tr);
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

async function cargarUnidadesEditorTrabajo(codigoActual, moduloId) {
  const selector = document.getElementById('editModUnidadDetalle');
  const estado = document.getElementById('editModUnidadEstado');
  const codigo = document.getElementById('editModUnidadCodigo');
  if (!selector || !codigo || !estado) return;

  selector.dataset.cargado = 'false';
  selector.disabled = true;
  codigo.value = codigoActual || '';
  estado.textContent = 'Consultando unidades disponibles…';

  const unidades = await consultarUnidadesDocencia();
  // Evita que una consulta demorada sobrescriba un trabajo abierto después.
  if (moduloAuditando?.id !== moduloId) return;
  selector.replaceChildren();

  const vacio = document.createElement('option');
  vacio.value = '';
  vacio.textContent = 'Sin unidad asignada';
  selector.appendChild(vacio);

  if (unidades === null) {
    estado.textContent = 'No se pudo consultar el catálogo. La unidad anterior no cambiará al guardar.';
    return;
  }

  // Presentación agrupada para navegar 112 entradas sin una lista plana.
  // Las cabeceras se distinguen visualmente y siguen disponibles para
  // clasificaciones que abarquen una unidad o subunidad completa.
  let grupo = null;
  for (const unidad of unidades) {
    const tipo = tipoUnidadDocencia(unidad.codigo);
    if (tipo === 'unidad') {
      grupo = null;
      const encabezado = document.createElement('option');
      encabezado.value = unidad.codigo;
      encabezado.textContent = unidad.codigo + ' — ' + unidad.detalle;
      encabezado.className = 'unidad-opcion-principal';
      selector.appendChild(encabezado);
    } else if (tipo === 'subunidad') {
      grupo = document.createElement('optgroup');
      grupo.label = unidad.codigo + ' — ' + unidad.detalle;
      selector.appendChild(grupo);
      const opcion = document.createElement('option');
      opcion.value = unidad.codigo;
      opcion.textContent = 'SUBUNIDAD COMPLETA — ' + unidad.detalle;
      grupo.appendChild(opcion);
    } else {
      const opcion = document.createElement('option');
      opcion.value = unidad.codigo;
      opcion.textContent = unidad.codigo + ' — ' + unidad.detalle;
      (grupo || selector).appendChild(opcion);
    }
  }

  // Conservar códigos de unidades archivadas sin permitir pérdida silenciosa.
  if (codigoActual && !unidades.some(unidad => unidad.codigo === codigoActual)) {
    const anterior = document.createElement('option');
    anterior.value = codigoActual;
    anterior.textContent = codigoActual + ' — unidad previamente asignada';
    selector.appendChild(anterior);
  }

  selector.value = codigoActual || '';
  selector.disabled = unidades.length === 0 && !codigoActual;
  selector.dataset.cargado = 'true';
  actualizarCodigoUnidadEditor();

  estado.textContent = unidades.length
    ? 'El código se completa automáticamente al elegir el detalle de la unidad.'
    : 'Aún no se han cargado las unidades oficiales. Se conservará la clasificación anterior.';
}

function actualizarCodigoUnidadEditor() {
  const selector = document.getElementById('editModUnidadDetalle');
  const codigo = document.getElementById('editModUnidadCodigo');
  if (selector && codigo) codigo.value = selector.value || '';
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
  void cargarUnidadesEditorTrabajo(moduloAuditando.unidad_codigo || '', moduloAuditando.id);
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
  const campoTexto = document.getElementById('editModTexto');
  if (!nuevoTitulo || !nuevoAutor || !campoTexto.value.trim()) {
    alert('El título, el autor y el texto no pueden quedar vacíos.');
    return;
  }
  let nuevoTexto;
  try {
    nuevoTexto = normalizarCierreTrabajo(campoTexto.value, nuevoAutor);
  } catch (error) {
    alert(error.message);
    return;
  }
  // La vista conserva los saltos finales: no usar .trim() para guardar.
  campoTexto.value = nuevoTexto;

  const cambios = {
    numero_orden: nuevoOrden,
    titulo: nuevoTitulo,
    autor: nuevoAutor,
    contenido_trazado: nuevoTexto
  };
  const selectorUnidad = document.getElementById('editModUnidadDetalle');
  // Si el catálogo aún está cargando o falló, se conserva el vínculo previo.
  if (selectorUnidad?.dataset.cargado === 'true') {
    cambios.unidad_codigo = selectorUnidad.value || null;
  }

  const { error } = await sbApp
    .from('modulos')
    .update(cambios)
    .eq('id', moduloAuditando.id);

  if (error) {
    alert("Error al actualizar trabajo: " + error.message);
  } else {
    moduloAuditando.titulo = nuevoTitulo;
    moduloAuditando.autor = nuevoAutor;
    moduloAuditando.numero_orden = nuevoOrden;
    moduloAuditando.contenido_trazado = nuevoTexto;
    if (Object.hasOwn(cambios, 'unidad_codigo')) {
      moduloAuditando.unidad_codigo = cambios.unidad_codigo;
    }
    alert("Encabezado, texto y clasificación guardados exitosamente.");
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
  try {
    const { data: usuarios } = await sbApp.from('usuarios').select('id,nombre,email,es_admin,debe_cambiar_clave,auth_user_id');
    const { data: modulos } = await sbApp.from('modulos').select('*');
    const { data: progresos } = await sbApp.from('progreso_maestro').select('*');
    const { data: comentarios } = await sbApp.from('comentarios_muro').select('*');

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
  const cont = document.getElementById('contenedorMuroGeneralAdmin');
  cont.innerHTML = "<p class='td-loading'>Cargando muro general...</p>";
  document.getElementById('muroAdminFechaEmision').innerText = `EMISIÓN: ${new Date().toLocaleDateString('es-CL')}`;

  const { data: reflexiones, error } = await sbApp
    .from('progreso_maestro')
    .select('*, usuarios(nombre), modulos(numero_orden, titulo)')
    .eq('completado', true)
    .not('reflexion', 'is', null)
    .order('completado_en', { ascending: false });

  cont.innerHTML = "";

  if (error || !reflexiones || reflexiones.length === 0) {
    cont.innerHTML = "<p style='color: var(--text-muted); font-style: italic;'>No hay reflexiones consagradas.</p>";
    return;
  }

  reflexiones.forEach(r => {
    const fecha = r.completado_en ? new Date(r.completado_en).toLocaleDateString('es-CL') : '';
    cont.innerHTML += `
      <div class="reflexion-item" style="margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <strong>Trabajo ${r.modulos?.numero_orden || '—'}: ${r.modulos?.titulo || 'Trazado'}</strong>
          <span style="font-size: 0.8rem; color: var(--text-muted);">${fecha}</span>
        </div>
        <p style="margin: 0 0 6px 0; font-style: italic;">"${r.reflexion}"</p>
        <span class="reflexion-autor">Q.·.H.·. ${r.usuarios?.nombre || 'Hermano'}</span>
      </div>
    `;
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
async function cargarEditorDoctrinaAdmin() {
  const cont = document.getElementById('contenedorEditorDoctrinaAdmin');
  cont.innerHTML = "<p class='td-loading'>Cargando doctrina institucional...</p>";

  const bloques = await obtenerDoctrinaBD();
  cont.innerHTML = "";

  bloques.forEach((b, idx) => {
    cont.innerHTML += `
      <div class="bloque-doctrina-card" id="bloque_doc_${idx}">
        <div class="bloque-doctrina-header">
          <strong>Bloque N° ${idx + 1}</strong>
          <button class="admin-link-btn" style="color: var(--error);" onclick="eliminarBloqueDoctrinaAdmin(${idx})">🗑️ Eliminar</button>
        </div>
        <div class="form-group">
          <label>Título:</label>
          <input type="text" id="doc_tit_${idx}" value="${b.titulo.replace(/"/g, '&quot;')}">
        </div>
        <div class="form-group">
          <label>Subtítulo:</label>
          <input type="text" id="doc_sub_${idx}" value="${b.subtitulo.replace(/"/g, '&quot;')}">
        </div>
        <div class="form-group">
          <label>Texto:</label>
          <textarea id="doc_txt_${idx}" rows="4">${b.texto}</textarea>
        </div>
      </div>
    `;
  });
}

function agregarBloqueDoctrinaAdmin() {
  const cont = document.getElementById('contenedorEditorDoctrinaAdmin');
  const idx = cont.querySelectorAll('.bloque-doctrina-card').length;

  cont.innerHTML += `
    <div class="bloque-doctrina-card" id="bloque_doc_${idx}">
      <div class="bloque-doctrina-header">
        <strong>Nuevo Bloque</strong>
        <button class="admin-link-btn" style="color: var(--error);" onclick="eliminarBloqueDoctrinaAdmin(${idx})">🗑️ Eliminar</button>
      </div>
      <div class="form-group">
        <label>Título:</label>
        <input type="text" id="doc_tit_${idx}" value="Nuevo Título">
      </div>
      <div class="form-group">
        <label>Subtítulo:</label>
        <input type="text" id="doc_sub_${idx}" value="Nuevo Subtítulo">
      </div>
      <div class="form-group">
        <label>Texto:</label>
        <textarea id="doc_txt_${idx}" rows="4">Escriba aquí los fundamentos doctrinales...</textarea>
      </div>
    </div>
  `;
}

function eliminarBloqueDoctrinaAdmin(idx) {
  document.getElementById(`bloque_doc_${idx}`)?.remove();
}

async function guardarDoctrinaAdmin() {
  if (!usuarioActual?.es_admin) return;
  const cont = document.getElementById('contenedorEditorDoctrinaAdmin');
  if (!cont) return;
  const bloques = [];
  for (const card of cont.querySelectorAll('.bloque-doctrina-card')) {
    const tit = card.querySelector('input[id^="doc_tit_"]')?.value.trim();
    const sub = card.querySelector('input[id^="doc_sub_"]')?.value.trim();
    const txt = card.querySelector('textarea[id^="doc_txt_"]')?.value.trim();
    if (tit && txt) bloques.push({ titulo: tit, subtitulo: sub || '', texto: txt });
  }
  const { error } = await sbApp.from('config_segura')
    .upsert({ clave: 'doctrina_docencia_maestros', valor: JSON.stringify(bloques) }, { onConflict: 'clave' });
  if (error) {
    alert('No se pudo guardar la doctrina. Verifique los permisos de SUPERADMIN.');
  } else {
    alert('Borrador doctrinal guardado. No se ha publicado a los usuarios.');
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


async function cargarResumenAdmin() {
  const status = document.getElementById('resumenAdminEstado');
  if (!status) return;
  status.textContent = 'Actualizando indicadores...';
  const campos = ['kpiUsuarios','kpiModulos','kpiCompletados','kpiComentarios'];
  campos.forEach(id => { document.getElementById(id).textContent = '—'; });
  try {
    const [users, modules, progress, comments] = await Promise.all([
      sbApp.from('usuarios').select('id,es_admin'),
      sbApp.from('modulos').select('id', { count: 'exact', head: true }),
      sbApp.from('progreso_maestro').select('usuario_id,completado').eq('completado',true),
      sbApp.from('comentarios_muro').select('id', { count: 'exact', head: true })
    ]);
    if ([users,modules,progress,comments].some(result => result.error)) throw new Error('Sin permisos de lectura para indicadores');
    const estudiantes = new Set(users.data.filter(u => !u.es_admin).map(u => u.id));
    document.getElementById('kpiUsuarios').textContent = estudiantes.size.toLocaleString('es-CL');
    document.getElementById('kpiModulos').textContent = (modules.count ?? 0).toLocaleString('es-CL');
    document.getElementById('kpiCompletados').textContent = progress.data.filter(p => estudiantes.has(p.usuario_id)).length.toLocaleString('es-CL');
    document.getElementById('kpiComentarios').textContent = (comments.count ?? 0).toLocaleString('es-CL');
    status.textContent = 'Indicadores actualizados.';
  } catch {
    status.textContent = 'No fue posible consultar los indicadores con los permisos actuales.';
  }
}
