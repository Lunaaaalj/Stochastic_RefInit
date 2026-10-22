# Diseño del deck ejecutivo: «Carta de campo»

Presentación ejecutiva del proyecto para CONAFOR. Es un deck en HTML y CSS con
comportamiento de sitio web: un mapa persistente con cámara, transiciones
fluidas y gráficas hechas con los datos reales del modelo.

Este documento fija la identidad visual, la estructura de las láminas y el
sistema de movimiento. Quedan pendientes, y se definen más adelante, la
duración de la presentación y el guion de la demo en vivo de `refor_gui`.

---

## 1. Concepto

El deck se siente como el **cuaderno de campo de un levantamiento botánico**:
carta topográfica, lámina de herbario y libreta del técnico, con un acabado
editorial. Es un lenguaje que CONAFOR reconoce (cartas INEGI, fichas de
especies, planos de plantación).

- **Lo memorable es el mapa con cámara.** Toda la audacia visual se gasta ahí.
- **Lo demás va callado.** Texto, gráficas y paneles son anotaciones sobre la
  carta y nunca compiten con ella.
- **Todo en papel claro.** No hay variante oscura; el ritmo entre láminas se
  marca con la cámara y con la composición, no invirtiendo colores.

### Principios

1. **Cada visual es un dato.** El mapa, el mosaico y las gráficas salen de
   `data/processed/` y de la salida de `refor`, nunca de imágenes ilustrativas
   con cifras inventadas.
2. **La animación explica.** Cada movimiento cuenta una parte del razonamiento
   (de la región al hexágono, de lo aleatorio a lo óptimo). Si no explica
   nada, no se anima.
3. **Un solo momento estelar.** El mosaico que se reordena (lámina 9) es el
   único espectáculo; lo demás se mueve con discreción.
4. **La conclusión va primero.** El veredicto (presupuesto insuficiente,
   cuánto comprar, cuánto mejora la siembra) aparece en la lámina 2; el método
   es respaldo.
5. **Nada de cromo de plantilla.** Sin etiquetas en mayúsculas espaciadas sobre
   los títulos, sin palabras sueltas resaltadas en los titulares, sin
   numeración `01 / 02` donde el contenido no es una secuencia.

---

## 2. Color

### Paleta de marca

| Token | Hex | Uso |
|---|---|---|
| `--papel` | `#FCF0DA` | Fondo de la carta y de los paneles |
| `--tierra` | `#4C4541` | Tinta: texto, contornos, ejes; género *Otras* |
| `--salvia` | `#AEAC78` | Género *Agave*; curvas de nivel |
| `--ocre` | `#F2C46A` | Género *Opuntia*; zona de brecha en gráficas sin especies |

### Derivados

| Token | Hex | Contraste sobre papel | Uso |
|---|---|---|---|
| `--tinta` | `#2E2A27` | 12.6 : 1 | Abreviaturas sobre rellenos claros de especie; autores en el cuadro de título de la portada |
| `--salvia-oscura` | `#26331C` | 11.8 : 1 | Título de la portada, sobre el papel opaco del cuadro de título |
| `--tierra-suave` | `#6E655F` | 5.1 : 1 | Texto secundario, ejes y rotulación del mapa |
| `--salvia-honda` | `#6F6D43` | 4.7 : 1 | Texto de acento verde |
| `--ocre-hondo` | `#8C6418` | 4.7 : 1 | Texto de acento dorado, cifras destacadas, contorno de resaltado, línea del presupuesto |
| `--papel-hondo` | `#F3E2C2` | — | Fondo de tablas y zonas sombreadas |
| `--linea` | `#4C4541` al 15 % | — | Bordes finos de paneles y divisiones |

**Reglas de contraste.** `--salvia` (2.1 : 1) y `--ocre` (1.5 : 1) **nunca** se
usan para texto sobre papel; solo como relleno. Todo texto de acento usa la
variante honda. El texto principal es `--tierra` (8.3 : 1).

### Colores de especie

La paleta de marca es también la leyenda de la plantación: cada género toma un
color base y sus especies, tonos de ese color. Estos valores también rigen
`refor_gui` (compromiso de `PRODUCT.md`): la GUI los toma de esta tabla y no
define otros.

