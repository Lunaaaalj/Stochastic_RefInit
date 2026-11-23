/* Motor del video de Expo Ingenierías.
 *
 * Arma el escenario de 1920 × 1080 (carta, capas de escena, objetos compartidos,
 * subtítulos, viñeta y grano), lleva la línea de tiempo de DATOS_VIDEO.linea y
 * expone window.__video = { duracion, fps, escenas, tick(t), listo }.
 *
 * Reglas (docs/expoing/video/PLAN.md §7 y §9):
 * - tick(t) es una función pura del tiempo: no usa Date, performance.now,
 *   requestAnimationFrame ni Math.random. El azar sale de mulberry32 con semilla.
 *   Dos llamadas con el mismo t dejan el escenario idéntico, sin importar el orden.
 * - Todo evento ligado a la voz se ancla a un subtítulo (ctx.cue) o a una palabra
 *   de ese subtítulo (ctx.palabra), nunca a segundos absolutos. Así, cuando
 *   alinear.py reescriba los tiempos con la voz real, la animación se recalcula.
 * - Ningún contenido entra en la franja de subtítulos (y ≥ 912).
 *
 * Una escena se registra con REFOR_VIDEO.escena({ id, entrada, cola, construir(ctx), tick(t, ctx) }),
 * donde t es el tiempo local (0 = inicio de la escena en la línea de tiempo). La escena
 * está activa de inicio − entrada a fin + cola; las escenas activas se ejecutan en
 * orden, así que la posterior manda sobre la carta y los objetos compartidos.
 */
/* global DATOS */
(() => {
'use strict';
const C = window.EXPO_COMUN, D = DATOS, DV = window.DATOS_VIDEO;
const ANCHO = 1920, ALTO = 1080, FPS = 60, FRANJA = 912;
const params = new URLSearchParams(location.search);
const RENDER = params.has('render');
const SIN_SUBTITULOS = params.has('sin_subtitulos');

/* ---------- Utilidades de tiempo y curvas ---------- */
const clamp = C.clamp;
const lerp = (a, b, p) => a + (b - a) * p;
// Avance de 0 a 1 entre a y a + d.
const rampa = (t, a, d) => d <= 0 ? (t >= a ? 1 : 0) : clamp((t - a) / d);
// Sube en [a, a + d], se sostiene y baja en [b − d, b].
const ventana = (t, a, b, d) => Math.min(rampa(t, a, d), 1 - rampa(t, b - d, d));
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = t => ((ax * t + bx) * t + cx) * t, Y = t => ((ay * t + by) * t + cy) * t, dX = t => (3 * ax * t + 2 * bx) * t + cx;
  return x => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) { const e = X(t) - x, d = dX(t); if (Math.abs(e) < 1e-6 || !d) break; t -= e / d; }
    return Y(clamp(t));
  };
}
const suave = bezier(.2, .7, .2, 1);      // entradas y datos (PLAN §3.5)
const camara = bezier(.65, 0, .35, 1);    // movimientos de cámara, ease in-out
// Escala elástica: sobrepasa ≈ 13 % y se asienta.
const elastico = p => p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.exp(-6 * p) * Math.cos(3 * Math.PI * p);
const px = v => v.toFixed(2) + 'px';
const opacidad = (e, a) => { const v = a <= 0.001 ? '0' : a >= 0.999 ? '1' : a.toFixed(3); if (e.style.opacity !== v) e.style.opacity = v; };
// Aparece con un ascenso (en px) mientras sube la opacidad.
function aparecer(e, p, sube = 8) {
  opacidad(e, p);
  e.style.transform = p >= 1 ? '' : `translateY(${px((1 - p) * sube)})`;
}
function html(tag, clase, padre, contenido) {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (contenido != null) e.innerHTML = contenido;
  if (padre) padre.appendChild(e);
  return e;
}
const escapar = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Los binomios van siempre en cursiva (DESIGN.md §3).
const BINOMIOS = D.especies.map(e => e.nombre).sort((a, b) => b.length - a.length);
function conCursivas(s) {
  let h = escapar(s);
  for (const n of BINOMIOS) h = h.split(n).join(`<em>${n}</em>`);
  return h;
}

