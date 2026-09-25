# Guía de colaboración

Esta es la guía de trabajo del equipo 5. Para facilitar la colaboración se aplican varias
reglas que hay que seguir, y es muy importante hacerlo para evitar confusiones, problemas y
conflictos. Si buscas de qué trata el proyecto o cómo correr el código, eso está en el
[`README.md`](README.md).

## El workflow

Este es el camino que vas a seguir cada vez que trabajes en algo. Si lo sigues tal cual, no te vas a atorar.

**1. Toma una issue.** Antes de escribir una sola línea, crea la issue que explique lo que vas a hacer o asígnate una que ya exista. La issue es el objetivo de tu branch.

**2. Parte de `main` actualizado.** Nunca crees tu branch desde un `main` viejo, porque te vas a topar con conflictos que no eran necesarios.

```bash
git switch main
git pull
git switch -c feat/analisis-pca
```

> En tutoriales y en StackOverflow vas a ver `git checkout main` y `git checkout -b mi-branch`, que hacen lo mismo. Nosotros usamos `switch` porque `checkout` también sirve para descartar cambios de un archivo, y si te equivocas de argumento puedes perder trabajo que no habías commiteado. `switch` solo cambia de branch, y si le pasas algo que no es una branch nada más te marca error.

**3. Trabaja y haz tus commits atómicos.** Cada commit debe ser una pieza de trabajo lógica y completa.

```bash
git add src/analisis_pca.R
git commit -m "feat: agregar calculo de componentes principales"
```

**4. Sube tu branch y abre la PR en draft.** En cuanto tengas tu primer commit (o los primeros), sube la rama y abre la Pull Request en modo draft. No esperes a terminar todo.

```bash
git push -u origin feat/analisis-pca
```

Con GitHub CLI:

```bash
gh pr create --draft --base main --title "feat: analisis de componentes principales" --body "Closes #10"
```

Desde la web: después del `push`, entra al repo en GitHub y te va a aparecer un banner con el botón **Compare & pull request**. Si no aparece, ve a la pestaña **Pull requests** → **New pull request**, elige `main` como base y tu branch como compare. Escribe el título, pon `Closes #10` en el body, y en el botón verde abre el menú y selecciona **Create draft pull request**.

En `Closes #10`, el "10" sería el número asignado a la issue del paso 1. Ponerlo en el body hace que la issue se cierre sola cuando la PR se mergee. El modo draft nos hace saber al equipo que el trabajo está en progreso, mientras nos permite ver y discutir los avances.

**5. Sigue haciendo commits y push.** Cada vez que juntes un conjunto significativo de commits, haz push a tu branch. Si tu PR es de análisis, acuérdate de subir también el PDF renderizado: es lo que hace revisable el trabajo.

**6. Saca la PR de draft.** Cuando el trabajo esté listo, dale a **Ready for review** y pide la revisión del equipo. Ahí es cuando corre la revisión automática de Claude (ver más abajo); los comentarios de Copilot se piden aparte.

**7. Si `main` avanzó mientras trabajabas**, en tu PR te va a aparecer el botón **Update branch**. Dale y GitHub actualiza tu branch con lo nuevo de `main`. Solo si hay conflictos el botón no va a poder, y ahí sí lo resuelves local (con merge, nunca con rebase):

```bash
git switch main
git pull
git switch feat/analisis-pca
git merge main
```

Resuelve los conflictos ahí en tu branch, haz commit y push.

**8. Merge.** Una vez aprobada y con todas las conversaciones resueltas, la PR se mergea con el botón **Merge pull request**. Nadie mergea a `main` desde su máquina, siempre es por PR.

## Convenciones de commits

Usamos Conventional Commits, o sea que el mensaje empieza con un tipo, dos puntos, y una descripción corta en minúsculas y en imperativo (`agregar`, no `agregado` ni `agregue`).

```
feat: agregar matriz de correlacion al EDA
fix: corregir escalamiento antes del PCA
docs: documentar el diccionario de datos
chore: actualizar dependencias de renv
refactor: separar la limpieza de datos en su propia funcion
test: agregar pruebas para la normalizacion
```

