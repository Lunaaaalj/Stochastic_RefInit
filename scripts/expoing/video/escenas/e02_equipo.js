/* E2 · Presentación del equipo (PLAN §5, E2).
 *
 * La cámara se aleja de la planta y la carta se atenúa al 35 %; desde abajo se
 * desliza la hoja de título (cuadro de título de carta topográfica, doble filete).
 * El brote de E1 viaja hasta el logo. Cada integrante aparece cuando la voz lo
 * nombra. Nunca se nombra a la institución socioformadora (PLAN §1).
 */
/* global DATOS */
(() => {
'use strict';
const V = window.REFOR_VIDEO, K = window.CARTA, C = window.EXPO_COMUN, D = DATOS;
const { rampa, suave, camara, aparecer, opacidad, html, lerp } = V;

// Hoja de título: 1400 × 760, centrada en la zona de contenido (y de 72 a 880).
const HOJA = { x: 260, y: 96, w: 1400, h: 760 };
// Logo completo (lienzo de 640 × 240 de logo-brote-hexagono) a 96 px de alto.
const LOGO = { alto: 96, y: 40 };
const LOGO_K = LOGO.alto / 240, LOGO_W = 640 * LOGO_K, LOGO_X = HOJA.w / 2 - LOGO_W / 2;
// Donde se posa el brote: la marca va en (120, 120) del lienzo del logo, a escala 1.12.
const BROTE_FIN = { x: HOJA.x + LOGO_X + 120 * LOGO_K, y: HOJA.y + LOGO.y + 120 * LOGO_K, k: 1.12 * LOGO_K };

const CENTRO = [(K.SITIO.x0 + K.SITIO.x1) / 2, (K.SITIO.y0 + K.SITIO.y1) / 2];
// Carta de fondo: el sitio entero, un poco más grande que la hoja, que deriva despacio.
const camFondo = u => K.mostrar([CENTRO[0] - 40 * u, CENTRO[1] + 24 * u], [960, 500], 0.75);
V.compartido.titulo = { camara: camFondo(1), atenuar: 0.65 };

const INTEGRANTES = [
  { nombre: 'Angel Eduardo', apellido: 'Luna', cuando: ctx => ctx.cue(3).a },
  { nombre: 'Irasema', apellido: 'Álvarez', cuando: ctx => ctx.palabra(3, 'Irasema') },
  { nombre: 'Carolina', apellido: 'Sánchez Meneses', cuando: ctx => ctx.palabra(3, 'Carolina') },
  { nombre: 'Andrea Estefanía', apellido: 'de la Peña', nota: 'narración', cuando: ctx => ctx.palabra(4, 'Andrea') },
];

V.escena({
  id: 'E2', entrada: 0, cola: 0.9,

  construir(ctx) {
    const h = V.hoja(ctx.raiz, HOJA.x, HOJA.y, HOJA.w, HOJA.h, 'e2-hoja');
    html('div', 'e2-filete', h);
    // Logo: el texto del logotipo; la marca es el brote que llega de E1.
    const lg = C.el('svg', { class: 'e2-logo', viewBox: '0 0 640 240', width: LOGO_W, height: LOGO.alto }, h);
    Object.assign(lg.style, { left: LOGO_X + 'px', top: LOGO.y + 'px' });
    const f = { 'font-family': 'Libre Caslon Text', 'font-size': 50 };
    C.tx(lg, 250, 100, 'Stochastic', Object.assign({ fill: C.TINTA, 'font-weight': 700 }, f));
    C.tx(lg, 250, 156, 'Reforestation', Object.assign({ fill: C.TINTA }, f));
    C.tx(lg, 250, 212, 'Initiative', Object.assign({ fill: C.SALVIA_H, 'font-style': 'italic' }, f));
    ctx.logo = lg;
    // Título del proyecto, en Bodoni Moda; la primera línea recibe el subrayado.
    const ti = html('div', 'e2-titulo', h);
    ctx.titulo = ti;
    const l1 = html('span', 'e2-l1', ti, 'Compra bajo incertidumbre y distribución');
    ctx.subrayado = html('span', 'e2-subrayado', l1);
    html('br', '', ti);
    ti.appendChild(document.createTextNode('espacial de especies para la reforestación'));
    html('br', '', ti);
    ti.appendChild(document.createTextNode(`de ${D.totales.poligonos} polígonos en San Luis Potosí`));
    ctx.curso = html('div', 'e2-curso', h,
      'Optimización Estocástica (MA2004B) · Modelo educativo profesional · Modalidad presencial · Tecnológico de Monterrey');
    const fila = html('div', 'e2-integrantes', h);
    ctx.integrantes = INTEGRANTES.map(p => {
      const e = html('div', 'e2-persona', fila);
      html('div', 'e2-nombre', e, `${p.nombre}<br>${p.apellido}`);
      if (p.nota) html('div', 'e2-nota', e, p.nota);
      return { e, cuando: p.cuando };
    });
    ctx.tutores = html('div', 'e2-tutores', h, 'Profesores tutores: Yadira Isabel Silva Soto · Rafael Muñoz Sánchez');
    ctx.pie = html('div', 'e2-pie', h, 'En colaboración con el socioformador · Datos: INECOL');
    ctx.hoja = h;
  },

  tick(t, ctx) {
    const ca = ctx.carta.estado, planta = V.compartido.planta;
    if (t <= ctx.dur) {
      // La cámara se aleja de la planta hasta el sitio, que luego deriva despacio.
      const fondo = camFondo(t / ctx.dur);
      ca.camara = K.viaje(planta.camara, fondo, K.OBJETIVO, camara(rampa(t, 0, 2.4)));
      ca.atenuar = V.compartido.titulo.atenuar * suave(rampa(t, 0.3, 1.2));
      ca.reticula = { alfa: 1, onda: 70, celdas: 1, objetivo: 1 };   // se desvanece sola al alejarse
    }

    // La hoja se desliza 50 px hacia arriba mientras aparece: nunca entra en la franja
    // de subtítulos (su borde inferior queda en y ≤ 906). Al pasar a E3 se retira hacia arriba.
    const ph = suave(rampa(t, 0.35, 1.0)), sale = camara(rampa(t, ctx.dur, 0.8)), dy = (1 - ph) * 50 - 110 * sale;
    opacidad(ctx.hoja, Math.min(suave(rampa(t, 0.35, 0.6)), 1 - rampa(t, ctx.dur + 0.15, 0.6)));
    ctx.hoja.style.transform = Math.abs(dy) < 0.005 ? '' : `translateY(${V.px(dy)})`;
    // El brote viaja de la planta al logo por un arco suave; llega antes de que el
    // título aparezca, para no cruzarlo. Al final se va con la hoja.
    const pb = camara(rampa(t, 0, 1.1)), b = ctx.objetos.brote, a = planta.brote;
    Object.assign(b, {
      visible: true,
      x: lerp(a.x, BROTE_FIN.x, pb) - 70 * Math.sin(Math.PI * pb),
      y: lerp(a.y, BROTE_FIN.y, pb) - 110 * sale,
      k: a.k * Math.pow(BROTE_FIN.k / a.k, pb),
      alfa: 1 - rampa(t, ctx.dur + 0.15, 0.6),
    });
    opacidad(ctx.logo, suave(rampa(t, 1.1, 0.6)));
    aparecer(ctx.titulo, suave(rampa(t, 1.0, 0.7)), 6);
    // Contenido de la hoja, al ritmo de la voz.
    aparecer(ctx.curso, suave(rampa(t, Math.max(ctx.cue(1).a, 1.2), 0.6)));
    for (const p of ctx.integrantes) aparecer(p.e, suave(rampa(t, p.cuando(ctx), 0.5)));
    aparecer(ctx.tutores, suave(rampa(t, ctx.cue(5).a, 0.6)));
    opacidad(ctx.pie, suave(rampa(t, 1.4, 0.6)));
    // «Nuestro proyecto…»: se subraya la primera línea del título.
    const ps = suave(rampa(t, ctx.cue(6).a, 0.9));
    ctx.subrayado.style.transform = `scaleX(${ps.toFixed(4)})`;
  },
});

const css = document.createElement('style');
css.textContent = `

.e2-filete { position: absolute; inset: 14px; border: 2px solid var(--tierra); }
.e2-filete::after { content: ''; position: absolute; inset: 5px; border: 1px solid var(--tierra); }
.e2-logo { position: absolute; }
.e2-titulo { position: absolute; left: 80px; right: 80px; top: 166px; text-align: center;
  font: 700 54px/1.13 var(--bodoni); color: var(--salvia-oscura); }
.e2-l1 { position: relative; display: inline-block; }
.e2-subrayado { position: absolute; left: 0; right: 0; bottom: -2px; height: 3px; background: var(--ocre-hondo);
  transform-origin: 0 50%; transform: scaleX(0); }
.e2-curso { position: absolute; left: 60px; right: 60px; top: 386px; text-align: center; font: 21px/1.4 var(--ui); color: var(--tierra); }
.e2-integrantes { position: absolute; left: 90px; right: 90px; top: 456px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px;
  border-top: 1px solid rgba(76,69,65,.15); padding-top: 34px; }
.e2-persona { text-align: center; }
.e2-nombre { font: 30px/1.3 var(--texto); color: var(--tinta); }
.e2-nota { font: italic 21px var(--texto); color: var(--tierra-suave); margin-top: 6px; }
.e2-tutores { position: absolute; left: 60px; right: 60px; top: 628px; text-align: center; font: 24px/1.4 var(--texto); color: var(--tierra); }
.e2-pie { position: absolute; left: 60px; right: 60px; top: 690px; text-align: center; font: 19px var(--ui); color: var(--tierra-suave); }
`;
document.head.appendChild(css);
})();
