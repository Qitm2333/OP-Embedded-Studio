#pragma once

#include <stdint.h>
#include "sdkconfig.h"

typedef enum {
    LCD_FRAME_CODEC_RAW_RGB565 = 0,
    LCD_FRAME_CODEC_RLE16 = 1,
} lcd_frame_codec_t;

typedef struct {
    uint32_t offset;
    uint32_t stored_bytes;
    uint32_t pixel_count;
    uint8_t codec;
} lcd_frame_resource_t;

#if !CONFIG_OPENPENCIL_EXTERNAL_CONTENT_ONLY && __has_include("generated_image_user.h")
#include "generated_image_user.h"
#else
#define LCD_GENERATED_IMAGE_NAME "none"
#define LCD_GENERATED_IMAGE_WIDTH 0
#define LCD_GENERATED_IMAGE_HEIGHT 0
#define LCD_GENERATED_IMAGE_FRAME_COUNT 0
#define LCD_GENERATED_IMAGE_FRAME_DELAY_MS 1000
#define LCD_GENERATED_IMAGE_PIXEL_COUNT 0
static const uint16_t lcd_generated_image_rgb565[1] = {0};
#endif

#ifndef LCD_GENERATED_IMAGE_FRAME_COUNT
#define LCD_GENERATED_IMAGE_FRAME_COUNT 1
#endif

#ifndef LCD_GENERATED_IMAGE_FRAME_DELAY_MS
#define LCD_GENERATED_IMAGE_FRAME_DELAY_MS 1000
#endif
