#include "estilo.hpp"

#include <algorithm>
#include <cmath>
#include <map>

#include "animacion.hpp"

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

std::string miles(double v) {
  std::string s = std::to_string(static_cast<long long>(std::llround(std::abs(v))));
  for (int i = static_cast<int>(s.size()) - 3; i > 0; i -= 3) s.insert(static_cast<std::size_t>(i), ",");
  return (v < 0 ? "-" : "") + s;
}

void aplicar() {
  ImGui::StyleColorsDark();
  ImGuiStyle& s = ImGui::GetStyle();
  // Medidas: más aire que el estilo por defecto, esquinas suaves y sin bordes
  // de ventana; la jerarquía la marcan las superficies, no las líneas.
  s.WindowPadding = ImVec2(12, 12);
  s.FramePadding = ImVec2(8, 5);
  s.ItemSpacing = ImVec2(10, 7);
  s.ItemInnerSpacing = ImVec2(6, 6);
  s.CellPadding = ImVec2(8, 4);
  s.WindowRounding = 8;
  s.ChildRounding = 6;
  s.FrameRounding = 6;
  s.PopupRounding = 6;
  s.ScrollbarRounding = 6;
  s.GrabRounding = 6;
  s.TabRounding = 5;
  s.ScrollbarSize = 11;
  s.WindowBorderSize = 0;
  s.PopupBorderSize = 1;
  s.FrameBorderSize = 1;
  s.TabBarBorderSize = 1;
  s.TabBarOverlineSize = 2;
  s.DockingSeparatorSize = 2;
  s.SeparatorTextBorderSize = 1;
  s.SeparatorTextPadding = ImVec2(0, 4);

  ImVec4* c = s.Colors;
  c[ImGuiCol_WindowBg] = v4(superficie);
  c[ImGuiCol_ChildBg] = v4(rgb(0, 0));
  c[ImGuiCol_PopupBg] = v4(elevada);
  c[ImGuiCol_MenuBarBg] = v4(plano);
  c[ImGuiCol_DockingEmptyBg] = v4(plano);
  c[ImGuiCol_Text] = v4(tinta);
  c[ImGuiCol_TextDisabled] = v4(tinta_tenue);
  c[ImGuiCol_Border] = v4(rgb(0xffffff, 18));
  c[ImGuiCol_Separator] = v4(reticula);
  c[ImGuiCol_SeparatorHovered] = v4(rgb(0x2a78d6, 160));
  c[ImGuiCol_SeparatorActive] = v4(primario);
  c[ImGuiCol_FrameBg] = v4(rgb(0x262624));
  c[ImGuiCol_FrameBgHovered] = v4(rgb(0x2e2e2c));
  c[ImGuiCol_FrameBgActive] = v4(rgb(0x363633));
  c[ImGuiCol_TitleBg] = v4(plano);
  c[ImGuiCol_TitleBgActive] = v4(plano);
  c[ImGuiCol_TitleBgCollapsed] = v4(plano);
  c[ImGuiCol_ScrollbarBg] = v4(rgb(0, 0));
  c[ImGuiCol_ScrollbarGrab] = v4(rgb(0x3a3a37));
  c[ImGuiCol_ScrollbarGrabHovered] = v4(rgb(0x4a4a46));
  c[ImGuiCol_ScrollbarGrabActive] = v4(rgb(0x5a5a55));
  // Botones neutros: el azul queda para la acción principal (boton_primario).
  c[ImGuiCol_Button] = v4(boton);
  c[ImGuiCol_ButtonHovered] = v4(boton_sobre);
  c[ImGuiCol_ButtonActive] = v4(boton_activo);
  c[ImGuiCol_Header] = v4(rgb(0x2a78d6, 70));
  c[ImGuiCol_HeaderHovered] = v4(rgb(0x2a78d6, 110));
  c[ImGuiCol_HeaderActive] = v4(rgb(0x2a78d6, 150));
  c[ImGuiCol_CheckMark] = v4(rgb(0xcde2fb));
  c[ImGuiCol_CheckboxSelectedBg] = v4(rgb(0x2a78d6, 95));
  c[ImGuiCol_SliderGrab] = v4(rgb(0x3987e5));
  c[ImGuiCol_SliderGrabActive] = v4(rgb(0x5598e7));
  c[ImGuiCol_ResizeGrip] = v4(rgb(0, 0));
  c[ImGuiCol_ResizeGripHovered] = v4(rgb(0x2a78d6, 120));
  c[ImGuiCol_ResizeGripActive] = v4(primario);
  c[ImGuiCol_PlotHistogram] = v4(rgb(0x3987e5));
  c[ImGuiCol_Tab] = v4(plano);
  c[ImGuiCol_TabHovered] = v4(rgb(0x2c2c2a));
  c[ImGuiCol_TabSelected] = v4(superficie);
  c[ImGuiCol_TabSelectedOverline] = v4(rgb(0x3987e5));
  c[ImGuiCol_TabDimmed] = v4(plano);
  c[ImGuiCol_TabDimmedSelected] = v4(superficie);
  c[ImGuiCol_TabDimmedSelectedOverline] = v4(rgb(0x3987e5, 90));
  c[ImGuiCol_DockingPreview] = v4(rgb(0x2a78d6, 110));
  c[ImGuiCol_TableHeaderBg] = v4(elevada);
  c[ImGuiCol_TableBorderStrong] = v4(eje);
  c[ImGuiCol_TableBorderLight] = v4(reticula);
  c[ImGuiCol_TableRowBgAlt] = v4(rgb(0xffffff, 7));
  c[ImGuiCol_TextSelectedBg] = v4(rgb(0x2a78d6, 110));
  c[ImGuiCol_NavCursor] = v4(rgb(0x5598e7));
  c[ImGuiCol_ModalWindowDimBg] = v4(rgb(0, 140));

  ImPlotStyle& ps = ImPlot::GetStyle();
  ps.PlotBorderSize = 0;
  ps.MinorAlpha = 0.2f;
  ps.PlotPadding = ImVec2(12, 12);
  ps.LabelPadding = ImVec2(6, 6);
  ps.LegendPadding = ImVec2(10, 10);
  ps.LegendInnerPadding = ImVec2(8, 6);
  ps.LegendSpacing = ImVec2(8, 2);
  ps.MajorTickLen = ImVec2(0, 0);
  ps.MinorTickLen = ImVec2(0, 0);
  ImVec4* pc = ps.Colors;
  pc[ImPlotCol_FrameBg] = v4(rgb(0, 0));
  pc[ImPlotCol_PlotBg] = v4(rgb(0, 0));
  pc[ImPlotCol_PlotBorder] = v4(rgb(0, 0));
  pc[ImPlotCol_LegendBg] = v4(rgb(0x232322, 235));
  pc[ImPlotCol_LegendBorder] = v4(rgb(0xffffff, 20));
  pc[ImPlotCol_LegendText] = v4(tinta_2);
  pc[ImPlotCol_TitleText] = v4(tinta);
  pc[ImPlotCol_InlayText] = v4(tinta);
  pc[ImPlotCol_AxisText] = v4(tinta_tenue);
  pc[ImPlotCol_AxisGrid] = v4(reticula);
  pc[ImPlotCol_AxisTick] = v4(eje);

  cmap_secuencial = ImPlot::AddColormap("Secuencial", azules, pasos, false);
  cmap_generos = ImPlot::AddColormap("Generos", categorico, 3, true);
}

