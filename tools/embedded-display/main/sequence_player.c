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
#include <stdatomic.h>

#define SEQUENCE_STATS_FRAMES 120

#if CONFIG_FREERTOS_UNICORE
#define SEQUENCE_TASK_CORE 0
#else
#define SEQUENCE_TASK_CORE 1
#endif

#if CONFIG_OPENPENCIL_SEQUENCE_PLAYBACK
static const char *TAG = "sequence_player";
static portMUX_TYPE s_metrics_lock = portMUX_INITIALIZER_UNLOCKED;
static portMUX_TYPE s_player_lock = portMUX_INITIALIZER_UNLOCKED;
static openpencil_sequence_player_metrics_t s_metrics;
static atomic_bool s_stop_requested = ATOMIC_VAR_INIT(false);
static TaskHandle_t s_player_task;
static bool s_player_starting;
static bool s_player_exited_during_start;

typedef struct {
    esp_lcd_panel_handle_t panel;
    uint16_t *primary_frame_buffer;
    size_t frame_pixels;
    int width;
    int height;
    openpencil_sequence_ready_callback_t on_first_frame;
} sequence_player_context_t;

static sequence_player_context_t s_player_context;

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
    atomic_bool stopped;
} sequence_decoder_t;

static bool sequence_stop_requested(void)
{
    return atomic_load_explicit(&s_stop_requested, memory_order_acquire);
}

static bool sequence_abort_requested(void)
{
    return sequence_stop_requested() || openpencil_content_write_in_progress();
}

static void sequence_metrics_set_inactive(void)
{
    portENTER_CRITICAL(&s_metrics_lock);
    s_metrics.active = false;
    portEXIT_CRITICAL(&s_metrics_lock);
}

static esp_err_t sequence_load_frame_with_region(uint16_t frame_index,
                                                 openpencil_sequence_region_t *region,
                                                 uint16_t *destination,
                                                 size_t frame_pixels)
{
    while (!openpencil_content_read_begin()) {
        if (sequence_abort_requested()) return ESP_ERR_INVALID_STATE;
        vTaskDelay(pdMS_TO_TICKS(10));
    }
    esp_err_t result = openpencil_content_sequence_region(frame_index, region);
    if (result == ESP_OK) {
        result = openpencil_content_load_frame(frame_index, destination, frame_pixels);
    }
    openpencil_content_read_end();
    return result;
}

static esp_err_t sequence_reconstruct_frame(uint16_t frame_index,
                                            uint16_t *previous_frame,
                                            uint16_t *destination,
                                            size_t frame_pixels)
{
    while (!openpencil_content_read_begin()) {
        if (sequence_abort_requested()) return ESP_ERR_INVALID_STATE;
        vTaskDelay(pdMS_TO_TICKS(10));
    }
    const esp_err_t result = openpencil_content_reconstruct_sequence_frame(
        frame_index, previous_frame, destination, frame_pixels);
    openpencil_content_read_end();
    return result;
}

static uint16_t *allocate_frame_buffer(size_t frame_bytes)
{
    uint16_t *buffer = heap_caps_malloc(frame_bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_DMA);
    if (!buffer) buffer = heap_caps_malloc(frame_bytes, MALLOC_CAP_DMA);
    return buffer;
}

static void sequence_frame_timer_callback(void *argument)
{
    xTaskNotifyGive((TaskHandle_t)argument);
}

static bool sequence_region_is_full_frame(const openpencil_sequence_region_t *region,
                                          int width,
                                          int height)
{
    return region->x == 0 && region->y == 0 &&
           region->width == width && region->height == height;
}

