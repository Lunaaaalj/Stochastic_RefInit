#pragma once

#include <ostream>
#include <vector>

#include "datos.hpp"
#include "modelo.hpp"

namespace refor {

enum class Formato { Tabla, Csv, Json };

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

}  // namespace refor
