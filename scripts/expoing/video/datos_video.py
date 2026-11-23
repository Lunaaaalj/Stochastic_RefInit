#!/usr/bin/env python3
"""Datos del video de Expo Ingenierías que no están en datos.js.

La página del video carga docs/presentacion/datos/datos.js tal cual (mapa,
totales, especies, W, mosaicos, frontera…) y, además, el archivo que escribe
este script:

    scripts/expoing/video/datos_video.js   window.DATOS_VIDEO = {...}

- linea: docs/expoing/video/linea_de_tiempo.json (lo genera tiempos.py; más
  adelante, alinear.py con los tiempos reales de la voz).
- musica: la grabación elegida, desde qué segundo de la pieza empieza y su sonoridad.
- clave_vigente: la secuencia de 22 posiciones de data/processed/clave_vigente.csv.
- hectarea: la hectárea de 14 × 47 posiciones de scripts/simulacion_siembra.py y la
  meta por especie que esa simulación le asigna (mayor residuo sobre la meta del plan).
- frontera_exacta: B*(α) con el cálculo exacto (cola binomial), para E7.
- terminal: la salida textual de `./build/refor frontera -f tabla`, tal cual.
- gui: la grabación de refor_gui para E10 (capturar_gui.py): duración, tramos acelerados,
  cuántos cuadros JPEG hay y dónde queda el polígono 1 al final del zoom.

Ninguna cifra del video se escribe a mano: si falta una, se agrega aquí.
Uso, desde la raíz del repositorio (después de tiempos.py y de correr refor):

    ./build/refor plan --alpha 0.05 -B 12500 -f json
    ./build/refor frontera --alphas 0.01,0.02,0.05,0.10,0.20,0.30,0.50 --metodo exacto -f csv -o docs/res/frontera_exacta.csv
    ./build/refor frontera -f tabla -o - > docs/res/terminal_frontera.txt 2>&1
    python3 scripts/expoing/video/capturar_gui.py
    python3 scripts/expoing/video/datos_video.py
"""
import csv
import importlib.util
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[3]
LINEA = RAIZ / "docs" / "expoing" / "video" / "linea_de_tiempo.json"
PROCESADOS = RAIZ / "data" / "processed"
RES = RAIZ / "docs" / "res"
SALIDA = RAIZ / "scripts" / "expoing" / "video" / "datos_video.js"
COMANDO_TERMINAL = "./build/refor frontera -f tabla"

# Grabación de Giorgi Latso (Wikimedia Commons); ver docs/expoing/video/CREDITOS.md.
# La grabación abre con aplausos (se apagan hacia 2.7 s) y la primera nota suena en
# 4.16 s (perfil de energía por banda con ffmpeg). Empezar en 3.15 s deja el video en
# silencio un segundo, como pide el guion de E1, y la música entra en 1.0 s.
MUSICA = {
    "archivo": "docs/expoing/video/musica/latso_reflets_dans_leau.ogg",
    "desde": 3.15,  # segundo de la pieza que suena en el cuadro 0 del video
    "lufs": -24,    # sonoridad de la mezcla provisional, sin voz (la final la fija mezclar.py)
    # Atribución de la tarjeta final (CC BY-NC-SA 4.0); la misma de CREDITOS.md.
    "atribucion": "Música: Claude Debussy, <i>Reflets dans l'eau</i> (1905), interpretación de Giorgi Latso, "
                  "grabación de Asuas (2017), CC BY-NC-SA 4.0, vía Wikimedia Commons, editada.",
    "licencia_video": "Este video: CC BY-NC-SA 4.0",
}


def abrev(nombre):
    """Igual que src/salida.cpp: inicial del género + dos letras del epíteto."""
    gen, _, ep = nombre.partition(" ")
    return gen[0] + ep[:2] if ep else nombre[:3]


def requerir(ruta, comando):
    if not ruta.exists():
        sys.exit(f"Falta {ruta.relative_to(RAIZ)}. Genéralo con:\n    {comando}")
    return ruta


