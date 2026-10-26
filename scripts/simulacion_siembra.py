"""Simulación del proceso de siembra en una hectárea representativa.

Repite R veces (1000 por defecto) la siembra de una hectárea con la
composición y la compra que da `refor` para todo el sitio:

  1. Plantas existentes de cada especie: E_s ~ Poisson(Ē_s), con Ē_s la
     densidad media observada en los 30 polígonos.
  2. Plantas a suministrar para llegar a la meta n_s: el número de plantas que
     hay que plantar, una tras otra, hasta que sobrevivan n_s − E_s
     (binomial negativa).
  3. Compra al 95 %: x_s es el cuantil 95 % de las plantas a suministrar del
     paso 2, la misma regla del modelo de compra pero para una sola hectárea y
     con las existentes inciertas. Con x_s fija se sortea de nuevo la
     supervivencia de cada réplica, S_s ~ Bin(x_s, q_s), y las plantas vivas al
     año son E_s + S_s. (La compra por hectárea de `refor`, promediada sobre
     polígonos de varias hectáreas, lleva menos margen relativo que el que
     necesita una hectárea sola, porque el margen crece como la raíz de la
     meta.)
  4. Competencia: una hectárea al tresbolillo de 14 × 47 = 658 posiciones
     (d ≈ 4.19 m) se llena con una clave; cada planta sobrevive con su q_s y
     se suma W sobre los pares de vecinas vivas. Se compara la clave 1 del
     memético, la secuencia vigente (filas alineadas y mejor desfase) y una
     asignación al azar con la composición de la clave 1.

Además calcula la matriz de transición entre especies a lo largo del orden de
plantación (cada planta es un estado; la siguiente es la que sigue en la
fila) para la clave 1 y para la secuencia vigente.

Uso, desde la raíz del repo y después de
`./build/refor plan --alpha 0.05 -B 12500 -f json`:

    python3 scripts/simulacion_siembra.py [--replicas 1000] [--semilla 42]

Escribe docs/res/siembra/{resumen,competencia,transicion_clave1,
transicion_vigente}.csv. random.Random da la misma secuencia en todas las
plataformas, así que los resultados son reproducibles.
"""

import argparse
import csv
import json
import math
import random
import statistics
from pathlib import Path

DATOS = Path("data/processed")
RES = Path("docs/res")
FILAS_HA, COLUMNAS_HA = 14, 47  # 658 posiciones al tresbolillo = 1 ha con d ≈ 4.19 m

DF = (-1, -1, 0, 0, 1, 1)  # mismas direcciones axiales que src/memetico/mosaico.cpp
DC = (0, 1, -1, 1, -1, 0)

ABREV = {
    "Agave lechuguilla": "Ale", "Agave salmiana": "Asa", "Agave scabra": "Asc",
    "Agave striata": "Ast", "Opuntia cantabrigiensis": "Oca", "Opuntia engelmannii": "Oen",
    "Opuntia robusta": "Oro", "Opuntia streptacantha": "Ost", "Prosopis laevigata": "Pla",
    "Yucca filifera": "Yfi",
}
ORDEN = list(ABREV.values())


def leer_csv(nombre):
    return list(csv.DictReader(open(DATOS / nombre, encoding="utf-8")))


def mayor_residuo(valores, total):
    """Enteros proporcionales a `valores` que suman `total`."""
    base = {k: math.floor(v) for k, v in valores.items()}
    faltan = total - sum(base.values())
    for k in sorted(valores, key=lambda k: valores[k] - base[k], reverse=True)[:faltan]:
        base[k] += 1
    return base


def poisson(rng, lam):
    # Inversión de la distribución acumulada; λ ≤ 40, sin problemas numéricos.
    u, k, p = rng.random(), 0, math.exp(-lam)
    acumulada = p
    while u > acumulada:
        k += 1
        p *= lam / k
        acumulada += p
    return k


def binomial(rng, n, q):
    return sum(rng.random() < q for _ in range(n))


