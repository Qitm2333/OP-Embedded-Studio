#pragma once

#include <stdbool.h>
#include "esp_err.h"

typedef struct {
    bool station_configured;
    bool station_connected;
    char ssid[33];
    char password[65];
    char ip[16];
    char ap_ip[16];
} openpencil_wireless_status_t;

esp_err_t openpencil_wireless_server_start(void);
void openpencil_wireless_server_get_status(openpencil_wireless_status_t *status);