| Género | Especie | Abrev. | Relleno | Texto encima | Contraste |
|---|---|---|---|---|---|
| *Agave* | *A. lechuguilla* | Ale | `#C9C79E` | tinta | 8.2 : 1 |
| | *A. salmiana* | Asa | `#AEAC78` | tinta | 6.1 : 1 |
| | *A. scabra* | Asc | `#6F6D43` | papel | 4.7 : 1 |
| | *A. striata* | Ast | `#5F5D34` | papel | 6.0 : 1 |
| *Opuntia* | *O. robusta* | Oro | `#F6D693` | tinta | 10.1 : 1 |
| | *O. streptacantha* | Ost | `#F2C46A` | tinta | 8.7 : 1 |
| | *O. cantabrigiensis* | Oca | `#D9A646` | tinta | 6.4 : 1 |
| | *O. engelmannii* | Oen | `#8C6418` | papel | 4.7 : 1 |
| *Otras* | *Prosopis laevigata* | Pla | `#4C4541` | papel | 8.3 : 1 |
| | *Yucca filifera* | Yfi | `#766A63` | papel | 4.6 : 1 |

*A. salmiana*, la especie más abundante (27–29 % del mosaico), lleva el color
base de su género, igual que *O. streptacantha*, la Opuntia más abundante. Las
abreviaturas son las de la clave del mosaico (`espacial.json`) y siempre van
escritas en el hexágono, en Instrument Sans 500, con al menos 4.5 : 1 sobre su
relleno. Sobre rellenos claros se usa `--tinta` (`#2E2A27`) en lugar de
`--tierra`, que no alcanza ese contraste sobre los tonos medios.

**Los tonos de un mismo género solo se distinguen con su abreviatura.** Entre
vecinos del mismo género el contraste es de 1.16 a 2.4 : 1 (*O. robusta* y
*O. streptacantha*, 1.16 : 1), y los rellenos claros casi no se separan del
papel (*O. robusta*, 1.24 : 1). Por eso:

- Todo hexágono lleva contorno de 0.75 px en `--tierra-suave` (al menos
  3.3 : 1 contra cualquier relleno claro y 5.1 : 1 contra el papel), sin
  separación de papel entre hexágonos.
- Cuando el hexágono es demasiado chico para su abreviatura, se colorea **por
  género** con el color base (*Agave* `#AEAC78`, *Opuntia* `#F2C46A`, *Otras*
  `#4C4541`), no por especie. Los tres colores base se distinguen también con
  deuteranopía y protanopía simuladas. Los umbrales están en la sección 5.

### Resaltado

El ocre ya significa *Opuntia*, así que **el resaltado nunca es un relleno**.
El polígono activo, el hexágono bajo el cursor y el mosaico elegido se marcan
con un contorno de 2.5 px en `--ocre-hondo`; el relleno no cambia. El relleno
`--ocre` fuera del mosaico solo aparece como zona de brecha (al 35 %) en
gráficas donde no hay especies (lámina 8).

### Rampa secuencial

Para las coropletas (láminas 7 y 8) y la vista de competencia del mosaico
(lámina 9). Sale de la marca: interpolada en OKLab de `--papel-hondo` a
`--salvia` y `--salvia-honda`. Cinco clases, con la leyenda escrita junto al
mapa.

| Token | Hex | Contraste sobre papel | Rótulo encima | Contraste del rótulo |
|---|---|---|---|---|
| `--sec-1` | `#F3E2C2` | 1.1 : 1 | tinta | 11.2 : 1 |
| `--sec-2` | `#C2BB8D` | 1.7 : 1 | tinta | 7.3 : 1 |
| `--sec-3` | `#969464` | 2.8 : 1 | tinta | 4.6 : 1 |
| `--sec-4` | `#64623D` | 5.6 : 1 | papel | 5.6 : 1 |
| `--sec-5` | `#3B3A26` | 10.2 : 1 | papel | 10.2 : 1 |

