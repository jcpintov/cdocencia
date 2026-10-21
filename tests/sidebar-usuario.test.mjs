import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const script=readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../ui-v2.css',import.meta.url),'utf8');
const portalMenus=[...html.matchAll(/<aside class="portal-nav"[^>]*>[\s\S]*?<\/aside>/g)].map(m=>m[0]);

test('inicio, trabajos, Contenido Docente y Este Espacio tienen navegación accesible equivalente',()=>{
  assert.equal(portalMenus.length,4);
  for(const menu of portalMenus){
    assert.match(menu,/<details class="portal-menu" open>/);
    assert.match(menu,/<summary class="portal-menu-toggle">/);
    assert.match(menu,/<nav class="portal-nav-list" aria-label=/);
    assert.equal((menu.match(/class="portal-nav-link/g)||[]).length,6);
    assert.equal((menu.match(/aria-current="page"/g)||[]).length,1);
    for(const action of ['volverAInicioPortal()','irACatalogoDocencia()','abrirModalMisAvances()']){
      assert.ok(menu.includes(action));
    }
    assert.match(menu,/mostrarMuroReflexionesUsuarios\(\)/);
    assert.match(menu,/irAContenidoDocente\(\)/);
    assert.match(menu,/cerrarSesion\(\)/);
  }
});
test('el sidebar de estudio ofrece selector nativo y mantiene las acciones',()=>{
  assert.match(html,/id="selectorTrabajosUsuario" class="sidebar-modulos-detalle" open/);
  assert.match(html,/<nav id="listaModulosNav" aria-label="Elegir trabajo de la Cámara">/);
  assert.match(html,/id="sidebarTrabajoActual"[^>]*aria-live="polite"/);
  assert.match(html,/onclick="volverACatalogo\(\)"/);
  assert.match(html,/onclick="mostrarMuroReflexionesUsuarios\(\)"/);
  assert.match(app,/const item = document\.createElement\('button'\)/);
  assert.match(app,/item\.type = 'button'/);
  assert.match(app,/activeNav\.setAttribute\('aria-current', 'page'\)/);
});
test('el foro conserva control de acceso mediante progreso completado',()=>{
  assert.match(app,/const accesoMuro = Object\.values\(misProgresos\)\.some\(p => p\?\.completado === true\)/);
  assert.match(app,/if \(!usuarioActual \|\| usuarioActual\.es_admin \|\| !accesoMuro\)/);
});
test('menús móviles ajustables sin depender de desplazamiento horizontal',()=>{
  assert.match(script,/media=window\.matchMedia\('\(max-width: 640px\)'\)/);
  assert.match(script,/selectorTrabajos\.open=!media\.matches/);
  assert.match(script,/menu\.open=false/);
  assert.match(css,/\.portal-menu \.portal-nav-list\s*\{/);
  assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/#seccionDocencia \.sidebar-acciones/);
});


test('los cuatro sidebars de users evitan el lema redundante y mantienen cierre de sesión',()=>{
  assert.equal(portalMenus.length,4);
  for (const menu of portalMenus) {
    assert.doesNotMatch(menu,/<span>DOCENCIA PARA MAESTROS<\/span>/);
    assert.doesNotMatch(menu,/<span>CÁMARA DE DOCENCIA<\/span>/);
    assert.doesNotMatch(menu,/Valle de Talagante/);
    assert.doesNotMatch(menu,/R\.·\.L\.·\. Orestes Frödden Lorenzen Nº 146/);
    assert.match(menu,/onclick="cerrarSesion\(\)"/);
  }
});

test('cuatro menús users siguen exactamente el orden y títulos aprobados',()=>{
  const esperados=['Inicio','Mis avances','Trabajos de la Cámara','Muro Docente','Contenido Docente','Este Espacio'];
  assert.equal(portalMenus.length,4);
  for (const menu of portalMenus) {
    const titulos=[...menu.matchAll(/<span class="portal-nav-text">([^<]+)<\/span>/g)].map(m=>m[1]);
    assert.deepEqual(titulos,esperados);
    assert.doesNotMatch(menu,/portal-nav-intro|portal-nav-brand|Espacio de Maestros/);
    assert.match(menu,/onclick="volverAInicioPortal\(\)"/);
    assert.match(menu,/onclick="abrirModalMisAvances\(\)"/);
    assert.match(menu,/onclick="irACatalogoDocencia\(\)"/);
    assert.match(menu,/mostrarMuroReflexionesUsuarios\(\)/);
    assert.match(menu,/mostrarDocenciaParaMaestros\(\)/);
  }
});
test('superadmin usa los mismos iconos tipográficos sin alterar botones',()=>{
  const sidebar=html.match(/<aside class="sidebar-admin">([\s\S]*?)<\/aside>/)?.[1];
  assert.ok(sidebar,'existe sidebar exclusivo Superadmin');
  const botones=[...sidebar.matchAll(/<button id="(tabNav\w+)" class="admin-side-btn[^"]*" onclick="cambiarSubseccionAdmin\('([^']+)'\)">([\s\S]*?)<\/button>/g)];
  assert.equal(botones.length,12);
  const idSet=new Set();
  for(const [,id,section,content] of botones) {
    assert.ok(id && section);
    assert.ok(!idSet.has(id),'cada opción tiene identificador único');
    idSet.add(id);
    assert.match(content,/<span class="portal-nav-glyph" aria-hidden="true">[^<]+<\/span>/);
    assert.match(content,/<span class="admin-nav-text">[^<]+<\/span>/);
  }
  assert.match(sidebar,/class="portal-nav-glyph admin-brand-glyph"/);
  assert.match(sidebar,/Repositorio GitHub/);
  assert.match(sidebar,/Supabase Dashboard/);
  assert.match(css,/#seccionAdmin \.admin-side-btn \.portal-nav-glyph/);
  assert.match(css,/#seccionAdmin \.admin-side-btn\.active \.portal-nav-glyph/);
});


test('programa y trabajos usan paneles independientes y navegación coherente',()=>{
  const trabajos=html.slice(html.indexOf('id="seccionCatalogoTrabajos"'),html.indexOf('id="seccionContenidoDocente"'));
  const contenido=html.slice(html.indexOf('id="seccionContenidoDocente"'),html.indexOf('id="seccionDocenciaInstitucional"'));
  assert.match(trabajos,/id="gridTrabajosBienvenida"/);
  assert.doesNotMatch(trabajos,/id="catalogoDirectorioUnidades"/);
  assert.match(contenido,/id="catalogoDirectorioUnidades"/);
  assert.match(contenido,/id="catalogoUnidadesContenido"/);
  assert.match(contenido,/aria-current="page" onclick="irAContenidoDocente\(\)"/);
  assert.match(script,/#seccionContenidoDocente \.portal-menu/);
  assert.match(app,/void irAContenidoDocente\(boton\.dataset\.codigoDocencia\)/);
  assert.match(app,/renderizarCatalogoTrabajos\('contenido'\)/);
  assert.match(app,/vista === 'contenido' \? 'seccionContenidoDocente' : 'seccionCatalogoTrabajos'/);
});


