# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

<!-- No hay un valor de escritorio en el esquema. `refor_gui` es una app de
escritorio multiplataforma (Dear ImGui + ImPlot sobre GLFW/OpenGL) con su
propio dibujo, no con controles nativos; por eso no es ios/android/adaptive.
El deck ejecutivo sí es HTML/CSS. -->

## Users

- **Primarios: técnicos de planeación de CONAFOR.** `refor_gui` se diseña para
  que ellos la operen: cargan los datos de INECOL, fijan nivel de confianza
  (α), presupuesto (B) y parámetros, ejecutan el plan y se llevan la compra
  por polígono y especie y la clave de plantación de cada mosaico.
- **Usuarios actuales: el equipo del proyecto.** Hoy la usan sobre todo para
  generar resultados, compararlos con el modelo exacto y preparar la demo en
  vivo.
- **Audiencia de presentaciones:** CONAFOR (socio formador) y los profesores
  que evalúan el reto. Ven los resultados en el deck y en la demo; no operan la
  herramienta.

## Product Purpose

`refor` responde dos decisiones de la reforestación de 30 polígonos (1.28 a
8 ha) en la Línea de Transmisión Dominica–Charcas, San Luis Potosí, con 10
especies nativas (agaves, nopales, mezquite, yuca), diseño en tresbolillo y una
meta de 658 plantas/ha:

1. **Cuánto comprar** de cada especie por polígono para alcanzar la meta con
   probabilidad de al menos 1 − α, al menor costo de compra más reposición
   esperada, sujeto al presupuesto, considerando la incertidumbre en la
   supervivencia de lo plantado.
2. **Cómo acomodar** las especies en el mosaico para minimizar la competencia
   entre plantas vecinas, respetando la cantidad por especie.

El éxito se mide en cuatro frentes, todos confirmados:

- CONAFOR adopta la herramienta en la planeación real de los polígonos.
- CONAFOR acepta la recomendación: cuánto comprar, si el presupuesto alcanza y
  la siembra propuesta.
- Las entregas académicas del reto (E1, E2, presentación final) son bien
  evaluadas.
- El método y el código quedan como base reproducible para trabajo futuro.

## Positioning

Sustituye un orden de plantación fijo y una compra a ojo por decisiones con
respaldo probabilístico y de optimización: la compra sale de 10,000 escenarios
de supervivencia (con validación por la cola binomial exacta) y una mochila de
elección múltiple; la siembra, de un memético con búsqueda tabú cuya distancia
al óptimo se mide contra un modelo entero (HiGHS). La herramienta muestra esa
brecha en lugar de ocultarla.

## Operating Context

- Escritorio: macOS, Linux y Windows con la misma apariencia.
- Se corre desde la raíz del repo; los datos de entrada son los CSV de
  `data/processed/` (generados desde los Excel de INECOL con
  `scripts/exportar_datos.py`).
- Los resultados se exportan a `docs/res/` en txt, csv y json para seguir
  trabajando en hoja de cálculo o en los reportes.
- Corridas largas (memético, modelo exacto) se ejecutan en segundo plano con
  avance y cancelación; la ventana no se bloquea.
- La GUI se muestra también en vivo durante la presentación ejecutiva.

## Capabilities and Constraints

- CLI `refor` (subcomandos `compra`, `frontera`, `barrido`, `plan`) y
  `refor_ple` para el modelo entero; `refor_gui` cubre configuración, mosaico,
  compra, convergencia, memético vs. exacto, matriz de competencia, frontera
  B*(α) y barrido α × B.
- **Reproducibilidad:** con la misma semilla el resultado es idéntico sin
  importar hilos ni plataforma. Ninguna función nueva puede romper esto.
- **Solo español.** Interfaz, documentos y mensajes en español; sin i18n.
- Terminología del dominio que se conserva tal cual: polígono, especie, género
  (*Agave*, *Opuntia*, *Otras*), mosaico, clave de plantación, competencia,
  meta, compra, reposición, α, B, B*(α), memético, exacto, brecha, cota.
- C++20, CMake; dependencias vía sistema o FetchContent (CLI11, Catch2, HiGHS,
  GLFW, Dear ImGui, ImPlot).

## Brand Commitments

- **Paleta de especies también en `refor_gui`.** La paleta del deck (papel,
  tierra, salvia, ocre y los colores por género y especie definidos en
  `docs/presentacion/DESIGN.md`) es vinculante para la GUI, que hoy usa una
  rampa azul. Los valores se toman de ese documento, no se reinventan.
- Siglas en mayúsculas: CONAFOR, INECOL, UTM.

## Evidence on Hand

- Datos reales: `data/raw/datos_inecol.xlsx`, `data/raw/Reajuste de cantidad
  de planta.xlsx` y los CSV de `data/processed/` (`especies`, `poligonos`,
  `existentes`, `competencia`, `mapa`).
- Reportes: `reports/e1/` y `reports/e2/` (LaTeX y PDF).
- Planteamiento del reto: `docs/misc/reto_reforestacion.docx` y
  `docs/misc/Reforestación – 18 diapositivas.pdf`.
- Resultados regenerables con la CLI en `docs/res/` (no versionados).
- **Ausencias:** no hay testimonios, adopción confirmada por CONAFOR ni
  métricas de campo. No se inventan; toda cifra o visual sale de
  `data/processed/` o de la salida de `refor`.

## Product Principles

1. **Cada cifra es un dato.** Nada ilustrativo: números, mapas, mosaicos y
   gráficas salen de los datos reales o del modelo, con su fuente.
2. **La incertidumbre se muestra.** α, la probabilidad de cumplir la meta y la
   brecha del memético al óptimo son parte del resultado, no letra chica.
3. **Operable por CONAFOR.** El flujo debe poder seguirlo un técnico de
   planeación sin el equipo al lado; la demo del equipo no justifica atajos que
   solo el equipo entiende.
4. **Reproducible siempre.** Misma semilla, mismo resultado, en cualquier
   plataforma; las exportaciones permiten rehacer cualquier cifra.
5. **El veredicto primero.** Cuánto comprar, si alcanza el presupuesto y qué
   siembra conviene van antes que el método.
