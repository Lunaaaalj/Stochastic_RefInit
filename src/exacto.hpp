#pragma once

#include "curva.hpp"

namespace refor {

// Con E fijo, E + S(x) >= n equivale a S(x) >= n - E con S(x) ~ Bin(x, q), así
// que la curva puede calcularse sin simulación. Sirve para validar el Monte
// Carlo y como método alternativo (--metodo exacto).
Curva curva_exacta(int E, double q, Rango r, double alpha);

// P(Bin(x, q) >= m) y E[(m - Bin(x, q))^+], sumando la pmf en espacio log.
struct Cola {
  double prob_cubrir;
  double deficit;
};
Cola cola_binomial(int x, double q, int m);

}  // namespace refor
