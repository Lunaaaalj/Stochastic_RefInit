#include "memetico/individuo.hpp"

namespace refor::memetico {

double competencia_total(const Individuo& ind, const Mosaico& m, const Competencia& w) {
  double total = 0.0;
  for (const auto& [u, v] : m.aristas()) total += w(ind.at(u), ind.at(v));
  return total;
}

double competencia_esperada_aleatoria(const std::vector<int>& m_s, const Mosaico& m, const Competencia& w) {
  // Bajo muestreo sin reemplazo de dos posiciones al azar, la probabilidad de
  // que salgan las especies (a, b) es proporcional al número de pares
  // ordenados posición-posición que les corresponde; promediar W con ese peso
  // y multiplicar por el número de aristas da la competencia esperada.
  const double n = static_cast<double>(m.num_posiciones());
  double suma_pares = 0.0;
  const std::size_t S = m_s.size();
  for (std::size_t a = 0; a < S; ++a) {
    for (std::size_t b = 0; b < S; ++b) {
      const double pares = (a == b) ? static_cast<double>(m_s[a]) * (m_s[a] - 1)
                                     : static_cast<double>(m_s[a]) * static_cast<double>(m_s[b]);
      suma_pares += pares * w(static_cast<int>(a), static_cast<int>(b));
    }
  }
  const double w_medio = suma_pares / (n * (n - 1));
  return w_medio * static_cast<double>(m.aristas().size());
}

}  // namespace refor::memetico