static void sequence_decoder_task(void *argument)
{
    sequence_decoder_t *decoder = argument;
    sequence_decode_request_t request;
    while (!sequence_abort_requested()) {
        if (xQueueReceive(decoder->requests, &request, pdMS_TO_TICKS(10)) != pdTRUE) {
            continue;
        }
        const int64_t started_us = esp_timer_get_time();
        openpencil_sequence_region_t region = {0};
        esp_err_t result = ESP_OK;
        while (true) {
            if (sequence_abort_requested()) {
                result = ESP_ERR_INVALID_STATE;
                break;
            }
            while (!openpencil_content_read_begin()) {
                if (sequence_abort_requested()) {
                    result = ESP_ERR_INVALID_STATE;
                    break;
                }
                vTaskDelay(pdMS_TO_TICKS(10));
            }
            if (result != ESP_OK) break;
            result = openpencil_content_sequence_region(request.frame_index, &region);
            if (result == ESP_OK) {
                // For a patch, load_frame decodes only the changed rectangle
                // into a contiguous buffer. The presenter then sends only
                // that rectangle, so there is no full-frame PSRAM copy.
                result = openpencil_content_load_frame(request.frame_index,
                                                        request.destination,
                                                        decoder->frame_pixels);
            }
            openpencil_content_read_end();
            if (sequence_abort_requested()) {
                result = ESP_ERR_INVALID_STATE;
                break;
            }
            break;
        }
        const sequence_decode_result_t decoded = {
            .frame_index = request.frame_index,
            .destination = request.destination,
            .region = region,
            .load_us = esp_timer_get_time() - started_us,
            .result = result,
        };
        while (xQueueSend(decoder->results, &decoded, pdMS_TO_TICKS(10)) != pdTRUE) {
            if (sequence_abort_requested()) break;
        }
        if (sequence_abort_requested()) break;
    }
    // The player owns the decoder task handle and is the only task allowed to
    // delete it. Suspending here prevents a stale handle from being deleted
    // twice while still giving cleanup a definite hand-off point.
    atomic_store_explicit(&decoder->stopped, true, memory_order_release);
    vTaskSuspend(NULL);
}

static esp_err_t sequence_send_decode_request(sequence_decoder_t *decoder,
                                               const sequence_decode_request_t *request)
{
    while (xQueueSend(decoder->requests, request, pdMS_TO_TICKS(10)) != pdTRUE) {
        if (sequence_abort_requested()) return ESP_ERR_INVALID_STATE;
    }
    return ESP_OK;
}

static esp_err_t sequence_receive_decode_result(sequence_decoder_t *decoder,
                                                 sequence_decode_result_t *result)
{
    while (xQueueReceive(decoder->results, result, pdMS_TO_TICKS(10)) != pdTRUE) {
        if (sequence_abort_requested()) return ESP_ERR_INVALID_STATE;
    }
    return ESP_OK;
}

#endif

bool openpencil_sequence_player_get_metrics(openpencil_sequence_player_metrics_t *metrics)
{
    if (!metrics) return false;
#if CONFIG_OPENPENCIL_SEQUENCE_PLAYBACK
    portENTER_CRITICAL(&s_metrics_lock);
    *metrics = s_metrics;
    portEXIT_CRITICAL(&s_metrics_lock);
    return metrics->active;
#else
    *metrics = (openpencil_sequence_player_metrics_t){0};
    return false;
#endif
}

#if CONFIG_OPENPENCIL_SEQUENCE_PLAYBACK
static void sequence_player_task(void *argument)
{
    sequence_player_context_t *context = argument;
    const esp_err_t result = openpencil_sequence_player_run(
        context->panel,
        context->primary_frame_buffer,
        context->frame_pixels,
        context->width,
        context->height,
        context->on_first_frame);
    if (result != ESP_OK && !sequence_abort_requested()) {
        ESP_LOGW(TAG, "sequence player stopped: %s", esp_err_to_name(result));
    }
    sequence_metrics_set_inactive();
    portENTER_CRITICAL(&s_player_lock);
    if (s_player_starting) {
        // xTaskCreatePinnedToCore() can schedule the new task before the
        // caller receives and publishes its handle. Preserve that outcome so
        // start() does not publish a stale handle after the task has exited.
        s_player_exited_during_start = true;
    } else {
        s_player_task = NULL;
    }
    portEXIT_CRITICAL(&s_player_lock);
    vTaskDelete(NULL);
}
#endif

