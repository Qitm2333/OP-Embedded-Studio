#include "usb_content_server.h"

#include <inttypes.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "driver/usb_serial_jtag.h"
#include "esp_check.h"
#include "esp_heap_caps.h"
#include "esp_log.h"
#include "miniz.h"
#include "esp_system.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "wireless_content.h"

#define USB_PROTOCOL_PREFIX "OPUSB/1"
#define USB_CONTENT_SERVICE_VERSION 2u
#define USB_CONTENT_CHUNK_BYTES 0x10000u
#define USB_CONTENT_LINE_BYTES 128u
#define USB_CONTENT_TASK_STACK_BYTES 6144u
#define USB_CONTENT_READ_TIMEOUT_MS 2000u

static const char *TAG = "usb_content";
static bool server_started;

static esp_err_t usb_write_all(const void *data, size_t length)
{
    const uint8_t *bytes = data;
    size_t written = 0;
    while (written < length) {
        const int result = usb_serial_jtag_write_bytes(bytes + written,
                                                       length - written,
                                                       pdMS_TO_TICKS(1000));
        if (result <= 0) return ESP_ERR_TIMEOUT;
        written += (size_t)result;
    }
    return ESP_OK;
}

static esp_err_t usb_write_line(const char *line)
{
    return usb_write_all(line, strlen(line));
}

static void usb_reply_error(esp_err_t error, const char *operation)
{
    char response[USB_CONTENT_LINE_BYTES];
    snprintf(response,
             sizeof(response),
             USB_PROTOCOL_PREFIX " ERR %" PRIi32 " %s\n",
             (int32_t)error,
             operation);
    usb_write_line(response);
}

static esp_err_t usb_read_exact_with_timeout(void *destination,
                                             size_t length,
                                             TickType_t timeout_ticks)
{
    uint8_t *bytes = destination;
    size_t received = 0;
    while (received < length) {
        const int result = usb_serial_jtag_read_bytes(bytes + received,
                                                      length - received,
                                                      timeout_ticks);
        if (result <= 0) return ESP_ERR_TIMEOUT;
        received += (size_t)result;
    }
    return ESP_OK;
}

static esp_err_t usb_read_line(char *line, size_t capacity)
{
    size_t length = 0;
    while (length + 1 < capacity) {
        uint8_t byte = 0;
        ESP_RETURN_ON_ERROR(usb_read_exact_with_timeout(&byte, 1, portMAX_DELAY), TAG,
                            "read USB command byte failed");
        if (byte == '\n') {
            line[length] = '\0';
            return ESP_OK;
        }
        if (byte != '\r') line[length++] = (char)byte;
    }
    line[capacity - 1] = '\0';
    return ESP_ERR_INVALID_SIZE;
}

static esp_err_t handle_begin(const char *line, uint8_t *encoded_buffer)
{
    uint32_t total_bytes = 0;
    if (sscanf(line, USB_PROTOCOL_PREFIX " BEGIN %" SCNu32, &total_bytes) != 1 ||
        total_bytes < sizeof(openpencil_content_header_t)) {
        return ESP_ERR_INVALID_ARG;
    }

    openpencil_content_header_t header;
    ESP_RETURN_ON_ERROR(usb_read_exact_with_timeout(encoded_buffer,
                                                    sizeof(header),
                                                    pdMS_TO_TICKS(USB_CONTENT_READ_TIMEOUT_MS)), TAG,
                        "read USB content header failed");
    memcpy(&header, encoded_buffer, sizeof(header));
    ESP_RETURN_ON_ERROR(openpencil_content_write_begin(&header, total_bytes), TAG,
                        "begin USB content write failed");
    return usb_write_line(USB_PROTOCOL_PREFIX " ACK 0\n");
}

static esp_err_t handle_chunk(const char *line,
                              uint8_t *encoded_buffer,
                              uint8_t *decoded_buffer,
                              tinfl_decompressor *decompressor)
{
    uint32_t offset = 0;
    uint32_t raw_bytes = 0;
    uint32_t encoded_bytes = 0;
    uint32_t codec = 0;
    if (sscanf(line,
               USB_PROTOCOL_PREFIX " CHUNK %" SCNu32 " %" SCNu32 " %" SCNu32 " %" SCNu32,
               &offset,
               &raw_bytes,
               &encoded_bytes,
               &codec) != 4 ||
        raw_bytes == 0 || raw_bytes > USB_CONTENT_CHUNK_BYTES ||
        encoded_bytes == 0 || encoded_bytes > USB_CONTENT_CHUNK_BYTES || codec > 1) {
        return ESP_ERR_INVALID_ARG;
    }

    ESP_RETURN_ON_ERROR(usb_read_exact_with_timeout(encoded_buffer,
                                                    encoded_bytes,
                                                    pdMS_TO_TICKS(USB_CONTENT_READ_TIMEOUT_MS)), TAG,
                        "read USB content chunk failed");
    const uint8_t *content = encoded_buffer;
    if (codec == 1) {
        tinfl_init(decompressor);
        size_t input_bytes = encoded_bytes;
        size_t output_bytes = raw_bytes;
        const tinfl_status status = tinfl_decompress(
            decompressor,
            encoded_buffer,
            &input_bytes,
            decoded_buffer,
            decoded_buffer,
            &output_bytes,
            TINFL_FLAG_PARSE_ZLIB_HEADER | TINFL_FLAG_USING_NON_WRAPPING_OUTPUT_BUF);
        if (status != TINFL_STATUS_DONE || input_bytes != encoded_bytes ||
            output_bytes != raw_bytes) {
            return ESP_ERR_INVALID_SIZE;
        }
        content = decoded_buffer;
    } else if (encoded_bytes != raw_bytes) {
        return ESP_ERR_INVALID_SIZE;
    } else {
        memcpy(decoded_buffer, encoded_buffer, raw_bytes);
        content = decoded_buffer;
    }

    ESP_RETURN_ON_ERROR(openpencil_content_write_chunk(offset, content, raw_bytes), TAG,
                        "write USB content chunk failed");
    char response[USB_CONTENT_LINE_BYTES];
    snprintf(response,
             sizeof(response),
             USB_PROTOCOL_PREFIX " ACK %" PRIu32 "\n",
             offset + raw_bytes);
    return usb_write_line(response);
}

