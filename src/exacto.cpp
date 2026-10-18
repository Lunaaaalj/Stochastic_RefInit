#include "exacto.hpp"

#include <algorithm>
#include <cmath>

namespace refor {

Cola cola_binomial(int x, double q, int m) {
  if (m <= 0) return {1.0, 0.0};
  if (x < m) {
    // No hay suficientes plantas; el déficit es m - E[S] = m - x·q.
    return {0.0, m - x * q};
  }
  const double lq = std::log(q), lp = std::log1p(-q), lgx = std::lgamma(x + 1.0);
  double cdf = 0, deficit = 0;
  for (int j = 0; j < m; ++j) {
    const double pmf = std::exp(lgx - std::lgamma(j + 1.0) - std::lgamma(x - j + 1.0) + j * lq +
                                (x - j) * lp);
    cdf += pmf;
    deficit += (m - j) * pmf;
  }
  return {std::max(0.0, 1.0 - cdf), deficit};
}

Curva curva_exacta(int E, double q, Rango r, double alpha) {
  Curva c{r.n_min, std::vector<int>(r.tamano()), std::vector<double>(r.tamano())};
  int x = 0;
  for (int n = r.n_min; n <= r.n_max; ++n) {
    const int m = n - E;
    const auto i = static_cast<std::size_t>(n - r.n_min);
    if (m <= 0) continue;
    // x*(n) es no decreciente en n: se continúa desde el x anterior.
    x = std::max(x, m);
    Cola cola = cola_binomial(x, q, m);
    while (cola.prob_cubrir < 1 - alpha) cola = cola_binomial(++x, q, m);
    c.x[i] = x;
    c.deficit[i] = cola.deficit;
  }
  return c;
}

}  // namespace refor
