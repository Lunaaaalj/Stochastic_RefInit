"""Análisis de las claves de plantación para el reporte final.

Dos subcomandos, ambos desde la raíz del repo y después de
`./build/refor plan --alpha 0.05 -B 12500 -f json` (que deja
docs/res/plan/espacial.json):

  vigente       Evalúa la clave vigente de CONAFOR (data/processed/
                clave_vigente.csv, 22 posiciones por fila) en el tresbolillo y
                la compara con las claves del memético.
  sensibilidad  Reconstruye la matriz W con otros valores de γ y φ y con
                perturbaciones de los rasgos, vuelve a correr `refor plan` con
                cada una y mide cuánto empeoran las claves base.

La geometría replica src/memetico/mosaico.cpp (coordenadas axiales, borde
periódico, seis vecinas), y antes de reportar nada se comprueba que la
competencia de las claves de refor sale idéntica con este código.

    python3 scripts/analisis_claves.py vigente
    python3 scripts/analisis_claves.py sensibilidad [--corridas 10]
"""

import argparse
import csv
import json
import random
import subprocess
import sys
import tempfile
from pathlib import Path

DATOS = Path("data/processed")
RES = Path("docs/res")

# Mismo orden que src/memetico/mosaico.cpp.
DF = (-1, -1, 0, 0, 1, 1)
DC = (0, 1, -1, 1, -1, 0)

ABREV = {
    "Agave lechuguilla": "Ale", "Agave salmiana": "Asa", "Agave scabra": "Asc",
    "Agave striata": "Ast", "Opuntia cantabrigiensis": "Oca", "Opuntia engelmannii": "Oen",
    "Opuntia robusta": "Oro", "Opuntia streptacantha": "Ost", "Prosopis laevigata": "Pla",
    "Yucca filifera": "Yfi",
}

# Parámetros con los que se construyó data/processed/competencia.csv
# (sección del modelo espacial): W = γ^[a=b]·T·N − φ·F.
GAMMA_BASE, PHI_BASE = 1.5, 0.3
SUCULENTAS = {"Ale", "Asa", "Asc", "Ast", "Oca", "Oen", "Oro", "Ost"}


def leer_w(ruta):
    w = {}
    for r in csv.DictReader(open(ruta, encoding="utf-8")):
        a, b = ABREV[r["especie_a"]], ABREV[r["especie_b"]]
        w[a, b] = w[b, a] = float(r["W"])
    return w


def escribir_w(w, ruta):
    nombres = {v: k for k, v in ABREV.items()}
    especies = list(ABREV.values())
    with open(ruta, "w", encoding="utf-8", newline="") as f:
        out = csv.writer(f)
        out.writerow(["especie_a", "especie_b", "W"])
        for i, a in enumerate(especies):
            for b in especies[i:]:
                out.writerow([nombres[a], nombres[b], f"{w[a, b]:.4f}"])


def aristas(filas, columnas):
    res = set()
    for f in range(filas):
        for c in range(columnas):
            v = f * columnas + c
            for k in range(6):
                u = ((f + DF[k]) % filas) * columnas + (c + DC[k]) % columnas
                res.add((min(u, v), max(u, v)))
    return sorted(res)


def competencia(clave, filas, columnas, w):
    plano = [e for fila in clave for e in fila]
    return sum(w[plano[u], plano[v]] for u, v in aristas(filas, columnas))


def esperada_azar(composicion, num_aristas, w):
    """Como competencia_esperada_aleatoria() de src/memetico/individuo.cpp."""
    n = sum(composicion.values())
    suma = sum(ma * (mb - (a == b)) * w[a, b]
               for a, ma in composicion.items() for b, mb in composicion.items())
    return suma / (n * (n - 1)) * num_aristas


def composicion_de(clave):
    comp = {}
    for fila in clave:
        for e in fila:
            comp[e] = comp.get(e, 0) + 1
    return comp


def verificar(espacial, w):
    """Las competencias de refor deben salir iguales con este código."""
    F, C = espacial["filas"], espacial["columnas"]
    for m in espacial["mosaicos"]:
        propia = competencia(m["clave"], F, C, w)
        azar = esperada_azar(composicion_de(m["clave"]), len(aristas(F, C)), w)
        if abs(propia - m["competencia_mejor"]) > 0.005 or abs(azar - m["esperada_azar"]) > 0.005:
            sys.exit(f"mosaico {m['mosaico']}: {propia:.4f}/{azar:.4f} contra refor "
                     f"{m['competencia_mejor']}/{m['esperada_azar']}")


def cmd_vigente(_args):
    w = leer_w(DATOS / "competencia.csv")
    espacial = json.load(open(RES / "plan" / "espacial.json", encoding="utf-8"))
    verificar(espacial, w)
    secuencia = [ABREV[r["especie"]] for r in csv.DictReader(open(DATOS / "clave_vigente.csv", encoding="utf-8"))]
    L = len(secuencia)

    # Cada fila repite la secuencia; la fila f empieza desplazada f·k
    # posiciones. Con L filas el mosaico siempre cierra (L·k ≡ 0 mod L).
    print(f"Clave vigente: {L} posiciones, composición {composicion_de([secuencia])}")
    print("desfase  competencia/arista  coeficiente  pares_misma_especie/planta")
    filas = []
    for k in range(L):
        clave = [[secuencia[(c + f * k) % L] for c in range(L)] for f in range(L)]
        ar = aristas(L, L)
        comp = competencia(clave, L, L, w)
        azar = esperada_azar(composicion_de(clave), len(ar), w)
        plano = [e for fila in clave for e in fila]
        mismas = sum(plano[u] == plano[v] for u, v in ar) / (L * L)
        filas.append((k, comp / len(ar), comp / azar, mismas))
        print(f"{k:7d}  {comp / len(ar):18.4f}  {comp / azar:11.4f}  {mismas:10.3f}")
    coef = [f[2] for f in filas]
    print(f"desfase 0: coeficiente {filas[0][2]:.4f}; desfases 1..{L - 1}: "
          f"{min(coef[1:]):.4f} a {max(coef[1:]):.4f}, media {sum(coef[1:]) / (L - 1):.4f}")

    F, C = espacial["filas"], espacial["columnas"]
    na = len(aristas(F, C))
    for m in espacial["mosaicos"]:
        print(f"memético mosaico {m['mosaico']}: competencia/arista {m['competencia_mejor'] / na:.4f}, "
              f"coeficiente {m['coeficiente']:.4f}")


