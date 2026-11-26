# Créditos y licencias del video

## Música

| Campo | Valor |
|---|---|
| Obra | Claude Debussy, *Reflets dans l'eau*, de *Images* (libro 1), 1905. Dominio público |
| Interpretación | Giorgi Latso, piano |
| Grabación | Asuas (usuario de Wikimedia Commons), 13 de mayo de 2017 |
| Página | <https://commons.wikimedia.org/wiki/File:Debussy_,_Reflets_dans_l%27eau.ogg> |
| Archivo original | <https://upload.wikimedia.org/wikipedia/commons/e/e5/Debussy_%2C_Reflets_dans_l%27eau.ogg> |
| Formato | Ogg Vorbis, 44.1 kHz, estéreo, 5:32.9, 8,080,687 bytes |
| SHA-1 | `2baa4d7f76dc496745d17c57e0b12ec875088c51` |
| Licencia en Commons | CC BY-SA 4.0, con permiso del titular registrado (ticket VRT 2017080610003191) |
| Licencia en IMSLP (según PLAN §4.2) | CC BY-NC-SA 4.0 |
| Licencia que se cumple | **CC BY-NC-SA 4.0**, la más restrictiva de las dos |
| Fecha de consulta | 22 de noviembre de 2026 (API de Commons: `extmetadata` y texto de la página) |

Antes del render final hay que volver a abrir la página de Commons y confirmar que la licencia
sigue igual (PLAN §4.2).

**Atribución** (tarjeta final y descripción del video):

> Música: Claude Debussy, *Reflets dans l'eau* (1905). Interpretación de Giorgi Latso; grabación de
> Asuas (2017). CC BY-NC-SA 4.0, vía Wikimedia Commons. Editada (recortes, fundidos y mezcla).
>
> Este video: CC BY-NC-SA 4.0.

**Modificaciones.** La grabación abre con aplausos (se apagan hacia 2.7 s) y la primera nota
suena en 4.16 s, así que el video la toma desde 3.15 s: el primer segundo queda en silencio y el
piano entra en 1.0 s, como pide el guion de E1. El animatic (fase 2) usa la grabación de corrido
desde ese punto, con un fundido de entrada de 0.4 s, uno de salida de 2.5 s y normalización a
−24 LUFS (`datos_video.py` → `MUSICA`).

La mezcla final (`mezclar.py`, fase 5) conserva el orden de la pieza, como en el animatic: suena
de corrido desde 3.15 s, así que el clímax (3:00–3:12 de la grabación) llega hacia 2:57–3:09 del
video, al terminar E7, y se resuelve con la tarjeta de la pregunta 2. Para terminar con el último
acorde de la pieza, hay un solo salto en la coda, con un fundido cruzado de igual potencia de 2 s
entre dos valles de su sonoridad que además tienen notas parecidas:

| Video | Grabación | Qué suena |
|---|---|---|
| 0:00 – 4:05.6 | 0:03.2 – 4:08.8 | La pieza de corrido: apertura, crescendos y clímax, y el inicio de la coda |
| 4:05.6 – 4:39.7 | 4:49.7 – 5:23.8 | El final de la coda, con el último acorde (ataca en 5:19.1, 0.85 s después de la última frase); los aplausos no se usan |

Su nivel sigue a la voz: unos 24 dB por debajo de ella, sube en los silencios largos (inicio,
tarjetas y cambios de escena), sube 4 dB en las tarjetas de capítulo y se desvanece en los
últimos 3 s.

**Descarga.** El `.ogg` no se versiona (pesa 8 MB). Para renderizar con música, desde la raíz del
repositorio:

```bash
curl -L -A "refor-video" -o docs/expoing/video/musica/latso_reflets_dans_leau.ogg \
  "https://upload.wikimedia.org/wikipedia/commons/e/e5/Debussy_%2C_Reflets_dans_l%27eau.ogg"
shasum docs/expoing/video/musica/latso_reflets_dans_leau.ogg   # debe dar el SHA-1 de arriba
```

## Tipografías

Bodoni Moda, Libre Caslon Display, Libre Caslon Text e Instrument Sans, bajo la SIL Open Font
License (`docs/presentacion/fuentes/OFL.txt`).

## Voz

La voz del video es la de Andrea Estefanía de la Peña (fase 3), grabada en notas de voz del
teléfono y procesada en `mezclar.py` (pasa altos, reducción de ruido con la huella del silencio de
cada toma, expansor suave, compresión 3:1, de-esser y −16 LUFS). Para revisar el ritmo del
animatic, `renderizar.py --voz-provisional` genera además una copia con una voz sintética (`say`
de macOS, voz Paulina). Esa copia es solo para la revisión interna del equipo: nunca se publica ni
entra a la mezcla final (PLAN §1 y §8.3).

## Efectos de sonido

Cuatro, sintetizados por `mezclar.py` (trabajo propio; no usa archivos de terceros), a −28 dBFS o
menos (PLAN §4.3): un golpe grave cuando brota la planta en E1, un roce de papel en cada tarjeta de
capítulo (E5 y E8) y un clic de madera cuando el mosaico se asienta en E9.

## Bibliotecas e imágenes

- KaTeX 0.16.11 (licencia MIT, `scripts/expoing/video/vendor/katex/LICENSE`), servido localmente
  para las fórmulas de E6 y E8.
- Grabación de `refor_gui` en E10: trabajo propio. `capturar_gui.py` corre el programa real con
  los datos de `data/processed` y lo graba desde su propio framebuffer; el cálculo del plan va
  acelerado y la ventana lo marca («×N»). Interfaz con Dear ImGui e ImPlot (MIT) y la fuente Inter
  (SIL OFL 1.1), como en `refor_gui`.

## Datos

Todas las cifras salen de `data/processed/` (datos de INECOL), de `docs/presentacion/datos/datos.js`
o de la salida de `refor` (PLAN §6).
