/* E9 · Pregunta 2: memético y resultado, el momento estelar (PLAN §5, E9).
 *
 * El mosaico de la clave 1 (4 × 13) arranca en una asignación al azar con semilla fija
 * (la misma de imagen-1-mosaico.gif) y, con «Resultado», cada hexágono viaja por un
 * arco a su lugar en el arreglo optimizado (la lógica de comun.js: armarMosaico).
 * Una regla de competencia compara el azar, el memético y la cota del modelo exacto.
 * Al final el mosaico se replica, se encoge y la cámara se aleja al mapa, donde cada
 * polígono toma el tono de su clave.
 */
/* global DATOS */
(() => {
'use strict';
const V = window.REFOR_VIDEO, K = window.CARTA, C = window.EXPO_COMUN, D = DATOS;
const { rampa, suave, camara, aparecer, opacidad, html, lerp, clamp } = V;
const R3 = Math.sqrt(3), T = D.totales, M1 = D.mosaicos[0];
const MOS = C.armarMosaico(M1.clave, D.W);

// Mosaico centrado: r = 36, filas corridas medio hexágono cada una (paralelogramo).
const R = 36;
const OX = 960 - (R3 * R * (MOS.C - 1 + 0.5 * (MOS.F - 1))) / 2, OY = 340;
const lugar = v => [OX + R3 * R * ((v % MOS.C) + 0.5 * Math.floor(v / MOS.C)), OY + 1.5 * R * Math.floor(v / MOS.C)];
const CENTRO_M = [960, OY + 1.5 * R * (MOS.F - 1) / 2];
// Traslaciones del mosaico periódico: 13 columnas a la derecha; 4 filas abajo.
const T1 = [R3 * R * MOS.C, 0], T2 = [R3 * R * 0.5 * MOS.F, 1.5 * R * MOS.F];
// Regla de competencia, de 70 a 96.
const REG = { x0: 430, x1: 1490, y: 700, v0: 70, v1: 96 };
const XR = v => REG.x0 + (v - REG.v0) / (REG.v1 - REG.v0) * (REG.x1 - REG.x0);
const EX = M1.exacto;
// Tonos de las seis claves (comun.js; los mismos del fondo del perfil).
const TONO = C.tonoClave(D.mosaicos.map(m => m.id));
const CAM_E9 = K.mostrar(K.CENTRO_SITIO, [1180, 470], 0.36);
V.compartido.claves = { CAM_E9, TONO };
const ESTRELLA = 2.5;   // duración del reacomodo (PLAN §3.5)

V.escena({
  id: 'E9', entrada: 0, cola: 0.6,

  construir(ctx) {
    const r = ctx.raiz;
    // Ciclo de una generación del memético, en miniatura.
    const ci = html('div', 'abs e9-ciclo', r);
    html('div', 'e9-ciclo-t', ci, 'Algoritmo memético + búsqueda tabú');
    const sc = C.el('svg', { width: 380, height: 260, viewBox: '-190 -125 380 260' }, ci);
    const PASOS = ['población', 'torneo', 'cruce', 'búsqueda tabú', 'reemplazo'], RC = 84;
    C.el('circle', { r: RC, fill: 'none', stroke: C.TS, 'stroke-width': 1, 'stroke-dasharray': '3 5' }, sc);
    PASOS.forEach((p, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / PASOS.length, x = Math.cos(a) * RC, y = Math.sin(a) * RC;
      C.el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 5, fill: C.TIERRA }, sc);
      const dx = Math.cos(a) * 16, dy = Math.sin(a) * 16 + 6;
      C.tx(sc, (x + dx).toFixed(1), (y + dy).toFixed(1), p, { 'font-family': 'Instrument Sans', 'font-size': 18, fill: C.TIERRA,
        'text-anchor': Math.abs(Math.cos(a)) < 0.2 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end' });
    });
    ctx.flecha = C.el('g', {}, sc);
    C.el('path', { d: `M0 ${-RC}A${RC} ${RC} 0 0 1 ${(RC * Math.sin(1.0)).toFixed(1)} ${(-RC * Math.cos(1.0)).toFixed(1)}`, fill: 'none', stroke: C.OCRE_H, 'stroke-width': 3, 'stroke-linecap': 'round' }, ctx.flecha);
    // Punta de flecha en el extremo del arco, orientada con su tangente (sentido del reloj).
    const ax = RC * Math.sin(1.0), ay = -RC * Math.cos(1.0), tx = Math.cos(1.0), ty = Math.sin(1.0);
    const pt = (u, v) => `${(ax + tx * u - ty * v).toFixed(1)} ${(ay + ty * u + tx * v).toFixed(1)}`;
    C.el('path', { d: `M${pt(9, 0)}L${pt(-5, 7)}L${pt(-5, -7)}Z`, fill: C.OCRE_H }, ctx.flecha);
    ctx.ciclo = ci;
    // Mosaico: el original y sus réplicas.
    const s = C.el('svg', { class: 'abs', width: 1920, height: 1080, viewBox: '0 0 1920 1080' }, r);
    ctx.svg = s;
    ctx.grupo = C.el('g', {}, s);
    ctx.replicas = C.el('g', { opacity: 0 }, ctx.grupo);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      if (!i && !j) continue;
      const g = C.el('g', { transform: `translate(${(i * T1[0] + j * T2[0]).toFixed(1)} ${(i * T1[1] + j * T2[1]).toFixed(1)})` }, ctx.replicas);
      MOS.optima.forEach((ab, v) => {
        const [x, y] = lugar(v);
        C.el('path', { d: C.hexD(R), transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`, fill: C.ESPC[ab][0], stroke: C.TS, 'stroke-width': 1 }, g);
      });
    }
    const fuente = { 'font-family': 'Instrument Sans', 'font-weight': 500, 'font-size': R * 0.5, 'text-anchor': 'middle' };
    ctx.fichas = MOS.fichas.map(fi => {
      const g = C.el('g', {}, ctx.grupo);
      C.el('path', { d: C.hexD(R), fill: C.ESPC[fi.s][0], stroke: C.TS, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, g);
      C.tx(g, 0, R * 0.18, fi.s, Object.assign({ fill: C.ESPC[fi.s][1] }, fuente));
      return { fi, g, a: lugar(fi.desde), b: lugar(fi.hasta) };
    });
    // Competencia total.
    const co = html('div', 'abs e9-contador', r);
    ctx.contN = html('div', 'e9-cn cifra', co, C.fmt(MOS.totAz, 1));
    html('div', 'e9-rot', co, 'competencia total entre vecinas');
    ctx.dif = html('div', 'e9-dif', co, `−${C.fmt(T.reduccion * 100)} %`);
    ctx.contador = co;
    // Regla: azar, memético y la cota del exacto.
    const sr = C.el('svg', { class: 'abs', width: 1920, height: 1080, viewBox: '0 0 1920 1080' }, r);
    ctx.regla = sr;
    const ui = (g, x, y, t, a) => C.tx(g, x, y, t, Object.assign({ 'font-family': 'Instrument Sans', 'font-size': 20, fill: C.TS, 'text-anchor': 'middle' }, a || {}));
    C.el('path', { d: `M${REG.x0} ${REG.y}H${REG.x1}`, stroke: C.TIERRA, 'stroke-width': 2 }, sr);
    for (let v = 70; v <= 95; v += 5) {
      C.el('path', { d: `M${XR(v)} ${REG.y}v8`, stroke: C.TIERRA, 'stroke-width': 1.5 }, sr);
      ui(sr, XR(v), REG.y + 30, C.fmt(v));
    }
    ctx.mAzar = C.el('g', {}, sr);
    C.el('circle', { cx: XR(M1.azar), cy: REG.y, r: 9, fill: C.PAPEL, stroke: C.TS, 'stroke-width': 2 }, ctx.mAzar);
    ui(ctx.mAzar, XR(M1.azar), REG.y - 22, `azar ${C.fmt(M1.azar, 1)}`, { fill: C.TIERRA });
    ctx.mMem = C.el('g', { opacity: 0.25 }, sr);
    C.el('circle', { cx: XR(M1.mejor), cy: REG.y, r: 9, fill: C.SALVIA_H }, ctx.mMem);
    ui(ctx.mMem, XR(M1.mejor), REG.y - 22, `memético ${C.fmt(M1.mejor, 1)}`, { fill: C.SALVIA_H, 'font-weight': 600 });
    ctx.mCota = C.el('g', { opacity: 0 }, sr);
    C.el('path', { d: `M${XR(EX.cota)} ${REG.y - 16}V${REG.y + 16}`, stroke: C.TIERRA, 'stroke-width': 2, 'stroke-dasharray': '4 3' }, ctx.mCota);
    ui(ctx.mCota, XR(EX.cota) - 12, REG.y - 22, `cota del exacto ${C.fmt(EX.cota, 1)}`, { fill: C.TIERRA, 'text-anchor': 'end' });
    ui(ctx.mCota, XR(EX.cota) - 12, REG.y + 62, 'Programación entera · HiGHS', { 'text-anchor': 'end', 'font-size': 19 });
    ctx.puntero = C.el('path', { d: 'M0 0l-9 -15h18z', fill: C.OCRE_H }, sr);
    // Llave de la brecha.
    const xa = XR(EX.cota), xb = XR(M1.mejor), yb = REG.y + 44;
    ctx.brecha = C.el('g', { opacity: 0 }, sr);
    C.el('path', { d: `M${xa} ${yb}q0 10 10 10H${(xa + xb) / 2 - 8}q8 0 8 10q0 -10 8 -10H${xb - 10}q10 0 10 -10`, fill: 'none', stroke: C.OCRE_H, 'stroke-width': 1.8 }, ctx.brecha);
    ui(ctx.brecha, (xa + xb) / 2, yb + 50, `brecha ≤ ${C.fmt(Math.ceil(EX.brecha * 10) / 10, 1)} %`, { fill: C.OCRE_H, 'font-weight': 600, 'font-size': 22 });
    // Leyenda de las claves en el mapa.
    const ley = html('div', 'abs e9-leyenda', r);
    html('div', 'e9-ley-t', ley, `${D.mosaicos.length} claves de plantación para ${T.poligonos} polígonos`);
    const grupos = [];
    for (const m of [...D.mosaicos].sort((a, b) => b.poligonos.length - a.poligonos.length || a.id - b.id)) {
      const n = m.poligonos.length, g = grupos.find(x => x.n === n && n === 1);
      if (g) g.ids.push(m.id); else grupos.push({ n, ids: [m.id] });
    }
    for (const g of grupos) {
      const f = html('div', 'e9-ley-fila', ley);
      for (const id of g.ids) {
        const sw = C.el('svg', { width: 24, height: 26, viewBox: '-12 -13 24 26' }, f);
        C.el('path', { d: C.hexD(11.5), fill: TONO(id), stroke: C.TS, 'stroke-width': 1 }, sw);
      }
      const ids = g.ids.length > 1 ? `Claves ${g.ids.slice(0, -1).join(', ')} y ${g.ids[g.ids.length - 1]}` : `Clave ${g.ids[0]}`;
      html('span', '', f, g.ids.length > 1 ? `${ids} · ${g.n} polígono cada una` : `${ids} · ${g.n} ${g.n === 1 ? 'polígono' : 'polígonos'}`);
    }
    ctx.leyenda = ley;
  },

  tick(t, ctx) {
    const ca = ctx.carta.estado, c1 = ctx.cue(1), c2 = ctx.cue(2), c3 = ctx.cue(3), c4 = ctx.cue(4), c5 = ctx.cue(5);
    const tE = c3.a + 0.3;                      // el momento estelar
    const tRep = c5.a + 0.2, tEnc = tRep + 0.7, tMapa = tEnc + 0.2;
    if (t <= ctx.dur) {
      const pm = camara(rampa(t, tMapa, 1.8));
      ca.camara = K.viaje(K.mostrar(K.CENTRO_SITIO, [1180, 470], CAM_E9.s * 3), CAM_E9, K.P1.c, pm);
      ca.atenuar = lerp(0.92, 0, suave(rampa(t, tMapa - 0.4, 1.4)));
      const pt = suave(rampa(t, tMapa + 1.0, 1.0));
      ca.poligonos.color = K.POLS.map(p => p.programa ? C.mix(C.PAPEL_H, TONO(p.clave), pt) : C.PAPEL_H);
    }
    // El ciclo del memético gira una vez.
    aparecer(ctx.ciclo, suave(rampa(t, 0.5, 0.6)) * (1 - rampa(t, tRep, 0.5)));
    const giro = 360 * C.eIO(rampa(t, c1.a + 0.6, 3.0));
    ctx.flecha.setAttribute('transform', `rotate(${giro.toFixed(2)})`);
    // El mosaico: al azar, luego el reacomodo por arcos.
    opacidad(ctx.svg, suave(rampa(t, 0.45, 0.6)));
    for (const f of ctx.fichas) {
      const p = C.eIO(clamp((t - tE - f.fi.ret * ESTRELLA / MOS.fin) / (f.fi.dur * ESTRELLA / MOS.fin)));
      const d = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
      const [x, y] = V.arco(f.a, f.b, p, Math.min(60, 0.3 * d));
      f.g.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
    }
    const g = C.eOut(clamp((t - tE) / ESTRELLA));
    ctx.contN.textContent = C.fmt(MOS.totAz + (MOS.totOp - MOS.totAz) * g, 1);
    aparecer(ctx.contador, suave(rampa(t, 0.5, 0.6)) * (1 - rampa(t, tRep, 0.5)));
    aparecer(ctx.dif, suave(rampa(t, tE + ESTRELLA - 0.2, 0.5)), 6);
    // Regla.
    opacidad(ctx.regla, suave(rampa(t, c2.a - 0.1, 0.6)) * (1 - rampa(t, tRep, 0.5)));
    opacidad(ctx.mCota, suave(rampa(t, ctx.palabra(2, 'exacto') - 0.2, 0.5)));
    opacidad(ctx.mMem, 0.25 + 0.75 * suave(rampa(t, tE + ESTRELLA - 0.4, 0.5)));
    const xp = lerp(XR(M1.azar), XR(M1.mejor), g);
    ctx.puntero.setAttribute('transform', `translate(${xp.toFixed(1)} ${REG.y - 46})`);
    opacidad(ctx.brecha, suave(rampa(t, c4.a + 0.2, 0.6)));
    // Corte por continuidad: el mosaico se replica, se encoge hacia el polígono 1 y se funde con el mapa.
    opacidad(ctx.replicas, suave(rampa(t, tRep, 0.5)));
    const pe = camara(rampa(t, tEnc, 1.6)), destino = K.proyectar(CAM_E9, K.P1.c);
    const k = lerp(1, 0.06, pe), cx = lerp(CENTRO_M[0], destino[0], pe), cy = lerp(CENTRO_M[1], destino[1], pe);
    ctx.grupo.setAttribute('transform', pe > 0 ? `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${k.toFixed(4)}) translate(${-CENTRO_M[0]} ${-CENTRO_M[1]})` : '');
    ctx.grupo.setAttribute('opacity', (1 - rampa(t, tEnc + 0.9, 0.7)).toFixed(3));
    aparecer(ctx.leyenda, suave(rampa(t, tMapa + 1.4, 0.6)) * (1 - rampa(t, ctx.dur - 0.1, 0.5)));
  },
});

const css = document.createElement('style');
css.textContent = `
.e9-ciclo { left: 96px; top: 80px; }
.e9-ciclo-t { font: 500 21px var(--ui); color: var(--tierra); margin: 0 0 4px 0; }
.e9-contador { left: 1490px; top: 96px; width: 334px; text-align: right; }
.e9-cn { font: 84px/1 var(--display); color: var(--tinta); }
.e9-rot { font: 21px/1.3 var(--ui); color: var(--tierra-suave); margin-top: 6px; }
.e9-dif { font: 48px/1.1 var(--display); color: var(--ocre-hondo); margin-top: 12px; }
.e9-leyenda { left: 96px; top: 300px; padding: 22px 26px; background: var(--papel); border: 1px solid rgba(76,69,65,.22);
  box-shadow: 0 6px 24px rgba(76,69,65,.10); }
.e9-ley-t { font: 500 21px var(--ui); color: var(--tierra); margin-bottom: 10px; }
.e9-ley-fila { display: flex; align-items: center; gap: 6px; height: 40px; font: 24px var(--texto); color: var(--tinta); }
.e9-ley-fila span { margin-left: 8px; }
`;
document.head.appendChild(css);
})();
