#pragma once

#include "esp_err.h"
#include "esp_lcd_panel_ops.h"

#ifdef __cplusplus
extern "C" {
#endif

esp_err_t openpencil_new_panel_ssd1315(esp_lcd_panel_handle_t *ret_panel);

#ifdef __cplusplus
}
#endif
