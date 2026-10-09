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
