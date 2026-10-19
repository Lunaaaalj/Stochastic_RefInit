#include "estilo.hpp"

#include <algorithm>
#include <cmath>
#include <map>

namespace refor::gui::estilo {

ImPlotColormap cmap_secuencial = -1;
ImPlotColormap cmap_generos = -1;

namespace {

// Pasos 700 → 100 de la rampa azul.
constexpr ImU32 rampa[] = {rgb(0x0d366b), rgb(0x104281), rgb(0x184f95), rgb(0x1c5cab), rgb(0x256abf),
                           rgb(0x2a78d6), rgb(0x3987e5), rgb(0x5598e7), rgb(0x6da7ec), rgb(0x86b6ef),
                           rgb(0x9ec5f4), rgb(0xb7d3f6), rgb(0xcde2fb)};
constexpr int pasos = sizeof(rampa) / sizeof(rampa[0]);

}  // namespace

ImU32 secuencial(float t) {
  t = std::clamp(t, 0.0f, 1.0f) * (pasos - 1);
  const int i = std::min(static_cast<int>(t), pasos - 2);
  const ImVec4 a = v4(rampa[i]), b = v4(rampa[i + 1]);
  const float f = t - static_cast<float>(i);
  return ImGui::ColorConvertFloat4ToU32(
      ImVec4(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.z + (b.z - a.z) * f, 1.0f));
}

void aplicar() {
  ImGui::StyleColorsDark();
  ImGuiStyle& s = ImGui::GetStyle();
  s.WindowRounding = 4;
  s.FrameRounding = 3;
  s.GrabRounding = 3;
  s.TabRounding = 3;
  s.FramePadding = ImVec2(6, 4);
  s.ItemSpacing = ImVec2(8, 6);
  ImVec4* c = s.Colors;
  c[ImGuiCol_WindowBg] = v4(superficie);
  c[ImGuiCol_ChildBg] = v4(superficie);
  c[ImGuiCol_PopupBg] = v4(rgb(0x232322));
  c[ImGuiCol_DockingEmptyBg] = v4(plano);
  c[ImGuiCol_Text] = v4(tinta);
  c[ImGuiCol_TextDisabled] = v4(tinta_tenue);
  c[ImGuiCol_Border] = v4(rgb(0xffffff, 26));
  c[ImGuiCol_Separator] = v4(eje);
  c[ImGuiCol_FrameBg] = v4(rgb(0x262624));
  c[ImGuiCol_FrameBgHovered] = v4(rgb(0x30302e));
  c[ImGuiCol_FrameBgActive] = v4(rgb(0x383835));
  c[ImGuiCol_TitleBg] = v4(plano);
  c[ImGuiCol_TitleBgActive] = v4(plano);
  c[ImGuiCol_Button] = v4(rgb(0x2a78d6, 200));
  c[ImGuiCol_ButtonHovered] = v4(rgb(0x3987e5));
  c[ImGuiCol_ButtonActive] = v4(rgb(0x256abf));
  c[ImGuiCol_Header] = v4(rgb(0x2a78d6, 90));
  c[ImGuiCol_HeaderHovered] = v4(rgb(0x2a78d6, 130));
  c[ImGuiCol_HeaderActive] = v4(rgb(0x2a78d6, 170));
  c[ImGuiCol_CheckMark] = v4(rgb(0x5598e7));
  c[ImGuiCol_SliderGrab] = v4(rgb(0x3987e5));
  c[ImGuiCol_SliderGrabActive] = v4(rgb(0x5598e7));
  c[ImGuiCol_PlotHistogram] = v4(rgb(0x3987e5));
  c[ImGuiCol_Tab] = v4(rgb(0x232322));
  c[ImGuiCol_TabHovered] = v4(rgb(0x2a78d6, 150));
  c[ImGuiCol_TabSelected] = v4(rgb(0x2a78d6, 110));
  c[ImGuiCol_TabDimmed] = v4(rgb(0x1e1e1d));
  c[ImGuiCol_TabDimmedSelected] = v4(rgb(0x2b2b29));
  c[ImGuiCol_TableHeaderBg] = v4(rgb(0x232322));
  c[ImGuiCol_TableBorderStrong] = v4(eje);
  c[ImGuiCol_TableBorderLight] = v4(reticula);
  c[ImGuiCol_TableRowBgAlt] = v4(rgb(0xffffff, 8));

  ImPlotStyle& ps = ImPlot::GetStyle();
  ImVec4* pc = ps.Colors;
  pc[ImPlotCol_FrameBg] = v4(superficie);
  pc[ImPlotCol_PlotBg] = v4(superficie);
  pc[ImPlotCol_PlotBorder] = v4(rgb(0, 0));
  pc[ImPlotCol_LegendBg] = v4(rgb(0x232322, 235));
  pc[ImPlotCol_LegendBorder] = v4(rgb(0xffffff, 26));
  pc[ImPlotCol_LegendText] = v4(tinta_2);
  pc[ImPlotCol_TitleText] = v4(tinta);
  pc[ImPlotCol_InlayText] = v4(tinta);
  pc[ImPlotCol_AxisText] = v4(tinta_tenue);
  pc[ImPlotCol_AxisGrid] = v4(reticula);
  pc[ImPlotCol_AxisTick] = v4(eje);

  cmap_secuencial = ImPlot::AddColormap("Secuencial", rampa, pasos, false);
  cmap_generos = ImPlot::AddColormap("Generos", categorico, 3, true);
}

Generos generos(const Datos& datos) {
  // Género = primera palabra del nombre científico.
  std::map<std::string, int> cuenta;
  std::vector<std::string> genero_de;
  for (const auto& e : datos.especies) {
    genero_de.push_back(e.nombre.substr(0, e.nombre.find(' ')));
    ++cuenta[genero_de.back()];
  }
  std::vector<std::pair<int, std::string>> orden;
  for (const auto& [g, n] : cuenta) orden.emplace_back(-n, g);
  std::sort(orden.begin(), orden.end());

  Generos r;
  std::map<std::string, int> grupo;
  for (std::size_t i = 0; i < orden.size(); ++i) {
    if (i < 2 || orden.size() <= 3) {
      grupo[orden[i].second] = static_cast<int>(r.nombres.size());
      r.nombres.push_back(orden[i].second);
    } else {
      if (r.nombres.size() == 2) r.nombres.push_back("Otras");
      grupo[orden[i].second] = 2;
    }
  }
  for (const auto& g : genero_de) r.de_especie.push_back(grupo[g]);
  return r;
}

}  // namespace refor::gui::estilo