Todo paso admite rótulo de al menos 4.5 : 1, porque en la vista de competencia
la abreviatura no puede salir del hexágono. `--sec-3` es el tono más oscuro de
la interpolación con el que la tinta aún llega a 4.5 : 1, y `--sec-2` queda a
medio camino entre el 1 y el 3; los saltos de luminosidad (OKLab) van de 0.13 a
0.17.

En el mapa no hay especies cuando se usa la rampa, así que su tono verde no se
confunde con *Agave*. En la vista de competencia del mosaico, la abreviatura
sigue escrita en el hexágono para no perder la especie.

### Series que no son especies

| Serie | Tratamiento | Lámina |
|---|---|---|
| Azar | Contorno de 1.25 px en `--tierra-suave`, sin relleno | 10 |
| Memético | Relleno `--salvia-honda` | 10 |
| Exacto | Relleno `--tierra` | 10 |
| Cota inferior del exacto | Línea discontinua de 1.25 px en `--tierra` | 10 |
| Frontera B\*(α) | Línea de 2 px en `--tierra` | 8 |
| Presupuesto disponible | Línea discontinua de 2 px en `--ocre-hondo`, con rótulo directo | 2, 8 |
| Brecha de presupuesto | `--ocre` al 35 % entre la frontera y el presupuesto | 8 |

El azar es la referencia, así que va hueco; memético y exacto van llenos y se
distinguen además por su rótulo directo.

---

## 3. Tipografía

| Rol | Familia | Pesos | Notas |
|---|---|---|---|
| Título de la portada | **Bodoni Moda**, corte de 72 pt | 700 | Solo en la lámina 1, a 60 px; elegido por el equipo |
| Títulos y cifras grandes (≥ 48 px) | **Libre Caslon Display** | 400 | Contraste alto, pensada para tamaños grandes |
| Cuerpo, subtítulos y binomiales | **Libre Caslon Text** | 400, *400 itálica*, 700 | Más robusta para leerse proyectada |
| Rotulación técnica | **Instrument Sans** | 400, 500 | Ejes, etiquetas de gráficas, coordenadas, escala |

Las cuatro se sirven localmente desde `fuentes/` (woff2, licencia OFL en
`fuentes/OFL.txt`), así que el deck funciona sin red.

### Escala (lienzo de 1920 × 1080)

Cada paso multiplica el anterior por 1.333 (la cuarta justa, 4 : 3; no es la
proporción de la pantalla). `--t-3xl` se sale de la escala a propósito: las
cifras protagonistas saltan directo de 67 px a 120–160 px.

| Paso | Tamaño | Familia | Interlineado | Uso |
|---|---|---|---|---|
| `--t-xs` | 16 px | Instrument Sans | 1.3 | Rotulación del mapa, notas de fuente |
| `--t-s` | 21 px | Instrument Sans / Caslon Text | 1.4 | Etiquetas de gráficas, pies |
| `--t-m` | 28 px | Caslon Text | 1.5 | Cuerpo |
| `--t-l` | 37 px | Caslon Text | 1.35 | Subtítulos, frases de apoyo |
| `--t-xl` | 50 px | Caslon Display | 1.15 | Título de lámina |
| `--t-2xl` | 67 px | Caslon Display | 1.1 | Títulos de portada y cierre |
| `--t-3xl` | 120–160 px | Caslon Display | 1.0 | Cifras protagonistas |

- **Binomiales siempre en itálica** (*Prosopis laevigata*), como en botánica.
  Es el único uso de la itálica para nombres; los demás énfasis se resuelven
  con la composición, no con cursivas sueltas.
- **Cifras:** en las tablas, figuras tabulares (`font-variant-numeric:
  tabular-nums`) para que las columnas se alineen. En el texto corrido se
  prueban las elzevirianas (`onum`), si Libre Caslon las trae.
- **Largo de línea:** máximo 60 a 70 caracteres en paneles; el cuerpo serif
  lleva un interlineado un poco más abierto que una sans.
- **Mayúsculas:** solo en siglas (CONAFOR, INECOL, UTM). Las etiquetas van en
  minúscula inicial.

---

## 4. Ilustración: láminas de herbario

Las especies se presentan como **ejemplares de herbario**: dibujo lineal sobre
papel, con su etiqueta de colecta.

