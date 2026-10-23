#pragma once

// Dónde buscar los datos y dónde escribir los resultados.
//
// Desde la raíz del repo todo sigue como siempre (data/processed y docs/res).
// Fuera de él, que es como corren los binarios de una release, los datos son
// los que vienen junto al programa y los resultados van a una carpeta del
// usuario.

#include <filesystem>
#include <string>

namespace refor {

// Los cuatro CSV que necesita el modelo; mapa.csv es opcional (solo la GUI).
inline constexpr const char* kArchivosDatos[] = {"especies.csv", "poligonos.csv", "existentes.csv", "competencia.csv"};

// Ruta a partir de texto UTF-8, y al revés. En Windows std::string se
// interpreta en la página de códigos local, así que una carpeta con acentos
// fallaría con la conversión implícita.
std::filesystem::path ruta_utf8(const std::string& s);
std::string texto_utf8(const std::filesystem::path& p);

// En Windows, que la consola muestre UTF-8 (acentos, α, ×); en otros, nada.
void consola_utf8();

// Directorio del ejecutable en curso (vacío si no se puede saber).
std::filesystem::path directorio_ejecutable();

// true si dir tiene los CSV de kArchivosDatos.
bool tiene_datos(const std::filesystem::path& dir);

// data/processed si se corre desde el repo; si no, los datos incluidos en la
// release: <ejecutable>/datos o, en la app de macOS, Contents/Resources/datos.
std::filesystem::path datos_por_defecto();

// docs/res desde el repo. Fuera de él, la CLI escribe en ./resultados y la GUI
// (que suele abrirse con doble clic, sin directorio de trabajo útil) en
// <Documentos>/refor.
std::filesystem::path resultados_por_defecto(bool gui);

}  // namespace refor
