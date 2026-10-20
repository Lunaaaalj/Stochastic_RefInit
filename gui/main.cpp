// refor_gui: interfaz gráfica del modelo de compra y del mosaico memético.
//
//   ./build/refor_gui [directorio de datos]     (por defecto data/processed)
//
// Se corre desde la raíz del repo, igual que la CLI; los resultados se
// guardan en docs/res/plan/.

#include <imgui.h>
#include <imgui_impl_glfw.h>
#include <imgui_impl_opengl3.h>
#include <implot.h>

#ifndef GL_SILENCE_DEPRECATION
#define GL_SILENCE_DEPRECATION
#endif
#include <GLFW/glfw3.h>

#include <cstdio>
#include <filesystem>

#include "app.hpp"
#include "estilo.hpp"
#include "fuentes.hpp"

namespace {

namespace estilo = refor::gui::estilo;

void error_glfw(int codigo, const char* descripcion) { std::fprintf(stderr, "GLFW %d: %s\n", codigo, descripcion); }

// Inter embebida: Regular por defecto y SemiBold para títulos. ImGui carga
// los glifos al vuelo; los que Inter no tenga se buscan en una fuente del
// sistema fusionada como respaldo, si hay alguna.
void cargar_fuente(ImGuiIO& io) {
  constexpr float kTam = 15.5f;
  auto inter = [&](const unsigned char* datos, int tam) {
    ImFontConfig cfg;
    cfg.FontDataOwnedByAtlas = false;  // los bytes son estáticos
    ImFont* f = io.Fonts->AddFontFromMemoryTTF(const_cast<unsigned char*>(datos), tam, kTam, &cfg);
    for (const char* ruta : {"/System/Library/Fonts/Supplemental/Arial Unicode.ttf", "/Library/Fonts/Arial Unicode.ttf",
                             "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/TTF/DejaVuSans.ttf",
                             "C:\\Windows\\Fonts\\segoeui.ttf"}) {
      if (!std::filesystem::exists(ruta)) continue;
      ImFontConfig respaldo;
      respaldo.MergeMode = true;
      io.Fonts->AddFontFromFileTTF(ruta, kTam, &respaldo);
      break;
    }
    return f;
  };
  inter(refor::gui::fuentes::inter_regular, refor::gui::fuentes::inter_regular_tam);
  estilo::fuente_titulo = inter(refor::gui::fuentes::inter_semibold, refor::gui::fuentes::inter_semibold_tam);
}

}  // namespace

int main(int argc, char** argv) {
  glfwSetErrorCallback(error_glfw);
  if (!glfwInit()) return 1;

#if defined(__APPLE__)
  const char* glsl = "#version 150";
  glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
  glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 2);
  glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
  glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GL_TRUE);
#else
  const char* glsl = "#version 130";
  glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
  glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 0);
#endif

  const float escala = ImGui_ImplGlfw_GetContentScaleForMonitor(glfwGetPrimaryMonitor());
  GLFWwindow* ventana = glfwCreateWindow(static_cast<int>(1440 * escala), static_cast<int>(900 * escala),
                                         "Reforestación: compra y distribución espacial", nullptr, nullptr);
  if (!ventana) return 1;
  glfwMakeContextCurrent(ventana);
  glfwSwapInterval(1);

  IMGUI_CHECKVERSION();
  ImGui::CreateContext();
  ImPlot::CreateContext();
  ImGuiIO& io = ImGui::GetIO();
  io.ConfigFlags |= ImGuiConfigFlags_NavEnableKeyboard | ImGuiConfigFlags_DockingEnable;
  io.IniFilename = nullptr;  // el acomodo inicial se arma en cada arranque
  estilo::aplicar();
  ImGui::GetStyle().ScaleAllSizes(escala);
  ImGui::GetStyle().FontScaleDpi = escala;
  cargar_fuente(io);

  ImGui_ImplGlfw_InitForOpenGL(ventana, true);
  ImGui_ImplOpenGL3_Init(glsl);

  {
    refor::gui::App app(argc > 1 ? argv[1] : "data/processed");
    // En reposo (sin cálculo, sin animación y sin entrada reciente) el bucle
    // duerme hasta el siguiente evento en vez de redibujar a 60 cps. Tras cada
    // evento sigue dibujando un rato: los tooltips de ImGui aparecen con
    // retardo y necesitan cuadros aunque el ratón ya no se mueva.
    constexpr double kTrasEvento = 0.6, kDormir = 0.5;
    double activo_hasta = 0;
    while (!glfwWindowShouldClose(ventana)) {
      if (app.ocupado() || refor::gui::anim::animando() || glfwGetTime() < activo_hasta) {
        glfwPollEvents();
      } else {
        const double antes = glfwGetTime();
        glfwWaitEventsTimeout(kDormir);
        if (glfwGetTime() - antes < kDormir * 0.9) activo_hasta = glfwGetTime() + kTrasEvento;  // despertó un evento
      }
      if (glfwGetWindowAttrib(ventana, GLFW_ICONIFIED)) {
        ImGui_ImplGlfw_Sleep(10);
        continue;
      }
      ImGui_ImplOpenGL3_NewFrame();
      ImGui_ImplGlfw_NewFrame();
      ImGui::NewFrame();
      app.cuadro();
      if (app.quiere_salir()) glfwSetWindowShouldClose(ventana, GLFW_TRUE);
      ImGui::Render();

      int w = 0, h = 0;
      glfwGetFramebufferSize(ventana, &w, &h);
      glViewport(0, 0, w, h);
      const ImVec4 fondo = estilo::v4(estilo::plano);
      glClearColor(fondo.x, fondo.y, fondo.z, 1.0f);
      glClear(GL_COLOR_BUFFER_BIT);
      ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
      glfwSwapBuffers(ventana);
    }
  }  // la app (y sus hilos) se cierra antes que el contexto de ImGui

  ImGui_ImplOpenGL3_Shutdown();
  ImGui_ImplGlfw_Shutdown();
  ImPlot::DestroyContext();
  ImGui::DestroyContext();
  glfwDestroyWindow(ventana);
  glfwTerminate();
  return 0;
}
