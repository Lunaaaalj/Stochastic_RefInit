# Video de Expo Ingenierías: plan de producción

Plan completo del video de *Compra bajo incertidumbre y distribución espacial de
especies para la reforestación de 30 polígonos en San Luis Potosí* para la
Muestra Virtual de Expo Ingenierías (categoría **Investigación y desarrollo de
propuestas de mejora**). Lo implementa otra sesión de Claude Code; este
documento fija qué se ve, qué se oye, cuándo y con qué herramientas.

- **Fuente de verdad de los tiempos y del texto:** `scripts/expoing/video/tiempos.py`.
  Genera `linea_de_tiempo.json` y `guion.srt` en esta carpeta. Si cambia una
  frase, se edita ahí y se vuelve a correr; la tabla de la sección 5 es una
  copia legible de esa salida.
- Todo en español. Todas las cifras salen de `data/processed/`, de
  `docs/presentacion/datos/datos.js` o de la salida de `refor` (invariante del
  repositorio); la sección 6 da la fuente de cada una.

---

## 1. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Producción | Animación por código: escenas HTML/SVG/JS deterministas, renderizadas cuadro a cuadro con Chromium sin interfaz y armadas con ffmpeg |
| Personas en cámara | Nadie. El equipo se presenta con nombres en pantalla mientras la voz los dice |
| Narración | Una sola voz: **Andrea Estefanía de la Peña**, grabada por ella (nunca voz sintética en el video final) |
| Sincronía | **Animación primero**, la voz se ajusta: Andrea graba siguiendo un *video guía* |
| Identidad | Base «Carta de campo» (`docs/presentacion/DESIGN.md`), con tratamiento más cinematográfico |
| Tratamiento | Documental de datos: papel claro dominante, cámara continua sobre el mapa, transiciones por movimiento; tinta oscura solo en la apertura y en las dos tarjetas de capítulo |
| Audiencia | Público general de Expo: primero la intuición, sin jerga en la voz |
| Matemáticas | Se muestran los **modelos completos**, de compra y de asignación, en tipografía de tinta sobre papel; cada término se ilumina cuando la voz lo explica en lenguaje llano |
| Técnicas | Se nombran en rótulos discretos (Monte Carlo, mochila de elección múltiple, memético con búsqueda tabú, programación entera con HiGHS) |
| Arco | Historia: gancho → equipo → problema → proyecto y alcance → Pregunta 1 (cuánto comprar) → Pregunta 2 (cómo acomodar) → herramienta → impacto |
| Innovación destacada | Comprar con garantía probabilística, no a ojo |
| Presupuesto | Se presenta como hallazgo valioso: saberlo antes de plantar evita perder la inversión |
| Gancho | Vuelo de mapa: de la región a una sola planta que brota |
| Cierre | Toma aérea inversa: del mosaico al sitio completo plantado |
| Pruebas mostradas | Grabación real de `refor_gui` (la hace Claude), extracto real del CLI y la validación Monte Carlo contra el cálculo exacto |
| Música | *Reflets dans l'eau* (Debussy, *Images*, 1905), piano, en una grabación de dominio público o CC0 |
| Efectos | Muy pocos (≤ 4), discretos |
| Subtítulos | Quemados, clásicos, en una franja inferior reservada; además se entrega un `.srt` |
| Duración | Objetivo de 4:15 a 4:30; el guion calculado dura **4:30** a ritmo tranquilo (E10 lleva 1.5 s más para que se vea el zoom de la grabación de `refor_gui`) |
| Formato | MP4 H.264 + AAC, 1920 × 1080, **60 fps**; archivo `refor_expoing_2026.mp4` (22 caracteres) |
| Ubicación | Plan y guion en `docs/expoing/video/`; código en `scripts/expoing/video/` |
| Socioformador | **Nunca se nombra a la institución** en la voz, los subtítulos, los rótulos, la tarjeta final, los créditos ni el `.srt`; siempre se dice «el socioformador». Vale para todo material del evento |

---

## 2. Requisitos de la convocatoria y dónde se cumplen

| Requisito (Anexo 4) | Dónde | Cómo |
|---|---|---|
| MP4, 3–5 min, nombre ≤ 30 caracteres | Exportación | `refor_expoing_2026.mp4`; QA con `ffprobe` (sección 10) |
| No generado completamente con IA | Todo | Voz humana real; animaciones programadas con datos propios; nada de imagen ni voz generativa |
| Explicación audible | Todo | Narración continua de Andrea |
| Imágenes o extractos de las pruebas | E7, E9, E10 | Validación Monte Carlo contra exacto, salida real de `refor` en la terminal, memético contra la cota de HiGHS, grabación real de `refor_gui` |
| No solo demo ni solo explicación | Todo | Explicación con el proyecto, su desarrollo y sus resultados en pantalla |
| Presentación del equipo: proyecto, integrantes, tutores, modelo educativo, clase, modalidad | E2 (0:19–0:52) | Tarjeta de título y voz |
| Problema o necesidad | E3 | Meta de 658/ha, mortalidad del 4 al 18 %, presupuesto |
| Qué resuelve y cómo | E4 | Las dos preguntas y la tubería |
| Por qué es innovador | E6 | «Comprar con una garantía, no a ojo» |
| Justificación del alcance | E4 | Lo que el planeador decide; agua y terreno fuera |
| Técnicas con figuras, diagramas o gráficas | E5, E6, E8, E9 | Histograma de 10,000 temporadas, modelos anotados, matriz W, mosaico, regla azar/memético/cota |
| Resultados: presentar, discutir, concluir | E7, E9 | 108,680 plantas; $14,496/ha frente a $12,500; −16 %; brecha ≤ 4.5 %; 6 claves |
| Impacto en la industria o la sociedad | E11 | Dinero público, supervivencia, método replicable |

---

## 3. Dirección de arte

### 3.1 Lienzo y zonas

- Lienzo de 1920 × 1080 a 60 fps. Márgenes seguros de 96 px a los lados y 72 px arriba.
- **Franja de subtítulos reservada:** de y = 912 a y = 1080 (168 px). Ningún
  elemento de contenido, fórmula, rótulo o gráfica entra ahí en ninguna escena.
  El mapa de fondo sí puede pasar por debajo, porque la franja lleva su propio
  respaldo.
- Zona de contenido: y de 72 a 880.

### 3.2 Color

Se usa la paleta de `DESIGN.md` §2 sin cambios: `--papel #FCF0DA`, `--tierra #4C4541`,
`--salvia #AEAC78`, `--ocre #F2C46A`, `--tinta #2E2A27`, `--tierra-suave #6E655F`,
`--salvia-honda #6F6D43`, `--ocre-hondo #8C6418`, `--papel-hondo #F3E2C2` y los colores por especie
de la tabla de especies de `DESIGN.md`. Reglas de contraste iguales: salvia y ocre nunca
como texto sobre papel.

Concesiones cinematográficas, que no existen en el deck:

- **Tinta como fondo** (`#2E2A27`) solo en tres momentos: los primeros
  segundos de E1 y las tarjetas de capítulo de E5 y E8. Sobre tinta, el texto va en papel.
- **Grano de papel estático** al 3 % de opacidad sobre todo el cuadro, y
  **viñeta** suave (6 %, multiplicada con tierra). El grano no se anima, porque el
  grano animado arruina la compresión H.264.
- **Amanecer** en E1: el fondo pasa de tinta a papel en ≈ 2.5 s, como si se
  encendiera la luz sobre la carta.

### 3.3 Tipografía

Archivos en `docs/presentacion/fuentes/`; se embeben localmente.

| Uso | Fuente | Tamaño |
|---|---|---|
| Título del proyecto (E2) y tarjeta final | Bodoni Moda 72 pt Bold | 54–60 px |
| Títulos de escena y preguntas de capítulo | Libre Caslon Display | 64–96 px |
| Anotaciones, nombres de especie (cursiva) | Libre Caslon Text, regular e itálica | 24–32 px |
| Cifras, ejes, rótulos técnicos, **subtítulos** | Instrument Sans | 20–40 px |
| Fórmulas | KaTeX (fuentes KaTeX_Main/KaTeX_Math), color `--tierra` | 40–46 px |

