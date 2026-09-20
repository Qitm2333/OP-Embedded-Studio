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
#include "esp_timer.h"
#include "driver/gpio.h"
#include "driver/spi_master.h"
#include "generated_image.h"
#include "display_presenter.h"
#include "frame_store.h"
#include "generated_prototype.h"
#include "lcd_panel_factory.h"
#include "prototype_runtime.h"
#include "animated_prototype_runtime.h"
#include "sequence_player.h"
#include "wireless_content.h"
#include "wireless_diagnostic_view.h"
#if CONFIG_OPENPENCIL_WIFI_SERVER
#include "wireless_server.h"
#include "wireless_status_view.h"
#if CONFIG_OPENPENCIL_WIFI_LIVE_PREVIEW
#include "wireless_preview.h"
#endif
#endif
#if CONFIG_OPENPENCIL_BLE_SERVER
#include "ble_server.h"
#include "ble_status_view.h"
#endif
#if CONFIG_OPENPENCIL_USB_CONTENT_SERVER
#include "usb_content_server.h"
#endif
#include "co5300_panel.h"
#include "m5ioe1.h"
#include "m5cores3.h"
#include "ssd1315_panel.h"

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

#if CONFIG_OPENPENCIL_EXTERNAL_CONTENT_ONLY || CONFIG_OPENPENCIL_WIFI_SERVER || CONFIG_OPENPENCIL_BLE_SERVER
static esp_err_t draw_wireless_image(esp_lcd_panel_handle_t panel,
                                      uint16_t *frame_buffer,
                                      openpencil_sequence_ready_callback_t on_sequence_ready)
{
    const openpencil_content_header_t *content = openpencil_content_header();
    if (!content || content->width != CONFIG_EXAMPLE_LCD_H_RES ||
        content->height != CONFIG_EXAMPLE_LCD_V_RES) {
        ESP_LOGW(TAG, "Wireless content geometry does not match selected display");
        return ESP_ERR_INVALID_SIZE;
    }

    if (openpencil_content_is_sequence()) {
        return openpencil_sequence_player_start(panel,
                                                frame_buffer,
                                                LCD_FRAME_PIXELS,
                                                CONFIG_EXAMPLE_LCD_H_RES,
                                                CONFIG_EXAMPLE_LCD_V_RES,
                                                on_sequence_ready);
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

#if CONFIG_OPENPENCIL_BLE_SERVER && CONFIG_OPENPENCIL_BOARD_M5STACK_STOPWATCH
static esp_lcd_panel_handle_t s_ble_direct_panel;
static uint16_t *s_ble_direct_frame_buffer;

static esp_err_t present_m5_ble_frame_without_restart(void)
{
    ESP_RETURN_ON_FALSE(s_ble_direct_panel && s_ble_direct_frame_buffer,
                        ESP_ERR_INVALID_STATE,
                        TAG,
                        "M5 BLE direct display is not configured");
    const esp_err_t stop_result = openpencil_sequence_player_stop_and_wait();
    ESP_RETURN_ON_ERROR(stop_result, TAG, "stop previous sequence player failed");

    if (openpencil_content_is_sequence()) {
        ESP_LOGI(TAG, "Start committed M5 BLE sequence after stopping previous player");
        return openpencil_sequence_player_start(s_ble_direct_panel,
                                                s_ble_direct_frame_buffer,
                                                LCD_FRAME_PIXELS,
                                                CONFIG_EXAMPLE_LCD_H_RES,
                                                CONFIG_EXAMPLE_LCD_V_RES,
                                                NULL);
    }
    ESP_RETURN_ON_FALSE(!openpencil_content_is_prototype(),
                        ESP_ERR_NOT_SUPPORTED,
                        TAG,
                        "M5 BLE prototype presentation is not supported in place");
    ESP_LOGI(TAG, "Present committed M5 BLE frame without restart");
    return draw_wireless_image(s_ble_direct_panel, s_ble_direct_frame_buffer, NULL);
}

static void enable_m5_ble_direct_frame_updates(esp_lcd_panel_handle_t panel,
                                                uint16_t *frame_buffer)
{
    s_ble_direct_panel = panel;
    s_ble_direct_frame_buffer = frame_buffer;
    openpencil_ble_server_set_content_ready_callback(present_m5_ble_frame_without_restart);
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
        return openpencil_wireless_diagnostic_view_run(panel, frame_buffer, NULL);
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

#if CONFIG_OPENPENCIL_BOARD_M5STACK_STOPWATCH
    ESP_LOGI(TAG, "Initialize M5IOE1 display power and reset");
    const esp_err_t m5ioe1_result = openpencil_m5ioe1_display_init();
    if (m5ioe1_result != ESP_OK) {
        ESP_LOGE(TAG, "M5IOE1 display power initialization failed: %s", esp_err_to_name(m5ioe1_result));
        // A powered-off AMOLED cannot recover by continuing into CO5300 init.
        // Fail early so a watchdog/hardware reset retries the complete power
        // and panel sequence instead of leaving a misleading black screen.
        ESP_ERROR_CHECK(m5ioe1_result);
    }
#endif

#if CONFIG_OPENPENCIL_BOARD_M5STACK_CORES3
    ESP_LOGI(TAG, "Initialize M5Stack CoreS3 display power and reset");
    ESP_ERROR_CHECK(openpencil_m5cores3_display_init());
#endif

    esp_lcd_panel_io_handle_t io_handle = NULL;
    esp_lcd_panel_handle_t panel_handle = NULL;

#if CONFIG_EXAMPLE_LCD_CONTROLLER_CO5300
    ESP_LOGI(TAG, "Initialize CO5300 QSPI panel");
    ESP_ERROR_CHECK(example_co5300_new_panel(
        LCD_FRAME_PIXELS * sizeof(uint16_t),
        &io_handle,
        &panel_handle));
#else
#if CONFIG_EXAMPLE_LCD_CONTROLLER_SSD1315
    ESP_LOGI(TAG, "Initialize SSD1315 I2C OLED panel");
    ESP_ERROR_CHECK(openpencil_new_panel_ssd1315(&panel_handle));
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
        .on_color_trans_done = openpencil_display_presenter_on_color_done,
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
#endif

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
    ESP_ERROR_CHECK(openpencil_display_presenter_init(io_handle));
#if CONFIG_OPENPENCIL_EXTERNAL_CONTENT_ONLY || CONFIG_OPENPENCIL_WIFI_SERVER || CONFIG_OPENPENCIL_BLE_SERVER
    ESP_ERROR_CHECK(openpencil_content_init());
#endif
#if CONFIG_OPENPENCIL_WIFI_LIVE_PREVIEW
    ESP_ERROR_CHECK(openpencil_wireless_preview_init(panel_handle, frame_buffer, LCD_FRAME_PIXELS));
#endif

#if CONFIG_OPENPENCIL_EXTERNAL_CONTENT_ONLY || CONFIG_OPENPENCIL_WIFI_SERVER || CONFIG_OPENPENCIL_BLE_SERVER
    if (LCD_GENERATED_IMAGE_PIXEL_COUNT == 0 && openpencil_content_is_valid()) {
#if CONFIG_OPENPENCIL_ANIMATED_PROTOTYPE
        if (openpencil_content_is_animated_prototype()) {
#if CONFIG_OPENPENCIL_USB_CONTENT_SERVER
            ESP_ERROR_CHECK(openpencil_usb_content_server_start());
#endif
            ESP_ERROR_CHECK(openpencil_wireless_animated_prototype_run(panel_handle, frame_buffer));
            return;
        }
#endif
#if CONFIG_OPENPENCIL_BLE_SERVER || CONFIG_OPENPENCIL_EXTERNAL_PROTOTYPE
        if (openpencil_content_is_prototype()) {
#if CONFIG_OPENPENCIL_BLE_SERVER
            ESP_ERROR_CHECK(openpencil_ble_server_start());
#endif
#if CONFIG_OPENPENCIL_WIFI_SERVER
            ESP_ERROR_CHECK(openpencil_wireless_server_start());
#endif
#if CONFIG_OPENPENCIL_USB_CONTENT_SERVER
            ESP_ERROR_CHECK(openpencil_usb_content_server_start());
#endif
            ESP_ERROR_CHECK(openpencil_wireless_prototype_run(panel_handle, frame_buffer));
            return;
        }
#endif
        openpencil_sequence_ready_callback_t sequence_ready = NULL;
        if (openpencil_content_is_sequence()) {
#if CONFIG_OPENPENCIL_WIFI_SERVER
            sequence_ready = openpencil_wireless_server_start;
#elif CONFIG_OPENPENCIL_BLE_SERVER
            sequence_ready = openpencil_ble_server_start;
#elif CONFIG_OPENPENCIL_USB_CONTENT_SERVER
            sequence_ready = openpencil_usb_content_server_start;
#endif
        }
#if CONFIG_OPENPENCIL_BLE_SERVER && CONFIG_OPENPENCIL_BOARD_M5STACK_STOPWATCH
        enable_m5_ble_direct_frame_updates(panel_handle, frame_buffer);
#endif
        ESP_ERROR_CHECK(draw_wireless_image(panel_handle, frame_buffer, sequence_ready));
        if (openpencil_content_is_sequence()) {
            // The sequence task starts the transport after its first frame.
            // Do not start a second server from the app_main task.
            return;
        }
#if CONFIG_OPENPENCIL_WIFI_SERVER
        // Present persisted content before starting Wi-Fi. On CO5300 hardware,
        // the first full-frame QSPI DMA transfer can underflow when it competes
        // with Wi-Fi startup work. Wireless content is static until an upload
        // completes and reboots the device, so one synchronized draw is enough.
        ESP_ERROR_CHECK(openpencil_wireless_server_start());
        return;
#elif CONFIG_OPENPENCIL_BLE_SERVER
        // Keep BLE reachable after boot while leaving the persisted image on screen.
        ESP_ERROR_CHECK(openpencil_ble_server_start());
        return;
#elif CONFIG_OPENPENCIL_USB_CONTENT_SERVER
        ESP_ERROR_CHECK(openpencil_usb_content_server_start());
        return;
#endif
    } else
#endif
#if CONFIG_OPENPENCIL_WIFI_SERVER
    if (LCD_GENERATED_IMAGE_PIXEL_COUNT == 0) {
#if CONFIG_OPENPENCIL_WIFI_LIVE_PREVIEW
        // Present the real-time firmware marker before starting Wi-Fi. The
        // CO5300 full-frame QSPI path can underflow if its PSRAM DMA read races
        // Wi-Fi startup; subsequent live frames use the staged internal-SRAM path.
        ESP_LOGI(TAG, "Draw Wi-Fi real-time mirror diagnostic pattern");
        openpencil_wireless_diagnostic_draw(frame_buffer, "RealtimeMode");
        ESP_ERROR_CHECK(openpencil_display_presenter_draw(panel_handle,
                                                          CONFIG_EXAMPLE_LCD_H_RES,
                                                          CONFIG_EXAMPLE_LCD_V_RES,
                                                          frame_buffer));
        ESP_ERROR_CHECK(openpencil_wireless_server_start());
#elif CONFIG_OPENPENCIL_LAN_STATUS_SCREEN
        ESP_ERROR_CHECK(openpencil_wireless_server_start());
        ESP_LOGI(TAG, "Start LAN connection status view");
        ESP_ERROR_CHECK(openpencil_wireless_status_view_run(panel_handle, frame_buffer));
#else
        ESP_ERROR_CHECK(openpencil_wireless_server_start());
        // Keep the hotspot base firmware reachable while showing a deterministic
        // checkerboard/cross diagnostic image until the first content upload.
        ESP_LOGI(TAG, "Start Wi-Fi base firmware diagnostic pattern");
        ESP_ERROR_CHECK(openpencil_wireless_diagnostic_view_run(panel_handle, frame_buffer, "WIFI MODE"));
#endif
        return;
    } else
#endif
#if CONFIG_OPENPENCIL_BLE_SERVER
    if (LCD_GENERATED_IMAGE_PIXEL_COUNT == 0) {
        // The first QSPI frame must finish before NimBLE allocates controller
        // buffers and starts radio work. Persisted content already follows
        // this order; use it for the base status page as well.
        ESP_LOGI(TAG, "Present BLE transfer status view before BLE startup");
        ESP_ERROR_CHECK(openpencil_ble_status_view_present(panel_handle, frame_buffer));
#if CONFIG_OPENPENCIL_BOARD_M5STACK_STOPWATCH
        enable_m5_ble_direct_frame_updates(panel_handle, frame_buffer);
#endif
        ESP_ERROR_CHECK(openpencil_ble_server_start());
        ESP_LOGI(TAG, "Continue BLE transfer status view");
        ESP_ERROR_CHECK(openpencil_ble_status_view_run(panel_handle, frame_buffer));
        return;
    } else
#endif
#if CONFIG_OPENPENCIL_USB_CONTENT_SERVER
    if (LCD_GENERATED_IMAGE_PIXEL_COUNT == 0) {
        ESP_ERROR_CHECK(openpencil_usb_content_server_start());
        ESP_LOGI(TAG, "Start USB base firmware diagnostic pattern");
        ESP_ERROR_CHECK(openpencil_wireless_diagnostic_view_run(panel_handle,
                                                                frame_buffer,
                                                                "USB MODE"));
        return;
    } else
#endif
    if (OPENPENCIL_PROTOTYPE_ENABLED) {
        ESP_ERROR_CHECK(openpencil_prototype_run(panel_handle, frame_buffer));
    } else if (LCD_GENERATED_IMAGE_PIXEL_COUNT > 0) {
        ESP_ERROR_CHECK(draw_generated_image(panel_handle, frame_buffer));
    } else {
        ESP_LOGI(TAG, "Start %dx%d geometry test for %s", CONFIG_EXAMPLE_LCD_H_RES, CONFIG_EXAMPLE_LCD_V_RES, example_lcd_controller_name());
        ESP_ERROR_CHECK(openpencil_wireless_diagnostic_view_run(panel_handle, frame_buffer, NULL));
    }
}
