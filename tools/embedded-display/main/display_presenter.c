#include "display_presenter.h"
#include "co5300_panel.h"

#include "driver/gpio.h"
#include "esp_check.h"
#include "esp_heap_caps.h"
#include "esp_log.h"
#include "esp_timer.h"
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "sdkconfig.h"

#define TE_WAIT_TIMEOUT_MS 100
#define TRANSFER_DONE_TIMEOUT_MS 500
#define CO5300_RECOVERY_RETRIES 2
#define CO5300_RECOVERY_DELAY_MS 20
#define CO5300_STREAM_CHUNK_PIXELS 16384
#define CO5300_STREAM_BUFFER_COUNT (OPENPENCIL_CO5300_STREAM_QUEUE_DEPTH + 1)
#define CO5300_STREAM_MAX_CHUNKS \
    (((CONFIG_EXAMPLE_LCD_H_RES * CONFIG_EXAMPLE_LCD_V_RES) + CO5300_STREAM_CHUNK_PIXELS - 1) / \
     CO5300_STREAM_CHUNK_PIXELS)

static const char *TAG = "display_presenter";
static SemaphoreHandle_t s_te_signal;
static SemaphoreHandle_t s_transfer_done;
static SemaphoreHandle_t s_draw_lock;
static bool s_te_enabled;
#if CONFIG_OPENPENCIL_BOARD_M5STACK_STOPWATCH
static esp_lcd_panel_io_handle_t s_co5300_stream_io;
static uint16_t *s_co5300_stream_buffers;
static size_t s_co5300_stream_chunk_pixels;
#endif

#if CONFIG_EXAMPLE_LCD_CONTROLLER_CO5300 && CONFIG_EXAMPLE_PIN_NUM_LCD_TE >= 0
static void IRAM_ATTR te_gpio_isr(void *argument)
{
    (void)argument;
    BaseType_t should_yield = pdFALSE;
    xSemaphoreGiveFromISR(s_te_signal, &should_yield);
    if (should_yield) {
        portYIELD_FROM_ISR();
    }
}
#endif

static esp_err_t wait_for_te(int64_t *waited_us)
{
    *waited_us = 0;
    if (!s_te_enabled) return ESP_OK;

    // Discard a stale pulse so this frame waits for a TE edge that happened
    // after the frame was fully prepared. A missing TE edge is a hard failure:
    // submitting without synchronization would allow a torn frame.
    (void)xSemaphoreTake(s_te_signal, 0);
    const int64_t started_us = esp_timer_get_time();
    if (xSemaphoreTake(s_te_signal, pdMS_TO_TICKS(TE_WAIT_TIMEOUT_MS)) != pdTRUE) {
        ESP_LOGW(TAG, "TE wait timed out; holding the current frame");
        *waited_us = esp_timer_get_time() - started_us;
        return ESP_ERR_TIMEOUT;
    }
    *waited_us = esp_timer_get_time() - started_us;
    return ESP_OK;
}

static bool should_retry_display_submit(esp_err_t result)
{
#if CONFIG_EXAMPLE_LCD_CONTROLLER_CO5300
    // A QSPI DMA underflow leaves the panel IO transaction unusable for that
    // transfer. The driver reports it as INVALID_STATE, but a later transfer
    // is valid once the SPI host has recycled the failed transaction.
    return result == ESP_ERR_INVALID_STATE;
#else
    (void)result;
    return false;
#endif
}

static esp_err_t submit_region(esp_lcd_panel_handle_t panel,
                               int x_start,
                               int y_start,
                               int x_end,
                               int y_end,
                               const uint16_t *pixels)
{
#if CONFIG_EXAMPLE_LCD_CONTROLLER_SSD1315
    return esp_lcd_panel_draw_bitmap(panel, x_start, y_start, x_end, y_end, pixels);
#else
    (void)xSemaphoreTake(s_transfer_done, 0);
    ESP_RETURN_ON_ERROR(esp_lcd_panel_draw_bitmap(panel,
                                                  x_start,
                                                  y_start,
                                                  x_end,
                                                  y_end,
                                                  pixels),
                        TAG,
                        "submit frame region failed");

    ESP_RETURN_ON_FALSE(xSemaphoreTake(s_transfer_done, pdMS_TO_TICKS(TRANSFER_DONE_TIMEOUT_MS)) == pdTRUE,
                        ESP_ERR_TIMEOUT,
                        TAG,
                        "frame transfer completion timed out");
    return ESP_OK;
#endif
}

