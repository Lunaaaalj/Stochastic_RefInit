#include <imgui.h>

#include <algorithm>
#include <cfloat>
#include <cmath>
#include <format>
#include <string>

#include "app.hpp"
#include "memetico/individuo.hpp"
#include "salida.hpp"

namespace refor::gui {

namespace {

constexpr float kRaiz3 = 1.7320508f;

// Las 6 direcciones axiales, en el mismo orden que Mosaico; las tres primeras
// "hacia adelante" bastan para recorrer cada arista una vez.
constexpr int kAdelante[3][2] = {{0, 1}, {1, -1}, {1, 0}};
constexpr int kVecinas[6][2] = {{-1, 0}, {-1, 1}, {0, -1}, {0, 1}, {1, -1}, {1, 0}};

using estilo::con_alfa;

// Coordenadas de pantalla de la posición (fila, columna) sin envolver: cada
// fila se recorre media posición, así se ve el tresbolillo.
struct Geometria {
  ImVec2 origen;
  float s;  // radio del hexágono
  ImVec2 centro(int f, int c) const {
    return ImVec2(origen.x + kRaiz3 * s * (static_cast<float>(c) + 0.5f * static_cast<float>(f)),
                  origen.y + 1.5f * s * static_cast<float>(f));
  }
};

void hexagono(ImVec2 (&pts)[6], ImVec2 c, float r) {
  for (int k = 0; k < 6; ++k) {
    const float a = (60.0f * static_cast<float>(k) - 90.0f) * 3.14159265f / 180.0f;
    pts[k] = ImVec2(c.x + r * std::cos(a), c.y + r * std::sin(a));
  }
}

}  // namespace

void App::lienzo_mosaico(const ResultadoPlan& r, const memetico::Individuo& asig, const Resaltado* res) {
  const auto& m = r.mosaico;
  const auto& d = *r.datos;
  const auto& w = *r.w;
  const int F = m.filas(), C = m.columnas();

  // Competencia local de cada posición: Σ W con sus 6 vecinas.
  std::vector<double> local(m.num_posiciones(), 0.0);
  for (int v = 0; v < m.num_posiciones(); ++v)
    for (int x : m.vecinas(v)) local[v] += w(asig[v], asig[x]);
  const auto [it_min, it_max] = std::minmax_element(local.begin(), local.end());
  const double* lmin = res ? &res->local_min : &*it_min;
  const double* lmax = res ? &res->local_max : &*it_max;
  double wmin = DBL_MAX, wmax = -DBL_MAX;
  for (const auto& [u, v] : m.aristas()) {
    wmin = std::min(wmin, w(asig[u], asig[v]));
    wmax = std::max(wmax, w(asig[u], asig[v]));
  }
  auto norm = [](double v, double lo, double hi) { return hi > lo ? static_cast<float>((v - lo) / (hi - lo)) : 0.5f; };

  // Rango dibujado en coordenadas sin envolver.
  const int f0 = replicar_ ? -F : 0, f1 = replicar_ ? 2 * F : F;
  const int c0 = replicar_ ? -C : 0, c1 = replicar_ ? 2 * C : C;
  auto dentro = [&](int f, int c) { return f >= f0 && f < f1 && c >= c0 && c < c1; };
  auto central = [&](int f, int c) { return f >= 0 && f < F && c >= 0 && c < C; };

  // Escala para que todo quepa en el lienzo.
  const ImVec2 p0 = ImGui::GetCursorScreenPos();
  ImVec2 tam = ImGui::GetContentRegionAvail();
  tam.y = std::max(tam.y, 120.0f);
  float xmin = FLT_MAX, xmax = -FLT_MAX;
  for (int f = f0; f < f1; ++f) {
    xmin = std::min(xmin, kRaiz3 * (static_cast<float>(c0) + 0.5f * static_cast<float>(f)));
    xmax = std::max(xmax, kRaiz3 * (static_cast<float>(c1 - 1) + 0.5f * static_cast<float>(f)));
  }
  const float ancho_u = xmax - xmin + kRaiz3, alto_u = 1.5f * static_cast<float>(f1 - f0 - 1) + 2.0f;
  const float margen = 8;
  const float s = std::max(4.0f, std::min((tam.x - 2 * margen) / ancho_u, (tam.y - 2 * margen) / alto_u));
  Geometria geo{ImVec2(0, 0), s};
  geo.origen = ImVec2(p0.x + margen + (tam.x - 2 * margen - ancho_u * s) / 2 - xmin * s + kRaiz3 * s / 2,
                      p0.y + margen + (tam.y - 2 * margen - alto_u * s) / 2 + s - 1.5f * s * static_cast<float>(f0));

  ImGui::InvisibleButton("lienzo", tam);
  const bool sobre = ImGui::IsItemHovered();
  const ImVec2 raton = ImGui::GetIO().MousePos;
  ImDrawList* dl = ImGui::GetWindowDrawList();
  dl->PushClipRect(p0, ImVec2(p0.x + tam.x, p0.y + tam.y), true);

  auto relleno = [&](int v) {
    return color_modo_ == 0 ? estilo::categorico[generos_.de_especie[asig[v]]]
                            : estilo::secuencial(norm(local[v], *lmin, *lmax));
  };
  auto tinta_sobre = [&](int v) {
    return color_modo_ == 0 || norm(local[v], *lmin, *lmax) > 0.45f ? estilo::tinta_oscura : estilo::tinta;
  };

  // Celdas; la de abajo del ratón se recuerda para el resaltado.
  int hf = 0, hc = 0, hv = -1;
  ImVec2 pts[6];
  for (int f = f0; f < f1; ++f)
    for (int c = c0; c < c1; ++c) {
      const int v = m.indice(f, c);
      const ImVec2 ctr = geo.centro(f, c);
      const float a = central(f, c) ? 1.0f : 0.35f;
      hexagono(pts, ctr, s * 0.94f);  // 6 % de margen: separación visible entre vecinas
      dl->AddConvexPolyFilled(pts, 6, con_alfa(relleno(v), a));
      const float dx = raton.x - ctr.x, dy = raton.y - ctr.y;
      if (sobre && dx * dx + dy * dy < 0.8f * s * s) hf = f, hc = c, hv = v;
    }

  // Grafo de vecindad: grosor y opacidad crecen con W; se dibuja solo el tramo
  // central de cada arista para no tapar las claves.
  if (aristas_) {
    for (int f = f0; f < f1; ++f)
      for (int c = c0; c < c1; ++c) {
        const int v = m.indice(f, c);
        for (const auto& [df, dc] : kAdelante) {
          const int u = m.indice(f + df, c + dc);
          const float t = norm(w(asig[v], asig[u]), wmin, wmax);
          const bool completa = dentro(f + df, c + dc);
          const float a = central(f, c) || (completa && central(f + df, c + dc)) ? 1.0f : 0.35f;
          const ImVec2 A = geo.centro(f, c), B = geo.centro(f + df, c + dc);
          const float t0 = 0.28f, t1 = completa ? 0.72f : 0.5f;
          dl->AddLine(ImVec2(A.x + (B.x - A.x) * t0, A.y + (B.y - A.y) * t0),
                      ImVec2(A.x + (B.x - A.x) * t1, A.y + (B.y - A.y) * t1),
                      con_alfa(estilo::tinta, a * (0.25f + 0.75f * t)), 1.0f + 4.0f * t);
        }
      }
  }

  // Claves de especie, que es lo que la cuadrilla lee en campo.
  const float letra = std::min(ImGui::GetFontSize(), s * 0.62f);
  if (letra >= 8.0f) {
    ImFont* fuente = ImGui::GetFont();
    for (int f = f0; f < f1; ++f)
      for (int c = c0; c < c1; ++c) {
        const int v = m.indice(f, c);
        const std::string k = clave_especie(d.especies[asig[v]].nombre);
        const ImVec2 ts = fuente->CalcTextSizeA(letra, FLT_MAX, 0, k.c_str());
        const ImVec2 ctr = geo.centro(f, c);
        dl->AddText(fuente, letra, ImVec2(ctr.x - ts.x / 2, ctr.y - ts.y / 2),
                    con_alfa(tinta_sobre(v), central(f, c) ? 1.0f : 0.55f), k.c_str());
      }
  }

  // Contorno del mosaico que se repite, cuando se ven las réplicas.
  if (replicar_) {
    for (int f = 0; f < F; ++f)
      for (int c = 0; c < C; ++c)
        if (f == 0 || f == F - 1 || c == 0 || c == C - 1) {
          hexagono(pts, geo.centro(f, c), s);
          dl->AddPolyline(pts, 6, con_alfa(estilo::tinta_2, 0.5f), ImDrawFlags_Closed, 1.0f);
        }
  }

  // Posiciones marcadas al comparar dos claves.
  if (res && !res->distintas.empty()) {
    for (int f = f0; f < f1; ++f)
      for (int c = c0; c < c1; ++c)
        if (res->distintas[m.indice(f, c)]) {
          hexagono(pts, geo.centro(f, c), s * 0.86f);
          dl->AddPolyline(pts, 6, con_alfa(estilo::aviso, central(f, c) ? 1.0f : 0.4f), ImDrawFlags_Closed, 2.5f);
        }
  }

  // Resaltado y detalle de la posición bajo el ratón.
  if (hv >= 0) {
    for (const auto& [df, dc] : kVecinas) {
      hexagono(pts, geo.centro(hf + df, hc + dc), s * 0.94f);
      dl->AddPolyline(pts, 6, estilo::tinta_2, ImDrawFlags_Closed, 1.5f);
    }
    hexagono(pts, geo.centro(hf, hc), s * 0.98f);
    dl->AddPolyline(pts, 6, estilo::tinta, ImDrawFlags_Closed, 2.5f);

    const int fr = ((hf % F) + F) % F, cr = ((hc % C) + C) % C;
    const auto& e = d.especies[asig[hv]];
    ImGui::BeginTooltip();
    ImGui::Text("%s (%s)", e.nombre.c_str(), clave_especie(e.nombre).c_str());
    ImGui::TextDisabled("Fila %d, columna %d   competencia local %.2f", fr + 1, cr + 1, local[hv]);
    ImGui::Separator();
    for (int x : m.vecinas(hv)) {
      const auto& ex = d.especies[asig[x]];
      ImGui::Text("%-4s %-26s W = %.2f", clave_especie(ex.nombre).c_str(), ex.nombre.c_str(), w(asig[hv], asig[x]));
    }
    ImGui::EndTooltip();
  }
  dl->PopClipRect();
}

void App::leyenda_generos(const Datos& d) {
  for (std::size_t k = 0; k < generos_.nombres.size(); ++k) {
    std::string especies;
    for (std::size_t s = 0; s < d.especies.size(); ++s)
      if (generos_.de_especie[s] == static_cast<int>(k))
        especies += (especies.empty() ? "" : ", ") + clave_especie(d.especies[s].nombre);
    const ImVec2 p = ImGui::GetCursorScreenPos();
    const float h = ImGui::GetTextLineHeight();
    ImGui::GetWindowDrawList()->AddRectFilled(ImVec2(p.x, p.y + 2), ImVec2(p.x + h - 4, p.y + h - 2),
                                              estilo::categorico[k], 3);
    ImGui::Dummy(ImVec2(h, h));
    ImGui::SameLine();
    ImGui::Text("%s (%s)", generos_.nombres[k].c_str(), especies.c_str());
    if (k + 1 < generos_.nombres.size()) ImGui::SameLine(0, ImGui::GetFontSize() * 1.5f);
  }
}

void App::vista_mosaico() {
  if (!ImGui::Begin(kMosaico)) return ImGui::End();
  if (!plan_ || plan_->plan.espacial.empty()) {
    if (plan_) {
      estilo::estado_vacio("Ningún polígono necesita plantación con esta compra.");
    } else {
      ImGui::BeginDisabled(!datos_ || ocupado());
      if (estilo::estado_vacio("Configura el modelo y ejecuta el plan para generar los mosaicos de plantación.",
                               "Ejecutar plan"))
        lanzar_plan();
      ImGui::EndDisabled();
    }
    return ImGui::End();
  }
  const auto& r = *plan_;
  const auto& d = *r.datos;
  const auto& grupos = r.plan.espacial;
  mosaico_sel_ = std::clamp(mosaico_sel_, 0, static_cast<int>(grupos.size()) - 1);

  auto nombre = [&](int k) {
    std::string ids;
    for (std::size_t i = 0; i < grupos[k].poligonos.size(); ++i)
      ids += (i ? ", " : "") + std::to_string(grupos[k].poligonos[i]);
    return std::format("Mosaico {} — {} polígonos: {}", k + 1, grupos[k].poligonos.size(), ids);
  };
  ImGui::SetNextItemWidth(std::min(ImGui::GetContentRegionAvail().x * 0.55f, ImGui::GetFontSize() * 32));
  if (ImGui::BeginCombo("##mosaico", nombre(mosaico_sel_).c_str())) {
    for (int k = 0; k < static_cast<int>(grupos.size()); ++k)
      if (ImGui::Selectable(nombre(k).c_str(), k == mosaico_sel_)) mosaico_sel_ = k;
    ImGui::EndCombo();
  }
  ImGui::SameLine();
  ImGui::RadioButton("Género", &color_modo_, 0);
  ImGui::SameLine();
  ImGui::RadioButton("Competencia local", &color_modo_, 1);
  ImGui::SameLine();
  ImGui::Checkbox("Grafo W", &aristas_);
  ImGui::SetItemTooltip("Dibuja cada par de vecinas; más grueso y opaco cuanto mayor es su penalización W.");
  ImGui::SameLine();
  ImGui::Checkbox("Replicar 3 × 3", &replicar_);
  ImGui::SetItemTooltip("Repite el mosaico como lo hace la cuadrilla: el borde periódico se vuelve visible.");

  const Espacial& g = grupos[mosaico_sel_];
  // Cifra principal: el coeficiente frente al azar.
  estilo::cifra(std::format("{:.3f}", g.coeficiente()).c_str(), "coeficiente de competencia",
                g.coeficiente() < 1 ? estilo::tinta : estilo::aviso);
  ImGui::SameLine();
  ImGui::BeginGroup();
  ImGui::TextDisabled("menor que 1: mejor que plantar al azar");
  ImGui::Text("competencia %.2f (mejor de %zu corridas)   media %.2f ± %.2f   azar %.2f%s", g.mejor_competencia,
              g.competencias.size(), g.media, g.desviacion, g.esperada, g.cancelado ? "   [cancelado]" : "");
  ImGui::EndGroup();

  // Composición del mosaico.
  std::string comp;
  for (std::size_t s = 0; s < g.m_s.size(); ++s)
    if (g.m_s[s]) comp += std::format("{} {}   ", clave_especie(d.especies[s].nombre), g.m_s[s]);
  ImGui::TextDisabled("Composición (%d posiciones): %s", r.mosaico.num_posiciones(), comp.c_str());

  // Leyenda y vista de tabla debajo del lienzo.
  const float alto_leyenda = ImGui::GetFrameHeightWithSpacing() * 2.2f;
  const bool tabla_abierta = ImGui::GetStateStorage()->GetBool(ImGui::GetID("tabla_abierta"), false);
  const float alto_tabla = tabla_abierta ? ImGui::GetTextLineHeightWithSpacing() * (r.mosaico.filas() + 3.5f)
                                         : ImGui::GetFrameHeightWithSpacing();
  ImGui::BeginChild("lienzo", ImVec2(0, std::max(160.0f, ImGui::GetContentRegionAvail().y - alto_leyenda - alto_tabla)));
  lienzo_mosaico(r, g.mejor);
  ImGui::EndChild();

  // Leyenda: colores por género con sus especies, o la escala de competencia.
  if (color_modo_ == 0) {
    leyenda_generos(d);
  } else {
    double lmin = DBL_MAX, lmax = -DBL_MAX;
    for (int v = 0; v < r.mosaico.num_posiciones(); ++v) {
      double l = 0;
      for (int x : r.mosaico.vecinas(v)) l += (*r.w)(g.mejor[v], g.mejor[x]);
      lmin = std::min(lmin, l);
      lmax = std::max(lmax, l);
    }
    ImGui::TextUnformatted("Competencia local");
    ImGui::SameLine();
    estilo::rampa(lmin, lmax, "(suma de W con las 6 vecinas)", "%.2f");
    ImGui::NewLine();
  }

  // La clave como tabla: accesible sin color y lista para copiar.
  const bool abierta = estilo::seccion("Clave de plantación como tabla");
  ImGui::GetStateStorage()->SetBool(ImGui::GetID("tabla_abierta"), abierta);
  if (abierta) {
    std::string tsv;
    for (int f = 0; f < r.mosaico.filas(); ++f)
      for (int c = 0; c < r.mosaico.columnas(); ++c)
        tsv += clave_especie(d.especies[g.mejor[r.mosaico.indice(f, c)]].nombre) +
               (c + 1 < r.mosaico.columnas() ? "\t" : "\n");
    if (ImGui::SmallButton("Copiar al portapapeles")) ImGui::SetClipboardText(tsv.c_str());
    ImGui::SameLine();
    ImGui::TextDisabled("cada fila se recorre media posición respecto a la anterior");
    if (ImGui::BeginTable("clave", r.mosaico.columnas() + 1,
                          ImGuiTableFlags_Borders | ImGuiTableFlags_SizingFixedFit | ImGuiTableFlags_ScrollX)) {
      for (int f = 0; f < r.mosaico.filas(); ++f) {
        ImGui::TableNextRow();
        ImGui::TableNextColumn();
        ImGui::TextDisabled("Fila %d", f + 1);
        for (int c = 0; c < r.mosaico.columnas(); ++c) {
          ImGui::TableNextColumn();
          ImGui::TextUnformatted(clave_especie(d.especies[g.mejor[r.mosaico.indice(f, c)]].nombre).c_str());
        }
      }
      ImGui::EndTable();
    }
  }
  ImGui::End();
}

}  // namespace refor::gui
