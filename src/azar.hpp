#pragma once

// Entero uniforme y barajado portables sobre mt19937_64.
//
// El estándar fija mt19937_64, pero no los algoritmos de
// std::uniform_int_distribution ni de std::shuffle: libc++ (macOS) y
// libstdc++ (Linux, MinGW en Windows) dan secuencias distintas con el mismo
// generador. Estas funciones replican el algoritmo de libc++, con el que se
// generaron los resultados publicados, así que con la misma semilla el
// memético da la misma clave en las tres plataformas.

#include <bit>
#include <cstdint>
#include <iterator>
#include <random>

namespace refor {

// Entero uniforme en [a, b]. Toma los w bits bajos de cada número del
// generador, con w el mínimo que cubre el rango, y rechaza los que se pasan
// (como uniform_int_distribution de libc++).
inline std::int64_t entero_uniforme(std::mt19937_64& rng, std::int64_t a, std::int64_t b) {
  const std::uint64_t rango = static_cast<std::uint64_t>(b) - static_cast<std::uint64_t>(a) + 1;
  if (rango == 1) return a;
  if (rango == 0) return static_cast<std::int64_t>(rng());  // los 2^64 valores
  const auto mascara = ~std::uint64_t{0} >> (64 - std::bit_width(rango - 1));
  std::uint64_t u;
  do {
    u = rng() & mascara;
  } while (u >= rango);
  return a + static_cast<std::int64_t>(u);
}

// Fisher–Yates de adelante hacia atrás, como std::shuffle de libc++.
template <class It>
void barajar(It primero, It ultimo, std::mt19937_64& rng) {
  auto d = std::distance(primero, ultimo);
  if (d <= 1) return;
  for (--ultimo, --d; primero < ultimo; ++primero, --d) {
    const auto i = entero_uniforme(rng, 0, d);
    if (i != 0) std::iter_swap(primero, primero + i);
  }
}

}  // namespace refor
