#pragma once

#include <imgui.h>

namespace refor::gui::anim {

// Acerca un valor a su objetivo con decaimiento exponencial: la fracción que
// avanza depende del tiempo del cuadro, no de cuántos cuadros hay por segundo.
// La velocidad es 1/τ: a 14, recorre el 63 % del camino en ~70 ms. Si aún no
// llega (a menos de eps), avisa que hay una animación en curso.
float suavizar(float actual, float objetivo, float velocidad = 14, float eps = 1e-3f);
ImVec2 suavizar(ImVec2 actual, ImVec2 objetivo, float velocidad = 14, float eps = 1e-3f);
ImVec4 suavizar(ImVec4 actual, ImVec4 objetivo, float velocidad = 14);

// Un valor animado guardado en el almacén de la ventana actual bajo id, para
// animar sin agregar estado a App. La primera vez arranca en el objetivo, o
// en inicial si se da.
float valor(ImGuiID id, float objetivo, float velocidad = 14, float inicial = -1, float eps = 1e-3f);

ImVec4 mezcla(ImVec4 a, ImVec4 b, float t);
ImU32 mezcla(ImU32 a, ImU32 b, float t);

// Al inicio de cada cuadro; animando() dice si en el anterior algo seguía en
// movimiento (main.cpp lo usa para dormir cuando la ventana está quieta).
void nuevo_cuadro();
void seguir();  // pide otro cuadro aunque nada se haya movido
bool animando();

// Widgets con transición de color al pasar el ratón y al pulsar; misma firma
// que los de ImGui. Los colores salen del estilo, salvo en boton_colores.
bool boton(const char* etiqueta, ImVec2 tam = ImVec2(0, 0));
bool boton_chico(const char* etiqueta);
bool boton_colores(const char* etiqueta, ImVec2 tam, ImU32 base, ImU32 sobre, ImU32 activo);
bool casilla(const char* etiqueta, bool* v);
bool radio(const char* etiqueta, int* v, int este);

}  // namespace refor::gui::anim