bool boton_primario(const char* etiqueta, ImVec2 tam) {
  return anim::boton_colores(etiqueta, tam, primario, primario_sobre, primario_activo);
}

bool seccion(const char* etiqueta, ImGuiTreeNodeFlags flags) {
  ImGui::PushStyleColor(ImGuiCol_Header, v4(elevada));
  ImGui::PushStyleColor(ImGuiCol_HeaderHovered, v4(boton_sobre));
  ImGui::PushStyleColor(ImGuiCol_HeaderActive, v4(boton_activo));
  ImGui::PushFont(fuente_titulo, 0.0f);
  const bool abierta = ImGui::CollapsingHeader(etiqueta, flags);
  ImGui::PopFont();
  ImGui::PopStyleColor(3);
  return abierta;
}

bool estado_vacio(const char* texto, const char* accion) {
  const ImVec2 hay = ImGui::GetContentRegionAvail();
  const float f = ImGui::GetFontSize();
  const float ancho = std::min(hay.x - 2 * f, f * 26);
  const ImVec2 t = ImGui::CalcTextSize(texto, nullptr, false, ancho);
  const float boton_h = accion ? ImGui::GetFrameHeight() * 1.3f + ImGui::GetStyle().ItemSpacing.y : 0;
  const ImVec2 caja(ancho + 2 * f, t.y + boton_h + 2 * f);
  const ImVec2 p = ImGui::GetCursorScreenPos();
  const ImVec2 o(p.x + std::max(0.0f, (hay.x - caja.x) / 2), p.y + std::max(0.0f, (hay.y - caja.y) * 0.42f));
  ImDrawList* dl = ImGui::GetWindowDrawList();
  dl->AddRectFilled(o, ImVec2(o.x + caja.x, o.y + caja.y), elevada, 10);
  dl->AddRect(o, ImVec2(o.x + caja.x, o.y + caja.y), rgb(0xffffff, 14), 10);

  ImGui::SetCursorScreenPos(ImVec2(o.x + f + (ancho - t.x) / 2, o.y + f));
  ImGui::PushTextWrapPos(ImGui::GetCursorPosX() + ancho);
  ImGui::PushStyleColor(ImGuiCol_Text, v4(tinta_2));
  ImGui::TextWrapped("%s", texto);
  ImGui::PopStyleColor();
  ImGui::PopTextWrapPos();
  bool pulsado = false;
  if (accion) {
    const float bw = ImGui::CalcTextSize(accion).x + f * 2.5f;
    ImGui::SetCursorScreenPos(ImVec2(o.x + (caja.x - bw) / 2, ImGui::GetCursorScreenPos().y));
    pulsado = boton_primario(accion, ImVec2(bw, ImGui::GetFrameHeight() * 1.3f));
  }
  ImGui::SetCursorScreenPos(ImVec2(p.x, o.y + caja.y));
  ImGui::Dummy(ImVec2(0, 0));
  return pulsado;
}

