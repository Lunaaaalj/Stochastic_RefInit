#pragma once

#include <cmath>
#include <stdexcept>
#include <vector>

namespace refor {

// Metas admisibles de una especie en un polígono: |n - n0·A| <= δ·n0·A.
struct Rango {
  int n_min;
  int n_max;
  int tamano() const { return n_max - n_min + 1; }
};

inline Rango banda(int n0, double area, double delta) {
  const double centro = n0 * area;
  // El épsilon evita que 0.9·42·5.0 = 188.99999… se redondee hacia afuera.
  Rango r{static_cast<int>(std::ceil(centro * (1 - delta) - 1e-9)),
          static_cast<int>(std::floor(centro * (1 + delta) + 1e-9))};
  if (r.n_min > r.n_max) throw std::invalid_argument("banda vacía: aumentar delta");
  return r;
}

// Para cada meta n del rango: compra mínima x*(n) que cumple
// P(E + S(x) >= n) >= 1 - α, y déficit esperado E[(n - E - S(x*))^+].
struct Curva {
  int n_min;
  std::vector<int> x;           // x*(n), índice n - n_min
  std::vector<double> deficit;  // E[D](n), índice n - n_min

  int n_max() const { return n_min + static_cast<int>(x.size()) - 1; }
  int compra(int n) const { return x.at(n - n_min); }
  double deficit_esperado(int n) const { return deficit.at(n - n_min); }
};

// Número de escenarios r = ⌈(1-α)K⌉ que deben cubrirse; el épsilon absorbe
// errores de redondeo en α·K (0.05·10000 = 500.00000000000006).
inline long rango_cuantil(double alpha, long K) {
  return K - static_cast<long>(std::floor(alpha * K + 1e-9));
}

}  // namespace refor
