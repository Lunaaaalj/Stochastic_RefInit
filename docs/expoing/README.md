# Perfil de Expo Ingenierías

Piezas para completar el perfil de *Stochastic Reforestation Initiative* en la Muestra Virtual.

| Espacio de la plataforma | Archivo | Formato |
|---|---|---|
| Imagen 1 (animada) | `imagen-1-mosaico.gif` | GIF, 1280 × 720, 8 s en bucle, 1.4 MB |
| Imagen 2 | `imagen-2-mapa.png` | PNG, 1920 × 1080 |
| Imagen 3 | `imagen-3-compra.png` | PNG, 1920 × 1080 |
| Imagen de fondo | `fondo-curvas-de-nivel.png` | PNG, 1920 × 1080 |
| Logo (opcional) | `logo-brote-hexagono.png` | PNG con fondo transparente, 1280 × 480 |
| Logo, solo la marca | `logo-marca.png` | PNG con fondo transparente, 512 × 512 |

Reglas de la plataforma: las imágenes muestran el proyecto, nunca al equipo; no se aceptan videos ni PDF.

Todas las cifras salen de `docs/presentacion/datos/datos.js`. Las piezas son:

- **Imagen 1:** el mosaico de la clave 1 pasa de una siembra al azar (90.9 de competencia entre vecinas) al arreglo optimizado (78.2), 16 % menos que el promedio al azar (93.3).
- **Imagen 2:** los 30 polígonos por superficie (183 ha), con escala de 500 m.
- **Imagen 3:** *Agave salmiana* en el polígono 1, donde comprar 220 plantas cubre el 96 % de 10,000 temporadas simuladas, y el presupuesto mínimo de $14,496 por hectárea frente a los $12,500 disponibles.
- **Imagen de fondo:** el sitio sobre curvas de nivel, cada polígono con el tono de su clave de
  plantación, y una lupa sobre el borde del polígono 12 con cada planta y su especie. La
  plataforma la muestra como banner: recorta al centro una franja de ~2.7:1 (y de 182 a 898) y
  pone el logo abajo a la izquierda, así que el sitio y la lupa caben en esa franja.

## Regenerar

Desde la raíz del repositorio, con Google Chrome y ffmpeg instalados:

```bash
python scripts/exportar_expoing.py                # todo
python scripts/exportar_expoing.py --solo gif     # gif | imagenes | fondo | logo
```

El dibujo está en `scripts/expoing/piezas.js`, que incluye las demás versiones que se descartaron
(otras imágenes, fondos y logos). Para exportar otra, cambia los identificadores en
`scripts/exportar_expoing.py`. La paleta, las utilidades, las curvas de nivel y la marca del logo
están en `scripts/expoing/comun.js`, que comparten las piezas y el video. El fondo usa además la
carta del video (`scripts/expoing/video/carta.js`), con los mismos tonos por clave que la escena E9.

## Video

El plan completo está en [`video/PLAN.md`](video/PLAN.md) y los créditos en
[`video/CREDITOS.md`](video/CREDITOS.md). El código vive en `scripts/expoing/video/`:

