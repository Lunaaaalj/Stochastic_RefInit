#!/usr/bin/env python3
"""Exporta las piezas del perfil de Expo Ingenierías a docs/expoing/.

Genera, con las versiones elegidas del mockup:
  imagen-1-mosaico.gif            Imagen 1 (A): el mosaico pasa del azar al arreglo optimizado.
  imagen-2-mapa.png               Imagen 2 (E): mapa de los 30 polígonos por superficie.
  imagen-3-compra.png             Imagen 3 (F): cuánto comprar y cuánto cuesta.
  fondo-curvas-de-nivel.png       Imagen de fondo de la muestra virtual (7): el sitio y una lupa
                                  sobre el mosaico, dibujados con la carta del video.
  logo-brote-hexagono.png         Logo completo, con fondo transparente (5).
  logo-marca.png                  Solo la marca del logo, con fondo transparente.

Las piezas se dibujan en scripts/expoing/piezas.js (con lo común de
scripts/expoing/comun.js, que comparte con el video; el fondo usa además la carta del video,
scripts/expoing/video/carta.js) y los datos de
docs/presentacion/datos/datos.js (generado por scripts/datos_presentacion.py), y se
rasterizan con Chrome sin interfaz. El GIF se arma con ffmpeg. Nada de lo que se
dibuja es ilustrativo: todas las cifras salen de esos datos.

Uso, desde la raíz del repositorio:
    python scripts/exportar_expoing.py                 # todo
    python scripts/exportar_expoing.py --solo gif      # gif | imagenes | fondo | logo
    python scripts/exportar_expoing.py --fps 12 --ancho-gif 960

Requisitos: Google Chrome (o la variable CHROME con la ruta del ejecutable) y ffmpeg.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DATOS = RAIZ / "docs" / "presentacion" / "datos" / "datos.js"
FUENTES = RAIZ / "docs" / "presentacion" / "fuentes"
COMUN = RAIZ / "scripts" / "expoing" / "comun.js"
PIEZAS = RAIZ / "scripts" / "expoing" / "piezas.js"
CARTA = RAIZ / "scripts" / "expoing" / "video" / "carta.js"
SALIDA = RAIZ / "docs" / "expoing"

LOGO = "l5"  # versión del logo elegida en el mockup
FONDO = "7"  # versión del fondo: del sitio al mosaico
DURACION_GIF = 8.0  # segundos de un ciclo de la versión A (T_MOS en piezas.js)


def buscar_chrome():
    candidatos = [os.environ.get("CHROME"),
                  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                  shutil.which("google-chrome"), shutil.which("chromium"), shutil.which("chrome"),
                  r"C:\Program Files\Google\Chrome\Application\chrome.exe"]
    for c in candidatos:
        if c and Path(c).exists():
            return c
    sys.exit("No encontré Chrome. Instálalo o define CHROME con la ruta del ejecutable.")


def leer_datos():
    """Resumen de datos.js con lo que usan las piezas (el mismo del mockup)."""
    s = DATOS.read_text(encoding="utf-8")
    j = json.loads(s[s.index("{"):s.rindex("}") + 1])
    m = j["mosaicos"][0]
    return {
        "mapa": j["mapa"], "W": j["W"], "especies": j["especies"], "clave": m["clave"],
        "m1": {k: m[k] for k in ("mejor", "azar", "media", "de", "coef")},
        "escenarios": j["escenarios"], "frontera": j["frontera"], "totales": j["totales"],
        "origen": j["origen_utm"],
        "mosaicos": [{"id": x["id"], "n": len(x["poligonos"]), "clave": x["clave"],
                      "mejor": x["mejor"], "azar": x["azar"]} for x in j["mosaicos"]],
    }


def fuentes_css():
    f = lambda n: (FUENTES / n).as_uri()
    return f"""
@font-face {{ font-family: 'Libre Caslon Display'; font-weight: 400; src: url({f('LibreCaslonDisplay-400-normal-latin.woff2')}) format('woff2'); }}
@font-face {{ font-family: 'Libre Caslon Text'; font-weight: 400; font-style: normal; src: url({f('LibreCaslonText-400-normal-latin.woff2')}) format('woff2'); }}
@font-face {{ font-family: 'Libre Caslon Text'; font-weight: 400; font-style: italic; src: url({f('LibreCaslonText-400-italic-latin.woff2')}) format('woff2'); }}
@font-face {{ font-family: 'Libre Caslon Text'; font-weight: 700; font-style: normal; src: url({f('LibreCaslonText-700-normal-latin.woff2')}) format('woff2'); }}
@font-face {{ font-family: 'Instrument Sans'; font-weight: 400 700; src: url({f('InstrumentSans-normal-latin.woff2')}) format('woff2'); }}
"""


CONTROLADOR = """
const q = new URLSearchParams(location.search), tipo = q.get('tipo'), id = q.get('id'), t = parseFloat(q.get('t') || '0');
const w = +q.get('w'), h = +q.get('h'), E = window.__EXPO;
let svg;
if (tipo === 'v') { const v = E.V.find(x => x.id === id); svg = E.crearSvg(v); E.reg.length = 0; if (svg._o) svg._o.tick(t); }
else if (tipo === 'f') {
  const f = E.FONDOS.find(x => x.id === id), NS = 'http://www.w3.org/2000/svg';
  svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 1600 900'); f.build(svg);
}
else { svg = E.logoSvg(id, q.get('modo')); }
svg.setAttribute('width', w); svg.setAttribute('height', h); svg.style.display = 'block';
document.body.appendChild(svg);
document.title = 'listo';
"""


def escribir_pagina(tmp):
    css = fuentes_css() + """
