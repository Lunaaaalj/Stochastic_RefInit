# Grabación de la voz

<!-- Generado por scripts/expoing/video/video_guia.py a partir de linea_de_tiempo.json; no editar a mano. -->

Narra **Andrea Estefanía de la Peña**, en 11 tomas, una por escena (PLAN §4.1 y §8.4). La animación ya
está hecha: la voz sigue al video, no al revés.

## Antes de grabar

- Un cuarto chico con ropa, cortinas o cojines; sin ventiladores ni aire acondicionado.
- Micrófono a 15–20 cm de la boca, un poco de lado para que las «p» no golpeen. Sirve uno de diadema
  o el del teléfono.
- **WAV a 48 kHz** (24 o 16 bits, mono o estéreo). Nada de MP3 ni de notas de voz comprimidas.
- Audífonos puestos y **sin música**: la guía no tiene sonido.
- Que el nivel quede lejos del máximo: si el medidor llega al rojo, se baja la ganancia.

## Cómo grabar cada toma

1. Abre la guía de la toma, `guia_EXX.mp4`, a pantalla completa (están en
   `docs/expoing/video/salida/guia/`; el equipo te las pasa si no tienes el repositorio).
2. Empieza a grabar, deja 2 s de silencio y dale play al video.
3. Arriba está el texto que se dice. Las palabras se encienden al ritmo esperado y la barra ocre
   marca cuánto falta de la frase; abajo, en gris, viene la siguiente.
4. Cuando la cuenta regresiva llega a «1», empieza la primera frase. Lee a tu ritmo natural:
   seguir las palabras encendidas ayuda, pero no tiene que ser exacto.
5. Al ver «Fin de la toma», deja 2 s de silencio y detén la grabación.
6. Se pueden repetir las veces que haga falta. Entrega la mejor de cada escena con el nombre
   `EXX.wav` (E01.wav … E11.wav); van en `docs/expoing/video/voz/`, que git no versiona.

Los números se dicen con letra, tal como aparecen abajo (los subtítulos del video sí llevan
cifras). Si una toma queda dentro de ±8 % de la duración planeada, se ajusta sola en la mezcla; si
no, se vuelve a grabar esa toma. Para revisarlas:

```bash
uv run scripts/expoing/video/video_guia.py --revisar
```

## Las 11 tomas

| Toma | Escena | Frases | Habla | Guía | Archivo |
|---|---|---|---|---|---|
| E01 | Gancho: de la región a la planta | 4 | 15.9 s | `guia_E01.mp4` | `voz/E01.wav` |
| E02 | Presentación del equipo | 7 | 30.7 s | `guia_E02.mp4` | `voz/E02.wav` |
| E03 | El problema: plantar no es reforestar | 5 | 27.5 s | `guia_E03.mp4` | `voz/E03.wav` |
| E04 | El proyecto y su alcance | 5 | 23.9 s | `guia_E04.mp4` | `voz/E04.wav` |
| E05 | Pregunta 1: diez mil temporadas | 4 | 16.6 s | `guia_E05.mp4` | `voz/E05.wav` |
| E06 | Pregunta 1: el modelo de compra | 5 | 25.5 s | `guia_E06.mp4` | `voz/E06.wav` |
| E07 | Pregunta 1: el resultado | 6 | 30.9 s | `guia_E07.mp4` | `voz/E07.wav` |
| E08 | Pregunta 2: el modelo de siembra | 5 | 22.6 s | `guia_E08.mp4` | `voz/E08.wav` |
| E09 | Pregunta 2: memético y resultado | 5 | 21.8 s | `guia_E09.mp4` | `voz/E09.wav` |
| E10 | La herramienta y las pruebas | 2 | 10.0 s | `guia_E10.mp4` | `voz/E10.wav` |
| E11 | Impacto y cierre | 4 | 17.7 s | `guia_E11.mp4` | `voz/E11.wav` |

## Texto de cada toma

### E01 · Gancho: de la región a la planta

Duración planeada del habla: 15.9 s (se acepta de 14.7 a 17.2 s).

1. Ciento ochenta y tres hectáreas del semidesierto potosino.
2. Treinta terrenos junto a una línea de transmisión, que hay que reforestar.
3. Y una pregunta que parece sencilla:
4. ¿cuántas plantas comprar, y dónde poner cada una?

### E02 · Presentación del equipo

Duración planeada del habla: 30.7 s (se acepta de 28.3 a 33.2 s).

