#include <catch2/catch_approx.hpp>
#include <catch2/catch_test_macros.hpp>

#include <limits>
#include <optional>

#include "datos.hpp"
#include "mochila.hpp"
#include "modelo.hpp"

using namespace refor;

namespace {

// Tres especies con curvas pequeñas; la segunda es barata por planta pero
// necesita más compra, la tercera es cara.
Instancia pequena(double theta = 0.05) {
  return Instancia{{Curva{4, {5, 6, 8, 9}, {0.10, 0.20, 0.10, 0.30}},
                    Curva{2, {3, 5, 7}, {0.00, 0.40, 0.20}},
                    Curva{3, {4, 5, 6, 7, 9}, {0.30, 0.10, 0.20, 0.10, 0.00}}},
                   {20.0, 12.0, 30.0},
                   12,
                   theta};
}

// Enumeración completa del problema con presupuesto opcional.
std::optional<double> fuerza_bruta(const Instancia& inst, std::optional<double> presupuesto) {
  const double f = 1 + inst.theta;
  std::optional<double> mejor;
  const auto& c = inst.curvas;
  for (int a = c[0].n_min; a <= c[0].n_max(); ++a)
    for (int b = c[1].n_min; b <= c[1].n_max(); ++b)
      for (int d = c[2].n_min; d <= c[2].n_max(); ++d) {
        if (a + b + d != inst.total) continue;
        const double compra =
            f * (inst.c[0] * c[0].compra(a) + inst.c[1] * c[1].compra(b) + inst.c[2] * c[2].compra(d));
        const double repo = f * (inst.c[0] * c[0].deficit_esperado(a) +
                                 inst.c[1] * c[1].deficit_esperado(b) +
                                 inst.c[2] * c[2].deficit_esperado(d));
        if (presupuesto && compra > *presupuesto + 1e-9) continue;
        if (!mejor || compra + repo < *mejor) mejor = compra + repo;
      }
  return mejor;
}

void verificar_restricciones(const Instancia& inst, const Solucion& s, std::optional<double> pres) {
  int suma = 0;
  for (std::size_t k = 0; k < inst.curvas.size(); ++k) {
    CHECK(s.n[k] >= inst.curvas[k].n_min);
    CHECK(s.n[k] <= inst.curvas[k].n_max());
    CHECK(s.x[k] == inst.curvas[k].compra(s.n[k]));
    suma += s.n[k];
  }
  CHECK(suma == inst.total);
  if (pres) CHECK(s.costo_compra <= *pres + 1e-6);
}

}  // namespace

TEST_CASE("DP y HiGHS coinciden con la fuerza bruta sin presupuesto", "[mochila]") {
  const Instancia inst = pequena();
  const auto esperado = fuerza_bruta(inst, std::nullopt);
  REQUIRE(esperado);

  const auto dp = resolver_dp(inst, Criterio::Total);
  const auto milp = resolver_highs(inst, std::nullopt);
  REQUIRE(dp);
  REQUIRE(milp);
  CHECK(dp->costo_total() == Catch::Approx(*esperado));
  CHECK(milp->costo_total() == Catch::Approx(*esperado));
  verificar_restricciones(inst, *dp, std::nullopt);
}

TEST_CASE("con presupuesto, resolver coincide con la fuerza bruta", "[mochila]") {
  const Instancia inst = pequena();
  for (double pres = 200; pres <= 420; pres += 5) {
    INFO("presupuesto = " << pres);
    const auto esperado = fuerza_bruta(inst, pres);
    const auto sol = resolver(inst, pres);
    REQUIRE(sol.has_value() == esperado.has_value());
    if (!sol) continue;
    CHECK(sol->costo_total() == Catch::Approx(*esperado));
    verificar_restricciones(inst, *sol, pres);
  }
}

TEST_CASE("la DP de compra mínima da el umbral de factibilidad", "[mochila]") {
  const Instancia inst = pequena();
  const auto minima = resolver_dp(inst, Criterio::Compra);
  REQUIRE(minima);
  CHECK(resolver(inst, minima->costo_compra).has_value());
  CHECK_FALSE(resolver(inst, minima->costo_compra - 1).has_value());
}

TEST_CASE("una suma imposible para la banda es infactible", "[mochila]") {
  Instancia inst = pequena();
  inst.total = 100;
  CHECK_FALSE(resolver_dp(inst, Criterio::Total).has_value());
  CHECK_FALSE(resolver_highs(inst, std::nullopt).has_value());
}

TEST_CASE("un polígono real respeta suma, banda y presupuesto", "[mochila][modelo]") {
  const Datos d = cargar_datos(REFOR_DATOS_DIR);
  Parametros p;
  p.metodo = Metodo::Exacto;
  const auto curvas = calcular_curvas(d, {1, 5}, {0.05, 0.30}, p);

  for (const auto& cp : curvas) {
    for (std::size_t a = 0; a < 2; ++a) {
      const Instancia inst = instancia(d, cp, a, p.theta);
      const auto libre = resolver_dp(inst, Criterio::Total);
      const auto milp = resolver_highs(inst, std::nullopt);
      REQUIRE(libre);
      REQUIRE(milp);
      CHECK(milp->costo_total() == Catch::Approx(libre->costo_total()));

      // Presupuesto entre la compra mínima y la del óptimo libre: usa HiGHS.
      const auto minima = resolver_dp(inst, Criterio::Compra);
      const double pres = (minima->costo_compra + libre->costo_compra) / 2;
      const auto sol = resolver(inst, pres);
      REQUIRE(sol);
      verificar_restricciones(inst, *sol, pres);
      CHECK(sol->costo_total() >= libre->costo_total() - 1e-6);
    }
  }
}
