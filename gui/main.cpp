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

namespace {

namespace estilo = refor::gui::estilo;

void error_glfw(int codigo, const char* descripcion) { std::fprintf(stderr, "GLFW %d: %s\n", codigo, descripcion); }

// Una fuente del sistema con acentos, ñ y letras griegas (α, θ, δ); ImGui
// carga los glifos al vuelo. Si no hay ninguna, queda la fuente por defecto.
void cargar_fuente(ImGuiIO& io) {
  for (const char* ruta : {"/System/Library/Fonts/Supplemental/Arial Unicode.ttf", "/Library/Fonts/Arial Unicode.ttf",
                           "/System/Library/Fonts/Supplemental/Arial.ttf",
                           "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/TTF/DejaVuSans.ttf",
                           "C:\\Windows\\Fonts\\segoeui.ttf"}) {
    if (std::filesystem::exists(ruta) && io.Fonts->AddFontFromFileTTF(ruta, 15.0f)) return;
  }
  io.Fonts->AddFontDefault();
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
    while (!glfwWindowShouldClose(ventana)) {
      glfwPollEvents();
      if (glfwGetWindowAttrib(ventana, GLFW_ICONIFIED)) {
        ImGui_ImplGlfw_Sleep(10);
        continue;
      }
      ImGui_ImplOpenGL3_NewFrame();
      ImGui_ImplGlfw_NewFrame();
      ImGui::NewFrame();
      app.cuadro();
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
