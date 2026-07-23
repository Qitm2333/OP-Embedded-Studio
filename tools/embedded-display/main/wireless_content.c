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
static openpencil_sequence_content_header_t active_sequence;
static uint8_t sequence_decode_chunk[16384];
static bool content_valid;

static void fill_rgb565(uint16_t *destination, size_t pixels, uint16_t color)
{
    if (((uintptr_t)destination & (sizeof(uint32_t) - 1)) != 0 && pixels > 0) {
        *destination++ = color;
        pixels--;
    }

    const uint32_t pair = (uint32_t)color | ((uint32_t)color << 16);
    uint32_t *destination32 = (uint32_t *)destination;
    while (pixels >= 8) {
        destination32[0] = pair;
        destination32[1] = pair;
        destination32[2] = pair;
        destination32[3] = pair;
        destination32 += 4;
        pixels -= 8;
    }
    while (pixels >= 2) {
        *destination32++ = pair;
        pixels -= 2;
    }
    if (pixels > 0) {
        *(uint16_t *)destination32 = color;
    }
}

static esp_err_t decode_rle_chunk(const uint8_t *encoded,
                                  size_t encoded_bytes,
                                  uint16_t *destination,
                                  size_t frame_pixels,
                                  size_t *written_pixels)
{
    for (size_t offset = 0; offset < encoded_bytes; offset += 4) {
        const uint16_t run =
            (uint16_t)encoded[offset] | ((uint16_t)encoded[offset + 1] << 8);
        const uint16_t color =
            (uint16_t)encoded[offset + 2] | ((uint16_t)encoded[offset + 3] << 8);
        if (run == 0 || run > frame_pixels - *written_pixels) {
            return ESP_ERR_INVALID_SIZE;
        }
        fill_rgb565(destination + *written_pixels,
                    run,
                    example_lcd_panel_color_from_rgb565(color));
        *written_pixels += run;
    }
    return ESP_OK;
}

uint8_t openpencil_content_firmware_mode(void)
{
#if CONFIG_OPENPENCIL_BLE_SERVER || CONFIG_OPENPENCIL_EXTERNAL_PROTOTYPE
    return OPENPENCIL_CONTENT_FIRMWARE_MODE_UNIFIED;
#else
    return OPENPENCIL_CONTENT_MODE_FRAME;
#endif
}

