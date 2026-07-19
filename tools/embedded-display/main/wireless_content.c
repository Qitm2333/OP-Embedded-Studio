#include "wireless_content.h"

#include <string.h>
#include "sdkconfig.h"
#include "esp_check.h"
#include "esp_crc.h"
#include "esp_log.h"
#include "esp_partition.h"

static const char *TAG = "wireless_content";
static const esp_partition_t *content_partition;
static openpencil_content_header_t active_header;
static bool content_valid;

static bool header_matches(const openpencil_content_header_t *header)
{
    if (!content_partition || !header) return false;
    const size_t expected_payload = (size_t)CONFIG_EXAMPLE_LCD_H_RES *
                                    CONFIG_EXAMPLE_LCD_V_RES * sizeof(uint16_t);
    return header->magic == OPENPENCIL_CONTENT_MAGIC &&
           header->version == OPENPENCIL_CONTENT_VERSION &&
           header->mode == OPENPENCIL_CONTENT_MODE_FRAME &&
           header->frame_count == 1 && header->payload_bytes > 0 &&
           header->width == CONFIG_EXAMPLE_LCD_H_RES &&
           header->height == CONFIG_EXAMPLE_LCD_V_RES &&
           header->payload_bytes == expected_payload &&
           header->payload_bytes <= content_partition->size - sizeof(*header);
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
    if (!header_matches(&header)) {
        ESP_LOGI(TAG, "no valid wireless content; using generated image");
        content_valid = false;
        return ESP_OK;
    }

    uint8_t chunk[4096];
    uint32_t crc = 0;
    size_t remaining = header.payload_bytes;
    size_t offset = sizeof(header);
    while (remaining > 0) {
        size_t length = remaining > sizeof(chunk) ? sizeof(chunk) : remaining;
        ESP_RETURN_ON_ERROR(esp_partition_read(content_partition, offset, chunk, length), TAG,
                            "read content payload failed");
        crc = esp_crc32_le(crc, chunk, length);
        offset += length;
        remaining -= length;
    }
    if (crc != header.payload_crc32) {
        ESP_LOGW(TAG, "wireless content CRC mismatch; using generated image");
        content_valid = false;
        return ESP_OK;
    }

    active_header = header;
    content_valid = true;
    ESP_LOGI(TAG, "wireless image ready: %ux%u, %u bytes", header.width, header.height,
             (unsigned)header.payload_bytes);
    return ESP_OK;
}

bool openpencil_content_is_valid(void)
{
    return content_valid;
}

const openpencil_content_header_t *openpencil_content_header(void)
{
    return content_valid ? &active_header : NULL;
}

esp_err_t openpencil_content_load_frame(uint16_t frame_index, uint16_t *destination, size_t pixels)
{
    if (!content_valid || frame_index != 0 || !destination) return ESP_ERR_INVALID_STATE;
    const size_t expected = (size_t)active_header.width * active_header.height * sizeof(uint16_t);
    if (pixels * sizeof(uint16_t) < expected || active_header.payload_bytes < expected) {
        return ESP_ERR_INVALID_SIZE;
    }
    return esp_partition_read(content_partition, sizeof(active_header), destination, expected);
}

esp_err_t openpencil_content_write(const uint8_t *data, size_t length)
{
    if (!content_partition || !data || length < sizeof(openpencil_content_header_t)) {
        return ESP_ERR_INVALID_ARG;
    }
    const openpencil_content_header_t *header = (const openpencil_content_header_t *)data;
    if (!header_matches(header) || length != sizeof(*header) + header->payload_bytes) {
        return ESP_ERR_INVALID_SIZE;
    }
    const uint8_t *payload = data + sizeof(*header);
    if (esp_crc32_le(0, payload, header->payload_bytes) != header->payload_crc32) {
        return ESP_ERR_INVALID_CRC;
    }

    const size_t erase_size = (length + 0xFFFu) & ~0xFFFu;
    if (erase_size > content_partition->size) return ESP_ERR_INVALID_SIZE;

    // Commit the payload before the header. A power loss during the transfer
    // therefore leaves the previous committed header or an invalid image,
    // rather than advertising a partially written payload after reboot.
    ESP_RETURN_ON_ERROR(esp_partition_erase_range(content_partition, 0, erase_size), TAG,
                        "erase content partition failed");
    ESP_RETURN_ON_ERROR(esp_partition_write(content_partition, sizeof(*header), payload,
                                            header->payload_bytes), TAG,
                        "write content payload failed");
    ESP_RETURN_ON_ERROR(esp_partition_write(content_partition, 0, header, sizeof(*header)), TAG,
                        "write content header failed");
    active_header = *header;
    content_valid = true;
    return ESP_OK;
}
