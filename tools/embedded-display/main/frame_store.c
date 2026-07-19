#include "frame_store.h"

#include <string.h>
#include "esp_check.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "generated_image.h"
#include "lcd_panel_factory.h"
#include "wireless_content.h"

static const char *TAG = "frame_store";

#if defined(LCD_GENERATED_IMAGE_STORAGE_VERSION)
static esp_err_t decode_rle16(const lcd_frame_resource_t *resource,
                              uint16_t *destination,
                              size_t destination_pixels)
{
    const uint8_t *source = lcd_generated_image_data + resource->offset;
    const uint8_t *source_end = source + resource->stored_bytes;
    size_t output_pixels = 0;

    while (source < source_end) {
        ESP_RETURN_ON_FALSE(source_end - source >= 4, ESP_ERR_INVALID_SIZE, TAG, "truncated RLE16 run");
        const uint16_t count = source[0] | ((uint16_t)source[1] << 8);
        const uint16_t value = source[2] | ((uint16_t)source[3] << 8);
        source += 4;

        ESP_RETURN_ON_FALSE(count > 0, ESP_ERR_INVALID_SIZE, TAG, "zero-length RLE16 run");
        ESP_RETURN_ON_FALSE(output_pixels + count <= destination_pixels,
                            ESP_ERR_INVALID_SIZE,
                            TAG,
                            "RLE16 output exceeds frame buffer");
        for (uint16_t pixel = 0; pixel < count; pixel++) {
            destination[output_pixels++] = value;
        }
    }

    ESP_RETURN_ON_FALSE(output_pixels == resource->pixel_count,
                        ESP_ERR_INVALID_SIZE,
                        TAG,
                        "RLE16 pixel count mismatch");
    return ESP_OK;
}
#endif

esp_err_t openpencil_frame_store_load(uint8_t frame_index,
                                      uint16_t *destination,
                                      size_t destination_pixels)
{
    ESP_RETURN_ON_FALSE(destination, ESP_ERR_INVALID_ARG, TAG, "destination is NULL");
#if LCD_GENERATED_IMAGE_FRAME_COUNT == 0
    return ESP_ERR_NOT_FOUND;
#else
    ESP_RETURN_ON_FALSE(frame_index < LCD_GENERATED_IMAGE_FRAME_COUNT,
                        ESP_ERR_INVALID_ARG,
                        TAG,
                        "frame index is out of range");
#endif

    const int64_t started_us = esp_timer_get_time();

#if LCD_GENERATED_IMAGE_FRAME_COUNT == 0
    const openpencil_content_header_t *wireless = openpencil_content_header();
    if (wireless && wireless->width == CONFIG_EXAMPLE_LCD_H_RES &&
        wireless->height == CONFIG_EXAMPLE_LCD_V_RES && wireless->frame_count == 1) {
        return openpencil_content_load_frame(frame_index, destination, destination_pixels);
    }
#endif

#if defined(LCD_GENERATED_IMAGE_STORAGE_VERSION)
    const lcd_frame_resource_t *resource = &lcd_generated_image_frames[frame_index];
    ESP_RETURN_ON_FALSE(resource->pixel_count == destination_pixels,
                        ESP_ERR_INVALID_SIZE,
                        TAG,
                        "frame geometry mismatch");
    ESP_RETURN_ON_FALSE(resource->offset + resource->stored_bytes <= LCD_GENERATED_IMAGE_STORED_BYTES,
                        ESP_ERR_INVALID_SIZE,
                        TAG,
                        "frame resource exceeds generated storage");

    esp_err_t ret = ESP_OK;
    if (resource->codec == LCD_FRAME_CODEC_RAW_RGB565) {
        ESP_RETURN_ON_FALSE(resource->stored_bytes == destination_pixels * sizeof(uint16_t),
                            ESP_ERR_INVALID_SIZE,
                            TAG,
                            "raw frame size mismatch");
        memcpy(destination, lcd_generated_image_data + resource->offset, resource->stored_bytes);
    } else if (resource->codec == LCD_FRAME_CODEC_RLE16) {
        ret = decode_rle16(resource, destination, destination_pixels);
    } else {
        return ESP_ERR_NOT_SUPPORTED;
    }
    ESP_RETURN_ON_ERROR(ret, TAG, "decode frame failed");

    ESP_LOGI(TAG,
             "Frame %u loaded: codec=%u, stored=%u bytes, decode=%lld us",
             frame_index,
             resource->codec,
             (unsigned)resource->stored_bytes,
             (long long)(esp_timer_get_time() - started_us));
#else
    const size_t offset = (size_t)frame_index * destination_pixels;
    for (size_t pixel = 0; pixel < destination_pixels; pixel++) {
        destination[pixel] = example_lcd_panel_color_from_rgb565(lcd_generated_image_rgb565[offset + pixel]);
    }
    ESP_LOGI(TAG,
             "Frame %u loaded from legacy RGB565 storage in %lld us",
             frame_index,
             (long long)(esp_timer_get_time() - started_us));
#endif

    return ESP_OK;
}
