#include <catch2/catch_approx.hpp>
#include <catch2/catch_test_macros.hpp>

#include <algorithm>
#include <filesystem>
#include <numeric>
#include <random>
#include <vector>

#include "azar.hpp"
#include "datos.hpp"
#include "memetico/competencia.hpp"
#include "memetico/individuo.hpp"
#include "memetico/memetico.hpp"
#include "memetico/mosaico.hpp"
#include "memetico/tabu.hpp"

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


namespace {

Competencia cargar_competencia(const Datos& d) {
  return Competencia(d, std::filesystem::path(REFOR_DATOS_DIR) / "competencia.csv");
}

}  // namespace

TEST_CASE("trasladar y distancia_traslacion reconocen el mismo esquema desplazado", "[memetico]") {
  Mosaico m(7, 3);
  const Datos d = cargar_datos(REFOR_DATOS_DIR);
  std::mt19937_64 rng(1);
  std::vector<int> m_s(d.especies.size(), 0);
  m_s[0] = 10;
  m_s[1] = 11;
  const Individuo a = individuo_aleatorio(m_s, m.num_posiciones(), rng);
  const Individuo b = trasladar(a, m, 2, 1);

  CHECK(distancia_traslacion(a, b, m) == 0);
  CHECK(distancia_traslacion(a, a, m) == 0);
}

TEST_CASE("busqueda_tabu nunca empeora la solución inicial", "[memetico]") {
  const Datos d = cargar_datos(REFOR_DATOS_DIR);
  const Competencia w = cargar_competencia(d);
  Mosaico m(7, 3);
  std::vector<int> m_s(d.especies.size(), 0);
  m_s[0] = 7;
  m_s[1] = 7;
  m_s[2] = 7;

  std::mt19937_64 rng(7);
  Individuo ind = individuo_aleatorio(m_s, m.num_posiciones(), rng);
  const double inicial = competencia_total(ind, m, w);

  ParametrosTabu p;
  p.iteraciones_sin_mejora = 100;
  const double final = busqueda_tabu(ind, m, w, p, rng);

  CHECK(final <= inicial + 1e-9);
  CHECK(final == Catch::Approx(competencia_total(ind, m, w)));
}

TEST_CASE("cruzar produce un hijo con la composición exacta de m_s", "[memetico]") {
  const Datos d = cargar_datos(REFOR_DATOS_DIR);
  const Competencia w = cargar_competencia(d);
  Mosaico m(7, 3);
  std::vector<int> m_s(d.especies.size(), 0);
  m_s[0] = 8;
  m_s[3] = 6;
  m_s[7] = 7;

  std::mt19937_64 rng(3);
  const Individuo p1 = individuo_aleatorio(m_s, m.num_posiciones(), rng);
  const Individuo p2 = individuo_aleatorio(m_s, m.num_posiciones(), rng);
  const Individuo hijo = cruzar(p1, p2, m_s, m, w, rng);

  REQUIRE(hijo.size() == static_cast<std::size_t>(m.num_posiciones()));
  std::vector<int> conteo(d.especies.size(), 0);
  for (int s : hijo) {
    REQUIRE(s >= 0);
    ++conteo[s];
  }
  CHECK(conteo == m_s);
}