:root { --display: 'Libre Caslon Display', Georgia, serif; --texto: 'Libre Caslon Text', Georgia, serif; --ui: 'Instrument Sans', sans-serif; }
html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
svg text { font-family: var(--texto); } svg .t-disp { font-family: var(--display); }
svg .t-ui { font-family: var(--ui); } svg .it { font-style: italic; }
"""
    datos = json.dumps(leer_datos(), ensure_ascii=False, separators=(",", ":"))
    comun = COMUN.read_text(encoding="utf-8")
    # La carta del video lee DATOS (datos.js completo); las piezas, el resumen D.
    datos_js = DATOS.read_text(encoding="utf-8")
    carta = CARTA.read_text(encoding="utf-8")
    piezas = PIEZAS.read_text(encoding="utf-8")
    html = (f"<!doctype html><meta charset=utf-8><style>{css}</style>\n"
            f"<script>{datos_js}</script>\n<script>const D = {datos}; const CAPTURA = '';</script>\n"
            f"<script>{comun}</script>\n<script>{carta}</script>\n<script>{piezas}</script>\n"
            f"<script>document.fonts.load(\"400 20px 'Libre Caslon Text'\");"
            f"Promise.all([document.fonts.load(\"italic 20px 'Libre Caslon Text'\"), document.fonts.load(\"700 20px 'Libre Caslon Text'\"), "
            f"document.fonts.load(\"20px 'Libre Caslon Display'\"), document.fonts.load(\"600 20px 'Instrument Sans'\")]).then(() => {{{CONTROLADOR}}});</script>")
    ruta = tmp / "exportar.html"
    ruta.write_text(html, encoding="utf-8")
    return ruta


def capturar(chrome, pagina, params, salida, ancho, alto, escala=1.0, transparente=False):
    url = pagina.as_uri() + "?" + "&".join(f"{k}={v}" for k, v in {**params, "w": ancho, "h": alto}.items())
    with tempfile.TemporaryDirectory() as perfil:
        cmd = [chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
               f"--user-data-dir={perfil}", f"--window-size={ancho},{alto}",
               f"--force-device-scale-factor={escala}", "--virtual-time-budget=4000",
               "--allow-file-access-from-files", f"--screenshot={salida}"]
        if transparente:
            cmd.append("--default-background-color=00000000")
        r = subprocess.run(cmd + [url], capture_output=True, text=True, timeout=120)
    if not Path(salida).exists():
        sys.exit(f"Chrome no generó {salida}:\n{r.stderr[-800:]}")


def exportar_gif(chrome, pagina, fps, ancho_gif):
    n = int(round(DURACION_GIF * fps))
    alto_gif = round(ancho_gif * 9 / 16)
    with tempfile.TemporaryDirectory() as d:
        d = Path(d)
        print(f"GIF: {n} cuadros de {ancho_gif}×{alto_gif} a {fps} cuadros/s…")
        def uno(k):
            capturar(chrome, pagina, {"tipo": "v", "id": "A", "t": f"{k / fps:.4f}"}, d / f"c{k:03d}.png", 1280, 720, ancho_gif / 1280)
        with ThreadPoolExecutor(max_workers=6) as ex:
            list(ex.map(uno, range(n)))
        paleta = d / "paleta.png"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps), "-i", str(d / "c%03d.png"),
                        "-vf", "palettegen=max_colors=96:stats_mode=full", str(paleta)], check=True)
        gif = SALIDA / "imagen-1-mosaico.gif"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps), "-i", str(d / "c%03d.png"), "-i", str(paleta),
                        "-lavfi", "paletteuse=dither=none:diff_mode=rectangle", "-loop", "0", str(gif)], check=True)
    print(f"  {gif.relative_to(RAIZ)}  {gif.stat().st_size / 1e6:.2f} MB")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--solo", choices=["gif", "imagenes", "fondo", "logo"], help="exporta solo un grupo")
    ap.add_argument("--fps", type=int, default=15, help="cuadros por segundo del GIF")
    ap.add_argument("--ancho-gif", type=int, default=1280, help="ancho del GIF en píxeles")
    a = ap.parse_args()
    SALIDA.mkdir(parents=True, exist_ok=True)
    chrome = buscar_chrome()
    with tempfile.TemporaryDirectory() as tmp:
        pagina = escribir_pagina(Path(tmp))
        quiere = lambda g: a.solo in (None, g)
        if quiere("imagenes"):
            for nombre, v in (("imagen-2-mapa.png", "E"), ("imagen-3-compra.png", "F")):
                capturar(chrome, pagina, {"tipo": "v", "id": v}, SALIDA / nombre, 1280, 720, 1.5)
                print("  ", nombre)
        if quiere("fondo"):
            capturar(chrome, pagina, {"tipo": "f", "id": FONDO}, SALIDA / "fondo-curvas-de-nivel.png", 1600, 900, 1.2)
            print("   fondo-curvas-de-nivel.png")
        if quiere("logo"):
            capturar(chrome, pagina, {"tipo": "l", "id": LOGO, "modo": "full"}, SALIDA / "logo-brote-hexagono.png", 640, 240, 2, True)
            capturar(chrome, pagina, {"tipo": "l", "id": LOGO, "modo": "mark"}, SALIDA / "logo-marca.png", 512, 512, 1, True)
            print("   logo-brote-hexagono.png, logo-marca.png")
        if quiere("gif"):
            exportar_gif(chrome, pagina, a.fps, a.ancho_gif)


if __name__ == "__main__":
    main()
