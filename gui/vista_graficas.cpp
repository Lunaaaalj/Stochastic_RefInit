#include <imgui.h>
#include <implot.h>

#include <algorithm>
#include <cmath>
#include <format>
#include <map>
#include <string>

#include "app.hpp"
#include "salida.hpp"

namespace refor::gui {

namespace {

using estilo::linea;

}  // namespace

void App::vista_convergencia() {
  if (!ImGui::Begin(kConvergencia)) return ImGui::End();
  if (!plan_ || plan_->plan.espacial.empty()) {
    ImGui::BeginDisabled(!datos_ || ocupado());
    if (estilo::estado_vacio("Ejecuta el plan para ver cómo converge cada corrida del memético.", "Ejecutar plan"))
      lanzar_plan();
    ImGui::EndDisabled();
    return ImGui::End();
  }
  const auto& grupos = plan_->plan.espacial;
  mosaico_sel_ = std::clamp(mosaico_sel_, 0, static_cast<int>(grupos.size()) - 1);
  const Espacial& g = grupos[mosaico_sel_];
  ImGui::Text("Mosaico %d: %zu corridas", mosaico_sel_ + 1, g.historias.size());
  ImGui::SameLine();
  ImGui::TextDisabled("(se elige en la pestaña Mosaico o en la tabla de Compra)");

  const auto mejor = std::min_element(g.competencias.begin(), g.competencias.end()) - g.competencias.begin();
  const float alto = ImGui::GetContentRegionAvail().y;

  // Mejor competencia por generación de cada corrida; la mejor resaltada.
  // Límites explícitos: todas las corridas comparten etiqueta y el
  // autoajuste solo vería una.
  double ymin = 1e300, ymax = -1e300;
  std::size_t gens = 1;
  for (const auto& h : g.historias) {
    if (h.empty()) continue;
    ymin = std::min(ymin, *std::min_element(h.begin(), h.end()));
    ymax = std::max(ymax, *std::max_element(h.begin(), h.end()));
    gens = std::max(gens, h.size());
  }
  const double pad = std::max(1e-3, (ymax - ymin) * 0.06);
  if (ImPlot::BeginPlot("Convergencia", ImVec2(-1, alto * 0.58f))) {
    ImPlot::SetupAxes("Generación", "Mejor competencia total");
    ImPlot::SetupAxesLimits(0, static_cast<double>(gens - 1), ymin - pad, ymax + pad, ImPlotCond_Always);
    ImPlot::SetupLegend(ImPlotLocation_NorthEast);
    for (std::size_t i = 0; i < g.historias.size(); ++i) {
      if (static_cast<std::ptrdiff_t>(i) == mejor) continue;
      const auto& h = g.historias[i];
      ImPlot::PlotLine("Otras corridas", h.data(), static_cast<int>(h.size()), 1, 0,
                       linea(estilo::rgb(0x898781, 110), 1.0f));
    }
    const auto& h = g.historias[mejor];
    ImPlot::PlotLine("Mejor corrida", h.data(), static_cast<int>(h.size()), 1, 0,
                     linea(estilo::categorico[0], 2.0f));
    ImPlot::EndPlot();
  }

  // Distribución de la competencia final entre corridas.
  if (ImPlot::BeginPlot("Competencia final de las corridas", ImVec2(-1, -1))) {
    ImPlot::SetupAxes("Competencia total", "Corridas", ImPlotAxisFlags_AutoFit, ImPlotAxisFlags_AutoFit);
    ImPlotSpec barras;
    barras.FillColor = estilo::v4(estilo::categorico[0]);
    barras.LineColor = estilo::v4(estilo::superficie);
    const double lo = *std::min_element(g.competencias.begin(), g.competencias.end());
    const double hi = *std::max_element(g.competencias.begin(), g.competencias.end());
    const ImPlotRange rango = hi > lo ? ImPlotRange(lo, hi) : ImPlotRange(lo - 0.5, hi + 0.5);
    ImPlot::PlotHistogram("Corridas", g.competencias.data(), static_cast<int>(g.competencias.size()),
                          ImPlotBin_Sturges, 1.0, rango, barras);
    const double media = g.media;
    ImPlot::PlotInfLines(std::format("Media {:.2f}", media).c_str(), &media, 1, linea(estilo::tinta_2, 1.5f));
    ImPlot::EndPlot();
  }
  ImGui::End();
}

void App::vista_competencia() {
  if (!ImGui::Begin(kCompetencia)) return ImGui::End();
  if (!datos_ || !w_) {
    estilo::estado_vacio("Carga los datos para ver la matriz de competencia W.");
    return ImGui::End();
  }
  const auto& d = *datos_;
  const int S = static_cast<int>(d.especies.size());
  std::vector<double> valores(static_cast<std::size_t>(S * S));
  double lo = 1e300, hi = -1e300;
  for (int a = 0; a < S; ++a)
    for (int b = 0; b < S; ++b) {
      valores[a * S + b] = (*w_)(a, b);
      lo = std::min(lo, valores[a * S + b]);
      hi = std::max(hi, valores[a * S + b]);
    }
  std::vector<std::string> claves;
  for (const auto& e : d.especies) claves.push_back(clave_especie(e.nombre));
  std::vector<const char*> etq_x, etq_y;
  std::vector<double> tx, ty;
  for (int i = 0; i < S; ++i) {
    tx.push_back(i + 0.5);
    etq_x.push_back(claves[i].c_str());
    ty.push_back(S - i - 0.5);  // la fila 0 del heatmap queda arriba
    etq_y.push_back(claves[i].c_str());
  }

  ImGui::TextDisabled("Penalización por ocupar posiciones vecinas; la diagonal es la competencia intraespecífica.");
  const float escala = ImGui::GetFontSize() * 5;
  const float lado = std::min(ImGui::GetContentRegionAvail().x - escala - ImGui::GetStyle().ItemSpacing.x,
                              ImGui::GetContentRegionAvail().y);
  ImPlot::PushColormap(estilo::cmap_secuencial);
  if (ImPlot::BeginPlot("##W", ImVec2(lado, lado), ImPlotFlags_NoLegend | ImPlotFlags_NoMouseText)) {
    const ImPlotAxisFlags ejes = ImPlotAxisFlags_NoGridLines | ImPlotAxisFlags_NoTickMarks | ImPlotAxisFlags_Lock;
    ImPlot::SetupAxes(nullptr, nullptr, ejes, ejes);
    ImPlot::SetupAxisTicks(ImAxis_X1, tx.data(), S, etq_x.data());
    ImPlot::SetupAxisTicks(ImAxis_Y1, ty.data(), S, etq_y.data());
    ImPlot::SetupAxesLimits(0, S, 0, S, ImPlotCond_Always);
    ImPlot::PlotHeatmap("W", valores.data(), S, S, lo, hi, "%.2f", ImPlotPoint(0, 0), ImPlotPoint(S, S));
    if (ImPlot::IsPlotHovered()) {
      const ImPlotPoint p = ImPlot::GetPlotMousePos();
      const int b = static_cast<int>(p.x), a = S - 1 - static_cast<int>(p.y);
      if (a >= 0 && a < S && b >= 0 && b < S) {
        ImGui::BeginTooltip();
        ImGui::Text("%s ↔ %s", d.especies[a].nombre.c_str(), d.especies[b].nombre.c_str());
        ImGui::Text("W = %.2f", valores[a * S + b]);
        ImGui::EndTooltip();
      }
    }
    ImPlot::EndPlot();
  }
  ImGui::SameLine();
  ImPlot::ColormapScale("W", lo, hi, ImVec2(escala, lado), "%.2f");
  ImPlot::PopColormap();
  ImGui::End();
}

void App::vista_frontera() {
  if (!ImGui::Begin(kFrontera)) return ImGui::End();
  if (!frontera_) {
    ImGui::BeginDisabled(!datos_ || ocupado());
    if (estilo::estado_vacio("Calcula el presupuesto mínimo factible para cada α de la lista en Configuración.",
                             "Calcular frontera"))
      lanzar_frontera();
    ImGui::EndDisabled();
    return ImGui::End();
  }
  const auto& fr = *frontera_;
  std::vector<double> xs, prom, bmin, bmax, costo;
  for (double a : fr.alfas) {
    const AgregadoFrontera g = agregar_frontera(fr.res, a);
    if (!g.B_minimo) continue;
    xs.push_back(a);
    prom.push_back(*g.B_minimo);
    bmin.push_back(*g.B_min_pol);
    bmax.push_back(*g.B_max_pol);
    costo.push_back(*g.costo_libre);
  }
  if (xs.empty()) {
    estilo::estado_vacio("Ningún α tiene presupuesto mínimo para todos los polígonos seleccionados.");
    return ImGui::End();
  }

  const float alto = ImGui::GetContentRegionAvail().y - ImGui::GetTextLineHeightWithSpacing() * (xs.size() + 2.5f);
  if (ImPlot::BeginPlot("Presupuesto mínimo factible", ImVec2(-1, std::max(alto, 200.0f)))) {
    ImPlot::SetupAxes("α (riesgo admisible)", "$/ha", ImPlotAxisFlags_AutoFit, ImPlotAxisFlags_AutoFit);
    ImPlot::SetupLegend(ImPlotLocation_NorthEast);
    ImPlotSpec banda;
    banda.FillColor = estilo::v4(estilo::categorico[0]);
    banda.FillAlpha = 0.38f;
    ImPlot::PlotShaded("Rango entre polígonos", xs.data(), bmin.data(), bmax.data(), static_cast<int>(xs.size()), banda);
    ImPlotSpec l = linea(estilo::categorico[0], 2.0f);
    l.Marker = ImPlotMarker_Circle;
    l.MarkerSize = 4;
    l.MarkerFillColor = estilo::v4(estilo::categorico[0]);
    ImPlot::PlotLine("B* promedio (ponderado por área)", xs.data(), prom.data(), static_cast<int>(xs.size()), l);
    ImPlotSpec ref = linea(estilo::tinta_tenue, 1.0f);
    ref.Flags = ImPlotInfLinesFlags_Horizontal;
    ImPlot::PlotInfLines(std::format("B configurado ${:.0f}/ha", cfg_.B).c_str(), &cfg_.B, 1, ref);
    ImPlot::EndPlot();
  }

  if (ImGui::BeginTable("frontera", 5, ImGuiTableFlags_RowBg | ImGuiTableFlags_BordersInnerH)) {
    for (const char* h : {"α", "B* promedio", "B* mínimo", "B* máximo", "Costo óptimo $/ha"}) ImGui::TableSetupColumn(h);
    ImGui::TableHeadersRow();
    for (std::size_t i = 0; i < xs.size(); ++i) {
      ImGui::TableNextRow();
      ImGui::TableNextColumn();
      ImGui::Text("%.3f", xs[i]);
      ImGui::TableNextColumn();
      ImGui::Text("%.0f", prom[i]);
      ImGui::TableNextColumn();
      ImGui::Text("%.0f", bmin[i]);
      ImGui::TableNextColumn();
      ImGui::Text("%.0f", bmax[i]);
      ImGui::TableNextColumn();
      ImGui::Text("%.0f", costo[i]);
    }
    ImGui::EndTable();
  }
  ImGui::End();
}

void App::vista_barrido() {
  if (!ImGui::Begin(kBarrido)) return ImGui::End();
  if (!barrido_) {
    ImGui::BeginDisabled(!datos_ || ocupado());
    if (estilo::estado_vacio("Calcula cuántos polígonos son factibles en cada celda de la rejilla α × B.",
                             "Calcular barrido"))
      lanzar_barrido();
    ImGui::EndDisabled();
    return ImGui::End();
  }
  const auto& br = *barrido_;
  const int A = static_cast<int>(br.alfas.size()), NB = static_cast<int>(br.Bs.size());
  // Fracción de polígonos factibles por celda (filas: α, columnas: B).
  std::map<std::pair<double, double>, std::pair<int, int>> conteo;
  for (const auto& r : br.res) {
    auto& [fact, tot] = conteo[{r.alfa, r.B}];
    fact += r.optima.has_value();
    ++tot;
  }
  std::vector<double> pct(static_cast<std::size_t>(A * NB));
  for (int a = 0; a < A; ++a)
    for (int b = 0; b < NB; ++b) {
      const auto [fact, tot] = conteo[{br.alfas[a], br.Bs[b]}];
      pct[a * NB + b] = tot ? 100.0 * fact / tot : 0;
    }

  std::vector<std::string> sx, sy;
  std::vector<double> tx, ty;
  const int salto = std::max(1, NB / 10);
  for (int b = 0; b < NB; b += salto) {
    tx.push_back(b + 0.5);
    sx.push_back(std::format("{:.0f}", br.Bs[b]));
  }
  for (int a = 0; a < A; ++a) {
    ty.push_back(A - a - 0.5);
    sy.push_back(std::format("{:.2f}", br.alfas[a]));
  }
  std::vector<const char*> ex, ey;
  for (const auto& s : sx) ex.push_back(s.c_str());
  for (const auto& s : sy) ey.push_back(s.c_str());

  ImGui::TextDisabled("Porcentaje de polígonos factibles en cada celda; pasa el ratón para ver el conteo.");
  const float escala = ImGui::GetFontSize() * 5;
  ImPlot::PushColormap(estilo::cmap_secuencial);
  if (ImPlot::BeginPlot("##barrido", ImVec2(ImGui::GetContentRegionAvail().x - escala, -1),
                        ImPlotFlags_NoLegend | ImPlotFlags_NoMouseText)) {
    const ImPlotAxisFlags ejes = ImPlotAxisFlags_NoGridLines | ImPlotAxisFlags_NoTickMarks | ImPlotAxisFlags_Lock;
    ImPlot::SetupAxes("B ($/ha)", "α", ejes, ejes);
    ImPlot::SetupAxisTicks(ImAxis_X1, tx.data(), static_cast<int>(tx.size()), ex.data());
    ImPlot::SetupAxisTicks(ImAxis_Y1, ty.data(), A, ey.data());
    ImPlot::SetupAxesLimits(0, NB, 0, A, ImPlotCond_Always);
    ImPlot::PlotHeatmap("factibles", pct.data(), A, NB, 0, 100, NB <= 14 ? "%.0f" : nullptr, ImPlotPoint(0, 0),
                        ImPlotPoint(NB, A));
    if (ImPlot::IsPlotHovered()) {
      const ImPlotPoint p = ImPlot::GetPlotMousePos();
      const int b = static_cast<int>(p.x), a = A - 1 - static_cast<int>(p.y);
      if (a >= 0 && a < A && b >= 0 && b < NB) {
        const auto [fact, tot] = conteo[{br.alfas[a], br.Bs[b]}];
        ImGui::SetTooltip("α = %.3f   B = $%.0f/ha\n%d de %d polígonos factibles", br.alfas[a], br.Bs[b], fact, tot);
      }
    }
    ImPlot::EndPlot();
  }
  ImGui::SameLine();
  ImPlot::ColormapScale("% factibles", 0, 100, ImVec2(escala, -1), "%.0f");
  ImPlot::PopColormap();
  ImGui::End();
}

}  // namespace refor::gui
