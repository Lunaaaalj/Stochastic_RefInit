#include "app.hpp"

#include <imgui_internal.h>  // DockBuilder

#include <algorithm>
#include <cmath>
#include <filesystem>
#include <format>
#include <fstream>
#include <sstream>
#include <stdexcept>
#include <utility>

#include "asignacion_exacta/salida_ple.hpp"
#include "rutas.hpp"
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
  if (!out) throw std::runtime_error("no se pudo escribir " + texto_utf8(ruta));
  escribir(out);
}

}  // namespace

App::App(std::string datos_dir) {
  cfg_.datos_dir = std::move(datos_dir);
  cfg_.dir_res = texto_utf8(resultados_por_defecto(true));
  cargar();
}

void App::usar_datos(std::string dir) {
  std::string antes = std::exchange(cfg_.datos_dir, std::move(dir));
  cargar();
  if (mensaje_es_error_ && datos_) {
    mensaje_ += " Se conservan los datos de " + antes + ".";
    cfg_.datos_dir = std::move(antes);
  }
}

void App::soltar(const std::vector<std::string>& rutas) {
  if (rutas.empty()) return;
  if (ocupado()) {
    mensaje_ = "Espera a que termine el cálculo para cambiar los datos.";
    mensaje_es_error_ = true;
    return;
  }
  // Vale soltar la carpeta o cualquiera de sus CSV.
  fs::path dir = ruta_utf8(rutas.front());
  std::error_code ec;
  if (!fs::is_directory(dir, ec)) dir = dir.parent_path();
  usar_datos(texto_utf8(dir));
}

void App::cargar() {
  try {
    auto d = std::make_shared<const Datos>(cargar_datos(ruta_utf8(cfg_.datos_dir)));
    auto w = std::make_shared<const memetico::Competencia>(*d, ruta_utf8(cfg_.datos_dir) / "competencia.csv");
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
    return;
  }
  // El mapa es opcional: si falla, el modelo sigue funcionando sin él.
  try {
    mapa_ = cargar_mapa(cfg_.datos_dir);
    mapa_de_id_.clear();
    for (std::size_t k = 0; k < mapa_.size(); ++k)
      if (mapa_[k].id >= 0) mapa_de_id_[mapa_[k].id] = static_cast<int>(k);
    mapa_sel_ = -1;
    mapa_centro_ = mapa_centro_obj_ = ImVec2(-1, -1);
    mapa_zoom_ = mapa_zoom_obj_ = 1;
    mapa_anim_.clear();
    sembrar_mapa();
  } catch (const std::exception& e) {
    mapa_.clear();
    mapa_de_id_.clear();
    mensaje_ += std::string(" Mapa no disponible: ") + e.what();
  }
}

int App::etiqueta_mapa(int id) const {
  const auto it = mapa_de_id_.find(id);
  return it == mapa_de_id_.end() ? -1 : mapa_[it->second].etiqueta;
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
                    cfg.alfa, cfg.B, pe.corridas, 0, {}, cfg};

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

