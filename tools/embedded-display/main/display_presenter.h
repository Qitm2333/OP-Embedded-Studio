#pragma once

#include <stdbool.h>
#include <stdint.h>
#include "esp_err.h"
#include "esp_lcd_panel_io.h"
#include "esp_lcd_panel_ops.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    int64_t te_wait_us;
    int64_t transfer_us;
    int64_t total_us;
} openpencil_display_presenter_metrics_t;

esp_err_t openpencil_display_presenter_init(void);
esp_err_t openpencil_display_presenter_draw(esp_lcd_panel_handle_t panel,
                                            int width,
                                            int height,
                                            const uint16_t *frame_buffer);
esp_err_t openpencil_display_presenter_draw_measured(
    esp_lcd_panel_handle_t panel,
    int width,
    int height,
    const uint16_t *frame_buffer,
    openpencil_display_presenter_metrics_t *metrics);
esp_err_t openpencil_display_presenter_draw_region_measured(
    esp_lcd_panel_handle_t panel,
    int x,
    int y,
    int width,
    int height,
    const uint16_t *pixels,
    openpencil_display_presenter_metrics_t *metrics);

bool openpencil_display_presenter_on_color_done(esp_lcd_panel_io_handle_t panel_io,
                                                esp_lcd_panel_io_event_data_t *event_data,
                                                void *user_context);

#ifdef __cplusplus
}
#endif
