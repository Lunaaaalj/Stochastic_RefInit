#pragma once

#include <imgui.h>

#include <memory>
#include <optional>
#include <string>
#include <vector>

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
  bool ocupado() const { return t_plan_.ocupado() || t_frontera_.ocupado() || t_barrido_.ocupado(); }
  void lanzar_plan();
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
  void lienzo_mosaico(const ResultadoPlan& r, const Espacial& g);
  void vista_convergencia();
  void vista_competencia();
  void vista_frontera();
  void vista_barrido();

  Config cfg_;
  std::shared_ptr<const Datos> datos_;
  std::shared_ptr<const memetico::Competencia> w_;
  estilo::Generos generos_;
  std::string mensaje_;  // último error o aviso, en la barra de configuración
  bool mensaje_es_error_ = false;

  std::optional<ResultadoPlan> plan_;
  std::optional<ResultadoFrontera> frontera_;
  std::optional<ResultadoBarrido> barrido_;

  // Selección compartida entre vistas.
  int compra_sel_ = -1;   // índice en plan_->plan.compras
  int mosaico_sel_ = 0;   // índice en plan_->plan.espacial
  int color_modo_ = 0;    // 0: género, 1: competencia local
  bool replicar_ = false; // mosaico 3 × 3 para ver el borde periódico
  bool aristas_ = false;  // grafo de vecindad pesado por W
  std::vector<int> orden_compras_;
  bool layout_hecho_ = false;

  // Al final: se destruyen primero y esperan a sus hilos.
  Trabajo<ResultadoPlan> t_plan_;
  Trabajo<ResultadoFrontera> t_frontera_;
  Trabajo<ResultadoBarrido> t_barrido_;
};

// Nombres de las ventanas, para el acomodo inicial.
inline constexpr const char* kConfig = "Configuración";
inline constexpr const char* kCompra = "Compra";
inline constexpr const char* kMosaico = "Mosaico";
inline constexpr const char* kConvergencia = "Convergencia";
inline constexpr const char* kCompetencia = "Matriz de competencia";
inline constexpr const char* kFrontera = "Frontera B*(α)";
inline constexpr const char* kBarrido = "Barrido α × B";

}  // namespace refor::gui
