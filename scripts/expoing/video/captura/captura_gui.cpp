// Grabación de refor_gui para el video de Expo Ingenierías (PLAN §8.5).
//
// Compila gui/main.cpp tal cual, con cinco llamadas desviadas por macros: la entrada viene de
// un guion de acciones (no del ratón ni del teclado) y cada cuadro se dibuja en un framebuffer
// propio de 2× que se lee con glReadPixels y se manda por tubería a ffmpeg. Lo demás es el
// programa real: los mismos datos, el mismo cálculo en sus hilos, las mismas vistas.
//
// El reloj es el de la pared, como en una grabación de pantalla: el cálculo del plan corre a
// su velocidad real y cada cuadro se escribe en tantas ranuras de 1/60 s como haya tardado.
// Así la grabación cruda dura lo que duró la sesión; acelerar un tramo es trabajo de la
// edición (capturar_gui.py), que lo marca en pantalla.
//
// Los botones y campos se encuentran por su etiqueta con los ganchos de prueba de Dear ImGui
// (IMGUI_ENABLE_TEST_ENGINE): cada widget avisa su etiqueta y su rectángulo al dibujarse, y
// el guion apunta al centro del que busca. Si la interfaz cambia de acomodo, el guion la sigue.
//
//   refor_gui_captura --salida crudo.mkv --registro crudo.json [--ancho 1280 --alto 720]

#include <imgui.h>
#include <imgui_internal.h>
#include <imgui_impl_glfw.h>
#include <imgui_impl_opengl3.h>

#define GLFW_INCLUDE_GLCOREARB
#include <GLFW/glfw3.h>

#include "app.hpp"    // refor::gui::cargar_mapa, para apuntar al mapa
#include "rutas.hpp"

#include <algorithm>
#include <cfloat>
#include <chrono>
#include <cmath>
#include <condition_variable>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <deque>
#include <functional>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <unordered_map>
#include <vector>

namespace captura {

using Reloj = std::chrono::steady_clock;

// ---------------------------------------------------------------------------------------------
// Configuración (de la línea de comandos)

int W = 1280, H = 720;  // ventana en puntos
int S = 2;              // densidad del framebuffer: 2560 × 1440
constexpr int FPS = 60;
std::string salida, registro;

// ---------------------------------------------------------------------------------------------
// Widgets vistos en el cuadro anterior, por etiqueta (ganchos de prueba de ImGui)

struct Item {
  std::string etiqueta, ventana;
  ImGuiID id;
  ImRect r;
  bool desactivado;
};
std::vector<Item> items, items_previos;

// El rectángulo y el estado salen del gancho ItemAdd, por id: algunos widgets (las pestañas)
// avisan su etiqueta cuando LastItemData todavía describe el widget anterior.
struct Caja {
  ImRect r;
  bool desactivado;
};
std::unordered_map<ImGuiID, Caja> cajas, cajas_previas;

// Filtro para distinguir widgets con la misma etiqueta (el «Ejecutar plan» de la configuración
// del que aparece en las vistas vacías; la pestaña «Mosaico» de otros textos).
using Filtro = std::function<bool(const Item&)>;
Filtro en(const char* ventana) {
  return [v = std::string(ventana)](const Item& it) { return it.ventana == v; };
}

const Item* buscar(const char* etiqueta, const Filtro& filtro) {
  for (const auto& it : items_previos)
    if (it.etiqueta == etiqueta && (!filtro || filtro(it))) return &it;
  return nullptr;
}

// ---------------------------------------------------------------------------------------------
// Escritura a ffmpeg en otro hilo: el bucle de la interfaz solo copia el cuadro y sigue.

struct Cuadro {
  std::vector<unsigned char> px;
  int veces;
};

class Escritor {
 public:
  void abrir(const std::string& ruta) {
    const std::string cmd = "ffmpeg -hide_banner -loglevel error -y -f rawvideo -pix_fmt bgr0 -s " +
                            std::to_string(W * S) + "x" + std::to_string(H * S) + " -framerate " + std::to_string(FPS) +
                            " -i - -c:v libx264rgb -preset ultrafast -qp 0 -threads 4 '" + ruta + "'";
    tubo_ = popen(cmd.c_str(), "w");
    if (!tubo_) {
      std::fprintf(stderr, "No se pudo abrir ffmpeg\n");
      std::exit(1);
    }
    hilo_ = std::thread([this] { bucle(); });
  }
  // Bloquea si ffmpeg va atrasado más de 6 cuadros: el reloj de pared lo compensa repitiendo.
  void poner(Cuadro c) {
    std::unique_lock lk(m_);
    cv_.wait(lk, [&] { return cola_.size() < 6; });
    cola_.push_back(std::move(c));
    cv_.notify_all();
  }
  long cerrar() {
    {
      std::lock_guard lk(m_);
      fin_ = true;
      cv_.notify_all();
    }
    hilo_.join();
    pclose(tubo_);
    return escritos_;
  }

