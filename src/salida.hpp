#pragma once

#include <optional>
#include <ostream>
#include <string>
#include <vector>

#include "datos.hpp"
#include "memetico/mosaico.hpp"
#include "modelo.hpp"
#include "plan.hpp"

namespace refor {

enum class Formato { Tabla, Csv, Json };

// Clave corta de la especie: inicial del género y dos letras del epíteto
// (Agave salmiana → Asa), que es lo que la cuadrilla lee en campo.
std::string clave_especie(const std::string& nombre);

// B*(α) y costo óptimo agregados sobre los polígonos (promedios ponderados por
// área) y el rango de B* entre polígonos; vacíos si algún polígono no tiene valor.
struct AgregadoFrontera {
  std::optional<double> B_minimo, costo_libre, B_min_pol, B_max_pol;
};
AgregadoFrontera agregar_frontera(const std::vector<Frontera>& res, double alfa);

// Compra por polígono y especie. Si el polígono es infactible con B, las
// cantidades reportadas son las del óptimo sin presupuesto.
void escribir_compra(std::ostream& out, const Datos& datos, const std::vector<Resultado>& res,
                     Formato f);

// Rejilla α × B: factibilidad y costo por hectárea de cada polígono.
void escribir_barrido(std::ostream& out, const std::vector<Resultado>& res,
                      const std::vector<double>& alfas, const std::vector<double>& Bs, Formato f);

// Presupuesto mínimo B*(α) por polígono y agregado ponderado por área.
void escribir_frontera(std::ostream& out, const std::vector<Frontera>& res,
                       const std::vector<double>& alfas, Formato f);

// Mosaicos del memético: composición, competencia (mejor, media ± d.e. de las
// corridas, coeficiente respecto al azar) y la clave de plantación. En csv
// solo va el resumen; la clave se escribe aparte con escribir_mosaicos_csv.
void escribir_espacial(std::ostream& out, const Datos& datos, const std::vector<Espacial>& res,
                       const memetico::Mosaico& m, int corridas, Formato f);

// Clave de cada mosaico en formato largo: mosaico,fila,columna,especie.
void escribir_mosaicos_csv(std::ostream& out, const Datos& datos, const std::vector<Espacial>& res,
                           const memetico::Mosaico& m);

}  // namespace refor