- **Trazo:** línea continua en `--tierra`, de 1.25 a 1.5 px a tamaño final, con
  sombreado por achurado fino y nunca degradados.
- **Color:** una sola aguada plana con el color de la especie (tabla de la
  sección 2) al 35–50 %, desfasada unos píxeles del trazo, como acuarela de
  lámina antigua.
- **Etiqueta de herbario:** recuadro de borde fino en la esquina inferior
  derecha, con el binomial en itálica, el género y un dato del modelo
  (supervivencia *q*, costo *c*). Este recuadro es también el motivo de las
  fichas de especie en el resto del deck.
- **Formato:** SVG, una pieza por especie (10 en total), con encuadre y escala
  coherentes entre sí.
- **Origen:** dibujos propios o láminas de dominio público, por ejemplo de la
  Biodiversity Heritage Library, vectorizadas y simplificadas al mismo
  trazo. Hay que verificar la licencia de cada lámina.

---

## 5. El escenario persistente: mapa con cámara

El mapa real de los 30 polígonos queda fijo detrás de todas las láminas. Lo
único que cambia entre una y otra es el **encuadre de una cámara**; las láminas
son paneles que flotan encima.

### Narrativa de escalas

```
Región ──► Sitio (30 polígonos) ──► Un polígono ──► La retícula ──► El mosaico ──► De regreso al sitio
 SLP        183 ha                   1.28 ha          tresbolillo     52 posiciones    todo plantado
```

### Datos

- **Contornos:** `data/processed/mapa.csv`, en UTM. Como UTM ya es una proyección
  plana en metros, las coordenadas se usan directo en el `viewBox` del SVG, sin
  bibliotecas de mapas ni *tiles* externos. Los convierte a metros locales
  `scripts/datos_presentacion.py`, que escribe todo lo que usa el deck en
  `docs/presentacion/datos/datos.js`.
- **Numeración:** `mapa.csv` trae dos números. `etiqueta` es el del plano de
  INECOL y `poligono` es el ID del programa, el mismo de `poligonos.csv` y de
  todas las tablas de `refor` (el polígono 1 es la etiqueta 27). El deck
  **rotula y encuadra siempre por ID del programa**; la etiqueta del plano solo
  aparece en el tooltip («etiqueta 27 del plano INECOL»).
- **Precisión:** los vértices se digitalizaron a mano (±5 m; ver
  `scripts/digitalizar_mapa.py`). Sirven para mostrar la disposición, no como
  deslinde, y así se aclara en una nota de fuente.
- **Polígono fuera del programa:** la etiqueta 29 del mapa (6.54 ha) no está en
  `poligonos.csv`. Se dibuja con contorno punteado y sin relleno.
- **Retícula:** al tresbolillo con espaciado *d* ≈ 4.19 m, que corresponde a 658
  plantas/ha ( *d*² · √3/2 = 10 000 / 658 m² ).

### Encuadres por lámina

| # | Lámina | Cámara | Qué cambia en el mapa |
|---|---|---|---|
| 1 | Portada | Cenital y fija (`hoja`), el sitio a la derecha de la hoja | Los polígonos se plantan en ondas con su clave; resalta el polígono 29, que se amplía en el detalle |
| 2 | Resumen | Se aleja; el mapa queda a un lado, más tenue | Pasa a segundo plano |
| 3 | El reto | Cenital, encuadra los 30 polígonos | Los contornos se trazan y aparecen sus ID del programa |
| 4 | Dos preguntas | Zoom al polígono 1 | Aparece la retícula vacía |
| 5 | Incertidumbre | Sobre el polígono 1 | Las plantas existentes parpadean |
| 6 | Método | Vista del sitio | Un pulso recorre los polígonos siguiendo la tubería |
| 7 | Compra | Vista del sitio | Coropleta de plantas/ha |
| 8 | Presupuesto | Vista del sitio | Coropleta de B\*/ha; resaltan los polígonos 1 y 4, los más caros |
| 9 | Mosaico | Zoom profundo a la retícula | La retícula se vuelve el mosaico real y se reordena |
| 10 | Validación | Se aleja un poco | El mosaico se tesela sobre todo el polígono |
| 11 | Herramienta | El mapa se encoge a la ventana de la GUI | Liga el mapa con `refor_gui` |
| 12 | Visor | Igual que la 11; el mapa queda detrás del visor | El visor de `docs/visor/` embebido y operable |
| 13 | Recomendaciones | Vista del sitio, tenue | Capas futuras punteadas: agua, pendiente, suelo |
| 14 | Cierre | Lejana e inclinada (perspectiva suave), con deriva lenta | Todos los polígonos plantados |

