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

// Compara, mosaico por mosaico, el memético con el modelo entero: competencia
// de cada uno, cota inferior, brecha del memético y la clave de plantación del
// exacto. Los formatos tabla y json escriben el texto; csv, un resumen.
void escribir_exacto(std::ostream& out, const Datos& datos, const std::vector<Espacial>& espacial,
                     const std::vector<ResultadoPLE>& exacto, const memetico::Mosaico& m, Formato f);

}  // namespace refor::asignacion_exacta
