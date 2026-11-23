#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["playwright==1.64.1"]
# ///
"""Renderiza el video de Expo Ingenierías cuadro a cuadro (PLAN §7).

Abre scripts/expoing/video/previsualizar.html?render en Chromium sin interfaz
(Playwright fijado a 1.64.1, es decir, Chromium 156; la versión fija importa para
que los cuadros sean idénticos byte por byte). Cada trabajador tiene su página,
pide cada cuadro con window.__video.tick(k / fps), lo captura en PNG y lo manda por
tubería a ffmpeg, que lo guarda sin pérdida. Al final se concatenan los tramos, se
agrega la música provisional y se exporta en H.264 + AAC, 1920 × 1080 a 60 fps.

Uso, desde la raíz del repositorio (uv instala Playwright solo):
    uv run scripts/expoing/video/renderizar.py --hasta E2              # rebanada vertical: E1 y E2
    uv run scripts/expoing/video/renderizar.py                         # todo el video
    uv run scripts/expoing/video/renderizar.py --desde E5 --hasta E6 --salida docs/expoing/video/salida/e5.mp4
    uv run scripts/expoing/video/renderizar.py --cuadros 3,12.3,17.6   # fotogramas sueltos en PNG
    uv run scripts/expoing/video/renderizar.py --determinismo 20 --hasta E2
    uv run scripts/expoing/video/renderizar.py --franja 0.25                # QA de la franja de subtítulos
    uv run scripts/expoing/video/renderizar.py --saltos                     # QA de cortes bruscos entre escenas
    uv run scripts/expoing/video/renderizar.py --borrador --voz-provisional    # animatic para revisar el ritmo

--voz-provisional exporta, además, una copia (<nombre>_voz_provisional.mp4) con una voz
sintética (say de macOS, voz Paulina) que lee el texto hablado de cada subtítulo en su tiempo. Solo sirve para revisar el ritmo del animatic
(PLAN §8.3); nunca entra a la mezcla final, que lleva la voz de Andrea.

--desde y --hasta aceptan segundos o el id de una escena (--desde toma su inicio;
--hasta, su fin). Si Chromium no está instalado:
    uv run --with playwright==1.64.1 playwright install chromium-headless-shell
"""
import argparse
import hashlib
import json
import multiprocessing as mp
import os
import random
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[3]
VIDEO = RAIZ / "scripts" / "expoing" / "video"
PAGINA = VIDEO / "previsualizar.html"
DATOS_VIDEO = VIDEO / "datos_video.js"
SALIDA = RAIZ / "docs" / "expoing" / "video" / "salida"
ANCHO, ALTO = 1920, 1080
ARGS_CHROMIUM = ["--force-color-profile=srgb", "--font-render-hinting=none", "--disable-lcd-text",
                 "--hide-scrollbars", "--allow-file-access-from-files", "--disable-gpu"]


def leer_datos_video():
    s = DATOS_VIDEO.read_text(encoding="utf-8")
    return json.loads(s[s.index("{"):s.rindex("}") + 1])


def instante(valor, escenas, fin):
    """Segundos o id de escena → segundos (inicio de la escena si fin es False)."""
    if valor is None:
        return None
    for e in escenas:
        if e["id"].lower() == str(valor).lower():
            return e["fin"] if fin else e["inicio"]
    return float(valor)


