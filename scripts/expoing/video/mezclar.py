#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy"]
# ///
"""Mezcla final del video de Expo Ingenierías: voz, música y efectos (PLAN §4, §8.6).

Lee la línea de tiempo con los tiempos reales de la voz (alinear.py → tiempos.py) y escribe:

    docs/expoing/video/salida/mezcla.wav    48 kHz, estéreo, 24 bits; −16 LUFS, pico ≤ −1 dBTP
    docs/expoing/video/salida/mezcla.json   de qué línea de tiempo sale, qué tomas lleva y sus medidas

renderizar.py usa esta mezcla en lugar de la música provisional (y se niega a usarla si la línea
de tiempo cambió después de mezclar).

- Voz (§4.1): cada toma pasa por un pasa altos de 100 Hz y reducción de ruido (afftdn, con la
  huella del silencio antes de hablar), se recorta a su tramo con habla, pasa por un expansor
  suave para las pausas, un compresor de 3:1 y un de-esser, y se lleva a −16 LUFS.
  Se coloca donde dice la línea de tiempo (y se acelera con atempo si tiempos.py lo pidió).
- Música (§4.2): la grabación de Latso en su orden, como en el animatic (el clímax llega con la
  tarjeta de la pregunta 2), con un solo salto en la coda para terminar con el último acorde de la
  pieza (MAPA_MUSICA; fundido cruzado de igual potencia entre dos valles de la sonoridad). Su
  nivel sigue a la voz: bajo la voz queda unos 24 dB por debajo y, en los silencios de más de
  HUECO s (inicio, tarjetas, cambios de escena, cierre), sube a unos −18 LUFS de corto plazo. En vez de un compresor de cadena lateral, la ganancia se calcula con
  los tiempos conocidos de cada frase: así la música no «respira» entre palabras ni entre frases.
  En las tarjetas de capítulo sube 4 dB durante 2 s, y al final se desvanece en 3 s.
- Efectos (§4.3): cuatro, sintetizados aquí (sin archivos de terceros), a −28 dBFS o menos y
  anclados igual que la animación (una palabra de un subtítulo, el inicio de una escena).

Uso, desde la raíz del repositorio:
    uv run scripts/expoing/video/mezclar.py
    uv run scripts/expoing/video/mezclar.py --pistas     # además, la voz y la música por separado
"""
import argparse
import hashlib
import importlib.util
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

RAIZ = Path(__file__).resolve().parents[3]
VIDEO = RAIZ / "docs" / "expoing" / "video"
LINEA = VIDEO / "linea_de_tiempo.json"
SALIDA = VIDEO / "salida"
SR = 48000
CR = 100          # muestras por segundo de las curvas de ganancia

VOZ_LUFS = -16.0
LIBRE_LUFS = -16.5                       # música sola, de corto plazo
BAJO_VOZ = {}                            # por escena: música bajo la voz, en dB respecto de la voz (si no, −24)
BAJO_VOZ_DEF = -24.0
REF = -35.0       # sonoridad típica de los pasajes tranquilos de la grabación (LUFS de corto plazo)
DINAMICA = 0.35   # parte de la dinámica propia de la música que se conserva (0 = nivelada del todo)
TOPE_LIBRE = -15.0
ATAQUE, LIBERACION = 0.3, 1.0   # s: la música baja antes de la voz y sube después de ella
HUECO = 2.5       # s: silencios más cortos (entre frases) no hacen subir la música
TARJETAS = ("E5", "E8")
FUNDIDO_FINAL = 3.0
CRUCE = 2.0       # s: fundido cruzado entre tramos de la música

# Mapa de edición de la música (PLAN §4.2). Cada tramo: desde qué instante del video (escena +
# segundos) suena qué segundo de la pieza. Perfil de sonoridad de la grabación (ffmpeg ebur128):
#   apertura tranquila 0:04–1:17 · crescendo 1:20–1:50 · pasaje tranquilo 2:02–2:34 ·
#   crescendo 2:35–2:47 · clímax 3:00–3:12, que se resuelve hasta 3:26 · coda 3:26–5:26
#   (el último acorde ataca en 5:19.1 y se apaga en 5:26) · aplausos desde 5:27.
# El equipo prefirió el orden de la pieza, como en el animatic (el clímax, con la tarjeta de la
# pregunta 2, ≈ 3:06 del video). Para terminar con el último acorde se saltan 40.9 s de la coda:
# se sale en 4:08.8 y se entra en 4:49.7, dos valles con la misma sonoridad (−43.5 dB) y un croma
# parecido (similitud 0.86), así que el acorde suena 0.85 s después de la última frase y el video
# acaba en 5:23.8 de la grabación, antes de los aplausos. Con la versión con pausas (tiempos.py),
# el tamaño del salto lo fija dónde cae la última frase; solo se elige el instante.
MAPA_MUSICA = [
    ("E1", 0.0, None),      # de corrido desde MUSICA["desde"] (la primera nota suena a 1 s)
    ("E10", 4.35, 289.69),  # el salto en la coda (≈ 4:05.6 del video, bajo la voz)
]
FIN_PIEZA = 326.6           # s: después empiezan los aplausos; ningún tramo debe llegar ahí


