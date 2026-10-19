#include <catch2/catch_test_macros.hpp>
#include <catch2/matchers/catch_matchers_floating_point.hpp>

#include <algorithm>
#include <atomic>
#include <cmath>
#include <limits>
#include <numeric>
#include <random>
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

TEST_CASE("La traza de cotas termina en el resultado y la dual nunca rebasa la primal") {
  const auto datos = cargar_datos(REFOR_DATOS_DIR);
  const memetico::Competencia w(datos, std::string(REFOR_DATOS_DIR) + "/competencia.csv");
  const memetico::Mosaico m(3, 4);

  std::vector<int> m_s(datos.especies.size(), 0);
  m_s[1] = 5; m_s[8] = 3; m_s[7] = 2; m_s[9] = 2;

  int avisos = 0;
  asignacion_exacta::ParametrosPLE p;
  p.avance = [&avisos](const asignacion_exacta::PuntoTraza&) { ++avisos; };
  const auto r = asignacion_exacta::resolver_ple(m_s, m, w, p);
  REQUIRE(r.optimo);
  REQUIRE(r.traza.size() >= 2);
  REQUIRE(avisos == static_cast<int>(r.traza.size()) - 1);  // el punto final no se avisa
  REQUIRE_THAT(r.traza.back().primal, Catch::Matchers::WithinAbs(r.competencia, 1e-9));
  for (std::size_t i = 0; i < r.traza.size(); ++i) {
    const auto& pt = r.traza[i];
    if (std::isfinite(pt.primal) && std::isfinite(pt.dual)) REQUIRE(pt.dual <= pt.primal + 1e-6);
    if (i > 0) REQUIRE(pt.segundos >= r.traza[i - 1].segundos);
  }
}

TEST_CASE("Cancelar el modelo entero devuelve la solución inicial") {
  const auto datos = cargar_datos(REFOR_DATOS_DIR);
  const memetico::Competencia w(datos, std::string(REFOR_DATOS_DIR) + "/competencia.csv");
  const memetico::Mosaico m(4, 13);

  std::vector<int> m_s(datos.especies.size(), 0);
  m_s[1] = 20; m_s[8] = 14; m_s[7] = 10; m_s[9] = 8;
  memetico::ParametrosMemetico pm;
  pm.semilla = 3;
  pm.generaciones_max = 5;
  const auto mem = memetico::ejecutar_memetico(m_s, m, w, pm);

  std::atomic<bool> cancelar{true};  // cancelado desde antes de empezar
  asignacion_exacta::ParametrosPLE p;
  p.cancelar = &cancelar;
  const auto r = asignacion_exacta::resolver_ple(m_s, m, w, p, &mem.mejor);
  REQUIRE(r.cancelado);
  REQUIRE_FALSE(r.optimo);
  REQUIRE(r.segundos < 30);
  REQUIRE(r.competencia <= mem.competencia + 1e-6);
  // El exacto arranca de la clave del memético: la misma, salvo traslación.
  if (r.competencia >= mem.competencia - 1e-6) REQUIRE(memetico::distancia_traslacion(r.asignacion, mem.mejor, m) == 0);
}

TEST_CASE("alinear deshace una traslación") {
  const memetico::Mosaico m(4, 5);
  std::mt19937_64 rng(7);
  const auto a = memetico::individuo_aleatorio({8, 7, 5}, m.num_posiciones(), rng);
  const auto b = memetico::trasladar(a, m, 2, 3);
  REQUIRE(memetico::alinear(a, b, m) == a);
  REQUIRE(memetico::distancia_traslacion(a, b, m) == 0);
}
