/* Piezas comunes de Expo Ingenierías: paleta, utilidades SVG, azar con semilla,
 * el campo de las curvas de nivel y la marca del logo (brote en hexágono).
 *
 * Lo usan scripts/expoing/piezas.js (imágenes del perfil, vía
 * scripts/exportar_expoing.py) y el video (scripts/expoing/video/). Es un script
 * clásico, no un módulo ES, para que funcione abierto desde file://.
 * Expone window.EXPO_COMUN. Nada aquí usa Math.random ni el reloj: todo es
 * determinista, igual que el resto del repositorio.
 */
(() => {
'use strict';
const NS = 'http://www.w3.org/2000/svg';
const R3 = Math.sqrt(3);

// Paleta de docs/presentacion/DESIGN.md §2.
const PAPEL = '#FCF0DA', PAPEL_H = '#F3E2C2', TIERRA = '#4C4541', TS = '#6E655F', TINTA = '#2E2A27';
const SALVIA = '#AEAC78', SALVIA_H = '#6F6D43', OCRE = '#F2C46A', OCRE_H = '#8C6418';
// Especie → [relleno, texto encima].
const ESPC = { Ale: ['#C9C79E', TINTA], Asa: ['#AEAC78', TINTA], Asc: ['#6F6D43', PAPEL], Ast: ['#5F5D34', PAPEL], Oro: ['#F6D693', TINTA], Ost: ['#F2C46A', TINTA], Oca: ['#D9A646', TINTA], Oen: ['#8C6418', PAPEL], Pla: ['#4C4541', PAPEL], Yfi: ['#766A63', PAPEL] };
const RAMPA = ['#F3E2C2', '#C2BB8D', '#969464', '#64623D', '#3B3A26'];
const RAMPA_T = [TINTA, TINTA, TINTA, PAPEL, PAPEL];

const el = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in (a || {})) if (a[k] != null) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
const tx = (p, x, y, s, a) => { const e = el('text', Object.assign({ x, y, fill: TIERRA }, a || {}), p); e.textContent = s; return e; };
const fmt = (v, d = 0) => v.toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const eIO = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eOut = x => 1 - Math.pow(1 - x, 3);
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hx = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, p) => { const A = hx(a), B = hx(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * p).toString(16).padStart(2, '0')).join(''); };
// Tonos de las claves de plantación: la rampa secuencial de DESIGN.md en tantos pasos como
// claves, sin el más claro. Recibe los ids de las claves y devuelve id → color. Lo usan la
// escena E9 del video y el fondo del perfil, para que cada clave tenga el mismo tono en ambos.
function tonoClave(ids) {
  const orden = ids.slice().sort((a, b) => a - b), n = orden.length + 1, tonos = [];
  for (let k = 1; k < n; k++) {
    const u = k / (n - 1) * (RAMPA.length - 1), i = Math.min(RAMPA.length - 2, Math.floor(u));
    tonos.push(mix(RAMPA[i], RAMPA[i + 1], u - i));
  }
  return id => tonos[orden.indexOf(id)];
}
// Hexágono con vértice arriba (el del mosaico y el de la retícula al tresbolillo).
const hexD = r => { const w = R3 / 2 * r; return `M0 ${-r}L${w} ${-r / 2}L${w} ${r / 2}L0 ${r}L${-w} ${r / 2}L${-w} ${-r / 2}Z`; };

/* ---------- Curvas de nivel ---------- */
// Ruido de valor periódico (tabla de 64 × 64) con interpolación suave.
function ruido(seed) {
  const r = mulberry32(seed), tab = new Float32Array(4096);
  for (let i = 0; i < 4096; i++) tab[i] = r();
  const s = t => t * t * (3 - 2 * t), g = (i, j) => tab[((j & 63) << 6) | (i & 63)];
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = s(x - xi), fy = s(y - yi);
    return g(xi, yi) * (1 - fx) * (1 - fy) + g(xi + 1, yi) * fx * (1 - fy) + g(xi, yi + 1) * (1 - fx) * fy + g(xi + 1, yi + 1) * fx * fy; };
}
// Marching squares: índice de esquinas → lados que cruza la curva (T, R, B, L).
const SEG = { 1: 'LB', 2: 'BR', 3: 'LR', 4: 'TR', 5: 'TLBR', 6: 'TB', 7: 'TL', 8: 'TL', 9: 'TB', 10: 'TRLB', 11: 'TR', 12: 'LR', 13: 'BR', 14: 'LB' };
// Campo de alturas del fondo «curvas de nivel» (en píxeles del lienzo de 1600 × 900)
// y sus niveles: 27 curvas, una maestra cada cinco.
function campoCurvas() {
  const n = ruido(21);
  return (x, y) => n(x / 300, y / 300) * .55 + n(x / 150 + 9, y / 150 + 4) * .28 + n(x / 75 + 3, y / 75 + 7) * .12 + n(x / 38 + 5, y / 38 + 1) * .05;
}
const NIVELES = Array.from({ length: 27 }, (_, k) => ({ l: .27 + k * .02, maestra: k % 5 === 0 }));

