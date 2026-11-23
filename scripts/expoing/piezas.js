/* Piezas gráficas del perfil de Expo Ingenierías (Stochastic Reforestation Initiative).
 *
 * Dibuja con SVG las imágenes, los fondos y los logos que elige el equipo. Lo usa
 * scripts/exportar_expoing.py dentro de Chrome, que antepone los datos como las
 * constantes globales D (resumen de docs/presentacion/datos/datos.js) y CAPTURA.
 * Es el mismo código del mockup de selección; si cambia aquí, cambia la pieza.
 * La paleta, las utilidades, el campo de las curvas de nivel y la marca del logo
 * vienen de scripts/expoing/comun.js (window.EXPO_COMUN), que también usa el video.
 * Expone window.__EXPO = { V, FONDOS, LOGOS, logoSvg, crearSvg, reg }.
 */
/* global D, CAPTURA */
(() => {
'use strict';
const { NS, R3, PAPEL, PAPEL_H, TIERRA, TS, TINTA, SALVIA, SALVIA_H, OCRE, OCRE_H, ESPC, RAMPA, RAMPA_T,
  el, tx, fmt, clamp, eIO, eOut, mulberry32, mix, tonoClave, hexD, SEG, campoCurvas, NIVELES, marcaBrote, armarMosaico } = window.EXPO_COMUN;
const reducir = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
let uid = 0;

function lienzo(svg) { el('rect', { width: 1280, height: 720, fill: PAPEL }, svg); }
function marca(svg, fondo) {
  if (fondo) el('rect', { x: 36, y: 668, width: 430, height: 40, fill: PAPEL, 'fill-opacity': .94 }, svg);
  tx(svg, 48, 694, 'Stochastic Reforestation Initiative', { class: 't-ui', 'font-size': 18, fill: TS, 'letter-spacing': '.04em' });
}

/* ---------- Mosaico (clave 1, 4 × 13); la lógica vive en comun.js ---------- */
const MOS = armarMosaico(D.clave, D.W);

function crearMosaico(parent, r, ox, oy) {
  const g = el('g', {}, parent), hd = hexD(r);
  const lugar = v => [ox + R3 * r * ((v % MOS.C) + 0.5 * Math.floor(v / MOS.C)), oy + 1.5 * r * Math.floor(v / MOS.C)];
  const fs = MOS.fichas.map(fi => {
    const gg = el('g', {}, g);
    const hex = el('path', { d: hd, stroke: TS, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, gg);
    const t = tx(gg, 0, r * .18, fi.s, { class: 't-ui', 'font-size': r * .5, 'text-anchor': 'middle', 'font-weight': 500 });
    return { fi, gg, hex, t, a: lugar(fi.desde), b: lugar(fi.hasta) };
  });
  return { fs, mover(qf) { for (const f of fs) { const q = qf(f.fi); f.gg.setAttribute('transform', `translate(${(f.a[0] + (f.b[0] - f.a[0]) * q).toFixed(2)} ${(f.a[1] + (f.b[1] - f.a[1]) * q).toFixed(2)})`); } } };
}

const T_MOS = 8, T0 = 1.0;
const progresoFicha = (t, fi) => t < T0 ? 0 : t < 7 ? eIO(clamp((t - T0 - fi.ret) / fi.dur)) : t < 7.9 ? 1 - eIO((t - 7) / .9) : 0;
const progresoGlobal = t => t < T0 ? 0 : t < 7 ? clamp((t - T0) / MOS.fin) : 1 - eIO(clamp((t - 7) / .9));

function mosaicoVariante(svg, modo) {
  lienzo(svg); marca(svg);
  if (modo === 'especie') {
    tx(svg, 80, 112, 'De sembrar al azar', { class: 't-disp', 'font-size': 58, fill: TINTA });
    tx(svg, 80, 176, 'a sembrar con estrategia', { class: 'it', 'font-size': 46, fill: TIERRA });
  } else {
    tx(svg, 80, 112, 'Dónde compiten más las plantas', { class: 't-disp', 'font-size': 58, fill: TINTA });
    tx(svg, 80, 176, 'Cada hexágono suma su competencia con sus 6 vecinas', { class: 'it', 'font-size': 32, fill: TIERRA });
  }
  const r = 40, m = crearMosaico(svg, r, 172, 300);
  // Leyenda
  const ly = 568;
  if (modo === 'especie') {
    [['Agave', SALVIA], ['Opuntia', OCRE], ['Prosopis y Yucca', TIERRA]].reduce((x, [n, c]) => {
      el('path', { d: hexD(13), transform: `translate(${x + 13} ${ly})`, fill: c, stroke: TS, 'stroke-width': 1 }, svg);
      const t = tx(svg, x + 34, ly + 6, n, { class: 't-ui', 'font-size': 18, fill: TIERRA });
      return x + 34 + n.length * 10 + 30;
    }, 80);
    tx(svg, 1200, ly + 6, 'Cada género, en varios tonos', { class: 't-ui', 'font-size': 16, fill: TS, 'text-anchor': 'end' });
  } else {
    tx(svg, 80, ly + 6, 'Más clara = menos competencia', { class: 't-ui', 'font-size': 18, fill: TIERRA });
    for (let q = 0; q < 5; q++) {
      el('path', { d: hexD(13), transform: `translate(${420 + q * 120 + 13} ${ly})`, fill: RAMPA[q], stroke: TS, 'stroke-width': 1 }, svg);
      const lo = MOS.lmin + (MOS.lmax - MOS.lmin) * q / 5, hi = MOS.lmin + (MOS.lmax - MOS.lmin) * (q + 1) / 5;
      tx(svg, 420 + q * 120 + 34, ly + 6, `${fmt(lo, 1)}–${fmt(hi, 1)}`, { class: 't-ui', 'font-size': 16, fill: TS });
    }
  }
  // Barra de competencia total
  const bx = 80, by = 614, esc = 8;
  tx(svg, bx, by - 10, 'Competencia total entre plantas vecinas (menos es mejor)', { class: 't-ui', 'font-size': 18, fill: TIERRA });
  el('rect', { x: bx, y: by, width: 100 * esc, height: 22, fill: PAPEL_H, stroke: TS, 'stroke-width': 1 }, svg);
  const barra = el('rect', { x: bx, y: by, width: 0, height: 22, fill: SALVIA_H }, svg);
  const xa = bx + D.m1.azar * esc;
  el('path', { d: `M${xa} ${by - 6}V${by + 30}`, stroke: OCRE_H, 'stroke-width': 2.5, 'stroke-dasharray': '5 4' }, svg);
  tx(svg, xa, by + 52, `al azar, en promedio: ${fmt(D.m1.azar, 1)}`, { class: 't-ui', 'font-size': 16, fill: OCRE_H, 'text-anchor': 'middle', 'font-weight': 600 });
  const num = tx(svg, 910, by + 40, '', { class: 't-disp', 'font-size': 64, fill: TINTA });
  const dif = tx(svg, 1062, by + 20, '', { class: 't-ui', 'font-size': 22, fill: SALVIA_H, 'font-weight': 600 });
  const dif2 = tx(svg, 1062, by + 46, '', { class: 't-ui', 'font-size': 18, fill: TS });
  const pintaA = () => { for (const f of m.fs) { f.hex.setAttribute('fill', ESPC[f.fi.s][0]); f.t.setAttribute('fill', ESPC[f.fi.s][1]); } };
  if (modo === 'especie') pintaA();
  const tick = t => {
    m.mover(fi => progresoFicha(t, fi));
    if (modo !== 'especie') for (const f of m.fs) {
      const lleg = progresoFicha(t, f.fi) >= 1, q = MOS.cls(lleg ? MOS.locOp[f.fi.hasta] : MOS.locAz[f.fi.desde]);
      f.hex.setAttribute('fill', RAMPA[q]); f.t.setAttribute('fill', RAMPA_T[q]);
    }
    const g = progresoGlobal(t), v = MOS.totAz + (MOS.totOp - MOS.totAz) * eOut(g);
    barra.setAttribute('width', (v * esc).toFixed(1));
    num.textContent = fmt(v, 1);
    if (g > .98) { dif.textContent = `−${fmt((1 - v / D.m1.azar) * 100)} %`; dif2.textContent = 'frente al azar'; } else { dif.textContent = ''; dif2.textContent = ''; }
  };
  return tick;
}

/* ---------- Mapa ---------- */
const MW = 2110.1, MH = 1996.5;
function mapaBase(svg, x, y, h) {
  const s = h / MH, g = el('g', { transform: `translate(${x} ${y}) scale(${s})` }, svg);
  const items = D.mapa.map(m => {
    const d = 'M' + m.v.map(p => p[0] + ' ' + p[1]).join('L') + 'Z';
    const path = el('path', { d, fill: m.p == null ? 'none' : PAPEL_H, stroke: TS, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round', 'stroke-dasharray': m.p == null ? '5 4' : null }, g);
    const cx = m.v.reduce((a, p) => a + p[0], 0) / m.v.length, cy = m.v.reduce((a, p) => a + p[1], 0) / m.v.length;
    return { m, path, cx, cy, X: x + cx * s, Y: y + cy * s };
  });
  return { s, items, w: MW * s };
}
const planos = () => D.mapa.filter(m => m.p != null);

function mapaSuperficie(svg) {
  lienzo(svg); marca(svg);
  const mp = mapaBase(svg, 60, 40, 620);
  const areas = planos().map(m => m.area), amin = Math.min(...areas), amax = Math.max(...areas);
  const cl = a => Math.min(4, Math.floor((a - amin) / (amax - amin) * 5));
  for (const it of mp.items) if (it.m.p != null) {
    const q = cl(it.m.area); it.path.setAttribute('fill', RAMPA[q]);
    tx(svg, it.X, it.Y + 5, it.m.p, { class: 't-ui', 'font-size': 13, 'text-anchor': 'middle', fill: RAMPA_T[q], 'font-weight': 500 });
  }
  const x0 = 780;
  tx(svg, x0, 100, 'San Luis Potosí', { class: 't-ui', 'font-size': 22, fill: TS });
  tx(svg, x0, 190, '30 polígonos', { class: 't-disp', 'font-size': 88, fill: TINTA });
  tx(svg, x0, 244, `${fmt(D.totales.area, 0)} hectáreas por reforestar`, { 'font-size': 34, fill: TIERRA });
  tx(svg, x0, 322, 'Superficie de cada polígono', { class: 't-ui', 'font-size': 20, fill: TS, 'font-weight': 500 });
  for (let q = 0; q < 5; q++) {
    const y = 346 + q * 40, lo = amin + (amax - amin) * q / 5, hi = amin + (amax - amin) * (q + 1) / 5;
    el('rect', { x: x0, y, width: 44, height: 28, fill: RAMPA[q], stroke: TS, 'stroke-width': 1 }, svg);
    tx(svg, x0 + 60, y + 21, `${fmt(lo, 1)} a ${fmt(hi, 1)} ha`, { class: 't-ui', 'font-size': 20, fill: TIERRA });
  }
  const L = 500 * mp.s, yb = 628;
  el('path', { d: `M${x0} ${yb}H${x0 + L}M${x0} ${yb - 6}V${yb + 6}M${x0 + L} ${yb - 6}V${yb + 6}`, stroke: TIERRA, 'stroke-width': 2, fill: 'none' }, svg);
  tx(svg, x0 + L + 14, yb + 6, '500 m', { class: 't-ui', 'font-size': 18, fill: TIERRA });
}

const dens = D.totales.compra;
function mapaSiembra(svg) {
  lienzo(svg); marca(svg);
  const mp = mapaBase(svg, 60, 40, 620), cen = [MW / 2, MH / 2];
  const its = mp.items.filter(i => i.m.p != null);
  const dm = Math.max(...its.map(i => Math.hypot(i.cx - cen[0], i.cy - cen[1])));
  const totA = its.reduce((a, i) => a + i.m.area, 0);
  const x0 = 790;
  tx(svg, x0, 190, 'Plantas por comprar', { class: 't-ui', 'font-size': 24, fill: TS, 'font-weight': 500 });
  const num = tx(svg, x0, 322, '0', { class: 't-disp', 'font-size': 122, fill: TINTA });
  tx(svg, x0, 392, `en 30 polígonos · ${fmt(D.totales.area, 0)} hectáreas`, { 'font-size': 32, fill: TIERRA });
  tx(svg, x0, 438, 'San Luis Potosí', { 'font-size': 32, fill: TIERRA, class: 'it' });
  tx(svg, x0, 516, `Es la compra mínima para cumplir la meta`, { class: 't-ui', 'font-size': 20, fill: TS });
  tx(svg, x0, 544, `con ${fmt((1 - D.totales.alfa) * 100)} % de probabilidad.`, { class: 't-ui', 'font-size': 20, fill: TS });
  const tick = t => {
    let w = 0;
    for (const it of its) {
      const d = .3 + Math.hypot(it.cx - cen[0], it.cy - cen[1]) / dm * 3, p = eIO(clamp((t - d) / .9));
      it.path.setAttribute('fill', mix(PAPEL_H, SALVIA, p)); w += p * it.m.area;
    }
    num.textContent = fmt(Math.round(w / totA * dens));
  };
  return tick;
}

/* ---------- Histograma de temporadas ---------- */
const SC = D.escenarios, DIST = SC.dist, XS = DIST.map(d => d[0]), PM = Math.max(...DIST.map(d => d[1]));
const ACUM = DIST.filter(([x]) => x <= SC.q95).reduce((a, [, p]) => a + p, 0);
function histograma(svg, x0, base, w, alto, tam) {
  const bw = w / XS.length, barras = DIST.map(([x], i) => el('rect', { x: x0 + i * bw + 1.5, y: base, width: bw - 3, height: 0, fill: SALVIA }, svg));
  el('path', { d: `M${x0} ${base + .5}H${x0 + w}`, stroke: TIERRA, 'stroke-width': 1.5 }, svg);
  [206, 210, 215, 220, 225, 228].forEach(x => { const i = XS.indexOf(x); tx(svg, x0 + i * bw + bw / 2, base + 12 + tam, String(x), { class: 't-ui', 'font-size': tam, fill: TS, 'text-anchor': 'middle' }); });
  tx(svg, x0 + w / 2, base + 22 + tam * 2.2, 'plantas que hacían falta en cada temporada', { class: 't-ui', 'font-size': tam, fill: TS, 'text-anchor': 'middle' });
  const xq = x0 + (XS.indexOf(SC.q95) + 1) * bw;
  return { xq, bw, set(frac, marca) { barras.forEach((b, i) => { const h = frac[i] * alto; b.setAttribute('y', (base - h).toFixed(1)); b.setAttribute('height', h.toFixed(1)); b.setAttribute('fill', marca && XS[i] <= SC.q95 ? SALVIA_H : SALVIA); }); } };
}
const fracFinal = DIST.map(([, p]) => p / PM / 1.08);

function temporadas(svg) {
  lienzo(svg); marca(svg);
  tx(svg, 110, 100, 'Simulamos 10,000 temporadas de siembra', { class: 't-disp', 'font-size': 50, fill: TINTA });
  tx(svg, 110, 146, `${SC.especie}, polígono ${SC.poligono}: en cada temporada contamos cuántas plantas hacían falta.`, { 'font-size': 22, fill: TIERRA });
  const base = 540, alto = 300, h = histograma(svg, 110, base, 1060, alto, 20);
  // muestreo reproducible con puntos de control cada 100
  const r = mulberry32(2026), acum = []; let c = new Array(XS.length).fill(0);
  const cdf = []; DIST.reduce((s, [, p], i) => (cdf[i] = s + p), 0);
  const tot = cdf[cdf.length - 1];
  for (let n = 1; n <= 10000; n++) { const u = r() * tot; let i = 0; while (i < cdf.length - 1 && u > cdf[i]) i++; c[i]++; if (n % 100 === 0) acum.push(c.slice()); }
  const num = tx(svg, 110, 296, '0', { class: 't-disp', 'font-size': 66, fill: TINTA });
  tx(svg, 110, 326, 'temporadas simuladas', { class: 't-ui', 'font-size': 20, fill: TS });
  const linea = el('path', { d: `M${h.xq} ${base - alto - 8}V${base + 6}`, stroke: OCRE_H, 'stroke-width': 3, 'stroke-dasharray': '7 5', opacity: 0 }, svg);
  const t1 = tx(svg, h.xq + 14, base - alto + 18, `comprar ${SC.q95}`, { class: 't-ui', 'font-size': 26, fill: OCRE_H, 'font-weight': 600, opacity: 0 });
  const t2 = tx(svg, h.xq + 14, base - alto + 48, `alcanza en ${fmt(ACUM * 100)} % de las temporadas`, { class: 't-ui', 'font-size': 20, fill: TIERRA, opacity: 0 });
  const dib = (n, rev, op) => {
    const k = Math.max(0, Math.min(acum.length, Math.floor(n / 100)) - 1), cc = n < 100 ? new Array(XS.length).fill(0) : acum[k];
    h.set(cc.map(v => clamp(v / (PM * 10000 * 1.08))), rev);
    num.textContent = fmt(Math.floor(n / 100) * 100); linea.setAttribute('opacity', op); t1.setAttribute('opacity', op); t2.setAttribute('opacity', op);
  };
  const tick = t => {
    if (t >= 8.6) { const o = 1 - clamp((t - 8.6) / .4); svg.style.opacity = ''; dib(10000, true, o); return; }
    const n = t < .4 ? 0 : 10000 * eOut(clamp((t - .4) / 5));
    const rev = t > 5.6, op = rev ? eOut(clamp((t - 5.6) / .5)) : 0;
    dib(n, rev, op);
  };
  return tick;
}

function cuantoComprar(svg) {
  lienzo(svg); marca(svg);
  tx(svg, 60, 88, 'Cuánto comprar y cuánto cuesta', { class: 't-disp', 'font-size': 46, fill: TINTA });
  tx(svg, 60, 126, `Ejemplo: ${SC.especie} en el polígono ${SC.poligono}. Meta de ${SC.meta} plantas; ya hay ${SC.existentes}.`, { 'font-size': 21, fill: TIERRA, class: 'it' });
  // Panel izquierdo
  tx(svg, 60, 190, 'Plantas que hacían falta', { class: 't-ui', 'font-size': 20, fill: TS, 'font-weight': 500 });
  const base = 520, alto = 250, h = histograma(svg, 60, base, 560, alto, 16);
  h.set(fracFinal, true);
  el('path', { d: `M${h.xq} ${base - alto - 4}V${base + 6}`, stroke: OCRE_H, 'stroke-width': 3, 'stroke-dasharray': '7 5' }, svg);
  tx(svg, h.xq + 10, base - alto + 14, `comprar ${SC.q95}`, { class: 't-ui', 'font-size': 24, fill: OCRE_H, 'font-weight': 600 });
  tx(svg, 60, 610, `Comprar ${SC.q95} alcanza en ${fmt(ACUM * 100)} %`, { 'font-size': 26, fill: TINTA, 'font-weight': 700 });
  tx(svg, 60, 640, 'de 10,000 temporadas simuladas.', { 'font-size': 22, fill: TIERRA });
  // Panel derecho: frontera
  const fr = D.frontera, X0 = 740, X1 = 1220, Y0 = 230, Y1 = 520, ymin = 12000, ymax = 15000;
  const X = a => X0 + a / .5 * (X1 - X0), Y = b => Y1 - (b - ymin) / (ymax - ymin) * (Y1 - Y0);
  tx(svg, X0, 190, 'Presupuesto mínimo por hectárea', { class: 't-ui', 'font-size': 20, fill: TS, 'font-weight': 500 });
  [12000, 13000, 14000, 15000].forEach(v => {
    el('path', { d: `M${X0} ${Y(v)}H${X1}`, stroke: TIERRA, 'stroke-opacity': .15, 'stroke-width': 1 }, svg);
    tx(svg, X0 - 10, Y(v) + 5, '$' + fmt(v), { class: 't-ui', 'font-size': 15, fill: TS, 'text-anchor': 'end' });
  });
  const T = D.totales, curva = fr.map(([a, b]) => `${X(a).toFixed(1)} ${Y(b).toFixed(1)}`);
  el('path', { d: `M${X(fr[0][0])} ${Y(T.presupuesto)}H${X(.5)}V${Y(fr[fr.length - 1][1])}L${curva.slice().reverse().join('L')}Z`, fill: OCRE, 'fill-opacity': .35 }, svg);
  el('path', { d: `M${X0} ${Y(T.presupuesto)}H${X1}`, stroke: OCRE_H, 'stroke-width': 2.5, 'stroke-dasharray': '8 6' }, svg);
  tx(svg, X1, Y(T.presupuesto) + 24, `Disponible: $${fmt(T.presupuesto)}`, { class: 't-ui', 'font-size': 17, fill: OCRE_H, 'text-anchor': 'end', 'font-weight': 600 });
  el('path', { d: 'M' + curva.join('L'), stroke: SALVIA_H, 'stroke-width': 3, fill: 'none', 'stroke-linejoin': 'round' }, svg);
  fr.forEach(([a, b]) => el('circle', { cx: X(a), cy: Y(b), r: a === T.alfa ? 7 : 4.5, fill: a === T.alfa ? SALVIA_H : PAPEL, stroke: SALVIA_H, 'stroke-width': 2 }, svg));
  [.01, .1, .2, .3, .5].forEach(a => tx(svg, X(a), Y1 + 24, fmt(a * 100) + ' %', { class: 't-ui', 'font-size': 15, fill: TS, 'text-anchor': 'middle' }));
  tx(svg, (X0 + X1) / 2, Y1 + 50, 'riesgo aceptado de no cumplir la meta', { class: 't-ui', 'font-size': 15, fill: TS, 'text-anchor': 'middle' });
  tx(svg, X(T.alfa) + 16, Y(T.B_min) - 18, `$${fmt(T.B_min)} con ${fmt(T.alfa * 100)} % de riesgo`, { class: 't-ui', 'font-size': 16, fill: SALVIA_H, 'font-weight': 600 });
  tx(svg, 740, 610, `Faltan $${fmt(T.B_min - T.presupuesto)} por hectárea`, { 'font-size': 26, fill: TINTA, 'font-weight': 700 });
  tx(svg, 740, 640, 'para cumplir la meta con 95 % de probabilidad.', { 'font-size': 22, fill: TIERRA });
}

function herramienta(svg) {
  lienzo(svg); marca(svg);
  tx(svg, 60, 140, 'Una herramienta', { class: 't-disp', 'font-size': 44, fill: TINTA });
  tx(svg, 60, 192, 'para decidir qué', { class: 't-disp', 'font-size': 44, fill: TINTA });
  tx(svg, 60, 244, 'comprar y dónde', { class: 't-disp', 'font-size': 44, fill: TINTA });
  tx(svg, 60, 296, 'plantar', { class: 't-disp', 'font-size': 44, fill: TINTA });
  tx(svg, 60, 360, 'refor_gui, aplicación', { class: 't-ui', 'font-size': 20, fill: TS });
  tx(svg, 60, 388, 'de escritorio del proyecto', { class: 't-ui', 'font-size': 20, fill: TS });
  el('rect', { x: 337, y: 97, width: 893, height: 556, fill: TIERRA, 'fill-opacity': .12 }, svg);
  el('image', { href: CAPTURA, x: 330, y: 90, width: 890, height: 554, preserveAspectRatio: 'xMidYMid slice' }, svg);
  el('rect', { x: 330, y: 90, width: 890, height: 554, fill: 'none', stroke: TS, 'stroke-width': 1.5 }, svg);
}

function especies(svg) {
  lienzo(svg); marca(svg);
  tx(svg, 60, 96, '10 especies, 4 géneros', { class: 't-disp', 'font-size': 56, fill: TINTA });
  tx(svg, 60, 140, 'Con la probabilidad de que cada planta sobreviva, según los datos del proyecto.', { 'font-size': 22, fill: TIERRA, class: 'it' });
  const cw = 224, ch = 215, gx = 20, gy = 20, x0 = 60, y0 = 178;
  D.especies.forEach((e, i) => {
    const cx = x0 + (i % 5) * (cw + gx), cy = y0 + Math.floor(i / 5) * (ch + gy);
    el('rect', { x: cx, y: cy, width: cw, height: ch, fill: PAPEL_H, stroke: TS, 'stroke-opacity': .35, 'stroke-width': 1 }, svg);
    el('path', { d: hexD(40), transform: `translate(${cx + cw / 2} ${cy + 62})`, fill: ESPC[e.ab][0], stroke: TS, 'stroke-width': 1.2 }, svg);
    tx(svg, cx + cw / 2, cy + 70, e.ab, { class: 't-ui', 'font-size': 22, fill: ESPC[e.ab][1], 'text-anchor': 'middle', 'font-weight': 500 });
    const [g, s] = e.nombre.split(' ');
    tx(svg, cx + cw / 2, cy + 136, g[0] + '. ' + s, { class: 'it', 'font-size': 21, fill: TINTA, 'text-anchor': 'middle' });
    tx(svg, cx + cw / 2, cy + 160, e.genero, { class: 't-ui', 'font-size': 14, fill: TS, 'text-anchor': 'middle' });
    tx(svg, cx + cw / 2, cy + 192, `sobrevive ${fmt(e.q * 100)} %`, { class: 't-ui', 'font-size': 18, fill: SALVIA_H, 'text-anchor': 'middle', 'font-weight': 600 });
  });
}

function replicaBase(svg, anim) {
  lienzo(svg);
  const r = 24, F = MOS.F, C = MOS.C, f0 = 8, c0 = 5, wx = R3 * r;
  const clave = D.clave, sp = (f, c) => clave[((f % F) + F) % F][((c % C) + C) % C];
  const enTile = (f, c) => f >= f0 && f < f0 + F && c >= c0 && c < c0 + C;
  const centro = (f, c) => [wx * (c + .5 * f), 1.5 * r * f];
  const hd = hexD(r), V = [[0, -r], [R3 / 2 * r, -r / 2], [R3 / 2 * r, r / 2], [0, r], [-R3 / 2 * r, r / 2], [-R3 / 2 * r, -r / 2]];
  const vecinos = [[-1, 1, 0], [0, 1, 1], [1, 0, 2], [1, -1, 3], [0, -1, 4], [-1, 0, 5]];
  const [tcx, tcy] = [centro(f0 + 1.5, c0 + 6)[0], centro(f0 + 1.5, c0 + 6)[1]];
  const borde = [], items = [];
  for (let f = -1; f <= 21; f++) {
    const cmin = Math.ceil(-r / wx - .5 * f) - 1, cmax = Math.floor((1280 + r) / wx - .5 * f) + 1;
    for (let c = cmin; c <= cmax; c++) {
      const [x, y] = centro(f, c), s = sp(f, c), dentro = enTile(f, c);
      const h = el('path', { d: hd, transform: anim ? `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(0)` : `translate(${x.toFixed(1)} ${y.toFixed(1)})`, fill: ESPC[s][0], stroke: TS, 'stroke-width': .8, 'stroke-opacity': .7 }, svg);
      let t = null;
      if (dentro) {
        t = tx(svg, x, y + 4.5, s, { class: 't-ui', 'font-size': 12, fill: ESPC[s][1], 'text-anchor': 'middle', 'font-weight': 500 });
        for (const [df, dc, k] of vecinos) if (!enTile(f + df, c + dc)) borde.push(`M${(x + V[k][0]).toFixed(1)} ${(y + V[k][1]).toFixed(1)}L${(x + V[(k + 1) % 6][0]).toFixed(1)} ${(y + V[(k + 1) % 6][1]).toFixed(1)}`);
      }
      items.push({ h, t, x, y, d: Math.hypot(x - tcx, y - tcy) });
    }
  }
  const dmax = Math.max(...items.map(i => i.d));
  const bord = el('path', { d: borde.join(''), stroke: OCRE_H, 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', opacity: anim ? 0 : 1 }, svg);
  el('rect', { x: 36, y: 36, width: 660, height: 116, fill: PAPEL, 'fill-opacity': .95, stroke: TS, 'stroke-opacity': .4 }, svg);
  tx(svg, 58, 92, 'El mosaico se repite sin costuras', { class: 't-disp', 'font-size': 38, fill: TINTA });
  tx(svg, 58, 128, '52 plantas por repetición (4 × 13), cada una con sus 6 vecinas', { class: 't-ui', 'font-size': 19, fill: TIERRA });
  const [tx0, ty0] = centro(f0, c0);
  const rot = el('g', { opacity: anim ? 0 : 1 }, svg);
  el('rect', { x: tx0 - 20, y: ty0 - 62, width: 190, height: 30, fill: PAPEL, 'fill-opacity': .95 }, rot);
  tx(rot, tx0 - 12, ty0 - 41, 'una repetición', { class: 't-ui', 'font-size': 18, fill: OCRE_H, 'font-weight': 600 });
  marca(svg, true);
  if (!anim) return;
  return t => {
    for (const i of items) {
      const p = eOut(clamp((t - .5 - i.d / dmax * 3.2) / .8));
      i.h.setAttribute('transform', `translate(${i.x.toFixed(1)} ${i.y.toFixed(1)}) scale(${p.toFixed(3)})`);
      if (i.t) i.t.setAttribute('opacity', p > .9 ? 1 : 0);
    }
    const o = clamp((t - 4.2) / .6); bord.setAttribute('opacity', o); rot.setAttribute('opacity', o);
  };
}
const replica = svg => replicaBase(svg, false), replicaAnim = svg => replicaBase(svg, true);

/* ---------- Fondos (1600 × 900) ---------- */
const fondoBase = svg => el('rect', { width: 1600, height: 900, fill: PAPEL }, svg);
let curvasUrl;
function curvasImagen() {
  if (curvasUrl !== undefined) return curvasUrl;
  curvasUrl = '';
  try {
    const W = 1600, H = 900, S = 8, cols = W / S + 1, rows = H / S + 1, f = campoCurvas();
    const v = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) v[j * cols + i] = f(i * S, j * S);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'); g.fillStyle = PAPEL; g.fillRect(0, 0, W, H); g.lineCap = 'round';
    for (const { l, maestra } of NIVELES) {
      g.beginPath();
      for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
        const a = v[j * cols + i], b = v[j * cols + i + 1], c = v[(j + 1) * cols + i + 1], d = v[(j + 1) * cols + i];
        const cs = (a > l ? 8 : 0) + (b > l ? 4 : 0) + (c > l ? 2 : 0) + (d > l ? 1 : 0), sg = SEG[cs]; if (!sg) continue;
        const x0 = i * S, y0 = j * S;
        const P = e => e === 'T' ? [x0 + S * (l - a) / (b - a), y0] : e === 'R' ? [x0 + S, y0 + S * (l - b) / (c - b)] : e === 'B' ? [x0 + S * (l - d) / (c - d), y0 + S] : [x0, y0 + S * (l - a) / (d - a)];
        for (let q = 0; q < sg.length; q += 2) { const p1 = P(sg[q]), p2 = P(sg[q + 1]); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); }
      }
      g.strokeStyle = maestra ? 'rgba(111,109,67,.5)' : 'rgba(174,172,120,.72)'; g.lineWidth = maestra ? 2.6 : 1.4; g.stroke();
    }
    curvasUrl = cv.toDataURL('image/png');
  } catch (e) { curvasUrl = ''; }
  return curvasUrl;
}
function fondoCurvas(svg) {
  fondoBase(svg);
  const u = curvasImagen(); if (u) el('image', { href: u, x: 0, y: 0, width: 1600, height: 900 }, svg);
}
function fondoTesela(svg) {
  fondoBase(svg);
  const r = 36, wx = R3 * r, hd = hexD(r), rn = mulberry32(5), cols = [SALVIA, OCRE, TIERRA];
  for (let f = -1; f < 900 / (1.5 * r) + 2; f++) for (let c = -2; c < 1600 / wx + 2; c++) {
    const x = wx * (c + .5 * f), y = 1.5 * r * f + 10, d = Math.hypot(1600 - x, 900 - y) / 1500, o = Math.max(0, .55 - d * .62);
    if (o <= .02) continue;
    const llena = rn() < .22 * (1 - d);
    el('path', { d: hd, transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`, fill: llena ? cols[Math.floor(rn() * 3)] : 'none', 'fill-opacity': llena ? o * .55 : 0, stroke: SALVIA_H, 'stroke-opacity': o * .8, 'stroke-width': 1.2 }, svg);
  }
}
function fondoReticula(svg) {
  fondoBase(svg);
  const [ex, ny] = D.origen, py = ny % 100, px = 100 - (ex % 100);
  const fE = v => fmt(Math.round(v), 0).replace(/,/g, ' ');
  for (let i = 0; i * 100 + px < 1600; i++) for (let j = 0; j * 100 + py < 900; j++) {
    const x = px + i * 100, y = py + j * 100;
    el('path', { d: `M${x - 7} ${y}H${x + 7}M${x} ${y - 7}V${y + 7}`, stroke: TIERRA, 'stroke-opacity': .32, 'stroke-width': 1.3 }, svg);
  }
  for (let i = 0; i * 100 + px < 1600; i++) if (Math.round(ex + px + i * 100) % 500 === 0) tx(svg, px + i * 100, 30, fE(ex + px + i * 100), { class: 't-ui', 'font-size': 15, fill: TS, 'text-anchor': 'middle', opacity: .8 });
  for (let j = 0; j * 100 + py < 900; j++) if (Math.round(ny - py - j * 100) % 500 === 0) tx(svg, 20, py + j * 100 + 5, fE(ny - py - j * 100), { class: 't-ui', 'font-size': 15, fill: TS, opacity: .8 });
  el('path', { d: 'M0 0H1600V900H0Z', fill: 'none', stroke: TIERRA, 'stroke-opacity': .25, 'stroke-width': 2 }, svg);
}

function mosaicoEst(svg, arr, r, ox, oy, rotulos) {
  const hd = hexD(r);
  arr.forEach((s, v) => {
    const f = Math.floor(v / MOS.C), c = v % MOS.C, x = ox + R3 * r * (c + .5 * f), y = oy + 1.5 * r * f;
    el('path', { d: hd, transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`, fill: ESPC[s][0], stroke: TS, 'stroke-width': .9, 'stroke-linejoin': 'round' }, svg);
    if (rotulos) tx(svg, x, y + r * .18, s, { class: 't-ui', 'font-size': r * .5, fill: ESPC[s][1], 'text-anchor': 'middle', 'font-weight': 500 });
  });
}
const NOMBRE = {}; D.especies.forEach(e => { NOMBRE[e.ab] = e.nombre; });
const corto = n => n[0] + '. ' + n.split(' ')[1];

function vecinasAnim(svg) {
  lienzo(svg); marca(svg);
  tx(svg, 790, 100, 'Cada planta compite', { class: 't-disp', 'font-size': 46, fill: TINTA });
  tx(svg, 790, 152, 'con sus 6 vecinas', { class: 't-disp', 'font-size': 46, fill: TINTA });
  const F = MOS.F, C = MOS.C, env = (f, c) => (((f % F) + F) % F) * C + (((c % C) + C) % C);
  const DF = [-1, -1, 0, 0, 1, 1], DC = [0, 1, -1, 1, -1, 0], W = (a, b) => D.W[a + '|' + b];
  const orden = MOS.optima.map((_, v) => v).sort((a, b) => MOS.locOp[a] - MOS.locOp[b]);
  const picks = [orden[0], orden[26], orden[51]], rotulos = ['La planta con menos competencia del mosaico', 'Una planta en la mediana del mosaico', 'La planta con más competencia del mosaico'];
  const r = 62, cx = 400, cy = 392, grupos = [];
  picks.forEach((v, k) => {
    const g = el('g', { opacity: 0 }, svg), f = Math.floor(v / C), c = v % C, s0 = MOS.optima[v];
    const pos = (df, dc) => [cx + R3 * r * (dc + .5 * df), cy + 1.5 * r * df];
    for (let df = -2; df <= 2; df++) for (let dc = -2; dc <= 2; dc++) {
      const dist = Math.max(Math.abs(df), Math.abs(dc), Math.abs(df + dc)); if (dist > 2 || dist === 0) continue;
      const [x, y] = pos(df, dc), s = MOS.optima[env(f + df, c + dc)];
      el('path', { d: hexD(r), transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`, fill: ESPC[s][0], 'fill-opacity': dist === 1 ? 1 : .4, stroke: TS, 'stroke-width': 1, 'stroke-opacity': dist === 1 ? 1 : .5, 'stroke-linejoin': 'round' }, g);
      if (dist === 1) tx(g, x, y + 7, s, { class: 't-ui', 'font-size': 22, fill: ESPC[s][1], 'text-anchor': 'middle', 'font-weight': 500 });
    }
    el('path', { d: hexD(r), transform: `translate(${cx} ${cy})`, fill: ESPC[s0][0], stroke: OCRE_H, 'stroke-width': 4, 'stroke-linejoin': 'round' }, g);
    tx(g, cx, cy + 7, s0, { class: 't-ui', 'font-size': 22, fill: ESPC[s0][1], 'text-anchor': 'middle', 'font-weight': 500 });
    const filas = DF.map((df, i) => {
      const [x, y] = pos(df, DC[i]), s = MOS.optima[env(f + df, c + DC[i])], w = W(s0, s), q = 1 + 5.5 * (w - .17) / (1.5 - .17);
      const x1 = cx + (x - cx) * .3, y1 = cy + (y - cy) * .3, x2 = cx + (x - cx) * .7, y2 = cy + (y - cy) * .7;
      const l = el('path', { d: `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`, stroke: TINTA, 'stroke-width': q.toFixed(2), 'stroke-linecap': 'round', opacity: 0 }, g);
      const yy = 462 + i * 34, fila = el('g', { opacity: 0 }, g);
      tx(fila, 790, yy, `${s0} con ${s}`, { class: 't-ui', 'font-size': 19, fill: TIERRA });
      el('rect', { x: 930, y: yy - 15, width: w * 150, height: 16, fill: SALVIA_H }, fila);
      tx(fila, 930 + w * 150 + 10, yy, fmt(w, 2), { class: 't-ui', 'font-size': 18, fill: TINTA, 'font-weight': 600 });
      return { l, fila, w };
    });
    tx(g, 790, 222, NOMBRE[s0], { class: 'it', 'font-size': 30, fill: TINTA });
    tx(g, 790, 258, rotulos[k], { class: 't-ui', 'font-size': 18, fill: TS });
    tx(g, 790, 318, 'Competencia con sus vecinas', { class: 't-ui', 'font-size': 18, fill: TS, 'font-weight': 500 });
    const num = tx(g, 790, 404, '0', { class: 't-disp', 'font-size': 84, fill: TINTA });
    grupos.push({ g, filas, num });
  });
  return t => {
    const seg = Math.floor(t / 3) % 3, u = t % 3;
    grupos.forEach((G, k) => {
      const o = k !== seg ? 0 : u < .25 ? u / .25 : u > 2.75 ? (3 - u) / .25 : 1;
      G.g.setAttribute('opacity', o.toFixed(2));
      let suma = 0;
      G.filas.forEach((f, i) => { const a = clamp((u - .4 - .22 * i) / .25); f.l.setAttribute('opacity', a.toFixed(2)); f.fila.setAttribute('opacity', a.toFixed(2)); suma += f.w * a; });
      G.num.textContent = fmt(suma, 2);
    });
  };
}

function fronteraAnim(svg) {
  lienzo(svg); marca(svg);
  tx(svg, 80, 96, 'Cuánto dinero hace falta', { class: 't-disp', 'font-size': 54, fill: TINTA });
  tx(svg, 80, 138, 'Presupuesto mínimo por hectárea según el riesgo que se acepta', { class: 'it', 'font-size': 24, fill: TIERRA });
  const fr = D.frontera, T = D.totales, X0 = 190, X1 = 1190, Y0 = 190, Y1 = 560, ymin = 12000, ymax = 15000, n = fr.length;
  const X = a => X0 + a / .5 * (X1 - X0), Y = b => Y1 - (b - ymin) / (ymax - ymin) * (Y1 - Y0);
  [12000, 13000, 14000, 15000].forEach(v => { el('path', { d: `M${X0} ${Y(v)}H${X1}`, stroke: TIERRA, 'stroke-opacity': .15, 'stroke-width': 1 }, svg); tx(svg, X0 - 12, Y(v) + 5, '$' + fmt(v), { class: 't-ui', 'font-size': 17, fill: TS, 'text-anchor': 'end' }); });
  [.01, .05, .1, .2, .3, .5].forEach(a => tx(svg, X(a), Y1 + 28, fmt(a * 100) + ' %', { class: 't-ui', 'font-size': 17, fill: TS, 'text-anchor': 'middle' }));
  tx(svg, (X0 + X1) / 2, Y1 + 58, 'riesgo aceptado de no cumplir la meta', { class: 't-ui', 'font-size': 17, fill: TS, 'text-anchor': 'middle' });
  const pts = fr.map(([a, b]) => [X(a), Y(b)]);
  const area = el('path', { d: `M${X(fr[0][0])} ${Y(T.presupuesto)}H${X(.5)}V${pts[n - 1][1]}L${pts.slice().reverse().map(p => p.join(' ')).join('L')}Z`, fill: OCRE, 'fill-opacity': 0 }, svg);
  const bud = el('path', { d: `M${X0} ${Y(T.presupuesto)}H${X1}`, stroke: OCRE_H, 'stroke-width': 3, 'stroke-dasharray': '9 6', opacity: 0 }, svg);
  const bl = tx(svg, X1, Y(T.presupuesto) + 30, `Disponible: $${fmt(T.presupuesto)}`, { class: 't-ui', 'font-size': 20, fill: OCRE_H, 'text-anchor': 'end', 'font-weight': 600, opacity: 0 });
  const gap = tx(svg, X(.27), (Y(T.presupuesto) + Y(14250)) / 2 + 8, `Faltan $${fmt(T.B_min - T.presupuesto)} por hectárea`, { 'font-size': 30, fill: TINTA, 'font-weight': 700, 'text-anchor': 'middle', opacity: 0 });
  const curva = el('path', { d: '', stroke: SALVIA_H, 'stroke-width': 4.5, fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
  const cs = pts.map((p, i) => el('circle', { cx: p[0], cy: p[1], r: fr[i][0] === T.alfa ? 8 : 5.5, fill: fr[i][0] === T.alfa ? SALVIA_H : PAPEL, stroke: SALVIA_H, 'stroke-width': 2.5, opacity: 0 }, svg));
  const eti = tx(svg, X(T.alfa) + 18, Y(T.B_min) - 22, `$${fmt(T.B_min)} con ${fmt(T.alfa * 100)} % de riesgo`, { class: 't-ui', 'font-size': 20, fill: SALVIA_H, 'font-weight': 600, opacity: 0 });
  return t => {
    const pos = eIO(clamp((t - .4) / 3.2)) * (n - 1), k = Math.floor(pos), fr2 = pos - k;
    let d = ''; for (let i = 0; i <= k && i < n; i++) d += (i ? 'L' : 'M') + pts[i].join(' ');
    if (k < n - 1 && fr2 > 0) d += 'L' + [pts[k][0] + (pts[k + 1][0] - pts[k][0]) * fr2, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * fr2].map(v => v.toFixed(1)).join(' ');
    curva.setAttribute('d', d); cs.forEach((c, i) => c.setAttribute('opacity', i <= pos + .001 ? 1 : 0));
    eti.setAttribute('opacity', pos >= fr.findIndex(f => f[0] === T.alfa) ? 1 : 0);
    const a = clamp((t - 4) / .5); bud.setAttribute('opacity', a); bl.setAttribute('opacity', a);
    area.setAttribute('fill-opacity', (.35 * clamp((t - 4.6) / .6)).toFixed(2)); gap.setAttribute('opacity', clamp((t - 5.3) / .5));
  };
}

function porEspecie(svg) {
  lienzo(svg); marca(svg);
  tx(svg, 80, 92, 'Plantas por comprar, especie por especie', { class: 't-disp', 'font-size': 48, fill: TINTA });
  tx(svg, 80, 130, `Para los ${D.totales.poligonos} polígonos de San Luis Potosí.`, { class: 'it', 'font-size': 24, fill: TIERRA });
  const es = D.especies.slice().sort((a, b) => b.x - a.x), x0 = 330, esc = 700 / es[0].x, y0 = 180, dy = 47;
  const filas = es.map((e, i) => {
    const y = y0 + i * dy;
    tx(svg, x0 - 14, y + 26, corto(e.nombre), { class: 'it', 'font-size': 23, fill: TINTA, 'text-anchor': 'end' });
    const b = el('rect', { x: x0, y, width: 0, height: 34, fill: ESPC[e.ab][0], stroke: TS, 'stroke-width': 1 }, svg);
    const v = tx(svg, x0, y + 25, '', { class: 't-ui', 'font-size': 20, fill: TINTA, 'font-weight': 600 });
    return { e, b, v };
  });
  tx(svg, 1200, 586, 'plantas por comprar en total', { class: 't-ui', 'font-size': 20, fill: TS, 'text-anchor': 'end' });
  const tot = tx(svg, 1200, 540, '0', { class: 't-disp', 'font-size': 64, fill: TINTA, 'text-anchor': 'end' });
  return t => {
    let s = 0;
    filas.forEach((f, i) => { const p = eOut(clamp((t - .4 - i * .25) / 1.1)), w = f.e.x * esc * p; f.b.setAttribute('width', w.toFixed(1)); f.v.setAttribute('x', x0 + w + 10); f.v.textContent = fmt(Math.round(f.e.x * p)); s += f.e.x * p; });
    tot.textContent = fmt(Math.round(s));
  };
}

function antesDespues(svg) {
  lienzo(svg); marca(svg);
  tx(svg, 60, 92, 'Las mismas plantas, ordenadas de otra forma', { class: 't-disp', 'font-size': 46, fill: TINTA });
  tx(svg, 60, 130, 'Son 52 plantas en los dos casos; solo cambia quién queda junto a quién.', { class: 'it', 'font-size': 22, fill: TIERRA });
  tx(svg, 60, 188, 'Sembradas al azar', { class: 't-ui', 'font-size': 22, fill: TS, 'font-weight': 600 });
  mosaicoEst(svg, MOS.azar, 26, 82.5, 240, true);
  tx(svg, 60, 428, 'Con la estrategia del proyecto', { class: 't-ui', 'font-size': 22, fill: SALVIA_H, 'font-weight': 600 });
  mosaicoEst(svg, MOS.optima, 26, 82.5, 480, true);
  const x0 = 800;
  tx(svg, x0, 188, 'Competencia entre vecinas', { class: 't-ui', 'font-size': 20, fill: TS });
  tx(svg, x0, 270, fmt(MOS.totAz, 1), { class: 't-disp', 'font-size': 84, fill: TINTA });
  tx(svg, x0, 304, 'esta siembra al azar', { class: 't-ui', 'font-size': 18, fill: TS });
  tx(svg, x0, 510, fmt(MOS.totOp, 1), { class: 't-disp', 'font-size': 84, fill: TINTA });
  tx(svg, x0, 544, 'siembra optimizada (menos es mejor)', { class: 't-ui', 'font-size': 18, fill: TS });
  el('path', { d: `M${x0} 596H1220`, stroke: TIERRA, 'stroke-opacity': .25 }, svg);
  tx(svg, x0, 640, `−${fmt((1 - D.m1.mejor / D.m1.azar) * 100)} % frente al promedio al azar (${fmt(D.m1.azar, 1)})`, { 'font-size': 26, fill: TINTA, 'font-weight': 700 });
}

function porHectarea(svg) {
  lienzo(svg); marca(svg);
  const T = D.totales, x0 = 90, k = 1.3, y = 300, h = 80;
  tx(svg, 80, 96, 'Por cada hectárea', { class: 't-disp', 'font-size': 60, fill: TINTA });
  tx(svg, 80, 140, 'Cuántas plantas ya hay, cuántas compramos y a qué meta llegamos.', { class: 'it', 'font-size': 24, fill: TIERRA });
  el('rect', { x: x0, y, width: T.existentes_ha * k, height: h, fill: PAPEL_H, stroke: TS, 'stroke-width': 1.5 }, svg);
  el('rect', { x: x0 + T.existentes_ha * k, y, width: T.compra_ha * k, height: h, fill: SALVIA_H, stroke: TS, 'stroke-width': 1.5 }, svg);
  tx(svg, x0 + T.existentes_ha * k / 2, y + 54, fmt(T.existentes_ha), { class: 't-disp', 'font-size': 44, fill: TINTA, 'text-anchor': 'middle' });
  tx(svg, x0 + T.existentes_ha * k + T.compra_ha * k / 2, y + 54, fmt(T.compra_ha), { class: 't-disp', 'font-size': 56, fill: PAPEL, 'text-anchor': 'middle' });
  tx(svg, x0 + T.existentes_ha * k / 2, y + h + 34, 'ya hay', { class: 't-ui', 'font-size': 20, fill: TIERRA, 'text-anchor': 'middle', 'font-weight': 600 });
  tx(svg, x0 + T.existentes_ha * k / 2, y + h + 58, 'nacidas solas', { class: 't-ui', 'font-size': 17, fill: TS, 'text-anchor': 'middle' });
  tx(svg, x0 + T.existentes_ha * k + T.compra_ha * k / 2, y + h + 34, 'compramos', { class: 't-ui', 'font-size': 20, fill: TIERRA, 'text-anchor': 'middle', 'font-weight': 600 });
  tx(svg, x0 + T.existentes_ha * k + T.compra_ha * k / 2, y + h + 58, 'plantas por hectárea', { class: 't-ui', 'font-size': 17, fill: TS, 'text-anchor': 'middle' });
  const xm = x0 + T.meta_ha * k;
  el('path', { d: `M${xm} ${y - 50}V${y + h + 14}`, stroke: OCRE_H, 'stroke-width': 3, 'stroke-dasharray': '8 6' }, svg);
  tx(svg, xm, y - 62, `meta: ${fmt(T.meta_ha)} plantas vivas por hectárea`, { class: 't-ui', 'font-size': 20, fill: OCRE_H, 'text-anchor': 'middle', 'font-weight': 600 });
  tx(svg, 80, 520, 'Se compra más de lo que falta porque no todas las plantas sobreviven.', { 'font-size': 28, fill: TINTA });
  tx(svg, 80, 566, `En total: ${fmt(T.compra)} plantas por comprar en ${fmt(T.area)} hectáreas.`, { 'font-size': 26, fill: TIERRA, class: 'it' });
}

function seisClaves(svg) {
  lienzo(svg); marca(svg);
  tx(svg, 60, 92, 'Seis claves de plantación', { class: 't-disp', 'font-size': 56, fill: TINTA });
  tx(svg, 60, 132, `Los ${D.totales.poligonos} polígonos con la misma composición comparten clave.`, { class: 'it', 'font-size': 24, fill: TIERRA });
  D.mosaicos.forEach((m, i) => {
    const x0 = 60 + (i % 3) * 410, y0 = 200 + Math.floor(i / 3) * 235;
    tx(svg, x0, y0, `Clave ${m.id} · ${m.n} ${m.n === 1 ? 'polígono' : 'polígonos'}`, { class: 't-ui', 'font-size': 20, fill: TINTA, 'font-weight': 600 });
    tx(svg, x0, y0 + 24, `competencia total ${fmt(m.mejor, 1)}`, { class: 't-ui', 'font-size': 16, fill: TS });
    mosaicoEst(svg, m.clave.flat(), 12, x0 + 10.4, y0 + 64, false);
  });
}

function fondoSurcos(svg) {
  fondoBase(svg);
  for (let k = 0; k < 30; k++) {
    const y0 = 20 + k * 31, pts = [];
    for (let x = -20; x <= 1620; x += 40) pts.push(`${x} ${(y0 + 26 * Math.sin(x / 210 + k * .17) + 11 * Math.sin(x / 83 + k * .5)).toFixed(1)}`);
    el('path', { d: 'M' + pts.join('L'), fill: 'none', stroke: k % 6 === 0 ? SALVIA_H : SALVIA, 'stroke-opacity': k % 6 === 0 ? .45 : .6, 'stroke-width': k % 6 === 0 ? 2.2 : 1.4, 'stroke-linejoin': 'round' }, svg);
  }
}
function fondoTresbolillo(svg) {
  fondoBase(svg);
  const e = 44, rn = mulberry32(8), cols = [SALVIA_H, OCRE, TIERRA];
  for (let j = 0; j * e * .866 < 930; j++) for (let i = 0; i * e < 1640; i++) {
    const x = i * e + (j % 2 ? e / 2 : 0), y = 10 + j * e * .866, planta = rn() < .075;
    el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: planta ? 6.5 : 2.4, fill: planta ? cols[Math.floor(rn() * 3)] : SALVIA, 'fill-opacity': planta ? .5 : .75 }, svg);
  }
}
function fondoSitio(svg) {
  fondoBase(svg);
  const s = 1080 / MH, g = el('g', { transform: `translate(760 -90) scale(${s})` }, svg);
  for (const m of D.mapa) el('path', { d: 'M' + m.v.map(p => p[0] + ' ' + p[1]).join('L') + 'Z', fill: m.p == null ? 'none' : SALVIA, 'fill-opacity': .16, stroke: SALVIA_H, 'stroke-opacity': .5, 'stroke-width': 1.6, 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round', 'stroke-dasharray': m.p == null ? '6 5' : null }, g);
}

/* ---------- Fondo 7: del sitio al mosaico ---------- */
// El sitio sobre las curvas de nivel, cada polígono con el tono de su clave, y una lupa sobre
// el borde noroeste del polígono 12 donde se ve cada planta con su especie. Lo dibuja la carta
// del video (scripts/expoing/video/carta.js, el mundo en metros con su cámara) en un lienzo de
// 1920 × 1080, el tamaño del PNG. La plataforma muestra el fondo como banner: recorta al
// centro una franja de ~2.7:1 (y de 182 a 898) y tapa la esquina inferior izquierda con el
// logo, así que el sitio y la lupa caben en esa franja y lejos de esa esquina.
const LUPA = { x: 1500, y: 540, r: 316, escala: 11, adentro: 20 };   // escala en px/m; adentro, m
function sitioMosaico(K) {
  const ANCHO = 1920, ALTO = 1080, tono = tonoClave(D.mosaicos.map(m => m.id));
  const carta = (camara, ajustar) => {
    const cv = document.createElement('canvas'); cv.width = ANCHO; cv.height = ALTO;
    const k = K.crear(cv); k.estado.camara = camara; ajustar(k.estado); k.dibujar();
    return cv;
  };
  // El sitio, de 600 px de alto, con su centro en (770, 540).
  const s = 600 / (K.SITIO.y1 - K.SITIO.y0), cam = K.mostrar(K.CENTRO_SITIO, [770, 540], s);
  const sitio = carta(cam, e => {
    e.curvas.brillo = 1.5;
    e.poligonos.color = K.POLS.map(p => p.programa ? tono(p.clave) : PAPEL_H);
  });
  // Lo que ve la lupa: un punto LUPA.adentro metros dentro del primer lado del polígono 12.
  const p12 = K.POLS.find(p => p.p === 12), [a, b] = p12.v;
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let n = [(a[1] - b[1]) / l, (b[0] - a[0]) / l];
  if ((p12.c[0] - m[0]) * n[0] + (p12.c[1] - m[1]) * n[1] < 0) n = [-n[0], -n[1]];
  const obj = [m[0] + LUPA.adentro * n[0], m[1] + LUPA.adentro * n[1]];
  const cerca = carta(K.mostrar(obj, [ANCHO / 2, ALTO / 2], LUPA.escala), e => {
    e.curvas.brillo = 1.6;
    e.poligonos.colorTrazo = TIERRA;
    e.siembra = { alfa: 1, onda: 0, centro: K.CENTRO_SITIO, modo: 'especie', fijos: K.PROGRAMA.map(p => p.i) };
  });

  const cv = document.createElement('canvas'); cv.width = ANCHO; cv.height = ALTO;
  const g = cv.getContext('2d');
  g.drawImage(sitio, 0, 0);
  // En el mapa, el círculo que la lupa amplía, unido a ella por sus tangentes exteriores.
  const [px, py] = K.proyectar(cam, obj), c1 = { x: px, y: py, r: LUPA.r / LUPA.escala * s };
  const dx = LUPA.x - px, dy = LUPA.y - py, th = Math.atan2(dy, dx), al = Math.acos((c1.r - LUPA.r) / Math.hypot(dx, dy));
  g.strokeStyle = OCRE_H; g.lineWidth = 2.5;
  for (const sg of [1, -1]) {
    const t = th + sg * al;
    g.beginPath(); g.moveTo(px + c1.r * Math.cos(t), py + c1.r * Math.sin(t));
    g.lineTo(LUPA.x + LUPA.r * Math.cos(t), LUPA.y + LUPA.r * Math.sin(t)); g.stroke();
  }
  g.beginPath(); g.arc(px, py, c1.r, 0, 2 * Math.PI);
  g.fillStyle = 'rgba(252,240,218,.35)'; g.fill(); g.lineWidth = 3; g.stroke();
  // La lupa: sombra, la vista de cerca recortada en círculo y un aro de papel con filo ocre.
  const circulo = r => { g.beginPath(); g.arc(LUPA.x, LUPA.y, r, 0, 2 * Math.PI); };
  g.save(); g.shadowColor = 'rgba(46,42,39,.28)'; g.shadowBlur = 40; g.shadowOffsetY = 10;
  circulo(LUPA.r); g.fillStyle = PAPEL; g.fill(); g.restore();
  g.save(); circulo(LUPA.r); g.clip(); g.drawImage(cerca, LUPA.x - ANCHO / 2, LUPA.y - ALTO / 2); g.restore();
  circulo(LUPA.r); g.lineWidth = 10; g.strokeStyle = PAPEL; g.stroke();
  circulo(LUPA.r + 5); g.lineWidth = 3; g.strokeStyle = OCRE_H; g.stroke();
  return cv;
}
function fondoSitioMosaico(svg) {
  fondoBase(svg);
  // La página de exportar_expoing.py carga carta.js y datos.js; sin ellos no hay sitio.
  if (!window.CARTA) { tx(svg, 800, 450, 'Este fondo necesita carta.js', { class: 't-ui', 'font-size': 28, 'text-anchor': 'middle', fill: TS }); return; }
  el('image', { href: sitioMosaico(window.CARTA).toDataURL('image/png'), x: 0, y: 0, width: 1600, height: 900 }, svg);
}

/* ---------- Logos ---------- */
function marcaHex(g, cx, cy, s, tipo, pequeno) {
  const G = el('g', { transform: `translate(${cx} ${cy}) scale(${s})` }, g);
  const P = [[0, -90], [77.9, -45], [77.9, 45], [0, 90], [-77.9, 45], [-77.9, -45]];
  const q = a => a.map(p => p.join(' ')).join('L');
  if (tipo === 'l1') {
    const O = [0, 0];
    el('path', { d: `M${q([O, P[5], P[0], P[1]])}Z`, fill: SALVIA }, G);
    el('path', { d: `M${q([O, P[1], P[2], P[3]])}Z`, fill: OCRE }, G);
    el('path', { d: `M${q([O, P[3], P[4], P[5]])}Z`, fill: TIERRA }, G);
    el('path', { d: `M${q(P)}Z`, fill: 'none', stroke: TINTA, 'stroke-width': 4, 'stroke-linejoin': 'round' }, G);
    el('path', { d: `M0 0L${q([P[1]])}M0 0L${q([P[3]])}M0 0L${q([P[5]])}`, stroke: TINTA, 'stroke-width': 3, fill: 'none' }, G);
  } else if (tipo === 'l2') {
    el('path', { d: `M${q(P)}Z`, fill: PAPEL_H, stroke: TIERRA, 'stroke-width': 8, 'stroke-linejoin': 'round' }, G);
    el('path', { d: `M${q(P.map(p => [p[0] * .78, p[1] * .78]))}Z`, fill: 'none', stroke: SALVIA_H, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, G);
    tx(G, 0, 20, 'SRI', { class: 't-disp', 'font-size': 58, fill: TINTA, 'text-anchor': 'middle', 'letter-spacing': 3 });
  } else if (tipo === 'l3') {
    const id = 'anillo' + (++uid);
    el('circle', { r: 95, fill: PAPEL_H, stroke: TIERRA, 'stroke-width': 5 }, G);
    el('circle', { r: 68, fill: 'none', stroke: TIERRA, 'stroke-width': 1.5 }, G);
    if (!pequeno) {
      el('path', { id, d: 'M0 -82A82 82 0 1 1 -0.01 -82', fill: 'none' }, G);
      const t = el('text', { class: 't-ui', 'font-size': 12.5, 'font-weight': 600, fill: TIERRA, 'letter-spacing': 1.5 }, G);
      const tp = el('textPath', { href: '#' + id, startOffset: '0', textLength: 505, lengthAdjust: 'spacing' }, t); tp.textContent = 'STOCHASTIC REFORESTATION INITIATIVE · SAN LUIS POTOSÍ · ';
    }
    const rr = 17, cols = [SALVIA, OCRE, TIERRA, SALVIA, OCRE, TIERRA];
    el('path', { d: hexD(rr), fill: OCRE, stroke: TINTA, 'stroke-width': 1.5 }, G);
    cols.forEach((c, k) => { const a = k * 60 * Math.PI / 180; el('path', { d: hexD(rr), transform: `translate(${(R3 * rr * Math.cos(a)).toFixed(1)} ${(R3 * rr * Math.sin(a)).toFixed(1)})`, fill: c, stroke: TINTA, 'stroke-width': 1.5 }, G); });
  } else if (tipo === 'l5') {
    marcaBrote(G);
  } else if (tipo === 'l6') {
    const rr = 29, cs = [SALVIA, OCRE, TIERRA, SALVIA, OCRE, TIERRA];
    cs.forEach((c, k) => { const a = k * 60 * Math.PI / 180; el('path', { d: hexD(rr), transform: `translate(${(R3 * rr * Math.cos(a)).toFixed(1)} ${(R3 * rr * Math.sin(a)).toFixed(1)})`, fill: c, stroke: TINTA, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, G); });
    el('path', { d: hexD(rr), fill: OCRE, stroke: TINTA, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, G);
  } else if (tipo === 'l7') {
    el('path', { d: `M${q(P)}Z`, fill: PAPEL_H, stroke: TIERRA, 'stroke-width': 7, 'stroke-linejoin': 'round' }, G);
    const Nn = [0, 1, 2, 3, 4, 5].map(k => { const a = (k * 60 - 90) * Math.PI / 180; return [52 * Math.cos(a), 52 * Math.sin(a)]; });
    let d = '';
    Nn.forEach((p1, k) => { const n2 = Nn[(k + 1) % 6]; d += `M0 0L${p1[0].toFixed(1)} ${p1[1].toFixed(1)}M${p1[0].toFixed(1)} ${p1[1].toFixed(1)}L${n2[0].toFixed(1)} ${n2[1].toFixed(1)}`; });
    el('path', { d, stroke: TINTA, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }, G);
    Nn.forEach((p1, k) => el('circle', { cx: p1[0].toFixed(1), cy: p1[1].toFixed(1), r: 11, fill: [SALVIA, OCRE, TIERRA][k % 3], stroke: TINTA, 'stroke-width': 3 }, G));
    el('circle', { r: 16, fill: OCRE, stroke: TINTA, 'stroke-width': 3 }, G);
  } else if (tipo === 'l8') {
    const id = 'rec' + (++uid);
    el('circle', { r: 88, fill: PAPEL_H }, G);
    const cp = el('clipPath', { id }, G); el('circle', { r: 86 }, cp);
    const Cg = el('g', { 'clip-path': `url(#${id})` }, G);
    [16, 34, 52, 70, 88, 106].forEach((rad, i) => {
      const pts = [];
      for (let j = 0; j < 72; j++) { const th = j / 72 * Math.PI * 2, b = rad * (1 + .09 * Math.sin(3 * th + 1) + .05 * Math.sin(5 * th + 2)); pts.push(`${(18 + b * Math.cos(th)).toFixed(1)} ${(14 + b * Math.sin(th)).toFixed(1)}`); }
      el('path', { d: 'M' + pts.join('L') + 'Z', fill: 'none', stroke: i % 3 === 2 ? SALVIA_H : SALVIA, 'stroke-width': i % 3 === 2 ? 4 : 2.6, 'stroke-linejoin': 'round' }, Cg);
    });
    el('path', { d: hexD(15), transform: 'translate(18 14)', fill: OCRE, stroke: TINTA, 'stroke-width': 3, 'stroke-linejoin': 'round' }, Cg);
    el('circle', { r: 88, fill: 'none', stroke: TIERRA, 'stroke-width': 7 }, G);
  } else {
    tx(G, 0, 18, 'SRI', { class: 't-disp', 'font-size': 96, fill: TINTA, 'text-anchor': 'middle' });
    [[-32, SALVIA], [0, OCRE], [32, TIERRA]].forEach(([x, c]) => el('path', { d: hexD(15), transform: `translate(${x} 62)`, fill: c, stroke: TINTA, 'stroke-width': 1.5 }, G));
  }
}
function logoSvg(tipo, modo, pequeno) {
  if (modo === 'mark') {
    const svg = el('svg', { viewBox: '0 0 200 200', role: 'img', 'aria-label': 'Marca del logo' }); marcaHex(svg, 100, 100, tipo === 'l3' ? 1.02 : 1, tipo, pequeno); return svg;
  }
  const svg = el('svg', { viewBox: '0 0 640 240', role: 'img', 'aria-label': 'Logo completo' });
  if (tipo === 'l1') {
    marcaHex(svg, 120, 120, 1.12, tipo);
    tx(svg, 250, 100, 'Stochastic', { 'font-size': 50, fill: TINTA }); tx(svg, 250, 156, 'Reforestation', { class: 'it', 'font-size': 50, fill: TINTA }); tx(svg, 250, 212, 'Initiative', { 'font-size': 50, fill: TINTA });
  } else if (tipo === 'l2') {
    marcaHex(svg, 120, 120, 1.12, tipo);
    ['STOCHASTIC', 'REFORESTATION', 'INITIATIVE'].forEach((s, i) => tx(svg, 252, 100 + i * 50, s, { class: 't-ui', 'font-size': 33, fill: TINTA, 'font-weight': 600, 'letter-spacing': 4 }));
  } else if (tipo === 'l3') {
    marcaHex(svg, 320, 120, 1.2, tipo);
  } else if (tipo === 'l5') {
    marcaHex(svg, 120, 120, 1.12, tipo);
    tx(svg, 250, 100, 'Stochastic', { 'font-size': 50, fill: TINTA, 'font-weight': 700 }); tx(svg, 250, 156, 'Reforestation', { 'font-size': 50, fill: TINTA }); tx(svg, 250, 212, 'Initiative', { class: 'it', 'font-size': 50, fill: SALVIA_H });
  } else if (tipo === 'l6') {
    marcaHex(svg, 120, 120, 1.12, tipo);
    ['stochastic', 'reforestation', 'initiative'].forEach((s, i) => tx(svg, 250, 100 + i * 52, s, { class: 't-ui', 'font-size': 42, fill: TINTA, 'font-weight': 500, 'letter-spacing': 1 }));
  } else if (tipo === 'l7') {
    marcaHex(svg, 120, 120, 1.12, tipo);
    tx(svg, 258, 150, 'SRI', { class: 't-disp', 'font-size': 112, fill: TINTA }); tx(svg, 262, 194, 'Stochastic Reforestation Initiative', { class: 't-ui', 'font-size': 21, fill: TS });
  } else if (tipo === 'l8') {
    marcaHex(svg, 120, 120, 1.12, tipo);
    ['STOCHASTIC', 'REFORESTATION', 'INITIATIVE'].forEach((s, i) => tx(svg, 252, 100 + i * 50, s, { 'font-size': 32, fill: TINTA, 'font-weight': 700, 'letter-spacing': 3 }));
  } else {
    tx(svg, 28, 140, 'SRI', { class: 't-disp', 'font-size': 150, fill: TINTA });
    el('path', { d: 'M300 40V200', stroke: TIERRA, 'stroke-width': 2 }, svg);
    tx(svg, 330, 88, 'Stochastic', { 'font-size': 42, fill: TINTA }); tx(svg, 330, 138, 'Reforestation', { class: 'it', 'font-size': 42, fill: TINTA }); tx(svg, 330, 188, 'Initiative', { 'font-size': 42, fill: TINTA });
    [[44, SALVIA], [78, OCRE], [112, TIERRA]].forEach(([x, c]) => el('path', { d: hexD(15), transform: `translate(${x} 200)`, fill: c, stroke: TINTA, 'stroke-width': 1.5 }, svg));
  }
  return svg;
}

/* ---------- Catálogo ---------- */
const V = [
  { id: 'A', nombre: 'Mosaico que se reordena', nota: 'Pasa de plantar al azar a un arreglo con menos competencia entre vecinas.', anim: true, T: 8, reposo: 5, build: s => mosaicoVariante(s, 'especie') },
  { id: 'B', nombre: 'Mapa que se siembra', nota: 'Los 30 polígonos se plantan y sube el total de plantas por comprar.', anim: true, T: 8.5, reposo: 7, build: mapaSiembra },
  { id: 'C', nombre: 'Temporadas simuladas', nota: 'Se simulan 10,000 temporadas y aparece cuántas plantas comprar.', anim: true, T: 9, reposo: 7.5, build: temporadas },
  { id: 'D', nombre: 'Vista de competencia', nota: 'El mosaico se colorea por competencia y se aclara al reordenarse.', anim: true, T: 8, reposo: 5, build: s => mosaicoVariante(s, 'competencia') },
  { id: 'E', nombre: 'Mapa por superficie', nota: 'Los 30 polígonos de San Luis Potosí, con su escala real.', build: mapaSuperficie },
  { id: 'F', nombre: 'Cuánto comprar y cuánto cuesta', nota: 'Muestra la compra y que el presupuesto disponible no alcanza.', build: cuantoComprar },
  { id: 'G', nombre: 'La herramienta', nota: 'Captura de refor_gui, la aplicación del proyecto.', build: herramienta },
  { id: 'H', nombre: 'Las 10 especies', nota: 'Cada especie con su color y su probabilidad de sobrevivir.', build: especies },
  { id: 'I', nombre: 'Mosaico sin costuras', nota: 'El patrón de 52 plantas se repite en toda la hectárea.', build: replica },
  { id: 'J', nombre: 'Cada planta y sus vecinas', nota: 'Una planta se conecta con sus 6 vecinas y suma su competencia.', anim: true, T: 9, reposo: 2.4, build: vecinasAnim },
  { id: 'K', nombre: 'La frontera de compra', nota: 'La curva se dibuja y muestra cuánto falta para el presupuesto.', anim: true, T: 9, reposo: 7, build: fronteraAnim },
  { id: 'L', nombre: 'Compra por especie', nota: 'Las barras crecen y el total llega a 108,680 plantas.', anim: true, T: 8, reposo: 5.5, build: porEspecie },
  { id: 'M', nombre: 'El mosaico crece', nota: 'El patrón de 52 plantas se extiende hasta cubrir toda la imagen.', anim: true, T: 9, reposo: 6.5, build: replicaAnim },
  { id: 'N', nombre: 'Antes y después', nota: 'Las mismas 52 plantas al azar y optimizadas, una sobre otra.', build: antesDespues },
  { id: 'O', nombre: 'Por cada hectárea', nota: 'Cuántas plantas ya hay, cuántas se compran y cuál es la meta.', build: porHectarea },
  { id: 'P', nombre: 'Seis claves de plantación', nota: 'Los seis mosaicos que cubren los 30 polígonos.', build: seisClaves }
];
const FONDOS = [
  { id: '1', nombre: 'Curvas de nivel', nota: 'Líneas de nivel con curva maestra, como en una carta topográfica.', build: fondoCurvas },
  { id: '2', nombre: 'Tesela hexagonal', nota: 'Hexágonos que se desvanecen desde una esquina.', build: fondoTesela },
  { id: '3', nombre: 'Retícula del sitio', nota: 'Cruces cada 100 m con las coordenadas reales del sitio.', build: fondoReticula },
  { id: '4', nombre: 'Surcos', nota: 'Líneas onduladas paralelas, como surcos de siembra en una ladera.', build: fondoSurcos },
  { id: '5', nombre: 'Plantas al tresbolillo', nota: 'Puntos en el arreglo de siembra real, con algunas plantas resaltadas.', build: fondoTresbolillo },
  { id: '6', nombre: 'Contorno del sitio', nota: 'Los 30 polígonos del proyecto, muy tenues, recortados en una esquina.', build: fondoSitio },
  { id: '7', nombre: 'Del sitio al mosaico', nota: 'El sitio con el tono de cada clave y una lupa con cada planta y su especie.', build: fondoSitioMosaico }
];
const LOGOS = [
  { id: 'l1', nombre: 'Hexágono de géneros', nota: 'Agave, Opuntia y otras especies en un solo hexágono.' },
  { id: 'l2', nombre: 'Monograma SRI', nota: 'Siglas dentro de un hexágono, en mayúsculas.' },
  { id: 'l3', nombre: 'Sello de herbario', nota: 'Sello circular con siete hexágonos al centro.' },
  { id: 'l4', nombre: 'Tipográfico', nota: 'Siglas grandes y el nombre completo en tres líneas.' },
  { id: 'l5', nombre: 'Brote en hexágono', nota: 'Un brote con dos hojas, una de Agave y otra de Opuntia, dentro del hexágono.' },
  { id: 'l6', nombre: 'Siete hexágonos', nota: 'Una planta rodeada de sus seis vecinas, el patrón del mosaico.' },
  { id: 'l7', nombre: 'Red de vecinas', nota: 'Una planta conectada con sus seis vecinas: la competencia que se minimiza.' },
  { id: 'l8', nombre: 'Insignia de nivel', nota: 'Curvas de nivel dentro de un círculo, con un hexágono en la cumbre.' }
];

/* ---------- Animación ---------- */
const reg = []; let pausado = false;
const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.target._o) e.target._o.vis = e.isIntersecting; })) : null;
function crearSvg(v, nombre) {
  const svg = el('svg', { viewBox: '0 0 1280 720', role: 'img', 'aria-label': nombre || v.nombre });
  const tick = v.build(svg);
  if (tick) {
    const o = { svg, tick, T: v.T, reposo: v.reposo, vis: true, t0: performance.now() };
    svg._o = o; reg.push(o); if (io) io.observe(svg);
    tick(v.reposo);
  }
  return svg;
}
function bucle(ms) {
  if (!pausado && !reducir) for (let i = reg.length - 1; i >= 0; i--) {
    const o = reg[i]; if (!o.svg.isConnected) { reg.splice(i, 1); continue; }
    if (o.vis) o.tick(((ms - o.t0) / 1000) % o.T);
  }
  requestAnimationFrame(bucle);
}
if (!reducir) requestAnimationFrame(bucle);
window.__EXPO = { V, FONDOS, LOGOS, logoSvg, crearSvg, reg };
})();
