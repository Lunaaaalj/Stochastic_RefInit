#pragma once

#include <imgui.h>

#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "asignacion_exacta/ple.hpp"
#include "datos.hpp"
#include "estilo.hpp"
#include "memetico/competencia.hpp"
#include "memetico/mosaico.hpp"
#include "modelo.hpp"
#include "plan.hpp"
#include "trabajo.hpp"

namespace refor::gui {

// Lo que se configura en el panel izquierdo; cada cálculo se lanza con una
// copia, así que editarlo mientras corre no afecta al cálculo en curso.
struct Config {
  std::string datos_dir = "data/processed";
  std::string dir_res = "docs/res";
  std::vector<char> poligonos;  // selección, indexada como Datos::poligonos
  double alfa = 0.05, B = 12'500;
  Parametros p;
  ParametrosEspacial pe;
  std::string alfas = "0.01,0.02,0.05,0.10,0.15,0.20,0.30,0.40,0.50";
  double B_min = 12'000, B_max = 17'000, B_paso = 250;
  asignacion_exacta::ParametrosPLE ple{.limite_segundos = 60};
};

// Los resultados guardan los datos con que se calcularon: los Resultado y
// Frontera apuntan a sus polígonos, y así sobreviven a una recarga.
struct ResultadoPlan {
  std::shared_ptr<const Datos> datos;
  std::shared_ptr<const memetico::Competencia> w;
  memetico::Mosaico mosaico;
  PlanCompleto plan;
  double alfa = 0, B = 0;
  int corridas = 0;
  double segundos = 0;
  std::vector<int> grupo_de;  // mosaico de cada compra (-1 si no planta)
};

struct ResultadoFrontera {
  std::shared_ptr<const Datos> datos;
  std::vector<double> alfas;
  std::vector<Frontera> res;
};

// Mosaicos del plan actual resueltos con el modelo entero: (índice en
// plan.espacial, resultado). Un cálculo puede resolver uno o varios.
struct ResultadoExacto {
  std::vector<std::pair<int, asignacion_exacta::ResultadoPLE>> res;
};

// Cotas del solver en curso; las escribe el hilo de trabajo y la vista de
// comparación las dibuja mientras resuelve.
struct TrazaViva {
  std::mutex mtx;
  int mosaico = -1;
  std::vector<asignacion_exacta::PuntoTraza> puntos;
};

// Extras del lienzo al comparar dos claves: posiciones que difieren y un
// rango común para la escala de competencia local.
struct Resaltado {
  std::vector<char> distintas;
  double local_min = 0, local_max = 0;
};

// Contorno de un polígono del cerco, trazado sobre la lámina del proyecto
// (scripts/digitalizar_mapa.py). El mapa numera distinto que el modelo.
struct PoligonoMapa {
  int etiqueta;           // número en la lámina
  int id;                 // id del modelo; -1 si quedó fuera del programa
  std::vector<ImVec2> v;  // vértices en metros, relativos a la esquina suroeste del cerco
  ImVec2 rotulo;          // punto interior donde va el número
  float holgura = 0;      // distancia del rótulo al borde (m)
  double area = 0;        // área trazada (ha), para contrastar con la tabla
};

// Un polígono del mapa sembrado con el mosaico de su plan: el mosaico se repite
// al tresbolillo desde la esquina noroeste, con la distancia entre plantas que
// hace caber justo las plantas compradas.
struct PlantacionMapa {
  float a = 0;                          // distancia entre plantas (m)
  int grupo = -1;                       // índice en plan.espacial
  ImVec2 lo, hi;                        // caja del polígono (m)
  std::vector<ImVec2> pos;              // plantas dentro del polígono (m)
  std::vector<unsigned char> especie;   // de cada planta, indexada como Datos::especies
};

// Lee mapa.csv del directorio de datos; vacío si no existe (el mapa es
// opcional). Lanza std::runtime_error si el archivo está mal formado.
std::vector<PoligonoMapa> cargar_mapa(const std::string& dir);

struct ResultadoBarrido {
  std::shared_ptr<const Datos> datos;
  std::vector<double> alfas, Bs;
  std::vector<Resultado> res;
};

class App {
 public:
  explicit App(std::string datos_dir);
  void cuadro();  // dibuja un cuadro completo de la interfaz

