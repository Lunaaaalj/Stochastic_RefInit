#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["playwright==1.64.1"]
# ///
"""Video guía para grabar la voz, y revisión de las tomas (PLAN §8.4, fase 3).

Andrea graba la narración escena por escena (11 tomas) viendo, en silencio, el video
guía de cada escena: la animación real, sin subtítulos, con un teleprompter arriba que
muestra el texto hablado (la frase actual resaltada al ritmo del guion y la siguiente
en gris), una barra de progreso de la frase y una cuenta regresiva de 3 s antes de la
primera frase (scripts/expoing/video/guia.js).

Uso, desde la raíz del repositorio:
    uv run scripts/expoing/video/video_guia.py                 # las 11 guías y GRABACION.md
    uv run scripts/expoing/video/video_guia.py E3 E7           # solo esas escenas
    uv run scripts/expoing/video/video_guia.py --revisar       # revisa las tomas de voz/

Escribe docs/expoing/video/salida/guia/guia_E01.mp4 … (git las ignora) y
docs/expoing/video/GRABACION.md (instrucciones y texto de cada toma). Si cambia el
guion: tiempos.py → datos_video.py → este script.

--revisar lee docs/expoing/video/voz/E01.wav … E11.wav y, para cada toma, comprueba el
formato (WAV a 48 kHz), que no sature, el ruido de fondo y cuánto dura el habla frente
a lo planeado: dentro de ±8 % se ajusta en la fase 5 (alinear.py); fuera, se vuelve a
grabar (PLAN §4.1).
"""
import argparse
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

VIDEO = Path(__file__).resolve().parent
sys.path.insert(0, str(VIDEO))
import renderizar as r  # noqa: E402  # pyright: ignore[reportMissingImports]  (mismo render que el video; también en los procesos hijos)

RAIZ = r.RAIZ
SALIDA = r.SALIDA / "guia"
VOZ = RAIZ / "docs" / "expoing" / "video" / "voz"
GRABACION = RAIZ / "docs" / "expoing" / "video" / "GRABACION.md"
ANTES = 3.0 + 1.0    # cuenta regresiva de 3 s, y 1 s de animación antes de ella
DESPUES = 1.0        # la guía sigue 1 s después del fin de la escena
TOLERANCIA = 0.08    # ±8 %: se ajusta; más, se vuelve a grabar (PLAN §4.1)


def tramo(e, total):
    c0, c1 = e["cues"][0]["inicio"], e["cues"][-1]["fin"]
    return c0 - ANTES, min(total, e["fin"] + DESPUES), c1 - c0


def fmt_t(s):
    return f"{int(s // 60)}:{s % 60:05.2f}"


def guias(ids, fps, trabajadores):
    dv = r.leer_datos_video()
    escenas = dv["linea"]["escenas"]
    total = escenas[-1]["fin"]
    elegidas = [e for e in escenas if not ids or e["id"].lower() in {i.lower() for i in ids}]
    if not elegidas:
        sys.exit(f"No hay escenas {ids}; existen {[e['id'] for e in escenas]}.")
    SALIDA.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="refor_guia_") as tmp:
        tmp = Path(tmp)
        grano = {"png": tmp / "grano.png"}
        grano["opacidad"] = r.extraer_grano(grano["png"])
        for e in elegidas:
            desde, hasta, _ = tramo(e, total)
            k0, k1 = round(desde * fps), round(hasta * fps)
            dur = (k1 - k0) / fps
            print(f"{e['id']}: guía de {fmt_t(max(0, desde))} a {fmt_t(hasta)} ({dur:.1f} s, {k1 - k0} cuadros a {fps} fps)")
            sub = tmp / e["id"]
            sub.mkdir()
            tramos = r.renderizar_tramos(k0, k1, fps, trabajadores, sub, True, extra=f"&guia={e['id']}")
            salida = SALIDA / f"guia_E{int(e['id'][1:]):02d}.mp4"
            r.exportar(tramos, salida, desde, dur, fps, None, grano, sub, borrador=True)
            print(f"  {salida.relative_to(RAIZ)} ({salida.stat().st_size / 1e6:.1f} MB)")
    escribir_grabacion(escenas, total)


