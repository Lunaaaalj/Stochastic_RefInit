# Reportes

Aquí van los reportes en LaTeX: uno por etapa del proyecto (`e1/`, `e2/`, `e3/`, …) y el documento final en `final/`. Las reglas para trabajarlos están en [`CONTRIBUTING.md`](../CONTRIBUTING.md#workflow-para-los-reportes).

## Estructura

```
reports/
├── e1/
│   ├── main.tex            # preámbulo + \input de cada sección
│   ├── investigacion.tex   # sección, envuelta en su refsection
│   ├── investigacion.bib   # bibliografía de esa sección
│   ├── metodos.tex
│   ├── metodos.bib
│   └── main.pdf
├── e2/
├── e3/
└── final/
```

Cada sección es un par `nombre.tex` + `nombre.bib` y tiene un solo dueño. No hay bibliografía compartida.

## Preámbulo mínimo de `main.tex`

```latex
\documentclass{article}
\usepackage[spanish]{babel}
\usepackage[backend=biber, style=numeric]{biblatex}

\begin{document}
\input{investigacion}
\input{metodos}
\end{document}
```

`main.tex` **no** lleva `\addbibresource`: cada sección carga su propio `.bib` con `\begin{refsection}[nombre.bib]`.

## Compilar

Desde la carpeta de la etapa:

```bash
cd reports/e1
latexmk -pdf main.tex
```

`latexmk` corre `pdflatex` y `biber` las veces necesarias. Si compilas a mano, el orden es `pdflatex main` → `biber main` → `pdflatex main` → `pdflatex main`. Para borrar los archivos auxiliares: `latexmk -c`.