- `feat`: funcionalidad, análisis o modelo nuevo.
- `fix`: corrección de un error.
- `docs`: documentación, README, comentarios.
- `chore`: mantenimiento, dependencias, configuración.
- `refactor`: reorganizar código sin cambiar lo que hace.
- `test`: pruebas.

La misma convención aplica para los nombres de branches: `feat/analisis-pca`, `fix/escalamiento-datos`, `docs/diccionario-datos`.

## Las reglas

El workflow de arriba ya cubre el día a día. Esto es lo que no se negocia:

- NO hagas rebase, ni rebase merging. Si tu branch se atrasó respecto a `main`, actualízala con merge como está explicado en el paso 7. Si algo se enreda, pregunta antes de tocar el historial.
- NO puedes hacer pushes directos a `main`. Si haces commits en tu `main` local e intentas hacer un push al `origin main`, el remoto te va a detener y vas a estar atorado con commits en tu `main` local (para salir de eso, ve la sección de abajo).
- Usa commits atómicos. No hagas todo de una y luego un solo commit, ni tampoco un commit por cada pedacito de código que escribas: que sea una pieza de trabajo lógica significativa, que aborde exactamente lo que el mensaje del commit indica.
- Tomen en cuenta los comentarios de Copilot en las PRs, para evitar bugs, errores en los modelos y mejorar la calidad del proyecto en general.
- Mergear una PR a `main` requiere que se resuelvan todas las conversaciones y comentarios, y que se apruebe la Pull Request. Si haces un nuevo push después de una aprobación, esta aprobación se eliminará y la PR tendrá que revisarse de nuevo.
- Puedes hacer force pushes en tus branches personales, pero no es recomendable. Si lo llegas a necesitar, usa `git push --force-with-lease` y nunca sobre una branch en la que esté trabajando alguien más.

## Me atoré, ¿qué hago?

**Hice commits en mi `main` local.** No los pierdas, rescátalos a una branch nueva y regresa tu `main` a como está en el remoto:

```bash
git switch -c feat/mi-trabajo   # tus commits ahora viven aquí
git switch main
git reset --hard origin/main    # tu main queda igual al del remoto
```

**Ya empecé a trabajar pero no he hecho commit y estoy en `main`.** Solo crea la branch, los cambios sin commit se van contigo:

```bash
git switch -c feat/mi-trabajo
```

## Claude en GitHub

