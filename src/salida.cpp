#include "salida.hpp"

#include <cmath>
#include <format>
#include <map>
#include <string>

namespace refor {

namespace {

// Solución que se reporta: la factible, o la libre si no hay factible.
const Solucion* reportada(const Resultado& r) {
  if (r.optima) return &*r.optima;
  if (r.libre) return &*r.libre;
  return nullptr;
}

std::string estado(const Resultado& r) {
  if (r.optima) return "factible";
  return r.libre ? "infactible" : "banda_infactible";
}

std::string num(const std::optional<double>& v, int dec = 2) {
  return v ? std::format("{:.{}f}", *v, dec) : "";
}

std::string json_num(const std::optional<double>& v, int dec = 2) {
  return v ? std::format("{:.{}f}", *v, dec) : "null";
}

// ---------------------------------------------------------------- compra

void compra_tabla(std::ostream& out, const Datos& d, const std::vector<Resultado>& res) {
  std::vector<long> total_x(d.especies.size(), 0);
  double total_compra = 0, total_area = 0;
  int factibles = 0;

  for (const auto& r : res) {
    const Solucion* sol = reportada(r);
    out << std::format("\nPolígono {} ({:.2f} ha)  α={}  B=${:.0f}/ha  → {}\n", r.poligono->id,
                       r.poligono->area, r.alfa, r.B, estado(r));
    if (!sol) continue;
    out << std::format("  {:<26}{:>6}{:>8}{:>8}{:>8}{:>9}{:>12}\n", "Especie", "E", "n0·A", "n",
                       "x*", "E[D]", "Costo $");
    for (std::size_t s = 0; s < d.especies.size(); ++s) {
      const auto& e = d.especies[s];
      out << std::format("  {:<26}{:>6}{:>8.1f}{:>8}{:>8}{:>9.2f}{:>12.2f}\n", e.nombre,
                         r.poligono->E[s], e.n0 * r.poligono->area, sol->n[s], sol->x[s],
                         sol->deficit[s], sol->compra_especie[s]);
      total_x[s] += sol->x[s];
    }
    const double a = r.poligono->area;
    out << std::format("  Compra ${:.0f}/ha + reposición esperada ${:.0f}/ha = ${:.0f}/ha",
                       sol->costo_compra / a, sol->costo_reposicion / a, sol->costo_total() / a);
    out << std::format("   (presupuesto mínimo ${}/ha)\n", num(r.B_minimo, 0));
    total_compra += sol->costo_compra;
    total_area += a;
    factibles += r.optima.has_value();
  }

  if (res.size() > 1) {
    out << std::format("\nResumen: {} de {} polígonos factibles; {:.2f} ha; compra ${:.0f} "
                       "(${:.0f}/ha, incluye θ)\n",
                       factibles, res.size(), total_area, total_compra, total_compra / total_area);
    out << "Plantas a comprar por especie:\n";
    for (std::size_t s = 0; s < d.especies.size(); ++s) {
      out << std::format("  {:<26}{:>8}\n", d.especies[s].nombre, total_x[s]);
    }
  }
}

void compra_csv(std::ostream& out, const Datos& d, const std::vector<Resultado>& res) {
  out << "poligono,area,alfa,B,estado,B_minimo,especie,E,n0A,n,x,deficit,costo_compra,"
         "costo_reposicion\n";
  for (const auto& r : res) {
    const Solucion* sol = reportada(r);
    if (!sol) {
      out << std::format("{},{},{},{},{},,,,,,,,,\n", r.poligono->id, r.poligono->area, r.alfa,
                         r.B, estado(r));
      continue;
    }
    for (std::size_t s = 0; s < d.especies.size(); ++s) {
      const auto& e = d.especies[s];
      out << std::format("{},{},{},{},{},{},{},{},{:.2f},{},{},{:.4f},{:.2f},{:.2f}\n",
                         r.poligono->id, r.poligono->area, r.alfa, r.B, estado(r),
                         num(r.B_minimo), e.nombre, r.poligono->E[s], e.n0 * r.poligono->area,
                         sol->n[s], sol->x[s], sol->deficit[s], sol->compra_especie[s],
                         sol->reposicion_especie[s]);
    }
  }
}

void compra_json(std::ostream& out, const Datos& d, const std::vector<Resultado>& res) {
  out << "[\n";
  for (std::size_t i = 0; i < res.size(); ++i) {
    const auto& r = res[i];
    const Solucion* sol = reportada(r);
    out << std::format("  {{\"poligono\": {}, \"area\": {}, \"alfa\": {}, \"B\": {}, "
                       "\"estado\": \"{}\", \"B_minimo\": {}",
                       r.poligono->id, r.poligono->area, r.alfa, r.B, estado(r),
                       json_num(r.B_minimo));
    if (sol) {
      out << std::format(", \"costo_compra\": {:.2f}, \"costo_reposicion\": {:.2f}, \"especies\": [",
                         sol->costo_compra, sol->costo_reposicion);
      for (std::size_t s = 0; s < d.especies.size(); ++s) {
        out << std::format("{}\n    {{\"especie\": \"{}\", \"E\": {}, \"n\": {}, \"x\": {}, "
                           "\"deficit\": {:.4f}}}",
                           s ? "," : "", d.especies[s].nombre, r.poligono->E[s], sol->n[s],
                           sol->x[s], sol->deficit[s]);
      }
      out << "\n  ]";
    }
    out << (i + 1 < res.size() ? "},\n" : "}\n");
  }
  out << "]\n";
}

// ---------------------------------------------------------------- barrido

void barrido_tabla(std::ostream& out, const std::vector<Resultado>& res,
                   const std::vector<double>& alfas, const std::vector<double>& Bs) {
  std::map<std::pair<double, double>, std::pair<int, int>> conteo;  // (α, B) → (factibles, total)
  for (const auto& r : res) {
    auto& [fact, tot] = conteo[{r.alfa, r.B}];
    fact += r.optima.has_value();
    ++tot;
  }
  out << "Polígonos factibles por (α, B $/ha)\n";
  out << std::format("{:>7}", "α \\ B");
  for (double B : Bs) out << std::format("{:>8.0f}", B);
  out << '\n';
  for (double a : alfas) {
    out << std::format("{:>7.3f}", a);
    for (double B : Bs) {
      const auto [fact, tot] = conteo[{a, B}];
      out << std::format("{:>8}", std::format("{}/{}", fact, tot));
    }
    out << '\n';
  }
}

void barrido_csv(std::ostream& out, const std::vector<Resultado>& res) {
  out << "poligono,area,alfa,B,estado,B_minimo,costo_compra_ha,costo_total_ha\n";
  for (const auto& r : res) {
    const double a = r.poligono->area;
    std::optional<double> compra, total;
    if (r.optima) {
      compra = r.optima->costo_compra / a;
      total = r.optima->costo_total() / a;
    }
    out << std::format("{},{},{},{},{},{},{},{}\n", r.poligono->id, a, r.alfa, r.B, estado(r),
                       num(r.B_minimo), num(compra), num(total));
  }
}

void barrido_json(std::ostream& out, const std::vector<Resultado>& res) {
  out << "[\n";
  for (std::size_t i = 0; i < res.size(); ++i) {
    const auto& r = res[i];
    const double a = r.poligono->area;
    std::optional<double> compra, total;
    if (r.optima) {
      compra = r.optima->costo_compra / a;
      total = r.optima->costo_total() / a;
    }
    out << std::format("  {{\"poligono\": {}, \"alfa\": {}, \"B\": {}, \"estado\": \"{}\", "
                       "\"B_minimo\": {}, \"costo_compra_ha\": {}, \"costo_total_ha\": {}}}{}\n",
                       r.poligono->id, r.alfa, r.B, estado(r), json_num(r.B_minimo),
                       json_num(compra), json_num(total), i + 1 < res.size() ? "," : "");
  }
  out << "]\n";
}

// ---------------------------------------------------------------- frontera

struct Agregado {
  std::optional<double> B_minimo, costo_libre, B_min_pol, B_max_pol;
};

// Promedios ponderados por área; vacíos si algún polígono no tiene valor.
Agregado agregar(const std::vector<Frontera>& res, double alfa) {
  double area = 0, b = 0, c = 0;
  double bmin = INFINITY, bmax = -INFINITY;
  for (const auto& f : res) {
    if (f.alfa != alfa) continue;
    if (!f.B_minimo || !f.costo_libre) return {};
    const double a = f.poligono->area;
    area += a;
    b += *f.B_minimo * a;
    c += *f.costo_libre * a;
    bmin = std::min(bmin, *f.B_minimo);
    bmax = std::max(bmax, *f.B_minimo);
  }
  if (area == 0) return {};
  return {b / area, c / area, bmin, bmax};
}

void frontera_tabla(std::ostream& out, const std::vector<Frontera>& res,
                    const std::vector<double>& alfas) {
  out << "Presupuesto mínimo B*(α) en $/ha (promedio ponderado por área)\n";
  out << std::format("{:>7}{:>12}{:>12}{:>12}{:>16}\n", "α", "B* prom.", "B* mín.", "B* máx.",
                     "Costo óptimo");
  for (double a : alfas) {
    const Agregado g = agregar(res, a);
    out << std::format("{:>7.3f}{:>12}{:>12}{:>12}{:>16}\n", a, num(g.B_minimo, 0),
                       num(g.B_min_pol, 0), num(g.B_max_pol, 0), num(g.costo_libre, 0));
  }
}

void frontera_csv(std::ostream& out, const std::vector<Frontera>& res,
                  const std::vector<double>& alfas) {
  out << "poligono,area,alfa,B_minimo,costo_libre\n";
  for (const auto& f : res) {
    out << std::format("{},{},{},{},{}\n", f.poligono->id, f.poligono->area, f.alfa,
                       num(f.B_minimo), num(f.costo_libre));
  }
  for (double a : alfas) {
    const Agregado g = agregar(res, a);
    out << std::format("todos,,{},{},{}\n", a, num(g.B_minimo), num(g.costo_libre));
  }
}

void frontera_json(std::ostream& out, const std::vector<Frontera>& res,
                   const std::vector<double>& alfas) {
  out << "{\n  \"poligonos\": [\n";
  for (std::size_t i = 0; i < res.size(); ++i) {
    const auto& f = res[i];
    out << std::format("    {{\"poligono\": {}, \"alfa\": {}, \"B_minimo\": {}, "
                       "\"costo_libre\": {}}}{}\n",
                       f.poligono->id, f.alfa, json_num(f.B_minimo), json_num(f.costo_libre),
                       i + 1 < res.size() ? "," : "");
  }
  out << "  ],\n  \"agregado\": [\n";
  for (std::size_t i = 0; i < alfas.size(); ++i) {
    const Agregado g = agregar(res, alfas[i]);
    out << std::format("    {{\"alfa\": {}, \"B_minimo\": {}, \"costo_libre\": {}}}{}\n", alfas[i],
                       json_num(g.B_minimo), json_num(g.costo_libre),
                       i + 1 < alfas.size() ? "," : "");
  }
  out << "  ]\n}\n";
}

}  // namespace

void escribir_barrido(std::ostream& out, const std::vector<Resultado>& res,
                      const std::vector<double>& alfas, const std::vector<double>& Bs, Formato f) {
  switch (f) {
    case Formato::Tabla: return barrido_tabla(out, res, alfas, Bs);
    case Formato::Csv: return barrido_csv(out, res);
    case Formato::Json: return barrido_json(out, res);
  }
}

void escribir_frontera(std::ostream& out, const std::vector<Frontera>& res,
                       const std::vector<double>& alfas, Formato f) {
  switch (f) {
    case Formato::Tabla: return frontera_tabla(out, res, alfas);
    case Formato::Csv: return frontera_csv(out, res, alfas);
    case Formato::Json: return frontera_json(out, res, alfas);
  }
}

void escribir_compra(std::ostream& out, const Datos& datos, const std::vector<Resultado>& res,
                     Formato f) {
  switch (f) {
    case Formato::Tabla: return compra_tabla(out, datos, res);
    case Formato::Csv: return compra_csv(out, datos, res);
    case Formato::Json: return compra_json(out, datos, res);
  }
}

}  // namespace refor
