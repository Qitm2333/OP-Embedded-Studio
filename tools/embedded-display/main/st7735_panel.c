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
#include "st7735_panel.h"

static const char *TAG = "lcd_panel.st7735";

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
} st7735_panel_t;

static esp_err_t panel_st7735_del(esp_lcd_panel_t *panel);
static esp_err_t panel_st7735_reset(esp_lcd_panel_t *panel);
static esp_err_t panel_st7735_init(esp_lcd_panel_t *panel);
static esp_err_t panel_st7735_draw_bitmap(esp_lcd_panel_t *panel, int x_start, int y_start, int x_end, int y_end,
                                          const void *color_data);
static esp_err_t panel_st7735_invert_color(esp_lcd_panel_t *panel, bool invert_color_data);
static esp_err_t panel_st7735_mirror(esp_lcd_panel_t *panel, bool mirror_x, bool mirror_y);
static esp_err_t panel_st7735_swap_xy(esp_lcd_panel_t *panel, bool swap_axes);
static esp_err_t panel_st7735_set_gap(esp_lcd_panel_t *panel, int x_gap, int y_gap);
static esp_err_t panel_st7735_disp_on_off(esp_lcd_panel_t *panel, bool on_off);
static esp_err_t panel_st7735_sleep(esp_lcd_panel_t *panel, bool sleep);

esp_err_t esp_lcd_new_panel_st7735(const esp_lcd_panel_io_handle_t io,
                                   const esp_lcd_panel_dev_config_t *panel_dev_config,
                                   esp_lcd_panel_handle_t *ret_panel)
{
    esp_err_t ret = ESP_OK;
    st7735_panel_t *st7735 = NULL;
    ESP_GOTO_ON_FALSE(io && panel_dev_config && ret_panel, ESP_ERR_INVALID_ARG, err, TAG, "invalid argument");

    st7735 = calloc(1, sizeof(st7735_panel_t));
    ESP_GOTO_ON_FALSE(st7735, ESP_ERR_NO_MEM, err, TAG, "no mem for st7735 panel");

    if (panel_dev_config->reset_gpio_num >= 0) {
        gpio_config_t io_conf = {
            .mode = GPIO_MODE_OUTPUT,
            .pin_bit_mask = 1ULL << panel_dev_config->reset_gpio_num,
        };
        ESP_GOTO_ON_ERROR(gpio_config(&io_conf), err, TAG, "configure reset GPIO failed");
    }

    switch (panel_dev_config->rgb_ele_order) {
    case LCD_RGB_ELEMENT_ORDER_RGB:
        st7735->madctl_val = 0;
        break;
    case LCD_RGB_ELEMENT_ORDER_BGR:
        st7735->madctl_val = LCD_CMD_BGR_BIT;
        break;
    default:
        ESP_GOTO_ON_FALSE(false, ESP_ERR_NOT_SUPPORTED, err, TAG, "unsupported RGB element order");
        break;
    }

    switch (panel_dev_config->bits_per_pixel) {
    case 16:
        st7735->colmod_val = 0x05;
        st7735->fb_bits_per_pixel = 16;
        break;
    default:
        ESP_GOTO_ON_FALSE(false, ESP_ERR_NOT_SUPPORTED, err, TAG, "unsupported pixel width");
        break;
    }

    st7735->io = io;
    st7735->reset_gpio_num = panel_dev_config->reset_gpio_num;
    st7735->reset_level = panel_dev_config->flags.reset_active_high;
    st7735->base.del = panel_st7735_del;
    st7735->base.reset = panel_st7735_reset;
    st7735->base.init = panel_st7735_init;
    st7735->base.draw_bitmap = panel_st7735_draw_bitmap;
    st7735->base.invert_color = panel_st7735_invert_color;
    st7735->base.mirror = panel_st7735_mirror;
    st7735->base.swap_xy = panel_st7735_swap_xy;
    st7735->base.set_gap = panel_st7735_set_gap;
    st7735->base.disp_on_off = panel_st7735_disp_on_off;
    st7735->base.disp_sleep = panel_st7735_sleep;

    *ret_panel = &st7735->base;
    return ESP_OK;

err:
    if (st7735) {
        if (panel_dev_config && panel_dev_config->reset_gpio_num >= 0) {
            gpio_reset_pin(panel_dev_config->reset_gpio_num);
        }
        free(st7735);
    }
    return ret;
}

static esp_err_t panel_st7735_del(esp_lcd_panel_t *panel)
{
    st7735_panel_t *st7735 = __containerof(panel, st7735_panel_t, base);

    if (st7735->reset_gpio_num >= 0) {
        gpio_reset_pin(st7735->reset_gpio_num);
    }
    free(st7735);
    return ESP_OK;
}

static esp_err_t panel_st7735_reset(esp_lcd_panel_t *panel)
{
    st7735_panel_t *st7735 = __containerof(panel, st7735_panel_t, base);

    if (st7735->reset_gpio_num >= 0) {
        gpio_set_level(st7735->reset_gpio_num, st7735->reset_level);
        vTaskDelay(pdMS_TO_TICKS(10));
        gpio_set_level(st7735->reset_gpio_num, !st7735->reset_level);
        vTaskDelay(pdMS_TO_TICKS(120));
    } else {
        ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(st7735->io, LCD_CMD_SWRESET, NULL, 0), TAG, "software reset failed");
        vTaskDelay(pdMS_TO_TICKS(120));
    }

    return ESP_OK;
}

