#include "mochila.hpp"

#include <limits>
#include <stdexcept>

#include "Highs.h"

namespace refor {

namespace {

constexpr double kInf = std::numeric_limits<double>::infinity();
// Holgura para comparar costos en pesos tras sumar flotantes.
constexpr double kTol = 1e-6;

double costo_compra(const Instancia& inst, std::size_t s, int n) {
  return (1 + inst.theta) * inst.c[s] * inst.curvas[s].compra(n);
}

double costo_reposicion(const Instancia& inst, std::size_t s, int n) {
  return (1 + inst.theta) * inst.c[s] * inst.curvas[s].deficit_esperado(n);
}

Solucion armar(const Instancia& inst, const std::vector<int>& n) {
  Solucion sol;
  sol.n = n;
  for (std::size_t s = 0; s < n.size(); ++s) {
    sol.x.push_back(inst.curvas[s].compra(n[s]));
    sol.deficit.push_back(inst.curvas[s].deficit_esperado(n[s]));
    sol.compra_especie.push_back(costo_compra(inst, s, n[s]));
    sol.reposicion_especie.push_back(costo_reposicion(inst, s, n[s]));
    sol.costo_compra += sol.compra_especie.back();
    sol.costo_reposicion += sol.reposicion_especie.back();
  }
  return sol;
}

void validar(const Instancia& inst) {
  if (inst.curvas.size() != inst.c.size() || inst.curvas.empty()) {
    throw std::invalid_argument("instancia con curvas y costos de distinto tamaño");
  }
}

}  // namespace

std::optional<Solucion> resolver_dp(const Instancia& inst, Criterio criterio) {
  validar(inst);
  const std::size_t S = inst.curvas.size();

  // Estado: suma parcial de metas, desplazada por Σ n_min.
  int base = 0, holgura = 0;
  for (const auto& cv : inst.curvas) {
    base += cv.n_min;
    holgura += cv.n_max() - cv.n_min;
  }
  const int objetivo = inst.total - base;
  if (objetivo < 0 || objetivo > holgura) return std::nullopt;

  std::vector<double> mejor(holgura + 1, kInf), siguiente;
  mejor[0] = 0;
  std::vector<std::vector<int>> eleccion(S, std::vector<int>(holgura + 1, -1));

  for (std::size_t s = 0; s < S; ++s) {
    const Curva& cv = inst.curvas[s];
    siguiente.assign(holgura + 1, kInf);
    for (int t = 0; t <= holgura; ++t) {
      if (mejor[t] == kInf) continue;
      for (int d = 0; d <= cv.n_max() - cv.n_min && t + d <= holgura; ++d) {
        const int n = cv.n_min + d;
        double costo = costo_compra(inst, s, n);
        if (criterio == Criterio::Total) costo += costo_reposicion(inst, s, n);
        if (mejor[t] + costo < siguiente[t + d]) {
          siguiente[t + d] = mejor[t] + costo;
          eleccion[s][t + d] = d;
        }
      }
    }
    mejor.swap(siguiente);
  }
  if (mejor[objetivo] == kInf) return std::nullopt;

  std::vector<int> n(S);
  for (int t = objetivo, s = static_cast<int>(S) - 1; s >= 0; --s) {
    const int d = eleccion[s][t];
    n[s] = inst.curvas[s].n_min + d;
    t -= d;
  }
  return armar(inst, n);
}

std::optional<Solucion> resolver_highs(const Instancia& inst, std::optional<double> presupuesto) {
  validar(inst);
  const std::size_t S = inst.curvas.size();

  // Una columna binaria z_{s,n} por especie y meta candidata. Filas: una
  // meta por especie (S filas), suma de metas, presupuesto.
  HighsLp lp;
  const HighsInt fila_suma = static_cast<HighsInt>(S), fila_pres = fila_suma + 1;
  lp.num_row_ = fila_pres + (presupuesto ? 1 : 0);
  lp.row_lower_.assign(S, 1.0);
  lp.row_upper_.assign(S, 1.0);
  lp.row_lower_.push_back(inst.total);
  lp.row_upper_.push_back(inst.total);
  if (presupuesto) {
    lp.row_lower_.push_back(-kInf);
    lp.row_upper_.push_back(*presupuesto);
  }

  auto& A = lp.a_matrix_;
  A.format_ = MatrixFormat::kColwise;
  A.start_ = {0};
  std::vector<std::pair<std::size_t, int>> columnas;
  for (std::size_t s = 0; s < S; ++s) {
    const Curva& cv = inst.curvas[s];
    for (int n = cv.n_min; n <= cv.n_max(); ++n) {
      columnas.emplace_back(s, n);
      lp.col_cost_.push_back(costo_compra(inst, s, n) + costo_reposicion(inst, s, n));
      A.index_.push_back(static_cast<HighsInt>(s));
      A.value_.push_back(1.0);
      A.index_.push_back(fila_suma);
      A.value_.push_back(n);
      if (presupuesto) {
        A.index_.push_back(fila_pres);
        A.value_.push_back(costo_compra(inst, s, n));
      }
      A.start_.push_back(static_cast<HighsInt>(A.index_.size()));
    }
  }
  lp.num_col_ = static_cast<HighsInt>(columnas.size());
  A.num_col_ = lp.num_col_;
  A.num_row_ = lp.num_row_;
  lp.col_lower_.assign(columnas.size(), 0.0);
  lp.col_upper_.assign(columnas.size(), 1.0);
  lp.integrality_.assign(columnas.size(), HighsVarType::kInteger);

  Highs highs;
  highs.setOptionValue("output_flag", false);
  highs.setOptionValue("mip_rel_gap", 0.0);
  highs.setOptionValue("threads", 1);
  if (highs.passModel(std::move(lp)) != HighsStatus::kOk) {
    throw std::runtime_error("HiGHS rechazó el modelo");
  }
  highs.run();

  const HighsModelStatus estado = highs.getModelStatus();
  if (estado == HighsModelStatus::kInfeasible) return std::nullopt;
  if (estado != HighsModelStatus::kOptimal) {
    throw std::runtime_error("HiGHS terminó con estado " + highs.modelStatusToString(estado));
  }

  std::vector<int> n(S);
  const auto& z = highs.getSolution().col_value;
  for (std::size_t j = 0; j < columnas.size(); ++j) {
    if (z[j] > 0.5) n[columnas[j].first] = columnas[j].second;
  }
  return armar(inst, n);
}

std::optional<Solucion> resolver(const Instancia& inst, double presupuesto) {
  auto libre = resolver_dp(inst, Criterio::Total);
  if (!libre) return std::nullopt;
  if (libre->costo_compra <= presupuesto + kTol) return libre;

  auto minima = resolver_dp(inst, Criterio::Compra);
  if (minima->costo_compra > presupuesto + kTol) return std::nullopt;
  return resolver_highs(inst, presupuesto + kTol);
}

}  // namespace refor
