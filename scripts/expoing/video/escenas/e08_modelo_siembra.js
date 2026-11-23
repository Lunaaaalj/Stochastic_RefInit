/* E8 · Pregunta 2: el modelo de siembra (PLAN §5, E8).
 *
 * Tarjeta de capítulo con iris. Una retícula al tresbolillo (la clave 1 repetida):
 * una planta se enciende y sus seis vecinas se unen a ella. A la derecha, la matriz W
 * de competencia (datos.js → W), fila por fila; se resaltan la diagonal y el
 * mezquite. Luego la matriz se va a la esquina y una hoja de método trae el modelo de
 * asignación (reports/final/secciones/modelo-espacial.tex).
 */
/* global DATOS */
(() => {
'use strict';
const V = window.REFOR_VIDEO, C = window.EXPO_COMUN, D = DATOS;
const { rampa, suave, camara, aparecer, opacidad, html, clamp } = V;
const R3 = Math.sqrt(3);

/* ---------- Retícula: 9 × 7 posiciones de la clave 1 ---------- */
// La planta central es un mezquite de la clave (fila 0, columna axial 1), rodeado de suculentas.
const CLAVE = D.mosaicos[0].clave, F = CLAVE.length, CC = CLAVE[0].length;
const RR = 40, COLS = 9, FILAS = 7, OX = 150, OY = 235, CF = 3, CCOL = 4;
const RET = [];
for (let f = 0; f < FILAS; f++) for (let c = 0; c < COLS; c++) {
  const fc = f - CF, ac = (c - Math.floor(f / 2)) - (CCOL - Math.floor(CF / 2)) + 1;
  const ab = CLAVE[((fc % F) + F) % F][((ac % CC) + CC) % CC];
  RET.push({ f, c, x: OX + R3 * RR * (c + 0.5 * (f % 2)), y: OY + 1.5 * RR * f, ab });
}
const CENTRO = RET.find(p => p.f === CF && p.c === CCOL);
const VECINAS = RET.filter(p => p !== CENTRO && Math.hypot(p.x - CENTRO.x, p.y - CENTRO.y) < R3 * RR * 1.05)
  .sort((a, b) => Math.atan2(a.y - CENTRO.y, a.x - CENTRO.x) - Math.atan2(b.y - CENTRO.y, b.x - CENTRO.x));

/* ---------- Matriz W ---------- */
const AB = D.especies.map(e => e.ab), W = (a, b) => D.W[a + '|' + b];
const VALS = AB.flatMap(a => AB.map(b => W(a, b))), WMIN = Math.min(...VALS), WMAX = Math.max(...VALS);
const clase = w => Math.min(4, Math.floor((w - WMIN) / (WMAX - WMIN) * 5));
const M = { x: 1140, y: 196, c: 60 };   // esquina superior izquierda y lado de la celda
const PLA = AB.indexOf('Pla');

const HOJA = { x: 96, y: 96, w: 1380, h: 764 };
const TEX = String.raw`\begin{aligned}
& \htmlClass{t-c}{C(\sigma)=\textstyle\sum_{(u,v)\in\mathcal{E}} W_{\sigma(u)\sigma(v)}}\\[10pt]
\min\;\; & \htmlClass{t-obj}{\sum_{(u,v)\in\mathcal{E}}\sum_{a,b} W_{ab}\,z_{uvab}}\\[2pt]
\text{s.a.}\;\; & \htmlClass{t-una}{\textstyle\sum_{s} y_{vs}=1\quad v\in V}\\
& \htmlClass{t-conteo}{\textstyle\sum_{v} y_{vs}=m_s\quad s\in\mathcal{S}}\\
& \htmlClass{t-lin}{\textstyle\sum_{b} z_{uvab}=y_{ua},\;\; \sum_{a} z_{uvab}=y_{vb}}
\end{aligned}`;
const ANOTA = {
  c: 'suma de la competencia de cada par de vecinas',
  una: 'una especie por posición',
  conteo: 'las cantidades que dictó la compra',
  lin: 'linealizan el producto <i>y</i>·<i>y</i>',
};

V.escena({
  id: 'E8', entrada: 0, cola: 0.5,

  construir(ctx) {
    const r = ctx.raiz;
    // Retícula.
    const s = C.el('svg', { class: 'abs', width: 1920, height: 1080, viewBox: '0 0 1920 1080' }, r);
    ctx.reticula = s;
    const fuente = { 'font-family': 'Instrument Sans', 'font-weight': 500, 'font-size': 19, 'text-anchor': 'middle' };
    ctx.hex = new Map(RET.map(p => {
      const g = C.el('g', { transform: `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})` }, s);
      const h = C.el('path', { d: C.hexD(RR), fill: C.PAPEL_H, stroke: C.TS, 'stroke-width': 1 }, g);
      const t = C.tx(g, 0, 7, p.ab, Object.assign({ fill: C.ESPC[p.ab][1], opacity: 0 }, fuente));
      return [p, { g, h, t }];
    }));
    ctx.lineas = VECINAS.map(v => C.el('path', { d: `M${CENTRO.x} ${CENTRO.y}L${CENTRO.x} ${CENTRO.y}`, stroke: C.TINTA, 'stroke-width': 3, 'stroke-linecap': 'round' }, s));
    ctx.contornoC = C.el('path', { d: C.hexD(RR), transform: `translate(${CENTRO.x} ${CENTRO.y})`, fill: 'none', stroke: C.OCRE_H, 'stroke-width': 3, opacity: 0 }, s);
    // Matriz.
    const m = html('div', 'abs e8-matriz', r);
    ctx.matriz = m;
    const sm = C.el('svg', { width: 700, height: 700, viewBox: `${M.x - 70} ${M.y - 70} 700 700` }, m);
    ctx.filas = AB.map((a, i) => {
      const g = C.el('g', { opacity: 0 }, sm);
      C.tx(g, M.x - 10, M.y + i * M.c + M.c / 2 + 6, a, { 'font-family': 'Instrument Sans', 'font-weight': 500, 'font-size': 17, fill: C.TIERRA, 'text-anchor': 'end' });
      const celdas = AB.map((b, j) => {
        const w = W(a, b), q = clase(w), x = M.x + j * M.c, y = M.y + i * M.c;
        C.el('rect', { x, y, width: M.c, height: M.c, fill: C.RAMPA[q], stroke: C.PAPEL, 'stroke-width': 1 }, g);
        const t = C.tx(g, x + M.c / 2, y + M.c / 2 + 6, C.fmt(w, 2), { 'font-family': 'Instrument Sans', 'font-size': 17, fill: C.RAMPA_T[q], 'text-anchor': 'middle' });
        return { t, w, x: x + M.c / 2, y: y + M.c / 2 };
      });
      return { g, celdas };
    });
    ctx.cols = C.el('g', { opacity: 0 }, sm);
    C.tx(ctx.cols, M.x, M.y - 44, 'Competencia W entre cada par de especies', { 'font-family': 'Instrument Sans', 'font-weight': 500, 'font-size': 20, fill: C.TS });
    AB.forEach((b, j) => C.tx(ctx.cols, M.x + j * M.c + M.c / 2, M.y - 10, b, { 'font-family': 'Instrument Sans', 'font-weight': 500, 'font-size': 17, fill: C.TIERRA, 'text-anchor': 'middle' }));
    let dg = '';
    AB.forEach((_, i) => { dg += `M${M.x + i * M.c} ${M.y + i * M.c}h${M.c}v${M.c}h${-M.c}Z`; });
    ctx.diagonal = C.el('path', { d: dg, fill: 'none', stroke: C.OCRE_H, 'stroke-width': 3, opacity: 0 }, sm);
    ctx.pla = C.el('path', { d: `M${M.x} ${M.y + PLA * M.c}h${10 * M.c}v${M.c}h${-10 * M.c}Z M${M.x + PLA * M.c} ${M.y}h${M.c}v${10 * M.c}h${-M.c}Z`,
      fill: 'none', stroke: C.OCRE_H, 'stroke-width': 3, opacity: 0 }, sm);
    ctx.formulaW = V.formula(m, String.raw`W_{ab}=\gamma^{\mathbf{1}[a=b]}\,T_{ab}\,N_{ab}-\varphi\,F_{ab}`, 'e8-fw');
    // Hoja del modelo de asignación.
    const h = V.hoja(r, HOJA.x, HOJA.y, HOJA.w, HOJA.h);
    ctx.hoja = h;
    const f = V.formula(h, TEX, 'e8-formula');
    ctx.f = f;
    const guias = C.el('svg', { class: 'abs', width: HOJA.w, height: HOJA.h, viewBox: `0 0 ${HOJA.w} ${HOJA.h}` }, h);
    guias.style.left = '0'; guias.style.top = '0';
    const med = n => V.medir(f.terminos[n][0], h);
    const derecha = Math.max(...Object.keys(ANOTA).map(n => { const q = med(n); return q.x + q.w; }), med('obj').x + med('obj').w) + 90;
    ctx.anota = {};
    for (const n of Object.keys(ANOTA)) {
      const q = med(n), cy = q.y + q.h / 2, e = html('div', 'anotacion', h, ANOTA[n]);
      Object.assign(e.style, { left: derecha + 'px', top: (cy - 18) + 'px', width: (HOJA.w - derecha - 40) + 'px' });
      const linea = C.el('path', { d: `M${q.x + q.w + 14} ${cy}H${derecha - 14}`, class: 'guia' }, guias);
      ctx.anota[n] = { e, linea };
    }
    ctx.cap = V.capitulo(r, 'Pregunta 2', '¿Dónde plantar cada una?');
  },

  tick(t, ctx) {
    const ca = ctx.carta.estado, c1 = ctx.cue(1), c2 = ctx.cue(2), c4 = ctx.cue(4), c5 = ctx.cue(5);
    ctx.cap.tick(t, ctx, 1.9);
    if (t <= ctx.dur) { ca.camara = V.compartido.sitioE7; ca.atenuar = t < 0.5 ? V.compartido.atenuarE7 : 0.92; }
    // Retícula: la planta central y sus seis vecinas, una cada 80 ms.
    // La retícula aparece cuando la tarjeta ya cubre el cuadro (t ≥ 0.5): antes se vería
    // encima de E7, fuera del hexágono del iris que se está cerrando.
    const sale = 1 - rampa(t, c4.a - 0.2, 0.6);
    opacidad(ctx.reticula, t < 0.5 ? 0 : sale);
    const tC = c1.a + 0.3, tV = ctx.palabra(1, 'seis');
    const pc = suave(rampa(t, tC, 0.5));
    for (const [p, o] of ctx.hex) {
      const k = p === CENTRO ? -1 : VECINAS.indexOf(p);
      const on = k < 0 ? pc : k >= 0 ? suave(rampa(t, tV + k * 0.08, 0.4)) : 0;
      if (p !== CENTRO && k < 0) continue;
      o.h.setAttribute('fill', C.mix(C.PAPEL_H, C.ESPC[p.ab][0], on));
      o.t.setAttribute('opacity', on.toFixed(3));
    }
    ctx.contornoC.setAttribute('opacity', pc.toFixed(3));
    VECINAS.forEach((v, k) => {
      const p = suave(rampa(t, tV + k * 0.08, 0.35)), x = CENTRO.x + (v.x - CENTRO.x) * 0.78 * p, y = CENTRO.y + (v.y - CENTRO.y) * 0.78 * p;
      ctx.lineas[k].setAttribute('d', `M${(CENTRO.x + (v.x - CENTRO.x) * 0.22 * p).toFixed(1)} ${(CENTRO.y + (v.y - CENTRO.y) * 0.22 * p).toFixed(1)}L${x.toFixed(1)} ${y.toFixed(1)}`);
      ctx.lineas[k].setAttribute('opacity', p > 0 ? '1' : '0');
    });
    // Matriz: fila por fila en 900 ms; después, la diagonal y el mezquite.
    opacidad(ctx.cols, suave(rampa(t, c2.a, 0.3)));
    ctx.filas.forEach((fi, i) => opacidad(fi.g, suave(rampa(t, c2.a + 0.09 * i, 0.25))));
    const tDiag = ctx.palabra(3, 'misma'), tPla = ctx.palabra(3, 'mezquite'), tSuc = ctx.palabra(3, 'suculentas');
    ctx.diagonal.setAttribute('opacity', (suave(rampa(t, tDiag, 0.4)) * (1 - 0.6 * rampa(t, tPla, 0.4))).toFixed(3));
    ctx.pla.setAttribute('opacity', suave(rampa(t, tPla, 0.4)).toFixed(3));
    const pulso = Math.sin(Math.PI * clamp((t - tSuc) / 0.6));
    ctx.filas.forEach((fi, i) => fi.celdas.forEach((ce, j) => {
      const late = (i === PLA || j === PLA) && i !== j && ce.w <= 0.25 ? pulso : 0;
      ce.t.setAttribute('transform', late > 0.001 ? `translate(${ce.x} ${ce.y}) scale(${(1 + 0.3 * late).toFixed(3)}) translate(${-ce.x} ${-ce.y})` : '');
      ce.t.setAttribute('font-weight', late > 0.001 ? 700 : 400);
    }));
    opacidad(ctx.formulaW.e, suave(rampa(t, c2.a + 1.1, 0.6)) * (1 - rampa(t, c4.a - 0.2, 0.4)));
    // La matriz se va a la esquina superior derecha y entra la hoja del modelo.
    const pm = camara(rampa(t, c4.a - 0.2, 1.0)), k = 1 - 0.56 * pm;
    ctx.matriz.style.transform = pm > 0 ? `translate(${V.px(pm * (1824 - (M.x - 70 + 700)))}, ${V.px(pm * (96 - (M.y - 70)))}) scale(${k.toFixed(4)})` : '';
    opacidad(ctx.matriz, 1 - rampa(t, ctx.dur, 0.5));
    V.hojaVaiven(ctx.hoja, t, c4.a, ctx.dur, { dy: 36, d: 0.8, dFuera: 0.5 });
    const tObj = c4.a + 0.5, tUna = ctx.palabra(5, 'especie'), tConteo = ctx.palabra(5, 'cantidades'), tLin = c5.b + 0.3;
    const Tm = ctx.f.terminos;
    ctx.f.e.style.color = C.mix(C.mix(C.PAPEL, C.TIERRA, 0.3), C.TIERRA, suave(rampa(t, tObj, 0.8)));
    V.encender(Tm.c, t, tObj, tUna);
    V.encender(Tm.obj, t, tObj, tUna);
    V.encender(Tm.una, t, tUna, tConteo);
    V.encender(Tm.conteo, t, tConteo, tLin);
    // Las restricciones de linealización, sin narración: solo pasan a tierra suave.
    const pl = suave(rampa(t, tLin, 0.6));
    for (const n of Tm.lin) n.style.color = C.mix(C.mix(C.PAPEL, C.TIERRA, 0.3), C.TS, pl);
    const ver = { c: tObj, una: tUna, conteo: tConteo, lin: tLin };
    for (const [n, a] of Object.entries(ctx.anota)) {
      const p = suave(rampa(t, ver[n] + 0.1, 0.5));
      aparecer(a.e, p, 4);
      a.linea.setAttribute('opacity', p.toFixed(3));
    }
  },
});

const css = document.createElement('style');
css.textContent = `
.e8-matriz { left: ${M.x - 70}px; top: ${M.y - 70}px; width: 700px; height: 760px; transform-origin: 100% 0; }
.e8-matriz svg { position: absolute; left: 0; top: 0; overflow: visible; }
.e8-fw { position: absolute; left: 70px; top: 684px; font-size: 26px; color: var(--tierra-suave); }
.e8-formula { position: absolute; left: 90px; top: 110px; font-size: 44px; }
`;
document.head.appendChild(css);
})();