 private:
  void cargar();
  std::vector<int> ids_seleccionados() const;
  bool ocupado() const {
    return t_plan_.ocupado() || t_frontera_.ocupado() || t_barrido_.ocupado() || t_exacto_.ocupado();
  }
  void lanzar_plan();
  void lanzar_exacto(int mosaico);  // -1: todos los que aún no se resuelven
  void lanzar_frontera();
  void lanzar_barrido();
  void recoger();
  void guardar_plan();
  void layout_inicial(ImGuiID dock);

  // Una ventana por vista; cada grupo vive en su propio archivo vista_*.cpp.
  void vista_config();
  void barra_progreso();
  void vista_compra();
  void vista_mosaico();
  void lienzo_mosaico(const ResultadoPlan& r, const memetico::Individuo& asig, const Resaltado* res = nullptr);
  void leyenda_generos(const Datos& d);
  void vista_comparacion();
  void vista_convergencia();
  void vista_competencia();
  void vista_frontera();
  void vista_barrido();
  void vista_mapa();
  void detalle_mapa(int k);         // configuración del polígono mapa_[k]
  void sembrar_mapa();              // recalcula plantacion_ con el plan actual
  int etiqueta_mapa(int id) const;  // número del polígono en la lámina, -1 si no está

  Config cfg_;
  std::shared_ptr<const Datos> datos_;
  std::shared_ptr<const memetico::Competencia> w_;
  estilo::Generos generos_;
  std::vector<PoligonoMapa> mapa_;
  std::vector<PlantacionMapa> plantacion_;  // paralelo a mapa_; vacío sin plan
  std::string mensaje_;  // último error o aviso, en la barra de configuración
  bool mensaje_es_error_ = false;

  std::optional<ResultadoPlan> plan_;
  std::optional<ResultadoFrontera> frontera_;
  std::optional<ResultadoBarrido> barrido_;
  std::vector<std::optional<asignacion_exacta::ResultadoPLE>> exacto_;  // uno por mosaico del plan
  std::shared_ptr<TrazaViva> traza_viva_;

  // Selección compartida entre vistas.
  int compra_sel_ = -1;   // índice en plan_->plan.compras
  int mosaico_sel_ = 0;   // índice en plan_->plan.espacial
  int color_modo_ = 0;    // 0: género, 1: competencia local
  bool replicar_ = false; // mosaico 3 × 3 para ver el borde periódico
  bool aristas_ = false;  // grafo de vecindad pesado por W
  int mapa_modo_ = 0;     // 0: selección, 1: existentes/ha, 2: estado, 3: compra $/ha
  int mapa_sel_ = -1;     // índice en mapa_ del polígono en detalle (si no está en el plan)
  float mapa_zoom_ = 1;   // 1: todo el cerco a la vista
  ImVec2 mapa_centro_{-1, -1};  // centro de la vista (m); negativo: sin fijar
  int mapa_encuadrar_ = -1;     // polígono a encuadrar en el próximo cuadro
  bool mapa_plantas_ = true;
  std::vector<int> orden_compras_;
  bool layout_hecho_ = false;

  // Al final: se destruyen primero y esperan a sus hilos.
  Trabajo<ResultadoPlan> t_plan_;
  Trabajo<ResultadoFrontera> t_frontera_;
  Trabajo<ResultadoBarrido> t_barrido_;
  Trabajo<ResultadoExacto> t_exacto_;
};

// Nombres de las ventanas, para el acomodo inicial.
inline constexpr const char* kConfig = "Configuración";
inline constexpr const char* kCompra = "Compra";
inline constexpr const char* kMosaico = "Mosaico";
inline constexpr const char* kConvergencia = "Convergencia";
inline constexpr const char* kCompetencia = "Matriz de competencia";
inline constexpr const char* kFrontera = "Frontera B*(α)";
inline constexpr const char* kBarrido = "Barrido α × B";
inline constexpr const char* kComparacion = "Memético vs. exacto";
inline constexpr const char* kMapa = "Mapa del cerco";

}  // namespace refor::gui