def abrir_pagina(p, sin_subtitulos, sin_grano=False, extra=""):
    try:
        nav = p.chromium.launch(args=ARGS_CHROMIUM)
    except Exception as e:  # noqa: BLE001 — se explica cómo instalar el navegador
        if "Executable doesn't exist" in str(e):
            sys.exit("Falta Chromium para Playwright 1.64.1. Instálalo con:\n"
                     "  uv run --with playwright==1.64.1 playwright install chromium-headless-shell")
        raise
    pag = nav.new_page(viewport={"width": ANCHO, "height": ALTO}, device_scale_factor=1)
    errores = []
    pag.on("pageerror", lambda e: errores.append(str(e)))
    url = PAGINA.as_uri() + "?render" + ("&sin_subtitulos" if sin_subtitulos else "") + ("&sin_grano" if sin_grano else "") + extra
    pag.goto(url)
    try:
        pag.wait_for_function("window.__video && window.__video.listo === true", timeout=60000)
    except Exception:  # noqa: BLE001
        sys.exit("La página no terminó de cargar:\n" + "\n".join(errores))
    cdp = pag.context.new_cdp_session(pag)
    return nav, pag, cdp, errores


def capturar(pag, cdp, t):
    import base64
    # Tick y, si el cuadro cambió una imagen (E10), su decodificación antes de capturar.
    pag.evaluate("async t => { window.__video.tick(t); await window.__video.pendientes(); }", t)
    # optimizeForSpeed solo baja la compresión del PNG: sigue siendo sin pérdida.
    r = cdp.send("Page.captureScreenshot", {"format": "png", "optimizeForSpeed": True, "captureBeyondViewport": False})
    return base64.b64decode(r["data"])


def extraer_grano(destino):
    """El grano de papel de la página (estático), para componerlo en ffmpeg."""
    import base64
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        nav, pag, _, _ = abrir_pagina(p, False)
        url, opacidad = pag.evaluate("() => [window.__video.grano(), window.__video.opacidadGrano]")
        nav.close()
    destino.write_bytes(base64.b64decode(url.split(",", 1)[1]))
    return opacidad


def trabajador(i, k0, k1, fps, destino, sin_subtitulos, contador, extra=""):
    from playwright.sync_api import sync_playwright
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(fps), "-c:v", "png", "-i", "-",
           "-c:v", "libx264rgb", "-qp", "0", "-preset", "ultrafast", str(destino)]
    with sync_playwright() as p:
        nav, pag, cdp, errores = abrir_pagina(p, sin_subtitulos, sin_grano=True, extra=extra)
        ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        assert ff.stdin is not None
        for k in range(k0, k1):
            ff.stdin.write(capturar(pag, cdp, k / fps))
            with contador.get_lock():
                contador.value += 1
        ff.stdin.close()
        if ff.wait() != 0:
            sys.exit(f"ffmpeg falló en el tramo {i}")
        if errores:
            sys.exit(f"Errores de la página en el tramo {i}:\n" + "\n".join(errores))
        nav.close()


def renderizar_tramos(k0, k1, fps, trabajadores, tmp, sin_subtitulos, extra=""):
    n = k1 - k0
    cortes = [k0 + round(n * j / trabajadores) for j in range(trabajadores + 1)]
    contador = mp.Value("i", 0)
    tramos, procesos = [], []
    for j in range(trabajadores):
        if cortes[j + 1] <= cortes[j]:
            continue
        destino = tmp / f"tramo_{j:02d}.mkv"
        tramos.append(destino)
        pr = mp.Process(target=trabajador, args=(j, cortes[j], cortes[j + 1], fps, destino, sin_subtitulos, contador, extra))
        pr.start()
        procesos.append(pr)
    inicio = time.time()
    while any(pr.is_alive() for pr in procesos):
        hechos = contador.value
        dt = time.time() - inicio
        resta = (n - hechos) * dt / hechos if hechos else 0
        print(f"\r  {hechos}/{n} cuadros · {hechos / max(dt, 1e-9):.1f} cuadros/s · faltan ≈ {resta:.0f} s   ", end="", flush=True)
        time.sleep(0.5)
    print(f"\r  {contador.value}/{n} cuadros en {time.time() - inicio:.0f} s" + " " * 30)
    if any(pr.exitcode != 0 for pr in procesos):
        sys.exit("Falló al menos un trabajador.")
    return tramos


