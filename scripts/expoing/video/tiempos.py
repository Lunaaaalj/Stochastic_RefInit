#!/usr/bin/env python3
"""Línea de tiempo del video de Expo Ingenierías: fuente de verdad del guion.

Calcula, a partir del texto HABLADO de cada subtítulo (números con letra), cuándo
empieza y termina cada subtítulo y cada escena. Escribe:
  docs/expoing/video/linea_de_tiempo.json   escenas y subtítulos con tiempos
  docs/expoing/video/guion.srt              subtítulos de borrador (antes de grabar la voz)

Para cambiar el guion se edita la lista E y se vuelve a correr; nunca se editan
a mano los archivos generados. Uso, desde la raíz del repositorio:
    python scripts/expoing/video/tiempos.py
"""
import json
from pathlib import Path
RAIZ = Path(__file__).resolve().parents[3]
SALIDA = RAIZ / "docs" / "expoing" / "video"
VEL = 14.5      # caracteres hablados por segundo (narración tranquila en español)
PAUSA = 0.35    # pausa entre subtítulos dentro de una escena

# (id, titulo, entrada_antes_de_voz, colchon_final, [(voz, subtitulo), ...])
E = [
 ("E1", "Gancho: de la región a la planta", 2.5, 1.2, [
  ("Ciento ochenta y tres hectáreas del semidesierto potosino.", "183 hectáreas del semidesierto potosino."),
  ("Treinta terrenos junto a una línea de transmisión, que hay que reforestar.", "30 terrenos junto a una línea de transmisión\nque hay que reforestar."),
  ("Y una pregunta que parece sencilla:", "Y una pregunta que parece sencilla:"),
  ("¿cuántas plantas comprar, y dónde poner cada una?", "¿cuántas plantas comprar,\ny dónde poner cada una?"),
 ]),
 ("E2", "Presentación del equipo", 0.6, 1.0, [
  ("Somos el equipo cinco de Optimización Estocástica,", "Somos el equipo 5 de Optimización Estocástica,"),
  ("modelo educativo profesional, modalidad presencial, del Tec de Monterrey:", "modelo educativo profesional,\nmodalidad presencial, del Tec de Monterrey:"),
  ("Angel Eduardo Luna, Irasema Álvarez, Carolina Sánchez Meneses", "Angel Eduardo Luna, Irasema Álvarez,\nCarolina Sánchez Meneses"),
  ("y yo, Andrea de la Peña,", "y yo, Andrea de la Peña,"),
  ("con la tutoría de Yadira Isabel Silva Soto y Rafael Muñoz Sánchez.", "con la tutoría de Yadira Isabel Silva Soto\ny Rafael Muñoz Sánchez."),
  ("Nuestro proyecto: compra bajo incertidumbre y distribución espacial de especies", "Nuestro proyecto: compra bajo incertidumbre\ny distribución espacial de especies"),
  ("para la reforestación de treinta polígonos en San Luis Potosí.", "para la reforestación de 30 polígonos\nen San Luis Potosí."),
 ]),
 ("E3", "El problema: plantar no es reforestar", 0.6, 0.8, [
  ("El socioformador busca que cada hectárea tenga seiscientas cincuenta y ocho plantas", "El socioformador busca que cada hectárea\ntenga 658 plantas"),
  ("de diez especies nativas: agaves, nopales, mezquite y yuca.", "de 10 especies nativas:\nagaves, nopales, mezquite y yuca."),
  ("Pero plantar no es lo mismo que reforestar:", "Pero plantar no es lo mismo que reforestar:"),
  ("en el primer año muere entre el cuatro y el dieciocho por ciento de lo plantado.", "en el primer año muere entre el 4 y el 18 %\nde lo plantado."),
  ("Comprar de menos incumple la meta; comprar de más rebasa el presupuesto de doce mil quinientos pesos por hectárea.", "Comprar de menos incumple la meta; comprar de más\nrebasa el presupuesto de $12,500 por hectárea."),
 ]),
 ("E4", "El proyecto y su alcance", 0.5, 1.0, [
  ("Hoy, la compra se estima a ojo y se siembra con una secuencia fija.", "Hoy, la compra se estima a ojo\ny se siembra con una secuencia fija."),
  ("Nuestro proyecto, refor, responde dos preguntas:", "Nuestro proyecto, refor, responde dos preguntas:"),
  ("cuánto comprar de cada especie, al menor costo y con garantía de cumplir la meta,", "cuánto comprar de cada especie, al menor costo\ny con garantía de cumplir la meta,"),
  ("y cómo acomodarlas para que compitan lo menos posible.", "y cómo acomodarlas\npara que compitan lo menos posible."),
  ("El alcance es lo que el planeador decide; el agua y el terreno quedan fuera.", "El alcance es lo que el planeador decide;\nel agua y el terreno quedan fuera."),
 ]),
 ("E5", "Pregunta 1: diez mil temporadas", 2.4, 0.8, [
  ("Tomemos el agave salmiana del polígono uno.", "Tomemos el Agave salmiana del polígono 1."),
  ("La meta es de doscientas cincuenta y dos, y ya hay cuarenta y seis.", "La meta es de 252, y ya hay 46."),
  ("Simulamos diez mil temporadas de siembra.", "Simulamos 10,000 temporadas de siembra."),
  ("Comprar doscientas veinte alcanza en el noventa y seis por ciento de ellas.", "Comprar 220 alcanza\nen el 96 % de ellas."),
 ]),
 ("E6", "Pregunta 1: el modelo de compra", 0.4, 1.0, [
  ("Con eso armamos un modelo de optimización:", "Con eso armamos un modelo de optimización:"),
  ("minimizar lo que cuesta comprar, más lo que se espera gastar en reponer.", "minimizar lo que cuesta comprar,\nmás lo que se espera gastar en reponer."),
  ("Respetar la meta total, un margen de diez por ciento por especie y el presupuesto.", "Respetar la meta total, un margen de 10 %\npor especie y el presupuesto."),
  ("Y exigir que cada especie cumpla su meta con al menos noventa y cinco por ciento de probabilidad.", "Y exigir que cada especie cumpla su meta\ncon al menos 95 % de probabilidad."),
  ("Esa es la innovación: comprar con una garantía, no a ojo.", "Esa es la innovación:\ncomprar con una garantía, no a ojo."),
 ]),
 ("E7", "Pregunta 1: el resultado", 0.4, 1.2, [
  ("Resultado: ciento ocho mil seiscientas ochenta plantas para los treinta polígonos.", "Resultado: 108,680 plantas\npara los 30 polígonos."),
  ("Y un hallazgo: con doce mil quinientos pesos por hectárea, ningún polígono cumple.", "Y un hallazgo: con $12,500 por hectárea,\nningún polígono cumple."),
  ("Hacen falta catorce mil cuatrocientos noventa y seis.", "Hacen falta $14,496."),
  ("Ni aceptar cincuenta veces más riesgo lo resuelve: ahorra menos del cuatro por ciento.", "Ni aceptar 50 veces más riesgo lo resuelve:\nahorra menos del 4 %."),
  ("El cálculo exacto lo confirma: difiere en ocho centavos por hectárea.", "El cálculo exacto lo confirma:\ndifiere en 8 centavos por hectárea."),
  ("Saberlo antes de plantar evita perder la inversión.", "Saberlo antes de plantar\nevita perder la inversión."),
 ]),
 ("E8", "Pregunta 2: el modelo de siembra", 2.4, 0.8, [
  ("Se siembra al tresbolillo: cada planta tiene seis vecinas.", "Se siembra al tresbolillo:\ncada planta tiene seis vecinas."),
  ("Una matriz mide cuánto compite cada par de especies.", "Una matriz mide cuánto compite\ncada par de especies."),
  ("Dos de la misma especie compiten más; el mezquite apenas compite con las suculentas.", "Dos de la misma especie compiten más;\nel mezquite apenas compite con las suculentas."),
  ("Buscamos el acomodo de menor competencia total,", "Buscamos el acomodo\nde menor competencia total,"),
  ("con una especie por posición y las cantidades que dictó la compra.", "con una especie por posición\ny las cantidades que dictó la compra."),
 ]),
 ("E9", "Pregunta 2: memético y resultado", 0.4, 1.4, [
  ("Lo resolvemos con un algoritmo memético con búsqueda tabú,", "Lo resolvemos con un algoritmo memético\ncon búsqueda tabú,"),
  ("y lo medimos contra un modelo entero exacto.", "y lo medimos contra un modelo entero exacto."),
  ("Resultado: dieciséis por ciento menos competencia que sembrar al azar,", "Resultado: 16 % menos competencia\nque sembrar al azar,"),
  ("a lo más a cuatro punto cinco por ciento del óptimo.", "a lo más a 4.5 % del óptimo."),
  ("Y los treinta polígonos se resuelven con solo seis claves de plantación.", "Y los 30 polígonos se resuelven\ncon solo seis claves de plantación."),
 ]),
 ("E10", "La herramienta y las pruebas", 0.4, 2.9, [
  ("Todo vive en refor, una herramienta de escritorio que se opera sin saber programar,", "Todo vive en refor, una herramienta de escritorio\nque se opera sin saber programar,"),
  ("y que da los mismos resultados en Windows, macOS y Linux.", "y que da los mismos resultados\nen Windows, macOS y Linux."),
 ]),
 ("E11", "Impacto y cierre", 0.4, 4.0, [
  ("El impacto: decisiones de reforestación con respaldo probabilístico,", "El impacto: decisiones de reforestación\ncon respaldo probabilístico,"),
  ("que cuidan el dinero público y la supervivencia de cada planta,", "que cuidan el dinero público\ny la supervivencia de cada planta,"),
  ("y un método abierto que puede repetirse en otros sitios.", "y un método abierto\nque puede repetirse en otros sitios."),
  ("Plantar es fácil. Lograr que sobreviva: ese es el reto.", "Plantar es fácil.\nLograr que sobreviva: ese es el reto."),
 ]),
]


