#include "ssd1315_panel.h"

#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <sys/cdefs.h>

#include "driver/i2c_master.h"
#include "esp_check.h"
#include "esp_lcd_panel_interface.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "sdkconfig.h"

#define SSD1315_PAGES (CONFIG_EXAMPLE_LCD_V_RES / 8)
#define SSD1315_TIMEOUT_MS 100

static const char *TAG = "lcd_panel.ssd1315";

typedef struct {
    esp_lcd_panel_t base;
    i2c_master_bus_handle_t bus;
    i2c_master_dev_handle_t device;
    uint8_t framebuffer[SSD1315_PAGES][CONFIG_EXAMPLE_LCD_H_RES];
} ssd1315_panel_t;

static esp_err_t ssd1315_command(ssd1315_panel_t *ssd1315, uint8_t command)
{
    const uint8_t bytes[] = {0x00, command};
    return i2c_master_transmit(ssd1315->device, bytes, sizeof(bytes), SSD1315_TIMEOUT_MS);
}

static esp_err_t ssd1315_data(ssd1315_panel_t *ssd1315, const uint8_t *data, size_t length)
{
    uint8_t bytes[CONFIG_EXAMPLE_LCD_H_RES + 1];
    ESP_RETURN_ON_FALSE(length <= CONFIG_EXAMPLE_LCD_H_RES,
                        ESP_ERR_INVALID_SIZE,
                        TAG,
                        "OLED row is too wide");
    bytes[0] = 0x40;
    memcpy(bytes + 1, data, length);
    return i2c_master_transmit(ssd1315->device, bytes, length + 1, SSD1315_TIMEOUT_MS);
}

static esp_err_t ssd1315_flush(ssd1315_panel_t *ssd1315)
{
    for (uint8_t page = 0; page < SSD1315_PAGES; ++page) {
        ESP_RETURN_ON_ERROR(ssd1315_command(ssd1315, 0xB0 + page), TAG, "set OLED page");
        ESP_RETURN_ON_ERROR(
            ssd1315_command(ssd1315, CONFIG_EXAMPLE_LCD_COLUMN_OFFSET & 0x0F),
            TAG,
            "set OLED low column");
        ESP_RETURN_ON_ERROR(
            ssd1315_command(ssd1315, 0x10 + ((CONFIG_EXAMPLE_LCD_COLUMN_OFFSET >> 4) & 0x0F)),
            TAG,
            "set OLED high column");
        ESP_RETURN_ON_ERROR(
            ssd1315_data(ssd1315, ssd1315->framebuffer[page], CONFIG_EXAMPLE_LCD_H_RES),
            TAG,
            "write OLED page");
    }
    return ESP_OK;
}

static bool rgb565_pixel_on(uint16_t color, int x, int y)
{
    const uint32_t red = ((color >> 11) & 0x1F) * 255 / 31;
    const uint32_t green = ((color >> 5) & 0x3F) * 255 / 63;
    const uint32_t blue = (color & 0x1F) * 255 / 31;
    const uint32_t luminance = (red * 77 + green * 150 + blue * 29) >> 8;
#if CONFIG_OPENPENCIL_SSD1315_RENDER_DITHERED
    static const uint8_t bayer4x4[16] = {
        0, 8, 2, 10,
        12, 4, 14, 6,
        3, 11, 1, 9,
        15, 7, 13, 5,
    };
    const uint32_t threshold = (uint32_t)bayer4x4[(y & 3) * 4 + (x & 3)] * 16 + 8;
    return luminance >= threshold;
#else
    (void)x;
    (void)y;
    return luminance >= 128;
#endif
}

static esp_err_t panel_ssd1315_del(esp_lcd_panel_t *panel)
{
    ssd1315_panel_t *ssd1315 = __containerof(panel, ssd1315_panel_t, base);
    if (ssd1315->device) i2c_master_bus_rm_device(ssd1315->device);
    if (ssd1315->bus) i2c_del_master_bus(ssd1315->bus);
    free(ssd1315);
    return ESP_OK;
}