/* ---------- Línea de tiempo ---------- */
const ESCENAS = DV.linea.escenas;
const DURACION = ESCENAS[ESCENAS.length - 1].fin;
const CUES = ESCENAS.flatMap(e => e.cues.map(c => Object.assign({ escena: e.id }, c)));

// Momento (local) en que empieza la n-ésima aparición de una palabra dentro del
// texto hablado de un subtítulo. Con marcas por palabra de alinear.py (cue.palabras)
// usa la marca real; sin ellas, reparte el subtítulo en proporción a los caracteres,
// que es como tiempos.py calcula su duración.
function momentoPalabra(cue, inicioEscena, palabra, n) {
  const norm = s => s.toLocaleLowerCase('es');
  if (cue.palabras) {
    const hits = cue.palabras.filter(w => norm(w.p).replace(/[^\p{L}\p{N}]/gu, '') === norm(palabra));
    if (hits.length >= n) return hits[n - 1].t - inicioEscena;
  }
  const voz = norm(cue.voz), w = norm(palabra);
  let k = -1;
  for (let i = 0; i < n; i++) { k = voz.indexOf(w, k + 1); if (k < 0) break; }
  if (k < 0) throw new Error(`No encontré «${palabra}» (${n}) en «${cue.voz}»`);
  return cue.inicio + (cue.fin - cue.inicio) * k / cue.voz.length - inicioEscena;
}

/* ---------- Escenario ---------- */
const $ = id => document.getElementById(id);
const REG = new Map();
const estado = { subInvertido: false };
let carta = null, objetos = null, escenas = [];

// Objetos que viajan de una escena a otra (corte por continuidad). Cada cuadro se
// reinician y la escena activa los coloca.
function crearObjetos(svg) {
  // El brote: la marca del logo, que nace en E1 y se queda como logo en E2.
  const g = C.el('g', { display: 'none' }, svg);
  C.marcaBrote(g);
  const brote = { g, visible: false, x: 960, y: 540, k: 1, alfa: 1 };
  return {
    brote,
    reiniciar() { brote.visible = false; brote.alfa = 1; },
    dibujar() {
      // Oculto, sin transform ni opacidad: el cuadro no debe depender de dónde quedó antes.
      if (!brote.visible || brote.k <= 0.0005 || brote.alfa <= 0.001) {
        g.setAttribute('display', 'none'); g.removeAttribute('transform'); g.removeAttribute('opacity'); return;
      }
      g.removeAttribute('display');
      g.setAttribute('opacity', brote.alfa >= 0.999 ? 1 : brote.alfa.toFixed(3));
      g.setAttribute('transform', `translate(${brote.x.toFixed(2)} ${brote.y.toFixed(2)}) scale(${brote.k.toFixed(4)})`);
    },
  };
}

// Grano de papel estático (no se anima: el grano animado arruina la compresión H.264).
function pintarGrano(cv) {
  const g = cv.getContext('2d'), img = g.createImageData(ANCHO, ALTO), r = C.mulberry32(1905), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = Math.floor(r() * 256); d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  g.putImageData(img, 0, 0);
}

