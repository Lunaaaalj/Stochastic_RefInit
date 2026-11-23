/* Teleprompter del video guía (PLAN §8.4). Solo se activa con ?guia=E3.
 *
 * Andrea graba cada escena viendo su video guía: la animación real, sin subtítulos, con
 * una banda arriba que muestra el texto hablado (no el subtítulo con cifras). La frase
 * actual va resaltada palabra por palabra, al ritmo con que el guion la reparte; la
 * siguiente, en gris; debajo, la barra de progreso de la frase. Antes de la primera
 * frase hay una cuenta regresiva de 3 s. Es una función pura del tiempo, como el resto.
 */
(() => {
'use strict';
const id = new URLSearchParams(location.search).get('guia');
if (!id) return;
const V = window.REFOR_VIDEO, DV = window.DATOS_VIDEO;
const ESCENAS = DV.linea.escenas, n = ESCENAS.findIndex(e => e.id === id);
if (n < 0) throw new Error(`No existe la escena ${id}`);
const ESC = ESCENAS[n], CUES = ESC.cues, C0 = CUES[0].inicio, FIN = CUES[CUES.length - 1].fin;

// Palabras de cada frase con el momento en que el guion espera que se digan: el mismo
// reparto por caracteres que usa motor.js para anclar la animación.
const FRASES = CUES.map(c => {
  const palabras = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(c.voz))) palabras.push({ p: m[0], t: c.inicio + (c.fin - c.inicio) * m.index / c.voz.length });
  return { c, palabras };
});

let raiz = null, eMeta, eActual, eBarra, eSig, eCuenta, eNum, frasePintada = -2, spans = [];
function construir() {
  const esc = document.getElementById('escenario');
  raiz = document.createElement('div');
  raiz.id = 'guia';
  raiz.innerHTML = `<div class="g-banda"><div class="g-meta"></div><div class="g-actual"></div>
    <div class="g-barra"><i></i></div><div class="g-sig"></div></div><div class="g-cuenta"><span></span></div>`;
  esc.appendChild(raiz);
  [eMeta, eActual, eBarra, eSig, eCuenta, eNum] = ['.g-meta', '.g-actual', '.g-barra i', '.g-sig', '.g-cuenta', '.g-cuenta span'].map(s => raiz.querySelector(s));
}

function pintarFrase(i) {
  if (i === frasePintada) return;
  frasePintada = i;
  if (i >= FRASES.length) {
    eActual.innerHTML = '<span class="g-fin">Fin de la toma</span>';
    spans = [];
  } else {
    eActual.innerHTML = FRASES[i].palabras.map(w => `<span>${V.escapar(w.p)}</span>`).join(' ');
    spans = [...eActual.children];
  }
  eSig.textContent = i + 1 < FRASES.length ? FRASES[i + 1].c.voz : i + 1 === FRASES.length ? '(última frase de la toma)' : '';
  eMeta.textContent = `Toma ${ESC.id} de ${ESCENAS.length} · ${ESC.titulo}` + (i < FRASES.length ? ` · frase ${i + 1} de ${FRASES.length}` : '');
}

V.alPintar(t => {
  if (!raiz) construir();
  // La frase que toca: la que suena, o la que sigue durante las pausas.
  let i = FRASES.findIndex(f => t < f.c.fin);
  if (i < 0) i = t < FIN + 0.3 ? FRASES.length - 1 : FRASES.length;
  pintarFrase(i);
  if (i < FRASES.length) {
    const f = FRASES[i], dentro = t >= f.c.inicio;
    spans.forEach((s, k) => s.classList.toggle('dicha', dentro && t >= f.palabras[k].t));
    const p = V.clamp((t - f.c.inicio) / (f.c.fin - f.c.inicio));
    eBarra.style.transform = `scaleX(${p.toFixed(4)})`;
    eActual.classList.toggle('espera', !dentro);
  } else eBarra.style.transform = 'scaleX(1)';
  // Cuenta regresiva de 3 s antes de la primera frase.
  const resta = C0 - t;
  if (resta > 0 && resta <= 3) {
    eCuenta.style.display = '';
    const k = Math.ceil(resta), u = k - resta;   // u: de 0 a 1 dentro de cada segundo
    eNum.textContent = String(k);
    eNum.style.transform = `scale(${(1.18 - 0.18 * V.suave(Math.min(1, u * 3))).toFixed(3)})`;
    V.opacidad(eCuenta, Math.min(1, (1 - u) * 6, 1));
  } else eCuenta.style.display = 'none';
});

const css = document.createElement('style');
css.textContent = `
#guia { width: 1920px; height: 1080px; pointer-events: none; z-index: 20; }
#guia .g-banda { position: absolute; left: 0; top: 0; width: 1920px; height: 300px; padding: 26px 96px 0;
  background: rgba(46, 42, 39, .93); color: var(--papel); font-family: var(--ui); }
#guia .g-meta { font: 500 22px var(--ui); color: rgba(252, 240, 218, .6); }
#guia .g-actual { font: 600 48px/1.2 var(--ui); margin-top: 14px; min-height: 116px; color: rgba(252, 240, 218, .5); }
#guia .g-actual .dicha { color: var(--papel); }
#guia .g-actual.espera { color: rgba(252, 240, 218, .5); }
#guia .g-fin { font: italic 40px var(--texto); color: rgba(252, 240, 218, .7); }
#guia .g-barra { height: 6px; margin-top: 14px; background: rgba(252, 240, 218, .18); border-radius: 3px; overflow: hidden; }
#guia .g-barra i { display: block; height: 100%; background: var(--ocre); transform-origin: 0 50%; transform: scaleX(0); }
#guia .g-sig { font: 500 28px/1.3 var(--ui); color: rgba(252, 240, 218, .42); margin-top: 14px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* Debajo de la banda, a la derecha: no tapa los títulos centrados (tarjetas de capítulo). */
#guia .g-cuenta { position: absolute; left: 1604px; top: 324px; width: 220px; height: 220px; border-radius: 50%;
  background: rgba(46, 42, 39, .93); box-shadow: 0 0 0 3px var(--ocre); display: flex; align-items: center; justify-content: center; }
#guia .g-cuenta span { font: 150px/1 var(--display); color: var(--papel); }
`;
document.head.appendChild(css);
})();