def ts(s):
    m, x = divmod(s, 60); return f"{int(m)}:{x:05.2f}"
def srt(s):
    h = int(s // 3600); m = int(s % 3600 // 60); x = s % 60
    return f"{h:02d}:{m:02d}:{int(x):02d},{int(round((x-int(x))*1000)):03d}"


def planear():
    """Escenas con los tiempos planeados: cada subtítulo dura len(voz) / VEL, con PAUSA entre ellos."""
    t = 0.0; escenas = []
    for eid, tit, pre, post, lin in E:
        ini = t; t += pre; cues = []
        for i, (voz, sub) in enumerate(lin):
            a, b = t, t + len(voz) / VEL
            cues.append({"inicio": round(a, 2), "fin": round(b, 2), "voz": voz, "sub": sub})
            t = b + (PAUSA if i < len(lin) - 1 else 0)
        t += post
        escenas.append({"id": eid, "titulo": tit, "inicio": round(ini, 2), "fin": round(t, 2), "cues": cues})
    return escenas


def main():
    escenas = planear()
    palabras = sum(len(c["voz"].split()) for e in escenas for c in e["cues"])
    total = escenas[-1]["fin"]
    for e in escenas:
        print(f"{e['id']} {ts(e['inicio'])}–{ts(e['fin'])} ({e['fin'] - e['inicio']:.1f}s) {e['titulo']}")
        for c in e["cues"]:
            print(f"   {ts(c['inicio'])}–{ts(c['fin'])}  {c['sub'].replace(chr(10), ' / ')}")
    print("TOTAL", ts(total), "palabras", palabras, f"({palabras / (total / 60):.0f} ppm global)")
    for c in (c for e in escenas for c in e["cues"]):
        for l in c["sub"].split("\n"):
            if len(l) > 50: print("LARGA:", l, len(l))
    json.dump({"escenas": escenas}, open(SALIDA / "linea_de_tiempo.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    with open(SALIDA / "guion.srt", "w", encoding="utf-8") as fh:
        for i, c in enumerate((c for e in escenas for c in e["cues"]), 1):
            fh.write(f"{i}\n{srt(c['inicio'])} --> {srt(c['fin'])}\n{c['sub']}\n\n")


if __name__ == "__main__":
    main()
