/* E3 · El problema: plantar no es reforestar (PLAN §5, E3).
 *
 * La hoja de título se retira y la cámara vuela a un claro de la carta, al este del
 * sitio, donde se dibuja una hectárea a escala real: la retícula al tresbolillo de
 * 14 × 47 = 658 posiciones de scripts/simulacion_siembra.py. Las posiciones se llenan
 * en una onda diagonal, toman el color de su especie (la meta por especie de esa
 * hectárea, barajada con semilla fija), y una realización de la supervivencia vacía
 * las que mueren. Al final, el dilema de la compra en un control deslizante.
 */
/* global DATOS */
(() => {
'use strict';
const V = window.REFOR_VIDEO, K = window.CARTA, C = window.EXPO_COMUN, D = DATOS, DV = window.DATOS_VIDEO;
const { rampa, suave, camara, aparecer, opacidad, html, lerp, clamp } = V;

/* ---------- La hectárea, en metros de la carta ---------- */
const HA = DV.hectarea, d = K.DIST, FILA = K.FILA;
const ANCHO_HA = HA.columnas * d, ALTO_HA = HA.filas * FILA;   // 47 d × 14 filas = exactamente 1 ha
const ORIGEN = [K.SITIO.x1 + 420, (K.SITIO.y0 + K.SITIO.y1) / 2 - ALTO_HA / 2];
const CENTRO_HA = [ORIGEN[0] + ANCHO_HA / 2, ORIGEN[1] + ALTO_HA / 2];
// En pantalla: 1100 px de ancho, de x = 96 a 1196, con el centro en y = 372.
const CAM_HA = K.mostrar(CENTRO_HA, [646, 372], 1100 / ANCHO_HA);
// Filas pares corridas d/4 a la izquierda y las impares d/4 a la derecha: el tresbolillo
// queda dentro del rectángulo de una hectárea.
const ESP = D.especies.map(e => e.ab), Q = Object.fromEntries(D.especies.map(e => [e.ab, e.q]));
const PUNTOS = [];
for (let f = 0; f < HA.filas; f++) for (let c = 0; c < HA.columnas; c++) {
  const x = (c + 0.5 + (f % 2 ? 0.25 : -0.25)) * d, y = (f + 0.5) * FILA;
  PUNTOS.push({ x: ORIGEN[0] + x, y: ORIGEN[1] + y, u: (x + y) / (ANCHO_HA + ALTO_HA) });
}
{
  // Composición de la hectárea barajada con semilla fija (solo ilustra la mezcla), y
  // una realización de la supervivencia: cada planta vive con la q de su especie.
  const lista = ESP.flatMap(ab => Array(HA.meta[ab]).fill(ab)), r = C.mulberry32(658);
  for (let i = lista.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [lista[i], lista[j]] = [lista[j], lista[i]]; }
  const rv = C.mulberry32(2021);
  PUNTOS.forEach((p, k) => { p.ab = lista[k]; p.muere = rv() > Q[p.ab]; p.ret = rv(); });
}

// Dibuja la hectárea con la cámara dada. e = { marco, onda, color, muerte, alfa } en [0, 1];
// devuelve cuántas posiciones están llenas.
function dibujarHectarea(g, cam, e) {
  const s = cam.s, [x0, y0] = K.proyectar(cam, ORIGEN), w = ANCHO_HA * s, h = ALTO_HA * s, r = 0.3 * d * s;
  g.save();
  g.globalAlpha = e.alfa;
  if (e.marco > 0) {
    g.fillStyle = C.PAPEL; g.globalAlpha = e.alfa * Math.min(1, e.marco * 1.5);
    g.fillRect(x0, y0, w, h);
    g.globalAlpha = e.alfa;
    g.strokeStyle = C.TS; g.lineWidth = 1.5; g.lineJoin = 'round';
    // El contorno se traza desde la esquina superior izquierda, en el sentido del reloj.
    const esq = [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h], [x0, y0]];
    let resta = e.marco * 2 * (w + h);
    g.beginPath(); g.moveTo(x0, y0);
    for (let k = 1; k < esq.length && resta > 0; k++) {
      const [ax, ay] = esq[k - 1], [bx, by] = esq[k], l = Math.hypot(bx - ax, by - ay), q = Math.min(1, resta / l);
      g.lineTo(ax + (bx - ax) * q, ay + (by - ay) * q);
      resta -= l;
    }
    g.stroke();
  }
  // Posiciones vacías: un punto fino.
  let llenas = 0;
  g.fillStyle = C.TS;
  for (const p of PUNTOS) {
    const sf = clamp((e.onda * 1.08 - p.u) / 0.08);
    if (sf >= 0.5) llenas++;
    const X = x0 + (p.x - ORIGEN[0]) * s, Y = y0 + (p.y - ORIGEN[1]) * s;
    if (sf < 1 && e.marco > 0) {
      g.globalAlpha = e.alfa * 0.45 * Math.min(1, e.marco * 2) * (1 - sf);
      g.beginPath(); g.arc(X, Y, 1.8, 0, 2 * Math.PI); g.fill();
    }
  }
  // Posiciones llenas: tierra suave, luego el color de su especie; las que mueren quedan huecas.
  for (const p of PUNTOS) {
    const sf = clamp((e.onda * 1.08 - p.u) / 0.08);
    if (sf <= 0) continue;
    const X = x0 + (p.x - ORIGEN[0]) * s, Y = y0 + (p.y - ORIGEN[1]) * s;
    const cm = clamp((e.color * 1.6 - p.u * 0.6)), dm = p.muere ? clamp(e.muerte * 2.2 - p.ret * 1.2) : 0;
    const col = C.mix(C.TS, C.ESPC[p.ab][0], suave(cm));
    if (dm > 0) {
      g.globalAlpha = e.alfa * suave(dm);
      g.strokeStyle = C.TS; g.lineWidth = 1.5;
      g.beginPath(); g.arc(X, Y, r - 0.75, 0, 2 * Math.PI); g.stroke();
    }
    const rr = r * V.elastico(sf) * (1 - suave(dm));
    if (rr <= 0.05) continue;
    g.globalAlpha = e.alfa;
    g.fillStyle = col;
    g.beginPath(); g.arc(X, Y, rr, 0, 2 * Math.PI); g.fill();
    if (cm > 0.5) { g.strokeStyle = C.TS; g.lineWidth = 0.75; g.stroke(); }
  }
  g.restore();
  return llenas;
}
V.compartido.hectarea = { CAM_HA, CENTRO_HA, ANCHO_HA, dibujar: dibujarHectarea, FINAL: { marco: 1, onda: 1, color: 1, muerte: 1, alfa: 1 } };

/* ---------- Leyenda: especies por género, luego supervivencia ---------- */
const GRUPOS = [
  { nombre: 'Agaves', palabra: 'agaves', especies: D.especies.filter(e => e.genero === 'Agave') },
  { nombre: 'Nopales', palabra: 'nopales', especies: D.especies.filter(e => e.genero === 'Opuntia') },
  { nombre: 'Mezquite', palabra: 'mezquite', especies: D.especies.filter(e => e.ab === 'Pla') },
  { nombre: 'Yuca', palabra: 'yuca', especies: D.especies.filter(e => e.ab === 'Yfi') },
];
const corto = n => n[0] + '. ' + n.split(' ')[1];
const pct = q => C.fmt(q * 100, 1) + ' %';

V.escena({
  id: 'E3', entrada: 0, cola: 0.7,

  construir(ctx) {
    const r = ctx.raiz;
    ctx.g = V.lienzo(r);
    ctx.titulo = html('div', 'abs e3-titulo', r, 'Una hectárea');
    const cont = html('div', 'abs e3-contador cifra', r);
    ctx.contN = html('span', 'n', cont, '0');
    html('span', '', cont, ' plantas');
    ctx.contador = cont;
    ctx.nota = html('div', 'abs e3-nota', r, `${HA.filas} × ${HA.columnas} posiciones al tresbolillo`);
    // Leyenda a la derecha.
    const ley = html('div', 'abs e3-leyenda', r);
    ctx.ley1 = html('div', 'e3-ley-titulo', ley, `${D.especies.length} especies nativas · plantas por hectárea`);
    ctx.ley2 = html('div', 'e3-ley-titulo e3-ley-titulo2', ley, 'Supervivencia al primer año');
    ctx.grupos = GRUPOS.map(gr => {
      const e = html('div', 'e3-grupo', ley);
      html('div', 'e3-gnombre', e, gr.nombre);
      const filas = gr.especies.map(es => {
        const f = html('div', 'e3-fila', e);
        const sw = C.el('svg', { width: 26, height: 28, viewBox: '-13 -14 26 28' }, f);
        C.el('path', { d: C.hexD(12), fill: C.ESPC[es.ab][0], stroke: C.TS, 'stroke-width': 1 }, sw);
        html('span', 'e3-bin', f, corto(es.nombre));
        const n = html('span', 'e3-n cifra', f, C.fmt(HA.meta[es.ab]));
        const barra = html('span', 'e3-barra', f);
        const lleno = html('i', '', barra);
        lleno.style.background = C.ESPC[es.ab][0];
        const p = html('span', 'e3-pct cifra', f, pct(es.q));
        return { n, barra, lleno, p, q: es.q };
      });
      return { e, filas, palabra: gr.palabra };
    });
    ctx.leyenda = ley;
    // Control deslizante del dilema, bajo la hectárea.
    const des = html('div', 'abs e3-deslizante', r);
    html('div', 'e3-des-titulo', des, 'plantas compradas');
    html('div', 'e3-eje', des);
    ctx.presu = html('div', 'e3-presu', des);
    html('div', 'e3-presu-t', ctx.presu, `$${C.fmt(D.totales.presupuesto)} por hectárea`);
    ctx.izq = html('div', 'e3-zona e3-izq', des, 'faltan plantas → hay que reponer');
    ctx.der = html('div', 'e3-zona e3-der', des, 'se rebasa el presupuesto');
    ctx.perilla = html('div', 'e3-perilla', des);
    ctx.deslizante = des;
  },

  tick(t, ctx) {
    const ca = ctx.carta.estado, c5 = ctx.cue(5);
    const tHa = ctx.palabra(1, 'hectárea'), tOnda = ctx.palabra(1, 'seiscientas'), tColor = ctx.palabra(2, 'diez');
    const tMuere = ctx.palabra(4, 'muere');
    let cam = CAM_HA;
    if (t <= ctx.dur) {
      // De la carta detrás del título a la hectárea, con la carta atenuada.
      const ti = V.compartido.titulo;
      cam = K.viaje(ti.camara, CAM_HA, CENTRO_HA, camara(rampa(t, 0.1, 2.5)));
      ca.camara = cam;
      // A mitad del vuelo la carta se aclara para que se lea el movimiento; luego se atenúa.
      ca.atenuar = lerp(lerp(ti.atenuar, 0.4, suave(rampa(t, 0.1, 1.1))), 0.72, suave(rampa(t, 1.4, 1.3)));
    }
    const sale = 1 - rampa(t, ctx.dur, 0.5);
    // La hectárea (sigue en E4, que la dibuja con su propia cámara).
    const g = ctx.g; g.limpiar();
    if (t <= ctx.dur) {
      const llenas = dibujarHectarea(g, cam, {
        alfa: 1, marco: suave(rampa(t, tHa - 0.2, 1.0)), onda: suave(rampa(t, tOnda, 2.5)),
        color: rampa(t, tColor, 1.2), muerte: rampa(t, tMuere, 1.6),
      });
      ctx.contN.textContent = C.fmt(llenas);
    } else ctx.contN.textContent = C.fmt(PUNTOS.length);
    aparecer(ctx.titulo, suave(rampa(t, tHa - 0.3, 0.7)) * sale);
    aparecer(ctx.nota, suave(rampa(t, tHa + 0.2, 0.7)) * sale);
    opacidad(ctx.contador, suave(rampa(t, tOnda, 0.4)) * sale);
    // Leyenda: el título y cada género cuando la voz lo nombra.
    opacidad(ctx.leyenda, sale);
    const pSup = suave(rampa(t, tMuere + 0.4, 0.8));
    aparecer(ctx.ley1, suave(rampa(t, tColor, 0.6)) * (1 - pSup), 6);
    aparecer(ctx.ley2, pSup, 6);
    ctx.grupos.forEach((gr, i) => {
      aparecer(gr.e, suave(rampa(t, ctx.palabra(2, gr.palabra) - 0.1, 0.5)));
      gr.filas.forEach((f, k) => {
        const pb = suave(rampa(t, tMuere + 0.5 + (i * 3 + k) * 0.06, 0.9));
        opacidad(f.n, 1 - rampa(t, tMuere + 0.3, 0.4));
        opacidad(f.barra, pb); opacidad(f.p, pb);
        f.lleno.style.transform = `scaleX(${(f.q * pb).toFixed(4)})`;
      });
    });
    // El dilema: la perilla va a «menos», a «más» y se queda oscilando en el centro.
    const tMenos = ctx.palabra(5, 'menos'), tMas = ctx.palabra(5, 'más'), tPresu = ctx.palabra(5, 'presupuesto');
    aparecer(ctx.deslizante, suave(rampa(t, c5.a - 0.3, 0.6)) * sale);
    const CENTRO = 470, IZQ = 110, DER = 900;
    let x = CENTRO;
    x = lerp(x, IZQ, camara(rampa(t, tMenos - 0.2, 0.9)));
    x = lerp(x, DER, camara(rampa(t, tMas - 0.2, 1.1)));
    const vuelta = camara(rampa(t, tPresu + 0.3, 1.0));
    x = lerp(x, CENTRO, vuelta) + vuelta * 70 * Math.sin((t - tPresu - 0.3) * Math.PI / 0.9) * rampa(t, tPresu + 0.6, 0.8);
    ctx.perilla.style.transform = `translateX(${V.px(x)})`;
    const enIzq = clamp((300 - x) / 120), enDer = clamp((x - 700) / 80);
    opacidad(ctx.izq, 0.45 + 0.55 * enIzq);
    opacidad(ctx.der, 0.45 + 0.55 * enDer);
  },
});

const css = document.createElement('style');
css.textContent = `
.e3-titulo { left: 96px; top: 84px; font: 64px/1.1 var(--display); color: var(--tinta); }
.e3-contador { right: ${1920 - 1196}px; top: 116px; font: 26px var(--ui); color: var(--tierra-suave); text-align: right; }
.e3-contador .n { font: 600 34px var(--ui); color: var(--tinta); }
.e3-nota { left: 96px; top: 528px; font: 20px var(--ui); color: var(--tierra-suave); }
.e3-leyenda { left: 1290px; top: 150px; width: 534px; }
.e3-ley-titulo { font: 500 20px var(--ui); color: var(--tierra-suave); height: 34px; }
.e3-ley-titulo2 { position: absolute; left: 0; top: 0; color: var(--tinta); font: 500 22px var(--ui); }
.e3-grupo { margin-top: 10px; }
.e3-gnombre { font: 500 17px var(--ui); color: var(--tierra-suave); margin: 0 0 2px; letter-spacing: .01em; }
.e3-fila { position: relative; height: 38px; display: flex; align-items: center; gap: 12px; }
.e3-bin { font: italic 24px var(--texto); color: var(--tinta); width: 230px; }
.e3-n { font: 500 22px var(--ui); color: var(--tinta); }
.e3-barra { position: absolute; left: 270px; top: 10px; width: 170px; height: 18px; border: 1px solid var(--tierra-suave); }
.e3-barra i { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; transform-origin: 0 50%; transform: scaleX(0);
  border-right: 1px solid var(--tierra-suave); }
.e3-pct { position: absolute; left: 454px; font: 500 21px var(--ui); color: var(--tinta); }
.e3-deslizante { left: 96px; top: 600px; width: 1100px; height: 240px; }
.e3-des-titulo { position: absolute; left: 0; top: 0; font: 500 22px var(--ui); color: var(--tierra); }
.e3-eje { position: absolute; left: 40px; right: 40px; top: 96px; height: 2px; background: var(--tierra); }
.e3-presu { position: absolute; left: 860px; top: 62px; width: 0; height: 70px; border-left: 3px dashed var(--ocre-hondo); }
.e3-presu-t { position: absolute; left: -12px; top: -34px; transform: translateX(-100%); white-space: nowrap;
  font: 600 22px var(--ui); color: var(--ocre-hondo); }
.e3-zona { position: absolute; top: 128px; font: italic 25px var(--texto); color: var(--tierra); white-space: nowrap; }
.e3-izq { left: 40px; }
.e3-der { left: 880px; }
.e3-perilla { position: absolute; left: 40px; top: 83px; width: 28px; height: 28px; margin-left: -14px; border-radius: 50%;
  background: var(--tinta); box-shadow: 0 0 0 4px var(--papel), 0 2px 8px rgba(76,69,65,.3); }
`;
document.head.appendChild(css);
})();
