#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include "esp_err.h"

typedef struct {
    bool connected;
    bool paired;
    bool receiving;
    bool completed;
    bool failed;
    size_t received_bytes;
    size_t total_bytes;
} openpencil_ble_status_t;

esp_err_t openpencil_ble_server_start(void);
void openpencil_ble_server_get_status(openpencil_ble_status_t *status);
