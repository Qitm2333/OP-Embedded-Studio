#include "wireless_content.h"
#include "lcd_panel_factory.h"

#include <stdlib.h>
#include <string.h>
#include "sdkconfig.h"
#include "esp_check.h"
#include "esp_crc.h"
#include "esp_log.h"
#include "esp_partition.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "wireless_content";
static const esp_partition_t *content_partition;
static openpencil_content_header_t active_header;
static openpencil_prototype_content_header_t active_prototype;
static bool content_valid;

uint8_t openpencil_content_firmware_mode(void)
{
#if CONFIG_OPENPENCIL_BLE_SERVER
    return OPENPENCIL_CONTENT_FIRMWARE_MODE_UNIFIED;
#else
    return OPENPENCIL_CONTENT_MODE_FRAME;
#endif
}

static bool content_mode_supported(uint8_t mode)
{
#if CONFIG_OPENPENCIL_BLE_SERVER
    return mode == OPENPENCIL_CONTENT_MODE_FRAME ||
           mode == OPENPENCIL_CONTENT_MODE_PROTOTYPE;
#else
    return mode == OPENPENCIL_CONTENT_MODE_FRAME;
#endif
}

static bool common_header_matches(const openpencil_content_header_t *header)
{
    return content_partition && header &&
           header->magic == OPENPENCIL_CONTENT_MAGIC &&
           header->version == OPENPENCIL_CONTENT_VERSION &&
           content_mode_supported(header->mode) &&
           header->frame_count > 0 &&
           header->width == CONFIG_EXAMPLE_LCD_H_RES &&
           header->height == CONFIG_EXAMPLE_LCD_V_RES &&
           header->payload_bytes > 0 &&
           header->payload_bytes <= content_partition->size - sizeof(*header);
}

static bool layout_matches(const openpencil_content_header_t *header,
                           const openpencil_prototype_content_header_t *prototype)
{
    if (!common_header_matches(header)) return false;
    const size_t frame_bytes = (size_t)header->width * header->height * sizeof(uint16_t);
    if (header->mode == OPENPENCIL_CONTENT_MODE_FRAME) {
        return header->frame_count == 1 && header->payload_bytes == frame_bytes;
    }
    if (!prototype || header->mode != OPENPENCIL_CONTENT_MODE_PROTOTYPE ||
        header->frame_count > OPENPENCIL_CONTENT_MAX_PROTOTYPE_STATES ||
        prototype->initial_state >= header->frame_count || prototype->frame_bytes != frame_bytes) {
        return false;
    }
    const size_t metadata_bytes = sizeof(*prototype) +
                                  (size_t)prototype->transition_count * sizeof(openpencil_content_transition_t);
    return metadata_bytes <= header->payload_bytes &&
           header->payload_bytes - metadata_bytes == frame_bytes * header->frame_count;
}

static esp_err_t validate_transitions(const openpencil_content_header_t *header,
                                      const openpencil_prototype_content_header_t *prototype,
                                      const uint8_t *payload)
{
    if (header->mode != OPENPENCIL_CONTENT_MODE_PROTOTYPE) return ESP_OK;
    for (uint16_t index = 0; index < prototype->transition_count; index++) {
        openpencil_content_transition_t transition;
        if (payload) {
            memcpy(&transition,
                   payload + sizeof(*prototype) + (size_t)index * sizeof(transition),
                   sizeof(transition));
        } else {
            ESP_RETURN_ON_ERROR(
                esp_partition_read(content_partition,
                                   sizeof(*header) + sizeof(*prototype) +
                                       (size_t)index * sizeof(transition),
                                   &transition,
                                   sizeof(transition)),
                TAG,
                "read prototype transition failed");
        }
        if (transition.from_state >= header->frame_count ||
            transition.to_state >= header->frame_count || transition.event > 5) {
            return ESP_ERR_INVALID_ARG;
        }
    }
    return ESP_OK;
}

esp_err_t openpencil_content_init(void)
{
    content_partition = esp_partition_find_first(
        ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_ANY, "content");
    if (!content_partition) {
        ESP_LOGW(TAG, "wireless content partition not found; using generated image");
        content_valid = false;
        return ESP_OK;
    }

    openpencil_content_header_t header = {0};
    ESP_RETURN_ON_ERROR(esp_partition_read(content_partition, 0, &header, sizeof(header)), TAG,
                        "read content header failed");
    openpencil_prototype_content_header_t prototype = {0};
    if (header.mode == OPENPENCIL_CONTENT_MODE_PROTOTYPE) {
        ESP_RETURN_ON_ERROR(esp_partition_read(content_partition, sizeof(header), &prototype,
                                               sizeof(prototype)),
                            TAG,
                            "read prototype header failed");
    }
    if (!layout_matches(&header, &prototype)) {
        ESP_LOGI(TAG, "no valid wireless content; using generated image");
        content_valid = false;
        return ESP_OK;
    }

    const size_t chunk_capacity = 4096;
    uint8_t *chunk = malloc(chunk_capacity);
    ESP_RETURN_ON_FALSE(chunk, ESP_ERR_NO_MEM, TAG, "allocate CRC buffer failed");
    uint32_t crc = 0;
    size_t remaining = header.payload_bytes;
    size_t offset = sizeof(header);
    while (remaining > 0) {
        size_t length = remaining > chunk_capacity ? chunk_capacity : remaining;
        ESP_RETURN_ON_ERROR(esp_partition_read(content_partition, offset, chunk, length), TAG,
                            "read content payload failed");
        crc = esp_crc32_le(crc, chunk, length);
        offset += length;
        remaining -= length;
        vTaskDelay(pdMS_TO_TICKS(1));
    }
    free(chunk);
    if (crc != header.payload_crc32 || validate_transitions(&header, &prototype, NULL) != ESP_OK) {
        ESP_LOGW(TAG, "wireless content validation failed; using generated image");
        content_valid = false;
        return ESP_OK;
    }

    active_header = header;
    active_prototype = prototype;
    content_valid = true;
    ESP_LOGI(TAG, "wireless content ready: mode=%u, %ux%u, frames=%u, %u bytes",
             header.mode, header.width, header.height, header.frame_count,
             (unsigned)header.payload_bytes);
    return ESP_OK;
}

