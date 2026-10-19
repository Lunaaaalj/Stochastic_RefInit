#include <catch2/catch_test_macros.hpp>
#include <catch2/matchers/catch_matchers_floating_point.hpp>

#include <algorithm>
#include <limits>
#include <numeric>
#include <vector>

#include "asignacion_exacta/ple.hpp"
#include "datos.hpp"
#include "memetico/memetico.hpp"

using namespace refor;

#ifndef REFOR_DATOS_DIR
#error "REFOR_DATOS_DIR no definido"
#endif

namespace {

// Mínimo exacto por fuerza bruta (todas las permutaciones distintas de la composición)
double minimo_fuerza_bruta(std::vector<int> ind, const memetico::Mosaico& m, const memetico::Competencia& w) {
  std::sort(ind.begin(), ind.end());
  double mejor = std::numeric_limits<double>::infinity();
  do {
    mejor = std::min(mejor, memetico::competencia_total(ind, m, w));
  } while (std::next_permutation(ind.begin(), ind.end()));
  return mejor;
}

}  // namespace

TEST_CASE("El modelo entero coincide con la fuerza bruta en un mosaico 3x3") {
  const auto datos = cargar_datos(REFOR_DATOS_DIR);
  const memetico::Competencia w(datos, std::string(REFOR_DATOS_DIR) + "/competencia.csv");
  const memetico::Mosaico m(3, 3);

  // Composición de 9 posiciones con 4 especies (índices 0, 1, 8, 9.
  std::vector<int> m_s(datos.especies.size(), 0);
  m_s[1] = 4;  // ASA
  m_s[8] = 3;  // PLA
  m_s[9] = 1;  // YFI
  m_s[0] = 1;  // ALE

  const auto r = asignacion_exacta::resolver_ple(m_s, m, w);
  REQUIRE(r.optimo);
  REQUIRE(r.asignacion.size() == 9);

  // La asignación respeta la composición
  std::vector<int> cuenta(m_s.size(), 0);
  for (int s : r.asignacion) ++cuenta[s];
  REQUIRE(cuenta == m_s);

  const double bf = minimo_fuerza_bruta(r.asignacion, m, w);
  REQUIRE_THAT(r.competencia, Catch::Matchers::WithinAbs(bf, 1e-6));
}

TEST_CASE("El óptimo exacto no es peor que el memético") {
  const auto datos = cargar_datos(REFOR_DATOS_DIR);
  const memetico::Competencia w(datos, std::string(REFOR_DATOS_DIR) + "/competencia.csv");
  const memetico::Mosaico m(3, 4);

  std::vector<int> m_s(datos.especies.size(), 0);
  m_s[1] = 5; m_s[8] = 3; m_s[7] = 2; m_s[9] = 2;

  const auto exacto = asignacion_exacta::resolver_ple(m_s, m, w);
  REQUIRE(exacto.optimo);

  memetico::ParametrosMemetico p;
  p.semilla = 1;
  const auto mem = memetico::ejecutar_memetico(m_s, m, w, p);
  REQUIRE(exacto.competencia <= mem.competencia + 1e-6);
}
