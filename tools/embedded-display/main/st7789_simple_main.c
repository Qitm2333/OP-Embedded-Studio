/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: CC0-1.0
 */

#include <stdbool.h>
#include <stdint.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_check.h"
#include "esp_heap_caps.h"
#include "esp_lcd_panel_io.h"
#include "esp_lcd_panel_ops.h"
#include "esp_lcd_panel_vendor.h"
#include "esp_log.h"
#include "driver/gpio.h"
#include "driver/spi_master.h"
#include "generated_image.h"
#include "display_presenter.h"
#include "frame_store.h"
#include "generated_prototype.h"
#include "lcd_panel_factory.h"
#include "prototype_runtime.h"
#include "wireless_content.h"
#if CONFIG_OPENPENCIL_WIFI_SERVER
#include "wireless_server.h"
#endif
#include "co5300_panel.h"

static const char *TAG = "lcd_simple";

#define LCD_HOST              SPI2_HOST
#define LCD_CMD_BITS          8
#define LCD_PARAM_BITS        8
#define LCD_FRAME_PIXELS      (CONFIG_EXAMPLE_LCD_H_RES * CONFIG_EXAMPLE_LCD_V_RES)

#if CONFIG_EXAMPLE_LCD_RGB_ORDER_BGR
#define LCD_RGB_ELEMENT_ORDER LCD_RGB_ELEMENT_ORDER_BGR
#else
#define LCD_RGB_ELEMENT_ORDER LCD_RGB_ELEMENT_ORDER_RGB
#endif

#ifdef CONFIG_EXAMPLE_LCD_MIRROR_X
#define LCD_MIRROR_X true
#else
#define LCD_MIRROR_X false
#endif

#ifdef CONFIG_EXAMPLE_LCD_MIRROR_Y
#define LCD_MIRROR_Y true
#else
#define LCD_MIRROR_Y false
#endif

#ifdef CONFIG_EXAMPLE_LCD_SWAP_XY
#define LCD_SWAP_XY true
#else
#define LCD_SWAP_XY false
#endif

#ifdef CONFIG_EXAMPLE_LCD_INVERT_COLOR
#define LCD_INVERT_COLOR true
#else
#define LCD_INVERT_COLOR false
#endif

static uint16_t panel_color_from_rgb565(uint16_t color)
{
    return example_lcd_panel_color_from_rgb565(color);
}

static uint16_t rgb565(uint8_t red, uint8_t green, uint8_t blue)
{
    return panel_color_from_rgb565(((red & 0xF8) << 8) | ((green & 0xF8) << 3) | (blue >> 3));
}

static esp_err_t backlight_init(void)
{
#if CONFIG_EXAMPLE_PIN_NUM_BK_LIGHT >= 0
    gpio_config_t bk_gpio_config = {
        .mode = GPIO_MODE_OUTPUT,
        .pin_bit_mask = 1ULL << CONFIG_EXAMPLE_PIN_NUM_BK_LIGHT,
    };
    ESP_RETURN_ON_ERROR(gpio_config(&bk_gpio_config), TAG, "configure backlight GPIO failed");
    gpio_set_level(CONFIG_EXAMPLE_PIN_NUM_BK_LIGHT, !CONFIG_EXAMPLE_LCD_BK_LIGHT_ON_LEVEL);
#endif
    return ESP_OK;
}

static void backlight_set(bool on)
{
#if CONFIG_EXAMPLE_PIN_NUM_BK_LIGHT >= 0
    gpio_set_level(CONFIG_EXAMPLE_PIN_NUM_BK_LIGHT, on ? CONFIG_EXAMPLE_LCD_BK_LIGHT_ON_LEVEL : !CONFIG_EXAMPLE_LCD_BK_LIGHT_ON_LEVEL);
#else
    (void)on;
#endif
}

static void frame_fill(uint16_t *frame_buffer, uint16_t color)
{
    for (int i = 0; i < LCD_FRAME_PIXELS; i++) {
        frame_buffer[i] = color;
    }
}

