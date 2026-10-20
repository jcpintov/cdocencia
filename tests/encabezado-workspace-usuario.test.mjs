import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../ui-v2.css',import.meta.url),'utf8');

function entorno() {
  const nodes=new Map();
  for(const id of ['encabezadoWorkspaceUsuario','encabezadoNombreUsuario']){
    const clases=new Set(['hidden']);
    nodes.set(id,{
      textContent:'',
      classList:{
        add(c){clases.add(c)},
        remove(c){clases.delete(c)},
        contains(c){return clases.has(c)}
      }
    });
  }
  const start=app.indexOf('function limpiarNombreWorkspaceUsuario(nombre)');
  const end=app.indexOf('function configurarEntornoUsuario()',start);
  assert.ok(start>0&&end>start);
  const methods=runInNewContext('let usuarioActual=null;\n'+app.slice(start,end)+
    '\n({normalizar:limpiarNombreWorkspaceUsuario, actualizar:sincronizarEncabezadoWorkspaceUsuario,setUsuario:p=>{usuarioActual=p}})',
    {document:{getElementById:id=>nodes.get(id)}});
  return {methods,nodes};
}
test('cabecera preserva título y añade Workspace y nombre dinámico',()=>{
  assert.match(html,/class="brand-title-text">DOCENCIA MASÓNICA DE TERCER GRADO<\/span>/);
  assert.match(html,/id="encabezadoWorkspaceUsuario" class="header-workspace-usuario hidden"/);
  assert.match(html,/class="header-workspace-etiqueta">WORKSPACE DEL<\/span>/);
  assert.match(html,/id="encabezadoNombreUsuario"/);
  assert.match(css,/body > header \.header-workspace-usuario/);
  assert.match(css,/@media\(max-width:640px\)/);
});
test('Workspace permanece dentro del encabezado sin franja dorada',()=>{
 const header=html.slice(html.indexOf('  <header>'),html.indexOf('</header>'));
 assert.ok(header.includes('id="encabezadoWorkspaceUsuario"'));
 assert.doesNotMatch(css,/body > \\.header-workspace-usuario/);
});
test('nombre fraternal aparece solo tras autenticación y no duplica tratamiento',()=>{
  const {methods,nodes}=entorno();
  methods.setUsuario({nombre:'Q.·.H.·. Ricardo Pérez González',es_admin:false});
  methods.actualizar();
  assert.equal(nodes.get('encabezadoNombreUsuario').textContent,'Q.·.H.·. Ricardo Pérez González');
  assert.equal(nodes.get('encabezadoWorkspaceUsuario').classList.contains('hidden'),false);
  methods.setUsuario({nombre:'  Hugo   Adolfo   Tapia Romero  ',es_admin:false});
  methods.actualizar();
  assert.equal(nodes.get('encabezadoNombreUsuario').textContent,'Q.·.H.·. Hugo Adolfo Tapia Romero');
});
test('se oculta al cerrar sesión, en login y para Superadmin',()=>{
  const {methods,nodes}=entorno();
  methods.setUsuario({nombre:'Maestro de prueba',es_admin:false});
  methods.actualizar();
  assert.equal(nodes.get('encabezadoWorkspaceUsuario').classList.contains('hidden'),false);
  methods.setUsuario(null);
  methods.actualizar();
  assert.equal(nodes.get('encabezadoNombreUsuario').textContent,'');
  assert.equal(nodes.get('encabezadoWorkspaceUsuario').classList.contains('hidden'),true);
  methods.setUsuario({nombre:'Cuenta superadmin',es_admin:true});
  methods.actualizar();
  assert.equal(nodes.get('encabezadoWorkspaceUsuario').classList.contains('hidden'),true);
});
test('sincronización en login/restauración y limpieza al salir',()=>{
  const setup=app.slice(app.indexOf('function configurarEntornoUsuario()'),app.indexOf('function aceptarSigilo()'));
  const logout=app.slice(app.indexOf('function cerrarSesion()'),app.indexOf('function abrirModalCambioClaveUsuario()'));
  assert.match(setup,/sincronizarEncabezadoWorkspaceUsuario\(\)/);
  assert.match(logout,/usuarioActual = null;[\s\S]*?sincronizarEncabezadoWorkspaceUsuario\(\)/);
});
test('tarjetas originales mantienen título y autor antes de unidad, subunidad y códigos',()=>{
  const render=app.slice(app.indexOf('async function renderizarCatalogoTrabajos('),
    app.indexOf('function entrarADocenciaConModulo('));
  const content=render.slice(render.indexOf('grid.innerHTML += '),render.indexOf('renderizarDirectorioUnidadesDocencia('));
  const posiciones=[
    content.indexOf('grid-card-meta'),
    content.indexOf('grid-card-cuerpo'),
    content.indexOf('grid-card-titulo'),
    content.indexOf('grid-card-autor'),
    content.indexOf('$'+'{bloqueUnidad}'),
    content.indexOf('grid-card-footer')
  ];
  assert.ok(posiciones.every(x=>x>=0),'Estructura incompleta de tarjeta: '+posiciones.join(','));
  assert.deepEqual([...posiciones].sort((a,b)=>a-b),posiciones);
  assert.match(app,/class="grid-card-unidad"/);
  assert.match(app,/class="grid-card-subunidad"/);
  assert.match(app,/class="grid-card-codigo-enlace"/);
});
