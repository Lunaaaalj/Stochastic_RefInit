#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["faster-whisper==1.2.1", "num2words==0.5.14", "numpy"]
# ///
"""Alineación de las tomas de voz con el guion (PLAN §8.6).

Transcribe cada toma (docs/expoing/video/voz/EXX.wav) con faster-whisper y marcas por
palabra, y alinea esa transcripción contra el TEXTO HABLADO conocido de cada subtítulo
(no contra la transcripción: si Andrea dice «plantador» donde el guion dice «planeador»,
la palabra del guion conserva su lugar y su tiempo, y el desacuerdo se reporta). Escribe:

    docs/expoing/video/alineacion.json

con, por escena, la toma usada (y su huella SHA-1), dónde empieza y termina cada subtítulo
dentro de la toma y el tiempo de cada palabra del guion. tiempos.py la aplica a la línea de
tiempo: cada toma se coloca donde empezaba su primer subtítulo planeado y los subtítulos y
las palabras toman los tiempos reales (las animaciones ancladas con ctx.cue y ctx.palabra se
mueven con ellos).

El modelo se corre sin prompt inicial a propósito: un prompt con el guion haría que el modelo
«oyera» el texto esperado y escondería los errores de lectura. Los bordes de cada subtítulo
se ajustan a los bordes reales del sonido (silencedetect), que son más precisos que las
marcas de Whisper después de un silencio.

Uso, desde la raíz del repositorio (uv instala las dependencias; la primera vez descarga el
modelo large-v3-turbo, ≈ 1.6 GB):
    uv run scripts/expoing/video/alinear.py            # solo las tomas nuevas o cambiadas
    uv run scripts/expoing/video/alinear.py --forzar   # todas otra vez
Después: tiempos.py, datos_video.py, mezclar.py y renderizar.py.
"""
import argparse
import difflib
import hashlib
import importlib.util
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[3]
VIDEO = RAIZ / "docs" / "expoing" / "video"
VOZ = VIDEO / "voz"
SALIDA = VIDEO / "alineacion.json"
MODELO = "large-v3-turbo"
AJUSTE = 0.35   # s: cuánto puede moverse el borde de un subtítulo para caer en el borde del sonido
UMBRAL = "-42dB"  # el mismo de video_guia.py --revisar


def tiempos():
    """El módulo tiempos.py: su planear() da el guion y los tiempos planeados de cada escena."""
    spec = importlib.util.spec_from_file_location("tiempos", Path(__file__).with_name("tiempos.py"))
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def duracion(err):
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", err)
    assert m, "ffmpeg no informó la duración"
    return 3600 * float(m.group(1)) + 60 * float(m.group(2)) + float(m.group(3))


def huella(ruta):
    return hashlib.sha1(ruta.read_bytes()).hexdigest()


def normalizar(s):
    """Palabras comparables: minúsculas, sin acentos ni signos, y los números con letra."""
    from num2words import num2words
    s = s.lower().replace("%", " por ciento ").replace("$", " ")
    s = re.sub(r"(\d)[,.](\d{3})(?!\d)", r"\1\2", s)         # 108,680 · 10.000
    s = re.sub(r"\d+(\.\d+)?", lambda m: " " + num2words(float(m.group()) if "." in m.group() else int(m.group()),
                                                          lang="es") + " ", s)
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    # Sin género en las centenas: Whisper escribe «658» y no se sabe si dijo «seiscientas» o «seiscientos».
    return [re.sub(r"ientas$", "ientos", f) for f in re.findall(r"[a-zñ]+", s)]


def cargar(wav):
    """Audio a 16 kHz mono en float32 con ffmpeg (el decodificador de faster-whisper usa PyAV,
    y las versiones recientes de PyAV ya no aceptan sus argumentos)."""
    import numpy as np
    crudo = subprocess.run(["ffmpeg", "-v", "error", "-i", str(wav), "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                           capture_output=True, check=True).stdout
    return np.frombuffer(crudo, np.float32)


def sonidos(wav):
    """Tramos con sonido (inicio, fin) según silencedetect."""
    err = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(wav), "-af",
                          f"silencedetect=noise={UMBRAL}:d=0.2", "-f", "null", "-"], capture_output=True, text=True).stderr
    dur = duracion(err)
    ini = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", err)]
    fin = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", err)]
    tramos, t = [], 0.0
    for a, b in zip(ini, fin + [dur] * (len(ini) - len(fin))):
        if a > t:
            tramos.append((t, a))
        t = b
    if t < dur:
        tramos.append((t, dur))
    # Fuera los chasquidos de 0.2 s o menos (el toque que empieza o detiene la grabación).
    return [s for s in tramos if s[1] - s[0] > 0.2], dur


