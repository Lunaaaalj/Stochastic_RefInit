// Láminas de herbario provisionales (DESIGN.md, sección 4): trazo lineal en
// tierra y una aguada plana del color de la especie, desfasada del trazo.
// Son dibujos propios y esquemáticos; se reemplazan cuando estén las láminas
// definitivas. Cada una ocupa un viewBox de 200 × 200 con el suelo en y = 184.

const Herbario = (() => {
  "use strict";

  const TIERRA = "#4C4541";
  const SUELO = 184;

  function azar(semilla) {
    let a = semilla >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const n = v => v.toFixed(1);

  // Cada dibujo junta trazos (líneas) y aguadas (rellenos) por separado.
  function lienzo() {
    return { trazo: [], aguada: [], fino: [] };
  }

  // Hoja lanceolada de agave que sale de (x0, y0) con ángulo a (0 = vertical).
  function hoja(d, x0, y0, a, largo, ancho, curva, dientes, r) {
    const s = Math.sin(a), c = Math.cos(a);
    const tx = x0 + s * largo + curva * largo * Math.sign(s || 1) * 0.25;
    const ty = y0 - c * largo + curva * largo * 0.35;
    const px = c, py = s; // perpendicular
    const mx = x0 + s * largo * 0.5, my = y0 - c * largo * 0.5;
    const L = [x0 - px * ancho * 0.5, y0 - py * ancho * 0.5];
    const R = [x0 + px * ancho * 0.5, y0 + py * ancho * 0.5];
    const cL = [mx - px * ancho * 0.7, my - py * ancho * 0.7];
    const cR = [mx + px * ancho * 0.7, my + py * ancho * 0.7];
    const p = `M${n(L[0])} ${n(L[1])}Q${n(cL[0])} ${n(cL[1])} ${n(tx)} ${n(ty)}Q${n(cR[0])} ${n(cR[1])} ${n(R[0])} ${n(R[1])}`;
    d.trazo.push(p);
    d.aguada.push(p + "Z");
    // Espina terminal.
    const ex = tx - x0, ey = ty - y0, el = Math.hypot(ex, ey) || 1;
    d.trazo.push(`M${n(tx)} ${n(ty)}l${n(ex / el * 6)} ${n(ey / el * 6)}`);
    // Nervadura central.
    d.fino.push(`M${n(x0)} ${n(y0)}Q${n(mx)} ${n(my)} ${n(tx - ex / el * 4)} ${n(ty - ey / el * 4)}`);
    if (dientes) {
      for (let t = 0.25; t < 0.9; t += 0.16) {
        for (const lado of [-1, 1]) {
          const bx = (1 - t) * (1 - t) * (lado < 0 ? L[0] : R[0]) + 2 * (1 - t) * t * (lado < 0 ? cL[0] : cR[0]) + t * t * tx;
          const by = (1 - t) * (1 - t) * (lado < 0 ? L[1] : R[1]) + 2 * (1 - t) * t * (lado < 0 ? cL[1] : cR[1]) + t * t * ty;
          d.fino.push(`M${n(bx)} ${n(by)}l${n(lado * px * 3 + (r() - 0.5))} ${n(lado * py * 3)}`);
        }
      }
    }
  }

  function roseta(d, cx, cy, cfg, r) {
    const hojas = [];
    for (let i = 0; i < cfg.n; i++) {
      const t = cfg.n === 1 ? 0 : i / (cfg.n - 1);
      const a = (t - 0.5) * 2 * cfg.abre + (r() - 0.5) * 0.12;
      hojas.push({ a, largo: cfg.largo * (0.8 + 0.25 * r()) * (1 - Math.abs(t - 0.5) * cfg.acorta) });
    }
    // Las de los lados van atrás; las centrales, al frente.
    hojas.sort((p, q) => Math.abs(q.a) - Math.abs(p.a));
    for (const h of hojas) hoja(d, cx + h.a * 4, cy, h.a, h.largo, cfg.ancho, cfg.curva, cfg.dientes, r);
  }

  // Roseta esférica de hojas filiformes (A. striata, cabezas de Yucca).
  function esfera(d, cx, cy, radio, cuantas, r, fibras) {
    for (let i = 0; i < cuantas; i++) {
      const a = -Math.PI * (0.02 + 0.96 * (i / (cuantas - 1))) + (r() - 0.5) * 0.08;
      const l = radio * (0.75 + 0.3 * r());
      const x1 = cx + Math.cos(a) * l, y1 = cy + Math.sin(a) * l * 0.95;
      const qx = cx + Math.cos(a) * l * 0.5 + (r() - 0.5) * 4, qy = cy + Math.sin(a) * l * 0.5;
      d.trazo.push(`M${n(cx)} ${n(cy)}Q${n(qx)} ${n(qy)} ${n(x1)} ${n(y1)}`);
      if (fibras && i % 3 === 0) d.fino.push(`M${n(x1)} ${n(y1)}q${n(r() * 6 - 3)} ${n(4 + r() * 4)} ${n(r() * 4 - 2)} ${n(9 + r() * 5)}`);
    }
    d.aguada.push(`M${n(cx - radio)} ${n(cy)}A${n(radio)} ${n(radio * 0.95)} 0 0 1 ${n(cx + radio)} ${n(cy)}Z`);
  }

  // Penca de nopal: elipse girada, con areolas.
  function penca(d, cx, cy, rx, ry, giro, areolas, r, espinas) {
    const g = giro * Math.PI / 180;
    const p = `M${n(cx + Math.sin(g) * ry)} ${n(cy - Math.cos(g) * ry)}` +
      `A${n(rx)} ${n(ry)} ${n(giro)} 1 1 ${n(cx - Math.sin(g) * ry)} ${n(cy + Math.cos(g) * ry)}` +
      `A${n(rx)} ${n(ry)} ${n(giro)} 1 1 ${n(cx + Math.sin(g) * ry)} ${n(cy - Math.cos(g) * ry)}Z`;
    d.trazo.push(p);
    d.aguada.push(p);
    for (let i = 0; i < areolas; i++) {
      const u = (r() * 2 - 1) * 0.72, v = (r() * 2 - 1) * 0.78;
      if (u * u + v * v > 0.62) continue;
      const lx = u * rx, ly = v * ry;
      const x = cx + lx * Math.cos(g) - ly * Math.sin(g), y = cy + lx * Math.sin(g) + ly * Math.cos(g);
      d.fino.push(`M${n(x - 0.6)} ${n(y)}h1.2`);
      for (let k = 0; k < espinas; k++) {
        const a = -Math.PI / 2 + (k - (espinas - 1) / 2) * 0.7 + (r() - 0.5) * 0.4;
        d.fino.push(`M${n(x)} ${n(y)}l${n(Math.cos(a) * 4.5)} ${n(Math.sin(a) * 4.5)}`);
      }
    }
  }

  function tronco(d, x, y0, y1, ancho, r) {
    const p = `M${n(x - ancho / 2)} ${n(y0)}C${n(x - ancho / 2 - 2)} ${n((y0 + y1) / 2)} ${n(x - ancho / 2 + 2)} ${n((y0 + y1) / 2)} ${n(x - ancho / 3)} ${n(y1)}` +
      `M${n(x + ancho / 2)} ${n(y0)}C${n(x + ancho / 2 + 2)} ${n((y0 + y1) / 2)} ${n(x + ancho / 2 - 2)} ${n((y0 + y1) / 2)} ${n(x + ancho / 3)} ${n(y1)}`;
    d.trazo.push(p);
    // Achurado fino del tronco.
    for (let y = y0 - 6; y > y1 + 4; y -= 7) d.fino.push(`M${n(x - ancho / 2 + 2)} ${n(y)}l${n(ancho * 0.45)} ${n(-3 - r() * 2)}`);
  }

  function rama(d, x, y, a, largo, nivel, r, puntas) {
    const x1 = x + Math.sin(a) * largo, y1 = y - Math.cos(a) * largo;
    const qx = (x + x1) / 2 + (r() - 0.5) * largo * 0.25, qy = (y + y1) / 2;
    d.trazo.push(`M${n(x)} ${n(y)}Q${n(qx)} ${n(qy)} ${n(x1)} ${n(y1)}`);
    if (nivel === 0) { puntas.push([x1, y1, a]); return; }
    const k = nivel > 2 ? 2 : 2 + (r() < 0.4 ? 1 : 0);
    for (let i = 0; i < k; i++) {
      const na = a + (i - (k - 1) / 2) * (0.55 + r() * 0.3);
      rama(d, x1, y1, na, largo * (0.68 + r() * 0.12), nivel - 1, r, puntas);
    }
  }

  // Follaje bipinnado del mezquite: pinnas con foliolos en espiga.
  function pinna(d, x, y, a, largo) {
    const dx = Math.sin(a), dy = -Math.cos(a);
    d.fino.push(`M${n(x)} ${n(y)}l${n(dx * largo)} ${n(dy * largo)}`);
    for (let t = 0.2; t <= 1; t += 0.16) {
      const px = x + dx * largo * t, py = y + dy * largo * t;
      d.fino.push(`M${n(px)} ${n(py)}l${n(dy * 3.2 + dx)} ${n(-dx * 3.2 + dy)}M${n(px)} ${n(py)}l${n(-dy * 3.2 + dx)} ${n(dx * 3.2 + dy)}`);
    }
  }

  const dibujos = {
    "Agave lechuguilla": r => { const d = lienzo(); roseta(d, 100, SUELO - 2, { n: 15, abre: 0.85, largo: 92, ancho: 9, curva: 0.12, acorta: 0.4, dientes: true }, r); return d; },
    "Agave salmiana": r => { const d = lienzo(); roseta(d, 100, SUELO - 2, { n: 11, abre: 1.25, largo: 98, ancho: 25, curva: 0.42, acorta: 0.55, dientes: true }, r); return d; },
    "Agave scabra": r => {
      const d = lienzo(); roseta(d, 100, SUELO - 2, { n: 10, abre: 1.15, largo: 72, ancho: 22, curva: 0.3, acorta: 0.45, dientes: true }, r);
      for (let i = 0; i < 46; i++) { const x = 60 + r() * 80, y = 120 + r() * 58; d.fino.push(`M${n(x)} ${n(y)}h.8`); }
      return d;
    },
    "Agave striata": r => { const d = lienzo(); esfera(d, 100, SUELO - 6, 72, 64, r, false); return d; },
    "Opuntia robusta": r => {
      const d = lienzo();
      [[100, 150, 34, 32, 0], [66, 106, 28, 27, -22], [132, 102, 30, 28, 18], [98, 66, 24, 23, 4]].forEach(p => penca(d, ...p, 9, r, 1));
      return d;
    },
    "Opuntia streptacantha": r => {
      const d = lienzo(); tronco(d, 100, SUELO, 120, 12, r);
      [[100, 98, 17, 26, 0], [72, 74, 15, 23, -30], [128, 72, 15, 24, 28], [94, 48, 13, 21, -8], [56, 46, 13, 20, -40], [140, 38, 13, 20, 22]].forEach(p => penca(d, ...p, 8, r, 2));
      return d;
    },
    "Opuntia cantabrigiensis": r => {
      const d = lienzo();
      [[78, 158, 24, 25, -10], [124, 160, 24, 24, 12], [100, 118, 23, 24, 2], [62, 116, 20, 21, -28], [140, 116, 21, 22, 26], [100, 76, 19, 20, -6]].forEach(p => penca(d, ...p, 14, r, 4));
      return d;
    },
    "Opuntia engelmannii": r => {
      const d = lienzo();
      [[60, 162, 22, 28, -50], [100, 156, 20, 28, 0], [142, 164, 22, 27, 52], [82, 116, 17, 24, -20], [122, 114, 17, 24, 22]].forEach(p => penca(d, ...p, 9, r, 3));
      // Tunas en el borde de las pencas superiores.
      [[76, 90], [88, 89], [118, 88], [130, 90]].forEach(([x, y]) => { const p = `M${x - 4} ${y}a4 6 0 1 0 8 0a4 6 0 1 0 -8 0`; d.trazo.push(p); d.aguada.push(p); });
      return d;
    },
    "Prosopis laevigata": r => {
      const d = lienzo(); const puntas = [];
      tronco(d, 100, SUELO, 132, 9, r);
      rama(d, 100, 132, -0.15, 34, 4, r, puntas);
      d.aguada.push("M38 92C30 50 70 22 104 24C142 26 172 52 162 92C150 112 52 114 38 92Z");
      for (const [x, y, a] of puntas) for (let k = -1; k <= 1; k++) pinna(d, x, y, a + k * 0.7, 12);
      // Vainas.
      [[70, 100], [126, 98], [146, 90]].forEach(([x, y]) => d.trazo.push(`M${x} ${y}c2 10 -1 22 -6 30`));
      return d;
    },
    "Yucca filifera": r => {
      const d = lienzo();
      tronco(d, 100, SUELO, 112, 16, r);
      d.trazo.push("M100 116C92 100 76 92 62 84M104 114C112 96 126 86 140 80M100 112L100 70");
      esfera(d, 62, 82, 30, 30, r, true); esfera(d, 140, 78, 30, 30, r, true); esfera(d, 100, 68, 32, 32, r, true);
      // Inflorescencia colgante.
      d.trazo.push("M100 40C112 46 118 60 116 82");
      for (let t = 0; t < 9; t++) d.fino.push(`M${n(104 + t * 1.4)} ${n(46 + t * 4)}a2 2.6 0 1 0 0.1 0`);
      return d;
    },
  };

  // Devuelve el SVG de una especie; color es el relleno de la tabla de especies.
  function svg(nombre, color, semilla = 1) {
    const r = azar(semilla * 7919 + nombre.length * 104729);
    const d = dibujos[nombre](r);
    const desfase = "translate(3 2)";
    return `<svg viewBox="0 0 200 200" role="img" aria-label="Dibujo provisional de ${nombre}">` +
      `<path d="M14 ${SUELO}H186" stroke="${TIERRA}" stroke-width="1" opacity=".5" vector-effect="non-scaling-stroke"/>` +
      `<g transform="${desfase}" fill="${color}" fill-opacity=".45" stroke="none">${d.aguada.map(p => `<path d="${p}"/>`).join("")}</g>` +
      `<g fill="none" stroke="${TIERRA}" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke">` +
      d.trazo.map(p => `<path d="${p}" vector-effect="non-scaling-stroke"/>`).join("") + `</g>` +
      `<g fill="none" stroke="${TIERRA}" stroke-width=".8" stroke-linecap="round" opacity=".85">` +
      d.fino.map(p => `<path d="${p}" vector-effect="non-scaling-stroke"/>`).join("") + `</g></svg>`;
  }

  return { svg };
})();
