/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 */

#pragma once

#include <stdbool.h>
#include <stdint.h>
#include "esp_lcd_panel_vendor.h"

#ifdef __cplusplus
extern "C" {
#endif

const char *example_lcd_controller_name(void);
bool example_lcd_panel_needs_rgb565_byte_swap(void);
uint16_t example_lcd_panel_color_from_rgb565(uint16_t color);
esp_err_t example_lcd_new_panel(const esp_lcd_panel_io_handle_t io,
                                const esp_lcd_panel_dev_config_t *panel_dev_config,
                                esp_lcd_panel_handle_t *ret_panel);

#ifdef __cplusplus
}
#endif
