#include "wireless_preview.h"

#include <string.h>
#include "esp_check.h"
#include "esp_crc.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"
#include "sdkconfig.h"
#include "display_presenter.h"
#include "lcd_panel_factory.h"
#include "wireless_content.h"
#include "wireless_diagnostic_view.h"

static const char *TAG = "wireless_preview";
static esp_lcd_panel_handle_t preview_panel;
static uint16_t *preview_frame_buffer;
static size_t preview_frame_pixels;
static SemaphoreHandle_t preview_request_lock;
static SemaphoreHandle_t preview_request_ready;
static SemaphoreHandle_t preview_request_done;
static TaskHandle_t preview_task_handle;
static volatile bool preview_active;
static esp_err_t preview_request_result;

static esp_err_t present_frame(void)
{
    // Keep one complete RAMWR transaction in realtime mode. TE synchronizes
    // the frame boundary; row-by-row transfers visibly expose every window.
    return openpencil_display_presenter_draw(preview_panel,
                                              CONFIG_EXAMPLE_LCD_H_RES,
                                              CONFIG_EXAMPLE_LCD_V_RES,
                                              preview_frame_buffer);
}

static void preview_display_task(void *argument)
{
    (void)argument;
    while (true) {
        xSemaphoreTake(preview_request_ready, portMAX_DELAY);
        preview_request_result = present_frame();
        xSemaphoreGive(preview_request_done);
    }
}

static esp_err_t submit_prepared_frame(void)
{
    preview_request_result = ESP_FAIL;
    xSemaphoreGive(preview_request_ready);
    ESP_RETURN_ON_FALSE(xSemaphoreTake(preview_request_done, portMAX_DELAY) == pdTRUE,
                        ESP_ERR_TIMEOUT,
                        TAG,
                        "wait for preview display task failed");
    return preview_request_result;
}

esp_err_t openpencil_wireless_preview_init(esp_lcd_panel_handle_t panel,
                                            uint16_t *frame_buffer,
                                            size_t frame_pixels)
{
    ESP_RETURN_ON_FALSE(panel && frame_buffer, ESP_ERR_INVALID_ARG, TAG, "invalid preview target");
    ESP_RETURN_ON_FALSE(frame_pixels >=
                            (size_t)CONFIG_EXAMPLE_LCD_H_RES * CONFIG_EXAMPLE_LCD_V_RES,
                        ESP_ERR_INVALID_SIZE,
                        TAG,
                        "preview frame buffer is too small");
    preview_panel = panel;
    preview_frame_buffer = frame_buffer;
    preview_frame_pixels = frame_pixels;
    preview_active = false;

    preview_request_lock = xSemaphoreCreateMutex();
    preview_request_ready = xSemaphoreCreateBinary();
    preview_request_done = xSemaphoreCreateBinary();
    ESP_RETURN_ON_FALSE(preview_request_lock && preview_request_ready && preview_request_done,
                        ESP_ERR_NO_MEM,
                        TAG,
                        "create preview synchronization objects failed");
    ESP_RETURN_ON_FALSE(xTaskCreate(preview_display_task,
                                    "preview_display",
                                    4096,
                                    NULL,
                                    5,
                                    &preview_task_handle) == pdPASS,
                        ESP_ERR_NO_MEM,
                        TAG,
                        "create preview display task failed");
    ESP_LOGI(TAG,
             "live preview display task ready; realtime frames use TE-synchronized full-frame QSPI");
    return ESP_OK;
}

esp_err_t openpencil_wireless_preview_apply(const uint8_t *data, size_t length)
{
    ESP_RETURN_ON_FALSE(preview_panel && preview_frame_buffer && preview_task_handle,
                        ESP_ERR_INVALID_STATE,
                        TAG,
                        "preview target is not initialized");
    ESP_RETURN_ON_FALSE(data && length >= sizeof(openpencil_content_header_t),
                        ESP_ERR_INVALID_ARG,
                        TAG,
                        "invalid preview payload");

    const openpencil_content_header_t *header = (const openpencil_content_header_t *)data;
    const size_t expected_pixels =
        (size_t)CONFIG_EXAMPLE_LCD_H_RES * CONFIG_EXAMPLE_LCD_V_RES;
    const size_t expected_bytes = expected_pixels * sizeof(uint16_t);
    ESP_RETURN_ON_FALSE(header->magic == OPENPENCIL_CONTENT_MAGIC &&
                            header->version == OPENPENCIL_CONTENT_VERSION &&
                            header->mode == OPENPENCIL_CONTENT_MODE_FRAME &&
                            header->width == CONFIG_EXAMPLE_LCD_H_RES &&
                            header->height == CONFIG_EXAMPLE_LCD_V_RES &&
                            header->frame_count == 1 &&
                            header->payload_bytes == expected_bytes &&
                            length == sizeof(*header) + expected_bytes &&
                            preview_frame_pixels >= expected_pixels,
                        ESP_ERR_INVALID_SIZE,
                        TAG,
                        "preview geometry does not match display");

    const uint8_t *payload = data + sizeof(*header);
    ESP_RETURN_ON_FALSE(esp_crc32_le(0, payload, expected_bytes) == header->payload_crc32,
                        ESP_ERR_INVALID_CRC,
                        TAG,
                        "preview CRC mismatch");

    ESP_RETURN_ON_FALSE(xSemaphoreTake(preview_request_lock, portMAX_DELAY) == pdTRUE,
                        ESP_ERR_TIMEOUT,
                        TAG,
                        "lock preview request failed");
    memcpy(preview_frame_buffer, payload, expected_bytes);
    for (size_t pixel = 0; pixel < expected_pixels; pixel++) {
        preview_frame_buffer[pixel] =
            example_lcd_panel_color_from_rgb565(preview_frame_buffer[pixel]);
    }
    const esp_err_t result = submit_prepared_frame();
    if (result == ESP_OK) preview_active = true;
    xSemaphoreGive(preview_request_lock);
    ESP_RETURN_ON_ERROR(result, TAG, "present preview frame failed");
    return result;
}

esp_err_t openpencil_wireless_preview_stop(void)
{
    ESP_RETURN_ON_FALSE(preview_panel && preview_frame_buffer && preview_task_handle,
                        ESP_ERR_INVALID_STATE,
                        TAG,
                        "preview target is not initialized");
    if (!preview_active) return ESP_OK;

    ESP_RETURN_ON_FALSE(xSemaphoreTake(preview_request_lock, portMAX_DELAY) == pdTRUE,
                        ESP_ERR_TIMEOUT,
                        TAG,
                        "lock preview request failed");

    const openpencil_content_header_t *content = openpencil_content_header();
    esp_err_t result = ESP_OK;
    if (content && content->width == CONFIG_EXAMPLE_LCD_H_RES &&
        content->height == CONFIG_EXAMPLE_LCD_V_RES) {
        const uint16_t frame_index =
            openpencil_content_is_prototype() ? openpencil_content_initial_state() : 0;
        result = openpencil_content_load_frame(frame_index,
                                                preview_frame_buffer,
                                                preview_frame_pixels);
    } else {
        openpencil_wireless_diagnostic_draw(preview_frame_buffer, "RealtimeMode");
    }
    if (result == ESP_OK) result = submit_prepared_frame();
    if (result == ESP_OK) preview_active = false;
    xSemaphoreGive(preview_request_lock);
    ESP_RETURN_ON_ERROR(result, TAG, "restore display after preview failed");
    return result;
}

bool openpencil_wireless_preview_is_active(void)
{
    return preview_active;
}
