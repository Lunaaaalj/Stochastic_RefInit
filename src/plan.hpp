#pragma once

#include <atomic>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <vector>

#include "memetico/competencia.hpp"
#include "memetico/memetico.hpp"
#include "memetico/mosaico.hpp"
#include "modelo.hpp"

namespace refor {

// Orquestación de los dos niveles del reporte E2: la compra de cada polígono
// (modelo.hpp) fija la composición de su mosaico y el memético la distribuye.

struct ParametrosEspacial {
  int filas = 4, columnas = 13;  // 52 posiciones al tresbolillo, como en el reporte
  int corridas = 30;             // corridas independientes por composición
  memetico::ParametrosMemetico memetico;
  std::uint64_t semilla = 42;
  unsigned hilos = 0;  // 0: automático
  // Se llama desde los hilos de trabajo cada vez que termina una corrida; debe
  // ser seguro llamarla en paralelo.
  std::function<void(std::size_t hechas, std::size_t total)> avance;
  // Si apunta a true, las corridas pendientes y la que esté en curso paran
  // pronto y devuelven lo mejor que tengan (Espacial::cancelado).
  const std::atomic<bool>* cancelar = nullptr;
};

// Composición del mosaico de n posiciones proporcional a las plantas x[s] que
// se plantan, redondeada por el método del mayor residuo (Σ = n exactamente).
// Vacía si no se planta nada.
std::vector<int> composicion_mosaico(const std::vector<int>& x, int n);

// Resultado espacial de una composición. Varios polígonos suelen compartir la
// misma composición al redondear a pocas decenas de posiciones, y entonces
// comparten mosaico.
struct Espacial {
  std::vector<int> m_s;
  std::vector<int> poligonos;  // ids que usan este mosaico
  memetico::Individuo mejor;   // la mejor de todas las corridas
  double mejor_competencia = 0, media = 0, desviacion = 0;
  double esperada = 0;  // competencia esperada de una asignación aleatoria
  double generaciones_media = 0;
  std::vector<double> competencias;           // la final de cada corrida
  std::vector<std::vector<double>> historias;  // convergencia de cada corrida
  bool cancelado = false;
  double coeficiente() const { return mejor_competencia / esperada; }
  double coeficiente_medio() const { return media / esperada; }
};

// Agrupa los polígonos por composición y corre p.corridas veces el memético
// para cada grupo, en paralelo. Cada corrida usa una semilla derivada del
// grupo y de su número, así que el resultado no depende de los hilos.
std::vector<Espacial> resolver_espacial(const std::vector<Resultado>& compras, const memetico::Mosaico& m,
                                        const memetico::Competencia& w, const ParametrosEspacial& p);

// Los dos niveles para un (α, B): la compra de cada polígono a partir de sus
// curvas y su distribución espacial. Los Resultado apuntan a los polígonos de
// datos, que debe seguir vivo mientras se usen.
struct PlanCompleto {
  std::vector<Resultado> compras;
  std::vector<Espacial> espacial;
};

PlanCompleto ejecutar_plan(const Datos& datos, const std::vector<CurvasPoligono>& curvas, double alfa, double B,
                           double theta, const memetico::Mosaico& m, const memetico::Competencia& w,
                           const ParametrosEspacial& p);

}  // namespace refor
