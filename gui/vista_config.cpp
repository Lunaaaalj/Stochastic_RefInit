#include <imgui.h>
#include <imgui_stdlib.h>

#include <algorithm>
#include <cmath>
#include <format>

#include "app.hpp"

namespace refor::gui {

namespace {

void titulo(const char* t) {
  ImGui::Spacing();
  ImGui::PushStyleColor(ImGuiCol_Text, estilo::v4(estilo::tinta_tenue));
  ImGui::SeparatorText(t);
  ImGui::PopStyleColor();
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

void App::barra_progreso() {
  const Progreso* pr = nullptr;
  double seg = 0;
  if (t_plan_.ocupado()) pr = t_plan_.progreso(), seg = t_plan_.segundos();
  else if (t_frontera_.ocupado()) pr = t_frontera_.progreso(), seg = t_frontera_.segundos();
  else if (t_barrido_.ocupado()) pr = t_barrido_.progreso(), seg = t_barrido_.segundos();
  else if (t_exacto_.ocupado()) pr = t_exacto_.progreso(), seg = t_exacto_.segundos();
  if (!pr) return;

  const std::size_t total = pr->total, hechas = pr->hechas;
  ImGui::TextUnformatted(pr->etapa().c_str());
  if (total > 0) {
    const float f = static_cast<float>(hechas) / static_cast<float>(total);
    ImGui::ProgressBar(f, ImVec2(-1, 0), std::format("{} de {}", hechas, total).c_str());
  } else {
    ImGui::ProgressBar(-1.0f * static_cast<float>(ImGui::GetTime()), ImVec2(-1, 0), "calculando…");
  }
  ImGui::TextDisabled("%.1f s", seg);
  ImGui::SameLine(ImGui::GetContentRegionAvail().x - ImGui::CalcTextSize("Cancelar").x -
                  ImGui::GetStyle().FramePadding.x * 2);
  if (ImGui::SmallButton("Cancelar")) {
    t_plan_.cancelar();
    t_frontera_.cancelar();
    t_barrido_.cancelar();
    t_exacto_.cancelar();
  }
}

void App::vista_config() {
  if (!ImGui::Begin(kConfig)) return ImGui::End();

  // Acciones, avance y mensajes arriba: siempre a la vista, sin desplazar.
  ImGui::BeginDisabled(!datos_ || ocupado());
  const float medio_b = (ImGui::GetContentRegionAvail().x - ImGui::GetStyle().ItemSpacing.x) / 2;
  if (ImGui::Button("Ejecutar plan", ImVec2(medio_b, ImGui::GetFrameHeight() * 1.4f))) lanzar_plan();
  ImGui::EndDisabled();
  ImGui::SameLine();
  ImGui::BeginDisabled(!plan_ || ocupado());
  if (ImGui::Button("Guardar en docs/res/plan", ImVec2(medio_b, ImGui::GetFrameHeight() * 1.4f))) guardar_plan();
  ImGui::EndDisabled();
  barra_progreso();
  if (!mensaje_.empty()) {
    ImGui::PushStyleColor(ImGuiCol_Text, estilo::v4(mensaje_es_error_ ? estilo::aviso : estilo::tinta_2));
    ImGui::TextWrapped("%s", mensaje_.c_str());
    ImGui::PopStyleColor();
  }

  ImGui::PushItemWidth(-ImGui::GetFontSize() * 9);

  titulo("Datos");
  ImGui::InputText("Directorio", &cfg_.datos_dir);
  ImGui::BeginDisabled(ocupado());
  if (ImGui::Button("Recargar datos")) cargar();
  ImGui::EndDisabled();

  if (datos_) {
    titulo("Polígonos");
    int sel = static_cast<int>(std::count(cfg_.poligonos.begin(), cfg_.poligonos.end(), 1));
    ImGui::Text("%d de %zu seleccionados", sel, cfg_.poligonos.size());
    ImGui::SameLine();
    if (ImGui::SmallButton("Todos")) std::fill(cfg_.poligonos.begin(), cfg_.poligonos.end(), 1);
    ImGui::SameLine();
    if (ImGui::SmallButton("Ninguno")) std::fill(cfg_.poligonos.begin(), cfg_.poligonos.end(), 0);
    const float alto = ImGui::GetTextLineHeightWithSpacing() * 5.5f;
    if (ImGui::BeginTable("poligonos", 5, ImGuiTableFlags_ScrollY | ImGuiTableFlags_BordersOuter, ImVec2(0, alto))) {
      for (std::size_t i = 0; i < datos_->poligonos.size(); ++i) {
        ImGui::TableNextColumn();
        const auto& p = datos_->poligonos[i];
        bool b = cfg_.poligonos[i];
        if (ImGui::Checkbox(std::to_string(p.id).c_str(), &b)) cfg_.poligonos[i] = b;
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

  titulo("Mosaico y memético");
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

  titulo("Modelo exacto");
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

  titulo("Frontera y barrido");
  ImGui::InputText("Valores de α", &cfg_.alfas);
  ImGui::InputDouble("B mín", &cfg_.B_min, 250, 1000, "%.0f");
  ImGui::InputDouble("B máx", &cfg_.B_max, 250, 1000, "%.0f");
  ImGui::InputDouble("Paso de B", &cfg_.B_paso, 50, 250, "%.0f");
  cfg_.B_paso = std::max(cfg_.B_paso, 1.0);
  ImGui::BeginDisabled(!datos_ || ocupado());
  const float medio = (ImGui::GetContentRegionAvail().x - ImGui::GetStyle().ItemSpacing.x) / 2;
  if (ImGui::Button("Calcular frontera", ImVec2(medio, 0))) lanzar_frontera();
  ImGui::SameLine();
  if (ImGui::Button("Calcular barrido", ImVec2(medio, 0))) lanzar_barrido();
  ImGui::EndDisabled();

  ImGui::PopItemWidth();
  ImGui::End();
}

}  // namespace refor::gui