static void frame_rect(uint16_t *frame_buffer, int x1, int y1, int x2, int y2, uint16_t color)
{
    if (x1 < 0) {
        x1 = 0;
    }
    if (y1 < 0) {
        y1 = 0;
    }
    if (x2 > CONFIG_EXAMPLE_LCD_H_RES) {
        x2 = CONFIG_EXAMPLE_LCD_H_RES;
    }
    if (y2 > CONFIG_EXAMPLE_LCD_V_RES) {
        y2 = CONFIG_EXAMPLE_LCD_V_RES;
    }
    if (x2 <= x1 || y2 <= y1) {
        return;
    }

    for (int y = y1; y < y2; y++) {
        for (int x = x1; x < x2; x++) {
            frame_buffer[y * CONFIG_EXAMPLE_LCD_H_RES + x] = color;
        }
    }
}

static esp_err_t draw_geometry_test(esp_lcd_panel_handle_t panel, uint16_t *frame_buffer)
{
    const int width = CONFIG_EXAMPLE_LCD_H_RES;
    const int height = CONFIG_EXAMPLE_LCD_V_RES;
    const int center_x = width / 2;
    const int center_y = height / 2;
    const uint16_t black = rgb565(0, 0, 0);
    const uint16_t white = rgb565(255, 255, 255);
    const uint16_t gray = rgb565(40, 40, 40);
    const uint16_t red = rgb565(255, 0, 0);
    const uint16_t green = rgb565(0, 255, 0);
    const uint16_t blue = rgb565(0, 0, 255);
    const uint16_t yellow = rgb565(255, 255, 0);

    frame_fill(frame_buffer, black);

    for (int x = 40; x < width; x += 40) {
        frame_rect(frame_buffer, x, 0, x + 1, height, gray);
    }
    for (int y = 40; y < height; y += 40) {
        frame_rect(frame_buffer, 0, y, width, y + 1, gray);
    }

    frame_rect(frame_buffer, 4, 4, 24, 24, red);
    frame_rect(frame_buffer, width - 24, 4, width - 4, 24, green);
    frame_rect(frame_buffer, 4, height - 24, 24, height - 4, blue);
    frame_rect(frame_buffer, width - 24, height - 24, width - 4, height - 4, yellow);

    frame_rect(frame_buffer, center_x - 10, center_y, center_x + 11, center_y + 1, white);
    frame_rect(frame_buffer, center_x, center_y - 10, center_x + 1, center_y + 11, white);

    frame_rect(frame_buffer, 0, 0, width, 1, white);
    frame_rect(frame_buffer, 0, height - 1, width, height, white);
    frame_rect(frame_buffer, 0, 0, 1, height, white);
    frame_rect(frame_buffer, width - 1, 0, width, height, white);

    ESP_RETURN_ON_ERROR(esp_lcd_panel_draw_bitmap(panel, 0, 0, width, height, frame_buffer), TAG, "draw frame failed");

    while (1) {
        vTaskDelay(pdMS_TO_TICKS(1000));
    }

    return ESP_OK;
}

