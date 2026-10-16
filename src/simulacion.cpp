#include "simulacion.hpp"

#include <algorithm>
#include <limits>
#include <random>
#include <stdexcept>

namespace refor {

namespace {

std::uint64_t splitmix64(std::uint64_t z) {
  z += 0x9E3779B97F4A7C15ULL;
  z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ULL;
  z = (z ^ (z >> 27)) * 0x94D049BB133111EBULL;
  return z ^ (z >> 31);
}

}  // namespace

std::uint64_t semilla_derivada(std::uint64_t semilla, int poligono, int especie) {
  return splitmix64(splitmix64(semilla) ^ (static_cast<std::uint64_t>(poligono) << 16) ^
                    static_cast<std::uint64_t>(especie));
}

Escenarios::Escenarios(double q, int L_max, long K, std::uint64_t semilla)
    : K_(K), L_max_(std::max(L_max, 0)), x_(static_cast<std::size_t>(K) * L_max_) {
  if (q <= 0 || q >= 1) throw std::invalid_argument("q debe estar en (0, 1)");
  if (K <= 0) throw std::invalid_argument("K debe ser positivo");

  // mt19937_64 está especificado por el estándar, a diferencia de
  // uniform_real_distribution: comparar su salida con q·2^64 da los mismos
  // escenarios con libc++ y libstdc++.
  const auto umbral = static_cast<std::uint64_t>(std::ldexp(q, 64));
  std::mt19937_64 rng(semilla);
  constexpr int tope = std::numeric_limits<std::uint16_t>::max();

  // Cada escenario se simula completo (el orden de los números aleatorios no
  // depende del almacenamiento) en un bloque pequeño que luego se transpone.
  constexpr long bloque = 64;
  std::vector<std::uint16_t> filas(static_cast<std::size_t>(bloque) * L_max_);
  for (long k0 = 0; k0 < K_; k0 += bloque) {
    const long nb = std::min(bloque, K_ - k0);
    for (long j = 0; j < nb; ++j) {
      std::uint16_t* f = filas.data() + j * L_max_;
      int plantadas = 0;
      for (int L = 0; L < L_max_; ++L) {
        do {
          if (++plantadas > tope) throw std::overflow_error("meta demasiado grande para uint16");
        } while (rng() >= umbral);
        f[L] = static_cast<std::uint16_t>(plantadas);
      }
    }
    for (int L = 0; L < L_max_; ++L) {
      std::uint16_t* destino = x_.data() + L * K_ + k0;
      for (long j = 0; j < nb; ++j) destino[j] = filas[j * L_max_ + L];
    }
  }
}

int Escenarios::sobrevivientes(long k, int x) const {
  // Búsqueda binaria del mayor L con x_k(L) <= x (x_k es creciente en L).
  int lo = 0, hi = L_max_;
  while (lo < hi) {
    const int mid = (lo + hi + 1) / 2;
    if (plantas(k, mid) <= x) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

Curva Escenarios::curva(int E, Rango r, double alpha) const {
  return curvas(E, r, {alpha}).front();
}

std::vector<Curva> Escenarios::curvas(int E, Rango r, const std::vector<double>& alfas) const {
  if (r.n_max - E > L_max_) throw std::invalid_argument("L_max insuficiente para el rango");

  std::vector<Curva> res(alfas.size(),
                         Curva{r.n_min, std::vector<int>(r.tamano()), std::vector<double>(r.tamano())});
  std::vector<std::uint16_t> req(K_);
  for (int n = r.n_min; n <= r.n_max; ++n) {
    const int falta = n - E;
    const auto i = static_cast<std::size_t>(n - r.n_min);
    if (falta <= 0) continue;  // las existentes ya cubren la meta: x* = 0, D = 0

    const std::uint16_t* v = nivel(falta);
    std::copy(v, v + K_, req.begin());
    for (std::size_t a = 0; a < alfas.size(); ++a) {
      // x*(n): el r-ésimo menor de los x_k(n - E). Con esa compra, al menos r
      // escenarios alcanzan la meta, y con una planta menos no.
      const long cubrir = rango_cuantil(alfas[a], K_);
      std::nth_element(req.begin(), req.begin() + (cubrir - 1), req.end());
      const int x = req[cubrir - 1];

      // Solo los escenarios que no alcanzan la meta tienen déficit; se baja
      // desde L = falta hasta el último nivel alcanzado con x plantas.
      long suma = 0;
      for (long k = 0; k < K_; ++k) {
        if (v[k] <= x) continue;
        int L = falta - 1;
        while (L > 0 && plantas(k, L) > x) --L;
        suma += falta - L;
      }
      res[a].x[i] = x;
      res[a].deficit[i] = static_cast<double>(suma) / static_cast<double>(K_);
    }
  }
  return res;
}

}  // namespace refor