1. Somos el equipo cinco de Optimización Estocástica,
2. modelo educativo profesional, modalidad presencial, del Tec de Monterrey:
3. Angel Eduardo Luna, Irasema Álvarez, Carolina Sánchez Meneses
4. y yo, Andrea de la Peña,
5. con la tutoría de Yadira Isabel Silva Soto y Rafael Muñoz Sánchez.
6. Nuestro proyecto: compra bajo incertidumbre y distribución espacial de especies
7. para la reforestación de treinta polígonos en San Luis Potosí.

### E03 · El problema: plantar no es reforestar

Duración planeada del habla: 27.5 s (se acepta de 25.3 a 29.7 s).

1. El socioformador busca que cada hectárea tenga seiscientas cincuenta y ocho plantas
2. de diez especies nativas: agaves, nopales, mezquite y yuca.
3. Pero plantar no es lo mismo que reforestar:
4. en el primer año muere entre el cuatro y el dieciocho por ciento de lo plantado.
5. Comprar de menos incumple la meta; comprar de más rebasa el presupuesto de doce mil quinientos pesos por hectárea.

### E04 · El proyecto y su alcance

Duración planeada del habla: 23.9 s (se acepta de 22.0 a 25.8 s).

1. Hoy, la compra se estima a ojo y se siembra con una secuencia fija.
2. Nuestro proyecto, refor, responde dos preguntas:
3. cuánto comprar de cada especie, al menor costo y con garantía de cumplir la meta,
4. y cómo acomodarlas para que compitan lo menos posible.
5. El alcance es lo que el planeador decide; el agua y el terreno quedan fuera.

### E05 · Pregunta 1: diez mil temporadas

Duración planeada del habla: 16.6 s (se acepta de 15.3 a 18.0 s).

1. Tomemos el agave salmiana del polígono uno.
2. La meta es de doscientas cincuenta y dos, y ya hay cuarenta y seis.
3. Simulamos diez mil temporadas de siembra.
4. Comprar doscientas veinte alcanza en el noventa y seis por ciento de ellas.

### E06 · Pregunta 1: el modelo de compra

Duración planeada del habla: 25.5 s (se acepta de 23.5 a 27.6 s).

1. Con eso armamos un modelo de optimización:
2. minimizar lo que cuesta comprar, más lo que se espera gastar en reponer.
3. Respetar la meta total, un margen de diez por ciento por especie y el presupuesto.
4. Y exigir que cada especie cumpla su meta con al menos noventa y cinco por ciento de probabilidad.
5. Esa es la innovación: comprar con una garantía, no a ojo.

### E07 · Pregunta 1: el resultado

Duración planeada del habla: 30.9 s (se acepta de 28.4 a 33.4 s).

1. Resultado: ciento ocho mil seiscientas ochenta plantas para los treinta polígonos.
2. Y un hallazgo: con doce mil quinientos pesos por hectárea, ningún polígono cumple.
3. Hacen falta catorce mil cuatrocientos noventa y seis.
4. Ni aceptar cincuenta veces más riesgo lo resuelve: ahorra menos del cuatro por ciento.
5. El cálculo exacto lo confirma: difiere en ocho centavos por hectárea.
6. Saberlo antes de plantar evita perder la inversión.

### E08 · Pregunta 2: el modelo de siembra

Duración planeada del habla: 22.6 s (se acepta de 20.8 a 24.4 s).

1. Se siembra al tresbolillo: cada planta tiene seis vecinas.
2. Una matriz mide cuánto compite cada par de especies.
3. Dos de la misma especie compiten más; el mezquite apenas compite con las suculentas.
4. Buscamos el acomodo de menor competencia total,
5. con una especie por posición y las cantidades que dictó la compra.

### E09 · Pregunta 2: memético y resultado

Duración planeada del habla: 21.8 s (se acepta de 20.1 a 23.6 s).

1. Lo resolvemos con un algoritmo memético con búsqueda tabú,
2. y lo medimos contra un modelo entero exacto.
3. Resultado: dieciséis por ciento menos competencia que sembrar al azar,
4. a lo más a cuatro punto cinco por ciento del óptimo.
5. Y los treinta polígonos se resuelven con solo seis claves de plantación.

### E10 · La herramienta y las pruebas

Duración planeada del habla: 10.0 s (se acepta de 9.2 a 10.8 s).

1. Todo vive en refor, una herramienta de escritorio que se opera sin saber programar,
2. y que da los mismos resultados en Windows, macOS y Linux.

### E11 · Impacto y cierre

Duración planeada del habla: 17.7 s (se acepta de 16.3 a 19.2 s).

1. El impacto: decisiones de reforestación con respaldo probabilístico,
2. que cuidan el dinero público y la supervivencia de cada planta,
3. y un método abierto que puede repetirse en otros sitios.
4. Plantar es fácil. Lograr que sobreviva: ese es el reto.
