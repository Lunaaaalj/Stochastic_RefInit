// Deck «Carta de campo»: un mapa persistente con cámara y láminas encima.
// Todo lo que se dibuja sale de DATOS (scripts/datos_presentacion.py).

(() => {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const D = DATOS;
  const raiz = getComputedStyle(document.documentElement);
  const tok = n => raiz.getPropertyValue(n).trim();
  const COL = {
    papel: tok("--papel"), papelHondo: tok("--papel-hondo"), tierra: tok("--tierra"), tierraSuave: tok("--tierra-suave"),
    tinta: tok("--tinta"), salvia: tok("--salvia"), salviaHonda: tok("--salvia-honda"), ocre: tok("--ocre"), ocreHondo: tok("--ocre-hondo"),
  };
  const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const R3 = Math.sqrt(3);

  const fmt = (x, d = 0) => x.toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d });
  const dinero = x => "$" + fmt(x);
  const $ = id => document.getElementById(id);
  function el(tag, attrs = {}, padre) {
    const e = document.createElementNS(NS, tag);
    for (const [a, v] of Object.entries(attrs)) if (v !== null && v !== undefined) e.setAttribute(a, v);
    if (padre) padre.appendChild(e);
    return e;
  }
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = t => ((ax * t + bx) * t + cx) * t, Y = t => ((ay * t + by) * t + cy) * t, dX = t => (3 * ax * t + 2 * bx) * t + cx;
    return x => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) { const e = X(t) - x, d = dX(t); if (Math.abs(e) < 1e-5 || !d) break; t -= e / d; }
      return Y(Math.min(1, Math.max(0, t)));
    };
  }
  const eCamara = bezier(.65, 0, .35, 1), eSalida = bezier(.2, .7, .2, 1);

  // Especies: relleno y texto encima (DESIGN.md, sección 2).
  const ESP = {
    Ale: { c: "#C9C79E", t: "tinta" }, Asa: { c: "#AEAC78", t: "tinta" }, Asc: { c: "#6F6D43", t: "papel" }, Ast: { c: "#5F5D34", t: "papel" },
    Oro: { c: "#F6D693", t: "tinta" }, Ost: { c: "#F2C46A", t: "tinta" }, Oca: { c: "#D9A646", t: "tinta" }, Oen: { c: "#8C6418", t: "papel" },
    Pla: { c: "#4C4541", t: "papel" }, Yfi: { c: "#766A63", t: "papel" },
  };
  for (const e of D.especies) Object.assign(ESP[e.ab], { nombre: e.nombre, genero: e.genero, q: e.q, costo: e.c });
  const GEN = { Agave: { c: "#AEAC78", t: "tinta" }, Opuntia: { c: "#F2C46A", t: "tinta" }, Otras: { c: "#4C4541", t: "papel" } };
  const RAMPA = ["#F3E2C2", "#C2BB8D", "#969464", "#64623D", "#3B3A26"];
  const RAMPA_T = ["tinta", "tinta", "tinta", "papel", "papel"];
  const TXT = { tinta: COL.tinta, papel: COL.papel };
  const corto = nombre => nombre.replace(/^(\w)\w+ /, "$1. ");

  // ================= Lienzo escalado =================
  const lienzo = $("lienzo");
  let k = 1;
  function ajustar() {
    k = Math.max(0.05, Math.min(innerWidth / 1920, innerHeight / 1080));
    document.documentElement.style.setProperty("--k", k);
  }
  addEventListener("resize", () => { ajustar(); tamanoTerreno(); if (cam) dibujarTerreno(cam); });
  ajustar();
  const aLienzo = (cx, cy) => { const r = lienzo.getBoundingClientRect(); return [(cx - r.left) / k, (cy - r.top) / k]; };

  // ================= Mundo (metros locales; x al este, y al sur) =================
  const vista = $("vista"), giro = $("giro"), defs = $("defs"), camaraG = $("camara"), mundo = $("mundo");
  // Una capa a opacidad 0 sigue costando en cada cuadro de la cámara: al terminar de
  // desvanecerse sale del render con display: none.
  function mostrarCapa(g, v) {
    clearTimeout(g.__ocultar);
    g.style.transition = "opacity 600ms var(--ease-salida)";
    if (v > 0) {
      if (g.classList.contains("capa-oculta")) { g.classList.remove("capa-oculta"); g.style.opacity = 0; void g.getBoundingClientRect(); }
      g.style.opacity = v;
    } else {
      g.style.opacity = 0;
      g.__ocultar = setTimeout(() => g.classList.add("capa-oculta"), 650);
    }
  }
  const pols = D.mapa;
  const caja = pts => {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  };
  const SITIO = caja(pols.flatMap(p => p.v));
  const P1 = pols.find(p => p.p === 1);
  const B1 = caja(P1.v);
  const centroide = v => {
    let a = 0, x = 0, y = 0;
    for (let i = 0; i < v.length; i++) {
      const [x0, y0] = v[i], [x1, y1] = v[(i + 1) % v.length], f = x0 * y1 - x1 * y0;
      a += f; x += (x0 + x1) * f; y += (y0 + y1) * f;
    }
    return [x / (3 * a), y / (3 * a)];
  };
  const dentro = ([x, y], v) => {
    let si = false;
    for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
      const [xi, yi] = v[i], [xj, yj] = v[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) si = !si;
    }
    return si;
  };
  const dPol = v => "M" + v.map(p => p.join(" ")).join("L") + "Z";

  // Retícula al tresbolillo: d = 4.19 m entre vecinas, R = d/√3 es el radio del hexágono.
  const F = 4, C = 13, N = F * C;
  const R = 4.19 / R3;
  const O = [(B1.x0 + B1.x1) / 2 + 2.25 * R, B1.y0 + 110];
  const reticula = (f, c) => [O[0] - 1.5 * R * f, O[1] + R3 * R * (c + 0.5 * f)];
  const TILE_T = `translate(${O[0]} ${O[1]}) rotate(90) scale(${R})`;
  const HEX = "M0 -1L0.866 -0.5L0.866 0.5L0 1L-0.866 0.5L-0.866 -0.5Z";
  const hexEn = (x, y) => `M${(x).toFixed(3)} ${(y - 1).toFixed(3)}l.866 .5v1l-.866 .5l-.866 -.5v-1z`;
  const centroLocal = (f, c) => [R3 * (c + 0.5 * f), 1.5 * f];
  const DF = [-1, -1, 0, 0, 1, 1], DC = [0, 1, -1, 1, -1, 0];
  const envolver = (f, c) => (((f % F) + F) % F) * C + (((c % C) + C) % C);
  const W = (a, b) => D.W[a + "|" + b];

  const ENCUADRE_TESELA = encuadre(B1, { x: 96, y: 130, w: 1728, h: 170 }, 90);

  // ---------- Curvas de nivel estilizadas ----------
  // Van en un <canvas> bajo el SVG, partidas en bloques de 16 × 16 celdas: en
  // cada cuadro solo se trazan los bloques que caen en pantalla.
  const BLOQUES = [];
  {
    const r = mulberry32(7);
    const m = 500, x0 = SITIO.x0 - m, y0 = SITIO.y0 - m, w = SITIO.x1 - SITIO.x0 + 2 * m, h = SITIO.y1 - SITIO.y0 + 2 * m;
    const cerros = Array.from({ length: 9 }, () => ({ x: x0 + r() * w, y: y0 + r() * h, a: r() * 2 - 1, s: 260 + r() * 520 }));
    const campo = (x, y) => cerros.reduce((v, b) => v + b.a * Math.exp(-((x - b.x) ** 2 + (y - b.y) ** 2) / (2 * b.s * b.s)), 0.00018 * (x - x0) - 0.0001 * (y - y0));
    const paso = 24, nx = Math.ceil(w / paso) + 1, ny = Math.ceil(h / paso) + 1;
    const v = new Float32Array(nx * ny);
    let lo = Infinity, hi = -Infinity;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const z = campo(x0 + i * paso, y0 + j * paso); v[j * nx + i] = z; lo = Math.min(lo, z); hi = Math.max(hi, z);
    }
    const niveles = 34, lado = 16;
    const bx = Math.ceil((nx - 1) / lado), by = Math.ceil((ny - 1) / lado);
    for (let j = 0; j < by; j++) for (let i = 0; i < bx; i++) {
      BLOQUES.push({ x0: x0 + i * lado * paso, y0: y0 + j * lado * paso, x1: x0 + (i + 1) * lado * paso, y1: y0 + (j + 1) * lado * paso,
        menor: new Path2D(), maestra: new Path2D() });
    }
    for (let nv = 1; nv < niveles; nv++) {
      const z = lo + nv * (hi - lo) / niveles, maestra = nv % 5 === 0;
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const bloque = BLOQUES[Math.floor(j / lado) * bx + Math.floor(i / lado)];
        const d = maestra ? bloque.maestra : bloque.menor;
        const a = v[j * nx + i], b = v[j * nx + i + 1], c = v[(j + 1) * nx + i + 1], dd = v[(j + 1) * nx + i];
        const idx = (a > z) | ((b > z) << 1) | ((c > z) << 2) | ((dd > z) << 3);
        if (idx === 0 || idx === 15) continue;
        const x = x0 + i * paso, y = y0 + j * paso, t = (p, q) => (z - p) / (q - p);
        const A = [x + paso * t(a, b), y], B = [x + paso, y + paso * t(b, c)], Cc = [x + paso * t(dd, c), y + paso], Dd = [x, y + paso * t(a, dd)];
        const s = (p, q) => { d.moveTo(p[0], p[1]); d.lineTo(q[0], q[1]); };
        switch (idx) {
          case 1: case 14: s(Dd, A); break;
          case 2: case 13: s(A, B); break;
          case 3: case 12: s(Dd, B); break;
          case 4: case 11: s(B, Cc); break;
          case 5: s(Dd, A); s(B, Cc); break;
          case 6: case 9: s(A, Cc); break;
          case 7: case 8: s(Dd, Cc); break;
          case 10: s(A, B); s(Cc, Dd); break;
        }
      }
    }
  }
  const terreno = $("terreno"), ctxT = terreno.getContext("2d");
  function tamanoTerreno() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    terreno.width = Math.round(1920 * k * dpr);
    terreno.height = Math.round(1080 * k * dpr);
  }
  function dibujarTerreno(c) {
    const e = terreno.width / 1920;
    ctxT.setTransform(1, 0, 0, 1, 0, 0);
    ctxT.clearRect(0, 0, terreno.width, terreno.height);
    // Rectángulo visible en el mundo, con margen.
    const a = c.rot * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a), extra = 40;
    const esq = [[-extra, -extra], [1920 + extra, -extra], [-extra, 1080 + extra], [1920 + extra, 1080 + extra]].map(([sx, sy]) => {
      const vx = (sx - c.ax) / c.s, vy = (sy - c.ay) / c.s;
      return [c.cx + vx * cos - vy * sin, c.cy + vx * sin + vy * cos];
    });
    const vx0 = Math.min(...esq.map(p => p[0])), vx1 = Math.max(...esq.map(p => p[0]));
    const vy0 = Math.min(...esq.map(p => p[1])), vy1 = Math.max(...esq.map(p => p[1]));
    ctxT.setTransform(e, 0, 0, e, 0, 0);
    ctxT.translate(c.ax, c.ay); ctxT.rotate(-a); ctxT.scale(c.s, c.s); ctxT.translate(-c.cx, -c.cy);
    ctxT.strokeStyle = COL.salvia;
    for (const [campo, ancho, alfa] of [["menor", 0.75, 0.35], ["maestra", 1.3, 0.5]]) {
      ctxT.lineWidth = ancho / c.s;
      ctxT.globalAlpha = alfa;
      for (const b of BLOQUES) if (b.x1 >= vx0 && b.x0 <= vx1 && b.y1 >= vy0 && b.y0 <= vy1) ctxT.stroke(b[campo]);
    }
    ctxT.globalAlpha = 1;
  }
  tamanoTerreno();

  // ---------- Patrones: cada clave repetida por género (vista de sitio, hexágono < 6 px) ----------
  const generoDe = ab => ESP[ab].genero;
  {
    const ancho = 13 * R3, alto = 78; // periodo rectangular del mosaico 4 × 13 (52 filas)
    const patron = (id, plano, contorno) => {
      const pat = el("pattern", { id, patternUnits: "userSpaceOnUse", width: ancho, height: alto, patternTransform: TILE_T }, defs);
      const caminos = { Agave: "", Opuntia: "", Otras: "" };
      let todos = "";
      for (let f = -1; f <= 52; f++) for (let c = 0; c < C; c++) {
        const x = ((R3 * (c + 0.5 * f)) % ancho + ancho) % ancho, y = 1.5 * f;
        const g = generoDe(plano[envolver(f, c)]);
        for (const dx of [-ancho, 0, ancho]) {
          caminos[g] += hexEn(x + dx, y);
          if (contorno) todos += hexEn(x + dx, y);
        }
      }
      for (const [g, d] of Object.entries(caminos)) el("path", { d, fill: GEN[g].c }, pat);
      // El grosor del contorno se fija para la escala de la lámina 10 (0.75 px en pantalla).
      if (contorno) el("path", { d: todos, fill: "none", stroke: COL.tierraSuave, "stroke-width": contorno }, pat);
    };
    for (const m of D.mosaicos) patron(`pat-${m.id}`, m.clave.flat(), 0);
    // Clave 1 por género con contorno, para teselar el polígono 1 (hexágono de 6 a 32 px).
    patron("pat-tesela", D.mosaicos[0].clave.flat(), 0.75 / (R * ENCUADRE_TESELA.s));
  }

  // ---------- Polígonos ----------
  const gPol = el("g", {}, mundo);
  const gPlantado = el("g", { class: "plantado", opacity: 0 }, mundo);
  const pathPol = new Map();
  for (const p of pols) {
    const e = el("path", { d: dPol(p.v), class: "poligono" + (p.p === null ? " fuera" : "") }, gPol);
    e.dataset.e = p.e;
    if (p.p !== null) {
      pathPol.set(p.p, e);
      const ov = el("path", { d: dPol(p.v), fill: `url(#pat-${p.clave})` }, gPlantado);
      ov.dataset.p = p.p;
    }
  }

  // ---------- Detalle del polígono 1 ----------
  const gReticula = el("g", { fill: COL.tierraSuave, opacity: 0 }, mundo);
  const puntosP1 = [];
  for (let f = -40; f <= 40; f++) for (let c = -40; c <= 140; c++) {
    const pt = reticula(f, c);
    if (pt[1] < B1.y0 - 5 || pt[1] > B1.y1 + 5) continue;
    if (dentro(pt, P1.v)) puntosP1.push(pt);
  }
  for (const [x, y] of puntosP1) el("circle", { cx: x.toFixed(2), cy: y.toFixed(2), r: 0.8 }, gReticula);

  const gExistentes = el("g", { opacity: 0 }, mundo);
  {
    const r = mulberry32(165), libres = puntosP1.slice();
    for (const [nombre, cuantas] of Object.entries(D.existentes_p1)) {
      const ab = Object.keys(ESP).find(a => ESP[a].nombre === nombre);
      for (let i = 0; i < cuantas && libres.length; i++) {
        const [x, y] = libres.splice(Math.floor(r() * libres.length), 1)[0];
        const c = el("circle", { cx: x.toFixed(2), cy: y.toFixed(2), r: 1.25, fill: ESP[ab].c, stroke: COL.tierraSuave, "stroke-width": 0.75, "vector-effect": "non-scaling-stroke" }, gExistentes);
        c.dataset.retraso = Math.floor(r() * 1400);
      }
    }
  }

  // El polígono 1 relleno con la clave 1 repetida: un solo trazo con patrón.
  const gTesela = el("g", { opacity: 0 }, mundo);
  el("path", { d: dPol(P1.v), fill: "url(#pat-tesela)", stroke: COL.tierra, "stroke-width": 1.25, "vector-effect": "non-scaling-stroke" }, gTesela);

  const gTile = el("g", { transform: TILE_T, opacity: 0 }, mundo);
  const gCopias = el("g", { opacity: 0.55 }, gTile);
  const gFichas = el("g", {}, gTile);
  const gVecinas = el("g", { stroke: COL.tierra, "stroke-linecap": "round", opacity: 0.8, "pointer-events": "none" }, gTile);
  const gResalteFicha = el("path", { d: HEX, class: "resalte", visibility: "hidden" }, gTile);

  const gResalte = el("g", {}, mundo);
  const gIds = el("g", { opacity: 0 }, mundo);
  const etiquetasId = [];
  for (const p of pols) {
    if (p.p === null) continue;
    const [x, y] = centroide(p.v);
    const t = el("text", { class: "id-poligono" }, gIds);
    t.textContent = p.p;
    etiquetasId.push({ t, x, y });
  }

  // ================= Cámara =================
  // Una cámara es centro en el mundo (cx, cy), escala en px/m (s), giro (rot,
  // grados) y el punto del lienzo donde cae el centro (ax, ay).
  let cam = null;
  const camTransform = c => `translate(${c.ax} ${c.ay}) rotate(${-c.rot}) scale(${c.s}) translate(${-c.cx} ${-c.cy})`;
  function encuadre(b, rect, rot = 0) {
    const w = b.x1 - b.x0, h = b.y1 - b.y0, a = rot * Math.PI / 180;
    const ww = Math.abs(Math.cos(a)) * w + Math.abs(Math.sin(a)) * h, hh = Math.abs(Math.sin(a)) * w + Math.abs(Math.cos(a)) * h;
    return { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, s: Math.min(rect.w / ww, rect.h / hh), rot, ax: rect.x + rect.w / 2, ay: rect.y + rect.h / 2 };
  }
  // Centro del mosaico 4 × 13 en el mundo.
  const TC = (() => { const [lx, ly] = [(-0.866 + R3 * 13.5 + 0.866) / 2, 2.25]; return [O[0] - ly * R, O[1] + lx * R]; })();
  const CAMARAS = {
    hoja: encuadre(SITIO, { x: 1000, y: 100, w: 820, h: 860 }),
    cierre: encuadre(SITIO, { x: 1060, y: 150, w: 760, h: 760 }),
    resumen: encuadre(SITIO, { x: 1220, y: 160, w: 620, h: 760 }),
    sitio: encuadre(SITIO, { x: 60, y: 90, w: 1000, h: 880 }),
    "sitio-datos": encuadre(SITIO, { x: 40, y: 150, w: 680, h: 760 }),
    poligono: encuadre(B1, { x: 60, y: 420, w: 740, h: 240 }, 90),
    reticula: { cx: TC[0], cy: TC[1], s: 44 / R, rot: 90, ax: 96 + 552.5, ay: 430 + 143 },
    replica: { cx: TC[0], cy: TC[1], s: Math.min(1144 / 77.07, 300 / 18.5) / R, rot: 90, ax: 96 + 572, ay: 430 + 137 },
    tesela: ENCUADRE_TESELA,
    // Lámina 13: el polígono 1 como franja dentro del ciclo del memético; de ahí la 14 se acerca a la retícula.
    memetico: encuadre(B1, { x: 96, y: 688, w: 1728, h: 84 }, 90),
    // Lámina 15: el polígono 1 teselado, en el hueco bajo la conclusión; la 14 se aleja hasta aquí.
    exacto: encuadre(B1, { x: 980, y: 878, w: 844, h: 84 }, 90),
    ventana: encuadre(SITIO, { x: 120, y: 360, w: 812, h: 480 }),
  };

  let ultimaCartela = 0;
  function aplicarCamara(c, enMovimiento = false) {
    cam = c;
    camaraG.setAttribute("transform", camTransform(c));
    dibujarTerreno(c);
    // Las etiquetas se contraescalan solo si se ven; la cartela, a lo más diez veces por segundo.
    if (!gIds.classList.contains("capa-oculta")) {
      for (const { t, x, y } of etiquetasId) t.setAttribute("transform", `translate(${x} ${y}) rotate(${c.rot}) scale(${1 / c.s})`);
    }
    const ahora = performance.now();
    if (!enMovimiento || ahora - ultimaCartela > 100) { ultimaCartela = ahora; cartela(c); }
  }
  function interp(a, b, p) {
    const lnA = Math.log(a.s), lnB = Math.log(b.s);
    const s = Math.exp(lnA + (lnB - lnA) * p);
    // El centro avanza con el ancho de la vista, no con el tiempo: así el destino no se escapa al acercar.
    const w = Math.abs(lnB - lnA) > 0.2 ? (1 / a.s - 1 / s) / (1 / a.s - 1 / b.s) : p;
    let dr = b.rot - a.rot;
    if (dr > 180) dr -= 360;
    if (dr < -180) dr += 360;
    return { cx: a.cx + (b.cx - a.cx) * w, cy: a.cy + (b.cy - a.cy) * w, s, rot: a.rot + dr * p, ax: a.ax + (b.ax - a.ax) * p, ay: a.ay + (b.ay - a.ay) * p };
  }
  // Duración del viaje según cuánto cambia el encuadre: el acercamiento en escala logarítmica, el
  // desplazamiento en anchos de pantalla, el giro y el ancla. Si la cámara no se mueve, 0 ms.
  function duracionViaje(a, b) {
    if (!a) return 0;
    let dr = Math.abs(b.rot - a.rot) % 360;
    if (dr > 180) dr = 360 - dr;
    const d = Math.abs(Math.log(b.s / a.s)) + Math.hypot(b.cx - a.cx, b.cy - a.cy) * Math.min(a.s, b.s) / 1920 +
      dr / 90 + Math.hypot(b.ax - a.ax, b.ay - a.ay) / 1920;
    return d < 0.005 ? 0 : Math.round(Math.min(1700, 650 + 700 * d));
  }
  let viaje = null;
  function moverCamara(dest, { dur = 1600, progreso, fin } = {}) {
    if (viaje) cancelAnimationFrame(viaje.raf);
    viaje = null;
    if (!cam || dur <= 0) { aplicarCamara(dest); progreso?.(1); fin?.(); return; }
    if (reducir) {
      vista.style.opacity = 0;
      setTimeout(() => { aplicarCamara(dest); vista.style.opacity = ""; progreso?.(1); fin?.(); }, 300);
      return;
    }
    const ini = { ...cam }, t0 = performance.now();
    const paso = ahora => {
      const u = Math.min(1, (ahora - t0) / dur);
      aplicarCamara(interp(ini, dest, eCamara(u)), u < 1);
      progreso?.(u);
      if (u < 1) viaje.raf = requestAnimationFrame(paso);
      else { viaje = null; fin?.(); }
    };
    viaje = { raf: requestAnimationFrame(paso) };
  }

  // Cartela: coordenadas de la esquina inferior izquierda, escala gráfica y norte.
  const [E0, N0] = D.origen_utm;
  function cartela(c) {
    $("norte").setAttribute("transform", `rotate(${-c.rot} 11 17)`);
    const largos = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    const L = largos.find(l => l * c.s >= 70) ?? 1000;
    $("escala-barra").setAttribute("d", `M0 6V12H${(L * c.s).toFixed(1)}V6`);
    $("escala-texto").textContent = `${fmt(L)} m`;
    const a = c.rot * Math.PI / 180, vx = (0 - c.ax) / c.s, vy = (1080 - c.ay) / c.s;
    const wx = c.cx + vx * Math.cos(a) - vy * Math.sin(a), wy = c.cy + vx * Math.sin(a) + vy * Math.cos(a);
    $("utm").textContent = `E ${fmt(Math.round(E0 + wx))} · N ${fmt(Math.round(N0 - wy))} (UTM)`;
  }

  // Hoja de la portada: margen de papel, marco doble y cuadrícula UTM cada 500 m con su
  // rotulación al margen. La cámara "hoja" no gira ni se inclina, así que las coordenadas son exactas.
  const DETALLE = 29; // 7.56 ha con la clave 1, junto al espacio libre de la hoja
  {
    const svg = $("hoja"), c = CAMARAS.hoja, M = { x0: 56, y0: 56, x1: 1864, y1: 1000 }, paso = 500;
    const X = E => c.ax + c.s * (E - E0 - c.cx), Y = N => c.ay + c.s * (N0 - N - c.cy);
    const aE = x => E0 + c.cx + (x - c.ax) / c.s, aN = y => N0 - (c.cy + (y - c.ay) / c.s);
    el("path", { class: "margen", "fill-rule": "evenodd",
      d: `M0 0H1920V1080H0Z M${M.x0} ${M.y0}V${M.y1}H${M.x1}V${M.y0}Z` }, svg);
    el("rect", { class: "marco-ext", x: M.x0, y: M.y0, width: M.x1 - M.x0, height: M.y1 - M.y0 }, svg);
    el("rect", { class: "marco-int", x: M.x0 + 6, y: M.y0 + 6, width: M.x1 - M.x0 - 12, height: M.y1 - M.y0 - 12 }, svg);
    // Como en las cartas INEGI: los dígitos que cambian van grandes y los que se repiten, chicos.
    const rotular = (v, attrs) => {
      const t = el("text", attrs, svg), s = String(Math.round(v)), n = s.length - 3;
      el("tspan", { class: "menor" }, t).textContent = s.slice(0, n);
      t.append(s.slice(n));
      return t;
    };
    const Es = [], Ns = [];
    for (let E = Math.ceil(aE(M.x0 + 40) / paso) * paso; X(E) < M.x1 - 40; E += paso) Es.push(E);
    for (let N = Math.ceil(aN(M.y1 - 40) / paso) * paso; Y(N) > M.y0 + 40; N += paso) Ns.push(N);
    let d = "";
    for (const E of Es) {
      const x = X(E).toFixed(1);
      d += `M${x} ${M.y0}v10M${x} ${M.y1}v-10`;
      rotular(E, { x, y: M.y0 - 16, "text-anchor": "middle" });
    }
    for (const N of Ns) {
      const y = Y(N).toFixed(1);
      d += `M${M.x0} ${y}h10M${M.x1} ${y}h-10`;
      rotular(N, { transform: `translate(${M.x0 - 16} ${y}) rotate(-90)`, "text-anchor": "middle" });
      for (const E of Es) d += `M${(X(E) - 9).toFixed(1)} ${y}h18M${X(E).toFixed(1)} ${(Y(N) - 9).toFixed(1)}v18`;
    }
    el("path", { class: "cuadricula", d }, svg);

    // Detalle: a esta escala cada planta mide un píxel y los géneros se funden. Un círculo
    // amplía el centro del polígono DETALLE hasta que cada hexágono (una planta) se lee por género.
    const P = pols.find(p => p.p === DETALLE), [wx, wy] = centroide(P.v);
    const L = { x: 1652, y: 736, r: 146 }, rho = 15, m = rho / R;
    const sx = c.ax + c.s * (wx - c.cx), sy = c.ay + c.s * (wy - c.cy), rMapa = L.r / m * c.s;
    const ang = Math.atan2(L.y - sy, L.x - sx);
    el("circle", { class: "detalle-marca", cx: sx, cy: sy, r: rMapa }, svg);
    el("path", { class: "detalle-marca", d: `M${sx + rMapa * Math.cos(ang)} ${sy + rMapa * Math.sin(ang)}L${L.x - L.r * Math.cos(ang)} ${L.y - L.r * Math.sin(ang)}` }, svg);
    el("clipPath", { id: "recorte-detalle" }, svg).appendChild(el("circle", { cx: L.x, cy: L.y, r: L.r }));
    el("circle", { class: "detalle-fondo", cx: L.x, cy: L.y, r: L.r }, svg);
    const plano = D.mosaicos.find(k => k.id === P.clave).clave.flat();
    const hexD = (x, y) => `M${x + rho} ${y}` + [1, 2, 3, 4, 5].map(i => `L${(x + rho * Math.cos(i * Math.PI / 3)).toFixed(1)} ${(y + rho * Math.sin(i * Math.PI / 3)).toFixed(1)}`).join("") + "Z";
    const caminos = { Agave: "", Opuntia: "", Otras: "" };
    const f0 = Math.round((O[0] - wx) / (1.5 * R)), c0 = Math.round((wy - O[1]) / (R3 * R) - 0.5 * f0);
    for (let f = f0 - 12; f <= f0 + 12; f++) for (let cc = c0 - 14; cc <= c0 + 14; cc++) {
      const [hx, hy] = reticula(f, cc), x = L.x + m * (hx - wx), y = L.y + m * (hy - wy);
      if (Math.hypot(x - L.x, y - L.y) < L.r + rho && dentro([hx, hy], P.v)) caminos[generoDe(plano[envolver(f, cc)])] += hexD(x, y);
    }
    const gDet = el("g", { "clip-path": "url(#recorte-detalle)" }, svg);
    for (const [g, dd] of Object.entries(caminos)) el("path", { class: "detalle-hex", d: dd, fill: GEN[g].c }, gDet);
    el("circle", { class: "detalle-borde", cx: L.x, cy: L.y, r: L.r }, svg);
    const pie = el("text", { class: "detalle-pie", x: L.x, y: L.y + L.r + 34, "text-anchor": "middle" }, svg);
    pie.textContent = `Detalle del polígono ${DETALLE}, clave ${P.clave}`;
    const pie2 = el("text", { class: "detalle-pie", x: L.x, y: L.y + L.r + 58, "text-anchor": "middle" }, svg);
    pie2.textContent = "Un hexágono por planta, a 4.19 m";
  }

  // ================= Capas por lámina =================
  // Clases de la coropleta por quintiles (seis polígonos por clase).
  function quintiles(valores) {
    const s = [...valores].sort((a, b) => a - b);
    return [1, 2, 3, 4].map(i => s[Math.round(i * s.length / 5) - 1]);
  }
  const clasif = (x, cortes) => cortes.filter(c => x > c).length;
  const CORO = {};
  for (const campo of ["compra_ha", "Bmin"]) {
    const vals = pols.filter(p => p.p !== null).map(p => p[campo]);
    CORO[campo] = { cortes: quintiles(vals), min: Math.min(...vals), max: Math.max(...vals) };
  }
  function leyenda(id, titulo, campo, formato) {
    const { cortes, min, max } = CORO[campo];
    const lim = [min, ...cortes, max];
    const caja = $(id);
    caja.className = "rotulo";
    caja.innerHTML = `<div style="margin-bottom:6px">${titulo}</div>`;
    const fila = document.createElement("div");
    fila.style.cssText = "display:flex;gap:16px;flex-wrap:wrap";
    for (let i = 0; i < 5; i++) {
      const s = document.createElement("span");
      s.style.cssText = "display:inline-flex;align-items:center;gap:6px";
      s.innerHTML = `<i style="width:18px;height:14px;display:inline-block;background:${RAMPA[i]};border:1px solid ${COL.tierraSuave}"></i>${formato(lim[i])}–${formato(lim[i + 1])}`;
      fila.appendChild(s);
    }
    caja.appendChild(fila);
  }
  leyenda("leyenda-compra", "Plantas compradas por hectárea, por quintiles", "compra_ha", x => fmt(x));
  leyenda("leyenda-presupuesto", "Presupuesto mínimo B* por hectárea (α = 0.05), por quintiles", "Bmin", x => dinero(x));

  let polHover = false;
  function aplicarCapas(cap) {
    const fade = (g, v) => mostrarCapa(g, v);
    fade(gIds, cap.ids ? 1 : 0);
    fade(gReticula, cap.reticula ? 1 : 0);
    fade(gExistentes, cap.existentes ? 1 : 0);
    fade(gTesela, cap.tesela ? 1 : 0);
    fade(gTile, cap.tile ? 1 : 0);
    fade(gPlantado, cap.plantado ?? 0);
    gTile.style.pointerEvents = cap.tile ? "auto" : "none";
    giro.style.opacity = cap.tenue ?? 1;
    polHover = !!cap.hover;
    gPol.style.pointerEvents = polHover ? "auto" : "none";
    for (const p of pols) {
      const e = gPol.querySelector(`[data-e="${p.e}"]`);
      e.classList.toggle("insinuado", !!cap.insinuado && p.p !== null);
      e.classList.toggle("lejano", cap.foco !== undefined && p.p !== cap.foco);
      if (cap.coro && p.p !== null) e.style.fill = RAMPA[clasif(p[cap.coro], CORO[cap.coro].cortes)];
      else e.style.fill = "";
    }
    gResalte.replaceChildren();
    for (const id of cap.resalte ?? []) el("path", { d: pathPol.get(id).getAttribute("d"), class: "resalte" }, gResalte);
  }

  // ================= Etiqueta flotante =================
  const etiqueta = $("etiqueta");
  function mostrarEtiqueta(html, x, y, separacion = 18) {
    etiqueta.innerHTML = html;
    etiqueta.hidden = false;
    const w = etiqueta.offsetWidth, h = etiqueta.offsetHeight;
    let lx = x + separacion, ly = y - h - separacion;
    if (lx + w > 1860) lx = x - separacion - w;
    if (ly < 40) ly = y + separacion;
    etiqueta.style.left = lx + "px";
    etiqueta.style.top = ly + "px";
  }
  const ocultarEtiqueta = () => { etiqueta.hidden = true; };

  gPol.addEventListener("pointermove", ev => {
    if (!polHover) return;
    const e = ev.target.closest(".poligono");
    if (!e) return ocultarEtiqueta();
    const p = pols.find(q => q.e === +e.dataset.e);
    const [x, y] = aLienzo(ev.clientX, ev.clientY);
    if (p.p === null) {
      mostrarEtiqueta(`<span class="titulo">Fuera del programa</span><span class="rotulo">Etiqueta ${p.e} del plano de INECOL; no está en la lista de polígonos.</span>`, x, y);
      return;
    }
    mostrarEtiqueta(
      `<span class="titulo">Polígono ${p.p}</span>` +
      `<span class="rotulo">${fmt(p.area, 2)} ha · etiqueta ${p.e} del plano INECOL · clave ${p.clave}</span>` +
      `<span class="valor">B* ${dinero(p.Bmin)}/ha</span>` +
      `<span class="rotulo">Compra ${fmt(p.compra_ha, 1)} plantas/ha; ya existen ${fmt(p.existentes_ha, 1)}/ha</span>`, x, y);
  });
  gPol.addEventListener("pointerleave", ocultarEtiqueta);

  // ================= Gráficas =================
  const svgEl = (id) => { const s = $(id); s.replaceChildren(); return s; };
  const texto = (padre, x, y, t, attrs = {}) => { const e = el("text", { x, y, ...attrs }, padre); e.textContent = t; return e; };
  // Hexágono de radio r con centro en (x, y), punta arriba como los del mosaico.
  const hexR = (x, y, r) => `M${x.toFixed(2)} ${(y - r).toFixed(2)}l${(.866 * r).toFixed(2)} ${r / 2}v${r}l${(-.866 * r).toFixed(2)} ${r / 2}l${(-.866 * r).toFixed(2)} ${-r / 2}v${-r}z`;
  // Animación de los dibujos (clases de estilo.css): --t es el inicio y --d la duración.
  const tiempo = (e, t, d) => {
    e.style.setProperty("--t", `${Math.round(t)}ms`);
    if (d !== undefined) e.style.setProperty("--d", `${Math.max(1, Math.round(d))}ms`);
    return e;
  };
  // Trazo que se dibuja de principio a fin; el largo sale de su geometría.
  function trazo(padre, d, t, dur, attrs = {}) {
    const e = el("path", { d, class: "trazo", ...attrs }, padre);
    e.style.setProperty("--largo", (e.getTotalLength() + 1).toFixed(1));
    return tiempo(e, t, dur);
  }
  // Flecha: el trazo y, al terminar, su punta en (x, y) apuntando en el ángulo a (radianes).
  function flecha(padre, d, t, dur, [x, y, a]) {
    trazo(padre, d, t, dur, { class: "trazo flecha" });
    const p = [-0.5, 0.5].map(da => `M${(x - 10 * Math.cos(a + da)).toFixed(1)} ${(y - 10 * Math.sin(a + da)).toFixed(1)}L${x} ${y}`).join("");
    return tiempo(el("path", { d: p, class: "flecha aparece" }, padre), t + dur);
  }
  // Mosaico 4 × 13 en miniatura, por género (hexágono < 32 px). Esquina superior izquierda en
  // (x, y); mide 25.1 r × 6.5 r. opacidad(v) atenúa posiciones.
  function miniatura(padre, plano, x, y, r, opacidad = () => 1) {
    const g = el("g", { transform: `translate(${x} ${y})` }, padre);
    plano.forEach((ab, v) => {
      const [cx, cy] = centroLocal(Math.floor(v / C), v % C);
      el("path", { d: hexR((cx + 0.866) * r, (cy + 1) * r, r), fill: GEN[ESP[ab].genero].c, stroke: COL.tierraSuave, "stroke-width": 0.5, opacity: opacidad(v) }, g);
    });
    return g;
  }
  function muestraHex(padre, x, y, r, fill) {
    return el("path", { d: HEX, transform: `translate(${x} ${y}) scale(${r})`, fill, stroke: COL.tierraSuave, "stroke-width": 1, "vector-effect": "non-scaling-stroke" }, padre);
  }

  const T = D.totales;
  // ---------- Lámina 2 ----------
  {
    $("r-bmin").textContent = dinero(T.B_min);
    const s = svgEl("r-barra"), esc = 1000 / 16000, y = 44;
    el("rect", { x: T.presupuesto * esc, y: y - 12, width: (T.B_min - T.presupuesto) * esc, height: 50, fill: COL.ocre, "fill-opacity": 0.35 }, s);
    el("rect", { x: 0, y, width: T.B_min * esc, height: 26, fill: COL.tierra, class: "crece" }, s);
    el("path", { d: `M${T.presupuesto * esc} ${y - 22}V${y + 44}`, stroke: COL.ocreHondo, "stroke-width": 2, "stroke-dasharray": "6 5" }, s);
    texto(s, T.presupuesto * esc - 10, y - 8, `Disponible: ${dinero(T.presupuesto)}`, { "text-anchor": "end", class: "fuerte", fill: COL.ocreHondo }).style.fill = COL.ocreHondo;
    texto(s, (T.presupuesto + T.B_min) / 2 * esc, y + 66, `faltan ${dinero(T.B_min - T.presupuesto)}`, { "text-anchor": "middle" });
    $("r-compra").innerHTML = `Comprar <span class="cifra" style="font-size:var(--t-xl)">${fmt(T.compra)}</span> plantas para los 30 polígonos: ${fmt(T.compra_ha)} por hectárea, que con las ${fmt(T.existentes_ha)} que ya existen dan ${fmt(T.densidad_ha)}.`;
    $("r-competencia").innerHTML = `La clave de plantación reduce <span class="cifra" style="font-size:var(--t-xl)">${fmt(T.reduccion * 100)} %</span> la competencia entre plantas vecinas frente a sembrar al azar.`;
  }

  // ---------- Lámina 4: herbario ----------
  {
    const caja = $("herbario");
    let semilla = 1;
    for (const genero of ["Agave", "Opuntia", "Otras"]) {
      for (const e of D.especies.filter(x => x.genero === genero)) {
        const fig = document.createElement("figure");
        fig.className = "lamina-herbario";
        fig.style.margin = 0;
        fig.innerHTML = Herbario.svg(e.nombre, ESP[e.ab].c, semilla++) +
          `<figcaption class="etiqueta-herbario"><span class="binomial">${corto(e.nombre)}</span>` +
          `<span class="rotulo">${e.ab} · <i>q</i> ${fmt(e.q, 2)} · <i>c</i> ${dinero(e.c)}</span></figcaption>`;
        caja.appendChild(fig);
      }
    }
  }

  // ---------- Lámina 5: supervivencia ----------
  {
    $("n-existentes").textContent = `INECOL contó ${fmt(T.existentes_ha)} plantas por hectárea que nacieron solas en el sitio; en el polígono 1 son ${fmt(Object.values(D.existentes_p1).reduce((a, b) => a + b, 0))}. Se descuentan de la compra.`;
    const s = svgEl("g-supervivencia");
    const filas = [...D.especies].sort((a, b) => b.q - a.q);
    const x0 = 330, x1 = 820, q0 = 0.70, q1 = 1.0, X = q => x0 + (q - q0) / (q1 - q0) * (x1 - x0), h = 40;
    filas.forEach((e, i) => {
      const y = 18 + i * h;
      texto(s, 0, y + 6, e.ab, { class: "ab" });
      texto(s, 50, y + 6, corto(e.nombre), { class: "bin" });
      el("line", { x1: X(e.banda[0]), x2: X(e.banda[1]), y1: y, y2: y, stroke: COL.salvia, "stroke-width": 9, "stroke-linecap": "round", class: "crece", style: `--i:${i}` }, s);
      el("circle", { cx: X(e.q), cy: y, r: 7.5, fill: ESP[e.ab].c, stroke: COL.tierra, "stroke-width": 1.25 }, s);
      texto(s, x1 + 18, y + 6, fmt(e.q, 2), { class: "fuerte" });
    });
    const yb = 18 + filas.length * h - 10;
    el("path", { d: `M${x0} ${yb}H${x1}`, class: "eje" }, s);
    for (const q of [0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1]) {
      el("path", { d: `M${X(q)} ${yb}v5`, class: "eje" }, s);
      texto(s, X(q), yb + 24, fmt(q, 2), { "text-anchor": "middle" });
    }
    texto(s, x0, yb + 50, "Supervivencia q: punto; banda del 90 % en un lote de 100 plantas", {});
  }

  // ---------- Lámina 6: la tubería como árbol ----------
  // Raíces: los datos. Tronco: los escenarios, comunes a todo. Ramas: una compra por polígono,
  // agrupadas en las claves que comparten. Hojas: una planta de su clave con sus seis vecinas.
  // El grosor sigue el modelo de tubos de los árboles: la sección de cada rama es proporcional
  // a la superficie que alimenta, así que el ancho va con la raíz cuadrada del área.
  {
    const s = svgEl("arbol");
    const AX = 1240, SUELO = 770, TOPE = 590, CY = 600, WT = 22, R_HOJA = 8.5;
    const grosor = a => Math.max(1.4, WT * Math.sqrt(a / T.area));
    const dist = (P, Q) => Math.hypot(Q[0] - P[0], Q[1] - P[1]);
    const gGuias = el("g", {}, s), gRaices = el("g", { class: "raiz" }, s), gRamas = el("g", {}, s), gHojas = el("g", {}, s);

    // Rama de P a Q que se adelgaza de w0 a w1, en tramos: cada tramo empieza cuando termina el
    // anterior, y la punta avanza como 1 − (1 − t)², así que el tramo i empieza en 1 − √(1 − i/n).
    function rama(padre, P, Q, w0, w1, t0, dur, n = 8) {
      const g = el("g", {}, padre);
      const dx = Q[0] - P[0], dy = Q[1] - P[1], l = Math.hypot(dx, dy) || 1, vy = dy / l + (dy > 0 ? 0.9 : -0.9), lv = Math.hypot(dx / l, vy);
      const C1 = [P[0] + dx / lv * 0.4, P[1] + vy * l / lv * 0.4], C2 = [Q[0] - dx * 0.3, Q[1] - dy * 0.3];
      const B = u => { const v = 1 - u; return [0, 1].map(j => v * v * v * P[j] + 3 * v * v * u * C1[j] + 3 * v * u * u * C2[j] + u * u * u * Q[j]); };
      const inicio = i => t0 + dur * (1 - Math.sqrt(1 - i / n));
      for (let i = 0; i < n; i++) {
        const pts = [0, 1, 2, 3, 4].map(j => B((i + j / 4) / n));
        let largo = 0;
        for (let j = 1; j < pts.length; j++) largo += dist(pts[j - 1], pts[j]);
        const e = el("path", { d: "M" + pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("L"), class: "trazo",
          "stroke-width": (w0 + (w1 - w0) * (i + 0.5) / n).toFixed(2) }, g);
        e.style.setProperty("--largo", (largo + 0.5).toFixed(1));
        tiempo(e, inicio(i), inicio(i + 1) - inicio(i));
      }
      return { g, B, fin: t0 + dur };
    }

    // Suelo con achurado, como en las láminas de herbario.
    const suelo = el("path", { d: `M${AX - 420} ${SUELO}H${AX + 420}`, class: "trazo suelo" }, gGuias);
    suelo.style.setProperty("--largo", 840);
    tiempo(suelo, 0, 600);
    let achurado = "";
    for (let x = AX - 410; x <= AX + 410; x += 14) achurado += `M${x} ${SUELO + 3}l-7 9`;
    tiempo(el("path", { d: achurado, class: "suelo aparece" }, gGuias), 250);

    // Raíces: los cuatro insumos de INECOL.
    const RAICES = [["superficie", -232, 115], ["plantas existentes", -88, 150], ["supervivencia y costo", 88, 150], ["competencia <tspan font-style=\"italic\">W</tspan>", 232, 115]];
    const raices = RAICES.map(([nombre, dx, dy], i) => {
      const t0 = 150 + i * 80, lado = Math.sign(dx);
      const r = rama(gRaices, [AX + lado * 6, SUELO], [AX + dx, SUELO + dy], 9, 1.2, t0, 700);
      const m = r.B(0.5);
      rama(gRaices, m, [m[0] + lado * 46, m[1] + 30], 2.6, 0.8, t0 + 420, 380, 4);
      tiempo(el("text", { x: AX + dx, y: SUELO + dy + 30, class: "aparece" }, s), t0 + 600).innerHTML = nombre;
      return r;
    });

    // Tronco: una rama brota cuando el tronco llega a su altura.
    const T0 = 650, DT = 650;
    const tronco = rama(gRamas, [AX, SUELO + 4], [AX, TOPE], WT + 9, WT, T0, DT);
    const brota = y => T0 + DT * (1 - Math.sqrt(1 - Math.min(1, (SUELO - y) / (SUELO - TOPE))));

    // Copa: la clave más grande sigue al tronco y las demás se reparten a los lados, alternando.
    // Las hojas van en dos arcos al tresbolillo, con un hueco entre claves.
    const conPol = pols.filter(p => p.p !== null);
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
        return { p, x: AX + (fuera ? 540 : 420) * Math.cos(th), y: CY - (fuera ? 470 : 355) * Math.sin(th) };
      });
      return { m, ps, gi };
    });
    const centroDe = qs => qs.reduce((a, q) => [a[0] + q.x / qs.length, a[1] + q.y / qs.length], [0, 0]);
    const areaDe = qs => qs.reduce((a, q) => a + q.p.area, 0);
    const hacia = (P, Q, f) => [P[0] + (Q[0] - P[0]) * f, P[1] + (Q[1] - P[1]) * f];

    const linajes = new Map(), hojas = [], mayores = [];
    for (const { m, ps, gi } of grupos) {
      const lado = Math.sign(gi - centro), lejos = Math.abs(gi - centro);
      const S = lejos ? [AX + lado * 5, TOPE + 22 + 38 * (lejos - 1) + (lado > 0 ? 14 : 0)] : [AX, TOPE + 2];
      const L = hacia(S, centroDe(ps), ps.length > 1 ? 0.5 : 0.6), a = areaDe(ps);
      const mayor = rama(gRamas, S, L, grosor(a), grosor(a) * 0.8, brota(S[1]), 250 + 1.2 * dist(S, L));
      mayores[gi] = mayor;
      // Más de cuatro polígonos: ramas intermedias de a lo más cuatro.
      const nSub = Math.ceil(ps.length / 4);
      for (let j = 0; j < nSub; j++) {
        const sub = ps.slice(Math.round(j * ps.length / nSub), Math.round((j + 1) * ps.length / nSub));
        let base = L, t = mayor.fin, gSub = null;
        if (nSub > 1) {
          const G = hacia(L, centroDe(sub), 0.55), as = areaDe(sub);
          const r = rama(gRamas, L, G, grosor(as), grosor(as) * 0.8, mayor.fin - 60, 200 + 1.2 * dist(L, G), 6);
          base = G; t = r.fin; gSub = r.g;
        }
        for (const q of sub) {
          const fin = [q.x, q.y], w = grosor(q.p.area);
          const ramita = rama(gRamas, base, fin, w, w * 0.8, t - 40, 150 + 1.3 * dist(base, fin), 5);
          linajes.set(q.p.p, [tronco.g, mayor.g, gSub, ramita.g].filter(Boolean));
          hojas.push({ q, m, ramita, t: ramita.fin - 60, i: ps.indexOf(q) });
        }
      }
    }

    // Hojas: una planta de la clave y sus seis vecinas, coloreadas por género (hexágono < 32 px).
    for (const { q, m, t, i } of hojas) {
      const plano = m.clave.flat(), v = (i * 19 + 7) % N, f = Math.floor(v / C), c = v % C;
      const g = el("g", { class: "roseta interactivo", transform: `translate(${q.x.toFixed(1)} ${q.y.toFixed(1)})` }, gHojas);
      [[0, 0], ...DF.map((df, j) => [df, DC[j]])].forEach(([df, dc], j) => {
        const ab = plano[envolver(f + df, c + dc)];
        const hex = el("path", { d: hexR(R3 * (dc + 0.5 * df) * R_HOJA, 1.5 * df * R_HOJA, R_HOJA), class: "hex brote", fill: GEN[ESP[ab].genero].c }, g);
        tiempo(hex, t + (j ? 80 + 35 * j : 0));
      });
      const otros = m.poligonos.length - 1;
      g.addEventListener("pointerenter", () => {
        g.classList.add("activa");
        for (const r of linajes.get(q.p.p)) r.classList.add("linaje");
        mostrarEtiqueta(
          `<span class="titulo">Polígono ${q.p.p}</span>` +
          `<span class="rotulo">${fmt(q.p.area, 2)} ha · compra ${fmt(q.p.compra_ha, 1)} plantas/ha</span>` +
          `<span class="valor">Clave ${m.id}</span>` +
          `<span class="rotulo">${otros ? `La comparte con ${otros} ${otros === 1 ? "polígono" : "polígonos"} más` : "Solo la usa este polígono"}</span>`, q.x, q.y - 20, 28);
      });
      g.addEventListener("pointerleave", () => {
        g.classList.remove("activa");
        for (const r of linajes.get(q.p.p)) r.classList.remove("linaje");
        ocultarEtiqueta();
      });
    }

    // Anotaciones con su línea guía; cada una aparece cuando crece su parte del árbol.
    function guia(n, top, destino, t, radio = 0) {
      const a = $(`anota-${n}`);
      a.style.top = top + "px";
      a.style.setProperty("--t", `${Math.round(t)}ms`);
      const P = [96 + 430 + 18, top + 22], d = dist(P, destino), Q = hacia(destino, P, radio / d);
      tiempo(el("path", { d: `M${P[0]} ${P[1]}L${Q[0].toFixed(1)} ${Q[1].toFixed(1)}`, class: "guia aparece" }, gGuias), t);
      tiempo(el("circle", { cx: Q[0].toFixed(1), cy: Q[1].toFixed(1), r: 3, class: "guia-punto aparece" }, gGuias), t);
    }
    const tHojas = Math.min(...hojas.map(h => h.t));
    const hoja4 = hojas.filter(h => Math.abs(h.q.y - 282) < 70).sort((a, b) => a.q.x - b.q.x)[0].q;
    guia(4, 260, [hoja4.x, hoja4.y], tHojas, 3.2 * R_HOJA);
    const izquierda = hojas.reduce((a, h) => (h.q.x < a.q.x ? h : a));
    guia(3, 510, izquierda.ramita.B(0.3), Math.min(...mayores.map(r => r.fin)) - 400);
    guia(2, 676, [AX - 14, 700], T0);
    guia(1, 846, raices[0].B(0.55), 150);
    document.querySelector(".ficha-arbol").style.setProperty("--t", `${Math.round(Math.max(...hojas.map(h => h.t)) + 300)}ms`);
    $("arbol-generos").innerHTML = Object.entries(GEN).map(([g, { c }]) =>
      `<span><svg viewBox="-1 -1.1 2 2.2" aria-hidden="true"><path d="${HEX}" fill="${c}" stroke="${COL.tierraSuave}" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>${g === "Otras" ? "Otras" : `<i>${g}</i>`}</span>`).join("");
  }

  // ---------- Lámina 7: el modelo de compra ----------
  // El ejemplo de la lámina es el de DATOS.escenarios: una especie en el polígono 1.
  {
    const sc = D.escenarios, falta = sc.meta - sc.existentes;
    const ab = Object.keys(ESP).find(a => ESP[a].nombre === sc.especie);
    $("mc-falta").innerHTML = `En el polígono ${sc.poligono}, la meta de <i>${sc.especie}</i> es ${fmt(sc.meta)} plantas. Ya hay ${fmt(sc.existentes)}, así que deben sobrevivir ${fmt(falta)} nuevas.`;
    const s1 = svgEl("mc-meta"), esc = 360 / sc.meta, y = 34;
    el("rect", { x: 0, y, width: sc.existentes * esc, height: 28, fill: COL.papelHondo, stroke: COL.tierraSuave, "stroke-width": 1, class: "crece" }, s1);
    el("rect", { x: sc.existentes * esc, y, width: falta * esc, height: 28, fill: ESP[ab].c, stroke: COL.tierraSuave, "stroke-width": 1, class: "crece", style: "--i:5" }, s1);
    el("path", { d: `M${sc.meta * esc} ${y - 6}V${y + 40}`, stroke: COL.tierra, "stroke-width": 1.5, "stroke-dasharray": "5 4" }, s1);
    texto(s1, 0, y - 10, `ya hay ${fmt(sc.existentes)}`, {});
    texto(s1, sc.meta * esc - 8, y - 10, `faltan ${fmt(falta)} vivas`, { "text-anchor": "end", class: "fuerte" });
    texto(s1, sc.meta * esc, y + 62, `meta ${fmt(sc.meta)}`, { "text-anchor": "middle" });

    const acum = sc.dist.filter(([x]) => x <= sc.q95).reduce((a, [, p]) => a + p, 0);
    $("mc-escenarios").innerHTML = `Cada planta sobrevive con probabilidad <i>q</i> = ${fmt(sc.q, 2)}, así que ${fmt(falta)} no bastan. En 10,000 escenarios contamos cuántas hacía falta plantar: comprar ${fmt(sc.q95)} alcanza en al menos el 95 %.`;
    const s2 = svgEl("mc-hist");
    const xs = sc.dist.map(d => d[0]), pm = Math.max(...sc.dist.map(d => d[1]));
    const x0 = 8, ancho = 384, bw = ancho / xs.length, base = 128, alto = 96;
    const bx = x => x0 + (x - xs[0]) * bw;
    sc.dist.forEach(([x, p], i) => el("rect", { x: bx(x) + 0.75, y: base - p / pm * alto, width: bw - 1.5, height: p / pm * alto,
      fill: x <= sc.q95 ? COL.salviaHonda : COL.salvia, class: "crece vertical", style: `--i:${i}` }, s2));
    const xq = bx(sc.q95) + bw;
    el("path", { d: `M${xq} ${base - alto - 16}V${base + 4}`, stroke: COL.ocreHondo, "stroke-width": 2, "stroke-dasharray": "5 4" }, s2);
    texto(s2, xq + 8, base - alto - 4, `comprar ${sc.q95}`, { class: "fuerte" }).style.fill = COL.ocreHondo;
    texto(s2, xq - 8, base - alto - 4, `${fmt(acum * 100)} % de los escenarios`, { "text-anchor": "end" });
    el("path", { d: `M${x0} ${base + 0.5}H${x0 + ancho}`, class: "eje" }, s2);
    texto(s2, x0, base + 22, `${xs[0]}`, {});
    texto(s2, x0 + ancho, base + 22, `${xs[xs.length - 1]}`, { "text-anchor": "end" });
    texto(s2, x0 + ancho / 2, base + 22, "plantas necesarias en cada escenario", { "text-anchor": "middle" });

    $("mc-mochila-texto").innerHTML = `Lo mismo para cada especie y cada meta a ±10 % de la referencia de INECOL. Una mochila de opción múltiple elige la combinación más barata, con la reposición esperada, que suma ${fmt(T.meta_ha)} plantas/ha.`;
    const s3 = svgEl("mc-mochila"), yr = 78, kk = 5.2, xI = 66, paso = 35;
    el("path", { d: `M${xI - 18} ${yr}H${xI + 9 * paso + 18}`, stroke: COL.tierra, "stroke-width": 1, "stroke-dasharray": "4 4" }, s3);
    texto(s3, xI - 26, yr + 5, "n₀", { "text-anchor": "end" });
    texto(s3, xI - 26, yr - 10 * kk + 5, "+10 %", { "text-anchor": "end" });
    texto(s3, xI - 26, yr + 10 * kk + 5, "−10 %", { "text-anchor": "end" });
    D.especies.forEach((e, i) => {
      const x = xI + i * paso, yy = yr - e.desvio * kk;
      el("path", { d: `M${x} ${yr - 10 * kk}V${yr + 10 * kk}M${x - 5} ${yr - 10 * kk}h10M${x - 5} ${yr + 10 * kk}h10`, stroke: COL.tierraSuave, "stroke-width": 1, fill: "none" }, s3);
      const g = el("g", { transform: `translate(${x} ${yy.toFixed(1)})` }, s3);
      el("path", { d: hexR(0, 0, 10), fill: ESP[e.ab].c, stroke: COL.tierraSuave, "stroke-width": 1, class: "elige", style: `--i:${i};--dy:${(yr - yy).toFixed(1)}px` }, g);
      texto(s3, x, yr + 10 * kk + 28, e.ab, { "text-anchor": "middle", class: "ab", style: "font-size:16px" });
    });
  }

  // ---------- Lámina 8: cómo se decide la compra ----------
  // El modelo en lenguaje llano y en ecuaciones: un objetivo y cuatro reglas, cada una con su
  // ecuación y las cifras del polígono 1. A la derecha, cómo
  // elige: lo que cuesta una planta más de cada especie (cola binomial exacta) y dónde quedó su meta.
  {
    const P = D.compra_p1, th = P.theta;
    $("fc-entrada").innerHTML = `En cada polígono, el modelo decide para cada especie <i>s</i> cuántas plantas deben quedar vivas (<i>n<sub>s</sub></i>) y cuántas comprar para lograrlo (<i>x<sub>s</sub></i>). Ejemplo: el polígono 1, de ${fmt(P.area, 2)} ha.`;
    const iv = (v, s = "s") => `<i>${v}</i><sub>${s}</sub>`, SUMA = `<span class="op">Σ</span><sub>s</sub>`;
    const n0 = `<i>n</i><sup>0</sup><sub>s</sub><i>A</i>`;
    const REGLAS = [
      ["Llegar a la densidad", `${SUMA} ${iv("n")} = ${fmt(T.meta_ha)} <i>A</i>`, `Entre todas las especies deben quedar ${fmt(P.total)} plantas: ${fmt(T.meta_ha)} por hectárea.`],
      ["Respetar la mezcla de INECOL", `${fmt(1 - P.delta, 1)} ${n0} ≤ ${iv("n")} ≤ ${fmt(1 + P.delta, 1)} ${n0}`, `Cada especie puede quedar hasta ${fmt(P.delta * 100)} % arriba o abajo de su proporción de referencia.`],
      ["Cumplir aunque algunas mueran", `P(${iv("E")} + ${iv("S")}(${iv("x")}) ≥ ${iv("n")}) ≥ ${fmt(1 - P.alfa, 2)}`, `Las que ya existen más las compradas que sobreviven alcanzan la meta en ${fmt((1 - P.alfa) * 100)} de cada 100 escenarios simulados.`, "corazon"],
      ["Caber en el presupuesto", `(1 + <i>θ</i>) ${SUMA} ${iv("c")} ${iv("x")} ≤ <i>B A</i>`, `La compra no puede pasar de ${dinero(T.presupuesto)} por hectárea. Ningún polígono lo logra (lámina 10), así que aquí se muestra la compra sin ese tope.`],
    ];
    $("reglas").innerHTML =
      `<p class="rotulo">Objetivo</p>` +
      `<div class="regla-fila objetivo"><span class="n">$</span><div><div class="regla-cabeza"><h3>Pagar lo menos posible</h3>` +
      `<span class="mat">mín (1 + <i>θ</i>) ${SUMA} ${iv("c")} (${iv("x")} + E[${iv("D")}])</span></div><p class="chico">La compra más lo que se espera gastar en reponer las que mueran el primer año. En el polígono 1: ${dinero(P.costo_compra)} de compra y ${dinero(P.costo_reposicion)} de reposición esperada.</p></div></div>` +
      `<p class="rotulo">Las reglas</p>` +
      REGLAS.map(([h, m, t, c], i) => `<div class="regla-fila ${c ?? ""}"><span class="n">${i + 1}</span><div><div class="regla-cabeza"><h3>${h}</h3><span class="mat">${m}</span></div><p class="chico">${t}</p></div></div>`).join("") +
      `<p class="glosario">${iv("c")} costo por planta · ${iv("E")} plantas que ya existen · ${iv("S")}(<i>x</i>) ~ Bin(<i>x</i>, ${iv("q")}) cuántas de <i>x</i> sobreviven · ` +
      `E[${iv("D")}] faltante esperado al año · <i>n</i><sup>0</sup><sub>s</sub> densidad de referencia · <i>A</i> hectáreas · <i>B</i> presupuesto por hectárea · <i>θ</i> = ${th} logística</p>`;

    // Lo que cuesta una planta más de cada especie, de un extremo al otro de su banda de metas.
    const costo = (e, x, d) => (1 + th) * ESP[e.ab].costo * (x + d);
    const filas = P.especies.map(e => {
      const a = e.curva[0], b = e.curva[e.curva.length - 1];
      return { e, marg: (costo(e, b[1], b[2]) - costo(e, a[1], a[2])) / (b[0] - a[0]), pos: (e.n - e.n0A) / e.n0A * 100 };
    }).sort((a, b) => a.marg - b.marg);
    $("fc-texto-eleccion").innerHTML = `Hay que repartir ${fmt(P.total)} plantas entre ${filas.length} especies. Conviene poner más de las especies cuya planta extra sale barata, porque cuesta menos o sobrevive más, y menos de las caras. El modelo revisa todas las combinaciones y se queda con la más barata.`;
    const s2 = svgEl("fc-eleccion"), B0 = 400, B1 = 740, Bp = p => B0 + (p + 10) / 20 * (B1 - B0), h = 34;
    texto(s2, 330, 16, "una planta más cuesta", { "text-anchor": "end" });
    [[-10, "menos"], [0, "referencia"], [10, "más"]].forEach(([p, t]) => texto(s2, Bp(p), 16, t, { "text-anchor": "middle" }));
    filas.forEach(({ e, marg, pos }, i) => {
      const y = 50 + i * h;
      texto(s2, 0, y + 7, e.ab, { class: "ab" });
      texto(s2, 52, y + 7, corto(ESP[e.ab].nombre), { class: "bin" });
      texto(s2, 330, y + 7, dinero(marg), { "text-anchor": "end", class: "fuerte" });
      el("path", { d: `M${Bp(-10)} ${y}H${Bp(10)}M${Bp(0)} ${y - 6}v12`, stroke: COL.tierraSuave, "stroke-width": 1, fill: "none" }, s2);
      const g = el("g", { transform: `translate(${Bp(pos).toFixed(1)} ${y})` }, s2);
      el("path", { d: hexR(0, 0, 10), fill: ESP[e.ab].c, stroke: COL.tierraSuave, "stroke-width": 1, class: "desliza", style: `--i:${i};--dx:${(Bp(0) - Bp(pos)).toFixed(1)}px` }, g);
    });
    const yb = 50 + filas.length * h;
    texto(s2, B1, yb + 8, `cada hexágono: la meta elegida, hasta ±${fmt(P.delta * 100)} %`, { "text-anchor": "end" });
    $("fc-fuente").innerHTML = `Polígono 1, ${fmt(P.area, 2)} ha · riesgo α = ${P.alfa} · logística θ = ${th}. Costo de una planta más: cola binomial exacta; metas, compra y reposición: <code>refor plan</code>, semilla 42.`;
  }

  // ---------- Lámina 19: cierre ----------
  // Las tres cifras del resumen; cada una lleva a la lámina que la respalda. Se cuentan al entrar.
  const LLEVARSE = [
    [T.B_min, dinero, `por hectárea es el presupuesto mínimo para cumplir la meta con ${fmt((1 - T.alfa) * 100)} % de probabilidad; hoy hay ${dinero(T.presupuesto)}.`, 10],
    [T.compra, fmt, `plantas para los ${T.poligonos} polígonos: ${fmt(T.compra_ha)} por hectárea, más las ${fmt(T.existentes_ha)} que ya existen.`, 9],
    [T.reduccion * 100, v => `−${fmt(v)} %`, `de competencia entre plantas vecinas frente a sembrar al azar, con ${D.mosaicos.length} claves de plantación.`, 14],
  ];
  $("llevarse").innerHTML = LLEVARSE.map(([v, f, t, n]) =>
    `<li><button data-lamina="${n}"><span class="cifra">${f(v)}</span><span class="chico">${t}<span class="rotulo">Lámina ${n} →</span></span></button></li>`).join("");
  for (const b of document.querySelectorAll("#llevarse button")) b.addEventListener("click", ev => { if (ev.detail) b.blur(); ir(+b.dataset.lamina - 1); });
  function llevarse() {
    if (reducir) return;
    document.querySelectorAll("#llevarse .cifra").forEach((e, i) => {
      const [v, f] = LLEVARSE[i], t0 = performance.now() + 450 + i * 180, dur = 1100;
      e.textContent = f(0);
      const paso = ahora => {
        const u = Math.max(0, Math.min(1, (ahora - t0) / dur));
        e.textContent = f(u < 1 ? Math.round(v * eSalida(u)) : v);
        if (u < 1 && actual === LAMINAS.length - 1) requestAnimationFrame(paso);
        else e.textContent = f(v);
      };
      requestAnimationFrame(paso);
    });
  }

  // ---------- Lámina 9: la compra ----------
  {
    $("c-titulo").textContent = `Comprar ${fmt(T.compra_ha)} plantas por hectárea; con las ${fmt(T.existentes_ha)} que ya hay se llega a ${fmt(T.densidad_ha)}`;
    const s = svgEl("g-densidad"), esc = 900 / 800, y = 34;
    el("rect", { x: 0, y, width: T.compra_ha * esc, height: 34, fill: COL.salviaHonda, class: "crece" }, s);
    el("rect", { x: T.compra_ha * esc, y, width: T.existentes_ha * esc, height: 34, fill: COL.papelHondo, stroke: COL.tierraSuave, "stroke-width": 1, class: "crece", style: "--i:6" }, s);
    el("path", { d: `M${T.meta_ha * esc} ${y - 12}V${y + 46}`, stroke: COL.tierra, "stroke-width": 1.5, "stroke-dasharray": "5 4" }, s);
    texto(s, 0, y - 10, `Compradas: ${fmt(T.compra_ha)}/ha`, { class: "fuerte" });
    texto(s, (T.compra_ha + T.existentes_ha) * esc, y - 10, `Existentes: ${fmt(T.existentes_ha)}/ha`, { "text-anchor": "end" });
    texto(s, T.meta_ha * esc, y + 66, `meta ${fmt(T.meta_ha)}`, { "text-anchor": "middle" });
    texto(s, (T.compra_ha + T.existentes_ha) * esc + 10, y + 23, `${fmt(T.densidad_ha)}`, { class: "fuerte" });
    const sobra = (T.densidad_ha / T.meta_ha - 1) * 100;
    $("c-texto").textContent = `Quedan ${fmt(sobra)} % por encima de la meta para cubrir la mortalidad. La composición se mueve dentro del margen de ±10 %: más Opuntia; menos mezquite, yuca y Agave scabra.`;

    const s2 = svgEl("g-desvio");
    const filas = [...D.especies].sort((a, b) => b.desvio - a.desvio);
    const cx = 640, u = 300 / 12, h = 36;
    filas.forEach((e, i) => {
      const y = 30 + i * h, w = Math.abs(e.desvio) * u;
      texto(s2, 0, y + 6, e.ab, { class: "ab" });
      texto(s2, 50, y + 6, corto(e.nombre), { class: "bin" });
      el("rect", { x: e.desvio >= 0 ? cx : cx - w, y: y - 11, width: w, height: 22, fill: ESP[e.ab].c, stroke: COL.tierraSuave, "stroke-width": 1, class: "crece" + (e.desvio < 0 ? " centro" : ""), style: `--i:${i}` }, s2);
      texto(s2, e.desvio >= 0 ? cx + w + 8 : cx - w - 8, y + 6, `${e.desvio > 0 ? "+" : "−"}${fmt(Math.abs(e.desvio), 1)} %`, { "text-anchor": e.desvio >= 0 ? "start" : "end", class: "fuerte" });
    });
    const yb = 30 + filas.length * h - 14;
    el("path", { d: `M${cx} 10V${yb}`, stroke: COL.tierra, "stroke-width": 1 }, s2);
    for (const d of [-10, 10]) {
      el("path", { d: `M${cx + d * u} 10V${yb}`, stroke: COL.tierraSuave, "stroke-width": 1, "stroke-dasharray": "4 4" }, s2);
      texto(s2, cx + d * u, yb + 22, `${d > 0 ? "+" : "−"}10 % (δ)`, { "text-anchor": "middle" });
    }
    texto(s2, cx, yb + 22, "0", { "text-anchor": "middle" });
  }

  // ---------- Lámina 10: frontera ----------
  {
    const s = svgEl("g-frontera");
    const fr = D.frontera, x0 = 110, x1 = 900, y0 = 360, y1 = 30, b0 = 12000, b1 = 15000;
    const X = a => x0 + (Math.log(a) - Math.log(0.01)) / (Math.log(0.5) - Math.log(0.01)) * (x1 - x0);
    const Y = b => y0 - (b - b0) / (b1 - b0) * (y0 - y1);
    const curva = fr.map(([a, b]) => `${X(a).toFixed(1)} ${Y(b).toFixed(1)}`).join("L");
    el("path", { d: `M${curva}L${X(0.5)} ${Y(T.presupuesto)}L${X(0.01)} ${Y(T.presupuesto)}Z`, fill: COL.ocre, "fill-opacity": 0.35 }, s);
    for (const b of [12000, 13000, 14000, 15000]) {
      el("path", { d: `M${x0 - 6} ${Y(b)}H${x0}`, class: "eje" }, s);
      texto(s, x0 - 12, Y(b) + 5, dinero(b), { "text-anchor": "end" });
    }
    el("path", { d: `M${x0} ${y1}V${y0}H${x1}`, class: "eje" }, s);
    for (const a of [0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.5]) {
      el("path", { d: `M${X(a)} ${y0}v6`, class: "eje" }, s);
      texto(s, X(a), y0 + 26, `${fmt(a * 100)} %`, { "text-anchor": "middle" });
    }
    texto(s, x1, y0 + 56, "riesgo admisible α (escala logarítmica)", { "text-anchor": "end" });
    el("path", { d: `M${x0} ${Y(T.presupuesto)}H${x1}`, stroke: COL.ocreHondo, "stroke-width": 2, "stroke-dasharray": "8 6" }, s);
    texto(s, x1, Y(T.presupuesto) + 26, `Presupuesto disponible: ${dinero(T.presupuesto)}/ha`, { "text-anchor": "end" }).style.fill = COL.ocreHondo;
    const linea = el("path", { d: `M${curva}`, fill: "none", stroke: COL.tierra, "stroke-width": 2.5, class: "traza" }, s);
    linea.style.setProperty("--largo", 1200);
    fr.forEach(([a, b]) => el("circle", { cx: X(a), cy: Y(b), r: a === T.alfa ? 6 : 4, fill: COL.tierra }, s));
    const [aI, bI] = fr[0], [aF, bF] = fr[fr.length - 1], b5 = fr.find(f => f[0] === T.alfa)[1];
    texto(s, X(aI) + 8, Y(bI) - 14, `${dinero(bI)} con α = 1 %`, { class: "fuerte" });
    texto(s, X(aF), Y(bF) - 16, `${dinero(bF)} con α = 50 %`, { class: "fuerte", "text-anchor": "end" });
    texto(s, X(T.alfa), Y(b5) + 30, `${dinero(b5)} con α = 5 %`, { "text-anchor": "middle" });
    texto(s, (X(0.01) + X(0.5)) / 2, (Y(T.presupuesto) + Y(b5)) / 2 + 6, `faltan ${dinero(b5 - T.presupuesto)} por hectárea`, { "text-anchor": "middle", class: "fuerte" });
    const ahorro = (bI - bF) / bI * 100;
    const p1 = pols.find(p => p.p === 1), p4 = pols.find(p => p.p === 4);
    $("p-texto").innerHTML = `Aceptar 50 veces más riesgo (α de 1 % a 50 %) solo baja el mínimo ${fmt(ahorro, 1)} %. Para los ${fmt(T.area)} ha faltan unos ${dinero(Math.round((T.B_min - T.presupuesto) * T.area / 1000) * 1000)}. Los polígonos 1 y 4, los más chicos, son los más caros: ${dinero(p1.Bmin)} y ${dinero(p4.Bmin)} por hectárea.`;
    $("rec-presupuesto").textContent = `Con ${dinero(T.presupuesto)}/ha ningún polígono cumple la meta con 95 % de probabilidad. Hacen falta ${dinero(T.B_min)}/ha, o bien revisar la meta de ${T.meta_ha} plantas por hectárea.`;
  }

  // ---------- Lámina 11: matriz de competencia ----------
  // Rampa secuencial con cortes redondos: la clase alta son justo los valores mayores que 1.
  {
    const s = svgEl("g-matriz"), abs = D.especies.map(e => e.ab);
    const cortes = [0.3, 0.5, 0.7, 1];
    const x0 = 300, y0 = 76, cw = 70, ch = 56, n = abs.length;
    abs.forEach((ab, i) => {
      const y = y0 + i * ch + ch / 2;
      muestraHex(s, 12, y, 12, ESP[ab].c);
      texto(s, 34, y + 7, ab, { class: "ab" });
      texto(s, 84, y + 7, corto(ESP[ab].nombre), { class: "bin" });
      const x = x0 + i * cw + cw / 2;
      muestraHex(s, x, 16, 12, ESP[ab].c);
      texto(s, x, 60, ab, { class: "ab", "text-anchor": "middle" });
    });
    const celdas = el("g", {}, s);
    abs.forEach((a, i) => abs.forEach((b, j) => {
      const w = W(a, b), k = clasif(w, cortes);
      const g = el("g", { class: "celda" }, celdas);
      g.dataset.a = a; g.dataset.b = b;
      el("rect", { x: x0 + j * cw, y: y0 + i * ch, width: cw, height: ch, fill: RAMPA[k], stroke: COL.tierraSuave, "stroke-width": 0.75 }, g);
      texto(g, x0 + j * cw + cw / 2, y0 + i * ch + ch / 2 + 8, fmt(w, 2), { "text-anchor": "middle", style: `font-size:var(--t-s);fill:${TXT[RAMPA_T[k]]}${w > 1 ? ";font-weight:500" : ""}` });
    }));
    // El mezquite, fila y columna, con el contorno de resaltado.
    const iP = abs.indexOf("Pla");
    el("rect", { x: x0, y: y0 + iP * ch, width: n * cw, height: ch, class: "resalte", fill: "none" }, s);
    el("rect", { x: x0 + iP * cw, y: y0, width: cw, height: n * ch, class: "resalte", fill: "none" }, s);
    const marca = el("rect", { width: cw, height: ch, class: "resalte", fill: "none", visibility: "hidden", "pointer-events": "none" }, s);

    // Escala de 0 a 1.5 en las clases de la rampa, con una marca por pareja de especies. Los
    // hitos salen de la fórmula: sin traslape (0), traslape pleno (1) y traslape pleno de la misma especie (γ = 1.5).
    const pares = abs.flatMap((a, i) => abs.slice(i).map(b => ({ a, b, w: W(a, b) })));
    const yb = y0 + n * ch + 58, X = w => w / 1.5 * 1000, lim = [0, ...cortes, 1.5];
    texto(s, 0, yb - 22, "Penalización W: cada marca es una pareja de especies", { class: "fuerte" });
    RAMPA.forEach((c, k) => el("rect", { x: X(lim[k]), y: yb, width: X(lim[k + 1]) - X(lim[k]), height: 14, fill: c, stroke: COL.tierraSuave, "stroke-width": 0.75 }, s));
    for (const p of pares) el("path", { d: `M${X(p.w).toFixed(1)} ${yb - 9}v8`, stroke: COL.tierra, "stroke-width": 1.25 }, s);
    const hitos = [
      [0, "start", "0 · no compiten", "copas o raíces que no se alcanzan"],
      [1, "end", "1 · competencia plena", "dos especies, copas y raíces juntas"],
      [1.5, "end", "1.5 · el máximo", "lo mismo, de la misma especie"],
    ];
    for (const [w, ancla, t1, t2] of hitos) {
      el("path", { d: `M${X(w)} ${yb}v22`, stroke: COL.tierra, "stroke-width": 1.25 }, s);
      texto(s, X(w), yb + 42, t1, { class: "fuerte", "text-anchor": ancla });
      texto(s, X(w), yb + 62, t2, { "text-anchor": ancla });
    }

    celdas.addEventListener("pointermove", ev => {
      const g = ev.target.closest(".celda");
      if (!g) return;
      const { a, b } = g.dataset, r = g.firstChild;
      marca.setAttribute("x", r.getAttribute("x")); marca.setAttribute("y", r.getAttribute("y")); marca.setAttribute("visibility", "visible");
      const [x, y] = aLienzo(ev.clientX, ev.clientY);
      const par = a === b ? `Dos <i>${ESP[a].nombre}</i> vecinas` : `<i>${ESP[a].nombre}</i> junto a <i>${ESP[b].nombre}</i>`;
      mostrarEtiqueta(`<span class="titulo">${par}</span><span class="valor">W = ${fmt(W(a, b), 2)}</span>`, x, y);
    });
    celdas.addEventListener("pointerleave", () => { marca.setAttribute("visibility", "hidden"); ocultarEtiqueta(); });

    const altos = pares.filter(p => p.w > 1);
    const conSuculentas = D.especies.filter(e => e.genero !== "Otras").map(e => W("Pla", e.ab));
    $("w-texto").innerHTML = `Los ${altos.length} valores mayores que 1 son de una especie junto a sí misma. El mezquite va de ${fmt(W("Pla", "Pla"), 2)} junto a otro mezquite a <span class="num" style="white-space: nowrap">${fmt(Math.min(...conSuculentas), 2)}–${fmt(Math.max(...conSuculentas), 2)}</span> junto a agaves y nopales, por su raíz profunda y su efecto nodriza.`;
  }

  // ---------- Lámina 12: los modelos de asignación ----------
  {
    const m1 = D.mosaicos[0], plano = m1.clave.flat();
    const [par, wMax] = Object.entries(D.W).sort((a, b) => b[1] - a[1])[0];
    const [pa, pb] = par.split("|");
    const pareja = pa === pb ? `dos <i>${corto(ESP[pa].nombre)}</i>` : `<i>${corto(ESP[pa].nombre)}</i> con <i>${corto(ESP[pb].nombre)}</i>`;
    $("ma-problema").innerHTML = `La compra se reparte en ${N} lugares que se repiten sobre el polígono. Cada planta tiene seis vecinas y <i>W</i> mide cuánto compite cada pareja; la que más, ${pareja} (${fmt(wMax, 2)}).`;

    // Un recorte de la clave 1 alrededor de una planta de esa especie, con sus seis vecinas.
    const r = 22, s1 = svgEl("ma-vecinas"), cx = 200, cy = 66;
    let v0 = plano.findIndex((ab, v) => ab === pa && Math.floor(v / C) >= 1 && Math.floor(v / C) <= 2 && v % C >= 3 && v % C <= 9);
    if (v0 < 0) v0 = C + 6;
    const f0 = Math.floor(v0 / C), c0 = v0 % C;
    const esVecina = (df, dc) => DF.some((d, j) => d === df && DC[j] === dc);
    for (let df = -1; df <= 1; df++) for (let dc = -5; dc <= 5; dc++) {
      const x = cx + R3 * (dc + 0.5 * df) * r, y = cy + 1.5 * df * r;
      if (Math.abs(x - cx) > 3.6 * R3 * r) continue;
      const ab = plano[envolver(f0 + df, c0 + dc)], foco = (!df && !dc) || esVecina(df, dc);
      const g = el("g", { opacity: foco ? 1 : 0.4 }, s1);
      el("path", { d: hexR(x, y, r), fill: ESP[ab].c, stroke: COL.tierraSuave, "stroke-width": 0.75 }, g);
      texto(g, x, y + 5.5, ab, { "text-anchor": "middle", style: `font-size:15px;font-weight:500;fill:${TXT[ESP[ab].t]}` });
    }
    let suma = 0;
    DF.forEach((df, j) => {
      const w = W(pa, plano[envolver(f0 + df, c0 + DC[j])]), dx = R3 * (DC[j] + 0.5 * df) * r, dy = 1.5 * df * r;
      suma += w;
      el("line", { x1: cx + dx * 0.34, y1: cy + dy * 0.34, x2: cx + dx * 0.66, y2: cy + dy * 0.66, stroke: COL.tierra, "stroke-linecap": "round",
        "stroke-width": (1 + 5 * (w - 0.17) / (1.5 - 0.17)).toFixed(2) }, s1);
    });
    el("path", { d: hexR(cx, cy, r), class: "resalte" }, s1);
    texto(s1, cx, 150, `Este ${corto(ESP[pa].nombre)} con sus 6 vecinas: ${fmt(suma, 2)}`, { "text-anchor": "middle", class: "fuerte" });
    texto(s1, cx, 172, "La clave suma la competencia de todas las parejas vecinas.", { "text-anchor": "middle" });

    // Un intercambio de la búsqueda tabú: dos plantas de la fila 1 cambian de lugar.
    const s2 = svgEl("ma-cambio"), fila = m1.clave[0].slice(0, 7), ya = 62, xa = i => 200 + (i - 3) * R3 * r;
    const [i1, i2] = [1, 4], final = fila.slice();
    [final[i1], final[i2]] = [final[i2], final[i1]];
    el("path", { d: `M${xa(i1)} ${ya - 30}Q${(xa(i1) + xa(i2)) / 2} ${ya - 72} ${xa(i2)} ${ya - 30}M${xa(i1) + 9} ${ya - 40}l-9 10l-1 -13M${xa(i2) - 9} ${ya - 40}l9 10l1 -13`,
      fill: "none", stroke: COL.tierra, "stroke-width": 1.5, "stroke-linecap": "round", "stroke-linejoin": "round", class: "aparece-tarde" }, s2);
    final.forEach((ab, i) => {
      const mueve = i === i1 || i === i2;
      const g = el("g", mueve ? { class: "cambia", style: `--dx:${(xa(i === i1 ? i2 : i1) - xa(i)).toFixed(1)}px;--arco:${i === i1 ? 24 : -24}px` } : {}, s2);
      el("path", { d: hexR(xa(i), ya, r), fill: ESP[ab].c, stroke: mueve ? COL.ocreHondo : COL.tierraSuave, "stroke-width": mueve ? 2.5 : 0.75 }, g);
      texto(g, xa(i), ya + 5.5, ab, { "text-anchor": "middle", style: `font-size:15px;font-weight:500;fill:${TXT[ESP[ab].t]}` });
    });
    texto(s2, 200, 128, "La composición no cambia: solo dónde va cada planta.", { "text-anchor": "middle" });

    // Azar, memético y la cota del modelo exacto en la clave 1.
    const ex = m1.exacto, s3 = svgEl("ma-brecha"), X = x => 16 + (x - 70) / 26 * 368, ym = 62, eje = 124;
    $("ma-exacto").innerHTML = ex
      ? `Un modelo entero (HiGHS) parte de la mejor clave del memético y busca una mejor durante ${fmt(ex.segundos)} s. Su cota inferior dice cuánto podría faltar: en la clave 1, a lo más ${fmt(ex.brecha, 1)} %.`
      : "Un modelo entero (HiGHS) parte de la mejor clave del memético y busca una mejor. Falta correr <code>refor plan --exacto</code> para medir la brecha.";
    el("path", { d: `M${X(70)} ${eje}H${X(96)}`, class: "eje" }, s3);
    for (const v of [70, 75, 80, 85, 90, 95]) { el("path", { d: `M${X(v)} ${eje}v5`, class: "eje" }, s3); texto(s3, X(v), eje + 22, `${v}`, { "text-anchor": "middle" }); }
    el("rect", { x: X(m1.azar) - 7, y: ym - 7, width: 14, height: 14, fill: "none", stroke: COL.tierraSuave, "stroke-width": 1.25 }, s3);
    texto(s3, X(m1.azar), ym - 18, `al azar ${fmt(m1.azar, 1)}`, { "text-anchor": "middle" });
    el("rect", { x: X(m1.mejor) - 7, y: ym - 7, width: 14, height: 14, fill: COL.salviaHonda }, s3);
    texto(s3, X(m1.mejor) - 7, ym - 18, `memético ${fmt(m1.mejor, 2)}`, { class: "fuerte" });
    const flecha = el("path", { d: `M${X(m1.azar) - 12} ${ym}H${X(m1.mejor) + 12}m10 -6l-10 6l10 6`, fill: "none", stroke: COL.tierra, "stroke-width": 1.5, class: "traza" }, s3);
    flecha.style.setProperty("--largo", (X(m1.azar) - X(m1.mejor) + 40).toFixed(0));
    texto(s3, (X(m1.azar) + X(m1.mejor)) / 2, ym + 22, `−${fmt((1 - m1.coef) * 100)} %`, { "text-anchor": "middle", class: "fuerte" });
    if (ex) {
      el("path", { d: `M${X(ex.cota)} ${ym - 30}V${eje}`, stroke: COL.tierra, "stroke-width": 1.25, "stroke-dasharray": "3 3" }, s3);
      texto(s3, X(ex.cota) - 6, ym - 18, `cota ${fmt(ex.cota, 2)}`, { "text-anchor": "end" });
      el("path", { d: `M${X(ex.cota)} ${ym + 14}v6H${X(m1.mejor)}v-6`, fill: "none", stroke: COL.tierraSuave, "stroke-width": 1 }, s3);
      texto(s3, X(ex.cota) + 6, ym + 38, `brecha ≤ ${fmt(ex.brecha, 1)} %`, { "text-anchor": "start" });
    }
  }

  // ---------- Lámina 13: cómo funciona el memético ----------
  // Una generación con la composición de la clave 1: población al azar, torneo, cruce, búsqueda
  // tabú y reemplazo. Las claves salen del azar con semilla fija y su competencia se calcula con
  // W, como en refor (las vecinas envuelven: el mosaico se repite).
  {
    const s = svgEl("memetico"), m1 = D.mosaicos[0], comp = m1.clave.flat();
    const VEC = Array.from({ length: N }, (_, v) => DF.map((df, j) => envolver(Math.floor(v / C) + df, v % C + DC[j])));
    const total = a => { let t = 0; for (let v = 0; v < N; v++) for (const u of VEC[v]) if (u > v) t += W(a[v], a[u]); return t; };
    const r = mulberry32(2026);
    const barajar = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const pob = Array.from({ length: 20 }, () => { const a = barajar(comp); return { a, v: total(a) }; });

    // Cruce (src/memetico/memetico.hpp): alternando padres, el hijo hereda la especie con más
    // lugares libres en el padre en turno; lo que nadie heredó se llena con la que menos compite.
    function cruzar(A, B) {
      const hijo = Array(N).fill(null), origen = Array(N).fill(0), falta = {};
      for (const sp of comp) falta[sp] = (falta[sp] || 0) + 1;
      for (let turno = 0, sin = 0; sin < 2; turno++) {
        const Pd = turno % 2 ? B : A;
        let mejor = null, nm = 0;
        for (const sp of Object.keys(falta)) {
          if (!falta[sp]) continue;
          const libres = Pd.reduce((n, x, v) => n + (x === sp && hijo[v] === null), 0);
          if (libres > nm) { nm = libres; mejor = sp; }
        }
        if (!mejor) { sin++; continue; }
        sin = 0;
        for (let v = 0; v < N && falta[mejor]; v++) if (Pd[v] === mejor && hijo[v] === null) { hijo[v] = mejor; origen[v] = 1 + turno % 2; falta[mejor]--; }
      }
      for (let v = 0; v < N; v++) if (hijo[v] === null) {
        let mejor = null, dm = Infinity;
        for (const sp of Object.keys(falta)) if (falta[sp]) {
          const d = VEC[v].reduce((t, u) => t + (hijo[u] ? W(sp, hijo[u]) : 0), 0);
          if (d < dm) { dm = d; mejor = sp; }
        }
        hijo[v] = mejor; falta[mejor]--;
      }
      return { a: hijo, origen };
    }
    // Búsqueda tabú (src/memetico/tabu.hpp): el mejor intercambio no prohibido; deshacerlo queda
    // prohibido de 5 a 15 pasos, salvo que dé una nueva mejor clave. Devuelve la historia.
    function tabu(a0, sinMejoraMax = 150) {
      const a = a0.slice(), hist = [];
      let val = total(a), mejor = val, mejorA = a.slice(), sin = 0;
      const prohibido = new Map();
      const delta = (i, j) => {
        let d = 0;
        for (const u of VEC[i]) if (u !== j) d += W(a[j], a[u]) - W(a[i], a[u]);
        for (const u of VEC[j]) if (u !== i) d += W(a[i], a[u]) - W(a[j], a[u]);
        return d;
      };
      hist.push(val);
      for (let it = 0; sin < sinMejoraMax && it < 800; it++) {
        let mov = null;
        for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
          if (a[i] === a[j]) continue;
          const d = delta(i, j), veda = (prohibido.get(i + a[j]) ?? -1) > it || (prohibido.get(j + a[i]) ?? -1) > it;
          if (veda && val + d >= mejor - 1e-9) continue;
          if (!mov || d < mov.d) mov = { i, j, d };
        }
        if (!mov) break;
        const veda = it + 5 + Math.floor(r() * 11);
        prohibido.set(mov.i + a[mov.i], veda); prohibido.set(mov.j + a[mov.j], veda);
        [a[mov.i], a[mov.j]] = [a[mov.j], a[mov.i]];
        val += mov.d;
        if (val < mejor - 1e-9) { mejor = val; mejorA = a.slice(); sin = 0; } else sin++;
        hist.push(val);
      }
      return { a: mejorA, v: mejor, hist };
    }

    const R4 = 4, R5 = 5, Y0 = 250;
    // Población
    pob.forEach((p, i) => tiempo(miniatura(s, p.a, 96 + (i % 4) * 116, Y0 + Math.floor(i / 4) * 42, R4), i * 25).classList.add("aparece"));
    $("est-0").style.cssText = "left:96px;top:470px;width:440px;--t:0ms";
    flecha(s, `M556 ${Y0 + 97}H604`, 600, 250, [610, Y0 + 97, 0]);

    // 1. Torneo: dos duelos entre claves al azar.
    const elegir = () => pob[Math.floor(r() * pob.length)];
    const duelos = [0, 1].map(() => { const a = elegir(); let b = elegir(); while (b === a) b = elegir(); return [a, b]; });
    duelos.forEach((par, k) => {
      const y = Y0 + 8 + k * 100, gana = par[0].v <= par[1].v ? 0 : 1;
      par.forEach((p, j) => {
        const x = 620 + j * 146;
        tiempo(miniatura(s, p.a, x, y, R4), 750 + k * 120).classList.add("aparece");
        tiempo(texto(s, x + 50, y + 46, fmt(p.v, 1), { class: j === gana ? "fuerte aparece" : "aparece" }), 750 + k * 120);
        if (j === gana) tiempo(el("rect", { x: x - 6, y: y - 6, width: 112.4, height: 38, rx: 2, fill: "none", stroke: COL.ocreHondo, "stroke-width": 2.5, class: "aparece" }, s), 1150 + k * 120);
      });
      tiempo(texto(s, 743, y + 18, "o", { class: "aparece" }), 750 + k * 120);
    });
    $("est-1").style.cssText = "left:620px;top:470px;width:250px;--t:750ms";
    const [pa, pb] = duelos.map(par => (par[0].v <= par[1].v ? par[0] : par[1]));
    flecha(s, `M878 ${Y0 + 66}H912`, 1350, 200, [918, Y0 + 66, 0]);

    // 2. Cruce: lo heredado de cada padre se ve pleno; lo demás, tenue.
    const cruce = cruzar(pa.a, pb.a), vh = total(cruce.a);
    tiempo(miniatura(s, pa.a, 928, Y0, R5, v => (cruce.origen[v] === 1 ? 1 : 0.22)), 1450).classList.add("aparece");
    tiempo(miniatura(s, pb.a, 1078, Y0, R5, v => (cruce.origen[v] === 2 ? 1 : 0.22)), 1450).classList.add("aparece");
    tiempo(texto(s, 991, Y0 + 52, "padre A", { class: "aparece" }), 1450);
    tiempo(texto(s, 1141, Y0 + 52, "padre B", { class: "aparece" }), 1450);
    flecha(s, `M991 ${Y0 + 62}Q991 ${Y0 + 92} 1040 ${Y0 + 104}`, 1650, 220, [1046, Y0 + 106, 0.25]);
    flecha(s, `M1141 ${Y0 + 62}Q1141 ${Y0 + 92} 1092 ${Y0 + 104}`, 1650, 220, [1086, Y0 + 106, Math.PI - 0.25]);
    tiempo(miniatura(s, cruce.a, 1003, Y0 + 112, R5), 1850).classList.add("aparece");
    tiempo(texto(s, 1066, Y0 + 166, `hijo · ${fmt(vh, 1)}`, { class: "fuerte aparece" }), 1850);
    $("est-2").style.cssText = "left:920px;top:470px;width:290px;--t:1450ms";
    flecha(s, `M1218 ${Y0 + 66}H1252`, 2100, 200, [1258, Y0 + 66, 0]);

    // 3. Búsqueda tabú: la competencia del hijo, intercambio tras intercambio.
    const tb = tabu(cruce.a), h = tb.hist, hmin = Math.min(...h), hmax = Math.max(...h);
    const SX = i => 1270 + i / (h.length - 1) * 250, SY = v => Y0 + 20 + (hmax - v) / (hmax - hmin) * 120;
    trazo(s, "M" + h.map((v, i) => `${SX(i).toFixed(1)} ${SY(v).toFixed(1)}`).join("L"), 2200, 900, { "stroke-width": 1.5 });
    tiempo(el("path", { d: `M1270 ${Y0 + 150}H1520`, class: "eje aparece" }, s), 2200);
    tiempo(texto(s, 1276, SY(h[0]) - 8, fmt(h[0], 1), { class: "rotulo-izq aparece" }), 2200);
    tiempo(texto(s, 1520, SY(tb.v) - 10, fmt(tb.v, 1), { class: "rotulo-der fuerte aparece" }), 3100);
    tiempo(texto(s, 1270, Y0 + 170, `${h.length - 1} intercambios`, { class: "rotulo-izq aparece" }), 2200);
    $("est-3").style.cssText = "left:1260px;top:470px;width:270px;--t:2200ms";
    flecha(s, `M1546 ${Y0 + 66}H1584`, 3200, 200, [1590, Y0 + 66, 0]);

    // 4. Reemplazo: el hijo pulido sustituye a la peor clave.
    const peor = pob.reduce((a, b) => (b.v > a.v ? b : a));
    tiempo(miniatura(s, peor.a, 1600, Y0 + 8, R4), 3300).classList.add("aparece");
    tiempo(texto(s, 1712, Y0 + 26, `peor · ${fmt(peor.v, 1)}`, { class: "rotulo-izq aparece" }), 3300);
    trazo(s, `M1596 ${Y0 + 4}L1704 ${Y0 + 38}M1704 ${Y0 + 4}L1596 ${Y0 + 38}`, 3550, 250, { "stroke-width": 1.5 });
    flecha(s, `M1650 ${Y0 + 50}V${Y0 + 92}`, 3650, 200, [1650, Y0 + 98, Math.PI / 2]);
    tiempo(miniatura(s, tb.a, 1600, Y0 + 108, R4), 3800).classList.add("aparece");
    tiempo(el("rect", { x: 1594, y: Y0 + 102, width: 112.4, height: 38, rx: 2, fill: "none", stroke: COL.ocreHondo, "stroke-width": 2.5, class: "aparece" }, s), 3800);
    tiempo(texto(s, 1712, Y0 + 126, `hijo · ${fmt(tb.v, 1)}`, { class: "rotulo-izq fuerte aparece" }), 3800);
    $("est-4").style.cssText = "left:1590px;top:470px;width:234px;--t:3300ms";

    // De vuelta a la población: una generación.
    flecha(s, "M1707 710V758Q1707 786 1679 786H348Q320 786 320 758V618", 4000, 1000, [320, 612, -Math.PI / 2]);
    tiempo(texto(s, 1010, 816, "Eso es una generación. Se repite hasta 100 generaciones sin mejora, o 1,000 en total.", { class: "aparece" }), 4700);
    $("mm-pie").innerHTML = `Cada clave se resuelve con 30 corridas independientes, cada una con su semilla. En la clave 1 terminan en ${fmt(m1.media, 2)} ± ${fmt(m1.de, 3)}: todas llegan prácticamente al mismo valor.`;
    $("mm-pie").style.setProperty("--t", "4800ms");
  }

  // ---------- Lámina 15: cómo funciona el modelo exacto ----------
  // Tres ideas sin fórmulas: cuántas claves hay, ramificar y podar, y el techo y el piso de la clave 1.
  {
    const s = svgEl("exacto"), m1 = D.mosaicos[0], plano = m1.clave.flat();
    $("ex-b1").style.cssText = "position:absolute;left:96px;top:220px;width:800px;--t:0ms";
    $("ex-b2").style.cssText = "position:absolute;left:96px;top:600px;width:800px;--t:1200ms";
    $("ex-b3").style.cssText = "position:absolute;left:980px;top:220px;width:844px;--t:2200ms";

    // 1. Cuántas maneras hay de acomodar las mismas plantas: 52! / (n₁! n₂! …), en base 10.
    const logFact = n => { let v = 0; for (let i = 2; i <= n; i++) v += Math.log10(i); return v; };
    const cuenta = {};
    for (const ab of plano) cuenta[ab] = (cuenta[ab] ?? 0) + 1;
    const l10 = logFact(N) - Object.values(cuenta).reduce((a, n) => a + logFact(n), 0);
    const exp = Math.floor(l10), man = 10 ** (l10 - exp);
    $("ex-t1").innerHTML = `Las ${N} plantas de la clave 1 se pueden acomodar de muchísimas maneras. Revisarlas una por una, aun a mil millones por segundo, no terminaría nunca.`;
    // La clave 1 y dos reacomodos al azar de las mismas plantas, en fila, y la cuenta.
    const rnd = mulberry32(15), r = 7.4;
    const barajar = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
    [plano, barajar(plano), barajar(plano)].forEach((pl, i) => {
      const g = tiempo(el("g", { class: "aparece" }, s), 250 + i * 200);
      miniatura(g, pl, 96 + i * 222, 372, r);
    });
    tiempo(texto(s, 96 + 3 * 222 + 4, 408, "…", { class: "rotulo-izq aparece", style: "font-size:28px" }), 850);
    const tc = tiempo(texto(s, 96, 520, "", { class: "rotulo-izq aparece" }), 1000);
    tc.style.cssText = `font:400 var(--t-2xl)/1 var(--f-display);fill:${COL.tierra}`;
    tc.innerHTML = `≈ ${fmt(man, 1)} × 10<tspan dy="-26" font-size="38">${exp}</tspan>`;
    tiempo(texto(s, 430, 512, "claves distintas con las mismas plantas", { class: "rotulo-izq aparece" }), 1000);

    // 2. Ramificar y podar: esquema sin cifras.
    const NODOS = { r: [430, 790, "todas las claves"], a: [250, 860, "mezquite en el lugar 1"], b: [610, 860, "otra especie en el lugar 1"],
      aa: [170, 935, "sigue…"], ab: [330, 935, "se descarta"], ba: [530, 935, "se descarta"], bb: [690, 935, "sigue…"] };
    const RAMAS = [["r", "a", 1350], ["r", "b", 1350], ["a", "aa", 1700], ["a", "ab", 1700], ["b", "ba", 1700], ["b", "bb", 1700]];
    for (const [de, a, t] of RAMAS) {
      const [x0, y0] = NODOS[de], [x1, y1] = NODOS[a];
      trazo(s, `M${x0} ${y0}C${x0} ${(y0 + y1) / 2} ${x1} ${(y0 + y1) / 2} ${x1} ${y1}`, t, 320, { "stroke-width": 1.5 });
    }
    for (const [id, [x, y, txt]] of Object.entries(NODOS)) {
      const t = id === "r" ? 1300 : id.length === 1 ? 1670 : 2020, poda = txt === "se descarta";
      const g = tiempo(el("g", { class: "aparece" }, s), t);
      if (poda) el("path", { d: `M${x - 6} ${y - 6}l12 12m0 -12l-12 12`, stroke: COL.ocreHondo, "stroke-width": 2.5, "stroke-linecap": "round" }, g);
      else el("circle", { cx: x, cy: y, r: 6, fill: COL.tierra }, g);
      const tx = texto(g, x + 14, y + 5, txt, { class: "rotulo-izq" + (poda ? "" : " fuerte") });
      if (poda) tx.style.fill = COL.ocreHondo;
    }
    tiempo(texto(s, 800, 975, "ni en el mejor caso supera a la mejor conocida", { class: "rotulo-der aparece" }), 2150).style.fill = COL.ocreHondo;

    // 3. Techo y piso de la clave 1 sobre una regla de competencia, con el azar como referencia.
    const ex = m1.exacto;
    if (!ex) {
      $("ex-conclusion").innerHTML = "Falta correr <code>refor plan --exacto</code> para ver el techo y el piso de cada clave.";
    } else {
      const x0 = 1060, x1 = 1800, v0 = 70, v1 = 95, X = v => x0 + (v - v0) / (v1 - v0) * (x1 - x0), ye = 640, t0 = 2400;
      const techo = m1.mejor, piso = ex.cota;
      tiempo(el("rect", { x: X(piso), y: ye - 70, width: X(techo) - X(piso), height: 70, fill: COL.papelHondo, class: "aparece" }, s), t0 + 900);
      tiempo(el("path", { d: `M${x0} ${ye}H${x1}`, class: "eje aparece" }, s), t0);
      for (let v = v0; v <= v1; v += 5) {
        tiempo(el("path", { d: `M${X(v)} ${ye}v6`, class: "eje aparece" }, s), t0);
        tiempo(texto(s, X(v), ye + 28, fmt(v), { class: "aparece" }), t0);
      }
      tiempo(texto(s, x1, ye + 58, "competencia total de la clave 1 (menos es mejor)", { class: "rotulo-der aparece" }), t0);
      // Azar: la referencia. Techo: la mejor clave, que llega desde el azar. Piso: sube desde la izquierda.
      tiempo(el("circle", { cx: X(m1.azar), cy: ye - 35, r: 9, fill: COL.papel, stroke: COL.tierraSuave, "stroke-width": 1.5, class: "aparece" }, s), t0 + 150);
      tiempo(texto(s, X(m1.azar), ye - 58, `al azar ${fmt(m1.azar, 1)}`, { class: "aparece" }), t0 + 150);
      const gT = tiempo(el("g", { class: "llega", style: `--dx:${(X(m1.azar) - X(techo)).toFixed(1)}px` }, s), t0 + 350);
      el("circle", { cx: X(techo), cy: ye - 35, r: 9, fill: COL.tierra }, gT);
      texto(gT, X(techo) + 16, ye - 104, `techo ${fmt(techo, 2)}`, { class: "rotulo-izq fuerte" });
      texto(gT, X(techo) + 16, ye - 82, "la mejor clave encontrada", { class: "rotulo-izq" });
      el("path", { d: `M${X(techo)} ${ye - 96}V${ye - 50}`, stroke: COL.tierra, "stroke-width": 1 }, gT);
      const gP = tiempo(el("g", { class: "llega", style: `--dx:${(X(v0) - X(piso)).toFixed(1)}px` }, s), t0 + 550);
      el("path", { d: `M${X(piso)} ${ye - 120}V${ye}`, stroke: COL.tierra, "stroke-width": 1.5, "stroke-dasharray": "4 4" }, gP);
      texto(gP, X(piso) - 12, ye - 104, `piso ${fmt(piso, 2)}`, { class: "rotulo-der fuerte" });
      texto(gP, X(piso) - 12, ye - 82, "ninguna clave compite menos", { class: "rotulo-der" });
      tiempo(texto(s, (X(piso) + X(techo)) / 2, ye + 96, `brecha ${fmt(ex.brecha, 1)} %`, { class: "fuerte aparece" }), t0 + 1100).style.fill = COL.ocreHondo;
      tiempo(el("path", { d: `M${X(piso)} ${ye + 70}H${X(techo)}M${X(piso)} ${ye + 64}v12M${X(techo)} ${ye + 64}v12`, stroke: COL.ocreHondo, "stroke-width": 1.5, fill: "none", class: "aparece" }, s), t0 + 1100);

      const br = D.mosaicos.map(m => m.exacto?.brecha ?? 0), mejores = D.mosaicos.filter(m => m.exacto && m.exacto.valor < m.mejor - 1e-6).length;
      const seg = Math.round(Math.max(...D.mosaicos.map(m => m.exacto?.segundos ?? 0)));
      $("ex-conclusion").innerHTML = (mejores === 0
        ? `Tras ${fmt(seg / 60)} minutos por clave, el solver no encontró nada mejor que el memético.`
        : `Tras ${fmt(seg / 60)} minutos por clave, el solver mejoró ${mejores} de las ${D.mosaicos.length} claves del memético.`) +
        ` En las ${D.mosaicos.length} claves, el memético queda a lo más entre ${fmt(Math.min(...br), 1)} % y ${fmt(Math.max(...br), 1)} % de la mejor posible.`;
    }
    $("ex-conclusion").style.setProperty("--t", "3600ms");
  }

  // ---------- Lámina 16: validación ----------
  {
    const s = svgEl("g-validacion");
    const hay = D.mosaicos.every(m => m.exacto);
    const x0 = 200, u = 560 / 100, alto = 76;
    const serie = [["Azar (esperado)", "azar"], ["Memético", "mem"], ["Exacto, mejor encontrado", "ex"], ["Cota inferior del exacto", "cota"]];
    let xLeyenda = x0;
    serie.forEach(([nombre, tipo]) => {
      const x = xLeyenda, y = 8;
      xLeyenda += 32 + nombre.length * 8 + 28;
      if (tipo === "azar") el("rect", { x, y, width: 24, height: 12, fill: "none", stroke: COL.tierraSuave, "stroke-width": 1.25 }, s);
      if (tipo === "mem") el("rect", { x, y, width: 24, height: 12, fill: COL.salviaHonda }, s);
      if (tipo === "ex") el("rect", { x, y, width: 24, height: 12, fill: COL.tierra }, s);
      if (tipo === "cota") el("path", { d: `M${x + 12} ${y - 4}v20`, stroke: COL.tierra, "stroke-width": 1.5, "stroke-dasharray": "3 3" }, s);
      if (!hay && (tipo === "ex" || tipo === "cota")) { s.lastChild.remove(); return; }
      texto(s, x + 32, y + 11, nombre, {});
    });
    D.mosaicos.forEach((m, i) => {
      const y = 56 + i * alto;
      texto(s, 0, y + 14, `Clave ${m.id}`, { class: "fuerte", style: "font-size:21px" });
      texto(s, 0, y + 38, `${m.poligonos.length} ${m.poligonos.length === 1 ? "polígono" : "polígonos"}`, {});
      el("rect", { x: x0, y, width: m.azar * u, height: 16, fill: "none", stroke: COL.tierraSuave, "stroke-width": 1.25, class: "crece", style: `--i:${i}` }, s);
      el("rect", { x: x0, y: y + 20, width: m.mejor * u, height: 16, fill: COL.salviaHonda, class: "crece", style: `--i:${i}` }, s);
      texto(s, x0 + m.azar * u + 8, y + 13, fmt(m.azar, 1), {});
      texto(s, x0 + m.mejor * u + 8, y + 33, fmt(m.mejor, 2), { class: "fuerte" });
      if (m.exacto) {
        el("rect", { x: x0, y: y + 40, width: m.exacto.valor * u, height: 16, fill: COL.tierra, class: "crece", style: `--i:${i}` }, s);
        el("path", { d: `M${x0 + m.exacto.cota * u} ${y - 4}V${y + 60}`, stroke: COL.tierra, "stroke-width": 1.5, "stroke-dasharray": "3 3" }, s);
        texto(s, x0 + m.exacto.valor * u + 8, y + 53, `${fmt(m.exacto.valor, 2)} · brecha ≤ ${fmt(m.exacto.brecha, 1)} %`, {});
      }
    });
    const yb = 56 + D.mosaicos.length * alto - 12;
    el("path", { d: `M${x0} ${yb}H${x0 + 100 * u}`, class: "eje" }, s);
    for (const v of [0, 25, 50, 75, 100]) { el("path", { d: `M${x0 + v * u} ${yb}v5`, class: "eje" }, s); texto(s, x0 + v * u, yb + 24, `${v}`, { "text-anchor": "middle" }); }
    texto(s, x0 + 100 * u, yb + 50, "competencia total del mosaico (menos es mejor)", { "text-anchor": "end" });

    const red = D.mosaicos.map(m => (1 - m.coef) * 100), de = Math.max(...D.mosaicos.map(m => m.de));
    let t = `Frente al azar, la competencia baja entre ${fmt(Math.min(...red), 1)} % y ${fmt(Math.max(...red), 1)} %. En 30 corridas por clave la desviación estándar no pasa de ${fmt(de, 3)}.`;
    if (hay) {
      const br = D.mosaicos.map(m => m.exacto.brecha), mejores = D.mosaicos.filter(m => m.exacto.valor < m.mejor - 1e-6).length;
      const seg = Math.round(Math.min(...D.mosaicos.map(m => m.exacto.segundos)));
      t += mejores === 0
        ? ` Con al menos ${seg} s por clave, el modelo entero no encontró ninguna clave mejor; su cota inferior deja al memético a lo más entre ${fmt(Math.min(...br), 1)} % y ${fmt(Math.max(...br), 1)} % del óptimo.`
        : ` El modelo entero mejoró ${mejores} de las 6 claves; la brecha del memético queda entre ${fmt(Math.min(...br), 1)} % y ${fmt(Math.max(...br), 1)} %.`;
      $("v-fuente").innerHTML = "Fuente: <code>refor plan --exacto</code> (HiGHS, límite de 300 s por clave), semilla 42.";
    } else {
      t += " La comparación con el modelo entero está pendiente: falta correr <code>refor plan --exacto</code>.";
      $("v-fuente").innerHTML = "Fuente: <code>refor plan</code>, semilla 42.";
    }
    $("v-texto").innerHTML = t;
  }

  // ================= Lámina 14: el mosaico =================
  const Mos = (() => {
    const m1 = D.mosaicos[0];
    const optima = m1.clave.flat();
    const vecinas = v => { const f = Math.floor(v / C), c = v % C; return DF.map((df, i) => ({ f: f + df, c: c + DC[i], i: envolver(f + df, c + DC[i]) })); };
    const local = (arr, v) => vecinas(v).reduce((s, u) => s + W(arr[v], arr[u.i]), 0);
    const total = arr => { let t = 0; for (let v = 0; v < N; v++) for (const u of vecinas(v)) if (u.i > v) t += W(arr[v], arr[u.i]); return t; };
    const azar = optima.slice();
    { const r = mulberry32(42); for (let i = N - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [azar[i], azar[j]] = [azar[j], azar[i]]; } }
    const totalAzar = total(azar), totalOpt = total(optima);
    const lugar = v => centroLocal(Math.floor(v / C), v % C);

    const fichas = [];
    {
      const libres = {};
      optima.forEach((s, v) => (libres[s] ||= []).push(v));
      azar.forEach((s, v) => {
        const [x0, y0] = lugar(v);
        let mejor = 0, dmin = Infinity;
        libres[s].forEach((u, i) => { const [x1, y1] = lugar(u), d = (x1 - x0) ** 2 + (y1 - y0) ** 2; if (d < dmin) { dmin = d; mejor = i; } });
        fichas.push({ s, desde: v, hasta: libres[s].splice(mejor, 1)[0], d: Math.sqrt(dmin) });
      });
    }
    const locales = [...azar.map((_, v) => local(azar, v)), ...optima.map((_, v) => local(optima, v))];
    const lmin = Math.min(...locales), lmax = Math.max(...locales);
    const clase = x => Math.min(4, Math.floor((x - lmin) / (lmax - lmin) * 5));

    const st = { modo: "especie", replica: false, estado: "optima", animando: false, raf: 0, gen: 0 };
    const detalle = () => (R3 * R * (cam ? cam.s : CAMARAS.reticula.s) >= 32 ? "especie" : "genero");
    function colores(s, vl) {
      if (st.modo === "competencia") { const q = clase(vl); return [RAMPA[q], TXT[RAMPA_T[q]]]; }
      if (detalle() === "especie") return [ESP[s].c, TXT[ESP[s].t]];
      const g = GEN[ESP[s].genero]; return [g.c, TXT[g.t]];
    }
    for (const fi of fichas) {
      fi.g = el("g", { class: "mosaico-ficha" }, gFichas);
      fi.hex = el("path", { d: HEX, stroke: COL.tierraSuave, "stroke-width": 0.75, "vector-effect": "non-scaling-stroke" }, fi.g);
      fi.txt = el("text", { "font-size": (21 / 44).toFixed(4) }, fi.g);
      fi.txt.textContent = fi.s;
      fi.g.addEventListener("pointerenter", () => mostrar(fi));
      fi.g.addEventListener("pointerleave", ocultar);
    }
    const arreglo = () => (st.estado === "azar" ? azar : optima);
    const ranura = fi => (st.estado === "azar" ? fi.desde : fi.hasta);
    function pintar() {
      const arr = arreglo(), conTexto = detalle() === "especie";
      for (const fi of fichas) {
        const [c, t] = colores(fi.s, local(arr, ranura(fi)));
        fi.hex.setAttribute("fill", c); fi.txt.setAttribute("fill", t);
        fi.txt.style.display = conTexto ? "" : "none";
      }
      const comp = st.modo === "competencia";
      $("clave-especies").hidden = comp; $("clave-rampa").hidden = !comp;
      $("clave-especies").querySelectorAll("path").forEach((p, i) => {
        const ab = Object.keys(ESP)[i]; p.setAttribute("fill", detalle() === "especie" ? ESP[ab].c : GEN[ESP[ab].genero].c);
      });
    }
    function colocar(p = null) {
      for (const fi of fichas) {
        let x, y;
        if (p === null) [x, y] = lugar(ranura(fi));
        else { const [a, b] = lugar(fi.desde), [c, d] = lugar(fi.hasta), q = p(fi); x = a + (c - a) * q; y = b + (d - b) * q; }
        fi.g.setAttribute("transform", `translate(${x.toFixed(4)} ${y.toFixed(4)})`);
      }
    }
    function copias() {
      gCopias.replaceChildren();
      if (!st.replica || st.animando) return;
      const arr = arreglo();
      for (let df = -1; df <= 1; df++) for (let dc = -1; dc <= 1; dc++) {
        if (!df && !dc) continue;
        for (let v = 0; v < N; v++) {
          const [x, y] = centroLocal(Math.floor(v / C) + df * F, (v % C) + dc * C);
          el("path", { d: HEX, transform: `translate(${x} ${y})`, fill: colores(arr[v], local(arr, v))[0], stroke: COL.tierraSuave, "stroke-width": 0.75, "vector-effect": "non-scaling-stroke" }, gCopias);
        }
      }
    }
    const PX = 380 / 100;
    $("barra-azar").style.width = m1.azar * PX + "px";
    $("valor-azar").textContent = fmt(m1.azar, 1);
    function comparacion(valor) {
      $("barra-actual").style.width = valor * PX + "px";
      $("valor-actual").textContent = fmt(valor, 1);
      const dif = (valor / m1.azar - 1) * 100;
      if (st.estado === "optima" && !st.animando) {
        $("nombre-actual").textContent = "Clave 1, optimizada";
        $("nota-comparacion").textContent = `${fmt(Math.abs(dif))} % menos que al azar. En 30 corridas del memético: ${fmt(m1.media, 2)} ± ${fmt(m1.de, 3)}.`;
      } else {
        $("nombre-actual").textContent = st.animando ? "Reordenando" : "Esta asignación al azar";
        $("nota-comparacion").textContent = `${fmt(Math.abs(dif))} % ${dif >= 0 ? "más" : "menos"} que el valor esperado al azar.`;
      }
    }
    function detener() {
      cancelAnimationFrame(st.raf);
      st.gen++;
      st.animando = false;
      $("btn-reordenar").disabled = false;
    }
    function ponerOptima() {
      detener(); st.estado = "optima";
      pintar(); colocar(); comparacion(totalOpt); copias();
    }
    function reordenar() {
      detener(); ocultar();
      st.estado = "azar";
      pintar(); colocar(); copias(); comparacion(totalAzar);
      if (reducir) return ponerOptima();
      const dmax = Math.max(...fichas.map(f => f.d)) || 1;
      for (const fi of fichas) { if (fi.s === "Pla") { fi.ret = 0; fi.dur = 1100; } else { fi.ret = 650 + 450 * fi.d / dmax; fi.dur = 1400; } }
      const fin = Math.max(...fichas.map(f => f.ret + f.dur)), gen = st.gen;
      st.animando = true; $("btn-reordenar").disabled = true;
      const t0 = performance.now() + 500, pintadas = new Set();
      const cuadro = ahora => {
        if (gen !== st.gen) return;
        const t = ahora - t0;
        colocar(fi => eCamara(Math.min(1, Math.max(0, (t - fi.ret) / fi.dur))));
        if (st.modo === "competencia") for (const fi of fichas) if (!pintadas.has(fi) && t >= fi.ret + fi.dur) {
          pintadas.add(fi); const [c, tx] = colores(fi.s, local(optima, fi.hasta)); fi.hex.setAttribute("fill", c); fi.txt.setAttribute("fill", tx);
        }
        comparacion(totalAzar + (totalOpt - totalAzar) * eSalida(Math.min(1, Math.max(0, t / fin))));
        if (t < fin) st.raf = requestAnimationFrame(cuadro);
        else { st.animando = false; ponerOptima(); }
      };
      st.raf = requestAnimationFrame(cuadro);
    }
    function mostrar(fi) {
      if (st.animando) return;
      const arr = arreglo(), v = ranura(fi), f = Math.floor(v / C), c = v % C, [x, y] = centroLocal(f, c);
      gResalteFicha.setAttribute("transform", `translate(${x} ${y})`);
      gResalteFicha.setAttribute("visibility", "visible");
      gVecinas.replaceChildren();
      for (const u of vecinas(v)) {
        const [x1, y1] = centroLocal(u.f, u.c), w = W(arr[v], arr[u.i]);
        const fuera = u.f < 0 || u.f >= F || u.c < 0 || u.c >= C, t1 = fuera ? 0.5 : 0.72;
        el("line", { x1: x + (x1 - x) * .28, y1: y + (y1 - y) * .28, x2: x + (x1 - x) * t1, y2: y + (y1 - y) * t1,
          "stroke-width": (1 + 5 * (w - 0.17) / (1.5 - 0.17)).toFixed(2), "vector-effect": "non-scaling-stroke", "stroke-dasharray": fuera ? "2 4" : null }, gVecinas);
      }
      const b = fi.hex.getBoundingClientRect(), [lx, ly] = aLienzo(b.left + b.width / 2, b.top + b.height / 2);
      mostrarEtiqueta(
        `<span class="titulo binomial">${ESP[fi.s].nombre}</span>` +
        `<span class="rotulo">${ESP[fi.s].genero} · fila ${f + 1}, posición ${c + 1}</span>` +
        `<span class="valor">Competencia con sus 6 vecinas: ${fmt(local(arr, v), 2)}</span>` +
        `<span class="rotulo">Vecinas: ${vecinas(v).map(u => arr[u.i]).join(", ")}</span>`, lx, ly, b.width / k * 0.6);
    }
    function ocultar() { ocultarEtiqueta(); gResalteFicha.setAttribute("visibility", "hidden"); gVecinas.replaceChildren(); }

    // Claves (leyendas) de especie y de competencia.
    {
      const ul = $("clave-especies");
      for (const [ab, e] of Object.entries(ESP)) {
        const li = document.createElement("li");
        const s = el("svg", { width: 22, height: 25, viewBox: "-1 -1.1 2 2.2", "aria-hidden": "true" });
        el("path", { d: HEX, fill: e.c, stroke: COL.tierraSuave, "stroke-width": 1, "vector-effect": "non-scaling-stroke" }, s);
        li.appendChild(s);
        li.insertAdjacentHTML("beforeend", `<b>${ab}</b><span class="binomial">${corto(e.nombre)}</span>`);
        ul.appendChild(li);
      }
      const ur = $("clave-rampa");
      ur.insertAdjacentHTML("beforeend", '<li><span class="titulo">Competencia de cada planta con sus 6 vecinas</span></li>');
      for (let q = 0; q < 5; q++) {
        const li = document.createElement("li");
        const s = el("svg", { width: 22, height: 25, viewBox: "-1 -1.1 2 2.2", "aria-hidden": "true" });
        el("path", { d: HEX, fill: RAMPA[q], stroke: COL.tierraSuave, "stroke-width": 1, "vector-effect": "non-scaling-stroke" }, s);
        li.appendChild(s);
        li.insertAdjacentHTML("beforeend", `<span class="rango">${fmt(lmin + (lmax - lmin) * q / 5, 2)}–${fmt(lmin + (lmax - lmin) * (q + 1) / 5, 2)}</span>`);
        ur.appendChild(li);
      }
    }
    const bEsp = $("btn-especie"), bComp = $("btn-competencia"), bRep = $("btn-replica");
    function modo(m) { st.modo = m; bEsp.setAttribute("aria-pressed", m === "especie"); bComp.setAttribute("aria-pressed", m === "competencia"); pintar(); copias(); }
    bEsp.addEventListener("click", () => modo("especie"));
    bComp.addEventListener("click", () => modo("competencia"));
    function replica(si) {
      st.replica = si; bRep.setAttribute("aria-pressed", si);
      $("pie-mosaico").innerHTML = si ? "Réplica 3 × 3: el mosaico es periódico, así que sus bordes empalman"
        : "Clave 1 · 4 × 13 = 52 posiciones al tresbolillo, <i>d</i> ≈ 4.19 m";
      ocultar(); copias();
      let antes = detalle();
      moverCamara(si ? CAMARAS.replica : CAMARAS.reticula, { progreso: () => { if (detalle() !== antes) { antes = detalle(); pintar(); } }, fin: () => { pintar(); copias(); } });
    }
    bRep.addEventListener("click", () => replica(!st.replica));
    $("btn-reordenar").addEventListener("click", reordenar);

    return {
      entrar(adelante) { st.replica = false; bRep.setAttribute("aria-pressed", false); modo("especie"); if (adelante) reordenar(); else ponerOptima(); },
      salir() { detener(); ocultar(); st.replica = false; gCopias.replaceChildren(); },
      preparar() { st.estado = "azar"; pintar(); colocar(); comparacion(totalAzar); },
    };
  })();

  // ================= Efectos de entrada =================
  const centroSitio = [(SITIO.x0 + SITIO.x1) / 2, (SITIO.y0 + SITIO.y1) / 2];
  const distancia = p => Math.hypot(centroide(p.v)[0] - centroSitio[0], centroide(p.v)[1] - centroSitio[1]);
  const dmax = Math.max(...pols.map(distancia));
  function ondas(opacidad) {
    mostrarCapa(gPlantado, 1);
    for (const ov of gPlantado.children) {
      const p = pols.find(q => q.p === +ov.dataset.p);
      ov.style.transition = "none"; ov.style.opacity = 0;
      void ov.getBoundingClientRect();
      ov.style.transition = `opacity 700ms var(--ease-salida) ${reducir ? 0 : Math.round(distancia(p) / dmax * 1400)}ms`;
      ov.style.opacity = opacidad;
    }
  }
  function aparecerPoligonos() {
    if (reducir) return;
    for (const e of gPol.children) {
      const p = pols.find(q => q.e === +e.dataset.e);
      e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: distancia(p) / dmax * 900, easing: "cubic-bezier(.2,.7,.2,1)", fill: "backwards" });
    }
  }
  function parpadeo() {
    for (const c of gExistentes.children) {
      if (reducir) continue;
      c.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0.3 }, { opacity: 1 }], { duration: 900, delay: +c.dataset.retraso, easing: "ease-out", fill: "backwards" });
    }
  }

  // ================= Láminas =================
  const secciones = [...document.querySelectorAll(".lamina")];
  const LAMINAS = [
    { cam: "hoja", capas: { resalte: [DETALLE] }, plantar: 0.9, entrar: () => ondas(0.9) },
    { cam: "resumen", capas: { tenue: 0.45 }, datos: true },
    { cam: "sitio", capas: { ids: true, hover: true }, entrar: adelante => { if (adelante) aparecerPoligonos(); } },
    { cam: "poligono", capas: { reticula: true, resalte: [1] } },
    { cam: "poligono", capas: { reticula: true, existentes: true, resalte: [1] }, entrar: adelante => { if (adelante) parpadeo(); }, datos: true },
    { cam: "poligono", capas: { tenue: 0 }, datos: true, sinCartela: true },
    { cam: "poligono", capas: { reticula: true, existentes: true, resalte: [1] }, datos: true },
    { cam: "poligono", capas: { tenue: 0 }, datos: true, sinCartela: true },
    { cam: "sitio-datos", capas: { ids: true, hover: true, coro: "compra_ha" }, datos: true },
    { cam: "sitio-datos", capas: { ids: true, hover: true, coro: "Bmin", resalte: [1, 4] }, datos: true },
    { cam: "poligono", capas: { tenue: 0 }, sinCartela: true },
    { cam: "poligono", capas: { reticula: true, resalte: [1] }, datos: true },
    { cam: "memetico", capas: { reticula: true, resalte: [1], foco: 1 }, datos: true },
    { cam: "reticula", capas: { reticula: true, tile: true }, antes: () => Mos.preparar(), entrar: adelante => Mos.entrar(adelante), salir: () => Mos.salir() },
    { cam: "exacto", capas: { tesela: true, resalte: [1], foco: 1 }, datos: true },
    { cam: "tesela", capas: { tesela: true }, datos: true },
    { cam: "ventana", capas: { tenue: 0.85 } },
    { cam: "sitio", capas: { tenue: 0.55 } },
    { cam: "cierre", capas: { hover: true }, plantar: 0.85, entrar: adelante => { ondas(0.85); if (adelante) llevarse(); }, sinCartela: true },
  ];

  // Barra de avance: un punto por lámina, al tresbolillo.
  const avance = $("avance");
  const puntos = LAMINAS.map((_, i) => {
    const g = el("g", { class: "punto", tabindex: 0, role: "button", "aria-label": `Ir a la lámina ${i + 1}` }, avance);
    el("circle", { cx: 12 + i * 21, cy: i % 2 ? 24 : 10, r: 5.5, "stroke-width": 1.25 }, g);
    g.addEventListener("click", () => ir(i));
    g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ir(i); } });
    return g;
  });
  function pintarAvance(i) {
    puntos.forEach((g, j) => {
      const c = g.firstChild;
      c.setAttribute("fill", j <= i ? COL.tierra : "none");
      c.setAttribute("stroke", j === i ? COL.ocreHondo : j < i ? COL.tierra : COL.tierraSuave);
      c.setAttribute("stroke-width", j === i ? 2.5 : 1.25);
      if (j === i) g.setAttribute("aria-current", "step"); else g.removeAttribute("aria-current");
    });
    $("numero").textContent = `${i + 1} / ${LAMINAS.length}`;
    itemsIndice.forEach((b, j) => { if (j === i) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  }

  // Índice: una entrada por lámina, con el nombre de su aria-label.
  const indice = $("indice"), btnIndice = $("btn-indice");
  const itemsIndice = secciones.map((sec, i) => {
    const li = document.createElement("li"), b = document.createElement("button");
    b.innerHTML = `<span class="n">${i + 1}</span><span>${sec.getAttribute("aria-label")}</span>`;
    b.addEventListener("click", ev => { cerrarIndice(ev.detail === 0); ir(i); });
    li.appendChild(b);
    $("indice-lista").appendChild(li);
    return b;
  });
  function abrirIndice() {
    indice.hidden = false;
    btnIndice.setAttribute("aria-expanded", "true");
    (itemsIndice[actual] ?? itemsIndice[0]).focus({ preventScroll: true });
  }
  // Con teclado el foco vuelve al botón; con el ratón se suelta, para que la barra espaciadora avance.
  function cerrarIndice(devolverFoco = false) {
    if (indice.hidden) return;
    indice.hidden = true;
    btnIndice.setAttribute("aria-expanded", "false");
    if (devolverFoco) btnIndice.focus({ preventScroll: true }); else document.activeElement?.blur?.();
  }
  btnIndice.addEventListener("click", ev => { if (indice.hidden) abrirIndice(); else cerrarIndice(ev.detail === 0); });
  addEventListener("pointerdown", ev => { if (!indice.hidden && !ev.target.closest("#indice, #btn-indice")) cerrarIndice(); });

  // Pantalla completa, con el prefijo de Safari.
  const btnPantalla = $("btn-pantalla");
  const enPantalla = () => document.fullscreenElement ?? document.webkitFullscreenElement;
  function pantallaCompleta() {
    const r = document.documentElement;
    if (enPantalla()) (document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document);
    else (r.requestFullscreen ?? r.webkitRequestFullscreen)?.call(r)?.catch?.(() => {});
  }
  const marcarPantalla = () => {
    const si = !!enPantalla();
    btnPantalla.setAttribute("aria-pressed", si);
    btnPantalla.textContent = si ? "Salir de pantalla completa" : "Pantalla completa";
  };
  btnPantalla.addEventListener("click", ev => { pantallaCompleta(); if (ev.detail) btnPantalla.blur(); });
  addEventListener("fullscreenchange", marcarPantalla);
  addEventListener("webkitfullscreenchange", marcarPantalla);

  let actual = -1, turno = 0;
  function ir(i, { inmediato = false } = {}) {
    i = Math.max(0, Math.min(LAMINAS.length - 1, i));
    if (i === actual && !inmediato) return;
    const adelante = i > actual, previa = actual, L = LAMINAS[i], t = ++turno;
    if (previa >= 0) {
      LAMINAS[previa].salir?.();
      const s = secciones[previa];
      s.classList.remove("activa", "entra", "datos", "vuelve");
      s.classList.add("sale");
      setTimeout(() => s.classList.remove("sale"), 260);
    }
    ocultarEtiqueta();
    actual = i;
    pintarAvance(i);
    try { history.replaceState(null, "", `#${i + 1}`); } catch (e) { /* file:// sin historia */ }
    L.antes?.();
    aplicarCapas(L.capas);
    // Los puntos de la retícula miden lo mismo en pantalla a cualquier escala.
    const rPunto = (1.7 / CAMARAS[L.cam].s).toFixed(3);
    for (const c of gReticula.children) c.setAttribute("r", rPunto);
    if (!L.capas.plantado) {
      for (const ov of gPlantado.children) { ov.style.transition = "opacity 500ms var(--ease-salida)"; ov.style.opacity = 0; }
    }
    $("cartela").style.opacity = L.sinCartela ? 0 : 1;
    const s = secciones[i];
    let mostrado = false;
    // Hacia adelante el contenido entra con su animación; hacia atrás solo se funde, ya completo.
    const mostrar = () => {
      if (mostrado || t !== turno) return;
      mostrado = true;
      s.classList.add("activa");
      if (!inmediato) {
        if (adelante) { s.classList.add("entra"); if (L.datos) s.classList.add("datos"); }
        else s.classList.add("vuelve");
      }
      L.entrar?.(adelante && !inmediato);
    };
    const dur = inmediato ? 0 : duracionViaje(cam, CAMARAS[L.cam]);
    moverCamara(CAMARAS[L.cam], {
      dur,
      // El contenido llega cuando la cámara va al 70 %; sin viaje, en cuanto la lámina previa empieza a irse.
      progreso: u => { if (u >= 0.7 && u < 1) mostrar(); },
      fin: () => { if (dur || inmediato || previa < 0) mostrar(); else setTimeout(mostrar, 140); },
    });
  }

  addEventListener("keydown", e => {
    if (e.key === "Escape" && !indice.hidden) { e.preventDefault(); cerrarIndice(true); return; }
    if (e.key === "i" || e.key === "I") { e.preventDefault(); if (indice.hidden) abrirIndice(); else cerrarIndice(true); return; }
    if (e.target.closest?.("button, [role=button]") && (e.key === " " || e.key === "Enter")) return;
    const sig = ["ArrowRight", "ArrowDown", "PageDown", " "], ant = ["ArrowLeft", "ArrowUp", "PageUp"];
    if (sig.includes(e.key)) { e.preventDefault(); ir(actual + 1); }
    else if (ant.includes(e.key)) { e.preventDefault(); ir(actual - 1); }
    else if (e.key === "Home") { e.preventDefault(); ir(0); }
    else if (e.key === "End") { e.preventDefault(); ir(LAMINAS.length - 1); }
    else if (e.key === "f" || e.key === "F") pantallaCompleta();
  });
  addEventListener("hashchange", () => { const n = parseInt(location.hash.slice(1), 10); if (n >= 1 && n !== actual + 1) ir(n - 1); });

  // ================= Impresión: una lámina por página =================
  addEventListener("beforeprint", () => {
    LAMINAS.forEach((L, i) => {
      aplicarCapas(L.capas);
      if (L.plantar) {
        for (const ov of gPlantado.children) ov.style.opacity = L.plantar;
        gPlantado.classList.remove("capa-oculta"); gPlantado.style.opacity = 1;
      }
      const s = el("svg", { class: "impresion", viewBox: "0 0 1920 1080" });
      el("rect", { width: 1920, height: 1080, fill: COL.papel }, s);
      const g = el("g", { transform: camTransform(CAMARAS[L.cam]) }, s);
      const copia = mundo.cloneNode(true);
      copia.removeAttribute("id");
      copia.style.transition = "none";
      g.appendChild(copia);
      secciones[i].prepend(s);
    });
    aplicarCapas(LAMINAS[actual].capas);
  });
  addEventListener("afterprint", () => document.querySelectorAll(".impresion").forEach(s => s.remove()));

  // ================= Arranque =================
  const inicial = Math.max(0, Math.min(LAMINAS.length - 1, (parseInt(location.hash.slice(1), 10) || 1) - 1));
  const arrancar = () => ir(inicial, { inmediato: true });
  if (document.fonts?.ready) document.fonts.ready.then(arrancar); else arrancar();
})();