static esp_err_t panel_ssd1315_reset(esp_lcd_panel_t *panel)
{
    (void)panel;
    vTaskDelay(pdMS_TO_TICKS(50));
    return ESP_OK;
}

static esp_err_t panel_ssd1315_init(esp_lcd_panel_t *panel)
{
    ssd1315_panel_t *ssd1315 = __containerof(panel, ssd1315_panel_t, base);
    static const uint8_t init_sequence[] = {
        0xAE, 0xD5, 0x80, 0xA8, 0x27, 0xD3, 0x00, 0x40,
        0x8D, 0x14, 0x20, 0x02, 0xA1, 0xC8, 0xDA, 0x12,
        0x81, 0xCF, 0xD9, 0xF1, 0xDB, 0x40, 0xA4, 0xA6, 0xAF,
    };
    for (size_t index = 0; index < sizeof(init_sequence); ++index) {
        ESP_RETURN_ON_ERROR(ssd1315_command(ssd1315, init_sequence[index]),
                            TAG,
                            "send OLED initialization byte");
    }
    memset(ssd1315->framebuffer, 0, sizeof(ssd1315->framebuffer));
    return ssd1315_flush(ssd1315);
}

static esp_err_t panel_ssd1315_draw_bitmap(esp_lcd_panel_t *panel,
                                           int x_start,
                                           int y_start,
                                           int x_end,
                                           int y_end,
                                           const void *color_data)
{
    ssd1315_panel_t *ssd1315 = __containerof(panel, ssd1315_panel_t, base);
    ESP_RETURN_ON_FALSE(color_data && x_start >= 0 && y_start >= 0 &&
                            x_end <= CONFIG_EXAMPLE_LCD_H_RES &&
                            y_end <= CONFIG_EXAMPLE_LCD_V_RES &&
                            x_start < x_end && y_start < y_end,
                        ESP_ERR_INVALID_ARG,
                        TAG,
                        "invalid OLED draw region");
    const uint16_t *pixels = color_data;
    const int width = x_end - x_start;
    for (int y = y_start; y < y_end; ++y) {
        for (int x = x_start; x < x_end; ++x) {
            const uint8_t mask = (uint8_t)(1U << (y & 7));
            uint8_t *column = &ssd1315->framebuffer[y >> 3][x];
            if (rgb565_pixel_on(pixels[(y - y_start) * width + (x - x_start)], x, y)) {
                *column |= mask;
            } else {
                *column &= (uint8_t)~mask;
            }
        }
    }
    return ssd1315_flush(ssd1315);
}

static esp_err_t panel_ssd1315_invert_color(esp_lcd_panel_t *panel, bool invert)
{
    ssd1315_panel_t *ssd1315 = __containerof(panel, ssd1315_panel_t, base);
    return ssd1315_command(ssd1315, invert ? 0xA7 : 0xA6);
}

static esp_err_t panel_ssd1315_mirror(esp_lcd_panel_t *panel, bool mirror_x, bool mirror_y)
{
    ssd1315_panel_t *ssd1315 = __containerof(panel, ssd1315_panel_t, base);
    ESP_RETURN_ON_ERROR(ssd1315_command(ssd1315, mirror_x ? 0xA0 : 0xA1),
                        TAG,
                        "set OLED horizontal direction");
    return ssd1315_command(ssd1315, mirror_y ? 0xC0 : 0xC8);
}

static esp_err_t panel_ssd1315_swap_xy(esp_lcd_panel_t *panel, bool swap_axes)
{
    (void)panel;
    return swap_axes ? ESP_ERR_NOT_SUPPORTED : ESP_OK;
}