esp_err_t openpencil_sequence_player_start(esp_lcd_panel_handle_t panel,
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
    portENTER_CRITICAL(&s_player_lock);
    const bool already_running = s_player_task != NULL || s_player_starting;
    if (!already_running) {
        s_player_starting = true;
        s_player_exited_during_start = false;
    }
    portEXIT_CRITICAL(&s_player_lock);
    ESP_RETURN_ON_FALSE(!already_running,
                        ESP_ERR_INVALID_STATE,
                        TAG,
                        "sequence player is already running");

    s_player_context = (sequence_player_context_t){
        .panel = panel,
        .primary_frame_buffer = primary_frame_buffer,
        .frame_pixels = frame_pixels,
        .width = width,
        .height = height,
        .on_first_frame = on_first_frame,
    };
    atomic_store_explicit(&s_stop_requested, false, memory_order_release);
    TaskHandle_t task = NULL;
    const BaseType_t created = xTaskCreatePinnedToCore(sequence_player_task,
                                                       "sequence_player",
                                                       6144,
                                                       &s_player_context,
                                                       6,
                                                       &task,
                                                       SEQUENCE_TASK_CORE);
    if (created != pdPASS) {
        portENTER_CRITICAL(&s_player_lock);
        s_player_starting = false;
        s_player_exited_during_start = false;
        portEXIT_CRITICAL(&s_player_lock);
        ESP_LOGE(TAG, "create sequence player task failed");
        return ESP_ERR_NO_MEM;
    }
    portENTER_CRITICAL(&s_player_lock);
    s_player_starting = false;
    const bool exited_during_start = s_player_exited_during_start;
    if (!exited_during_start) s_player_task = task;
    portEXIT_CRITICAL(&s_player_lock);
    return exited_during_start ? ESP_ERR_INVALID_STATE : ESP_OK;
#endif
}

