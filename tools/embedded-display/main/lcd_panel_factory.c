/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 */

#include "lcd_panel_factory.h"
#include "esp_check.h"
#include "esp_lcd_panel_st7789.h"
#include "gc9d01n_panel.h"
#include "co5300_panel.h"
#include "st7735_panel.h"

static const char *TAG __attribute__((unused)) = "lcd_panel_factory";

const char *example_lcd_controller_name(void)
{
#if CONFIG_EXAMPLE_LCD_CONTROLLER_CO5300
    return "CO5300";
#elif CONFIG_EXAMPLE_LCD_CONTROLLER_GC9D01N
    return "GC9D01N";
#elif CONFIG_EXAMPLE_LCD_CONTROLLER_ST7735
    return "ST7735";
#else
    return "ST7789";
#endif
}

bool example_lcd_panel_needs_rgb565_byte_swap(void)
{
#if CONFIG_EXAMPLE_LCD_CONTROLLER_CO5300 || CONFIG_EXAMPLE_LCD_CONTROLLER_ST7735 || CONFIG_EXAMPLE_LCD_CONTROLLER_GC9D01N
    return true;
#else
    return false;
#endif
}
uint16_t example_lcd_panel_color_from_rgb565(uint16_t color)
{
    if (example_lcd_panel_needs_rgb565_byte_swap()) {
        color = (color << 8) | (color >> 8);
    }
    return color;
}

esp_err_t example_lcd_new_panel(const esp_lcd_panel_io_handle_t io,
                                const esp_lcd_panel_dev_config_t *panel_dev_config,
                                esp_lcd_panel_handle_t *ret_panel)
{
#if CONFIG_EXAMPLE_LCD_CONTROLLER_CO5300
    ESP_RETURN_ON_FALSE(false, ESP_ERR_NOT_SUPPORTED, TAG, "CO5300 uses QSPI initialization");
#elif CONFIG_EXAMPLE_LCD_CONTROLLER_GC9D01N
    return esp_lcd_new_panel_gc9d01n(io, panel_dev_config, ret_panel);
#elif CONFIG_EXAMPLE_LCD_CONTROLLER_ST7735
    return esp_lcd_new_panel_st7735(io, panel_dev_config, ret_panel);
#elif CONFIG_EXAMPLE_LCD_CONTROLLER_ST7789
    return esp_lcd_new_panel_st7789(io, panel_dev_config, ret_panel);
#else
    ESP_RETURN_ON_FALSE(false, ESP_ERR_NOT_SUPPORTED, TAG, "unsupported LCD controller");
#endif
}

