#include "wireless_status_view.h"

#include <stdbool.h>
#include <string.h>
#include "sdkconfig.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "display_presenter.h"
#include "lcd_panel_factory.h"
#if CONFIG_OPENPENCIL_WIFI_SERVER
#include "wireless_server.h"
#endif

#define VIEW_WIDTH CONFIG_EXAMPLE_LCD_H_RES
#define VIEW_HEIGHT CONFIG_EXAMPLE_LCD_V_RES

static const uint8_t font5x7[96][5] = {
    {0,0,0,0,0},{0,0,95,0,0},{0,7,0,7,0},{20,127,20,127,20},{36,42,127,42,18},{35,19,8,100,98},{54,73,85,34,80},{0,5,3,0,0},{0,28,34,65,0},{0,65,34,28,0},{20,8,62,8,20},{8,8,62,8,8},{0,80,48,0,0},{8,8,8,8,8},{0,96,96,0,0},{32,16,8,4,2},
    {62,81,73,69,62},{0,66,127,64,0},{66,97,81,73,70},{33,65,69,75,49},{24,20,18,127,16},{39,69,69,69,57},{60,74,73,73,48},{1,113,9,5,3},{54,73,73,73,54},{6,73,73,41,30},{0,54,54,0,0},{0,86,54,0,0},{8,20,34,65,0},{20,20,20,20,20},{0,65,34,20,8},{2,1,81,9,6},
    {50,73,121,65,62},{126,17,17,17,126},{127,73,73,73,54},{62,65,65,65,34},{127,65,65,34,28},{127,73,73,73,65},{127,9,9,9,1},{62,65,73,73,122},{127,8,8,8,127},{0,65,127,65,0},{32,64,65,63,1},{127,8,20,34,65},{127,64,64,64,64},{127,2,12,2,127},{127,4,8,16,127},{62,65,65,65,62},
    {127,9,9,9,6},{62,65,81,33,94},{127,9,25,41,70},{70,73,73,73,49},{1,1,127,1,1},{63,64,64,64,63},{31,32,64,32,31},{63,64,56,64,63},{99,20,8,20,99},{3,4,120,4,3},{97,81,73,69,67},{0,127,65,65,0},{2,4,8,16,32},{0,65,65,127,0},{4,2,1,2,4},{64,64,64,64,64},
    {0,1,2,4,0},{32,84,84,120,64},{127,40,68,68,56},{56,68,68,68,40},{56,68,68,40,127},{56,84,84,84,24},{8,126,9,1,2},{12,82,82,82,62},{127,8,4,4,120},{0,68,125,64,0},{32,64,68,61,0},{127,16,40,68,0},{0,65,127,64,0},{124,4,24,4,120},{124,8,4,4,120},{56,68,68,68,56},
    {124,20,20,20,8},{8,20,20,24,124},{124,8,4,4,8},{72,84,84,84,32},{4,63,68,64,32},{60,64,64,32,124},{28,32,64,32,28},{60,64,48,64,60},{68,40,16,40,68},{12,80,80,80,60},{68,100,84,76,68},{0,8,54,65,0},{0,0,127,0,0},{0,65,54,8,0},{2,1,2,4,2},{127,127,127,127,127}
};

