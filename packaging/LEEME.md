# refor: compra bajo incertidumbre y distribución espacial

`refor` decide **cuántas plantas de cada especie comprar** para cumplir la meta
de reforestación con probabilidad de al menos 1 − α al menor costo, y **cómo
acomodarlas** en un mosaico al tresbolillo para que las plantas vecinas
compitan lo menos posible.

Este paquete funciona por sí solo: no hay que instalar nada y ya trae los datos
de INECOL de los 30 polígonos de la Línea de Transmisión Dominica–Charcas.

## Qué contiene

| Archivo | Qué es |
|---|---|
| `Refor.app` (macOS) · `refor_gui.exe` (Windows) · `refor_gui` (Linux) | La aplicación de escritorio |
| `refor` | La línea de comandos: `compra`, `frontera`, `barrido` y `plan` |
| `refor_ple` | El modelo entero de asignación espacial por sí solo |
| `datos/` | Los datos incluidos (CSV); sirven también de plantilla para datos propios |
| `licencias/` | Licencias de terceros |

## Abrir la aplicación

- **Windows:** doble clic en `refor_gui.exe`. Si SmartScreen avisa que la
  aplicación no es reconocida, elige «Más información» → «Ejecutar de todas
  formas». El aviso aparece porque el programa no está firmado.
- **macOS:** arrastra `Refor.app` a Aplicaciones (opcional) y ábrela con clic
  derecho → «Abrir» → «Abrir». Solo hace falta la primera vez, porque la app no
  está firmada por Apple. Si macOS dice que «está dañada», quita la cuarentena
  desde la Terminal:

  ```bash
  xattr -dr com.apple.quarantine Refor.app refor refor_ple
  ```

  Funciona en Macs con Apple Silicon e Intel, desde macOS 13.3.
- **Linux:** `./refor_gui` desde la carpeta del paquete. Requiere un escritorio
  con OpenGL 3 (X11 o Wayland), que es lo normal.

La aplicación abre con los datos incluidos. **Guardar resultados** escribe
`plan/` en txt, csv y json dentro de `Documentos/refor`; la carpeta se cambia
en el campo «Resultados» del panel de configuración.

## Usar datos propios

1. Copia la carpeta `datos/` y edita los CSV, o arma una carpeta nueva con los
   mismos archivos y columnas (tabla de abajo).
2. **En la aplicación:** arrastra la carpeta (o cualquiera de sus CSV) a la
   ventana, o escribe su ruta en «Directorio» y pulsa «Recargar datos». Si los
   datos tienen un error, la aplicación dice cuál y conserva los anteriores.
   «Datos incluidos» vuelve a los de INECOL.
3. **En la línea de comandos:** `--datos <carpeta>`.

| Archivo | Columnas | Contenido |
|---|---|---|
| `especies.csv` | `especie,n0,c,q` | Por especie: plantas por hectárea del plan (`n0`, entero), costo por planta en pesos (`c`) y supervivencia al primer año (`q`, entre 0 y 1) |
| `poligonos.csv` | `poligono,area` | Número del polígono (entero, sin repetir) y superficie en hectáreas |
| `existentes.csv` | `poligono,especie,E` | Plantas ya establecidas de cada especie en cada polígono; debe estar **cada pareja** polígono–especie |
| `competencia.csv` | `especie_a,especie_b,W` | Competencia entre dos especies vecinas (simétrica; basta una fila por pareja y las que falten valen 0) |
| `mapa.csv` *(opcional)* | `etiqueta,poligono,x,y` | Vértices de cada polígono en metros (UTM), en orden; solo lo usa la vista de mapa |

Reglas del formato: la primera fila es el encabezado; los campos se separan con
coma, sin comillas ni comas dentro de un campo; los decimales llevan punto; el
texto va en UTF-8. Los nombres de especie de `existentes.csv` y
`competencia.csv` deben escribirse igual que en `especies.csv`.

## Línea de comandos

Desde una terminal en la carpeta del paquete (en Windows, `refor.exe`):

```bash
./refor compra --alpha 0.05 -B 12500          # compra por polígono y especie
./refor frontera -f csv                       # presupuesto mínimo B*(α)
./refor barrido --B-min 13000 --B-max 16000   # factibilidad en la rejilla α × B
./refor plan --alpha 0.05 -B 12500 -f json    # compra + clave de plantación
./refor plan --datos mis_datos -f csv         # con datos propios
./refor plan --help                           # todas las opciones
```

Los resultados se escriben en `./resultados/` (se cambia con `--dir`, o con
`-o -` para verlos en la terminal). Con la misma `--semilla`, el resultado es
idéntico en Windows, macOS y Linux.

---

Proyecto del Tecnológico de Monterrey (MA2004B, equipo 5) para CONAFOR, con
datos de INECOL. Código, modelos y reportes:
<https://github.com/Lunaaaalj/Stochastic_RefInit>
