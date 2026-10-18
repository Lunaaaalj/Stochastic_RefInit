#include <catch2/catch_approx.hpp>
#include <catch2/catch_test_macros.hpp>

#include "curva.hpp"
#include "datos.hpp"

using namespace refor;

TEST_CASE("los CSV de INECOL se leen completos y consistentes", "[datos]") {
  const Datos d = cargar_datos(REFOR_DATOS_DIR);

  REQUIRE(d.especies.size() == 10);
  REQUIRE(d.poligonos.size() == 30);
  CHECK(d.densidad_total() == 658);

  double area = 0;
  for (const auto& p : d.poligonos) area += p.area;
  CHECK(area == Catch::Approx(183.01));

  // Polígonos cuya área Excel había convertido en fecha en la Hoja1.
  CHECK(d.poligono(9).area == Catch::Approx(7.11));
  CHECK(d.poligono(13).area == Catch::Approx(5.05));

  CHECK(d.especies[0].nombre == "Agave lechuguilla");
  CHECK(d.poligono(1).E[0] == 8);
  CHECK(d.poligono(30).E[9] == 23);
}

TEST_CASE("la banda de metas no se sale por redondeo", "[datos]") {
  // 0.9 · 42 · 5.0 = 189 exacto, aunque en punto flotante sea 188.999…
  const Rango r = banda(42, 5.0, 0.10);
  CHECK(r.n_min == 189);
  CHECK(r.n_max == 231);
  CHECK(banda(42, 5.0, 0.0).tamano() == 1);
}