#if CONFIG_OPENPENCIL_BOARD_M5STACK_STOPWATCH
static esp_err_t submit_streamed_region(esp_lcd_panel_handle_t panel,
                                        int x,
                                        int y,
                                        int width,
                                        int height,
                                        const uint16_t *pixels)
{
    ESP_RETURN_ON_FALSE(s_co5300_stream_io && s_co5300_stream_buffers && s_co5300_stream_chunk_pixels > 0,
                        ESP_ERR_INVALID_STATE,
                        TAG,
                        "CO5300 DMA stream buffers are unavailable");

    (void)panel;
    // A completed frame from a previous draw must never satisfy this frame's
    // completion count. Keep every color-DMA callback below, then wait for all
    // chunks after they have been queued.
    while (xSemaphoreTake(s_transfer_done, 0) == pdTRUE) {
    }
    ESP_RETURN_ON_ERROR(example_co5300_stream_begin(s_co5300_stream_io, x, y, width, height),
                        TAG,
                        "set CO5300 streamed window failed");

    const size_t total_pixels = (size_t)width * (size_t)height;
    size_t pixel_offset = 0;
    size_t chunk_index = 0;
    while (pixel_offset < total_pixels) {
        const size_t chunk_pixels = (total_pixels - pixel_offset < s_co5300_stream_chunk_pixels)
                                        ? total_pixels - pixel_offset
                                        : s_co5300_stream_chunk_pixels;
        uint16_t *chunk = s_co5300_stream_buffers +
                          (chunk_index % CO5300_STREAM_BUFFER_COUNT) * s_co5300_stream_chunk_pixels;
        memcpy(chunk, pixels + pixel_offset, chunk_pixels * sizeof(*chunk));
        ESP_RETURN_ON_ERROR(example_co5300_stream_color(s_co5300_stream_io,
                                                         chunk,
                                                         chunk_pixels * sizeof(*chunk),
                                                         pixel_offset == 0),
                            TAG,
                            "queue CO5300 streamed color failed");
        // Keep at most one color transaction in flight. If a QSPI DMA
        // completion is lost, this bounded wait returns an error instead of
        // allowing the next tx_color() call to block forever on a full queue.
        ESP_RETURN_ON_FALSE(xSemaphoreTake(s_transfer_done,
                                           pdMS_TO_TICKS(TRANSFER_DONE_TIMEOUT_MS)) == pdTRUE,
                            ESP_ERR_TIMEOUT,
                            TAG,
                            "streamed chunk transfer completion timed out");
        pixel_offset += chunk_pixels;
        chunk_index++;
    }
    return ESP_OK;
}

#endif

bool openpencil_display_presenter_on_color_done(esp_lcd_panel_io_handle_t panel_io,
                                                esp_lcd_panel_io_event_data_t *event_data,
                                                void *user_context)
{
    (void)panel_io;
    (void)event_data;
    (void)user_context;

    if (!s_transfer_done) {
        return false;
    }

    BaseType_t should_yield = pdFALSE;
    xSemaphoreGiveFromISR(s_transfer_done, &should_yield);
    return should_yield == pdTRUE;
}

