#include "rutas.hpp"

#include <cstdlib>
#include <system_error>

#if defined(_WIN32)
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shlobj.h>
#elif defined(__APPLE__)
#include <mach-o/dyld.h>
#include <cstdint>
#include <vector>
#endif

namespace refor {

namespace fs = std::filesystem;

fs::path ruta_utf8(const std::string& s) {
  return fs::path(std::u8string(reinterpret_cast<const char8_t*>(s.data()), s.size()));
}

std::string texto_utf8(const fs::path& p) {
  const std::u8string u = p.u8string();
  return std::string(reinterpret_cast<const char*>(u.data()), u.size());
}

void consola_utf8() {
#if defined(_WIN32)
  SetConsoleOutputCP(CP_UTF8);
#endif
}

fs::path directorio_ejecutable() {
  std::error_code ec;
#if defined(_WIN32)
  std::wstring buf(MAX_PATH, L'\0');
  for (;;) {
    const DWORD n = GetModuleFileNameW(nullptr, buf.data(), static_cast<DWORD>(buf.size()));
    if (n == 0) return {};
    if (n < buf.size()) {
      buf.resize(n);
      break;
    }
    buf.resize(buf.size() * 2);
  }
  return fs::path(buf).parent_path();
#elif defined(__APPLE__)
  std::uint32_t tam = 0;
  _NSGetExecutablePath(nullptr, &tam);
  std::vector<char> buf(tam);
  if (_NSGetExecutablePath(buf.data(), &tam) != 0) return {};
  const fs::path p = fs::weakly_canonical(buf.data(), ec);
  return ec ? fs::path(buf.data()).parent_path() : p.parent_path();
#else
  const fs::path p = fs::read_symlink("/proc/self/exe", ec);
  return ec ? fs::path() : p.parent_path();
#endif
}

bool tiene_datos(const fs::path& dir) {
  std::error_code ec;
  for (const char* archivo : kArchivosDatos)
    if (!fs::is_regular_file(dir / archivo, ec)) return false;
  return true;
}

fs::path datos_por_defecto() {
  const fs::path repo = "data/processed";
  if (tiene_datos(repo)) return repo;
  if (const fs::path exe = directorio_ejecutable(); !exe.empty()) {
    for (const fs::path& p : {exe / "datos", exe.parent_path() / "Resources" / "datos"})
      if (tiene_datos(p)) return p;
  }
  return repo;  // para que el error diga qué carpeta se buscó
}

namespace {

fs::path documentos() {
  std::error_code ec;
#if defined(_WIN32)
  PWSTR w = nullptr;
  if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_Documents, 0, nullptr, &w))) {
    const fs::path p(w);
    CoTaskMemFree(w);
    return p;
  }
  if (const wchar_t* perfil = _wgetenv(L"USERPROFILE")) return fs::path(perfil) / "Documents";
  return {};
#else
  const char* home = std::getenv("HOME");
  if (!home) return {};
  // macOS siempre tiene Documents; en Linux la carpeta cambia con el idioma.
  for (const char* nombre : {"Documents", "Documentos"})
    if (fs::is_directory(fs::path(home) / nombre, ec)) return fs::path(home) / nombre;
  return home;
#endif
}

}  // namespace

fs::path resultados_por_defecto(bool gui) {
  if (tiene_datos("data/processed")) return "docs/res";
  if (gui)
    if (const fs::path d = documentos(); !d.empty()) return d / "refor";
  return "resultados";
}

}  // namespace refor