 private:
  void bucle() {
    const std::size_t fila = static_cast<std::size_t>(W * S) * 4;
    std::vector<unsigned char> volteado(fila * H * S);
    for (;;) {
      Cuadro c;
      {
        std::unique_lock lk(m_);
        cv_.wait(lk, [&] { return fin_ || !cola_.empty(); });
        if (cola_.empty()) return;
        c = std::move(cola_.front());
        cola_.pop_front();
        cv_.notify_all();
      }
      // OpenGL entrega las filas de abajo hacia arriba.
      for (int y = 0; y < H * S; ++y)
        std::memcpy(&volteado[fila * y], &c.px[fila * (H * S - 1 - y)], fila);
      for (int k = 0; k < c.veces; ++k) {
        std::fwrite(volteado.data(), 1, volteado.size(), tubo_);
        ++escritos_;
      }
    }
  }
  FILE* tubo_ = nullptr;
  std::thread hilo_;
  std::mutex m_;
  std::condition_variable cv_;
  std::deque<Cuadro> cola_;
  bool fin_ = false;
  long escritos_ = 0;
};

Escritor escritor;

// ---------------------------------------------------------------------------------------------
// El guion: una lista de pasos que se ejecutan en orden, cada uno con su propio reloj.

struct Marca {
  std::string nombre;
  double t;
};
std::vector<Marca> marcas;

std::vector<refor::gui::PoligonoMapa> mapa;  // el mismo mapa.csv que carga la interfaz
constexpr double kZoomMapa = 25;              // cuánto acerca la rueda (la vista sin zoom es 1)
// Dónde queda, ya acercado, el polígono 1 en la ventana (puntos): E10 cierra la ventana hacia
// ahí para que la siembra de la GUI caiga sobre la siembra de papel de E11.
ImVec2 ancla(-1, -1);
ImRect caja_poligono_1();  // más abajo, junto al guion

ImVec2 raton;  // posición actual del cursor, en puntos (empieza junto al título «Compra»)
bool terminado = false;

struct Paso {
  const char* que;
  // Devuelve true cuando el paso terminó. t: segundos desde que empezó el paso; ahora: reloj
  // de la sesión.
  std::function<bool(double t, double ahora)> hacer;
};

double suave(double u) {  // trayectoria de mínimo tirón, como la mano que mueve un ratón
  u = std::clamp(u, 0.0, 1.0);
  return u * u * u * (10 - 15 * u + 6 * u * u);
}

Paso esperar(double s) {
  return {"esperar", [s](double t, double) { return t >= s; }};
}

Paso marcar(const char* nombre) {
  return {"marcar", [nombre](double, double ahora) {
            marcas.push_back({nombre, ahora});
            return true;
          }};
}

// Cómo se mueve la mano: cuánto se curva el camino (fracción de la distancia; el signo dice
// hacia qué lado) y si arranca de golpe en vez de acelerar poco a poco. Para ImGui el cursor
// está quieto si avanza menos de 2 puntos por cuadro; al irse de un botón recién pulsado, un
// arranque suave sumaría el tiempo quieto que hace falta para que salga su tooltip.
struct Trazo {
  double curva = 0.08;
  bool arranque = false;
};

// Mueve el cursor hacia un punto del widget: (fx, fy) es la fracción de su rectángulo y (dx, dy)
// un desplazamiento en puntos. La duración crece con la distancia, y el camino se curva un
// poco, como el de una mano.
Paso mover(const char* etiqueta, Filtro filtro, float fx, float fy, float dx = 0, float dy = 0, Trazo trazo = {}) {
  struct Estado {
    ImVec2 a, b;
    double dur = -1;
  };
  auto e = std::make_shared<Estado>();
  return {"mover", [=](double t, double) {
            if (e->dur < 0) {
              const Item* it = buscar(etiqueta, filtro);
              if (!it) {
                std::fprintf(stderr, "No encuentro «%s»\n", etiqueta);
                std::exit(2);
              }
              e->a = raton;
              e->b = ImVec2(it->r.Min.x + (it->r.Max.x - it->r.Min.x) * fx + dx,
                            it->r.Min.y + (it->r.Max.y - it->r.Min.y) * fy + dy);
              const double d = std::hypot(e->b.x - e->a.x, e->b.y - e->a.y);
              e->dur = std::clamp(0.35 + d / 1100.0, 0.45, 1.1);
            }
            const double v = std::clamp(t / e->dur, 0.0, 1.0);
            const double u = trazo.arranque ? 1 - std::pow(1 - v, 3) : suave(v), arco = trazo.curva * std::sin(M_PI * u);
            const float ux = e->b.x - e->a.x, uy = e->b.y - e->a.y;
            raton = ImVec2(static_cast<float>(e->a.x + ux * u - uy * arco), static_cast<float>(e->a.y + uy * u + ux * arco));
            return t >= e->dur;
          }};
}

Paso mover_a(ImVec2 destino, double dur) {
  auto a = std::make_shared<ImVec2>(-1, -1);
  return {"mover_a", [=](double t, double) {
            if (a->x < 0) *a = raton;
            const double u = suave(t / dur);
            raton = ImVec2(static_cast<float>(a->x + (destino.x - a->x) * u), static_cast<float>(a->y + (destino.y - a->y) * u));
            return t >= dur;
          }};
}

// Mueve el cursor a un punto del mapa del cerco, en metros (los de mapa.csv relativos a la
// esquina suroeste, como en refor::gui::cargar_mapa), con la vista sin zoom. Reproduce la
// cuenta de App::vista_mapa: el lienzo es el InvisibleButton «mapa», con un margen de 1.5
// veces el tamaño de letra, y a zoom 1 el cerco completo cabe centrado.
Paso mover_al_mapa(ImVec2 punto_m, double dur) {
  struct Estado {
    ImVec2 a, b;
    bool listo = false;
  };
  auto e = std::make_shared<Estado>();
  return {"mover_al_mapa", [=](double t, double) {
            if (!e->listo) {
              const Item* lienzo = buscar("mapa", [](const Item& it) { return it.ventana.find("lienzo_mapa") != std::string::npos; });
              if (!lienzo) {
                std::fprintf(stderr, "No encuentro el lienzo del mapa\n");
                std::exit(2);
              }
              float xmax = 0, ymax = 0;
              for (const auto& pm : mapa)
                for (const auto& v : pm.v) xmax = std::max(xmax, v.x), ymax = std::max(ymax, v.y);
              const ImGuiStyle& st = ImGui::GetStyle();
              const float margen = st.FontSizeBase * st.FontScaleMain * st.FontScaleDpi * 1.5f;
              const ImVec2 tam(lienzo->r.Max.x - lienzo->r.Min.x, lienzo->r.Max.y - lienzo->r.Min.y);
              const float s = std::min((tam.x - 2 * margen) / xmax, (tam.y - 2 * margen) / ymax);
              const ImVec2 cc(lienzo->r.Min.x + tam.x / 2, lienzo->r.Min.y + tam.y / 2);
              e->a = raton;
              e->b = ImVec2(cc.x + (punto_m.x - xmax / 2) * s, cc.y - (punto_m.y - ymax / 2) * s);
              e->listo = true;
              // La rueda acerca alrededor del cursor: el centro de la franja del polígono 1 queda
              // a (centro − punto) · s · zoom del cursor. En vertical la franja llena el lienzo,
              // así que el ancla va a media altura.
              const ImRect c = caja_poligono_1();
              ancla = ImVec2(static_cast<float>(e->b.x + (c.GetCenter().x - punto_m.x) * s * kZoomMapa), cc.y);
            }
            const double u = suave(t / dur);
            raton = ImVec2(static_cast<float>(e->a.x + (e->b.x - e->a.x) * u), static_cast<float>(e->a.y + (e->b.y - e->a.y) * u));
            return t >= dur;
          }};
}

// Gira la rueda del ratón: `total` muescas repartidas en `dur` segundos, rápido a la mitad y
// lento al empezar y al terminar, como un gesto continuo en el trackpad.
Paso rueda(double total, double dur) {
  auto hecho = std::make_shared<double>(0);
  return {"rueda", [=](double t, double) {
            const double objetivo = total * suave(t / dur);
            ImGui::GetIO().AddMouseWheelEvent(0, static_cast<float>(objetivo - *hecho));
            *hecho = objetivo;
            return t >= dur;
          }};
}

Paso clic(double pulsado = 0.09) {
  auto fase = std::make_shared<int>(0);
  return {"clic", [=](double t, double) {
            ImGuiIO& io = ImGui::GetIO();
            if (*fase == 0) io.AddMouseButtonEvent(0, true), *fase = 1;
            if (*fase == 1 && t >= pulsado) io.AddMouseButtonEvent(0, false), *fase = 2;
            return *fase == 2 && t >= pulsado + 0.02;
          }};
}

// Teclea a ritmo de persona: un carácter cada 0.11 s.
Paso escribir(const char* texto) {
  constexpr double kPaso = 0.11;
  auto n = std::make_shared<std::size_t>(0);
  const std::string s = texto;
  return {"escribir", [=](double t, double) {
            while (*n < s.size() && t >= kPaso * static_cast<double>(*n)) {
              ImGui::GetIO().AddInputCharacter(static_cast<unsigned>(s[*n]));
              ++*n;
            }
            return *n == s.size() && t >= kPaso * static_cast<double>(s.size());
          }};
}

Paso tecla(ImGuiKey k) {
  auto fase = std::make_shared<int>(0);
  return {"tecla", [=](double t, double) {
            ImGuiIO& io = ImGui::GetIO();
            if (*fase == 0) io.AddKeyEvent(k, true), *fase = 1;
            if (*fase == 1 && t >= 0.08) io.AddKeyEvent(k, false), *fase = 2;
            return *fase == 2 && t >= 0.12;
          }};
}

// Espera a que el botón «Ejecutar plan» quede desactivado (el cálculo corre) o activo otra vez.
Paso esperar_plan(bool corriendo, double limite) {
  return {"esperar_plan", [=](double t, double) {
            const Item* b = buscar("Ejecutar plan", en("Configuración"));
            if (b && b->desactivado == corriendo) return true;
            if (t > limite) {
              std::fprintf(stderr, "El plan no %s en %.0f s\n", corriendo ? "arrancó" : "terminó", limite);
              std::exit(3);
            }
            return false;
          }};
}

Paso fin() {
  return {"fin", [](double, double) {
            terminado = true;
            return true;
          }};
}

// Imprime los widgets con etiqueta del último cuadro (para escribir o depurar el guion).
Paso listar() {
  return {"listar", [](double, double) {
            for (const auto& it : items_previos)
              std::fprintf(stderr, "%-34s %-28s (%6.1f, %6.1f)–(%6.1f, %6.1f)%s\n", it.etiqueta.c_str(), it.ventana.c_str(),
                           it.r.Min.x, it.r.Min.y, it.r.Max.x, it.r.Max.y, it.desactivado ? "  desactivado" : "");
            return true;
          }};
}

bool prueba = false;  // --prueba: solo abre, lista los widgets y cierra

// El polígono 1 del modelo (el 27 del mapa), el mismo de E1 y E11: su caja en metros.
ImRect caja_poligono_1() {
  for (const auto& pm : mapa) {
    if (pm.id != 1) continue;
    ImRect c(FLT_MAX, FLT_MAX, -FLT_MAX, -FLT_MAX);
    for (const auto& v : pm.v) c.Add(v);
    return c;
  }
  std::fprintf(stderr, "El mapa no tiene el polígono 1\n");
  std::exit(2);
}

// El punto a 15 m al poniente de la mitad de su borde oeste, que es también el borde del cerco.
ImVec2 punto_zoom() {
  const ImRect c = caja_poligono_1();
  return ImVec2(c.Min.x - 15, (c.Min.y + c.Max.y) / 2);
}

// La lista de tomas del PLAN §8.5: datos cargados → α = 0.05 y B = 12,500 → ejecutar el plan →
// progreso → la compra por polígono y el mapa sembrado → la vista del mosaico de la clave 1.
std::vector<Paso> guion() {
  if (prueba) return {esperar(2.0), listar(), esperar(0.1), fin()};
  const Filtro cfg = en("Configuración");
  // Las pestañas del acomodo de ventanas (DockSpace), no las ventanas ni otros textos.
  const Filtro pestana = [](const Item& it) { return it.ventana.find("DockSpace") != std::string::npos; };
  // α ya vale 0.050 y queda a la vista; se teclea solo el presupuesto, que es la cifra de la
  // historia (E7: con $12,500 por hectárea ningún polígono cumple).
  return {
      esperar(2.0),
      marcar("inicio"),
      mover("B ($/ha)", cfg, 0.30f, 0.5f),
      esperar(0.1),
      clic(),
      esperar(0.2),
      escribir("12500"),
      esperar(0.15),
      tecla(ImGuiKey_Enter),
      esperar(0.2),
      // Clic al llegar, sin pausa: el tooltip del botón (⌘↵) sale si el cursor se queda quieto
      // 0.15 s encima.
      mover("Ejecutar plan", cfg, 0.45f, 0.55f),
      marcar("clic_plan"),
      clic(0.05),
      // Se aparta del botón en cuanto lo pulsa, por arriba del mapa (que muestra un tooltip al
      // pasar sobre un polígono), y espera en la barra de pestañas.
      mover("Memético vs. exacto", pestana, 1.0f, 0.5f, 150, 0, {.curva = -0.03, .arranque = true}),
      esperar_plan(true, 5),
      marcar("calculando"),
      esperar_plan(false, 600),
      marcar("listo"),
      esperar(0.45),
      // La clave de plantación: la pestaña «Mosaico» (mosaico 1, el de 18 polígonos).
      mover("Mosaico", pestana, 0.5f, 0.55f, 0, 0, {.curva = 0}),
      marcar("clic_mosaico"),
      clic(),
      esperar(1.0),
      // Y la misma clave sembrada en el terreno: de vuelta al mapa, zoom al polígono 1.
      mover("Mapa del cerco", pestana, 0.5f, 0.55f, 0, 0, {.curva = 0}),
      marcar("clic_mapa"),
      clic(),
      esperar(0.05),
      // A 15 m al poniente de su borde, fuera del cerco: la rueda acerca alrededor del cursor y
      // el cursor nunca queda sobre un polígono (que mostraría su tooltip encima de las plantas).
      mover_al_mapa(punto_zoom(), 0.5),
      esperar(0.05),
      marcar("zoom"),
      rueda(std::log(kZoomMapa) / std::log(1.2), 1.15),  // cada muesca acerca ×1.2
      esperar(0.25),
      marcar("zoom_listo"),
      esperar(3.2),  // la edición recorta lo que sobre para que el clip dure lo que E10
      marcar("fin"),
      fin(),
  };
}

std::vector<Paso> pasos;
std::size_t paso_actual = 0;
double paso_desde = 0;

// ---------------------------------------------------------------------------------------------
// Reloj y cuadros

Reloj::time_point t0;
bool iniciado = false;
double t_cuadro = 0, t_anterior = 0;
long siguiente_ranura = 0, cuadros = 0, repetidos = 0;
double peor_ms = 0;
GLFWwindow* ventana_ = nullptr;
GLuint fbo = 0, tex = 0;

double ahora() { return std::chrono::duration<double>(Reloj::now() - t0).count(); }

GLFWwindow* crear_ventana(int, int, const char* titulo, GLFWmonitor* m, GLFWwindow* c) {
  glfwWindowHint(GLFW_RESIZABLE, GLFW_FALSE);
  ventana_ = ::glfwCreateWindow(W, H, titulo, m, c);
  return ventana_;
}

void nuevo_cuadro() {
  ImGuiIO& io = ImGui::GetIO();
  if (!iniciado) {
    iniciado = true;
    t0 = Reloj::now();
    ImGui::GetCurrentContext()->TestEngineHookItems = true;
    io.MouseDrawCursor = true;
    ImGui::GetStyle().MouseCursorScale = 1.25f;
    pasos = guion();
    glGenTextures(1, &tex);
    glBindTexture(GL_TEXTURE_2D, tex);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8, W * S, H * S, 0, GL_BGRA, GL_UNSIGNED_BYTE, nullptr);
    glGenFramebuffers(1, &fbo);
    glBindFramebuffer(GL_FRAMEBUFFER, fbo);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, tex, 0);
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE) {
      std::fprintf(stderr, "Framebuffer incompleto\n");
      std::exit(1);
    }
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
  }
  t_cuadro = ahora();
  io.DisplaySize = ImVec2(static_cast<float>(W), static_cast<float>(H));
  io.DisplayFramebufferScale = ImVec2(static_cast<float>(S), static_cast<float>(S));
  io.DeltaTime = static_cast<float>(std::max(t_cuadro - t_anterior, 1e-4));
  t_anterior = t_cuadro;

  items_previos.swap(items);
  items.clear();
  cajas_previas.swap(cajas);
  cajas.clear();
  for (auto& it : items_previos)
    if (const auto c = cajas_previas.find(it.id); c != cajas_previas.end()) it.r = c->second.r, it.desactivado = c->second.desactivado;
  while (paso_actual < pasos.size()) {
    if (!pasos[paso_actual].hacer(t_cuadro - paso_desde, t_cuadro)) break;
    ++paso_actual;
    paso_desde = t_cuadro;
  }
  io.AddMousePosEvent(raton.x, raton.y);
}

