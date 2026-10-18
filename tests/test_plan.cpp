#include <catch2/catch_test_macros.hpp>

#include <filesystem>
#include <numeric>

#include "datos.hpp"
#include "memetico/competencia.hpp"
#include "memetico/mosaico.hpp"
#include "modelo.hpp"
#include "plan.hpp"

using namespace refor;

TEST_CASE("composicion_mosaico reparte exactamente n posiciones por mayor residuo", "[plan]") {
  // 52 · (10, 20, 30) / 60 = (8.67, 17.33, 26) → (9, 17, 26)
  CHECK(composicion_mosaico({10, 20, 30}, 52) == std::vector<int>{9, 17, 26});
  // Empate de residuos (0.5, 0.5): gana la especie de menor índice.
  CHECK(composicion_mosaico({1, 1}, 3) == std::vector<int>{2, 1});
  CHECK(composicion_mosaico({0, 0, 0}, 52).empty());

  const auto m_s = composicion_mosaico({7, 0, 13, 101, 2}, 21);
  CHECK(std::accumulate(m_s.begin(), m_s.end(), 0) == 21);
  CHECK(m_s[1] == 0);
}

TEST_CASE("resolver_espacial agrupa polígonos con la misma composición y es reproducible", "[plan]") {
  const Datos d = cargar_datos(REFOR_DATOS_DIR);
  const memetico::Competencia w(d, std::filesystem::path(REFOR_DATOS_DIR) / "competencia.csv");
  const memetico::Mosaico m(3, 7);

  Parametros p;
  p.K = 2'000;
  const auto curvas = calcular_curvas(d, {1, 2, 3}, {0.05}, p);
  std::vector<Resultado> compras;
  for (const auto& cp : curvas) compras.push_back(resolver_poligono(d, cp, 0, 0.05, 20'000, p.theta));

  ParametrosEspacial pe;
  pe.filas = 3;
  pe.columnas = 7;
  pe.corridas = 3;
  pe.memetico.poblacion = 4;
  pe.memetico.generaciones_max = 10;
  pe.memetico.tabu.iteraciones_sin_mejora = 30;

  pe.hilos = 1;
  const auto a = resolver_espacial(compras, m, w, pe);
  pe.hilos = 3;
  const auto b = resolver_espacial(compras, m, w, pe);

  std::size_t poligonos = 0;
  REQUIRE(a.size() == b.size());
  for (std::size_t g = 0; g < a.size(); ++g) {
    poligonos += a[g].poligonos.size();
    CHECK(std::accumulate(a[g].m_s.begin(), a[g].m_s.end(), 0) == m.num_posiciones());
    CHECK(a[g].mejor == b[g].mejor);
    CHECK(a[g].mejor_competencia <= a[g].media + 1e-9);
    CHECK(a[g].coeficiente() > 0);
  }
  CHECK(poligonos == 3);
}
