#pragma once

#include <cstdint>
#include <optional>
#include <vector>

#include "datos.hpp"
#include "mochila.hpp"

namespace refor {

enum class Metodo { MonteCarlo, Exacto };

struct Parametros {
  double theta = 0.05;  // sobrecosto logístico
  double delta = 0.10;  // desviación máxima por especie respecto al plan
  long K = 10'000;      // escenarios Monte Carlo
  std::uint64_t semilla = 42;
  Metodo metodo = Metodo::MonteCarlo;
  unsigned hilos = 0;  // 0: automático
};

// Curvas de todas las especies de un polígono, para cada α pedido.
struct CurvasPoligono {
  const Poligono* poligono;
  int total;                                // round(658·A)
  std::vector<std::vector<Curva>> por_alfa;  // [α][especie]
};

// Calcula en paralelo (por polígono) las curvas x*(n), E[D](n). Cada par
// (polígono, especie) genera sus escenarios una sola vez y los reutiliza para
// todos los α.
std::vector<CurvasPoligono> calcular_curvas(const Datos& datos, const std::vector<int>& ids,
                                            const std::vector<double>& alfas, const Parametros& p);

Instancia instancia(const Datos& datos, const CurvasPoligono& cp, std::size_t ialfa, double theta);

// Resultado de un polígono para un (α, B).
struct Resultado {
  const Poligono* poligono;
  double alfa;
  double B;                         // presupuesto por hectárea
  std::optional<Solucion> optima;   // con presupuesto; vacío si es infactible
  std::optional<Solucion> libre;    // óptimo sin presupuesto
  std::optional<double> B_minimo;   // presupuesto mínimo factible, $/ha
};

Resultado resolver_poligono(const Datos& datos, const CurvasPoligono& cp, std::size_t ialfa,
                            double alfa, double B, double theta);

// Presupuesto mínimo factible y costo del óptimo libre de un polígono para un α.
struct Frontera {
  const Poligono* poligono;
  double alfa;
  std::optional<double> B_minimo;     // $/ha
  std::optional<double> costo_libre;  // costo total del óptimo libre, $/ha
};

Frontera frontera_poligono(const Datos& datos, const CurvasPoligono& cp, std::size_t ialfa,
                           double alfa, double theta);

}  // namespace refor
