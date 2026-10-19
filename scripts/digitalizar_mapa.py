"""Genera data/processed/mapa.csv: el contorno de cada polígono del cerco.

No hay shapefile del cerco; los vértices se trazaron a mano sobre la lámina
"Ubicación cerco ganadero Parque Eólico Dominica" (docs/misc, diapositiva 8),
renderizada a 300 ppp y recortada en (1050, 230) con 1500 x 1250 px. La
rejilla UTM de la lámina da la escala: 260800 E cae en x = 413, 2597200 N en
y = 75, y 800 m miden 458 px en horizontal y 460 px en vertical.

El mapa numera los polígonos distinto que la tabla de existencias (lámina 14,
la que usa poligonos.csv) y tiene uno más: el 29 del mapa (6.54 ha) no está en
el programa. Por eso cada polígono lleva su etiqueta del mapa y, si lo hay, su
id del modelo.

Las coordenadas son aproximadas (±5 m): sirven para ver la disposición, no
como deslinde. El script compara el área trazada con la de poligonos.csv.

    python3 scripts/digitalizar_mapa.py
"""

import csv
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "data" / "processed" / "mapa.csv"

E0, X0, MX = 260800.0, 413.0, 800.0 / 458.0
N0, Y0, MY = 2597200.0, 75.0, 800.0 / 460.0

# etiqueta del mapa -> (id del modelo o None, vértices en píxeles)
POLIGONOS = {
    27: (1, [(140, 62), (158, 62), (158, 252), (140, 252)]),
    28: (2, [(158, 62), (275, 62), (275, 252), (158, 252)]),
    29: (None, [(275, 62), (355, 62), (388, 84), (388, 252), (275, 252)]),
    30: (3, [(388, 84), (645, 252), (388, 252)]),
    20: (4, [(140, 252), (158, 252), (158, 482), (140, 482)]),
    21: (5, [(158, 252), (275, 252), (275, 482), (158, 482)]),
    22: (6, [(275, 252), (388, 252), (388, 447), (350, 482), (275, 482)]),
    23: (7, [(388, 252), (500, 252), (500, 394), (470, 395), (420, 420), (388, 447)]),
    24: (8, [(500, 252), (618, 252), (618, 450), (570, 416), (500, 394)]),
    18: (9, [(618, 252), (645, 252), (733, 310), (733, 495), (655, 470), (618, 450)]),
    17: (10, [(733, 310), (838, 380), (820, 402), (848, 428), (848, 578), (790, 505), (733, 495)]),
    16: (11, [(848, 428), (865, 432), (958, 393), (958, 530), (872, 615), (848, 578)]),
    19: (12, [(958, 393), (1045, 300), (1052, 284), (1075, 262), (1075, 411), (958, 530)]),
    25: (13, [(1075, 262), (1190, 172), (1190, 297), (1075, 411)]),
    26: (14, [(1190, 172), (1305, 85), (1348, 135), (1190, 297)]),
    13: (15, [(140, 482), (350, 482), (312, 515), (238, 654), (140, 654)]),
    31: (16, [(314, 654), (380, 545), (450, 470), (500, 437), (500, 654)]),
    14: (17, [(500, 437), (570, 487), (618, 527), (618, 654), (500, 654)]),
    15: (18, [(618, 527), (720, 552), (755, 590), (822, 652), (731, 654), (618, 654)]),
    7: (19, [(140, 654), (238, 654), (165, 790), (212, 825), (272, 730), (272, 884), (140, 884)]),
    8: (20, [(314, 654), (388, 654), (388, 884), (272, 884), (272, 730)]),
    9: (21, [(388, 654), (500, 654), (500, 884), (388, 884)]),
    10: (22, [(500, 654), (618, 654), (618, 884), (500, 884)]),
    11: (23, [(618, 654), (731, 654), (733, 805), (702, 857), (725, 884), (618, 884)]),
    12: (24, [(731, 654), (822, 652), (772, 705), (750, 727), (733, 805)]),
    6: (25, [(140, 884), (272, 884), (272, 1028), (250, 990), (145, 975)]),
    2: (26, [(272, 884), (388, 884), (388, 1112), (320, 1112), (272, 1028)]),
    3: (27, [(388, 884), (500, 884), (500, 1112), (388, 1112)]),
    4: (28, [(500, 884), (618, 884), (618, 1112), (500, 1112)]),
    5: (29, [(618, 884), (725, 884), (714, 1112), (618, 1112)]),
    1: (30, [(320, 1112), (714, 1112), (705, 1210), (470, 1135), (325, 1122)]),
}


def utm(px, py):
    return E0 + (px - X0) * MX, N0 - (py - Y0) * MY


def area_ha(vertices):
    pts = [utm(*v) for v in vertices]
    s = sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]))
    return abs(s) / 2 / 10_000


def main():
    with open(RAIZ / "data" / "processed" / "poligonos.csv", newline="") as f:
        areas = {int(r["poligono"]): float(r["area"]) for r in csv.DictReader(f)}
    ids = [i for i, _ in POLIGONOS.values() if i is not None]
    assert sorted(ids) == sorted(areas), "el mapa debe cubrir exactamente los polígonos del modelo"

    with open(SALIDA, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["etiqueta", "poligono", "x", "y"])
        for etiqueta, (i, vertices) in sorted(POLIGONOS.items()):
            for px, py in vertices:
                x, y = utm(px, py)
                w.writerow([etiqueta, "" if i is None else i, f"{x:.1f}", f"{y:.1f}"])

    print(f"{'mapa':>4} {'id':>3} {'trazada':>8} {'tabla':>6}")
    for etiqueta, (i, vertices) in sorted(POLIGONOS.items()):
        a = area_ha(vertices)
        print(f"{etiqueta:>4} {i if i else '-':>3} {a:8.2f} {areas.get(i, float('nan')):6.2f}")
    print(f"escrito {SALIDA.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
