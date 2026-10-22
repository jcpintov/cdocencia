if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
}

const SUPABASE_URL = "https://pwnnpjygnviyzyyvfxnq.supabase.co";
const SUPABASE_KEY = "sb_publishable_NExezuss4il3RPgO8Vifxw_pspbe5wF"; 

const sbApp = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let usuarioActual = null;
let versionSesion = 0;
let ingresoPendiente = false;
let versionNavegacion = 0;
let listaModulos = [];
let moduloActual = null;
let misProgresos = {};

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
// Un único tratamiento institucional, incluso si el nombre trae QH duplicado.
function limpiarTratamientoHermano(nombre) {
  return String(nombre || '').replace(/\s+/g, ' ').trim()
    .replace(/^(?:Q\s*[.·:]*\s*H\s*[.·:]*\s*)+/iu, '').trim();
}
function formatearNombreHermano(nombre, reemplazo = 'Hermano') {
  const limpio = limpiarTratamientoHermano(nombre) || reemplazo;
  return `Q.·.H.·. ${limpio}`;
}
function formatearAutorMasonico(autor) {
  return autor ? formatearNombreHermano(autor) : 'Cámara de Docencia';
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
  if (ingresoPendiente) return;
  const email = document.getElementById('inputEmail').value.trim().toLowerCase();
  const clave = document.getElementById('inputClave').value;
  const err = document.getElementById('errorLogin');

  if (!email || !clave) {
    err.innerText = "Por favor ingrese su correo y contraseña.";
    return;
  }

  const solicitud = ++versionSesion;
  ingresoPendiente = true;
  const boton = document.querySelector('#formAccesoCamara button[type="submit"]');
  if (boton) boton.disabled = true;
  err.innerText = "Verificando credenciales...";

  try {
    const { data, error } = await sbApp.auth.signInWithPassword({ email, password: clave });

    if (solicitud !== versionSesion) return;
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
    if (solicitud !== versionSesion) return;
    if (errorPerfil || !perfil) {
      await sbApp.auth.signOut();
      err.innerText = 'Perfil no disponible. Contacte al administrador.';
      return;
    }
    usuarioActual = perfil;
    sessionStorage.setItem('camara_usuario_sesion', JSON.stringify(usuarioActual));

    err.innerText = "";
    document.getElementById("inputClave").value = "";
    configurarEntornoUsuario();
  } catch (ex) {
    if (solicitud === versionSesion) err.innerText = mensajeErrorServicio(ex, 'autenticación');
  } finally {
    if (solicitud === versionSesion) {
      ingresoPendiente = false;
      if (boton) boton.disabled = false;
    }
  }
}

async function registrarIngresoAuditoria() {
  if (window.iniciarBitacoraSesion) await window.iniciarBitacoraSesion();
}

async function recuperarSesionGuardada() {
  const solicitud = versionSesion;
  try {
    // Una visita sin sesión no debe consultar /auth/v1/user ni provocar
    // respuestas 403 evitables por credenciales inexistentes o caducadas.
    const {data:sesionActual,error:sesionError}=await sbApp.auth.getSession();
    if(solicitud!==versionSesion)return;
    if(sesionError||!sesionActual?.session?.access_token){
      sessionStorage.removeItem('camara_usuario_sesion');
      return;
    }
    const { data, error } = await sbApp.auth.getUser();
    if (solicitud !== versionSesion) return;
    if (error || !data?.user) {
      sessionStorage.removeItem('camara_usuario_sesion');
      const mensaje=document.getElementById('errorLogin');
      if(mensaje)mensaje.textContent='La sesión guardada ya no es válida. Inicie sesión nuevamente.';
      return;
    }
    const { data: perfil, error: perfilError } = await sbApp.from('usuarios')
      .select('id,nombre,email,es_admin,debe_cambiar_clave')
      .eq('auth_user_id', data.user.id).maybeSingle();
    if (solicitud !== versionSesion) return;
    if (perfilError || !perfil) {
      sessionStorage.removeItem('camara_usuario_sesion');
      return;
    }
    usuarioActual = perfil;
    sessionStorage.setItem('camara_usuario_sesion', JSON.stringify(perfil));
    configurarEntornoUsuario();
  } catch (error) {
    if (solicitud !== versionSesion) return;
    sessionStorage.removeItem('camara_usuario_sesion');
    document.getElementById('errorLogin').innerText = mensajeErrorServicio(error, 'recuperación de sesión');
  }
}

// Encabezado compartido por todas las pantallas: se identifica al Maestro,
// pero nunca se muestra su nombre durante login o en la cuenta Superadmin.
function limpiarNombreWorkspaceUsuario(nombre) {
  return limpiarTratamientoHermano(nombre);
}

function sincronizarEncabezadoWorkspaceUsuario() {
  const bloque = document.getElementById('encabezadoWorkspaceUsuario');
  const campoNombre = document.getElementById('encabezadoNombreUsuario');
  if (!bloque || !campoNombre) return;

  campoNombre.textContent = '';
  bloque.classList.add('hidden');

  if (!usuarioActual || usuarioActual.es_admin) return;
  const nombre = limpiarNombreWorkspaceUsuario(usuarioActual.nombre);
  if (!nombre) return;

  campoNombre.textContent = formatearNombreHermano(nombre);
  bloque.classList.remove('hidden');
}

function configurarEntornoUsuario() {
  void registrarIngresoAuditoria();
  sincronizarEncabezadoWorkspaceUsuario();
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
    document.getElementById('seccionContenidoDocente')?.classList.add('hidden');
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

  const nombreLimpio = limpiarTratamientoHermano(usuarioActual.nombre);
  document.getElementById('bienvenidaNombreQH').innerText = formatearNombreHermano(nombreLimpio);
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
      const nombreLimpio = limpiarTratamientoHermano(usuarioActual.nombre);
      document.getElementById('bienvenidaNombreQH').innerText = formatearNombreHermano(nombreLimpio);
      document.getElementById('seccionBienvenida').classList.remove('hidden');
    }
  } catch (ex) {
    err.innerText = "Error: " + ex.message;
  }
}

