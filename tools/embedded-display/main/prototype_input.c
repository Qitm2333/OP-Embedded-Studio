#include "prototype_input.h"

#include "driver/gpio.h"
#include "driver/i2c_master.h"
#include "esp_check.h"
#include "esp_lcd_panel_io.h"
#include "esp_lcd_touch.h"
#include "esp_lcd_touch_cst9217.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "m5ioe1.h"
#include "m5cores3.h"
#include "sdkconfig.h"

#if CONFIG_IDF_TARGET_ESP32C3
#define BOOT_BUTTON_GPIO GPIO_NUM_9
#else
#define BOOT_BUTTON_GPIO GPIO_NUM_0
#endif
#define STOPWATCH_BUTTON_A_GPIO GPIO_NUM_2
#define STOPWATCH_BUTTON_B_GPIO GPIO_NUM_1
#define TOUCH_I2C_SCL GPIO_NUM_14
#define TOUCH_I2C_SDA GPIO_NUM_15
#define TOUCH_RESET_GPIO GPIO_NUM_2
#define TOUCH_INTERRUPT_GPIO GPIO_NUM_11
#define LONG_PRESS_MS 600
#define MULTI_CLICK_WINDOW_MS 320
#define BUTTON_DEBOUNCE_MS 25

typedef struct {
    bool pressed;
    bool long_sent;
    int64_t pressed_at_ms;
    int64_t released_at_ms;
    uint8_t click_count;
} gesture_recognizer_t;

#if CONFIG_OPENPENCIL_BOARD_M5STACK_STOPWATCH
typedef struct {
    bool raw_pressed;
    bool stable_pressed;
    int64_t changed_at_ms;
} debounced_button_t;
#endif
#if CONFIG_OPENPENCIL_BOARD_M5STACK_CORES3
static i2c_master_dev_handle_t s_cores3_touch;
#endif

static const char *TAG = "prototype_input";
static gesture_recognizer_t s_screen;
static gesture_recognizer_t s_boot;
static esp_lcd_touch_handle_t s_touch;
static bool s_screen_multi_click_enabled;
#if CONFIG_OPENPENCIL_BOARD_M5STACK_STOPWATCH
static debounced_button_t s_stopwatch_button_a;
static debounced_button_t s_stopwatch_button_b;
static i2c_master_dev_handle_t s_stopwatch_touch;
#endif

#if CONFIG_OPENPENCIL_BOARD_M5STACK_CORES3
static esp_err_t init_cores3_touch(void)
{
    i2c_master_bus_handle_t bus = openpencil_m5cores3_i2c_bus();
    ESP_RETURN_ON_FALSE(bus, ESP_ERR_INVALID_STATE, TAG, "CoreS3 I2C bus is unavailable");
    const i2c_device_config_t device_config = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = 0x38,
        .scl_speed_hz = 400000,
    };
    ESP_RETURN_ON_ERROR(i2c_master_bus_add_device(bus, &device_config, &s_cores3_touch), TAG, "add FT6336U touch device failed");
    uint8_t device_mode = 0;
    const uint8_t register_address = 0x00;
    ESP_RETURN_ON_ERROR(i2c_master_transmit_receive(s_cores3_touch, &register_address, 1, &device_mode, 1, 100), TAG, "read FT6336U failed");
    ESP_LOGI(TAG, "CoreS3 FT6336U ready at 0x38 (mode=0x%02x)", device_mode);
    return ESP_OK;
}

static bool read_cores3_touch(void)
{
    if (!s_cores3_touch) return false;
    uint8_t register_address = 0x02;
    uint8_t data[7] = {0};
    if (i2c_master_transmit_receive(s_cores3_touch, &register_address, 1, data, sizeof(data), 20) != ESP_OK) {
        return false;
    }
    return data[0] > 0;
}
#endif

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

#if CONFIG_OPENPENCIL_BOARD_M5STACK_STOPWATCH
static esp_err_t init_stopwatch_touch(void)
{
    i2c_master_bus_handle_t bus = openpencil_m5ioe1_i2c_bus();
    ESP_RETURN_ON_FALSE(bus, ESP_ERR_INVALID_STATE, TAG, "M5IOE1 I2C bus is unavailable");
    ESP_RETURN_ON_ERROR(openpencil_m5ioe1_touch_reset(), TAG, "reset StopWatch touch failed");

    const i2c_device_config_t device_config = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = 0x15,
        .scl_speed_hz = 100000,
    };
    ESP_RETURN_ON_ERROR(i2c_master_bus_add_device(bus, &device_config, &s_stopwatch_touch),
                        TAG,
                        "add CST820 touch device failed");

    uint8_t chip_id = 0;
    uint8_t software_version = 0;
    uint8_t chip_id_register = 0xA7;
    uint8_t software_version_register = 0xA9;
    ESP_RETURN_ON_ERROR(i2c_master_transmit_receive(s_stopwatch_touch,
                                                    &chip_id_register,
                                                    1,
                                                    &chip_id,
                                                    1,
                                                    100),
                        TAG,
                        "read CST820 chip ID failed");
    ESP_RETURN_ON_ERROR(i2c_master_transmit_receive(s_stopwatch_touch,
                                                    &software_version_register,
                                                    1,
                                                    &software_version,
                                                    1,
                                                    100),
                        TAG,
                        "read CST820 software version failed");
    ESP_RETURN_ON_FALSE(chip_id != 0 && software_version != 0,
                        ESP_ERR_NOT_FOUND,
                        TAG,
                        "CST820 returned an invalid identity");
    ESP_LOGI(TAG,
             "StopWatch CST820 ready at 0x15 (chip=0x%02x, version=0x%02x; I2C SDA=47 SCL=48)",
             chip_id,
             software_version);
    return ESP_OK;
}