static esp_err_t panel_st7735_init(esp_lcd_panel_t *panel)
{
    st7735_panel_t *st7735 = __containerof(panel, st7735_panel_t, base);
    esp_lcd_panel_io_handle_t io = st7735->io;

    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, LCD_CMD_SLPOUT, NULL, 0), TAG, "exit sleep failed");
    vTaskDelay(pdMS_TO_TICKS(120));
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, LCD_CMD_COLMOD, &st7735->colmod_val, 1), TAG, "set color mode failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, LCD_CMD_MADCTL, &st7735->madctl_val, 1), TAG, "set MADCTL failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, LCD_CMD_NORON, NULL, 0), TAG, "normal display mode failed");
    vTaskDelay(pdMS_TO_TICKS(10));

    return ESP_OK;
}

static esp_err_t panel_st7735_draw_bitmap(esp_lcd_panel_t *panel, int x_start, int y_start, int x_end, int y_end,
                                          const void *color_data)
{
    st7735_panel_t *st7735 = __containerof(panel, st7735_panel_t, base);
    esp_lcd_panel_io_handle_t io = st7735->io;

    x_start += st7735->x_gap;
    x_end += st7735->x_gap;
    y_start += st7735->y_gap;
    y_end += st7735->y_gap;

    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, LCD_CMD_CASET, (uint8_t[]) {
        (x_start >> 8) & 0xFF, x_start & 0xFF,
        ((x_end - 1) >> 8) & 0xFF, (x_end - 1) & 0xFF,
    }, 4), TAG, "set column address failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(io, LCD_CMD_RASET, (uint8_t[]) {
        (y_start >> 8) & 0xFF, y_start & 0xFF,
        ((y_end - 1) >> 8) & 0xFF, (y_end - 1) & 0xFF,
    }, 4), TAG, "set row address failed");

    size_t len = (x_end - x_start) * (y_end - y_start) * st7735->fb_bits_per_pixel / 8;
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_color(io, LCD_CMD_RAMWR, color_data, len), TAG, "write color data failed");

    return ESP_OK;
}

static esp_err_t panel_st7735_invert_color(esp_lcd_panel_t *panel, bool invert_color_data)
{
    st7735_panel_t *st7735 = __containerof(panel, st7735_panel_t, base);
    int command = invert_color_data ? LCD_CMD_INVON : LCD_CMD_INVOFF;
    return esp_lcd_panel_io_tx_param(st7735->io, command, NULL, 0);
}

static esp_err_t panel_st7735_mirror(esp_lcd_panel_t *panel, bool mirror_x, bool mirror_y)
{
    st7735_panel_t *st7735 = __containerof(panel, st7735_panel_t, base);

    if (mirror_x) {
        st7735->madctl_val |= LCD_CMD_MX_BIT;
    } else {
        st7735->madctl_val &= ~LCD_CMD_MX_BIT;
    }
    if (mirror_y) {
        st7735->madctl_val |= LCD_CMD_MY_BIT;
    } else {
        st7735->madctl_val &= ~LCD_CMD_MY_BIT;
    }

    return esp_lcd_panel_io_tx_param(st7735->io, LCD_CMD_MADCTL, &st7735->madctl_val, 1);
}

static esp_err_t panel_st7735_swap_xy(esp_lcd_panel_t *panel, bool swap_axes)
{
    st7735_panel_t *st7735 = __containerof(panel, st7735_panel_t, base);

    if (swap_axes) {
        st7735->madctl_val |= LCD_CMD_MV_BIT;
    } else {
        st7735->madctl_val &= ~LCD_CMD_MV_BIT;
    }

    return esp_lcd_panel_io_tx_param(st7735->io, LCD_CMD_MADCTL, &st7735->madctl_val, 1);
}

static esp_err_t panel_st7735_set_gap(esp_lcd_panel_t *panel, int x_gap, int y_gap)
{
    st7735_panel_t *st7735 = __containerof(panel, st7735_panel_t, base);
    st7735->x_gap = x_gap;
    st7735->y_gap = y_gap;
    return ESP_OK;
}

static esp_err_t panel_st7735_disp_on_off(esp_lcd_panel_t *panel, bool on_off)
{
    st7735_panel_t *st7735 = __containerof(panel, st7735_panel_t, base);
    int command = on_off ? LCD_CMD_DISPON : LCD_CMD_DISPOFF;
    return esp_lcd_panel_io_tx_param(st7735->io, command, NULL, 0);
}

static esp_err_t panel_st7735_sleep(esp_lcd_panel_t *panel, bool sleep)
{
    st7735_panel_t *st7735 = __containerof(panel, st7735_panel_t, base);
    int command = sleep ? LCD_CMD_SLPIN : LCD_CMD_SLPOUT;
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_tx_param(st7735->io, command, NULL, 0), TAG, "set sleep mode failed");
    vTaskDelay(pdMS_TO_TICKS(120));
    return ESP_OK;
}
