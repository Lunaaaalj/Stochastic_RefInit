"""Exporta los datos crudos de INECOL a CSV para la CLI del modelo de compra.

Uso (desde la raíz del repo):
    uv run --no-project --with pandas --with openpyxl python scripts/exportar_datos.py

Genera en data/processed/:
    especies.csv     especie, n0, c, q
    poligonos.csv    poligono, area
    existentes.csv   poligono, especie, E

Notas sobre las fuentes:
- Las áreas se leen de la Hoja2 de datos_inecol.xlsx. La fila "Dimensión del
  polígono" de la Hoja1 tiene celdas que Excel convirtió en fechas (7.11 ->
  2024-11-07), por lo que no es confiable.
- q es la supervivencia del monitoreo 2022 (primer año) de
  "Reajuste de cantidad de planta.xlsx".
- Los costos unitarios c no aparecen en los archivos crudos; se toman de la
  tabla tab:compra-parametros del reporte E2 (reports/e2/secciones/modelo-compra.tex).
"""

from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parents[1]
RAW = RAIZ / "data" / "raw"
SALIDA = RAIZ / "data" / "processed"

# Costo unitario por planta, sin logística (reporte E2, tab:compra-parametros).
COSTOS = {
    "Agave lechuguilla": 26.0,
    "Agave salmiana": 26.0,
    "Agave scabra": 26.0,
    "Agave striata": 26.0,
    "Opuntia cantabrigiensis": 18.0,
    "Opuntia engelmannii": 21.0,
    "Opuntia robusta": 18.0,
    "Opuntia streptacantha": 18.0,
    "Prosopis laevigata": 26.5,
    "Yucca filifera": 26.0,
}


def main() -> None:
    inecol = pd.read_excel(RAW / "datos_inecol.xlsx", sheet_name=None, header=None)
    hoja1, hoja2 = inecol["Hoja1"], inecol["Hoja2"]

    especies = hoja1.iloc[1:11, 0].str.strip().tolist()
    n0 = hoja1.iloc[1:11, 1].astype(int).tolist()
    assert sum(n0) == 658, "el plan debe sumar 658 plantas/ha"

    reajuste = pd.read_excel(RAW / "Reajuste de cantidad de planta.xlsx", header=None)
    q = (reajuste.iloc[2:12, 3].astype(float) / 100).round(4).tolist()
    assert reajuste.iloc[2:12, 0].str.strip().tolist() == especies

    SALIDA.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(
        {"especie": especies, "n0": n0, "c": [COSTOS[s] for s in especies], "q": q}
    ).to_csv(SALIDA / "especies.csv", index=False)

    areas = hoja2.iloc[0:30, [6, 7]].astype({6: int, 7: float})
    areas.columns = ["poligono", "area"]
    assert abs(areas["area"].sum() - 183.01) < 1e-6
    areas.to_csv(SALIDA / "poligonos.csv", index=False)

    conteos = hoja1.iloc[16:26, 1:31].astype(int)
    assert hoja1.iloc[16:26, 0].str.strip().tolist() == especies
    filas = [
        {"poligono": i + 1, "especie": s, "E": int(conteos.iloc[k, i])}
        for i in range(30)
        for k, s in enumerate(especies)
    ]
    pd.DataFrame(filas).to_csv(SALIDA / "existentes.csv", index=False)
    print(f"CSV escritos en {SALIDA.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
