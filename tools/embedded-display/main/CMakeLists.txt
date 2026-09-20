file(TO_CMAKE_PATH "$ENV{IDF_PATH}" IDF_PATH_CMAKE)

set(OPENPENCIL_SRCS "st7789_simple_main.c" "lcd_panel_factory.c" "st7735_panel.c" "gc9d01n_panel.c" "ili9342_panel.c" "co5300_panel.c" "ssd1315_panel.c" "display_presenter.c" "frame_store.c" "prototype_input.c" "prototype_runtime.c" "animated_prototype_runtime.c" "wireless_content.c" "sequence_player.c" "wireless_preview.c" "wireless_diagnostic_view.c" "wireless_status_view.c" "ble_status_view.c")

if(CONFIG_OPENPENCIL_BOARD_M5STACK_STOPWATCH)
    list(APPEND OPENPENCIL_SRCS "m5pm1.c" "m5ioe1.c")
endif()

if(CONFIG_OPENPENCIL_BOARD_M5STACK_CORES3)
    list(APPEND OPENPENCIL_SRCS "m5cores3.c")
endif()
set(OPENPENCIL_REQUIRES esp_lcd esp_driver_gpio esp_driver_i2c esp_driver_spi esp_timer esp_partition esp_lcd_co5300 esp_lcd_touch esp_lcd_touch_cst9217 bt nvs_flash)

idf_component_register(SRCS ${OPENPENCIL_SRCS}
                       INCLUDE_DIRS "."
                       PRIV_INCLUDE_DIRS "${IDF_PATH_CMAKE}/components/esp_lcd/interface"
                       REQUIRES ${OPENPENCIL_REQUIRES})
