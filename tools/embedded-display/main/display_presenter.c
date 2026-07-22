#include "display_presenter.h"

#include "driver/gpio.h"
#include "esp_check.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "sdkconfig.h"

#define TE_WAIT_TIMEOUT_MS 100
#define TRANSFER_DONE_TIMEOUT_MS 500

static const char *TAG = "display_presenter";
static SemaphoreHandle_t s_te_signal;
static SemaphoreHandle_t s_transfer_done;
static SemaphoreHandle_t s_draw_lock;
static bool s_te_enabled;

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

static void wait_for_te(int64_t *waited_us)
{
    *waited_us = 0;
    if (!s_te_enabled) return;

    // Discard a stale pulse so this frame waits for a TE edge that happened
    // after the frame was fully prepared. The timeout remains a fallback for
    // panels or boot phases where the TE signal is temporarily unavailable.
    (void)xSemaphoreTake(s_te_signal, 0);
    const int64_t started_us = esp_timer_get_time();
    if (xSemaphoreTake(s_te_signal, pdMS_TO_TICKS(TE_WAIT_TIMEOUT_MS)) != pdTRUE) {
        ESP_LOGW(TAG, "TE wait timed out; presenting the frame without synchronization");
    }
    *waited_us = esp_timer_get_time() - started_us;
}

static esp_err_t submit_region(esp_lcd_panel_handle_t panel,
                               int x_start,
                               int y_start,
                               int x_end,
                               int y_end,
                               const uint16_t *pixels)
{
    (void)xSemaphoreTake(s_transfer_done, 0);
    ESP_RETURN_ON_ERROR(esp_lcd_panel_draw_bitmap(panel,
                                                  x_start,
                                                  y_start,
                                                  x_end,
                                                  y_end,
                                                  pixels),
                        TAG,
                        "submit frame region failed");

#if CONFIG_EXAMPLE_LCD_CONTROLLER_CO5300
    ESP_RETURN_ON_FALSE(xSemaphoreTake(s_transfer_done, pdMS_TO_TICKS(TRANSFER_DONE_TIMEOUT_MS)) == pdTRUE,
                        ESP_ERR_TIMEOUT,
                        TAG,
                        "frame transfer completion timed out");
#endif
    return ESP_OK;
}

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

esp_err_t openpencil_display_presenter_init(void)
{
    s_draw_lock = xSemaphoreCreateMutex();
    ESP_RETURN_ON_FALSE(s_draw_lock, ESP_ERR_NO_MEM, TAG, "create draw mutex failed");

    s_transfer_done = xSemaphoreCreateBinary();
    ESP_RETURN_ON_FALSE(s_transfer_done, ESP_ERR_NO_MEM, TAG, "create transfer semaphore failed");

#if CONFIG_EXAMPLE_LCD_CONTROLLER_CO5300 && CONFIG_EXAMPLE_PIN_NUM_LCD_TE >= 0
    s_te_signal = xSemaphoreCreateBinary();
    ESP_RETURN_ON_FALSE(s_te_signal, ESP_ERR_NO_MEM, TAG, "create TE semaphore failed");

    // The Waveshare schematic routes LCD_TE to GPIO13. The panel's 0x35 init
    // command enables this signal; the GPIO edge only chooses a safe time to
    // submit a complete frame and never becomes a hard dependency.
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
             "TE sync enabled on GPIO%d (%s edge, timeout fallback active)",
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
    ESP_RETURN_ON_FALSE(panel && frame_buffer, ESP_ERR_INVALID_ARG, TAG, "invalid draw arguments");
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
    wait_for_te(&te_wait_us);
    const int64_t transfer_started_us = esp_timer_get_time();
    const esp_err_t result = submit_region(panel, 0, 0, width, height, frame_buffer);

    const int64_t completed_us = esp_timer_get_time();
    ESP_LOGI(TAG,
             "Frame presented: te_wait=%lld us, transfer=%lld us, total=%lld us",
             (long long)te_wait_us,
             (long long)(completed_us - transfer_started_us),
             (long long)(completed_us - started_us));
    xSemaphoreGive(s_draw_lock);
    return result;
}