def reconstruir_tn(w):
    """T·N de cada par a partir de W, γ y φ base: W = γ^[a=b]·T·N − φ·F."""
    tn = {}
    for (a, b), v in w.items():
        f = 1.0 if ("Pla" in (a, b) and ({a, b} - {"Pla"}) <= SUCULENTAS and a != b) else 0.0
        tn[a, b] = (v + PHI_BASE * f) / (GAMMA_BASE if a == b else 1.0)
    return tn


def matriz(tn, gamma, phi, factor=None):
    w = {}
    for (a, b), v in tn.items():
        f = 1.0 if ("Pla" in (a, b) and ({a, b} - {"Pla"}) <= SUCULENTAS and a != b) else 0.0
        x = v * (factor[a, b] if factor else 1.0)
        w[a, b] = (gamma if a == b else 1.0) * min(x, 1.0) - phi * f
    return w


def spearman(x, y):
    def rangos(v):
        orden = sorted(range(len(v)), key=lambda i: v[i])
        r = [0.0] * len(v)
        i = 0
        while i < len(v):
            j = i
            while j + 1 < len(v) and v[orden[j + 1]] == v[orden[i]]:
                j += 1
            for t in range(i, j + 1):
                r[orden[t]] = (i + j) / 2
            i = j + 1
        return r
    rx, ry = rangos(x), rangos(y)
    mx, my = sum(rx) / len(rx), sum(ry) / len(ry)
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    den = (sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry)) ** 0.5
    return num / den


def cmd_sensibilidad(args):
    w0 = leer_w(DATOS / "competencia.csv")
    base = json.load(open(RES / "plan" / "espacial.json", encoding="utf-8"))
    verificar(base, w0)
    tn = reconstruir_tn(w0)
    # La reconstrucción debe devolver la matriz original (al redondeo del CSV).
    assert all(abs(matriz(tn, GAMMA_BASE, PHI_BASE)[k] - w0[k]) < 1e-9 for k in w0)

    pares = sorted({tuple(sorted(k)) for k in w0})
    escenarios: list[tuple[str, float, float, dict | None]] = [(f"g{g}_p{p}", g, p, None)
                  for g in (1.0, 1.25, 1.5, 1.75, 2.0) for p in (0.0, 0.15, 0.3, 0.45, 0.6)]
    rng = random.Random(args.semilla)  # random.Random es el mismo en todas las plataformas
    for i in range(args.perturbaciones):
        factor = {}
        for a, b in pares:
            factor[a, b] = factor[b, a] = rng.uniform(0.7, 1.3)
        escenarios.append((f"r{i}", GAMMA_BASE, PHI_BASE, factor))

    F, C = base["filas"], base["columnas"]
    filas_csv = []
    with tempfile.TemporaryDirectory() as tmp:
        for nombre, g, p, factor in escenarios:
            w = matriz(tn, g, p, factor)
            ruta_w = Path(tmp) / f"{nombre}.csv"
            escribir_w(w, ruta_w)
            subprocess.run(
                ["./build/refor", "plan", "--alpha", "0.05", "-B", "12500", "--competencia", str(ruta_w),
                 "--corridas", str(args.corridas), "-f", "json", "--dir", str(Path(tmp) / nombre)],
                check=True, capture_output=True)
            alt = json.load(open(Path(tmp) / nombre / "plan" / "espacial.json", encoding="utf-8"))
            rho = spearman([w0[k] for k in pares], [w[k] for k in pares])
            for mb, ma in zip(base["mosaicos"], alt["mosaicos"]):
                assert mb["poligonos"] == ma["poligonos"]
                con_base = competencia(mb["clave"], F, C, w)  # clave base evaluada con W'
                optima = ma["competencia_mejor"]                # clave reoptimizada con W'
                filas_csv.append({
                    "escenario": nombre, "gamma": g, "phi": p, "spearman": round(rho, 4),
                    "mosaico": mb["mosaico"], "clave_base": round(con_base, 4),
                    "reoptimizada": optima, "azar": ma["esperada_azar"],
                    "exceso_pct": round(100 * (con_base - optima) / optima, 3),
                    "coef_base": round(con_base / ma["esperada_azar"], 4),
                })
            print(f"{nombre}: spearman {rho:.3f}", file=sys.stderr)

    salida = RES / "sensibilidad_w.csv"
    with open(salida, "w", encoding="utf-8", newline="") as f:
        out = csv.DictWriter(f, fieldnames=list(filas_csv[0]))
        out.writeheader()
        out.writerows(filas_csv)
    print(f"Resultados escritos en {salida}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("vigente")
    s = sub.add_parser("sensibilidad")
    s.add_argument("--corridas", type=int, default=10, help="corridas del memético por matriz")
    s.add_argument("--perturbaciones", type=int, default=20, help="matrices con rasgos perturbados ±30 %%")
    s.add_argument("--semilla", type=int, default=42)
    args = p.parse_args()
    {"vigente": cmd_vigente, "sensibilidad": cmd_sensibilidad}[args.cmd](args)


if __name__ == "__main__":
    main()