void App::lanzar_exacto(int mosaico) {
  if (!plan_) return;
  const auto& grupos = plan_->plan.espacial;
  // Solo la composición y el arranque de cada mosaico: el plan puede
  // reemplazarse mientras el solver corre.
  std::vector<std::pair<int, std::pair<std::vector<int>, memetico::Individuo>>> pendientes;
  for (int k = 0; k < static_cast<int>(grupos.size()); ++k)
    if (mosaico < 0 ? !exacto_[k] : k == mosaico) pendientes.push_back({k, {grupos[k].m_s, grupos[k].mejor}});
  if (pendientes.empty()) return;

  auto viva = std::make_shared<TrazaViva>();
  traza_viva_ = viva;
  t_exacto_.lanzar([w = plan_->w, m = plan_->mosaico, pendientes, pp = cfg_.ple, viva](Progreso& pr) {
    pr.total = pendientes.size();
    ResultadoExacto r;
    for (const auto& [k, g] : pendientes) {
      if (pr.cancelar) break;
      {
        std::lock_guard lock(viva->mtx);
        viva->mosaico = k;
        viva->puntos.clear();
      }
      const std::string etapa = std::format("Modelo entero, mosaico {}", k + 1);
      pr.etapa(etapa);
      auto p = pp;
      p.cancelar = &pr.cancelar;
      p.avance = [&](const asignacion_exacta::PuntoTraza& pt) {
        {
          std::lock_guard lock(viva->mtx);
          viva->puntos.push_back(pt);
        }
        if (std::isfinite(pt.primal) && std::isfinite(pt.dual))
          pr.etapa(std::format("{}: el óptimo está entre {:.2f} y {:.2f}", etapa, pt.dual, pt.primal));
      };
      r.res.emplace_back(k, asignacion_exacta::resolver_ple(g.first, m, *w, p, &g.second));
      ++pr.hechas;
    }
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
    t_resultado_ = ImGui::GetTime();
    exacto_.assign(plan_->plan.espacial.size(), std::nullopt);
    compra_sel_ = -1;
    mosaico_sel_ = 0;
    orden_compras_.clear();
    sembrar_mapa();
    bool cancelado = false;
    for (const auto& g : plan_->plan.espacial) cancelado = cancelado || g.cancelado;
    mensaje_ = cancelado ? "Plan cancelado: los mosaicos muestran lo mejor encontrado hasta ese momento."
                         : "Plan listo en " + std::to_string(static_cast<int>(plan_->segundos + 0.5)) + " s.";
    mensaje_es_error_ = cancelado;
  }
  if (auto r = t_exacto_.recoger()) {
    t_resultado_ = ImGui::GetTime();
    bool cancelado = r->res.empty();
    for (auto& [k, res] : r->res) {
      cancelado = cancelado || res.cancelado;
      if (k < static_cast<int>(exacto_.size())) exacto_[k] = std::move(res);
    }
    mensaje_ = cancelado ? "Modelo entero cancelado: se muestra lo mejor que encontró y la cota que alcanzó a probar."
                         : std::format("Modelo entero listo: {} mosaico(s) en {:.0f} s.", r->res.size(),
                                       t_exacto_.segundos());
    mensaje_es_error_ = cancelado;
  }
  if (auto r = t_frontera_.recoger()) frontera_ = std::move(*r), t_resultado_ = ImGui::GetTime();
  if (auto r = t_barrido_.recoger()) barrido_ = std::move(*r), t_resultado_ = ImGui::GetTime();
  for (auto e : {t_plan_.recoger_error(), t_frontera_.recoger_error(), t_barrido_.recoger_error(),
                 t_exacto_.recoger_error()}) {
    if (!e) continue;
    mensaje_ = "Error: " + *e;
    mensaje_es_error_ = true;
  }
}

void App::guardar_plan() {
  if (!plan_) return;
  const auto& r = *plan_;
  const fs::path dir = ruta_utf8(cfg_.dir_res) / "plan";
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
    // La comparación con el modelo entero, solo si se resolvieron todos los mosaicos.
    const auto resueltos = std::count_if(exacto_.begin(), exacto_.end(), [](const auto& e) { return e.has_value(); });
    const bool exacto_completo = !exacto_.empty() && resueltos == static_cast<std::ptrdiff_t>(exacto_.size());
    if (exacto_completo) {
      std::vector<asignacion_exacta::ResultadoPLE> ex;
      for (const auto& e : exacto_) ex.push_back(*e);
      for (Formato f : {Formato::Tabla, Formato::Csv, Formato::Json}) {
        const std::string ext = f == Formato::Tabla ? ".txt" : f == Formato::Csv ? ".csv" : ".json";
        escribir_archivo(dir / ("exacto" + ext), [&](std::ostream& o) {
          asignacion_exacta::escribir_exacto(o, *r.datos, r.plan.espacial, ex, r.mosaico, f);
        });
      }
    }
    mensaje_ = "Resultados guardados en " + texto_utf8(dir) + " (txt, csv y json)";
    if (exacto_completo)
      mensaje_ += ", con la comparación del modelo entero.";
    else if (resueltos > 0)
      mensaje_ += "; la comparación con el modelo entero se guarda cuando estén resueltos todos los mosaicos.";
    else
      mensaje_ += ".";
    mensaje_es_error_ = false;
  } catch (const std::exception& e) {
    mensaje_ = std::string("No se pudo guardar: ") + e.what();
    mensaje_es_error_ = true;
  }
}

