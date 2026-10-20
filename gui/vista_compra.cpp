#include <imgui.h>
#include <implot.h>

#include <algorithm>
#include <format>
#include <numeric>

#include "app.hpp"
#include "salida.hpp"

namespace refor::gui {

namespace {

// El estado lleva siempre su texto; el color solo lo refuerza.
void estado(const Resultado& r) {
  if (r.optima) {
    estilo::chip("factible", estilo::bueno);
  } else {
    estilo::chip(r.libre ? "infactible" : "sin banda", estilo::critico);
    ImGui::SetItemTooltip(r.libre ? "El presupuesto no alcanza; se muestra el óptimo sin presupuesto."
                                  : "La banda de metas no admite la densidad total.");
  }
}

enum Columna { cPoligono, cArea, cEstado, cCompra, cTotal, cBmin, cPlantas, cMosaico };

double clave_orden(const Resultado& r, int col, int grupo) {
  const Solucion* s = reportada(r);
  const double a = r.poligono->area;
  switch (col) {
    case cPoligono: return r.poligono->id;
    case cArea: return a;
    case cEstado: return r.optima ? 0 : r.libre ? 1 : 2;
    case cCompra: return s ? s->costo_compra / a : 1e300;
    case cTotal: return s ? s->costo_total() / a : 1e300;
    case cBmin: return r.B_minimo.value_or(1e300);
    case cPlantas: return s ? std::accumulate(s->x.begin(), s->x.end(), 0.0) : 0;
    case cMosaico: return grupo;
  }
  return 0;
}

}  // namespace

void App::vista_compra() {
  if (!ImGui::Begin(kCompra)) return ImGui::End();
  if (!plan_) {
    ImGui::BeginDisabled(!datos_ || ocupado());
    if (estilo::estado_vacio("Ejecuta el plan para ver cuánto comprar de cada especie en cada polígono.",
                             "Ejecutar plan"))
      lanzar_plan();
    ImGui::EndDisabled();
    return ImGui::End();
  }
  const auto& r = *plan_;
  const auto& d = *r.datos;
  const auto& compras = r.plan.compras;

  // Resumen.
  int factibles = 0;
  double area = 0, compra = 0;
  for (const auto& c : compras) {
    factibles += c.optima.has_value();
    area += c.poligono->area;
    if (const Solucion* s = reportada(c)) compra += s->costo_compra;
  }
  const bool todos = factibles == static_cast<int>(compras.size());
  estilo::cifra(std::format("{} / {}", factibles, compras.size()).c_str(), "polígonos factibles",
                todos ? estilo::tinta : estilo::aviso);
  ImGui::SameLine();
  estilo::cifra(std::format("{:.2f} ha", area).c_str(), "área del plan");
  ImGui::SameLine();
  estilo::cifra(("$" + estilo::miles(compra)).c_str(), "compra total");
  ImGui::SameLine();
  estilo::cifra(("$" + estilo::miles(area > 0 ? compra / area : 0.0)).c_str(), "por hectárea");
  ImGui::SameLine();
  ImGui::BeginGroup();
  ImGui::TextDisabled("α = %.3f", r.alfa);
  ImGui::TextDisabled("B = $%.0f/ha", r.B);
  ImGui::EndGroup();

  // Tabla de polígonos, ordenable.
  if (orden_compras_.size() != compras.size()) {
    orden_compras_.resize(compras.size());
    std::iota(orden_compras_.begin(), orden_compras_.end(), 0);
  }
  const ImGuiTableFlags tf = ImGuiTableFlags_Sortable | ImGuiTableFlags_RowBg | ImGuiTableFlags_BordersInnerH |
                             ImGuiTableFlags_ScrollY | ImGuiTableFlags_SizingStretchProp | ImGuiTableFlags_Resizable;
  const float alto = std::max(ImGui::GetContentRegionAvail().y * 0.42f, ImGui::GetTextLineHeightWithSpacing() * 6);
  if (ImGui::BeginTable("compras", 8, tf, ImVec2(0, alto))) {
    ImGui::TableSetupScrollFreeze(0, 1);
    ImGui::TableSetupColumn("Polígono", ImGuiTableColumnFlags_DefaultSort);
    ImGui::TableSetupColumn("Área (ha)");
    ImGui::TableSetupColumn("Estado");
    ImGui::TableSetupColumn("Compra $/ha");
    ImGui::TableSetupColumn("Compra + repos. $/ha");
    ImGui::TableSetupColumn("B mínimo $/ha");
    ImGui::TableSetupColumn("Plantas");
    ImGui::TableSetupColumn("Mosaico");
    ImGui::TableHeadersRow();

    if (ImGuiTableSortSpecs* ss = ImGui::TableGetSortSpecs(); ss && ss->SpecsDirty) {
      const int col = ss->Specs[0].ColumnIndex;
      const bool asc = ss->Specs[0].SortDirection == ImGuiSortDirection_Ascending;
      std::stable_sort(orden_compras_.begin(), orden_compras_.end(), [&](int i, int j) {
        const double a = clave_orden(compras[i], col, r.grupo_de[i]), b = clave_orden(compras[j], col, r.grupo_de[j]);
        return asc ? a < b : a > b;
      });
      ss->SpecsDirty = false;
    }

    for (int i : orden_compras_) {
      const auto& c = compras[i];
      const Solucion* s = reportada(c);
      const double a = c.poligono->area;
      ImGui::TableNextRow();
      ImGui::TableNextColumn();
      if (ImGui::Selectable(std::to_string(c.poligono->id).c_str(), compra_sel_ == i,
                            ImGuiSelectableFlags_SpanAllColumns)) {
        compra_sel_ = i;
        if (r.grupo_de[i] >= 0) mosaico_sel_ = r.grupo_de[i];
      }
      ImGui::TableNextColumn();
      ImGui::Text("%.2f", a);
      ImGui::TableNextColumn();
      estado(c);
      ImGui::TableNextColumn();
      if (s) ImGui::Text("%.0f", s->costo_compra / a);
      ImGui::TableNextColumn();
      if (s) ImGui::Text("%.0f", s->costo_total() / a);
      ImGui::TableNextColumn();
      if (c.B_minimo) ImGui::Text("%.0f", *c.B_minimo);
      ImGui::TableNextColumn();
      if (s) ImGui::Text("%d", std::accumulate(s->x.begin(), s->x.end(), 0));
      ImGui::TableNextColumn();
      if (r.grupo_de[i] >= 0) ImGui::Text("%d", r.grupo_de[i] + 1);
      else ImGui::TextDisabled("—");
    }
    ImGui::EndTable();
  }

  // Detalle del polígono seleccionado.
  if (compra_sel_ >= 0 && compra_sel_ < static_cast<int>(compras.size())) {
    const auto& c = compras[compra_sel_];
    const int e = etiqueta_mapa(c.poligono->id);
    ImGui::SeparatorText((std::format("Polígono {} ({:.2f} ha)", c.poligono->id, c.poligono->area) +
                          (e >= 0 ? std::format(" · número {} en el mapa", e) : ""))
                             .c_str());
    if (const Solucion* s = reportada(c);
        s && ImGui::BeginTable("especies", 8, ImGuiTableFlags_RowBg | ImGuiTableFlags_BordersInnerH)) {
      for (const char* h : {"Especie", "Clave", "Existentes E", "Plan n0·A", "Meta n", "Compra x*", "Déficit E[D]", "Costo $"})
        ImGui::TableSetupColumn(h);
      ImGui::TableHeadersRow();
      for (std::size_t sp = 0; sp < d.especies.size(); ++sp) {
        const auto& e = d.especies[sp];
        ImGui::TableNextRow();
        ImGui::TableNextColumn();
        ImGui::TextUnformatted(e.nombre.c_str());
        ImGui::TableNextColumn();
        ImGui::TextUnformatted(clave_especie(e.nombre).c_str());
        ImGui::TableNextColumn();
        ImGui::Text("%d", c.poligono->E[sp]);
        ImGui::TableNextColumn();
        ImGui::Text("%.1f", e.n0 * c.poligono->area);
        ImGui::TableNextColumn();
        ImGui::Text("%d", s->n[sp]);
        ImGui::TableNextColumn();
        ImGui::Text("%d", s->x[sp]);
        ImGui::TableNextColumn();
        ImGui::Text("%.2f", s->deficit[sp]);
        ImGui::TableNextColumn();
        ImGui::Text("%.2f", s->compra_especie[sp]);
      }
      ImGui::EndTable();
    }
  } else {
    ImGui::TextDisabled("Selecciona un polígono para ver su compra por especie.");
  }

  // Plantas a comprar por género, apiladas por polígono.
  ImGui::SeparatorText("Plantas a comprar por género");
  const int G = static_cast<int>(generos_.nombres.size()), P = static_cast<int>(compras.size());
  std::vector<double> valores(static_cast<std::size_t>(G * P), 0.0);  // [género][polígono]
  std::vector<double> ticks;
  std::vector<std::string> etiquetas;
  for (int p = 0; p < P; ++p) {
    if (const Solucion* s = reportada(compras[p]))
      for (std::size_t sp = 0; sp < s->x.size(); ++sp) valores[generos_.de_especie[sp] * P + p] += s->x[sp];
    ticks.push_back(p);
    etiquetas.push_back(std::to_string(compras[p].poligono->id));
  }
  std::vector<const char*> nombres, etq;
  for (const auto& n : generos_.nombres) nombres.push_back(n.c_str());
  for (const auto& e : etiquetas) etq.push_back(e.c_str());

  ImPlot::PushColormap(estilo::cmap_generos);
  if (ImPlot::BeginPlot("##generos", ImVec2(-1, -1), ImPlotFlags_NoMouseText)) {
    ImPlot::SetupLegend(ImPlotLocation_North, ImPlotLegendFlags_Horizontal | ImPlotLegendFlags_Outside);
    ImPlot::SetupAxes("Polígono", "Plantas", ImPlotAxisFlags_NoGridLines, ImPlotAxisFlags_AutoFit);
    ImPlot::SetupAxisTicks(ImAxis_X1, ticks.data(), P, etq.data());
    ImPlot::SetupAxisLimits(ImAxis_X1, -0.7, P - 0.3, ImPlotCond_Always);
    ImPlotSpec spec;
    spec.Flags = ImPlotBarGroupsFlags_Stacked;
    spec.LineColor = estilo::v4(estilo::superficie);  // borde = separación de 1 px entre segmentos
    ImPlot::PlotBarGroups(nombres.data(), valores.data(), G, P, 0.7, 0, spec);
    if (ImPlot::IsPlotHovered()) {
      const int p = static_cast<int>(std::lround(ImPlot::GetPlotMousePos().x));
      if (p >= 0 && p < P) {
        ImGui::BeginTooltip();
        ImGui::Text("Polígono %d", compras[p].poligono->id);
        double total = 0;
        for (int g = 0; g < G; ++g) {
          ImGui::Text("  %-8s %5.0f", nombres[g], valores[g * P + p]);
          total += valores[g * P + p];
        }
        ImGui::Text("  %-8s %5.0f", "Total", total);
        ImGui::EndTooltip();
      }
    }
    ImPlot::EndPlot();
  }
  ImPlot::PopColormap();
  ImGui::End();
}

}  // namespace refor::gui
