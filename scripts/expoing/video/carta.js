/* La carta: el escenario persistente del video (PLAN §3.5).
 *
 * Un solo mundo en metros locales (x al este, y al sur; los de datos.js, que salen
 * de mapa.csv) dibujado en un <canvas> con una cámara. Capas, de abajo arriba:
 *   fondo (tinta → papel con el amanecer), curvas de nivel (parallax 0.6), polígonos,
 *   retícula al tresbolillo y un velo de papel para atenuar la carta.
 * Cada cuadro, motor.js llama a reiniciar() (estado de reposo), las escenas
 * modifican `estado` y motor.js llama a dibujar(). Nada depende del cuadro anterior.
 *
 * Cámara: { x, y, s } = punto del mundo que cae en el centro del cuadro y escala en
 * píxeles por metro.
 */
/* global DATOS */
(() => {
'use strict';
const C = window.EXPO_COMUN, D = DATOS;
const ANCHO = 1920, ALTO = 1080, CX = ANCHO / 2, CY = ALTO / 2, R3 = Math.sqrt(3);
const { PAPEL, PAPEL_H, TIERRA, TS, TINTA, SALVIA_H, OCRE_H } = C;
const rgba = (hex, a) => `rgba(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',')},${a})`;
const lerp = (a, b, p) => a + (b - a) * p;
const val = (v, i) => typeof v === 'number' ? v : (v[i] ?? 0);

/* ---------- Geometría ---------- */
const caja = pts => {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};
const centroide = v => {
  let a = 0, x = 0, y = 0;
  for (let i = 0; i < v.length; i++) {
    const [x0, y0] = v[i], [x1, y1] = v[(i + 1) % v.length], f = x0 * y1 - x1 * y0;
    a += f; x += (x0 + x1) * f; y += (y0 + y1) * f;
  }
  return [x / (3 * a), y / (3 * a)];
};
const dentro = (x, y, v) => {
  let si = false;
  for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
    const [xi, yi] = v[i], [xj, yj] = v[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) si = !si;
  }
  return si;
};
const POLS = D.mapa.map((m, i) => {
  const v = m.v, lados = v.map((a, k) => Math.hypot(v[(k + 1) % v.length][0] - a[0], v[(k + 1) % v.length][1] - a[1]));
  return { i, e: m.e, p: m.p, v, lados, per: lados.reduce((s, l) => s + l, 0), c: centroide(v), caja: caja(v),
    area: m.area, clave: m.clave, programa: m.p != null };
});
const PROGRAMA = POLS.filter(p => p.programa);
const SITIO = caja(POLS.flatMap(p => p.v));
const CENTRO_SITIO = [(SITIO.x0 + SITIO.x1) / 2, (SITIO.y0 + SITIO.y1) / 2];
const P1 = POLS.find(p => p.p === 1);

/* ---------- Retícula al tresbolillo ---------- */
// Distancia entre vecinas que da la meta por hectárea: d² · √3/2 = 10 000 / meta.
const DIST = Math.sqrt(10000 / (D.totales.meta_ha * R3 / 2));
const RHEX = DIST / R3;               // radio del hexágono de cada planta
const FILA = DIST * R3 / 2;           // separación entre filas
const OBJETIVO = P1.c;                // la planta del gancho: el centro del polígono 1
// Cada posición guarda su fila f y su columna axial a = c − ⌊f/2⌋, las coordenadas del
// mosaico periódico de src/memetico (vecinas (−1,0), (−1,1), (0,−1), (0,1), (1,−1), (1,0)).
const RETICULA = PROGRAMA.map(p => {
  const xs = [], ys = [], fs = [], as = [], b = p.caja;
  for (let f = Math.floor((b.y0 - OBJETIVO[1]) / FILA) - 1; f <= Math.ceil((b.y1 - OBJETIVO[1]) / FILA) + 1; f++) {
    const y = OBJETIVO[1] + f * FILA, off = (((f % 2) + 2) % 2) * 0.5;
    for (let c = Math.floor((b.x0 - OBJETIVO[0]) / DIST) - 1; c <= Math.ceil((b.x1 - OBJETIVO[0]) / DIST) + 1; c++) {
      const x = OBJETIVO[0] + DIST * (c + off);
      if (dentro(x, y, p.v)) { xs.push(x); ys.push(y); fs.push(f); as.push(c - Math.floor(f / 2)); }
    }
  }
  return { pol: p, caja: p.caja, x: Float32Array.from(xs), y: Float32Array.from(ys), f: Int32Array.from(fs), a: Int32Array.from(as) };
});

/* ---------- Siembra: la clave de cada polígono repetida en su retícula ---------- */
// La especie de la posición (f, a) es clave[f mod 4][a mod 13], igual que el mosaico
// periódico. Para la compra (E7) se aclara la retícula al azar con semilla: cada
// posición queda con probabilidad compra_ha / meta_ha, así que los puntos de cada
// polígono son, en promedio, sus plantas compradas.
const ESPECIES_AB = D.especies.map(e => e.ab);
const SIEMBRA = RETICULA.map(R => {
  const m = D.mosaicos.find(x => x.id === R.pol.clave), F = m.clave.length, Cc = m.clave[0].length;
  const n = R.x.length, esp = new Uint8Array(n), u = new Float32Array(n), r = C.mulberry32(7000 + R.pol.p);
  for (let k = 0; k < n; k++) {
    const ab = m.clave[((R.f[k] % F) + F) % F][((R.a[k] % Cc) + Cc) % Cc];
    esp[k] = ESPECIES_AB.indexOf(ab);
    u[k] = r();
  }
  const dato = D.mapa.find(x => x.p === R.pol.p);
  return { R, esp, u, quedan: dato.compra_ha / D.totales.meta_ha };
});

/* ---------- Curvas de nivel ---------- */
// Mismo campo y mismos niveles que fondo-curvas-de-nivel.png (comun.js), en metros:
// K píxeles del fondo por metro. Con K = 0.24 las figuras salen 1.3 veces más grandes
// que en la pieza de fondo, para que las curvas sean contexto y no compitan con los
// polígonos. Se trazan con marching squares en bloques de 32 × 32 celdas para dibujar
// solo los que caen en el cuadro.
const CURVAS = (() => {
  const f = C.campoCurvas(), K = 0.24, O = 3000, paso = 12.5, lado = 32;
  const x0 = SITIO.x0 - 3800, y0 = SITIO.y0 - 2800, x1 = SITIO.x1 + 3300, y1 = SITIO.y1 + 2800;
  const nx = Math.ceil((x1 - x0) / paso) + 1, ny = Math.ceil((y1 - y0) / paso) + 1;
  const v = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) v[j * nx + i] = f((x0 + i * paso + O) * K, (y0 + j * paso + O) * K);
  const bx = Math.ceil((nx - 1) / lado), by = Math.ceil((ny - 1) / lado), bloques = [];
  for (let j = 0; j < by; j++) for (let i = 0; i < bx; i++) {
    bloques.push({ x0: x0 + i * lado * paso, y0: y0 + j * lado * paso, x1: x0 + (i + 1) * lado * paso, y1: y0 + (j + 1) * lado * paso,
      menor: new Path2D(), maestra: new Path2D() });
  }
  for (const { l, maestra } of C.NIVELES) {
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = v[j * nx + i], b = v[j * nx + i + 1], c = v[(j + 1) * nx + i + 1], d = v[(j + 1) * nx + i];
      const sg = C.SEG[(a > l ? 8 : 0) + (b > l ? 4 : 0) + (c > l ? 2 : 0) + (d > l ? 1 : 0)];
      if (!sg) continue;
      const blq = bloques[Math.floor(j / lado) * bx + Math.floor(i / lado)], ruta = maestra ? blq.maestra : blq.menor;
      const X = x0 + i * paso, Y = y0 + j * paso;
      const P = e => e === 'T' ? [X + paso * (l - a) / (b - a), Y] : e === 'R' ? [X + paso, Y + paso * (l - b) / (c - b)]
        : e === 'B' ? [X + paso * (l - d) / (c - d), Y + paso] : [X, Y + paso * (l - a) / (d - a)];
      for (let q = 0; q < sg.length; q += 2) { const p1 = P(sg[q]), p2 = P(sg[q + 1]); ruta.moveTo(p1[0], p1[1]); ruta.lineTo(p2[0], p2[1]); }
    }
  }
  return { bloques };
})();