function cerrarSesion() {
  versionSesion++;
  versionNavegacion++;
  ingresoPendiente = false;
  const botonIngreso = document.querySelector('#formAccesoCamara button[type="submit"]');
  if (botonIngreso) botonIngreso.disabled = false;
  window.limpiarAsignacionesAdmin?.();
  limpiarBibliotecaDoctrina();
  window.cerrarPerfilSuperadmin?.();
  window.limpiarCalendarioTenidas?.();
  window.cerrarBitacoraSesion?.();
  if (temporizadorInactividad) clearTimeout(temporizadorInactividad);
  if (temporizadorLecturaId) clearTimeout(temporizadorLecturaId);
  usuarioActual = null;
  sincronizarEncabezadoWorkspaceUsuario();
  moduloActual = null;
  misProgresos = {};
  respuestasMarcadas = {};
  archivoBase64Pendiente = null;
  sessionStorage.removeItem('camara_usuario_sesion');
  void sbApp.auth.signOut().catch(() => {});

  document.getElementById('errorLogin').innerText = '';
  document.getElementById('inputEmail').value = '';
  document.getElementById('inputClave').value = '';
  document.getElementById('inputClave').type = 'password';
  const btnEye = document.getElementById('btnToggleVerClave');
  if (btnEye) {
    btnEye.innerText = '👁️';
    btnEye.setAttribute('aria-pressed', 'false');
    btnEye.setAttribute('aria-label', 'Mostrar contraseña');
  }

  document.getElementById('seccionDocencia').classList.add('hidden');
  document.getElementById('seccionBienvenida').classList.add('hidden');
  document.getElementById('seccionCatalogoTrabajos').classList.add('hidden');
    document.getElementById('seccionContenidoDocente')?.classList.add('hidden');
  document.getElementById('seccionDocenciaInstitucional').classList.add('hidden');
  document.getElementById('seccionMuroUsuarios').classList.add('hidden');
  document.getElementById('seccionAdmin').classList.add('hidden');
  document.getElementById('modalSigilo').classList.add('hidden');
  document.getElementById('modalCambioClaveObligatorio').classList.add('hidden');
  document.getElementById('modalCambiarMiClave').classList.add('hidden');
  document.getElementById('modalAdminClaveHermano').classList.add('hidden');
  document.getElementById('modalAdminUsuario').classList.add('hidden');
  document.getElementById('modalRecuperarClave').classList.add('hidden');
  cerrarModalUniversalDirecto('modalEditarComentarioForo');
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
let padronUsuariosAdmin = [];
let consultaPadronAdmin = 0;
function filtrarPadronAdmin(usuarios, busqueda, estado = 'todos') {
  const palabras = normalizarBusquedaAdmin(busqueda).split(/\s+/).filter(Boolean);
  return usuarios.filter(u => {
    const especial = u.es_admin || String(u.email || '').trim().toLowerCase() === 'dummy@ofl.cl';
    const coincideEstado = estado === 'todos' || (estado === 'activos' && !especial && !!u.auth_user_id)
      || (estado === 'pendientes' && !especial && !u.auth_user_id) || (estado === 'especiales' && especial);
    const texto = normalizarBusquedaAdmin(`${u.nombre || ''} ${u.email || ''}`);
    return coincideEstado && palabras.every(p => texto.includes(p));
  });
}
function renderizarPadronAdmin() {
  const tbody = document.getElementById('tablaUsuariosAdminBody');
  if (!tbody) return;
  const usuarios = filtrarPadronAdmin(padronUsuariosAdmin, document.getElementById('buscarUsuarioAdmin')?.value || '', document.getElementById('filtrarEstadoUsuarioAdmin')?.value || 'todos');
  tbody.replaceChildren();
  const contador = document.getElementById('padronUsuariosConteo');
  if (contador) contador.textContent = `${usuarios.length} de ${padronUsuariosAdmin.length} cuentas`;
  if (!usuarios.length) {
    const fila = document.createElement('tr');
    const celda = document.createElement('td');
    celda.colSpan = 6;
    celda.className = 'admin-empty-state';
    celda.textContent = padronUsuariosAdmin.length ? 'No hay cuentas que coincidan con estos filtros.' : 'No hay cuentas registradas.';
    fila.appendChild(celda);tbody.appendChild(fila);
  }
  usuarios.forEach(u => {
    const tr = document.createElement('tr');
    const celda = (texto, className = '') => {
      const td = document.createElement('td');
      if (className) td.className = className;
      td.textContent = texto;
      tr.appendChild(td);
      return td;
    };
    const nombre=celda('');
    if (!u.es_admin) {
      const boton=document.createElement('button');
      boton.type='button';
      boton.className='admin-usuario-nombre-btn';
      boton.textContent=u.nombre||'Hermano';
      boton.setAttribute('aria-label','Modificar datos de '+(u.nombre||'integrante'));
      boton.addEventListener('click',()=>abrirModalEditarUsuario(u.id));
      nombre.appendChild(boton);
    } else {
      nombre.textContent=u.nombre||'Hermano';
      nombre.style.fontWeight='700';
    }
    const correo = celda(u.email || '');
    correo.style.fontFamily = 'monospace';
    correo.style.fontSize = '0.88rem';
    celda(u.es_admin ? 'Superadmin' : 'Hermano');
    celda(u.debe_cambiar_clave ? 'Requiere cambio' : 'Al día');
    celda(u.auth_user_id ? 'Vinculado' : 'Pendiente de activación');
    const acciones=celda(u.es_admin?'Administración protegida':'', 'admin-accion-pendiente');
    if(!u.es_admin&&String(u.email||'').toLowerCase()==='dummy@ofl.cl'){
      const eliminar=document.createElement('button');eliminar.type='button';eliminar.className='admin-link-btn';eliminar.textContent='Eliminar Dummy';eliminar.onclick=()=>eliminarCuentaDummy(u.id,eliminar);acciones.appendChild(eliminar);
    }
    tbody.appendChild(tr);
  });
}
async function cargarListadoUsuariosAdmin() {
  const tbody = document.getElementById('tablaUsuariosAdminBody');
  if (!tbody) return;
  const consulta = ++consultaPadronAdmin;
  const estado = document.getElementById('padronUsuariosEstado');
  const refrescar = document.getElementById('btnActualizarPadronAdmin');
  const botonAgregar = document.getElementById('btnAgregarUsuarioAdmin');
  tbody.setAttribute('aria-busy', 'true');
  if (estado) estado.textContent = 'Consultando padrón…';
  if (refrescar) refrescar.disabled = true;
  if (botonAgregar) botonAgregar.disabled = true;
  try {
    const {data: usuarios, error} = await sbApp.from('usuarios')
      .select('id, nombre, email, es_admin, debe_cambiar_clave, auth_user_id').eq('cuenta_eliminada',false).order('nombre', {ascending:true});
    if (consulta !== consultaPadronAdmin) return;
    if (error || !Array.isArray(usuarios)) {
      const codigo=error?.code;
      if(error?.status===401||error?.status===403||codigo==='42501')
        throw new Error('No se pudo acceder al padrón con esta sesión. Compruebe la autenticación y los permisos.');
      throw new Error('No se pudo consultar el padrón.');
    }
    padronUsuariosAdmin = usuarios;
    const cuposOcupados = usuarios.filter(u => !u.es_admin && String(u.email || '').trim().toLowerCase() !== 'dummy@ofl.cl').length;
    if (botonAgregar) {
      botonAgregar.disabled = false;
      botonAgregar.title = 'Agregar integrante al padrón';
    }
    const estadoCupos = document.getElementById('adminCupoUsuarios');
    if (estadoCupos) estadoCupos.textContent = `${cuposOcupados} integrantes registrados`;
    renderizarPadronAdmin();
    if (estado) estado.textContent = 'Padrón actualizado. Puede incorporar nuevos integrantes desde Agregar usuario.';
  } catch(error) {
    if (consulta !== consultaPadronAdmin) return;
    if (estado) estado.textContent = error?.message || 'No se pudo actualizar el padrón. Reintente; se conservan los datos anteriores.';
    if (!padronUsuariosAdmin.length) tbody.innerHTML = '<tr><td colspan="6" class="admin-empty-state">No se pudo cargar el padrón. Pulse Actualizar padrón para reintentar.</td></tr>';
  } finally {
    if (consulta === consultaPadronAdmin) {
      tbody.setAttribute('aria-busy', 'false');
      if (refrescar) refrescar.disabled = false;
    }
  }
}

function abrirModalCrearUsuario() {
  if (!usuarioActual?.es_admin || document.getElementById('btnAgregarUsuarioAdmin')?.disabled) return;
  document.getElementById('modalAdminUsuarioTitulo').textContent = 'Agregar usuario al padrón';
  document.getElementById('adminUsuarioModalAyuda').textContent = 'Incorpore un Hermano con nombre completo y correo electrónico real.';
  document.getElementById('adminUsuarioTargetId').value = '';
  document.getElementById('adminUsuarioNombre').value = '';
  document.getElementById('adminUsuarioEmail').value = '';
  document.getElementById('adminUsuarioEmail').readOnly = false;
  document.getElementById('adminUsuarioEmailInfo').hidden = true;
  document.getElementById('adminUsuarioNotaAcceso').textContent = 'El usuario será incorporado sin contraseña ni invitación; activará su acceso mediante verificación individual.';
  document.getElementById('btnGuardarUsuarioAdmin').textContent='Guardar usuario';
  document.getElementById('errorAdminUsuario').textContent = '';
  document.getElementById('modalAdminUsuario').classList.remove('hidden');
  document.getElementById('adminUsuarioNombre').focus();
  requestAnimationFrame(()=>{if(!document.getElementById('adminUsuarioTargetId').value)document.getElementById('adminUsuarioEmail').value='';});
}

function abrirModalEditarUsuario(id) {
  if (!usuarioActual?.es_admin) return;
  const u=padronUsuariosAdmin.find(item=>item.id===id);
  if(!u||u.es_admin) return;
  document.getElementById('modalAdminUsuarioTitulo').textContent = 'Modificar datos del Hermano';
  document.getElementById('adminUsuarioModalAyuda').textContent = 'Modifique los datos del padrón. Este formulario no cambia permisos, contraseñas ni historial docente.';
  document.getElementById('adminUsuarioTargetId').value = u.id;
  document.getElementById('adminUsuarioNombre').value = u.nombre||'';
  document.getElementById('adminUsuarioEmail').value = u.email||'';
  document.getElementById('adminUsuarioEmail').readOnly = !!u.auth_user_id;
  if(String(u.email||'').toLowerCase()==='dummy@ofl.cl')document.getElementById('adminUsuarioEmail').readOnly=true;
  document.getElementById('adminUsuarioEmailInfo').hidden = !u.auth_user_id;
  document.getElementById('adminUsuarioNotaAcceso').textContent = 'Los cambios se guardan en el padrón y no generan correos automáticos.';
  document.getElementById('btnGuardarUsuarioAdmin').textContent='Guardar cambios';
  document.getElementById('errorAdminUsuario').textContent = '';
  document.getElementById('modalAdminUsuario').classList.remove('hidden');
  document.getElementById('adminUsuarioNombre').focus();
}

async function guardarAdminUsuario() {
  const err = document.getElementById('errorAdminUsuario');
  const nombre = document.getElementById('adminUsuarioNombre').value.trim();
  const email = document.getElementById('adminUsuarioEmail').value.trim().toLowerCase();
  const id = document.getElementById('adminUsuarioTargetId').value.trim();
  const editar=!!id;
  if (!usuarioActual?.es_admin) return;
  const nombreReal=nombre.replace(/^(?:\s*Q\s*[.·:]*\s*H\s*[.·:]*\s*)+/iu,'').trim();
  if (nombreReal.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    err.textContent = 'Ingrese un nombre completo y un correo electrónico válido.';
    return;
  }
  const { data: sessionData, error: sessionError } = await sbApp.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (sessionError || !token) { err.textContent = 'Sesión vencida. Vuelva a iniciar sesión.'; return; }
  const button = document.getElementById('btnGuardarUsuarioAdmin');
  if (button) button.disabled = true;
  err.textContent = editar?'Guardando cambios…':'Registrando usuario…';
  try {
    const response = await fetch('/api/admin-usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ action: editar?'editar':'crear', id:editar?id:undefined, nombre, email })
    });
    const result = await response.json().catch(()=>({}));
    if (!response.ok || !result.ok) {
      err.textContent = result.error || 'No se pudo guardar el usuario.';
      return;
    }
    document.getElementById('modalAdminUsuario').classList.add('hidden');
    await cargarListadoUsuariosAdmin();
    const estado=document.getElementById('padronUsuariosEstado');
    if(estado)estado.textContent=editar?'Datos del Hermano actualizados.':'Integrante incorporado al padrón sin envío de invitación.';
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
function ocultarPantallasUsuario() {
  versionNavegacion++;
  ['seccionBienvenida','seccionCatalogoTrabajos','seccionContenidoDocente',
   'seccionDocencia','seccionDocenciaInstitucional','seccionMuroUsuarios']
    .forEach(id => document.getElementById(id)?.classList.add('hidden'));
}

function volverAInicioPortal() {
  ocultarPantallasUsuario();
  document.getElementById('seccionBienvenida')?.classList.remove('hidden');
}

async function irACatalogoDocencia() {
  ocultarPantallasUsuario();
  return await renderizarCatalogoTrabajos('trabajos');
}

async function irAContenidoDocente(codigo = null) {
  ocultarPantallasUsuario();
  const cargado = await renderizarCatalogoTrabajos('contenido');
  if (cargado && codigo) abrirProgramaDocencia(codigo);
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
  if (!/^(INCI|INST|FILO|ETIC)(000|[0-9]{2}[0-9A-Z]{2})$/.test(valor)) return 'desconocido';
  if (valor.endsWith('000') && valor.length === 7) return 'area';
  if (/^(INCI|INST|FILO|ETIC)[0-9]{2}00$/.test(valor)) return 'unidad';
  if (/^(INCI|INST|FILO|ETIC)[0-9]{2}[0-9A-Z]0$/.test(valor)) return 'subunidad';
  return 'tema';
}
function padresCodigoDocencia(codigo) {
  const c=String(codigo||'').toUpperCase(),nivel=tipoUnidadDocencia(c);
  if(nivel==='desconocido')return null;
  return {
    area:c.slice(0,4)+'000',
    unidad:nivel==='area'?null:c.slice(0,6)+'00',
    subunidad:nivel==='area'||nivel==='unidad'?null:c.slice(0,7)+'0'
  };
}
async function consultarObjetivosDocencia() {
  const {data,error}=await sbApp.from('areas_docencia')
    .select('codigo,objetivo_general,paginas_fuente');
  if(error){console.warn('No se pudieron leer objetivos docentes:',error.message);return [];}
  return Array.isArray(data)?data:[];
}
async function consultarVinculosDocencia() {
  const {data,error}=await sbApp.from('modulos_temas').select('modulo_id,codigo');
  if(error){console.warn('No se pudieron leer asociaciones temáticas:',error.message);return [];}
  return Array.isArray(data)?data:[];
}

// Catálogo visual: unidades, subunidades y fichas de temas (no una lista plana).
// Cada vínculo surge de unidad_codigo de un trabajo activo en Supabase.
// Cuatro áreas > ocho unidades > veinticuatro subunidades > 139 temas.
// Objetivos fieles al documento; trabajos enlazados SOLO por códigos guardados.
function construirDirectorioUnidadesDocencia(unidades,trabajos,objetivos=[]) {
  if(!Array.isArray(unidades)||!unidades.length)return '';
  const ordenadas=[...unidades].sort((a,b)=>a.orden-b.orden);
  const mapa=new Map(ordenadas.map(u=>[u.codigo,u]));
  const objetivoPorCodigo=new Map((objetivos||[]).map(o=>[o.codigo,o]));
  const publicados=new Map();
  for(const m of Array.isArray(trabajos)?trabajos:[]){
    const codigos=[...new Set([m.unidad_codigo,...(m.codigos_tematicos||[])].filter(Boolean))];
    for(const c of codigos){
      if(!mapa.has(c))continue;
      if(!publicados.has(c))publicados.set(c,[]);
      if(!publicados.get(c).some(x=>x.id===m.id))publicados.get(c).push(m);
    }
  }
  const e=escaparTextoHTMLDocencia,relacionados=c=>publicados.get(c)||[];
  const tarjetaTrabajo=m=>'<button class="docencia-tarjeta-trabajo" type="button" data-modulo-id="'+e(m.id)+'">'+
    '<span class="docencia-trabajo-numero">Trabajo N.º '+e(m.numero_orden)+'</span>'+
    '<strong>'+e(m.titulo)+'</strong>'+
    '<span class="docencia-trabajo-acceso">Abrir trabajo ↗</span></button>';
  const tarjetasTrabajos=c=>relacionados(c).length?
    '<div class="docencia-grid-trabajos">'+relacionados(c).map(tarjetaTrabajo).join('')+'</div>':'';

  const temaHTML=t=>{
    const mods=relacionados(t.codigo),activo=mods.length>0;
    return '<article class="docencia-tarjeta-tema '+(activo?'disponible':'pendiente')+
      '" data-codigo-docencia="'+e(t.codigo)+'" tabindex="-1">'+
      '<span class="docencia-tema-codigo">'+e(t.codigo)+'</span>'+
      (mods.length===1?
        '<button type="button" class="docencia-tema-enlace" data-modulo-id="'+e(mods[0].id)+'">'+
        '<strong class="docencia-tema-titulo">'+e(t.detalle)+'</strong>'+
        '<span class="docencia-tema-acceso">Ver trabajo ↗</span></button>'
      : mods.length>1?
        '<strong class="docencia-tema-titulo">'+e(t.detalle)+'</strong>'+tarjetasTrabajos(t.codigo)
      : '<span class="docencia-tema-titulo">'+e(t.detalle)+'</span><span class="docencia-tema-pendiente">Tema por desarrollar</span>')+
      '</article>';
  };
  const etiqueta=n=>n===1?'1 trabajo disponible':n+' trabajos disponibles';
  const areas=ordenadas.filter(u=>tipoUnidadDocencia(u.codigo)==='area');
  const allAreas=areas.map((a,indice)=>{
    const objetivo=objetivoPorCodigo.get(a.codigo)?.objetivo_general||'Objetivo general en preparación.';
    const unidadesArea=ordenadas.filter(u=>tipoUnidadDocencia(u.codigo)==='unidad'&&u.codigo.slice(0,4)===a.codigo.slice(0,4));
    let totalArea=0;
    const unidadesHTML=unidadesArea.map(u=>{
      const subs=ordenadas.filter(s=>tipoUnidadDocencia(s.codigo)==='subunidad'&&
        padresCodigoDocencia(s.codigo)?.unidad===u.codigo);
      let totalUnidad=relacionados(u.codigo).length;
      const subsHTML=subs.map(sub=>{
        const temas=ordenadas.filter(t=>tipoUnidadDocencia(t.codigo)==='tema'&&
          padresCodigoDocencia(t.codigo)?.subunidad===sub.codigo);
        const totalSub=relacionados(sub.codigo).length+
          temas.reduce((n,t)=>n+relacionados(t.codigo).length,0);
        totalUnidad+=totalSub;
        return '<details class="catalogo-subunidad docencia-tarjeta-subunidad" data-codigo-docencia="'+e(sub.codigo)+'" '+(totalSub?'open':'')+'>'+
          '<summary class="catalogo-subunidad-titulo">'+
          '<span class="catalogo-subunidad-codigo">'+e(sub.codigo)+'</span>'+
          '<strong>'+e(sub.detalle)+'</strong>'+
          '<span class="catalogo-unidad-total">'+etiqueta(totalSub)+'</span>'+
          '<span class="catalogo-plegable-icono" aria-hidden="true">⌄</span></summary>'+
          '<div class="catalogo-subunidad-contenido">'+tarjetasTrabajos(sub.codigo)+
          '<div class="docencia-grid-temas">'+temas.map(temaHTML).join('')+'</div></div></details>';
      }).join('');
      totalArea+=totalUnidad;
      return '<details class="catalogo-unidad-grupo docencia-tarjeta-unidad" data-codigo-docencia="'+e(u.codigo)+'" '+(totalUnidad?'open':'')+'>'+
        '<summary class="catalogo-unidad-titulo">'+
        '<span class="catalogo-unidad-codigo">'+e(u.codigo)+'</span>'+
        '<strong>'+e(u.detalle)+'</strong>'+
        '<span class="catalogo-unidad-total">'+etiqueta(totalUnidad)+'</span>'+
        '<span class="catalogo-plegable-icono" aria-hidden="true">⌄</span></summary>'+
        '<div class="catalogo-unidad-contenido">'+tarjetasTrabajos(u.codigo)+
        '<div class="docencia-grid-subunidades">'+subsHTML+'</div></div></details>';
    }).join('');
    const presentacion='<article class="docencia-area-presentacion">'+
      '<span class="docencia-area-codigo">'+e(a.codigo)+'</span>'+
      '<h3>'+e(a.detalle)+'</h3>'+
      '<p class="docencia-area-etiqueta">Objetivo general</p>'+
      '<p class="docencia-area-objetivo">'+e(objetivo)+'</p>'+
      '<button class="docencia-area-ver" type="button" data-abrir-area="'+e(a.codigo)+'">Explorar unidades y temas <span aria-hidden="true">→</span></button>'+
      '</article>';
    const detalle='<details class="docencia-tarjeta-area" data-codigo-docencia="'+e(a.codigo)+'" '+(indice===0?'open':'')+'>'+
      '<summary class="docencia-area-desplegable">'+
      '<span class="docencia-area-codigo">'+e(a.codigo)+'</span>'+
      '<strong>'+e(a.detalle)+'</strong>'+
      '<span class="catalogo-unidad-total">'+etiqueta(totalArea)+'</span>'+
      '<span class="catalogo-plegable-icono" aria-hidden="true">⌄</span></summary>'+
      '<div class="docencia-area-contenido"><p class="docencia-area-objetivo-completo"><strong>Objetivo general: </strong>'+e(objetivo)+'</p>'+
      '<div class="docencia-grid-unidades">'+unidadesHTML+'</div></div></details>';
    return {presentacion,detalle};
  });
  return '<div class="docencia-areas-grid">'+allAreas.map(x=>x.presentacion).join('')+'</div>'+
    '<div class="docencia-areas-desarrollo">'+allAreas.map(x=>x.detalle).join('')+'</div>';
}

function expandirContenidoDocente(abrir) {
  document.getElementById('catalogoUnidadesContenido')?.querySelectorAll('details').forEach(d=>{d.open=!!abrir;});
}

function renderizarDirectorioUnidadesDocencia(unidades,trabajos,objetivos=[]) {
  const seccion=document.getElementById('catalogoDirectorioUnidades');
  const contenedor=document.getElementById('catalogoUnidadesContenido');
  if(!seccion||!contenedor)return;
  if(!Array.isArray(unidades)||!unidades.length){
    contenedor.replaceChildren();
    seccion.classList.add('hidden');
    return;
  }
  contenedor.innerHTML=construirDirectorioUnidadesDocencia(unidades,trabajos,objetivos);
  const conteo=document.getElementById('contenidoDocenteConteo');
  if(conteo)conteo.textContent=unidades.filter(u=>tipoUnidadDocencia(u.codigo)==='tema').length+' temas en el programa';
  seccion.classList.remove('hidden');
  contenedor.onclick=event=>{
    const boton=event.target.closest('button');
    if(!boton||!contenedor.contains(boton))return;
    if(boton.dataset.abrirArea){
      abrirProgramaDocencia(boton.dataset.abrirArea);
      return;
    }
    const id=boton.dataset.moduloId;
    if(id && listaModulos.some(m=>m.id===id))entrarADocenciaConModulo(id);
  };
}

function construirClasificacionTarjetaDocencia(codigosAsignados, unidadesPorCodigo) {
  const lista=Array.isArray(codigosAsignados)?codigosAsignados:[codigosAsignados];
  const codigos=[...new Set(lista.map(c=>String(c||'').trim().toUpperCase()))]
    .filter(c=>tipoUnidadDocencia(c)!=='desconocido' && unidadesPorCodigo.has(c));
  if(!codigos.length)return '';
  const padres=padresCodigoDocencia(codigos[0]);
  const unidad=padres?.unidad?unidadesPorCodigo.get(padres.unidad):null;
  const subunidad=padres?.subunidad?unidadesPorCodigo.get(padres.subunidad):null;
  if(!unidad || !subunidad)return '';

  // Cada código apunta al tema propio: un trazado puede abarcar 2 o más temas.
  const escapar=escaparTextoHTMLDocencia;
  const enlaces=codigos.map(c=>
    '<button type="button" class="grid-card-codigo-enlace" data-codigo-docencia="' +
    escapar(c) + '" aria-label="Ver tema '+escapar(c)+' en Docencia">'+
    escapar(c)+' <span aria-hidden="true">↗</span></button>').join('');
  return '<div class="grid-card-unidad">'+
    '<div class="grid-card-linea-unidad"><strong class="grid-card-unidad-nombre">'+escapar(unidad.detalle)+'</strong></div>'+
    '<div class="grid-card-subunidad">'+escapar(subunidad.detalle)+'</div>'+
    '<div class="grid-card-codigos">'+enlaces+'</div></div>';
}

// El código de la tarjeta conduce al programa docente, no al lector del trabajo.
// Abre su unidad/subunidad, enfoca la tarjeta del tema y desplaza a esa sección.
function abrirProgramaDocencia(codigoSolicitado) {
  const codigo = String(codigoSolicitado || '').trim().toUpperCase();
  if(tipoUnidadDocencia(codigo)==='desconocido')return;

  const seccion = document.getElementById('catalogoDirectorioUnidades');
  const contenido = document.getElementById('catalogoUnidadesContenido');
  if (!seccion || !contenido || seccion.classList.contains('hidden')) return;

  contenido.querySelectorAll('.docencia-enfoque')
    .forEach(elemento => elemento.classList.remove('docencia-enfoque'));

  const padres=padresCodigoDocencia(codigo);
  const codigoUnidad=padres.unidad;
  const codigoSub=padres.subunidad;
  const codigoArea=padres.area;
  const buscar = (clase,valor) =>
    contenido.querySelector('.' + clase + '[data-codigo-docencia="' + valor + '"]');
  const area = buscar('docencia-tarjeta-area',codigoArea);
  if(area)area.open=true;
  const unidad = codigoUnidad?buscar('docencia-tarjeta-unidad',codigoUnidad):null;
  const subunidad = codigoSub ? buscar('docencia-tarjeta-subunidad',codigoSub) : null;
  if (unidad) unidad.open = true;
  if (subunidad) subunidad.open = true;

  const destino = buscar('docencia-tarjeta-tema',codigo) ||
    buscar('docencia-tarjeta-subunidad',codigo) ||
    buscar('docencia-tarjeta-unidad',codigo) ||
    buscar('docencia-tarjeta-area',codigo) || unidad || area || seccion;
  destino.classList.add('docencia-enfoque');
  if (!destino.hasAttribute('tabindex')) destino.setAttribute('tabindex','-1');
  destino.scrollIntoView({behavior:'smooth',block:'center'});
  destino.focus({preventScroll:true});
}

async function renderizarCatalogoTrabajos(vista = 'trabajos') {
  const solicitud = ++versionNavegacion;
  const usuarioId = usuarioActual?.id;
  const vigente = () => solicitud === versionNavegacion && usuarioActual?.id === usuarioId;
  const destino = vista === 'contenido' ? 'seccionContenidoDocente' : 'seccionCatalogoTrabajos';
  const seccion = document.getElementById(destino);
  let estado = seccion.querySelector('[data-estado-catalogo]');
  if (!estado) {
    estado = document.createElement('div');
    estado.dataset.estadoCatalogo = '';
    estado.className = 'estado-carga-catalogo';
    estado.setAttribute('role', 'status');
    estado.setAttribute('aria-live', 'polite');
    (seccion.querySelector('main') || seccion).prepend(estado);
  }
  estado.replaceChildren();
  estado.textContent = 'Cargando contenidos…';
  estado.hidden = false;
  seccion.classList.remove('hidden');
  seccion.setAttribute('aria-busy', 'true');
  try {
  const { data: dataModulos, error } = await sbApp
    .from('modulos')
    .select('*')
    .eq('activo', true)
    .order('numero_orden', { ascending: false });

  if (!vigente()) return false;
  if (error || !dataModulos) throw error || new Error('Catálogo no disponible');

  await refrescarProgresosUsuario();
  const unidades = await consultarUnidadesDocencia();
  if (!unidades) throw new Error('No se pudo cargar el programa docente.');
  const unidadesPorCodigo = new Map((unidades || []).map(u => [u.codigo, u]));
  const [objetivos,relaciones]=await Promise.all([
    consultarObjetivosDocencia(),consultarVinculosDocencia()
  ]);
  if (!vigente()) return false;
  const codigosPorModulo=new Map();
  for(const r of relaciones){
    if(!codigosPorModulo.has(r.modulo_id))codigosPorModulo.set(r.modulo_id,[]);
    codigosPorModulo.get(r.modulo_id).push(r.codigo);
  }

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
    void irAContenidoDocente(boton.dataset.codigoDocencia);
  };

  listaModulos.forEach(m => {
    const prog = misProgresos[m.id];
    let badgeHtml = `<span class="badge-estado badge-pen">Pendiente</span>`;
    if (prog && prog.completado) {
      badgeHtml = `<span class="badge-estado badge-ok">✓ Completado</span>`;
    } else if (prog && prog.leido) {
      badgeHtml = `<span class="badge-estado" style="background:#FEF3C7;color:#92400E;">En Curso</span>`;
    }

    const codigos=[m.unidad_codigo,...(codigosPorModulo.get(m.id)||[])].filter(Boolean);
    m.codigos_tematicos=[...new Set(codigos)];
    const bloqueUnidad = construirClasificacionTarjetaDocencia(m.codigos_tematicos, unidadesPorCodigo);

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

  renderizarDirectorioUnidadesDocencia(unidades, listaModulos, objetivos);
  estado.hidden = true;
  return true;
  } catch (error) {
    if (!vigente()) return false;
    estado.textContent = mensajeErrorServicio(error, 'carga del catálogo') + ' ';
    const reintentar = document.createElement('button');
    reintentar.type = 'button';
    reintentar.textContent = 'Reintentar';
    reintentar.addEventListener('click', () => { void renderizarCatalogoTrabajos(vista); });
    estado.append(reintentar);
    return false;
  } finally {
    if (vigente()) seccion.setAttribute('aria-busy', 'false');
  }
}

function entrarADocenciaConModulo(idModulo) {
  versionNavegacion++;
  document.getElementById('seccionContenidoDocente')?.classList.add('hidden');
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
  document.getElementById('seccionContenidoDocente')?.classList.add('hidden');
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
    "tipo": "introduccion",
    "titulo": "Propósito y sentido de la docencia",
    "subtitulo": "",
    "texto": "La docencia del Tercer Grado encuentra su sentido en una convicción fundamental: **el conocimiento masónico exige comprensión, reflexión y coherencia de conducta**. Desde esta perspectiva, el estudio no persigue la mera acumulación de nociones doctrinales, sino el perfeccionamiento de quien las recibe, interpreta y procura vivir conforme a ellas.\n\nEste espacio surge de la necesidad de fortalecer y dar continuidad a la labor docente del Tercer Grado mediante una plataforma digital de aprendizaje asincrónico, destinada a los Maestros del Taller. Su propósito es facilitar el acceso permanente a los contenidos formativos, permitiendo que cada Hermano pueda estudiarlos, revisarlos y profundizar en ellos de acuerdo con su disponibilidad y ritmo personal, sin las restricciones de un horario común. De este modo, la docencia trasciende las instancias presenciales de formación y encuentra una oportunidad adicional para mantenerse activa en la vida cotidiana del Maestro.\n\nJunto con presentar el sentido y los objetivos de este espacio, compartimos una reflexión sobre los principios y lineamientos generales que deben orientar el estudio y la investigación personal en el Tercer Grado. Esta labor comprende la profundización en sus fundamentos éticos, simbólicos, filosóficos e institucionales, procurando que el conocimiento adquirido no permanezca únicamente en el ámbito intelectual, sino que contribuya al discernimiento, al perfeccionamiento moral y a la práctica consciente de las enseñanzas masónicas.\n\nFinalmente, este espacio aspira a que las reflexiones surgidas del estudio individual encuentren una expresión colectiva en el **Muro Docente**, concebido como un lugar de encuentro e intercambio fraternal. Allí, las distintas perspectivas podrán enriquecer la comprensión de los temas estudiados, fortalecer el diálogo entre Hermanos y contribuir a la construcción de una reflexión compartida que **dé unidad, continuidad y sentido al trabajo docente de la Columna de Maestros**."
  },
  {
    "tipo": "fundamento",
    "titulo": "Naturaleza y sentido de la docencia",
    "subtitulo": "La formación del Maestro como tarea permanente",
    "texto": "La condición de Maestro no señala el término del aprendizaje masónico, sino una responsabilidad más consciente frente a él. Profundizar en los símbolos, el ritual y los deberes de la Maestría supone interrogar su significado, confrontarlo con la propia experiencia y reconocer cuánto resta por perfeccionar en uno mismo.\n\nEste espacio, reservado al trabajo docente de la Cámara de Maestros, acompaña esa labor mediante el estudio personal de los trazados y la reflexión fraterna acerca de su aplicación en la vida dentro y fuera de la Logia. Su soporte digital facilita la continuidad del aprendizaje; **no reemplaza la enseñanza compartida ni el ejercicio personal de la virtud**, sino que constituye un recurso de apoyo que reúne los contenidos docentes y los pone a disposición de cada Maestro para que pueda estudiarlos a su propio tiempo y ritmo.\n\nEl propósito es que cada enseñanza pueda convertirse, progresivamente, en criterio de juicio y orientación para la acción."
  },
  {
    "tipo": "fundamento",
    "titulo": "Propósito formativo y objetivos",
    "subtitulo": "Comprender, discernir y obrar con coherencia",
    "texto": "La docencia procura una comprensión fundada de los contenidos del Tercer Grado y de sus implicancias éticas, filosóficas y simbólicas. Esa comprensión debe favorecer una conciencia esclarecida, capaz de discernir, examinar las propias convicciones y enfrentar con mayor responsabilidad los dilemas que plantea la vida individual y colectiva.\n\nPor ello, el estudio propuesto, las preguntas formativas y la participación en el Muro Docente no constituyen fines en sí mismos: permiten revisar el entendimiento alcanzado, descubrir nuevas interrogantes y elaborar reflexiones que puedan enriquecer el diálogo entre Hermanos.\n\n**El resultado más valioso no es la respuesta acertada, sino la relación honesta entre lo que se comprende, lo que se proclama y lo que se hace.**\n\nLos contenidos de este espacio son elaborados por Maestros de la Logia, procurando mantener su concordancia con el programa de docencia vigente de la Gran Logia de Chile, así como con sus principios y orientaciones formativas."
  },
  {
    "tipo": "fundamento",
    "titulo": "Método de estudio y reflexión",
    "subtitulo": "Tres momentos de una misma labor formativa",
    "texto": "Esta plataforma propone tres momentos complementarios de una misma labor formativa, sin reducir el aprendizaje a una secuencia mecánica:\n\n**a) Lectura comprensiva.** Cada trazado se estudia con atención, buscando comprender sus argumentos, símbolos y enseñanzas esenciales. El tiempo dedicado a la lectura favorece la concentración, pero no sustituye la profundidad de la reflexión.\n\n**b) Evaluación formativa.** Una serie de preguntas invita a revisar la comprensión del tema y a considerar sus implicancias éticas. Su función es favorecer el discernimiento y reconocer los aspectos que requieren mayor estudio, no establecer jerarquías personales entre quienes participan ni distinguir a los Hermanos por la cantidad de respuestas acertadas.\n\n**c) Reflexión y participación.** El Maestro elabora su propia reflexión a partir del trabajo estudiado. Al completar un trabajo conforme a las reglas de la plataforma, puede participar en el **Muro Docente**, donde el intercambio fraternal permite contrastar perspectivas, compartir experiencias y enriquecer el aprendizaje común.\n\nLas tres fases son complementarias: **leer para comprender, examinar para discernir y reflexionar para obrar con mayor conciencia**."
  },
  {
    "tipo": "fundamento",
    "titulo": "El sentido de la Maestría",
    "subtitulo": "La responsabilidad de hacer vida lo aprendido",
    "texto": "La Maestría no se justifica por la sola posesión de un grado. Su valor se manifiesta en la responsabilidad de quien procura ejercerlo con prudencia, rectitud, templanza y espíritu fraternal.\n\nEllo exige una disposición permanente a revisar el propio juicio antes de juzgar al otro, sostener la palabra comprometida, reconocer los errores y actuar con respeto aun frente a la discrepancia.\n\nPor ello, la enseñanza masónica adquiere verdadero significado cuando deja de ser únicamente materia de estudio y se hace reconocible en las relaciones humanas, en el cumplimiento del deber y en la conducta dentro y fuera del Templo.\n\n**La docencia, entonces, no pretende definir al Maestro ideal, sino contribuir al trabajo constante de llegar a serlo.**"
  },
  {
    "tipo": "cierre",
    "titulo": "Invitación a la reflexión",
    "subtitulo": "",
    "texto": "Esperamos que este espacio constituya un aporte significativo a tu formación como Maestro y un estímulo permanente para profundizar en el conocimiento, la reflexión y el perfeccionamiento personal.\n\nQue cada trabajo estudiado sea una oportunidad para examinar nuestras convicciones, enriquecer nuestro discernimiento y fortalecer la coherencia entre lo que pensamos, expresamos y hacemos.\n\n**Te invitamos a compartir con tus Hermanos las reflexiones que surjan de este aprendizaje, contribuyendo así a un diálogo fraterno, respetuoso y enriquecedor, donde el conocimiento compartido fortalezca nuestra labor docente y el compromiso común con los ideales de la Orden.**"
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
  versionNavegacion++;
  ['seccionBienvenida', 'seccionCatalogoTrabajos', 'seccionContenidoDocente', 'seccionDocencia', 'seccionMuroUsuarios']
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

  let numeroFundamento = 0;
  visibles.forEach((b, i) => {
    const id = 'espacio-bloque-' + (i + 1);
    const titulo = String(b.titulo || 'Fundamento ' + (i + 1));
    const tipo = ['introduccion','fundamento','cierre'].includes(b.tipo) ? b.tipo : 'fundamento';
    const card = document.createElement('section');
    card.id = id;
    card.className = 'institucional-bloque espacio-bloque espacio-tipo-' + tipo;
    card.tabIndex = -1;
    card.setAttribute('aria-labelledby', id + '-titulo');

    if (tipo === 'fundamento') {
      numeroFundamento++;
      const numero = document.createElement('span');
      numero.className = 'espacio-bloque-numero';
      numero.textContent = String(numeroFundamento).padStart(2, '0');
      numero.setAttribute('aria-hidden', 'true');
      card.appendChild(numero);
    }
    const title = document.createElement('h3');
    title.id = id + '-titulo';
    title.textContent = (tipo==='fundamento' ? numeroFundamento+'. ' : '') + titulo;
    card.appendChild(title);
    if (String(b.subtitulo || '').trim()) {
      const subtitle = document.createElement('h4');
      subtitle.textContent = String(b.subtitulo);
      card.appendChild(subtitle);
    }
    // Texto editorial: párrafos separados, negritas **...** y texto seguro.
    for (const textoParrafo of String(b.texto || '').split(/\n\s*\n/)) {
      if (!textoParrafo.trim()) continue;
      const paragraph = document.createElement('p');
      paragraph.className = 'espacio-bloque-texto';
      const fragmentos = textoParrafo.split(/(\*\*[^*]+\*\*)/g);
      for (const fragmento of fragmentos) {
        if (fragmento.startsWith('**') && fragmento.endsWith('**')) {
          const strong = document.createElement('strong');
          strong.textContent = fragmento.slice(2, -2);
          paragraph.appendChild(strong);
        } else {
          paragraph.appendChild(document.createTextNode(fragmento));
        }
      }
      card.appendChild(paragraph);
    }
    cont.appendChild(card);

    const enlace = document.createElement('button');
    enlace.type = 'button';
    enlace.className = 'espacio-indice-link' + (tipo!=='fundamento' ? ' espacio-indice-'+tipo : '');
    enlace.textContent = (tipo==='fundamento' ? numeroFundamento+'. ' : '') + titulo;
    enlace.setAttribute('aria-label', 'Ir a ' + titulo);
    enlace.addEventListener('click', () => {
      card.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      card.focus({ preventScroll: true });
    });
    indice.appendChild(enlace);
  });
}

/* ==========================================================================
   MURO Y FORO DE REFLEXIONES
   ========================================================================== */
async function mostrarMuroReflexionesUsuarios() {
  const solicitud = ++versionNavegacion;
  await refrescarProgresosUsuario();
  if (solicitud !== versionNavegacion) return;
  const accesoMuro = Object.values(misProgresos).some(p => p?.completado === true);
  if (!usuarioActual || usuarioActual.es_admin || !accesoMuro) {
    alert('El Muro y Foro se habilita al completar al menos un trabajo de la Cámara.');
    return;
  }
  document.getElementById('seccionDocencia').classList.add('hidden');
  document.getElementById('seccionCatalogoTrabajos').classList.add('hidden');
    document.getElementById('seccionContenidoDocente')?.classList.add('hidden');
  document.getElementById('seccionDocenciaInstitucional').classList.add('hidden');
  
  const cont = document.getElementById('contenedorMuroUsuariosDirecto');
  let borradores;
  const actorMuro = usuarioActual;
  if (!cont.innerHTML) cont.innerHTML = "<p class='td-loading'>Recuperando aportes de la Cámara...</p>";
  document.getElementById('seccionMuroUsuarios').classList.remove('hidden');

  await refrescarProgresosUsuario();

  const {data: muro,error}=await sbApp.rpc('muro_docente_autorizado',{p_modulo:null});
  if (solicitud !== versionNavegacion || usuarioActual !== actorMuro) return;
  const aportes=muro?.aportes;

  if (error || !aportes) {
    if (window.mostrarEstadoHilos) window.mostrarEstadoHilos(cont, 'No se pudo actualizar el muro. Sus borradores se conservan; vuelva a abrirlo para reintentar.');
    else cont.innerHTML = '<p>No se pudo cargar el muro.</p>';
    return;
  }
  borradores = window.capturarBorradoresComentarios?.(cont);
  cont.innerHTML = '';

  let comentariosMap = {};
  const comentariosData=muro?.comentarios;

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
        const comentariosHtml = window.renderizarHilosComentarios?.(comentariosDeEstaReflexion, it.id, m.id, 'general') || '';

        return `
          <div class="reflexion-item" style="margin-bottom: 20px; border-left: 3px solid var(--accent-gold); padding: 18px 20px; border-radius: 0 6px 6px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span class="reflexion-autor">${escaparTextoHTMLDocencia(formatearNombreHermano(it.usuarios?.nombre, 'Hermano Maestro'))}</span>
              <span style="font-size: 0.78rem; color: var(--text-muted); font-family: var(--font-ui);">${fechaTxt}</span>
            </div>
            <div style="font-size: 1rem; line-height: 1.6; font-style: italic; margin-bottom: 8px;">"${escaparTextoHTMLDocencia(it.reflexion)}"</div>
            
            <button class="foro-btn-toggle-comentar" onclick="toggleFormularioComentario('${it.id}', 'general_')">
              💬 Comentarios (${comentariosDeEstaReflexion.length})
            </button>

            <div id="general_caja_comentario_${it.id}" class="foro-comentar-caja hidden">
              <textarea id="general_input_comentario_${it.id}" name="general_input_comentario_${it.id}" rows="3" class="foro-comentar-input" placeholder="Escriba su comentario aquí..."></textarea>
              <div style="display: flex; justify-content: flex-end; gap: 8px;">
                <button class="btn-secondary" style="padding: 6px 12px; font-size: 0.85rem;" onclick="toggleFormularioComentario('${it.id}', 'general_')">Cancelar</button>
                <button class="btn-primary" style="padding: 6px 14px; font-size: 0.85rem; width: auto;" onclick="enviarComentarioForo('${it.id}', '${m.id}', 'general_')">Publicar</button>
              </div>
            </div>

            <div class="foro-comentarios-wrapper" id="general_lista_comentarios_${it.id}">
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
  window.restaurarBorradoresComentarios?.(cont, borradores);
}

/* ==========================================================================
   GESTIÓN DE COMENTARIOS DEL FORO
   ========================================================================== */
function toggleFormularioComentario(progresoId, ambito = '') {
  const caja = document.getElementById(`${ambito}caja_comentario_${progresoId}`);
  if (caja) {
    caja.classList.toggle('hidden');
    if (!caja.classList.contains('hidden')) {
      const txt = document.getElementById(`${ambito}input_comentario_${progresoId}`);
      if (txt) txt.focus();
    }
  }
}

async function enviarComentarioForo(progresoId, moduloId, ambito = '') {
  const input = document.getElementById(`${ambito}input_comentario_${progresoId}`);
  if (!input) return;

  const texto = input.value.trim();
  if (texto.length < 5) {
    alert("Q.·.H.·., favor ingrese un comentario con contenido.");
    return;
  }

  // La RPC confirma la persistencia y valida identidad, progreso y límites
  // antes de anunciar el comentario como publicado. No recolectar IP externa.
  const { data: comentarioId, error } = await sbApp.rpc('maestro_publicar_comentario', {
    p_progreso_id: progresoId,
    p_contenido: texto
  });
  if (error || !comentarioId) {
    alert("No se guardó el comentario: " + (error?.message || "No hubo confirmación del servidor.") + " El texto permanece disponible para reintentar.");
  } else {
    input.value = "";
    toggleFormularioComentario(progresoId, ambito);
    
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
  document.getElementById('estadoEditarComentario').textContent = '';
  const dialogo = document.getElementById('modalEditarComentarioForo');
  dialogo.classList.remove('hidden');
  if (!dialogo.open) dialogo.showModal();
  document.getElementById('textareaEditarComentario').focus();
}

async function guardarEdicionComentarioModal() {
  const boton = document.getElementById('btnGuardarEdicionComentario');
  if (boton.disabled) return;
  const id = document.getElementById('editComentarioId').value;
  const input = document.getElementById('textareaEditarComentario');
  const texto = input.value.trim();
  const estado = document.getElementById('estadoEditarComentario');
  if (texto.length < 5 || texto.length > 1500) {
    estado.textContent = 'Escriba entre 5 y 1500 caracteres.';
    return;
  }
  const actor = usuarioActual;
  boton.disabled = true;
  estado.textContent = 'Guardando comentario…';
  try {
    const { data: guardado, error } = await sbApp.rpc('maestro_editar_comentario_propio', {
      p_comentario_id: id, p_contenido: texto
    });
    if (error || !guardado) throw new Error(error?.message || 'No se pudo confirmar el guardado.');
    if (usuarioActual !== actor) return;
    cerrarModalUniversalDirecto('modalEditarComentarioForo');
    const seccionMuroUsuarios = document.getElementById('seccionMuroUsuarios');
    if (seccionMuroUsuarios && !seccionMuroUsuarios.classList.contains('hidden')) {
      await mostrarMuroReflexionesUsuarios();
    } else if (moduloActual && !document.getElementById('seccionDocencia').classList.contains('hidden')) {
      await cargarMuroReflexiones();
    }
  } catch (error) {
    if (usuarioActual === actor) estado.textContent = (error.message || 'No se pudo confirmar la edición.') + ' Su texto se conserva.';
  } finally {
    boton.disabled = false;
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
  const usuarioId=usuarioActual?.id;
  if(!usuarioId)return false;
  const {data,error}=await sbApp.from('progreso_maestro').select('*').eq('usuario_id',usuarioId);
  if(error||!Array.isArray(data)){console.warn('No se pudo actualizar el avance; se conservan los datos anteriores.');return false;}
  if(usuarioActual?.id!==usuarioId)return false;
  misProgresos=Object.fromEntries(data.map(p=>[p.modulo_id,p]));
  return true;
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
  document.getElementById('bloqueMuro').classList.add('hidden');
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

    document.getElementById('bloqueMuro').classList.remove('hidden');
    await cargarMuroReflexiones();
    return;
  }

  if (prog && prog.leido && cuestionarioRespondido(prog.respuestas_evaluacion,moduloActual.preguntas_json?.preguntas||[])) {
    respuestasMarcadas = {...prog.respuestas_evaluacion};
    contConfLectura.classList.add('hidden');
    bloqueFaseDos.classList.add('hidden');
    bloqueFaseTres.classList.remove('hidden');
    btnCert.classList.add('hidden');
    txtRef.value=prog.reflexion || '';
    txtRef.disabled=false;
    btnConsagrar.classList.remove('hidden');
    btnEditar.classList.add('hidden');
    document.getElementById('bloqueMuro').classList.add('hidden');
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

async function guardarProgresoDocente(cambios) {
  const usuarioId=usuarioActual?.id, moduloId=moduloActual?.id;
  if(!usuarioId||!moduloId||usuarioActual.es_admin)throw new Error('Sesión docente no disponible.');
  const {data:anterior,error:consultaError}=await sbApp.from('progreso_maestro')
    .select('*').eq('usuario_id',usuarioId).eq('modulo_id',moduloId).maybeSingle();
  if(consultaError)throw new Error('No se pudo consultar el avance. Sus respuestas se conservan en pantalla.');
  const consulta=anterior
    ? sbApp.from('progreso_maestro').update(cambios).eq('id',anterior.id).eq('usuario_id',usuarioId)
    : sbApp.from('progreso_maestro').insert({usuario_id:usuarioId,modulo_id:moduloId,reflexion:'',completado:false,...cambios});
  const {data:guardado,error}=await consulta.select('*').single();
  if(error||!guardado)throw new Error('No se pudo guardar el avance. Revise la conexión y vuelva a intentar.');
  if(usuarioActual?.id!==usuarioId||moduloActual?.id!==moduloId)
    throw new Error('El avance se guardó en el trabajo anterior. Vuelva a abrirlo para continuar.');
  misProgresos[moduloId]=guardado;
  return guardado;
}
function cuestionarioRespondido(respuestas,preguntas) {
  return preguntas.length===8 && preguntas.every((_p,i)=>['A','B','C','D'].includes(respuestas?.[i]));
}

async function confirmarLecturaFaseUno() {
  const btn = document.getElementById('btnConfirmarLectura');
  btn.disabled = true;
  btn.innerText = "Registrando lectura...";

  try {
    await guardarProgresoDocente({leido:true});
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

  const totalPreguntas = moduloActual.preguntas_json?.preguntas?.length || 0;
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
    const preguntas=moduloActual.preguntas_json?.preguntas || [];
    if(!cuestionarioRespondido(respuestasMarcadas,preguntas))
      throw new Error('Debe responder las ocho preguntas antes de finalizar.');
    await guardarProgresoDocente({respuestas_evaluacion:respuestasMarcadas,intentos_preguntas:preguntas.length,leido:true});
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

  const boton=document.getElementById('btnConsagrarReflexion');
  if(boton?.disabled)return;
  if(boton)boton.disabled=true;
  try {
    const anterior=misProgresos[moduloActual.id];
    const respuestas=cuestionarioRespondido(respuestasMarcadas,moduloActual.preguntas_json?.preguntas||[])
      ? respuestasMarcadas : anterior?.respuestas_evaluacion;
    if(!cuestionarioRespondido(respuestas,moduloActual.preguntas_json?.preguntas||[]))
      throw new Error('Complete primero las ocho preguntas. Su reflexión se mantiene en pantalla.');
    await guardarProgresoDocente({
      respuestas_evaluacion:respuestas,intentos_preguntas:8,reflexion:texto,leido:true,completado:true,
      completado_en:anterior?.completado_en || new Date().toISOString()
    });
    renderizarSidebar();
    await evaluarEstadoFasesModulo();
    alert('Reflexión guardada y módulo completado.');
  } catch(error) {
    alert(error.message || 'No se pudo guardar la reflexión. Vuelva a intentar.');
  } finally {
    if(boton)boton.disabled=false;
  }
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
  let borradores;
  const contextoMuro = moduloActual, actorMuro = usuarioActual;
  if (!contenedor.innerHTML) contenedor.innerHTML = "<p class='td-loading'>Cargando aportes de la Cámara...</p>";

  const {data: muro,error}=await sbApp.rpc('muro_docente_autorizado',{p_modulo:moduloActual.id});
  if (moduloActual !== contextoMuro || usuarioActual !== actorMuro) return;
  const data=muro?.aportes;

  if(error || !Array.isArray(data)){
    if (window.mostrarEstadoHilos) window.mostrarEstadoHilos(contenedor, 'No se pudo actualizar el muro. Sus borradores se conservan; vuelva a abrirlo para reintentar.');
    else contenedor.innerHTML='<p>No se pudo cargar el muro. Vuelva a abrirlo para reintentar.</p>';
    return;
  }
  borradores = window.capturarBorradoresComentarios?.(contenedor);
  contenedor.innerHTML = '';
  if (data && data.length > 0) {
    let comentariosMap = {};
    const comentariosData=muro?.comentarios;

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
      const comsHtml = window.renderizarHilosComentarios?.(coms, item.id, moduloActual.id) || '';

      contenedor.innerHTML += `
        <div class="reflexion-item" style="margin-bottom: 20px;">
          <div class="reflexion-autor">${escaparTextoHTMLDocencia(formatearNombreHermano(item.usuarios?.nombre, 'Hermano Maestro'))}</div>
          <div style="font-style: italic; margin-bottom: 8px;">"${escaparTextoHTMLDocencia(item.reflexion)}"</div>
          
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
  window.restaurarBorradoresComentarios?.(contenedor, borradores);
}

/* ==========================================================================
   MIS AVANCES E INFORME
   ========================================================================== */
function desplazarInformeAvances(seccion) {
  const modal = document.getElementById('modalMisAvances');
  const contenedor = modal?.querySelector('.modal-certificado-wrapper');
  if (!contenedor || modal.classList.contains('hidden')) return;
  const destinos = {
    inicio: document.getElementById('documentoInformeAvance'),
    detalle: document.getElementById('tituloDetalleAvances'),
    certificados: document.getElementById('seccionCertificadosDisponibles')
  };
  const destino = destinos[seccion];
  if (!destino) return;
  const offset = destino.getBoundingClientRect().top - contenedor.getBoundingClientRect().top;
  const margen = seccion === 'inicio' ? 0 : 82;
  contenedor.scrollTo({ top: Math.max(0, contenedor.scrollTop + offset - margen), behavior: 'smooth' });
}

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
  document.querySelector('#modalMisAvances .modal-certificado-wrapper')?.scrollTo({ top: 0 });
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
  const nombreLimpio = limpiarTratamientoHermano(userTarget.nombre);

  document.getElementById('certNombreHermano').innerText = formatearNombreHermano(nombreLimpio);
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
  // Solo un clic directo sobre el fondo, nunca sobre los controles interiores.
  const fondo=document.getElementById(modalId);
  if(event?.target===fondo){
    cerrarModalUniversalDirecto(modalId);
    // No llamar cambiarSubseccionAdmin: el modal no tiene sección propia.
  }
}

function cerrarModalUniversalDirecto(modalId) {
  const el = document.getElementById(modalId);
  if (el) {
    if (el.tagName === 'DIALOG' && el.open) el.close();
    el.classList.add('hidden');
  }
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
      if (el && !el.classList.contains('hidden')) cerrarModalUniversalDirecto(id);
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
  const actor=usuarioActual;
  const { data: mods, error: errorModulos } = await sbApp
    .from('modulos')
    .select('*')
    .eq('activo', true)
    .order('numero_orden', { ascending: true });
  if(usuarioActual!==actor || !actor?.es_admin)return;
  if(errorModulos){
    console.warn('[Admin] No fue posible cargar el catálogo de trabajos');
    return;
  }
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

  // Cargar los selectores nunca cambia de pantalla: la navegación es exclusiva
  // de acciones explícitas del usuario o del ingreso inicial.
}

function cambiarSubseccionAdmin(seccion) {
  // Fuente única de las doce vistas: id del botón, título, id de la sección.
  const vistasAdmin = {
    resumen:['tabNavResumen','Resumen ejecutivo','adminSeccionResumen'],
    usuarios:['tabNavUsuarios','Usuarios y padrón','adminSeccionUsuarios'],
    cargar:['tabNavCargar','Archivos originales','adminSeccionCarga'],
    gestion_trabajos:['tabNavGestionTrabajos','Trabajos y cuestionarios','adminSeccionGestionTrabajos'],
    presencial:['tabNavPresencial','Cámara presencial','adminSeccionPresencial'],
    muro_general:['tabNavMuroGeneral','Muro docente','adminSeccionMuroGeneral'],
    metricas:['tabNavMetricas','Avance de los maestros','adminSeccionMetricas'],
    editor_doctrina:['tabNavEditorDoctrina','Contenido institucional','adminSeccionEditorDoctrina'],
    tenidas:['tabNavTenidas','Calendario de tenidas','adminSeccionTenidas'],
    asignaciones:['tabNavAsignaciones','Asignación de trabajos','adminSeccionAsignaciones'],
    doctrina:['tabNavDoctrina','Doctrina y Reglamentos','adminSeccionDoctrina'],
    accesos:['tabNavAccesos','Bitácora de accesos','adminSeccionAccesos']
  };
  if (!Object.prototype.hasOwnProperty.call(vistasAdmin, seccion)) return;
  const [botonActual, tituloActual, panelActual] = vistasAdmin[seccion];
  Object.values(vistasAdmin).forEach(([id]) => {
    const boton = document.getElementById(id);
    if (id === botonActual) boton?.setAttribute('aria-current', 'page');
    else boton?.removeAttribute('aria-current');
  });
  const tituloVista = document.getElementById('adminVistaActual');
  if (tituloVista) tituloVista.textContent = tituloActual;
  const menuAdmin = document.getElementById('adminNavegacion');
  if (window.matchMedia('(max-width: 960px)').matches && menuAdmin) {
    const focoEnMenu = menuAdmin.contains(document.activeElement);
    menuAdmin.open = false;
    if (focoEnMenu) tituloVista?.focus({ preventScroll: true });
  }

  // Un solo mapa determina las doce vistas, sus botones, encabezados y paneles.
  // Cerrar el panel anterior y activar uno solo; las cargas nunca navegan.
  Object.values(vistasAdmin).forEach(([id,,panel])=>{
    document.getElementById(id)?.classList.remove('active');
    document.getElementById(panel)?.classList.add('hidden');
  });
  document.getElementById(botonActual)?.classList.add('active');
  document.getElementById(panelActual)?.classList.remove('hidden');

  if (seccion === 'tenidas') {
    void window.cargarCalendarioTenidas?.();
  } else if (seccion === 'asignaciones') {
    void window.cargarAsignacionesAdmin?.();
  } else if (seccion === 'doctrina') {
    void cargarBibliotecaDoctrina();
  } else if (seccion === 'resumen') {
    cargarResumenAdmin();
  } else if (seccion === 'usuarios') {
    cargarListadoUsuariosAdmin();
  } else if (seccion === 'cargar') {
  } else if (seccion === 'gestion_trabajos') {
    cargarGestionTrabajosAdmin();
  } else if (seccion === 'presencial') {
  } else if (seccion === 'muro_general') {
    cargarMuroGeneralAdmin();
  } else if (seccion === 'editor_doctrina') {
    cargarEditorDoctrinaAdmin();
  } else if (seccion === 'accesos') {
    cargarBitacoraAccesos();
  } else if (seccion === 'metricas') {
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
    void window.notificarPublicacionesAdmin?.();
  }
}

/* ==========================================================================
   BITÁCORA DE ACCESOS
   ========================================================================== */
async function cargarBitacoraAccesos(filtroUsuarioId = null) {
  const tbody = document.getElementById('tablaAccesosBody');
  tbody.innerHTML = `<tr><td colspan="7" class="td-loading">Consultando registros...</td></tr>`;

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

  if (error) {
    tbody.innerHTML = '<tr><td colspan="7">No fue posible consultar la bitácora. Pulse Actualizar para reintentar.</td></tr>';
    return;
  }
  if (!registros || registros.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); font-style: italic;">No hay ingresos registrados para el criterio seleccionado.</td></tr>`;
    return;
  }

  const ocultarAdmin = document.getElementById('ocultarAdminAccesos')?.checked === true;
  let registrosVisibles = registros;
  if (ocultarAdmin) {
    const { data: admins, error: adminError } = await sbApp.from('usuarios').select('id,email,es_admin');
    if (adminError) {
      tbody.innerHTML = '<tr><td colspan="7">No fue posible aplicar el filtro de administrador.</td></tr>';
      return;
    }
    const idsAdmin = new Set((admins || [])
      .filter(u => u.es_admin === true || String(u.email || '').trim().toLowerCase() === 'dummy@ofl.cl')
      .map(u => u.id));
    registrosVisibles = registros.filter(r => !idsAdmin.has(r.usuario_id));
  }
  if (!registrosVisibles.length) {
    tbody.innerHTML = '<tr><td colspan="7">Sin registros para el filtro seleccionado.</td></tr>';
    return;
  }
  registrosVisibles.forEach(r => {
    const d = new Date(r.creado_en || r.fecha_acceso);
    const fechaTxt = d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone:'America/Santiago' });
    const horaTxt = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone:'America/Santiago' });

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
    const actividadCell = document.createElement('td');
    actividadCell.textContent = r.ultima_actividad_en
      ? new Date(r.ultima_actividad_en).toLocaleString('es-CL',{timeZone:'America/Santiago'}) : 'Sin medición histórica';
    const duracionCell = document.createElement('td');
    duracionCell.textContent = r.segundos_activos == null ? 'Sin medición histórica'
      : Math.floor(r.segundos_activos/3600)+' h '+Math.floor(r.segundos_activos%3600/60)+' min '+(r.segundos_activos%60)+' s';
    const estadoCell = document.createElement('td');
    estadoCell.textContent = r.seguimiento_version !== 1 ? 'Histórico'
      : r.cerrado_en ? 'Cerrada'
      : Date.now()-new Date(r.ultimo_latido_en).getTime()<90000 ? 'Conectada' : 'Sin señal';
    tr.append(dateCell, nameCell, emailCell, ipCell, actividadCell, duracionCell, estadoCell);
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
let consultaGestionTrabajosAdmin = 0;
let trabajosGestionAdmin = [];
function normalizarBusquedaAdmin(valor) {
  return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
}
function filtrarTrabajosGestionAdmin(trabajos, consulta) {
  const palabras = normalizarBusquedaAdmin(consulta).split(/\s+/).filter(Boolean);
  return trabajos.filter(m => {
    const texto = normalizarBusquedaAdmin([m.numero_orden, m.titulo, m.autor, m.unidad_codigo].join(' '));
    return palabras.every(palabra => texto.includes(palabra));
  });
}
function renderizarGestionTrabajosAdmin() {
  const cont = document.getElementById('listaGestionTrabajosAdmin');
  if (!cont) return;
  const consulta = document.getElementById('buscarTrabajoAdmin')?.value || '';
  const trabajos = filtrarTrabajosGestionAdmin(trabajosGestionAdmin, consulta);
  cont.replaceChildren();
  const contador = document.getElementById('gestionTrabajosConteo');
  if (contador) contador.textContent = `${trabajos.length} de ${trabajosGestionAdmin.length} trabajos`;
  if (!trabajos.length) {
    const vacio = document.createElement('p');
    vacio.className = 'admin-empty-state';
    vacio.textContent = trabajosGestionAdmin.length ? 'No hay coincidencias. Pruebe con otro título, autor o número.' : 'Todavía no hay trabajos activos.';
    cont.appendChild(vacio);
    return;
  }
  trabajos.forEach(m => {
    const card = document.createElement('article');
    card.className = 'card card-gestion-trabajo';
    const info = document.createElement('div');
    info.className = 'gestion-trabajo-info';
    const orden = document.createElement('span');
    orden.className = 'gestion-trabajo-orden';
    orden.textContent = `TRABAJO N.º ${m.numero_orden}`;
    const titulo = document.createElement('h4');
    titulo.className = 'gestion-trabajo-titulo';
    titulo.textContent = m.titulo || 'Sin título';
    const autor = document.createElement('p');
    autor.className = 'gestion-trabajo-autor';
    autor.textContent = m.autor ? formatearAutorMasonico(m.autor) : 'Cámara de Docencia';
    info.append(orden, titulo, autor);
    const acciones = document.createElement('div');
    acciones.className = 'gestion-trabajo-botones';
    const editar = document.createElement('button');
    editar.type = 'button';
    editar.className = 'admin-link-btn';
    editar.textContent = 'Revisar y editar';
    editar.setAttribute('aria-label', `Revisar y editar: ${m.titulo || 'trabajo'}`);
    editar.addEventListener('click', () => abrirAuditoriaModulo(m.id));
    const eliminar = document.createElement('button');
    eliminar.type = 'button';
    eliminar.className = 'admin-link-btn btn-eliminar-trabajo';
    eliminar.textContent = 'Eliminar';
    eliminar.setAttribute('aria-label', `Eliminar: ${m.titulo || 'trabajo'}`);
    eliminar.addEventListener('click', () => eliminarModuloYReordenar(m.id));
    acciones.append(editar, eliminar);
    card.append(info, acciones);
    cont.appendChild(card);
  });
}
async function cargarGestionTrabajosAdmin() {
  const cont = document.getElementById('listaGestionTrabajosAdmin');
  if (!cont) return;
  const consulta = ++consultaGestionTrabajosAdmin;
  const estado = document.getElementById('gestionTrabajosEstado');
  const refrescar = document.getElementById('btnActualizarTrabajosAdmin');
  cont.setAttribute('aria-busy', 'true');
  if (estado) estado.textContent = 'Consultando trabajos…';
  if (refrescar) refrescar.disabled = true;
  try {
    const { data: mods, error } = await sbApp.from('modulos').select('*')
      .eq('activo', true).order('numero_orden', { ascending: true });
    if (consulta !== consultaGestionTrabajosAdmin) return;
    if (error || !Array.isArray(mods)) throw new Error('consulta_trabajos');
    trabajosGestionAdmin = mods;
    listaModulos = mods;
    renderizarGestionTrabajosAdmin();
    if (estado) estado.textContent = 'Lista actualizada.';
  } catch {
    if (consulta !== consultaGestionTrabajosAdmin) return;
    if (estado) estado.textContent = 'No se pudo actualizar. Puede reintentar; los datos anteriores se conservan.';
  } finally {
    if (consulta === consultaGestionTrabajosAdmin) {
      cont.setAttribute('aria-busy', 'false');
      if (refrescar) refrescar.disabled = false;
    }
  }
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

  // Cuatro áreas: grupos por unidad, cabeceras de subunidad y códigos de tema.
  let grupo=null;
  for(const item of unidades){
    const tipo=tipoUnidadDocencia(item.codigo);
    if(tipo==='area'){
      grupo=null;
      const encabezado=document.createElement('option');
      encabezado.value='';
      encabezado.disabled=true;
      encabezado.textContent='── '+item.detalle+' ──';
      selector.appendChild(encabezado);
    }else if(tipo==='unidad'){
      grupo=document.createElement('optgroup');
      grupo.label=item.codigo+' — '+item.detalle;
      selector.appendChild(grupo);
    }else if(tipo==='subunidad'){
      const cabecera=document.createElement('option');
      cabecera.value='';
      cabecera.disabled=true;
      cabecera.textContent='  '+item.detalle;
      (grupo||selector).appendChild(cabecera);
    }else if(tipo==='tema'){
      const opcion=document.createElement('option');
      opcion.value=item.codigo;
      opcion.textContent=item.codigo+' — '+item.detalle;
      (grupo||selector).appendChild(opcion);
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

async function solicitarGuardadoTrabajoSuperadmin(payload) {
  const {data:{session}}=await sbApp.auth.getSession();
  if(!session?.access_token)throw new Error('La sesión ha vencido. Inicie sesión nuevamente.');
  const resp=await fetch('/api/admin-trabajos',{
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
    body:JSON.stringify(payload)
  });
  const data=await resp.json().catch(()=>({}));
  if(!resp.ok||!data.ok)throw new Error(data.error||'No se pudo guardar el trabajo');
  return data;
}

async function guardarTodasPreguntasAuditoria() {
  if (!moduloAuditando) return;

  const preguntas = structuredClone(moduloAuditando.preguntas_json?.preguntas || []);
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

  try {
    await solicitarGuardadoTrabajoSuperadmin({action:'preguntas',id:moduloAuditando.id,preguntas_json:nuevoJson});
    moduloAuditando.preguntas_json = nuevoJson;
    alert("Cuestionario actualizado exitosamente.");
  } catch(error) {
    alert("Error al actualizar preguntas: " + error.message);
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

  try {
    await solicitarGuardadoTrabajoSuperadmin({action:'editar',id:moduloAuditando.id,...cambios});
    moduloAuditando.titulo = nuevoTitulo;
    moduloAuditando.autor = nuevoAutor;
    moduloAuditando.numero_orden = nuevoOrden;
    moduloAuditando.contenido_trazado = nuevoTexto;
    if (Object.hasOwn(cambios,'unidad_codigo')) moduloAuditando.unidad_codigo=cambios.unidad_codigo;
    void window.notificarPublicacionesAdmin?.();
    alert("Encabezado, texto y clasificación guardados exitosamente.");
    await cargarDatosAdmin();
    cargarGestionTrabajosAdmin();
  } catch(error) {
    alert("Error al actualizar trabajo: " + error.message);
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
  const tbody=document.getElementById('tablaMetricasBody');
  if(!tbody)return;
  tbody.replaceChildren();
  const mensaje=document.createElement('tr');
  const esperando=document.createElement('td');
  esperando.colSpan=6;esperando.className='td-loading';
  esperando.textContent='Consultando registros…';
  mensaje.appendChild(esperando);tbody.appendChild(mensaje);
  const actor=usuarioActual;
  const [resultadoUsuarios,resultadoProgreso]=await Promise.all([
    sbApp.from('usuarios').select('id,nombre,email').order('nombre',{ascending:true}),
    sbApp.from('progreso_maestro').select('*').eq('modulo_id',moduloId)
  ]);
  if(usuarioActual!==actor)return;
  tbody.replaceChildren();
  const error=resultadoUsuarios.error||resultadoProgreso.error;
  function aviso(texto){
    const fila=document.createElement('tr'),columna=document.createElement('td');
    columna.colSpan=6;columna.className='admin-empty-state';
    columna.textContent=texto;fila.appendChild(columna);tbody.appendChild(fila);
  }
  if(error){
    aviso('No fue posible consultar los avances. Compruebe su sesión y pulse Actualizar.');
    return;
  }
  const usuarios=resultadoUsuarios.data||[],progresos=resultadoProgreso.data||[];
  if(!usuarios.length){aviso('No hay integrantes registrados en el padrón.');return;}
  const progMap=new Map(progresos.map(p=>[p.usuario_id,p]));
  for(const u of usuarios){
    const p=progMap.get(u.id)||null;
    const tr=document.createElement('tr');
    const columna=(texto)=>{
      const td=document.createElement('td');td.textContent=texto;
      tr.appendChild(td);return td;
    };
    const nombre=columna('');
    const botonNombre=document.createElement('button');
    botonNombre.type='button';botonNombre.className='admin-link-btn';
    botonNombre.textContent=u.nombre||'Hermano';
    botonNombre.setAttribute('aria-label','Consultar avances de '+(u.nombre||'integrante'));
    botonNombre.addEventListener('click',()=>{void abrirModalMisAvances(u.id);});
    nombre.appendChild(botonNombre);
    const lectura=columna(p?.leido?'✓ Leído':'Pendiente');
    lectura.style.color=p?.leido?'var(--success)':'var(--text-muted)';
    const preguntas= p?.completado?'8/8 ✓':p?.intentos_preguntas!==undefined?String(p.intentos_preguntas)+'/8':'—';
    const examen=columna(preguntas);
    if(p?.completado){examen.style.color='var(--success)';examen.style.fontWeight='600';}
    const reflexion=columna(p?.reflexion?'"'+String(p.reflexion).slice(0,70)+'…"':'—');
    reflexion.style.fontSize='.82rem';reflexion.style.fontStyle='italic';
    const fecha=p?.completado_en?new Date(p.completado_en).toLocaleDateString('es-CL',{
      day:'2-digit',month:'2-digit',year:'numeric'
    }):'—';
    columna(fecha);
    const acciones=columna('');
    const modificar=document.createElement('button');modificar.type='button';
    modificar.className='admin-link-btn';modificar.textContent='Modificar';
    modificar.setAttribute('aria-label','Modificar avance de '+(u.nombre||'integrante'));
    // La edición usa el progreso del Hermano seleccionado, nunca misProgresos
    // (que corresponde a la sesión actual, no al registro de Superadmin).
    modificar.addEventListener('click',()=>abrirModalParametrosHermano(
      p?.id||'',u.id,moduloId,u.nombre||'Hermano',p
    ));
    acciones.appendChild(modificar);tbody.appendChild(tr);
  }
}

function recargarMetricasActuales() {
  const sel = document.getElementById('selectMetricasModulo');
  if (sel) cargarMetricasAvance(sel.value);
}

function abrirModalParametrosHermano(progresoId, usuarioId, moduloId, nombreHermano, progreso=null) {
  document.getElementById('subParamHermano').innerText = `Modificando avance para: ${nombreHermano}`;
  document.getElementById('paramProgresoId').value = progresoId || '';
  document.getElementById('paramUsuarioId').value = usuarioId;
  document.getElementById('paramModuloId').value = moduloId;

  const prog=progreso?.usuario_id===usuarioId ? progreso : null;
  if (prog) {
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
          <strong>Trabajo ${r.modulos?.numero_orden || '—'}: ${escaparTextoHTMLDocencia(r.modulos?.titulo || 'Trazado')}</strong>
          <span style="font-size: 0.8rem; color: var(--text-muted);">${fecha}</span>
        </div>
        <p style="margin: 0 0 6px 0; font-style: italic;">"${escaparTextoHTMLDocencia(r.reflexion)}"</p>
        <span class="reflexion-autor">${escaparTextoHTMLDocencia(formatearNombreHermano(r.usuarios?.nombre))}</span>
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
  
  verificarTokenUrl();
  recuperarSesionGuardada();
});


async function cargarResumenAdmin() {
  const status = document.getElementById('resumenAdminEstado');
  if (!status) return;
  status.textContent = 'Actualizando indicadores...';
  const campos = ['kpiUsuarios','kpiResumenAsignados','kpiResumenEntregados','kpiResumenPendientes','kpiCompletados','kpiComentarios'];
  campos.forEach(id => { const campo=document.getElementById(id);if(campo)campo.textContent = '—'; });
  // La misma consulta autenticada del cronograma alimenta los tres KPI de trabajos.
  void window.cargarCronogramaAdmin?.();
  try {
    const [users, progress, muro] = await Promise.all([
      sbApp.from('usuarios').select('id,email,es_admin'),
      sbApp.from('progreso_maestro').select('usuario_id,completado').eq('completado',true),
      sbApp.rpc('muro_docente_autorizado', { p_modulo: null })
    ]);
    if ([users,progress,muro].some(result => result.error)) throw new Error('Sin permisos de lectura para indicadores');
    if (!Array.isArray(muro.data?.aportes) || !Array.isArray(muro.data?.comentarios))
      throw new Error('El Muro no entregó una respuesta verificable');
    const estudiantes = new Set(users.data.filter(u => !u.es_admin && String(u.email||'').trim().toLowerCase()!=='dummy@ofl.cl').map(u => u.id));
    const aportesUnicos = new Set([
      ...muro.data.aportes.filter(a=>a?.id).map(a=>'reflexion:'+a.id),
      ...muro.data.comentarios.filter(c=>c?.id).map(c=>'comentario:'+c.id)
    ]);
    document.getElementById('kpiUsuarios').textContent = estudiantes.size.toLocaleString('es-CL');
    document.getElementById('kpiCompletados').textContent = progress.data.filter(p => estudiantes.has(p.usuario_id)).length.toLocaleString('es-CL');
    // Una reflexión y cada comentario/respuesta visible aportan una unidad.
    document.getElementById('kpiComentarios').textContent = aportesUnicos.size.toLocaleString('es-CL');
    status.textContent = 'Indicadores actualizados. Comentarios incluye reflexiones y respuestas publicadas; los trabajos provienen del cronograma.';
  } catch {
    status.textContent = 'No fue posible consultar los indicadores con los permisos actuales.';
  }
}



async function eliminarCuentaDummy(id,boton){
 if(!usuarioActual?.es_admin||!confirm('¿Eliminar la cuenta Dummy y revocar su acceso? Se conservará su historial docente.'))return;
 boton.disabled=true;
 try{const {data:{session}}=await sbApp.auth.getSession();if(!session?.access_token)throw Error('Sesión vencida');const r=await fetch('/api/admin-usuarios',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({action:'eliminar_dummy',id})});const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'No se pudo completar la eliminación');await cargarListadoUsuariosAdmin();}
 catch(e){document.getElementById('padronUsuariosEstado').textContent=e.message;}finally{boton.disabled=false;}
}
