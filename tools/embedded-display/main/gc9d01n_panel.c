/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 */

#include <stdlib.h>
#include <sys/cdefs.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"
#include "esp_check.h"
#include "esp_lcd_panel_commands.h"
#include "esp_lcd_panel_interface.h"
#include "esp_lcd_panel_io.h"
#include "esp_log.h"
#include "gc9d01n_panel.h"

static const char *TAG = "lcd_panel.gc9d01n";

typedef struct {
    esp_lcd_panel_t base;
    esp_lcd_panel_io_handle_t io;
    gpio_num_t reset_gpio_num;
    bool reset_level;
    int x_gap;
    int y_gap;
    uint8_t madctl_val;
    uint8_t colmod_val;
    uint8_t fb_bits_per_pixel;
} gc9d01n_panel_t;

static esp_err_t panel_gc9d01n_del(esp_lcd_panel_t *panel);
static esp_err_t panel_gc9d01n_reset(esp_lcd_panel_t *panel);
static esp_err_t panel_gc9d01n_init(esp_lcd_panel_t *panel);
static esp_err_t panel_gc9d01n_draw_bitmap(esp_lcd_panel_t *panel, int x_start, int y_start, int x_end, int y_end,
                                           const void *color_data);
static esp_err_t panel_gc9d01n_invert_color(esp_lcd_panel_t *panel, bool invert_color_data);
static esp_err_t panel_gc9d01n_mirror(esp_lcd_panel_t *panel, bool mirror_x, bool mirror_y);
static esp_err_t panel_gc9d01n_swap_xy(esp_lcd_panel_t *panel, bool swap_axes);
static esp_err_t panel_gc9d01n_set_gap(esp_lcd_panel_t *panel, int x_gap, int y_gap);
static esp_err_t panel_gc9d01n_disp_on_off(esp_lcd_panel_t *panel, bool on_off);
static esp_err_t panel_gc9d01n_sleep(esp_lcd_panel_t *panel, bool sleep);

esp_err_t esp_lcd_new_panel_gc9d01n(const esp_lcd_panel_io_handle_t io,
                                    const esp_lcd_panel_dev_config_t *panel_dev_config,
                                    esp_lcd_panel_handle_t *ret_panel)
{
    esp_err_t ret = ESP_OK;
    gc9d01n_panel_t *gc9d01n = NULL;
    ESP_GOTO_ON_FALSE(io && panel_dev_config && ret_panel, ESP_ERR_INVALID_ARG, err, TAG, "invalid argument");

    gc9d01n = calloc(1, sizeof(gc9d01n_panel_t));
    ESP_GOTO_ON_FALSE(gc9d01n, ESP_ERR_NO_MEM, err, TAG, "no mem for gc9d01n panel");

    if (panel_dev_config->reset_gpio_num >= 0) {
        gpio_config_t io_conf = {
            .mode = GPIO_MODE_OUTPUT,
            .pin_bit_mask = 1ULL << panel_dev_config->reset_gpio_num,
        };
        ESP_GOTO_ON_ERROR(gpio_config(&io_conf), err, TAG, "configure reset GPIO failed");
    }

    switch (panel_dev_config->rgb_ele_order) {
    case LCD_RGB_ELEMENT_ORDER_RGB:
        gc9d01n->madctl_val = 0;
        break;
    case LCD_RGB_ELEMENT_ORDER_BGR:
        gc9d01n->madctl_val = LCD_CMD_BGR_BIT;
        break;
    default:
        ESP_GOTO_ON_FALSE(false, ESP_ERR_NOT_SUPPORTED, err, TAG, "unsupported RGB element order");
        break;
    }

    switch (panel_dev_config->bits_per_pixel) {
    case 16:
        gc9d01n->colmod_val = 0x05;
        gc9d01n->fb_bits_per_pixel = 16;
        break;
    default:
        ESP_GOTO_ON_FALSE(false, ESP_ERR_NOT_SUPPORTED, err, TAG, "unsupported pixel width");
        break;
    }

    gc9d01n->io = io;
    gc9d01n->reset_gpio_num = panel_dev_config->reset_gpio_num;
    gc9d01n->reset_level = panel_dev_config->flags.reset_active_high;
    gc9d01n->base.del = panel_gc9d01n_del;
    gc9d01n->base.reset = panel_gc9d01n_reset;
    gc9d01n->base.init = panel_gc9d01n_init;
    gc9d01n->base.draw_bitmap = panel_gc9d01n_draw_bitmap;
    gc9d01n->base.invert_color = panel_gc9d01n_invert_color;
    gc9d01n->base.mirror = panel_gc9d01n_mirror;
    gc9d01n->base.swap_xy = panel_gc9d01n_swap_xy;
    gc9d01n->base.set_gap = panel_gc9d01n_set_gap;
    gc9d01n->base.disp_on_off = panel_gc9d01n_disp_on_off;
    gc9d01n->base.disp_sleep = panel_gc9d01n_sleep;

    *ret_panel = &gc9d01n->base;
    return ESP_OK;

err:
    if (gc9d01n) {
        if (panel_dev_config && panel_dev_config->reset_gpio_num >= 0) {
            gpio_reset_pin(panel_dev_config->reset_gpio_num);
        }
        free(gc9d01n);
    }
    return ret;
}

