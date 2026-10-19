#pragma once

#include <string>
#include <vector>

#include "memetico/competencia.hpp"
#include "memetico/individuo.hpp"
#include "memetico/mosaico.hpp"

namespace refor::asignacion_exacta {

struct ParametrosPLE {
  double limite_segundos = 300.0;
  double brecha_relativa = 0.0;
  bool verbose = false;
};

struct ResultadoPLE {
  memetico::Individuo asignacion;
  double competencia = 0.0;      
  double cota_inferior = 0.0;
  double brecha = 0.0;
  bool optimo = false;
  std::string estado;
  double segundos = 0.0;
};


ResultadoPLE resolver_ple(const std::vector<int>& m_s, const memetico::Mosaico& m,
                          const memetico::Competencia& w, const ParametrosPLE& p = {});

}  // namespace refor::asignacion_exacta
