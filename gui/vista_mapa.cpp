#include <imgui.h>

#include <algorithm>
#include <cfloat>
#include <cmath>
#include <filesystem>
#include <format>
#include <fstream>
#include <map>
#include <numeric>
#include <sstream>
#include <stdexcept>

#include "app.hpp"
#include "salida.hpp"

namespace refor::gui {

namespace {

using estilo::con_alfa;
using estilo::muestra;
using estilo::rampa;
using estilo::tinta_sobre;

bool dentro(const std::vector<ImVec2>& v, ImVec2 p) {
  bool in = false;
  for (std::size_t i = 0, j = v.size() - 1; i < v.size(); j = i++)
    if ((v[i].y > p.y) != (v[j].y > p.y) && p.x < (v[j].x - v[i].x) * (p.y - v[i].y) / (v[j].y - v[i].y) + v[i].x)
      in = !in;
  return in;
}

float distancia_borde(const std::vector<ImVec2>& v, ImVec2 p) {
  float d = FLT_MAX;
  for (std::size_t i = 0, j = v.size() - 1; i < v.size(); j = i++) {
    const ImVec2 a = v[j], ab(v[i].x - a.x, v[i].y - a.y);
    const float l2 = ab.x * ab.x + ab.y * ab.y;
    const float t = l2 > 0 ? std::clamp(((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2, 0.0f, 1.0f) : 0.0f;
    d = std::min(d, std::hypot(p.x - a.x - t * ab.x, p.y - a.y - t * ab.y));
  }
  return d;
}

// Punto interior más alejado del borde (en una rejilla de 32 × 32): el
// centroide cae fuera en los polígonos cóncavos, como el 7 con su brecha.
std::pair<ImVec2, float> rotulo(const std::vector<ImVec2>& v) {
  ImVec2 lo(FLT_MAX, FLT_MAX), hi(-FLT_MAX, -FLT_MAX);
  for (const auto& p : v) {
    lo = ImVec2(std::min(lo.x, p.x), std::min(lo.y, p.y));
    hi = ImVec2(std::max(hi.x, p.x), std::max(hi.y, p.y));
  }
  std::pair<ImVec2, float> mejor{ImVec2((lo.x + hi.x) / 2, (lo.y + hi.y) / 2), 0.0f};
  constexpr int n = 32;
  for (int i = 0; i <= n; ++i)
    for (int j = 0; j <= n; ++j) {
      const ImVec2 p(lo.x + (hi.x - lo.x) * static_cast<float>(i) / n, lo.y + (hi.y - lo.y) * static_cast<float>(j) / n);
      if (!dentro(v, p)) continue;
      if (const float d = distancia_borde(v, p); d > mejor.second) mejor = {p, d};
    }
  return mejor;
}

}  // namespace

std::vector<PoligonoMapa> cargar_mapa(const std::string& dir) {
  const auto ruta = std::filesystem::path(dir) / "mapa.csv";
  std::ifstream in(ruta);
  if (!in) return {};

  // Vértices en UTM; se pasan a metros relativos para no perder precisión en float.
  std::map<int, std::pair<int, std::vector<std::pair<double, double>>>> crudo;
  std::string linea;
  std::getline(in, linea);  // encabezado
  while (std::getline(in, linea)) {
    if (!linea.empty() && linea.back() == '\r') linea.pop_back();
    if (linea.empty()) continue;
    std::vector<std::string> f;
    std::stringstream ss(linea);
    for (std::string campo; std::getline(ss, campo, ',');) f.push_back(campo);
    if (f.size() != 4) throw std::runtime_error("mapa.csv: fila mal formada: " + linea);
    auto& [id, v] = crudo[std::stoi(f[0])];
    id = f[1].empty() ? -1 : std::stoi(f[1]);
    v.emplace_back(std::stod(f[2]), std::stod(f[3]));
  }
  double x0 = DBL_MAX, y0 = DBL_MAX;
  for (const auto& [e, p] : crudo)
    for (const auto& [x, y] : p.second) x0 = std::min(x0, x), y0 = std::min(y0, y);

  std::vector<PoligonoMapa> mapa;
  for (const auto& [e, p] : crudo) {
    if (p.second.size() < 3) throw std::runtime_error("mapa.csv: el polígono " + std::to_string(e) + " tiene < 3 vértices");
    PoligonoMapa pm{e, p.first, {}, {}, 0, 0};
    for (const auto& [x, y] : p.second) pm.v.emplace_back(static_cast<float>(x - x0), static_cast<float>(y - y0));
    double s = 0;
    for (std::size_t i = 0, j = pm.v.size() - 1; i < pm.v.size(); j = i++)
      s += static_cast<double>(pm.v[j].x) * pm.v[i].y - static_cast<double>(pm.v[i].x) * pm.v[j].y;
    pm.area = std::abs(s) / 2 / 10'000;
    std::tie(pm.rotulo, pm.holgura) = rotulo(pm.v);
    mapa.push_back(std::move(pm));
  }
  return mapa;
}

void App::vista_mapa() {
  if (!ImGui::Begin(kMapa)) return ImGui::End();
  if (!datos_) {
    estilo::estado_vacio("Carga los datos para ver el mapa del cerco.");
    return ImGui::End();
  }
  if (mapa_.empty()) {
    estilo::estado_vacio(std::format("No hay {}/mapa.csv; se genera con  python3 scripts/digitalizar_mapa.py",
                                     cfg_.datos_dir).c_str());
    return ImGui::End();
  }
  const auto& d = *datos_;
  const ResultadoPlan* plan = plan_ ? &*plan_ : nullptr;
  if (!plan && mapa_modo_ >= 2) mapa_modo_ = 0;

  anim::radio("Selección", &mapa_modo_, 0);
  ImGui::SetItemTooltip("Polígonos incluidos en el próximo plan; se cambia desde el detalle de cada uno.");
  ImGui::SameLine();
  anim::radio("Existentes / ha", &mapa_modo_, 1);
  ImGui::BeginDisabled(!plan);
  ImGui::SameLine();
  anim::radio("Estado del plan", &mapa_modo_, 2);
  ImGui::SameLine();
  anim::radio("Compra $/ha", &mapa_modo_, 3);
  ImGui::EndDisabled();
  if (!plan) ImGui::SetItemTooltip("Ejecuta el plan para colorear por su resultado.");
  ImGui::SameLine(0, ImGui::GetFontSize() * 1.5f);
  ImGui::BeginDisabled(!plan);
  anim::casilla("Plantas", &mapa_plantas_);
  ImGui::EndDisabled();
  ImGui::SetItemTooltip("Siembra cada polígono con el mosaico de su plan; se ven al acercarse.");
  ImGui::SameLine();
  if (anim::boton_chico("Ver todo")) mapa_zoom_obj_ = 1, mapa_centro_obj_ = ImVec2(-1, -1);
  ImGui::SameLine();
  ImGui::TextDisabled("(?)");
  ImGui::SetItemTooltip("Rueda: zoom · arrastrar: mover · clic: detalle · doble clic: encuadrar el polígono");

  // Lo que cada polígono del mapa tiene en los datos y en el plan.
  struct Info {
    int dato = -1, compra = -1;
    double valor = 0;
  };
  std::vector<Info> info(mapa_.size());
  double vmin = DBL_MAX, vmax = -DBL_MAX;
  for (std::size_t k = 0; k < mapa_.size(); ++k) {
    auto& in = info[k];
    for (std::size_t i = 0; i < d.poligonos.size(); ++i)
      if (d.poligonos[i].id == mapa_[k].id) in.dato = static_cast<int>(i);
    if (plan)
      for (std::size_t i = 0; i < plan->plan.compras.size(); ++i)
        if (plan->plan.compras[i].poligono->id == mapa_[k].id) in.compra = static_cast<int>(i);
    bool con_valor = false;
    if (mapa_modo_ == 1 && in.dato >= 0) {
      const auto& p = d.poligonos[in.dato];
      in.valor = std::accumulate(p.E.begin(), p.E.end(), 0) / p.area;
      con_valor = true;
    } else if (mapa_modo_ == 3 && in.compra >= 0) {
      const auto& c = plan->plan.compras[in.compra];
      if (const Solucion* s = reportada(c)) in.valor = s->costo_compra / c.poligono->area, con_valor = true;
    }
    if (con_valor) vmin = std::min(vmin, in.valor), vmax = std::max(vmax, in.valor);
  }
  auto norm = [&](double v) { return vmax > vmin ? static_cast<float>((v - vmin) / (vmax - vmin)) : 0.5f; };

  auto relleno = [&](std::size_t k) -> ImU32 {
    const Info& in = info[k];
    if (in.dato < 0) return estilo::plano;
    switch (mapa_modo_) {
      case 0: return cfg_.poligonos[in.dato] ? estilo::categorico[0] : estilo::reticula;
      case 1: return estilo::secuencial(norm(in.valor));
      case 2:
        if (in.compra < 0) return estilo::reticula;
        return plan->plan.compras[in.compra].optima ? estilo::bueno : estilo::critico;
      default:
        if (in.compra < 0 || !reportada(plan->plan.compras[in.compra])) return estilo::reticula;
        return estilo::secuencial(norm(in.valor));
    }
  };

  // Lienzo: norte arriba, escala uniforme para que las formas no se deformen.
  // Al lado, el detalle del polígono elegido: el de Compra si está en el plan,
  // o el último clic.
  int sel = mapa_sel_;
  if (plan && compra_sel_ >= 0)
    if (const auto it = mapa_de_id_.find(plan->plan.compras[compra_sel_].poligono->id); it != mapa_de_id_.end())
      sel = it->second;
  const float alto_leyenda = ImGui::GetFrameHeightWithSpacing() * 1.6f;
  const float alto = std::max(200.0f, ImGui::GetContentRegionAvail().y - alto_leyenda);
  const float ancho_detalle = std::max(ImGui::GetFontSize() * 24, ImGui::GetContentRegionAvail().x * 0.42f);
  ImGui::BeginChild("lienzo_mapa", ImVec2(std::max(200.0f, ImGui::GetContentRegionAvail().x - ancho_detalle), alto),
                    ImGuiChildFlags_None, ImGuiWindowFlags_NoScrollWithMouse | ImGuiWindowFlags_NoScrollbar);
  const ImVec2 p0 = ImGui::GetCursorScreenPos();
  ImVec2 tam = ImGui::GetContentRegionAvail();
  tam = ImVec2(std::max(tam.x, 120.0f), std::max(tam.y, 120.0f));
  float xmax = 0, ymax = 0;
  for (const auto& pm : mapa_)
    for (const auto& v : pm.v) xmax = std::max(xmax, v.x), ymax = std::max(ymax, v.y);
  const float margen = ImGui::GetFontSize() * 1.5f;
  // Escala con zoom 1: todo el cerco cabe. La vista se guarda como centro (m) y zoom.
  const float s_ajuste = std::max(1e-3f, std::min((tam.x - 2 * margen) / xmax, (tam.y - 2 * margen) / ymax));
  constexpr float kZoomMax = 400;
  if (mapa_centro_obj_.x < 0) mapa_centro_obj_ = ImVec2(xmax / 2, ymax / 2);
  if (mapa_centro_.x < 0) mapa_centro_ = mapa_centro_obj_;  // la primera vez, sin animar
  if (mapa_encuadrar_ >= 0 && mapa_encuadrar_ < static_cast<int>(mapa_.size())) {
    ImVec2 lo(FLT_MAX, FLT_MAX), hi(-FLT_MAX, -FLT_MAX);
    for (const auto& v : mapa_[mapa_encuadrar_].v)
      lo = ImVec2(std::min(lo.x, v.x), std::min(lo.y, v.y)), hi = ImVec2(std::max(hi.x, v.x), std::max(hi.y, v.y));
    mapa_centro_obj_ = ImVec2((lo.x + hi.x) / 2, (lo.y + hi.y) / 2);
    mapa_zoom_obj_ =
        std::clamp(0.85f * std::min(tam.x / (hi.x - lo.x), tam.y / (hi.y - lo.y)) / s_ajuste, 1.0f, kZoomMax);
  }
  mapa_encuadrar_ = -1;
  const ImVec2 cc(p0.x + tam.x / 2, p0.y + tam.y / 2);

  ImGui::InvisibleButton("mapa", tam);
  const bool sobre = ImGui::IsItemHovered();
  const ImGuiIO& io = ImGui::GetIO();
  const ImVec2 raton = io.MousePos;
  // Rueda: zoom alrededor del ratón, sobre el objetivo para que varios tics
  // seguidos se acumulen. Arrastre: mover. Un clic sin arrastre selecciona.
  if (sobre && io.MouseWheel != 0) {
    const float s0 = s_ajuste * mapa_zoom_obj_;
    const ImVec2 bajo(mapa_centro_obj_.x + (raton.x - cc.x) / s0, mapa_centro_obj_.y - (raton.y - cc.y) / s0);
    mapa_zoom_obj_ = std::clamp(mapa_zoom_obj_ * std::pow(1.2f, io.MouseWheel), 1.0f, kZoomMax);
    const float s1 = s_ajuste * mapa_zoom_obj_;
    mapa_centro_obj_ = ImVec2(bajo.x - (raton.x - cc.x) / s1, bajo.y + (raton.y - cc.y) / s1);
  }
  if (ImGui::IsItemActive() && ImGui::IsMouseDragging(ImGuiMouseButton_Left, 3.0f)) {
    const float s0 = s_ajuste * mapa_zoom_;
    const ImVec2 d(-io.MouseDelta.x / s0, io.MouseDelta.y / s0);
    mapa_centro_ = ImVec2(mapa_centro_.x + d.x, mapa_centro_.y + d.y);
    mapa_centro_obj_ = ImVec2(mapa_centro_obj_.x + d.x, mapa_centro_obj_.y + d.y);
  }
  // El zoom se interpola en escala logarítmica: cada duplicación tarda lo mismo.
  mapa_zoom_ = std::exp(anim::suavizar(std::log(mapa_zoom_), std::log(mapa_zoom_obj_), 16, 1e-4f));
  mapa_centro_ = anim::suavizar(mapa_centro_, mapa_centro_obj_, 16, 0.01f / mapa_zoom_);
  const bool clic = ImGui::IsItemDeactivated() && io.MouseDragMaxDistanceSqr[ImGuiMouseButton_Left] < 9.0f;
  const bool doble = sobre && ImGui::IsMouseDoubleClicked(ImGuiMouseButton_Left);

  const float s = s_ajuste * mapa_zoom_;
  auto pantalla = [&](ImVec2 m) {
    return ImVec2(cc.x + (m.x - mapa_centro_.x) * s, cc.y - (m.y - mapa_centro_.y) * s);
  };
  const ImVec2 raton_m(mapa_centro_.x + (raton.x - cc.x) / s, mapa_centro_.y - (raton.y - cc.y) / s);
  const ImVec2 vista_lo(mapa_centro_.x - tam.x / 2 / s, mapa_centro_.y - tam.y / 2 / s);
  const ImVec2 vista_hi(mapa_centro_.x + tam.x / 2 / s, mapa_centro_.y + tam.y / 2 / s);
  ImDrawList* dl = ImGui::GetWindowDrawList();
  dl->PushClipRect(p0, ImVec2(p0.x + tam.x, p0.y + tam.y), true);

  // Las plantas se dibujan cuando cada una ocupa al menos un par de píxeles,
  // y aparecen con un fundido mientras crecen de 2 a 5 px al acercarse.
  auto con_plantas = [&](std::size_t k) {
    return mapa_plantas_ && plan && k < plantacion_.size() && plantacion_[k].grupo >= 0 && plantacion_[k].a * s >= 2.0f;
  };
  auto plantas_t = [&](std::size_t k) { return con_plantas(k) ? std::clamp((plantacion_[k].a * s - 2.0f) / 3.0f, 0.0f, 1.0f) : 0.0f; };

  // Relleno mostrado de cada polígono: se funde hacia el del modo actual, así
  // cambiar de modo o incluir un polígono no salta de un color a otro.
  const bool primera = mapa_anim_.size() != mapa_.size();
  if (primera) mapa_anim_.assign(mapa_.size(), {});
  for (std::size_t k = 0; k < mapa_.size(); ++k) {
    const float alfa = info[k].dato < 0 ? 0.6f : 0.9f - 0.65f * plantas_t(k);
    const ImVec4 obj = estilo::v4(con_alfa(relleno(k), alfa));
    mapa_anim_[k].color = primera ? obj : anim::suavizar(mapa_anim_[k].color, obj, 10);
  }

  int hk = -1;
  std::vector<ImVec2> pts;
  for (std::size_t k = 0; k < mapa_.size(); ++k) {
    const auto& pm = mapa_[k];
    pts.clear();
    for (const auto& v : pm.v) pts.push_back(pantalla(v));
    dl->AddConcavePolyFilled(pts.data(), static_cast<int>(pts.size()),
                             ImGui::ColorConvertFloat4ToU32(mapa_anim_[k].color));
    dl->AddPolyline(pts.data(), static_cast<int>(pts.size()), con_alfa(estilo::tinta_2, 0.55f), ImDrawFlags_Closed, 1.0f);
    if (sobre && dentro(pm.v, raton_m)) hk = static_cast<int>(k);
  }

  // Plantas, coloreadas por género como en la vista Mosaico; con la clave
  // escrita cuando hay espacio. Solo las que caen en la vista.
  std::vector<std::string> claves;
  if (plan)
    for (const auto& e : plan->datos->especies) claves.push_back(clave_especie(e.nombre));
  ImFont* fuente = ImGui::GetFont();
  for (std::size_t k = 0; k < mapa_.size(); ++k) {
    if (!con_plantas(k)) continue;
    const auto& pl = plantacion_[k];
    if (pl.hi.x < vista_lo.x || pl.lo.x > vista_hi.x || pl.hi.y < vista_lo.y || pl.lo.y > vista_hi.y) continue;
    const float r = 0.4f * pl.a * s, aparece = plantas_t(k);
    const float letra_k = std::min(ImGui::GetFontSize(), r * 0.9f);
    for (std::size_t i = 0; i < pl.pos.size(); ++i) {
      const ImVec2 q = pl.pos[i];
      if (q.x < vista_lo.x - pl.a || q.x > vista_hi.x + pl.a || q.y < vista_lo.y - pl.a || q.y > vista_hi.y + pl.a)
        continue;
      const ImVec2 c = pantalla(q);
      const ImU32 col = con_alfa(estilo::categorico[generos_.de_especie[pl.especie[i]]], aparece);
      if (r < 2.0f)
        dl->AddRectFilled(ImVec2(c.x - 1, c.y - 1), ImVec2(c.x + 1, c.y + 1), col);
      else
        dl->AddCircleFilled(c, r, col, r < 6 ? 6 : 0);
      if (letra_k >= 9.0f) {
        const std::string& t = claves[pl.especie[i]];
        const ImVec2 ts = fuente->CalcTextSizeA(letra_k, FLT_MAX, 0, t.c_str());
        dl->AddText(fuente, letra_k, ImVec2(c.x - ts.x / 2, c.y - ts.y / 2), estilo::tinta_oscura, t.c_str());
      }
    }
  }

  // Planta bajo el ratón: la más cercana del polígono, a menos de media distancia.
  int hp = -1;
  if (hk >= 0 && con_plantas(hk) && plantacion_[hk].a * s >= 6.0f) {
    const auto& pl = plantacion_[hk];
    float mejor = pl.a * pl.a / 4;
    for (std::size_t i = 0; i < pl.pos.size(); ++i) {
      const float dx = pl.pos[i].x - raton_m.x, dy = pl.pos[i].y - raton_m.y;
      if (dx * dx + dy * dy < mejor) mejor = dx * dx + dy * dy, hp = static_cast<int>(i);
    }
    if (hp >= 0) dl->AddCircle(pantalla(pl.pos[hp]), 0.5f * pl.a * s, estilo::tinta, 0, 2.0f);
  }

  // Número del mapa y área, como en la lámina; el área solo si cabe.
  const float letra = ImGui::GetFontSize() * 1.15f, letra_2 = ImGui::GetFontSize() * 0.8f;
  for (std::size_t k = 0; k < mapa_.size(); ++k) {
    const auto& pm = mapa_[k];
    const ImVec2 c = pantalla(pm.rotulo);
    const ImVec4 rc = mapa_anim_[k].color;
    const ImU32 t = info[k].dato < 0 ? estilo::tinta_tenue
                                     : tinta_sobre(ImGui::ColorConvertFloat4ToU32(ImVec4(rc.x, rc.y, rc.z, 1)));
    const std::string num = std::to_string(pm.etiqueta);
    const bool cabe = pm.holgura * s > letra * 1.1f;
    const ImVec2 tn = fuente->CalcTextSizeA(letra, FLT_MAX, 0, num.c_str());
    const ImVec2 pn(c.x - tn.x / 2, c.y - tn.y / (cabe ? 1.0f : 2.0f));
    if (con_plantas(k)) {
      // Sobre las plantas el número necesita un fondo propio para leerse.
      const float m = letra * 0.3f;
      dl->AddRectFilled(ImVec2(pn.x - m, pn.y - m * 0.3f), ImVec2(pn.x + tn.x + m, pn.y + tn.y + m * 0.3f),
                        con_alfa(estilo::elevada, 0.85f), letra * 0.4f);
      dl->AddText(fuente, letra, pn, estilo::tinta, num.c_str());
      continue;
    }
    dl->AddText(fuente, letra, pn, t, num.c_str());
    if (cabe) {
      const std::string sub = info[k].dato < 0 ? "fuera" : std::format("{:.2f} ha", d.poligonos[info[k].dato].area);
      const ImVec2 ts = fuente->CalcTextSizeA(letra_2, FLT_MAX, 0, sub.c_str());
      dl->AddText(fuente, letra_2, ImVec2(c.x - ts.x / 2, c.y), con_alfa(t, 0.8f), sub.c_str());
    }
  }

  // Contornos del polígono en detalle y del que está bajo el ratón.
  // Ambos entran y salen con un fundido; el de la selección va encima.
  for (std::size_t k = 0; k < mapa_.size(); ++k) {
    auto& a = mapa_anim_[k];
    a.sobre = anim::suavizar(a.sobre, static_cast<int>(k) == hk ? 1.0f : 0.0f, 18);
    a.marca = anim::suavizar(a.marca, static_cast<int>(k) == sel ? 1.0f : 0.0f, 14);
    if (a.sobre < 0.01f && a.marca < 0.01f) continue;
    pts.clear();
    for (const auto& v : mapa_[k].v) pts.push_back(pantalla(v));
    if (a.sobre >= 0.01f)
      dl->AddPolyline(pts.data(), static_cast<int>(pts.size()), con_alfa(estilo::tinta, a.sobre), ImDrawFlags_Closed,
                      1.0f + a.sobre);
    if (a.marca >= 0.01f)
      dl->AddPolyline(pts.data(), static_cast<int>(pts.size()), con_alfa(estilo::aviso, a.marca), ImDrawFlags_Closed,
                      1.0f + 2.0f * a.marca);
  }

  // Escala gráfica y norte.
  {
    float metros = 1;
    for (float m : {1.0f, 2.0f, 5.0f, 10.0f, 20.0f, 50.0f, 100.0f, 200.0f, 250.0f, 500.0f, 1000.0f})
      if (m * s <= tam.x * 0.25f) metros = m;
    const ImVec2 a(p0.x + margen * 0.5f, p0.y + tam.y - margen * 0.6f), b(a.x + metros * s, a.y);
    dl->AddLine(a, b, estilo::tinta_2, 2.0f);
    dl->AddLine(ImVec2(a.x, a.y - 4), ImVec2(a.x, a.y + 4), estilo::tinta_2, 2.0f);
    dl->AddLine(ImVec2(b.x, b.y - 4), ImVec2(b.x, b.y + 4), estilo::tinta_2, 2.0f);
    const std::string et = std::format("{:.0f} m", metros);
    dl->AddText(ImVec2(b.x + 6, a.y - ImGui::GetFontSize() / 2), estilo::tinta_2, et.c_str());

    const float h = ImGui::GetFontSize();
    const ImVec2 n(p0.x + tam.x - margen, p0.y + margen * 0.4f);
    dl->AddTriangleFilled(ImVec2(n.x, n.y + h * 0.9f), ImVec2(n.x - h * 0.4f, n.y + h * 1.8f),
                          ImVec2(n.x + h * 0.4f, n.y + h * 1.8f), estilo::tinta_2);
    dl->AddText(ImVec2(n.x - ImGui::CalcTextSize("N").x / 2, n.y - h * 0.1f), estilo::tinta_2, "N");
  }
  dl->PopClipRect();

  // Detalle y clic sobre el polígono bajo el ratón.
  if (hk >= 0) {
    const auto& pm = mapa_[hk];
    const Info& in = info[hk];
    ImGui::BeginTooltip();
    if (hp >= 0) {
      const auto& pl = plantacion_[hk];
      const auto& e = plan->datos->especies[pl.especie[hp]];
      ImGui::Text("%s (%s)", e.nombre.c_str(), claves[pl.especie[hp]].c_str());
      ImGui::TextDisabled("Mosaico %d · plantas cada %.1f m", pl.grupo + 1, pl.a);
      ImGui::Separator();
    }
    if (in.dato < 0) {
      ImGui::Text("Polígono %d del mapa", pm.etiqueta);
      ImGui::TextDisabled("Fuera del programa de reforestación (%.2f ha trazadas)", pm.area);
    } else {
      const auto& p = d.poligonos[in.dato];
      const int E = std::accumulate(p.E.begin(), p.E.end(), 0);
      ImGui::Text("Polígono %d del mapa  ·  P%d en el modelo", pm.etiqueta, p.id);
      ImGui::TextDisabled("%.2f ha (trazada sobre la lámina: %.2f ha)", p.area, pm.area);
      ImGui::Text("Existentes: %d plantas (%.0f/ha)", E, E / p.area);
      ImGui::Text("%s del próximo plan", cfg_.poligonos[in.dato] ? "Incluido" : "Excluido");
      if (in.compra >= 0) {
        const auto& c = plan->plan.compras[in.compra];
        ImGui::Separator();
        ImGui::Text("Plan: %s", c.optima ? "factible" : c.libre ? "infactible (sin presupuesto suficiente)" : "sin banda");
        if (const Solucion* sol = reportada(c))
          ImGui::Text("Compra $%.0f/ha · %d plantas", sol->costo_compra / p.area, std::accumulate(sol->x.begin(), sol->x.end(), 0));
        if (const int g = plan->grupo_de[in.compra]; g >= 0) ImGui::Text("Mosaico %d", g + 1);
      }
      ImGui::TextDisabled("Clic: ver su configuración");
    }
    ImGui::EndTooltip();

    if (doble) mapa_encuadrar_ = hk;
    if (clic || doble) {
      mapa_sel_ = hk;
      sel = hk;
      compra_sel_ = in.compra;  // -1 si no está en el plan: Compra queda sin selección
      if (in.compra >= 0 && plan->grupo_de[in.compra] >= 0) mosaico_sel_ = plan->grupo_de[in.compra];
    }
  }
  ImGui::EndChild();
  ImGui::SameLine();
  ImGui::BeginChild("detalle_mapa", ImVec2(0, alto), ImGuiChildFlags_Borders);
  if (sel >= 0) detalle_mapa(sel);
  else estilo::estado_vacio("Haz clic en un polígono para ver la configuración que encontró el modelo.");
  ImGui::EndChild();

  // Leyenda.
  switch (mapa_modo_) {
    case 0: {
      double ha = 0;
      int n = 0;
      for (std::size_t i = 0; i < d.poligonos.size(); ++i)
        if (cfg_.poligonos[i]) ha += d.poligonos[i].area, ++n;
      muestra(estilo::categorico[0], std::format("Incluido ({}, {:.2f} ha)", n, ha).c_str());
      muestra(estilo::reticula, "Excluido");
      break;
    }
    case 1: rampa(vmin, vmax, "plantas existentes / ha"); break;
    case 2:
      muestra(estilo::bueno, "Factible");
      muestra(estilo::critico, "Infactible");
      muestra(estilo::reticula, "No incluido en el plan");
      break;
    default:
      if (vmax >= vmin) rampa(vmin, vmax, "$/ha de compra");
      muestra(estilo::reticula, "Sin compra");
      break;
  }
  muestra(con_alfa(estilo::plano, 0.6f), "Fuera del programa");
  ImGui::NewLine();
  ImGui::TextDisabled("Contornos trazados sobre la lámina del cerco (docs/misc, diapositiva 8); números del mapa, "
                      "no del modelo. Aproximados: ±5 m.");
  ImGui::End();
}

void App::detalle_mapa(int k) {
  const auto& pm = mapa_[k];
  ImGui::PushFont(estilo::fuente_titulo, ImGui::GetStyle().FontSizeBase * 1.3f);
  ImGui::Text("Polígono %d del mapa", pm.etiqueta);
  ImGui::PopFont();
  int dato = -1;
  for (std::size_t i = 0; i < datos_->poligonos.size(); ++i)
    if (datos_->poligonos[i].id == pm.id) dato = static_cast<int>(i);
  if (dato < 0) {
    ImGui::TextDisabled("Fuera del programa de reforestación: no tiene existencias ni compra (%.2f ha trazadas).",
                        pm.area);
    return;
  }
  const auto& p = datos_->poligonos[dato];
  ImGui::TextDisabled("P%d en el modelo · %.2f ha", p.id, p.area);
  bool incluido = cfg_.poligonos[dato];
  if (anim::casilla("Incluir en el próximo plan", &incluido)) cfg_.poligonos[dato] = incluido;

  int ic = -1;
  if (plan_)
    for (std::size_t i = 0; i < plan_->plan.compras.size(); ++i)
      if (plan_->plan.compras[i].poligono->id == p.id) ic = static_cast<int>(i);

  // Sin resultado del modelo: solo lo que ya hay en campo.
  if (ic < 0) {
    ImGui::Spacing();
    ImGui::TextDisabled(plan_ ? "No se incluyó en el último plan." : "Ejecuta el plan para ver su compra y su mosaico.");
    if (ImGui::BeginTable("existentes", 3, ImGuiTableFlags_RowBg | ImGuiTableFlags_BordersInnerH)) {
      for (const char* h : {"Especie", "Existentes E", "Plan n0·A"}) ImGui::TableSetupColumn(h);
      ImGui::TableHeadersRow();
      for (std::size_t s = 0; s < datos_->especies.size(); ++s) {
        ImGui::TableNextRow();
        ImGui::TableNextColumn();
        ImGui::TextUnformatted(datos_->especies[s].nombre.c_str());
        ImGui::TableNextColumn();
        ImGui::Text("%d", p.E[s]);
        ImGui::TableNextColumn();
        ImGui::Text("%.1f", datos_->especies[s].n0 * p.area);
      }
      ImGui::EndTable();
    }
    return;
  }

  // Lo que encontró el modelo: compra por especie y mosaico de plantación.
  const auto& r = *plan_;
  const auto& d = *r.datos;
  const auto& c = r.plan.compras[ic];
  const Solucion* s = reportada(c);
  if (c.optima) {
    estilo::chip("factible", estilo::bueno);
  } else {
    estilo::chip(c.libre ? "infactible" : "sin banda", estilo::critico);
    if (c.libre) {
      ImGui::SameLine();
      ImGui::TextDisabled("se muestra el óptimo sin presupuesto");
    }
  }
  if (s) {
    ImGui::Text("Compra $%.0f/ha · con reposición $%.0f/ha · %d plantas", s->costo_compra / p.area,
                s->costo_total() / p.area, std::accumulate(s->x.begin(), s->x.end(), 0));
    if (c.B_minimo) ImGui::TextDisabled("Presupuesto mínimo factible: $%.0f/ha (α = %.3f)", *c.B_minimo, r.alfa);
    if (ImGui::BeginTable("compra_poligono", 5, ImGuiTableFlags_RowBg | ImGuiTableFlags_BordersInnerH)) {
      for (const char* h : {"Clave", "Existentes", "Meta n", "Compra x*", "Déficit"}) ImGui::TableSetupColumn(h);
      ImGui::TableHeadersRow();
      for (std::size_t sp = 0; sp < d.especies.size(); ++sp) {
        ImGui::TableNextRow();
        ImGui::TableNextColumn();
        ImGui::TextUnformatted(clave_especie(d.especies[sp].nombre).c_str());
        ImGui::SetItemTooltip("%s", d.especies[sp].nombre.c_str());
        ImGui::TableNextColumn();
        ImGui::Text("%d", c.poligono->E[sp]);
        ImGui::TableNextColumn();
        ImGui::Text("%d", s->n[sp]);
        ImGui::TableNextColumn();
        ImGui::Text("%d", s->x[sp]);
        ImGui::TableNextColumn();
        ImGui::Text("%.2f", s->deficit[sp]);
      }
      ImGui::EndTable();
    }
  }

  const int g = r.grupo_de[ic];
  ImGui::Spacing();
  if (g < 0) {
    ImGui::TextDisabled("No necesita plantación: las existentes cubren la meta.");
    return;
  }
  const Espacial& e = r.plan.espacial[g];
  ImGui::SeparatorText(std::format("Mosaico {} · coeficiente {:.3f}", g + 1, e.coeficiente()).c_str());
  ImGui::SameLine();
  if (anim::boton_chico("Abrir en Mosaico")) {
    mosaico_sel_ = g;
    ImGui::SetWindowFocus(kMosaico);
  }
  ImGui::SameLine();
  if (anim::boton_chico("Encuadrar en el mapa")) mapa_encuadrar_ = k;
  if (k < static_cast<int>(plantacion_.size()) && plantacion_[k].grupo >= 0) {
    const auto& pl = plantacion_[k];
    ImGui::TextDisabled("En el mapa: %zu posiciones al tresbolillo cada %.1f m (%d plantas compradas).", pl.pos.size(),
                        pl.a, s ? std::accumulate(s->x.begin(), s->x.end(), 0) : 0);
  }
  if (e.poligonos.size() > 1) {
    std::string otros;
    for (int id : e.poligonos)
      if (id != p.id) {
        const int et = etiqueta_mapa(id);
        otros += (otros.empty() ? "" : ", ") + (et >= 0 ? std::to_string(et) : "P" + std::to_string(id));
      }
    ImGui::TextDisabled("Comparte la clave con los polígonos %s del mapa.", otros.c_str());
  }
  const float alto_leyenda = color_modo_ == 0 ? ImGui::GetFrameHeightWithSpacing() * 1.2f : 0;
  ImGui::BeginChild("mosaico_poligono", ImVec2(0, std::max(140.0f, ImGui::GetContentRegionAvail().y - alto_leyenda)));
  lienzo_mosaico(r, e.mejor);
  ImGui::EndChild();
  if (color_modo_ == 0) leyenda_generos(d);
}

void App::sembrar_mapa() {
  plantacion_.assign(mapa_.size(), {});
  if (!plan_) return;
  const auto& r = *plan_;
  constexpr float kAltoFila = 0.8660254f;  // √3/2: separación entre filas del tresbolillo
  for (std::size_t k = 0; k < mapa_.size(); ++k) {
    const auto& pm = mapa_[k];
    for (std::size_t i = 0; i < r.plan.compras.size(); ++i) {
      if (r.plan.compras[i].poligono->id != pm.id || r.grupo_de[i] < 0) continue;
      const Solucion* sol = reportada(r.plan.compras[i]);
      const int total = sol ? std::accumulate(sol->x.begin(), sol->x.end(), 0) : 0;
      if (total <= 0) break;

      // Cada planta ocupa a²·√3/2 en el tresbolillo; a sale de repartir el área
      // trazada entre las plantas compradas.
      auto& pl = plantacion_[k];
      pl.grupo = r.grupo_de[i];
      pl.a = static_cast<float>(std::sqrt(pm.area * 10'000 / (kAltoFila * total)));
      pl.lo = ImVec2(FLT_MAX, FLT_MAX), pl.hi = ImVec2(-FLT_MAX, -FLT_MAX);
      for (const auto& v : pm.v)
        pl.lo = ImVec2(std::min(pl.lo.x, v.x), std::min(pl.lo.y, v.y)),
        pl.hi = ImVec2(std::max(pl.hi.x, v.x), std::max(pl.hi.y, v.y));

      // Fila 0 al norte, como se lee la clave en la vista Mosaico; cada fila se
      // recorre media posición, igual que las coordenadas axiales del mosaico.
      const auto& asig = r.plan.espacial[pl.grupo].mejor;
      const float h = pl.a * kAltoFila;
      const int filas = static_cast<int>(std::ceil((pl.hi.y - pl.lo.y) / h));
      for (int f = 0; f < filas; ++f) {
        const float y = pl.hi.y - h * (static_cast<float>(f) + 0.5f);
        for (int c = static_cast<int>(std::floor(-0.5f * static_cast<float>(f))) - 1;; ++c) {
          const float x = pl.lo.x + pl.a * (static_cast<float>(c) + 0.5f * static_cast<float>(f) + 0.5f);
          if (x > pl.hi.x) break;
          if (x < pl.lo.x || !dentro(pm.v, ImVec2(x, y))) continue;
          pl.pos.emplace_back(x, y);
          pl.especie.push_back(static_cast<unsigned char>(asig[r.mosaico.indice(f, c)]));
        }
      }
      break;
    }
  }
}

}  // namespace refor::gui