static esp_err_t panel_gc9d01n_del(esp_lcd_panel_t *panel)
{
    gc9d01n_panel_t *gc9d01n = __containerof(panel, gc9d01n_panel_t, base);

    if (gc9d01n->reset_gpio_num >= 0) {
        gpio_reset_pin(gc9d01n->reset_gpio_num);
    }
    free(gc9d01n);
    return ESP_OK;
}

static esp_err_t panel_gc9d01n_reset(esp_lcd_panel_t *panel)
{
    gc9d01n_panel_t *gc9d01n = __containerof(panel, gc9d01n_panel_t, base);

    if (gc9d01n->reset_gpio_num >= 0) {
        gpio_set_level(gc9d01n->reset_gpio_num, gc9d01n->reset_level);
        vTaskDelay(pdMS_TO_TICKS(10));
        gpio_set_level(gc9d01n->reset_gpio_num, !gc9d01n->reset_level);
        vTaskDelay(pdMS_TO_TICKS(120));
    } else {
        ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(gc9d01n->io, LCD_CMD_SWRESET, NULL, 0), TAG, "software reset failed");
        vTaskDelay(pdMS_TO_TICKS(120));
    }

    return ESP_OK;
}

static esp_err_t panel_gc9d01n_init(esp_lcd_panel_t *panel)
{
    gc9d01n_panel_t *gc9d01n = __containerof(panel, gc9d01n_panel_t, base);
    esp_lcd_panel_io_handle_t io = gc9d01n->io;

    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0xFE, NULL, 0), TAG, "command 0xFE failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0xEF, NULL, 0), TAG, "command 0xEF failed");

    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x86, (uint8_t[]) { 0xFF }, 1), TAG, "command 0x86 failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x87, (uint8_t[]) { 0xFF }, 1), TAG, "command 0x87 failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x8E, (uint8_t[]) { 0xFF }, 1), TAG, "command 0x8E failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x8F, (uint8_t[]) { 0xFF }, 1), TAG, "command 0x8F failed");

    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x80, (uint8_t[]) { 0x13 }, 1), TAG, "command 0x80 failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x81, (uint8_t[]) { 0x40 }, 1), TAG, "command 0x81 failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x82, (uint8_t[]) { 0x0A }, 1), TAG, "command 0x82 failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x83, (uint8_t[]) { 0x0B }, 1), TAG, "command 0x83 failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x84, (uint8_t[]) { 0x60 }, 1), TAG, "command 0x84 failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x85, (uint8_t[]) { 0x80 }, 1), TAG, "command 0x85 failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x89, (uint8_t[]) { 0x10 }, 1), TAG, "command 0x89 failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x8A, (uint8_t[]) { 0x0F }, 1), TAG, "command 0x8A failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x8B, (uint8_t[]) { 0x02 }, 1), TAG, "command 0x8B failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x8C, (uint8_t[]) { 0x5F }, 1), TAG, "command 0x8C failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x8D, (uint8_t[]) { 0x55 }, 1), TAG, "command 0x8D failed");

    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, LCD_CMD_COLMOD, &gc9d01n->colmod_val, 1), TAG, "set color mode failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0xEC, (uint8_t[]) { 0x70 }, 1), TAG, "command 0xEC failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x7E, (uint8_t[]) { 0x38 }, 1), TAG, "command 0x7E failed");

    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x74, (uint8_t[]) { 0x03, 0x16, 0x00, 0x00, 0x00, 0x00, 0x00 }, 7), TAG, "command 0x74 failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0xB5, (uint8_t[]) { 0x09, 0x09 }, 2), TAG, "command 0xB5 failed");

    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x60, (uint8_t[]) { 0x38, 0x07, 0x6D, 0x67 }, 4), TAG, "command 0x60 failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x61, (uint8_t[]) { 0x38, 0x03, 0x6D, 0x67 }, 4), TAG, "command 0x61 failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x62, (uint8_t[]) { 0x38, 0x02, 0x6D, 0x67 }, 4), TAG, "command 0x62 failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x63, (uint8_t[]) { 0x38, 0x09, 0x6D, 0x67 }, 4), TAG, "command 0x63 failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x64, (uint8_t[]) { 0x38, 0x0B, 0x71, 0x5B, 0x50, 0x50 }, 6), TAG, "command 0x64 failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x66, (uint8_t[]) { 0x38, 0x0F, 0x71, 0x5F, 0x50, 0x50 }, 6), TAG, "command 0x66 failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0xB6, (uint8_t[]) { 0x00, 0x00 }, 2), TAG, "command 0xB6 failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x6A, (uint8_t[]) { 0x00, 0x00 }, 2), TAG, "command 0x6A failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x6C, (uint8_t[]) { 0x22, 0x02, 0x22, 0x02, 0x22, 0x22, 0x50 }, 7), TAG, "command 0x6C failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x6E, (uint8_t[]) {
        0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0x02, 0x0A,
        0x0C, 0x12, 0x14, 0x1E, 0x1F, 0x00, 0x03, 0x1D,
        0x1D, 0x03, 0x00, 0x1F, 0x1E, 0x13, 0x11, 0x0B,
        0x09, 0x01, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00,
    }, 32), TAG, "command 0x6E failed");

    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x98, (uint8_t[]) { 0x3E }, 1), TAG, "command 0x98 failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x99, (uint8_t[]) { 0x3E }, 1), TAG, "command 0x99 failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x9B, (uint8_t[]) { 0x3B }, 1), TAG, "command 0x9B failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x93, (uint8_t[]) { 0x33, 0x7F, 0x00 }, 3), TAG, "command 0x93 failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x91, (uint8_t[]) { 0x0E, 0x09 }, 2), TAG, "command 0x91 failed");

    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x70, (uint8_t[]) { 0x04, 0x06, 0x0E, 0x04, 0x06, 0x0E }, 6), TAG, "command 0x70 failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0x71, (uint8_t[]) { 0x04, 0x06, 0x0E }, 3), TAG, "command 0x71 failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0xC3, (uint8_t[]) { 0x26 }, 1), TAG, "command 0xC3 failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0xC4, (uint8_t[]) { 0x1F }, 1), TAG, "command 0xC4 failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0xC9, (uint8_t[]) { 0x3A }, 1), TAG, "command 0xC9 failed");

    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0xF0, (uint8_t[]) { 0x0B, 0x0C, 0x0A, 0x06, 0x00, 0x2E }, 6), TAG, "command 0xF0 failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0xF2, (uint8_t[]) { 0x0B, 0x0C, 0x0A, 0x06, 0x00, 0x36 }, 6), TAG, "command 0xF2 failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0xF1, (uint8_t[]) { 0x45, 0x96, 0x8F, 0x32, 0x34, 0xEF }, 6), TAG, "command 0xF1 failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0xF3, (uint8_t[]) { 0x52, 0x96, 0x8F, 0x32, 0x34, 0xEF }, 6), TAG, "command 0xF3 failed");

    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0xBF, (uint8_t[]) { 0x01 }, 1), TAG, "command 0xBF failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, 0xF9, (uint8_t[]) { 0x40 }, 1), TAG, "command 0xF9 failed");

    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, LCD_CMD_CASET, (uint8_t[]) { 0x00, 0x00, 0x00, 0x9F }, 4), TAG, "set column range failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, LCD_CMD_RASET, (uint8_t[]) { 0x00, 0x00, 0x00, 0x9F }, 4), TAG, "set row range failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, LCD_CMD_SLPOUT, NULL, 0), TAG, "exit sleep failed");
    vTaskDelay(pdMS_TO_TICKS(120));
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, LCD_CMD_DISPON, NULL, 0), TAG, "display on failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, LCD_CMD_RAMWR, NULL, 0), TAG, "start memory write failed");

    return ESP_OK;
}

