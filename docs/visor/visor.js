// Visor de resultados de `refor`: lee los archivos que exporta el modelo (json y csv)
// y los muestra con la identidad del deck. No ejecuta el modelo.

(() => {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const R3 = Math.sqrt(3);
  const $ = id => document.getElementById(id);
  function el(tag, attrs = {}, padre) {
    const e = document.createElementNS(NS, tag);
    for (const [a, v] of Object.entries(attrs)) if (v !== null && v !== undefined) e.setAttribute(a, v);
    if (padre) padre.appendChild(e);
    return e;
  }
  const fmt = (x, d = 0) => Number(x).toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d });
  const dinero = (x, d = 0) => "$" + fmt(x, d);
  const pct = (x, d = 0) => fmt(x * 100, d) + " %";
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  // ================= Paleta (DESIGN.md, sección 2) =================
  const TXT = { tinta: "#2E2A27", papel: "#FCF0DA" };
  const COLOR_ESP = {
    Ale: ["#C9C79E", "tinta"], Asa: ["#AEAC78", "tinta"], Asc: ["#6F6D43", "papel"], Ast: ["#5F5D34", "papel"],
    Oro: ["#F6D693", "tinta"], Ost: ["#F2C46A", "tinta"], Oca: ["#D9A646", "tinta"], Oen: ["#8C6418", "papel"],
    Pla: ["#4C4541", "papel"], Yfi: ["#766A63", "papel"],
  };
  const GEN = { Agave: ["#AEAC78", "tinta"], Opuntia: ["#F2C46A", "tinta"], Otras: ["#4C4541", "papel"] };
  const RAMPA = [["#F3E2C2", "tinta"], ["#C2BB8D", "tinta"], ["#969464", "tinta"], ["#64623D", "papel"], ["#3B3A26", "papel"]];
  const OCRE = "#F2C46A", OCRE_HONDO = "#8C6418", TIERRA = "#4C4541", TIERRA_SUAVE = "#6E655F", SALVIA_HONDA = "#6F6D43";
  // Igual que src/salida.cpp: inicial del género y dos letras del epíteto.
  const abrev = nombre => { const [g, ...r] = nombre.split(" "); const ep = r.join(" "); return ep ? g[0] + ep.slice(0, 2) : nombre.slice(0, 3); };
  const generoDe = nombre => { const g = nombre.split(" ")[0]; return g === "Agave" || g === "Opuntia" ? g : "Otras"; };

  // ================= Archivos que lee el visor =================
  const ARCHIVOS = [
    { clave: "compra", nombre: "compra.json", ruta: "docs/res/plan/compra.json", requerido: true, usa: "Compra, mapa y presupuesto", cmd: "./build/refor plan -f json" },
    { clave: "espacial", nombre: "espacial.json", ruta: "docs/res/plan/espacial.json", usa: "Mosaico", cmd: "./build/refor plan -f json" },
    { clave: "exacto", nombre: "exacto.json", ruta: "docs/res/plan/exacto.json", usa: "Memético vs. exacto", cmd: "./build/refor plan --exacto -f json (unos 30 min)" },
    { clave: "frontera", nombre: "frontera.csv", ruta: "docs/res/frontera.csv", usa: "Presupuesto: frontera B*(α)", cmd: "./build/refor frontera -f csv",
      columnas: ["poligono", "area", "alfa", "B_minimo", "costo_libre"] },
    { clave: "barrido", nombre: "barrido.csv", ruta: "docs/res/barrido.csv", usa: "Presupuesto: rejilla α × B", cmd: "./build/refor barrido -f csv",
      columnas: ["poligono", "area", "alfa", "B", "estado", "B_minimo"] },
    { clave: "mapa", nombre: "mapa.csv", ruta: "data/processed/mapa.csv", usa: "Mapa del sitio", cmd: "data/processed (viene en el repositorio)",
      columnas: ["etiqueta", "poligono", "x", "y"] },
    { clave: "especies", nombre: "especies.csv", ruta: "data/processed/especies.csv", usa: "Supervivencia q y costo c por especie", cmd: "python3 scripts/exportar_datos.py",
      columnas: ["especie", "n0", "c", "q"] },
    { clave: "competencia", nombre: "competencia.csv", ruta: "data/processed/competencia.csv", usa: "Vista de competencia del mosaico", cmd: "python3 scripts/exportar_datos.py",
      columnas: ["especie_a", "especie_b", "W"] },
  ];
  // El visor vive en docs/visor/: la raíz del repositorio está dos carpetas arriba.
  const RAIZ = new URL("../../", location.href);

  // ================= Recolección de archivos =================
  // Pide cada archivo por su ruta en el repositorio; los que faltan se omiten.
  async function leerRepositorio() {
    const textos = await Promise.all(ARCHIVOS.map(async spec => {
      try {
        const r = await fetch(new URL(spec.ruta, RAIZ), { cache: "no-store" });
        return r.ok ? { ruta: spec.ruta, texto: await r.text() } : null;
      } catch { return null; }
    }));
    return textos.filter(Boolean);
  }
  async function recargar() {
    if (location.protocol === "file:") {
      mostrarVacio("El navegador no deja leer archivos del repositorio desde file://. Sirve el repositorio desde su raíz (ver abajo) y abre el visor por http.");
      return;
    }
    cargar(await leerRepositorio());
  }

  // ================= Lectura y validación =================
  function csv(texto) {
    const lineas = texto.replace(/\r/g, "").split("\n").filter(l => l.trim());
    const cab = lineas.shift().split(",").map(s => s.trim());
    return { cab, filas: lineas.map(l => { const v = l.split(","); return Object.fromEntries(cab.map((c, i) => [c, (v[i] ?? "").trim()])); }) };
  }
  const elegir = (textos, spec) => textos.find(t => t.ruta === spec.ruta) ?? null;
  function interpretar(spec, texto) {
    if (spec.nombre.endsWith(".json")) {
      const d = JSON.parse(texto);
      if (spec.clave === "compra" && !(Array.isArray(d) && d.every(p => "poligono" in p && Array.isArray(p.especies))))
        throw new Error("no es la lista de polígonos que escribe refor plan");
      if (spec.clave !== "compra" && !Array.isArray(d.mosaicos)) throw new Error("no trae la lista de mosaicos");
      return d;
    }
    const t = csv(texto);
    const faltan = spec.columnas.filter(c => !t.cab.includes(c));
    if (faltan.length) throw new Error(`faltan las columnas ${faltan.join(", ")}`);
    return t.filas;
  }

  let M = null;            // modelo cargado
  let estadoArchivos = []; // { spec, ruta, error }

  function cargar(textos) {
    const crudo = {};
    estadoArchivos = ARCHIVOS.map(spec => {
      const t = elegir(textos, spec);
      if (!t) return { spec, ruta: null, error: null };
      try { crudo[spec.clave] = interpretar(spec, t.texto); return { spec, ruta: t.ruta, error: null }; }
      catch (e) { return { spec, ruta: t.ruta, error: e.message.replace(/^JSON\.parse: /, "JSON mal formado: ") }; }
    });
    if (!crudo.compra) {
      M = null;
      mostrarVacio(textos.length ? "No encontré un compra.json válido. Es el único archivo indispensable." : null);
      return;
    }
    M = construir(crudo);
    leerHash();
    mostrarVisor();
  }

  function construir(c) {
    const avisos = [];
    // Especies: del CSV si está; si no, de los nombres de la compra.
    const nombres = c.especies ? c.especies.map(r => r.especie) : [...new Set(c.compra.flatMap(p => p.especies.map(s => s.especie)))].sort();
    const especies = nombres.map(nombre => {
      const ab = abrev(nombre), genero = generoDe(nombre), r = c.especies?.find(e => e.especie === nombre);
      const [color, txt] = COLOR_ESP[ab] ?? GEN[genero];
      return { nombre, ab, genero, color, txt: TXT[txt], q: r ? +r.q : null, c: r ? +r.c : null };
    });
    const espDe = new Map(especies.flatMap(e => [[e.nombre, e], [e.ab, e]]));
    const especie = k => espDe.get(k) ?? { nombre: k, ab: k, genero: "Otras", color: GEN.Otras[0], txt: TXT.papel };

    // Polígonos del programa.
    const pols = new Map();
    for (const p of c.compra) {
      const x = p.especies.reduce((s, e) => s + e.x, 0), E = p.especies.reduce((s, e) => s + e.E, 0);
      pols.set(p.poligono, { id: p.poligono, area: p.area, alfa: p.alfa, B: p.B, estado: p.estado, Bmin: p.B_minimo,
        compra: p.costo_compra ?? 0, repos: p.costo_reposicion ?? 0, especies: p.especies, x, E, clave: null, forma: null, etiqueta: null });
    }
    const ids = [...pols.keys()].sort((a, b) => a - b);
    const alfas = [...new Set(c.compra.map(p => p.alfa))], Bs = [...new Set(c.compra.map(p => p.B))];
    if (alfas.length > 1) avisos.push(`compra.json mezcla varios α (${alfas.join(", ")}); la cabecera usa el primero.`);
    if (Bs.length > 1) avisos.push(`compra.json mezcla varios presupuestos (${Bs.map(b => dinero(b)).join(", ")}).`);

    // Mapa en metros locales: x al este, y al sur.
    let mapa = null;
    if (c.mapa) {
      const porEt = new Map();
      for (const r of c.mapa) {
        const e = +r.etiqueta;
        if (!porEt.has(e)) porEt.set(e, { e, p: r.poligono === "" ? null : +r.poligono, v: [] });
        porEt.get(e).v.push([+r.x, +r.y]);
      }
      const todos = [...porEt.values()].flatMap(d => d.v);
      const x0 = Math.min(...todos.map(v => v[0])), y1 = Math.max(...todos.map(v => v[1]));
      mapa = [...porEt.values()].map(d => ({ ...d, v: d.v.map(([x, y]) => [x - x0, y1 - y]) }));
      for (const f of mapa) if (f.p !== null) {
        const p = pols.get(f.p);
        if (p) { p.forma = f.v; p.etiqueta = f.e; } else avisos.push(`El polígono ${f.p} del mapa no aparece en compra.json.`);
      }
      const sinForma = ids.filter(id => !pols.get(id).forma);
      if (sinForma.length) avisos.push(`mapa.csv no trae ${sinForma.length === 1 ? "el polígono" : "los polígonos"} ${sinForma.join(", ")}.`);
    }

    // Mosaicos del memético, con el modelo entero si está.
    let mosaicos = null;
    if (c.espacial) {
      const exDe = new Map((c.exacto?.mosaicos ?? []).map(m => [m.mosaico, m]));
      mosaicos = c.espacial.mosaicos.map(m => {
        const x = exDe.get(m.mosaico);
        for (const id of m.poligonos) { if (pols.has(id)) pols.get(id).clave = m.mosaico; else avisos.push(`espacial.json asigna la clave ${m.mosaico} al polígono ${id}, que no está en compra.json.`); }
        return { id: m.mosaico, poligonos: m.poligonos, clave: m.clave, composicion: m.composicion, mejor: m.competencia_mejor,
          media: m.competencia_media, de: m.desviacion, azar: m.esperada_azar, coef: m.coeficiente,
          area: m.poligonos.reduce((s, id) => s + (pols.get(id)?.area ?? 0), 0), exacto: x ?? null };
      });
      if (c.exacto && !mosaicos.some(m => m.exacto)) avisos.push("exacto.json no corresponde a los mosaicos de espacial.json.");
    } else if (c.exacto) avisos.push("Hay exacto.json pero falta espacial.json: la comparación necesita los dos.");
    const corridas = c.espacial?.corridas ?? null;

    // Matriz de competencia por abreviatura.
    let W = null;
    if (c.competencia) {
      W = new Map();
      for (const r of c.competencia) { const a = abrev(r.especie_a), b = abrev(r.especie_b); W.set(a + "|" + b, +r.W); W.set(b + "|" + a, +r.W); }
    }

    // Frontera B*(α): por polígono y del sitio (filas «todos», o el promedio ponderado por área).
    let frontera = null;
    if (c.frontera) {
      const porPol = new Map();
      let sitio = [];
      for (const r of c.frontera) {
        const fila = [+r.alfa, r.B_minimo === "" ? null : +r.B_minimo, r.costo_libre === "" ? null : +r.costo_libre];
        if (r.poligono === "todos") sitio.push(fila);
        else { const id = +r.poligono; if (!porPol.has(id)) porPol.set(id, []); porPol.get(id).push(fila); }
      }
      for (const f of porPol.values()) f.sort((a, b) => a[0] - b[0]);
      const fAlfas = [...new Set([...porPol.values()].flat().map(f => f[0]))].sort((a, b) => a - b);
      if (!sitio.length) sitio = fAlfas.map(a => {
        let s = 0, ar = 0;
        for (const [id, f] of porPol) { const r = f.find(x => x[0] === a); if (r?.[1] != null) { s += r[1] * (pols.get(id)?.area ?? 0); ar += pols.get(id)?.area ?? 0; } }
        return [a, ar ? s / ar : null, null];
      });
      sitio.sort((a, b) => a[0] - b[0]);
      frontera = { porPol, sitio, alfas: fAlfas };
    }

    // Barrido α × B: factibles por celda y estado por polígono.
    let barrido = null;
    if (c.barrido) {
      const celda = new Map(), porPol = new Map();
      for (const r of c.barrido) {
        const k = `${+r.alfa}|${+r.B}`, f = r.estado === "factible";
        if (!celda.has(k)) celda.set(k, { fact: 0, tot: 0 });
        const z = celda.get(k); z.tot++; if (f) z.fact++;
        const id = +r.poligono;
        if (!porPol.has(id)) porPol.set(id, new Map());
        porPol.get(id).set(k, r.estado);
      }
      barrido = { celda, porPol, alfas: [...new Set(c.barrido.map(r => +r.alfa))].sort((a, b) => a - b),
        Bs: [...new Set(c.barrido.map(r => +r.B))].sort((a, b) => a - b) };
    }

    // Totales del sitio.
    const lista = ids.map(id => pols.get(id));
    const area = lista.reduce((s, p) => s + p.area, 0);
    const tot = {
      area, n: lista.length, factibles: lista.filter(p => p.estado === "factible").length,
      x: lista.reduce((s, p) => s + p.x, 0), E: lista.reduce((s, p) => s + p.E, 0),
      Bmin: lista.reduce((s, p) => s + (p.Bmin ?? 0) * p.area, 0) / area,
      costo: lista.reduce((s, p) => s + p.compra + p.repos, 0),
    };
    return { pols, ids, especies, especie, mapa, mosaicos, corridas, W, frontera, barrido, tot, avisos,
      alfa: alfas[0], B: Bs[0], hayExacto: !!mosaicos?.some(m => m.exacto) };
  }

  // ================= Estado de la interfaz =================
  const S = { v: "mapa", p: null, m: 1, modo: "especie", replica: false, orden: { col: "id", dir: 1 } };
  const VISTAS = ["mapa", "compra", "mosaico", "exacto", "presupuesto"];
  function leerHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    if (VISTAS.includes(h.get("v"))) S.v = h.get("v");
    const p = +h.get("p");
    S.p = M.pols.has(p) ? p : null;
    const m = +h.get("m");
    if (M.mosaicos?.some(x => x.id === m)) S.m = m;
    else if (S.p && M.pols.get(S.p).clave) S.m = M.pols.get(S.p).clave;
    else if (M.mosaicos) S.m = M.mosaicos[0].id;
  }
  function escribirHash() {
    const h = new URLSearchParams({ v: S.v });
    if (S.p) h.set("p", S.p);
    if (M.mosaicos && (S.v === "mosaico" || S.v === "exacto")) h.set("m", S.m);
    try { history.replaceState(null, "", "#" + h); } catch { /* file:// sin historia */ }
  }
  // Elegir desde el selector, el teclado o la ficha encuadra el polígono en la vista Mapa; elegir
  // con un clic en el mapa no mueve la cámara, para no desorientar.
  function elegirPoligono(id, encuadrar = false) {
    S.p = id;
    const p = id ? M.pols.get(id) : null;
    if (p?.clave) S.m = p.clave;
    pintar();
    if (encuadrar && MP && S.v === "mapa") { if (id) encuadrarPoligono(id); else volarA(MP.ajuste); }
  }
  function elegirMosaico(id) { S.m = id; pintar(); }

  // ================= Etiqueta flotante =================
  const etq = $("etiqueta");
  function mostrarEtiqueta(html, x, y) {
    etq.innerHTML = html;
    etq.hidden = false;
    const r = etq.getBoundingClientRect();
    let lx = x + 16, ly = y + 16;
    if (lx + r.width > innerWidth - 8) lx = x - r.width - 16;
    if (ly + r.height > innerHeight - 8) ly = y - r.height - 16;
    etq.style.left = lx + "px"; etq.style.top = ly + "px";
  }
  const ocultarEtiqueta = () => { etq.hidden = true; };

  // ================= Capas del mapa =================
  // Capa del mapa según la vista: compra/ha, B*/ha, o los polígonos que usan la clave elegida.
  function capa() {
    const a = M.alfa;
    if (S.v === "compra") return { titulo: "Plantas compradas por hectárea", valor: p => p.x / p.area, txt: x => fmt(x) + " plantas/ha", corto: x => fmt(x) };
    if (S.v === "mapa") return M.mosaicos ? { titulo: "Plantación de cada polígono", plantacion: true } : { titulo: "Polígonos del programa" };
    if (S.v === "presupuesto") return { titulo: `Presupuesto mínimo B* por hectárea (α = ${a})`, valor: p => p.Bmin, txt: x => dinero(x) + "/ha", corto: x => dinero(x) };
    if (!M.mosaicos) return { titulo: "Polígonos del programa", valor: null };
    const m = M.mosaicos.find(x => x.id === S.m);
    return { titulo: `Polígonos con la clave ${S.m}`, clave: m };
  }
  // Clases por quintiles (seis polígonos por clase con 30 polígonos).
  function quintiles(valores) {
    const s = valores.filter(v => v != null).sort((a, b) => a - b);
    return [1, 2, 3, 4].map(i => s[Math.round(i * s.length / 5) - 1] ?? s[s.length - 1]);
  }
  const clase = (v, cortes) => { let i = 0; while (i < cortes.length && v > cortes[i]) i++; return i; };

  // ================= Mapa con zoom =================
  // La geometría vive en metros locales dentro de un grupo; la cámara (centro y píxeles por metro)
  // solo cambia su transformación. Al acercarse, cada polígono muestra su clave teselada con
  // patrones de SVG, como en el deck: por género cuando el hexágono mide de 3 a 16 px de radio y
  // por especie, con su abreviatura, desde 16 px (DESIGN.md, secciones 2 y 5).
  const marco = $("mapa-marco"), svgMapa = $("mapa");
  const RHEX = 4.19 / R3;                 // radio del hexágono: vecinas a 4.19 m (658 plantas/ha)
  const NIVEL_GENERO = 3, NIVEL_ESPECIE = 16, HEX_MAX = 44;
  const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mcd = (a, b) => (b ? mcd(b, a % b) : a), mcm = (a, b) => a / mcd(a, b) * b;
  const cajaDe = v => ({ x0: Math.min(...v.map(q => q[0])), x1: Math.max(...v.map(q => q[0])),
    y0: Math.min(...v.map(q => q[1])), y1: Math.max(...v.map(q => q[1])) });
  let MP = null; // estructura del mapa construida para el modelo cargado

  function centroide(v) {
    let a = 0, x = 0, y = 0;
    for (let i = 0; i < v.length; i++) {
      const [x0, y0] = v[i], [x1, y1] = v[(i + 1) % v.length], f = x0 * y1 - x1 * y0;
      a += f; x += (x0 + x1) * f; y += (y0 + y1) * f;
    }
    return [x / (3 * a), y / (3 * a)];
  }
  function dentro([x, y], v) {
    let si = false;
    for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
      const [xi, yi] = v[i], [xj, yj] = v[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) si = !si;
    }
    return si;
  }

  // Dos patrones por clave (género y especie). El periodo rectangular de una clave F × C es de
  // mcm(F, 2C) filas: con 4 × 13, 52 filas, igual que en el deck.
  function crearPatrones(defs, m, tile) {
    const F = m.clave.length, C = m.clave[0].length, filas = mcm(F, 2 * C), ancho = C * R3, alto = 1.5 * filas;
    const hexEn = (x, y) => `M${x.toFixed(3)} ${(y - 1).toFixed(3)}l.866 .5v1l-.866 .5l-.866 -.5v-1z`;
    const bordes = [];
    for (const nivel of ["genero", "especie"]) {
      const pat = el("pattern", { id: `pat-${nivel}-${m.id}`, patternUnits: "userSpaceOnUse", width: ancho.toFixed(4), height: alto, patternTransform: tile }, defs);
      const caminos = new Map(), textos = [];
      let todos = "";
      for (let f = -1; f <= filas; f++) for (let c = 0; c < C; c++) {
        const x = ((R3 * (c + 0.5 * f)) % ancho + ancho) % ancho, y = 1.5 * f;
        const ab = m.clave[((f % F) + F) % F][c], e = M.especie(ab);
        const [fill, txt] = nivel === "genero" ? [GEN[e.genero][0], TXT[GEN[e.genero][1]]] : [e.color, e.txt];
        for (const dx of [-ancho, 0, ancho]) {
          const px = x + dx;
          if (px < -1 || px > ancho + 1) continue;
          caminos.set(fill, (caminos.get(fill) ?? "") + hexEn(px, y));
          todos += hexEn(px, y);
          if (nivel === "especie") textos.push([px, y, ab, txt]);
        }
      }
      for (const [fill, d] of caminos) el("path", { d, fill }, pat);
      bordes.push(el("path", { d: todos, fill: "none", stroke: TIERRA_SUAVE, "stroke-width": 0 }, pat));
      // El patrón va girado 90°; cada abreviatura se gira de vuelta para leerse derecha.
      for (const [x, y, ab, txt] of textos) el("text", { x: x.toFixed(3), y: y.toFixed(3), transform: `rotate(-90 ${x.toFixed(3)} ${y.toFixed(3)})`,
        fill: txt, "font-size": 0.62, "font-family": "Instrument Sans, system-ui, sans-serif", "font-weight": 500,
        "text-anchor": "middle", "dominant-baseline": "central" }, pat).textContent = ab;
    }
    return bordes;
  }

  function construirMapa() {
    svgMapa.replaceChildren();
    marco.querySelector(".sin-mapa")?.remove();
    MP = null;
    $("visor").classList.toggle("sin-mapa-cargado", !M.mapa);
    if (!M.mapa) {
      const d = document.createElement("div");
      d.className = "sin-mapa";
      d.innerHTML = "<p>Falta <code>data/processed/mapa.csv</code>. Puedes elegir los polígonos con el selector de la derecha.</p>";
      marco.appendChild(d);
      return;
    }
    const defs = el("defs", {}, svgMapa), gMundo = el("g", {}, svgMapa);
    const gPol = el("g", {}, gMundo), gPlant = el("g", {}, gMundo), gRes = el("g", {}, gMundo);
    const gRot = el("g", {}, svgMapa), gCart = el("g", { class: "cartela-mapa" }, svgMapa);
    const dPol = v => "M" + v.map(q => q[0].toFixed(1) + " " + q[1].toFixed(1)).join("L") + "Z";
    const formas = new Map(), plant = new Map(), rot = [];
    for (const f of M.mapa) {
      const p = f.p !== null ? M.pols.get(f.p) : null;
      const e = el("path", { d: dPol(f.v), class: "poligono" + (p ? "" : " fuera") }, gPol);
      e.dataset.e = f.e;
      if (!p) continue;
      e.dataset.p = p.id;
      formas.set(p.id, e);
      if (p.clave) { const o = el("path", { d: dPol(f.v), class: "poligono plantacion" }, gPlant); o.dataset.p = p.id; plant.set(p.id, o); }
      const [x, y] = centroide(f.v);
      const t = el("text", { class: "id-poligono" }, gRot);
      t.textContent = p.id;
      rot.push({ t, x, y, id: p.id });
    }
    // Origen y orientación de la teselación: los mismos del deck (polígono 1, filas giradas 90°).
    const b1 = cajaDe(M.pols.get(1)?.forma ?? M.mapa[0].v);
    const O = [(b1.x0 + b1.x1) / 2 + 2.25 * RHEX, b1.y0 + 110];
    const bordes = (M.mosaicos ?? []).flatMap(m => crearPatrones(defs, m, `translate(${O[0]} ${O[1]}) rotate(90) scale(${RHEX})`));
    // Escala y norte llevan un trazo de papel debajo para leerse sobre la plantación.
    const fondo = () => el("path", { fill: "none", stroke: "#FCF0DA", "stroke-width": 4.5, "stroke-linejoin": "round" }, gCart);
    const cart = { escalaF: fondo(), norteF: fondo(),
      escala: el("path", { fill: "none", stroke: TIERRA, "stroke-width": 1.25 }, gCart), escalaT: el("text", {}, gCart),
      norte: el("path", { fill: "none", stroke: TIERRA, "stroke-width": 1.25 }, gCart), norteT: el("text", { "text-anchor": "end" }, gCart),
    };
    cart.norteT.textContent = "N";
    MP = { caja: cajaDe(M.mapa.flatMap(f => f.v)), gMundo, gPlant, gRes, gRot, formas, plant, rot, O, bordes, cart,
      cam: null, ajuste: null, w: 0, h: 0, k0: 1, nivel: -1 };
    medirMapa(true);
  }

  // Encuadre de todo el sitio; si la cámara estaba ajustada, sigue ajustada al cambiar el tamaño.
  function medirMapa(reiniciar = false) {
    if (!MP) return;
    const w = svgMapa.clientWidth, h = svgMapa.clientHeight;
    if (w < 10 || h < 10) return;
    // Márgenes del encuadre: a la derecha se libran los botones de zoom; abajo, la escala y el norte.
    const { caja } = MP, izq = 24, der = 64, arr = 24, aba = 54;
    const k0 = Math.min((w - izq - der) / (caja.x1 - caja.x0), (h - arr - aba) / (caja.y1 - caja.y0));
    const ajuste = { k: k0, cx: (caja.x0 + caja.x1) / 2 + (der - izq) / (2 * k0), cy: (caja.y0 + caja.y1) / 2 + (aba - arr) / (2 * k0) };
    const estabaAjustado = MP.cam && MP.ajuste && Math.abs(MP.cam.k - MP.ajuste.k) < 1e-9 && MP.cam.cx === MP.ajuste.cx && MP.cam.cy === MP.ajuste.cy;
    Object.assign(MP, { w, h, k0, ajuste });
    if (reiniciar || !MP.cam || estabaAjustado) MP.cam = { ...ajuste };
    MP.cam.k = Math.min(kMax(), Math.max(kMin(), MP.cam.k));
    aplicarCamara();
  }
  const kMin = () => MP.k0 * 0.8, kMax = () => HEX_MAX / RHEX;
  const aPx = (x, y) => [MP.w / 2 + MP.cam.k * (x - MP.cam.cx), MP.h / 2 + MP.cam.k * (y - MP.cam.cy)];
  const aMundo = (px, py) => [MP.cam.cx + (px - MP.w / 2) / MP.cam.k, MP.cam.cy + (py - MP.h / 2) / MP.cam.k];

  function aplicarCamara() {
    const { cam, w, h, cart } = MP;
    MP.gMundo.setAttribute("transform", `translate(${(w / 2).toFixed(2)} ${(h / 2).toFixed(2)}) scale(${cam.k.toFixed(5)}) translate(${(-cam.cx).toFixed(2)} ${(-cam.cy).toFixed(2)})`);
    for (const r of MP.rot) { const [x, y] = aPx(r.x, r.y); r.t.setAttribute("x", x.toFixed(1)); r.t.setAttribute("y", y.toFixed(1)); }
    // El contorno de los hexágonos mide 0.75 px en pantalla; por debajo de 5 px de radio se quita.
    const hexPx = RHEX * cam.k;
    for (const b of MP.bordes) b.setAttribute("stroke-width", hexPx >= 5 ? (0.75 / hexPx).toFixed(4) : 0);
    const nivel = hexPx < NIVEL_GENERO ? 0 : hexPx < NIVEL_ESPECIE ? 1 : 2;
    if (nivel !== MP.nivel) { MP.nivel = nivel; pintarCapaMapa(); }
    const largo = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000].find(l => l * cam.k >= 60) ?? 2000;
    for (const p of [cart.escala, cart.escalaF]) p.setAttribute("d", `M14 ${h - 18}v6h${(largo * cam.k).toFixed(1)}v-6`);
    cart.escalaT.setAttribute("x", (22 + largo * cam.k).toFixed(1)); cart.escalaT.setAttribute("y", h - 9);
    cart.escalaT.textContent = `${fmt(largo)} m`;
    for (const p of [cart.norte, cart.norteF]) p.setAttribute("d", `M${w - 18} ${h - 8}V${h - 34}M${w - 23} ${h - 27}l5 -7 5 7`);
    cart.norteT.setAttribute("x", w - 30); cart.norteT.setAttribute("y", h - 12);
    $("z-mas").disabled = cam.k >= kMax() * 0.999;
    $("z-menos").disabled = cam.k <= kMin() * 1.001;
    $("z-ajustar").disabled = Math.abs(cam.k - MP.ajuste.k) < 1e-6 && Math.abs(cam.cx - MP.ajuste.cx) < 1e-3 && Math.abs(cam.cy - MP.ajuste.cy) < 1e-3;
  }
  let rafCamara = 0;
  const pedirCamara = () => { if (!rafCamara) rafCamara = requestAnimationFrame(() => { rafCamara = 0; aplicarCamara(); }); };
  function zoomEn(factor, px = MP.w / 2, py = MP.h / 2) {
    detenerVuelo();
    const [wx, wy] = aMundo(px, py), k = Math.min(kMax(), Math.max(kMin(), MP.cam.k * factor));
    MP.cam = { k, cx: wx - (px - MP.w / 2) / k, cy: wy - (py - MP.h / 2) / k };
    pedirCamara();
  }
  // Vuelo corto entre encuadres: la escala se interpola en logaritmo para que el zoom se sienta parejo.
  // Si el navegador frena los cuadros (pestaña en segundo plano), un temporizador deja la cámara en
  // su destino: el vuelo siempre termina.
  let viaje = 0, finVuelo = 0;
  function detenerVuelo() { cancelAnimationFrame(viaje); clearTimeout(finVuelo); viaje = 0; }
  function volarA(dest) {
    detenerVuelo();
    if (reducir) { MP.cam = { ...dest }; aplicarCamara(); return; }
    const ini = { ...MP.cam }, t0 = performance.now(), dur = 560;
    const paso = t => {
      const u = Math.max(0, Math.min(1, (t - t0) / dur)), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      MP.cam = { k: Math.exp(Math.log(ini.k) + (Math.log(dest.k) - Math.log(ini.k)) * e), cx: ini.cx + (dest.cx - ini.cx) * e, cy: ini.cy + (dest.cy - ini.cy) * e };
      aplicarCamara();
      if (u < 1) viaje = requestAnimationFrame(paso); else detenerVuelo();
    };
    viaje = requestAnimationFrame(paso);
    finVuelo = setTimeout(() => { if (viaje) { detenerVuelo(); MP.cam = { ...dest }; aplicarCamara(); } }, dur + 250);
  }
  function encuadrarPoligono(id) {
    const forma = M.pols.get(id)?.forma;
    if (!MP || !forma) return;
    // Encuadra el polígono, pero nunca más lejos de lo necesario para ver su plantación por género:
    // en los polígonos alargados se recortan los extremos y se conserva el centro.
    const b = cajaDe(forma), pad = 56, [cx, cy] = centroide(forma);
    const ajusta = Math.min((MP.w - 2 * pad) / (b.x1 - b.x0), (MP.h - 2 * pad - 30) / (b.y1 - b.y0));
    const k = Math.min(kMax(), Math.max(ajusta, NIVEL_GENERO * 1.15 / RHEX));
    volarA(k > ajusta ? { k, cx, cy: cy + 15 / k } : { k, cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2 + 15 / k });
  }

  // Rellenos, leyenda y resalte según la vista y el nivel de detalle.
  function pintarCapaMapa() {
    const C = capa(), nivel = MP?.nivel ?? 0;
    $("capa-titulo").textContent = C.titulo;
    let cortes = null;
    if (C.valor) cortes = quintiles(M.ids.map(id => C.valor(M.pols.get(id))));
    const ley = $("leyenda");
    if (cortes) {
      const vals = M.ids.map(id => C.valor(M.pols.get(id)));
      const lim = [Math.min(...vals), ...cortes, Math.max(...vals)];
      ley.innerHTML = RAMPA.map(([c], i) => `<span><i style="background:${c}"></i>${esc(C.corto(lim[i]))} – ${esc(C.corto(lim[i + 1]))}</span>`).join("");
    } else if (C.clave) {
      ley.innerHTML = `<span><i style="background:${RAMPA[1][0]}"></i>Clave ${C.clave.id}: ${poligonos(C.clave.poligonos.length)}, ${fmt(C.clave.area, 2)} ha</span>`
        + `<span><i style="background:#FCF0DA"></i>Otra clave</span>`;
    } else if (C.plantacion) {
      ley.innerHTML = nivel === 0 ? `<span>Acerca el mapa para ver cómo se planta cada polígono: rueda del ratón, pellizco o el botón de acercar.</span>`
        : nivel === 1 ? Object.entries(GEN).map(([g, [c]]) => `<span><i class="hex" style="background:${c}"></i>${g === "Otras" ? "Otras: mezquite y yuca" : `<em>${g}</em>`}</span>`).join("")
          + `<span>Un hexágono por planta; acerca más para ver la especie.</span>`
        : M.especies.map(e => `<span title="${esc(e.nombre)}"><i class="hex" style="background:${e.color}"></i>${e.ab}</span>`).join("")
          + `<span>Pasa el cursor sobre una planta para ver su especie.</span>`;
    } else ley.innerHTML = M.mapa ? `<span>Falta <code>espacial.json</code>: sin él no hay claves de plantación que mostrar.</span>` : "";
    if (!MP) return;
    for (const [id, e] of MP.formas) {
      const p = M.pols.get(id);
      let [fill, txt] = ["#FCF0DA", "tinta"];
      if (cortes) [fill, txt] = RAMPA[clase(C.valor(p), cortes)];
      else if (C.clave && C.clave.poligonos.includes(id)) [fill, txt] = RAMPA[1];
      else if (C.plantacion) [fill, txt] = RAMPA[0];
      e.setAttribute("fill", fill);
      e.dataset.txt = txt;
    }
    const verPlantacion = C.plantacion && nivel > 0;
    MP.gPlant.style.display = verPlantacion ? "" : "none";
    if (verPlantacion) for (const [id, o] of MP.plant) o.setAttribute("fill", `url(#pat-${nivel === 1 ? "genero" : "especie"}-${M.pols.get(id).clave})`);
    // Con las abreviaturas a la vista, el número del polígono estorba: se oculta.
    MP.gRot.style.display = verPlantacion && nivel === 2 ? "none" : "";
    for (const r of MP.rot) {
      const txt = verPlantacion ? "tinta" : MP.formas.get(r.id).dataset.txt;
      r.t.setAttribute("fill", TXT[txt]);
      r.t.setAttribute("stroke", txt === "tinta" ? "rgb(252 240 218 / .8)" : "rgb(46 42 39 / .5)");
    }
    MP.gRes.replaceChildren();
    if (S.p && MP.formas.has(S.p)) el("path", { d: MP.formas.get(S.p).getAttribute("d"), class: "resalte" }, MP.gRes);
  }

  // Planta bajo un punto del mundo: se deshace la transformación del patrón y se busca el
  // centro de hexágono más cercano entre los candidatos vecinos.
  function plantaEn(id, wx, wy) {
    const p = M.pols.get(id), m = M.mosaicos?.find(x => x.id === p?.clave);
    if (!m || !p.forma || !dentro([wx, wy], p.forma)) return null;
    const lx = (wy - MP.O[1]) / RHEX, ly = -(wx - MP.O[0]) / RHEX;
    let mejor = null;
    for (const f of [Math.floor(ly / 1.5), Math.ceil(ly / 1.5)]) {
      const c0 = Math.round(lx / R3 - 0.5 * f);
      for (const c of [c0 - 1, c0, c0 + 1]) {
        const d = (lx - R3 * (c + 0.5 * f)) ** 2 + (ly - 1.5 * f) ** 2;
        if (!mejor || d < mejor.d) mejor = { f, c, d };
      }
    }
    const F = m.clave.length, C = m.clave[0].length, f = ((mejor.f % F) + F) % F, c = ((mejor.c % C) + C) % C;
    return { especie: M.especie(m.clave[f][c]), clave: m.id, f, c };
  }
  function etiquetaPoligono(id) {
    const p = M.pols.get(id), C = capa();
    let valor = "";
    if (C.valor) valor = C.txt(C.valor(p));
    else if (p.clave) valor = `Clave ${p.clave}`;
    return `<span class="titulo">Polígono ${p.id}</span><span class="rotulo">${fmt(p.area, 2)} ha · etiqueta ${p.etiqueta} del plano INECOL</span>`
      + (valor ? `<span class="valor">${esc(valor)}</span>` : "");
  }

  // ---------- Interacción: arrastrar, rueda, clic y teclado ----------
  let arrastre = null, huboArrastre = false;
  svgMapa.addEventListener("pointerdown", e => {
    if (!MP || e.button !== 0) return;
    arrastre = { x: e.clientX, y: e.clientY, cx: MP.cam.cx, cy: MP.cam.cy, id: e.pointerId };
    huboArrastre = false;
  });
  svgMapa.addEventListener("pointermove", e => {
    if (!MP) return;
    if (arrastre && e.pointerId === arrastre.id) {
      const dx = e.clientX - arrastre.x, dy = e.clientY - arrastre.y;
      if (!huboArrastre && Math.hypot(dx, dy) > 4) {
        huboArrastre = true;
        detenerVuelo();
        svgMapa.setPointerCapture(e.pointerId);
        svgMapa.classList.add("arrastrando");
        ocultarEtiqueta();
      }
      if (huboArrastre) { MP.cam = { ...MP.cam, cx: arrastre.cx - dx / MP.cam.k, cy: arrastre.cy - dy / MP.cam.k }; pedirCamara(); return; }
    }
    const t = e.target.closest?.("path.poligono");
    if (!t) return ocultarEtiqueta();
    if (!t.dataset.p) return mostrarEtiqueta(`<span class="titulo">Fuera del programa</span><span class="rotulo">Etiqueta ${t.dataset.e} del plano de INECOL; no está en la lista de polígonos.</span>`, e.clientX, e.clientY);
    const id = +t.dataset.p;
    if (MP.nivel > 0 && capa().plantacion) {
      const r = svgMapa.getBoundingClientRect(), pl = plantaEn(id, ...aMundo(e.clientX - r.left, e.clientY - r.top));
      if (pl) return mostrarEtiqueta(`<span class="titulo binomial">${esc(pl.especie.nombre)}</span>`
        + `<span class="rotulo">Polígono ${id} · clave ${pl.clave}, fila ${pl.f + 1}, columna ${pl.c + 1}</span>`, e.clientX, e.clientY);
    }
    mostrarEtiqueta(etiquetaPoligono(id), e.clientX, e.clientY);
  });
  const soltarArrastre = () => { arrastre = null; svgMapa.classList.remove("arrastrando"); };
  svgMapa.addEventListener("pointerup", soltarArrastre);
  svgMapa.addEventListener("pointercancel", soltarArrastre);
  svgMapa.addEventListener("pointerleave", () => { if (!arrastre) ocultarEtiqueta(); });
  svgMapa.addEventListener("click", e => {
    if (huboArrastre) { huboArrastre = false; return; }
    const t = e.target.closest?.("path.poligono");
    if (t?.dataset.p) elegirPoligono(+t.dataset.p);
  });
  svgMapa.addEventListener("wheel", e => {
    if (!MP) return;
    e.preventDefault();
    const r = svgMapa.getBoundingClientRect();
    // El pellizco del trackpad llega como rueda con ctrlKey y pasos más finos.
    zoomEn(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  svgMapa.addEventListener("dblclick", e => {
    if (!MP) return;
    const r = svgMapa.getBoundingClientRect();
    zoomEn(e.shiftKey ? 0.5 : 2, e.clientX - r.left, e.clientY - r.top);
  });
  svgMapa.addEventListener("keydown", e => {
    if (!M) return;
    const i = M.ids.indexOf(S.p);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); elegirPoligono(M.ids[(i + 1) % M.ids.length], true); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); elegirPoligono(M.ids[i <= 0 ? M.ids.length - 1 : i - 1], true); }
    else if (e.key === "Escape") { e.preventDefault(); elegirPoligono(null, true); }
    else if (!MP) return;
    else if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomEn(1.6); }
    else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomEn(1 / 1.6); }
    else if (e.key === "0") { e.preventDefault(); volarA(MP.ajuste); }
  });
  $("z-mas").addEventListener("click", () => MP && zoomEn(1.6));
  $("z-menos").addEventListener("click", () => MP && zoomEn(1 / 1.6));
  $("z-ajustar").addEventListener("click", () => MP && volarA(MP.ajuste));

  // ================= Mosaico: dibujo de una clave 4 × 13 =================
  const DF = [-1, -1, 0, 0, 1, 1], DC = [0, 1, -1, 1, -1, 0];
  // Competencia de cada planta con sus seis vecinas (el mosaico se repite, así que los bordes se envuelven).
  function competenciaLocal(clave) {
    const F = clave.length, C = clave[0].length;
    return clave.map((fila, f) => fila.map((ab, c) => DF.reduce((s, df, k) =>
      s + (M.W.get(ab + "|" + clave[((f + df) % F + F) % F][((c + DC[k]) % C + C) % C]) ?? 0), 0)));
  }
  let cortesComp = null;
  function cortesCompetencia() {
    if (!cortesComp) cortesComp = quintiles(M.mosaicos.flatMap(m => competenciaLocal(m.clave).flat()));
    return cortesComp;
  }
  function relleno(ab, modo, comp) {
    const e = M.especie(ab);
    if (modo === "genero") return [GEN[e.genero][0], TXT[GEN[e.genero][1]]];
    if (modo === "competencia") { const [c, t] = RAMPA[clase(comp, cortesCompetencia())]; return [c, TXT[t]]; }
    return [e.color, e.txt];
  }
  function dibujarClave(svg, clave, { r = 24, modo = "especie", replica = false, difiere = null } = {}) {
    svg.replaceChildren();
    const F = clave.length, C = clave[0].length;
    const comp = modo === "competencia" ? competenciaLocal(clave) : null;
    const cen = (f, c) => [R3 * r * (c + 0.5 * f), 1.5 * r * f];
    const hex = (x, y) => "M" + [0, 1, 2, 3, 4, 5].map(i => { const a = (60 * i - 90) * Math.PI / 180; return `${(x + r * Math.cos(a)).toFixed(1)} ${(y + r * Math.sin(a)).toFixed(1)}`; }).join("L") + "Z";
    const pa = [C * R3 * r, 0], pb = [F * 0.5 * R3 * r, F * 1.5 * r];
    const copias = replica ? [-1, 0, 1].flatMap(i => [-1, 0, 1].map(j => [i, j])).filter(([i, j]) => i || j) : [];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const dibujar = (dx, dy, base) => {
      if (!base) return dibujarCopia(dx, dy);
      const g = el("g", { opacity: base ? 1 : 0.45 }, svg);
      for (let f = 0; f < F; f++) for (let c = 0; c < C; c++) {
        const [x, y] = cen(f, c), ab = clave[f][c], [fill, txt] = relleno(ab, modo, comp?.[f][c]);
        const px = x + dx, py = y + dy;
        x0 = Math.min(x0, px - r); x1 = Math.max(x1, px + r); y0 = Math.min(y0, py - r); y1 = Math.max(y1, py + r);
        const h = el("path", { d: hex(px, py), class: "hex", fill }, g);
        if (base) { h.dataset.f = f; h.dataset.c = c; h.dataset.ab = ab; if (comp) h.dataset.comp = comp[f][c]; }
        if (r >= 16) el("text", { x: px.toFixed(1), y: py.toFixed(1), fill: txt, "font-size": Math.round(r * 0.52) }, g).textContent = ab;
      }
      if (base && difiere) for (let f = 0; f < F; f++) for (let c = 0; c < C; c++)
        if (difiere[f][c]) { const [x, y] = cen(f, c); el("path", { d: hex(x + dx, y + dy), class: "resalte" }, g); }
    };
    const capaCopias = el("g", { opacity: 0.45 }, svg);
    function dibujarCopia(dx, dy) {
      for (let f = 0; f < F; f++) for (let c = 0; c < C; c++) {
        const [x, y] = cen(f, c), ab = clave[f][c], [fill, txt] = relleno(ab, modo, comp?.[f][c]);
        el("path", { d: hex(x + dx, y + dy), class: "hex", fill }, capaCopias);
        if (r >= 16) el("text", { x: (x + dx).toFixed(1), y: (y + dy).toFixed(1), fill: txt, "font-size": Math.round(r * 0.52) }, capaCopias).textContent = ab;
      }
    }
    // capaCopias se creó antes que la capa de la clave base, así que queda debajo de ella.
    dibujar(0, 0, true);
    for (const [i, j] of copias) dibujar(i * pa[0] + j * pb[0], i * pa[1] + j * pb[1], false);
    // Con réplica, el encuadre es la clave base más un anillo de vecinas de cada lado.
    const mx = replica ? 2.6 * R3 * r : 4, my = replica ? 2.6 * r : 4;
    svg.setAttribute("viewBox", `${(x0 - mx).toFixed(1)} ${(y0 - my).toFixed(1)} ${(x1 - x0 + 2 * mx).toFixed(1)} ${(y1 - y0 + 2 * my).toFixed(1)}`);
    svg.style.overflow = replica ? "hidden" : "visible";
  }
  function etiquetaHex(svg) {
    svg.addEventListener("pointermove", e => {
      const h = e.target.closest?.("path[data-ab]");
      if (!h) return ocultarEtiqueta();
      const sp = M.especie(h.dataset.ab);
      mostrarEtiqueta(`<span class="titulo binomial">${esc(sp.nombre)}</span><span class="rotulo">${esc(sp.genero === "Otras" ? "Otras" : sp.genero)} · fila ${+h.dataset.f + 1}, columna ${+h.dataset.c + 1}</span>`
        + (h.dataset.comp ? `<span class="valor">Competencia con sus 6 vecinas: ${fmt(+h.dataset.comp, 2)}</span>` : ""), e.clientX, e.clientY);
    });
    svg.addEventListener("pointerleave", ocultarEtiqueta);
  }
  const muestraHex = (color, tam = 16) => `<svg width="${tam}" height="${tam}" viewBox="-1 -1 2 2" aria-hidden="true"><path d="M0 -1L.866 -.5V.5L0 1L-.866 .5V-.5Z" fill="${color}" stroke="${TIERRA_SUAVE}" stroke-width=".09"/></svg>`;

  // ================= Vistas =================
  const vista = $("vista");
  const ESTADO = { factible: "factible", infactible: "no alcanza", banda_infactible: "sin solución en la banda δ" };
  const hechos = items => `<dl class="hechos">${items.map(([t, v, s]) => `<div><dt>${t}</dt><dd>${v}${s ? `<small>${s}</small>` : ""}</dd></div>`).join("")}</dl>`;
  const confianza = () => pct(1 - M.alfa);
  const poligonos = n => `${n} polígono${n === 1 ? "" : "s"}`;
  const veredictoSitio = () => {
    const T = M.tot, B = M.B;
    return T.factibles === 0 ? `Con ${dinero(B)} por hectárea, ningún polígono es factible.`
      : T.factibles === T.n ? `Con ${dinero(B)} por hectárea, los ${T.n} polígonos son factibles.`
      : `Con ${dinero(B)} por hectárea, ${T.factibles} de ${T.n} polígonos son factibles.`;
  };
  const veredictoPoligono = p => p.estado === "factible" ? `El polígono ${p.id} es factible con ${dinero(M.B)} por hectárea.`
    : p.estado === "infactible" ? `El polígono ${p.id} no alcanza con ${dinero(M.B)} por hectárea: necesita ${dinero(p.Bmin)}.`
    : `El polígono ${p.id} no tiene solución dentro de la banda δ.`;
  const faltaArchivo = (nombre, cmd, que) => `<h2>${que}</h2><p class="apoyo">Falta <code>${nombre}</code>. Se genera desde la raíz del repositorio con:</p><p class="nota"><code>${esc(cmd)}</code></p>`;

  // Ficha de la vista Mapa: la configuración del polígono elegido, en una columna angosta.
  function vistaMapa() {
    if (!S.p) {
      vista.innerHTML = `
        <p class="veredicto chico">${veredictoSitio()}</p>
        <p class="apoyo">Elige un polígono en el mapa o en el selector para ver su configuración: cuánto comprar de cada especie y con qué clave se planta. Acerca el mapa para ver cada planta.</p>
        <h2>Cómo moverse en el mapa</h2>
        <dl class="teclas">
          <div><dt>Rueda o pellizco</dt><dd>Acercar y alejar donde está el cursor</dd></div>
          <div><dt>Arrastrar</dt><dd>Mover el mapa</dd></div>
          <div><dt>Clic</dt><dd>Elegir un polígono; doble clic acerca</dd></div>
          <div><dt>← →</dt><dd>Recorrer los polígonos y encuadrarlos</dd></div>
          <div><dt>+ − 0</dt><dd>Acercar, alejar y ver todo el sitio</dd></div>
        </dl>
        <p class="nota">De lejos se ven los polígonos; a media distancia, la plantación por género; de cerca, cada planta con la abreviatura de su especie.</p>`;
      return;
    }
    const p = M.pols.get(S.p), m = M.mosaicos?.find(x => x.id === p.clave);
    vista.innerHTML = `
      <div><h2 class="ficha-titulo">Polígono ${p.id}</h2>
        <p class="nota">${fmt(p.area, 2)} ha${p.etiqueta != null ? ` · etiqueta ${p.etiqueta} del plano INECOL` : ""}</p></div>
      <p class="veredicto chico">${veredictoPoligono(p)}</p>
      ${hechos([["B* mínimo", p.Bmin == null ? "—" : dinero(p.Bmin), "/ha"], ["A comprar", fmt(p.x), "plantas"],
        ["Existentes", fmt(p.E), "plantas"], ["Densidad final", fmt((p.x + p.E) / p.area), "/ha"]])}
      ${p.forma && MP ? `<p><button class="suelto" id="f-encuadrar">Acercar al polígono</button></p>` : ""}
      ${m ? `<h2>Clave de plantación ${m.id}</h2>
        <svg class="clave-svg" id="f-clave" role="img" aria-label="Clave de plantación ${m.id} por especie"></svg>
        <p class="nota">${pct(1 - m.coef, 1)} menos competencia que una siembra al azar. La comparten ${poligonos(m.poligonos.length)}.</p>` : ""}
      <h2>Compra por especie</h2>
      <table class="tabla"><thead><tr><th class="izq">Especie</th><th>Existentes</th><th>A comprar</th></tr></thead>
        <tbody>${p.especies.map(s => { const e = M.especie(s.especie); return `<tr><td class="izq binomial"><span class="muestra">${muestraHex(e.color)}${esc(s.especie)}</span></td><td>${fmt(s.E)}</td><td>${fmt(s.x)}</td></tr>`; }).join("")}</tbody>
        <tfoot><tr><td class="izq">Total</td><td>${fmt(p.E)}</td><td>${fmt(p.x)}</td></tr></tfoot></table>
      <p class="enlaces"><button class="enlace" id="f-compra">Ver la compra completa</button>${m ? `<button class="enlace" id="f-mosaico">Ver la clave en Mosaico</button>` : ""}</p>`;
    if (m) { dibujarClave($("f-clave"), m.clave, { r: 12 }); etiquetaHex($("f-clave")); }
    $("f-encuadrar")?.addEventListener("click", () => encuadrarPoligono(p.id));
    $("f-compra").addEventListener("click", () => { S.v = "compra"; pintar(); });
    $("f-mosaico")?.addEventListener("click", () => { S.v = "mosaico"; pintar(); });
  }

  function vistaCompra() {
    const T = M.tot;
    if (!S.p) {
      const ver = veredictoSitio();
      const cols = [
        ["id", "Polígono", p => p.id, "izq"], ["area", "Área (ha)", p => fmt(p.area, 2)],
        ["estado", "Estado", p => `<span class="estado-${p.estado}">${ESTADO[p.estado] ?? esc(p.estado)}</span>`, "izq"],
        ["Bmin", "B* $/ha", p => p.Bmin == null ? "—" : dinero(p.Bmin)], ["compra", "Compra $/ha", p => dinero(p.compra / p.area)],
        ["total", "Compra + repos. $/ha", p => dinero((p.compra + p.repos) / p.area)], ["x", "Plantas a comprar", p => fmt(p.x)],
        ["xha", "Plantas/ha", p => fmt(p.x / p.area)], ["clave", "Clave", p => p.clave ?? "—"],
      ];
      const valorOrden = { id: p => p.id, area: p => p.area, estado: p => p.estado, Bmin: p => p.Bmin ?? Infinity, compra: p => p.compra / p.area,
        total: p => (p.compra + p.repos) / p.area, x: p => p.x, xha: p => p.x / p.area, clave: p => p.clave ?? 99 };
      const filas = M.ids.map(id => M.pols.get(id)).sort((a, b) => {
        const va = valorOrden[S.orden.col](a), vb = valorOrden[S.orden.col](b);
        return (va < vb ? -1 : va > vb ? 1 : a.id - b.id) * S.orden.dir;
      });
      const porEsp = M.especies.map(e => {
        const s = M.ids.flatMap(id => M.pols.get(id).especies.filter(x => x.especie === e.nombre));
        return { e, x: s.reduce((a, b) => a + b.x, 0), E: s.reduce((a, b) => a + b.E, 0), n: s.reduce((a, b) => a + b.n, 0) };
      });
      vista.innerHTML = `
        <p class="veredicto">${ver}</p>
        <p class="apoyo">Para cumplir la meta con ${confianza()} de probabilidad hace falta, en promedio ponderado por área, ${dinero(T.Bmin)} por hectárea. Los polígonos que no alcanzan muestran su plan óptimo sin límite de presupuesto.</p>
        ${hechos([["Área", fmt(T.area, 2), "ha"], ["Plantas a comprar", fmt(T.x), `${fmt(T.x / T.area)}/ha`],
          ["Plantas existentes", fmt(T.E), `${fmt(T.E / T.area)}/ha`], ["Densidad final", fmt((T.x + T.E) / T.area), "plantas/ha"],
          ["Compra + reposición, total", dinero(T.costo)]])}
        <h2>Por polígono</h2>
        <div class="tabla-caja"><table class="tabla" id="t-pols"><thead><tr>${cols.map(([k, t, , c]) =>
          `<th class="${c ?? ""}" ${S.orden.col === k ? `aria-sort="${S.orden.dir > 0 ? "ascending" : "descending"}"` : ""}><button data-orden="${k}">${t}</button></th>`).join("")}</tr></thead>
        <tbody>${filas.map(p => `<tr class="elegible" data-p="${p.id}" tabindex="0">${cols.map(([, , f, c]) => `<td class="${c ?? ""}">${f(p)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
        <p class="nota">Clic en una fila o en el mapa para ver la compra por especie del polígono.</p>
        <h2>Por especie, en todo el sitio</h2>
        <div class="tabla-caja"><table class="tabla"><thead><tr><th class="izq">Especie</th><th>Existentes</th><th>Meta n</th><th>A comprar</th><th>Del total comprado</th></tr></thead>
        <tbody>${porEsp.map(r => `<tr><td class="izq binomial"><span class="muestra">${muestraHex(r.e.color)}${esc(r.e.nombre)}</span></td><td>${fmt(r.E)}</td><td>${fmt(r.n)}</td><td>${fmt(r.x)}</td><td>${pct(r.x / T.x, 1)}</td></tr>`).join("")}</tbody>
        <tfoot><tr><td class="izq">Total</td><td>${fmt(T.E)}</td><td>${fmt(porEsp.reduce((s, r) => s + r.n, 0))}</td><td>${fmt(T.x)}</td><td>100 %</td></tr></tfoot></table></div>`;
      vista.querySelectorAll("[data-orden]").forEach(b => b.addEventListener("click", () => {
        const k = b.dataset.orden;
        S.orden = { col: k, dir: S.orden.col === k ? -S.orden.dir : 1 };
        pintarVista();
      }));
      vista.querySelectorAll("tr[data-p]").forEach(tr => {
        tr.addEventListener("click", () => elegirPoligono(+tr.dataset.p));
        tr.addEventListener("keydown", e => { if (e.key === "Enter") elegirPoligono(+tr.dataset.p); });
      });
      return;
    }
    const p = M.pols.get(S.p);
    const ver = veredictoPoligono(p);
    const escala = Math.max(...p.especies.map(s => Math.max(s.E + s.x, s.n)), 1);
    vista.innerHTML = `
      <p class="veredicto">${ver}</p>
      <p class="apoyo">${p.estado === "infactible" ? "Se muestra el plan óptimo sin límite de presupuesto. " : ""}La compra asegura la meta de cada especie con al menos ${confianza()} de probabilidad, considerando la supervivencia de lo plantado.${p.clave ? ` Se siembra con la <button class="enlace" id="ir-clave">clave ${p.clave}</button>.` : ""}</p>
      ${hechos([["Área", fmt(p.area, 2), "ha"], ["B* mínimo", p.Bmin == null ? "—" : dinero(p.Bmin), "/ha"],
        ["Compra", dinero(p.compra / p.area), "/ha"], ["Reposición esperada", dinero(p.repos / p.area), "/ha"],
        ["Plantas a comprar", fmt(p.x), `${fmt(p.x / p.area)}/ha`]])}
      <h2>Compra por especie</h2>
      <div class="tabla-caja"><table class="tabla"><thead><tr><th class="izq">Especie</th><th>Existentes E</th><th>Meta n</th><th>A comprar x</th><th>Déficit esperado E[D]</th>
        <th class="izq">Frente a la meta</th></tr></thead>
      <tbody>${p.especies.map(s => {
        const e = M.especie(s.especie), k = 140 / escala;
        return `<tr><td class="izq binomial"><span class="muestra">${muestraHex(e.color)}${esc(s.especie)}</span></td><td>${fmt(s.E)}</td><td>${fmt(s.n)}</td><td>${fmt(s.x)}</td><td>${fmt(s.deficit, 2)}</td>
          <td class="izq"><div class="barra-esp" role="img" aria-label="${fmt(s.E)} existentes y ${fmt(s.x)} a comprar; meta ${fmt(s.n)}">
            <span class="e" style="left:0;width:${(s.E * k).toFixed(1)}px"></span><span class="x" style="left:${(s.E * k).toFixed(1)}px;width:${(s.x * k).toFixed(1)}px;background:${e.color}"></span>
            <span class="meta" style="left:${(s.n * k - 1).toFixed(1)}px"></span></div></td></tr>`;
      }).join("")}</tbody>
      <tfoot><tr><td class="izq">Total</td><td>${fmt(p.E)}</td><td>${fmt(p.especies.reduce((a, s) => a + s.n, 0))}</td><td>${fmt(p.x)}</td><td>${fmt(p.especies.reduce((a, s) => a + s.deficit, 0), 2)}</td><td></td></tr></tfoot></table></div>
      <p class="nota">Se compra más que la diferencia entre la meta y lo existente porque parte de lo plantado no sobrevive. La barra hueca son las plantas existentes; la llena, las que se compran; la marca vertical, la meta n.</p>`;
    $("ir-clave")?.addEventListener("click", () => { S.v = "mosaico"; pintar(); });
  }

  function vistaMosaico() {
    if (!M.mosaicos) { vista.innerHTML = faltaArchivo("espacial.json", "./build/refor plan -f json", "Mosaico"); return; }
    const m = M.mosaicos.find(x => x.id === S.m);
    const red = 1 - m.coef, maxC = Math.max(m.azar, m.mejor, m.exacto?.competencia_exacto ?? 0), PX = 220 / maxC;
    const comp = Object.entries(m.composicion).map(([n, k]) => [M.especie(n), k]).sort((a, b) => b[1] - a[1]);
    const total = comp.reduce((s, [, k]) => s + k, 0);
    vista.innerHTML = `
      <div class="fila-controles">
        <span>Clave</span><div class="segmentado" role="group" aria-label="Clave">${M.mosaicos.map(x => `<button data-m="${x.id}" aria-pressed="${x.id === S.m}">${x.id}</button>`).join("")}</div>
        <span>Color</span><div class="segmentado" role="group" aria-label="Color de los hexágonos">
          ${[["especie", "Especie"], ["genero", "Género"], ["competencia", "Competencia"]].map(([k, t]) =>
            `<button data-modo="${k}" aria-pressed="${S.modo === k}" ${k === "competencia" && !M.W ? "disabled title=\"Falta competencia.csv\"" : ""}>${t}</button>`).join("")}</div>
        <label class="casilla"><input type="checkbox" id="replica" ${S.replica ? "checked" : ""}>Réplica 3 × 3</label>
      </div>
      <h2>Clave ${m.id}: ${poligonos(m.poligonos.length)}, ${fmt(m.area, 2)} ha</h2>
      <div class="mosaico-cuerpo">
        <div><svg class="clave-svg" id="clave-svg" role="img" aria-label="Clave de plantación ${m.id}, 4 filas por 13 columnas"></svg>
          <p class="nota" style="margin-top:10px">${S.modo === "competencia"
            ? "Cada hexágono se colorea por la suma de su competencia con sus seis vecinas (matriz W), en quintiles de todas las claves."
            : "Cada hexágono es una planta, al tresbolillo a 4.19 m. La clave se repite para cubrir el polígono."}</p></div>
        <div class="lado">
          <div><h3>Competencia total de la clave</h3>
            <div class="comparacion">
              <div class="serie"><span class="nombre">Esperada al azar</span><div class="fila"><span class="barra azar" style="width:${(m.azar * PX).toFixed(0)}px"></span>${fmt(m.azar, 2)}</div></div>
              <div class="serie"><span class="nombre">Memético, mejor de ${M.corridas ?? "las"} corridas</span><div class="fila"><span class="barra memetico" style="width:${(m.mejor * PX).toFixed(0)}px"></span>${fmt(m.mejor, 2)}</div></div>
            </div></div>
          <p class="reduccion">${pct(red, 1)} menos competencia<small>que una siembra al azar. Media de las corridas ${fmt(m.media, 3)}, d.e. ${fmt(m.de, 4)}.</small></p>
          <div><h3>Composición (${total} posiciones)</h3><ul class="composicion">${comp.map(([e, k]) =>
            `<li>${muestraHex(e.color)}<span class="binomial">${esc(e.nombre)}</span><span>${k}</span></li>`).join("")}</ul></div>
          <div><h3>Polígonos que la usan</h3><div class="chips">${m.poligonos.map(id => `<button data-p="${id}" aria-pressed="${id === S.p}">${id}</button>`).join("")}</div></div>
        </div>
      </div>`;
    const svg = $("clave-svg");
    dibujarClave(svg, m.clave, { r: 26, modo: S.modo, replica: S.replica });
    etiquetaHex(svg);
    vista.querySelectorAll("[data-m]").forEach(b => b.addEventListener("click", () => elegirMosaico(+b.dataset.m)));
    vista.querySelectorAll("[data-modo]").forEach(b => b.addEventListener("click", () => { S.modo = b.dataset.modo; pintarVista(); }));
    $("replica").addEventListener("change", e => { S.replica = e.target.checked; pintarVista(); });
    vista.querySelectorAll(".chips [data-p]").forEach(b => b.addEventListener("click", () => elegirPoligono(+b.dataset.p)));
  }

  const ESTADO_EXACTO = { "Time limit reached": "límite de tiempo", "Optimal": "óptimo" };
  function vistaExacto() {
    if (!M.mosaicos) { vista.innerHTML = faltaArchivo("espacial.json", "./build/refor plan -f json", "Memético vs. exacto"); return; }
    if (!M.hayExacto) { vista.innerHTML = faltaArchivo("exacto.json", "./build/refor plan --exacto -f json", "Memético vs. exacto")
      + `<p class="nota">El modelo entero (HiGHS) tarda unos 300 s por mosaico. Sin él, la vista de Mosaico ya muestra la competencia del memético frente al azar.</p>`; return; }
    const m = M.mosaicos.find(x => x.id === S.m), x = m.exacto;
    const ests = M.mosaicos.map(k => k.exacto).filter(Boolean);
    const optimos = ests.filter(e => e.optimo).length;
    vista.innerHTML = `
      <p class="veredicto">${optimos === ests.length ? "El modelo entero cerró la brecha en todas las claves."
        : `El memético queda a lo más a ${fmt(Math.max(...ests.map(e => e.brecha_memetico_pct)), 1)} % de la cota del modelo entero.`}</p>
      <p class="apoyo">${optimos === ests.length ? "" : `El modelo entero ${optimos ? `probó el óptimo en ${optimos} de ${ests.length} claves y en las demás` : "no probó el óptimo en ninguna clave:"} llegó a su límite de tiempo. `}La brecha se mide contra la cota inferior, así que el óptimo real puede estar más cerca del memético.</p>
      <div class="tabla-caja"><table class="tabla"><thead><tr><th class="izq">Clave</th><th>Polígonos</th><th>Memético</th><th>Exacto</th><th>Cota inferior</th>
        <th>Brecha del memético</th><th class="izq">Estado del exacto</th><th>Posiciones distintas</th></tr></thead>
      <tbody>${M.mosaicos.map(k => { const e = k.exacto; return `<tr class="elegible" data-m="${k.id}" tabindex="0" aria-selected="${k.id === S.m}">
        <td class="izq">${k.id}</td><td>${k.poligonos.length}</td><td>${fmt(k.mejor, 2)}</td>
        <td>${e ? fmt(e.competencia_exacto, 2) : "—"}</td><td>${e ? fmt(e.cota_inferior, 2) : "—"}</td><td>${e ? fmt(e.brecha_memetico_pct, 2) + " %" : "—"}</td>
        <td class="izq">${e ? `${esc(ESTADO_EXACTO[e.estado] ?? e.estado)} (${fmt(e.segundos)} s)` : "sin correr"}</td><td>${e ? e.posiciones_distintas : "—"}</td></tr>`; }).join("")}</tbody></table></div>
      ${x ? `<h2>Clave ${m.id}: el exacto en el tiempo</h2>
      <svg class="grafica" id="traza" role="img" aria-label="Valor del exacto y su cota inferior a lo largo de la corrida"></svg>
      <p class="nota">La línea continua es la mejor siembra que ha encontrado el exacto; la discontinua, su cota inferior. La zona sombreada es la brecha que queda abierta.</p>
      <h2>Las dos claves, lado a lado</h2>
      <div class="dos-claves">
        <div><h3>Memético</h3><svg class="clave-svg" id="clave-mem" role="img" aria-label="Clave del memético"></svg></div>
        <div><h3>Exacto${x.posiciones_distintas ? ` · ${x.posiciones_distintas} posiciones distintas, con contorno` : " · idéntica a la del memético"}</h3><svg class="clave-svg" id="clave-ex" role="img" aria-label="Clave del exacto"></svg></div>
      </div>` : `<p class="apoyo">La clave ${m.id} no tiene corrida del modelo entero.</p>`}`;
    vista.querySelectorAll("tr[data-m]").forEach(tr => {
      tr.addEventListener("click", () => elegirMosaico(+tr.dataset.m));
      tr.addEventListener("keydown", e => { if (e.key === "Enter") elegirMosaico(+tr.dataset.m); });
    });
    if (!x) return;
    grafTraza($("traza"), m);
    const difiere = x.clave ? m.clave.map((fila, f) => fila.map((ab, c) => x.clave[f]?.[c] !== ab)) : null;
    for (const [id, clave, dif] of [["clave-mem", m.clave, null], ["clave-ex", x.clave ?? m.clave, difiere]]) {
      dibujarClave($(id), clave, { r: 20, difiere: dif });
      etiquetaHex($(id));
    }
  }

  function grafTraza(svg, m) {
    const x = m.exacto, tr = x.traza ?? [];
    const W = Math.max(480, svg.clientWidth || vista.clientWidth), H = 280, ml = 56, mr = 150, mt = 16, mb = 40;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("height", H);
    const tmax = x.segundos || Math.max(...tr.map(t => t[0]), 1);
    const vals = [m.mejor, x.competencia_exacto, x.cota_inferior, ...tr.flatMap(t => [t[1], t[2]]).filter(v => v != null)];
    const v0 = Math.min(...vals), v1 = Math.max(...vals), padv = (v1 - v0) * 0.08 || 1;
    const X = t => ml + (t / tmax) * (W - ml - mr), Y = v => mt + (1 - (v - (v0 - padv)) / ((v1 + padv) - (v0 - padv))) * (H - mt - mb);
    const escalon = (i) => {
      const pts = tr.filter(t => t[i] != null);
      if (!pts.length) return [];
      const out = [];
      pts.forEach((t, k) => { if (k) out.push([t[0], pts[k - 1][i]]); out.push([t[0], t[i]]); });
      out.push([tmax, pts[pts.length - 1][i]]);
      return out;
    };
    const inc = escalon(1), cota = escalon(2);
    const linea = pts => "M" + pts.map(([t, v]) => `${X(t).toFixed(1)} ${Y(v).toFixed(1)}`).join("L");
    if (inc.length && cota.length) {
      const t0 = cota[0][0], arriba = inc.filter(p => p[0] >= t0);
      el("path", { d: linea([[t0, inc.filter(p => p[0] <= t0).pop()?.[1] ?? inc[0][1]], ...arriba]) + "L" + cota.slice().reverse().map(([t, v]) => `${X(t).toFixed(1)} ${Y(v).toFixed(1)}`).join("L") + "Z",
        fill: OCRE, "fill-opacity": 0.35 }, svg);
    }
    el("path", { d: `M${ml} ${H - mb}H${W - mr}`, class: "eje" }, svg);
    for (const t of [0, tmax / 4, tmax / 2, 3 * tmax / 4, tmax]) {
      el("path", { d: `M${X(t)} ${H - mb}v5`, class: "eje" }, svg);
      el("text", { x: X(t), y: H - mb + 20, "text-anchor": "middle" }, svg).textContent = `${fmt(t)} s`;
    }
    for (const v of [v0, (v0 + v1) / 2, v1]) el("text", { x: ml - 10, y: Y(v) + 4, "text-anchor": "end" }, svg).textContent = fmt(v, 1);
    el("path", { d: `M${ml} ${Y(m.mejor)}H${W - mr}`, stroke: SALVIA_HONDA, "stroke-width": 2, fill: "none" }, svg);
    if (inc.length) el("path", { d: linea(inc), stroke: TIERRA, "stroke-width": 2, fill: "none" }, svg);
    if (cota.length) el("path", { d: linea(cota), stroke: TIERRA, "stroke-width": 1.25, "stroke-dasharray": "5 4", fill: "none" }, svg);
    // Rótulos directos a la derecha; si memético y exacto coinciden, uno solo.
    const rot = [];
    if (Math.abs(m.mejor - x.competencia_exacto) < 1e-6) rot.push([m.mejor, `Memético y exacto ${fmt(m.mejor, 2)}`, "fuerte"]);
    else { rot.push([m.mejor, `Memético ${fmt(m.mejor, 2)}`, "fuerte"]); rot.push([x.competencia_exacto, `Exacto ${fmt(x.competencia_exacto, 2)}`, "fuerte"]); }
    rot.push([x.cota_inferior, `Cota ${fmt(x.cota_inferior, 2)}`, ""]);
    rot.sort((a, b) => b[0] - a[0]);
    let yPrev = -Infinity;
    for (const [v, t, c] of rot) { const y = Math.max(Y(v) + 4, yPrev + 16); yPrev = y; el("text", { x: W - mr + 10, y, class: c }, svg).textContent = t; }
    el("text", { x: W - mr + 10, y: (Y(x.competencia_exacto) + Y(x.cota_inferior)) / 2 + 22, class: "acento" }, svg).textContent = `brecha ${fmt(x.brecha_memetico_pct, 2)} %`;
  }

  function vistaPresupuesto() {
    const p = S.p ? M.pols.get(S.p) : null;
    const partes = [];
    if (!M.frontera) partes.push(faltaArchivo("frontera.csv", "./build/refor frontera -f csv", "Frontera B*(α)"));
    else {
      const curva = p ? (M.frontera.porPol.get(p.id) ?? []) : M.frontera.sitio;
      const enA = curva.find(f => Math.abs(f[0] - M.alfa) < 1e-9);
      const bmin = Math.min(...curva.map(f => f[1]).filter(v => v != null));
      partes.push(`<p class="veredicto">${bmin > M.B
        ? `Ningún nivel de riesgo α entre ${curva[0][0]} y ${curva[curva.length - 1][0]} cabe en ${dinero(M.B)} por hectárea${p ? ` para el polígono ${p.id}` : ""}.`
        : `${p ? `El polígono ${p.id}` : "El sitio"} cabe en ${dinero(M.B)} por hectárea a partir de α = ${curva.find(f => f[1] != null && f[1] <= M.B)[0]}.`}</p>
        <p class="apoyo">${enA ? `Con α = ${M.alfa} (${confianza()} de confianza) el presupuesto mínimo es ${dinero(enA[1])} por hectárea${p ? "" : ", en promedio ponderado por área"}. ` : ""}Aceptar más riesgo baja el presupuesto mínimo, pero poco: ${dinero(curva[0][1])} con α = ${curva[0][0]} contra ${dinero(curva[curva.length - 1][1])} con α = ${curva[curva.length - 1][0]}.</p>
        <h2>Frontera B*(α)${p ? `, polígono ${p.id}` : ", todo el sitio"}</h2>
        <svg class="grafica" id="frontera" role="img" aria-label="Presupuesto mínimo por nivel de riesgo α"></svg>
        <p class="nota">${p ? "La línea gruesa es el polígono elegido; las finas, los otros polígonos." : "La línea gruesa es el sitio, ponderado por área; las finas, cada polígono."} La zona sombreada es lo que falta para llegar a la meta con el presupuesto disponible.</p>
        <div class="tabla-caja"><table class="tabla" style="max-width:520px"><thead><tr><th class="izq">α</th><th>Confianza</th><th>B* $/ha</th><th>Costo sin presupuesto $/ha</th></tr></thead>
        <tbody>${curva.map(([a, b, l]) => `<tr${Math.abs(a - M.alfa) < 1e-9 ? ' aria-selected="true"' : ""}><td class="izq">${a}</td><td>${pct(1 - a)}</td><td>${b == null ? "—" : dinero(b)}</td><td>${l == null ? "—" : dinero(l)}</td></tr>`).join("")}</tbody></table></div>`);
    }
    if (!M.barrido) partes.push(faltaArchivo("barrido.csv", "./build/refor barrido -f csv", "Rejilla α × B"));
    else {
      const { alfas, Bs, celda, porPol } = M.barrido, est = p ? porPol.get(p.id) : null;
      const miles = b => fmt(b / 1000, b % 1000 ? 2 : 0).replace(/(\.\d)0$/, "$1");
      partes.push(`<h2>Rejilla α × B${p ? `, polígono ${p.id}` : ""}</h2>
        <p class="apoyo">${p ? "Cada celda dice si el polígono es factible con ese presupuesto y ese nivel de riesgo." : "Cada celda dice cuántos polígonos son factibles con ese presupuesto y ese nivel de riesgo."} El contorno marca el plan de <code>compra.json</code>.</p>
        <div class="tabla-caja"><table class="rejilla"><thead><tr><th scope="col">α \\ B</th>${Bs.map(b => `<th scope="col">${miles(b)}</th>`).join("")}</tr></thead>
        <tbody>${alfas.map(a => `<tr><th scope="row">${a}</th>${Bs.map(b => {
          const k = `${a}|${b}`, plan = Math.abs(a - M.alfa) < 1e-9 && b === M.B ? ' class="plan"' : "";
          if (est) { const f = est.get(k) === "factible"; const [c, t] = f ? RAMPA[3] : RAMPA[0]; return `<td${plan} style="background:${c};color:${TXT[t]}" title="α ${a}, ${dinero(b)}/ha: ${f ? "factible" : "no alcanza"}">${f ? "sí" : ""}</td>`; }
          const z = celda.get(k); if (!z) return "<td></td>";
          const i = z.fact === 0 ? 0 : Math.min(4, 1 + Math.floor((z.fact / z.tot) * 4 - 1e-9));
          const [c, t] = RAMPA[i];
          return `<td${plan} style="background:${c};color:${TXT[t]}" title="α ${a}, ${dinero(b)}/ha: ${z.fact} de ${z.tot} factibles">${z.fact}</td>`;
        }).join("")}</tr>`).join("")}</tbody></table></div>
        <p class="nota">Presupuesto B en miles de pesos por hectárea.${p ? "" : ` Tonos más oscuros: más polígonos factibles (de ${M.tot.n}).`}</p>`);
    }
    vista.innerHTML = partes.join("");
    if (M.frontera && $("frontera")) grafFrontera($("frontera"), p);
  }

  function grafFrontera(svg, p) {
    const { porPol, sitio, alfas } = M.frontera;
    const foco = p ? (porPol.get(p.id) ?? []) : sitio;
    const W = Math.max(480, svg.clientWidth || vista.clientWidth), H = 330, ml = 70, mr = 190, mt = 16, mb = 52;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("height", H);
    const todas = [...porPol.values()].flat().map(f => f[1]).filter(v => v != null);
    const b0 = Math.min(M.B, ...todas), b1 = Math.max(M.B, ...todas), pad = (b1 - b0) * 0.06;
    const la0 = Math.log(alfas[0]), la1 = Math.log(alfas[alfas.length - 1]);
    const X = a => ml + (Math.log(a) - la0) / (la1 - la0 || 1) * (W - ml - mr);
    const Y = b => mt + (1 - (b - (b0 - pad)) / ((b1 + pad) - (b0 - pad))) * (H - mt - mb);
    const linea = f => "M" + f.filter(r => r[1] != null).map(([a, b]) => `${X(a).toFixed(1)} ${Y(b).toFixed(1)}`).join("L");
    const fc = foco.filter(r => r[1] != null);
    if (fc.length) el("path", { d: "M" + fc.map(([a, b]) => `${X(a).toFixed(1)} ${Y(Math.max(b, M.B)).toFixed(1)}`).join("L")
      + `L${X(fc[fc.length - 1][0]).toFixed(1)} ${Y(M.B).toFixed(1)}L${X(fc[0][0]).toFixed(1)} ${Y(M.B).toFixed(1)}Z`, fill: OCRE, "fill-opacity": 0.35 }, svg);
    for (const [id, f] of porPol) if (!p || id !== p.id) el("path", { d: linea(f), stroke: TIERRA_SUAVE, "stroke-opacity": 0.35, "stroke-width": 1, fill: "none" }, svg);
    el("path", { d: `M${ml} ${H - mb}H${W - mr}`, class: "eje" }, svg);
    for (const a of alfas) {
      el("path", { d: `M${X(a)} ${H - mb}v5`, class: "eje" }, svg);
      el("text", { x: X(a), y: H - mb + 20, "text-anchor": "middle" }, svg).textContent = a;
    }
    el("text", { x: W - mr, y: H - mb + 42, "text-anchor": "end" }, svg).textContent = "nivel de riesgo α, en escala logarítmica";
    const paso = [100, 250, 500, 1000].find(s => (b1 - b0) / s <= 6) ?? 1000;
    for (let b = Math.ceil(b0 / paso) * paso; b <= b1; b += paso) el("text", { x: ml - 10, y: Y(b) + 4, "text-anchor": "end" }, svg).textContent = dinero(b);
    el("path", { d: `M${ml} ${Y(M.B)}H${W - mr}`, stroke: OCRE_HONDO, "stroke-width": 2, "stroke-dasharray": "7 5", fill: "none" }, svg);
    el("text", { x: W - mr + 10, y: Y(M.B) + 4, class: "acento" }, svg).textContent = `Disponible ${dinero(M.B)}/ha`;
    if (fc.length) {
      el("path", { d: linea(foco), stroke: TIERRA, "stroke-width": 2.25, fill: "none" }, svg);
      const u = fc[fc.length - 1];
      el("text", { x: W - mr + 10, y: Math.min(Y(u[1]) + 4, Y(M.B) - 14), class: "fuerte" }, svg).textContent = p ? `Polígono ${p.id}` : "Todo el sitio";
      const r = fc.find(f => Math.abs(f[0] - M.alfa) < 1e-9);
      if (r) {
        el("circle", { cx: X(r[0]), cy: Y(r[1]), r: 4.5, fill: TIERRA }, svg);
        el("text", { x: X(r[0]) + 10, y: Y(r[1]) - 10, class: "fuerte" }, svg).textContent = `α = ${r[0]}: ${dinero(r[1])}`;
      }
    }
  }

  // ================= Pintado general =================
  const selPol = $("sel-pol");
  function pintarVista() {
    ocultarEtiqueta();
    ({ mapa: vistaMapa, compra: vistaCompra, mosaico: vistaMosaico, exacto: vistaExacto, presupuesto: vistaPresupuesto })[S.v]();
  }
  function pintar() {
    document.querySelectorAll("[role=tab]").forEach(t => { const on = t.dataset.v === S.v; t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1; });
    selPol.value = S.p ?? "";
    $("b-sitio").hidden = !S.p;
    $("visor").classList.toggle("modo-mapa", S.v === "mapa");
    pintarCapaMapa();
    pintarVista();
    escribirHash();
  }

  function listaArchivos() {
    const filas = (estadoArchivos.length ? estadoArchivos : ARCHIVOS.map(spec => ({ spec, ruta: null, error: null }))).map(({ spec, ruta, error }) => {
      const ok = ruta && !error;
      const marca = `<svg width="12" height="12" viewBox="-1 -1 2 2" aria-hidden="true"><path d="M0 -1L.866 -.5V.5L0 1L-.866 .5V-.5Z" fill="${ok ? SALVIA_HONDA : "none"}" stroke="${ok ? SALVIA_HONDA : TIERRA_SUAVE}" stroke-width=".18"/></svg>`;
      const estado = error ? `<span class="error">${esc(ruta)}: ${esc(error)}</span>` : ruta ? `<span class="ruta">${esc(ruta)}</span>`
        : `<span class="falta">${spec.requerido ? "Falta (indispensable)" : "Falta"}</span> · <code>${esc(spec.cmd)}</code>`;
      return `<tr><td><span class="marca-archivo">${marca}${spec.nombre}</span></td><td>${spec.usa}</td><td>${estado}</td></tr>`;
    }).join("");
    return `<table class="archivos"><thead><tr><th>Archivo</th><th>Alimenta</th><th>Encontrado en</th></tr></thead><tbody>${filas}</tbody></table>`;
  }
  const marcaAviso = `<svg width="11" height="11" viewBox="-1 -1 2 2" aria-hidden="true"><path d="M0 -1L.866 -.5V.5L0 1L-.866 .5V-.5Z" fill="${OCRE_HONDO}"/></svg>`;

  function mostrarVacio(error) {
    $("vacio").hidden = false; $("visor").hidden = true; $("pestanas").hidden = true; $("b-archivos").hidden = true; $("archivos").hidden = true;
    $("lista-vacio").innerHTML = (error ? `<p class="apoyo" style="color:var(--ocre-hondo);margin-bottom:16px">${esc(error)}</p>` : "") + listaArchivos();
    $("avisos").hidden = true;
  }
  function mostrarVisor() {
    $("vacio").hidden = true; $("visor").hidden = false; $("pestanas").hidden = false;
    $("visor").classList.toggle("modo-mapa", S.v === "mapa");
    const hay = estadoArchivos.filter(a => a.ruta && !a.error).length;
    const bA = $("b-archivos");
    bA.hidden = false; bA.textContent = `Archivos: ${hay} de ${ARCHIVOS.length}`;
    $("archivos").innerHTML = listaArchivos();
    $("corrida").innerHTML = `α = ${M.alfa} · presupuesto ${dinero(M.B)}/ha · ${M.tot.n} polígonos, ${fmt(M.tot.area, 2)} ha${M.mosaicos ? ` · ${M.mosaicos.length} claves` : ""}`;
    const errores = estadoArchivos.filter(a => a.error).map(a => `${a.spec.nombre} no se pudo leer: ${a.error}.`);
    const av = [...errores, ...M.avisos];
    $("avisos").hidden = !av.length;
    $("avisos").innerHTML = av.map(t => `<p>${marcaAviso}<span>${esc(t)}</span></p>`).join("");
    selPol.innerHTML = `<option value="">Todo el sitio</option>` + M.ids.map(id => `<option value="${id}">${id} · ${fmt(M.pols.get(id).area, 2)} ha</option>`).join("");
    cortesComp = null;
    construirMapa();
    pintar();
  }

  // ================= Eventos generales =================
  document.querySelectorAll("[role=tab]").forEach(t => {
    t.addEventListener("click", () => { S.v = t.dataset.v; pintar(); });
    t.addEventListener("keydown", e => {
      const i = VISTAS.indexOf(S.v);
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      S.v = VISTAS[(i + (e.key === "ArrowRight" ? 1 : VISTAS.length - 1)) % VISTAS.length];
      pintar();
      $("t-" + S.v).focus();
    });
  });
  selPol.addEventListener("change", () => elegirPoligono(selPol.value ? +selPol.value : null, true));
  $("b-sitio").addEventListener("click", () => elegirPoligono(null, true));
  $("b-archivos").addEventListener("click", e => {
    const ab = $("archivos").hidden;
    $("archivos").hidden = !ab;
    e.currentTarget.setAttribute("aria-expanded", ab);
  });
  for (const b of [$("b-cargar"), $("b-cargar-vacio")]) b.addEventListener("click", recargar);
  // El mapa se redibuja cuando cambia su propio marco; las gráficas, cuando cambia el ancho de la vista.
  new ResizeObserver(() => { if (M) medirMapa(); }).observe(marco);
  let ancho = 0;
  new ResizeObserver(() => {
    if (!M) return;
    const w = vista.clientWidth;
    if (Math.abs(w - ancho) > 40 && (S.v === "presupuesto" || S.v === "exacto")) pintarVista();
    ancho = w;
  }).observe(document.body);

  // Embebido en el deck: PageUp y PageDown (los del control remoto) siguen pasando de lámina.
  if (window.parent !== window) addEventListener("keydown", e => {
    if (e.key !== "PageUp" && e.key !== "PageDown") return;
    e.preventDefault();
    window.parent.dispatchEvent(new KeyboardEvent("keydown", { key: e.key }));
  });
  recargar();
  // Punto de entrada para pruebas y para cargar resultados desde otro script.
  window.Visor = { cargar, camara: () => MP && { ...MP.cam, hexPx: RHEX * MP.cam.k, nivel: MP.nivel, kMax: kMax() } };
})();
