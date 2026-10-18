#pragma once

#include <vector>

#include "memetico/competencia.hpp"
#include "memetico/mosaico.hpp"

namespace refor::memetico {

// Un individuo es una asignación de especie a cada posición del mosaico:
// especie[v] es el índice de la especie en la posición v (mismo índice que
// Datos::especies). Su tamaño debe ser m.num_posiciones().
using Individuo = std::vector<int>;

// La aptitud del reporte: suma, sobre todas las aristas del mosaico, de la
// penalización entre las especies de sus dos extremos.
double competencia_total(const Individuo& ind, const Mosaico& m, const Competencia& w);

// Competencia esperada bajo una asignación aleatoria de la misma composición
// m_s (plantas de cada especie). Sirve para el coeficiente de competencia
// del reporte: competencia_total(...) / competencia_esperada_aleatoria(...).
double competencia_esperada_aleatoria(const std::vector<int>& m_s, const Mosaico& m, const Competencia& w);

}  // namespace refor::memetico