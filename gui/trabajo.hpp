#pragma once

#include <atomic>
#include <chrono>
#include <exception>
#include <functional>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <thread>

namespace refor::gui {

// Estado que comparten el hilo de trabajo y la UI mientras dura un cálculo.
class Progreso {
 public:
  std::atomic<bool> cancelar{false};
  std::atomic<std::size_t> hechas{0}, total{0};  // total = 0: avance desconocido

  void etapa(std::string e) {
    std::lock_guard lock(mtx_);
    etapa_ = std::move(e);
  }
  std::string etapa() const {
    std::lock_guard lock(mtx_);
    return etapa_;
  }

 private:
  mutable std::mutex mtx_;
  std::string etapa_;
};

// Un cálculo largo en un hilo aparte que entrega un T sin bloquear la ventana.
// La función recibe el Progreso para avisar avance y consultar cancelar; lo
// que devuelve (o el mensaje de la excepción que lance) se recoge desde la UI.
template <class T>
class Trabajo {
 public:
  using Funcion = std::function<T(Progreso&)>;

  ~Trabajo() { cancelar(); }  // hilo_ se destruye primero y espera al cálculo

  bool ocupado() const { return ocupado_.load(); }

  void lanzar(Funcion f) {
    if (ocupado()) return;
    if (hilo_.joinable()) hilo_.join();
    progreso_ = std::make_unique<Progreso>();
    inicio_ = std::chrono::steady_clock::now();
    ocupado_ = true;
    hilo_ = std::jthread([this, f = std::move(f), pr = progreso_.get()] {
      try {
        T r = f(*pr);
        std::lock_guard lock(mtx_);
        resultado_ = std::move(r);
      } catch (const std::exception& e) {
        std::lock_guard lock(mtx_);
        error_ = e.what();
      }
      fin_ = std::chrono::steady_clock::now();
      ocupado_ = false;
    });
  }

  void cancelar() {
    if (progreso_) progreso_->cancelar = true;
  }

  // Nulo antes del primer cálculo.
  const Progreso* progreso() const { return progreso_.get(); }

  double segundos() const {
    const auto hasta = ocupado() ? std::chrono::steady_clock::now() : fin_.load();
    return std::chrono::duration<double>(hasta - inicio_).count();
  }

  // El resultado del último cálculo terminado, una sola vez.
  std::optional<T> recoger() {
    std::lock_guard lock(mtx_);
    auto r = std::move(resultado_);
    resultado_.reset();
    return r;
  }

  std::optional<std::string> recoger_error() {
    std::lock_guard lock(mtx_);
    auto e = std::move(error_);
    error_.reset();
    return e;
  }

 private:
  std::unique_ptr<Progreso> progreso_;
  std::atomic<bool> ocupado_{false};
  std::mutex mtx_;
  std::optional<T> resultado_;
  std::optional<std::string> error_;
  std::chrono::steady_clock::time_point inicio_;
  std::atomic<std::chrono::steady_clock::time_point> fin_{};
  std::jthread hilo_;  // último miembro: se une antes de destruir lo demás
};

}  // namespace refor::gui
