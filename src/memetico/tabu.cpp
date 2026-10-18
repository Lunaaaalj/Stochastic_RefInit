@'
#pragma once

#include <random>

#include "memetico/competencia.hpp"
#include "memetico/individuo.hpp"
#include "memetico/mosaico.hpp"

namespace refor::memetico {

struct ParametrosTabu {
  int iteraciones_sin_mejora = 500;  // paro de la búsqueda
  int tenure_min = 5;                // iteraciones mínimas que un intercambio queda prohibido
  int tenure_max = 15;               // iteraciones máximas
};

// Mejora ind in situ con búsqueda tabú sobre intercambios de especie entre
// dos posiciones (conserva la composición, solo reordena). Cada iteración
// aplica el mejor intercambio no prohibido, salvo que uno prohibido dé una
// solución mejor que la mejor encontrada (criterio de aspiración). Devuelve
// la competencia total de la mejor solución encontrada, que es la que queda
// en ind al salir.
double busqueda_tabu(Individuo& ind, const Mosaico& m, const Competencia& w, const ParametrosTabu& p,
                     std::mt19937_64& rng);

}  // namespace refor::memetico
'@ | Set-Content -Path "src\memetico\tabu.hpp" -Encoding utf8