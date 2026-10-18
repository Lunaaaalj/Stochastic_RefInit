#include "memetico/tabu.hpp"

#include <limits>
#include <utility>
#include <vector>

namespace refor::memetico {

namespace {

// Cambio en la competencia total si se intercambiaran ind[u] e ind[v], sin
// hacerlo. Solo evalúa las aristas que tocan u o v, como pide el reporte.
double delta_intercambio(const Individuo& ind, const Mosaico& m, const Competencia& w, int u, int v) {
  const int a = ind[u], b = ind[v];
  double delta = 0.0;
  for (int x : m.vecinas(u))
    if (x != v) delta += w(b, ind[x]) - w(a, ind[x]);
  for (int x : m.vecinas(v))
    if (x != u) delta += w(a, ind[x]) - w(b, ind[x]);
  return delta;
}

}  // namespace

double busqueda_tabu(Individuo& ind, const Mosaico& m, const Competencia& w, const ParametrosTabu& p,
                     std::mt19937_64& rng) {
  const int n = m.num_posiciones();
  double actual = competencia_total(ind, m, w);
  double mejor_valor = actual;
  Individuo mejor = ind;

  // tabu_hasta[u][v] (u < v): iteración hasta la que ese intercambio está
  // prohibido; 0 si nunca se ha hecho.
  std::vector<std::vector<int>> tabu_hasta(n, std::vector<int>(n, 0));
  std::uniform_int_distribution<int> tenure(p.tenure_min, p.tenure_max);

  int sin_mejora = 0;
  for (int it = 1; sin_mejora < p.iteraciones_sin_mejora; ++it) {
    int mejor_u = -1, mejor_v = -1;
    double mejor_delta = std::numeric_limits<double>::infinity();

    for (int u = 0; u < n; ++u) {
      for (int v = u + 1; v < n; ++v) {
        if (ind[u] == ind[v]) continue;  // intercambio sin efecto
        const double delta = delta_intercambio(ind, m, w, u, v);
        const bool prohibido = tabu_hasta[u][v] >= it;
        const bool aspiracion = actual + delta < mejor_valor - 1e-9;
        if (prohibido && !aspiracion) continue;
        if (delta < mejor_delta) {
          mejor_delta = delta;
          mejor_u = u;
          mejor_v = v;
        }
      }
    }
    if (mejor_u < 0) break;  // todo prohibido, no hay a dónde moverse

    std::swap(ind[mejor_u], ind[mejor_v]);
    actual += mejor_delta;
    tabu_hasta[mejor_u][mejor_v] = it + tenure(rng);

    if (actual < mejor_valor - 1e-9) {
      mejor_valor = actual;
      mejor = ind;
      sin_mejora = 0;
    } else {
      ++sin_mejora;
    }
  }

  ind = mejor;
  return mejor_valor;
}

}  // namespace refor::memetico