def modulo(nombre):
    spec = importlib.util.spec_from_file_location(nombre, Path(__file__).with_name(f"{nombre}.py"))
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def ffmpeg(*args, entrada=None):
    return subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-loglevel", "error", *args],
                          input=entrada, capture_output=True, check=True).stdout


def leer(ruta, canales, filtros=None):
    """Audio a SR en float32 (muestras × canales)."""
    af = ["-af", filtros] if filtros else []
    crudo = ffmpeg("-i", str(ruta), *af, "-ac", str(canales), "-ar", str(SR), "-f", "f32le", "-")
    return np.frombuffer(crudo, np.float32).reshape(-1, canales).copy()


def escribir(ruta, x, filtros=None):
    af = ["-af", filtros] if filtros else []
    ffmpeg("-f", "f32le", "-ar", str(SR), "-ac", str(x.shape[1]), "-i", "-", *af, "-c:a", "pcm_s24le", str(ruta),
           "-y", entrada=np.ascontiguousarray(x, np.float32).tobytes())


def sonoridad(x):
    """(integrada en LUFS, pico real en dBTP) con ebur128."""
    err = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-f", "f32le", "-ar", str(SR), "-ac", str(x.shape[1]),
                          "-i", "-", "-af", "ebur128=peak=true", "-f", "null", "-"],
                         input=np.ascontiguousarray(x, np.float32).tobytes(), capture_output=True).stderr.decode()
    resumen = err[err.rfind("Summary:"):]
    i = re.search(r"I:\s+(-?[\d.]+|-inf) LUFS", resumen)
    tp = re.search(r"Peak:\s+(-?[\d.]+|-inf) dBFS", resumen)
    return (float(i.group(1)) if i and i.group(1) != "-inf" else -70.0,
            float(tp.group(1)) if tp and tp.group(1) != "-inf" else -70.0)


def corto_plazo(x):
    """Sonoridad de corto plazo (ventana de 3 s) muestreada a CR por segundo."""
    with tempfile.TemporaryDirectory() as d:
        f = Path(d) / "s.txt"
        subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-f", "f32le", "-ar", str(SR), "-ac", str(x.shape[1]),
                        "-i", "-", "-af", f"ebur128=metadata=1,ametadata=print:key=lavfi.r128.S:file={f}",
                        "-f", "null", "-"], input=np.ascontiguousarray(x, np.float32).tobytes(), capture_output=True)
        t, ts, vs = None, [], []
        for linea in f.read_text().splitlines():
            m = re.search(r"pts_time:([\d.]+)", linea)
            if m:
                t = float(m.group(1))
                continue
            m = re.search(r"lavfi\.r128\.S=(-?[\d.]+|-inf|nan)", linea)
            if m and t is not None:
                ts.append(t)
                vs.append(float(m.group(1)) if m.group(1) not in ("-inf", "nan") else -70.0)
    n = int(len(x) / SR * CR) + 1
    # La ventana de 3 s está centrada 1.5 s antes de cada marca: se adelanta para alinearla.
    return np.interp(np.arange(n) / CR, np.array(ts) - 1.5, np.maximum(vs, -70.0))


def rampa_curva(n, tramos):
    """Curva 0–1 a CR por segundo: 1 dentro de cada tramo, con rampas de ATAQUE y LIBERACION."""
    t = np.arange(n) / CR
    c = np.zeros(n)
    for a, b in tramos:
        sube = np.clip((t - (a - ATAQUE)) / ATAQUE, 0, 1)
        baja = np.clip(1 - (t - b) / LIBERACION, 0, 1)
        c = np.maximum(c, np.minimum(sube, baja))
    return c


def suavizar(c, segundos):
    k = max(1, int(segundos * CR))
    return np.convolve(np.pad(c, (k, k), mode="edge"), np.ones(2 * k + 1) / (2 * k + 1), mode="same")[k:-k]