Los nombres científicos siempre van en cursiva en pantalla (*Agave salmiana*,
*Prosopis laevigata*). Igual que en `DESIGN.md`: nada de etiquetas en mayúsculas espaciadas sobre los
títulos, ni palabras resaltadas sueltas en los titulares, ni numeración decorativa. La única
numeración es «Pregunta 1» y «Pregunta 2», porque sí es una secuencia.

### 3.4 Subtítulos

- Instrument Sans 600, 40 px, color `--tinta`, centrados en la franja, a lo más
  dos líneas (≤ 50 caracteres por línea; los cortes ya vienen en `tiempos.py`).
- Respaldo: una franja de papel al 88 % de opacidad con desenfoque de fondo de 6 px,
  del ancho del texto más 32 px por lado, con radio de 6 px. Sobre las tarjetas de
  tinta, la franja se invierte (tinta al 88 % con texto en papel).
- Entrada y salida con un fundido de 120 ms; nunca deslizamiento.
- Duración mínima de 1.2 s por subtítulo; si uno queda más corto tras alinear la voz, se fusiona con el
  siguiente.
- Se dibujan en la misma capa HTML del render, no con el filtro `subtitles` de ffmpeg, para
  controlar la tipografía. Además se exporta `refor_expoing_2026.srt`.
- Los subtítulos usan cifras («$14,496»); la voz dice los números con letra. El
  texto exacto de ambos está en `tiempos.py`.

### 3.5 Cámara y movimiento

- **Un escenario persistente:** la carta (curvas de nivel y los 30 polígonos de
  `mapa.csv`) es un solo lienzo enorme y la cámara se mueve sobre él, como en
  `DESIGN.md` §5. Las escenas «de hoja» (fórmulas, tarjeta de título) son hojas de
  papel opaco que se deslizan encima de la carta, con sombra suave (0 12px 40px, tierra al 18 %).
- **Parallax ligero:** las curvas de nivel se mueven al 0.6× de la capa de polígonos en
  los paneos, lo que da profundidad sin 3D.
- **Curvas:** `cubic-bezier(.2,.7,.2,1)` para entradas y datos; los movimientos de
  cámara usan *ease in-out* de 1.2 a 2.4 s. Ningún movimiento dura menos de 300 ms.
- **Transiciones permitidas, solo estas tres:**
  1. *Movimiento de cámara* sobre la carta (la normal).
  2. *Iris hexagonal*: un hexágono que crece desde el centro abre o cierra las
     tarjetas de capítulo (500 ms).
  3. *Corte por continuidad*: un objeto de una escena viaja a la siguiente (la
     miniatura del histograma entra al término de probabilidad; el mosaico se convierte en
     el mapa).
  No hay disolvencias genéricas, salvo el fundido final a tinta.
- **Un solo momento estelar:** el mosaico que se reordena del azar al arreglo
  optimizado en E9 (≈ 2.5 s, coreografiado). Lo demás se mueve con discreción.

### 3.6 Fórmulas

- Se renderizan con KaTeX fijado en una versión y servido localmente (por ejemplo
  `katex@0.16.11` copiado a `scripts/expoing/video/vendor/`); no se usa CDN en el render.
- Cada término va envuelto en `\htmlClass{t-<nombre>}{…}` (con `trust: true`), para
  iluminarlo por separado.
- Estados de un término: *fantasma* (tierra al 30 %), *activo* (`--ocre-hondo`, con
  un subrayado de 3 px que se dibuja de izquierda a derecha en 400 ms) y *leído*
  (tierra al 100 %).
- Las anotaciones en lenguaje llano van debajo del término, en Libre Caslon Text cursiva de 26 px,
  `--tierra-suave`, unidas al término por una línea guía fina (1.5 px, tierra al 40 %).
- La fórmula entera aparece en fantasma primero (para que el ojo vea su forma) y los
  términos se encienden sincronizados con la voz (sección 5).

---

## 4. Audio

### 4.1 Voz

- Narra Andrea de la Peña. Hay que grabar en un cuarto chico con ropa o cortinas, y con el
  micrófono a 15–20 cm (sirve uno de diadema o el de un teléfono). WAV a 48 kHz.
- **Animación primero:** se renderiza un *video guía* (sección 8.4) y Andrea graba
  **escena por escena** (11 tomas) leyendo el subtítulo resaltado al ritmo de la
  animación. Cada toma empieza con una cuenta regresiva visual de 3-2-1.
- Ritmo del guion: 14.5 caracteres hablados por segundo, con pausas de 0.35 s entre frases. Es tranquilo a
  propósito; si Andrea es más rápida, sobra silencio en los colchones, y eso es preferible.
- Tolerancia: si una toma difiere de la duración planeada por ±8 % o menos, se ajusta con
  `rubberband` o `atempo` y los subtítulos se realinean. Si difiere más, se vuelve a grabar esa toma.
- Procesamiento: pasa altos de 80 Hz, reducción de ruido (`afftdn` o `arnndn`),
  compresor suave de 3:1 y de-esser; la normalización final va en la mezcla.

### 4.2 Música: *Reflets dans l'eau*

- La obra es de dominio público, pero **cada grabación tiene sus propios derechos**. Revisión de
  licencias (noviembre de 2026):