### Implementación

- Cada `<section>` declara su encuadre (`data-cam="sitio"`,
  `data-cam="poligono:1"`, `data-cam="reticula:1"`). Un controlador interpola
  el `viewBox` entre el encuadre actual y el siguiente, así que la navegación
  funciona igual hacia adelante y hacia atrás. El número en `poligono:N` es el
  ID del programa.
- Los detalles se muestran según el tamaño del hexágono en el lienzo de
  1920 × 1080:

  | Hexágono | Se dibuja |
  |---|---|
  | ≥ 32 px | Color de especie, contorno y abreviatura |
  | 6–32 px | Color de género y contorno, sin abreviatura |
  | < 6 px | El polígono relleno con un `<pattern>` del mosaico por género |

- El mosaico es periódico (por eso la réplica 3 × 3), así que teselarlo con un
  `<pattern>` de SVG es fiel al modelo y evita dibujar más de 100,000
  hexágonos en la vista del sitio.
- **Rendimiento.** Cada cuadro de la cámara obliga al navegador a volver a
  maquetar y pintar todo el SVG, así que:
  - las curvas de nivel van en un `<canvas>` bajo el SVG, partidas en bloques,
    y solo se trazan los bloques visibles;
  - una capa desvanecida sale del render con `display: none`;
  - la teselación de la lámina 10 y los polígonos plantados son un solo trazo
    con `<pattern>`, no un elemento por hexágono;
  - la inclinación y la deriva del cierre, y el atenuado del mapa, son
    `transform` y `opacity` de CSS sobre capas compuestas (`#vista`, `#giro`):
    no repintan el mapa.
- Al imprimir, cada lámina lleva su encuadre final, pero sin curvas de nivel.

### Estilo cartográfico

| Elemento | Tratamiento |
|---|---|
| Curvas de nivel | `--salvia`, 0.75 px al 35 %; una de cada cinco más gruesa (curva maestra), como en las cartas INEGI. Son estilizadas (campo suave generado), no topografía real, y así se indica |
| Polígonos | Contorno `--tierra` de 1.25 px y relleno `--papel` translúcido. Activo: contorno de 2.5 px en `--ocre-hondo`, sin cambiar el relleno (sección 2, Resaltado) |
| Rotulación | Instrument Sans `--t-xs` en `--tierra-suave`: coordenadas UTM de la esquina, escala gráfica y norte, que se actualizan con la cámara |
| Norte | Rosa de los vientos sencilla y lineal. El tresbolillo se eligió por los vientos de la zona, así que el viento tiene sentido en la composición |
| Textura | Grano de papel, ruido SVG al 3–4 % |

---

## 6. Composición

El mapa ocupa siempre toda la pantalla. El contenido entra en una de tres
composiciones, según dónde deje espacio la cámara; la portada tiene la suya
(«Hoja de carta», abajo):

```
  A · Anotación lateral          B · Lámina de datos             C · Titular sobre el terreno
┌───────────────────────────┐  ┌───────────────────────────┐  ┌───────────────────────────┐
│ ░░░░░░░░░░░░ ┌─────────┐  │  │ ░░┌───────────────────┐░░ │  │ ░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░ mapa ░░░░ │ Título  │  │  │ ░░│ Título            │░░ │  │ ░░░  Grande, serif,  ░░░ │
│ ░░ (cámara) ░│ texto   │  │  │ ░░│ ▇▇▇▇▅▅▃▃ gráfica  │░░ │  │ ░░░  sobre el mapa   ░░░ │
│ ░░░░░░░░░░░░ │ breve   │  │  │ ░░│                   │░░ │  │ ░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░ └─────────┘  │  │ ░░└───────────────────┘░░ │  │ ░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ∙∙∙∙∙∙∙∙∘∘∘∘∘∘∘           │  │ ∙∙∙∙∙∙∙∙∙∙∘∘∘∘∘           │  │ ∙∙∘∘∘∘∘∘∘∘∘∘∘∘∘           │
└───────────────────────────┘  └───────────────────────────┘  └───────────────────────────┘
  láminas 3–6, 12                 láminas 7, 8, 10, 11            láminas 2, 9, 13
```

