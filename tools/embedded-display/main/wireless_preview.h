#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include "esp_err.h"
#include "esp_lcd_panel_ops.h"

esp_err_t openpencil_wireless_preview_init(esp_lcd_panel_handle_t panel,
                                            uint16_t *frame_buffer,
                                            size_t frame_pixels);
esp_err_t openpencil_wireless_preview_apply(const uint8_t *data, size_t length);
esp_err_t openpencil_wireless_preview_stop(void);
bool openpencil_wireless_preview_is_active(void);
