#include "wireless_diagnostic_view.h"

#include <stddef.h>
#include <string.h>
#include "sdkconfig.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "display_presenter.h"
#include "lcd_panel_factory.h"

#define VIEW_WIDTH CONFIG_EXAMPLE_LCD_H_RES
#define VIEW_HEIGHT CONFIG_EXAMPLE_LCD_V_RES

static uint16_t diagnostic_color(uint8_t red, uint8_t green, uint8_t blue)
{
    const uint16_t value = ((red & 0xf8) << 8) | ((green & 0xfc) << 3) | (blue >> 3);
    return example_lcd_panel_color_from_rgb565(value);
}

static void fill_rect(uint16_t *buffer, int x, int y, int width, int height, uint16_t color)
{
    if (x < 0) { width += x; x = 0; }
    if (y < 0) { height += y; y = 0; }
    if (x + width > VIEW_WIDTH) width = VIEW_WIDTH - x;
    if (y + height > VIEW_HEIGHT) height = VIEW_HEIGHT - y;
    if (width <= 0 || height <= 0) return;
    for (int row = y; row < y + height; row++) {
        for (int column = x; column < x + width; column++) {
            buffer[row * VIEW_WIDTH + column] = color;
        }
    }
}

static const uint8_t *diagnostic_glyph(char character)
{
    static const uint8_t space[5] = {0, 0, 0, 0, 0};
    static const uint8_t b[5] = {127, 73, 73, 73, 54};
    static const uint8_t d[5] = {127, 65, 65, 34, 28};
    static const uint8_t e[5] = {127, 73, 73, 73, 65};
    static const uint8_t f[5] = {127, 9, 9, 9, 1};
    static const uint8_t i[5] = {0, 65, 127, 65, 0};
    static const uint8_t l[5] = {127, 64, 64, 64, 64};
    static const uint8_t m[5] = {127, 2, 12, 2, 127};
    static const uint8_t o[5] = {62, 65, 65, 65, 62};
    static const uint8_t w[5] = {63, 64, 56, 64, 63};
    switch (character) {
        case 'B': return b;
        case 'D': return d;
        case 'E': return e;
        case 'F': return f;
        case 'I': return i;
        case 'L': return l;
        case 'M': return m;
        case 'O': return o;
        case 'W': return w;
        default: return space;
    }
}

static void draw_text(uint16_t *buffer, int x, int y, const char *label, int scale, uint16_t color)
{
    for (size_t index = 0; label[index]; index++) {
        const uint8_t *glyph = diagnostic_glyph(label[index]);
        for (int column = 0; column < 5; column++) {
            for (int row = 0; row < 7; row++) {
                if (glyph[column] & (1U << row)) {
                    fill_rect(buffer,
                              x + (int)index * 6 * scale + column * scale,
                              y + row * scale,
                              scale,
                              scale,
                              color);
                }
            }
        }
    }
}

void openpencil_wireless_diagnostic_draw(uint16_t *frame_buffer, const char *label)
{
    const int center_x = VIEW_WIDTH / 2;
    const int center_y = VIEW_HEIGHT / 2;
    const uint16_t black = diagnostic_color(0, 0, 0);
    const uint16_t white = diagnostic_color(255, 255, 255);
    const uint16_t gray = diagnostic_color(40, 40, 40);
    const uint16_t red = diagnostic_color(255, 0, 0);
    const uint16_t green = diagnostic_color(0, 255, 0);
    const uint16_t blue = diagnostic_color(0, 0, 255);
    const uint16_t yellow = diagnostic_color(255, 255, 0);

    fill_rect(frame_buffer, 0, 0, VIEW_WIDTH, VIEW_HEIGHT, black);
    for (int x = 40; x < VIEW_WIDTH; x += 40) fill_rect(frame_buffer, x, 0, 1, VIEW_HEIGHT, gray);
    for (int y = 40; y < VIEW_HEIGHT; y += 40) fill_rect(frame_buffer, 0, y, VIEW_WIDTH, 1, gray);

    fill_rect(frame_buffer, 4, 4, 20, 20, red);
    fill_rect(frame_buffer, VIEW_WIDTH - 24, 4, 20, 20, green);
    fill_rect(frame_buffer, 4, VIEW_HEIGHT - 24, 20, 20, blue);
    fill_rect(frame_buffer, VIEW_WIDTH - 24, VIEW_HEIGHT - 24, 20, 20, yellow);
    fill_rect(frame_buffer, center_x - 10, center_y, 21, 1, white);
    fill_rect(frame_buffer, center_x, center_y - 10, 1, 21, white);
    fill_rect(frame_buffer, 0, 0, VIEW_WIDTH, 1, white);
    fill_rect(frame_buffer, 0, VIEW_HEIGHT - 1, VIEW_WIDTH, 1, white);
    fill_rect(frame_buffer, 0, 0, 1, VIEW_HEIGHT, white);
    fill_rect(frame_buffer, VIEW_WIDTH - 1, 0, 1, VIEW_HEIGHT, white);

    if (label && label[0]) {
        const int scale = VIEW_WIDTH >= 400 ? 3 : (VIEW_WIDTH >= 220 ? 2 : 1);
        const int text_width = (int)strlen(label) * 6 * scale;
        const int text_x = (VIEW_WIDTH - text_width) / 2;
        const int text_y = center_y + 28;
        fill_rect(frame_buffer, text_x - 8, text_y - 6, text_width + 16, 7 * scale + 12, black);
        draw_text(frame_buffer, text_x, text_y, label, scale, white);
    }
}

esp_err_t openpencil_wireless_diagnostic_view_run(esp_lcd_panel_handle_t panel,
                                                   uint16_t *frame_buffer,
                                                   const char *label)
{
    openpencil_wireless_diagnostic_draw(frame_buffer, label);
    esp_err_t result = openpencil_display_presenter_draw(panel, VIEW_WIDTH, VIEW_HEIGHT, frame_buffer);
    if (result != ESP_OK) return result;
    while (true) vTaskDelay(pdMS_TO_TICKS(1000));
    return ESP_OK;
}