- **Lienzo:** 1920 × 1080 escalado a la ventana (16 : 9), con márgenes de
  96 px a los lados y 80 px arriba y abajo.
- **Alineación a la izquierda**, como notas de campo. Solo el cierre va
  centrado.
- **Paneles de papel, no tarjetas:** `--papel` al 92 % sobre el mapa, borde de
  1 px en `--linea`, sombra cálida muy difusa (`0 18px 48px` con `--tierra` al
  8–10 %) y esquinas de 2 px, como hoja recortada.
- **Sin variante oscura.** Las láminas C (2, 9 y 13) se distinguen por
  composición: titular grande directo sobre el mapa, sin panel.
- **Portada: hoja de carta.** La lámina 1 es una hoja de carta topográfica, no
  un titular sobre el mapa: el título nunca va encima de los polígonos
  plantados, porque su textura (un hexágono por planta, de 1 px a esta
  escala) le quita lectura a cualquier texto.
  - Margen de papel opaco y marco doble (1.5 px y 0.75 px en `--tierra`). En el
    margen, la cuadrícula UTM cada 500 m en Instrument Sans 18 px con los
    dígitos que se repiten a 13 px, como en las cartas INEGI; dentro, cruces de
    18 px en las intersecciones. Todo sale de `origen_utm` y de la cámara
    `hoja`, que no gira ni se inclina para que las coordenadas sean exactas.
  - Cuadro de título a la izquierda: papel opaco, borde de 1 px en `--tierra`,
    sin sombra, en tres compartimentos separados por `--linea`: título y
    subtítulo; leyenda por género con los datos del sitio; autores e
    institución.
  - Detalle circular del polígono 29 (clave 1) con hexágonos de 15 px por
    género, unido con una línea a su lugar en el mapa. Hace legible la leyenda,
    que en la vista del sitio no se distingue.
- **Controles en C.** La lámina 9 necesita el conmutador género/competencia y
  la réplica 3 × 3. Van en una tira mínima de papel al pie, alineada a la
  izquierda, en Instrument Sans `--t-s`; no se convierte en panel.

---

## 7. Elementos gráficos

| Elemento | Tratamiento |
|---|---|
| Hexágonos del mosaico | Relleno por especie (sección 2), contorno de 0.75 px en `--tierra-suave`, abreviatura en Instrument Sans; por género cuando no cabe la abreviatura |
| Gráficas | Sin cuadrícula de fondo, solo el eje base. Etiquetas directas en lugar de leyendas. Colores planos por especie o género; las series que no son especies usan su tabla de la sección 2. Solo SVG |
| Coropletas | Rampa secuencial de cinco clases (sección 2), con la leyenda escrita junto al mapa |
| Cifras protagonistas | Caslon Display grande junto a una referencia física (por ejemplo, la barra del presupuesto disponible quedándose corta), nunca un número suelto con gradiente |
| Fichas de especie | El recuadro de la etiqueta de herbario (sección 4) |
| Barra de avance | Hilera de puntos al tresbolillo en la base de la pantalla; cada lámina vista "planta" (rellena) los suyos |
| Notas de fuente | Instrument Sans `--t-xs`, al pie del panel: «Fuente: INECOL; modelo `refor`, semilla 42» |

---

## 8. Movimiento

**Regla principal:** la cámara es el único movimiento protagonista. Todo lo
demás la sigue y no compite con ella.