| Archivo | Qué hace |
|---|---|
| `tiempos.py` | Fuente de verdad del guion: escribe `video/linea_de_tiempo.json` y `video/guion.srt` |
| `datos_video.py` | Junta la línea de tiempo, la música, la clave vigente, la hectárea de 14 × 47, la frontera exacta, la salida de la terminal y la grabación de la GUI en `datos_video.js` |
| `previsualizar.html` | Escenario del video; abierto en el navegador es la previsualización |
| `motor.js`, `carta.js` | Línea de tiempo, anclas a la voz, subtítulos, fórmulas, tarjetas de capítulo, y el mapa con cámara y siembra |
| `escenas/eNN_*.js` | Una escena cada uno (E1 a E11) |
| `vendor/katex/` | KaTeX 0.16.11 fijado, con sus fuentes (sin CDN) |
| `renderizar.py` | Render cuadro a cuadro con Chromium y exportación con ffmpeg |
| `guia.js`, `video_guia.py` | Video guía por escena para grabar la voz (teleprompter y cuenta regresiva), instrucciones en `video/GRABACION.md` y revisión de las tomas |
| `alinear.py` | Transcribe las tomas de `video/voz/` (faster-whisper) y las alinea con el guion: dónde empieza cada subtítulo y cada palabra, y en qué se apartó la lectura; escribe `video/alineacion.json`, que aplica `tiempos.py` |
| `mezclar.py` | Mezcla final: la voz procesada en sus tiempos reales, la música editada que baja bajo la voz y los cuatro efectos; escribe `video/salida/mezcla.wav` (−16 LUFS), que usa `renderizar.py` |
| `capturar_gui.py`, `captura/captura_gui.cpp` | Grabación real de `refor_gui` para E10: compila el `gui/main.cpp` real con la entrada desviada a un guion de clics y la salida a ffmpeg (sin permiso de grabación de pantalla), edita el clip con el cálculo acelerado y marcado, y lo deja como un JPEG por cuadro en `video/salida/gui/cuadros/` |

Desde la raíz del repositorio:

```bash
python3 scripts/expoing/video/tiempos.py           # si cambió el guion (o la alineación)
# Salidas de refor que lee datos_video.py (en docs/res/, que git ignora):
./build/refor plan --alpha 0.05 -B 12500 -f json
./build/refor frontera --alphas 0.01,0.02,0.05,0.10,0.20,0.30,0.50 --metodo exacto -f csv -o docs/res/frontera_exacta.csv
./build/refor frontera -f tabla -o - > docs/res/terminal_frontera.txt 2>&1
python3 scripts/expoing/video/capturar_gui.py      # grabación de refor_gui para E10 (requiere cmake --build build)
python3 scripts/expoing/video/datos_video.py
open scripts/expoing/video/previsualizar.html      # previsualizar (espacio reproduce; 1–9, 0 saltan de escena)
uv run scripts/expoing/video/renderizar.py --borrador --salida docs/expoing/video/salida/animatic.mp4
uv run scripts/expoing/video/renderizar.py --borrador --voz-provisional --salida docs/expoing/video/salida/animatic.mp4
uv run scripts/expoing/video/renderizar.py --desde E5 --hasta E6 --borrador   # un tramo
uv run scripts/expoing/video/renderizar.py --cuadros 5,17.6,42                # fotogramas sueltos
uv run scripts/expoing/video/renderizar.py --determinismo 20                  # QA de determinismo
uv run scripts/expoing/video/renderizar.py --franja 0.05                      # QA de la franja de subtítulos
uv run scripts/expoing/video/renderizar.py --saltos                           # QA de cortes bruscos entre escenas
uv run scripts/expoing/video/video_guia.py                                    # las 11 guías y GRABACION.md
uv run scripts/expoing/video/video_guia.py --revisar                          # revisa las tomas de video/voz/
# Con las tomas en video/voz/ (EXX.wav; de notas de voz: ffmpeg -i EXX.m4a -c:a pcm_s24le EXX.wav):
uv run scripts/expoing/video/alinear.py                                       # tiempos reales de la voz
python3 scripts/expoing/video/tiempos.py && python3 scripts/expoing/video/datos_video.py
uv run scripts/expoing/video/mezclar.py                                       # mezcla final (--pistas: voz y música aparte)
uv run scripts/expoing/video/renderizar.py                                    # el video con la mezcla, más su .srt
python3 scripts/expoing/video/capturar_gui.py --editar   # solo vuelve a editar la grabación cruda
```

`--voz-provisional` exporta además una copia con voz sintética para revisar el ritmo; es solo para
el equipo y nunca va en el video final. Los MP4 y los fotogramas quedan en `video/salida/`, y las
tomas de voz en `video/voz/`; git ignora ambos.