def escribir_grabacion(escenas, total):
    filas, textos = [], []
    for k, e in enumerate(escenas, 1):
        _, _, habla = tramo(e, total)
        nombre = f"E{k:02d}"
        filas.append(f"| {nombre} | {e['titulo']} | {len(e['cues'])} | {habla:.1f} s | `guia_{nombre}.mp4` | `voz/{nombre}.wav` |")
        frases = "\n".join(f"{i}. {c['voz']}" for i, c in enumerate(e["cues"], 1))
        textos.append(f"### {nombre} · {e['titulo']}\n\nDuración planeada del habla: {habla:.1f} s "
                      f"(se acepta de {habla * (1 - TOLERANCIA):.1f} a {habla * (1 + TOLERANCIA):.1f} s).\n\n{frases}\n")
    GRABACION.write_text(f"""# Grabación de la voz

<!-- Generado por scripts/expoing/video/video_guia.py a partir de linea_de_tiempo.json; no editar a mano. -->

Narra **Andrea Estefanía de la Peña**, en 11 tomas, una por escena (PLAN §4.1 y §8.4). La animación ya
está hecha: la voz sigue al video, no al revés.

## Antes de grabar

- Un cuarto chico con ropa, cortinas o cojines; sin ventiladores ni aire acondicionado.
- Micrófono a 15–20 cm de la boca, un poco de lado para que las «p» no golpeen. Sirve uno de diadema
  o el del teléfono.
- **WAV a 48 kHz** (24 o 16 bits, mono o estéreo). Nada de MP3 ni de notas de voz comprimidas.
- Audífonos puestos y **sin música**: la guía no tiene sonido.
- Que el nivel quede lejos del máximo: si el medidor llega al rojo, se baja la ganancia.

## Cómo grabar cada toma

1. Abre la guía de la toma, `guia_EXX.mp4`, a pantalla completa (están en
   `docs/expoing/video/salida/guia/`; el equipo te las pasa si no tienes el repositorio).
2. Empieza a grabar, deja 2 s de silencio y dale play al video.
3. Arriba está el texto que se dice. Las palabras se encienden al ritmo esperado y la barra ocre
   marca cuánto falta de la frase; abajo, en gris, viene la siguiente.
4. Cuando la cuenta regresiva llega a «1», empieza la primera frase. Lee a tu ritmo natural:
   seguir las palabras encendidas ayuda, pero no tiene que ser exacto.
5. Al ver «Fin de la toma», deja 2 s de silencio y detén la grabación.
6. Se pueden repetir las veces que haga falta. Entrega la mejor de cada escena con el nombre
   `EXX.wav` (E01.wav … E11.wav); van en `docs/expoing/video/voz/`, que git no versiona.

Los números se dicen con letra, tal como aparecen abajo (los subtítulos del video sí llevan
cifras). Si una toma queda dentro de ±8 % de la duración planeada, se ajusta sola en la mezcla; si
no, se vuelve a grabar esa toma. Para revisarlas:

```bash
uv run scripts/expoing/video/video_guia.py --revisar
```

## Las 11 tomas

| Toma | Escena | Frases | Habla | Guía | Archivo |
|---|---|---|---|---|---|
{chr(10).join(filas)}

## Texto de cada toma

{chr(10).join(textos)}""", encoding="utf-8")
    print(f"{GRABACION.relative_to(RAIZ)}: instrucciones y texto de las {len(escenas)} tomas")


