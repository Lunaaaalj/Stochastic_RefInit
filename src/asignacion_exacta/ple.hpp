#pragma once

#include <string>
#include <vector>

#include "memetico/competencia.hpp"
#include "memetico/individuo.hpp"
#include "memetico/mosaico.hpp"

namespace refor::asignacion_exacta {

struct ParametrosPLE {
  double limite_segundos = 300.0;  // límite de tiempo del solver
  double brecha_relativa = 0.0;    // 0 = exigir optimalidad (HiGHS: mip_rel_gap)
  bool verbose = false;            // imprime el log de HiGHS
};

struct ResultadoPLE {
  memetico::Individuo asignacion;  // vacío si el solver no encontró solución
  double competencia = 0.0;        // competencia total de `asignacion` (cota superior del óptimo)
  double cota_inferior = 0.0;      // mejor cota inferior probada por el solver
  double brecha = 0.0;             // (competencia - cota_inferior) / |competencia|; inf si no hay solución
  bool optimo = false;             // true si el solver probó optimalidad
  std::string estado;              // estado de HiGHS ("Optimal", "Time limit reached", ...)
  double segundos = 0.0;           // tiempo de reloj del solver
};

// Modelo de programación entera de la sección 2.2 del reporte E2:
//
//   min  sum_{(u,v) en E} sum_{a,b} W_ab z_uvab                      (6)
//   s.a. sum_s y_vs = 1                         para toda posición v  (7)
//        sum_v y_vs = m_s                       para toda especie s   (8)
//        sum_b z_uvab = y_ua                    para (u,v) en E, a    (9)
//        sum_a z_uvab = y_vb                    para (u,v) en E, b    (10)
//        y binaria, z >= 0
//
// m_s[s] es el número de posiciones de la especie s (Σ m_s = m.num_posiciones()).
// Como el mosaico es un toro, toda traslación es una simetría: se fija la
// especie más abundante en la posición 0 sin perder optimalidad.
// Todas las aristas del tresbolillo tienen el mismo peso (w_uv = 1), igual que
// competencia_total() del memético, así que ambos métodos minimizan lo mismo.
//
// `inicial`, si se da, es una asignación factible (por ejemplo, la mejor del
// memético) con la que arranca el solver: no cambia el óptimo ni la cota
// inferior, pero le da desde el inicio una cota superior con la que podar.
ResultadoPLE resolver_ple(const std::vector<int>& m_s, const memetico::Mosaico& m,
                          const memetico::Competencia& w, const ParametrosPLE& p = {},
                          const memetico::Individuo* inicial = nullptr);

}  // namespace refor::asignacion_exacta