def maximo_movil(c, segundos):
    k = max(1, int(segundos * CR))
    p = np.pad(c, (k, k), mode="edge")
    return np.max(np.lib.stride_tricks.sliding_window_view(p, 2 * k + 1), axis=1)


def db(x):
    return 10 ** (np.asarray(x) / 20)


# ---------- Voz ----------

def voz(escenas, total, tmp):
    """Pista de voz (mono) y los tramos con voz de cada escena."""
    pista = np.zeros(int(total * SR) + SR, np.float32)
    usadas, faltan = [], []
    for e in escenas:
        v = e.get("voz")
        if not v:
            faltan.append(e["id"])
            continue
        archivo = RAIZ / v["archivo"]
        if hashlib.sha1(archivo.read_bytes()).hexdigest() != v["sha1"]:
            sys.exit(f"{v['archivo']} cambió después de alinear: corre alinear.py y tiempos.py otra vez.")
        a, b = v["habla"][0] - 0.25, v["habla"][1] + 0.4
        recorte = f"atrim=start={max(0.0, a):.3f}:end={b:.3f},asetpts=PTS-STARTPTS"
        cruda = leer(archivo, 1, recorte)
        i0, _ = sonoridad(cruda)
        previa = -20.0 - i0     # al compresor le llega la voz a unos −20 LUFS
        tempo = f",atempo={v['tempo']:.4f}" if v["tempo"] != 1 else ""
        # Reducción de ruido con la huella del cuarto: afftdn la toma del silencio antes de hablar
        # (desde 0.4 s, después del clic de grabar, hasta 0.3 s antes de la voz). El ruido de estas
        # tomas es un zumbido grave (40–500 Hz) que se encima con la voz: sin reducción queda solo
        # 22 dB abajo. Con la huella (18 dB, lo más suave que basta) y el expansor de las pausas
        # queda unos 45 dB abajo. Va antes del recorte porque necesita ese silencio; si no lo hay,
        # afftdn sigue el ruido solo (tn=1).
        s1 = v["habla"][0] - 0.3
        huella = (f"asendcmd=c='0.4 afftdn sn start; {s1:.2f} afftdn sn stop',afftdn=nr=18:nf=-66"
                  if s1 - 0.4 >= 1.0 else "afftdn=nr=24:nf=-64:tn=1")
        cadena = (f"highpass=f=100:poles=2,{huella},{recorte},volume={previa:.2f}dB,"
                  "agate=threshold=0.01:ratio=2:range=0.1:attack=8:release=250:knee=2,"
                  f"acompressor=threshold=-24dB:ratio=3:attack=8:release=150:knee=4,deesser=i=0.35{tempo},"
                  "afade=t=in:d=0.08,areverse,afade=t=in:d=0.12,areverse")
        x = leer(archivo, 1, cadena)[:, 0]
        i1, _ = sonoridad(x[:, None])
        x = x * db(VOZ_LUFS - i1)
        k = int(round((v["desplazamiento"] + max(0.0, a) / v["tempo"]) * SR))
        fin = min(len(pista), k + len(x))
        pista[max(0, k):fin] += x[max(0, -k):fin - k]
        usadas.append({"escena": e["id"], "archivo": v["archivo"], "lufs_toma": round(i0, 1), "tempo": v["tempo"]})
    return pista[:int(round(total * SR))], usadas, faltan


# ---------- Música ----------

def editar_musica(escenas, total, musica):
    pieza = leer(RAIZ / musica["archivo"], 2)
    inicio = {e["id"]: e["inicio"] for e in escenas}
    cortes = [(inicio[s] + d, musica["desde"] if p is None else p) for s, d, p in MAPA_MUSICA]
    n = int(round(total * SR))
    t = np.arange(n) / SR
    pista = np.zeros((n, 2), np.float32)
    for k, (v0, p0) in enumerate(cortes):
        v1 = cortes[k + 1][0] if k + 1 < len(cortes) else total
        a = 0.0 if k == 0 else v0 - CRUCE / 2
        b = total if k + 1 == len(cortes) else v1 + CRUCE / 2
        i, j = int(round(a * SR)), int(round(b * SR))
        fuente = np.round((p0 + t[i:j] - v0) * SR).astype(np.int64)
        if fuente.min() < 0 or fuente.max() >= min(len(pieza), FIN_PIEZA * SR):
            sys.exit(f"El tramo {k + 1} de MAPA_MUSICA se sale de la grabación o llega a los aplausos.")
        g = np.ones(j - i)
        if k == 0:
            g *= np.clip(t[i:j] / 0.4, 0, 1)
        else:   # entrada de igual potencia
            g *= np.sin(np.pi / 2 * np.clip((t[i:j] - (v0 - CRUCE / 2)) / CRUCE, 0, 1))
        if k + 1 < len(cortes):
            g *= np.cos(np.pi / 2 * np.clip((t[i:j] - (v1 - CRUCE / 2)) / CRUCE, 0, 1))
        pista[i:j] += pieza[fuente] * g[:, None].astype(np.float32)
    return pista, [{"video": round(v, 2), "pieza": round(p, 2)} for v, p in cortes]