// Hoja de papel opaco que se desliza sobre la carta.
function hoja(padre, x, y, w, h, clase) {
  const e = html('div', 'hoja' + (clase ? ' ' + clase : ''), padre);
  Object.assign(e.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
  return e;
}

// Iris hexagonal (tarjetas de capítulo): recorta un elemento a un hexágono que crece
// desde el centro. p = 0, cerrado; p = 1, cubre el cuadro. Con `hueco`, al revés: el
// elemento cubre el cuadro menos el hexágono (el iris que se abre).
const hexIris = (p, cx, cy) => {
  const r = Math.max(0, p) * 1250, w = Math.sqrt(3) / 2 * r;
  return [[0, -r], [w, -r / 2], [w, r / 2], [0, r], [-w, r / 2], [-w, -r / 2]].map(([x, y]) => `${(cx + x).toFixed(1)}px ${(cy + y).toFixed(1)}px`);
};
function iris(e, p, cx = 960, cy = 540, hueco = false) {
  if (!hueco && p >= 1) { e.style.clipPath = ''; return; }
  if (hueco && p <= 0) { e.style.clipPath = ''; return; }
  const h = hexIris(p, cx, cy);
  e.style.clipPath = hueco ? `polygon(evenodd, 0 0, 1920px 0, 1920px 1080px, 0 1080px, 0 0, ${h.join(',')}, ${h[0]})`
    : `polygon(${h.join(',')})`;
}

// Tarjeta de capítulo sobre tinta (PLAN §5, E5 y E8): el iris se cierra hacia la tinta
// en 500 ms desde t = 0, la tarjeta se sostiene y el iris se abre sobre papel en `abre`.
function capitulo(padre, pregunta, titulo) {
  const e = html('div', 'capitulo', padre);
  const p1 = html('div', 'cap-pregunta', e, pregunta), p2 = html('div', 'cap-titulo', e, titulo);
  return {
    // Devuelve true mientras la tinta cubre el cuadro entero.
    tick(t, ctx, abre) {
      const c = camara(rampa(t, 0, 0.5)), o = camara(rampa(t, abre, 0.5));
      if (c <= 0 || o >= 1) { e.style.display = 'none'; return false; }
      e.style.display = '';
      if (o > 0) iris(e, o, 960, 540, true); else iris(e, c);
      aparecer(p1, suave(rampa(t, 0.35, 0.5)), 6);
      aparecer(p2, suave(rampa(t, 0.5, 0.6)), 10);
      if (o < 0.5 && c > 0.5) ctx.estado.subInvertido = true;
      return c >= 1 && o <= 0;
    },
  };
}

// Lienzo de escena: un <canvas> de 1920 × 1080 en la capa de la escena.
function lienzo(padre) {
  const cv = html('canvas', 'lienzo', padre);
  cv.width = ANCHO; cv.height = ALTO;
  const g = cv.getContext('2d');
  g.limpiar = () => { g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.clearRect(0, 0, ANCHO, ALTO); };
  return g;
}

// Hoja que entra (sube dy px mientras aparece, desde `a`) y sale (sube dyFuera, desde `b`).
function hojaVaiven(e, t, a, b, { dy = 50, d = 0.9, dyFuera = -70, dFuera = 0.7 } = {}) {
  const pin = suave(rampa(t, a, d)), pout = camara(rampa(t, b, dFuera));
  opacidad(e, Math.min(suave(rampa(t, a, d * 0.6)), 1 - rampa(t, b + dFuera * 0.25, dFuera * 0.75)));
  const y = (1 - pin) * dy + pout * dyFuera;
  e.style.transform = Math.abs(y) < 0.005 ? '' : `translateY(${px(y)})`;
}

// Punto de un arco de a a b que se levanta `alto` px a la izquierda de la cuerda.
function arco(a, b, p, alto) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, h = alto * 4 * p * (1 - p);
  return [a[0] + dx * p + dy / l * h, a[1] + dy * p - dx / l * h];
}

/* ---------- Fórmulas (KaTeX fijado en vendor/katex) ---------- */
// Cada término va en \htmlClass{t-<nombre>}{…}; formula() devuelve sus nodos por nombre.
function formula(padre, tex, clase) {
  const e = html('div', 'formula' + (clase ? ' ' + clase : ''), padre);
  window.katex.render(tex, e, { displayMode: true, trust: true, strict: 'ignore', throwOnError: true, output: 'html' });
  const terminos = {};
  for (const n of e.querySelectorAll('.enclosing')) {
    for (const c of n.classList) if (c.startsWith('t-')) (terminos[c.slice(2)] = terminos[c.slice(2)] || []).push(n);
  }
  return { e, terminos };
}
// Estados de un término (PLAN §3.6): fantasma (tierra al 30 %), activo (ocre hondo con un
// subrayado de 3 px que se dibuja en 400 ms) y leído (tierra). Se enciende en `on` y pasa
// a leído en `leido`.
const FANTASMA = C.mix(C.PAPEL, C.TIERRA, 0.3);
function encender(nodos, t, on, leido = Infinity) {
  const a = rampa(t, on, 0.3), l = rampa(t, leido, 0.4);
  const color = l > 0 ? C.mix(C.OCRE_H, C.TIERRA, l) : C.mix(FANTASMA, C.OCRE_H, a);
  const sub = suave(rampa(t, on, 0.4)), subA = 1 - l;
  for (const n of nodos || []) {
    if (n.style.color !== color) n.style.color = color;
    n.style.setProperty('--sub', sub.toFixed(3));
    n.style.setProperty('--suba', subA.toFixed(3));
  }
}
// Medida de un nodo relativa a `ref`, en píxeles del escenario (sin la escala de la previa).
function medir(nodo, ref) {
  const a = nodo.getBoundingClientRect(), b = ref.getBoundingClientRect(), k = b.width / ref.offsetWidth || 1;
  return { x: (a.left - b.left) / k, y: (a.top - b.top) / k, w: a.width / k, h: a.height / k };
}

