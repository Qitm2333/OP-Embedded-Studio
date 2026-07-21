#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include "esp_err.h"

#define OPENPENCIL_CONTENT_MAGIC 0x4F504331u
#define OPENPENCIL_CONTENT_VERSION 1u
#define OPENPENCIL_CONTENT_MODE_FRAME 0u
#define OPENPENCIL_CONTENT_MODE_PROTOTYPE 1u
#define OPENPENCIL_CONTENT_FIRMWARE_MODE_UNIFIED 2u
#define OPENPENCIL_CONTENT_MAX_PROTOTYPE_STATES 10u

// The outer envelope remains shared by Wi-Fi and BLE. Mode-specific metadata
// lives at the start of the payload so transports never need separate packet protocols.
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

typedef struct __attribute__((packed)) {
    uint16_t initial_state;
    uint16_t transition_count;
    uint32_t frame_bytes;
} openpencil_prototype_content_header_t;

typedef struct __attribute__((packed)) {
    uint8_t from_state;
    uint8_t event;
    uint8_t to_state;
    uint8_t reserved;
} openpencil_content_transition_t;

esp_err_t openpencil_content_init(void);
uint8_t openpencil_content_firmware_mode(void);
bool openpencil_content_is_valid(void);
bool openpencil_content_is_prototype(void);
const openpencil_content_header_t *openpencil_content_header(void);
uint16_t openpencil_content_initial_state(void);
esp_err_t openpencil_content_transition_target(uint16_t state, uint8_t event, uint16_t *target);
bool openpencil_content_state_uses_multi_click(uint16_t state);
esp_err_t openpencil_content_load_frame(uint16_t frame_index, uint16_t *destination, size_t pixels);
esp_err_t openpencil_content_write(const uint8_t *data, size_t length);