#if CONFIG_OPENPENCIL_EXTERNAL_CONTENT_ONLY || CONFIG_OPENPENCIL_WIFI_SERVER
static esp_err_t draw_wireless_image(esp_lcd_panel_handle_t panel, uint16_t *frame_buffer)
{
    const openpencil_content_header_t *content = openpencil_content_header();
    if (!content || content->width != CONFIG_EXAMPLE_LCD_H_RES ||
        content->height != CONFIG_EXAMPLE_LCD_V_RES) {
        ESP_LOGW(TAG, "Wireless content geometry does not match selected display");
        return ESP_ERR_INVALID_SIZE;
    }

    ESP_LOGI(TAG, "Draw wireless image (%ux%u)", content->width, content->height);
    ESP_RETURN_ON_ERROR(openpencil_content_load_frame(0, frame_buffer, LCD_FRAME_PIXELS),
                        TAG,
                        "load wireless image failed");
    ESP_RETURN_ON_ERROR(openpencil_display_presenter_draw(panel,
                                                          CONFIG_EXAMPLE_LCD_H_RES,
                                                          CONFIG_EXAMPLE_LCD_V_RES,
                                                          frame_buffer),
                        TAG,
                        "draw wireless image failed");
    return ESP_OK;
}
#endif
static esp_err_t draw_generated_image(esp_lcd_panel_handle_t panel, uint16_t *frame_buffer)
{
    if (LCD_GENERATED_IMAGE_WIDTH != CONFIG_EXAMPLE_LCD_H_RES ||
        LCD_GENERATED_IMAGE_HEIGHT != CONFIG_EXAMPLE_LCD_V_RES ||
        LCD_GENERATED_IMAGE_FRAME_COUNT <= 0 ||
        LCD_GENERATED_IMAGE_PIXEL_COUNT != LCD_FRAME_PIXELS * LCD_GENERATED_IMAGE_FRAME_COUNT) {
        ESP_LOGW(TAG, "Generated image %s is %dx%d x %d frames, expected %dx%d; drawing geometry test",
                 LCD_GENERATED_IMAGE_NAME,
                 LCD_GENERATED_IMAGE_WIDTH,
                 LCD_GENERATED_IMAGE_HEIGHT,
                 LCD_GENERATED_IMAGE_FRAME_COUNT,
                 CONFIG_EXAMPLE_LCD_H_RES,
                 CONFIG_EXAMPLE_LCD_V_RES);
        return draw_geometry_test(panel, frame_buffer);
    }

    ESP_LOGI(TAG, "Draw generated image: %s (%dx%d, %d frame(s), %d ms)",
             LCD_GENERATED_IMAGE_NAME,
             LCD_GENERATED_IMAGE_WIDTH,
             LCD_GENERATED_IMAGE_HEIGHT,
             LCD_GENERATED_IMAGE_FRAME_COUNT,
             LCD_GENERATED_IMAGE_FRAME_DELAY_MS);

    while (1) {
        for (int frame = 0; frame < LCD_GENERATED_IMAGE_FRAME_COUNT; frame++) {
            ESP_RETURN_ON_ERROR(openpencil_frame_store_load(frame, frame_buffer, LCD_FRAME_PIXELS),
                                TAG,
                                "load generated image failed");
            ESP_RETURN_ON_ERROR(openpencil_display_presenter_draw(panel,
                                                                  CONFIG_EXAMPLE_LCD_H_RES,
                                                                  CONFIG_EXAMPLE_LCD_V_RES,
                                                                  frame_buffer),
                                TAG,
                                "draw generated image failed");
            vTaskDelay(pdMS_TO_TICKS(LCD_GENERATED_IMAGE_FRAME_DELAY_MS));
        }
    }

    return ESP_OK;
}