def transcribir(modelo, wav):
    segs, _ = modelo.transcribe(cargar(wav), language="es", beam_size=5, word_timestamps=True,
                                condition_on_previous_text=False, vad_filter=False)
    return [(w.word.strip(), float(w.start), float(w.end), float(w.probability)) for s in segs for w in s.words]


def alinear(cues, palabras_dichas):
    """Tiempo de cada palabra del guion a partir de las palabras transcritas."""
    # Fichas del guion: (subtítulo, índice de palabra, ficha normalizada).
    guion, originales = [], []
    for i, c in enumerate(cues):
        for j, w in enumerate(c["voz"].split()):
            originales.append((i, j, w))
            for f in normalizar(w):
                guion.append((len(originales) - 1, f))
    # Whisper parte las cifras con separador en dos palabras («108» y «,680»; «4» y «.5»): se juntan.
    juntas = []
    for w, a, b, p in palabras_dichas:
        if juntas and re.match(r"^[.,]\d", w) and re.search(r"\d$", juntas[-1][0]):
            w0, a0, _, p0 = juntas[-1]
            juntas[-1] = (w0 + w, a0, b, min(p0, p))
        else:
            juntas.append((w, a, b, p))
    # Fichas transcritas: una palabra con un número se vuelve varias fichas que se reparten su tramo.
    dichas = []
    for w, a, b, p in juntas:
        fs = normalizar(w)
        for k, f in enumerate(fs):
            dichas.append((f, a + (b - a) * k / len(fs), a + (b - a) * (k + 1) / len(fs), p, w))
    A, B = [f for _, f in guion], [f for f, *_ in dichas]
    tiempo: list = [None] * len(guion)
    difs = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(a=A, b=B, autojunk=False).get_opcodes():
        if op == "equal":
            for k in range(i2 - i1):
                tiempo[i1 + k] = dichas[j1 + k][1:3]
        elif op == "replace":
            a, b = dichas[j1][1], dichas[j2 - 1][2]
            for k in range(i2 - i1):   # el tramo dicho, repartido entre las palabras del guion
                tiempo[i1 + k] = (a + (b - a) * k / (i2 - i1), a + (b - a) * (k + 1) / (i2 - i1))
        if op != "equal" and "".join(A[i1:i2]) != "".join(B[j1:j2]):   # «socio formador» no es error
            difs.append({"guion": " ".join(A[i1:i2]), "dijo": " ".join(w for *_, w in dichas[j1:j2]),
                         "en": round(dichas[j1][1], 2) if j1 < len(dichas) else None,
                         "seguridad": round(min(p for _, _, _, p, _ in dichas[j1:j2]), 2) if j2 > j1 else None})
    # Las que faltan (palabras del guion que no se oyeron) se interpolan entre sus vecinas.
    for k in range(len(tiempo)):
        if tiempo[k] is None:
            prev = next((tiempo[q][1] for q in range(k - 1, -1, -1) if tiempo[q]), 0.0)
            sig = next((tiempo[q][0] for q in range(k + 1, len(tiempo)) if tiempo[q]), prev)
            tiempo[k] = (prev, max(prev, sig))
    # Tiempo de cada palabra original: de su primera a su última ficha.
    por_palabra = {}
    for (o, _), (a, b) in zip(guion, tiempo):
        x = por_palabra.setdefault(o, [a, b])
        x[0], x[1] = min(x[0], a), max(x[1], b)
    salida = [{"palabras": []} for _ in cues]
    for o, (i, j, w) in enumerate(originales):
        a, b = por_palabra.get(o, por_palabra.get(o - 1, (0.0, 0.0)))
        salida[i]["palabras"].append({"p": w, "a": round(a, 3), "b": round(b, 3)})
    coinciden = sum(i2 - i1 for op, i1, i2, *_ in difflib.SequenceMatcher(a=A, b=B, autojunk=False).get_opcodes()
                    if op == "equal")
    return salida, difs, coinciden / max(1, len(A))


def ajustar_inicio(aw, bw, tramos):
    """Inicio real de una frase cuya primera palabra Whisper marca en [aw, bw]. Whisper suele
    adelantar esa marca hacia el silencio previo: si la palabra cruza un silencio, la frase
    empieza donde vuelve el sonido; si la marca cae en silencio, en el siguiente sonido."""
    for s, e in tramos:
        if s - 0.05 <= aw <= e:
            nuevos = [s2 for s2, _ in tramos if aw < s2 < bw]
            if nuevos:
                return nuevos[0]
            return s if aw - s <= AJUSTE else aw
    sig = [s for s, _ in tramos if s >= aw]
    return sig[0] if sig and sig[0] - aw <= 1.5 else aw