/* ---------- Cámara ---------- */
const cam = (x, y, s) => ({ x, y, s });
const proyectar = (c, w) => [CX + (w[0] - c.x) * c.s, CY + (w[1] - c.y) * c.s];
// Cámara de escala s que pone el punto del mundo w en el punto de pantalla p.
const mostrar = (w, p, s) => cam(w[0] - (p[0] - CX) / s, w[1] - (p[1] - CY) / s, s);
// De la cámara a a la b siguiendo al punto w: la escala avanza en logaritmos y la
// posición de w en pantalla, en línea recta. Así un acercamiento de 60× se siente parejo.
function viaje(a, b, w, p) {
  if (p <= 0) return a;
  if (p >= 1) return b;
  const pa = proyectar(a, w), pb = proyectar(b, w);
  return mostrar(w, [lerp(pa[0], pb[0], p), lerp(pa[1], pb[1], p)], a.s * Math.pow(b.s / a.s, p));
}
// El sitio completo: 760 px de alto, centrado en (1100, 476), a la derecha de la anotación.
const CAM_SITIO = mostrar([(SITIO.x0 + SITIO.x1) / 2, (SITIO.y0 + SITIO.y1) / 2], [1100, 476], 760 / (SITIO.y1 - SITIO.y0));
// Capa con parallax p respecto de la vista del sitio (p = 1, se mueve con la carta).
const conParallax = (c, p) => cam(lerp(CAM_SITIO.x, c.x, p), lerp(CAM_SITIO.y, c.y, p), CAM_SITIO.s * Math.pow(c.s / CAM_SITIO.s, p));