def voz_provisional(escenas, desde, dur, tmp):
    """Una pista WAV con la voz sintética de cada subtítulo en su tiempo (solo revisión interna)."""
    if not shutil.which("say"):
        sys.exit("--voz-provisional necesita el comando say de macOS.")
    entradas, filtros = [], []
    cues = [c for e in escenas for c in e["cues"] if c["fin"] > desde and c["inicio"] < desde + dur]
    for k, c in enumerate(cues):
        wav = tmp / f"voz_{k:02d}.wav"
        subprocess.run(["say", "-v", "Paulina", "-r", "170", "--file-format=WAVE", "--data-format=LEI16@48000",
                        "-o", str(wav), c["voz"]], check=True)
        largo = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(wav)],
                                     capture_output=True, text=True, check=True).stdout)
        # Si la frase sintética dura más que el subtítulo, se acelera para que quepa.
        tempo = min(2.0, max(1.0, largo / max(0.5, c["fin"] - c["inicio"])))
        retraso = max(0, round((c["inicio"] - desde) * 1000))
        entradas += ["-i", str(wav)]
        filtros.append(f"[{k}:a]atempo={tempo:.4f},adelay={retraso}|{retraso}[v{k}]")
    salida = tmp / "voz_provisional.wav"
    mezcla = "".join(f"[v{k}]" for k in range(len(cues)))
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *entradas, "-filter_complex",
                    ";".join(filtros) + f";{mezcla}amix=inputs={len(cues)}:normalize=0:duration=longest[a]",
                    "-map", "[a]", "-ac", "2", "-ar", "48000", str(salida)], check=True)
    print(f"  voz provisional: {len(cues)} frases")
    return salida


def exportar(tramos, salida, desde, dur, fps, musica, grano, tmp, borrador=False, voz=None):
    lista = tmp / "tramos.txt"
    lista.write_text("".join(f"file '{t}'\n" for t in tramos), encoding="utf-8")
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lista),
           "-loop", "1", "-framerate", str(fps), "-i", str(grano["png"])]
    # Grano encima de todo, en mezcla normal (igual que el <canvas id="grano"> de la página),
    # y paso a YUV 4:2:0 con la matriz BT.709 para no desplazar los colores de la paleta.
    o = grano["opacidad"]
    filtros = [f"[0:v]format=gbrp[base];[1:v]format=gbrp[ruido];"
               f"[base][ruido]blend=all_expr='A*{1 - o:.4f}+B*{o:.4f}':shortest=1,"
               f"scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[v]"]
    mapas = ["-map", "[v]"]
    if musica:
        archivo = RAIZ / musica["archivo"]
        if not archivo.exists():
            sys.exit(f"No encuentro la música {archivo}; usa --sin-audio o descárgala (ver CREDITOS.md).")
        cmd += ["-ss", f"{musica['desde'] + desde:.3f}", "-t", f"{dur:.3f}", "-i", str(archivo)]
        # Mezcla provisional: la música sola, sin voz; la mezcla final la hace mezclar.py.
        # Entra con un fundido corto (evita el chasquido del corte) y sale en 2.5 s.
        fundido = min(2.5, dur / 4)
        entrada = 0.4 if desde == 0 else 0.05
        lufs = musica.get("lufs", -24)
        if voz:
            # Con la voz provisional, la música baja a fondo y la voz queda cerca de −16 LUFS (PLAN §4.2).
            cmd += ["-i", str(voz)]
            filtros.append(f"[2:a]afade=t=in:d={entrada},afade=t=out:st={dur - fundido:.3f}:d={fundido:.3f},"
                           f"loudnorm=I=-30:TP=-2:LRA=9,aresample=48000[m];"
                           f"[3:a]loudnorm=I=-17:TP=-2:LRA=7,aresample=48000[voz];"
                           f"[m][voz]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.89[a]")
        else:
            filtros.append(f"[2:a]afade=t=in:d={entrada},afade=t=out:st={dur - fundido:.3f}:d={fundido:.3f},"
                           f"loudnorm=I={lufs}:TP=-2:LRA=9,aresample=48000[a]")
        mapas += ["-map", "[a]", "-c:a", "aac", "-b:a", "192k", "-ar", "48000"]
    cmd += ["-filter_complex", ";".join(filtros), *mapas,
            "-c:v", "libx264", "-preset", "veryfast" if borrador else "slow", "-crf", "18", "-profile:v", "high", "-level", "4.2",
            "-pix_fmt", "yuv420p", "-r", str(fps), "-colorspace", "bt709", "-color_primaries", "bt709",
            "-color_trc", "bt709", "-color_range", "tv", "-movflags", "+faststart", "-t", f"{dur:.3f}", str(salida)]
    subprocess.run(cmd, check=True)


