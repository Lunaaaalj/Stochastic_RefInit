#pragma once

#include <filesystem>
#include <string>
#include <vector>

namespace refor {

struct Especie {
  std::string nombre;
  int n0;    // plantas/ha según el plan de reforestación
  double c;  // costo unitario de la planta, sin logística ($)
  double q;  // supervivencia al primer año
};

struct Poligono {
  int id;
  double area;         // ha
  std::vector<int> E;  // plantas existentes, indexadas como Datos::especies
};

struct Datos {
  std::vector<Especie> especies;
  std::vector<Poligono> poligonos;

  int densidad_total() const;  // Σ n0 (658 plantas/ha)
  const Poligono& poligono(int id) const;
};

// Lee especies.csv, poligonos.csv y existentes.csv del directorio dado
// (generados por scripts/exportar_datos.py). Lanza std::runtime_error si falta
// un archivo o los datos son inconsistentes.
Datos cargar_datos(const std::filesystem::path& dir);

}  // namespace refor
