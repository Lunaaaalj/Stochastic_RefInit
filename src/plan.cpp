#include "plan.hpp"

#include <algorithm>
#include <atomic>
#include <cmath>
#include <exception>
#include <map>
#include <mutex>
#include <numeric>
#include <thread>

#include "simulacion.hpp"

namespace refor {

std::vector<int> composicion_mosaico(const std::vector<int>& x, int n) {
  const long total = std::accumulate(x.begin(), x.end(), 0L);
  if (total <= 0) return {};

  std::vector<int> m_s(x.size());
  std::vector<std::pair<double, std::size_t>> residuo;  // (residuo, especie)
  int asignadas = 0;
  for (std::size_t s = 0; s < x.size(); ++s) {
    const double cuota = static_cast<double>(n) * x[s] / static_cast<double>(total);
    m_s[s] = static_cast<int>(std::floor(cuota));
    asignadas += m_s[s];
    residuo.emplace_back(cuota - m_s[s], s);
  }
  // Mayor residuo primero; a igual residuo, la especie de menor índice.
  std::stable_sort(residuo.begin(), residuo.end(),
                   [](const auto& a, const auto& b) { return a.first > b.first; });
  for (int k = 0; asignadas < n; ++k, ++asignadas) ++m_s[residuo[k].second];
  return m_s;
}

std::vector<Espacial> resolver_espacial(const std::vector<Resultado>& compras, const memetico::Mosaico& m,
                                        const memetico::Competencia& w, const ParametrosEspacial& p) {
  // Agrupa por composición, en el orden en que aparecen los polígonos.
  std::vector<Espacial> grupos;
  std::map<std::vector<int>, std::size_t> indice;
  for (const auto& r : compras) {
    const Solucion* sol = r.optima ? &*r.optima : (r.libre ? &*r.libre : nullptr);
    if (!sol) continue;
    auto m_s = composicion_mosaico(sol->x, m.num_posiciones());
    if (m_s.empty()) continue;
    auto [it, nuevo] = indice.try_emplace(m_s, grupos.size());
    if (nuevo) grupos.push_back({std::move(m_s), {}, {}});
    grupos[it->second].poligonos.push_back(r.poligono->id);
  }

  // Una tarea por (grupo, corrida).
  const std::size_t R = static_cast<std::size_t>(p.corridas);
  const std::size_t tareas = grupos.size() * R;
  std::vector<memetico::ResultadoMemetico> res(tareas);
  unsigned hilos = p.hilos ? p.hilos : std::max(1u, std::min(std::thread::hardware_concurrency(), 8u));
  hilos = std::min<unsigned>(hilos, static_cast<unsigned>(std::max<std::size_t>(tareas, 1)));

  std::atomic<std::size_t> siguiente{0};
  std::exception_ptr error;
  std::mutex mtx;
  auto trabajar = [&] {
    for (std::size_t t; (t = siguiente++) < tareas;) {
      try {
        const Espacial& g = grupos[t / R];
        memetico::ParametrosMemetico pm = p.memetico;
        pm.semilla = semilla_derivada(p.semilla, g.poligonos.front(), static_cast<int>(t % R));
        res[t] = memetico::ejecutar_memetico(g.m_s, m, w, pm);
      } catch (...) {
        std::lock_guard lock(mtx);
        if (!error) error = std::current_exception();
      }
    }
  };
  {
    std::vector<std::jthread> pool;
    for (unsigned h = 1; h < hilos; ++h) pool.emplace_back(trabajar);
    trabajar();
  }
  if (error) std::rethrow_exception(error);

  for (std::size_t gi = 0; gi < grupos.size(); ++gi) {
    Espacial& g = grupos[gi];
    const auto ini = res.begin() + static_cast<std::ptrdiff_t>(gi * R);
    const auto mejor = std::min_element(ini, ini + static_cast<std::ptrdiff_t>(R),
                                        [](const auto& a, const auto& b) { return a.competencia < b.competencia; });
    g.mejor = mejor->mejor;
    g.mejor_competencia = mejor->competencia;

    double suma = 0, suma2 = 0, gens = 0;
    for (auto it = ini; it != ini + static_cast<std::ptrdiff_t>(R); ++it) {
      suma += it->competencia;
      suma2 += it->competencia * it->competencia;
      gens += it->generaciones;
    }
    g.media = suma / R;
    g.desviacion = R > 1 ? std::sqrt(std::max(0.0, (suma2 - R * g.media * g.media) / (R - 1))) : 0.0;
    g.generaciones_media = gens / R;
    g.esperada = memetico::competencia_esperada_aleatoria(g.m_s, m, w);
  }
  return grupos;
}

}  // namespace refor
