"""Genera docs/presentacion/datos/datos.js para el deck ejecutivo.

Lee los CSV de data/processed/ y las salidas de `refor` en docs/res/, y deja
todo en un solo objeto `DATOS` que el deck carga sin servidor. Antes de
correrlo hay que generar los resultados (misma semilla que el reporte E2):

    ./build/refor frontera --alphas 0.01,0.02,0.05,0.10,0.20,0.30,0.50 -f csv
    ./build/refor plan --exacto -f json

Uso, desde la raíz del repo:

    python3 scripts/datos_presentacion.py
"""

import csv
import json
import math
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DATOS = RAIZ / "data" / "processed"
RES = RAIZ / "docs" / "res"
SALIDA = RAIZ / "docs" / "presentacion" / "datos" / "datos.js"


def abrev(nombre):
    """Igual que src/salida.cpp: inicial del género + dos letras del epíteto."""
    gen, _, ep = nombre.partition(" ")
    return gen[0] + ep[:2] if ep else nombre[:3]


def leer_csv(ruta):
    with open(ruta, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def binom_cdf(k, n, p):
    """P(Bin(n, p) <= k), sumando en logaritmos para n de cientos."""
    if k < 0:
        return 0.0
    if k >= n:
        return 1.0
    total = 0.0
    for i in range(k + 1):
        total += math.exp(math.lgamma(n + 1) - math.lgamma(i + 1) - math.lgamma(n - i + 1)
                          + i * math.log(p) + (n - i) * math.log1p(-p))
    return total


def binom_pmf(k, n, p):
    return math.exp(math.lgamma(n + 1) - math.lgamma(k + 1) - math.lgamma(n - k + 1)
                    + k * math.log(p) + (n - k) * math.log1p(-p))


def compra_minima(m, q, alfa):
    """Menor x con P(Bin(x, q) >= m) >= 1 - alfa: la cola exacta de `refor --metodo exacto`."""
    if m <= 0:
        return 0
    x = m
    while 1.0 - binom_cdf(m - 1, x, q) < 1 - alfa:
        x += 1
    return x


def deficit_esperado(m, x, q):
    """E[(m - S)^+] con S ~ Bin(x, q): las plantas que faltarían al año."""
    return sum((m - k) * binom_pmf(k, x, q) for k in range(min(m, x + 1))) if m > 0 else 0.0


def plantas_necesarias(m, q, x_max):
    """Distribución de las plantas que hay que comprar para que sobrevivan m.

    P(X <= x) = P(Bin(x, q) >= m). Devuelve [(x, probabilidad)] con masa
    visible y el cuantil 95 %.
    """
    acum_prev, filas, q95 = 0.0, [], None
    for x in range(m, x_max + 1):
        acum = 1.0 - binom_cdf(m - 1, x, q)
        filas.append([x, acum - acum_prev])
        if q95 is None and acum >= 0.95:
            q95 = x
        acum_prev = acum
        if acum > 0.99999:
            break
    return [f for f in filas if f[1] > 1e-4], q95


def main():
    especies = leer_csv(DATOS / "especies.csv")
    poligonos = {int(r["poligono"]): float(r["area"]) for r in leer_csv(DATOS / "poligonos.csv")}
    compra = json.loads((RES / "plan" / "compra.json").read_text(encoding="utf-8"))
    espacial = json.loads((RES / "plan" / "espacial.json").read_text(encoding="utf-8"))
    ruta_exacto = RES / "plan" / "exacto.json"
    exacto = json.loads(ruta_exacto.read_text(encoding="utf-8")) if ruta_exacto.exists() else None
    frontera = leer_csv(RES / "frontera.csv")

    # Mapa en metros locales: x hacia el este, y hacia el sur (como un SVG).
    vertices = {}
    for r in leer_csv(DATOS / "mapa.csv"):
        e = int(r["etiqueta"])
        vertices.setdefault(e, {"p": int(r["poligono"]) if r["poligono"] else None, "v": []})
        vertices[e]["v"].append((float(r["x"]), float(r["y"])))
    x0 = min(x for d in vertices.values() for x, _ in d["v"])
    y1 = max(y for d in vertices.values() for _, y in d["v"])

    clave_de = {}
    for m in espacial["mosaicos"]:
        for p in m["poligonos"]:
            clave_de[p] = m["mosaico"]
    por_pol = {p["poligono"]: p for p in compra}

    mapa = []
    for e, d in sorted(vertices.items()):
        pol = {"e": e, "p": d["p"], "v": [[round(x - x0, 1), round(y1 - y, 1)] for x, y in d["v"]]}
        if d["p"] is not None:
            c = por_pol[d["p"]]
            area = poligonos[d["p"]]
            x = sum(s["x"] for s in c["especies"])
            ex = sum(s["E"] for s in c["especies"])
            pol.update(area=area, Bmin=c["B_minimo"], compra_ha=round(x / area, 1),
                       existentes_ha=round(ex / area, 1), clave=clave_de.get(d["p"]))
        mapa.append(pol)

    # Totales del sitio.
    area = sum(p["area"] for p in compra)
    x_tot = sum(s["x"] for p in compra for s in p["especies"])
    e_tot = sum(s["E"] for p in compra for s in p["especies"])
    b_pond = sum(p["B_minimo"] * p["area"] for p in compra) / area
    presupuesto = compra[0]["B"]

    # Por especie: densidad planeada contra la de referencia n0 (plantas/ha).
    tabla = []
    for r in especies:
        nombre = r["especie"]
        filas = [s for p in compra for s in p["especies"] if s["especie"] == nombre]
        n = sum(s["n"] for s in filas)
        tabla.append({
            "nombre": nombre, "ab": abrev(nombre), "genero": nombre.split()[0] if nombre.split()[0] in ("Agave", "Opuntia") else "Otras",
            "n0": int(r["n0"]), "c": float(r["c"]), "q": float(r["q"]),
            "n_ha": round(n / area, 1), "x": sum(s["x"] for s in filas), "E": sum(s["E"] for s in filas),
            "desvio": round((n / area / int(r["n0"]) - 1) * 100, 1),
        })
        # Intervalo del 90 % de la proporción que sobrevive en un lote de 100 plantas.
        q = float(r["q"])
        bajo = next(k for k in range(101) if binom_cdf(k, 100, q) >= 0.05)
        alto = next(k for k in range(101) if binom_cdf(k, 100, q) >= 0.95)
        tabla[-1]["banda"] = [bajo / 100, alto / 100]

    # Frontera agregada B*(α): las filas "todos" que escribe `refor frontera`.
    curva = sorted([float(r["alfa"]), float(r["B_minimo"])] for r in frontera if r["poligono"] == "todos")

    # Mosaicos, con el modelo entero si está.
    ex_de = {m["mosaico"]: m for m in exacto["mosaicos"]} if exacto else {}
    mosaicos = []
    for m in espacial["mosaicos"]:
        x = ex_de.get(m["mosaico"])
        mosaicos.append({
            "id": m["mosaico"], "poligonos": m["poligonos"], "clave": m["clave"],
            "mejor": m["competencia_mejor"], "media": m["competencia_media"], "de": m["desviacion"],
            "azar": m["esperada_azar"], "coef": m["coeficiente"],
            "area": round(sum(poligonos[p] for p in m["poligonos"]), 2),
            "exacto": None if x is None else {
                "valor": x["competencia_exacto"], "cota": x["cota_inferior"], "brecha": x["brecha_memetico_pct"],
                "optimo": x["optimo"], "segundos": x["segundos"], "distintas": x["posiciones_distintas"],
                "traza": x.get("traza", []),
            },
        })
    reduccion = sum((1 - m["coef"]) * m["area"] for m in mosaicos) / sum(m["area"] for m in mosaicos)

    # Escenarios de un caso concreto para la lámina 6: A. salmiana en el polígono 1.
    p1 = por_pol[1]
    asa = next(s for s in p1["especies"] if s["especie"] == "Agave salmiana")
    q_asa = next(float(r["q"]) for r in especies if r["especie"] == "Agave salmiana")
    dist, q95 = plantas_necesarias(asa["n"] - asa["E"], q_asa, asa["n"] * 2)

    # Curvas de costo del polígono 1 (lámina de la formulación): para cada especie y cada meta n
    # de su banda, la compra mínima x*(n) y el déficit esperado E[D](n) con la cola binomial
    # exacta. El punto elegido (n, x, déficit) es el de `refor plan`. θ se deduce del costo de
    # compra que reporta refor; δ es el de refor por omisión (src/modelo.hpp), el del reporte E2.
    delta, alfa = 0.10, p1["alfa"]
    c_de = {r["especie"]: float(r["c"]) for r in especies}
    theta = p1["costo_compra"] / sum(c_de[s["especie"]] * s["x"] for s in p1["especies"]) - 1
    curvas_p1 = []
    for s in p1["especies"]:
        r = next(r for r in especies if r["especie"] == s["especie"])
        q, centro = float(r["q"]), int(r["n0"]) * p1["area"]
        n_min, n_max = math.ceil(centro * (1 - delta) - 1e-9), math.floor(centro * (1 + delta) + 1e-9)
        filas = []
        for n in range(n_min, n_max + 1):
            x = compra_minima(n - s["E"], q, alfa)
            filas.append([n, x, round(deficit_esperado(n - s["E"], x, q), 4)])
        curvas_p1.append({"ab": abrev(s["especie"]), "n0A": round(centro, 2), "E": s["E"], "n": s["n"], "x": s["x"],
                          "deficit": s["deficit"], "curva": filas})

    W = {}
    for r in leer_csv(DATOS / "competencia.csv"):
        a, b = abrev(r["especie_a"]), abrev(r["especie_b"])
        W[f"{a}|{b}"] = W[f"{b}|{a}"] = float(r["W"])

    salida = {
        "mapa": mapa,
        "especies": tabla,
        "W": W,
        "totales": {
            "area": round(area, 2), "poligonos": len(compra), "compra": x_tot, "existentes": e_tot,
            "compra_ha": round(x_tot / area, 1), "existentes_ha": round(e_tot / area, 1),
            "densidad_ha": round((x_tot + e_tot) / area, 1), "meta_ha": 658,
            "B_min": round(b_pond, 2), "presupuesto": presupuesto, "factibles": sum(p["estado"] != "infactible" for p in compra),
            "alfa": compra[0]["alfa"], "reduccion": round(reduccion, 4),
        },
        "frontera": curva,
        "mosaicos": mosaicos,
        "escenarios": {"especie": "Agave salmiana", "poligono": 1, "meta": asa["n"], "existentes": asa["E"],
                       "compra": asa["x"], "q": q_asa, "q95": q95, "dist": [[x, round(p, 5)] for x, p in dist]},
        "existentes_p1": {s["especie"]: s["E"] for s in p1["especies"]},
        "compra_p1": {"area": p1["area"], "theta": round(theta, 6), "delta": delta, "alfa": alfa,
                      "total": sum(s["n"] for s in p1["especies"]), "costo_compra": p1["costo_compra"],
                      "costo_reposicion": p1["costo_reposicion"], "especies": curvas_p1},
        "origen_utm": [x0, y1],
    }
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_text("// Generado por scripts/datos_presentacion.py; no editar a mano.\nconst DATOS = "
                      + json.dumps(salida, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"Escrito {SALIDA.relative_to(RAIZ)}")
    print(f"  B* ponderado ${b_pond:,.0f}/ha, compra {x_tot:,} plantas, reducción de competencia {reduccion:.1%}")
    print(f"  escenarios A. salmiana pol. 1: cuantil 95 % exacto = {q95}, compra (Monte Carlo) = {asa['x']}")
    if exacto is None:
        print("  aviso: falta docs/res/plan/exacto.json; la lámina 10 quedará sin el modelo entero")


if __name__ == "__main__":
    main()
