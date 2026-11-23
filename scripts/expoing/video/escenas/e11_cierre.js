/* E11 · Impacto y cierre: la toma aérea inversa (PLAN §5, E11).
 *
 * Un solo movimiento continuo de ≈ 17 s: la cámara sube del mosaico de papel del
 * polígono 1 al sitio, donde los 30 polígonos se plantan (puntos por especie, la clave
 * de cada uno) en una onda desde el centro, y luego a la región con sus curvas de
 * nivel. Tres frases de impacto, una a la vez, sobre un cuadro de papel. Al final, la
 * tarjeta con el equipo y los créditos, y un fundido a tinta.
 */
/* global DATOS */
(() => {
'use strict';
const V = window.REFOR_VIDEO, K = window.CARTA, C = window.EXPO_COMUN, D = DATOS, DV = window.DATOS_VIDEO;
const { rampa, suave, camara, aparecer, opacidad, html } = V;

const CAM_REGION_FIN = K.mostrar(K.CENTRO_SITIO, [1080, 520], 0.2);
const R_MAX = Math.max(...K.PROGRAMA.flatMap(p => p.v.map(v => Math.hypot(v[0] - K.CENTRO_SITIO[0], v[1] - K.CENTRO_SITIO[1])))) + 30;
const FRASES = ['decisiones con respaldo probabilístico', 'dinero público y plantas que sobreviven', 'un método abierto y replicable'];
const INTEGRANTES = ['Angel Eduardo Luna', 'Irasema Álvarez', 'Carolina Sánchez Meneses', 'Andrea Estefanía de la Peña'];

V.escena({
  id: 'E11', entrada: 0, cola: 0,

  construir(ctx) {
    const r = ctx.raiz;
    const caja = html('div', 'abs e11-caja', r);
    ctx.frases = FRASES.map(f => html('div', 'e11-frase', caja, f));
    ctx.caja = caja;
    // Tarjeta final, sobre papel opaco.
    const tf = html('div', 'abs e11-tarjeta', r);
    const lg = C.el('svg', { class: 'e11-logo', viewBox: '0 0 640 240', width: 320, height: 120 }, tf);
    C.marcaBrote(C.el('g', { transform: 'translate(120 120) scale(1.12)' }, lg));
    const f = { 'font-family': 'Libre Caslon Text', 'font-size': 50 };
    C.tx(lg, 250, 100, 'Stochastic', Object.assign({ fill: C.TINTA, 'font-weight': 700 }, f));
    C.tx(lg, 250, 156, 'Reforestation', Object.assign({ fill: C.TINTA }, f));
    C.tx(lg, 250, 212, 'Initiative', Object.assign({ fill: C.SALVIA_H, 'font-style': 'italic' }, f));
    html('div', 'e11-titulo', tf, 'Compra bajo incertidumbre<br>y distribución espacial de especies');
    html('div', 'e11-equipo', tf, INTEGRANTES.join(' · '));
    html('div', 'e11-curso', tf, 'Optimización Estocástica · Tec de Monterrey');
    html('div', 'e11-socio', tf, 'En colaboración con el socioformador · Datos: INECOL');
    html('div', 'e11-musica', tf, DV.musica.atribucion);
    html('div', 'e11-licencia', tf, DV.musica.licencia_video);
    ctx.tarjeta = tf;
    ctx.tinta = html('div', 'abs e11-tinta', r);
  },

  tick(t, ctx) {
    const ca = ctx.carta.estado, c1 = ctx.cue(1), c2 = ctx.cue(2), c3 = ctx.cue(3), c4 = ctx.cue(4);
    // La toma aérea: escala en logaritmos de 14 px/m a 0.2 px/m, sin detenerse.
    const pv = camara(rampa(t, 0.3, c4.b - 0.3));
    ca.camara = K.viaje(V.compartido.cierre.CAM_MOS, CAM_REGION_FIN, K.OBJETIVO, pv);
    ca.atenuar = 0;
    ca.siembra = { alfa: 1, onda: R_MAX * C.eIO(rampa(t, 6.5, 6.5)), centro: K.CENTRO_SITIO, modo: 'especie', fijos: [K.P1.i] };
    ca.curvas.brillo = 1.15;
    // Frases de impacto, una a la vez.
    const ts = [c1.a, c2.a, c3.a, c4.a];
    opacidad(ctx.caja, suave(rampa(t, c1.a - 0.2, 0.5)) * (1 - suave(rampa(t, c4.a, 0.6))));
    ctx.frases.forEach((e, i) => aparecer(e, suave(rampa(t, ts[i], 0.6)) * (1 - suave(rampa(t, ts[i + 1] - 0.35, 0.35))), 6));
    // Tarjeta final y fundido a tinta en el último segundo.
    aparecer(ctx.tarjeta, suave(rampa(t, c4.b - 0.1, 0.8)), 10);
    opacidad(ctx.tinta, C.eIO(rampa(t, ctx.dur - 1, 1)));
  },
});

const css = document.createElement('style');
css.textContent = `
.e11-caja { left: 96px; top: 72px; padding: 18px 30px 22px; background: var(--papel); border: 1px solid rgba(76,69,65,.22);
  box-shadow: 0 6px 24px rgba(76,69,65,.10); min-width: 980px; height: 104px; }
.e11-frase { position: absolute; left: 30px; top: 22px; font: 52px/1.1 var(--display); color: var(--tinta); white-space: nowrap; }
.e11-tarjeta { left: 0; top: 0; width: 1920px; height: 1080px; background: var(--papel); text-align: center; }
.e11-logo { position: absolute; left: 800px; top: 104px; }
.e11-titulo { position: absolute; left: 0; right: 0; top: 268px; font: 700 54px/1.15 var(--bodoni); color: var(--salvia-oscura); }
.e11-equipo { position: absolute; left: 0; right: 0; top: 444px; font: 30px var(--texto); color: var(--tinta); }
.e11-curso { position: absolute; left: 0; right: 0; top: 508px; font: 24px var(--ui); color: var(--tierra); }
.e11-socio { position: absolute; left: 0; right: 0; top: 552px; font: 21px var(--ui); color: var(--tierra-suave); }
.e11-musica { position: absolute; left: 360px; right: 360px; top: 742px; font: 17px/1.5 var(--ui); color: var(--tierra-suave);
  padding-top: 22px; border-top: 1px solid rgba(76,69,65,.18); }
.e11-licencia { position: absolute; left: 0; right: 0; top: 820px; font: 500 17px var(--ui); color: var(--tierra-suave); }
.e11-tinta { left: 0; top: 0; width: 1920px; height: 1080px; background: var(--tinta); opacity: 0; }
`;
document.head.appendChild(css);
})();