void tamano_framebuffer(GLFWwindow*, int* w, int* h) {
  glBindFramebuffer(GL_FRAMEBUFFER, fbo);
  *w = W * S;
  *h = H * S;
}

void presentar(GLFWwindow* v) {
  // El cuadro va a las ranuras de 1/60 s que cubrió: normalmente una; más si se atrasó.
  const long ranura = std::lround(t_cuadro * FPS);
  const int veces = static_cast<int>(std::max(0L, ranura - siguiente_ranura + 1));
  if (veces > 0) {
    Cuadro c{std::vector<unsigned char>(static_cast<std::size_t>(W * S) * H * S * 4), veces};
    glBindFramebuffer(GL_READ_FRAMEBUFFER, fbo);
    glReadPixels(0, 0, W * S, H * S, GL_BGRA, GL_UNSIGNED_INT_8_8_8_8_REV, c.px.data());
    escritor.poner(std::move(c));
    siguiente_ranura = ranura + 1;
    ++cuadros;
    repetidos += veces - 1;
  }
  // Una copia a la ventana, para ver la grabación mientras ocurre.
  int fw = 0, fh = 0;
  ::glfwGetFramebufferSize(v, &fw, &fh);
  glBindFramebuffer(GL_READ_FRAMEBUFFER, fbo);
  glBindFramebuffer(GL_DRAW_FRAMEBUFFER, 0);
  glBlitFramebuffer(0, 0, W * S, H * S, 0, 0, fw, fh, GL_COLOR_BUFFER_BIT, GL_LINEAR);
  glBindFramebuffer(GL_FRAMEBUFFER, 0);
  ::glfwSwapBuffers(v);

  peor_ms = std::max(peor_ms, (ahora() - t_cuadro) * 1000);
  if (terminado) glfwSetWindowShouldClose(v, GLFW_TRUE);
  std::this_thread::sleep_until(t0 + std::chrono::duration_cast<Reloj::duration>(
                                         std::chrono::duration<double>(static_cast<double>(siguiente_ranura) / FPS)));
}