function crear(lienzo) {
  const g = lienzo.getContext('2d');
  const fuera = document.createElement('canvas'); fuera.width = ANCHO; fuera.height = ALTO;
  const gf = fuera.getContext('2d');
  const estado = {};

  function reiniciar() {
    estado.camara = CAM_SITIO;
    estado.amanecer = 1;                                            // 0 = tinta, 1 = papel
    estado.curvas = { alfa: 1, revelado: 1, centro: [1100, 476] };   // revelado radial desde el centro
    estado.poligonos = { alfa: 1, trazo: 1, relleno: 1, color: PAPEL_H, colorTrazo: TS };
    estado.reticula = { alfa: 0, onda: 0, celdas: 0, objetivo: 0 };
    // Siembra: onda en metros desde `centro`; `fijos`, polígonos (índices) ya plantados.
    // modo 'especie' colorea por la clave; 'compra', un solo tono con la densidad comprada.
    estado.siembra = { alfa: 0, onda: 0, centro: CENTRO_SITIO, modo: 'especie', fijos: null };
    estado.resalte = { i: -1, p: 0 };                               // contorno ocre de un polígono
    estado.atenuar = 0;                                             // velo de papel sobre la carta
  }

  function vistaMundo(c, margen) {
    return { x0: c.x - (CX + margen) / c.s, x1: c.x + (CX + margen) / c.s, y0: c.y - (CY + margen) / c.s, y1: c.y + (CY + margen) / c.s };
  }
  const cruza = (a, b) => a.x1 >= b.x0 && a.x0 <= b.x1 && a.y1 >= b.y0 && a.y0 <= b.y1;

  function dibujarCurvas() {
    const e = estado.curvas;
    if (e.alfa <= 0.001 || e.revelado <= 0) return;
    const c = conParallax(estado.camara, 0.6), parcial = e.revelado < 1;
    const ctx = parcial ? gf : g;
    if (parcial) { gf.setTransform(1, 0, 0, 1, 0, 0); gf.globalCompositeOperation = 'source-over'; gf.clearRect(0, 0, ANCHO, ALTO); }
    ctx.save();
    ctx.globalAlpha = parcial ? 1 : e.alfa;
    ctx.setTransform(c.s, 0, 0, c.s, CX - c.x * c.s, CY - c.y * c.s);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const vista = vistaMundo(c, 20), vis = CURVAS.bloques.filter(b => cruza(b, vista));
    // Trazo de fondo-curvas-de-nivel.png (menores en salvia, maestras en salvia honda),
    // más tenue: aquí las curvas van debajo de los datos.
    // Sobre la tinta del amanecer las curvas necesitan más presencia (brillo > 1).
    const b0 = e.brillo ?? 1;
    ctx.strokeStyle = `rgba(174,172,120,${Math.min(1, .55 * b0).toFixed(3)})`; ctx.lineWidth = 1.2 / c.s;
    for (const b of vis) ctx.stroke(b.menor);
    ctx.strokeStyle = `rgba(111,109,67,${Math.min(1, .4 * b0).toFixed(3)})`; ctx.lineWidth = 2 / c.s;
    for (const b of vis) ctx.stroke(b.maestra);
    ctx.restore();
    if (parcial) {
      const borde = 520, r = e.revelado * (Math.hypot(ANCHO, ALTO) + borde), [x, y] = e.centro;
      const gr = gf.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
      gr.addColorStop(0, 'rgba(0,0,0,1)');
      gr.addColorStop(Math.max(0, 1 - borde / Math.max(r, 1)), 'rgba(0,0,0,1)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      gf.globalCompositeOperation = 'destination-in';
      gf.fillStyle = gr; gf.fillRect(0, 0, ANCHO, ALTO);
      gf.globalCompositeOperation = 'source-over';
      g.save(); g.globalAlpha = e.alfa; g.drawImage(fuera, 0, 0); g.restore();
    }
  }

  // Recorre el contorno hasta la fracción f del perímetro.
  function contorno(ctx, pts, lados, per, f) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    let resta = f * per;
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k], b = pts[(k + 1) % pts.length], l = lados[k];
      if (resta >= l) { ctx.lineTo(b[0], b[1]); resta -= l; continue; }
      const q = resta / l; ctx.lineTo(a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q);
      return;
    }
    ctx.closePath();
  }

  function dibujarPoligonos() {
    const e = estado.poligonos, c = estado.camara;
    if (e.alfa <= 0.001) return;
    g.save();
    g.lineJoin = 'round'; g.lineCap = 'round';
    for (const p of POLS) {
      const pts = p.v.map(w => proyectar(c, w));
      const rel = p.programa ? val(e.relleno, p.i) : 0;
      if (rel > 0.001) {
        g.globalAlpha = e.alfa * Math.min(1, rel);
        g.fillStyle = typeof e.color === 'string' ? e.color : e.color[p.i];
        g.beginPath(); pts.forEach((q, k) => k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.fill();
      }
      const tr = val(e.trazo, p.i);
      if (tr > 0.001) {
        g.globalAlpha = e.alfa;
        g.strokeStyle = e.colorTrazo; g.lineWidth = 1.5;
        g.setLineDash(p.programa ? [] : [6, 5]);
        contorno(g, pts, p.lados, p.per, Math.min(1, tr));
        g.stroke();
      }
    }
    g.restore();
  }

  function dibujarReticula() {
    const e = estado.reticula, c = estado.camara;
    // Aparece sola al acercarse: invisible a menos de 3 px/m, completa desde 9 px/m.
    const z = C.clamp((c.s - 3) / 6), alfa = e.alfa * z * z * (3 - 2 * z);
    if (alfa <= 0.001) return;
    const vista = vistaMundo(c, 80), rh = RHEX * c.s;
    const apagados = new Path2D(), celdas = new Path2D(), encendidos = [];
    const hexEn = (ruta, x, y) => {
      const w = R3 / 2 * rh;
      ruta.moveTo(x, y - rh); ruta.lineTo(x + w, y - rh / 2); ruta.lineTo(x + w, y + rh / 2);
      ruta.lineTo(x, y + rh); ruta.lineTo(x - w, y + rh / 2); ruta.lineTo(x - w, y - rh / 2); ruta.closePath();
    };
    for (const R of RETICULA) {
      if (!cruza(R.caja, vista)) continue;
      for (let k = 0; k < R.x.length; k++) {
        const wx = R.x[k], wy = R.y[k];
        if (wx < vista.x0 || wx > vista.x1 || wy < vista.y0 || wy > vista.y1) continue;
        const sx = CX + (wx - c.x) * c.s, sy = CY + (wy - c.y) * c.s;
        if (e.celdas > 0.001) hexEn(celdas, sx, sy);
        // La onda de encendido avanza desde la planta objetivo (en metros).
        const on = e.onda > 0 ? C.clamp((e.onda - Math.hypot(wx - OBJETIVO[0], wy - OBJETIVO[1])) / 10) : 0;
        if (on <= 0) { apagados.moveTo(sx + 2, sy); apagados.arc(sx, sy, 2, 0, 2 * Math.PI); }
        else encendidos.push([sx, sy, on]);
      }
    }
    g.save();
    if (e.celdas > 0.001) { g.globalAlpha = alfa * e.celdas * 0.32; g.strokeStyle = TS; g.lineWidth = 1; g.stroke(celdas); }
    g.globalAlpha = alfa * 0.6; g.fillStyle = TS; g.fill(apagados);
    for (const [x, y, on] of encendidos) {
      g.globalAlpha = alfa * lerp(0.6, 1, on);
      g.fillStyle = C.mix(TS, SALVIA_H, on);
      g.beginPath(); g.arc(x, y, lerp(2, Math.min(6, Math.max(2.6, 0.09 * rh)), on), 0, 2 * Math.PI); g.fill();
    }
    if (e.objetivo > 0.001) {
      const [x, y] = proyectar(c, OBJETIVO), w = R3 / 2 * rh;
      const pts = [[x, y - rh], [x + w, y - rh / 2], [x + w, y + rh / 2], [x, y + rh], [x - w, y + rh / 2], [x - w, y - rh / 2]];
      g.globalAlpha = alfa; g.strokeStyle = OCRE_H; g.lineWidth = 2.5; g.lineJoin = 'round';
      contorno(g, pts, Array(6).fill(rh), 6 * rh, Math.min(1, e.objetivo));
      g.stroke();
    }
    g.restore();
  }

  // Tres modos según el tamaño en pantalla de la separación entre plantas: hexágonos con
  // su abreviatura (como el mosaico), hexágonos solos, o puntos (la textura del sitio).
  function dibujarSiembra() {
    const e = estado.siembra, c = estado.camara;
    if (e.alfa <= 0.001) return;
    const paso = DIST * c.s, vista = vistaMundo(c, paso + 4), [ox, oy] = e.centro;
    const fijos = e.fijos ? new Set(e.fijos) : null, compra = e.modo === 'compra';
    const hexes = paso >= 12, rotulos = paso >= 30, rh = RHEX * c.s, w = R3 / 2 * rh;
    const lado = Math.max(1, paso * (compra ? 0.55 : 0.72)), medio = lado / 2;
    // Por especie: listas de [x, y, escala] en pantalla.
    const grupos = compra ? [[]] : ESPECIES_AB.map(() => []);
    for (const S of SIEMBRA) {
      const R = S.R, fijo = fijos && fijos.has(R.pol.i);
      if (!cruza(R.caja, vista)) continue;
      if (!fijo && e.onda <= 0) continue;
      for (let k = 0; k < R.x.length; k++) {
        const wx = R.x[k], wy = R.y[k];
        if (wx < vista.x0 || wx > vista.x1 || wy < vista.y0 || wy > vista.y1) continue;
        if (compra && S.u[k] >= S.quedan) continue;
        // Frente de la onda de 25 m: la planta crece de 0 a su tamaño.
        const q = fijo ? 1 : C.clamp((e.onda - Math.hypot(wx - ox, wy - oy)) / 25);
        if (q <= 0) continue;
        grupos[compra ? 0 : S.esp[k]].push(CX + (wx - c.x) * c.s, CY + (wy - c.y) * c.s, q);
      }
    }
    g.save();
    g.globalAlpha = e.alfa;
    g.lineJoin = 'round';
    grupos.forEach((pts, i) => {
      if (!pts.length) return;
      const ab = compra ? null : ESPECIES_AB[i];
      g.fillStyle = compra ? SALVIA_H : C.ESPC[ab][0];
      if (!hexes) {
        for (let k = 0; k < pts.length; k += 3) { const m = medio * pts[k + 2]; g.fillRect(pts[k] - m, pts[k + 1] - m, 2 * m, 2 * m); }
        return;
      }
      const ruta = new Path2D();
      for (let k = 0; k < pts.length; k += 3) {
        const x = pts[k], y = pts[k + 1], s = pts[k + 2], r = rh * s, ww = w * s;
        ruta.moveTo(x, y - r); ruta.lineTo(x + ww, y - r / 2); ruta.lineTo(x + ww, y + r / 2);
        ruta.lineTo(x, y + r); ruta.lineTo(x - ww, y + r / 2); ruta.lineTo(x - ww, y - r / 2); ruta.closePath();
      }
      g.fill(ruta);
      g.strokeStyle = TS; g.lineWidth = Math.min(1.2, 0.04 * rh + 0.5); g.stroke(ruta);
      if (rotulos) {
        g.fillStyle = C.ESPC[ab][1];
        g.font = `500 ${(rh * 0.5).toFixed(1)}px 'Instrument Sans'`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        for (let k = 0; k < pts.length; k += 3) if (pts[k + 2] >= 1) g.fillText(ab, pts[k], pts[k + 1] + rh * 0.04);
      }
    });
    g.restore();
  }

  function dibujarResalte() {
    const e = estado.resalte;
    if (e.i < 0 || e.p <= 0.001) return;
    const p = POLS[e.i], pts = p.v.map(w => proyectar(estado.camara, w));
    g.save(); g.strokeStyle = OCRE_H; g.lineWidth = 2.5; g.lineJoin = 'round'; g.lineCap = 'round';
    contorno(g, pts, p.lados, p.per, Math.min(1, e.p));
    g.stroke(); g.restore();
  }

  function dibujar() {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.setLineDash([]);
    g.fillStyle = C.mix(TINTA, PAPEL, C.clamp(estado.amanecer));
    g.fillRect(0, 0, ANCHO, ALTO);
    dibujarCurvas();
    dibujarPoligonos();
    dibujarSiembra();
    dibujarResalte();
    dibujarReticula();
    if (estado.atenuar > 0.001) { g.globalAlpha = Math.min(1, estado.atenuar); g.fillStyle = PAPEL; g.fillRect(0, 0, ANCHO, ALTO); g.globalAlpha = 1; }
  }

  reiniciar();
  return { estado, reiniciar, dibujar };
}

window.CARTA = {
  crear, cam, proyectar, mostrar, viaje, conParallax, rgba,
  CAM_SITIO, POLS, PROGRAMA, SITIO, CENTRO_SITIO, P1, OBJETIVO, DIST, RHEX, FILA, TIERRA,
};
})();
