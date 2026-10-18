#include "modelo.hpp"

#include <algorithm>
#include <atomic>
#include <cmath>
#include <exception>
#include <mutex>
#include <thread>

#include "exacto.hpp"
#include "simulacion.hpp"

namespace refor {

namespace {

CurvasPoligono curvas_de(const Datos& datos, const Poligono& pol, const std::vector<double>& alfas,
                         const Parametros& p) {
  const std::size_t S = datos.especies.size();
  CurvasPoligono cp{&pol, static_cast<int>(std::lround(datos.densidad_total() * pol.area)),
                    std::vector<std::vector<Curva>>(alfas.size(), std::vector<Curva>(S))};

  for (std::size_t s = 0; s < S; ++s) {
    const Especie& esp = datos.especies[s];
    const Rango r = banda(esp.n0, pol.area, p.delta);
    const int E = pol.E[s];

    if (p.metodo == Metodo::Exacto) {
      for (std::size_t a = 0; a < alfas.size(); ++a) cp.por_alfa[a][s] = curva_exacta(E, esp.q, r, alfas[a]);
      continue;
    }
    const Escenarios esc(esp.q, r.n_max - E, p.K,
                         semilla_derivada(p.semilla, pol.id, static_cast<int>(s)));
    auto cs = esc.curvas(E, r, alfas);
    for (std::size_t a = 0; a < alfas.size(); ++a) cp.por_alfa[a][s] = std::move(cs[a]);
  }
  return cp;
}

}  // namespace

std::vector<CurvasPoligono> calcular_curvas(const Datos& datos, const std::vector<int>& ids,
                                            const std::vector<double>& alfas, const Parametros& p) {
  std::vector<CurvasPoligono> res(ids.size());
  unsigned hilos = p.hilos ? p.hilos : std::max(1u, std::min(std::thread::hardware_concurrency(), 8u));
  hilos = std::min<unsigned>(hilos, static_cast<unsigned>(ids.size()));

  std::atomic<std::size_t> siguiente{0};
  std::exception_ptr error;
  std::mutex mtx;
  auto trabajar = [&] {
    for (std::size_t i; (i = siguiente++) < ids.size();) {
      try {
        res[i] = curvas_de(datos, datos.poligono(ids[i]), alfas, p);
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
  return res;
}

Instancia instancia(const Datos& datos, const CurvasPoligono& cp, std::size_t ialfa, double theta) {
  Instancia inst{cp.por_alfa.at(ialfa), {}, cp.total, theta};
  for (const auto& e : datos.especies) inst.c.push_back(e.c);
  return inst;
}

Resultado resolver_poligono(const Datos& datos, const CurvasPoligono& cp, std::size_t ialfa,
                            double alfa, double B, double theta) {
  const Instancia inst = instancia(datos, cp, ialfa, theta);
  const double area = cp.poligono->area;
  Resultado r{cp.poligono, alfa, B, resolver(inst, B * area), resolver_dp(inst, Criterio::Total), {}};
  if (auto minima = resolver_dp(inst, Criterio::Compra)) r.B_minimo = minima->costo_compra / area;
  return r;
}

Frontera frontera_poligono(const Datos& datos, const CurvasPoligono& cp, std::size_t ialfa,
                           double alfa, double theta) {
  const Instancia inst = instancia(datos, cp, ialfa, theta);
  const double area = cp.poligono->area;
  Frontera f{cp.poligono, alfa, {}, {}};
  if (auto minima = resolver_dp(inst, Criterio::Compra)) f.B_minimo = minima->costo_compra / area;
  if (auto libre = resolver_dp(inst, Criterio::Total)) f.costo_libre = libre->costo_total() / area;
  return f;
}

}  // namespace refor