def ajustar_fin(aw, bw, tramos):
    """Fin real de una frase cuya última palabra Whisper marca en [aw, bw] (lo simétrico)."""
    for s, e in tramos:
        if s <= bw <= e + 0.05:
            cortes = [e2 for _, e2 in tramos if aw < e2 < bw - 0.05]
            if cortes:
                return cortes[0]
            return e if e - bw <= AJUSTE else bw
    prev = [e for _, e in tramos if e <= bw]
    return prev[-1] if prev and bw - prev[-1] <= 1.5 else bw


def ajustar_bordes(salida, tramos):
    """Los bordes de cada subtítulo, en los bordes reales del sonido (más precisos que Whisper)."""
    for c in salida:
        w0, w1 = c["palabras"][0], c["palabras"][-1]
        a = ajustar_inicio(w0["a"], w0["b"], tramos)
        b = ajustar_fin(w1["a"], w1["b"], tramos)
        c["a"], c["b"] = round(a, 3), round(max(b, a + 0.2), 3)
    # Sin traslapes entre subtítulos seguidos.
    for c, d in zip(salida, salida[1:]):
        if d["a"] < c["b"]:
            m = round((c["b"] + d["a"]) / 2, 3)
            c["b"], d["a"] = m, m
    # Las palabras, dentro de su subtítulo.
    for c in salida:
        for w in c["palabras"]:
            w["a"] = round(min(max(w["a"], c["a"]), c["b"]), 3)
            w["b"] = round(min(max(w["b"], w["a"]), c["b"]), 3)
    return salida


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--forzar", action="store_true", help="vuelve a transcribir aunque la toma no haya cambiado")
    a = ap.parse_args()
    escenas = tiempos().planear()
    previa = json.loads(SALIDA.read_text(encoding="utf-8")) if SALIDA.exists() else {"escenas": {}}
    resultado, modelo, faltan = {"modelo": MODELO, "escenas": {}}, None, []
    print(f"Alineación de las tomas de {VOZ.relative_to(RAIZ)}/ con el guion:")
    for e in escenas:
        nombre = "E%02d" % int(e["id"][1:])
        wav = VOZ / f"{nombre}.wav"
        if not wav.exists():
            faltan.append(nombre)
            continue
        h = huella(wav)
        vieja = previa["escenas"].get(e["id"])
        guion = [c["voz"] for c in e["cues"]]
        if vieja and vieja["sha1"] == h and vieja.get("guion") == guion and not a.forzar:
            resultado["escenas"][e["id"]] = vieja
            r = vieja
        else:
            if modelo is None:
                from faster_whisper import WhisperModel
                modelo = WhisperModel(MODELO, device="cpu", compute_type="int8")
            tramos, dur = sonidos(wav)
            cues, difs, parecido = alinear(e["cues"], transcribir(modelo, wav))
            cues = ajustar_bordes(cues, tramos)
            r = {"archivo": str(wav.relative_to(RAIZ)), "sha1": h, "duracion": round(dur, 3), "guion": guion,
                 "parecido": round(parecido, 3), "diferencias": difs,
                 "habla": [round(tramos[0][0], 3), round(tramos[-1][1], 3)] if tramos else [0.0, dur],
                 "cues": cues}
            resultado["escenas"][e["id"]] = r
        plan = e["cues"][-1]["fin"] - e["cues"][0]["inicio"]
        real = r["cues"][-1]["b"] - r["cues"][0]["a"]
        print(f"  {nombre}  habla {real:5.1f} s / {plan:5.1f} s ({real / plan - 1:+.1%})  "
              f"palabras iguales {r['parecido']:.0%}" + "".join(
                  f"\n        · «{d['guion']}» → «{d['dijo']}»" + (f" en {d['en']:.1f} s" if d['en'] is not None else "")
                  for d in r["diferencias"]))
    if faltan:
        print(f"  Faltan: {', '.join(faltan)} (esas escenas conservan los tiempos planeados y van sin voz)")
    SALIDA.write_text(json.dumps(resultado, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{SALIDA.relative_to(RAIZ)}: {len(resultado['escenas'])} tomas alineadas.\n"
          "Sigue: python3 scripts/expoing/video/tiempos.py && python3 scripts/expoing/video/datos_video.py")


if __name__ == "__main__":
    sys.exit(main())
