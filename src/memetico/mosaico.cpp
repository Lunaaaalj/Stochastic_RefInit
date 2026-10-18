#include "memetico/mosaico.hpp"

namespace refor::memetico {

namespace {

int indice(int fila, int col, int filas, int columnas) {
  const int f = ((fila % filas) + filas) % filas;
  const int c = ((col % columnas) + columnas) % columnas;
  return f * columnas + c;
}

}  // namespace

Mosaico::Mosaico(int filas, int columnas) : filas_(filas), columnas_(columnas) {
  // Las 6 direcciones axiales de una posición en el tresbolillo.
  static const int df[6] = {-1, -1, 0, 0, 1, 1};
  static const int dc[6] = {0, 1, -1, 1, -1, 0};

  const int n = num_posiciones();
  vecinas_.resize(n);
  for (int f = 0; f < filas; ++f) {
    for (int c = 0; c < columnas; ++c) {
      const int v = f * columnas + c;
      for (int k = 0; k < 6; ++k) vecinas_[v].push_back(indice(f + df[k], c + dc[k], filas, columnas));
    }
  }

  for (int v = 0; v < n; ++v)
    for (int u : vecinas_[v])
      if (u > v) aristas_.emplace_back(v, u);
}

}  // namespace refor::memetico