void esperar_eventos(double) { glfwPollEvents(); }

}  // namespace captura

// Ganchos de prueba de Dear ImGui: cada widget con etiqueta avisa su rectángulo.
void ImGuiTestEngineHook_ItemAdd(ImGuiContext*, ImGuiID id, const ImRect& bb, const ImGuiLastItemData* d) {
  captura::cajas[id] = {bb, d && (d->ItemFlags & ImGuiItemFlags_Disabled) != 0};
}
void ImGuiTestEngineHook_ItemInfo(ImGuiContext* ctx, ImGuiID id, const char* label, ImGuiItemStatusFlags) {
  if (!label || !*label) return;
  const ImGuiLastItemData& d = ctx->LastItemData;
  captura::items.push_back({label, ctx->CurrentWindow ? ctx->CurrentWindow->Name : "", id, d.Rect,
                            (d.ItemFlags & ImGuiItemFlags_Disabled) != 0});
}
void ImGuiTestEngineHook_Log(ImGuiContext*, const char*, ...) {}
const char* ImGuiTestEngine_FindItemDebugLabel(ImGuiContext*, ImGuiID) { return nullptr; }

// El programa real, con las llamadas de entrada y salida desviadas. Los encabezados ya están
// incluidos arriba, así que las macros solo tocan las llamadas de main.cpp, no sus declaraciones.
#define glfwCreateWindow captura::crear_ventana
#define glfwSwapInterval(n) glfwSwapInterval(0)
#define ImGui_ImplGlfw_InitForOpenGL(v, cb) ImGui_ImplGlfw_InitForOpenGL(v, false)
#define ImGui_ImplGlfw_NewFrame captura::nuevo_cuadro
#define glfwGetFramebufferSize captura::tamano_framebuffer
#define glfwSwapBuffers captura::presentar
#define glfwWaitEventsTimeout captura::esperar_eventos
#define main refor_gui_main
#include "main.cpp"
#undef main
#undef glfwCreateWindow
#undef glfwSwapInterval
#undef ImGui_ImplGlfw_InitForOpenGL
#undef ImGui_ImplGlfw_NewFrame
#undef glfwGetFramebufferSize
#undef glfwSwapBuffers
#undef glfwWaitEventsTimeout

