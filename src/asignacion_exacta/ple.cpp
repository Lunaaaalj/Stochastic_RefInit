#include "asignacion_exacta/ple.hpp"

#include <Highs.h>

#include <algorithm>
#include <limits>
#include <numeric>
#include <stdexcept>
#include <utility>

namespace refor::asignacion_exacta {

ResultadoPLE resolver_ple(const std::vector<int>& m_s, const memetico::Mosaico& m,
                          const memetico::Competencia& w, const ParametrosPLE& p) {
  const int n = m.num_posiciones();
  const int S = static_cast<int>(m_s.size());
  const auto& aristas = m.aristas();
  const int nE = static_cast<int>(aristas.size());

  if (std::accumulate(m_s.begin(), m_s.end(), 0) != n)
    throw std::invalid_argument("la suma de m_s debe ser igual al número de posiciones del mosaico");
  if (w.num_especies() != static_cast<std::size_t>(S))
    throw std::invalid_argument("m_s y la matriz de competencia tienen distinto número de especies");

  // Índices de columnas: primero las y (posición, especie), luego las z (arista, a, b).
  auto y = [S](int v, int s) { return v * S + s; };
  auto z = [n, S](int e, int a, int b) { return n * S + (e * S + a) * S + b; };
  const int num_col = n * S + nE * S * S;

  HighsModel model;
  HighsLp& lp = model.lp_;
  lp.sense_ = ObjSense::kMinimize;
  lp.num_col_ = num_col;
  lp.col_cost_.assign(num_col, 0.0);
  lp.col_lower_.assign(num_col, 0.0);
  lp.col_upper_.assign(num_col, kHighsInf);
  lp.integrality_.assign(num_col, HighsVarType::kContinuous);

  for (int v = 0; v < n; ++v) {
    for (int s = 0; s < S; ++s) {
      lp.col_upper_[y(v, s)] = 1.0;
      lp.integrality_[y(v, s)] = HighsVarType::kInteger;
    }
  }
  for (int e = 0; e < nE; ++e)
    for (int a = 0; a < S; ++a)
      for (int b = 0; b < S; ++b) lp.col_cost_[z(e, a, b)] = w(a, b);  // w_uv = 1

  const int s_fija = static_cast<int>(std::max_element(m_s.begin(), m_s.end()) - m_s.begin());
  lp.col_lower_[y(0, s_fija)] = 1.0;

  // Restricciones, por filas.
  lp.a_matrix_.format_ = MatrixFormat::kRowwise;
  lp.a_matrix_.start_.assign(1, 0);
    
  auto fila = [&lp](double lo, double hi, const std::vector<std::pair<int, double>>& coef) {
    for (const auto& [col, val] : coef) {
      lp.a_matrix_.index_.push_back(col);
      lp.a_matrix_.value_.push_back(val);
    }
    lp.a_matrix_.start_.push_back(static_cast<HighsInt>(lp.a_matrix_.index_.size()));
    lp.row_lower_.push_back(lo);
    lp.row_upper_.push_back(hi);
  };

  for (int v = 0; v < n; ++v) {  // (7)
    std::vector<std::pair<int, double>> c;
    for (int s = 0; s < S; ++s) c.emplace_back(y(v, s), 1.0);
    fila(1.0, 1.0, c);
  }
  for (int s = 0; s < S; ++s) {  // (8)
    std::vector<std::pair<int, double>> c;
    for (int v = 0; v < n; ++v) c.emplace_back(y(v, s), 1.0);
    fila(m_s[s], m_s[s], c);
  }
  for (int e = 0; e < nE; ++e) {
    const auto [u, v] = aristas[e];
    for (int a = 0; a < S; ++a) {  // (9)
      std::vector<std::pair<int, double>> c;
      for (int b = 0; b < S; ++b) c.emplace_back(z(e, a, b), 1.0);
      c.emplace_back(y(u, a), -1.0);
      fila(0.0, 0.0, c);
    }
    for (int b = 0; b < S; ++b) {  // (10)
      std::vector<std::pair<int, double>> c;
      for (int a = 0; a < S; ++a) c.emplace_back(z(e, a, b), 1.0);
      c.emplace_back(y(v, b), -1.0);
      fila(0.0, 0.0, c);
    }
  }
  lp.num_row_ = static_cast<HighsInt>(lp.row_lower_.size());

  Highs highs;
  highs.setOptionValue("output_flag", p.verbose);
  highs.setOptionValue("time_limit", p.limite_segundos);
  highs.setOptionValue("mip_rel_gap", p.brecha_relativa);
  if (highs.passModel(model) == HighsStatus::kError) throw std::runtime_error("HiGHS rechazó el modelo");
  highs.run();

  ResultadoPLE res;
  const HighsModelStatus estado = highs.getModelStatus();
  res.estado = highs.modelStatusToString(estado);
  res.optimo = (estado == HighsModelStatus::kOptimal);
  res.segundos = highs.getRunTime();

  const HighsInfo& info = highs.getInfo();
  res.cota_inferior = info.mip_dual_bound;
  res.competencia = std::numeric_limits<double>::infinity();
  res.brecha = std::numeric_limits<double>::infinity();

  if (info.primal_solution_status == kSolutionStatusFeasible) {
    const auto& x = highs.getSolution().col_value;
    res.asignacion.assign(n, -1);
    for (int v = 0; v < n; ++v) {
      int mejor = 0;
      for (int s = 1; s < S; ++s)
        if (x[y(v, s)] > x[y(v, mejor)]) mejor = s;
      res.asignacion[v] = mejor;
    }
    // Se recalcula con la misma función que usa el memético.
    res.competencia = memetico::competencia_total(res.asignacion, m, w);
    res.brecha = res.competencia > 0 ? (res.competencia - res.cota_inferior) / res.competencia : 0.0;
    if (res.brecha < 0) res.brecha = 0;
  }
  return res;
}

}  // namespace refor::asignacion_exacta