def simulacion_siembra():
    """El módulo scripts/simulacion_siembra.py, para usar su hectárea y su reparto."""
    ruta = RAIZ / "scripts" / "simulacion_siembra.py"
    spec = importlib.util.spec_from_file_location("simulacion_siembra", ruta)
    assert spec is not None and spec.loader is not None, ruta
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def hectarea():
    """Meta por especie de la hectárea de 14 × 47, con el mismo cálculo de simulacion_siembra.py."""
    sim = simulacion_siembra()
    compra = json.loads(requerir(RES / "plan" / "compra.json",
                                 "./build/refor plan --alpha 0.05 -B 12500 -f json").read_text(encoding="utf-8"))
    with open(PROCESADOS / "poligonos.csv", newline="", encoding="utf-8") as f:
        area = sum(float(r["area"]) for r in csv.DictReader(f))
    meta_ha = {s: 0.0 for s in sim.ORDEN}
    for pol in compra:
        for e in pol["especies"]:
            meta_ha[sim.ABREV[e["especie"]]] += e["n"] / area
    total = sim.FILAS_HA * sim.COLUMNAS_HA
    return {"filas": sim.FILAS_HA, "columnas": sim.COLUMNAS_HA, "meta": sim.mayor_residuo(meta_ha, total)}


def frontera_exacta():
    ruta = requerir(RES / "frontera_exacta.csv",
                    "./build/refor frontera --alphas 0.01,0.02,0.05,0.10,0.20,0.30,0.50 --metodo exacto -f csv "
                    "-o docs/res/frontera_exacta.csv")
    with open(ruta, newline="", encoding="utf-8") as f:
        return [[float(r["alfa"]), float(r["B_minimo"])] for r in csv.DictReader(f) if r["poligono"] == "todos"]


def terminal():
    ruta = requerir(RES / "terminal_frontera.txt", f"{COMANDO_TERMINAL} -o - > docs/res/terminal_frontera.txt 2>&1")
    return {"comando": COMANDO_TERMINAL, "salida": ruta.read_text(encoding="utf-8").rstrip("\n").split("\n")}


def gui():
    ruta = requerir(RAIZ / "docs/expoing/video/salida/gui/refor_gui.json", "python3 scripts/expoing/video/capturar_gui.py")
    g = json.loads(ruta.read_text(encoding="utf-8"))
    cuadros = RAIZ / g["carpeta"]
    if len(list(cuadros.glob("*.jpg"))) != g["cuadros"]:
        sys.exit(f"Faltan cuadros en {g['carpeta']}. Vuelve a editar con:\n"
                 "    python3 scripts/expoing/video/capturar_gui.py --editar")
    claves = ("duracion", "fps", "puntos", "acelerado", "tramos", "inicio_en_e10", "ancla", "cuadros", "carpeta",
              "calculo_real_s")
    return {k: g[k] for k in claves}


def main():
    linea = json.loads(LINEA.read_text(encoding="utf-8"))
    with open(PROCESADOS / "clave_vigente.csv", newline="", encoding="utf-8") as f:
        clave = [abrev(r["especie"]) for r in sorted(csv.DictReader(f), key=lambda r: int(r["posicion"]))]
    datos = {"linea": linea, "musica": MUSICA, "clave_vigente": clave, "hectarea": hectarea(),
             "frontera_exacta": frontera_exacta(), "terminal": terminal(), "gui": gui()}
    texto = json.dumps(datos, ensure_ascii=False, separators=(",", ":"))
    SALIDA.write_text("// Generado por scripts/expoing/video/datos_video.py; no editar a mano.\n"
                      f"window.DATOS_VIDEO = {texto};\n", encoding="utf-8")
    n = sum(len(e["cues"]) for e in linea["escenas"])
    h = datos["hectarea"]
    print(f"{SALIDA.relative_to(RAIZ)}: {len(linea['escenas'])} escenas, {n} subtítulos, "
          f"duración {linea['escenas'][-1]['fin']:.2f} s, clave vigente de {len(clave)} posiciones, "
          f"hectárea de {h['filas']} × {h['columnas']} ({sum(h['meta'].values())} plantas), "
          f"frontera exacta de {len(datos['frontera_exacta'])} α, terminal de {len(datos['terminal']['salida'])} líneas, "
          f"GUI de {datos['gui']['duracion']:.2f} s ({datos['gui']['cuadros']} cuadros, ×{datos['gui']['acelerado']})")


if __name__ == "__main__":
    main()