bool openpencil_content_is_valid(void)
{
    return content_valid;
}

bool openpencil_content_is_prototype(void)
{
    return content_valid && active_header.mode == OPENPENCIL_CONTENT_MODE_PROTOTYPE;
}

const openpencil_content_header_t *openpencil_content_header(void)
{
    return content_valid ? &active_header : NULL;
}

uint16_t openpencil_content_initial_state(void)
{
    return openpencil_content_is_prototype() ? active_prototype.initial_state : 0;
}

esp_err_t openpencil_content_transition_target(uint16_t state, uint8_t event, uint16_t *target)
{
    if (!openpencil_content_is_prototype() || !target || state >= active_header.frame_count) {
        return ESP_ERR_INVALID_ARG;
    }
    *target = state;
    for (uint16_t index = 0; index < active_prototype.transition_count; index++) {
        openpencil_content_transition_t transition;
        ESP_RETURN_ON_ERROR(
            esp_partition_read(content_partition,
                               sizeof(active_header) + sizeof(active_prototype) +
                                   (size_t)index * sizeof(transition),
                               &transition,
                               sizeof(transition)),
            TAG,
            "read prototype transition failed");
        if (transition.from_state == state && transition.event == event) {
            *target = transition.to_state;
            return ESP_OK;
        }
    }
    return ESP_OK;
}

bool openpencil_content_state_uses_multi_click(uint16_t state)
{
    if (!openpencil_content_is_prototype() || state >= active_header.frame_count) return false;
    for (uint16_t index = 0; index < active_prototype.transition_count; index++) {
        openpencil_content_transition_t transition;
        if (esp_partition_read(content_partition,
                               sizeof(active_header) + sizeof(active_prototype) +
                                   (size_t)index * sizeof(transition),
                               &transition,
                               sizeof(transition)) != ESP_OK) {
            return false;
        }
        if (transition.from_state == state && (transition.event == 2 || transition.event == 3)) {
            return true;
        }
    }
    return false;
}

esp_err_t openpencil_content_load_frame(uint16_t frame_index, uint16_t *destination, size_t pixels)
{
    if (!content_valid || !destination || frame_index >= active_header.frame_count) {
        return ESP_ERR_INVALID_STATE;
    }
    const size_t frame_bytes = (size_t)active_header.width * active_header.height * sizeof(uint16_t);
    if (pixels * sizeof(uint16_t) < frame_bytes) return ESP_ERR_INVALID_SIZE;

    size_t frame_offset = sizeof(active_header);
    if (active_header.mode == OPENPENCIL_CONTENT_MODE_PROTOTYPE) {
        frame_offset += sizeof(active_prototype) +
                        (size_t)active_prototype.transition_count * sizeof(openpencil_content_transition_t);
    }
    frame_offset += (size_t)frame_index * frame_bytes;
    ESP_RETURN_ON_ERROR(esp_partition_read(content_partition, frame_offset, destination, frame_bytes),
                        TAG,
                        "read content frame failed");

    for (size_t pixel = 0; pixel < frame_bytes / sizeof(uint16_t); pixel++) {
        destination[pixel] = example_lcd_panel_color_from_rgb565(destination[pixel]);
    }
    return ESP_OK;
}

esp_err_t openpencil_content_write(const uint8_t *data, size_t length)
{
    if (!content_partition || !data || length < sizeof(openpencil_content_header_t)) {
        return ESP_ERR_INVALID_ARG;
    }
    const openpencil_content_header_t *header = (const openpencil_content_header_t *)data;
    const uint8_t *payload = data + sizeof(*header);
    openpencil_prototype_content_header_t prototype = {0};
    if (header->mode == OPENPENCIL_CONTENT_MODE_PROTOTYPE &&
        header->payload_bytes >= sizeof(prototype)) {
        memcpy(&prototype, payload, sizeof(prototype));
    }
    if (!layout_matches(header, &prototype) || length != sizeof(*header) + header->payload_bytes ||
        validate_transitions(header, &prototype, payload) != ESP_OK) {
        return ESP_ERR_INVALID_SIZE;
    }
    if (esp_crc32_le(0, payload, header->payload_bytes) != header->payload_crc32) {
        return ESP_ERR_INVALID_CRC;
    }

    const size_t erase_size = (length + 0xFFFu) & ~0xFFFu;
    if (erase_size > content_partition->size) return ESP_ERR_INVALID_SIZE;
    ESP_RETURN_ON_ERROR(esp_partition_erase_range(content_partition, 0, erase_size), TAG,
                        "erase content partition failed");
    ESP_RETURN_ON_ERROR(esp_partition_write(content_partition, sizeof(*header), payload,
                                            header->payload_bytes), TAG,
                        "write content payload failed");
    ESP_RETURN_ON_ERROR(esp_partition_write(content_partition, 0, header, sizeof(*header)), TAG,
                        "write content header failed");
    active_header = *header;
    active_prototype = prototype;
    content_valid = true;
    return ESP_OK;
}