static esp_err_t handle_finish(void)
{
    ESP_RETURN_ON_ERROR(openpencil_content_write_finish(), TAG, "finish USB content write failed");
    ESP_RETURN_ON_ERROR(usb_write_line(USB_PROTOCOL_PREFIX " DONE\n"), TAG,
                        "write USB completion failed");
    usb_serial_jtag_wait_tx_done(pdMS_TO_TICKS(1000));
    vTaskDelay(pdMS_TO_TICKS(150));
    esp_restart();
    return ESP_OK;
}

static void usb_content_server_task(void *argument)
{
    (void)argument;
    uint8_t *encoded_buffer = heap_caps_malloc(USB_CONTENT_CHUNK_BYTES,
                                               MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    uint8_t *decoded_buffer = heap_caps_malloc(USB_CONTENT_CHUNK_BYTES,
                                               MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
    if (!decoded_buffer) {
        decoded_buffer = heap_caps_malloc(USB_CONTENT_CHUNK_BYTES,
                                          MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    }
    tinfl_decompressor *decompressor = heap_caps_malloc(sizeof(*decompressor),
                                                        MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
    if (!encoded_buffer || !decoded_buffer || !decompressor) {
        ESP_LOGE(TAG, "USB content buffers unavailable");
        free(encoded_buffer);
        free(decoded_buffer);
        free(decompressor);
        server_started = false;
        vTaskDelete(NULL);
        return;
    }

    char line[USB_CONTENT_LINE_BYTES];
    while (true) {
        const esp_err_t read_result = usb_read_line(line, sizeof(line));
        if (read_result != ESP_OK) {
            usb_reply_error(read_result, "line");
            continue;
        }
        if (strncmp(line, USB_PROTOCOL_PREFIX " ", strlen(USB_PROTOCOL_PREFIX) + 1) != 0) {
            continue;
        }

        esp_err_t result = ESP_OK;
        const char *operation = "command";
        if (strcmp(line, USB_PROTOCOL_PREFIX " HELLO") == 0) {
            char response[USB_CONTENT_LINE_BYTES];
            snprintf(response,
                     sizeof(response),
                     USB_PROTOCOL_PREFIX " READY %u %u %u %u\n",
                     USB_CONTENT_SERVICE_VERSION,
                     CONFIG_EXAMPLE_LCD_H_RES,
                     CONFIG_EXAMPLE_LCD_V_RES,
                     (unsigned)openpencil_content_capacity());
            result = usb_write_line(response);
            operation = "hello";
        } else if (strncmp(line, USB_PROTOCOL_PREFIX " BEGIN ", 14) == 0) {
            operation = "begin";
            result = handle_begin(line, encoded_buffer);
        } else if (strncmp(line, USB_PROTOCOL_PREFIX " CHUNK ", 14) == 0) {
            operation = "chunk";
            result = handle_chunk(line, encoded_buffer, decoded_buffer, decompressor);
        } else if (strcmp(line, USB_PROTOCOL_PREFIX " END") == 0) {
            operation = "finish";
            result = handle_finish();
        } else if (strcmp(line, USB_PROTOCOL_PREFIX " ABORT") == 0) {
            openpencil_content_write_abort();
            operation = "abort";
            result = usb_write_line(USB_PROTOCOL_PREFIX " ABORTED\n");
        } else {
            result = ESP_ERR_NOT_SUPPORTED;
        }

        if (result != ESP_OK) {
            openpencil_content_write_abort();
            usb_reply_error(result, operation);
        }
    }
}

esp_err_t openpencil_usb_content_server_start(void)
{
    if (server_started) return ESP_OK;
    if (!usb_serial_jtag_is_driver_installed()) {
        usb_serial_jtag_driver_config_t config = {
            .tx_buffer_size = 4096,
            .rx_buffer_size = 16384,
        };
        ESP_RETURN_ON_ERROR(usb_serial_jtag_driver_install(&config), TAG,
                            "install USB Serial/JTAG driver failed");
    }
    const BaseType_t task_created = xTaskCreatePinnedToCore(usb_content_server_task,
                                                            "usb_content",
                                                            USB_CONTENT_TASK_STACK_BYTES,
                                                            NULL,
                                                            8,
                                                            NULL,
                                                            0);
    ESP_RETURN_ON_FALSE(task_created == pdPASS, ESP_ERR_NO_MEM, TAG,
                        "create USB content task failed");
    server_started = true;
    return ESP_OK;
}
