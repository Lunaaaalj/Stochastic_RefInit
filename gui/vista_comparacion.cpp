#include <imgui.h>
#include <implot.h>

#include <algorithm>
#include <cmath>
#include <format>
#include <mutex>
#include <string>
#include <vector>

#include "app.hpp"
#include "asignacion_exacta/salida_ple.hpp"
#include "memetico/memetico.hpp"

namespace refor::gui {

namespace {

using asignacion_exacta::PuntoTraza;
using asignacion_exacta::ResultadoPLE;

constexpr double kEps = 1e-6;

using estilo::linea;

std::string estado_corto(const ResultadoPLE& r) {
  if (r.optimo) return "óptimo probado";
  if (r.cancelado) return "cancelado";
  if (r.estado == "Time limit reached") return "límite de tiempo";
  return r.estado;
}

// Lo que dice la comparación, en una frase. El exacto arranca desde la mejor
// solución del memético, así que nunca queda peor que ella.
std::string veredicto(const Espacial& g, const ResultadoPLE& r, bool en_curso) {
  const double mejora = g.mejor_competencia - r.competencia;
  if (r.asignacion.empty() && !en_curso)
    return "El modelo entero no llegó a una solución; solo prueba una cota inferior.";
  if (!std::isfinite(r.cota_inferior)) return "El solver aún no prueba una cota inferior.";
  if (r.optimo)
    return mejora <= kEps ? "El memético halló el óptimo."
                          : std::format("El óptimo es {:.2f}: el memético queda {:.2f} arriba.", r.competencia, mejora);
  if (mejora > kEps)
    return std::format("El exacto mejoró al memético en {:.2f} sin probar optimalidad; el óptimo está entre {:.2f} y "
                       "{:.2f}.",
                       mejora, r.cota_inferior, r.competencia);
  return std::format("{} no mejora al memético; el óptimo está entre {:.2f} y {:.2f}.",
                     en_curso ? "Por ahora, el exacto" : "El exacto", r.cota_inferior, g.mejor_competencia);
}

// Cotas del solver en el tiempo frente a la mejor solución y la media del
// memético. Entre las dos cotas (sombreado) está el óptimo.
void grafica_cotas(const std::vector<PuntoTraza>& t, const Espacial& g, double hasta, ImVec2 tam) {
  std::vector<double> xp, yp, xd, yd, sx, sp, sd;
  for (std::size_t i = 0; i < t.size(); ++i) {
    if (std::isfinite(t[i].primal)) xp.push_back(t[i].segundos), yp.push_back(t[i].primal);
    if (std::isfinite(t[i].dual)) xd.push_back(t[i].segundos), yd.push_back(t[i].dual);
    if (std::isfinite(t[i].primal) && std::isfinite(t[i].dual)) {
      const double fin = i + 1 < t.size() ? t[i + 1].segundos : std::max(hasta, t[i].segundos);
      for (double x : {t[i].segundos, fin}) sx.push_back(x), sp.push_back(t[i].primal), sd.push_back(t[i].dual);
    }
  }
  // Escalones: cada cota vale lo mismo hasta su siguiente cambio, y la última
  // se prolonga hasta el instante actual.
  if (!xp.empty() && hasta > xp.back()) xp.push_back(hasta), yp.push_back(yp.back());
  if (!xd.empty() && hasta > xd.back()) xd.push_back(hasta), yd.push_back(yd.back());

  if (!ImPlot::BeginPlot("Cotas del modelo entero", tam)) return;
  ImPlot::SetupAxes("Tiempo del solver (s)", "Competencia total", ImPlotAxisFlags_AutoFit, ImPlotAxisFlags_AutoFit);
  ImPlot::SetupLegend(ImPlotLocation_SouthEast);
  ImPlotSpec banda;
  banda.FillColor = estilo::v4(estilo::categorico[1]);
  banda.FillAlpha = 0.18f;
  ImPlot::PlotShaded("Donde está el óptimo", sx.data(), sp.data(), sd.data(), static_cast<int>(sx.size()), banda);
  ImPlot::PlotStairs("Solución del exacto", xp.data(), yp.data(), static_cast<int>(xp.size()),
                     linea(estilo::categorico[1], 2.0f));
  ImPlot::PlotStairs("Cota inferior", xd.data(), yd.data(), static_cast<int>(xd.size()),
                     linea(estilo::categorico[2], 2.0f));
  const double mejor = g.mejor_competencia, media = g.media;
  ImPlot::PlotInfLines("Memético: mejor", &mejor, 1, linea(estilo::categorico[0], 2.0f, ImPlotInfLinesFlags_Horizontal));
  ImPlot::PlotInfLines("Memético: media", &media, 1, linea(estilo::tinta_tenue, 1.0f, ImPlotInfLinesFlags_Horizontal));
  ImPlot::EndPlot();
}

// Competencia final de cada corrida del memético, con el exacto y la cota
// inferior como referencia: cuántas corridas llegan al óptimo (o cerca).
void grafica_corridas(const Espacial& g, const ResultadoPLE& r, ImVec2 tam) {
  if (g.competencias.empty() || !ImPlot::BeginPlot("Corridas del memético", tam)) return;
  const double lo = *std::min_element(g.competencias.begin(), g.competencias.end());
  const double hi = *std::max_element(g.competencias.begin(), g.competencias.end());
  double xmin = lo, xmax = hi;
  if (std::isfinite(r.cota_inferior)) xmin = std::min(xmin, r.cota_inferior);
  if (std::isfinite(r.competencia)) xmin = std::min(xmin, r.competencia);
  const double pad = std::max(0.5, (xmax - xmin) * 0.08);
  ImPlot::SetupAxes("Competencia total", "Corridas", 0, ImPlotAxisFlags_AutoFit);
  ImPlot::SetupAxisLimits(ImAxis_X1, xmin - pad, xmax + pad, ImPlotCond_Always);
  ImPlot::SetupLegend(ImPlotLocation_NorthEast);

  ImPlotSpec barras;
  barras.FillColor = estilo::v4(estilo::categorico[0]);
  barras.LineColor = estilo::v4(estilo::superficie);
  const ImPlotRange rango = hi > lo ? ImPlotRange(lo, hi) : ImPlotRange(lo - 0.5, hi + 0.5);
  ImPlot::PlotHistogram("Corridas", g.competencias.data(), static_cast<int>(g.competencias.size()),
                        ImPlotBin_Sturges, 1.0, rango, barras);
  if (std::isfinite(r.competencia))
    ImPlot::PlotInfLines("Exacto", &r.competencia, 1, linea(estilo::categorico[1], 2.0f));
  if (std::isfinite(r.cota_inferior))
    ImPlot::PlotInfLines("Cota inferior", &r.cota_inferior, 1, linea(estilo::categorico[2], 2.0f));
  ImPlot::EndPlot();
}

}  // namespace

void App::vista_comparacion() {
  if (!ImGui::Begin(kComparacion)) return ImGui::End();
  if (!plan_ || plan_->plan.espacial.empty()) {
    if (plan_) {
      estilo::estado_vacio("Ningún polígono necesita plantación con esta compra.");
    } else {
      ImGui::BeginDisabled(!datos_ || ocupado());
      if (estilo::estado_vacio("Ejecuta el plan; después cada mosaico puede resolverse con el modelo entero para "
                               "medir qué tan lejos queda el memético del óptimo.",
                               "Ejecutar plan"))
        lanzar_plan();
      ImGui::EndDisabled();
    }
    return ImGui::End();
  }
  const auto& r = *plan_;
  const auto& m = r.mosaico;
  const auto& grupos = r.plan.espacial;
  const int n = static_cast<int>(grupos.size());
  mosaico_sel_ = std::clamp(mosaico_sel_, 0, n - 1);

  // Mosaico que el solver resuelve en este momento, si hay uno.
  int en_curso = -1;
  std::vector<PuntoTraza> viva;
  if (t_exacto_.ocupado() && traza_viva_) {
    std::lock_guard lock(traza_viva_->mtx);
    en_curso = traza_viva_->mosaico;
    if (en_curso == mosaico_sel_) viva = traza_viva_->puntos;
  }

  // Acciones.
  const int pendientes = static_cast<int>(std::count(exacto_.begin(), exacto_.end(), std::nullopt));
  ImGui::BeginDisabled(ocupado());
  if (estilo::boton_primario(std::format("Resolver mosaico {}", mosaico_sel_ + 1).c_str())) lanzar_exacto(mosaico_sel_);
  ImGui::SameLine();
  ImGui::BeginDisabled(pendientes == 0);
  if (anim::boton(std::format("Resolver pendientes ({})", pendientes).c_str())) lanzar_exacto(-1);
  ImGui::EndDisabled();
  ImGui::EndDisabled();
  ImGui::SameLine();
  ImGui::TextDisabled("límite %.0f s por mosaico, brecha %.1f %% (en Configuración); arranca desde el memético",
                      cfg_.ple.limite_segundos, 100 * cfg_.ple.brecha_relativa);

  // Resumen de todos los mosaicos; una fila elige el mosaico en todas las vistas.
  const float alto_tabla = ImGui::GetTextLineHeightWithSpacing() * (static_cast<float>(std::min(n, 6)) + 1.8f);
  constexpr ImGuiTableFlags flags = ImGuiTableFlags_RowBg | ImGuiTableFlags_BordersInnerH | ImGuiTableFlags_ScrollY |
                                    ImGuiTableFlags_SizingFixedFit;
  if (ImGui::BeginTable("resumen", 10, flags, ImVec2(0, alto_tabla))) {
    ImGui::TableSetupScrollFreeze(0, 1);
    ImGui::TableSetupColumn("Mosaico");
    ImGui::TableSetupColumn("Polígonos", ImGuiTableColumnFlags_WidthStretch);
    for (const char* c : {"Memético", "Media ± d.e.", "Exacto", "Cota inferior", "Brecha memético", "Distintas",
                          "Estado", "Tiempo"})
      ImGui::TableSetupColumn(c);
    ImGui::TableHeadersRow();
    for (int k = 0; k < n; ++k) {
      const auto& g = grupos[k];
      const auto& e = exacto_[k];
      ImGui::PushID(k);
      ImGui::TableNextRow();
      ImGui::TableNextColumn();
      if (ImGui::Selectable(std::to_string(k + 1).c_str(), k == mosaico_sel_, ImGuiSelectableFlags_SpanAllColumns))
        mosaico_sel_ = k;
      ImGui::TableNextColumn();
      std::string ids;
      for (std::size_t i = 0; i < g.poligonos.size(); ++i) ids += (i ? ", " : "") + std::to_string(g.poligonos[i]);
      ImGui::TextUnformatted(ids.c_str());
      ImGui::TableNextColumn();
      ImGui::Text("%.2f", g.mejor_competencia);
      ImGui::TableNextColumn();
      ImGui::Text("%.2f ± %.2f", g.media, g.desviacion);
      if (!e) {
        ImGui::TableNextColumn();
        ImGui::TextDisabled("—");
        for (int c = 0; c < 4; ++c) ImGui::TableNextColumn();
        ImGui::TextDisabled(k == en_curso ? "resolviendo…" : "pendiente");
        ImGui::TableNextColumn();
        ImGui::PopID();
        continue;
      }
      const bool hay = !e->asignacion.empty();
      const double brecha = asignacion_exacta::brecha_memetico(g, *e);
      ImGui::TableNextColumn();
      if (hay) ImGui::Text("%.2f", e->competencia);
      else ImGui::TextDisabled("sin solución");
      ImGui::TableNextColumn();
      ImGui::Text("%.2f", e->cota_inferior);
      ImGui::TableNextColumn();
      if (e->optimo && brecha < kEps) ImGui::TextColored(estilo::v4(estilo::bueno), "0 %% (óptimo)");
      else ImGui::Text("%s%.2f %%", e->optimo ? "" : "≤ ", brecha);
      ImGui::TableNextColumn();
      if (hay) ImGui::Text("%d", asignacion_exacta::posiciones_distintas(g, *e, m));
      ImGui::TableNextColumn();
      ImGui::TextUnformatted(estado_corto(*e).c_str());
      ImGui::TableNextColumn();
      ImGui::Text("%.1f s", e->segundos);
      ImGui::PopID();
    }
    ImGui::EndTable();
  }

  // Detalle del mosaico elegido: el resultado final o, si se está
  // resolviendo, uno provisional armado con las últimas cotas.
  const Espacial& g = grupos[mosaico_sel_];
  const bool vivo = en_curso == mosaico_sel_;
  ResultadoPLE provisional;
  if (vivo) {
    provisional.traza = viva;
    provisional.competencia = viva.empty() ? g.mejor_competencia : viva.back().primal;
    provisional.cota_inferior = viva.empty() ? -INFINITY : viva.back().dual;
  }
  const ResultadoPLE* e = vivo ? &provisional : exacto_[mosaico_sel_] ? &*exacto_[mosaico_sel_] : nullptr;

  ImGui::Spacing();
  ImGui::SeparatorText(std::format("Mosaico {}", mosaico_sel_ + 1).c_str());
  if (!e) {
    ImGui::TextDisabled("Memético: %.2f (mejor de %zu corridas), media %.2f ± %.2f.", g.mejor_competencia,
                        g.competencias.size(), g.media, g.desviacion);
    ImGui::BeginDisabled(ocupado());
    if (estilo::estado_vacio("Resuelve este mosaico con el modelo entero para saber qué tan lejos está del óptimo.",
                             std::format("Resolver mosaico {}", mosaico_sel_ + 1).c_str()))
      lanzar_exacto(mosaico_sel_);
    ImGui::EndDisabled();
    return ImGui::End();
  }

  // Cifra principal: la distancia del memético al óptimo (o su cota).
  const double brecha = asignacion_exacta::brecha_memetico(g, *e);
  const bool exacta = e->optimo;
  if (exacta && brecha < kEps) estilo::cifra("0 %", "distancia al óptimo", estilo::bueno);
  else estilo::cifra(std::format("{}{:.2f} %", exacta ? "" : "≤ ", brecha).c_str(), "distancia al óptimo");
  ImGui::SameLine();
  ImGui::BeginGroup();
  ImGui::TextDisabled(exacta ? "distancia del memético al óptimo probado"
                             : "a lo más; según la cota inferior que el solver alcanzó a probar");
  ImGui::TextUnformatted(veredicto(g, *e, vivo).c_str());
  ImGui::EndGroup();
  ImGui::TextDisabled("Memético %.2f (mejor de %zu corridas; media %.2f ± %.2f)   Exacto %s   Cota inferior %s   %s",
                      g.mejor_competencia, g.competencias.size(), g.media, g.desviacion,
                      std::isfinite(e->competencia) ? std::format("{:.2f}", e->competencia).c_str() : "—",
                      std::isfinite(e->cota_inferior) ? std::format("{:.2f}", e->cota_inferior).c_str() : "—",
                      vivo ? std::format("resolviendo, {:.0f} s", t_exacto_.segundos()).c_str()
                           : std::format("{} en {:.1f} s", estado_corto(*e), e->segundos).c_str());

  // Gráficas, lado a lado.
  const float alto = ImGui::GetContentRegionAvail().y;
  const bool hay_clave = !e->asignacion.empty();
  const float alto_graficas = hay_clave ? std::max(180.0f, alto * 0.42f) : alto;
  const float medio = (ImGui::GetContentRegionAvail().x - ImGui::GetStyle().ItemSpacing.x) / 2;
  const double hasta = vivo ? t_exacto_.segundos() : e->segundos;
  grafica_cotas(e->traza, g, hasta, ImVec2(medio, alto_graficas));
  ImGui::SameLine();
  grafica_corridas(g, *e, ImVec2(medio, alto_graficas));
  if (!hay_clave) return ImGui::End();

  // Las dos claves, con el memético trasladado al marco del exacto para que
  // las posiciones distintas sean diferencias reales y no un desplazamiento.
  const auto alineado = memetico::alinear(e->asignacion, g.mejor, m);
  Resaltado res;
  res.distintas.resize(alineado.size());
  int distintas = 0;
  for (std::size_t v = 0; v < alineado.size(); ++v) {
    res.distintas[v] = alineado[v] != e->asignacion[v];
    distintas += res.distintas[v];
  }
  res.local_min = INFINITY, res.local_max = -INFINITY;
  for (const auto* a : {&alineado, &e->asignacion})
    for (int v = 0; v < m.num_posiciones(); ++v) {
      double l = 0;
      for (int x : m.vecinas(v)) l += (*r.w)((*a)[v], (*a)[x]);
      res.local_min = std::min(res.local_min, l);
      res.local_max = std::max(res.local_max, l);
    }

  anim::radio("Género", &color_modo_, 0);
  ImGui::SameLine();
  anim::radio("Competencia local", &color_modo_, 1);
  ImGui::SameLine();
  anim::casilla("Grafo W", &aristas_);
  ImGui::SameLine();
  anim::casilla("Replicar 3 × 3", &replicar_);
  ImGui::SameLine(0, ImGui::GetFontSize() * 1.5f);
  if (distintas == 0)
    ImGui::TextColored(estilo::v4(estilo::bueno), "Mismo esquema: solo difieren por una traslación.");
  else
    ImGui::TextColored(estilo::v4(estilo::aviso), "%d de %d posiciones distintas (contorno amarillo)", distintas,
                       m.num_posiciones());

  const float alto_lienzo = std::max(140.0f, ImGui::GetContentRegionAvail().y - ImGui::GetFrameHeightWithSpacing());
  const float ancho = (ImGui::GetContentRegionAvail().x - ImGui::GetStyle().ItemSpacing.x) / 2;
  ImGui::BeginChild("memetico", ImVec2(ancho, alto_lienzo));
  ImGui::Text("Memético  %.2f", g.mejor_competencia);
  lienzo_mosaico(r, alineado, &res);
  ImGui::EndChild();
  ImGui::SameLine();
  ImGui::BeginChild("exacto", ImVec2(ancho, alto_lienzo));
  ImGui::Text("Exacto  %.2f", e->competencia);
  lienzo_mosaico(r, e->asignacion, &res);
  ImGui::EndChild();
  if (color_modo_ == 0) leyenda_generos(*r.datos);
  else ImGui::TextDisabled("Competencia local con escala común: %.2f a %.2f", res.local_min, res.local_max);
  ImGui::End();
}

}  // namespace refor::gui
