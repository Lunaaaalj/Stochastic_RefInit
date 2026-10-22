# Visor de resultados de `refor`

Muestra los resultados que exporta el modelo `refor` —compra por polígono y
especie, claves de plantación, comparación con el modelo exacto y presupuesto—
con la identidad del deck («Carta de campo»). **No ejecuta el modelo**: solo
lee los archivos json y csv que ya generó.

## Cómo se usa

1. Sirve el repositorio desde su raíz y abre el visor por http:

   ```bash
   python3 -m http.server 8000      # desde la raíz del repo
   ```

   y luego <http://localhost:8000/docs/visor/>. El visor toma la raíz del
   repositorio (dos carpetas arriba de `docs/visor/`) y lee cada archivo de su
   ruta fija; no hay que elegir nada. Abrir `index.html` con doble clic
   (`file://`) no funciona: el navegador no deja leer otros archivos así.
2. Tras volver a correr `refor`, pulsa «Recargar» para leer los archivos nuevos.
3. La pestaña **Mapa** abre con el sitio completo. Elige un polígono (clic en
   el mapa, el selector o las flechas) y a la derecha aparece su configuración:
   veredicto, compra por especie y clave de plantación. Las demás pestañas
   (Compra, Mosaico, Memético vs. exacto, Presupuesto) tienen el detalle.

### Moverse en el mapa

| Acción | Cómo |
|---|---|
| Acercar y alejar | Rueda del ratón o pellizco (sobre el punto del cursor), botones + y −, teclas `+` y `-`, doble clic |
| Mover | Arrastrar |
| Ver todo el sitio | Botón de encuadre o tecla `0`; `Esc` además quita la selección |
| Recorrer polígonos | Flechas con el mapa enfocado; el polígono elegido se encuadra |

Al acercarse, cada polígono muestra su clave de plantación repetida sobre su
superficie, con el mismo origen y orientación que el deck:

- de lejos, solo los polígonos;
- desde 3 px de radio por hexágono, la plantación por género;
- desde 16 px, cada planta con el color y la abreviatura de su especie. Al pasar
  el cursor sobre una planta se ve su especie, la clave y su fila y columna.

La URL guarda la vista y el polígono (`#v=compra&p=12`), así que se puede
recargar sin perder el lugar.

## Archivos que lee

| Archivo | Vista | Cómo se genera (desde la raíz del repo) |
|---|---|---|
| `docs/res/plan/compra.json` | Compra, mapa y presupuesto (**indispensable**) | `./build/refor plan -f json` |
| `docs/res/plan/espacial.json` | Mosaico | `./build/refor plan -f json` |
| `docs/res/plan/exacto.json` | Memético vs. exacto | `./build/refor plan --exacto -f json` (unos 30 min) |
| `docs/res/frontera.csv` | Presupuesto: frontera B\*(α) | `./build/refor frontera -f csv` |
| `docs/res/barrido.csv` | Presupuesto: rejilla α × B | `./build/refor barrido -f csv` |
| `data/processed/mapa.csv` | Mapa del sitio | viene en el repositorio |
| `data/processed/especies.csv` | Nombres por especie | `python3 scripts/exportar_datos.py` |
| `data/processed/competencia.csv` | Vista de competencia del mosaico | `python3 scripts/exportar_datos.py` |

Si falta alguno, la vista que lo usa dice cuál y con qué comando se genera; las
demás siguen funcionando.

## Qué no muestra

- La convergencia de las corridas del memético y el histograma de las 30
  corridas: `refor` no los exporta (solo la media y la desviación estándar).
- La matriz de competencia W como tabla: es un dato de entrada; el visor la usa
  para colorear el mosaico por competencia.

## Archivos

`index.html` (estructura), `visor.css` (tokens del deck y composición),
`visor.js` (lectura, validación, mapa y vistas), `fuentes/` y `fuentes.css`
(copias locales de las fuentes del deck, licencia OFL).

Funciona en Chrome, Edge, Safari y Firefox recientes.
