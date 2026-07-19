#pragma once

#include <stdbool.h>
#include <stdint.h>
#include "esp_err.h"
#include "esp_lcd_panel_io.h"
#include "esp_lcd_panel_ops.h"

#ifdef __cplusplus
extern "C" {
#endif

esp_err_t openpencil_display_presenter_init(void);
esp_err_t openpencil_display_presenter_draw(esp_lcd_panel_handle_t panel,
                                            int width,
                                            int height,
                                            const uint16_t *frame_buffer);
bool openpencil_display_presenter_on_color_done(esp_lcd_panel_io_handle_t panel_io,
                                                esp_lcd_panel_io_event_data_t *event_data,
                                                void *user_context);

#ifdef __cplusplus
}
#endif
