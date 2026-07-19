#pragma once

#include <stddef.h>
#include <stdint.h>
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

esp_err_t openpencil_frame_store_load(uint8_t frame_index,
                                      uint16_t *destination,
                                      size_t destination_pixels);

#ifdef __cplusplus
}
#endif