esp_err_t openpencil_display_presenter_init(esp_lcd_panel_io_handle_t panel_io)
{
    s_draw_lock = xSemaphoreCreateMutex();
    ESP_RETURN_ON_FALSE(s_draw_lock, ESP_ERR_NO_MEM, TAG, "create draw mutex failed");

#if CONFIG_OPENPENCIL_BOARD_M5STACK_STOPWATCH
    s_transfer_done = xSemaphoreCreateCounting(CO5300_STREAM_MAX_CHUNKS, 0);
#else
    s_transfer_done = xSemaphoreCreateBinary();
#endif
    ESP_RETURN_ON_FALSE(s_transfer_done, ESP_ERR_NO_MEM, TAG, "create transfer semaphore failed");

#if CONFIG_OPENPENCIL_BOARD_M5STACK_STOPWATCH
    s_co5300_stream_io = panel_io;
    s_co5300_stream_chunk_pixels = CO5300_STREAM_CHUNK_PIXELS;
    const size_t stream_buffer_bytes = s_co5300_stream_chunk_pixels * sizeof(uint16_t) *
                                       CO5300_STREAM_BUFFER_COUNT;
    s_co5300_stream_buffers = heap_caps_malloc(stream_buffer_bytes,
                                               MALLOC_CAP_INTERNAL | MALLOC_CAP_DMA);
    ESP_RETURN_ON_FALSE(s_co5300_stream_buffers,
                        ESP_ERR_NO_MEM,
                        TAG,
                        "allocate CO5300 internal DMA stream buffers failed");
    ESP_LOGI(TAG,
             "CO5300 internal DMA stream: %u bytes (%d x %u-pixel buffers)",
             (unsigned)stream_buffer_bytes,
             CO5300_STREAM_BUFFER_COUNT,
             (unsigned)s_co5300_stream_chunk_pixels);
#endif

#if CONFIG_EXAMPLE_LCD_CONTROLLER_CO5300 && CONFIG_EXAMPLE_PIN_NUM_LCD_TE >= 0
    s_te_signal = xSemaphoreCreateBinary();
    ESP_RETURN_ON_FALSE(s_te_signal, ESP_ERR_NO_MEM, TAG, "create TE semaphore failed");

    // The panel's 0x35 init command enables this signal. The GPIO edge chooses
    // the only safe time to submit a complete frame and is a hard dependency.
    const gpio_config_t input_config = {
        .pin_bit_mask = 1ULL << CONFIG_EXAMPLE_PIN_NUM_LCD_TE,
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    ESP_RETURN_ON_ERROR(gpio_config(&input_config), TAG, "configure TE GPIO failed");

    const int idle_level = gpio_get_level(CONFIG_EXAMPLE_PIN_NUM_LCD_TE);
    const gpio_int_type_t edge = idle_level ? GPIO_INTR_NEGEDGE : GPIO_INTR_POSEDGE;
    ESP_RETURN_ON_ERROR(gpio_set_intr_type(CONFIG_EXAMPLE_PIN_NUM_LCD_TE, edge), TAG, "set TE edge failed");

    esp_err_t ret = gpio_install_isr_service(ESP_INTR_FLAG_LOWMED);
    if (ret != ESP_OK && ret != ESP_ERR_INVALID_STATE) {
        return ret;
    }
    ESP_RETURN_ON_ERROR(gpio_isr_handler_add(CONFIG_EXAMPLE_PIN_NUM_LCD_TE, te_gpio_isr, NULL),
                        TAG,
                        "install TE ISR failed");
    s_te_enabled = true;
    ESP_LOGI(TAG,
             "TE sync enabled on GPIO%d (%s edge, timeout is frame hold)",
             CONFIG_EXAMPLE_PIN_NUM_LCD_TE,
             edge == GPIO_INTR_NEGEDGE ? "falling" : "rising");
#else
    ESP_LOGI(TAG, "TE sync is not configured for this display profile");
#endif

    return ESP_OK;
}

esp_err_t openpencil_display_presenter_draw(esp_lcd_panel_handle_t panel,
                                            int width,
                                            int height,
                                            const uint16_t *frame_buffer)
{
    return openpencil_display_presenter_draw_measured(panel, width, height, frame_buffer, NULL);
}

esp_err_t openpencil_display_presenter_draw_measured(
    esp_lcd_panel_handle_t panel,
    int width,
    int height,
    const uint16_t *frame_buffer,
    openpencil_display_presenter_metrics_t *metrics)
{
    return openpencil_display_presenter_draw_region_measured(panel,
                                                             0,
                                                             0,
                                                             width,
                                                             height,
                                                             frame_buffer,
                                                             metrics);
}

esp_err_t openpencil_display_presenter_draw_region_measured(
    esp_lcd_panel_handle_t panel,
    int x,
    int y,
    int width,
    int height,
    const uint16_t *pixels,
    openpencil_display_presenter_metrics_t *metrics)
{
    ESP_RETURN_ON_FALSE(panel && pixels && x >= 0 && y >= 0 && width > 0 && height > 0,
                        ESP_ERR_INVALID_ARG,
                        TAG,
                        "invalid draw region arguments");
    ESP_RETURN_ON_FALSE(s_draw_lock && s_transfer_done,
                        ESP_ERR_INVALID_STATE,
                        TAG,
                        "display presenter is not initialized");
    ESP_RETURN_ON_FALSE(xSemaphoreTake(s_draw_lock, portMAX_DELAY) == pdTRUE,
                        ESP_ERR_TIMEOUT,
                        TAG,
                        "lock display presenter failed");

    const int64_t started_us = esp_timer_get_time();
    int64_t te_wait_us = 0;
    int64_t transfer_started_us = 0;
    esp_err_t result = ESP_FAIL;
    int attempt = 0;
    do {
        const esp_err_t te_result = wait_for_te(&te_wait_us);
        if (te_result != ESP_OK) {
            result = te_result;
            break;
        }
        transfer_started_us = esp_timer_get_time();
#if CONFIG_OPENPENCIL_BOARD_M5STACK_STOPWATCH
        result = submit_streamed_region(panel, x, y, width, height, pixels);
#else
        result = submit_region(panel, x, y, x + width, y + height, pixels);
#endif
        if (!should_retry_display_submit(result) || attempt >= CO5300_RECOVERY_RETRIES) break;

        ESP_LOGW(TAG,
                 "CO5300 QSPI transfer underflow; retrying frame submission (%d/%d)",
                 attempt + 1,
                 CO5300_RECOVERY_RETRIES);
        vTaskDelay(pdMS_TO_TICKS(CO5300_RECOVERY_DELAY_MS));
        attempt++;
    } while (true);

    const int64_t completed_us = esp_timer_get_time();
    if (metrics) {
        metrics->te_wait_us = te_wait_us;
        metrics->transfer_us = completed_us - transfer_started_us;
        metrics->total_us = completed_us - started_us;
    }
    xSemaphoreGive(s_draw_lock);
    return result;
}
