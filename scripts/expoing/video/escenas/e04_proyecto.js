/* E4 · El proyecto y su alcance (PLAN §5, E4).
 *
 * La hectárea se encoge a la izquierda y aparece la clave vigente (22 posiciones),
 * copiada fila tras fila sin desfase, como se usa hoy. Luego crece el árbol de la
 * tubería (DESIGN.md §4.1, el de la lámina 6 del deck): raíces (datos de INECOL),
 * tronco (los escenarios), una rama por clave, una ramita por polígono y, en cada
 * punta, una planta de su clave con sus seis vecinas. A los lados, las dos preguntas;
 * abajo, el alcance.
 */
/* global DATOS */
(() => {
'use strict';
const V = window.REFOR_VIDEO, K = window.CARTA, C = window.EXPO_COMUN, D = DATOS, DV = window.DATOS_VIDEO;
const { rampa, suave, camara, aparecer, opacidad, html, clamp } = V;
const R3 = Math.sqrt(3);

/* ---------- Clave vigente: una fila de hexágonos, repetida sin desfase ---------- */
const VIG = DV.clave_vigente, RV = 22, FILAS_VIG = 5;
const VIG_X = 1180 - (VIG.length - 0.5) * R3 * RV / 2, VIG_Y = 330;

/* ---------- Árbol de la tubería (port de docs/presentacion/deck.js, lámina 6) ---------- */
// Cada rama se dibuja en tramos que se adelgazan; el tramo i empieza cuando termina el
// anterior y la punta avanza como 1 − (1 − t)². Los tiempos (en ms del deck) se
// reescalan para que el árbol crezca en 3.5 s.
const AX = 960, SUELO = 500, TOPE = 382, CY = 392, WT = 18, R_HOJA = 7;
const GEN = { Agave: C.SALVIA, Opuntia: C.OCRE, Otras: C.TIERRA };
const GEN_DE = Object.fromEntries(D.especies.map(e => [e.ab, e.genero]));
const ARBOL = (() => {
  const T = D.totales, tramos = [], hojas = [];
  const grosor = a => Math.max(1.2, WT * Math.sqrt(a / T.area));
  const dist = (P, Q) => Math.hypot(Q[0] - P[0], Q[1] - P[1]);
  const hacia = (P, Q, f) => [P[0] + (Q[0] - P[0]) * f, P[1] + (Q[1] - P[1]) * f];
  function rama(P, Q, w0, w1, t0, dur, n = 8, raiz = false) {
    const dx = Q[0] - P[0], dy = Q[1] - P[1], l = Math.hypot(dx, dy) || 1, vy = dy / l + (dy > 0 ? 0.9 : -0.9), lv = Math.hypot(dx / l, vy);
    const C1 = [P[0] + dx / lv * 0.4, P[1] + vy * l / lv * 0.4], C2 = [Q[0] - dx * 0.3, Q[1] - dy * 0.3];
    const B = u => { const v = 1 - u; return [0, 1].map(j => v * v * v * P[j] + 3 * v * v * u * C1[j] + 3 * v * u * u * C2[j] + u * u * u * Q[j]); };
    const inicio = i => t0 + dur * (1 - Math.sqrt(1 - i / n));
    for (let i = 0; i < n; i++) {
      const pts = [0, 1, 2, 3, 4].map(j => B((i + j / 4) / n));
      let largo = 0;
      for (let j = 1; j < pts.length; j++) largo += dist(pts[j - 1], pts[j]);
      tramos.push({ d: 'M' + pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L'), w: w0 + (w1 - w0) * (i + 0.5) / n,
        largo: largo + 0.5, t0: inicio(i), dur: inicio(i + 1) - inicio(i), raiz });
    }
    return { B, fin: t0 + dur };
  }
  // Raíces: los cuatro insumos de INECOL.
  const raices = [[-200, 88], [-76, 112], [76, 112], [200, 88]].map(([dx, dy], i) => {
    const t0 = 150 + i * 80, lado = Math.sign(dx), r = rama([AX + lado * 6, SUELO], [AX + dx, SUELO + dy], 8, 1.1, t0, 700, 8, true);
    const m = r.B(0.5);
    rama(m, [m[0] + lado * 38, m[1] + 24], 2.4, 0.8, t0 + 420, 380, 4, true);
    return r;
  });
  const T0 = 650, DT = 650;
  const tronco = rama([AX, SUELO + 4], [AX, TOPE], WT + 8, WT, T0, DT);
  const brota = y => T0 + DT * (1 - Math.sqrt(1 - Math.min(1, (SUELO - y) / (SUELO - TOPE))));
  // Copa: la clave más grande sigue al tronco; las demás alternan a los lados. Hojas en dos
  // arcos al tresbolillo, con un hueco entre claves.
  const conPol = K.PROGRAMA;
  const porTamano = [...D.mosaicos].sort((a, b) => b.poligonos.length - a.poligonos.length || a.id - b.id);
  const izq = [], der = [];
  porTamano.slice(1).forEach((m, i) => (i % 2 ? der : izq).push(m));
  const orden = [...izq.reverse(), porTamano[0], ...der], centro = izq.length;
  const HUECO = 0.9, total = conPol.length + (orden.length - 1) * HUECO;
  let u = 0, k = 0;
  const grupos = orden.map((m, gi) => {
    if (gi) u += HUECO;
    const ps = conPol.filter(p => p.clave === m.id).sort((a, b) => a.p - b.p).map(p => {
      const th = Math.PI * (0.95 - 0.9 * u / (total - 1)), fuera = k % 2 === 0;
      u += 1; k += 1;
      return { p, x: AX + (fuera ? 470 : 372) * Math.cos(th), y: CY - (fuera ? 290 : 218) * Math.sin(th) };
    });
    return { m, ps, gi };
  });
  const centroDe = qs => qs.reduce((a, q) => [a[0] + q.x / qs.length, a[1] + q.y / qs.length], [0, 0]);
  const areaDe = qs => qs.reduce((a, q) => a + q.p.area, 0);
  let finRamitas = 0;
  for (const { m, ps, gi } of grupos) {
    const lado = Math.sign(gi - centro), lejos = Math.abs(gi - centro);
    const S = lejos ? [AX + lado * 5, TOPE + 15 + 25 * (lejos - 1) + (lado > 0 ? 9 : 0)] : [AX, TOPE + 2];
    const L = hacia(S, centroDe(ps), ps.length > 1 ? 0.5 : 0.6), a = areaDe(ps);
    const mayor = rama(S, L, grosor(a), grosor(a) * 0.8, brota(S[1]), 250 + 1.2 * dist(S, L));
    const nSub = Math.ceil(ps.length / 4);
    for (let j = 0; j < nSub; j++) {
      const sub = ps.slice(Math.round(j * ps.length / nSub), Math.round((j + 1) * ps.length / nSub));
      let base = L, t = mayor.fin;
      if (nSub > 1) {
        const G = hacia(L, centroDe(sub), 0.55), as = areaDe(sub);
        const r = rama(L, G, grosor(as), grosor(as) * 0.8, mayor.fin - 60, 200 + 1.2 * dist(L, G), 6);
        base = G; t = r.fin;
      }
      for (const q of sub) {
        const fin = [q.x, q.y], w = grosor(q.p.area);
        const ramita = rama(base, fin, w, w * 0.8, t - 40, 150 + 1.3 * dist(base, fin), 5);
        finRamitas = Math.max(finRamitas, ramita.fin);
        hojas.push({ x: q.x, y: q.y, m, t: ramita.fin - 60, i: ps.indexOf(q) });
      }
    }
  }
  // Reescala a 3.5 s.
  const finTotal = Math.max(...hojas.map(h => h.t)) + 80 + 35 * 6 + 200, e = 3.5 / finTotal;
  for (const s of tramos) { s.t0 *= e; s.dur *= e; }
  for (const h of hojas) h.t *= e;
  return { tramos, hojas, tronco: T0 * e, ramitas: finRamitas * e, fin: 3.5, escala: e };
})();
// Cámara final de E4: la hectárea encogida a la izquierda (E5 la conserva mientras cierra el iris).
const HA0 = V.compartido.hectarea, CAM_PEQ = K.mostrar(HA0.CENTRO_HA, [330, 452], HA0.CAM_HA.s / 3.2);
V.compartido.finE4 = { camara: CAM_PEQ, atenuar: 0.92 };
// Escenarios Monte Carlo: el K que reporta refor en la salida de la terminal.
const K_ESCENARIOS = +(/K=(\d+)/.exec(DV.terminal.salida.join('\n')) || [0, 0])[1];

V.escena({
  id: 'E4', entrada: 0, cola: 0.6,

  construir(ctx) {
    const r = ctx.raiz;
    ctx.g = V.lienzo(r);
    // Clave vigente.
    const sv = C.el('svg', { class: 'abs', width: 1920, height: 1080, viewBox: '0 0 1920 1080' }, r);
    ctx.vigente = sv;
    ctx.filasVig = [];
    for (let f = 0; f < FILAS_VIG; f++) {
      const gf = C.el('g', {}, sv);
      VIG.forEach((ab, i) => {
        const x = VIG_X + (i + (f % 2) * 0.5) * R3 * RV, y = VIG_Y + f * 1.5 * RV;
        C.el('path', { d: C.hexD(RV), transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`, fill: C.ESPC[ab][0], stroke: C.TS, 'stroke-width': 0.9 }, gf);
        if (f === 0) C.tx(gf, x, y + 6, ab, { 'font-family': 'Instrument Sans', 'font-weight': 500, 'font-size': 14, fill: C.ESPC[ab][1], 'text-anchor': 'middle' });
      });
      ctx.filasVig.push(gf);
    }
    ctx.vigTitulo = html('div', 'abs e4-vig-titulo', r, `Hoy: una secuencia fija de ${VIG.length} plantas por cada 100 m`);
    ctx.vigNota = html('div', 'abs e4-vig-nota', r, 'compra estimada a ojo');
    // Árbol.
    const sa = C.el('svg', { class: 'abs', width: 1920, height: 1080, viewBox: '0 0 1920 1080' }, r);
    ctx.arbol = sa;
    let ach = '';
    for (let x = AX - 300; x <= AX + 300; x += 12) ach += `M${x} ${SUELO + 3}l-6 8`;
    ctx.suelo = C.el('path', { d: `M${AX - 310} ${SUELO}H${AX + 310}`, stroke: C.TIERRA, 'stroke-width': 1.5, fill: 'none', 'stroke-linecap': 'round' }, sa);
    ctx.achurado = C.el('path', { d: ach, stroke: C.TS, 'stroke-width': 1, fill: 'none', opacity: 0 }, sa);
    ctx.tramos = ARBOL.tramos.map(s => {
      const e = C.el('path', { d: s.d, fill: 'none', stroke: s.raiz ? C.TS : C.TIERRA, 'stroke-width': s.w.toFixed(2), 'stroke-linecap': 'round',
        'stroke-dasharray': s.largo.toFixed(1), 'stroke-dashoffset': s.largo.toFixed(1) }, sa);
      return { e, s, ultimo: -1 };
    });
    ctx.hojas = ARBOL.hojas.map(h => {
      const plano = h.m.clave.flat(), F = h.m.clave.length, Cc = h.m.clave[0].length, N = F * Cc;
      const v = (h.i * 19 + 7) % N, f = Math.floor(v / Cc), c = v % Cc;
      const env = (ff, cc) => (((ff % F) + F) % F) * Cc + (((cc % Cc) + Cc) % Cc);
      const g = C.el('g', { transform: `translate(${h.x.toFixed(1)} ${h.y.toFixed(1)})` }, sa);
      const hex = [[0, 0], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0]].map(([df, dc], j) => {
        const ab = plano[env(f + df, c + dc)];
        const e = C.el('path', { d: C.hexD(R_HOJA), transform: `translate(${(R3 * (dc + 0.5 * df) * R_HOJA).toFixed(2)} ${(1.5 * df * R_HOJA).toFixed(2)}) scale(0)`,
          fill: GEN[GEN_DE[ab]], stroke: C.TS, 'stroke-width': 0.75 }, g);
        return { e, j, x: R3 * (dc + 0.5 * df) * R_HOJA, y: 1.5 * df * R_HOJA };
      });
      return { h, hex };
    });
    // Leyenda de la tubería bajo el suelo.
    const cad = html('div', 'abs e4-cadena', r);
    ctx.cadena = [`datos de INECOL`, `${C.fmt(K_ESCENARIOS)} escenarios`, 'compra por polígono', 'clave de plantación'].map((s, i) => {
      if (i) html('span', 'e4-flecha', cad, '→');
      return html('span', 'e4-eslabon', cad, s);
    });
    ctx.cadenaE = cad;
    // Las dos preguntas.
    const pregunta = (clase, n, titulo, nota) => {
      const e = html('div', 'abs e4-pregunta ' + clase, r);
      html('div', 'e4-p-n', e, `Pregunta ${n}`);
      html('div', 'e4-p-t', e, titulo);
      html('div', 'e4-p-nota', e, nota);
      return e;
    };
    ctx.p1 = pregunta('e4-p1', 1, '¿Cuánto comprar?', 'al menor costo, con garantía de cumplir la meta');
    ctx.p2 = pregunta('e4-p2', 2, '¿Dónde plantar<br>cada una?', 'que compitan lo menos posible');
    // El alcance.
    const al = html('div', 'abs e4-alcance', r);
    const sl = C.el('svg', { width: 1320, height: 40, viewBox: '0 0 1320 40', class: 'e4-llave' }, al);
    // Llave horizontal con la punta hacia el árbol.
    const m = 660, y0 = 34, y1 = 20, y2 = 6;
    ctx.llave = C.el('path', { d: `M2 ${y0}Q2 ${y1} 30 ${y1}H${m - 30}Q${m} ${y1} ${m} ${y2}Q${m} ${y1} ${m + 30} ${y1}H1288Q1318 ${y1} 1318 ${y0}`,
      fill: 'none', stroke: C.TIERRA, 'stroke-width': 1.5, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, sl);
    const dentro = html('div', 'e4-col e4-dentro', al);
    html('div', 'e4-col-t', dentro, 'Dentro del alcance');
    html('div', 'e4-col-x', dentro, `compra y composición por especie · acomodo en el terreno · ${D.totales.poligonos} polígonos, ` +
      `${C.fmt(Math.round(D.totales.area))} ha, ${D.especies.length} especies · supervivencia al primer año`);
    const fuera = html('div', 'e4-col e4-fuera', al);
    html('div', 'e4-col-t', fuera, 'Fuera');
    html('div', 'e4-col-x', fuera, '<s>agua · vivero · terreno de cada polígono</s>');
    ctx.dentro = dentro; ctx.fuera = fuera; ctx.alcance = al;
  },

  tick(t, ctx) {
    const ca = ctx.carta.estado, HAc = V.compartido.hectarea, c1 = ctx.cue(1), c2 = ctx.cue(2), c3 = ctx.cue(3), c4 = ctx.cue(4), c5 = ctx.cue(5);
    // La hectárea se encoge a la izquierda con un movimiento de cámara.
    const cam = K.viaje(HAc.CAM_HA, CAM_PEQ, HAc.CENTRO_HA, camara(rampa(t, c1.a, 1.6)));
    const tArbol = c2.a + 0.3, fuera = 1 - rampa(t, c2.a - 0.1, 0.6);
    if (t <= ctx.dur) {
      ca.camara = cam;
      ca.atenuar = V.lerp(0.72, V.compartido.finE4.atenuar, suave(rampa(t, c2.a - 0.1, 0.8)));
    }
    const g = ctx.g; g.limpiar();
    if (fuera > 0) HAc.dibujar(g, cam, Object.assign({}, HAc.FINAL, { alfa: fuera }));
    // Clave vigente: la fila y sus copias hacia abajo.
    ctx.filasVig.forEach((f, i) => opacidad(f, suave(rampa(t, c1.a + 1.5 + i * 0.3, 0.4)) * fuera));
    aparecer(ctx.vigTitulo, suave(rampa(t, c1.a + 1.2, 0.6)) * fuera);
    aparecer(ctx.vigNota, suave(rampa(t, ctx.palabra(1, 'ojo') - 0.2, 0.6)) * fuera, 4);
    // El árbol crece en 3.5 s.
    const ta = t - tArbol;
    opacidad(ctx.arbol, t >= tArbol ? 1 : 0);
    ctx.suelo.setAttribute('stroke-dasharray', '620'); ctx.suelo.setAttribute('stroke-dashoffset', (620 * (1 - suave(clamp(ta / 0.5)))).toFixed(1));
    opacidad(ctx.achurado, clamp((ta - 0.25) / 0.4));
    for (const tr of ctx.tramos) {
      const p = clamp((ta - tr.s.t0) / tr.s.dur), q = Math.round(p * 1000);
      if (q === tr.ultimo) continue;
      tr.ultimo = q;
      // Sin trazo aún, se oculta: con extremos redondos, un guion de largo 0 se ve como un punto.
      tr.e.style.visibility = p <= 0 ? 'hidden' : '';
      tr.e.setAttribute('stroke-dashoffset', (tr.s.largo * (1 - p)).toFixed(2));
    }
    for (const h of ctx.hojas) for (const x of h.hex) {
      const p = V.elastico(clamp((ta - h.h.t - (x.j ? (80 + 35 * x.j) * ARBOL.escala : 0)) / (0.25)));
      x.e.setAttribute('transform', `translate(${x.x.toFixed(2)} ${x.y.toFixed(2)}) scale(${p.toFixed(3)})`);
    }
    const hitos = [0.1, ARBOL.tronco, ARBOL.ramitas - 0.4, ARBOL.fin - 0.4];
    opacidad(ctx.cadenaE, suave(rampa(ta, 0, 0.4)));
    ctx.cadena.forEach((e, i) => opacidad(e, 0.3 + 0.7 * suave(rampa(ta, hitos[i], 0.4))));
    // Preguntas y alcance, al ritmo de la voz.
    aparecer(ctx.p1, suave(rampa(t, c3.a, 0.7)));
    aparecer(ctx.p2, suave(rampa(t, c4.a, 0.7)));
    opacidad(ctx.alcance, rampa(t, c5.a - 0.1, 0.2));
    ctx.llave.setAttribute('stroke-dashoffset', (1 - suave(rampa(t, c5.a, 0.7))).toFixed(4));
    aparecer(ctx.dentro, suave(rampa(t, c5.a + 0.4, 0.6)));
    aparecer(ctx.fuera, suave(rampa(t, ctx.palabra(5, 'agua') - 0.1, 0.6)));
  },
});

const css = document.createElement('style');
css.textContent = `
.e4-vig-titulo { left: ${Math.round(VIG_X - RV)}px; top: ${VIG_Y - 96}px; font: 32px/1.2 var(--texto); color: var(--tinta); }
.e4-vig-nota { left: ${Math.round(VIG_X - RV)}px; top: ${VIG_Y + (FILAS_VIG - 1) * 1.5 * RV + 44}px; font: italic 30px var(--texto);
  color: var(--tierra-suave); transform-origin: 0 50%; rotate: -2deg; }
.e4-cadena { left: 0; width: 1920px; top: ${SUELO + 128}px; text-align: center; font: 500 22px var(--ui); color: var(--tierra); }
.e4-flecha { margin: 0 14px; color: var(--tierra-suave); }
.e4-pregunta { top: 170px; width: 360px; }
.e4-p1 { left: 96px; }
.e4-p2 { left: ${1824 - 360}px; text-align: right; }
.e4-p-n { font: 500 22px var(--ui); color: var(--tierra-suave); }
.e4-p-t { font: 46px/1.1 var(--display); color: var(--tinta); margin: 8px 0 12px; }
.e4-p-nota { font: italic 25px/1.35 var(--texto); color: var(--tierra); }
.e4-alcance { left: 300px; top: 690px; width: 1320px; }
.e4-llave { display: block; }
.e4-col { position: absolute; top: 52px; }
.e4-dentro { left: 0; width: 740px; }
.e4-fuera { left: 830px; width: 490px; }
.e4-col-t { font: 500 20px var(--ui); color: var(--tierra-suave); margin-bottom: 6px; }
.e4-col-x { font: 25px/1.4 var(--texto); color: var(--tinta); }
.e4-fuera .e4-col-x { color: var(--tierra-suave); }
.e4-fuera s { text-decoration-thickness: 1.5px; }
`;
document.head.appendChild(css);
})();
