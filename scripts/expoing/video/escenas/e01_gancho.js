/* E1 · Gancho: de la región a la planta (PLAN §5, E1).
 *
 * Tinta y silencio; amanece mientras las curvas de nivel se revelan de dentro
 * hacia fuera; se trazan los 30 polígonos y se rellenan en orden geográfico; la
 * cámara vuela al polígono 1 hasta una sola posición de la retícula, donde brota
 * la planta (la marca del logo), que en E2 se queda como logo.
 */
/* global DATOS */
(() => {
'use strict';
const V = window.REFOR_VIDEO, K = window.CARTA, C = window.EXPO_COMUN, D = DATOS;
const { rampa, suave, camara, elastico, opacidad, aparecer, html } = V;

const CENTRO = [(K.SITIO.x0 + K.SITIO.x1) / 2, (K.SITIO.y0 + K.SITIO.y1) / 2];
// Antes de la vista del sitio, la región: un poco más lejos, y la cámara empuja despacio.
const CAM_REGION = K.mostrar(CENTRO, [1100, 476], K.CAM_SITIO.s * 0.72);
V.compartido.region = CAM_REGION;
// La planta: la posición central del polígono 1, a ≈ 74× la escala del sitio.
const ESCALA_PLANTA = 28;
const CAM_PLANTA = K.mostrar(K.OBJETIVO, [960, 610], ESCALA_PLANTA);
// La marca mide 90 unidades de radio; queda un poco dentro del hexágono de la planta.
const K_BROTE = 0.84 * K.RHEX * ESCALA_PLANTA / 90;
V.compartido.planta = { camara: CAM_PLANTA, brote: { x: 960, y: 610, k: K_BROTE } };

// Orden geográfico del relleno: de noroeste a sureste.
const ORDEN = K.PROGRAMA.slice().sort((a, b) => (a.c[0] + a.c[1]) - (b.c[0] + b.c[1]));
const RANGO = new Map(ORDEN.map((p, k) => [p.i, k]));
const N = ORDEN.length;

V.escena({
  id: 'E1', entrada: 0, cola: 0.8,

  construir(ctx) {
    const r = ctx.raiz;
    // Anotación cartográfica arriba a la izquierda, en un recuadro de papel como la
    // leyenda de una carta (el texto nunca va directo sobre el mapa).
    const an = html('div', 'abs e1-anotacion', r);
    Object.assign(an.style, { left: '96px', top: '72px' });
    html('div', 'e1-cifras', an, `${C.fmt(Math.round(D.totales.area))} ha · ${D.totales.poligonos} polígonos`);
    html('div', 'e1-lugar', an, 'Línea de Transmisión Dominica–Charcas, San Luis Potosí');
    const esc = html('div', 'e1-escala', an);
    const svg = C.el('svg', { width: 300, height: 44, viewBox: '0 0 300 44' }, esc);
    ctx.barra = C.el('path', { d: '', stroke: C.TIERRA, 'stroke-width': 2, fill: 'none' }, svg);
    ctx.barraT = C.tx(svg, 0, 31, '500 m', { 'font-family': 'Instrument Sans', 'font-size': 18, fill: C.TS });
    const norte = C.el('g', { transform: 'translate(280 0)' }, svg);
    C.el('path', { d: 'M0 30V8M0 3L-6 17L0 13L6 17Z', stroke: C.TIERRA, 'stroke-width': 1.6, fill: C.TIERRA, 'stroke-linejoin': 'round' }, norte);
    C.tx(norte, 0, 44, 'N', { 'font-family': 'Instrument Sans', 'font-size': 14, 'font-weight': 600, fill: C.TIERRA, 'text-anchor': 'middle' });
    ctx.anotacion = an;
    // Contador de polígonos, dentro del recuadro.
    const co = html('div', 'e1-contador cifra', an);
    ctx.contN = html('span', 'n', co, '0');
    html('span', 'de', co, `de ${N} terrenos`);
    ctx.contador = co;
    // La pregunta, sobre una neblina de papel en la mitad superior.
    ctx.neblina = html('div', 'abs e1-neblina', r);
    const pr = html('div', 'abs e1-pregunta', r);
    ctx.l1 = html('div', '', pr, '¿Cuántas plantas comprar');
    ctx.l2 = html('div', '', pr, 'y dónde poner cada una?');
    ctx.pregunta = pr;
  },

  tick(t, ctx) {
    const ca = ctx.carta.estado, c1 = ctx.cue(1), c2 = ctx.cue(2), c3 = ctx.cue(3), c4 = ctx.cue(4);
    const tComprar = ctx.palabra(4, 'comprar'), tDonde = ctx.palabra(4, 'dónde'), tCada = ctx.palabra(4, 'cada');
    const paso = (c2.b - c2.a - 0.5) / (N - 1);

    if (t <= ctx.dur) {
      // Amanecer de tinta a papel (≈ 2.5 s) y curvas que se revelan desde el sitio.
      ca.amanecer = C.eIO(rampa(t, 1.2, 2.5));
      ca.curvas.revelado = C.eIO(rampa(t, 1.2, 2.8));
      ca.curvas.brillo = V.lerp(1.8, 1, ca.amanecer);
      // Cámara: empuje lento de la región al sitio; luego, el vuelo a la planta.
      const pZoom = camara(rampa(t, c3.a, tDonde - c3.a));
      ca.camara = pZoom > 0 ? K.viaje(K.CAM_SITIO, CAM_PLANTA, K.OBJETIVO, pZoom)
        : K.viaje(CAM_REGION, K.CAM_SITIO, CENTRO, camara(rampa(t, 0, c3.a)));
      ca.curvas.centro = K.proyectar(ca.camara, CENTRO);
      // Polígonos: se trazan en 1.8 s con la primera frase y se rellenan uno por uno con la segunda.
      const trazo = [], relleno = [];
      for (const p of K.POLS) {
        const k = RANGO.has(p.i) ? RANGO.get(p.i) : N / 2;
        trazo[p.i] = suave(rampa(t, c1.a + k * 0.015, 1.8));
        relleno[p.i] = suave(rampa(t, c2.a + k * paso, 0.5));
      }
      ca.poligonos.trazo = trazo; ca.poligonos.relleno = relleno;
      ca.poligonos.colorTrazo = C.mix(C.PAPEL, C.TS, ca.amanecer);
      // Retícula: se enciende con «comprar»; con «dónde», las celdas y la planta elegida.
      ca.reticula.alfa = 1;
      ca.reticula.onda = 70 * suave(rampa(t, tComprar, 1.4));
      ca.reticula.celdas = rampa(t, tDonde - 0.2, 0.6);
      ca.reticula.objetivo = suave(rampa(t, tDonde, 0.6));
      // Brota la planta con «cada una».
      const b = ctx.objetos.brote, pb = rampa(t, tCada, 0.6);
      if (pb > 0) Object.assign(b, { visible: true, x: 960, y: 610, k: K_BROTE * elastico(pb) });
    }

    // Anotación: entra con la primera frase y se va cuando empieza el vuelo.
    const fuera = 1 - rampa(t, c3.a, 0.6);
    aparecer(ctx.anotacion, suave(rampa(t, c1.a, 0.9)) * fuera);
    const L = 500 * (t <= ctx.dur ? ca.camara.s : K.CAM_SITIO.s);
    ctx.barra.setAttribute('d', `M1 18V28H${(1 + L).toFixed(1)}V18M1 28H${(1 + L).toFixed(1)}`);
    ctx.barraT.setAttribute('x', (L + 14).toFixed(1));
    const n = t < c2.a ? 0 : Math.min(N, 1 + Math.floor((t - c2.a) / paso));
    ctx.contN.textContent = String(n);
    opacidad(ctx.contador, suave(rampa(t, c2.a, 0.5)));
    // Pregunta en dos líneas: la segunda con «dónde». Se va al pasar a E2.
    const sale = 1 - rampa(t, ctx.dur, 0.6);
    opacidad(ctx.neblina, rampa(t, c4.a - 0.2, 0.8) * sale);
    aparecer(ctx.l1, suave(rampa(t, c4.a, 0.7)) * sale, 10);
    aparecer(ctx.l2, suave(rampa(t, tDonde - 0.15, 0.7)) * sale, 10);
  },
});

const css = document.createElement('style');
css.textContent = `
.e1-anotacion { color: var(--tierra); background: var(--papel); padding: 22px 28px 18px;
  border: 1px solid rgba(76,69,65,.22); box-shadow: 0 6px 24px rgba(76,69,65,.10); }
.e1-cifras { font: 36px/1.2 var(--texto); color: var(--tinta); }
.e1-lugar { font: 22px/1.4 var(--texto); color: var(--tierra-suave); margin-top: 4px; }
.e1-escala { margin-top: 14px; height: 44px; }
.e1-contador { font: 20px var(--ui); color: var(--tierra-suave); margin-top: 10px; padding-top: 10px;
  border-top: 1px solid rgba(76,69,65,.15); }
.e1-contador .n { font: 600 20px var(--ui); color: var(--tinta); display: inline-block; min-width: 1.6em; }
.e1-neblina { left: 0; top: 0; width: 1920px; height: 470px;
  background: linear-gradient(180deg, rgba(252,240,218,.95) 0%, rgba(252,240,218,.9) 55%, rgba(252,240,218,0) 100%); }
.e1-pregunta { left: 0; top: 118px; width: 1920px; text-align: center; font: 72px/1.18 var(--display); color: var(--tinta); }
`;
document.head.appendChild(css);
})();
