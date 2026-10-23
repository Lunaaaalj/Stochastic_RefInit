#include "memetico/memetico.hpp"

#include <algorithm>
#include <limits>

#include "azar.hpp"

namespace refor::memetico {

Individuo individuo_aleatorio(const std::vector<int>& m_s, int n, std::mt19937_64& rng) {
  Individuo ind;
  ind.reserve(n);
  for (std::size_t s = 0; s < m_s.size(); ++s) ind.insert(ind.end(), m_s[s], static_cast<int>(s));
  barajar(ind.begin(), ind.end(), rng);
  return ind;
}

Individuo trasladar(const Individuo& ind, const Mosaico& m, int dq, int dr) {
  Individuo res(ind.size());
  for (int f = 0; f < m.filas(); ++f)
    for (int c = 0; c < m.columnas(); ++c) res[m.indice(f + dq, c + dr)] = ind[m.indice(f, c)];
  return res;
}

namespace {

int distancia(const Individuo& a, const Individuo& bt) {
  int dist = 0;
  for (std::size_t v = 0; v < a.size(); ++v) dist += (a[v] != bt[v]);
  return dist;
}

}  // namespace

Individuo alinear(const Individuo& a, const Individuo& b, const Mosaico& m) {
  Individuo mejor_b = b;
  int mejor_dist = static_cast<int>(a.size()) + 1;
  for (int dq = 0; dq < m.filas(); ++dq) {
    for (int dr = 0; dr < m.columnas(); ++dr) {
      const Individuo bt = trasladar(b, m, dq, dr);
      const int dist = distancia(a, bt);
      if (dist < mejor_dist) {
        mejor_dist = dist;
        mejor_b = bt;
      }
    }
  }
  return mejor_b;
}

int distancia_traslacion(const Individuo& a, const Individuo& b, const Mosaico& m) {
  int mejor = static_cast<int>(a.size());
  for (int dq = 0; dq < m.filas(); ++dq)
    for (int dr = 0; dr < m.columnas(); ++dr) mejor = std::min(mejor, distancia(a, trasladar(b, m, dq, dr)));
  return mejor;
}

Individuo cruzar(const Individuo& padre1, const Individuo& padre2, const std::vector<int>& m_s,
                  const Mosaico& m, const Competencia& w, std::mt19937_64& rng) {
  (void)rng;  // el cruce en sí es determinista; el azar entra antes (selección) y después (tabú)
  const int n = static_cast<int>(padre1.size());
  const Individuo padre2_alineado = alinear(padre1, padre2, m);
  const Individuo* padres[2] = {&padre1, &padre2_alineado};

  Individuo hijo(n, -1);
  std::vector<int> restante = m_s;
  std::vector<char> pendiente(m_s.size());
  for (std::size_t s = 0; s < m_s.size(); ++s) pendiente[s] = restante[s] > 0;

  // Alterna entre padres heredando, en cada turno, la especie pendiente con
  // más posiciones libres en el padre de ese turno.
  int turno = 0, turnos_sin_progreso = 0;
  while (turnos_sin_progreso < 2) {
    const Individuo& parent = *padres[turno % 2];
    ++turno;

    std::vector<int> libres(m_s.size(), 0);
    for (int v = 0; v < n; ++v)
      if (hijo[v] == -1 && pendiente[parent[v]]) ++libres[parent[v]];

    int s_elegida = -1, max_libres = 0;
    for (std::size_t s = 0; s < m_s.size(); ++s) {
      if (pendiente[s] && libres[s] > max_libres) {
        max_libres = libres[s];
        s_elegida = static_cast<int>(s);
      }
    }
    if (s_elegida < 0) {
      ++turnos_sin_progreso;
      continue;
    }
    turnos_sin_progreso = 0;

    int asignadas = 0;
    for (int v = 0; v < n && asignadas < restante[s_elegida]; ++v) {
      if (hijo[v] == -1 && parent[v] == s_elegida) {
        hijo[v] = s_elegida;
        ++asignadas;
      }
    }
    restante[s_elegida] -= asignadas;
    if (restante[s_elegida] == 0) pendiente[s_elegida] = false;
  }

  // Lo que ningún padre pudo heredar se completa de forma voraz: en cada
  // paso, la pareja (posición libre, especie pendiente) que menos
  // incrementa la competencia con lo ya asignado a su alrededor.
  for (;;) {
    int mejor_v = -1, mejor_s = -1;
    double mejor_costo = std::numeric_limits<double>::infinity();
    for (int v = 0; v < n; ++v) {
      if (hijo[v] != -1) continue;
      for (std::size_t s = 0; s < m_s.size(); ++s) {
        if (restante[s] <= 0) continue;
        double costo = 0.0;
        for (int x : m.vecinas(v))
          if (hijo[x] != -1) costo += w(static_cast<int>(s), hijo[x]);
        if (costo < mejor_costo) {
          mejor_costo = costo;
          mejor_v = v;
          mejor_s = static_cast<int>(s);
        }
      }
    }
    if (mejor_v < 0) break;
    hijo[mejor_v] = mejor_s;
    --restante[mejor_s];
  }

  return hijo;
}

ResultadoMemetico ejecutar_memetico(const std::vector<int>& m_s, const Mosaico& m, const Competencia& w,
                           const ParametrosMemetico& p, std::optional<Individuo> linea_base) {
  std::mt19937_64 rng(p.semilla);
  auto torneo = [&] { return static_cast<int>(entero_uniforme(rng, 0, p.poblacion - 1)); };
  ParametrosTabu pt = p.tabu;
  if (p.cancelar) pt.cancelar = p.cancelar;
  auto cancelado = [&] { return p.cancelar && p.cancelar->load(std::memory_order_relaxed); };

  std::vector<Individuo> pob;
  std::vector<double> aptitud;
  pob.reserve(p.poblacion);
  aptitud.reserve(p.poblacion);

  if (linea_base) {
    Individuo base = *linea_base;
    aptitud.push_back(busqueda_tabu(base, m, w, pt, rng));
    pob.push_back(std::move(base));
  }
  while (static_cast<int>(pob.size()) < p.poblacion) {
    Individuo ind = individuo_aleatorio(m_s, m.num_posiciones(), rng);
    aptitud.push_back(busqueda_tabu(ind, m, w, pt, rng));
    pob.push_back(std::move(ind));
  }

  int mejor_idx = static_cast<int>(std::min_element(aptitud.begin(), aptitud.end()) - aptitud.begin());
  Individuo mejor_global = pob[mejor_idx];
  double mejor_valor = aptitud[mejor_idx];

  std::vector<double> historia{mejor_valor};
  int gen = 0, sin_mejora = 0;
  for (; gen < p.generaciones_max && sin_mejora < p.generaciones_sin_mejora_max && !cancelado(); ++gen) {
    auto elegir_padre = [&] {
      const int i = torneo(), j = torneo();
      return aptitud[i] <= aptitud[j] ? i : j;
    };
    const int i1 = elegir_padre(), i2 = elegir_padre();

    Individuo hijo = cruzar(pob[i1], pob[i2], m_s, m, w, rng);
    const double apt_hijo = busqueda_tabu(hijo, m, w, pt, rng);

    const int idx_peor = static_cast<int>(std::max_element(aptitud.begin(), aptitud.end()) - aptitud.begin());
    const bool mejora = apt_hijo < aptitud[idx_peor];
    bool es_copia = false;
    if (mejora) {
      for (const auto& otro : pob) {
        if (distancia_traslacion(hijo, otro, m) == 0) {
          es_copia = true;
          break;
        }
      }
    }
    if (mejora && !es_copia) {
      pob[idx_peor] = hijo;
      aptitud[idx_peor] = apt_hijo;
    }

    if (apt_hijo < mejor_valor - 1e-9) {
      mejor_valor = apt_hijo;
      mejor_global = hijo;
      sin_mejora = 0;
    } else {
      ++sin_mejora;
    }
    historia.push_back(mejor_valor);
    if (p.al_generar) p.al_generar(gen + 1, mejor_valor);
  }

  return {mejor_global, mejor_valor, gen, std::move(historia), cancelado()};
}

}  // namespace refor::memetico