def ganancia_musica(escenas, musica_cruda, total):
    """Ganancia de la música (lineal, por muestra) según la voz y la propia música."""
    n = int(total * CR) + 1
    t = np.arange(n) / CR
    # Tramos con voz (también los de las escenas sin toma: así la mezcla ya suena como sonará),
    # unidos cuando el silencio entre ellos dura menos de HUECO.
    tramos = []
    for e in escenas:
        for c in e["cues"]:
            if tramos and c["inicio"] - tramos[-1][1] < HUECO:
                tramos[-1][1] = c["fin"]
            else:
                tramos.append([c["inicio"], c["fin"]])
    con_voz = rampa_curva(n, tramos)
    # Bajo la voz, el nivel objetivo depende de la escena (E10–E11 más arriba).
    bajo = np.full(n, VOZ_LUFS + BAJO_VOZ_DEF)
    for e in escenas:
        if e["id"] in BAJO_VOZ:
            bajo[(t >= e["inicio"]) & (t < e["fin"])] = VOZ_LUFS + BAJO_VOZ[e["id"]]
    bajo = suavizar(bajo, 1.5)
    objetivo = LIBRE_LUFS + (bajo - LIBRE_LUFS) * con_voz
    # Tarjetas de capítulo: +4 dB durante 2 s.
    for e in escenas:
        if e["id"] in TARJETAS:
            a = e["inicio"]
            objetivo += 4.0 * np.clip(np.minimum((t - a) / 0.3, 1 - (t - a - 2.0) / 0.6), 0, 1)
    # La música conserva una parte de su dinámica (el clímax sigue subiendo) y nunca pasa de TOPE_LIBRE.
    L = maximo_movil(corto_plazo(musica_cruda)[:n], 1.0)
    L = suavizar(np.maximum(L, REF - 15), 0.8)
    nivel = objetivo + DINAMICA * (L - REF)
    nivel = np.minimum(nivel, TOPE_LIBRE)
    g_db = suavizar(nivel - L, 0.15)
    g = db(g_db)
    # Desvanecimiento final.
    g *= np.clip((total - t) / FUNDIDO_FINAL, 0, 1) ** 1.5
    return np.interp(np.arange(int(round(total * SR))) / SR, t, g).astype(np.float32), con_voz


# ---------- Efectos ----------

def efecto(tipo):
    """Efectos sintetizados, deterministas (RandomState con semilla fija), con pico en 1."""
    rs = np.random.RandomState({"toc": 1, "papel": 2, "madera": 3}[tipo])
    if tipo == "toc":       # semilla que cae en tierra: un golpe grave que baja de tono
        n = int(0.35 * SR); t = np.arange(n) / SR
        f = 150 * np.exp(-t / 0.08) + 70
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.05)
        x += 0.15 * rs.randn(n) * np.exp(-t / 0.004)
    elif tipo == "papel":   # roce de papel: ruido en banda (1.5–6 kHz) que crece y se apaga
        n = int(0.6 * SR); t = np.arange(n) / SR
        r = np.fft.rfft(rs.randn(n)); fr = np.fft.rfftfreq(n, 1 / SR)
        r *= ((fr > 1500) & (fr < 6000)) * (1 + 0.5 * np.sin(fr / 300))
        x = np.fft.irfft(r, n) * np.clip(t / 0.15, 0, 1) * np.exp(-np.clip(t - 0.15, 0, None) / 0.12)
    else:                   # clic de madera: dos resonancias muy cortas
        n = int(0.15 * SR); t = np.arange(n) / SR
        x = (np.sin(2 * np.pi * 1150 * t) + 0.5 * np.sin(2 * np.pi * 2380 * t)) * np.exp(-t / 0.012)
        x += 0.2 * rs.randn(n) * np.exp(-t / 0.002)
    return (x / np.max(np.abs(x))).astype(np.float32)


def momento_palabra(cue, palabra):
    """Igual que momentoPalabra de motor.js: la marca real o, sin ella, la proporción de caracteres."""
    norm = lambda s: re.sub(r"[^\w]", "", s.lower())
    for w in cue.get("palabras", []):
        if norm(w["p"]) == norm(palabra):
            return w["t"]
    k = cue["voz"].lower().index(palabra.lower())
    return cue["inicio"] + (cue["fin"] - cue["inicio"]) * k / len(cue["voz"])


