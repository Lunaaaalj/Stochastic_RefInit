#include <catch2/catch_approx.hpp>
#include <catch2/catch_test_macros.hpp>
#include <catch2/generators/catch_generators.hpp>

#include <cmath>
#include <cstdlib>

#include "curva.hpp"
#include "exacto.hpp"
#include "simulacion.hpp"

using namespace refor;

TEST_CASE("cola binomial contra valores conocidos", "[exacto]") {
  // P(Bin(10, 0.5) >= 5) = 638/1024
  CHECK(cola_binomial(10, 0.5, 5).prob_cubrir == Catch::Approx(638.0 / 1024));
  // E[(1 - Bin(2, 0.5))^+] = P(S = 0) = 0.25
  CHECK(cola_binomial(2, 0.5, 1).deficit == Catch::Approx(0.25));
  CHECK(cola_binomial(3, 0.9, 0).prob_cubrir == 1.0);
  CHECK(cola_binomial(3, 0.9, 5).deficit == Catch::Approx(5 - 3 * 0.9));
}

TEST_CASE("el Monte Carlo reproduce la curva exacta", "[simulacion]") {
  // A. salmiana en el polígono 2 y P. laevigata (la q más baja) en el 5.
  struct Caso { int n0, E; double area, q; };
  const auto caso = GENERATE(Caso{196, 263, 6.64, 0.9587}, Caso{86, 106, 8.00, 0.8214},
                             Caso{42, 8, 1.28, 0.9435});
  const double alfa = GENERATE(0.05, 0.20);

  const Rango r = banda(caso.n0, caso.area, 0.10);
  const Escenarios esc(caso.q, r.n_max - caso.E, 10'000, 7);
  const Curva mc = esc.curva(caso.E, r, alfa);
  const Curva ex = curva_exacta(caso.E, caso.q, r, alfa);

  for (int n = r.n_min; n <= r.n_max; ++n) {
    INFO("n = " << n);
    CHECK(std::abs(mc.compra(n) - ex.compra(n)) <= 2);
    // El déficit se compara con la misma compra: x* de Monte Carlo y exacto
    // pueden diferir en una o dos plantas, y el déficit es sensible a x.
    // Tolerancia de 4 errores estándar, con E[D²] <= 3·E[D] en este rango.
    const double exacto = cola_binomial(mc.compra(n), caso.q, n - caso.E).deficit;
    const double tol = 4 * std::sqrt(3 * exacto / 10'000) + 0.005;
    CHECK(mc.deficit_esperado(n) == Catch::Approx(exacto).margin(tol));
  }
}

TEST_CASE("x*(n) es monótona en n y en α", "[simulacion]") {
  const Rango r = banda(86, 8.0, 0.10);
  const Escenarios esc(0.8214, r.n_max - 106, 5'000, 11);
  const Curva c05 = esc.curva(106, r, 0.05);
  const Curva c20 = esc.curva(106, r, 0.20);

  for (int n = r.n_min; n < r.n_max; ++n) CHECK(c05.compra(n) <= c05.compra(n + 1));
  for (int n = r.n_min; n <= r.n_max; ++n) CHECK(c20.compra(n) <= c05.compra(n));
}

TEST_CASE("los escenarios son reproducibles con la misma semilla", "[simulacion]") {
  const Rango r = banda(196, 6.64, 0.10);
  const auto semilla = semilla_derivada(42, 2, 1);
  const Curva a = Escenarios(0.9587, r.n_max - 263, 2'000, semilla).curva(263, r, 0.05);
  const Curva b = Escenarios(0.9587, r.n_max - 263, 2'000, semilla).curva(263, r, 0.05);
  CHECK(a.x == b.x);
  CHECK(a.deficit == b.deficit);

  CHECK(semilla_derivada(42, 2, 1) != semilla_derivada(42, 1, 2));
  CHECK(semilla_derivada(42, 2, 1) != semilla_derivada(43, 2, 1));
}

TEST_CASE("sin faltante no se compra nada", "[simulacion]") {
  const Rango r{10, 20};
  const Escenarios esc(0.9, 0, 100, 1);  // E = 25 cubre todo el rango
  const Curva c = esc.curva(25, r, 0.05);
  for (int n = r.n_min; n <= r.n_max; ++n) {
    CHECK(c.compra(n) == 0);
    CHECK(c.deficit_esperado(n) == 0.0);
  }
}
