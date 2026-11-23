/* E7 · Pregunta 1: el resultado (PLAN §5, E7).
 *
 * La hoja de método se retira y la cámara se aleja hasta los 30 polígonos, que se
 * pueblan con sus plantas compradas en una onda desde el centro, mientras corre el
 * contador de la compra total. Luego una hoja trae la frontera B*(α): la curva Monte
 * Carlo, el presupuesto disponible y el hueco que nunca se cierra; la curva exacta
 * encima y, a la izquierda, la salida real de `refor frontera -f tabla`.
 */
/* global DATOS */
(() => {
'use strict';
const V = window.REFOR_VIDEO, K = window.CARTA, C = window.EXPO_COMUN, D = DATOS, DV = window.DATOS_VIDEO;
const { rampa, suave, camara, aparecer, opacidad, html, lerp, clamp } = V;
const T = D.totales, FR = D.frontera, FX = DV.frontera_exacta;

const CAM_E7 = K.mostrar(K.CENTRO_SITIO, [1260, 480], 0.36);
V.compartido.sitioE7 = CAM_E7;
V.compartido.atenuarE7 = 0.3;   // como queda la carta al final de E7
// Avance de la onda en cada polígono: de su punto más cercano al centro al más lejano.
const ONDA = K.PROGRAMA.map(p => {
  const ds = p.v.map(v => Math.hypot(v[0] - K.CENTRO_SITIO[0], v[1] - K.CENTRO_SITIO[1]));
  const m = D.mapa.find(x => x.p === p.p);
  return { a: Math.min(...ds), b: Math.max(...ds), peso: m.compra_ha * m.area };
});
const PESO = ONDA.reduce((s, o) => s + o.peso, 0);
const R_MAX = Math.max(...ONDA.map(o => o.b)) + 30;

// Frontera: α de 0 a 0.5 en x; B de $12,000 a $15,000 en y (coordenadas de la hoja).
const HOJA = { x: 760, y: 96, w: 1064, h: 760 };
const G = { x0: 150, x1: 1000, y0: 190, y1: 600, b0: 12000, b1: 15000 };
const X = a => G.x0 + a / 0.5 * (G.x1 - G.x0), Y = b => G.y1 - (b - G.b0) / (G.b1 - G.b0) * (G.y1 - G.y0);
const B05 = FR.find(f => f[0] === T.alfa)[1], BX05 = FX.find(f => f[0] === T.alfa)[1];
const MAS = B05 / T.presupuesto - 1;
const RIESGO = FR[FR.length - 1][0] / FR[0][0], AHORRO = FR[FR.length - 1][1] / FR[0][1] - 1;
const FALTANTE = (T.B_min - T.presupuesto) * T.area;
const ruta = pts => 'M' + pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L');

V.escena({
  id: 'E7', entrada: 0, cola: 0.5,

  construir(ctx) {
    const r = ctx.raiz;
    // Panel de la compra (sobre papel: el texto nunca va directo sobre el mapa).
    const pa = html('div', 'abs e7-panel', r);
    ctx.contN = html('div', 'e7-num cifra', pa, '0');
    html('div', 'e7-rot', pa, `plantas por comprar para los ${T.poligonos} polígonos`);
    const bh = html('div', 'e7-bloque', pa);
    html('div', 'e7-rot2', bh, 'por hectárea');
    const barra = html('div', 'e7-barra', bh), esc = 520 / 760;
    ctx.bCompra = html('div', 'e7-b e7-compra', barra); ctx.bCompra.style.width = (T.compra_ha * esc) + 'px';
    ctx.bExist = html('div', 'e7-b e7-exist', barra);
    Object.assign(ctx.bExist.style, { left: (T.compra_ha * esc) + 'px', width: (T.existentes_ha * esc) + 'px' });
    ctx.bMeta = html('div', 'e7-meta', barra); ctx.bMeta.style.left = (T.meta_ha * esc) + 'px';
    html('div', 'e7-meta-t', ctx.bMeta, `meta ${C.fmt(T.meta_ha)}`);
    ctx.bTexto = html('div', 'e7-btexto', bh,
      `${C.fmt(T.compra_ha, 1)} compradas + ${C.fmt(T.existentes_ha, 1)} existentes = <b>${C.fmt(T.densidad_ha, 1)} plantas/ha</b>`);
    ctx.bNota = html('div', 'e7-bnota', bh, `${C.fmt((T.densidad_ha / T.meta_ha - 1) * 100, 1)} % sobre la meta, para absorber la mortalidad`);
    ctx.bloque = bh;
    ctx.panel = pa;
    // Terminal: la salida real de refor, sin editar.
    const te = html('div', 'abs e7-terminal', r);
    html('div', 'e7-term-barra', te, 'terminal');
    const cuerpo = html('pre', 'e7-term-cuerpo', te);
    ctx.cmd = html('span', 'e7-cmd', cuerpo, '');
    ctx.lineas = DV.terminal.salida.map(l => {
      const e = html('span', 'e7-linea', cuerpo, V.escapar(l));
      if (/^\s+0\.050\s/.test(l)) e.classList.add('e7-fila-05');
      return e;
    });
    ctx.terminal = te;
    // Hoja de la frontera.
    const h = V.hoja(r, HOJA.x, HOJA.y, HOJA.w, HOJA.h);
    ctx.hoja = h;
    html('div', 'e7-titulo', h, 'Presupuesto mínimo por hectárea');
    html('div', 'e7-subt', h, 'según el riesgo aceptado de no cumplir la meta');
    const s = C.el('svg', { class: 'abs', width: HOJA.w, height: HOJA.h, viewBox: `0 0 ${HOJA.w} ${HOJA.h}` }, h);
    s.style.left = '0'; s.style.top = '0';
    ctx.svg = s;
    const ui = (x, y, t, a) => C.tx(s, x, y, t, Object.assign({ 'font-family': 'Instrument Sans', 'font-size': 19, fill: C.TS }, a || {}));
    const ejes = C.el('g', {}, s);
    for (let b = G.b0; b <= G.b1; b += 1000) {
      C.el('path', { d: `M${G.x0} ${Y(b)}H${G.x1}`, stroke: C.TIERRA, 'stroke-opacity': 0.13, 'stroke-width': 1 }, ejes);
      C.tx(ejes, G.x0 - 14, Y(b) + 6, '$' + C.fmt(b), { 'font-family': 'Instrument Sans', 'font-size': 19, fill: C.TS, 'text-anchor': 'end' });
    }
    C.el('path', { d: `M${G.x0} ${G.y1}H${G.x1}`, stroke: C.TIERRA, 'stroke-width': 1.5 }, ejes);
    [0.01, 0.05, 0.1, 0.2, 0.3, 0.5].forEach(a => C.tx(ejes, X(a), G.y1 + 30, C.fmt(a * 100) + ' %', { 'font-family': 'Instrument Sans', 'font-size': 19, fill: C.TS, 'text-anchor': 'middle' }));
    C.tx(ejes, (G.x0 + G.x1) / 2, G.y1 + 64, 'riesgo aceptado de no cumplir la meta (α)', { 'font-family': 'Instrument Sans', 'font-size': 19, fill: C.TS, 'text-anchor': 'middle' });
    ctx.ejes = ejes;
    const pts = FR.map(([a, b]) => [X(a), Y(b)]), ptsX = FX.map(([a, b]) => [X(a), Y(b)]);
    // Hueco entre la frontera y el presupuesto, en ocre al 35 % (DESIGN.md §2).
    const yp = Y(T.presupuesto).toFixed(1);
    ctx.hueco = C.el('path', { d: `M${pts[0][0].toFixed(1)} ${yp}${ruta(pts).replace('M', 'L')}L${pts[pts.length - 1][0].toFixed(1)} ${yp}Z`,
      fill: C.OCRE, 'fill-opacity': 0.35, opacity: 0 }, s);
    ctx.presu = C.el('path', { d: `M${G.x0} ${Y(T.presupuesto)}H${G.x1}`, stroke: C.OCRE_H, 'stroke-width': 2, 'stroke-dasharray': '9 6', opacity: 0 }, s);
    ctx.presuT = ui(G.x1, Y(T.presupuesto) + 30, `$${C.fmt(T.presupuesto)}/ha disponibles`, { fill: C.OCRE_H, 'font-weight': 600, 'text-anchor': 'end', 'font-size': 21, opacity: 0 });
    ctx.curva = C.el('path', { d: ruta(pts), stroke: C.TIERRA, 'stroke-width': 2.5, fill: 'none', 'stroke-linejoin': 'round', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, s);
    ctx.puntos = pts.map(p => C.el('circle', { cx: p[0], cy: p[1], r: 4.5, fill: C.PAPEL, stroke: C.TIERRA, 'stroke-width': 2, opacity: 0 }, s));
    ctx.exacta = C.el('path', { d: ruta(ptsX), stroke: C.TINTA, 'stroke-width': 2, fill: 'none', 'stroke-dasharray': '7 6', opacity: 0 }, s);
    // α = 0.05: el presupuesto mínimo.
    const p05 = [X(T.alfa), Y(B05)];
    ctx.marca = C.el('circle', { cx: p05[0], cy: p05[1], r: 8, fill: C.OCRE_H, stroke: C.PAPEL, 'stroke-width': 2, opacity: 0 }, s);
    const yG = (Y(T.presupuesto) + Y(B05)) / 2;
    ctx.bmin = C.el('g', { opacity: 0 }, s);
    C.el('path', { d: `M${p05[0] + 6} ${p05[1] + 8}L${p05[0] + 60} ${yG - 44}`, class: 'guia' }, ctx.bmin);
    C.tx(ctx.bmin, p05[0] + 70, yG - 18, `$${C.fmt(T.B_min)}/ha`, { 'font-family': 'Libre Caslon Display', 'font-size': 62, fill: C.OCRE_H });
    C.tx(ctx.bmin, p05[0] + 72, yG + 18, `${C.fmt(MAS * 100)} % más que lo disponible · ningún polígono es factible`, { 'font-family': 'Instrument Sans', 'font-size': 20, fill: C.TIERRA });
    // Cursor que recorre la frontera de α = 0.01 a 0.50.
    ctx.cursor = C.el('g', { opacity: 0 }, s);
    ctx.cursorL = C.el('path', { d: '', stroke: C.OCRE_H, 'stroke-width': 1.5, 'stroke-dasharray': '3 4' }, ctx.cursor);
    ctx.cursorP = C.el('circle', { r: 9, fill: 'none', stroke: C.OCRE_H, 'stroke-width': 3 }, ctx.cursor);
    const pf = pts[pts.length - 1];
    ctx.riesgo = C.tx(s, pf[0], pf[1] - 26, `riesgo ×${C.fmt(RIESGO)} → ${AHORRO < 0 ? '−' : '+'}${C.fmt(Math.abs(AHORRO) * 100, 1)} %`,
      { 'font-family': 'Instrument Sans', 'font-size': 22, 'font-weight': 600, fill: C.OCRE_H, 'text-anchor': 'end', opacity: 0 });
    // Lupa en α = 0.05.
    ctx.lupa = C.el('g', { opacity: 0 }, s);
    C.el('circle', { cx: p05[0], cy: p05[1], r: 30, fill: 'none', stroke: C.TIERRA, 'stroke-width': 2 }, ctx.lupa);
    C.el('path', { d: `M${p05[0] + 21} ${p05[1] - 21}L${p05[0] + 66} ${p05[1] - 66}`, stroke: C.TIERRA, 'stroke-width': 2 }, ctx.lupa);
    C.tx(ctx.lupa, p05[0] + 74, p05[1] - 86, `Monte Carlo $${C.fmt(B05, 2)} · exacto $${C.fmt(BX05, 2)}`,
      { 'font-family': 'Instrument Sans', 'font-size': 22, 'font-weight': 600, fill: C.TINTA });
    ctx.faltante = html('div', 'e7-faltante', h, `faltan $${C.fmt(Math.round(FALTANTE / 1000))} mil para los ${T.poligonos} polígonos`);
    Object.assign(ctx.faltante.style, { left: (X(T.alfa) + 70) + 'px', top: (Y(T.presupuesto) - 72) + 'px' });
  },

  tick(t, ctx) {
    const ca = ctx.carta.estado, c1 = ctx.cue(1), c2 = ctx.cue(2), c3 = ctx.cue(3), c4 = ctx.cue(4), c5 = ctx.cue(5), c6 = ctx.cue(6);
    const tOnda = c1.a + 0.3, dOnda = 4.2;
    const onda = R_MAX * C.eIO(rampa(t, tOnda, dOnda));
    if (t <= ctx.dur) {
      ca.camara = K.viaje(V.compartido.temporadas.CAM_E5, CAM_E7, K.CENTRO_SITIO, camara(rampa(t, 0.1, 2.0)));
      ca.atenuar = lerp(0.9, 0, suave(rampa(t, 0.2, 1.4))) + V.compartido.atenuarE7 * suave(rampa(t, c2.a, 0.8));
      ca.resalte = { i: -1, p: 0 };
      // La hoja de la frontera tapa el sitio a partir de c2: ya no hace falta dibujar la siembra.
      ca.siembra = { alfa: 1 - rampa(t, c2.a + 0.9, 0.2), onda, centro: K.CENTRO_SITIO, modo: 'compra', fijos: null };
    }
    // Contador: la compra de cada polígono, en la fracción que ya cubrió la onda.
    let w = 0;
    for (const o of ONDA) w += o.peso * clamp((onda - o.a) / Math.max(1, o.b - o.a));
    ctx.contN.textContent = C.fmt(t >= tOnda + dOnda ? T.compra : Math.round(T.compra * w / PESO));
    const tBarra = tOnda + dOnda - 0.6;
    aparecer(ctx.panel, suave(rampa(t, 0.7, 0.6)) * (1 - rampa(t, c5.a - 0.2, 0.5)));
    aparecer(ctx.bloque, suave(rampa(t, tBarra, 0.6)));
    ctx.bCompra.style.transform = `scaleX(${suave(rampa(t, tBarra + 0.2, 0.8)).toFixed(4)})`;
    ctx.bExist.style.transform = `scaleX(${suave(rampa(t, tBarra + 0.8, 0.6)).toFixed(4)})`;
    opacidad(ctx.bMeta, suave(rampa(t, tBarra + 1.2, 0.4)));
    opacidad(ctx.bNota, suave(rampa(t, tBarra + 1.5, 0.5)));
    // La hoja de la frontera.
    V.hojaVaiven(ctx.hoja, t, c2.a, Infinity, { dy: 40, d: 0.8 });
    const tCurva = c2.a + 0.5;
    ctx.curva.setAttribute('stroke-dashoffset', (1 - suave(rampa(t, tCurva, 0.8))).toFixed(4));
    ctx.puntos.forEach((p, i) => p.setAttribute('opacity', rampa(t, tCurva + 0.8 * i / (ctx.puntos.length - 1), 0.1).toFixed(2)));
    const tPresu = ctx.palabra(2, 'doce'), tHueco = ctx.palabra(2, 'ningún');
    const pp = suave(rampa(t, tPresu, 0.5));
    ctx.presu.setAttribute('opacity', pp.toFixed(3)); ctx.presuT.setAttribute('opacity', pp.toFixed(3));
    ctx.hueco.setAttribute('opacity', suave(rampa(t, tHueco, 0.6)).toFixed(3));
    // c3: el presupuesto mínimo en α = 0.05.
    ctx.marca.setAttribute('opacity', suave(rampa(t, c3.a, 0.3)).toFixed(3));
    ctx.bmin.setAttribute('opacity', suave(rampa(t, c3.a + 0.2, 0.6)).toFixed(3));
    // c4: el cursor recorre la frontera; el hueco nunca se cierra.
    const pc = C.eIO(rampa(t, ctx.palabra(4, 'cincuenta') - 0.2, 3.0)), a = lerp(FR[0][0], FR[FR.length - 1][0], pc);
    let k = 0;
    while (k < FR.length - 2 && FR[k + 1][0] < a) k++;
    const b = lerp(FR[k][1], FR[k + 1][1], clamp((a - FR[k][0]) / (FR[k + 1][0] - FR[k][0])));
    ctx.cursor.setAttribute('opacity', (rampa(t, c4.a, 0.4) * (1 - rampa(t, c5.a, 0.5))).toFixed(3));
    ctx.cursorP.setAttribute('cx', X(a).toFixed(1)); ctx.cursorP.setAttribute('cy', Y(b).toFixed(1));
    ctx.cursorL.setAttribute('d', `M${X(a).toFixed(1)} ${(Y(b) + 10).toFixed(1)}V${Y(T.presupuesto).toFixed(1)}`);
    ctx.riesgo.setAttribute('opacity', suave(rampa(t, ctx.palabra(4, 'ahorra'), 0.5)).toFixed(3));
    // c5: la curva exacta encima, la lupa y la terminal.
    ctx.exacta.setAttribute('opacity', suave(rampa(t, c5.a, 0.6)).toFixed(3));
    ctx.lupa.setAttribute('opacity', suave(rampa(t, ctx.palabra(5, 'difiere'), 0.5)).toFixed(3));
    aparecer(ctx.terminal, suave(rampa(t, c5.a, 0.6)));
    const tCmd = c5.a + 0.5, cmd = DV.terminal.comando, nc = Math.floor(clamp((t - tCmd) * 30 / cmd.length) * cmd.length);
    ctx.cmd.textContent = '$ ' + cmd.slice(0, nc) + (t >= tCmd && nc < cmd.length ? '▌' : '');
    const tSal = tCmd + cmd.length / 30 + 0.4;
    ctx.lineas.forEach((e, i) => opacidad(e, t >= tSal + i * 0.12 ? 1 : 0));
    const fila = ctx.lineas.find(e => e.classList.contains('e7-fila-05'));
    if (fila) fila.style.setProperty('--resalte', suave(rampa(t, tSal + ctx.lineas.length * 0.12 + 0.3, 0.5)).toFixed(3));
    // c6: todo baja al 60 % menos el hueco; el faltante para los 30 polígonos.
    const baja = 1 - 0.4 * suave(rampa(t, c6.a, 0.6));
    for (const e of [ctx.ejes, ctx.curva, ctx.exacta, ctx.presu, ctx.presuT, ctx.bmin, ctx.lupa, ctx.marca, ...ctx.puntos]) e.style.opacity = baja < 1 ? baja.toFixed(3) : '';
    opacidad(ctx.terminal, suave(rampa(t, c5.a, 0.6)) * baja);
    aparecer(ctx.faltante, suave(rampa(t, c6.a + 0.2, 0.6)), 6);
  },
});

const css = document.createElement('style');
css.textContent = `
.e7-panel { left: 80px; top: 150px; width: 640px; padding: 30px 34px 32px; background: var(--papel);
  border: 1px solid rgba(76,69,65,.22); box-shadow: 0 6px 24px rgba(76,69,65,.10); }
.e7-num { font: 120px/1 var(--display); color: var(--tinta); }
.e7-rot { font: 23px/1.35 var(--ui); color: var(--tierra); margin-top: 10px; }
.e7-bloque { margin-top: 44px; }
.e7-rot2 { font: 500 19px var(--ui); color: var(--tierra-suave); margin-bottom: 30px; }
.e7-barra { position: relative; height: 34px; }
.e7-b { position: absolute; top: 0; height: 34px; border: 1px solid var(--tierra-suave); transform-origin: 0 50%; transform: scaleX(0); }
.e7-compra { left: 0; background: var(--salvia-honda); }
.e7-exist { background: var(--papel-hondo); }
.e7-meta { position: absolute; top: -12px; height: 58px; border-left: 2px solid var(--tinta); }
.e7-meta-t { position: absolute; left: -2px; top: -26px; transform: translateX(-50%); white-space: nowrap; font: 600 18px var(--ui); color: var(--tinta); }
.e7-btexto { font: 22px/1.4 var(--ui); color: var(--tierra); margin-top: 22px; }
.e7-btexto b { font-weight: 600; color: var(--tinta); }
.e7-bnota { font: italic 23px/1.4 var(--texto); color: var(--tierra-suave); margin-top: 6px; }
.e7-terminal { left: 64px; top: 150px; width: 680px; background: var(--papel-hondo); border: 1px solid rgba(76,69,65,.28);
  box-shadow: 0 12px 40px rgba(76,69,65,.18); border-radius: 6px; overflow: hidden; }
.e7-term-barra { font: 500 16px var(--ui); color: var(--tierra-suave); padding: 8px 16px; border-bottom: 1px solid rgba(76,69,65,.2);
  background: rgba(252,240,218,.6); }
.e7-term-cuerpo { margin: 0; padding: 16px 18px 20px; font: 16.5px/1.55 Menlo, 'SF Mono', monospace; color: var(--tinta);
  white-space: pre; min-height: 380px; }
.e7-cmd { display: block; font-weight: 700; margin-bottom: 4px; }
.e7-linea { display: block; }
.e7-fila-05 { outline: 2px solid rgba(140,100,24,var(--resalte,0)); outline-offset: 2px; border-radius: 2px; }
.e7-titulo { position: absolute; left: 56px; top: 40px; font: 44px/1.1 var(--display); color: var(--tinta); }
.e7-subt { position: absolute; left: 58px; top: 96px; font: italic 25px var(--texto); color: var(--tierra-suave); }
.e7-faltante { position: absolute; font: italic 32px var(--texto); color: var(--tinta); white-space: nowrap; }
`;
document.head.appendChild(css);
})();
