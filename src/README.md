# `refor`: modelo de compra bajo incertidumbre

CLI en C++20 que resuelve el modelo de compra del reporte E2
(`reports/e2/secciones/modelo-compra.tex`): para cada polígono, cuántas plantas
de cada especie comprar para alcanzar la meta con probabilidad de al menos
$1-\alpha$, al menor costo de compra más reposición esperada, sujeto al
presupuesto.

## Compilar

Requisitos: CMake ≥ 3.24 y un compilador con C++20 (clang ≥ 17, gcc ≥ 13). CLI11
y Catch2 se descargan solos. HiGHS se toma del sistema si está instalado
(`brew install highs`, `apt install libhighs-dev`); si no, también se descarga
y compila, aunque eso tarda unos minutos la primera vez.

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
ctest --test-dir build        # pruebas
```

## Usar

Los datos de entrada son los CSV de `data/processed/` (`especies.csv`,
`poligonos.csv`, `existentes.csv`), generados desde los Excel de INECOL con
`scripts/exportar_datos.py`. Se corre desde la raíz del repo:

```bash
# Compra por polígono y especie para un (α, B)
./build/refor compra --alpha 0.05 -B 15000 --poligonos 1,2

# Presupuesto mínimo factible B*(α), por polígono y agregado
./build/refor frontera --alphas 0.01,0.05,0.10,0.20,0.50

# Factibilidad en la rejilla α × B
./build/refor barrido --alphas 0.05,0.20 --B-min 13000 --B-max 16000 --B-paso 250

# Cualquier subcomando: -f csv|json -o archivo, --help para ver todo
./build/refor compra -f csv -o compra.csv
```

Opciones comunes: `--theta` (sobrecosto logístico, 0.05), `--delta` (desviación
máxima respecto al plan, 0.10), `-K` (escenarios, 10,000), `--semilla` (42),
`--metodo mc|exacto`, `--hilos`. Con la misma semilla, el resultado es idéntico
sin importar el número de hilos ni la plataforma.

## Modelo implementado

- Las plantas existentes $E_{is}$ son los **conteos observados**. La única
  variable aleatoria es la supervivencia $S_{is}(x)\sim\text{Bin}(x,q_s)$.
- El costo de reposición es igual al de compra: $c_s^R=(1+\theta)c_s$.
- **Curvas por especie** (`simulacion.cpp`): para cada meta $n$ de la banda,
  la compra mínima $x^*(n)$ con $\hat p\ge1-\alpha$ es el cuantil
  $\lceil(1-\alpha)K\rceil$ de $x_k(n-E)$, las plantas que el escenario $k$
  necesita para cubrir el faltante. Los escenarios son comunes a todas las
  metas y a todos los α. `exacto.cpp` calcula lo mismo con la cola binomial y
  sirve para validar.
- **Mochila de elección múltiple** (`mochila.cpp`): una meta por especie con
  $\sum_s n_s=\text{round}(658A_i)$. Una DP exacta da el óptimo sin
  presupuesto y la compra mínima $B^*$; HiGHS resuelve el MILP solo cuando el
  presupuesto queda entre ambos.

## Estructura

| Archivo | Contenido |
|---|---|
| `datos.*` | Lectura y validación de los CSV |
| `curva.hpp` | Banda de metas, curva $x^*(n)$, $E[D](n)$ |
| `simulacion.*` | Escenarios Monte Carlo con números aleatorios comunes |
| `exacto.*` | Curva exacta con la binomial |
| `mochila.*` | DP y MILP (HiGHS) |
| `modelo.*` | Cálculo paralelo de curvas y resolución por polígono |
| `salida.*` | Tabla, CSV y JSON |
| `main.cpp` | Subcomandos de la CLI |
