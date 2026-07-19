file(TO_CMAKE_PATH "$ENV{IDF_PATH}" IDF_PATH_CMAKE)

set(OPENPENCIL_SRCS "st7789_simple_main.c" "lcd_panel_factory.c" "st7735_panel.c" "gc9d01n_panel.c" "co5300_panel.c" "display_presenter.c" "frame_store.c" "prototype_input.c" "prototype_runtime.c" "wireless_content.c")
set(OPENPENCIL_REQUIRES esp_lcd esp_driver_gpio esp_driver_i2c esp_driver_spi esp_timer esp_partition esp_lcd_co5300 esp_lcd_touch esp_lcd_touch_cst9217)

if(CONFIG_OPENPENCIL_WIFI_SERVER)
    list(APPEND OPENPENCIL_SRCS "wireless_server.c")
    list(APPEND OPENPENCIL_REQUIRES esp_wifi esp_event esp_netif nvs_flash esp_http_server)
endif()

idf_component_register(SRCS ${OPENPENCIL_SRCS}
                       INCLUDE_DIRS "."
                       PRIV_INCLUDE_DIRS "${IDF_PATH_CMAKE}/components/esp_lcd/interface"
                       REQUIRES ${OPENPENCIL_REQUIRES})
