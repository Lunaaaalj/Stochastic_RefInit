#pragma once

#include <atomic>
#include <cstdint>
#include <functional>
#include <optional>
#include <random>
#include <vector>

#include "memetico/competencia.hpp"
#include "memetico/individuo.hpp"
#include "memetico/mosaico.hpp"
#include "memetico/tabu.hpp"

namespace refor::memetico {

struct ParametrosMemetico {
  int poblacion = 20;
  int generaciones_max = 1000;
  int generaciones_sin_mejora_max = 100;
  ParametrosTabu tabu;
  std::uint64_t semilla = 0;
  // Se llama al final de cada generación con la mejor competencia hasta ahí.
  std::function<void(int generacion, double mejor)> al_generar;
  // Si apunta a true, el run para en la siguiente generación (y la búsqueda
  // tabú en curso, en su siguiente iteración) y devuelve lo mejor que tenga.
  const std::atomic<bool>* cancelar = nullptr;
};

struct ResultadoMemetico {
  Individuo mejor;
  double competencia;
  int generaciones;
  // historia[g]: mejor competencia al terminar la generación g; historia[0]
  // es la de la población inicial, así que tiene generaciones + 1 valores.
  std::vector<double> historia;
  bool cancelado = false;
};

// Un individuo aleatorio con la composición m_s dada (m_s[s] posiciones de
// la especie s). Σ m_s debe ser igual a n.
Individuo individuo_aleatorio(const std::vector<int>& m_s, int n, std::mt19937_64& rng);

// Traslada un individuo (dq, dr) en el mosaico, con borde periódico.
Individuo trasladar(const Individuo& ind, const Mosaico& m, int dq, int dr);

// Número mínimo de posiciones distintas entre dos individuos, minimizando
// sobre todas las traslaciones del mosaico (0 si son el mismo esquema
// desplazado, lo que el reemplazo considera una copia).
int distancia_traslacion(const Individuo& a, const Individuo& b, const Mosaico& m);

// La traslación de b que más coincide con a (menor distancia); sirve para
// comparar dos esquemas en el mismo marco.
Individuo alinear(const Individuo& a, const Individuo& b, const Mosaico& m);

// Cruce GPX adaptado a especies no intercambiables: alinea padre2 a la
// traslación de máxima coincidencia con padre1, hereda especies alternando
// entre padres (en cada turno, la especie pendiente con más posiciones
// libres en el padre en turno) hasta completar su cantidad, y resuelve lo
// que ningún padre pudo heredar de forma voraz, posición por posición, con
// la especie que menos incrementa la competencia con lo ya asignado.
Individuo cruzar(const Individuo& padre1, const Individuo& padre2, const std::vector<int>& m_s,
                  const Mosaico& m, const Competencia& w, std::mt19937_64& rng);

// Un run independiente del algoritmo memético (población, selección por
// torneo, cruce, búsqueda tabú sobre cada hijo, reemplazo del peor si
// mejora y no es copia de otro, paro por generaciones o estancamiento).
// linea_base, si se da, entra a la población inicial para no empeorar el
// esquema vigente.
ResultadoMemetico ejecutar_memetico(const std::vector<int>& m_s, const Mosaico& m, const Competencia& w,
                           const ParametrosMemetico& p, std::optional<Individuo> linea_base = std::nullopt);

}  // namespace refor::memetico