/* ---------- Subtítulos ---------- */
const FUNDIDO = 0.12;
let subNodo = null, subCaja = null, subActual = -1;
function subtitulos(t) {
  let idx = -1, a = 0;
  if (!SIN_SUBTITULOS) {
    for (let i = 0; i < CUES.length; i++) {
      const c = CUES[i];
      if (t >= c.inicio && t < c.fin + FUNDIDO) { idx = i; a = Math.min(rampa(t, c.inicio, FUNDIDO), 1 - rampa(t, c.fin, FUNDIDO)); break; }
    }
  }
  if (idx !== subActual) {
    subActual = idx;
    subCaja.innerHTML = idx < 0 ? '' : CUES[idx].sub.split('\n').map(conCursivas).join('<br>');
  }
  opacidad(subNodo, idx < 0 ? 0 : a);
  subNodo.classList.toggle('invertido', !!estado.subInvertido);
}

/* ---------- Escenas ---------- */
function escena(def) { REG.set(def.id, def); }

// Las escenas que aún no existen muestran una hoja con su título, para que la
// previsualización recorra todo el guion con sus subtítulos.
const PENDIENTE = {
  entrada: 0, cola: 0,
  construir(ctx) {
    const h = hoja(ctx.raiz, 0, 0, 0, 0, 'pendiente');
    html('div', 'id', h, ctx.id);
    html('div', 'titulo', h, escapar(ctx.titulo));
    html('div', 'nota', h, 'Escena pendiente: se anima en la fase 2');
    ctx.hoja = h;
  },
  tick(t, ctx) { ctx.carta.estado.atenuar = 0.5; opacidad(ctx.hoja, rampa(t, 0, 0.4)); },
};

function contexto(e, raiz) {
  const cues = e.cues;
  return {
    id: e.id, titulo: e.titulo, inicio: e.inicio, fin: e.fin, dur: e.fin - e.inicio, raiz,
    carta, objetos, estado,
    // Subtítulo i (desde 1) de la escena, en tiempo local: { a, b, voz, sub }.
    cue(i) {
      const c = cues[i - 1];
      if (!c) throw new Error(`${e.id} no tiene el subtítulo ${i}`);
      return { a: c.inicio - e.inicio, b: c.fin - e.inicio, voz: c.voz, sub: c.sub };
    },
    // Momento local en que la voz dice la n-ésima «palabra» del subtítulo i.
    palabra(i, palabra, n = 1) {
      const c = cues[i - 1];
      if (!c) throw new Error(`${e.id} no tiene el subtítulo ${i}`);
      return momentoPalabra(c, e.inicio, palabra, n);
    },
  };
}

// Promesas que un cuadro necesita cumplidas antes de capturarse: la decodificación de una
// imagen que cambió de src (los cuadros de la grabación de refor_gui en E10). renderizar.py las
// espera con __video.pendientes() después de cada tick; en la previsualización no se guardan.
const PENDIENTES = [];
const esperar = p => { if (RENDER) PENDIENTES.push(p); };
async function pendientes() { while (PENDIENTES.length) await Promise.all(PENDIENTES.splice(0)); }

// Capas que se pintan encima de todo después de cada cuadro (el teleprompter del video guía).
// Reciben el tiempo sin recortar: el video guía empieza antes de 0 en E1.
const ENCIMA = [];
const alPintar = f => ENCIMA.push(f);

