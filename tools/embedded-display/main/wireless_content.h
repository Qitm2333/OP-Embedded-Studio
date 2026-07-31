#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include "esp_err.h"

#define OPENPENCIL_CONTENT_MAGIC 0x4F504331u
#define OPENPENCIL_CONTENT_VERSION 1u
#define OPENPENCIL_CONTENT_MODE_FRAME 0u
#define OPENPENCIL_CONTENT_MODE_PROTOTYPE 1u
#define OPENPENCIL_CONTENT_MODE_SEQUENCE 2u
#define OPENPENCIL_CONTENT_FIRMWARE_MODE_UNIFIED 2u
#define OPENPENCIL_CONTENT_MAX_PROTOTYPE_STATES 10u
#define OPENPENCIL_SEQUENCE_CODEC_RAW_RGB565 0u
#define OPENPENCIL_SEQUENCE_CODEC_RLE16 1u
#define OPENPENCIL_SEQUENCE_CODEC_PATCH_RGB565 2u

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
    uint32_t frame_bytes;
    uint16_t frame_delay_ms;
    uint16_t resource_count;
    uint32_t data_bytes;
} openpencil_sequence_content_header_t;

typedef struct __attribute__((packed)) {
    uint32_t offset;
    uint32_t stored_bytes;
    uint8_t codec;
    uint8_t reserved[3];
} openpencil_sequence_resource_t;

typedef struct __attribute__((packed)) {
    uint16_t x;
    uint16_t y;
    uint16_t width;
    uint16_t height;
    uint8_t codec;
    uint8_t reserved[3];
} openpencil_sequence_patch_header_t;

typedef struct {
    uint16_t x;
    uint16_t y;
    uint16_t width;
    uint16_t height;
} openpencil_sequence_region_t;

typedef struct __attribute__((packed)) {
    uint8_t from_state;
    uint8_t event;
    uint8_t to_state;
    uint8_t reserved;
} openpencil_content_transition_t;

esp_err_t openpencil_content_init(void);
uint8_t openpencil_content_firmware_mode(void);
bool openpencil_content_write_in_progress(void);
bool openpencil_content_is_valid(void);
bool openpencil_content_is_prototype(void);
bool openpencil_content_is_sequence(void);
uint16_t openpencil_content_frame_delay_ms(void);
const openpencil_content_header_t *openpencil_content_header(void);
uint16_t openpencil_content_initial_state(void);
esp_err_t openpencil_content_transition_target(uint16_t state, uint8_t event, uint16_t *target);
bool openpencil_content_state_uses_multi_click(uint16_t state);
esp_err_t openpencil_content_sequence_region(uint16_t frame_index,
                                             openpencil_sequence_region_t *region);
esp_err_t openpencil_content_load_frame(uint16_t frame_index, uint16_t *destination, size_t pixels);
esp_err_t openpencil_content_reconstruct_sequence_frame(uint16_t frame_index,
                                                        const uint16_t *previous_frame,
                                                        uint16_t *destination,
                                                        size_t pixels);
size_t openpencil_content_capacity(void);
esp_err_t openpencil_content_write_begin(const openpencil_content_header_t *header, size_t length);
esp_err_t openpencil_content_write_chunk(size_t payload_offset, const uint8_t *data, size_t length);
esp_err_t openpencil_content_write_finish(void);
void openpencil_content_write_abort(void);
esp_err_t openpencil_content_write(const uint8_t *data, size_t length);