| Tipo | Duración | Curva | Uso |
|---|---|---|---|
| Cámara | 1.4–1.8 s | `cubic-bezier(.65, 0, .35, 1)` | Cambio de encuadre del mapa |
| Contenido | 450 ms; empieza cuando la cámara va al 70 % | `cubic-bezier(.2, .7, .2, 1)` | Fundido y barrido de máscara de izquierda a derecha, como tinta que se escribe |
| Datos | 600–900 ms | `cubic-bezier(.2, .7, .2, 1)` | Barras que crecen, curvas que se trazan; solo en láminas de resultados |
| Momento estelar | ≈ 2.5 s, coreografiado | por elemento | El mosaico de la lámina 9 pasa de una asignación al azar a la óptima |
| Respuesta | 150–200 ms | `cubic-bezier(.2, .7, .2, 1)` | Hover sobre polígonos, conmutadores |

- **Hacia atrás:** la cámara hace el recorrido inverso y el contenido aparece
  sin animación de entrada.
- **`prefers-reduced-motion`:** la cámara cambia de encuadre con un fundido y
  las gráficas aparecen ya completas.
- **Prohibido:** entradas «fade y sube» en cada elemento, rebotes, parallax
  sobre texto, animaciones en bucle salvo la deriva del cierre.

### Navegación

Flechas, barra espaciadora, `Re Pág` y `Av Pág`; `F` para pantalla completa;
`Inicio` y `Fin`. La URL refleja la lámina (`#7`) para poder recargar sin
perder el lugar. `@media print` exporta una lámina por página con la cámara en
su encuadre final.

---

## 9. Estructura de las láminas

| # | Lámina | Mensaje | Visual principal | Composición |
|---|---|---|---|---|
| 1 | Portada | «Procesos estocásticos y metaheurísticos en la modelación de una iniciativa de reforestación», equipo, CONAFOR, fecha | Hoja de carta: el sitio plantado en ondas desde el centro, cuadrícula UTM y detalle del mosaico | Hoja |
| 2 | Resumen | **$14,496/ha** de presupuesto mínimo · **108,680 plantas** · **−16 % de competencia** | Las cifras frente a la barra de $12,500/ha disponibles | C |
| 3 | El reto | 183 ha, 30 polígonos (1.28–8 ha), 10 especies, 658 plantas/ha | El mapa se revela; tooltip por polígono | A |
| 4 | Dos preguntas | ¿Cuántas plantas comprar? ¿Dónde plantar cada una? | Láminas de herbario de las 10 especies, por género | A |
| 5 | Lo que no sabemos | Mortalidad, plantas existentes, competencia | Supervivencia *q* por especie con banda de incertidumbre | A |
| 6 | Cómo lo resolvimos | Datos INECOL → 10,000 escenarios → compra óptima → mosaico | Tubería de 4 pasos con mini-visual por nodo (secuencia: aquí sí se numera) | A |
| 7 | La compra | 594 plantas/ha + 129 existentes = 723/ha (10 % sobre la meta); Opuntia +10 %; Prosopis, Yucca y A. scabra −10 % | Barras divergentes por especie; barra apilada de densidad | B |
| 8 | El presupuesto | Con $12,500/ha ningún polígono es factible; aceptar 50 veces más riesgo ahorra menos del 4 % | Frontera B\*(α) con la línea del presupuesto debajo de toda la curva | B |
| 9 | La clave de plantación | 30 polígonos, 6 claves; el mezquite separa | El mosaico real se reordena del azar al óptimo; conmutador género/competencia y réplica 3 × 3 | C |
| 10 | Qué tan buena es | 14.5–16.3 % menos competencia que al azar; d.e. ≤ 0.006; brecha con el óptimo exacto | Barras azar / memético / exacto por mosaico, con la cota del exacto | B |
| 11 | La herramienta | `refor_gui`: configurar, ejecutar, exportar; reproducible | Captura de `refor_gui` en un marco de ventana | B |
| 12 | El visor | Los resultados de `refor`, polígono por polígono | El visor embebido (iframe); se usa en vivo. Requiere servir el repo desde su raíz | C |
| 13 | Recomendaciones | Ajustar presupuesto o meta; validar la matriz W; ampliar el monitoreo | Decisiones numeradas y línea de tiempo de siguientes pasos | A |
| 14 | Cierre | Gracias y preguntas | El sitio inclinado y todo plantado; QR al repositorio | C |