El repo tiene integrado el [Claude Code GitHub Action](https://github.com/anthropics/claude-code-action) oficial, así que puedes pedirle ayuda a Claude sin salir de GitHub.

**Menciona `@claude` en un comentario** de un issue o de una PR (o en el cuerpo de un issue nuevo) y va a responder ahí mismo. Sirve para preguntas, para que explique un error, o para pedirle que implemente un cambio, en cuyo caso abre una PR con el trabajo.

```
@claude ¿por qué el catálogo de estaciones no tiene NE3 ni NO3?
@claude revisa de nuevo los chunks que agregué en el último commit
```

Solo funciona para colaboradores con permiso de escritura en el repo, es decir, el equipo.

**Revisión automática.** Cuando marcas tu PR como *Ready for review* (sale del estado draft), Claude la revisa una vez y deja comentarios inline. No corre mientras la PR sigue en draft, ni en cada push, para no gastar la cuota de más. Si quieres otra pasada después de arreglar cosas, pídesela con `@claude`.

Los comentarios de Claude son un apoyo, no una aprobación: la PR sigue necesitando review de una persona del equipo.

## Workflow para los reportes

Este repositorio también será el lugar principal para trabajar en los reportes en LaTeX. Es un poco más complicado que otras plataformas (como Overleaf), donde todos escriben sobre el mismo archivo al mismo tiempo. Aquí cada quien trabaja en su branch, así que hay que tener cuidado para no pisarnos.

### Estructura

Cada etapa del proyecto tiene su propio documento en LaTeX, en su propia carpeta dentro de [`reports/`](reports/). Al final, todo se junta en un documento final en `reports/final/`:

```
reports/
├── e1/
│   ├── main.tex            # solo arma el documento, no lleva texto
│   ├── investigacion.tex   # una sección = un archivo
│   ├── investigacion.bib   # ...con su propia bibliografía
│   ├── metodos.tex
│   ├── metodos.bib
│   └── main.pdf
├── e2/
│   └── ...
├── e3/
│   └── ...
└── final/
    └── ...
```

Cada carpeta compila por su cuenta. Los detalles para compilar están en [`reports/README.md`](reports/README.md).

### Pasos

**1. Toma una issue.** Cada sección del reporte que haya que trabajar va a estar especificada en una issue, indicando la etapa (`e1`, `e2`, …) y la sección. Crea la issue o asígnate a una antes que nada.

**2. Sigue el workflow normal.** Branch nueva desde `main` actualizado, commits atómicos, PR en draft, etc. Todo lo de la sección de arriba aplica igual. Nombra la branch con la etapa para que sea fácil de ubicar: `docs/e1-metodos`.

**3. NO hagas más ni menos de lo que dice la issue.** Si escribes de más, es muy probable que te cruces con lo que otra persona está trabajando en su propia issue, y eso se traduce en conflictos de merge sobre el mismo archivo.

**4. Escribe el reporte modularmente.** Esta es la regla más importante para evitar conflictos. **No escribas tu texto directamente en `main.tex`.** Tu sección vive en su propio archivo dentro de la carpeta de la etapa (por ejemplo `reports/e1/metodos.tex`), y desde `main.tex` solo se inserta:

```latex
% reports/e1/main.tex
\begin{document}
\input{investigacion}
\input{metodos}
\input{resultados}
\end{document}
```

Así `main.tex` casi nunca cambia (solo cuando se agrega una sección nueva), y cada quien es dueño de su propio archivo. Dos personas trabajando en secciones distintas ya no tocan las mismas líneas.

> `\input{archivo}` le dice al compilador "copia y pega aquí el contenido de ese archivo". Nota que **no lleva la extensión `.tex`**: se escribe `\input{metodos}`, no `\input{metodos.tex}`.
>
> Vas a ver también `\include{}`, que es parecido pero mete un salto de página forzado antes y después, y no se puede anidar (un archivo incluido no puede incluir a otro). Sirve para capítulos completos, no para secciones. Para nuestro caso, usa `\input`.

**5. Cada sección tiene su propia bibliografía.** No hay un `references.bib` compartido: cada sección tiene un `.bib` con el mismo nombre que su `.tex` (`metodos.tex` → `metodos.bib`), en formato BibLaTeX, y solo tú lo editas. Así nadie se pisa agregando referencias.

Tu archivo de sección va envuelto en un `refsection` que apunta a tu `.bib`, y termina imprimiendo sus propias referencias:

```latex
% reports/e1/metodos.tex
\begin{refsection}[metodos.bib]
\section{Métodos}

Usamos el esquema de Euler--Maruyama \parencite{kloeden1992}...

\printbibliography[heading=subbibliography]
\end{refsection}
```

> Dentro de un `refsection`, las citas solo se buscan en el `.bib` que le pasaste, y `\printbibliography` solo imprime lo que se citó en esa sección. Si necesitas una referencia que ya tiene otra sección, cópiala a tu `.bib`; no cites el archivo de alguien más.
>
> La numeración y las etiquetas se reinician en cada `refsection`, así que `[1]` en métodos y `[1]` en investigación pueden ser referencias distintas. Es lo esperado.

**6. Sube el PDF.** Cuando tu sección esté lista, compila el `main.tex` de la etapa y sube el `main.pdf` actualizado en tu PR, para que se pueda revisar sin compilar.

### El documento final

`reports/final/` sigue exactamente la misma estructura y las mismas reglas: un `main.tex` que solo hace `\input`, y un `.tex` con su `.bib` por sección. Cuando se arme, cada quien pasa su sección (y su bibliografía) desde las etapas anteriores, en una issue y PR propias como cualquier otra.

Cualquier otra cosa, pregunta en el chat del equipo antes de correr comandos que no conozcas.