void cifra(const char* valor, const char* etiqueta, ImU32 color) {
  const float f = ImGui::GetFontSize(), grande = ImGui::GetStyle().FontSizeBase * 1.6f;
  ImFont* fuente = fuente_titulo ? fuente_titulo : ImGui::GetFont();
  ImGui::PushFont(fuente, grande);
  const ImVec2 tv = ImGui::CalcTextSize(valor);
  ImGui::PopFont();
  const ImVec2 te = ImGui::CalcTextSize(etiqueta);
  const ImVec2 pad(f * 0.8f, f * 0.55f);
  const ImVec2 tam(std::max(tv.x, te.x) + 2 * pad.x, tv.y + te.y + 2 * pad.y + 2);
  const ImVec2 p = ImGui::GetCursorScreenPos();
  ImDrawList* dl = ImGui::GetWindowDrawList();
  dl->AddRectFilled(p, ImVec2(p.x + tam.x, p.y + tam.y), elevada, 8);
  ImGui::SetCursorScreenPos(ImVec2(p.x + pad.x, p.y + pad.y));
  ImGui::PushFont(fuente, grande);
  ImGui::PushStyleColor(ImGuiCol_Text, v4(color));
  ImGui::TextUnformatted(valor);
  ImGui::PopStyleColor();
  ImGui::PopFont();
  ImGui::SetCursorScreenPos(ImVec2(p.x + pad.x, p.y + pad.y + tv.y + 2));
  ImGui::PushStyleColor(ImGuiCol_Text, v4(tinta_tenue));
  ImGui::TextUnformatted(etiqueta);
  ImGui::PopStyleColor();
  ImGui::SetCursorScreenPos(p);
  ImGui::Dummy(tam);
}

void chip(const char* texto, ImU32 color) {
  const ImVec2 t = ImGui::CalcTextSize(texto);
  const float h = ImGui::GetTextLineHeight(), px = h * 0.5f;
  const ImVec2 p = ImGui::GetCursorScreenPos();
  const ImVec2 tam(t.x + 2 * px, h + 2);
  ImDrawList* dl = ImGui::GetWindowDrawList();
  // Texto más claro que el relleno: el color saturado puro pierde contraste
  // sobre su propio tono atenuado.
  const ImVec4 a = v4(color), b = v4(tinta);
  const ImU32 texto_col = ImGui::ColorConvertFloat4ToU32(
      ImVec4(a.x + (b.x - a.x) * 0.45f, a.y + (b.y - a.y) * 0.45f, a.z + (b.z - a.z) * 0.45f, a.w));
  dl->AddRectFilled(p, ImVec2(p.x + tam.x, p.y + tam.y), con_alfa(color, 0.22f), tam.y / 2);
  dl->AddText(ImVec2(p.x + px, p.y + 1), texto_col, texto);
  ImGui::Dummy(tam);
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