function tick(t) {
  const crudo = +t || 0;
  t = clamp(crudo, 0, DURACION);
  carta.reiniciar();
  objetos.reiniciar();
  estado.subInvertido = false;
  for (const s of escenas) {
    const activa = t >= s.inicio - s.def.entrada && t <= s.fin + s.def.cola;
    if (activa !== s.visible) { s.raiz.style.display = activa ? '' : 'none'; s.visible = activa; }
    if (activa) s.def.tick(t - s.inicio, s.ctx);
  }
  carta.dibujar();
  objetos.dibujar();
  subtitulos(t);
  for (const f of ENCIMA) f(crudo);
  return t;
}

async function cargarFuentes() {
  const muestra = 'AaÁáÉéÍíÓóÚúÑñü¿?¡!0123456789$%·–—×−';
  const caras = ["400 40px 'Libre Caslon Display'", "400 30px 'Libre Caslon Text'", "italic 400 30px 'Libre Caslon Text'",
    "700 30px 'Libre Caslon Text'", "400 30px 'Instrument Sans'", "500 30px 'Instrument Sans'", "600 30px 'Instrument Sans'",
    "700 56px 'Bodoni Moda'"];
  // Las de KaTeX: hay que cargarlas antes de construir, porque las escenas miden las fórmulas.
  const katex = ['KaTeX_Main', 'italic 400 40px KaTeX_Math', 'KaTeX_AMS', 'KaTeX_Size1', 'KaTeX_Size2', 'italic 400 40px KaTeX_Main']
    .map(f => f.includes(' ') ? f : `400 40px ${f}`);
  await Promise.all([...caras, ...katex].map(f => document.fonts.load(f, muestra)));
  await document.fonts.ready;
}

async function iniciar() {
  window.__video = { listo: false };
  document.body.classList.add(RENDER ? 'render' : 'previa');
  if (params.has('sin_grano')) document.body.classList.add('sin-grano');
  await cargarFuentes();
  carta = window.CARTA.crear($('carta'));
  objetos = crearObjetos($('objetos'));
  subNodo = $('subtitulos'); subCaja = subNodo.querySelector('.caja');
  pintarGrano($('grano'));
  const capas = $('capas');
  escenas = ESCENAS.map(e => {
    const raiz = html('div', 'escena', capas);
    raiz.dataset.escena = e.id;
    const def = Object.assign({ entrada: 0, cola: 0 }, REG.get(e.id) || PENDIENTE);
    const ctx = contexto(e, raiz);
    def.construir(ctx);
    raiz.style.display = 'none';
    return { id: e.id, inicio: e.inicio, fin: e.fin, raiz, def, ctx, visible: false, hecha: REG.has(e.id) };
  });
  // Las imágenes (la captura de E10) tienen que estar decodificadas antes del primer cuadro.
  await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
  tick(0);
  Object.assign(window.__video, {
    duracion: DURACION, fps: FPS, ancho: ANCHO, alto: ALTO, tick, pendientes,
    escenas: escenas.map(s => ({ id: s.id, inicio: s.inicio, fin: s.fin, entrada: s.def.entrada, cola: s.def.cola, hecha: s.hecha })),
    musica: DV.musica, listo: true,
    // El grano como PNG, para que renderizar.py lo componga en ffmpeg (normal, al 3 %).
    grano: () => $('grano').toDataURL('image/png'), opacidadGrano: 0.03,
  });
  if (!RENDER && window.REFOR_PREVIA) window.REFOR_PREVIA(window.__video);
}

window.REFOR_VIDEO = {
  escena, iniciar, alPintar, esperar, hoja, iris, capitulo, lienzo, hojaVaiven, arco, formula, encender, medir,
  html, opacidad, aparecer, escapar, conCursivas,
  clamp, lerp, rampa, ventana, bezier, suave, camara, elastico, px,
  ANCHO, ALTO, FPS, FRANJA,
  // Lo que una escena deja para la siguiente (cámaras, posiciones): constantes, no estado.
  compartido: {},
};
})();