def fotogramas(tiempos, carpeta, sin_subtitulos):
    from playwright.sync_api import sync_playwright
    carpeta.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        nav, pag, cdp, errores = abrir_pagina(p, sin_subtitulos)
        for t in tiempos:
            ruta = carpeta / f"cuadro_{t:07.3f}.png"
            ruta.write_bytes(capturar(pag, cdp, t))
            print("  ", ruta.relative_to(RAIZ))
        nav.close()
    if errores:
        sys.exit("Errores de la página:\n" + "\n".join(errores))


# Revisa, dentro de la página, que ningún elemento visible de una escena entre en la franja
# de subtítulos (y ≥ 912): cajas de los elementos con opacidad efectiva y, en los lienzos de
# escena, píxeles no transparentes. La carta y el brote pueden pasar por debajo (PLAN §3.1).
FRANJA_JS = """t => {
  window.__video.tick(t);
  const esc = document.getElementById('escenario'), k = esc.getBoundingClientRect().width / 1920, y0 = esc.getBoundingClientRect().top;
  const malos = [];
  for (const raiz of document.querySelectorAll('#capas > .escena')) {
    if (raiz.style.display === 'none') continue;
    const visible = e => { let a = 1; for (let n = e; n && n !== raiz.parentNode; n = n.parentElement) {
      const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden') return 0; a *= +cs.opacity; } return a; };
    for (const e of raiz.querySelectorAll('*')) {
      if (e.closest('svg') && e.tagName.toLowerCase() !== 'svg' && !['path', 'text', 'rect', 'circle', 'g'].includes(e.tagName.toLowerCase())) continue;
      if (e.classList.contains('capitulo') || e.classList.contains('e11-tarjeta') || e.classList.contains('e11-tinta')) continue;
      if (e.tagName === 'CANVAS') {
        if (visible(e) < 0.01) continue;
        const d = e.getContext('2d').getImageData(0, 912, 1920, 168).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 8) { malos.push(raiz.dataset.escena + ' lienzo'); break; }
        continue;
      }
      if (['svg', 'g'].includes(e.tagName.toLowerCase()) || e.children.length && !e.textContent.trim()) continue;
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if ((r.bottom - y0) / k > 912.5 && (r.top - y0) / k < 1080 && visible(e) > 0.01) {
        malos.push(`${raiz.dataset.escena} <${e.tagName.toLowerCase()} class="${e.getAttribute('class') || ''}"> y=${((r.top - y0) / k).toFixed(0)}–${((r.bottom - y0) / k).toFixed(0)}`);
      }
    }
  }
  return [...new Set(malos)];
}"""


def franja(paso, desde, hasta):
    """QA de la franja de subtítulos, un cuadro cada `paso` segundos."""
    from playwright.sync_api import sync_playwright
    malos = {}
    with sync_playwright() as p:
        nav, pag, _, _ = abrir_pagina(p, True)
        t = desde
        while t <= hasta:
            for m in pag.evaluate(FRANJA_JS, t):
                malos.setdefault(m, []).append(t)
            t = round(t + paso, 6)
        nav.close()
    for m, ts in malos.items():
        print(f"  {m}: {len(ts)} cuadros, de {ts[0]:.2f} s a {ts[-1]:.2f} s")
    if malos:
        sys.exit(f"{len(malos)} elementos entran en la franja de subtítulos.")
    print(f"Franja de subtítulos libre en {desde:.2f}–{hasta:.2f} s (un cuadro cada {paso} s).")


