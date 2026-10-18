#include <catch2/catch_approx.hpp>
#include <catch2/catch_test_macros.hpp>

#include <algorithm>
#include <filesystem>

#include "datos.hpp"
#include "memetico/competencia.hpp"
#include "memetico/individuo.hpp"
#include "memetico/mosaico.hpp"

using namespace refor;
using namespace refor::memetico;

TEST_CASE("el mosaico tiene 6 vecinas por posición y aristas sin repetir", "[memetico]") {
  Mosaico m(7, 3);  // 21 posiciones, la línea base vigente
  CHECK(m.num_posiciones() == 21);
  for (int v = 0; v < m.num_posiciones(); ++v) CHECK(m.vecinas(v).size() == 6);
  CHECK(m.aristas().size() == 21 * 6 / 2);

  for (const auto& [u, v] : m.aristas()) {
    const auto& vec_u = m.vecinas(u);
    CHECK(std::find(vec_u.begin(), vec_u.end(), v) != vec_u.end());
  }
}

TEST_CASE("la competencia se carga simétrica", "[memetico]") {
  const Datos d = cargar_datos(REFOR_DATOS_DIR);
  const Competencia w(d, std::filesystem::path(REFOR_DATOS_DIR) / "competencia.csv");
  for (std::size_t a = 0; a < d.especies.size(); ++a)
    for (std::size_t b = 0; b < d.especies.size(); ++b)
      CHECK(w(static_cast<int>(a), static_cast<int>(b)) == w(static_cast<int>(b), static_cast<int>(a)));

  // Agave salmiana, la segunda especie del csv, tiene la competencia
  // intraespecífica más alta entre los agaves (1.29).
  CHECK(w(1, 1) == Catch::Approx(1.29));
}

TEST_CASE("competencia_total suma el peso de cada arista", "[memetico]") {
  const Datos d = cargar_datos(REFOR_DATOS_DIR);
  const Competencia w(d, std::filesystem::path(REFOR_DATOS_DIR) / "competencia.csv");
  Mosaico m(2, 2);  // 4 posiciones, 6 aristas (periódico)

  Individuo ind(m.num_posiciones(), 0);  // todas la especie 0 (Agave lechuguilla)
  const double esperado = w(0, 0) * static_cast<double>(m.aristas().size());
  CHECK(competencia_total(ind, m, w) == Catch::Approx(esperado));
}

TEST_CASE("la competencia esperada aleatoria es simétrica en la composición", "[memetico]") {
  const Datos d = cargar_datos(REFOR_DATOS_DIR);
  const Competencia w(d, std::filesystem::path(REFOR_DATOS_DIR) / "competencia.csv");
  Mosaico m(7, 3);

  std::vector<int> m_s(d.especies.size(), 0);
  m_s[0] = 21;  // todo el mosaico es una sola especie
  const double libre = competencia_esperada_aleatoria(m_s, m, w);

  Individuo ind(m.num_posiciones(), 0);
  CHECK(competencia_total(ind, m, w) == Catch::Approx(libre));
}