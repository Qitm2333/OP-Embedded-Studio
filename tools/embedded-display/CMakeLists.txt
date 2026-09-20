cmake_minimum_required(VERSION 3.22)

if(OPENPENCIL_BUILD_MODE MATCHES "^(wifi|lan)-")
    set(COMPONENTS main openpencil_wifi_server)
elseif(OPENPENCIL_BUILD_MODE MATCHES "^ble-")
    set(COMPONENTS main openpencil_ble_server)
elseif(OPENPENCIL_BUILD_MODE MATCHES "^usb-")
    set(COMPONENTS main openpencil_usb_server)
endif()

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
if(IDF_TARGET STREQUAL "esp32c3")
    idf_build_set_property(DEPENDENCIES_LOCK "${CMAKE_BINARY_DIR}/dependencies.lock")
endif()
idf_build_set_property(MINIMAL_BUILD ON)
project(st7789_simple)

