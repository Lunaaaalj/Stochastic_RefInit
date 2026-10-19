#include "asignacion_exacta/salida_ple.hpp"

#include <algorithm>
#include <format>
#include <iostream>
#include <string>

namespace refor::asignacion_exacta {

namespace {

// Misma clave de tres letras que usa salida.cpp (p. ej. "Agave salmiana" -> "Asa").
std::string clave_especie(const std::string& nombre) {
  const auto esp = nombre.find(' ');
  if (esp == std::string::npos || esp + 2 >= nombre.size()) return nombre.substr(0, 3);
  return nombre.substr(0, 1) + nombre.substr(esp + 1, 2);
}

std::string ids(const std::vector<int>& v, const char* sep) {
  std::string s;
  for (std::size_t i = 0; i < v.size(); ++i) s += (i ? sep : "") + std::to_string(v[i]);
  return s;
}

// Brecha (%) del memético respecto a la cota inferior del exacto; nunca negativa.
double brecha_memetico(const Espacial& g, const ResultadoPLE& r) {
  if (g.mejor_competencia <= 0) return 0.0;
  return std::max(0.0, 100.0 * (g.mejor_competencia - r.cota_inferior) / g.mejor_competencia);
}

void tabla(std::ostream& out, const Datos& d, const std::vector<Espacial>& esp,
           const std::vector<ResultadoPLE>& ex, const memetico::Mosaico& m) {
  out << std::format("Modelo entero (sección 2.2): mosaico {} × {} ({} posiciones al tresbolillo, borde "
                     "periódico), con arranque desde el memético\n",
                     m.filas(), m.columnas(), m.num_posiciones());
  out << "Claves:";
  for (const auto& e : d.especies) out << std::format("  {} = {}", clave_especie(e.nombre), e.nombre);
  out << '\n';

  for (std::size_t g = 0; g < esp.size(); ++g) {
    const auto& e = esp[g];
    const auto& r = ex[g];
    out << std::format("\nMosaico {} — polígonos {}\n", g + 1, ids(e.poligonos, ", "));
    out << "  Composición:";
    for (std::size_t s = 0; s < e.m_s.size(); ++s)
      if (e.m_s[s]) out << std::format(" {} {}", clave_especie(d.especies[s].nombre), e.m_s[s]);
    out << '\n';
    out << std::format("  Memético: mejor {:.2f}\n", e.mejor_competencia);
    if (r.asignacion.empty()) {
      out << std::format("  Exacto: sin solución ({}, {:.1f} s); cota inferior {:.2f}\n", r.estado, r.segundos,
                         r.cota_inferior);
      continue;
    }
    out << std::format("  Exacto: competencia {:.2f}, cota inferior {:.2f}, brecha {:.2f} %, {} ({:.1f} s)\n",
                       r.competencia, r.cota_inferior, 100.0 * r.brecha, r.optimo ? "óptimo probado" : r.estado,
                       r.segundos);
    if (r.optimo)
      out << std::format("  El memético está a {:.2f} % del óptimo\n", brecha_memetico(e, r));
    else
      out << std::format("  El memético está, a lo más, a {:.2f} % del óptimo (según la cota inferior)\n",
                         brecha_memetico(e, r));
    out << "  Clave de plantación (exacto):\n";
    for (int f = 0; f < m.filas(); ++f) {
      out << std::string(4 + 2 * f, ' ');
      for (int c = 0; c < m.columnas(); ++c)
        out << std::format("{}{:<3}", c ? " " : "", clave_especie(d.especies[r.asignacion[m.indice(f, c)]].nombre));
      out << '\n';
    }
  }
}

void csv(std::ostream& out, const std::vector<Espacial>& esp, const std::vector<ResultadoPLE>& ex,
         const memetico::Mosaico& m) {
  out << "mosaico,poligonos,posiciones,competencia_memetico,competencia_exacto,cota_inferior,"
         "brecha_exacto_pct,brecha_memetico_pct,optimo,estado,segundos\n";
  for (std::size_t g = 0; g < esp.size(); ++g) {
    const auto& e = esp[g];
    const auto& r = ex[g];
    const bool hay = !r.asignacion.empty();
    out << std::format("{},{},{},{:.4f},{},{:.4f},{},{:.4f},{},{},{:.1f}\n", g + 1, ids(e.poligonos, ";"),
                       m.num_posiciones(), e.mejor_competencia,
                       hay ? std::format("{:.4f}", r.competencia) : std::string(), r.cota_inferior,
                       hay ? std::format("{:.4f}", 100.0 * r.brecha) : std::string(), brecha_memetico(e, r),
                       r.optimo ? "si" : "no", r.estado, r.segundos);
  }
}

}  // namespace

std::vector<ResultadoPLE> resolver_exacto(const std::vector<Espacial>& espacial, const memetico::Mosaico& m,
                                          const memetico::Competencia& w, const ParametrosPLE& p) {
  std::vector<ResultadoPLE> res;
  res.reserve(espacial.size());
  for (std::size_t g = 0; g < espacial.size(); ++g) {
    std::cerr << std::format("Modelo entero: mosaico {}/{} (límite {:.0f} s)...\n", g + 1, espacial.size(),
                             p.limite_segundos);
    res.push_back(resolver_ple(espacial[g].m_s, m, w, p, &espacial[g].mejor));
  }
  return res;
}

void escribir_exacto(std::ostream& out, const Datos& datos, const std::vector<Espacial>& espacial,
                     const std::vector<ResultadoPLE>& exacto, const memetico::Mosaico& m, Formato f) {
  if (f == Formato::Csv)
    csv(out, espacial, exacto, m);
  else
    tabla(out, datos, espacial, exacto, m);
}

}  // namespace refor::asignacion_exacta
