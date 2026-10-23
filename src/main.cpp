// refor: modelo de compra de plantas bajo incertidumbre y su distribución
// espacial (reporte E2). Los resultados se escriben en docs/res/ desde el
// repo, o en ./resultados fuera de él (ver rutas.hpp).
//
//   refor compra   --alpha 0.05 --B 12500      compra por polígono y especie
//   refor barrido  --alphas ... --B-min ...    factibilidad en la rejilla α × B
//   refor frontera --alphas ...                presupuesto mínimo B*(α)
//   refor plan     --alpha 0.05 --B 12500      compra + mosaico memético por polígono
//   refor plan ... --exacto                + modelo entero (secc. 2.2) por mosaico, para medir la brecha del memético
//   refor plan ... --exacto -f json        + la traza de cotas del solver y la clave del exacto

#include <chrono>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <map>
#include <sstream>
#include <string>
#include <vector>

#include <CLI/CLI.hpp>

#include "asignacion_exacta/salida_ple.hpp"
#include "datos.hpp"
#include "memetico/competencia.hpp"
#include "memetico/mosaico.hpp"
#include "modelo.hpp"
#include "plan.hpp"
#include "rutas.hpp"
#include "salida.hpp"

namespace {

using namespace refor;
namespace fs = std::filesystem;

struct Comunes {
  std::string datos_dir = texto_utf8(datos_por_defecto());
  std::string poligonos = "todos";
  std::string formato = "tabla";
  std::string metodo = "mc";
  std::string salida;
  std::string dir_res = texto_utf8(resultados_por_defecto(false));
  Parametros p;
};

void agregar_comunes(CLI::App* cmd, Comunes& c) {
  cmd->add_option("--datos", c.datos_dir,
                  "Directorio con especies.csv, poligonos.csv, existentes.csv y competencia.csv")
      ->capture_default_str();
  cmd->add_option("--poligonos", c.poligonos, "Polígonos a resolver: 'todos' o lista '1,5,7'")
      ->capture_default_str();
  cmd->add_option("--theta", c.p.theta, "Sobrecosto logístico θ (fracción del costo de la planta)")
      ->check(CLI::Range(0.0, 10.0))
      ->capture_default_str();
  cmd->add_option("--delta", c.p.delta, "Desviación máxima por especie respecto al plan δ")
      ->check(CLI::Range(0.0, 1.0))
      ->capture_default_str();
  cmd->add_option("-K,--escenarios", c.p.K, "Escenarios Monte Carlo")
      ->check(CLI::PositiveNumber)
      ->capture_default_str();
  cmd->add_option("--semilla", c.p.semilla, "Semilla del generador")->capture_default_str();
  cmd->add_option("--metodo", c.metodo, "Cálculo de x*(n): 'mc' (Monte Carlo) o 'exacto' (binomial)")
      ->check(CLI::IsMember({"mc", "exacto"}))
      ->capture_default_str();
  cmd->add_option("--hilos", c.p.hilos, "Hilos para la simulación (0: automático)")->capture_default_str();
  cmd->add_option("-f,--formato", c.formato, "Formato de salida")
      ->check(CLI::IsMember({"tabla", "csv", "json"}))
      ->capture_default_str();
  cmd->add_option("--dir", c.dir_res, "Directorio de resultados")->capture_default_str();
}

// Solo para los subcomandos que producen un archivo; plan escribe varios en --dir.
void agregar_salida(CLI::App* cmd, Comunes& c) {
  cmd->add_option("-o,--salida", c.salida,
                  "Archivo de salida (por defecto, <dir>/<subcomando>.<ext>; '-' para la terminal)");
}

std::vector<int> elegir_poligonos(const Datos& d, const std::string& spec) {
  std::vector<int> ids;
  if (spec == "todos" || spec == "all") {
    for (const auto& p : d.poligonos) ids.push_back(p.id);
    return ids;
  }
  std::stringstream ss(spec);
  for (std::string t; std::getline(ss, t, ',');) {
    const int id = std::stoi(t);
    d.poligono(id);  // valida que exista
    ids.push_back(id);
  }
  return ids;
}

Formato formato_de(const std::string& s) {
  static const std::map<std::string, Formato> m{
      {"tabla", Formato::Tabla}, {"csv", Formato::Csv}, {"json", Formato::Json}};
  return m.at(s);
}

void validar_alfas(const std::vector<double>& alfas) {
  for (double a : alfas) {
    if (a <= 0 || a >= 1) throw CLI::ValidationError("--alpha", "α debe estar en (0, 1)");
  }
}

std::string extension(Formato f) {
  switch (f) {
    case Formato::Tabla: return ".txt";
    case Formato::Csv: return ".csv";
    case Formato::Json: return ".json";
  }
  return "";
}

// Escribe en la terminal si la ruta es "-"; si no, en el archivo (creando sus
// directorios).
template <class F>
void emitir(const fs::path& ruta, F&& escribir) {
  if (ruta == "-") return escribir(std::cout);
  if (ruta.has_parent_path()) fs::create_directories(ruta.parent_path());
  std::ofstream out(ruta);
  if (!out) throw std::runtime_error("no se pudo escribir " + texto_utf8(ruta));
  escribir(out);
  std::cerr << "Resultados escritos en " << texto_utf8(ruta) << '\n';
}

// La ruta pedida con -o o, por defecto, <dir>/<nombre>.<ext>.
fs::path ruta_de(const Comunes& c, const std::string& nombre, Formato f) {
  if (!c.salida.empty()) return ruta_utf8(c.salida);
  return ruta_utf8(c.dir_res) / (nombre + extension(f));
}

}  // namespace

