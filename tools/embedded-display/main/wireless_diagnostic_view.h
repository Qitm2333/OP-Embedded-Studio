#pragma once

#include <stdint.h>
#include "esp_err.h"
#include "esp_lcd_panel_ops.h"

void openpencil_wireless_diagnostic_draw(uint16_t *frame_buffer, const char *label);
esp_err_t openpencil_wireless_diagnostic_view_run(esp_lcd_panel_handle_t panel,
                                                   uint16_t *frame_buffer,
                                                   const char *label);
