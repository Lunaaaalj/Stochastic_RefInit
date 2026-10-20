#include "animacion.hpp"

#include <algorithm>
#include <cmath>

namespace refor::gui::anim {

namespace {

bool en_curso = false, en_curso_antes = false;

float factor(float velocidad) {
  // Tope de 1/20 s: tras un reposo largo el primer cuadro trae un dt enorme y
  // sin tope la animación saltaría directo al final.
  const float dt = std::min(ImGui::GetIO().DeltaTime, 0.05f);
  return 1.0f - std::exp(-velocidad * dt);
}

ImVec4 col(ImGuiCol c) { return ImGui::GetStyle().Colors[c]; }

// Estado de un widget en el almacén de la ventana: si estaba bajo el ratón y
// pulsado en el cuadro anterior, y cuánto de cada transición lleva.
struct Transicion {
  ImGuiID id;
  float sobre, activo;
};

Transicion empezar(const char* etiqueta) {
  const ImGuiID id = ImGui::GetID(etiqueta);
  ImGuiStorage* st = ImGui::GetStateStorage();
  const bool sobre = st->GetBool(id + 1), activo = st->GetBool(id + 2);
  return {id, valor(id + 3, sobre ? 1.0f : 0.0f, 16), valor(id + 4, activo ? 1.0f : 0.0f, 28)};
}

void terminar(const Transicion& t) {
  ImGuiStorage* st = ImGui::GetStateStorage();
  st->SetBool(t.id + 1, ImGui::IsItemHovered());
  st->SetBool(t.id + 2, ImGui::IsItemActive());
}

// Empuja el mismo color interpolado en las tres variantes (normal, sobre,
// activo) de un elemento, para que ImGui dibuje el nuestro en cualquier caso.
void empujar(ImGuiCol base, ImGuiCol sobre, ImGuiCol activo, ImVec4 c) {
  ImGui::PushStyleColor(base, c);
  ImGui::PushStyleColor(sobre, c);
  ImGui::PushStyleColor(activo, c);
}

}  // namespace

float suavizar(float actual, float objetivo, float velocidad, float eps) {
  const float r = actual + (objetivo - actual) * factor(velocidad);
  if (std::abs(objetivo - r) <= eps) return objetivo;
  en_curso = true;
  return r;
}

ImVec2 suavizar(ImVec2 actual, ImVec2 objetivo, float velocidad, float eps) {
  return ImVec2(suavizar(actual.x, objetivo.x, velocidad, eps), suavizar(actual.y, objetivo.y, velocidad, eps));
}

ImVec4 suavizar(ImVec4 actual, ImVec4 objetivo, float velocidad) {
  constexpr float eps = 1.0f / 512;  // por debajo de un paso de color
  return ImVec4(suavizar(actual.x, objetivo.x, velocidad, eps), suavizar(actual.y, objetivo.y, velocidad, eps),
                suavizar(actual.z, objetivo.z, velocidad, eps), suavizar(actual.w, objetivo.w, velocidad, eps));
}

float valor(ImGuiID id, float objetivo, float velocidad, float inicial) {
  ImGuiStorage* st = ImGui::GetStateStorage();
  float* v = st->GetFloatRef(id, inicial >= 0 ? inicial : objetivo);
  *v = suavizar(*v, objetivo, velocidad);
  return *v;
}

ImVec4 mezcla(ImVec4 a, ImVec4 b, float t) {
  return ImVec4(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t, a.w + (b.w - a.w) * t);
}

ImU32 mezcla(ImU32 a, ImU32 b, float t) {
  return ImGui::ColorConvertFloat4ToU32(
      mezcla(ImGui::ColorConvertU32ToFloat4(a), ImGui::ColorConvertU32ToFloat4(b), t));
}

void nuevo_cuadro() {
  en_curso_antes = en_curso;
  en_curso = false;
}

void seguir() { en_curso = true; }

bool animando() { return en_curso || en_curso_antes; }

bool boton_colores(const char* etiqueta, ImVec2 tam, ImU32 base, ImU32 sobre, ImU32 activo) {
  const Transicion t = empezar(etiqueta);
  const ImVec4 c = mezcla(mezcla(ImGui::ColorConvertU32ToFloat4(base), ImGui::ColorConvertU32ToFloat4(sobre), t.sobre),
                          ImGui::ColorConvertU32ToFloat4(activo), t.activo);
  empujar(ImGuiCol_Button, ImGuiCol_ButtonHovered, ImGuiCol_ButtonActive, c);
  const bool r = ImGui::Button(etiqueta, tam);
  ImGui::PopStyleColor(3);
  terminar(t);
  return r;
}

bool boton(const char* etiqueta, ImVec2 tam) {
  return boton_colores(etiqueta, tam, ImGui::GetColorU32(ImGuiCol_Button), ImGui::GetColorU32(ImGuiCol_ButtonHovered),
                       ImGui::GetColorU32(ImGuiCol_ButtonActive));
}

bool boton_chico(const char* etiqueta) {
  // Como SmallButton: sin relleno vertical, para que quepa en una línea de texto.
  ImGui::PushStyleVarY(ImGuiStyleVar_FramePadding, 0.0f);
  const bool r = boton(etiqueta);
  ImGui::PopStyleVar();
  return r;
}

bool casilla(const char* etiqueta, bool* v) {
  const Transicion t = empezar(etiqueta);
  const ImVec4 c =
      mezcla(mezcla(col(ImGuiCol_FrameBg), col(ImGuiCol_FrameBgHovered), t.sobre), col(ImGuiCol_FrameBgActive), t.activo);
  empujar(ImGuiCol_FrameBg, ImGuiCol_FrameBgHovered, ImGuiCol_FrameBgActive, c);
  // Marcada, el fondo es CheckboxSelectedBg: se aclara con la misma transición.
  ImVec4 sel = col(ImGuiCol_CheckboxSelectedBg);
  ImGui::PushStyleColor(ImGuiCol_CheckboxSelectedBg, ImVec4(sel.x, sel.y, sel.z, sel.w + (1 - sel.w) * 0.45f * t.sobre));
  const bool r = ImGui::Checkbox(etiqueta, v);
  ImGui::PopStyleColor(4);
  terminar(t);
  return r;
}

bool radio(const char* etiqueta, int* v, int este) {
  const Transicion t = empezar(etiqueta);
  const ImVec4 c =
      mezcla(mezcla(col(ImGuiCol_FrameBg), col(ImGuiCol_FrameBgHovered), t.sobre), col(ImGuiCol_FrameBgActive), t.activo);
  empujar(ImGuiCol_FrameBg, ImGuiCol_FrameBgHovered, ImGuiCol_FrameBgActive, c);
  const bool r = ImGui::RadioButton(etiqueta, v, este);
  ImGui::PopStyleColor(3);
  terminar(t);
  return r;
}

}  // namespace refor::gui::anim