static bool read_stopwatch_touch(void)
{
    if (!s_stopwatch_touch) return false;
    uint8_t register_address = 0x00;
    uint8_t data[7] = {0};
    const esp_err_t result = i2c_master_transmit_receive(s_stopwatch_touch,
                                                         &register_address,
                                                         1,
                                                         data,
                                                         sizeof(data),
                                                         100);
    if (result != ESP_OK) return false;
    const uint8_t finger_count = data[2];
    const uint8_t event_status = (data[3] & 0xC0) >> 6;
    return finger_count > 0 && (event_status == 0 || event_status == 2);
}

static esp_err_t init_stopwatch_buttons(void)
{
    const gpio_config_t config = {
        .pin_bit_mask = (1ULL << STOPWATCH_BUTTON_A_GPIO) |
                        (1ULL << STOPWATCH_BUTTON_B_GPIO),
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    return gpio_config(&config);
}

static bool update_stopwatch_button(gpio_num_t gpio,
                                    debounced_button_t *button,
                                    openpencil_input_event_t released_event,
                                    openpencil_input_event_t *event)
{
    const int64_t now = now_ms();
    const bool pressed = gpio_get_level(gpio) == 0;
    if (pressed != button->raw_pressed) {
        button->raw_pressed = pressed;
        button->changed_at_ms = now;
    }
    if (pressed == button->stable_pressed || now - button->changed_at_ms < BUTTON_DEBOUNCE_MS) {
        return false;
    }
    button->stable_pressed = pressed;
    if (pressed) return false;
    *event = released_event;
    return true;
}
#endif

static esp_err_t init_waveshare_touch(void)
{
#if CONFIG_EXAMPLE_LCD_CONTROLLER_CO5300 && !CONFIG_OPENPENCIL_BOARD_M5STACK_STOPWATCH
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
#if CONFIG_OPENPENCIL_BOARD_M5STACK_STOPWATCH
    ESP_RETURN_ON_ERROR(init_stopwatch_buttons(), TAG, "initialize StopWatch buttons");
#endif
#if CONFIG_OPENPENCIL_BOARD_M5STACK_STOPWATCH
    const esp_err_t touch_result = init_stopwatch_touch();
    if (touch_result != ESP_OK) {
        ESP_LOGW(TAG, "StopWatch touch unavailable; physical buttons remain active: %s",
                 esp_err_to_name(touch_result));
    }
#else
    const esp_err_t touch_result =
#if CONFIG_OPENPENCIL_BOARD_M5STACK_CORES3
        init_cores3_touch();
#else
        init_waveshare_touch();
#endif
    if (touch_result != ESP_OK) {
        ESP_LOGW(TAG, "Touch unavailable; BOOT events remain active: %s", esp_err_to_name(touch_result));
    }
#endif
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
#if CONFIG_OPENPENCIL_BOARD_M5STACK_STOPWATCH
    screen_pressed = read_stopwatch_touch();
#elif CONFIG_OPENPENCIL_BOARD_M5STACK_CORES3
    screen_pressed = read_cores3_touch();
#else
    if (s_touch && esp_lcd_touch_read_data(s_touch) == ESP_OK) {
        esp_lcd_touch_point_data_t point = {0};
        uint8_t points = 0;
        screen_pressed = esp_lcd_touch_get_data(s_touch, &point, &points, 1) == ESP_OK && points > 0;
    }
#endif
    if (update_screen_gesture(screen_pressed, event)) return true;
#if CONFIG_OPENPENCIL_BOARD_M5STACK_STOPWATCH
    if (update_stopwatch_button(STOPWATCH_BUTTON_A_GPIO,
                                &s_stopwatch_button_a,
                                OPENPENCIL_EVENT_STOPWATCH_BUTTON_A_CLICK,
                                event)) {
        return true;
    }
    if (update_stopwatch_button(STOPWATCH_BUTTON_B_GPIO,
                                &s_stopwatch_button_b,
                                OPENPENCIL_EVENT_STOPWATCH_BUTTON_B_CLICK,
                                event)) {
        return true;
    }
#endif
    return update_boot_gesture(gpio_get_level(BOOT_BUTTON_GPIO) == 0, event);
}
