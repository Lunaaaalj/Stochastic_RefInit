#include "memetico/competencia.hpp"

#include <fstream>
#include <map>
#include <sstream>
#include <stdexcept>
#include <string>

namespace refor::memetico {

namespace {

std::map<std::string, int> indice_de(const Datos& datos) {
  std::map<std::string, int> idx;
  for (std::size_t s = 0; s < datos.especies.size(); ++s) idx[datos.especies[s].nombre] = static_cast<int>(s);
  return idx;
}

}  // namespace

Competencia::Competencia(const Datos& datos, const std::filesystem::path& csv) {
  const auto idx = indice_de(datos);
  const std::size_t S = datos.especies.size();
  w_.assign(S, std::vector<double>(S, 0.0));

  std::ifstream in(csv);
  if (!in) throw std::runtime_error("no se pudo abrir " + csv.string());

  std::string linea;
  std::getline(in, linea);  // descarta el encabezado especie_a,especie_b,W
  bool alguna = false;
  while (std::getline(in, linea)) {
    if (linea.empty()) continue;
    std::stringstream ss(linea);
    std::string a, b, w_str;
    std::getline(ss, a, ',');
    std::getline(ss, b, ',');
    std::getline(ss, w_str, ',');
    if (!idx.count(a) || !idx.count(b))
      throw std::runtime_error("especie desconocida en " + csv.string() + ": '" + a + "' / '" + b + "'");
    const int ia = idx.at(a), ib = idx.at(b);
    const double w = std::stod(w_str);
    w_[ia][ib] = w;
    w_[ib][ia] = w;
    alguna = true;
  }
  if (!alguna) throw std::runtime_error("sin filas en " + csv.string());
}

}  // namespace refor::memetico