def saltos(fps):
    """QA: en cada cambio de escena y al terminar cada cola, el cambio entre dos cuadros
    consecutivos no debe ser mucho mayor que el de los dos anteriores (un corte brusco).
    Las entradas previstas que arrancan de golpe (una hoja que empieza a aparecer) también
    salen aquí: hay que mirarlas y decidir."""
    import math
    from playwright.sync_api import sync_playwright
    if not shutil.which("magick"):
        sys.exit("--saltos necesita ImageMagick (magick).")
    marcados = []
    with tempfile.TemporaryDirectory(prefix="refor_saltos_") as tmp, sync_playwright() as p:
        tmp = Path(tmp)
        nav, pag, cdp, _ = abrir_pagina(p, True, sin_grano=True)
        escenas = pag.evaluate("() => window.__video.escenas")
        bordes = []
        for e in escenas[:-1]:
            bordes += [(f"{e['id']} termina", math.ceil(e["fin"] * fps - 1e-6)),
                       (f"{e['id']} fin de la cola", math.floor((e["fin"] + e["cola"]) * fps) + 1)]
        for nombre, k in bordes:
            pngs = []
            for j in (k - 2, k - 1, k):
                f = tmp / f"{j}.png"
                f.write_bytes(capturar(pag, cdp, j / fps))
                pngs.append(f)
            def mae(a, b):
                err = subprocess.run(["magick", "compare", "-metric", "MAE", str(a), str(b), "null:"], capture_output=True, text=True).stderr
                return float(err.split("(")[1].split(")")[0]) * 100
            antes, borde = mae(pngs[0], pngs[1]), mae(pngs[1], pngs[2])
            salto = borde > 0.6 and borde > 4 * max(antes, 0.05)
            marcados += [nombre] if salto else []
            print(f"  {nombre:22s} t = {k / fps:8.3f} s  cambio previo {antes:5.2f} %  en el borde {borde:5.2f} %" + ("  ← revisar" if salto else ""))
        nav.close()
    print(f"{len(marcados)} bordes por revisar: {', '.join(marcados)}" if marcados else "Sin saltos bruscos en los bordes de escena.")