TEST_CASE("memetico corre un ejercicio chico y regresa una solución válida", "[memetico]") {
  const Datos d = cargar_datos(REFOR_DATOS_DIR);
  const Competencia w = cargar_competencia(d);
  Mosaico m(7, 3);  // 21 posiciones
  std::vector<int> m_s(d.especies.size(), 0);
  m_s[0] = 3;
  m_s[1] = 4;
  m_s[4] = 5;
  m_s[8] = 9;

  ParametrosMemetico p;
  p.poblacion = 6;
  p.generaciones_max = 30;
  p.generaciones_sin_mejora_max = 15;
  p.tabu.iteraciones_sin_mejora = 50;
  p.semilla = 123;

  const auto r = ejecutar_memetico(m_s, m, w, p);

  REQUIRE(r.mejor.size() == static_cast<std::size_t>(m.num_posiciones()));
  std::vector<int> conteo(d.especies.size(), 0);
  for (int s : r.mejor) ++conteo[s];
  CHECK(conteo == m_s);
  CHECK(r.competencia == Catch::Approx(competencia_total(r.mejor, m, w)));
}
TEST_CASE("memetico registra la historia y avisa cada generación", "[memetico]") {
  const Datos d = cargar_datos(REFOR_DATOS_DIR);
  const Competencia w = cargar_competencia(d);
  Mosaico m(7, 3);
  std::vector<int> m_s(d.especies.size(), 0);
  m_s[0] = 6;
  m_s[1] = 8;
  m_s[5] = 7;

  ParametrosMemetico p;
  p.poblacion = 5;
  p.generaciones_max = 20;
  p.generaciones_sin_mejora_max = 20;
  p.tabu.iteraciones_sin_mejora = 30;
  p.semilla = 9;
  int avisos = 0, ultima = 0;
  p.al_generar = [&](int gen, double) {
    ++avisos;
    ultima = gen;
  };

  const auto r = ejecutar_memetico(m_s, m, w, p);
  REQUIRE(r.historia.size() == static_cast<std::size_t>(r.generaciones + 1));
  for (std::size_t g = 1; g < r.historia.size(); ++g) CHECK(r.historia[g] <= r.historia[g - 1]);
  CHECK(r.historia.back() == Catch::Approx(r.competencia));
  CHECK(avisos == r.generaciones);
  CHECK(ultima == r.generaciones);
  CHECK_FALSE(r.cancelado);
}

TEST_CASE("memetico cancelado termina sin generaciones con una solución válida", "[memetico]") {
  const Datos d = cargar_datos(REFOR_DATOS_DIR);
  const Competencia w = cargar_competencia(d);
  Mosaico m(4, 13);
  std::vector<int> m_s(d.especies.size(), 0);
  m_s[0] = 20;
  m_s[1] = 32;

  const std::atomic<bool> cancelar{true};
  ParametrosMemetico p;
  p.cancelar = &cancelar;
  const auto r = ejecutar_memetico(m_s, m, w, p);

  CHECK(r.cancelado);
  CHECK(r.generaciones == 0);
  std::vector<int> conteo(d.especies.size(), 0);
  for (int s : r.mejor) ++conteo[s];
  CHECK(conteo == m_s);
  CHECK(r.competencia == Catch::Approx(competencia_total(r.mejor, m, w)));
}

TEST_CASE("el azar del memético es el mismo en todas las plataformas", "[memetico]") {
  // Secuencias congeladas: si cambian, cambian las claves publicadas.
  std::mt19937_64 r(42);
  std::vector<std::int64_t> enteros;
  for (int k = 0; k < 8; ++k) enteros.push_back(entero_uniforme(r, 5, 19));
  CHECK(enteros == std::vector<std::int64_t>{11, 13, 15, 19, 10, 17, 5, 5});

  std::vector<int> v(10);
  std::iota(v.begin(), v.end(), 0);
  std::mt19937_64 g(7);
  barajar(v.begin(), v.end(), g);
  CHECK(v == std::vector<int>{7, 3, 8, 9, 1, 4, 0, 5, 6, 2});

#ifdef _LIBCPP_VERSION
  // Con libc++ deben coincidir con la biblioteca estándar, que es con la que
  // se generaron los resultados.
  for (const auto [a, b] : {std::pair{0, 19}, std::pair{5, 15}, std::pair{0, 1}, std::pair{3, 3}}) {
    std::mt19937_64 r1(9), r2(9);
    std::uniform_int_distribution<int> u(a, b);
    for (int k = 0; k < 200; ++k) CHECK(entero_uniforme(r1, a, b) == u(r2));
  }
  std::vector<int> x(52), y(52);
  std::iota(x.begin(), x.end(), 0);
  std::iota(y.begin(), y.end(), 0);
  std::mt19937_64 g1(3), g2(3);
  barajar(x.begin(), x.end(), g1);
  std::shuffle(y.begin(), y.end(), g2);
  CHECK(x == y);
#endif
}