**Anexo** (si preguntan por el método): formulación de la compra con
restricción probabilística, algoritmo memético con búsqueda tabú y matriz de
competencia W.

### Fuentes de datos por lámina

| Lámina | Fuente |
|---|---|
| 3, todas las de mapa | `data/processed/mapa.csv`, `poligonos.csv`, `existentes.csv` |
| 5 | `data/processed/especies.csv` (*q*, *c*) |
| 7 | `refor plan` → `compra.json` |
| 8 | `refor frontera` → `frontera.csv` |
| 9, 10 | `refor plan --exacto` → `espacial.json`, `exacto.json` |

Todas las corridas con α = 0.05, θ = 0.05, δ = 0.10, K = 10,000 y semilla 42,
como en el reporte E2.

---

## 10. Tokens CSS (referencia)

```css
:root {
  /* color */
  --papel: #FCF0DA;
  --papel-hondo: #F3E2C2;
  --tierra: #4C4541;
  --tierra-suave: #6E655F;
  --tinta: #2E2A27;
  --salvia: #AEAC78;
  --salvia-honda: #6F6D43;
  --ocre: #F2C46A;
  --ocre-hondo: #8C6418;
  --linea: rgb(76 69 65 / .15);

  /* rampa secuencial (coropletas, competencia) */
  --sec-1: #F3E2C2;
  --sec-2: #C2BB8D;
  --sec-3: #969464;
  --sec-4: #64623D;
  --sec-5: #3B3A26;

  /* tipografía */
  --f-display: "Libre Caslon Display", "Libre Caslon Text", Georgia, serif;
  --f-texto: "Libre Caslon Text", Georgia, serif;
  --f-rotulo: "Instrument Sans", system-ui, sans-serif;

  --t-xs: 16px;  --t-s: 21px;  --t-m: 28px;  --t-l: 37px;
  --t-xl: 50px;  --t-2xl: 67px; --t-3xl: 140px;

  /* movimiento */
  --ease-camara: cubic-bezier(.65, 0, .35, 1);
  --ease-salida: cubic-bezier(.2, .7, .2, 1);
  --d-camara: 1600ms;
  --d-contenido: 450ms;
  --d-datos: 750ms;
  --d-respuesta: 180ms;
}
```

---

## 11. Archivos y cómo presentar

| Archivo | Contenido |
|---|---|
| `index.html` | Las 14 láminas |
| `estilo.css` | Tokens y composición |
| `deck.js` | Mapa, cámara, navegación, gráficas y el mosaico de la lámina 9 |
| `herbario.js` | Dibujos provisionales de las 10 especies |
| `datos/datos.js` | Generado por `scripts/datos_presentacion.py`; no se edita a mano |
| `fuentes/`, `fuentes.css` | Fuentes locales |
| `qr-repositorio.svg` | QR de la lámina 14 |

Para regenerar los datos, desde la raíz del repo:

```bash
./build/refor frontera --alphas 0.01,0.02,0.05,0.10,0.20,0.30,0.50 -f csv
./build/refor plan --exacto -f json      # unos 30 min: 300 s por mosaico
python3 scripts/datos_presentacion.py
```

Se presenta abriendo `index.html` en el navegador, sin servidor. `#n` en la
URL abre la lámina *n*.

---

## 12. Pendientes

- Duración de la presentación y guion de la demo en vivo.
- Las 10 ilustraciones de herbario definitivas: origen, licencias y
  vectorización. Hoy la lámina 4 usa dibujos propios provisionales
  (`herbario.js`).
- Capturas de `refor_gui` para la lámina 11 (hoy, marco con «Captura
  pendiente»).
- Histograma de las 30 corridas por mosaico en la lámina 10: `refor` solo
  exporta la media y la desviación estándar, no cada corrida.
- Validar en el proyector los tonos de especie y la rampa secuencial. En
  simulación ya se comprobó que los tres colores de género se distinguen con
  deuteranopía y protanopía.
- Aplicar a `refor_gui` la paleta de especies, el resaltado y la rampa
  secuencial (trabajo aparte; hoy usa una rampa azul).
