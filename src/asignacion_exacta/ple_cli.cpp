// Ejecutable independiente para el modelo entero de asignación espacial:
//   ./refor_ple --filas 4 --columnas 13 --limite 600
#include <CLI/CLI.hpp>

#include <algorithm>
#include <iomanip>
#include <iostream>
#include <numeric>
#include <string>
#include <vector>

#include "asignacion_exacta/ple.hpp"
#include "datos.hpp"
#include "memetico/competencia.hpp"
#include "memetico/individuo.hpp"
#include "memetico/mosaico.hpp"
#include "rutas.hpp"

namespace {


std::vector<int> composicion_proporcional(const refor::Datos& d, int n) {
  const int S = static_cast<int>(d.especies.size());
  const double total = d.densidad_total();
  std::vector<int> m_s(S);
  std::vector<double> resto(S);
  for (int s = 0; s < S; ++s) {
    const double exacto = n * d.especies[s].n0 / total;
    m_s[s] = static_cast<int>(exacto);
    resto[s] = exacto - m_s[s];
  }
  int faltan = n - std::accumulate(m_s.begin(), m_s.end(), 0);
  std::vector<int> orden(S);
  std::iota(orden.begin(), orden.end(), 0);
  std::sort(orden.begin(), orden.end(), [&](int a, int b) { return resto[a] > resto[b]; });
  for (int k = 0; k < faltan; ++k) ++m_s[orden[k]];
  return m_s;
}

}  // namespace

int main(int argc, char** argv) {
  refor::consola_utf8();
  CLI::App app{"Modelo entero (sección 2.2) de asignación espacial de especies"};
  argv = app.ensure_utf8(argv);
  std::string dir_datos = refor::texto_utf8(refor::datos_por_defecto());
  std::string csv_w;
  int filas = 4, columnas = 13;
  refor::asignacion_exacta::ParametrosPLE p;
  app.add_option("--datos", dir_datos, "directorio con especies.csv, etc.");
  app.add_option("--competencia", csv_w, "csv de la matriz W (por defecto, <datos>/competencia.csv)");
  app.add_option("--filas", filas, "filas del mosaico (>= 3)");
  app.add_option("--columnas", columnas, "columnas del mosaico (>= 3)");
  app.add_option("--limite", p.limite_segundos, "límite de tiempo (s)");
  app.add_option("--brecha", p.brecha_relativa, "brecha relativa de paro");
  app.add_flag("--verbose", p.verbose, "log de HiGHS");
  CLI11_PARSE(app, argc, argv);

  if (filas < 3 || columnas < 3) {
    std::cerr << "filas y columnas deben ser >= 3 (con 2 hay aristas duplicadas)\n";
    return 1;
  }

  const auto datos = refor::cargar_datos(refor::ruta_utf8(dir_datos));
  const refor::memetico::Competencia w(
      datos, csv_w.empty() ? refor::ruta_utf8(dir_datos) / "competencia.csv" : refor::ruta_utf8(csv_w));
  const refor::memetico::Mosaico m(filas, columnas);
  const auto m_s = composicion_proporcional(datos, m.num_posiciones());

  std::cout << "Mosaico " << filas << "x" << columnas << " (" << m.num_posiciones() << " posiciones, "
            << m.aristas().size() << " aristas)\nComposicion m_s:";
  for (std::size_t s = 0; s < m_s.size(); ++s) std::cout << " " << datos.especies[s].nombre << "=" << m_s[s];
  std::cout << "\n";

  const auto r = refor::asignacion_exacta::resolver_ple(m_s, m, w, p);

  std::cout << std::fixed << std::setprecision(4) << "Estado: " << r.estado << "  (" << r.segundos << " s)\n";
  if (r.asignacion.empty()) {
    std::cout << "Sin solucion factible dentro del limite. Cota inferior: " << r.cota_inferior << "\n";
    return 2;
  }
  const double esperada = refor::memetico::competencia_esperada_aleatoria(m_s, m, w);
  std::cout << "Competencia total: " << r.competencia << "\nCota inferior:     " << r.cota_inferior
            << "\nBrecha relativa:   " << r.brecha << "\nCoef. de competencia (vs azar): "
            << r.competencia / esperada << "\nAsignacion por posicion:\n";
  for (int v = 0; v < m.num_posiciones(); ++v)
    std::cout << datos.especies[r.asignacion[v]].nombre << ((v + 1) % columnas == 0 ? "\n" : " ");
  return 0;
}
