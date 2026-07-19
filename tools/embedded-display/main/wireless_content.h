#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include "esp_err.h"

#define OPENPENCIL_CONTENT_MAGIC 0x4F504331u
#define OPENPENCIL_CONTENT_VERSION 1u
#define OPENPENCIL_CONTENT_MODE_FRAME 0u

typedef struct __attribute__((packed)) {
    uint32_t magic;
    uint16_t version;
    uint8_t mode;
    uint8_t reserved;
    uint16_t width;
    uint16_t height;
    uint16_t frame_count;
    uint16_t reserved2;
    uint32_t payload_bytes;
    uint32_t payload_crc32;
} openpencil_content_header_t;

esp_err_t openpencil_content_init(void);
bool openpencil_content_is_valid(void);
const openpencil_content_header_t *openpencil_content_header(void);
esp_err_t openpencil_content_load_frame(uint16_t frame_index, uint16_t *destination, size_t pixels);
esp_err_t openpencil_content_write(const uint8_t *data, size_t length);