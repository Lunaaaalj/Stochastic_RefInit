#pragma once

#include <cstdint>
#include <vector>

#include "curva.hpp"

namespace refor {

// Escenarios Monte Carlo de supervivencia con números aleatorios comunes.
//
// En el escenario k las plantas se plantan una por una y cada una sobrevive con
// probabilidad q. Se guarda x_k(L), el número de plantas necesarias para
// alcanzar L sobrevivientes (L = 1..L_max). Como el mismo escenario sirve para
// toda meta n y todo α, las comparaciones entre candidatos tienen varianza baja.
class Escenarios {
 public:
  Escenarios(double q, int L_max, long K, std::uint64_t semilla);

  long K() const { return K_; }
  int L_max() const { return L_max_; }

  // Plantas necesarias para L sobrevivientes en el escenario k (L >= 1).
  int plantas(long k, int L) const { return nivel(L)[k]; }
  // Sobrevivientes S_k(x) de las primeras x plantas, truncado en L_max.
  int sobrevivientes(long k, int x) const;

  // Curva x*(n), E[D](n) para las metas del rango, dados E existentes.
  Curva curva(int E, Rango r, double alpha) const;
  // Lo mismo para varios α en una sola pasada sobre los escenarios.
  std::vector<Curva> curvas(int E, Rango r, const std::vector<double>& alfas) const;

 private:
  // Orden L-mayor: para un nivel L, los K escenarios son contiguos, que es
  // como se recorren al calcular el cuantil de x_k(n - E).
  const std::uint16_t* nivel(int L) const { return x_.data() + (L - 1) * K_; }

  long K_;
  int L_max_;
  std::vector<std::uint16_t> x_;  // L_max × K
};

// Semilla reproducible para el par (polígono, especie), independiente del
// orden en que se procesen y del número de hilos.
std::uint64_t semilla_derivada(std::uint64_t semilla, int poligono, int especie);

}  // namespace refor
