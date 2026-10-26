"""Dibuja una clave de plantación de `refor plan` como figura TikZ.

Lee el espacial.json que escribe `refor plan -f json` y escribe un .tex con el
mosaico al tresbolillo: cada posición es un hexágono con la abreviatura de su
especie, coloreado por género. El reporte final lo incluye con \\input.

Uso, desde la raíz del repo:
    ./build/refor plan --alpha 0.05 -B 12500 -f json
    python3 scripts/figura_clave.py docs/res/plan/espacial.json 1 \
        reports/final/figuras/clave1.tex
"""

import json
import math
import sys

# Color de relleno por especie (xcolor), agrupado por género para que la
# figura se lea también en gris: agaves en verdes, nopales en naranjas,
# mezquite en café y yuca en morado.
COLORES = {
    "Ale": "green!20",
    "Asa": "green!45",
    "Asc": "green!65!black!60",
    "Ast": "green!10",
    "Oca": "orange!20",
    "Oen": "orange!40",
    "Oro": "orange!60",
    "Ost": "orange!80!red",
    "Pla": "brown!70",
    "Yfi": "violet!40",
}


def hexagono(cx, cy, r):
    """Vértices de un hexágono con punta arriba, centrado en (cx, cy)."""
    pts = []
    for k in range(6):
        a = math.radians(90 + 60 * k)
        pts.append(f"({cx + r * math.cos(a):.3f},{cy + r * math.sin(a):.3f})")
    return " -- ".join(pts) + " -- cycle"


def main():
    ruta, numero, salida = sys.argv[1], int(sys.argv[2]), sys.argv[3]
    datos = json.load(open(ruta, encoding="utf-8"))
    mosaico = next(m for m in datos["mosaicos"] if m["mosaico"] == numero)
    clave = mosaico["clave"]

    # Coordenadas axiales (fila, columna) como en src/memetico/mosaico.cpp:
    # las vecinas de (f, c) incluyen (f-1, c+1) y (f+1, c-1), así que cada
    # fila se desplaza media posición. Separación entre centros = 1.
    lado = 1 / math.sqrt(3)
    lineas = [
        "% Generado por scripts/figura_clave.py; no editar a mano.",
        f"% Mosaico {numero}: competencia {mosaico['competencia_mejor']}, "
        f"al azar {mosaico['esperada_azar']}.",
        "\\begin{tikzpicture}[x=0.5cm,y=0.5cm,font=\\sffamily\\fontsize{4.5}{5}\\selectfont]",
    ]
    for f, fila in enumerate(clave):
        for c, esp in enumerate(fila):
            x = c + f / 2
            y = -f * math.sqrt(3) / 2
            lineas.append(
                f"  \\filldraw[fill={COLORES[esp]},draw=white,line width=0.4pt] "
                f"{hexagono(x, y, lado)};"
            )
            lineas.append(f"  \\node at ({x:.3f},{y:.3f}) {{{esp}}};")
    lineas.append("\\end{tikzpicture}")
    open(salida, "w", encoding="utf-8").write("\n".join(lineas) + "\n")


if __name__ == "__main__":
    main()
