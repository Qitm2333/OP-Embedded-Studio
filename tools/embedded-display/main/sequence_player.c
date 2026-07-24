#include "sequence_player.h"

#include "display_presenter.h"
#include "wireless_content.h"

#include "esp_check.h"
#include "esp_heap_caps.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"
#include "sdkconfig.h"

#define SEQUENCE_STATS_FRAMES 120

#if CONFIG_OPENPENCIL_SEQUENCE_PLAYBACK
static const char *TAG = "sequence_player";

typedef struct {
    uint16_t frame_index;
    uint16_t *destination;
} sequence_decode_request_t;

typedef struct {
    uint16_t frame_index;
    uint16_t *destination;
    openpencil_sequence_region_t region;
    int64_t load_us;
    esp_err_t result;
} sequence_decode_result_t;

typedef struct {
    QueueHandle_t requests;
    QueueHandle_t results;
    size_t frame_pixels;
} sequence_decoder_t;

static uint16_t *allocate_frame_buffer(size_t frame_bytes)
{
    uint16_t *buffer = heap_caps_malloc(frame_bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_DMA);
    if (!buffer) buffer = heap_caps_malloc(frame_bytes, MALLOC_CAP_DMA);
    return buffer;
}

static void sequence_decoder_task(void *argument)
{
    sequence_decoder_t *decoder = argument;
    sequence_decode_request_t request;
    while (xQueueReceive(decoder->requests, &request, portMAX_DELAY) == pdTRUE) {
        const int64_t started_us = esp_timer_get_time();
        openpencil_sequence_region_t region = {0};
        esp_err_t result = ESP_OK;
        while (true) {
            while (openpencil_content_write_in_progress()) {
                vTaskDelay(pdMS_TO_TICKS(10));
            }
            result = openpencil_content_sequence_region(request.frame_index, &region);
            if (result != ESP_OK) break;
            if (openpencil_content_write_in_progress()) continue;
            result = openpencil_content_load_frame(request.frame_index,
                                                   request.destination,
                                                   decoder->frame_pixels);
            if (!openpencil_content_write_in_progress()) break;
        }
        const sequence_decode_result_t decoded = {
            .frame_index = request.frame_index,
            .destination = request.destination,
            .region = region,
            .load_us = esp_timer_get_time() - started_us,
            .result = result,
        };
        xQueueSend(decoder->results, &decoded, portMAX_DELAY);
    }
    vTaskDelete(NULL);
}

#endif