def efectos(escenas, total):
    e = {x["id"]: x for x in escenas}
    # (instante, tipo, nivel en dBFS); los mismos anclajes que la animación:
    lista = [
        (momento_palabra(e["E1"]["cues"][3], "cada"), "toc", -28.0),     # E1: brota la planta (e01_gancho.js)
        (e["E5"]["inicio"], "papel", -30.0),                              # tarjeta «Pregunta 1»
        (e["E8"]["inicio"], "papel", -30.0),                              # tarjeta «Pregunta 2»
        (e["E9"]["cues"][2]["inicio"] + 0.3 + 2.5, "madera", -30.0),      # E9: el mosaico se asienta (tE + ESTRELLA)
    ]
    pista = np.zeros(int(round(total * SR)), np.float32)
    for t0, tipo, nivel in lista:
        x = efecto(tipo) * db(nivel)
        k = int(round(t0 * SR))
        pista[k:k + len(x)] += x[:len(pista) - k]
    return pista, [{"t": round(t0, 2), "tipo": tipo, "dbfs": nivel} for t0, tipo, nivel in lista]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pistas", action="store_true", help="escribe también la voz y la música por separado")
    a = ap.parse_args()
    linea_bytes = LINEA.read_bytes()
    escenas = json.loads(linea_bytes)["escenas"]
    total = escenas[-1]["fin"]
    musica = modulo("datos_video").MUSICA
    SALIDA.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        print("Voz…")
        pv, usadas, faltan = voz(escenas, total, Path(tmp))
        print("Música…")
        musica_cruda, cortes = editar_musica(escenas, total, musica)
        g, con_voz = ganancia_musica(escenas, musica_cruda, total)
        pm = musica_cruda * g[:, None]
        print("Efectos…")
        pe, lista_efectos = efectos(escenas, total)
        mezcla = pm + (pv + pe)[:, None]
        # Nivel final: −16 LUFS integrados y un limitador para que el pico real no pase de −1 dBTP.
        i, _ = sonoridad(mezcla)
        mezcla *= db(VOZ_LUFS - i)
        ruta = SALIDA / "mezcla.wav"
        escribir(ruta, mezcla, "alimiter=limit=0.8:attack=2:release=60:level=false:asc=1")
        final = leer(ruta, 2)
        i_f, tp_f = sonoridad(final)
        # Medidas: la música bajo la voz y sola, de corto plazo.
        lm = corto_plazo(pm)
        n = min(len(lm), len(con_voz))
        bajo, libre = lm[:n][con_voz[:n] > 0.99], lm[:n][(con_voz[:n] < 0.01) & (lm[:n] > -60)]
        medidas = {"lufs": round(i_f, 2), "pico_real_dbtp": round(tp_f, 2),
                   "musica_bajo_voz_lufs_mediana": round(float(np.median(bajo)), 1) if len(bajo) else None,
                   "musica_sola_lufs_mediana": round(float(np.median(libre)), 1) if len(libre) else None,
                   "musica_sola_lufs_max": round(float(np.max(libre)), 1) if len(libre) else None}
        if a.pistas:
            escribir(SALIDA / "mezcla_voz.wav", np.repeat(pv[:, None], 2, axis=1))
            escribir(SALIDA / "mezcla_musica.wav", pm)
    info = {"linea_sha1": hashlib.sha1(linea_bytes).hexdigest(), "duracion": total, "voz": usadas,
            "sin_voz": faltan, "musica": {"archivo": musica["archivo"], "cortes": cortes},
            "efectos": lista_efectos, "medidas": medidas}
    (SALIDA / "mezcla.json").write_text(json.dumps(info, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{ruta.relative_to(RAIZ)}: {total:.2f} s · {medidas['lufs']} LUFS · pico real {medidas['pico_real_dbtp']} dBTP")
    print(f"  música bajo la voz ≈ {medidas['musica_bajo_voz_lufs_mediana']} LUFS (mediana), sola ≈ "
          f"{medidas['musica_sola_lufs_mediana']} LUFS (máx. {medidas['musica_sola_lufs_max']})")
    print("  cortes de la música: " + ", ".join(f"{c['video']:.1f} s ← {c['pieza']:.1f} s de la pieza" for c in cortes))
    if faltan:
        print(f"  AVISO: sin voz en {', '.join(faltan)} (falta la toma; la música queda abajo como si la hubiera)")


if __name__ == "__main__":
    main()
