cmake_minimum_required(VERSION 3.24)
project(reforestacion LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
  set(CMAKE_BUILD_TYPE Release CACHE STRING "Tipo de compilación" FORCE)
endif()

option(REFOR_TESTS "Compilar las pruebas" ON)
option(REFOR_GUI "Compilar la interfaz gráfica refor_gui (Dear ImGui + GLFW + OpenGL)" ON)

include(FetchContent)

# HiGHS: se usa la instalación del sistema (brew install highs, apt install
# libhighs-dev) y, si no existe, se descarga y compila.
find_package(highs CONFIG QUIET)
if(NOT highs_FOUND)
  message(STATUS "HiGHS no encontrado; se descarga v1.11.0")
  set(BUILD_SHARED_LIBS OFF)
  set(BUILD_TESTING OFF)
  set(FAST_BUILD ON)
  FetchContent_Declare(highs
    GIT_REPOSITORY https://github.com/ERGO-Code/HiGHS.git
    GIT_TAG v1.11.0
    GIT_SHALLOW TRUE)
  FetchContent_MakeAvailable(highs)
endif()

FetchContent_Declare(cli11
  GIT_REPOSITORY https://github.com/CLIUtils/CLI11.git
  GIT_TAG v2.4.2
  GIT_SHALLOW TRUE)
FetchContent_MakeAvailable(cli11)

add_library(refor_core
  src/datos.cpp
  src/simulacion.cpp
  src/exacto.cpp
  src/mochila.cpp
  src/modelo.cpp
  src/salida.cpp
  src/plan.cpp
  src/memetico/mosaico.cpp
  src/memetico/competencia.cpp
  src/memetico/individuo.cpp
  src/memetico/tabu.cpp
  src/memetico/memetico.cpp)
target_include_directories(refor_core PUBLIC src)
target_link_libraries(refor_core PUBLIC highs::highs)
target_compile_options(refor_core PRIVATE -Wall -Wextra -Wpedantic)

add_executable(refor src/main.cpp)
target_link_libraries(refor PRIVATE refor_core CLI11::CLI11)
target_compile_options(refor PRIVATE -Wall -Wextra -Wpedantic)

if(REFOR_GUI)
  # GLFW del sistema (brew install glfw, apt install libglfw3-dev) o descargado.
  find_package(glfw3 3.3 CONFIG QUIET)
  if(NOT glfw3_FOUND)
    message(STATUS "GLFW no encontrado; se descarga 3.4")
    set(GLFW_BUILD_DOCS OFF CACHE BOOL "" FORCE)
    set(GLFW_BUILD_TESTS OFF CACHE BOOL "" FORCE)
    set(GLFW_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
    FetchContent_Declare(glfw
      GIT_REPOSITORY https://github.com/glfw/glfw.git
      GIT_TAG 3.4
      GIT_SHALLOW TRUE)
    FetchContent_MakeAvailable(glfw)
  endif()
  find_package(OpenGL REQUIRED)

  FetchContent_Declare(imgui
    GIT_REPOSITORY https://github.com/ocornut/imgui.git
    GIT_TAG v1.92.8-docking
    GIT_SHALLOW TRUE)
  FetchContent_Declare(implot
    GIT_REPOSITORY https://github.com/epezent/implot.git
    GIT_TAG v1.0
    GIT_SHALLOW TRUE)
  FetchContent_MakeAvailable(imgui implot)

  add_library(imgui_lib STATIC
    ${imgui_SOURCE_DIR}/imgui.cpp
    ${imgui_SOURCE_DIR}/imgui_draw.cpp
    ${imgui_SOURCE_DIR}/imgui_tables.cpp
    ${imgui_SOURCE_DIR}/imgui_widgets.cpp
    ${imgui_SOURCE_DIR}/imgui_demo.cpp
    ${imgui_SOURCE_DIR}/backends/imgui_impl_glfw.cpp
    ${imgui_SOURCE_DIR}/backends/imgui_impl_opengl3.cpp
    ${imgui_SOURCE_DIR}/misc/cpp/imgui_stdlib.cpp
    ${implot_SOURCE_DIR}/implot.cpp
    ${implot_SOURCE_DIR}/implot_items.cpp)
  target_include_directories(imgui_lib PUBLIC
    ${imgui_SOURCE_DIR} ${imgui_SOURCE_DIR}/backends ${imgui_SOURCE_DIR}/misc/cpp ${implot_SOURCE_DIR})
  target_link_libraries(imgui_lib PUBLIC glfw OpenGL::GL)
  if(APPLE)
    target_compile_definitions(imgui_lib PUBLIC GL_SILENCE_DEPRECATION)
  endif()

  add_executable(refor_gui
    gui/main.cpp
    gui/app.cpp
    gui/estilo.cpp
    gui/vista_config.cpp
    gui/vista_compra.cpp
    gui/vista_mosaico.cpp
    gui/vista_graficas.cpp)
  target_link_libraries(refor_gui PRIVATE refor_core imgui_lib)
  target_compile_options(refor_gui PRIVATE -Wall -Wextra -Wpedantic)
endif()

if(REFOR_TESTS)
  FetchContent_Declare(catch2
    GIT_REPOSITORY https://github.com/catchorg/Catch2.git
    GIT_TAG v3.7.1
    GIT_SHALLOW TRUE)
  FetchContent_MakeAvailable(catch2)
  include(CTest)
  list(APPEND CMAKE_MODULE_PATH ${catch2_SOURCE_DIR}/extras)
  include(Catch)

  add_executable(refor_tests
    tests/test_datos.cpp
    tests/test_simulacion.cpp
    tests/test_mochila.cpp
    tests/test_memetico.cpp
    tests/test_plan.cpp)
  target_link_libraries(refor_tests PRIVATE refor_core Catch2::Catch2WithMain)
  target_compile_definitions(refor_tests PRIVATE
    REFOR_DATOS_DIR="${CMAKE_CURRENT_SOURCE_DIR}/data/processed")
  catch_discover_tests(refor_tests)
endif()
