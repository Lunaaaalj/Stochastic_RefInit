#include <imgui.h>
#include <imgui_internal.h>  // BeginViewportSideBar
#include <imgui_stdlib.h>

#include <algorithm>
#include <cmath>
#include <format>

#include "app.hpp"

namespace refor::gui {

namespace {

void titulo(const char* t) {
  ImGui::Spacing();
  ImGui::PushFont(estilo::fuente_titulo, 0.0f);
  ImGui::PushStyleColor(ImGuiCol_Text, estilo::v4(estilo::tinta_2));
  ImGui::SeparatorText(t);
  ImGui::PopStyleColor();
  ImGui::PopFont();
}

void ayuda(const char* texto) {
  ImGui::SameLine();
  ImGui::TextDisabled("(?)");
  if (ImGui::BeginItemTooltip()) {
    ImGui::PushTextWrapPos(ImGui::GetFontSize() * 28);
    ImGui::TextUnformatted(texto);
    ImGui::PopTextWrapPos();
    ImGui::EndTooltip();
  }
}

bool entero(const char* etiqueta, int& v, int min, int max, int paso = 1) {
  const bool cambio = ImGui::InputInt(etiqueta, &v, paso, paso * 10);
  v = std::clamp(v, min, max);
  return cambio;
}

}  // namespace

void App::barra_estado() {
  ImGuiViewport* vp = ImGui::GetMainViewport();
  const float alto = ImGui::GetFrameHeight() + ImGui::GetFontSize() * 0.5f;
  ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, ImVec2(ImGui::GetFontSize() * 0.8f, ImGui::GetFontSize() * 0.25f));
  ImGui::PushStyleColor(ImGuiCol_WindowBg, estilo::v4(estilo::plano));
  const bool abierta = ImGui::BeginViewportSideBar("##estado", vp, ImGuiDir_Down, alto,
                                                   ImGuiWindowFlags_NoScrollbar | ImGuiWindowFlags_NoSavedSettings |
                                                       ImGuiWindowFlags_NoNav);
  ImGui::PopStyleColor();
  ImGui::PopStyleVar();
  if (!abierta) return ImGui::End();

  // A la derecha, de afuera hacia adentro: cuadros por segundo y el aviso de
  // plan desactualizado. Se reserva su ancho para que el mensaje no los tape.
  const std::string fps = mostrar_fps_ ? std::format("{:.0f} cps", ImGui::GetIO().Framerate) : "";
  float derecha = 0;
  if (!fps.empty()) derecha += ImGui::CalcTextSize(fps.c_str()).x + ImGui::GetFontSize();
  if (!cambios_.empty()) derecha += ImGui::CalcTextSize("desactualizado").x + ImGui::GetFontSize() * 2;
  const float x_derecha = ImGui::GetContentRegionAvail().x - derecha;

  const Progreso* pr = nullptr;
  double seg = 0;
  if (t_plan_.ocupado()) pr = t_plan_.progreso(), seg = t_plan_.segundos();
  else if (t_frontera_.ocupado()) pr = t_frontera_.progreso(), seg = t_frontera_.segundos();
  else if (t_barrido_.ocupado()) pr = t_barrido_.progreso(), seg = t_barrido_.segundos();
  else if (t_exacto_.ocupado()) pr = t_exacto_.progreso(), seg = t_exacto_.segundos();