static bool content_mode_supported(uint8_t mode)
{
    bool supported = mode == OPENPENCIL_CONTENT_MODE_FRAME;
#if CONFIG_OPENPENCIL_BLE_SERVER || CONFIG_OPENPENCIL_EXTERNAL_PROTOTYPE
    supported = supported || mode == OPENPENCIL_CONTENT_MODE_PROTOTYPE;
#endif
#if CONFIG_OPENPENCIL_USB_SEQUENCE
    supported = supported || mode == OPENPENCIL_CONTENT_MODE_SEQUENCE;
#endif
    return supported;
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
                           const openpencil_prototype_content_header_t *prototype,
                           const openpencil_sequence_content_header_t *sequence)
{
    if (!common_header_matches(header)) return false;
    const size_t frame_bytes = (size_t)header->width * header->height * sizeof(uint16_t);
    if (header->mode == OPENPENCIL_CONTENT_MODE_FRAME) {
        return header->frame_count == 1 && header->payload_bytes == frame_bytes;
    }
#if CONFIG_OPENPENCIL_USB_SEQUENCE
    if (header->mode == OPENPENCIL_CONTENT_MODE_SEQUENCE) {
        const size_t resources_bytes =
            (size_t)header->frame_count * sizeof(openpencil_sequence_resource_t);
        return sequence && header->frame_count > 1 && sequence->frame_bytes == frame_bytes &&
               sequence->frame_delay_ms > 0 &&
               sequence->resource_count == header->frame_count && sequence->data_bytes > 0 &&
               header->payload_bytes == sizeof(*sequence) + resources_bytes + sequence->data_bytes;
    }
#endif
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

static esp_err_t validate_sequence_resources(
    const openpencil_content_header_t *header,
    const openpencil_sequence_content_header_t *sequence,
    const uint8_t *payload)
{
    if (header->mode != OPENPENCIL_CONTENT_MODE_SEQUENCE) return ESP_OK;
    const size_t frame_bytes = (size_t)header->width * header->height * sizeof(uint16_t);
    size_t expected_offset = 0;
    for (uint16_t index = 0; index < sequence->resource_count; index++) {
        openpencil_sequence_resource_t resource;
        if (payload) {
            memcpy(&resource,
                   payload + sizeof(*sequence) + (size_t)index * sizeof(resource),
                   sizeof(resource));
        } else {
            ESP_RETURN_ON_ERROR(
                esp_partition_read(content_partition,
                                   sizeof(*header) + sizeof(*sequence) +
                                       (size_t)index * sizeof(resource),
                                   &resource,
                                   sizeof(resource)),
                TAG,
                "read sequence resource failed");
        }
        if (resource.offset != expected_offset || resource.offset > sequence->data_bytes ||
            resource.stored_bytes == 0 ||
            resource.stored_bytes > sequence->data_bytes - resource.offset) {
            return ESP_ERR_INVALID_SIZE;
        }
        if (resource.codec == OPENPENCIL_SEQUENCE_CODEC_RAW_RGB565) {
            if (resource.stored_bytes != frame_bytes) return ESP_ERR_INVALID_SIZE;
        } else if (resource.codec == OPENPENCIL_SEQUENCE_CODEC_RLE16) {
            if (resource.stored_bytes % 4 != 0) return ESP_ERR_INVALID_SIZE;
        } else if (resource.codec == OPENPENCIL_SEQUENCE_CODEC_PATCH_RGB565) {
            if (resource.stored_bytes <= sizeof(openpencil_sequence_patch_header_t)) {
                return ESP_ERR_INVALID_SIZE;
            }
        } else {
            return ESP_ERR_NOT_SUPPORTED;
        }
        expected_offset += resource.stored_bytes;
    }
    return expected_offset == sequence->data_bytes ? ESP_OK : ESP_ERR_INVALID_SIZE;
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
    openpencil_sequence_content_header_t sequence = {0};
    if (header.mode == OPENPENCIL_CONTENT_MODE_PROTOTYPE) {
        ESP_RETURN_ON_ERROR(esp_partition_read(content_partition, sizeof(header), &prototype,
                                               sizeof(prototype)),
                            TAG,
                            "read prototype header failed");
    } else if (header.mode == OPENPENCIL_CONTENT_MODE_SEQUENCE) {
        ESP_RETURN_ON_ERROR(esp_partition_read(content_partition, sizeof(header), &sequence,
                                               sizeof(sequence)),
                            TAG,
                            "read sequence header failed");
    }
    if (!layout_matches(&header, &prototype, &sequence)) {
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
    size_t chunks_since_yield = 0;
    while (remaining > 0) {
        size_t length = remaining > chunk_capacity ? chunk_capacity : remaining;
        ESP_RETURN_ON_ERROR(esp_partition_read(content_partition, offset, chunk, length), TAG,
                            "read content payload failed");
        crc = esp_crc32_le(crc, chunk, length);
        offset += length;
        remaining -= length;
        chunks_since_yield += 1;
        if (header.mode != OPENPENCIL_CONTENT_MODE_SEQUENCE || chunks_since_yield >= 64) {
            vTaskDelay(pdMS_TO_TICKS(1));
            chunks_since_yield = 0;
        }
    }
    free(chunk);
    if (crc != header.payload_crc32 ||
        validate_transitions(&header, &prototype, NULL) != ESP_OK ||
        validate_sequence_resources(&header, &sequence, NULL) != ESP_OK) {
        ESP_LOGW(TAG, "wireless content validation failed; using generated image");
        content_valid = false;
        return ESP_OK;
    }

    active_header = header;
    active_prototype = prototype;
    active_sequence = sequence;
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

bool openpencil_content_is_sequence(void)
{
    return content_valid && active_header.mode == OPENPENCIL_CONTENT_MODE_SEQUENCE;
}

uint16_t openpencil_content_frame_delay_ms(void)
{
    return openpencil_content_is_sequence() ? active_sequence.frame_delay_ms : 0;
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

static esp_err_t read_sequence_resource(uint16_t frame_index,
                                        openpencil_sequence_resource_t *resource,
                                        size_t *data_offset)
{
    ESP_RETURN_ON_FALSE(openpencil_content_is_sequence() && resource && data_offset &&
                            frame_index < active_header.frame_count,
                        ESP_ERR_INVALID_ARG,
                        TAG,
                        "invalid sequence resource request");
    const size_t resource_offset =
        sizeof(active_header) + sizeof(active_sequence) +
        (size_t)frame_index * sizeof(*resource);
    ESP_RETURN_ON_ERROR(esp_partition_read(content_partition,
                                           resource_offset,
                                           resource,
                                           sizeof(*resource)),
                        TAG,
                        "read sequence resource failed");
    *data_offset = sizeof(active_header) + sizeof(active_sequence) +
                   (size_t)active_sequence.resource_count * sizeof(*resource) +
                   resource->offset;
    return ESP_OK;
}

esp_err_t openpencil_content_sequence_region(uint16_t frame_index,
                                             openpencil_sequence_region_t *region)
{
    ESP_RETURN_ON_FALSE(region, ESP_ERR_INVALID_ARG, TAG, "sequence region is required");
    openpencil_sequence_resource_t resource;
    size_t data_offset = 0;
    ESP_RETURN_ON_ERROR(read_sequence_resource(frame_index, &resource, &data_offset),
                        TAG,
                        "read sequence region resource failed");
    if (resource.codec != OPENPENCIL_SEQUENCE_CODEC_PATCH_RGB565) {
        *region = (openpencil_sequence_region_t){
            .x = 0,
            .y = 0,
            .width = active_header.width,
            .height = active_header.height,
        };
        return ESP_OK;
    }

    openpencil_sequence_patch_header_t patch;
    ESP_RETURN_ON_ERROR(esp_partition_read(content_partition,
                                           data_offset,
                                           &patch,
                                           sizeof(patch)),
                        TAG,
                        "read sequence patch header failed");
    ESP_RETURN_ON_FALSE(patch.width > 0 && patch.height > 0 &&
                            patch.x + patch.width <= active_header.width &&
                            patch.y + patch.height <= active_header.height &&
                            (patch.codec == OPENPENCIL_SEQUENCE_CODEC_RAW_RGB565 ||
                             patch.codec == OPENPENCIL_SEQUENCE_CODEC_RLE16),
                        ESP_ERR_INVALID_SIZE,
                        TAG,
                        "invalid sequence patch geometry");
    *region = (openpencil_sequence_region_t){
        .x = patch.x,
        .y = patch.y,
        .width = patch.width,
        .height = patch.height,
    };
    return ESP_OK;
}

esp_err_t openpencil_content_load_frame(uint16_t frame_index, uint16_t *destination, size_t pixels)
{
    if (!content_valid || !destination || frame_index >= active_header.frame_count) {
        return ESP_ERR_INVALID_STATE;
    }
    const size_t frame_bytes = (size_t)active_header.width * active_header.height * sizeof(uint16_t);
    const size_t frame_pixels = frame_bytes / sizeof(uint16_t);
    if (pixels < frame_pixels) return ESP_ERR_INVALID_SIZE;

    if (active_header.mode == OPENPENCIL_CONTENT_MODE_SEQUENCE) {
        openpencil_sequence_resource_t resource;
        size_t data_offset = 0;
        ESP_RETURN_ON_ERROR(read_sequence_resource(frame_index, &resource, &data_offset),
                            TAG,
                            "read sequence frame resource failed");
        size_t stored_bytes = resource.stored_bytes;
        uint8_t codec = resource.codec;
        size_t output_pixels = frame_pixels;

        if (codec == OPENPENCIL_SEQUENCE_CODEC_PATCH_RGB565) {
            openpencil_sequence_patch_header_t patch;
            ESP_RETURN_ON_ERROR(esp_partition_read(content_partition,
                                                   data_offset,
                                                   &patch,
                                                   sizeof(patch)),
                                TAG,
                                "read sequence patch header failed");
            output_pixels = (size_t)patch.width * patch.height;
            ESP_RETURN_ON_FALSE(output_pixels <= pixels,
                                ESP_ERR_INVALID_SIZE,
                                TAG,
                                "sequence patch buffer is too small");
            codec = patch.codec;
            data_offset += sizeof(patch);
            stored_bytes -= sizeof(patch);
        }

        if (codec == OPENPENCIL_SEQUENCE_CODEC_RAW_RGB565) {
            const size_t output_bytes = output_pixels * sizeof(uint16_t);
            ESP_RETURN_ON_FALSE(stored_bytes == output_bytes,
                                ESP_ERR_INVALID_SIZE,
                                TAG,
                                "raw sequence frame size mismatch");
            ESP_RETURN_ON_ERROR(
                esp_partition_read(content_partition, data_offset, destination, output_bytes),
                TAG,
                "read raw sequence frame failed");
            for (size_t pixel = 0; pixel < output_pixels; pixel++) {
                destination[pixel] = example_lcd_panel_color_from_rgb565(destination[pixel]);
            }
            return ESP_OK;
        }
        if (codec != OPENPENCIL_SEQUENCE_CODEC_RLE16 || stored_bytes % 4 != 0) {
            return ESP_ERR_NOT_SUPPORTED;
        }

        size_t written_pixels = 0;
        const size_t physical_end =
            (size_t)content_partition->address + data_offset + stored_bytes;
        if (physical_end <= 0x1000000) {
            const void *mapped_data = NULL;
            esp_partition_mmap_handle_t mmap_handle = 0;
            ESP_RETURN_ON_ERROR(esp_partition_mmap(content_partition,
                                                   data_offset,
                                                   stored_bytes,
                                                   ESP_PARTITION_MMAP_DATA,
                                                   &mapped_data,
                                                   &mmap_handle),
                                TAG,
                                "map RLE sequence frame failed");
            const esp_err_t result = decode_rle_chunk(mapped_data,
                                                      stored_bytes,
                                                      destination,
                                                      output_pixels,
                                                      &written_pixels);
            esp_partition_munmap(mmap_handle);
            if (result != ESP_OK) return result;
        } else {
            size_t stored_offset = 0;
            while (stored_offset < stored_bytes) {
                const size_t remaining = stored_bytes - stored_offset;
                const size_t chunk_bytes = remaining < sizeof(sequence_decode_chunk)
                                               ? remaining
                                               : sizeof(sequence_decode_chunk);
                ESP_RETURN_ON_ERROR(esp_partition_read(content_partition,
                                                       data_offset + stored_offset,
                                                       sequence_decode_chunk,
                                                       chunk_bytes),
                                    TAG,
                                    "read high-address RLE sequence frame failed");
                ESP_RETURN_ON_ERROR(decode_rle_chunk(sequence_decode_chunk,
                                                     chunk_bytes,
                                                     destination,
                                                     output_pixels,
                                                     &written_pixels),
                                    TAG,
                                    "decode high-address RLE sequence frame failed");
                stored_offset += chunk_bytes;
            }
        }
        return written_pixels == output_pixels ? ESP_OK : ESP_ERR_INVALID_SIZE;
    }

    size_t frame_offset = sizeof(active_header);
    if (active_header.mode == OPENPENCIL_CONTENT_MODE_PROTOTYPE) {
        frame_offset += sizeof(active_prototype) +
                        (size_t)active_prototype.transition_count * sizeof(openpencil_content_transition_t);
    }
    frame_offset += (size_t)frame_index * frame_bytes;
    ESP_RETURN_ON_ERROR(esp_partition_read(content_partition, frame_offset, destination, frame_bytes),
                        TAG,
                        "read content frame failed");

    for (size_t pixel = 0; pixel < frame_pixels; pixel++) {
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
    openpencil_sequence_content_header_t sequence = {0};
    if (header->mode == OPENPENCIL_CONTENT_MODE_PROTOTYPE &&
        header->payload_bytes >= sizeof(prototype)) {
        memcpy(&prototype, payload, sizeof(prototype));
    } else if (header->mode == OPENPENCIL_CONTENT_MODE_SEQUENCE &&
               header->payload_bytes >= sizeof(sequence)) {
        memcpy(&sequence, payload, sizeof(sequence));
    }
    if (!layout_matches(header, &prototype, &sequence) ||
        length != sizeof(*header) + header->payload_bytes ||
        validate_transitions(header, &prototype, payload) != ESP_OK ||
        validate_sequence_resources(header, &sequence, payload) != ESP_OK) {
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
    active_sequence = sequence;
    content_valid = true;
    return ESP_OK;
}