static esp_err_t panel_gc9d01n_draw_bitmap(esp_lcd_panel_t *panel, int x_start, int y_start, int x_end, int y_end,
                                           const void *color_data)
{
    gc9d01n_panel_t *gc9d01n = __containerof(panel, gc9d01n_panel_t, base);
    esp_lcd_panel_io_handle_t io = gc9d01n->io;

    x_start += gc9d01n->x_gap;
    x_end += gc9d01n->x_gap;
    y_start += gc9d01n->y_gap;
    y_end += gc9d01n->y_gap;

    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, LCD_CMD_CASET, (uint8_t[]) {
        (x_start >> 8) & 0xFF, x_start & 0xFF,
        ((x_end - 1) >> 8) & 0xFF, (x_end - 1) & 0xFF,
    }, 4), TAG, "set column address failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, LCD_CMD_RASET, (uint8_t[]) {
        (y_start >> 8) & 0xFF, y_start & 0xFF,
        ((y_end - 1) >> 8) & 0xFF, (y_end - 1) & 0xFF,
    }, 4), TAG, "set row address failed");

    size_t len = (x_end - x_start) * (y_end - y_start) * gc9d01n->fb_bits_per_pixel / 8;
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_color(io, LCD_CMD_RAMWR, color_data, len), TAG, "write color data failed");

    return ESP_OK;
}

