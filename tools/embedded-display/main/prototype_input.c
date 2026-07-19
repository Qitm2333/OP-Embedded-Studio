#include "prototype_input.h"

#include "driver/gpio.h"
#include "driver/i2c_master.h"
#include "esp_check.h"
#include "esp_lcd_panel_io.h"
#include "esp_lcd_touch.h"
#include "esp_lcd_touch_cst9217.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "sdkconfig.h"

#define BOOT_BUTTON_GPIO GPIO_NUM_0
#define TOUCH_I2C_SCL GPIO_NUM_14
#define TOUCH_I2C_SDA GPIO_NUM_15
#define TOUCH_RESET_GPIO GPIO_NUM_2
#define TOUCH_INTERRUPT_GPIO GPIO_NUM_11
#define LONG_PRESS_MS 600
#define MULTI_CLICK_WINDOW_MS 320

typedef struct {
    bool pressed;
    bool long_sent;
    int64_t pressed_at_ms;
    int64_t released_at_ms;
    uint8_t click_count;
} gesture_recognizer_t;

static const char *TAG = "prototype_input";
static gesture_recognizer_t s_screen;
static gesture_recognizer_t s_boot;
static esp_lcd_touch_handle_t s_touch;
static bool s_screen_multi_click_enabled;

static int64_t now_ms(void)
{
    return esp_timer_get_time() / 1000;
}

static bool update_screen_gesture(bool pressed, openpencil_input_event_t *event)
{
    const int64_t now = now_ms();
    if (pressed && !s_screen.pressed) {
        s_screen.pressed = true;
        s_screen.long_sent = false;
        s_screen.pressed_at_ms = now;
    } else if (pressed && !s_screen.long_sent && now - s_screen.pressed_at_ms >= LONG_PRESS_MS) {
        s_screen.long_sent = true;
        s_screen.click_count = 0;
        *event = OPENPENCIL_EVENT_SCREEN_LONG_PRESS;
        return true;
    } else if (!pressed && s_screen.pressed) {
        s_screen.pressed = false;
        if (!s_screen.long_sent) {
            if (!s_screen_multi_click_enabled) {
                *event = OPENPENCIL_EVENT_SCREEN_CLICK;
                return true;
            }
            s_screen.click_count++;
            s_screen.released_at_ms = now;
        }
    }

    if (!s_screen.pressed && s_screen.click_count > 0 &&
        now - s_screen.released_at_ms >= MULTI_CLICK_WINDOW_MS) {
        *event = s_screen.click_count >= 3
                     ? OPENPENCIL_EVENT_SCREEN_TRIPLE_CLICK
                     : s_screen.click_count == 2
                           ? OPENPENCIL_EVENT_SCREEN_DOUBLE_CLICK
                           : OPENPENCIL_EVENT_SCREEN_CLICK;
        s_screen.click_count = 0;
        return true;
    }
    return false;
}

static bool update_boot_gesture(bool pressed, openpencil_input_event_t *event)
{
    const int64_t now = now_ms();
    if (pressed && !s_boot.pressed) {
        s_boot.pressed = true;
        s_boot.long_sent = false;
        s_boot.pressed_at_ms = now;
    } else if (pressed && !s_boot.long_sent && now - s_boot.pressed_at_ms >= LONG_PRESS_MS) {
        s_boot.long_sent = true;
        *event = OPENPENCIL_EVENT_BOOT_LONG_PRESS;
        return true;
    } else if (!pressed && s_boot.pressed) {
        s_boot.pressed = false;
        if (!s_boot.long_sent) {
            *event = OPENPENCIL_EVENT_BOOT_CLICK;
            return true;
        }
    }
    return false;
}

static esp_err_t init_boot_button(void)
{
    const gpio_config_t config = {
        .pin_bit_mask = 1ULL << BOOT_BUTTON_GPIO,
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    return gpio_config(&config);
}

static esp_err_t init_waveshare_touch(void)
{
#if CONFIG_EXAMPLE_LCD_CONTROLLER_CO5300
    i2c_master_bus_handle_t bus = NULL;
    const i2c_master_bus_config_t bus_config = {
        .i2c_port = I2C_NUM_0,
        .sda_io_num = TOUCH_I2C_SDA,
        .scl_io_num = TOUCH_I2C_SCL,
        .clk_source = I2C_CLK_SRC_DEFAULT,
        .glitch_ignore_cnt = 7,
        .flags.enable_internal_pullup = true,
    };
    ESP_RETURN_ON_ERROR(i2c_new_master_bus(&bus_config, &bus), TAG, "create touch I2C bus");

    esp_lcd_panel_io_handle_t io = NULL;
    esp_lcd_panel_io_i2c_config_t io_config = ESP_LCD_TOUCH_IO_I2C_CST9217_CONFIG();
    io_config.scl_speed_hz = 400000;
    ESP_RETURN_ON_ERROR(esp_lcd_new_panel_io_i2c(bus, &io_config, &io), TAG, "create touch I2C IO");

    const esp_lcd_touch_config_t touch_config = {
        .x_max = CONFIG_EXAMPLE_LCD_H_RES,
        .y_max = CONFIG_EXAMPLE_LCD_V_RES,
        .rst_gpio_num = TOUCH_RESET_GPIO,
        .int_gpio_num = TOUCH_INTERRUPT_GPIO,
        .levels = {.reset = 0, .interrupt = 0},
        .flags = {.swap_xy = 0, .mirror_x = 0, .mirror_y = 0},
    };
    return esp_lcd_touch_new_i2c_cst9217(io, &touch_config, &s_touch);
#else
    return ESP_OK;
#endif
}

esp_err_t openpencil_input_init(void)
{
    ESP_RETURN_ON_ERROR(init_boot_button(), TAG, "initialize BOOT button");
    const esp_err_t touch_result = init_waveshare_touch();
    if (touch_result != ESP_OK) {
        ESP_LOGW(TAG, "Touch unavailable; BOOT events remain active: %s", esp_err_to_name(touch_result));
    }
    return ESP_OK;
}

void openpencil_input_set_screen_multi_click(bool enabled)
{
    s_screen_multi_click_enabled = enabled;
    s_screen.click_count = 0;
}

bool openpencil_input_poll(openpencil_input_event_t *event)
{
    bool screen_pressed = false;
    if (s_touch && esp_lcd_touch_read_data(s_touch) == ESP_OK) {
        esp_lcd_touch_point_data_t point = {0};
        uint8_t points = 0;
        screen_pressed = esp_lcd_touch_get_data(s_touch, &point, &points, 1) == ESP_OK && points > 0;
    }
    if (update_screen_gesture(screen_pressed, event)) return true;
    return update_boot_gesture(gpio_get_level(BOOT_BUTTON_GPIO) == 0, event);
}
