// refor: modelo de compra de plantas bajo incertidumbre (reporte E2).
//
//   refor compra   --alpha 0.05 --B 12500      compra por polígono y especie
//   refor barrido  --alphas ... --B-min ...    factibilidad en la rejilla α × B
//   refor frontera --alphas ...                presupuesto mínimo B*(α)

#include <chrono>
#include <fstream>
#include <iostream>
#include <map>
#include <sstream>
#include <string>
#include <vector>

#include <CLI/CLI.hpp>

#include "datos.hpp"
#include "modelo.hpp"
#include "salida.hpp"

namespace {

using namespace refor;

struct Comunes {
  std::string datos_dir = "data/processed";
  std::string poligonos = "todos";
  std::string formato = "tabla";
  std::string metodo = "mc";
  std::string salida;
  Parametros p;
};

void agregar_comunes(CLI::App* cmd, Comunes& c) {
  cmd->add_option("--datos", c.datos_dir, "Directorio con especies.csv, poligonos.csv y existentes.csv")
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
  cmd->add_option("-o,--salida", c.salida, "Archivo de salida (por defecto, la terminal)");
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

// Escribe en el archivo pedido o en la terminal.
template <class F>
void emitir(const std::string& ruta, F&& escribir) {
  if (ruta.empty()) return escribir(std::cout);
  std::ofstream out(ruta);
  if (!out) throw std::runtime_error("no se pudo escribir " + ruta);
  escribir(out);
  std::cerr << "Resultados escritos en " << ruta << '\n';
}

}  // namespace

int main(int argc, char** argv) {
  CLI::App app{"Modelo de compra de plantas para reforestación bajo incertidumbre (E2)"};
  app.require_subcommand(1);

  Comunes c;
  double alfa = 0.05, B = 12'500;
  std::vector<double> alfas{0.01, 0.02, 0.05, 0.10, 0.15, 0.20, 0.30, 0.40, 0.50};
  double B_min = 12'000, B_max = 17'000, B_paso = 250;

  auto* compra = app.add_subcommand("compra", "Compra óptima por polígono y especie para un (α, B)");
  agregar_comunes(compra, c);
  compra->add_option("-a,--alpha", alfa, "Riesgo admisible de no alcanzar la meta de una especie")
      ->capture_default_str();
  compra->add_option("-B,--presupuesto", B, "Presupuesto por hectárea ($)")
      ->check(CLI::PositiveNumber)
      ->capture_default_str();

  auto* barrido = app.add_subcommand("barrido", "Factibilidad y costo en la rejilla α × B");
  agregar_comunes(barrido, c);
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
  frontera->add_option("--alphas", alfas, "Valores de α separados por comas")
      ->delimiter(',')
      ->capture_default_str();

  CLI11_PARSE(app, argc, argv);

  try {
    const Datos datos = cargar_datos(c.datos_dir);
    const std::vector<int> ids = elegir_poligonos(datos, c.poligonos);
    c.p.metodo = c.metodo == "exacto" ? Metodo::Exacto : Metodo::MonteCarlo;
    const Formato fmt = formato_de(c.formato);
    if (compra->parsed()) alfas = {alfa};
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
      emitir(c.salida, [&](std::ostream& o) { escribir_compra(o, datos, res, fmt); });
    } else if (barrido->parsed()) {
      std::vector<double> Bs;
      for (double b = B_min; b <= B_max + 1e-9; b += B_paso) Bs.push_back(b);
      std::vector<Resultado> res;
      for (std::size_t a = 0; a < alfas.size(); ++a)
        for (double b : Bs)
          for (const auto& cp : curvas) res.push_back(resolver_poligono(datos, cp, a, alfas[a], b, c.p.theta));
      emitir(c.salida, [&](std::ostream& o) { escribir_barrido(o, res, alfas, Bs, fmt); });
    } else {
      std::vector<Frontera> res;
      for (std::size_t a = 0; a < alfas.size(); ++a)
        for (const auto& cp : curvas) res.push_back(frontera_poligono(datos, cp, a, alfas[a], c.p.theta));
      emitir(c.salida, [&](std::ostream& o) { escribir_frontera(o, res, alfas, fmt); });
    }
  } catch (const CLI::Error& e) {
    return app.exit(e);
  } catch (const std::exception& e) {
    std::cerr << "error: " << e.what() << '\n';
    return 1;
  }
  return 0;
}
