# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`refor` decides, for 30 reforestation polygons (CONAFOR / INECOL data, San Luis Potosí), **how many plants of each species to buy** so the planting target is met with probability ≥ 1−α at minimum cost under budget B, and **how to arrange species in a hexagonal mosaic** to minimize competition between neighbors. Everything (code identifiers, comments, UI, docs, commit messages, PR reviews) is in **Spanish**; keep domain terms as-is (polígono, especie, género, mosaico, clave de plantación, competencia, meta, compra, reposición, memético, exacto, brecha, cota). `src/README.md` is the authoritative user-facing doc for the CLI and the model; `PRODUCT.md` describes users and product principles.

## Build and test

C++20, CMake ≥ 3.24. HiGHS and GLFW come from the system (`brew install highs glfw`) or are fetched; CLI11, Catch2, Dear ImGui and ImPlot are always fetched.

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release   # -DREFOR_GUI=OFF / -DREFOR_TESTS=OFF to skip
cmake --build build -j
ctest --test-dir build                            # all tests
./build/refor_tests "[mochila]"                   # one Catch2 tag: datos, simulacion, exacto, mochila, modelo, memetico, plan, ple
./build/refor_tests "nombre exacto del TEST_CASE" # a single test
```

Tests read the real CSVs via the compile definition `REFOR_DATOS_DIR` (points at `data/processed`). Run all binaries from the repo root, because they default to `data/processed` and write to `docs/res/`, which git ignores:

```bash
./build/refor compra --alpha 0.05 -B 15000         # also: frontera, barrido, plan [--exacto]; -f tabla|csv|json
./build/refor_ple --filas 4 --columnas 13          # exact spatial MILP alone
./build/refor_gui [datos_dir]                      # desktop GUI
```

Data pipeline (Python scripts, run from the repo root):
- `uv run --no-project --with pandas --with openpyxl python scripts/exportar_datos.py` builds `data/processed/{especies,poligonos,existentes}.csv` from `data/raw/*.xlsx`. Never edit `data/raw/`.
- `scripts/digitalizar_mapa.py` builds `mapa.csv` (hand-traced polygon outlines, ±5 m).
- `scripts/datos_presentacion.py` builds `docs/presentacion/datos/datos.js` from the CSVs plus `docs/res/` output. Run `refor frontera … -f csv` and `refor plan --exacto -f json` first (see the script docstring).

Reports: `cd reports/eN && latexmk -pdf main.tex`.

## Architecture

Three executables share one static library, `refor_core` (everything in `src/` except `main.cpp`), in namespace `refor`:

- **Purchase level (stochastic):**
  - `simulacion.*` generates K Monte Carlo survival scenarios per species, with common random numbers shared across targets and α.
  - `curva.hpp` turns these into the curve x*(n) (minimum purchase as a quantile) and the expected replacement E[D](n).
  - `exacto.*` computes the same curve from the exact binomial tail. It is used for validation and for `--metodo exacto`.
  - `mochila.*` solves a multiple-choice knapsack per polygon: an exact DP gives the unconstrained optimum and the minimum budget B*, and HiGHS is called only when B lies between the two.
  - `modelo.*` computes curves in parallel and solves each polygon. Its `Resultado` holds an `optima` solution, or a `libre` one when the budget is insufficient.
- **Spatial level:**
  - `plan.*` orchestrates purchase → mosaic composition (largest remainder) → memético.
  - Polygons with the same composition share one mosaic. Each mosaic runs `corridas` independent memético runs in parallel.
  - `memetico/` holds the periodic hex mosaic (6 neighbors), the competition matrix W, tabu search and the memetic GA.
  - `asignacion_exacta/` holds the exact integer model (HiGHS). It is warm-started from the best memético solution, and the gap is reported after aligning both layouts by translation.
- **Output:** `salida.*` and `asignacion_exacta/salida_ple.*` produce table, CSV and JSON. `main.cpp` holds the CLI11 subcommands.
- **GUI (`gui/`, namespace `refor::gui`):**
  - Dear ImGui + ImPlot over GLFW/OpenGL. `app.*` holds the state, and each `vista_*.cpp` is one tab/view.
  - Long computations run through `Trabajo<T>` (`gui/trabajo.hpp`): a `std::jthread`, a shared `Progreso` (atomic progress and a `cancelar` flag), and `recoger()` to pull the result once.
  - Each job runs with a copy of `Config`. Results keep a `shared_ptr` to the `Datos` they were computed from, so they survive a data reload.
  - Fonts in `gui/fuentes/` are embedded at configure time into a generated `fuentes.cpp`.
- **Executive deck (`docs/presentacion/`):** a static HTML/CSS/JS deck with no build step. Its visual identity is fixed in `docs/presentacion/DESIGN.md`. That palette is also binding for `refor_gui` (see `PRODUCT.md`).

## Invariants

- **Reproducibility:** for a given `--semilla`, results must be identical regardless of thread count or platform. Random streams are seeded from their logical identity (`semilla_derivada(semilla, poligono, especie)`; for the memético, from the group and the run number), never from the order of execution. Keep this property in any new parallel or random code.
- Every number shown (GUI, deck, reports) must come from `data/processed/` or from `refor` output. Never use illustrative or made-up figures.
- On macOS, `-fexperimental-library` is required for `std::jthread` with Apple libc++. CMake already sets it on `refor_core`.

## Team workflow (CONTRIBUTING.md)

- Branch from an updated `main` with the same type prefixes as commits (`feat/…`, `fix/…`, `docs/e2-metodos`). Open the PR as a draft and link the issue with `Closes #N`. Changes reach `main` only through a PR.
- **Never rebase.** Update a branch with `git merge main`. Use `--force-with-lease` only on your own branch.
- Write Conventional Commits in Spanish, lowercase, imperative (`feat: agregar …`, `fix: corregir …`). Keep commits atomic.
- LaTeX reports:
  - Each section lives in its own `reports/eN/secciones/<x>.tex`, is pulled into `main.tex` with `\input`, and is wrapped in `\begin{refsection}[<x>.bib]` with its own `.bib`, ending with `\printbibliography[heading=subbibliography]`.
  - Do not put body text in `main.tex`, and do not share bibliographies.
  - Commit the rebuilt `main.pdf`.