def determinismo(n, desde, hasta, fps):
    """Renderiza n cuadros al azar dos veces, en orden inverso la segunda, y compara hashes."""
    from playwright.sync_api import sync_playwright
    azar = random.Random(2026)
    ks = sorted(azar.sample(range(round(desde * fps), round(hasta * fps)), n))
    hashes = []
    for orden in (ks, list(reversed(ks))):
        with sync_playwright() as p:
            nav, pag, cdp, _ = abrir_pagina(p, False)
            hashes.append({k: hashlib.sha1(capturar(pag, cdp, k / fps)).hexdigest() for k in orden})
            nav.close()
    malos = [k for k in ks if hashes[0][k] != hashes[1][k]]
    for k in ks:
        print(f"  t = {k / fps:8.3f} s  {hashes[0][k][:12]}  {'igual' if k not in malos else 'DISTINTO ' + hashes[1][k][:12]}")
    if malos:
        sys.exit(f"{len(malos)} de {n} cuadros cambian entre renders: tick(t) no es determinista.")
    print(f"Determinismo: {n} de {n} cuadros idénticos.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--desde", default=None, help="segundos o id de escena (por omisión, 0)")
    ap.add_argument("--hasta", default=None, help="segundos o id de escena (por omisión, el final)")
    ap.add_argument("--fps", type=int, default=60)
    ap.add_argument("--trabajadores", type=int, default=max(1, min(8, (os.cpu_count() or 4) - 2)))
    ap.add_argument("--salida", type=Path, default=None, help="MP4 de salida")
    ap.add_argument("--sin-audio", action="store_true", help="sin audio")
    ap.add_argument("--borrador", action="store_true", help="exporta con -preset veryfast (para revisiones)")
    ap.add_argument("--sin-subtitulos", action="store_true", help="oculta los subtítulos (QA de la franja)")
    ap.add_argument("--voz-provisional", action="store_true",
                    help="agrega una voz sintética solo para revisar el ritmo (nunca para el video final)")
    ap.add_argument("--cuadros", help="exporta solo estos instantes (segundos, separados por comas) a PNG")
    ap.add_argument("--determinismo", type=int, metavar="N", help="compara N cuadros al azar renderizados dos veces")
    ap.add_argument("--franja", type=float, metavar="PASO", help="QA: nada de las escenas entra en la franja de subtítulos")
    ap.add_argument("--saltos", action="store_true", help="QA: busca cortes bruscos en los bordes de escena")
    a = ap.parse_args()

    dv = leer_datos_video()
    escenas = dv["linea"]["escenas"]
    total = escenas[-1]["fin"]
    desde = instante(a.desde, escenas, False) or 0.0
    hasta = instante(a.hasta, escenas, True) or total
    hasta = min(hasta, total)
    if hasta <= desde:
        sys.exit("--hasta debe ser posterior a --desde.")
    if not shutil.which("ffmpeg"):
        sys.exit("Falta ffmpeg.")

    if a.cuadros:
        fotogramas([float(x) for x in a.cuadros.split(",")], SALIDA / "cuadros", a.sin_subtitulos)
        return
    if a.determinismo:
        determinismo(a.determinismo, desde, hasta, a.fps)
        return
    if a.franja:
        franja(a.franja, desde, hasta)
        return
    if a.saltos:
        saltos(a.fps)
        return

    if a.voz_provisional and a.sin_audio:
        sys.exit("--voz-provisional va con la música; quita --sin-audio.")
    nombre = "refor_expoing_2026.mp4" if (desde, hasta) == (0.0, total) else f"tramo_{desde:06.2f}-{hasta:06.2f}.mp4"
    salida = a.salida or SALIDA / nombre
    salida = salida if salida.is_absolute() else RAIZ / salida
    salida.parent.mkdir(parents=True, exist_ok=True)
    k0, k1 = round(desde * a.fps), round(hasta * a.fps)
    dur = (k1 - k0) / a.fps
    print(f"Render de {desde:.2f} s a {hasta:.2f} s ({k1 - k0} cuadros a {a.fps} fps) con {a.trabajadores} trabajadores…")
    with tempfile.TemporaryDirectory(prefix="refor_video_") as tmp:
        tmp = Path(tmp)
        grano = {"png": tmp / "grano.png"}
        grano["opacidad"] = extraer_grano(grano["png"])
        tramos = renderizar_tramos(k0, k1, a.fps, a.trabajadores, tmp, a.sin_subtitulos)
        print("Exportando…")
        musica = None if a.sin_audio else dv["musica"]
        exportar(tramos, salida, desde, dur, a.fps, musica, grano, tmp, a.borrador)
        listas = [salida]
        if a.voz_provisional:
            # De los mismos cuadros, una segunda copia con la voz sintética (solo revisión interna).
            con_voz = salida.with_name(salida.stem + "_voz_provisional.mp4")
            exportar(tramos, con_voz, desde, dur, a.fps, musica, grano, tmp, a.borrador, voz_provisional(escenas, desde, dur, tmp))
            listas.append(con_voz)
    for f in listas:
        print(f"Listo: {f.relative_to(RAIZ) if f.is_relative_to(RAIZ) else f} ({f.stat().st_size / 1e6:.1f} MB, {dur:.2f} s)")


if __name__ == "__main__":
    main()