static uint16_t view_color(uint8_t red, uint8_t green, uint8_t blue)
{
    const uint16_t rgb565 = ((red & 0xf8) << 8) | ((green & 0xfc) << 3) | (blue >> 3);
    return example_lcd_panel_color_from_rgb565(rgb565);
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

static void draw_character(uint16_t *buffer, int x, int y, char character, int scale, uint16_t color)
{
    const unsigned code = (unsigned char)character;
    const uint8_t *glyph = font5x7[(code >= 32 && code <= 127) ? code - 32 : '?' - 32];
    for (int column = 0; column < 5; column++) {
        for (int row = 0; row < 7; row++) {
            if (glyph[column] & (1U << row)) {
                fill_rect(buffer, x + column * scale, y + row * scale, scale, scale, color);
            }
        }
    }
}

static void draw_text(uint16_t *buffer, int x, int y, const char *text, int scale, uint16_t color)
{
    for (size_t index = 0; text[index]; index++) {
        draw_character(buffer, x + (int)index * 6 * scale, y, text[index], scale, color);
    }
}

static int draw_wrapped_value(uint16_t *buffer, int x, int y, int width,
                              const char *value, int scale, uint16_t color, int max_lines)
{
    const int characters_per_line = width / (6 * scale);
    if (characters_per_line <= 0) return y;
    const size_t length = strlen(value);
    size_t offset = 0;
    for (int line = 0; line < max_lines && offset < length; line++) {
        char chunk[65] = {0};
        size_t count = length - offset;
        if (count > (size_t)characters_per_line) count = (size_t)characters_per_line;
        memcpy(chunk, value + offset, count);
        draw_text(buffer, x, y, chunk, scale, color);
        offset += count;
        y += 8 * scale;
    }
    return y;
}

#if CONFIG_OPENPENCIL_WIFI_SERVER
static esp_err_t draw_status(esp_lcd_panel_handle_t panel, uint16_t *frame_buffer,
                             const openpencil_wireless_status_t *status)
{
    const int margin = VIEW_WIDTH >= 400 ? 28 : 10;
    const int title_scale = VIEW_WIDTH >= 400 ? 3 : (VIEW_WIDTH >= 220 ? 2 : 1);
    const int value_scale = VIEW_WIDTH >= 400 ? 2 : 1;
    const int available_width = VIEW_WIDTH - margin * 2;
    const uint16_t background = view_color(10, 14, 22);
    const uint16_t card = view_color(22, 29, 42);
    const uint16_t text = view_color(242, 245, 250);
    const uint16_t muted = view_color(142, 154, 174);
    const uint16_t accent = view_color(88, 145, 255);
    const uint16_t success = view_color(68, 210, 132);
    const uint16_t warning = view_color(255, 184, 76);

    fill_rect(frame_buffer, 0, 0, VIEW_WIDTH, VIEW_HEIGHT, background);
    fill_rect(frame_buffer, margin / 2, margin / 2, VIEW_WIDTH - margin, VIEW_HEIGHT - margin, card);

    int y = margin;
    draw_text(frame_buffer, margin, y, "OPENPENCIL LAN", title_scale, accent);
    y += 10 * title_scale;

    const char *link = status->station_connected
        ? "CONNECTED"
        : (status->station_configured ? "CONNECTING" : "NO CONFIG");
    draw_text(frame_buffer, margin, y, link, value_scale,
              status->station_connected ? success : warning);
    y += 11 * value_scale;

    draw_text(frame_buffer, margin, y, "SSID", value_scale, muted);
    y += 8 * value_scale;
    y = draw_wrapped_value(frame_buffer, margin, y, available_width,
                           status->ssid[0] ? status->ssid : "(NOT SET)", value_scale, text, 2);
    y += 3 * value_scale;

    draw_text(frame_buffer, margin, y, "PASSWORD", value_scale, muted);
    y += 8 * value_scale;
    y = draw_wrapped_value(frame_buffer, margin, y, available_width,
                           status->password[0] ? status->password : "(OPEN)", value_scale, text, 2);
    y += 3 * value_scale;

    draw_text(frame_buffer, margin, y, "LAN IP", value_scale, muted);
    y += 8 * value_scale;
    draw_text(frame_buffer, margin, y,
              status->station_connected && status->ip[0] ? status->ip : "WAITING FOR DHCP",
              value_scale, status->station_connected ? success : text);

    return openpencil_display_presenter_draw(panel, VIEW_WIDTH, VIEW_HEIGHT, frame_buffer);
}
#endif

esp_err_t openpencil_wireless_status_view_run(esp_lcd_panel_handle_t panel,
                                               uint16_t *frame_buffer)
{
#if CONFIG_OPENPENCIL_WIFI_SERVER
    openpencil_wireless_status_t previous = {0};
    bool first_frame = true;
    while (true) {
        openpencil_wireless_status_t current = {0};
        openpencil_wireless_server_get_status(&current);
        if (first_frame || memcmp(&current, &previous, sizeof(current)) != 0) {
            esp_err_t result = draw_status(panel, frame_buffer, &current);
            if (result != ESP_OK) return result;
            previous = current;
            first_frame = false;
        }
        vTaskDelay(pdMS_TO_TICKS(250));
    }
#else
    (void)panel;
    (void)frame_buffer;
    return ESP_ERR_NOT_SUPPORTED;
#endif
}
