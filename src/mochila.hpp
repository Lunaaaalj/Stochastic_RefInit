#pragma once

#include <optional>
#include <vector>

#include "curva.hpp"

namespace refor {

// Mochila de elección múltiple de un polígono: elegir una meta n_s por especie
// con Σ n_s = total, minimizando (1+θ) Σ c_s (x*_s(n_s) + E[D_s](n_s)) sujeto a
// (1+θ) Σ c_s x*_s(n_s) <= presupuesto. El costo de reposición es igual al de
// compra (c^R_s = (1+θ) c_s).
struct Instancia {
  std::vector<Curva> curvas;  // una por especie
  std::vector<double> c;      // costo unitario por especie
  int total;                  // Σ n_s = round(658·A)
  double theta;               // sobrecosto logístico
};

struct Solucion {
  std::vector<int> n, x;
  std::vector<double> deficit;
  std::vector<double> compra_especie, reposicion_especie;  // (1+θ) c x, (1+θ) c E[D]
  double costo_compra = 0;      // (1+θ) Σ c x
  double costo_reposicion = 0;  // (1+θ) Σ c E[D]
  double costo_total() const { return costo_compra + costo_reposicion; }
};

enum class Criterio {
  Total,   // minimiza compra + reposición esperada (objetivo del modelo)
  Compra,  // minimiza solo la compra (da el presupuesto mínimo factible)
};

// Programación dinámica exacta sobre la suma de metas, sin presupuesto.
// Devuelve nullopt si la banda no admite Σ n = total.
std::optional<Solucion> resolver_dp(const Instancia& inst, Criterio criterio);

// MILP con HiGHS. Sin presupuesto equivale a resolver_dp(inst, Criterio::Total).
std::optional<Solucion> resolver_highs(const Instancia& inst, std::optional<double> presupuesto);

// Problema completo. Evita el MILP cuando la DP basta: si el óptimo sin
// presupuesto cabe, es la solución; si ni la compra mínima cabe, es infactible.
std::optional<Solucion> resolver(const Instancia& inst, double presupuesto);

}  // namespace refor