  ImGui::AlignTextToFramePadding();
  if (pr) {
    if (anim::boton_chico("Cancelar")) cancelar_todo();
    ImGui::SetItemTooltip("Esc");
    ImGui::SameLine();
    const std::size_t total = pr->total, hechas = pr->hechas;
    const float ancho_barra = ImGui::GetFontSize() * 12;
    ImGui::PushStyleVarY(ImGuiStyleVar_FramePadding, 1.0f);
    if (total > 0) {
      // La barra avanza suave entre avisos; si un cálculo nuevo arranca, vuelve sin animar.
      const float f = static_cast<float>(hechas) / static_cast<float>(total);
      float* mostrado = ImGui::GetStateStorage()->GetFloatRef(ImGui::GetID("avance"), 0.0f);
      *mostrado = f < *mostrado ? f : anim::suavizar(*mostrado, f, 10);
      ImGui::ProgressBar(*mostrado, ImVec2(ancho_barra, 0), std::format("{} de {}", hechas, total).c_str());
    } else {
      ImGui::ProgressBar(-1.0f * static_cast<float>(ImGui::GetTime()), ImVec2(ancho_barra, 0), "calculando…");
    }
    ImGui::PopStyleVar();
    ImGui::SameLine();
    ImGui::TextDisabled("%.1f s", seg);
    ImGui::SameLine();
    ImGui::PushClipRect(ImGui::GetCursorScreenPos(),
                        ImVec2(ImGui::GetWindowPos().x + x_derecha, ImGui::GetWindowPos().y + alto), true);
    ImGui::TextUnformatted(pr->etapa().c_str());
    ImGui::PopClipRect();
  } else if (!mensaje_.empty()) {
    ImGui::PushClipRect(ImGui::GetCursorScreenPos(),
                        ImVec2(ImGui::GetWindowPos().x + x_derecha, ImGui::GetWindowPos().y + alto), true);
    ImGui::PushStyleColor(ImGuiCol_Text, estilo::v4(mensaje_es_error_ ? estilo::aviso : estilo::tinta_2));
    ImGui::TextUnformatted(mensaje_.c_str());
    ImGui::PopStyleColor();
    ImGui::PopClipRect();
    if (ImGui::IsItemHovered()) {
      ImGui::BeginTooltip();
      ImGui::PushTextWrapPos(ImGui::GetFontSize() * 36);
      ImGui::TextUnformatted(mensaje_.c_str());
      ImGui::PopTextWrapPos();
      ImGui::EndTooltip();
    }
  }

  if (derecha > 0) {
    ImGui::SameLine(x_derecha + ImGui::GetStyle().WindowPadding.x);
    chip_desactualizado();
    if (!fps.empty()) {
      if (!cambios_.empty()) ImGui::SameLine();
      ImGui::TextDisabled("%s", fps.c_str());
    }
  }
  ImGui::End();
}