static esp_err_t panel_ssd1315_set_gap(esp_lcd_panel_t *panel, int x_gap, int y_gap)
{
    (void)panel;
    return (x_gap == 0 && y_gap == 0) ? ESP_OK : ESP_ERR_NOT_SUPPORTED;
}

static esp_err_t panel_ssd1315_disp_on_off(esp_lcd_panel_t *panel, bool on)
{
    ssd1315_panel_t *ssd1315 = __containerof(panel, ssd1315_panel_t, base);
    return ssd1315_command(ssd1315, on ? 0xAF : 0xAE);
}

static esp_err_t panel_ssd1315_sleep(esp_lcd_panel_t *panel, bool sleep)
{
    return panel_ssd1315_disp_on_off(panel, !sleep);
}

esp_err_t openpencil_new_panel_ssd1315(esp_lcd_panel_handle_t *ret_panel)
{
    ESP_RETURN_ON_FALSE(ret_panel, ESP_ERR_INVALID_ARG, TAG, "missing OLED panel output");
    ssd1315_panel_t *ssd1315 = calloc(1, sizeof(*ssd1315));
    ESP_RETURN_ON_FALSE(ssd1315, ESP_ERR_NO_MEM, TAG, "allocate OLED panel");

    const i2c_master_bus_config_t bus_config = {
        .i2c_port = I2C_NUM_0,
        .sda_io_num = CONFIG_EXAMPLE_PIN_NUM_I2C_SDA,
        .scl_io_num = CONFIG_EXAMPLE_PIN_NUM_I2C_SCL,
        .clk_source = I2C_CLK_SRC_DEFAULT,
        .glitch_ignore_cnt = 7,
        .flags.enable_internal_pullup = true,
    };
    esp_err_t result = i2c_new_master_bus(&bus_config, &ssd1315->bus);
    if (result != ESP_OK) goto error;

    const i2c_device_config_t device_config = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = CONFIG_EXAMPLE_LCD_I2C_ADDRESS,
        .scl_speed_hz = CONFIG_EXAMPLE_LCD_I2C_FREQ_HZ,
    };
    result = i2c_master_bus_add_device(ssd1315->bus, &device_config, &ssd1315->device);
    if (result != ESP_OK) goto error;
    result = i2c_master_probe(ssd1315->bus, CONFIG_EXAMPLE_LCD_I2C_ADDRESS, SSD1315_TIMEOUT_MS);
    if (result != ESP_OK) goto error;

    ssd1315->base.del = panel_ssd1315_del;
    ssd1315->base.reset = panel_ssd1315_reset;
    ssd1315->base.init = panel_ssd1315_init;
    ssd1315->base.draw_bitmap = panel_ssd1315_draw_bitmap;
    ssd1315->base.invert_color = panel_ssd1315_invert_color;
    ssd1315->base.mirror = panel_ssd1315_mirror;
    ssd1315->base.swap_xy = panel_ssd1315_swap_xy;
    ssd1315->base.set_gap = panel_ssd1315_set_gap;
    ssd1315->base.disp_on_off = panel_ssd1315_disp_on_off;
    ssd1315->base.disp_sleep = panel_ssd1315_sleep;
    *ret_panel = &ssd1315->base;
    ESP_LOGI(TAG,
             "SSD1315 ready at 0x%02X: %dx%d, SDA GPIO%d, SCL GPIO%d",
             CONFIG_EXAMPLE_LCD_I2C_ADDRESS,
             CONFIG_EXAMPLE_LCD_H_RES,
             CONFIG_EXAMPLE_LCD_V_RES,
             CONFIG_EXAMPLE_PIN_NUM_I2C_SDA,
             CONFIG_EXAMPLE_PIN_NUM_I2C_SCL);
    return ESP_OK;

error:
    if (ssd1315->device) i2c_master_bus_rm_device(ssd1315->device);
    if (ssd1315->bus) i2c_del_master_bus(ssd1315->bus);
    free(ssd1315);
    return result;
}
