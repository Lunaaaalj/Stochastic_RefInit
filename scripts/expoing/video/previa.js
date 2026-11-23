/* Controles de la previsualización (solo cuando la página se abre sin ?render).
 *
 * Barra de arrastre, reproducción con la música provisional y saltos por escena.
 * Es lo único que usa el reloj: el escenario se sigue pidiendo con tick(t), así
 * que lo que se ve aquí es exactamente lo que renderiza renderizar.py.
 *
 * Teclas: espacio reproduce o pausa; ← y → avanzan un cuadro (con mayúsculas, 1 s);
 * 1 a 9 y 0 saltan a E1…E10; Inicio vuelve a 0.
 */
(() => {
'use strict';
window.REFOR_PREVIA = video => {
  const { duracion, fps, escenas, musica } = video;
  const marco = document.getElementById('marco'), esc = document.getElementById('escenario');
  const barra = document.createElement('div'); barra.id = 'controles';
  barra.innerHTML = `
    <div class="fila">
      <button id="reproducir" title="Espacio">▶ Reproducir</button>
      <span class="tiempo" id="tiempo"></span>
      <input type="range" id="barra" min="0" max="${duracion}" step="${1 / fps}" value="0">
    </div>
    <div class="fila" id="saltos"></div>
    <div class="fila">
      <label><input type="checkbox" id="conMusica" checked> música provisional</label>
      <label><input type="checkbox" id="conSubs" checked> subtítulos</label>
      <span class="ayuda">Espacio: reproducir · ←/→: un cuadro (⇧: 1 s) · 1–9, 0: escena · las escenas atenuadas están pendientes</span>
    </div>`;
  document.body.appendChild(barra);
  const $ = id => document.getElementById(id);
  const audio = new Audio('../../../' + musica.archivo);
  audio.preload = 'auto';

  let t = 0, tocando = false, t0 = 0, reloj0 = 0;
  const reloj = () => performance.now() / 1000;
  const fmtT = s => { const m = Math.floor(s / 60), r = s - 60 * m; return `${m}:${r.toFixed(2).padStart(5, '0')}`; };
  const escenaEn = s => escenas.find(e => s >= e.inicio && s < e.fin) || escenas[escenas.length - 1];

  function ajustar() {
    const alto = innerHeight - barra.offsetHeight, k = Math.min(innerWidth / 1920, alto / 1080);
    esc.style.transform = `scale(${k})`;
    marco.style.width = 1920 * k + 'px'; marco.style.height = 1080 * k + 'px';
  }
  function mostrar(s) {
    t = Math.min(duracion, Math.max(0, s));
    video.tick(t);
    $('barra').value = t;
    const e = escenaEn(t);
    $('tiempo').textContent = `${fmtT(t)} · ${e.id}`;
    for (const b of $('saltos').children) b.classList.toggle('activa', b.dataset.id === e.id);
  }
  function sincronizarAudio() {
    if (!tocando || !$('conMusica').checked) { audio.pause(); return; }
    const objetivo = musica.desde + t;
    if (Math.abs(audio.currentTime - objetivo) > 0.08) audio.currentTime = objetivo;
    audio.play().catch(() => {});
  }
  function reproducir(si) {
    tocando = si;
    if (tocando && t >= duracion - 1e-3) t = 0;
    t0 = t; reloj0 = reloj();
    $('reproducir').textContent = tocando ? '❚❚ Pausa' : '▶ Reproducir';
    sincronizarAudio();
  }
  function cuadro() {
    if (tocando) {
      // Con música, el reloj es el audio; sin ella, el reloj del navegador.
      const s = $('conMusica').checked && !audio.paused ? audio.currentTime - musica.desde : t0 + (reloj() - reloj0);
      mostrar(s);
      if (t >= duracion) reproducir(false);
    }
    requestAnimationFrame(cuadro);
  }

  for (const e of escenas) {
    const b = document.createElement('button');
    b.textContent = e.id; b.dataset.id = e.id; b.title = `${fmtT(e.inicio)}–${fmtT(e.fin)}`;
    if (!e.hecha) b.classList.add('vacia');
    b.onclick = () => { mostrar(e.inicio); reproducir(tocando); };
    $('saltos').appendChild(b);
  }
  $('reproducir').onclick = () => reproducir(!tocando);
  $('barra').oninput = ev => { mostrar(+ev.target.value); reproducir(tocando); };
  $('conMusica').onchange = () => reproducir(tocando);
  $('conSubs').onchange = ev => { document.getElementById('subtitulos').style.visibility = ev.target.checked ? '' : 'hidden'; };
  addEventListener('keydown', ev => {
    if (ev.target.tagName === 'INPUT' && ev.target.type !== 'range') return;
    if (ev.code === 'Space') { ev.preventDefault(); reproducir(!tocando); }
    else if (ev.code === 'ArrowRight' || ev.code === 'ArrowLeft') {
      ev.preventDefault();
      const d = (ev.shiftKey ? 1 : 1 / fps) * (ev.code === 'ArrowRight' ? 1 : -1);
      mostrar(t + d); reproducir(tocando);
    } else if (ev.code === 'Home') { mostrar(0); reproducir(tocando); }
    else if (/^Digit\d$/.test(ev.code)) {
      const n = +ev.code.slice(5), e = escenas[n === 0 ? 9 : n - 1];
      if (e) { mostrar(e.inicio); reproducir(tocando); }
    }
  });
  addEventListener('resize', ajustar);
  // Permite enlazar a un instante: previsualizar.html#t=95.5
  const m = /t=([\d.]+)/.exec(location.hash);
  ajustar(); mostrar(m ? +m[1] : 0);
  requestAnimationFrame(cuadro);
};
})();
