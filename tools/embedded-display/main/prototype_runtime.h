#pragma once

#include <stdint.h>

#include "esp_err.h"
#include "esp_lcd_panel_ops.h"

/** Run the generated prototype until the device resets. */
esp_err_t openpencil_prototype_run(esp_lcd_panel_handle_t panel, uint16_t *frame_buffer);