int main(int argc, char** argv) {
  std::vector<char*> resto{argv[0]};
  for (int i = 1; i < argc; ++i) {
    const std::string a = argv[i];
    auto valor = [&]() -> std::string {
      if (i + 1 >= argc) {
        std::fprintf(stderr, "Falta el valor de %s\n", a.c_str());
        std::exit(1);
      }
      return argv[++i];
    };
    if (a == "--salida") captura::salida = valor();
    else if (a == "--registro") captura::registro = valor();
    else if (a == "--ancho") captura::W = std::stoi(valor());
    else if (a == "--alto") captura::H = std::stoi(valor());
    else if (a == "--prueba") captura::prueba = true;
    else resto.push_back(argv[i]);
  }
  if (captura::salida.empty() || captura::registro.empty()) {
    std::fprintf(stderr, "uso: %s --salida crudo.mkv --registro crudo.json [--ancho 1280 --alto 720] [datos]\n", argv[0]);
    return 1;
  }
  captura::raton = ImVec2(captura::W * 0.2f, captura::H * 0.628f);
  captura::mapa = refor::gui::cargar_mapa(resto.size() > 1 ? resto[1] : refor::texto_utf8(refor::datos_por_defecto()));
  captura::escritor.abrir(captura::salida);
  const int r = refor_gui_main(static_cast<int>(resto.size()), resto.data());
  const long escritos = captura::escritor.cerrar();

  FILE* f = std::fopen(captura::registro.c_str(), "w");
  std::fprintf(f, "{\n  \"fps\": %d, \"ancho\": %d, \"alto\": %d, \"escala\": %d,\n", captura::FPS, captura::W,
               captura::H, captura::S);
  std::fprintf(f, "  \"cuadros_dibujados\": %ld, \"cuadros_escritos\": %ld, \"cuadros_repetidos\": %ld, \"peor_ms\": %.1f,\n",
               captura::cuadros, escritos, captura::repetidos, captura::peor_ms);
  std::fprintf(f, "  \"ancla\": [%.1f, %.1f],\n", captura::ancla.x, captura::ancla.y);
  std::fprintf(f, "  \"marcas\": {");
  for (std::size_t k = 0; k < captura::marcas.size(); ++k)
    std::fprintf(f, "%s\"%s\": %.4f", k ? ", " : "", captura::marcas[k].nombre.c_str(), captura::marcas[k].t);
  std::fprintf(f, "},\n  \"completo\": %s\n}\n", captura::terminado ? "true" : "false");
  std::fclose(f);
  std::fprintf(stderr, "Grabación: %ld cuadros dibujados, %ld escritos (%ld repetidos), peor cuadro %.1f ms\n",
               captura::cuadros, escritos, captura::repetidos, captura::peor_ms);
  return r;
}
