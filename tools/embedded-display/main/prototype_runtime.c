#include "prototype_runtime.h"

#include "esp_check.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "generated_image.h"
#include "generated_prototype.h"
#include "display_presenter.h"
#include "frame_store.h"
#include "lcd_panel_factory.h"
#include "prototype_input.h"
#include "sdkconfig.h"

#define FRAME_PIXELS (CONFIG_EXAMPLE_LCD_H_RES * CONFIG_EXAMPLE_LCD_V_RES)

static const char *TAG = "prototype_runtime";

#if OPENPENCIL_PROTOTYPE_ENABLED
static esp_err_t draw_state(esp_lcd_panel_handle_t panel, uint16_t *frame_buffer, uint8_t state)
{
    if (state >= OPENPENCIL_PROTOTYPE_STATE_COUNT) return ESP_ERR_INVALID_ARG;
    ESP_RETURN_ON_ERROR(openpencil_frame_store_load(state, frame_buffer, FRAME_PIXELS), TAG, "load state frame");
    ESP_LOGI(TAG, "State %u: %s", state, openpencil_state_names[state]);
    return openpencil_display_presenter_draw(panel,
                                             CONFIG_EXAMPLE_LCD_H_RES,
                                             CONFIG_EXAMPLE_LCD_V_RES,
                                             frame_buffer);
}

static uint8_t transition_target(uint8_t state, openpencil_input_event_t event)
{
    for (int index = 0; index < OPENPENCIL_PROTOTYPE_TRANSITION_COUNT; index++) {
        const openpencil_transition_t transition = openpencil_transitions[index];
        if (transition.from_state == state && transition.event == event) return transition.to_state;
    }
    return state;
}

static bool state_uses_multi_click(uint8_t state)
{
    for (int index = 0; index < OPENPENCIL_PROTOTYPE_TRANSITION_COUNT; index++) {
        const openpencil_transition_t transition = openpencil_transitions[index];
        if (transition.from_state == state &&
            (transition.event == OPENPENCIL_EVENT_SCREEN_DOUBLE_CLICK ||
             transition.event == OPENPENCIL_EVENT_SCREEN_TRIPLE_CLICK)) {
            return true;
        }
    }
    return false;
}
#endif

esp_err_t openpencil_prototype_run(esp_lcd_panel_handle_t panel, uint16_t *frame_buffer)
{
#if !OPENPENCIL_PROTOTYPE_ENABLED
    return ESP_ERR_NOT_SUPPORTED;
#else
    if (OPENPENCIL_PROTOTYPE_STATE_COUNT != LCD_GENERATED_IMAGE_FRAME_COUNT ||
        LCD_GENERATED_IMAGE_PIXEL_COUNT != FRAME_PIXELS * OPENPENCIL_PROTOTYPE_STATE_COUNT) {
        ESP_LOGE(TAG, "Prototype resources do not match the selected display geometry");
        return ESP_ERR_INVALID_SIZE;
    }

    ESP_LOGI(TAG, "Start prototype: %s", OPENPENCIL_PROTOTYPE_NAME);
    ESP_RETURN_ON_ERROR(openpencil_input_init(), TAG, "initialize prototype inputs");
    uint8_t current_state = OPENPENCIL_PROTOTYPE_INITIAL_STATE;
    openpencil_input_set_screen_multi_click(state_uses_multi_click(current_state));
    ESP_RETURN_ON_ERROR(draw_state(panel, frame_buffer, current_state), TAG, "draw initial state");

    while (1) {
        openpencil_input_event_t event;
        if (openpencil_input_poll(&event)) {
            const uint8_t next_state = transition_target(current_state, event);
            ESP_LOGI(TAG, "Event %d: %u -> %u", event, current_state, next_state);
            if (next_state != current_state) {
                current_state = next_state;
                openpencil_input_set_screen_multi_click(state_uses_multi_click(current_state));
                ESP_RETURN_ON_ERROR(draw_state(panel, frame_buffer, current_state), TAG, "draw state");
            }
        }
        vTaskDelay(pdMS_TO_TICKS(10));
    }
#endif
}
