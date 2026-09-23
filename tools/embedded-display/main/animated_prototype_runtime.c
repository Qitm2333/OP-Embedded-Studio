#include "animated_prototype_runtime.h"

#include "display_presenter.h"
#include "prototype_input.h"
#include "sdkconfig.h"
#include "wireless_content.h"

#include "esp_check.h"
#include "esp_heap_caps.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"

#define FRAME_PIXELS (CONFIG_EXAMPLE_LCD_H_RES * CONFIG_EXAMPLE_LCD_V_RES)
#if CONFIG_FREERTOS_UNICORE
#define ANIMATED_TASK_CORE 0
#else
#define ANIMATED_TASK_CORE 1
#endif
static const char *TAG = "animated_prototype";

#if CONFIG_OPENPENCIL_ANIMATED_PROTOTYPE
typedef struct {
    uint16_t frame_index;
    uint16_t *destination;
} animated_decode_request_t;

typedef struct {
    uint16_t frame_index;
    uint16_t *destination;
    esp_err_t result;
} animated_decode_result_t;

typedef struct {
    QueueHandle_t requests;
    QueueHandle_t results;
} animated_decoder_t;

static uint16_t *allocate_frame_buffer(size_t frame_bytes)
{
    uint16_t *buffer = heap_caps_malloc(frame_bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_DMA);
    if (!buffer) buffer = heap_caps_malloc(frame_bytes, MALLOC_CAP_DMA);
    return buffer;
}

static void animated_decoder_task(void *argument)
{
    animated_decoder_t *decoder = argument;
    animated_decode_request_t request;
    while (xQueueReceive(decoder->requests, &request, portMAX_DELAY) == pdTRUE) {
        while (!openpencil_content_read_begin()) {
            vTaskDelay(pdMS_TO_TICKS(10));
        }
        const animated_decode_result_t result = {
            .frame_index = request.frame_index,
            .destination = request.destination,
            .result = openpencil_content_load_frame(request.frame_index,
                                                     request.destination,
                                                     FRAME_PIXELS),
        };
        openpencil_content_read_end();
        xQueueSend(decoder->results, &result, portMAX_DELAY);
    }
    vTaskDelete(NULL);
}

static uint16_t next_frame_index(const openpencil_animated_state_t *descriptor,
                                 uint16_t frame)
{
    if (frame + 1 < descriptor->frame_count) return (uint16_t)(frame + 1);
    return descriptor->loop ? 0 : (uint16_t)(descriptor->frame_count - 1);
}

static esp_err_t queue_decode(animated_decoder_t *decoder,
                              uint16_t frame_index,
                              uint16_t *destination)
{
    const animated_decode_request_t request = {
        .frame_index = frame_index,
        .destination = destination,
    };
    return xQueueSend(decoder->requests, &request, portMAX_DELAY) == pdTRUE
               ? ESP_OK
               : ESP_ERR_TIMEOUT;
}

static esp_err_t wait_for_decode(animated_decoder_t *decoder, animated_decode_result_t *result)
{
    ESP_RETURN_ON_FALSE(xQueueReceive(decoder->results, result, portMAX_DELAY) == pdTRUE,
                        ESP_ERR_TIMEOUT,
                        TAG,
                        "wait for decoded animation frame");
    return result->result;
}
#endif