def medir(wav):
    """Formato, pico, ruido de fondo y tramo con habla de una toma."""
    info = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries",
                           "stream=codec_name,sample_rate,channels,bits_per_sample,bits_per_raw_sample:format=duration",
                           "-of", "default=nw=1", str(wav)], capture_output=True, text=True, check=True).stdout
    d = dict(l.split("=", 1) for l in info.strip().splitlines() if "=" in l)
    est = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(wav), "-af",
                          "silencedetect=noise=-42dB:d=0.35,astats=metadata=0", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    pico = max([float(x) for x in re.findall(r"Peak level dB: (-?[\d.]+|-inf)", est) if x != "-inf"] or [-99.0])
    dur = float(d.get("duration", 0))
    inicios = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", est)]
    finales = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", est)]
    silencios = list(zip(inicios, finales + [dur] * (len(inicios) - len(finales))))
    # Habla: del primer tramo con sonido al último. Los tramos de 0.2 s o menos no cuentan: son
    # el clic de empezar o detener la grabación (las notas de voz del teléfono lo dejan al inicio).
    sonidos, t = [], 0.0
    for s0, s1 in silencios:
        if s0 > t:
            sonidos.append((t, s0))
        t = s1
    if t < dur:
        sonidos.append((t, dur))
    habla = [s for s in sonidos if s[1] - s[0] > 0.2]
    a, b = (habla[0][0], habla[-1][1]) if habla else (0.0, 0.0)
    # Ruido de fondo: el nivel RMS del silencio más largo, sin sus orillas. (El «Noise floor» de
    # astats sobre toda la toma sale −inf en cuanto hay muestras en cero, como las del relleno
    # del códec al inicio de un M4A convertido.)
    piso = -99.0
    if silencios:
        s0, s1 = max(silencios, key=lambda s: s[1] - s[0])
        if s1 - s0 > 0.5:
            r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(wav), "-af",
                                f"atrim={s0 + 0.15:.3f}:{s1 - 0.15:.3f},astats=metadata=0", "-f", "null", "-"],
                               capture_output=True, text=True).stderr
            m = re.search(r"RMS level dB: (-?[\d.]+)", r)
            piso = float(m.group(1)) if m else piso
    return {"codec": d.get("codec_name"), "hz": int(d.get("sample_rate", 0)), "canales": int(d.get("channels", 0)),
            "bits": d.get("bits_per_sample") or d.get("bits_per_raw_sample"), "dur": dur, "pico": pico, "piso": piso,
            "habla": max(0.0, b - a)}


def revisar():
    # Contra lo PLANEADO (tiempos.py), no contra la línea de tiempo, que tras alinear ya trae la toma.
    import tiempos  # noqa: E402  # pyright: ignore[reportMissingImports]
    escenas = tiempos.planear()
    total = escenas[-1]["fin"]
    faltan, malas = [], 0
    print(f"Tomas en {VOZ.relative_to(RAIZ)}/ (habla planeada ± {TOLERANCIA:.0%}):")
    for k, e in enumerate(escenas, 1):
        nombre = f"E{k:02d}"
        wav = VOZ / f"{nombre}.wav"
        if not wav.exists():
            faltan.append(nombre)
            continue
        m, (_, _, plan) = medir(wav), tramo(e, total)
        avisos = []
        if m["codec"] is None or not m["codec"].startswith("pcm"):
            avisos.append(f"no es WAV PCM ({m['codec']})")
        if m["hz"] != 48000:
            avisos.append(f"{m['hz']} Hz (se pide 48 kHz)")
        if m["pico"] > -1.0:
            avisos.append(f"pico de {m['pico']:.1f} dBFS: puede saturar")
        if m["piso"] > -50:
            avisos.append(f"ruido de fondo de {m['piso']:.0f} dBFS (alto)")
        dif = m["habla"] / plan - 1
        if abs(dif) > TOLERANCIA:
            avisos.append(f"habla de {m['habla']:.1f} s frente a {plan:.1f} s ({dif:+.0%}): volver a grabar")
        estado = "bien" if not avisos else "revisar"
        malas += bool(avisos)
        print(f"  {nombre}  {m['habla']:5.1f} s de habla / {plan:5.1f} s ({dif:+.1%})  pico {m['pico']:5.1f} dBFS  "
              f"ruido {m['piso']:4.0f} dBFS  {estado}" + "".join(f"\n        · {a}" for a in avisos))
    if faltan:
        print(f"  Faltan: {', '.join(faltan)}")
    if malas:
        sys.exit(f"{malas} {'toma' if malas == 1 else 'tomas'} por revisar.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("escenas", nargs="*", help="ids de escena (por omisión, todas)")
    ap.add_argument("--fps", type=int, default=30, help="la guía no necesita 60 fps (por omisión, 30)")
    ap.add_argument("--trabajadores", type=int, default=max(1, min(8, (os.cpu_count() or 4) - 2)))
    ap.add_argument("--revisar", action="store_true", help="revisa las tomas de docs/expoing/video/voz/")
    ap.add_argument("--solo-texto", action="store_true", help="solo reescribe GRABACION.md")
    a = ap.parse_args()
    if a.revisar:
        revisar()
    elif a.solo_texto:
        dv = r.leer_datos_video()
        escribir_grabacion(dv["linea"]["escenas"], dv["linea"]["escenas"][-1]["fin"])
    else:
        guias(a.escenas, a.fps, a.trabajadores)


if __name__ == "__main__":
    main()
