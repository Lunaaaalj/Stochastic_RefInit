#pragma once

#include <imgui.h>
#include <implot.h>

#include <string>
#include <vector>

#include "datos.hpp"

namespace refor::gui::estilo {

// Paleta de la app (modo oscuro). Los tres colores categóricos son los únicos
// que se distinguen con cualquier par de vecinos, incluso con daltonismo, así
// que el mosaico colorea por género (Agave, Opuntia, Otras) y la especie va
// siempre escrita con su clave.
inline constexpr ImU32 rgb(unsigned hex, unsigned a = 255) {
  return IM_COL32((hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff, a);
}

inline constexpr ImU32 superficie = rgb(0x1a1a19);
inline constexpr ImU32 plano = rgb(0x0d0d0d);
inline constexpr ImU32 tinta = rgb(0xf0efec);
inline constexpr ImU32 tinta_2 = rgb(0xc3c2b7);
inline constexpr ImU32 tinta_tenue = rgb(0x898781);
inline constexpr ImU32 tinta_oscura = rgb(0x0b0b0b);
inline constexpr ImU32 reticula = rgb(0x2c2c2a);
inline constexpr ImU32 eje = rgb(0x383835);
inline constexpr ImU32 bueno = rgb(0x0ca30c);
inline constexpr ImU32 critico = rgb(0xd03b3b);
inline constexpr ImU32 aviso = rgb(0xfab219);

inline constexpr ImU32 categorico[3] = {rgb(0x3987e5), rgb(0xd95926), rgb(0x199e70)};

// Rampa secuencial azul para magnitudes, de oscuro (cerca de cero, se funde
// con la superficie) a claro (máximo).
ImU32 secuencial(float t);

// Colormaps de ImPlot registrados por aplicar(): rampa secuencial y géneros.
extern ImPlotColormap cmap_secuencial;
extern ImPlotColormap cmap_generos;

// Aplica la paleta a ImGui e ImPlot y registra los colormaps; después de
// crear ambos contextos.
void aplicar();

inline ImVec4 v4(ImU32 c) { return ImGui::ColorConvertU32ToFloat4(c); }

// Grupo de color de cada especie: los dos géneros con más especies tienen su
// propio color y el resto comparte "Otras".
struct Generos {
  std::vector<std::string> nombres;  // nombre de cada grupo (≤ 3)
  std::vector<int> de_especie;       // grupo de cada especie
};
Generos generos(const Datos& datos);

}  // namespace refor::gui::estilo
