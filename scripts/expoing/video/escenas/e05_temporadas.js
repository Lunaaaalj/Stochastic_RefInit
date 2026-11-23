/* E5 · Pregunta 1: diez mil temporadas (PLAN §5, E5).
 *
 * Tarjeta de capítulo con iris hexagonal. Luego, la ficha de Agave salmiana en el
 * polígono 1 (DATOS.escenarios): meta, existentes y las vivas que faltan; y el
 * histograma de las 10,000 temporadas simuladas (el de piezas.js, función
 * temporadas), con la compra de 220 que alcanza en el 96 % de ellas.
 */
/* global DATOS */
(() => {
'use strict';
const V = window.REFOR_VIDEO, K = window.CARTA, C = window.EXPO_COMUN, D = DATOS;
const { rampa, suave, aparecer, opacidad, html, lerp } = V;

const SC = D.escenarios, DIST = SC.dist, XS = DIST.map(d => d[0]), PM = Math.max(...DIST.map(d => d[1]));
const ACUM = DIST.filter(([x]) => x <= SC.q95).reduce((a, [, p]) => a + p, 0);
const ESP = D.especies.find(e => e.nombre === SC.especie);
const FALTAN = SC.meta - SC.existentes;
// Histograma a todo lo ancho, sobre la franja de subtítulos.
const H = { x: 96, base: 800, w: 1728, alto: 360 };
const BW = H.w / XS.length, XQ = H.x + (XS.indexOf(SC.q95) + 1) * BW;
// 10,000 temporadas muestreadas de la distribución exacta con semilla fija, con un corte
// cada 100 para que las barras crezcan mientras corre el contador (igual que piezas.js).
const CORTES = (() => {
  const r = C.mulberry32(2026), cdf = [], cortes = [], c = new Array(XS.length).fill(0);
  DIST.reduce((s, [, p], i) => (cdf[i] = s + p), 0);
  const tot = cdf[cdf.length - 1];
  for (let n = 1; n <= 10000; n++) {
    const u = r() * tot; let i = 0;
    while (i < cdf.length - 1 && u > cdf[i]) i++;
    c[i]++;
    if (n % 100 === 0) cortes.push(c.slice());
  }
  return cortes;
})();
// Cámara de la carta detrás de E5 y E6: el sitio, abajo a la derecha, con el polígono 1.
const CAM_E5 = K.mostrar(K.CENTRO_SITIO, [1230, 600], 0.27);
V.compartido.temporadas = { CAM_E5, H, miniatura };

// Miniatura del histograma final (para el corte por continuidad de E6).
function miniatura(padre, w, h) {
  const s = C.el('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}` }, padre), bw = w / XS.length;
  DIST.forEach(([x, p], i) => {
    const hh = p / PM / 1.08 * (h - 4);
    C.el('rect', { x: (i * bw + 0.6).toFixed(2), y: (h - 2 - hh).toFixed(2), width: (bw - 1.2).toFixed(2), height: hh.toFixed(2),
      fill: x <= SC.q95 ? C.SALVIA_H : C.SALVIA }, s);
  });
  C.el('path', { d: `M0 ${h - 1.5}H${w}`, stroke: C.TIERRA, 'stroke-width': 1.2 }, s);
  const xq = (XS.indexOf(SC.q95) + 1) * bw;
  C.el('path', { d: `M${xq} 0V${h}`, stroke: C.OCRE_H, 'stroke-width': 2, 'stroke-dasharray': '4 3' }, s);
  return s;
}

V.escena({
  id: 'E5', entrada: 0, cola: 0.9,

  construir(ctx) {
    const r = ctx.raiz;
    // Ficha de especie (como la etiqueta de herbario de DESIGN.md §4).
    const fi = html('div', 'abs e5-ficha', r);
    html('div', 'e5-bin', fi, SC.especie);
    html('div', 'e5-dato', fi, `polígono ${SC.poligono} · supervivencia ${C.fmt(ESP.q * 100, 1)} %`);
    ctx.ficha = fi;
    // Meta − existentes = las que deben sobrevivir.
    const cif = html('div', 'abs e5-cifras', r);
    const bloque = (n, rot) => { const b = html('div', 'e5-bloque', cif); html('div', 'e5-n cifra', b, C.fmt(n)); html('div', 'e5-rot', b, rot); return b; };
    ctx.meta = bloque(SC.meta, 'meta');
    ctx.menos = html('div', 'e5-op', cif, '−');
    ctx.hay = bloque(SC.existentes, 'ya hay');
    ctx.igual = html('div', 'e5-op', cif, '=');
    ctx.faltan = bloque(FALTAN, 'faltan vivas');
    ctx.faltan.classList.add('e5-deduce');
    // Histograma.
    const s = C.el('svg', { class: 'abs', width: 1920, height: 1080, viewBox: '0 0 1920 1080' }, r);
    ctx.hist = s;
    ctx.barras = DIST.map(([x], i) => C.el('rect', { x: (H.x + i * BW + 1.5).toFixed(1), y: H.base, width: (BW - 3).toFixed(1), height: 0, fill: C.SALVIA }, s));
    C.el('path', { d: `M${H.x} ${H.base + 0.5}H${H.x + H.w}`, stroke: C.TIERRA, 'stroke-width': 1.5 }, s);
    [206, 210, 215, 220, 225, 228].forEach(x => {
      const i = XS.indexOf(x);
      if (i >= 0) C.tx(s, H.x + i * BW + BW / 2, H.base + 28, String(x), { 'font-family': 'Instrument Sans', 'font-size': 20, fill: C.TS, 'text-anchor': 'middle' });
    });
    C.tx(s, H.x + H.w / 2, H.base + 56, 'plantas que hacían falta en cada temporada', { 'font-family': 'Instrument Sans', 'font-size': 20, fill: C.TS, 'text-anchor': 'middle' });
    ctx.linea = C.el('path', { d: `M${XQ} ${H.base - H.alto - 10}V${H.base + 6}`, stroke: C.OCRE_H, 'stroke-width': 3, 'stroke-dasharray': '8 6', opacity: 0 }, s);
    ctx.t1 = C.tx(s, XQ + 16, H.base - H.alto + 16, `comprar ${SC.q95}`, { 'font-family': 'Instrument Sans', 'font-size': 30, fill: C.OCRE_H, 'font-weight': 600, opacity: 0 });
    ctx.t2 = C.tx(s, XQ + 16, H.base - H.alto + 50, `alcanza en ${C.fmt(ACUM * 100)} % de las temporadas`, { 'font-family': 'Instrument Sans', 'font-size': 23, fill: C.TIERRA, opacity: 0 });
    const co = html('div', 'abs e5-contador', r);
    ctx.contN = html('div', 'e5-cn cifra', co, '0');
    html('div', 'e5-rot', co, 'temporadas simuladas');
    ctx.contador = co;
    ctx.rotulo = html('div', 'rotulo-tecnico e5-rotulo', r, 'Simulación Monte Carlo');
    ctx.cap = V.capitulo(r, 'Pregunta 1', '¿Cuánto comprar?');
  },

  tick(t, ctx) {
    const ca = ctx.carta.estado, c1 = ctx.cue(1), c2 = ctx.cue(2), c3 = ctx.cue(3), c4 = ctx.cue(4);
    ctx.cap.tick(t, ctx, 1.9);
    if (t < 0.5) {
      // Mientras el iris se cierra, la carta sigue como la dejó E4; cambia ya cubierta por la tinta.
      ca.camara = V.compartido.finE4.camara; ca.atenuar = V.compartido.finE4.atenuar;
    } else if (t <= ctx.dur) {
      ca.camara = CAM_E5;
      ca.atenuar = lerp(0.62, 0.9, suave(rampa(t, c3.a - 0.3, 0.8)));
      ca.resalte = { i: K.P1.i, p: suave(rampa(t, c1.a + 0.2, 1.2)) * (1 - rampa(t, c3.a - 0.3, 0.6)) };
    }
    const sale = 1 - rampa(t, ctx.dur + 0.3, 0.5);   // E6 trae su hoja encima
    aparecer(ctx.ficha, suave(rampa(t, c1.a - 0.1, 0.7)) * sale);
    const tMeta = ctx.palabra(2, 'doscientas'), tHay = ctx.palabra(2, 'cuarenta');
    aparecer(ctx.meta, suave(rampa(t, tMeta - 0.1, 0.5)) * sale);
    opacidad(ctx.menos, suave(rampa(t, tHay - 0.3, 0.4)) * sale);
    aparecer(ctx.hay, suave(rampa(t, tHay - 0.1, 0.5)) * sale);
    opacidad(ctx.igual, suave(rampa(t, c2.b - 0.2, 0.4)) * sale);
    aparecer(ctx.faltan, suave(rampa(t, c2.b, 0.6)) * sale);
    // Histograma: las barras crecen con el contador de 0 a 10,000.
    opacidad(ctx.hist, suave(rampa(t, c3.a - 0.2, 0.4)) * sale);
    const n = 10000 * C.eOut(rampa(t, c3.a, 2.6)), k = Math.floor(n / 100);
    const cc = k < 1 ? null : CORTES[Math.min(CORTES.length, k) - 1], marca = rampa(t, c4.a, 0.5);
    ctx.barras.forEach((b, i) => {
      const h = cc ? Math.min(1, cc[i] / (PM * 10000 * 1.08)) * H.alto : 0;
      b.setAttribute('y', (H.base - h).toFixed(1)); b.setAttribute('height', h.toFixed(1));
      b.setAttribute('fill', XS[i] <= SC.q95 ? C.mix(C.SALVIA, C.SALVIA_H, marca) : C.SALVIA);
    });
    ctx.contN.textContent = C.fmt(k * 100);
    opacidad(ctx.contador, suave(rampa(t, c3.a - 0.2, 0.4)) * sale);
    opacidad(ctx.rotulo, suave(rampa(t, c3.a + 0.6, 0.6)) * sale);
    const tl = suave(rampa(t, c4.a, 0.6));
    ctx.linea.setAttribute('opacity', tl.toFixed(3));
    ctx.t1.setAttribute('opacity', tl.toFixed(3));
    ctx.t2.setAttribute('opacity', suave(rampa(t, ctx.palabra(4, 'alcanza'), 0.6)).toFixed(3));
  },
});

const css = document.createElement('style');
css.textContent = `
.e5-ficha { left: 96px; top: 96px; width: 560px; padding: 22px 28px 20px; background: var(--papel);
  border: 1px solid rgba(76,69,65,.3); box-shadow: 0 6px 24px rgba(76,69,65,.10); }
.e5-bin { font: italic 46px/1.1 var(--texto); color: var(--tinta); }
.e5-dato { font: 24px/1.4 var(--ui); color: var(--tierra); margin-top: 10px; }
.e5-cifras { left: 740px; top: 96px; display: flex; align-items: flex-start; gap: 34px; }
.e5-bloque { text-align: left; }
.e5-n { font: 92px/1 var(--display); color: var(--tinta); }
.e5-deduce .e5-n { color: var(--ocre-hondo); }
.e5-rot { font: 22px/1.3 var(--ui); color: var(--tierra-suave); margin-top: 6px; }
.e5-op { font: 64px/1.2 var(--display); color: var(--tierra-suave); }
.e5-contador { left: 96px; top: 330px; }
.e5-cn { font: 72px/1 var(--display); color: var(--tinta); }
.e5-rotulo { right: 96px; top: 842px; text-align: right; }
`;
document.head.appendChild(css);
})();
