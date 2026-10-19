import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const script = readFileSync(new URL('../ui-v2.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../ui-v2.css', import.meta.url), 'utf8');

function element(tag = 'div') {
  const el = {
    tagName: tag.toUpperCase(),
    children: [],
    attributes: {},
    handlers: {},
    style: {},
    classList: {
      values: new Set(),
      add(...x) { for (const y of x) this.values.add(y); },
      remove(...x) { for (const y of x) this.values.delete(y); }
    },
    replaceChildren(...nodes) { this.children = [...nodes]; },
    append(...nodes) { this.children.push(...nodes); },
    appendChild(node) { this.children.push(node); },
    setAttribute(key, value) { this.attributes[key] = value; },
    addEventListener(name, callback) { this.handlers[name] = callback; },
    scrollIntoView(options) { this.scrolled = options; },
    focus(options) { this.focused = options; },
    textContent: '',
    innerHTML: ''
  };
  return el;
}

function buildScreen(response) {
  const nodes = {};
  for (const id of [
    'seccionBienvenida', 'seccionCatalogoTrabajos', 'seccionDocencia',
    'seccionMuroUsuarios', 'seccionDocenciaInstitucional',
    'contenidoInstitucionalDocencia', 'espacioIndice'
  ]) nodes[id] = element();
  const document = {
    getElementById(id) { return nodes[id] || null; },
    createElement(tag) { return element(tag); },
    createTextNode(text) { return {textContent:String(text)}; }
  };
  const start = app.indexOf('async function mostrarDocenciaParaMaestros() {');
  const end = app.indexOf('/* ==========================================================================', start + 1);
  assert.ok(start > 0 && end > start, 'la función sigue existiendo');
  const source = app.slice(start, end);
  const ctx = {
    document,
    window: {matchMedia:()=>({matches:false})},
    obtenerDoctrinaBD: async () => response,
    DOCTRINA_DEFAULT: [{ titulo: 'Fundamento de respaldo', subtitulo: '', texto: 'Texto local' }]
  };
  const render = runInNewContext(source + '\nmostrarDocenciaParaMaestros;', ctx);
  return { render, nodes };
}

test('Este Espacio incluye orientación, pasos y contenido institucional editable', () => {
  assert.match(html, /id="seccionDocenciaInstitucional" class="espacio-pagina hidden"/);
  assert.match(html, /<h1 id="espacioTitulo">Este Espacio<\/h1>/);
  assert.equal((html.match(/class="espacio-paso"/g) || []).length, 3);
  assert.match(html, /id="espacioIndice"/);
  assert.match(html, /id="contenidoInstitucionalDocencia"/);
  assert.match(html, /onclick="irACatalogoDocencia\(\)"/);
  assert.match(html, /onclick="abrirModalMisAvances\(\)"/);
  assert.match(script, /#seccionDocenciaInstitucional \.portal-menu/);
  assert.match(css, /#seccionDocenciaInstitucional \.espacio-fundamentos/);
  assert.match(css, /@media\(max-width:640px\)/);
});

test('el índice respeta títulos y cuerpos definidos por el Superadmin', async () => {
  const { render, nodes } = buildScreen([
    { titulo: '1. Primer fundamento', subtitulo: 'Sentido de la formación', texto: 'Texto con\nsegundo renglón' },
    { titulo: '2. Segundo fundamento', subtitulo: 'Participación', texto: 'Reflexión compartida' }
  ]);
  await render();
  const sections = nodes.contenidoInstitucionalDocencia.children;
  const links = nodes.espacioIndice.children;
  assert.equal(sections.length, 2);
  assert.equal(links.length, 2);
  assert.equal(sections[0].id, 'espacio-bloque-1');
  assert.equal(sections[0].children[1].textContent, '1. 1. Primer fundamento');
  assert.equal(sections[0].children[2].textContent, 'Sentido de la formación');
  assert.equal(sections[0].children[3].children[0].textContent, 'Texto con\nsegundo renglón');
  assert.equal(links[1].textContent, '2. 2. Segundo fundamento');
  links[0].handlers.click();
  assert.equal(sections[0].scrolled.block, 'start');
  assert.equal(sections[0].focused.preventScroll, true);
  assert.equal(nodes.seccionDocenciaInstitucional.classList.values.has('hidden'), false);
  assert.equal(nodes.seccionBienvenida.classList.values.has('hidden'), true);
});

test('se presenta respaldo local si la configuración está vacía', async () => {
  const { render, nodes } = buildScreen([]);
  await render();
  assert.equal(nodes.contenidoInstitucionalDocencia.children.length, 1);
  assert.equal(nodes.espacioIndice.children[0].textContent, '1. Fundamento de respaldo');
});

test('el texto institucional se trata como texto, no como HTML ejecutable', async () => {
  const { render, nodes } = buildScreen([
    { titulo: '<img src=x onerror=alert(1)>', subtitulo: '', texto: '<script>alert(1)</script>' }
  ]);
  await render();
  const section = nodes.contenidoInstitucionalDocencia.children[0];
  assert.equal(section.children[1].textContent, '1. <img src=x onerror=alert(1)>');
  assert.equal(section.children[2].children[0].textContent, '<script>alert(1)</script>');
  assert.equal(nodes.espacioIndice.children[0].textContent, '1. <img src=x onerror=alert(1)>');
});