esp_err_t openpencil_sequence_player_run(esp_lcd_panel_handle_t panel,
                                      uint16_t *primary_frame_buffer,
                                      size_t frame_pixels,
                                      int width,
                                      int height,
                                      openpencil_sequence_ready_callback_t on_first_frame)
{
#if !CONFIG_OPENPENCIL_SEQUENCE_PLAYBACK
    (void)panel;
    (void)primary_frame_buffer;
    (void)frame_pixels;
    (void)width;
    (void)height;
    (void)on_first_frame;
    return ESP_ERR_NOT_SUPPORTED;
#else
    const openpencil_content_header_t *content = openpencil_content_header();
    ESP_RETURN_ON_FALSE(panel && primary_frame_buffer && content,
                        ESP_ERR_INVALID_ARG,
                        TAG,
                        "invalid sequence player arguments");
    ESP_RETURN_ON_FALSE(openpencil_content_is_sequence() && content->frame_count > 1,
                        ESP_ERR_INVALID_STATE,
                        TAG,
                        "sequence content is not ready");

    const size_t frame_bytes = frame_pixels * sizeof(uint16_t);
    uint16_t *secondary_frame_buffer = allocate_frame_buffer(frame_bytes);
    ESP_RETURN_ON_FALSE(secondary_frame_buffer,
                        ESP_ERR_NO_MEM,
                        TAG,
                        "allocate secondary sequence frame buffer failed");

    sequence_decoder_t decoder = {
        .requests = xQueueCreate(1, sizeof(sequence_decode_request_t)),
        .results = xQueueCreate(1, sizeof(sequence_decode_result_t)),
        .frame_pixels = frame_pixels,
    };
    ESP_RETURN_ON_FALSE(decoder.requests && decoder.results,
                        ESP_ERR_NO_MEM,
                        TAG,
                        "create sequence decoder queues failed");

    TaskHandle_t decoder_task = NULL;
    ESP_RETURN_ON_FALSE(xTaskCreatePinnedToCore(sequence_decoder_task,
                                                "sequence_decode",
                                                4096,
                                                &decoder,
                                                6,
                                                &decoder_task,
                                                1) == pdPASS,
                        ESP_ERR_NO_MEM,
                        TAG,
                        "create sequence decoder task failed");

    ESP_LOGI(TAG,
             "sequence player ready: %ux%u, %u frames, %u ms",
             content->width,
             content->height,
             content->frame_count,
             openpencil_content_frame_delay_ms());

    int64_t initial_load_started_us = esp_timer_get_time();
    openpencil_sequence_region_t current_region = {0};
    ESP_RETURN_ON_ERROR(openpencil_content_sequence_region(0, &current_region),
                        TAG,
                        "load initial sequence region failed");
    ESP_RETURN_ON_ERROR(openpencil_content_load_frame(0, primary_frame_buffer, frame_pixels),
                        TAG,
                        "load initial sequence frame failed");
    int64_t current_load_us = esp_timer_get_time() - initial_load_started_us;

    uint16_t current_frame = 0;
    uint16_t *current_buffer = primary_frame_buffer;
    uint16_t next_frame = 1;
    uint16_t *next_buffer = secondary_frame_buffer;
    sequence_decode_request_t request = {
        .frame_index = next_frame,
        .destination = next_buffer,
    };
    xQueueSend(decoder.requests, &request, portMAX_DELAY);

    const TickType_t frame_delay = pdMS_TO_TICKS(openpencil_content_frame_delay_ms());
    TickType_t next_deadline = xTaskGetTickCount();
    int64_t stats_started_us = esp_timer_get_time();
    int64_t load_total_us = 0;
    int64_t decoder_wait_total_us = 0;
    int64_t te_total_us = 0;
    int64_t transfer_total_us = 0;
    int64_t present_total_us = 0;
    uint64_t transferred_pixels = 0;
    uint32_t stats_frames = 0;

    while (true) {
        openpencil_display_presenter_metrics_t present_metrics = {0};
        ESP_RETURN_ON_ERROR(openpencil_display_presenter_draw_region_measured(
                                panel,
                                current_region.x,
                                current_region.y,
                                current_region.width,
                                current_region.height,
                                current_buffer,
                                &present_metrics),
                            TAG,
                            "draw sequence frame failed");
        if (on_first_frame) {
            ESP_RETURN_ON_ERROR(on_first_frame(), TAG, "start sequence transport failed");
            on_first_frame = NULL;
        }

        const int64_t decoder_wait_started_us = esp_timer_get_time();
        sequence_decode_result_t decoded;
        ESP_RETURN_ON_FALSE(xQueueReceive(decoder.results, &decoded, portMAX_DELAY) == pdTRUE,
                            ESP_ERR_TIMEOUT,
                            TAG,
                            "wait for decoded sequence frame failed");
        const int64_t decoder_wait_us = esp_timer_get_time() - decoder_wait_started_us;
        ESP_RETURN_ON_ERROR(decoded.result, TAG, "decode sequence frame failed");
        ESP_RETURN_ON_FALSE(decoded.frame_index == next_frame && decoded.destination == next_buffer,
                            ESP_ERR_INVALID_STATE,
                            TAG,
                            "decoded sequence frame order mismatch");

        const uint16_t following_frame =
            (uint16_t)((next_frame + 1) % content->frame_count);
        request.frame_index = following_frame;
        request.destination = current_buffer;
        xQueueSend(decoder.requests, &request, portMAX_DELAY);

        load_total_us += current_load_us;
        decoder_wait_total_us += decoder_wait_us;
        te_total_us += present_metrics.te_wait_us;
        transfer_total_us += present_metrics.transfer_us;
        present_total_us += present_metrics.total_us;
        transferred_pixels += (uint64_t)current_region.width * current_region.height;
        stats_frames++;

        vTaskDelayUntil(&next_deadline, frame_delay > 0 ? frame_delay : 1);

        current_frame = next_frame;
        current_buffer = next_buffer;
        current_region = decoded.region;
        current_load_us = decoded.load_us;
        next_frame = following_frame;
        next_buffer = request.destination;

        if (stats_frames >= SEQUENCE_STATS_FRAMES) {
            const int64_t elapsed_us = esp_timer_get_time() - stats_started_us;
            const double actual_fps = elapsed_us > 0
                                          ? (double)stats_frames * 1000000.0 / elapsed_us
                                          : 0.0;
            ESP_LOGI(TAG,
                     "stats: frames=%lu fps=%.2f load=%.2f ms wait=%.2f ms te=%.2f ms "
                     "transfer=%.2f ms present=%.2f ms pixels=%.1f%% budget=%u ms",
                     (unsigned long)stats_frames,
                     actual_fps,
                     (double)load_total_us / stats_frames / 1000.0,
                     (double)decoder_wait_total_us / stats_frames / 1000.0,
                     (double)te_total_us / stats_frames / 1000.0,
                     (double)transfer_total_us / stats_frames / 1000.0,
                     (double)present_total_us / stats_frames / 1000.0,
                     (double)transferred_pixels * 100.0 /
                         ((double)stats_frames * width * height),
                     openpencil_content_frame_delay_ms());
            stats_started_us = esp_timer_get_time();
            load_total_us = 0;
            decoder_wait_total_us = 0;
            te_total_us = 0;
            transfer_total_us = 0;
            present_total_us = 0;
            transferred_pixels = 0;
            stats_frames = 0;
        }

        (void)current_frame;
    }
#endif
}