esp_err_t openpencil_wireless_animated_prototype_run(esp_lcd_panel_handle_t panel,
                                                      uint16_t *frame_buffer)
{
#if !CONFIG_OPENPENCIL_ANIMATED_PROTOTYPE
    (void)panel;
    (void)frame_buffer;
    return ESP_ERR_NOT_SUPPORTED;
#else
    const openpencil_content_header_t *header = openpencil_content_header();
    ESP_RETURN_ON_FALSE(panel && frame_buffer && header && openpencil_content_is_animated_prototype(),
                        ESP_ERR_INVALID_STATE, TAG, "animated interaction is unavailable");
    ESP_RETURN_ON_ERROR(openpencil_input_init(), TAG, "initialize animated interaction inputs");

    const size_t frame_bytes = FRAME_PIXELS * sizeof(uint16_t);
    uint16_t *secondary_frame_buffer = allocate_frame_buffer(frame_bytes);
    ESP_RETURN_ON_FALSE(secondary_frame_buffer, ESP_ERR_NO_MEM, TAG,
                        "allocate secondary animation frame buffer");

    animated_decoder_t decoder = {
        .requests = xQueueCreate(1, sizeof(animated_decode_request_t)),
        .results = xQueueCreate(1, sizeof(animated_decode_result_t)),
    };
    ESP_RETURN_ON_FALSE(decoder.requests && decoder.results, ESP_ERR_NO_MEM, TAG,
                        "create animation decoder queues");
    TaskHandle_t decoder_task = NULL;
    ESP_RETURN_ON_FALSE(xTaskCreatePinnedToCore(animated_decoder_task,
                                                "animation_decode",
                                                4096,
                                                &decoder,
                                                6,
                                                &decoder_task,
                                                ANIMATED_TASK_CORE) == pdPASS,
                        ESP_ERR_NO_MEM, TAG, "create animation decoder task");

    uint16_t state = openpencil_content_initial_state();
    openpencil_animated_state_t descriptor = {0};
    ESP_RETURN_ON_ERROR(openpencil_content_animated_state(state, &descriptor), TAG,
                        "read animated state");
    ESP_RETURN_ON_ERROR(openpencil_content_load_frame(descriptor.first_frame,
                                                       frame_buffer,
                                                       FRAME_PIXELS),
                        TAG, "load initial animation frame");
    openpencil_input_set_screen_multi_click(openpencil_content_state_uses_multi_click(state));

    uint16_t frame = 0;
    uint16_t *current_buffer = frame_buffer;
    uint16_t *next_buffer = secondary_frame_buffer;
    uint16_t next_frame = next_frame_index(&descriptor, frame);
    ESP_RETURN_ON_ERROR(queue_decode(&decoder, descriptor.first_frame + next_frame, next_buffer), TAG,
                        "queue next animation frame");

    ESP_LOGI(TAG, "animated player ready: %ux%u, first state has %u frames at %u ms",
             header->width, header->height, descriptor.frame_count, descriptor.frame_delay_ms);
    while (true) {
        const TickType_t frame_started = xTaskGetTickCount();
        const esp_err_t present_result = openpencil_display_presenter_draw(panel,
                                                                             CONFIG_EXAMPLE_LCD_H_RES,
                                                                             CONFIG_EXAMPLE_LCD_V_RES,
                                                                             current_buffer);
        if (present_result != ESP_OK) {
            // Preserve the interaction runtime when a CO5300 transfer underflows.
            // A later frame can be submitted after the SPI driver has recovered.
            ESP_LOGW(TAG, "dropping animated frame after display error: %s",
                     esp_err_to_name(present_result));
        }

        const TickType_t delay = pdMS_TO_TICKS(descriptor.frame_delay_ms);
        const TickType_t deadline = frame_started + (delay > 0 ? delay : 1);
        animated_decode_result_t decoded = {0};
        bool decoded_ready = false;
        bool transitioned = false;

        // Keep sampling input while the next frame is decoded and until this
        // frame's intended deadline. The old loop waited a full delay after a
        // full-screen transfer, effectively charging the render time twice.
        while (!decoded_ready || xTaskGetTickCount() < deadline) {
            openpencil_input_event_t event;
            if (openpencil_input_poll(&event)) {
                uint16_t target = state;
                ESP_RETURN_ON_ERROR(openpencil_content_transition_target(state, (uint8_t)event, &target),
                                    TAG, "resolve animated transition");
                if (target != state) {
                    if (!decoded_ready) {
                        ESP_RETURN_ON_ERROR(wait_for_decode(&decoder, &decoded), TAG,
                                            "finish interrupted animation decode");
                    }
                    ESP_RETURN_ON_ERROR(decoded.result, TAG, "decode interrupted animation frame");
                    state = target;
                    ESP_RETURN_ON_ERROR(openpencil_content_animated_state(state, &descriptor), TAG,
                                        "read target animated state");
                    openpencil_input_set_screen_multi_click(
                        openpencil_content_state_uses_multi_click(state));
                    frame = 0;
                    ESP_RETURN_ON_ERROR(openpencil_content_load_frame(descriptor.first_frame,
                                                                       current_buffer,
                                                                       FRAME_PIXELS),
                                        TAG, "load target animation frame");
                    next_buffer = decoded.destination;
                    next_frame = next_frame_index(&descriptor, frame);
                    ESP_RETURN_ON_ERROR(
                        queue_decode(&decoder, descriptor.first_frame + next_frame, next_buffer),
                        TAG, "queue target animation frame");
                    transitioned = true;
                    break;
                }
            }
            if (!decoded_ready && xQueueReceive(decoder.results, &decoded, 0) == pdTRUE) {
                ESP_RETURN_ON_ERROR(decoded.result, TAG, "decode animation frame");
                ESP_RETURN_ON_FALSE(decoded.frame_index == descriptor.first_frame + next_frame &&
                                        decoded.destination == next_buffer,
                                    ESP_ERR_INVALID_STATE, TAG,
                                    "animation decoder result order mismatch");
                decoded_ready = true;
            }
            if (!decoded_ready || xTaskGetTickCount() < deadline) vTaskDelay(pdMS_TO_TICKS(5));
        }
        if (transitioned) continue;

        uint16_t *following_buffer = current_buffer;
        current_buffer = decoded.destination;
        frame = next_frame;
        next_frame = next_frame_index(&descriptor, frame);
        next_buffer = following_buffer;
        ESP_RETURN_ON_ERROR(queue_decode(&decoder, descriptor.first_frame + next_frame, next_buffer), TAG,
                            "queue following animation frame");
    }
#endif
}