esp_err_t openpencil_sequence_player_stop_and_wait(void)
{
#if !CONFIG_OPENPENCIL_SEQUENCE_PLAYBACK
    return ESP_OK;
#else
    atomic_store_explicit(&s_stop_requested, true, memory_order_release);
    portENTER_CRITICAL(&s_player_lock);
    TaskHandle_t task = s_player_task;
    portEXIT_CRITICAL(&s_player_lock);
    if (task) xTaskNotifyGive(task);

    for (int attempt = 0; attempt < 200; attempt++) {
        portENTER_CRITICAL(&s_player_lock);
        const bool task_running = s_player_task != NULL;
        const bool task_starting = s_player_starting;
        portEXIT_CRITICAL(&s_player_lock);
        openpencil_sequence_player_metrics_t metrics = {0};
        openpencil_sequence_player_get_metrics(&metrics);
        if (!task_running && !task_starting && !metrics.active) return ESP_OK;
        vTaskDelay(pdMS_TO_TICKS(10));
    }
    return ESP_ERR_TIMEOUT;
#endif
}

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

    portENTER_CRITICAL(&s_metrics_lock);
    s_metrics = (openpencil_sequence_player_metrics_t){
        .active = true,
        .target_delay_ms = openpencil_content_frame_delay_ms(),
    };
    portEXIT_CRITICAL(&s_metrics_lock);

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
        .stopped = ATOMIC_VAR_INIT(false),
    };
    ESP_RETURN_ON_FALSE(decoder.requests && decoder.results,
                        ESP_ERR_NO_MEM,
                        TAG,
                        "create sequence decoder queues failed");

    TaskHandle_t decoder_task = NULL;
    esp_timer_handle_t frame_timer = NULL;
    ESP_RETURN_ON_FALSE(xTaskCreatePinnedToCore(sequence_decoder_task,
                                                "sequence_decode",
                                                4096,
                                                &decoder,
                                                6,
                                                &decoder_task,
                                                SEQUENCE_TASK_CORE) == pdPASS,
                        ESP_ERR_NO_MEM,
                                                TAG,
                                                "create sequence decoder task failed");

    if (sequence_abort_requested()) goto stop_cleanup;

    ESP_LOGI(TAG,
             "sequence player ready: %ux%u, %u frames, %u ms",
             content->width,
             content->height,
             content->frame_count,
             openpencil_content_frame_delay_ms());

    int64_t initial_load_started_us = esp_timer_get_time();
    openpencil_sequence_region_t initial_region = {0};
    const esp_err_t initial_load_result = sequence_load_frame_with_region(0,
                                                                          &initial_region,
                                                                          primary_frame_buffer,
                                                                          frame_pixels);
    if (initial_load_result != ESP_OK && sequence_abort_requested()) goto stop_cleanup;
    ESP_RETURN_ON_ERROR(initial_load_result, TAG, "load initial sequence frame failed");
    ESP_RETURN_ON_FALSE(sequence_region_is_full_frame(&initial_region, width, height),
                        ESP_ERR_INVALID_STATE,
                        TAG,
                        "first sequence frame must be a full keyframe");
    if (sequence_abort_requested()) goto stop_cleanup;
    int64_t current_load_us = esp_timer_get_time() - initial_load_started_us;

    uint16_t current_frame = 0;
    uint16_t *current_buffer = primary_frame_buffer;
    openpencil_sequence_region_t current_region = initial_region;
    uint16_t next_frame = 1;
    uint16_t *next_buffer = secondary_frame_buffer;
    sequence_decode_request_t request = {
        .frame_index = next_frame,
        .destination = next_buffer,
    };
    const esp_err_t initial_send_result = sequence_send_decode_request(&decoder, &request);
    if (initial_send_result != ESP_OK && sequence_abort_requested()) goto stop_cleanup;
    ESP_RETURN_ON_ERROR(initial_send_result, TAG, "queue initial sequence frame failed");

    const uint16_t frame_delay_ms = openpencil_content_frame_delay_ms();
    const esp_timer_create_args_t frame_timer_config = {
        .callback = sequence_frame_timer_callback,
        .arg = xTaskGetCurrentTaskHandle(),
        .dispatch_method = ESP_TIMER_TASK,
        .name = "sequence_frame",
    };
    ESP_RETURN_ON_ERROR(esp_timer_create(&frame_timer_config, &frame_timer),
                        TAG,
                        "create sequence frame timer failed");
    ESP_RETURN_ON_ERROR(esp_timer_start_periodic(frame_timer,
                                                 (uint64_t)frame_delay_ms * 1000ULL),
                        TAG,
                        "start sequence frame timer failed");
    int64_t stats_started_us = esp_timer_get_time();
    int64_t load_total_us = 0;
    int64_t decoder_wait_total_us = 0;
    int64_t te_total_us = 0;
    int64_t transfer_total_us = 0;
    int64_t present_total_us = 0;
    uint64_t transferred_pixels = 0;
    uint32_t stats_frames = 0;
    uint32_t dropped_frames = 0;

    while (true) {
        if (sequence_abort_requested()) goto stop_cleanup;
        openpencil_display_presenter_metrics_t present_metrics = {0};
        const bool draw_full_frame = sequence_region_is_full_frame(&current_region, width, height);
        const size_t presented_pixel_count = draw_full_frame
            ? (size_t)width * height
            : (size_t)current_region.width * current_region.height;
        const uint16_t *present_pixels = current_buffer;
        const esp_err_t present_result = draw_full_frame
            ? openpencil_display_presenter_draw_measured(panel,
                                                         width,
                                                         height,
                                                         current_buffer,
                                                         &present_metrics)
            : openpencil_display_presenter_draw_region_measured(panel,
                                                                 current_region.x,
                                                                 current_region.y,
                                                                 current_region.width,
                                                                 current_region.height,
                                                                 present_pixels,
                                                                 &present_metrics);
        if (present_result != ESP_OK) {
            // Do not turn a transient QSPI DMA fault into an application reset.
            // The next decoded frame is already independent and can be presented
            // normally, so skipping this frame keeps BLE connected.
            ESP_LOGW(TAG,
                     "dropping sequence frame %u after display error: %s",
                     current_frame,
                     esp_err_to_name(present_result));
            dropped_frames++;
        } else if (on_first_frame) {
            ESP_RETURN_ON_ERROR(on_first_frame(), TAG, "start sequence transport failed");
            on_first_frame = NULL;
        }

        if (sequence_abort_requested()) goto stop_cleanup;

        const int64_t decoder_wait_started_us = esp_timer_get_time();
        sequence_decode_result_t decoded;
        const esp_err_t receive_result = sequence_receive_decode_result(&decoder, &decoded);
        if (receive_result != ESP_OK && sequence_abort_requested()) goto stop_cleanup;
        ESP_RETURN_ON_ERROR(receive_result, TAG, "wait for decoded sequence frame failed");
        const int64_t decoder_wait_us = esp_timer_get_time() - decoder_wait_started_us;
        if (decoded.result != ESP_OK && sequence_abort_requested()) goto stop_cleanup;
        ESP_RETURN_ON_ERROR(decoded.result, TAG, "decode sequence frame failed");
        ESP_RETURN_ON_FALSE(decoded.frame_index == next_frame && decoded.destination == next_buffer,
                            ESP_ERR_INVALID_STATE,
                            TAG,
                            "decoded sequence frame order mismatch");

        // Present a complete reconstructed frame on the StopWatch panel. The
        // CO5300's small-region continuation path can tear when a patch window
        // changes during scanout; rebuilding into the already decoded buffer
        // keeps the display transaction and TE boundary frame-wide.
#if CONFIG_OPENPENCIL_BOARD_M5STACK_STOPWATCH
        if (!sequence_region_is_full_frame(&decoded.region, width, height)) {
            ESP_RETURN_ON_ERROR(sequence_reconstruct_frame(decoded.frame_index,
                                                            current_buffer,
                                                            decoded.destination,
                                                            frame_pixels),
                                TAG,
                                "reconstruct sequence display frame failed");
        }
        decoded.region = (openpencil_sequence_region_t){
            .x = 0,
            .y = 0,
            .width = (uint16_t)width,
            .height = (uint16_t)height,
        };
#endif

        if (sequence_abort_requested()) goto stop_cleanup;

        uint16_t *following_decode_buffer = current_buffer;
        if (present_result != ESP_OK) {
            // Patch buffers contain only a changed rectangle. Rebuild the
            // upcoming logical frame after a failed presentation so the next
            // update can safely resynchronize the panel with a full draw.
            uint16_t *recovery_previous = current_buffer;
            uint16_t *recovery_destination = decoded.destination;
            openpencil_sequence_region_t recovery_region = {0};
            ESP_RETURN_ON_ERROR(sequence_load_frame_with_region(0,
                                                                 &recovery_region,
                                                                 recovery_previous,
                                                                 frame_pixels),
                                TAG,
                                "load sequence recovery keyframe failed");
            for (uint16_t index = 1; index <= next_frame; index++) {
                ESP_RETURN_ON_ERROR(sequence_reconstruct_frame(index,
                                                                recovery_previous,
                                                                recovery_destination,
                                                                frame_pixels),
                                    TAG,
                                    "reconstruct sequence recovery frame failed");
                uint16_t *completed = recovery_previous;
                recovery_previous = recovery_destination;
                recovery_destination = completed;
            }
            current_buffer = recovery_previous;
            current_region = (openpencil_sequence_region_t){
                .x = 0,
                .y = 0,
                .width = (uint16_t)width,
                .height = (uint16_t)height,
            };
            following_decode_buffer = recovery_destination;
        } else {
            current_buffer = decoded.destination;
            current_region = decoded.region;
        }

        const uint16_t following_frame =
            (uint16_t)((next_frame + 1) % content->frame_count);
        request.frame_index = following_frame;
        request.destination = following_decode_buffer;
        const esp_err_t send_result = sequence_send_decode_request(&decoder, &request);
        if (send_result != ESP_OK && sequence_abort_requested()) goto stop_cleanup;
        ESP_RETURN_ON_ERROR(send_result, TAG, "queue sequence frame failed");

        load_total_us += current_load_us;
        decoder_wait_total_us += decoder_wait_us;
        te_total_us += present_metrics.te_wait_us;
        transfer_total_us += present_metrics.transfer_us;
        present_total_us += present_metrics.total_us;
        if (present_result == ESP_OK) {
            transferred_pixels += presented_pixel_count;
        }
        stats_frames++;

        const int64_t elapsed_us = esp_timer_get_time() - stats_started_us;
        portENTER_CRITICAL(&s_metrics_lock);
        s_metrics.fps_milli = elapsed_us > 0
                                  ? (uint32_t)((uint64_t)stats_frames * 1000000000ULL / (uint64_t)elapsed_us)
                                  : 0;
        s_metrics.transfer_us = (uint32_t)(transfer_total_us / stats_frames);
        s_metrics.present_us = (uint32_t)(present_total_us / stats_frames);
        s_metrics.dropped_frames = dropped_frames;
        portEXIT_CRITICAL(&s_metrics_lock);

        // FreeRTOS runs at 100 Hz in the USB firmware, so vTaskDelayUntil()
        // rounds a 16 ms animation interval down to 10 ms. esp_timer keeps
        // the content format's millisecond duration exact without changing
        // global scheduler settings for every firmware profile.
        ulTaskNotifyTake(pdTRUE, portMAX_DELAY);

        if (sequence_abort_requested()) goto stop_cleanup;

        current_frame = next_frame;
        current_load_us = decoded.load_us;
        next_frame = following_frame;
        next_buffer = request.destination;

        if (stats_frames >= SEQUENCE_STATS_FRAMES) {
            const double actual_fps = elapsed_us > 0
                                          ? (double)stats_frames * 1000000.0 / elapsed_us
                                          : 0.0;
            ESP_LOGI(TAG,
                     "stats: frames=%lu fps=%.2f load=%.2f ms wait=%.2f ms te=%.2f ms "
                     "transfer=%.2f ms present=%.2f ms pixels=%.1f%% drops=%lu budget=%u ms",
                     (unsigned long)stats_frames,
                     actual_fps,
                     (double)load_total_us / stats_frames / 1000.0,
                     (double)decoder_wait_total_us / stats_frames / 1000.0,
                     (double)te_total_us / stats_frames / 1000.0,
                     (double)transfer_total_us / stats_frames / 1000.0,
                     (double)present_total_us / stats_frames / 1000.0,
                     (double)transferred_pixels * 100.0 /
                         ((double)stats_frames * width * height),
                     (unsigned long)dropped_frames,
                     openpencil_content_frame_delay_ms());
            stats_started_us = esp_timer_get_time();
            load_total_us = 0;
            decoder_wait_total_us = 0;
            te_total_us = 0;
            transfer_total_us = 0;
            present_total_us = 0;
            transferred_pixels = 0;
            stats_frames = 0;
            dropped_frames = 0;
        }

        (void)current_frame;
    }

stop_cleanup:
    if (frame_timer) {
        esp_timer_stop(frame_timer);
        esp_timer_delete(frame_timer);
    }
    if (decoder_task) {
        while (!atomic_load_explicit(&decoder.stopped, memory_order_acquire)) {
            vTaskDelay(pdMS_TO_TICKS(1));
        }
        vTaskDelete(decoder_task);
    }
    if (decoder.requests) vQueueDelete(decoder.requests);
    if (decoder.results) vQueueDelete(decoder.results);
    free(secondary_frame_buffer);
    sequence_metrics_set_inactive();
    return ESP_ERR_INVALID_STATE;
#endif
}