static esp_err_t panel_gc9d01n_invert_color(esp_lcd_panel_t *panel, bool invert_color_data)
{
    gc9d01n_panel_t *gc9d01n = __containerof(panel, gc9d01n_panel_t, base);
    int command = invert_color_data ? LCD_CMD_INVON : LCD_CMD_INVOFF;
    return esp_lcd_panel_io_tx_param(gc9d01n->io, command, NULL, 0);
}

static esp_err_t panel_gc9d01n_mirror(esp_lcd_panel_t *panel, bool mirror_x, bool mirror_y)
{
    gc9d01n_panel_t *gc9d01n = __containerof(panel, gc9d01n_panel_t, base);

    if (mirror_x) {
        gc9d01n->madctl_val |= LCD_CMD_MX_BIT;
    } else {
        gc9d01n->madctl_val &= ~LCD_CMD_MX_BIT;
    }
    if (mirror_y) {
        gc9d01n->madctl_val |= LCD_CMD_MY_BIT;
    } else {
        gc9d01n->madctl_val &= ~LCD_CMD_MY_BIT;
    }

    return esp_lcd_panel_io_tx_param(gc9d01n->io, LCD_CMD_MADCTL, &gc9d01n->madctl_val, 1);
}

static esp_err_t panel_gc9d01n_swap_xy(esp_lcd_panel_t *panel, bool swap_axes)
{
    gc9d01n_panel_t *gc9d01n = __containerof(panel, gc9d01n_panel_t, base);

    if (swap_axes) {
        gc9d01n->madctl_val |= LCD_CMD_MV_BIT;
    } else {
        gc9d01n->madctl_val &= ~LCD_CMD_MV_BIT;
    }

    return esp_lcd_panel_io_tx_param(gc9d01n->io, LCD_CMD_MADCTL, &gc9d01n->madctl_val, 1);
}

static esp_err_t panel_gc9d01n_set_gap(esp_lcd_panel_t *panel, int x_gap, int y_gap)
{
    gc9d01n_panel_t *gc9d01n = __containerof(panel, gc9d01n_panel_t, base);
    gc9d01n->x_gap = x_gap;
    gc9d01n->y_gap = y_gap;
    return ESP_OK;
}

static esp_err_t panel_gc9d01n_disp_on_off(esp_lcd_panel_t *panel, bool on_off)
{
    gc9d01n_panel_t *gc9d01n = __containerof(panel, gc9d01n_panel_t, base);
    int command = on_off ? LCD_CMD_DISPON : LCD_CMD_DISPOFF;
    return esp_lcd_panel_io_tx_param(gc9d01n->io, command, NULL, 0);
}

static esp_err_t panel_gc9d01n_sleep(esp_lcd_panel_t *panel, bool sleep)
{
    gc9d01n_panel_t *gc9d01n = __containerof(panel, gc9d01n_panel_t, base);
    int command = sleep ? LCD_CMD_SLPIN : LCD_CMD_SLPOUT;
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(gc9d01n->io, command, NULL, 0), TAG, "set sleep mode failed");
    vTaskDelay(pdMS_TO_TICKS(120));
    return ESP_OK;
}
