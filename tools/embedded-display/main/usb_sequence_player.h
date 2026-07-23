#pragma once

#include <stddef.h>
#include <stdint.h>
#include "esp_err.h"
#include "esp_lcd_panel_ops.h"

#ifdef __cplusplus
extern "C" {
#endif

esp_err_t openpencil_usb_sequence_run(esp_lcd_panel_handle_t panel,
                                      uint16_t *primary_frame_buffer,
                                      size_t frame_pixels,
                                      int width,
                                      int height);

#ifdef __cplusplus
}
#endif