void App::layout_inicial(ImGuiID dock) {
  // Configuración a la izquierda; a la derecha, arriba lo espacial (mapa y
  // mosaicos) y abajo las tablas y gráficas. Así lo que se elige en Compra
  // se ve de inmediato en el mapa o el mosaico de arriba.
  ImGui::DockBuilderRemoveNode(dock);
  ImGui::DockBuilderAddNode(dock, ImGuiDockNodeFlags_DockSpace);
  ImGui::DockBuilderSetNodeSize(dock, ImGui::GetMainViewport()->WorkSize);
  ImGuiID izq = 0, der = 0, arriba = 0, abajo = 0;
  ImGui::DockBuilderSplitNode(dock, ImGuiDir_Left, 0.28f, &izq, &der);
  ImGui::DockBuilderSplitNode(der, ImGuiDir_Up, 0.6f, &arriba, &abajo);
  ImGui::DockBuilderDockWindow(kConfig, izq);
  for (const char* v : {kMapa, kMosaico, kComparacion}) ImGui::DockBuilderDockWindow(v, arriba);
  for (const char* v : {kCompra, kConvergencia, kCompetencia, kFrontera, kBarrido}) ImGui::DockBuilderDockWindow(v, abajo);
  ImGui::DockBuilderFinish(dock);
}

void App::cancelar_todo() {
  t_plan_.cancelar();
  t_frontera_.cancelar();
  t_barrido_.cancelar();
  t_exacto_.cancelar();
}

std::string App::cambios_plan() const {
  if (!plan_) return {};
  const Config& a = plan_->cfg;
  const Config& b = cfg_;
  std::vector<std::string> c;
  if (plan_->datos != datos_) c.push_back("datos recargados");
  else if (a.poligonos != b.poligonos) c.push_back("selección de polígonos");
  if (a.alfa != b.alfa) c.push_back(std::format("α {:.3f} → {:.3f}", a.alfa, b.alfa));
  if (a.B != b.B) c.push_back(std::format("B ${:.0f} → ${:.0f}", a.B, b.B));
  if (a.p.theta != b.p.theta) c.push_back(std::format("θ {:.2f} → {:.2f}", a.p.theta, b.p.theta));
  if (a.p.delta != b.p.delta) c.push_back(std::format("δ {:.2f} → {:.2f}", a.p.delta, b.p.delta));
  if (a.p.metodo != b.p.metodo || (b.p.metodo == Metodo::MonteCarlo && a.p.K != b.p.K)) c.push_back("método x*(n)");
  if (a.p.semilla != b.p.semilla) c.push_back("semilla");
  if (a.pe.filas != b.pe.filas || a.pe.columnas != b.pe.columnas) c.push_back("tamaño del mosaico");
  const auto& ma = a.pe.memetico;
  const auto& mb = b.pe.memetico;
  if (a.pe.corridas != b.pe.corridas || ma.poblacion != mb.poblacion || ma.generaciones_max != mb.generaciones_max ||
      ma.generaciones_sin_mejora_max != mb.generaciones_sin_mejora_max ||
      ma.tabu.iteraciones_sin_mejora != mb.tabu.iteraciones_sin_mejora)
    c.push_back("parámetros del memético");
  std::string r;
  for (const auto& s : c) r += (r.empty() ? "" : ", ") + s;
  return r;
}

void App::chip_desactualizado() {
  if (cambios_.empty()) return;
  estilo::chip("desactualizado", estilo::aviso);
  ImGui::SetItemTooltip("La configuración cambió desde el último plan (%s). Ejecútalo de nuevo para verla reflejada.",
                        cambios_.c_str());
}

void App::atajos() {
  // Ctrl es ⌘ en macOS (io.ConfigMacOSXBehaviors). RouteGlobal: funcionan con
  // el foco en cualquier ventana, pero ceden ante un campo de texto activo.
  constexpr ImGuiInputFlags global = ImGuiInputFlags_RouteGlobal;
  if (ImGui::Shortcut(ImGuiMod_Ctrl | ImGuiKey_Enter, global) || ImGui::Shortcut(ImGuiMod_Ctrl | ImGuiKey_KeypadEnter, global))
    if (datos_ && !ocupado()) lanzar_plan();
  if (ImGui::Shortcut(ImGuiMod_Ctrl | ImGuiKey_S, global) && plan_ && !ocupado()) guardar_plan();
  if (ocupado() && ImGui::Shortcut(ImGuiKey_Escape, global)) cancelar_todo();
}

