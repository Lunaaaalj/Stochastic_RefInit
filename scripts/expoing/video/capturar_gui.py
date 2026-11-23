#!/usr/bin/env python3
"""Grabación de refor_gui para E10 (PLAN §8.5): compila, graba y edita.

1. **Compila** `refor_gui_captura`: el `gui/main.cpp` real más `captura/captura_gui.cpp`, que
   desvía la entrada (un guion de clics y teclas) y la salida (cada cuadro a ffmpeg). Usa las
   mismas banderas, la misma `librefor_core.a` y las mismas dependencias que la build de CMake
   (`build/`), y solo vuelve a compilar Dear ImGui con sus ganchos de prueba.
2. **Graba** la sesión completa a 2560 × 1440 (la ventana de 1280 × 720 puntos al doble de
   densidad), sin pérdida, a reloj de pared: `salida/gui/crudo.mkv` y `crudo.json` (marcas del
   guion). No hace falta el permiso de grabación de pantalla: los cuadros salen del propio
   framebuffer del programa.
3. **Edita** el clip de E10 (la compra, la clave en «Mosaico» y el zoom al polígono 1 en el
   mapa del cerco): el tramo del cálculo se acelera ×N (N entero, a la vista en el
   clip) y lo demás va a velocidad real. Escribe `salida/gui/refor_gui.mkv` (maestro sin
   pérdida), `refor_gui.json` (tramos, factor y ancla), `refor_gui_vista.mp4` (1920 × 1080, con
   la marca «×N», para revisarlo) y `cuadros/0000.jpg…`: un JPEG por cuadro a 1280 × 720, que
   E10 muestra uno a uno (el render captura la página cuadro a cuadro; un <video> no daría
   siempre el mismo cuadro). datos_video.py lee refor_gui.json.

Desde la raíz del repositorio, con la build de CMake hecha (`cmake --build build`):

    python3 scripts/expoing/video/capturar_gui.py              # compila, graba y edita
    python3 scripts/expoing/video/capturar_gui.py --prueba     # abre, lista los widgets y cierra
    python3 scripts/expoing/video/capturar_gui.py --editar     # solo vuelve a editar el crudo
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import json
import math
import shlex
import shutil
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[3]
BUILD = RAIZ / "build"
OBJ = BUILD / "captura"
BIN = OBJ / "refor_gui_captura"
FUENTE = Path(__file__).resolve().parent / "captura" / "captura_gui.cpp"
SALIDA = RAIZ / "docs/expoing/video/salida/gui"
CRUDO, CRUDO_JSON = SALIDA / "crudo.mkv", SALIDA / "crudo.json"
MAESTRO, MAESTRO_JSON, VISTA = SALIDA / "refor_gui.mkv", SALIDA / "refor_gui.json", SALIDA / "refor_gui_vista.mp4"
CUADROS = SALIDA / "cuadros"

IMGUI = ["imgui-src/imgui.cpp", "imgui-src/imgui_draw.cpp", "imgui-src/imgui_tables.cpp", "imgui-src/imgui_widgets.cpp",
         "imgui-src/imgui_demo.cpp", "imgui-src/backends/imgui_impl_glfw.cpp",
         "imgui-src/backends/imgui_impl_opengl3.cpp", "imgui-src/misc/cpp/imgui_stdlib.cpp",
         "implot-src/implot.cpp", "implot-src/implot_items.cpp"]

# Edición: cuánto del cálculo se ve a velocidad real al empezar y al terminar, y cuánto dura
# el tramo acelerado en el clip.
REAL_AL_EMPEZAR, REAL_AL_TERMINAR, ACELERADO = 0.2, 0.3, 1.5
RECORTE_INICIO = 1.6   # el crudo empieza 2 s antes de la primera acción; quedan 0.4 s quietos
FINAL_MIN = 0.8        # lo mínimo que se ve el polígono sembrado, ya acercado, antes de cerrar
INICIO_EN_E10 = 0.4    # segundo de E10 en que arranca el clip: la ventana ya casi entró
LINEA = RAIZ / "docs/expoing/video/linea_de_tiempo.json"


def flags(objetivo: str) -> list[str]:
    """Defines, includes y banderas de un objetivo de la build de CMake (su flags.make)."""
    campos = {}
    for linea in (BUILD / "CMakeFiles" / f"{objetivo}.dir" / "flags.make").read_text().splitlines():
        if " = " in linea and not linea.startswith("#"):
            k, v = linea.split(" = ", 1)
            campos[k.strip()] = v
    return shlex.split(" ".join(campos.get(k, "") for k in ("CXX_DEFINES", "CXX_INCLUDES", "CXX_FLAGS")))


def compilar() -> None:
    enlace = shlex.split((BUILD / "CMakeFiles/refor_gui.dir/link.txt").read_text())
    for requisito in (BUILD / "librefor_core.a", BUILD / "gui_gen/fuentes.cpp", BUILD / "_deps/imgui-src/imgui.cpp"):
        if not requisito.exists():
            sys.exit(f"Falta {requisito.relative_to(RAIZ)}: primero cmake -S . -B build -DCMAKE_BUILD_TYPE=Release "
                     "&& cmake --build build -j")
    cxx, motor = enlace[0], ["-DIMGUI_ENABLE_TEST_ENGINE"]
    f_imgui, f_gui = flags("imgui_lib") + motor, flags("refor_gui") + motor
    unidades = [(BUILD / "_deps" / s, f_imgui) for s in IMGUI]
    unidades += [(BUILD / "gui_gen/fuentes.cpp", f_gui)]
    unidades += [(p, f_gui) for p in sorted((RAIZ / "gui").glob("*.cpp")) if p.name != "main.cpp"]
    unidades += [(FUENTE, f_gui)]
    OBJ.mkdir(parents=True, exist_ok=True)
    # Las cabeceras de gui/ y src/ también cuentan: si alguna es más nueva, se recompila lo de gui.
    cabeceras = max(p.stat().st_mtime for d in ("gui", "src") for p in (RAIZ / d).rglob("*.hpp"))

    def uno(u):
        fuente, fl = u
        obj = OBJ / (fuente.stem + ".o")
        referencia = fuente.stat().st_mtime if fl is f_imgui else max(fuente.stat().st_mtime, cabeceras,
                                                                         (RAIZ / "gui/main.cpp").stat().st_mtime)
        if obj.exists() and obj.stat().st_mtime > referencia:
            return obj
        r = subprocess.run([cxx, *fl, "-c", str(fuente), "-o", str(obj)], capture_output=True, text=True)
        if r.returncode:
            sys.exit(f"Error al compilar {fuente.name}:\n{r.stderr}")
        return obj

    with cf.ThreadPoolExecutor() as ex:
        objetos = list(ex.map(uno, unidades))
    # Lo que enlaza refor_gui, sin sus objetos ni la libimgui_lib.a sin ganchos.
    i = enlace.index("-o")
    banderas = [a for a in enlace[1:i] if not a.endswith(".o")]
    libs = [str(BUILD / a) if a.endswith(".a") else a for a in enlace[i + 2:] if a != "libimgui_lib.a"]
    r = subprocess.run([cxx, *banderas, *map(str, objetos), "-o", str(BIN), *libs], capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"Error al enlazar:\n{r.stderr}")
    print(f"Compilado {BIN.relative_to(RAIZ)}")


def grabar(prueba: bool) -> None:
    SALIDA.mkdir(parents=True, exist_ok=True)
    cmd = [str(BIN), "--salida", str(CRUDO), "--registro", str(CRUDO_JSON)] + (["--prueba"] if prueba else [])
    r = subprocess.run(cmd, cwd=RAIZ)
    if r.returncode:
        sys.exit(f"La grabación falló (código {r.returncode})")
    reg = json.loads(CRUDO_JSON.read_text())
    if not reg["completo"]:
        sys.exit("La ventana se cerró antes de terminar el guion")
    print(f"Grabado {CRUDO.relative_to(RAIZ)}: {reg['cuadros_escritos'] / reg['fps']:.1f} s, "
          f"{reg['cuadros_repetidos']} cuadros repetidos, peor cuadro {reg['peor_ms']} ms")


def editar() -> None:
    reg = json.loads(CRUDO_JSON.read_text())
    m = reg["marcas"]
    # Tramos del crudo: real hasta poco después de arrancar el cálculo, acelerado hasta poco
    # antes de terminar, real hasta el final.
    a0, a1 = RECORTE_INICIO, m["calculando"] + REAL_AL_EMPEZAR
    c0 = m["listo"] - REAL_AL_TERMINAR
    n = max(2, math.ceil((c0 - a1) / ACELERADO))
    # El clip va de INICIO_EN_E10 hasta 0.4 s después del final de E10, cuando la ventana ya
    # se está cerrando: lo que sobre se quita del final, sin dejar menos de FINAL_MIN en el
    # polígono ya acercado.
    e10 = next(e for e in json.loads(LINEA.read_text())["escenas"] if e["id"] == "E10")
    objetivo = e10["fin"] - e10["inicio"] + 0.4 - INICIO_EN_E10
    sin_final = (a1 - a0) + (c0 - a1) / n
    c1 = min(m["fin"], max(m["zoom_listo"] + FINAL_MIN, c0 + objetivo - sin_final))
    tramos = [(a0, a1, 1), (a1, c0, n), (c0, c1, 1)]
    filtros, t, salida = [], 0.0, []
    for k, (d, h, v) in enumerate(tramos):
        filtros.append(f"[0:v]trim=start={d:.4f}:end={h:.4f},setpts=(PTS-STARTPTS)/{v}[t{k}]")
        salida.append({"desde": round(t, 4), "hasta": round(t + (h - d) / v, 4), "velocidad": v,
                       "crudo": [round(d, 4), round(h, 4)]})
        t += (h - d) / v
    filtros.append("".join(f"[t{k}]" for k in range(len(tramos))) + f"concat=n={len(tramos)}:v=1:a=0,fps={reg['fps']}[v]")
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(CRUDO),
                    "-filter_complex", ";".join(filtros), "-map", "[v]",
                    "-c:v", "libx264rgb", "-preset", "veryfast", "-qp", "0", str(MAESTRO)], check=True)

    def en_clip(t_crudo: float) -> float:
        for tr in salida:
            d, h = tr["crudo"]
            if d <= t_crudo <= h:
                return round(tr["desde"] + (t_crudo - d) / tr["velocidad"], 4)
        return -1.0

    # Un JPEG por cuadro, a un punto por píxel (la ventana de E10 mide 1280 × 720), sin
    # submuestreo de color para que el texto de la interfaz no se manche.
    shutil.rmtree(CUADROS, ignore_errors=True)
    CUADROS.mkdir(parents=True)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(MAESTRO),
                    "-vf", f"scale={reg['ancho']}:{reg['alto']}:flags=lanczos", "-pix_fmt", "yuvj444p", "-q:v", "2",
                    "-start_number", "0", str(CUADROS / "%04d.jpg")], check=True)
    cuadros = len(list(CUADROS.glob("*.jpg")))

    datos = {"duracion": round(t, 4), "fps": reg["fps"], "tamano": [reg["ancho"] * reg["escala"], reg["alto"] * reg["escala"]],
             "puntos": [reg["ancho"], reg["alto"]], "acelerado": n, "tramos": salida,
             "marcas": {k: en_clip(v) for k, v in m.items() if en_clip(v) >= 0},
             "calculo_real_s": round(m["listo"] - m["calculando"], 2),
             "inicio_en_e10": INICIO_EN_E10, "ancla": reg["ancla"], "cuadros": cuadros,
             "carpeta": str(CUADROS.relative_to(RAIZ))}
    MAESTRO_JSON.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n")
    vista(datos)
    print(f"Editado {MAESTRO.relative_to(RAIZ)}: {t:.2f} s (E10 pide {objetivo:.2f} s); "
          f"el cálculo ({datos['calculo_real_s']} s reales) va ×{n}")
    print(f"Vista previa: {VISTA.relative_to(RAIZ)}")


def vista(datos: dict) -> None:
    """MP4 de revisión: el clip a 1920 × 1080 con la marca «×N» en el tramo acelerado."""
    rapido = next(tr for tr in datos["tramos"] if tr["velocidad"] > 1)
    marca = SALIDA / "marca.png"
    subprocess.run(["magick", "-size", "132x64", "xc:none", "-fill", "rgba(46,42,39,0.88)",
                    "-draw", "roundrectangle 0,0 131,63 12,12", "-fill", "#fcf0da", "-font", "Helvetica-Bold",
                    "-pointsize", "38", "-gravity", "center", "-annotate", "+0+1", f"×{rapido['velocidad']}",
                    str(marca)], check=True)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(MAESTRO), "-i", str(marca),
                    "-filter_complex",
                    f"[0:v]scale=1920:1080:flags=lanczos[b];[b][1:v]overlay=x=W-w-28:y=H-h-62:"
                    f"enable='between(t,{rapido['desde']},{rapido['hasta']})',format=yuv420p[v]",
                    "-map", "[v]", "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-movflags", "+faststart",
                    str(VISTA)], check=True)
    marca.unlink()


def main() -> None:
    ap = argparse.ArgumentParser(description=(__doc__ or "").split("\n\n")[0])
    ap.add_argument("--prueba", action="store_true", help="abre la ventana, lista los widgets y cierra")
    ap.add_argument("--editar", action="store_true", help="solo vuelve a editar el crudo ya grabado")
    a = ap.parse_args()
    if not a.editar:
        compilar()
        grabar(a.prueba)
        if a.prueba:
            return
    editar()


if __name__ == "__main__":
    main()
