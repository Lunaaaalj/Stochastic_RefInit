#include "app.hpp"

#include <imgui_internal.h>  // DockBuilder

#include <filesystem>
#include <fstream>
#include <sstream>
#include <stdexcept>

#include "salida.hpp"

namespace refor::gui {

namespace fs = std::filesystem;

namespace {

std::vector<double> leer_alfas(const std::string& s) {
  std::vector<double> alfas;
  std::stringstream ss(s);
  for (std::string t; std::getline(ss, t, ',');) {
    if (t.find_first_not_of(" \t") == std::string::npos) continue;
    const double a = std::stod(t);
    if (a <= 0 || a >= 1) throw std::runtime_error("cada α debe estar en (0, 1)");
    alfas.push_back(a);
  }
  if (alfas.empty()) throw std::runtime_error("escribe al menos un α");
  return alfas;
}

template <class F>
void escribir_archivo(const fs::path& ruta, F&& escribir) {
  fs::create_directories(ruta.parent_path());
  std::ofstream out(ruta);
  if (!out) throw std::runtime_error("no se pudo escribir " + ruta.string());
  escribir(out);
}

}  // namespace

App::App(std::string datos_dir) {
  cfg_.datos_dir = std::move(datos_dir);
  cargar();
}

void App::cargar() {
  try {
    auto d = std::make_shared<const Datos>(cargar_datos(cfg_.datos_dir));
    auto w = std::make_shared<const memetico::Competencia>(*d, fs::path(cfg_.datos_dir) / "competencia.csv");
    datos_ = std::move(d);
    w_ = std::move(w);
    generos_ = estilo::generos(*datos_);
    cfg_.poligonos.assign(datos_->poligonos.size(), 1);
    mensaje_ = "Datos cargados: " + std::to_string(datos_->poligonos.size()) + " polígonos, " +
               std::to_string(datos_->especies.size()) + " especies.";
    mensaje_es_error_ = false;
  } catch (const std::exception& e) {
    mensaje_ = std::string("No se pudieron cargar los datos: ") + e.what();
    mensaje_es_error_ = true;
  }
}

std::vector<int> App::ids_seleccionados() const {
  std::vector<int> ids;
  if (!datos_) return ids;
  for (std::size_t i = 0; i < datos_->poligonos.size(); ++i)
    if (cfg_.poligonos[i]) ids.push_back(datos_->poligonos[i].id);
  return ids;
}

void App::lanzar_plan() {
  const auto ids = ids_seleccionados();
  if (ids.empty()) {
    mensaje_ = "Selecciona al menos un polígono.";
    mensaje_es_error_ = true;
    return;
  }
  t_plan_.lanzar([datos = datos_, w = w_, ids, cfg = cfg_](Progreso& pr) {
    const auto t0 = std::chrono::steady_clock::now();
    pr.etapa("Curvas de supervivencia (Monte Carlo)");
    const auto curvas = calcular_curvas(*datos, ids, {cfg.alfa}, cfg.p);
    if (pr.cancelar) throw std::runtime_error("cálculo cancelado");

    pr.etapa("Algoritmo memético");
    ParametrosEspacial pe = cfg.pe;
    pe.semilla = cfg.p.semilla;
    pe.hilos = cfg.p.hilos;
    pe.cancelar = &pr.cancelar;
    pe.avance = [&pr](std::size_t hechas, std::size_t total) {
      pr.total = total;
      pr.hechas = hechas;
    };
    const memetico::Mosaico m(pe.filas, pe.columnas);
    ResultadoPlan r{datos, w, m, ejecutar_plan(*datos, curvas, cfg.alfa, cfg.B, cfg.p.theta, m, *w, pe),
                    cfg.alfa, cfg.B, pe.corridas, 0, {}};

    for (const auto& c : r.plan.compras) {
      int g = -1;
      for (std::size_t k = 0; k < r.plan.espacial.size() && g < 0; ++k)
        for (int id : r.plan.espacial[k].poligonos)
          if (id == c.poligono->id) g = static_cast<int>(k);
      r.grupo_de.push_back(g);
    }
    r.segundos = std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count();
    return r;
  });
}

void App::lanzar_frontera() {
  const auto ids = ids_seleccionados();
  std::vector<double> alfas;
  try {
    alfas = leer_alfas(cfg_.alfas);
  } catch (const std::exception& e) {
    mensaje_ = std::string("Lista de α inválida: ") + e.what();
    mensaje_es_error_ = true;
    return;
  }
  if (ids.empty()) return;
  t_frontera_.lanzar([datos = datos_, ids, alfas, cfg = cfg_](Progreso& pr) {
    pr.etapa("Curvas de supervivencia (Monte Carlo)");
    const auto curvas = calcular_curvas(*datos, ids, alfas, cfg.p);
    pr.etapa("Presupuesto mínimo por polígono");
    pr.total = alfas.size() * curvas.size();
    ResultadoFrontera r{datos, alfas, {}};
    for (std::size_t a = 0; a < alfas.size(); ++a)
      for (const auto& cp : curvas) {
        if (pr.cancelar) throw std::runtime_error("cálculo cancelado");
        r.res.push_back(frontera_poligono(*datos, cp, a, alfas[a], cfg.p.theta));
        ++pr.hechas;
      }
    return r;
  });
}

void App::lanzar_barrido() {
  const auto ids = ids_seleccionados();
  std::vector<double> alfas;
  try {
    alfas = leer_alfas(cfg_.alfas);
    if (cfg_.B_max < cfg_.B_min || cfg_.B_paso <= 0) throw std::runtime_error("revisa B mín, B máx y el paso");
  } catch (const std::exception& e) {
    mensaje_ = std::string("Rejilla inválida: ") + e.what();
    mensaje_es_error_ = true;
    return;
  }
  if (ids.empty()) return;
  t_barrido_.lanzar([datos = datos_, ids, alfas, cfg = cfg_](Progreso& pr) {
    ResultadoBarrido r{datos, alfas, {}, {}};
    for (double b = cfg.B_min; b <= cfg.B_max + 1e-9; b += cfg.B_paso) r.Bs.push_back(b);
    pr.etapa("Curvas de supervivencia (Monte Carlo)");
    const auto curvas = calcular_curvas(*datos, ids, alfas, cfg.p);
    pr.etapa("Factibilidad en la rejilla");
    pr.total = alfas.size() * r.Bs.size();
    for (std::size_t a = 0; a < alfas.size(); ++a)
      for (double b : r.Bs) {
        if (pr.cancelar) throw std::runtime_error("cálculo cancelado");
        for (const auto& cp : curvas) r.res.push_back(resolver_poligono(*datos, cp, a, alfas[a], b, cfg.p.theta));
        ++pr.hechas;
      }
    return r;
  });
}

void App::recoger() {
  if (auto r = t_plan_.recoger()) {
    plan_ = std::move(*r);
    compra_sel_ = -1;
    mosaico_sel_ = 0;
    orden_compras_.clear();
    bool cancelado = false;
    for (const auto& g : plan_->plan.espacial) cancelado = cancelado || g.cancelado;
    mensaje_ = cancelado ? "Plan cancelado: los mosaicos muestran lo mejor encontrado hasta ese momento."
                         : "Plan listo en " + std::to_string(static_cast<int>(plan_->segundos + 0.5)) + " s.";
    mensaje_es_error_ = cancelado;
  }
  if (auto r = t_frontera_.recoger()) frontera_ = std::move(*r);
  if (auto r = t_barrido_.recoger()) barrido_ = std::move(*r);
  for (auto e : {t_plan_.recoger_error(), t_frontera_.recoger_error(), t_barrido_.recoger_error()}) {
    if (!e) continue;
    mensaje_ = "Error: " + *e;
    mensaje_es_error_ = true;
  }
}

void App::guardar_plan() {
  if (!plan_) return;
  const auto& r = *plan_;
  const fs::path dir = fs::path(cfg_.dir_res) / "plan";
  try {
    for (Formato f : {Formato::Tabla, Formato::Csv, Formato::Json}) {
      const std::string ext = f == Formato::Tabla ? ".txt" : f == Formato::Csv ? ".csv" : ".json";
      escribir_archivo(dir / ("compra" + ext), [&](std::ostream& o) { escribir_compra(o, *r.datos, r.plan.compras, f); });
      escribir_archivo(dir / ("espacial" + ext), [&](std::ostream& o) {
        escribir_espacial(o, *r.datos, r.plan.espacial, r.mosaico, r.corridas, f);
      });
    }
    escribir_archivo(dir / "mosaicos.csv",
                     [&](std::ostream& o) { escribir_mosaicos_csv(o, *r.datos, r.plan.espacial, r.mosaico); });
    mensaje_ = "Resultados guardados en " + dir.string() + "/ (txt, csv y json).";
    mensaje_es_error_ = false;
  } catch (const std::exception& e) {
    mensaje_ = std::string("No se pudo guardar: ") + e.what();
    mensaje_es_error_ = true;
  }
}

void App::layout_inicial(ImGuiID dock) {
  ImGui::DockBuilderRemoveNode(dock);
  ImGui::DockBuilderAddNode(dock, ImGuiDockNodeFlags_DockSpace);
  ImGui::DockBuilderSetNodeSize(dock, ImGui::GetMainViewport()->WorkSize);
  ImGuiID izq = 0, der = 0;
  ImGui::DockBuilderSplitNode(dock, ImGuiDir_Left, 0.26f, &izq, &der);
  ImGui::DockBuilderDockWindow(kConfig, izq);
  for (const char* v : {kMosaico, kCompra, kConvergencia, kCompetencia, kFrontera, kBarrido})
    ImGui::DockBuilderDockWindow(v, der);
  ImGui::DockBuilderFinish(dock);
}

void App::cuadro() {
  recoger();
  const ImGuiID dock = ImGui::DockSpaceOverViewport();
  if (!layout_hecho_) {
    layout_inicial(dock);
    layout_hecho_ = true;
  }
  vista_config();
  vista_compra();
  vista_convergencia();
  vista_competencia();
  vista_frontera();
  vista_barrido();
  vista_mosaico();  // al final: queda como pestaña activa al abrir
}

}  // namespace refor::gui
