#include "prototype_runtime.h"

#include "esp_check.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "generated_image.h"
#include "generated_prototype.h"
#include "display_presenter.h"
#include "frame_store.h"
#include "prototype_input.h"
#include "sdkconfig.h"
#include "wireless_content.h"

#define FRAME_PIXELS (CONFIG_EXAMPLE_LCD_H_RES * CONFIG_EXAMPLE_LCD_V_RES)

static const char *TAG = "prototype_runtime";

typedef esp_err_t (*transition_target_fn)(uint16_t state,
                                          openpencil_input_event_t event,
                                          uint16_t *target);
typedef bool (*state_uses_multi_click_fn)(uint16_t state);

typedef struct {
    const char *name;
    uint16_t state_count;
    uint16_t initial_state;
    transition_target_fn transition_target;
    state_uses_multi_click_fn state_uses_multi_click;
} openpencil_prototype_source_t;

static esp_err_t draw_state(esp_lcd_panel_handle_t panel,
                            uint16_t *frame_buffer,
                            const openpencil_prototype_source_t *source,
                            uint16_t state)
{
    if (state >= source->state_count) return ESP_ERR_INVALID_ARG;
    ESP_RETURN_ON_ERROR(openpencil_frame_store_load(state, frame_buffer, FRAME_PIXELS), TAG,
                        "load state frame");
    ESP_LOGI(TAG, "State %u", state);
    return openpencil_display_presenter_draw(panel,
                                             CONFIG_EXAMPLE_LCD_H_RES,
                                             CONFIG_EXAMPLE_LCD_V_RES,
                                             frame_buffer);
}

static esp_err_t run_source(esp_lcd_panel_handle_t panel,
                            uint16_t *frame_buffer,
                            const openpencil_prototype_source_t *source)
{
    ESP_RETURN_ON_FALSE(source && source->state_count > 0 &&
                            source->initial_state < source->state_count,
                        ESP_ERR_INVALID_ARG,
                        TAG,
                        "invalid prototype source");
    ESP_LOGI(TAG, "Start prototype: %s", source->name);
    ESP_RETURN_ON_ERROR(openpencil_input_init(), TAG, "initialize prototype inputs");
    uint16_t current_state = source->initial_state;
    openpencil_input_set_screen_multi_click(source->state_uses_multi_click(current_state));
    ESP_RETURN_ON_ERROR(draw_state(panel, frame_buffer, source, current_state), TAG,
                        "draw initial state");

    while (1) {
        openpencil_input_event_t event;
        if (openpencil_input_poll(&event)) {
            uint16_t next_state = current_state;
            ESP_RETURN_ON_ERROR(source->transition_target(current_state, event, &next_state), TAG,
                                "resolve prototype transition");
            ESP_LOGI(TAG, "Event %d: %u -> %u", event, current_state, next_state);
            if (next_state != current_state) {
                current_state = next_state;
                openpencil_input_set_screen_multi_click(
                    source->state_uses_multi_click(current_state));
                ESP_RETURN_ON_ERROR(draw_state(panel, frame_buffer, source, current_state), TAG,
                                    "draw state");
            }
        }
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

#if OPENPENCIL_PROTOTYPE_ENABLED
static esp_err_t generated_transition_target(uint16_t state,
                                              openpencil_input_event_t event,
                                              uint16_t *target)
{
    *target = state;
    for (int index = 0; index < OPENPENCIL_PROTOTYPE_TRANSITION_COUNT; index++) {
        const openpencil_transition_t transition = openpencil_transitions[index];
        if (transition.from_state == state && transition.event == event) {
            *target = transition.to_state;
            return ESP_OK;
        }
    }
    return ESP_OK;
}

static bool generated_state_uses_multi_click(uint16_t state)
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

static esp_err_t wireless_transition_target(uint16_t state,
                                             openpencil_input_event_t event,
                                             uint16_t *target)
{
    return openpencil_content_transition_target(state, (uint8_t)event, target);
}

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
    const openpencil_prototype_source_t source = {
        .name = OPENPENCIL_PROTOTYPE_NAME,
        .state_count = OPENPENCIL_PROTOTYPE_STATE_COUNT,
        .initial_state = OPENPENCIL_PROTOTYPE_INITIAL_STATE,
        .transition_target = generated_transition_target,
        .state_uses_multi_click = generated_state_uses_multi_click,
    };
    return run_source(panel, frame_buffer, &source);
#endif
}

esp_err_t openpencil_wireless_prototype_run(esp_lcd_panel_handle_t panel, uint16_t *frame_buffer)
{
    const openpencil_content_header_t *header = openpencil_content_header();
    ESP_RETURN_ON_FALSE(header && openpencil_content_is_prototype(), ESP_ERR_INVALID_STATE, TAG,
                        "wireless prototype is unavailable");
    const openpencil_prototype_source_t source = {
        .name = "wireless",
        .state_count = header->frame_count,
        .initial_state = openpencil_content_initial_state(),
        .transition_target = wireless_transition_target,
        .state_uses_multi_click = openpencil_content_state_uses_multi_click,
    };
    return run_source(panel, frame_buffer, &source);
}