void app_main(void)
{
    ESP_ERROR_CHECK(backlight_init());

    esp_lcd_panel_io_handle_t io_handle = NULL;
    esp_lcd_panel_handle_t panel_handle = NULL;

#if CONFIG_EXAMPLE_LCD_CONTROLLER_CO5300
    ESP_LOGI(TAG, "Initialize CO5300 QSPI panel");
    ESP_ERROR_CHECK(example_co5300_new_panel(
        LCD_FRAME_PIXELS * sizeof(uint16_t),
        &io_handle,
        &panel_handle));
#else
    ESP_LOGI(TAG, "Initialize SPI bus");
    spi_bus_config_t buscfg = {
        .sclk_io_num = CONFIG_EXAMPLE_PIN_NUM_SCLK,
        .mosi_io_num = CONFIG_EXAMPLE_PIN_NUM_MOSI,
        .miso_io_num = CONFIG_EXAMPLE_PIN_NUM_MISO,
        .quadwp_io_num = -1,
        .quadhd_io_num = -1,
        .max_transfer_sz = LCD_FRAME_PIXELS * sizeof(uint16_t),
    };
    ESP_ERROR_CHECK(spi_bus_initialize(LCD_HOST, &buscfg, SPI_DMA_CH_AUTO));

    ESP_LOGI(TAG, "Install LCD panel IO");
    esp_lcd_panel_io_spi_config_t io_config = {
        .dc_gpio_num = CONFIG_EXAMPLE_PIN_NUM_LCD_DC,
        .cs_gpio_num = CONFIG_EXAMPLE_PIN_NUM_LCD_CS,
        .pclk_hz = CONFIG_EXAMPLE_LCD_PIXEL_CLOCK_HZ,
        .lcd_cmd_bits = LCD_CMD_BITS,
        .lcd_param_bits = LCD_PARAM_BITS,
        .spi_mode = 0,
        .trans_queue_depth = 10,
    };
    ESP_ERROR_CHECK(esp_lcd_new_panel_io_spi(LCD_HOST, &io_config, &io_handle));

    ESP_LOGI(TAG, "Install %s panel driver", example_lcd_controller_name());
    esp_lcd_panel_dev_config_t panel_config = {
        .reset_gpio_num = CONFIG_EXAMPLE_PIN_NUM_LCD_RST,
        .rgb_ele_order = LCD_RGB_ELEMENT_ORDER,
        .data_endian = LCD_RGB_DATA_ENDIAN_LITTLE,
        .bits_per_pixel = 16,
    };
    ESP_ERROR_CHECK(example_lcd_new_panel(io_handle, &panel_config, &panel_handle));

    ESP_ERROR_CHECK(esp_lcd_panel_reset(panel_handle));
    ESP_ERROR_CHECK(esp_lcd_panel_init(panel_handle));
    ESP_ERROR_CHECK(esp_lcd_panel_mirror(panel_handle, LCD_MIRROR_X, LCD_MIRROR_Y));
    ESP_ERROR_CHECK(esp_lcd_panel_swap_xy(panel_handle, LCD_SWAP_XY));
    ESP_ERROR_CHECK(esp_lcd_panel_set_gap(panel_handle, CONFIG_EXAMPLE_LCD_X_GAP, CONFIG_EXAMPLE_LCD_Y_GAP));
    ESP_ERROR_CHECK(esp_lcd_panel_invert_color(panel_handle, LCD_INVERT_COLOR));
    ESP_ERROR_CHECK(esp_lcd_panel_disp_on_off(panel_handle, true));
#endif

    const size_t frame_buffer_size = LCD_FRAME_PIXELS * sizeof(uint16_t);
    uint16_t *frame_buffer = heap_caps_malloc(frame_buffer_size, MALLOC_CAP_SPIRAM | MALLOC_CAP_DMA);
    if (!frame_buffer) {
        frame_buffer = heap_caps_malloc(frame_buffer_size, MALLOC_CAP_DMA);
    }
    ESP_LOGI(TAG, "Frame buffer: %u bytes at %p", (unsigned)frame_buffer_size, (void *)frame_buffer);
    ESP_ERROR_CHECK(frame_buffer ? ESP_OK : ESP_ERR_NO_MEM);

    ESP_LOGI(TAG, "Turn on LCD backlight");
    backlight_set(true);
    ESP_ERROR_CHECK(openpencil_display_presenter_init());
#if CONFIG_OPENPENCIL_EXTERNAL_CONTENT_ONLY || CONFIG_OPENPENCIL_WIFI_SERVER
    ESP_ERROR_CHECK(openpencil_content_init());
#endif

#if CONFIG_OPENPENCIL_EXTERNAL_CONTENT_ONLY || CONFIG_OPENPENCIL_WIFI_SERVER
    if (LCD_GENERATED_IMAGE_PIXEL_COUNT == 0 && openpencil_content_is_valid()) {
        ESP_ERROR_CHECK(draw_wireless_image(panel_handle, frame_buffer));
#if CONFIG_OPENPENCIL_WIFI_SERVER
        // Present persisted content before starting Wi-Fi. On CO5300 hardware,
        // the first full-frame QSPI DMA transfer can underflow when it competes
        // with Wi-Fi startup work. Wireless content is static until an upload
        // completes and reboots the device, so one synchronized draw is enough.
        ESP_ERROR_CHECK(openpencil_wireless_server_start());
        return;
#endif
    } else
#endif
#if CONFIG_OPENPENCIL_WIFI_SERVER
    if (LCD_GENERATED_IMAGE_PIXEL_COUNT == 0) {
        // Keep the base firmware reachable while showing a deterministic
        // checkerboard/cross diagnostic image until the first Frame upload.
        ESP_ERROR_CHECK(openpencil_wireless_server_start());
        ESP_LOGI(TAG, "Start Wi-Fi base firmware diagnostic pattern");
        ESP_ERROR_CHECK(draw_geometry_test(panel_handle, frame_buffer));
        return;
    } else
#endif
    if (OPENPENCIL_PROTOTYPE_ENABLED) {
        ESP_ERROR_CHECK(openpencil_prototype_run(panel_handle, frame_buffer));
    } else if (LCD_GENERATED_IMAGE_PIXEL_COUNT > 0) {
        ESP_ERROR_CHECK(draw_generated_image(panel_handle, frame_buffer));
    } else {
        ESP_LOGI(TAG, "Start %dx%d geometry test for %s", CONFIG_EXAMPLE_LCD_H_RES, CONFIG_EXAMPLE_LCD_V_RES, example_lcd_controller_name());
        ESP_ERROR_CHECK(draw_geometry_test(panel_handle, frame_buffer));
    }
}
