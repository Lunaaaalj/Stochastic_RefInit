#include "datos.hpp"

#include <algorithm>
#include <fstream>
#include <map>
#include <numeric>
#include <sstream>
#include <stdexcept>

namespace refor {

namespace {

using Fila = std::vector<std::string>;

// CSV simple: sin comillas ni comas dentro de los campos. Omite el encabezado.
std::vector<Fila> leer_csv(const std::filesystem::path& ruta, std::size_t columnas) {
  std::ifstream in(ruta);
  if (!in) throw std::runtime_error("no se pudo abrir " + ruta.string());

  std::vector<Fila> filas;
  std::string linea;
  std::getline(in, linea);  // encabezado
  while (std::getline(in, linea)) {
    if (!linea.empty() && linea.back() == '\r') linea.pop_back();
    if (linea.empty()) continue;
    Fila fila;
    std::stringstream ss(linea);
    for (std::string campo; std::getline(ss, campo, ',');) fila.push_back(campo);
    if (fila.size() != columnas) {
      throw std::runtime_error(ruta.filename().string() + ": fila con " +
                               std::to_string(fila.size()) + " columnas: " + linea);
    }
    filas.push_back(std::move(fila));
  }
  return filas;
}

}  // namespace

int Datos::densidad_total() const {
  return std::accumulate(especies.begin(), especies.end(), 0,
                         [](int s, const Especie& e) { return s + e.n0; });
}

const Poligono& Datos::poligono(int id) const {
  auto it = std::find_if(poligonos.begin(), poligonos.end(),
                         [id](const Poligono& p) { return p.id == id; });
  if (it == poligonos.end()) throw std::out_of_range("polígono inexistente: " + std::to_string(id));
  return *it;
}

Datos cargar_datos(const std::filesystem::path& dir) {
  Datos d;

  std::map<std::string, std::size_t> indice;
  for (const auto& f : leer_csv(dir / "especies.csv", 4)) {
    Especie e{f[0], std::stoi(f[1]), std::stod(f[2]), std::stod(f[3])};
    if (e.n0 <= 0 || e.c <= 0 || e.q <= 0 || e.q >= 1) {
      throw std::runtime_error("parámetros inválidos para " + e.nombre);
    }
    indice[e.nombre] = d.especies.size();
    d.especies.push_back(std::move(e));
  }

  std::map<int, std::size_t> pos_poligono;
  for (const auto& f : leer_csv(dir / "poligonos.csv", 2)) {
    Poligono p{std::stoi(f[0]), std::stod(f[1]), std::vector<int>(d.especies.size(), -1)};
    if (p.area <= 0) throw std::runtime_error("área no positiva en el polígono " + f[0]);
    if (!pos_poligono.emplace(p.id, d.poligonos.size()).second) {
      throw std::runtime_error("polígono repetido: " + f[0]);
    }
    d.poligonos.push_back(std::move(p));
  }

  for (const auto& f : leer_csv(dir / "existentes.csv", 3)) {
    auto s = indice.find(f[1]);
    if (s == indice.end()) throw std::runtime_error("especie desconocida en existentes.csv: " + f[1]);
    auto i = pos_poligono.find(std::stoi(f[0]));
    if (i == pos_poligono.end()) throw std::runtime_error("polígono desconocido en existentes.csv: " + f[0]);
    d.poligonos[i->second].E[s->second] = std::stoi(f[2]);
  }

  for (const auto& p : d.poligonos) {
    for (std::size_t s = 0; s < p.E.size(); ++s) {
      if (p.E[s] < 0) {
        throw std::runtime_error("falta el conteo de " + d.especies[s].nombre + " en el polígono " +
                                 std::to_string(p.id));
      }
    }
  }
  return d;
}

}  // namespace refor