| Grabación | Duración | Licencia | ¿Sirve? |
|---|---|---|---|
| **Giorgi Latso**, piano, 2017 ([Commons](https://commons.wikimedia.org/wiki/File:Debussy_,_Reflets_dans_l%27eau.ogg); [IMSLP](https://imslp.org/wiki/Special:ImagefromIndex/506786)) | 5:33 | Commons: CC BY-SA 4.0; IMSLP: CC BY-NC-SA 4.0 (discrepan) | **Sí. Es la elegida.** Se cumple la más restrictiva: BY-NC-SA 4.0 |
| Jacopo Salvatori, piano, OnClassical ([IMSLP](https://imslp.org/wiki/Special:ImagefromIndex/477299)) | 7:40 | CC BY-NC-SA 3.0 | Sí; es el respaldo (tempo más lento) |
| Gregor Quendel ([FMA](https://freemusicarchive.org/music/gregor-quendel/piano-classics-collection-vol-ii/debussy-reflets-dans-leau-reflections-in-the-water-images-book-1-l-110mp3)) | 4:31 | CC BY-NC-ND 4.0 | **No.** «Sin derivadas»: sincronizar y recortar música en un video es una obra derivada |
| Sviatoslav Richter, Carnegie Hall, 1960 (IMSLP) | — | Dominio público solo fuera de EE. UU. | **No.** En México el fonograma está protegido 75 años (hasta 2035) |
| Anderson, Budd, Kodeeswaran (enlaces de IMSLP a Piano Society) | — | No indicada | No, mientras no se verifique la licencia |

  **Obligaciones con Latso (BY-NC-SA 4.0):**
  1. **Atribución** en la tarjeta final y en la descripción del video: «Claude Debussy, *Reflets
     dans l'eau* (1905). Interpretación: Giorgi Latso; grabación: Markus Asus (2017). CC BY-NC-SA 4.0,
     vía Wikimedia Commons. Editada (recortes y mezcla)».
  2. **No comercial:** la Muestra Virtual es académica y sin fines de lucro; no se monetiza el video.
  3. **Compartir igual:** al sincronizar la música, el video es material adaptado. Por eso el video
     completo se publica bajo **CC BY-NC-SA 4.0**, y se dice así en la tarjeta final («Este video:
     CC BY-NC-SA 4.0»). Es compatible con el repositorio y con la Expo.
  4. Hay que indicar que la grabación se modificó (recortes, fundidos, ecualización).
- Se descarga el `.ogg` original de Commons (sin la transcodificación MP3) a
  `docs/expoing/video/musica/`, y se guardan la URL, el intérprete, el grabador, la licencia y la fecha
  de consulta en `docs/expoing/video/CREDITOS.md`. Antes del render final, el implementador vuelve a abrir la
  página de Commons para confirmar que la licencia sigue igual. No se usa ninguna grabación comercial.
- La pieza dura ≈ 5 min, con rubato y crescendos fuertes. **Mapa de edición** (lo afina el
  equipo al escucharlo; el implementador localiza las secciones con un perfil de sonoridad,
  `ffmpeg -af ebur128` o `astats` por segundo):

| Video | Parte de la pieza | Carácter |
|---|---|---|
| 0:00–0:20 (E1) | Apertura (los primeros compases, *pp*, las «gotas») | Entra sola durante 2.5 s y luego queda bajo la voz |
| 0:20–1:46 (E2–E4) | Continuación de la apertura y la primera sección tranquila | Fondo bajo |
| 1:46–3:55 (E5–E9) | Pasajes tranquilos del desarrollo, evitando los crescendos | Fondo bajo; en las tarjetas de capítulo sube 4 dB durante 2 s |
| 3:55–4:22 (E10–E11) | **Acercamiento al clímax** | Sube con la toma aérea |
| 4:22–4:30 (final) | Clímax que resuelve y acorde final, o el final de la pieza | Sin voz al final; desvanecimiento de 3 s |

  Los cortes van en finales de frase, con fundidos cruzados de 1.5 a 2.5 s; no se usan bucles
  audibles.
- **Mezcla:** voz a −16 LUFS integrados. La música queda entre −24 y −26 dB bajo la voz con
  *ducking* por cadena lateral (`sidechaincompress`: ataque de 20 ms, liberación de 400 ms) y sube
  a ≈ −18 LUFS de corto plazo cuando no hay voz (inicio, tarjetas, cierre). Pico real ≤ −1 dBTP.
  *Implementación (`mezclar.py`):* en lugar del compresor de cadena lateral, la ganancia de la música
  se calcula con los tiempos reales de cada frase (baja 0.3 s antes de la voz y sube en 1 s después
  de ella, solo en silencios de más de 2.5 s), así no «respira» entre frases; conserva el 35 % de
  la dinámica propia de la pieza para que el clímax siga subiendo. El mapa de edición que se usó
  está en `CREDITOS.md`. *Decisión del equipo (fase 5):* la música va en el orden de la pieza, como
  en el animatic, con el clímax en la tarjeta de la pregunta 2 (≈ 3:05) en lugar de en E10–E11, y
  termina con el último acorde de la pieza (un salto en la coda).

### 4.3 Efectos

Solo cuatro, CC0 (freesound con filtro CC0) o sintetizados, a −28 dB o menos:

1. **E1, 0:15.6:** el brote de la planta, un «toc» suave de semilla en tierra.
2. **E5, 1:46.3** y **E8, 3:05.6:** el papel de las tarjetas de capítulo, un roce breve.
3. **E9, ≈ 3:42:** el mosaico que se asienta, un clic de madera muy suave.

Nada más; el rubato de Debussy choca con efectos rítmicos.

---

## 5. Guion escena por escena

Formato de cada escena: tiempo, visual detallado, voz (texto hablado exacto, que es
lo que lee Andrea) y subtítulos con sus tiempos. Los tiempos de subtítulo los
genera `tiempos.py`. La duración total es de **4:30.4**; con la tarjeta final completa, **4:30**.

### E1 · Gancho: de la región a la planta (0:00.0 – 0:19.6)

**Visual**

- 0:00–0:01.2: cuadro en tinta y en silencio; la música entra con sus primeras
  notas.
- 0:01.2–0:04.0: las curvas de nivel (mismo trazo que `fondo-curvas-de-nivel.png`) se
  dibujan en salvia sobre la tinta, de dentro hacia fuera; al mismo tiempo **amanece**: el
  fondo pasa a papel.
- 0:02.5 («183 hectáreas»): los contornos de los 30 polígonos (`mapa.csv`) se trazan con
  un *stroke-dashoffset* de 1.8 s. Arriba a la izquierda aparece una anotación en Libre
  Caslon Text: «183 ha · 30 polígonos · Línea de Transmisión Dominica–Charcas, San Luis Potosí»,
  con la escala de 500 m y la flecha del norte, en estilo cartográfico.
- 0:06.85 («30 terrenos…»): los polígonos se rellenan de papel hondo uno por uno, en orden
  geográfico, y un contador pequeño en Instrument Sans va de 1 a 30. No se dibuja la
  línea de transmisión, porque no hay geometría en los datos.
- 0:12.3 («Y una pregunta…»): la cámara empuja hacia el polígono 1 (de 1× a ≈ 60× en
  4 s, con *ease in-out*). Al acercarse aparece la retícula al tresbolillo como puntos finos.
- 0:15.07 («¿cuántas plantas comprar…»): la pregunta aparece en dos líneas en Libre
  Caslon Display de 72 px, en la mitad superior. Con «comprar» se encienden puntos de la retícula;
  con «dónde poner cada una», la cámara se detiene en un solo hexágono y en su centro **brota una
  planta** (la marca de `logo-marca.png` crece con una escala elástica de 600 ms). Efecto 1.
- 0:18.5–0:19.6: pausa.

**Voz y subtítulos**

| Tiempo | Voz (hablado) | Subtítulo |
|---|---|---|
| 0:02.50–0:06.50 | Ciento ochenta y tres hectáreas del semidesierto potosino. | 183 hectáreas del semidesierto potosino. |
| 0:06.85–0:11.95 | Treinta terrenos junto a una línea de transmisión, que hay que reforestar. | 30 terrenos junto a una línea de transmisión / que hay que reforestar. |
| 0:12.30–0:14.72 | Y una pregunta que parece sencilla: | Y una pregunta que parece sencilla: |
| 0:15.07–0:18.45 | ¿cuántas plantas comprar, y dónde poner cada una? | ¿cuántas plantas comprar, / y dónde poner cada una? |

### E2 · Presentación del equipo (0:19.6 – 0:52.0)

**Visual**

- Transición: la cámara se aleja del hexágono (el brote se queda como logo) y sobre la
  carta, que se atenúa al 35 % y deriva lentamente, se desliza una **hoja de título** de papel opaco
  (≈ 1400 × 760 px, centrada en la zona de contenido), con el cuadro de título de una
  carta topográfica: doble filete en tierra.
- Contenido de la hoja, de arriba abajo:
  1. `logo-brote-hexagono` a 96 px de alto.
  2. Título en Bodoni Moda, en dos o tres líneas: «Compra bajo incertidumbre y distribución
     espacial de especies para la reforestación de 30 polígonos en San Luis Potosí». Es visible desde
     el principio.
  3. Una línea en Instrument Sans: «Optimización Estocástica (MA2004B) · Modelo educativo
     profesional · Modalidad presencial · Tecnológico de Monterrey». Aparece en 0:20.25.
  4. Los cuatro integrantes en una fila de cuatro columnas, en Libre Caslon Text de 30 px.
     Cada nombre aparece con un fundido y un ascenso de 8 px **cuando la voz lo dice**
     (0:29.4, 0:31.0, 0:32.5, 0:34.0). Bajo «Andrea Estefanía de la Peña» va una nota
     pequeña en cursiva: «narración».
  5. «Profesores tutores: Yadira Isabel Silva Soto · Rafael Muñoz Sánchez», en 0:36.0.
  6. Al pie, en tierra suave: «En colaboración con el socioformador · Datos: INECOL».
- 0:40.9 («Nuestro proyecto…»): el título recibe un subrayado en ocre hondo que se dibuja a lo
  largo de la primera línea.

**Voz y subtítulos**

| Tiempo | Voz (hablado) | Subtítulo |
|---|---|---|
| 0:20.25–0:23.69 | Somos el equipo cinco de Optimización Estocástica, | Somos el equipo 5 de Optimización Estocástica, |
| 0:24.04–0:29.08 | modelo educativo profesional, modalidad presencial, del Tec de Monterrey: | modelo educativo profesional, / modalidad presencial, del Tec de Monterrey: |
| 0:29.43–0:33.64 | Angel Eduardo Luna, Irasema Álvarez, Carolina Sánchez Meneses | Angel Eduardo Luna, Irasema Álvarez, / Carolina Sánchez Meneses |
| 0:33.99–0:35.64 | y yo, Andrea de la Peña, | y yo, Andrea de la Peña, |
| 0:35.99–0:40.54 | con la tutoría de Yadira Isabel Silva Soto y Rafael Muñoz Sánchez. | con la tutoría de Yadira Isabel Silva Soto / y Rafael Muñoz Sánchez. |
| 0:40.89–0:46.34 | Nuestro proyecto: compra bajo incertidumbre y distribución espacial de especies | Nuestro proyecto: compra bajo incertidumbre / y distribución espacial de especies |
| 0:46.69–0:50.97 | para la reforestación de treinta polígonos en San Luis Potosí. | para la reforestación de 30 polígonos / en San Luis Potosí. |

### E3 · El problema: plantar no es reforestar (0:52.0 – 1:20.9)

**Visual**

- La hoja de título se retira hacia arriba y la cámara se queda sobre un área libre de la
  carta. Ahí se dibuja **una hectárea**: un rectángulo con la retícula al tresbolillo de
  **14 × 47 = 658 posiciones** (la hectárea de `simulacion_siembra.py`), con un título en
  Caslon Display: «Una hectárea».
- 0:52.57 («658 plantas»): las posiciones se llenan en una onda diagonal de 2.5 s, con un
  contador de 0 a 658 en Instrument Sans.
- 0:58.43 («10 especies nativas»): los puntos toman el color de su especie según la meta por
  especie de esa hectárea (*A. lechuguilla* 39, *A. salmiana* 196, *A. scabra* 38, *A. striata*
  39, *O. cantabrigiensis* 54, *O. engelmannii* 41, *O. robusta* 80, *O. streptacantha* 70,
  *P. laevigata* 77, *Y. filifera* 24). La distribución sale de un arreglo por clave o de un
  barajado con semilla fija; esta escena solo ilustra la composición. A la derecha, la leyenda de
  las 10 especies agrupadas por género (Agave, Opuntia, Prosopis y Yucca) aparece con
  «agaves, nopales, mezquite y yuca».
- 1:02.85 («plantar no es lo mismo…»): una pausa visual; nada se mueve durante 0.6 s.
- 1:06.17 («muere entre el 4 y el 18 %»): una realización con semilla fija: cada punto
  sobrevive con la probabilidad *q* de su especie (`especies.csv`), y los que mueren pasan de
  relleno a contorno hueco en 1.2 s, escalonados. A la derecha, la leyenda se transforma en una
  barra horizontal por especie con la supervivencia (82.1 % *P. laevigata* … 95.9 %
  *A. salmiana*), con el título «Supervivencia al primer año».
- 1:12.04 («Comprar de menos… de más…»): bajo la hectárea aparece un control
  deslizante, «plantas compradas», que recorre de izquierda a derecha. A la izquierda, el
  rótulo «faltan plantas → hay que reponer»; a la derecha, «se rebasa el presupuesto», y una
  línea vertical en ocre hondo marca **«$12,500 por hectárea»**. El punto se queda oscilando en el
  centro: el dilema.

**Voz y subtítulos**

| Tiempo | Voz (hablado) | Subtítulo |
|---|---|---|
| 0:52.57–0:58.29 | El socioformador busca que cada hectárea tenga seiscientas cincuenta y ocho plantas | El socioformador busca que cada hectárea / tenga 658 plantas |
| 0:58.64–1:02.71 | de diez especies nativas: agaves, nopales, mezquite y yuca. | de 10 especies nativas: / agaves, nopales, mezquite y yuca. |
| 1:03.06–1:06.03 | Pero plantar no es lo mismo que reforestar: | Pero plantar no es lo mismo que reforestar: |
| 1:06.38–1:11.89 | en el primer año muere entre el cuatro y el dieciocho por ciento de lo plantado. | en el primer año muere entre el 4 y el 18 % / de lo plantado. |
| 1:12.24–1:20.11 | Comprar de menos incumple la meta; comprar de más rebasa el presupuesto de doce mil quinientos pesos por hectárea. | Comprar de menos incumple la meta; comprar de más / rebasa el presupuesto de $12,500 por hectárea. |

### E4 · El proyecto y su alcance (1:20.9 – 1:46.3)

**Visual**

- 1:21.4 («Hoy…»): la hectárea se encoge a la izquierda. Al centro aparece la **clave
  vigente**: la secuencia de 22 posiciones de `clave_vigente.csv` como una fila de hexágonos de
  colores, que se copia hacia abajo fila tras fila, con el rótulo «Hoy: una secuencia fija de 22
  plantas por cada 100 m». Junto a ella, una nota manuscrita en Caslon cursiva: «compra estimada a ojo».
- 1:26.37 («refor responde dos preguntas»): la fila se desvanece y crece el **árbol de la
  tubería** (`DESIGN.md` §4.1), de las raíces a las hojas en ≈ 3.5 s: «Datos INECOL → 10,000
  escenarios → compra por polígono → clave de plantación».
- 1:30.03: a la izquierda del árbol aparece la tarjeta «Pregunta 1 · ¿Cuánto comprar?» en
  Caslon Display de 44 px, con la anotación «al menor costo, con garantía de cumplir la meta».
- 1:35.97: a la derecha aparece la tarjeta «Pregunta 2 · ¿Dónde plantar cada una?», con la
  anotación «que compitan lo menos posible».
- 1:40.04 («El alcance…»): abajo, en la zona de contenido, una llave horizontal con dos
  columnas. **Dentro**: «compra y composición por especie · acomodo en el terreno · 30 polígonos,
  183 ha, 10 especies · supervivencia al primer año». **Fuera**, en tierra suave y tachado con
  una línea fina: «agua · vivero · terreno de cada polígono».

**Voz y subtítulos**

| Tiempo | Voz (hablado) | Subtítulo |
|---|---|---|
| 1:21.41–1:26.03 | Hoy, la compra se estima a ojo y se siembra con una secuencia fija. | Hoy, la compra se estima a ojo / y se siembra con una secuencia fija. |
| 1:26.38–1:29.69 | Nuestro proyecto, refor, responde dos preguntas: | Nuestro proyecto, refor, responde dos preguntas: |
| 1:30.04–1:35.62 | cuánto comprar de cada especie, al menor costo y con garantía de cumplir la meta, | cuánto comprar de cada especie, al menor costo / y con garantía de cumplir la meta, |
| 1:35.97–1:39.70 | y cómo acomodarlas para que compitan lo menos posible. | y cómo acomodarlas / para que compitan lo menos posible. |
| 1:40.05–1:45.29 | El alcance es lo que el planeador decide; el agua y el terreno quedan fuera. | El alcance es lo que el planeador decide; / el agua y el terreno quedan fuera. |

### E5 · Pregunta 1: diez mil temporadas (1:46.3 – 2:06.1)

**Visual**

- 1:46.3–1:48.7: **tarjeta de capítulo**. Se cierra un iris hexagonal hacia la tinta. Sobre la tinta, en
  papel: «Pregunta 1» (Instrument Sans de 28 px, al 70 %) y debajo «¿Cuánto comprar?» (Caslon
  Display de 96 px). Efecto 2; la música sube 4 dB. El iris se abre sobre papel.
- 1:48.68 («Tomemos el *Agave salmiana*…»): una ficha de especie arriba a la izquierda:
  *Agave salmiana* · polígono 1 · supervivencia 95.9 %.
- 1:52.0 («La meta es de 252, y ya hay 46»): en la ficha, dos cifras grandes, «meta 252» y
  «ya hay 46», y una tercera que se deduce: «faltan 206 vivas».
- 1:56.97 («Simulamos 10,000 temporadas»): el **histograma** de `piezas.js` (función
  `temporadas`) a todo lo ancho, con las barras creciendo y el contador de 0 a 10,000
  temporadas simuladas. Rótulo técnico abajo a la derecha: «Simulación Monte Carlo».
- 2:00.14 («Comprar 220…»): aparece la línea discontinua en ocre hondo en 220, «comprar 220», y las
  barras a su izquierda se oscurecen a salvia honda: «alcanza en 96 % de las temporadas».

**Voz y subtítulos**

| Tiempo | Voz (hablado) | Subtítulo |
|---|---|---|
| 1:48.69–1:51.65 | Tomemos el agave salmiana del polígono uno. | Tomemos el *Agave salmiana* del polígono 1. |
| 1:52.00–1:56.62 | La meta es de doscientas cincuenta y dos, y ya hay cuarenta y seis. | La meta es de 252, y ya hay 46. |
| 1:56.97–1:59.80 | Simulamos diez mil temporadas de siembra. | Simulamos 10,000 temporadas de siembra. |
| 2:00.15–2:05.32 | Comprar doscientas veinte alcanza en el noventa y seis por ciento de ellas. | Comprar 220 alcanza / en el 96 % de ellas. |

En los subtítulos, el nombre científico va en cursiva.

### E6 · Pregunta 1: el modelo de compra (2:06.1 – 2:33.1)

**Visual:** una hoja de método se desliza sobre la carta. El modelo del reporte
(`reports/final/secciones/modelo-compra.tex`, ec. obj–probabilidad), exacto, centrado en la
mitad superior:

```latex
\min_{n,\,x}\; \htmlClass{t-coef}{(1+\theta)}\sum_{s}c_s\Bigl(\htmlClass{t-compra}{x_{is}}+\htmlClass{t-repo}{\mathbb{E}[D_{is}]}\Bigr)
\text{s.a.}\;
\htmlClass{t-total}{\textstyle\sum_{s} n_{is}=N_i}
\htmlClass{t-banda}{|n_{is}-n_s^0A_i|\le\delta\,n_s^0A_i}
\htmlClass{t-presu}{(1+\theta)\textstyle\sum_{s}c_s x_{is}\le B\,A_i}
\htmlClass{t-prob}{\mathbb{P}\bigl(E_{is}+S_{is}(x_{is})\ge n_{is}\bigr)\ge 1-\alpha}
```

Se presenta como un `align` de cinco renglones; cada restricción lleva su anotación a la derecha, no
debajo, para no invadir la franja de subtítulos.

| Tiempo | Qué se enciende | Anotación en lenguaje llano |
|---|---|---|
| 2:06.5 | Todo en fantasma | «para cada polígono *i* y cada especie *s*» (arriba, pequeña) |
| 2:09.8 | `t-compra`, luego `t-repo` (+0.9 s) | «lo que se compra» · «lo que se espera reponer» |
| 2:15.1 | `t-total` | «la meta total: 658 por hectárea» |
| 2:16.6 | `t-banda` | «±10 % por especie respecto al plan» |
| 2:18.6 | `t-presu` | «el presupuesto: $12,500 por hectárea» |
| 2:21.1 | `t-prob`, en ocre hondo con fondo papel hondo | «cada especie cumple su meta en al menos 95 % de los escenarios» |
| 2:21.6 | Corte por continuidad: una miniatura del histograma de E5 vuela y se posa junto a `t-prob` | — |
| 2:28.1 | `t-prob` crece al 112 %; el resto vuelve a tierra | junto a ella, en Caslon cursiva: «lo nuevo: comprar con garantía» |

Rótulos técnicos abajo a la derecha, por encima de la franja y en Instrument Sans de 20 px, tierra
suave, aparecen en 2:24 y se quedan: «Restricción probabilística · Mochila de elección múltiple
(programación dinámica + HiGHS)».

**Voz y subtítulos**

| Tiempo | Voz (hablado) | Subtítulo |
|---|---|---|
| 2:06.52–2:09.42 | Con eso armamos un modelo de optimización: | Con eso armamos un modelo de optimización: |
| 2:09.77–2:14.74 | minimizar lo que cuesta comprar, más lo que se espera gastar en reponer. | minimizar lo que cuesta comprar, / más lo que se espera gastar en reponer. |
| 2:15.09–2:20.74 | Respetar la meta total, un margen de diez por ciento por especie y el presupuesto. | Respetar la meta total, un margen de 10 % / por especie y el presupuesto. |
| 2:21.09–2:27.78 | Y exigir que cada especie cumpla su meta con al menos noventa y cinco por ciento de probabilidad. | Y exigir que cada especie cumpla su meta / con al menos 95 % de probabilidad. |
| 2:28.13–2:32.06 | Esa es la innovación: comprar con una garantía, no a ojo. | Esa es la innovación: / comprar con una garantía, no a ojo. |

### E7 · Pregunta 1: el resultado (2:33.1 – 3:05.6)

**Visual**

- 2:33.46 («108,680 plantas»): la hoja se retira y la cámara se aleja hasta ver los 30 polígonos.
  Cada polígono se puebla de puntos con su densidad real, en una onda desde el centro como en la
  portada del deck. Un contador grande en Caslon Display va de 0 a **108,680**. Debajo, una barra
  apilada por hectárea: «593.8 compradas + 128.8 existentes = 722.6 plantas/ha», con la marca de la
  meta en 658 («9.8 % sobre la meta, para absorber la mortalidad»).
- 2:39.46 («Y un hallazgo…»): una hoja tipo B trae la **frontera B\*(α)**. El eje *x* es el riesgo
  α, de 0.01 a 0.50; el eje *y* va de $12,000 a $15,000. La curva Monte Carlo se traza en tierra
  (800 ms). Debajo de toda la curva hay una línea horizontal en ocre hondo, «$12,500/ha
  disponibles», y el hueco entre ambas se sombrea en ocre al 35 %.
- 2:45.47 («Hacen falta $14,496»): un marcador en α = 0.05 con la cifra **$14,496/ha** grande, en
  ocre hondo, y la nota «16 % más que lo disponible · ningún polígono es factible».
- 2:49.47 («50 veces más riesgo»): un cursor recorre la curva de α = 0.01 a α = 0.50 con
  la etiqueta «riesgo ×50 → −3.7 %»; el hueco sombreado nunca se cierra.
- 2:55.75 («El cálculo exacto lo confirma»): la curva **exacta** (cola binomial) se traza
  discontinua encima de la de Monte Carlo y coincide. Una lupa circular amplía el punto α = 0.05:
  «Monte Carlo $14,496.10 · exacto $14,496.02». A la izquierda se despliega una **tarjeta de terminal**
  (prueba real): el comando `refor frontera -f tabla` y su salida textual, que se escribe línea a línea
  (60 caracteres por segundo). El texto es la salida real del binario, capturada a un archivo; no se
  reescribe a mano.
- 3:00.86 («Saberlo antes de plantar…»): todo baja al 60 % menos el hueco sombreado; al lado, en
  Caslon cursiva: «faltan $365 mil para los 30 polígonos». Pausa de 1.2 s.

**Voz y subtítulos**

| Tiempo | Voz (hablado) | Subtítulo |
|---|---|---|
| 2:33.46–2:39.12 | Resultado: ciento ocho mil seiscientas ochenta plantas para los treinta polígonos. | Resultado: 108,680 plantas / para los 30 polígonos. |
| 2:39.47–2:45.12 | Y un hallazgo: con doce mil quinientos pesos por hectárea, ningún polígono cumple. | Y un hallazgo: con $12,500 por hectárea, / ningún polígono cumple. |
| 2:45.47–2:49.13 | Hacen falta catorce mil cuatrocientos noventa y seis. | Hacen falta $14,496. |
| 2:49.48–2:55.41 | Ni aceptar cincuenta veces más riesgo lo resuelve: ahorra menos del cuatro por ciento. | Ni aceptar 50 veces más riesgo lo resuelve: / ahorra menos del 4 %. |
| 2:55.76–3:00.52 | El cálculo exacto lo confirma: difiere en ocho centavos por hectárea. | El cálculo exacto lo confirma: / difiere en 8 centavos por hectárea. |
| 3:00.87–3:04.38 | Saberlo antes de plantar evita perder la inversión. | Saberlo antes de plantar / evita perder la inversión. |

### E8 · Pregunta 2: el modelo de siembra (3:05.6 – 3:31.4)

**Visual**

- 3:05.6–3:08.0: tarjeta de capítulo con iris hexagonal, «Pregunta 2» / «¿Dónde plantar cada una?».
  Efecto 2.
- 3:07.98 («tresbolillo… seis vecinas»): una retícula hexagonal grande a la izquierda (≈ 9 × 7
  posiciones visibles). Una planta central se ilumina y seis líneas la unen con sus vecinas, que
  se encienden una por una (80 ms entre cada una).
- 3:12.33 («Una matriz…»): a la derecha, la **matriz W** de 10 × 10 (`competencia.csv`) con la
  rampa secuencial y su valor en cada celda, construida fila por fila en 900 ms. Debajo, pequeña y
  sin narrar: W_ab = γ^{1[a=b]} T_ab N_ab − φ F_ab, en tierra suave.
- 3:16.26 («Dos de la misma especie compiten más»): la diagonal recibe un contorno de resaltado. Con
  «el mezquite apenas compite…», la fila y la columna de PLA reciben el contorno en ocre hondo y sus
  valores bajos (0.17, 0.20…) laten una vez.
- 3:22.41 («Buscamos el acomodo…»): la matriz se encoge a la esquina superior derecha y una hoja de
  método trae el **modelo de asignación** (`modelo-espacial.tex`, competencia y ec. ent-obj a
  ent-lin2):

```latex
C(\sigma)=\sum_{(u,v)\in\mathcal{E}} W_{\sigma(u)\sigma(v)}
\min \htmlClass{t-obj}{\sum_{(u,v)\in\mathcal{E}}\sum_{a,b} W_{ab}\,z_{uvab}}
\text{s.a.}\;
\htmlClass{t-una}{\textstyle\sum_{s} y_{vs}=1}\quad v\in V
\htmlClass{t-conteo}{\textstyle\sum_{v} y_{vs}=m_s}\quad s\in\mathcal{S}
\htmlClass{t-lin}{\textstyle\sum_{b} z_{uvab}=y_{ua},\;\; \sum_{a} z_{uvab}=y_{vb}}
```

| Tiempo | Qué se enciende | Anotación |
|---|---|---|
| 3:22.4 | `C(σ)` y `t-obj` | «suma de la competencia de cada par de vecinas» |
| 3:26.0 | `t-una` | «una especie por posición» |
| 3:27.8 | `t-conteo` | «las cantidades que dictó la compra» |
| 3:29.5 | `t-lin`, en tierra suave (sin narración) | «linealizan el producto *y·y*» |

**Voz y subtítulos**

| Tiempo | Voz (hablado) | Subtítulo |
|---|---|---|
| 3:07.98–3:11.98 | Se siembra al tresbolillo: cada planta tiene seis vecinas. | Se siembra al tresbolillo: / cada planta tiene seis vecinas. |
| 3:12.33–3:15.92 | Una matriz mide cuánto compite cada par de especies. | Una matriz mide cuánto compite / cada par de especies. |
| 3:16.27–3:22.06 | Dos de la misma especie compiten más; el mezquite apenas compite con las suculentas. | Dos de la misma especie compiten más; / el mezquite apenas compite con las suculentas. |
| 3:22.41–3:25.66 | Buscamos el acomodo de menor competencia total, | Buscamos el acomodo / de menor competencia total, |
| 3:26.01–3:30.56 | con una especie por posición y las cantidades que dictó la compra. | con una especie por posición / y las cantidades que dictó la compra. |

### E9 · Pregunta 2: memético y resultado, el momento estelar (3:31.4 – 3:55.0)

**Visual**

- 3:31.75 («algoritmo memético con búsqueda tabú»): la hoja se retira. Al centro aparece el
  **mosaico de la clave 1** (4 × 13 = 52 posiciones, hexágonos con la abreviatura de cada especie)
  en una **asignación al azar** con semilla fija y competencia de 90.9, igual que el arranque de
  `imagen-1-mosaico.gif`. Arriba a la izquierda, en miniatura, el ciclo de una generación:
  población → torneo → cruce → búsqueda tabú → reemplazo, con una flecha que gira una vez. Rótulo:
  «Algoritmo memético + búsqueda tabú».
- 3:36.1 («modelo entero exacto»): bajo el mosaico, una **regla de competencia** horizontal con tres
  marcas: «azar 93.3» (promedio), «memético 78.2» (todavía apagada) y «cota del exacto 74.7». Rótulo:
  «Programación entera · HiGHS».
- 3:39.48 («Resultado: 16 % menos…»): **el momento estelar**. Los hexágonos viajan por arcos a su
  lugar en el arreglo optimizado, coreografiados en ≈ 2.5 s (la misma lógica que la versión A de
  `piezas.js`). El contador de competencia baja de 90.9 a **78.2**. El puntero de la regla viaja de
  azar a memético y aparece **«−16 %»** en ocre hondo. Efecto 3 cuando se asienta. Los hexágonos de
  *P. laevigata* (tierra) quedan visiblemente aislados entre suculentas.
- 3:44.66 («a lo más a 4.5 % del óptimo»): en la regla, una llave entre 78.18 y 74.70: «brecha ≤ 4.5 %».
- 3:48.6 («30 polígonos… seis claves»): corte por continuidad. El mosaico se replica en 3 × 3,
  se encoge y la cámara se aleja hasta el mapa, donde cada polígono toma el tono de su clave (seis
  tonos de la rampa). Leyenda: «Clave 1 · 18 polígonos», «Clave 2 · 5», «Clave 5 · 4», «Claves 3,
  4 y 6 · 1 cada una».

**Voz y subtítulos**

| Tiempo | Voz (hablado) | Subtítulo |
|---|---|---|
| 3:31.76–3:35.76 | Lo resolvemos con un algoritmo memético con búsqueda tabú, | Lo resolvemos con un algoritmo memético / con búsqueda tabú, |
| 3:36.11–3:39.14 | y lo medimos contra un modelo entero exacto. | y lo medimos contra un modelo entero exacto. |
| 3:39.49–3:44.32 | Resultado: dieciséis por ciento menos competencia que sembrar al azar, | Resultado: 16 % menos competencia / que sembrar al azar, |
| 3:44.67–3:48.26 | a lo más a cuatro punto cinco por ciento del óptimo. | a lo más a 4.5 % del óptimo. |
| 3:48.61–3:53.57 | Y los treinta polígonos se resuelven con solo seis claves de plantación. | Y los 30 polígonos se resuelven / con solo seis claves de plantación. |

### E10 · La herramienta y las pruebas (3:55.0 – 4:08.3)

**Visual**

- Sobre la carta atenuada, una **ventana** con marco sobrio (barra de título en papel hondo, sombra
  suave, ≈ 1440 × 810 px) reproduce la **grabación real de `refor_gui`** (sección 8.5). Va a velocidad
  real; si un tramo se acelera, se indica con «×4» en la esquina, porque es una prueba y no se esconde.
- Contenido de la grabación (13.7 s editados, `capturar_gui.py`): en la configuración se teclea
  B = 12,500 (α = 0.05 ya está a la vista) → clic en «Ejecutar plan» → barra de progreso, acelerada
  (hoy ×19) → la compra por polígono → la pestaña «Mosaico» con la clave 1 → de vuelta al mapa del
  cerco, zoom con la rueda al polígono 1 hasta ver cada planta sembrada.
- Rótulos fuera de la ventana: «refor_gui · grabación real» arriba a la izquierda; con «Windows,
  macOS y Linux» (4:01.85), tres etiquetas de texto (sin logotipos de marca) y la nota «misma semilla →
  mismos resultados».

**Voz y subtítulos**

| Tiempo | Voz (hablado) | Subtítulo |
|---|---|---|
| 3:55.37–4:01.09 | Todo vive en refor, una herramienta de escritorio que se opera sin saber programar, | Todo vive en refor, una herramienta de escritorio / que se opera sin saber programar, |
| 4:01.44–4:05.38 | y que da los mismos resultados en Windows, macOS y Linux. | y que da los mismos resultados / en Windows, macOS y Linux. |

### E11 · Impacto y cierre: la toma aérea inversa (4:08.3 – 4:30.4)

**Visual**

- 4:08.7: la ventana se cierra hacia el mosaico de la GUI y, por corte por continuidad, ese mosaico se
  vuelve el mosaico de papel sobre el polígono 1.
- 4:08.7–4:26.4: **la toma aérea inversa**, un solo movimiento continuo de ≈ 17 s. La cámara sube del
  mosaico al polígono 1, luego a los 30 polígonos que se **plantan** en ondas desde el centro (puntos de
  color por especie, con la densidad real) y luego a la región con las curvas de nivel. La música
  llega a su clímax en este tramo.
- Frases de impacto en Caslon Display de 52 px, una a la vez, en la esquina superior izquierda sobre
  un cuadro de papel opaco (el texto nunca va directo sobre el mapa):
  - 4:08.7 «decisiones con respaldo probabilístico»
  - 4:13.7 «dinero público y plantas que sobreviven»
  - 4:18.4 «un método abierto y replicable»
- 4:22.6 («Plantar es fácil…»): las frases se van; queda el sitio entero plantado.
- 4:26.4–4:30.4: **tarjeta final** sobre papel opaco: el logo, el título corto («Compra bajo
  incertidumbre y distribución espacial de especies»), los cuatro integrantes, «Optimización
  Estocástica · Tec de Monterrey», «En colaboración con el socioformador · Datos: INECOL» y, en 16 px, «Música:
  Claude Debussy, *Reflets dans l'eau* (1905), interpretación de Giorgi Latso, grabación de Markus Asus
  (2017), CC BY-NC-SA 4.0, vía Wikimedia Commons, editada», y debajo «Este video: CC BY-NC-SA 4.0». En el último
  segundo, fundido a tinta junto con el acorde final.

**Voz y subtítulos**

| Tiempo | Voz (hablado) | Subtítulo |
|---|---|---|
| 4:08.68–4:13.37 | El impacto: decisiones de reforestación con respaldo probabilístico, | El impacto: decisiones de reforestación / con respaldo probabilístico, |
| 4:13.72–4:18.06 | que cuidan el dinero público y la supervivencia de cada planta, | que cuidan el dinero público / y la supervivencia de cada planta, |
| 4:18.41–4:22.27 | y un método abierto que puede repetirse en otros sitios. | y un método abierto / que puede repetirse en otros sitios. |
| 4:22.62–4:26.42 | Plantar es fácil. Lograr que sobreviva: ese es el reto. | Plantar es fácil. / Lograr que sobreviva: ese es el reto. |

---

## 6. Fuente de cada cifra

Ninguna cifra se escribe a mano en el código de las escenas: se leen de los datos. Si una cifra no
está en `datos.js`, se agrega a `scripts/datos_presentacion.py` (o a un `datos_video.js` hermano) y no
se codifica en duro.

| Cifra | Valor | Fuente |
|---|---|---|
| Superficie, polígonos | 183.01 ha, 30 | `datos.js` → `totales` |
| Meta por hectárea | 658 | `totales.meta_ha` |
| Especies, supervivencia | 10; *q* de 0.8214 a 0.9587 (mortalidad del 4 al 18 %) | `especies.csv` |
| Hectárea de 14 × 47 y meta por especie | 658 posiciones; 39/196/38/39/54/41/80/70/77/24 | `simulacion_siembra.py` (tabla de siembra del reporte); exportar a JSON |
| Presupuesto | $12,500/ha | `totales.presupuesto` |
| Clave vigente | 22 posiciones | `clave_vigente.csv` |
| Ejemplo de compra | *A. salmiana*, polígono 1: meta 252, existentes 46, compra 220, 96 % | `datos.js` → `escenarios` |
| Compra total | 108,680 plantas; 593.8 + 128.8 = 722.6/ha | `totales` |
| Presupuesto mínimo | $14,496/ha (14,496.10 MC, 14,496.02 exacto) | `totales.B_min`; frontera exacta: **hay que agregarla** (`refor frontera --metodo exacto -f csv`) |
| Frontera | α 0.01–0.50: $14,664 → $14,117 (−3.7 %) | `datos.js` → `frontera` |
| Faltante total | $365 mil | reporte, `resultados.tex`; recalcular de `frontera` y `area` |
| Matriz W | 10 × 10, de 0.17 a 1.50 | `competencia.csv` / `datos.js` → `W` |
| Mosaico de la clave 1 | azar 93.34 (esperado), 90.9 (realización del GIF), memético 78.18, cota 74.70, brecha 4.46 % | `datos.js` → `mosaicos[0]` |
| Reducción | −16 % (0.1619 ponderado) | `totales.reduccion` |
| Seis claves | 18/5/1/1/4/1 polígonos | `datos.js` → `mosaicos[*].poligonos` |
| Terminal | Salida textual | `./build/refor frontera -f tabla` en este momento, guardada en `docs/res/` |

---

## 7. Arquitectura técnica

```
scripts/expoing/video/
  tiempos.py              fuente de verdad del texto y los tiempos (ya existe)
  datos_video.py          junta datos.js + lo que falte (frontera exacta, hectárea) → datos_video.js
  motor.js                escenario 1920×1080, cámara, capas, curvas, subtítulos, iris, utilidades
  escenas/e01_gancho.js … e11_cierre.js
                          cada una: { id, construir(escenario), tick(t_local) } — función PURA de t
  vendor/katex/           KaTeX fijado, con sus fuentes
  previsualizar.html      línea de tiempo con barra de arrastre, reproducción con audio, saltos por escena
  renderizar.py           Playwright (Chromium) → PNG por cuadro → ffmpeg; paralelo por tramos
  video_guia.py           renderiza el video guía para la grabación (sección 8.4)
  alinear.py              alineación forzada voz ↔ guion (faster-whisper, marcas por palabra)
  mezclar.py              voz + música + efectos → mezcla final (ffmpeg)
  capturar_gui.py         grabación de refor_gui (con captura/captura_gui.cpp; sección 8.5)
docs/expoing/video/
  PLAN.md                 este documento
  linea_de_tiempo.json    generado por tiempos.py
  guion.srt               subtítulos de borrador (generado)
  CREDITOS.md             música, efectos y licencias
  voz/                    tomas de Andrea (WAV); no se versionan si pesan mucho
  salida/                 refor_expoing_2026.mp4 y .srt (ignorado por git)
```

**Determinismo (invariante del repositorio).** `tick(t)` no usa `Date`, `performance.now`,
`requestAnimationFrame` ni `Math.random`. El azar viene de `mulberry32` con semillas fijas, igual que
en `piezas.js`. Dos renders del mismo cuadro deben ser idénticos byte por byte (se comprueba en el QA).

**Reutilización.** `scripts/expoing/piezas.js` ya tiene el mapa, el histograma de temporadas, el
mosaico que se reordena (versión A), la paleta, `mulberry32` y los logos. Hay que extraer lo común a
un módulo compartido sin romper `scripts/exportar_expoing.py`; después de refactorizar, hay que
volver a exportar las piezas y verificar que los PNG no cambian.

**Render.** El enfoque de `exportar_expoing.py` (un proceso de Chrome por captura) es demasiado lento
para ≈ 16,200 cuadros. En su lugar se usa Playwright con **una página por trabajador**: para cada
cuadro *k* se llama `await page.evaluate(t => window.__video.tick(t), k/60)`, se toma
`page.screenshot()` y los bytes van por tubería a `ffmpeg -f image2pipe`. Con 6 a 8 trabajadores,
cada uno renderiza un tramo a un archivo intermedio sin pérdida (`-c:v libx264 -qp 0` o ProRes), y al
final se concatenan. Las fuentes se esperan con `document.fonts.ready`.

**Exportación final.**
`ffmpeg … -c:v libx264 -preset slow -crf 18 -profile:v high -level 4.2 -pix_fmt yuv420p -r 60 -c:a aac -b:a 192k -ar 48000 -movflags +faststart refor_expoing_2026.mp4`

---

## 8. Flujo de producción (en orden)

### 8.1 Fase 0 · Confirmar lo pendiente

Resolver la lista de la sección 11 con el equipo antes de escribir código.

### 8.2 Fase 1 · Rebanada vertical

Implementar `motor.js`, `previsualizar.html`, el render y **solo E1 y E2**, con subtítulos y la música
provisional. Exportar 20 s en MP4 y **detenerse para que el equipo apruebe el look** (color, tipos,
movimiento, subtítulos). No seguir sin esa aprobación.

### 8.3 Fase 2 · Animatic completo

Todas las escenas con los tiempos de `linea_de_tiempo.json`, subtítulos de borrador y sin voz. Para
revisar el ritmo sin voz humana, se permite generar una **voz provisional TTS solo para la
revisión interna**; nunca entra a la mezcla final. Revisión del equipo en `previsualizar.html`.

### 8.4 Fase 3 · Video guía y grabación

- `video_guia.py` renderiza, por escena, un MP4 del animatic con:
  - una cuenta regresiva de 3 s en grande antes del primer subtítulo de la escena;
  - arriba, a modo de teleprompter, el **texto hablado** (no el subtítulo con cifras), con la frase
    actual resaltada y la siguiente en gris;
  - una barra de progreso de la frase.
- Andrea graba **11 tomas** viendo el video guía en silencio, con audífonos sin música. Entrega
  `voz/E01.wav … voz/E11.wav`.

### 8.5 Fase 4 · Pruebas: GUI y terminal

- **Terminal:** correr `./build/refor frontera -f tabla` (y, si hace falta, `refor compra --alpha 0.05
  -B 12500`), guardar la salida en `docs/res/` y renderizar la tarjeta de terminal a partir de ese
  texto, sin editarlo.
- **GUI:** compilar `refor_gui` en Release, abrirlo con `data/processed` y grabar con
  `ffmpeg -f avfoundation -framerate 60 -capture_cursor 1 -i "<pantalla>:none"`, recortando a la
  ventana. Lista de tomas:
  1. ventana con los datos cargados (2 s);
  2. ajustar α = 0.05 y B = 12,500 (3 s);
  3. ejecutar el plan, con la barra de progreso (≤ 3 s; si tarda más, se acelera y se marca «×4»);
  4. la vista del mosaico de la clave 1 (2 s);
  5. la tabla de compra por polígono (2 s).
  macOS pedirá permiso de **Grabación de pantalla** para la terminal; hay que pedírselo al usuario. Para
  los clics: si hay herramientas de *computer use* disponibles, se usan; si no, el usuario sigue la
  lista de tomas mientras el script graba. La ventana debe tener un tamaño fijo (por ejemplo 1600 ×
  900) y el cursor debe moverse con calma.

### 8.6 Fase 5 · Alineación y mezcla

- `alinear.py`: faster-whisper con marcas por palabra sobre cada toma, alineado contra el texto
  hablado conocido (no contra la transcripción). Cada toma se coloca al inicio de su escena. Si dura
  dentro de ±8 % de lo planeado, se ajusta y los subtítulos toman los **tiempos reales**; las
  animaciones ancladas a frases (encendido de términos, nombres, contadores) se mueven con ellas,
  porque cada evento de animación se define relativo a un subtítulo (`cue` + desfase) y no en tiempo
  absoluto.
- `mezclar.py`: edición de la música según §4.2, *ducking*, efectos, `loudnorm` a −16 LUFS integrados
  con −1 dBTP.

### 8.7 Fase 6 · Render final y QA

Render a 60 fps, exportación, QA (sección 10) y entrega al equipo para subirlo a la plataforma.

---

## 9. Regla para anclar animaciones

Para que un ajuste de la voz no rompa la sincronía, **todo evento de animación ligado a la voz se
define como `{cue: <índice de subtítulo>, desfase: <s>}`** y no en segundos absolutos. Los movimientos
que no dependen de la voz (amanecer, iris, toma aérea) se anclan al inicio o al final de la escena. Así,
cuando `alinear.py` reescribe los tiempos de los subtítulos, la animación se recalcula sola.

---

## 10. Criterios de aceptación (QA)

- [ ] `ffprobe`: duración entre 3:00 y 5:00 (objetivo de 4:15 a 4:35), H.264 High con yuv420p,
      1920 × 1080, 60 fps, AAC a 48 kHz.
- [ ] Nombre del archivo ≤ 30 caracteres: `refor_expoing_2026.mp4`.
- [ ] Todos los renglones de la sección 2 se ven y se oyen en sus marcas de tiempo.
- [ ] Ningún elemento invade la franja de subtítulos (prueba automática: renderizar cada escena sin
      subtítulos y comprobar que los píxeles de y ≥ 912 solo contienen la carta o papel).
- [ ] Subtítulos: ≤ 2 líneas, ≤ 50 caracteres por línea, ≥ 1.2 s, sin traslapes, y coinciden palabra por
      palabra con la voz real (salvo números con letra frente a cifras).
- [ ] Cada cifra en pantalla coincide con su fuente de la sección 6 (script de verificación que compara
      contra `datos.js`).
- [ ] Determinismo: 20 cuadros al azar renderizados dos veces con hash idéntico.
- [ ] Mezcla: −16 LUFS integrados ±1, pico real ≤ −1 dBTP, la voz inteligible sobre la música en
      todo momento.
- [ ] Créditos de la música con intérprete y licencia en la tarjeta final y en `CREDITOS.md`.
- [ ] Nombres propios con la ortografía confirmada (sección 11).
- [ ] Ninguna mención explícita del socioformador por su nombre: `grep -ri conafor --exclude=PLAN.md`
      sobre `docs/expoing/`, `scripts/expoing/` y el `.srt` final no da resultados. Revisar también,
      cuadro por cuadro, la grabación de la GUI y la tarjeta de terminal (hoy, ni `src/` ni `gui/`
      muestran ese nombre).
- [ ] El equipo revisó el MP4 completo antes de subirlo.

---

## 11. Pendientes por confirmar con el equipo

1. ~~¿Alvarez o Álvarez?~~ Resuelto: **Irasema Álvarez**, con acento (el reporte final dice «Alvarez» y conviene corregirlo).
2. ¿Va «MA2004B» en la tarjeta de título? ¿Se agrega «Grupo 202»? La voz dice «equipo cinco», que viene del
   reporte.
3. ¿Les parece bien la frase «Hoy, la compra se estima a ojo» (E4), frente al socioformador?
   Una alternativa más neutra: «Hoy, la compra se calcula sin medir el riesgo».
4. Escuchar la grabación de Giorgi Latso (§4.2) y aprobar la edición musical. Si no convence, el respaldo
   es la de Salvatori. Confirmar que el equipo acepta publicar el video bajo CC BY-NC-SA 4.0.
5. Dar permiso de grabación de pantalla en macOS para la captura de `refor_gui`.
6. ¿Se mantiene el objetivo de 4:15? El guion calculado dura 4:30 a ritmo tranquilo; si se quiere más
   corto, los candidatos a recortar son la línea «Ni aceptar 50 veces más riesgo» (E7, 6 s) y la de
   «Windows, macOS y Linux» (E10, 4 s).
