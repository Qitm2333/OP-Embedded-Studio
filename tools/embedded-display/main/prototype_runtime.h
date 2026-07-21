#pragma once

#include <stdint.h>
#include "esp_err.h"
#include "esp_lcd_panel_ops.h"

/** Run the prototype compiled into the USB firmware until the device resets. */
esp_err_t openpencil_prototype_run(esp_lcd_panel_handle_t panel, uint16_t *frame_buffer);

/** Run a prototype loaded from the wireless content partition until reset. */
esp_err_t openpencil_wireless_prototype_run(esp_lcd_panel_handle_t panel, uint16_t *frame_buffer);