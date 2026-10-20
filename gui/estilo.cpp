#include "estilo.hpp"

#include <algorithm>
#include <cmath>
#include <map>

namespace refor::gui::estilo {

ImFont* fuente_titulo = nullptr;
ImPlotColormap cmap_secuencial = -1;
ImPlotColormap cmap_generos = -1;

namespace {

// Pasos 700 → 100 de la rampa azul.
constexpr ImU32 azules[] = {rgb(0x0d366b), rgb(0x104281), rgb(0x184f95), rgb(0x1c5cab), rgb(0x256abf),
                           rgb(0x2a78d6), rgb(0x3987e5), rgb(0x5598e7), rgb(0x6da7ec), rgb(0x86b6ef),
                           rgb(0x9ec5f4), rgb(0xb7d3f6), rgb(0xcde2fb)};
constexpr int pasos = sizeof(azules) / sizeof(azules[0]);

}  // namespace

ImU32 secuencial(float t) {
  t = std::clamp(t, 0.0f, 1.0f) * (pasos - 1);
  const int i = std::min(static_cast<int>(t), pasos - 2);
  const ImVec4 a = v4(azules[i]), b = v4(azules[i + 1]);
  const float f = t - static_cast<float>(i);
  return ImGui::ColorConvertFloat4ToU32(
      ImVec4(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.z + (b.z - a.z) * f, 1.0f));
}

ImU32 con_alfa(ImU32 c, float a) {
  ImVec4 v = v4(c);
  v.w *= a;
  return ImGui::ColorConvertFloat4ToU32(v);
}

ImU32 tinta_sobre(ImU32 relleno) {
  const ImVec4 c = v4(relleno);
  return 0.2126f * c.x + 0.7152f * c.y + 0.0722f * c.z > 0.45f ? tinta_oscura : tinta;
}

ImPlotSpec linea(ImU32 color, float grosor, ImPlotItemFlags flags) {
  ImPlotSpec s;
  s.LineColor = v4(color);
  s.LineWeight = grosor;
  s.Flags = flags;
  return s;
}

void muestra(ImU32 c, const char* texto) {
  const ImVec2 p = ImGui::GetCursorScreenPos();
  const float h = ImGui::GetTextLineHeight();
  ImGui::GetWindowDrawList()->AddRectFilled(ImVec2(p.x, p.y + 2), ImVec2(p.x + h - 4, p.y + h - 2), c, 3);
  ImGui::Dummy(ImVec2(h, h));
  ImGui::SameLine();
  ImGui::TextUnformatted(texto);
  ImGui::SameLine(0, ImGui::GetFontSize() * 1.5f);
}

void rampa(double lo, double hi, const char* unidad, const char* formato) {
  ImGui::Text(formato, lo);
  ImGui::SameLine();
  const ImVec2 p = ImGui::GetCursorScreenPos();
  const float ancho = ImGui::GetFontSize() * 14, h = ImGui::GetTextLineHeight();
  for (int i = 0; i < 28; ++i) {
    const float x0 = p.x + ancho * static_cast<float>(i) / 28, x1 = p.x + ancho * static_cast<float>(i + 1) / 28;
    ImGui::GetWindowDrawList()->AddRectFilled(ImVec2(x0, p.y + 2), ImVec2(x1, p.y + h - 2),
                                              secuencial(static_cast<float>(i) / 27));
  }
  ImGui::Dummy(ImVec2(ancho, h));
  ImGui::SameLine();
  ImGui::Text(formato, hi);
  ImGui::SameLine();
  ImGui::TextUnformatted(unidad);
  ImGui::SameLine(0, ImGui::GetFontSize() * 1.5f);
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

  cmap_secuencial = ImPlot::AddColormap("Secuencial", azules, pasos, false);
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
