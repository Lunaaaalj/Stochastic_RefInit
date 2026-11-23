/* E6 · Pregunta 1: el modelo de compra (PLAN §5, E6).
 *
 * Una hoja de método trae el modelo del reporte (reports/final/secciones/
 * modelo-compra.tex), completo, en fantasma; cada término se enciende cuando la voz
 * lo explica, con su anotación en lenguaje llano a la derecha. Con la restricción de
 * probabilidad, la miniatura del histograma de E5 vuela y se posa junto a ella.
 */
/* global DATOS */
(() => {
'use strict';
const V = window.REFOR_VIDEO, C = window.EXPO_COMUN, D = DATOS;
const { rampa, suave, camara, aparecer, opacidad, html, lerp, clamp } = V;

const HOJA = { x: 96, y: 84, w: 1728, h: 780 };
const TEX = String.raw`\begin{aligned}
\min_{n,\,x}\;\; & \htmlClass{t-coef}{(1+\theta)}\sum_{s}c_s\Bigl(\htmlClass{t-compra}{x_{is}}+\htmlClass{t-repo}{\mathbb{E}[D_{is}]}\Bigr)\\[4pt]
\text{s.a.}\;\; & \htmlClass{t-total}{\textstyle\sum_{s} n_{is}=N_i}\\
& \htmlClass{t-banda}{|n_{is}-n_s^0A_i|\le\delta\,n_s^0A_i}\\
& \htmlClass{t-presu}{(1+\theta)\textstyle\sum_{s}c_s x_{is}\le B\,A_i}\\
& \htmlClass{t-prob}{\mathbb{P}\bigl(E_{is}+S_{is}(x_{is})\ge n_{is}\bigr)\ge 1-\alpha}
\end{aligned}`;
const P1 = D.compra_p1, T = D.totales;
const ANOTA = {
  compra: 'lo que se compra',
  repo: 'lo que se espera reponer',
  total: `la meta total: ${C.fmt(T.meta_ha)} por hectárea`,
  banda: `±${C.fmt(P1.delta * 100)} % por especie respecto al plan`,
  presu: `el presupuesto: $${C.fmt(T.presupuesto)} por hectárea`,
  prob: `cada especie cumple su meta en al menos ${C.fmt((1 - T.alfa) * 100)} % de los escenarios`,
};

V.escena({
  id: 'E6', entrada: 0, cola: 0.8,

  construir(ctx) {
    const r = ctx.raiz, h = V.hoja(r, HOJA.x, HOJA.y, HOJA.w, HOJA.h, 'e6-hoja');
    ctx.hoja = h;
    ctx.para = html('div', 'anotacion e6-para', h, 'para cada polígono <i>i</i> y cada especie <i>s</i>');
    const f = V.formula(h, TEX, 'e6-formula');
    ctx.f = f;
    // Anotaciones: las del objetivo, encima de su término; las de las reglas, a la derecha.
    const guias = C.el('svg', { class: 'abs', width: HOJA.w, height: HOJA.h, viewBox: `0 0 ${HOJA.w} ${HOJA.h}` }, h);
    guias.style.left = '0'; guias.style.top = '0';
    const m = n => V.medir(f.terminos[n][0], h);
    const derecha = Math.max(...['total', 'banda', 'presu', 'prob'].map(n => { const q = m(n); return q.x + q.w; }), m('repo').x + m('repo').w) + 150;
    ctx.anota = {};
    for (const n of Object.keys(ANOTA)) {
      const q = m(n), e = html('div', 'anotacion', h, ANOTA[n]);
      let linea;
      if (n === 'compra' || n === 'repo') {
        // Los dos términos del objetivo quedan cerca: una anotación sale a la izquierda y la
        // otra a la derecha, cada una con su guía en codo.
        const cx = q.x + q.w / 2, izq = n === 'compra', y = q.y - 78;
        Object.assign(e.style, { top: y + 'px', whiteSpace: 'nowrap' });
        if (izq) { e.style.right = (HOJA.w - (cx - 24)) + 'px'; } else e.style.left = (cx + 24) + 'px';
        linea = C.el('path', { d: `M${cx + (izq ? -18 : 18)} ${y + 18}H${cx}V${q.y - 6}`, class: 'guia' }, guias);
      } else {
        const cy = q.y + q.h / 2;
        Object.assign(e.style, { left: derecha + 'px', top: (cy - 18) + 'px', width: (HOJA.w - derecha - 50) + 'px' });
        linea = C.el('path', { d: `M${q.x + q.w + 14} ${cy}H${derecha - 14}`, class: 'guia' }, guias);
      }
      ctx.anota[n] = { e, linea, q };
    }
    // La restricción de probabilidad, sobre papel hondo cuando se enciende.
    ctx.prob = f.terminos.prob[0];
    const qp = m('prob');
    ctx.destinoMini = { x: HOJA.x + qp.x, y: HOJA.y + qp.y + qp.h + 34, w: 250, h: 104 };
    ctx.mini = html('div', 'abs e6-mini', r);
    V.compartido.temporadas.miniatura(ctx.mini, 250, 104);
    ctx.nuevo = html('div', 'e6-nuevo', h, 'lo nuevo: comprar con garantía');
    Object.assign(ctx.nuevo.style, { left: (qp.x + 290) + 'px', top: (qp.y + qp.h + 66) + 'px' });
    ctx.rotulo = html('div', 'rotulo-tecnico e6-rotulo', h, 'Restricción probabilística · Mochila de elección múltiple<br>(programación dinámica + HiGHS)');
  },

  tick(t, ctx) {
    const ca = ctx.carta.estado, c1 = ctx.cue(1), c2 = ctx.cue(2), c4 = ctx.cue(4), c5 = ctx.cue(5);
    if (t <= ctx.dur) { ca.camara = V.compartido.temporadas.CAM_E5; ca.atenuar = 0.9; }
    // La hoja entra desde abajo (36 px, sin tocar la franja) y se retira hacia arriba en E7.
    V.hojaVaiven(ctx.hoja, t, 0, ctx.dur, { dy: 36, d: 0.8 });
    opacidad(ctx.para, suave(rampa(t, c1.a, 0.6)));
    // Términos al ritmo de la voz; el anterior pasa a leído cuando se enciende el siguiente.
    const tCompra = ctx.palabra(2, 'comprar'), tRepo = ctx.palabra(2, 'espera');
    const tTotal = ctx.palabra(3, 'meta'), tBanda = ctx.palabra(3, 'margen'), tPresu = ctx.palabra(3, 'presupuesto');
    const tProb = c4.a;
    const T = ctx.f.terminos;
    // El esqueleto (min, s.a., sumas) pasa de fantasma a tierra cuando empieza a hablar del modelo.
    ctx.f.e.style.color = C.mix(C.mix(C.PAPEL, C.TIERRA, 0.3), C.TIERRA, suave(rampa(t, c2.a, 0.8)));
    V.encender(T.coef, t, tCompra, tRepo);
    V.encender(T.compra, t, tCompra, tTotal);
    V.encender(T.repo, t, tRepo, tTotal);
    V.encender(T.total, t, tTotal, tBanda);
    V.encender(T.banda, t, tBanda, tPresu);
    V.encender(T.presu, t, tPresu, tProb);
    V.encender(T.prob, t, tProb);
    const fondo = suave(rampa(t, tProb, 0.4));
    ctx.prob.style.background = fondo > 0 ? `rgba(243,226,194,${fondo.toFixed(3)})` : '';
    // Cada anotación con su término; al final se apagan un poco las que no son la nueva.
    const final = suave(rampa(t, c5.a, 0.6));
    const ver = { compra: tCompra, repo: tRepo, total: tTotal, banda: tBanda, presu: tPresu, prob: tProb };
    for (const [n, a] of Object.entries(ctx.anota)) {
      const p = suave(rampa(t, ver[n] + 0.1, 0.5)) * (n === 'prob' ? 1 : 1 - 0.55 * final);
      aparecer(a.e, p, 4);
      a.linea.setAttribute('opacity', p.toFixed(3));
    }
    ctx.anota.prob.e.style.color = C.mix(C.TS, C.OCRE_H, suave(rampa(t, tProb, 0.4)));
    // «Lo nuevo»: la restricción crece al 112 % y su anotación se recorre lo que crece.
    const k = lerp(1, 1.12, final), crece = (k - 1) * ctx.anota.prob.q.w;
    ctx.prob.style.transform = final > 0 ? `scale(${k.toFixed(4)})` : '';
    ctx.anota.prob.e.style.marginLeft = crece > 0.01 ? V.px(crece) : '';
    ctx.anota.prob.linea.style.transform = crece > 0.01 ? `translateX(${V.px(crece)}) scaleX(1)` : '';
    // Corte por continuidad: la miniatura del histograma de E5 vuela hasta junto a la restricción.
    const H = V.compartido.temporadas.H, dm = ctx.destinoMini;
    const pv = camara(rampa(t, tProb + 0.5, 1.0));
    // Despega del área de barras de E5 con la proporción de la miniatura (sin bajar de y = 800).
    const kd = H.alto / dm.h, desde = { x: H.x + (H.w - dm.w * kd) / 2, y: H.base - H.alto, w: dm.w * kd, h: H.alto };
    const x = lerp(desde.x, dm.x, pv), y = lerp(desde.y, dm.y, pv) - 60 * Math.sin(Math.PI * pv), s = lerp(desde.w / dm.w, 1, pv);
    const salir = 1 - rampa(t, ctx.dur, 0.5);
    opacidad(ctx.mini, Math.min(1, rampa(t, tProb + 0.5, 0.25)) * salir);
    ctx.mini.style.transform = `translate(${V.px(x)}, ${V.px(y)}) scale(${s.toFixed(4)})`;
    aparecer(ctx.nuevo, final, 6);
    opacidad(ctx.rotulo, suave(rampa(t, tProb + 2.9, 0.6)));
  },
});

const css = document.createElement('style');
css.textContent = `
.e6-para { left: 64px; top: 34px; }
.e6-para i { font-style: italic; }
.e6-formula { position: absolute; left: 150px; top: 176px; font-size: 46px; }
.e6-hoja .anotacion { font-size: 28px; }
.e6-formula .enclosing { display: inline-block; transform-origin: 0 50%; border-radius: 4px; }
.e6-mini { left: 0; top: 0; transform-origin: 0 0; }
.e6-mini svg { display: block; }
.e6-nuevo { position: absolute; font: italic 36px/1.2 var(--texto); color: var(--ocre-hondo); white-space: nowrap; }
.e6-rotulo { right: 44px; bottom: 30px; text-align: right; }
`;
document.head.appendChild(css);
})();
