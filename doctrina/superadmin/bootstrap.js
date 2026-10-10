/* Bootstrap separado de la sesión heredada de Docencia. */
(function () {
  'use strict';
  function getClient() {
    // sbApp is defined in app.js; accessing it through a typeof check avoids
    // accidentally creating a new privileged client or reusing a Docencia role.
    return typeof sbApp !== 'undefined' ? sbApp : null;
  }
  async function refresh() {
    const shell=window.DoctrinaSuperadminShell;
    if (!shell) return;
    const client=getClient();
    if (!client) {shell.hide();return;}
    await shell.refreshFromSupabase(client);
  }
  document.addEventListener('DOMContentLoaded', function () {
    const client=getClient();
    if (!client) return;
    refresh();
    if (client.auth && typeof client.auth.onAuthStateChange==='function') {
      client.auth.onAuthStateChange(function () {
        // Defer Auth queries outside Supabase auth state callback.
        Promise.resolve().then(refresh);
      });
    }
  });
})();
