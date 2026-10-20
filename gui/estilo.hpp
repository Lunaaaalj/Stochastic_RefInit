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

// Tres superficies, de atrás hacia adelante: fondo, ventanas y tarjetas.
inline constexpr ImU32 plano = rgb(0x0d0d0d);
inline constexpr ImU32 superficie = rgb(0x1a1a19);
inline constexpr ImU32 elevada = rgb(0x242423);
inline constexpr ImU32 tinta = rgb(0xf0efec);
inline constexpr ImU32 tinta_2 = rgb(0xc3c2b7);
inline constexpr ImU32 tinta_tenue = rgb(0x898781);
inline constexpr ImU32 tinta_oscura = rgb(0x0b0b0b);
inline constexpr ImU32 reticula = rgb(0x2c2c2a);
inline constexpr ImU32 eje = rgb(0x383835);
inline constexpr ImU32 bueno = rgb(0x0ca30c);
inline constexpr ImU32 critico = rgb(0xd03b3b);
inline constexpr ImU32 aviso = rgb(0xfab219);

// Botones: neutros por defecto, azul solo para la acción principal.
inline constexpr ImU32 boton = rgb(0x2c2c2a);
inline constexpr ImU32 boton_sobre = rgb(0x383835);
inline constexpr ImU32 boton_activo = rgb(0x42423e);
inline constexpr ImU32 primario = rgb(0x2a78d6);
inline constexpr ImU32 primario_sobre = rgb(0x3987e5);
inline constexpr ImU32 primario_activo = rgb(0x256abf);

inline constexpr ImU32 categorico[3] = {rgb(0x3987e5), rgb(0xd95926), rgb(0x199e70)};

// Rampa secuencial azul para magnitudes, de oscuro (cerca de cero, se funde
// con la superficie) a claro (máximo).
ImU32 secuencial(float t);

// Inter SemiBold para títulos y cifras; la carga main.cpp. Nulo: la fuente
// por defecto (PushFont(nullptr, …) solo cambia el tamaño).
extern ImFont* fuente_titulo;

// Colormaps de ImPlot registrados por aplicar(): rampa secuencial y géneros.
extern ImPlotColormap cmap_secuencial;
extern ImPlotColormap cmap_generos;

// Aplica la paleta a ImGui e ImPlot y registra los colormaps; después de
// crear ambos contextos.
void aplicar();

inline ImVec4 v4(ImU32 c) { return ImGui::ColorConvertU32ToFloat4(c); }

// El color con su opacidad multiplicada por a.
ImU32 con_alfa(ImU32 c, float a);

// Tinta legible sobre un relleno: oscura sobre colores claros.
ImU32 tinta_sobre(ImU32 relleno);

// Línea de ImPlot con color y grosor.
ImPlotSpec linea(ImU32 color, float grosor, ImPlotItemFlags flags = 0);

// Leyendas en una sola línea: una muestra de color con su texto, o la rampa
// secuencial entre dos valores. Dejan la línea abierta para seguir con
// SameLine; quien la termina llama a ImGui::NewLine().
void muestra(ImU32 c, const char* texto);
void rampa(double lo, double hi, const char* unidad, const char* formato = "%.0f");

// Entero redondeado con separador de miles: 2652931 → "2,652,931".
std::string miles(double v);

// Botón azul para la acción principal de una vista.
bool boton_primario(const char* etiqueta, ImVec2 tam = ImVec2(0, 0));

// Cabecera plegable neutra: el azul de Header queda para las selecciones.
bool seccion(const char* etiqueta, ImGuiTreeNodeFlags flags = 0);

// Tarjeta centrada en lo que queda de la ventana, para vistas sin datos; con
// acción, lleva un botón primario y devuelve true al pulsarlo.
bool estado_vacio(const char* texto, const char* accion = nullptr);

// Tarjeta con una cifra grande y su etiqueta; se encadenan con SameLine.
void cifra(const char* valor, const char* etiqueta, ImU32 color = tinta);

// Etiqueta redondeada para un estado; el texto lo dice, el color lo refuerza.
void chip(const char* texto, ImU32 color);

// Grupo de color de cada especie: los dos géneros con más especies tienen su
// propio color y el resto comparte "Otras".
struct Generos {
  std::vector<std::string> nombres;  // nombre de cada grupo (≤ 3)
  std::vector<int> de_especie;       // grupo de cada especie
};
Generos generos(const Datos& datos);

}  // namespace refor::gui::estilo