/* ---------- Mosaico que se reordena (clave 1, 4 × 13, borde periódico) ---------- */
// Del azar (barajado con semilla 42) al arreglo optimizado: cada ficha viaja a la
// posición libre más cercana de su especie. Lo usan la imagen 1 del perfil y la
// escena E9 del video. W es el objeto { 'Asa|Pla': w, … } de datos.js.
function armarMosaico(clave, Wd) {
  const F = clave.length, C = clave[0].length, N = F * C, DF = [-1, -1, 0, 0, 1, 1], DC = [0, 1, -1, 1, -1, 0];
  const env = (f, c) => (((f % F) + F) % F) * C + (((c % C) + C) % C);
  const W = (a, b) => Wd[a + '|' + b];
  const optima = clave.flat();
  const vec = v => { const f = Math.floor(v / C), c = v % C; return DF.map((df, i) => env(f + df, c + DC[i])); };
  const local = (arr, v) => vec(v).reduce((s, u) => s + W(arr[v], arr[u]), 0);
  const total = arr => { let t = 0; for (let v = 0; v < N; v++) for (const u of vec(v)) if (u > v) t += W(arr[v], arr[u]); return t; };
  const azar = optima.slice();
  { const r = mulberry32(42); for (let i = N - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [azar[i], azar[j]] = [azar[j], azar[i]]; } }
  const lug = v => [R3 * ((v % C) + 0.5 * Math.floor(v / C)), 1.5 * Math.floor(v / C)];
  const fichas = [], libres = {};
  optima.forEach((s, v) => (libres[s] = libres[s] || []).push(v));
  azar.forEach((s, v) => {
    const [x0, y0] = lug(v); let mejor = 0, dmin = Infinity;
    libres[s].forEach((u, i) => { const [x1, y1] = lug(u), d = (x1 - x0) ** 2 + (y1 - y0) ** 2; if (d < dmin) { dmin = d; mejor = i; } });
    fichas.push({ s, desde: v, hasta: libres[s].splice(mejor, 1)[0], d: Math.sqrt(dmin) });
  });
  const dmax = Math.max(...fichas.map(f => f.d)) || 1;
  for (const f of fichas) { if (f.s === 'Pla') { f.ret = 0; f.dur = 1.1; } else { f.ret = .65 + .45 * f.d / dmax; f.dur = 1.4; } }
  const fin = Math.max(...fichas.map(f => f.ret + f.dur));
  const locAz = azar.map((_, v) => local(azar, v)), locOp = optima.map((_, v) => local(optima, v));
  const lmin = Math.min(...locAz, ...locOp), lmax = Math.max(...locAz, ...locOp);
  const cls = x => Math.min(4, Math.floor((x - lmin) / (lmax - lmin) * 5));
  return { F, C, N, optima, azar, fichas, fin, locAz, locOp, lmin, lmax, cls, totAz: total(azar), totOp: total(optima) };
}

/* ---------- Marca del logo: brote con dos hojas dentro del hexágono ---------- */
// Se dibuja en un grupo con el hexágono de radio 90 centrado en el origen.
function marcaBrote(G) {
  const P = [[0, -90], [77.9, -45], [77.9, 45], [0, 90], [-77.9, 45], [-77.9, -45]];
  el('path', { d: `M${P.map(p => p.join(' ')).join('L')}Z`, fill: PAPEL_H, stroke: TIERRA, 'stroke-width': 7, 'stroke-linejoin': 'round' }, G);
  const B = el('g', { transform: 'translate(0 6) scale(.85)' }, G);
  el('path', { d: 'M-34 44H34', stroke: TIERRA, 'stroke-width': 6, 'stroke-linecap': 'round' }, B);
  el('path', { d: 'M0 44V-4', stroke: SALVIA_H, 'stroke-width': 7, 'stroke-linecap': 'round' }, B);
  el('path', { d: 'M0 14C-46 14 -58 -22 -50 -46C-16 -44 0 -20 0 14Z', fill: SALVIA, stroke: TINTA, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, B);
  el('path', { d: 'M0 -2C40 -2 54 -34 48 -58C14 -56 0 -30 0 -2Z', fill: OCRE, stroke: TINTA, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, B);
  return B;
}

window.EXPO_COMUN = {
  NS, R3, PAPEL, PAPEL_H, TIERRA, TS, TINTA, SALVIA, SALVIA_H, OCRE, OCRE_H, ESPC, RAMPA, RAMPA_T,
  el, tx, fmt, clamp, eIO, eOut, mulberry32, mix, tonoClave, hexD, ruido, SEG, campoCurvas, NIVELES, marcaBrote, armarMosaico,
};
})();