void App::menu_principal() {
  if (!ImGui::BeginMainMenuBar()) return;
  const bool libre = datos_ && !ocupado();
  if (ImGui::BeginMenu("Archivo")) {
    if (ImGui::MenuItem("Recargar datos", nullptr, false, !ocupado())) cargar();
    if (ImGui::MenuItem("Guardar resultados", kTeclaGuardar, false, plan_ && !ocupado())) guardar_plan();
    ImGui::Separator();
    if (ImGui::MenuItem("Salir", kTeclaSalir)) salir_ = true;
    ImGui::EndMenu();
  }
  if (ImGui::BeginMenu("Ejecutar")) {
    if (ImGui::MenuItem("Plan", kTeclaPlan, false, libre)) lanzar_plan();
    if (ImGui::MenuItem("Frontera B*(α)", nullptr, false, libre)) lanzar_frontera();
    if (ImGui::MenuItem("Barrido α × B", nullptr, false, libre)) lanzar_barrido();
    const bool pendientes = std::count(exacto_.begin(), exacto_.end(), std::nullopt) > 0;
    if (ImGui::MenuItem("Resolver mosaicos pendientes", nullptr, false, libre && plan_ && pendientes)) lanzar_exacto(-1);
    ImGui::Separator();
    if (ImGui::MenuItem("Cancelar", "Esc", false, ocupado())) cancelar_todo();
    ImGui::EndMenu();
  }
  if (ImGui::BeginMenu("Ver")) {
    if (ImGui::MenuItem("Restablecer acomodo")) layout_hecho_ = false;
    ImGui::MenuItem("Cuadros por segundo", nullptr, &mostrar_fps_);
    ImGui::EndMenu();
  }
  ImGui::EndMainMenuBar();
}

void App::velo_resultados() {
  // Un velo del color de la ventana sobre cada vista visible que se desvanece
  // en 300 ms: el resultado nuevo aparece en vez de saltar. Se dibuja al
  // final, encima, para no tocar las vistas ni sus retornos tempranos.
  if (t_resultado_ < 0) return;
  const float t = static_cast<float>(ImGui::GetTime() - t_resultado_) / 0.3f;
  if (t >= 1) return;
  anim::seguir();
  const float velo = 1 - t * t * (3 - 2 * t);  // smoothstep, de 1 a 0
  for (const char* v : {kCompra, kMosaico, kConvergencia, kFrontera, kBarrido, kComparacion, kMapa}) {
    ImGuiWindow* w = ImGui::FindWindowByName(v);
    if (!w || !w->Active || w->SkipItems) continue;  // cerrada, plegada o pestaña oculta
    ImGui::GetForegroundDrawList(w->Viewport)
        ->AddRectFilled(w->InnerRect.Min, w->InnerRect.Max, estilo::con_alfa(estilo::superficie, velo));
  }
}

void App::cuadro() {
  anim::nuevo_cuadro();
  recoger();
  const std::string cambios = cambios_plan();
  if (!cambios.empty() && cambios_.empty()) t_cambios_ = ImGui::GetTime();
  cambios_ = cambios;
  atajos();
  // Menú y barra de estado antes del dock: reducen el área de trabajo que ocupa.
  menu_principal();
  barra_estado();
  const ImGuiID dock = ImGui::DockSpaceOverViewport();
  if (!layout_hecho_) {
    layout_inicial(dock);
    layout_hecho_ = true;
    enfocar_ = 3;  // las ventanas existen hasta el cuadro siguiente
  }
  // El orden de dibujo es el de las pestañas en su primer cuadro.
  vista_config();
  vista_mapa();
  vista_mosaico();
  vista_comparacion();
  vista_compra();
  vista_convergencia();
  vista_competencia();
  vista_frontera();
  vista_barrido();
  // Pestañas activas al abrir o restablecer: Compra abajo y el Mapa arriba.
  // Enfocar selecciona la pestaña solo de la ventana con el foco al final del
  // cuadro, así que van en cuadros distintos.
  if (enfocar_ > 0) {
    --enfocar_;
    if (enfocar_ == 1) ImGui::SetWindowFocus(kCompra);
    if (enfocar_ == 0) ImGui::SetWindowFocus(kMapa);
  }
  velo_resultados();
  if (ocupado()) anim::seguir();  // el progreso cambia aunque nada se anime
}

}  // namespace refor::gui
