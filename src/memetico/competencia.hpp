#pragma once

#include <filesystem>
#include <vector>

#include "datos.hpp"

namespace refor::memetico {

// Matriz de competencia W, simétrica, indexada igual que Datos::especies
// (W[a][a] es la competencia intraespecífica).
class Competencia {
 public:
  // Lee un csv de columnas especie_a,especie_b,W; cada par solo necesita
  // aparecer una vez, en cualquier orden (así está data/processed/competencia.csv).
  Competencia(const Datos& datos, const std::filesystem::path& csv);

  double operator()(int a, int b) const { return w_.at(a).at(b); }
  std::size_t num_especies() const { return w_.size(); }

 private:
  std::vector<std::vector<double>> w_;
};

}  // namespace refor::memetico