def plantas_hasta(rng, exitos, q):
    """Plantas que hay que plantar hasta que `exitos` sobrevivan (binomial negativa)."""
    plantadas = vivas = 0
    while vivas < exitos:
        plantadas += 1
        vivas += rng.random() < q
    return plantadas


def aristas_abiertas(filas, columnas):
    """Pares de vecinas de un parche al tresbolillo sin borde periódico."""
    res = []
    for f in range(filas):
        for c in range(columnas):
            for k in range(6):
                g, d = f + DF[k], c + DC[k]
                if 0 <= g < filas and 0 <= d < columnas and (g, d) > (f, c):
                    res.append((f * columnas + c, g * columnas + d))
    return res


def transiciones(filas_clave):
    """P(siguiente especie = j | actual = i) a lo largo de cada fila repetida."""
    cuenta = {a: {b: 0 for b in ORDEN} for a in ORDEN}
    for fila in filas_clave:
        for c, a in enumerate(fila):
            cuenta[a][fila[(c + 1) % len(fila)]] += 1
    prob = {}
    for a in ORDEN:
        tot = sum(cuenta[a].values())
        prob[a] = {b: (cuenta[a][b] / tot if tot else 0.0) for b in ORDEN}
    return prob


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--replicas", type=int, default=1000)
    p.add_argument("--semilla", type=int, default=42)
    args = p.parse_args()
    rng = random.Random(args.semilla)

    especies = {ABREV[r["especie"]]: r for r in leer_csv("especies.csv")}
    q = {s: float(especies[s]["q"]) for s in ORDEN}
    area = sum(float(r["area"]) for r in leer_csv("poligonos.csv"))
    e_media = {s: 0.0 for s in ORDEN}
    for r in leer_csv("existentes.csv"):
        e_media[ABREV[r["especie"]]] += int(r["E"]) / area
    w = {}
    for r in leer_csv("competencia.csv"):
        a, b = ABREV[r["especie_a"]], ABREV[r["especie_b"]]
        w[a, b] = w[b, a] = float(r["W"])

    # Meta y compra por hectárea del modelo, agregadas sobre los 30 polígonos.
    compra = json.load(open(RES / "plan" / "compra.json", encoding="utf-8"))
    meta_ha = {s: 0.0 for s in ORDEN}
    compra_ha = {s: 0.0 for s in ORDEN}
    for pol in compra:
        for e in pol["especies"]:
            meta_ha[ABREV[e["especie"]]] += e["n"] / area
            compra_ha[ABREV[e["especie"]]] += e["x"] / area
    meta = mayor_residuo(meta_ha, 658)
    compra_refor = mayor_residuo(compra_ha, round(sum(compra_ha.values())))

    # Claves en la hectárea.
    espacial = json.load(open(RES / "plan" / "espacial.json", encoding="utf-8"))
    clave1 = espacial["mosaicos"][0]["clave"]
    vigente = [ABREV[r["especie"]] for r in leer_csv("clave_vigente.csv")]
    L = len(vigente)
    arreglos = {
        "clave1": [clave1[f % len(clave1)][c % len(clave1[0])]
                   for f in range(FILAS_HA) for c in range(COLUMNAS_HA)],
        "vigente_alineada": [vigente[c % L] for f in range(FILAS_HA) for c in range(COLUMNAS_HA)],
        "vigente_desfase5": [vigente[(c + 5 * f) % L] for f in range(FILAS_HA) for c in range(COLUMNAS_HA)],
    }
    comp1 = {}
    for e in arreglos["clave1"]:
        comp1[e] = comp1.get(e, 0) + 1
    ar = aristas_abiertas(FILAS_HA, COLUMNAS_HA)

    existentes = {s: [] for s in ORDEN}
    suministro = {s: [] for s in ORDEN}
    competencia = {k: [] for k in [*arreglos, "azar"]}
    for _ in range(args.replicas):
        for s in ORDEN:
            e = poisson(rng, e_media[s])
            existentes[s].append(e)
            suministro[s].append(plantas_hasta(rng, max(meta[s] - e, 0), q[s]))

        azar = arreglos["clave1"][:]
        rng.shuffle(azar)
        for nombre, arreglo in [*arreglos.items(), ("azar", azar)]:
            viva = [rng.random() < q[e] for e in arreglo]
            competencia[nombre].append(sum(w[arreglo[u], arreglo[v]] for u, v in ar if viva[u] and viva[v]))

    # Compra al 95 % y supervivencia con sorteos nuevos sobre las mismas
    # existentes de cada réplica.
    x = {s: sorted(suministro[s])[math.ceil(0.95 * args.replicas) - 1] for s in ORDEN}
    vivas = {s: [] for s in ORDEN}
    cumple = {s: 0 for s in ORDEN}
    cumple_todas = 0
    for k in range(args.replicas):
        todas = True
        for s in ORDEN:
            v = existentes[s][k] + binomial(rng, x[s], q[s])
            vivas[s].append(v)
            cumple[s] += v >= meta[s]
            todas &= v >= meta[s]
        cumple_todas += todas

    salida = RES / "siembra"
    salida.mkdir(parents=True, exist_ok=True)
    with open(salida / "resumen.csv", "w", encoding="utf-8", newline="") as f:
        out = csv.writer(f)
        out.writerow(["especie", "meta", "existentes_media", "existentes_de", "suministro_media",
                      "suministro_de", "compra_95", "compra_refor", "vivas_media", "vivas_de", "p_cumple"])
        for s in ORDEN:
            out.writerow([s, meta[s], f"{statistics.mean(existentes[s]):.2f}",
                          f"{statistics.stdev(existentes[s]):.2f}", f"{statistics.mean(suministro[s]):.2f}",
                          f"{statistics.stdev(suministro[s]):.2f}", x[s], compra_refor[s],
                          f"{statistics.mean(vivas[s]):.2f}", f"{statistics.stdev(vivas[s]):.2f}",
                          f"{cumple[s] / args.replicas:.3f}"])

        def total(d):
            return [sum(d[s][k] for s in ORDEN) for k in range(args.replicas)]

        te, ts, tv = total(existentes), total(suministro), total(vivas)
        out.writerow(["Total", sum(meta.values()), f"{statistics.mean(te):.2f}", f"{statistics.stdev(te):.2f}",
                      f"{statistics.mean(ts):.2f}", f"{statistics.stdev(ts):.2f}", sum(x.values()),
                      sum(compra_refor.values()), f"{statistics.mean(tv):.2f}", f"{statistics.stdev(tv):.2f}",
                      f"{cumple_todas / args.replicas:.3f}"])

    with open(salida / "competencia.csv", "w", encoding="utf-8", newline="") as f:
        out = csv.writer(f)
        out.writerow(["arreglo", "al_plantar", "media", "de", "p05", "p95"])
        for nombre, valores in competencia.items():
            arreglo = arreglos.get(nombre)
            al_plantar = (f"{sum(w[arreglo[u], arreglo[v]] for u, v in ar):.2f}" if arreglo else
                          f"{sum(ma * (mb - (a == b)) * w[a, b] for a, ma in comp1.items() for b, mb in comp1.items()) / (658 * 657) * len(ar):.2f}")
            v = sorted(valores)
            out.writerow([nombre, al_plantar, f"{statistics.mean(v):.2f}", f"{statistics.stdev(v):.2f}",
                          f"{v[int(0.05 * len(v))]:.2f}", f"{v[math.ceil(0.95 * len(v)) - 1]:.2f}"])

    for nombre, filas in [("clave1", clave1), ("vigente", [vigente])]:
        prob = transiciones(filas)
        with open(salida / f"transicion_{nombre}.csv", "w", encoding="utf-8", newline="") as f:
            out = csv.writer(f)
            out.writerow(["de", *ORDEN])
            for a in ORDEN:
                out.writerow([a, *(f"{prob[a][b]:.3f}" for b in ORDEN)])

    print(f"{args.replicas} réplicas, {len(ar)} pares de vecinas en la hectárea; resultados en {salida}/")


if __name__ == "__main__":
    main()