void App::vista_config() {
  if (!ImGui::Begin(kConfig)) return ImGui::End();

  // Acciones arriba: siempre a la vista, sin desplazar. Si la configuración
  // cambió desde el último plan, el botón late unos segundos para avisarlo.
  ImGui::BeginDisabled(!datos_ || ocupado());
  const float medio_b = (ImGui::GetContentRegionAvail().x - ImGui::GetStyle().ItemSpacing.x) / 2;
  float pulso = 0;
  if (!cambios_.empty() && !ocupado()) {
    const float t = static_cast<float>(ImGui::GetTime() - t_cambios_);
    if (t < 3.6f) {
      pulso = (0.5f - 0.5f * std::cos(t * 3.4907f)) * (1 - t / 3.6f);  // dos latidos que se apagan
      anim::seguir();
    }
  }
  if (anim::boton_colores("Ejecutar plan", ImVec2(medio_b, ImGui::GetFrameHeight() * 1.4f),
                          anim::mezcla(estilo::primario, estilo::rgb(0x6da7ec), pulso), estilo::primario_sobre,
                          estilo::primario_activo))
    lanzar_plan();
  ImGui::EndDisabled();
  ImGui::SetItemTooltip("%s", kTeclaPlan);
  ImGui::SameLine();
  ImGui::BeginDisabled(!plan_ || ocupado());
  if (anim::boton("Guardar resultados", ImVec2(medio_b, ImGui::GetFrameHeight() * 1.4f))) guardar_plan();
  ImGui::EndDisabled();
  ImGui::SetItemTooltip("En %s/plan/ (txt, csv y json).", cfg_.dir_res.c_str());
  if (!cambios_.empty()) {
    ImGui::PushStyleColor(ImGuiCol_Text, estilo::v4(estilo::aviso));
    ImGui::TextWrapped("Cambió desde el último plan: %s.", cambios_.c_str());
    ImGui::PopStyleColor();
  }

  ImGui::PushItemWidth(-ImGui::GetFontSize() * 9);

  titulo("Datos");
  ImGui::InputText("Directorio", &cfg_.datos_dir);
  ImGui::BeginDisabled(ocupado());
  if (anim::boton("Recargar datos")) cargar();
  ImGui::EndDisabled();

  if (datos_) {
    titulo("Polígonos");
    int sel = static_cast<int>(std::count(cfg_.poligonos.begin(), cfg_.poligonos.end(), 1));
    ImGui::Text("%d de %zu seleccionados", sel, cfg_.poligonos.size());
    ImGui::SameLine();
    if (anim::boton_chico("Todos")) std::fill(cfg_.poligonos.begin(), cfg_.poligonos.end(), 1);
    ImGui::SameLine();
    if (anim::boton_chico("Ninguno")) std::fill(cfg_.poligonos.begin(), cfg_.poligonos.end(), 0);
    const float alto = ImGui::GetTextLineHeightWithSpacing() * 5.5f;
    // Tantas columnas como quepan, para que ningún número se corte.
    const int columnas = std::clamp(static_cast<int>(ImGui::GetContentRegionAvail().x / (ImGui::GetFontSize() * 4.2f)), 2, 10);
    if (ImGui::BeginTable("poligonos", columnas, ImGuiTableFlags_ScrollY | ImGuiTableFlags_BordersOuter | ImGuiTableFlags_SizingStretchSame,
                          ImVec2(0, alto))) {
      for (std::size_t i = 0; i < datos_->poligonos.size(); ++i) {
        ImGui::TableNextColumn();
        const auto& p = datos_->poligonos[i];
        bool b = cfg_.poligonos[i];
        if (anim::casilla(std::to_string(p.id).c_str(), &b)) cfg_.poligonos[i] = b;
        if (const int e = etiqueta_mapa(p.id); e >= 0)
          ImGui::SetItemTooltip("Polígono %d: %.2f ha (número %d en el mapa)", p.id, p.area, e);
        else
          ImGui::SetItemTooltip("Polígono %d: %.2f ha", p.id, p.area);
      }
      ImGui::EndTable();
    }
  }

  titulo("Compra");
  ImGui::InputDouble("α (riesgo)", &cfg_.alfa, 0.01, 0.05, "%.3f");
  cfg_.alfa = std::clamp(cfg_.alfa, 0.001, 0.5);
  ayuda("Probabilidad admisible de no alcanzar la meta de una especie.");
  ImGui::InputDouble("B ($/ha)", &cfg_.B, 250, 1000, "%.0f");
  cfg_.B = std::max(cfg_.B, 1.0);
  ImGui::InputDouble("θ (logística)", &cfg_.p.theta, 0.01, 0.05, "%.2f");
  cfg_.p.theta = std::clamp(cfg_.p.theta, 0.0, 10.0);
  ImGui::InputDouble("δ (desviación)", &cfg_.p.delta, 0.01, 0.05, "%.2f");
  cfg_.p.delta = std::clamp(cfg_.p.delta, 0.0, 1.0);
  ayuda("Desviación máxima de la meta por especie respecto al plan de reforestación.");
  int metodo = cfg_.p.metodo == Metodo::Exacto;
  ImGui::Combo("Método x*(n)", &metodo, "Monte Carlo\0Exacto (binomial)\0");
  cfg_.p.metodo = metodo ? Metodo::Exacto : Metodo::MonteCarlo;
  ImGui::BeginDisabled(metodo == 1);
  ImGui::InputScalar("Escenarios K", ImGuiDataType_S64, &cfg_.p.K);
  cfg_.p.K = std::clamp(cfg_.p.K, 100L, 1'000'000L);
  ImGui::EndDisabled();
  ImGui::InputScalar("Semilla", ImGuiDataType_U64, &cfg_.p.semilla);
  int hilos = static_cast<int>(cfg_.p.hilos);
  entero("Hilos (0: auto)", hilos, 0, 64);
  cfg_.p.hilos = static_cast<unsigned>(hilos);

  // Lo que se ajusta con menos frecuencia va en secciones plegables, para que
  // la compra quede a la vista sin desplazar.
  ImGui::Spacing();
  if (estilo::seccion("Mosaico y memético", ImGuiTreeNodeFlags_DefaultOpen)) {
    entero("Filas", cfg_.pe.filas, 3, 30);
    entero("Columnas", cfg_.pe.columnas, 3, 30);
    ImGui::TextDisabled("%d posiciones al tresbolillo, borde periódico", cfg_.pe.filas * cfg_.pe.columnas);
    entero("Corridas", cfg_.pe.corridas, 1, 200);
    ayuda("Corridas independientes del memético por mosaico; se reporta la mejor, la media y la desviación.");
    entero("Población P", cfg_.pe.memetico.poblacion, 2, 200);
    entero("Generaciones", cfg_.pe.memetico.generaciones_max, 1, 100'000, 50);
    entero("Sin mejora", cfg_.pe.memetico.generaciones_sin_mejora_max, 1, 100'000, 10);
    ayuda("Generaciones seguidas sin mejorar la mejor solución para detener una corrida.");
    entero("Iter. tabú", cfg_.pe.memetico.tabu.iteraciones_sin_mejora, 1, 100'000, 50);
    ayuda("Iteraciones sin mejora para detener la búsqueda tabú de cada hijo.");
  }

  if (estilo::seccion("Modelo exacto")) {
    ImGui::InputDouble("Límite (s)", &cfg_.ple.limite_segundos, 10, 60, "%.0f");
    cfg_.ple.limite_segundos = std::clamp(cfg_.ple.limite_segundos, 1.0, 86'400.0);
    ayuda("Tiempo máximo del modelo entero por mosaico. Si se agota, queda la mejor solución y la cota inferior "
          "probada, que acota cuánto puede mejorar el memético.");
    double brecha_pct = 100 * cfg_.ple.brecha_relativa;
    ImGui::InputDouble("Brecha (%)", &brecha_pct, 0.5, 1, "%.1f");
    cfg_.ple.brecha_relativa = std::clamp(brecha_pct, 0.0, 100.0) / 100;
    ayuda("El solver para en cuanto prueba que su solución está a lo más a esta distancia del óptimo; 0 exige "
          "probar el óptimo.");
    ImGui::TextDisabled("Se resuelve desde la pestaña «%s».", kComparacion);
  }

  if (estilo::seccion("Frontera y barrido")) {
    ImGui::InputText("Valores de α", &cfg_.alfas);
    ImGui::InputDouble("B mín", &cfg_.B_min, 250, 1000, "%.0f");
    ImGui::InputDouble("B máx", &cfg_.B_max, 250, 1000, "%.0f");
    ImGui::InputDouble("Paso de B", &cfg_.B_paso, 50, 250, "%.0f");
    cfg_.B_paso = std::max(cfg_.B_paso, 1.0);
    ImGui::BeginDisabled(!datos_ || ocupado());
    const float medio = (ImGui::GetContentRegionAvail().x - ImGui::GetStyle().ItemSpacing.x) / 2;
    if (anim::boton("Calcular frontera", ImVec2(medio, 0))) lanzar_frontera();
    ImGui::SameLine();
    if (anim::boton("Calcular barrido", ImVec2(medio, 0))) lanzar_barrido();
    ImGui::EndDisabled();
  }

  ImGui::PopItemWidth();
  ImGui::End();
}

}  // namespace refor::gui
