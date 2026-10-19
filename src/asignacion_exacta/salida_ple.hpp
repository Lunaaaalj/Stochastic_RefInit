#pragma once

#include <ostream>
#include <vector>

#include "asignacion_exacta/ple.hpp"
#include "datos.hpp"
#include "memetico/competencia.hpp"
#include "memetico/mosaico.hpp"
#include "plan.hpp"
#include "salida.hpp"

namespace refor::asignacion_exacta {

// Resuelve con el modelo entero cada mosaico (composición) de `espacial`,
// arrancando desde la mejor solución del memético. Devuelve un resultado por
// mosaico, en el mismo orden.
std::vector<ResultadoPLE> resolver_exacto(const std::vector<Espacial>& espacial, const memetico::Mosaico& m,
                                          const memetico::Competencia& w, const ParametrosPLE& p);

// Brecha (%) del memético respecto a la cota inferior del exacto; nunca
// negativa. Si el exacto probó optimalidad es la distancia al óptimo; si no,
// una cota superior de ella.
double brecha_memetico(const Espacial& g, const ResultadoPLE& r);

// Posiciones en que difieren las claves del memético y del exacto, tras
// alinearlas por traslación (0: el memético halló el mismo esquema). -1 si el
// exacto no tiene solución.
int posiciones_distintas(const Espacial& g, const ResultadoPLE& r, const memetico::Mosaico& m);

// Compara, mosaico por mosaico, el memético con el modelo entero: competencia
// de cada uno, cota inferior, brecha del memético, posiciones distintas y la
// clave de plantación del exacto. En csv solo va el resumen; el json lleva
// además la clave y la traza de cotas del solver.
void escribir_exacto(std::ostream& out, const Datos& datos, const std::vector<Espacial>& espacial,
                     const std::vector<ResultadoPLE>& exacto, const memetico::Mosaico& m, Formato f);

}  // namespace refor::asignacion_exacta
