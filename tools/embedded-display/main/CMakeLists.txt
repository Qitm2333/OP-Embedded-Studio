file(TO_CMAKE_PATH "$ENV{IDF_PATH}" IDF_PATH_CMAKE)

set(OPENPENCIL_SRCS "st7789_simple_main.c" "lcd_panel_factory.c" "st7735_panel.c" "gc9d01n_panel.c" "co5300_panel.c" "display_presenter.c" "frame_store.c" "prototype_input.c" "prototype_runtime.c" "wireless_content.c" "wireless_preview.c" "wireless_diagnostic_view.c" "wireless_status_view.c" "ble_status_view.c")
set(OPENPENCIL_REQUIRES esp_lcd esp_driver_gpio esp_driver_i2c esp_driver_spi esp_timer esp_partition esp_lcd_co5300 esp_lcd_touch esp_lcd_touch_cst9217 bt nvs_flash)

idf_component_register(SRCS ${OPENPENCIL_SRCS}
                       INCLUDE_DIRS "."
                       PRIV_INCLUDE_DIRS "${IDF_PATH_CMAKE}/components/esp_lcd/interface"
                       REQUIRES ${OPENPENCIL_REQUIRES})
