#include "ble_status_view.h"

#include <stdbool.h>
#include <stdio.h>
#include <string.h>
#include "sdkconfig.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "ble_server.h"
#include "display_presenter.h"
#include "lcd_panel_factory.h"

#define VIEW_WIDTH CONFIG_EXAMPLE_LCD_H_RES
#define VIEW_HEIGHT CONFIG_EXAMPLE_LCD_V_RES

static const char *TAG = "ble_status_view";

static const uint8_t upper_font[26][5] = {
    {126,17,17,17,126},{127,73,73,73,54},{62,65,65,65,34},{127,65,65,34,28},
    {127,73,73,73,65},{127,9,9,9,1},{62,65,73,73,122},{127,8,8,8,127},
    {0,65,127,65,0},{32,64,65,63,1},{127,8,20,34,65},{127,64,64,64,64},
    {127,2,12,2,127},{127,4,8,16,127},{62,65,65,65,62},{127,9,9,9,6},
    {62,65,81,33,94},{127,9,25,41,70},{70,73,73,73,49},{1,1,127,1,1},
    {63,64,64,64,63},{31,32,64,32,31},{63,64,56,64,63},{99,20,8,20,99},
    {3,4,120,4,3},{97,81,73,69,67}
};

static const uint8_t digit_font[10][5] = {
    {62,81,73,69,62},{0,66,127,64,0},{66,97,81,73,70},{33,65,69,75,49},
    {24,20,18,127,16},{39,69,69,69,57},{60,74,73,73,48},{1,113,9,5,3},
    {54,73,73,73,54},{6,73,73,41,30}
};

static const uint8_t *glyph(char character)
{
    if (character >= 'A' && character <= 'Z') return upper_font[character - 'A'];
    if (character >= '0' && character <= '9') return digit_font[character - '0'];
    static const uint8_t space[5] = {0,0,0,0,0};
    static const uint8_t dash[5] = {8,8,8,8,8};
    static const uint8_t colon[5] = {0,54,54,0,0};
    static const uint8_t percent[5] = {35,19,8,100,98};
    if (character == '-') return dash;
    if (character == ':') return colon;
    if (character == '%') return percent;
    return space;
}

static uint16_t color(uint8_t red, uint8_t green, uint8_t blue)
{
    const uint16_t value = ((red & 0xf8) << 8) | ((green & 0xfc) << 3) | (blue >> 3);
    return example_lcd_panel_color_from_rgb565(value);
}

static void fill(uint16_t *buffer, int x, int y, int width, int height, uint16_t value)
{
    if (x < 0) { width += x; x = 0; }
    if (y < 0) { height += y; y = 0; }
    if (x + width > VIEW_WIDTH) width = VIEW_WIDTH - x;
    if (y + height > VIEW_HEIGHT) height = VIEW_HEIGHT - y;
    if (width <= 0 || height <= 0) return;
    for (int row = y; row < y + height; row++) {
        for (int column = x; column < x + width; column++) {
            buffer[row * VIEW_WIDTH + column] = value;
        }
    }
}

static void text(uint16_t *buffer, int x, int y, const char *value, int scale, uint16_t ink)
{
    for (size_t index = 0; value[index]; index++) {
        const uint8_t *bitmap = glyph(value[index]);
        for (int column = 0; column < 5; column++) {
            for (int row = 0; row < 7; row++) {
                if (bitmap[column] & (1U << row)) {
                    fill(buffer, x + (int)index * 6 * scale + column * scale,
                         y + row * scale, scale, scale, ink);
                }
            }
        }
    }
}

static int text_width(const char *value, int scale)
{
    return (int)strlen(value) * 6 * scale;
}

static void centered_text(uint16_t *buffer, int y, const char *value, int scale, uint16_t ink)
{
    const int width = text_width(value, scale);
    text(buffer, (VIEW_WIDTH - width) / 2, y, value, scale, ink);
}

static esp_err_t draw(esp_lcd_panel_handle_t panel, uint16_t *buffer,
                      const openpencil_ble_status_t *status)
{
    const int scale = VIEW_WIDTH >= 400 ? 2 : (VIEW_WIDTH >= 220 ? 2 : 1);
    const int background = color(10, 14, 22);
    const uint16_t white = color(242, 245, 250);
    const uint16_t muted = color(142, 154, 174);
    const uint16_t blue = color(88, 145, 255);
    const uint16_t green = color(68, 210, 132);
    const uint16_t orange = color(255, 184, 76);
    const uint16_t red = color(255, 96, 96);
    fill(buffer, 0, 0, VIEW_WIDTH, VIEW_HEIGHT, (uint16_t)background);

    const char *state = !status->connected ? "WAITING" :
                        status->failed ? "ERROR" :
                        status->receiving ? "RECEIVING" :
                        status->completed ? "COMPLETE" : "READY";
    const uint16_t state_color = status->failed ? red :
                                 status->receiving || status->completed ? green : orange;
    const int title_y = VIEW_HEIGHT / 2 - 74;
    centered_text(buffer, title_y, "BLE FRAME", scale, blue);
    centered_text(buffer, title_y + 16, state, scale, state_color);

    const int bar_width = VIEW_WIDTH >= 400 ? 300 : VIEW_WIDTH - 32;
    const int bar_x = (VIEW_WIDTH - bar_width) / 2;
    const int bar_y = title_y + 42;
    const int bar_height = scale * 5;
    const int percent = status->total_bytes == 0 ? 0 :
        (int)((status->received_bytes * 100U) / status->total_bytes);
    fill(buffer, bar_x, bar_y, bar_width, bar_height, color(45, 54, 72));
    fill(buffer, bar_x, bar_y, (bar_width * percent) / 100, bar_height,
         status->failed ? red : green);

    char progress[8];
    snprintf(progress, sizeof(progress), "%d%%", percent);
    centered_text(buffer, bar_y + 18, progress, scale, white);
    centered_text(buffer, bar_y + 36,
                  status->paired ? "PAIRED" : (status->connected ? "READY" : "WAITING"),
                  scale, muted);
    return openpencil_display_presenter_draw(panel, VIEW_WIDTH, VIEW_HEIGHT, buffer);
}

esp_err_t openpencil_ble_status_view_run(esp_lcd_panel_handle_t panel, uint16_t *frame_buffer)
{
    openpencil_ble_status_t previous = {0};
    bool first_frame = true;
    while (true) {
        openpencil_ble_status_t current = {0};
        openpencil_ble_server_get_status(&current);
        const bool status_changed = memcmp(&current, &previous, sizeof(current)) != 0;
        // The BLE receive callback writes the image buffer from the NimBLE task.
        // Avoid full-frame LCD DMA transfers while receiving; CO5300 can
        // otherwise underflow the DMA engine and reboot the device.
        const bool can_draw = first_frame || !current.receiving;
        if (can_draw && (first_frame || status_changed)) {
            const esp_err_t draw_result = draw(panel, frame_buffer, &current);
            if (draw_result != ESP_OK) {
                ESP_LOGW(TAG, "status frame draw failed: %s", esp_err_to_name(draw_result));
            } else {
                previous = current;
                first_frame = false;
            }
        }
        vTaskDelay(pdMS_TO_TICKS(250));
    }
}



