/* E10 · La herramienta y las pruebas (PLAN §5, E10).
 *
 * Una ventana sobria sobre la carta atenuada reproduce la grabación real de refor_gui
 * (capturar_gui.py, PLAN §8.5): se teclea B, se ejecuta el plan (el cálculo va acelerado y
 * la esquina lo dice, «×N»), aparece la compra, la clave en «Mosaico» y, de vuelta al mapa
 * del cerco, el zoom al polígono 1 hasta ver cada planta. La grabación llega como un JPEG por
 * cuadro; la escena decodifica el que toca según t y lo pinta en un lienzo, y renderizar.py
 * espera esa decodificación antes de capturar (V.esperar). El lienzo, y no un <img> recortado
 * por las esquinas redondeadas de la ventana: Chromium a veces compone el <img> aparte y le
 * aplica la máscara de las esquinas por otro camino, y su suavizado cambiaba según los cuadros
 * anteriores. En el lienzo, las esquinas son parte del dibujo.
 *
 * Al final la cámara baja, detrás de la ventana, al mosaico de papel del polígono 1, y la
 * ventana se cierra hacia el polígono 1 de la GUI, que llega al centro del cuadro justo
 * donde está el de papel (corte por continuidad con E11).
 */
/* global DATOS */
(() => {
'use strict';
const V = window.REFOR_VIDEO, K = window.CARTA, C = window.EXPO_COMUN, G = window.DATOS_VIDEO.gui;
const { rampa, suave, camara, aparecer, opacidad, html, lerp, clamp } = V;

const BARRA = 34;
// La ventana muestra la grabación a un punto de la interfaz por píxel (1280 × 720).
const VENT = { x: 300, y: 104, w: G.puntos[0], h: G.puntos[1] + BARRA };
const RUTA = n => `../../../${G.carpeta}/${String(n).padStart(4, '0')}.jpg`;
const RADIO = 7;   // esquinas de la ventana, por dentro del borde de 1 px
// El polígono 1 de la GUI ya acercado, en coordenadas de la ventana (con su borde de 1 px).
const ANCLA = { x: 1 + G.ancla[0], y: 1 + BARRA + G.ancla[1] };
const RAPIDO = G.tramos.find(tr => tr.velocidad > 1);
// El mosaico de papel del polígono 1: la retícula plantada con su clave, de cerca.
const CAM_MOS = K.mostrar(K.OBJETIVO, [960, 540], 14);
V.compartido.cierre = { CAM_MOS };

// Pinta un cuadro de la grabación con las esquinas de abajo redondeadas (las de arriba las
// tapa la barra de título).
function pintar(g, im) {
  const w = g.canvas.width, h = g.canvas.height;
  g.clearRect(0, 0, w, h);
  g.save();
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(w, 0);
  g.lineTo(w, h - RADIO);
  g.arcTo(w, h, w - RADIO, h, RADIO);
  g.lineTo(RADIO, h);
  g.arcTo(0, h, 0, h - RADIO, RADIO);
  g.closePath();
  g.clip();
  g.drawImage(im, 0, 0, w, h);
  g.restore();
}

V.escena({
  id: 'E10', entrada: 0, cola: 0.9,

  construir(ctx) {
    const r = ctx.raiz;
    ctx.rotulo = html('div', 'abs e10-rotulo', r, 'refor_gui · grabación real');
    const v = html('div', 'abs e10-ventana', r);
    // El tamaño incluye el borde de 1 px (box-sizing: border-box): adentro caben 1280 × 720.
    Object.assign(v.style, { left: VENT.x + 'px', top: VENT.y + 'px', width: VENT.w + 2 + 'px', height: VENT.h + 2 + 'px' });
    html('div', 'e10-barra', v, 'refor_gui');
    const marco = html('div', 'e10-marco', v);
    const lienzo = html('canvas', 'e10-lienzo', marco);
    lienzo.width = VENT.w;
    lienzo.height = VENT.h - BARRA;
    ctx.g = lienzo.getContext('2d');
    ctx.cuadro = -1;
    ctx.rapido = html('div', 'e10-rapido', marco, `×${G.acelerado}`);
    ctx.ventana = v;
    const so = html('div', 'abs e10-so', r);
    ctx.so = ['Windows', 'macOS', 'Linux'].map(n => html('div', 'e10-so-n', so, n));
    ctx.semilla = html('div', 'e10-semilla', so, 'misma semilla →<br>mismos resultados');
  },

  tick(t, ctx) {
    const ca = ctx.carta.estado, c1 = ctx.cue(1), c2 = ctx.cue(2), cl = V.compartido.claves;
    const tBaja = c2.b - 0.2, pb = camara(rampa(t, tBaja, ctx.dur - tBaja));
    if (t <= ctx.dur) {
      // La carta de E9 (cada polígono con el tono de su clave), atenuada; al final baja al polígono 1.
      ca.camara = K.viaje(cl.CAM_E9, CAM_MOS, K.OBJETIVO, pb);
      ca.atenuar = 0.55 * suave(rampa(t, 0, 0.8)) * (1 - suave(rampa(t, tBaja, 1.4)));
      ca.poligonos.color = K.POLS.map(p => p.programa ? C.mix(C.PAPEL_H, cl.TONO(p.clave), 1 - suave(rampa(t, tBaja, 1.2))) : C.PAPEL_H);
      ca.siembra = { alfa: suave(rampa(t, tBaja + 0.4, 1.0)), onda: 0, centro: K.CENTRO_SITIO, modo: 'especie', fijos: [K.P1.i] };
    }
    // La grabación: el cuadro que toca; antes de empezar, el primero, y al terminar, el último.
    const tc = t - G.inicio_en_e10;
    const n = clamp(Math.floor(tc * G.fps + 1e-6), 0, G.cuadros - 1);
    if (n !== ctx.cuadro) {
      ctx.cuadro = n;
      const im = new Image();
      im.src = RUTA(n);
      // En la previsualización pueden llegar desordenadas: solo se pinta la que sigue tocando.
      V.esperar(im.decode().then(() => { if (ctx.cuadro === n) pintar(ctx.g, im); }).catch(() => {}));
    }
    // «×N» mientras el cálculo va acelerado.
    opacidad(ctx.rapido, Math.min(rampa(tc, RAPIDO.desde, 0.15), 1 - rampa(tc, RAPIDO.hasta - 0.15, 0.15)));
    // La ventana entra y, al pasar a E11, se cierra hacia el polígono 1 de la GUI, que viaja al
    // centro del cuadro (donde la cámara dejó el de papel).
    const pe = suave(rampa(t, 0.1, 0.8)), pc = camara(rampa(t, ctx.dur, 0.8));
    const k = lerp(0.96, 1, pe) * lerp(1, 0.08, pc);
    const dx = (960 - VENT.x - ANCLA.x) * pc, dy = (540 - VENT.y - ANCLA.y) * pc;
    opacidad(ctx.ventana, Math.min(pe, 1 - rampa(t, ctx.dur + 0.35, 0.45)));
    ctx.ventana.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${k.toFixed(4)})`;
    aparecer(ctx.rotulo, suave(rampa(t, c1.a, 0.6)) * (1 - rampa(t, ctx.dur - 0.4, 0.4)));
    ['Windows', 'macOS', 'Linux'].forEach((n, i) => aparecer(ctx.so[i], suave(rampa(t, ctx.palabra(2, n) - 0.1, 0.4)) * (1 - rampa(t, ctx.dur - 0.4, 0.4))));
    aparecer(ctx.semilla, suave(rampa(t, ctx.palabra(2, 'Linux') + 0.5, 0.6)) * (1 - rampa(t, ctx.dur - 0.4, 0.4)));
  },
});

const css = document.createElement('style');
css.textContent = `
.e10-rotulo { left: ${VENT.x}px; top: ${VENT.y - 42}px; font: 500 22px var(--ui); color: var(--tierra-suave); }
.e10-ventana { border: 1px solid rgba(76,69,65,.3); border-radius: ${RADIO + 1}px;
  box-shadow: 0 12px 40px rgba(76,69,65,.18); transform-origin: ${ANCLA.x}px ${ANCLA.y}px; }
.e10-barra { height: ${BARRA}px; background: var(--papel-hondo); border-bottom: 1px solid rgba(76,69,65,.2);
  border-radius: ${RADIO}px ${RADIO}px 0 0; font: 500 15px/${BARRA - 1}px var(--ui); color: var(--tierra-suave); text-align: center; }
.e10-marco { position: absolute; left: 0; top: ${BARRA}px; width: ${VENT.w}px; height: ${VENT.h - BARRA}px; }
.e10-lienzo { width: ${VENT.w}px; height: ${VENT.h - BARRA}px; display: block; }
.e10-rapido { position: absolute; right: 18px; bottom: 44px; padding: 4px 14px; border-radius: 8px;
  background: rgba(252,240,218,.95); font: 600 30px var(--ui); color: var(--tinta); }
.e10-so { left: ${VENT.x + VENT.w + 34}px; top: 300px; width: ${1824 - VENT.x - VENT.w - 34}px; }
.e10-so-n { font: 32px/1.45 var(--texto); color: var(--tinta); }
.e10-semilla { font: italic 22px/1.35 var(--texto); color: var(--tierra-suave); margin-top: 18px; }
`;
document.head.appendChild(css);
})();
