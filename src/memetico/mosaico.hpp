#pragma once

#include <utility>
#include <vector>

namespace refor::memetico {

// Retícula del tresbolillo con bordes periódicos (un mosaico toroidal): cada
// posición tiene 6 vecinas equidistantes, como pide el reporte E2. Se
// almacena en coordenadas axiales (q, r), que no tienen el problema de
// paridad por fila de una cuadrícula cuadrada forzada a hexagonal; "filas" y
// "columnas" aquí son el tamaño del mosaico en esas dos direcciones, no
// filas/columnas de pantalla. filas * columnas debe dar el tamaño total
// (por ejemplo 4 x 13 = 52, el mosaico del reporte).
class Mosaico {
 public:
  Mosaico(int filas, int columnas);

  int num_posiciones() const { return filas_ * columnas_; }
  int filas() const { return filas_; }
  int columnas() const { return columnas_; }

  // Índice de la posición (fila, columna), resuelto con borde periódico;
  // acepta coordenadas fuera de rango (negativas incluidas).
  int indice(int fila, int col) const;

  // Las 6 vecinas de una posición, ya resueltas con borde periódico.
  const std::vector<int>& vecinas(int v) const { return vecinas_.at(v); }

  // Cada arista (u, v) con u < v, una sola vez; todas las vecinas del
  // tresbolillo están a la misma distancia, por lo que no se pondera.
  const std::vector<std::pair<int, int>>& aristas() const { return aristas_; }

 private:
  int filas_, columnas_;
  std::vector<std::vector<int>> vecinas_;
  std::vector<std::pair<int, int>> aristas_;
};

}  // namespace refor::memetico