int main(int argc, char** argv) {
  consola_utf8();
  CLI::App app{"Compra de plantas bajo incertidumbre y su distribución espacial (E2)"};
  argv = app.ensure_utf8(argv);
  app.require_subcommand(1);

  Comunes c;
  double alfa = 0.05, B = 12'500;
  std::vector<double> alfas{0.01, 0.02, 0.05, 0.10, 0.15, 0.20, 0.30, 0.40, 0.50};
  double B_min = 12'000, B_max = 17'000, B_paso = 250;
  ParametrosEspacial pe;
  std::string competencia_csv;
  bool con_exacto = false;
  double limite_exacto = 300, brecha_exacto = 0;

  auto agregar_alfa_B = [&](CLI::App* cmd) {
    cmd->add_option("-a,--alpha", alfa, "Riesgo admisible de no alcanzar la meta de una especie")
        ->capture_default_str();
    cmd->add_option("-B,--presupuesto", B, "Presupuesto por hectárea ($)")
        ->check(CLI::PositiveNumber)
        ->capture_default_str();
  };

  auto* compra = app.add_subcommand("compra", "Compra óptima por polígono y especie para un (α, B)");
  agregar_comunes(compra, c);
  agregar_salida(compra, c);
  agregar_alfa_B(compra);

  auto* plan = app.add_subcommand(
      "plan", "Orquesta ambos niveles: compra para un (α, B) y mosaico memético con esa composición");
  agregar_comunes(plan, c);
  agregar_alfa_B(plan);
  plan->add_option("--competencia", competencia_csv, "Matriz W (por defecto, <datos>/competencia.csv)");
  // Con menos de 3 en una dirección, el borde periódico repite vecinas.
  plan->add_option("--filas", pe.filas, "Filas del mosaico (coordenada axial q)")
      ->check(CLI::Range(3, 100))
      ->capture_default_str();
  plan->add_option("--columnas", pe.columnas, "Columnas del mosaico (coordenada axial r)")
      ->check(CLI::Range(3, 100))
      ->capture_default_str();
  plan->add_option("--corridas", pe.corridas, "Corridas independientes del memético por mosaico")
      ->check(CLI::PositiveNumber)
      ->capture_default_str();
  plan->add_option("--poblacion", pe.memetico.poblacion, "Tamaño de la población P")
      ->check(CLI::Range(2, 1000))
      ->capture_default_str();
  plan->add_option("--generaciones", pe.memetico.generaciones_max, "Generaciones máximas")
      ->check(CLI::PositiveNumber)
      ->capture_default_str();
  plan->add_option("--sin-mejora", pe.memetico.generaciones_sin_mejora_max, "Generaciones sin mejora para parar")
      ->check(CLI::PositiveNumber)
      ->capture_default_str();
  plan->add_option("--tabu-iter", pe.memetico.tabu.iteraciones_sin_mejora,
                   "Iteraciones sin mejora para parar la búsqueda tabú")
      ->check(CLI::PositiveNumber)
      ->capture_default_str();
  plan->add_flag("--exacto", con_exacto,
                 "Resuelve también cada mosaico con el modelo entero (secc. 2.2) y compara con el memético");
  plan->add_option("--limite-exacto", limite_exacto, "Límite de tiempo del modelo entero por mosaico (s)")
      ->check(CLI::PositiveNumber)
      ->capture_default_str();
  plan->add_option("--brecha-exacto", brecha_exacto,
                   "Brecha relativa con la que el modelo entero se da por satisfecho (0: probar el óptimo)")
      ->check(CLI::Range(0.0, 1.0))
      ->capture_default_str();

  auto* barrido = app.add_subcommand("barrido", "Factibilidad y costo en la rejilla α × B");
  agregar_comunes(barrido, c);
  agregar_salida(barrido, c);
  barrido->add_option("--alphas", alfas, "Valores de α separados por comas")
      ->delimiter(',')
      ->capture_default_str();
  barrido->add_option("--B-min", B_min, "Presupuesto mínimo de la rejilla ($/ha)")->capture_default_str();
  barrido->add_option("--B-max", B_max, "Presupuesto máximo de la rejilla ($/ha)")->capture_default_str();
  barrido->add_option("--B-paso", B_paso, "Paso de la rejilla ($/ha)")
      ->check(CLI::PositiveNumber)
      ->capture_default_str();

  auto* frontera = app.add_subcommand("frontera", "Presupuesto mínimo factible B*(α)");
  agregar_comunes(frontera, c);
  agregar_salida(frontera, c);
  frontera->add_option("--alphas", alfas, "Valores de α separados por comas")
      ->delimiter(',')
      ->capture_default_str();

  CLI11_PARSE(app, argc, argv);

  try {
    const Datos datos = cargar_datos(ruta_utf8(c.datos_dir));
    const std::vector<int> ids = elegir_poligonos(datos, c.poligonos);
    c.p.metodo = c.metodo == "exacto" ? Metodo::Exacto : Metodo::MonteCarlo;
    const Formato fmt = formato_de(c.formato);
    if (compra->parsed() || plan->parsed()) alfas = {alfa};
    validar_alfas(alfas);
    if (barrido->parsed() && B_max < B_min) {
      throw CLI::ValidationError("--B-max", "debe ser mayor o igual que --B-min");
    }

    const auto t0 = std::chrono::steady_clock::now();
    const auto curvas = calcular_curvas(datos, ids, alfas, c.p);
    const double seg = std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count();
    std::cerr << "Curvas de " << ids.size() << " polígonos × " << alfas.size() << " α en " << seg
              << " s (" << c.metodo << (c.p.metodo == Metodo::MonteCarlo ? ", K=" + std::to_string(c.p.K) : "")
              << ")\n";

    if (compra->parsed()) {
      std::vector<Resultado> res;
      for (const auto& cp : curvas) res.push_back(resolver_poligono(datos, cp, 0, alfa, B, c.p.theta));
      emitir(ruta_de(c, "compra", fmt), [&](std::ostream& o) { escribir_compra(o, datos, res, fmt); });
    } else if (plan->parsed()) {
      const fs::path w_csv = competencia_csv.empty() ? ruta_utf8(c.datos_dir) / "competencia.csv" : ruta_utf8(competencia_csv);
      const memetico::Competencia w(datos, w_csv);
      const memetico::Mosaico m(pe.filas, pe.columnas);
      pe.semilla = c.p.semilla;
      pe.hilos = c.p.hilos;

      const auto t1 = std::chrono::steady_clock::now();
      // Nivel 1: compra. Nivel 2: su composición, distribuida en el mosaico.
      const auto [compras, espacial] = ejecutar_plan(datos, curvas, alfa, B, c.p.theta, m, w, pe);
      const double seg_esp = std::chrono::duration<double>(std::chrono::steady_clock::now() - t1).count();
      std::cerr << "Memético: " << espacial.size() << " mosaicos distintos × " << pe.corridas << " corridas en "
                << seg_esp << " s\n";

      const fs::path dir = ruta_utf8(c.dir_res) / "plan";
      emitir(dir / ("compra" + extension(fmt)), [&](std::ostream& o) { escribir_compra(o, datos, compras, fmt); });
      emitir(dir / ("espacial" + extension(fmt)),
             [&](std::ostream& o) { escribir_espacial(o, datos, espacial, m, pe.corridas, fmt); });
      if (fmt == Formato::Csv)
        emitir(dir / "mosaicos.csv", [&](std::ostream& o) { escribir_mosaicos_csv(o, datos, espacial, m); });

      if (con_exacto) {
        asignacion_exacta::ParametrosPLE pp;
        pp.limite_segundos = limite_exacto;
        pp.brecha_relativa = brecha_exacto;
        const auto exactos = asignacion_exacta::resolver_exacto(espacial, m, w, pp);
        emitir(dir / ("exacto" + extension(fmt)),
               [&](std::ostream& o) { asignacion_exacta::escribir_exacto(o, datos, espacial, exactos, m, fmt); });
      }
    } else if (barrido->parsed()) {
      std::vector<double> Bs;
      for (double b = B_min; b <= B_max + 1e-9; b += B_paso) Bs.push_back(b);
      std::vector<Resultado> res;
      for (std::size_t a = 0; a < alfas.size(); ++a)
        for (double b : Bs)
          for (const auto& cp : curvas) res.push_back(resolver_poligono(datos, cp, a, alfas[a], b, c.p.theta));
      emitir(ruta_de(c, "barrido", fmt), [&](std::ostream& o) { escribir_barrido(o, res, alfas, Bs, fmt); });
    } else {
      std::vector<Frontera> res;
      for (std::size_t a = 0; a < alfas.size(); ++a)
        for (const auto& cp : curvas) res.push_back(frontera_poligono(datos, cp, a, alfas[a], c.p.theta));
      emitir(ruta_de(c, "frontera", fmt), [&](std::ostream& o) { escribir_frontera(o, res, alfas, fmt); });
    }
  } catch (const CLI::Error& e) {
    return app.exit(e);
  } catch (const std::exception& e) {
    std::cerr << "error: " << e.what() << '\n';
    return 1;
  }
  return 0;
}
