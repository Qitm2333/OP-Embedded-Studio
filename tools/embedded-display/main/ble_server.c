#include "ble_server.h"

#include <string.h>
#include <stdlib.h>
#include "sdkconfig.h"
#include "esp_check.h"
#include "esp_heap_caps.h"
#include "esp_log.h"
#include "esp_system.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "host/ble_gap.h"
#include "host/ble_gatt.h"
#include "host/ble_hs.h"
#include "host/ble_store.h"
#include "nimble/nimble_port.h"
#include "nimble/nimble_port_freertos.h"
#include "os/os_mbuf.h"
#include "nvs_flash.h"
#include "services/gap/ble_svc_gap.h"
#include "services/gatt/ble_svc_gatt.h"
#include "wireless_content.h"

static const char *TAG = "ble_server";

#define OPENPENCIL_BLE_DEVICE_NAME "OpenPencil BLE"
#define OPENPENCIL_BLE_SERVICE_UUID \
    BLE_UUID128_DECLARE(0x7d, 0x12, 0x2b, 0x89, 0x91, 0x47, 0x4a, 0x8e, 0x9b, 0x55, 0x4d, 0x8f, 0x7d, 0x20, 0x10, 0xa1)
#define OPENPENCIL_BLE_TRANSFER_UUID \
    BLE_UUID128_DECLARE(0x7d, 0x12, 0x2b, 0x89, 0x91, 0x47, 0x4a, 0x8e, 0x9b, 0x55, 0x4d, 0x8f, 0x7d, 0x20, 0x10, 0xa2)
#define OPENPENCIL_BLE_STATUS_UUID \
    BLE_UUID128_DECLARE(0x7d, 0x12, 0x2b, 0x89, 0x91, 0x47, 0x4a, 0x8e, 0x9b, 0x55, 0x4d, 0x8f, 0x7d, 0x20, 0x10, 0xa3)

static const ble_uuid128_t openpencil_ble_service_uuid = BLE_UUID128_INIT(
    0x7d, 0x12, 0x2b, 0x89, 0x91, 0x47, 0x4a, 0x8e, 0x9b,
    0x55, 0x4d, 0x8f, 0x7d, 0x20, 0x10, 0xa1);


static openpencil_ble_status_t ble_status;
static uint16_t transfer_value_handle;
static uint16_t status_value_handle;
static uint16_t connection_handle = BLE_HS_CONN_HANDLE_NONE;
static uint8_t own_address_type;
static uint8_t *transfer_buffer;
static uint8_t transfer_header[sizeof(openpencil_content_header_t)];
static size_t transfer_header_received;
static size_t transfer_capacity;
static size_t transfer_received;
static portMUX_TYPE ble_status_lock = portMUX_INITIALIZER_UNLOCKED;

void ble_store_config_init(void);

static void ble_host_task(void *param);

static void content_reboot_task(void *param)
{
    (void)param;
    vTaskDelay(pdMS_TO_TICKS(1000));
    esp_restart();
}
static void advertise(void);
static void advertise_retry_task(void *param);
static int ble_gap_event(struct ble_gap_event *event, void *arg);

void openpencil_ble_server_get_status(openpencil_ble_status_t *status)
{
    if (!status) return;
    taskENTER_CRITICAL(&ble_status_lock);
    *status = ble_status;
    taskEXIT_CRITICAL(&ble_status_lock);
}

static void reset_transfer(bool failed)
{
    if (transfer_buffer) heap_caps_free(transfer_buffer);
    transfer_buffer = NULL;
    transfer_header_received = 0;
    transfer_capacity = 0;
    transfer_received = 0;
    taskENTER_CRITICAL(&ble_status_lock);
    ble_status.receiving = false;
    ble_status.failed = failed;
    ble_status.received_bytes = 0;
    ble_status.total_bytes = 0;
    taskEXIT_CRITICAL(&ble_status_lock);
}

static bool validate_header(const openpencil_content_header_t *header, size_t *total)
{
    if (!header || header->magic != OPENPENCIL_CONTENT_MAGIC ||
        header->version != OPENPENCIL_CONTENT_VERSION ||
        header->width != CONFIG_EXAMPLE_LCD_H_RES || header->height != CONFIG_EXAMPLE_LCD_V_RES ||
        header->payload_bytes == 0) {
        return false;
    }
    const size_t frame_bytes = (size_t)CONFIG_EXAMPLE_LCD_H_RES *
                               CONFIG_EXAMPLE_LCD_V_RES * sizeof(uint16_t);
    if (header->mode == OPENPENCIL_CONTENT_MODE_FRAME) {
        if (header->frame_count != 1 || header->payload_bytes != frame_bytes) return false;
    } else if (header->mode == OPENPENCIL_CONTENT_MODE_PROTOTYPE) {
        if (header->frame_count < 1 ||
            header->frame_count > OPENPENCIL_CONTENT_MAX_PROTOTYPE_STATES ||
            header->payload_bytes < sizeof(openpencil_prototype_content_header_t) +
                                        frame_bytes * header->frame_count) {
            return false;
        }
    } else {
        return false;
    }
    *total = sizeof(*header) + header->payload_bytes;
    return true;
}
static int receive_chunk(struct os_mbuf *om)
{
    const uint16_t length = OS_MBUF_PKTLEN(om);
    if (length <= sizeof(uint32_t) || length > 512) return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
    uint8_t chunk[512];
    uint16_t flattened = 0;
    if (ble_hs_mbuf_to_flat(om, chunk, sizeof(chunk), &flattened) != 0 || flattened != length) {
        return BLE_ATT_ERR_UNLIKELY;
    }

    uint32_t packet_offset = 0;
    memcpy(&packet_offset, chunk, sizeof(packet_offset));
    const uint8_t *packet_data = chunk + sizeof(packet_offset);
    const size_t packet_length = length - sizeof(packet_offset);
    const size_t confirmed_offset = transfer_buffer ? transfer_received : transfer_header_received;
    if (packet_offset != confirmed_offset) {
        // A status read can race with packets already queued by the browser.
        // Accept fully duplicated packets, but never append data after a gap.
        if (packet_offset < confirmed_offset && packet_offset + packet_length <= confirmed_offset) return 0;
        return BLE_ATT_ERR_INVALID_OFFSET;
    }

    size_t packet_data_offset = 0;
    if (!transfer_buffer) {
        const size_t header_remaining = sizeof(transfer_header) - transfer_header_received;
        const size_t header_bytes = packet_length < header_remaining ? packet_length : header_remaining;
        memcpy(transfer_header + transfer_header_received, packet_data, header_bytes);
        transfer_header_received += header_bytes;
        packet_data_offset += header_bytes;

        taskENTER_CRITICAL(&ble_status_lock);
        ble_status.receiving = true;
        ble_status.failed = false;
        ble_status.completed = false;
        ble_status.received_bytes = transfer_header_received;
        taskEXIT_CRITICAL(&ble_status_lock);

        if (transfer_header_received < sizeof(transfer_header)) return 0;

        const openpencil_content_header_t *header =
            (const openpencil_content_header_t *)transfer_header;
        if (!validate_header(header, &transfer_capacity) || transfer_capacity > 5 * 1024 * 1024) {
            reset_transfer(true);
            return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
        }
        transfer_buffer = heap_caps_malloc(transfer_capacity, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
        if (!transfer_buffer) transfer_buffer = malloc(transfer_capacity);
        if (!transfer_buffer) {
            reset_transfer(true);
            return BLE_ATT_ERR_INSUFFICIENT_RES;
        }
        memcpy(transfer_buffer, transfer_header, sizeof(transfer_header));
        transfer_received = sizeof(transfer_header);
        transfer_header_received = 0;
        taskENTER_CRITICAL(&ble_status_lock);
        ble_status.received_bytes = transfer_received;
        ble_status.total_bytes = transfer_capacity;
        taskEXIT_CRITICAL(&ble_status_lock);
    }

    const size_t payload_length = packet_length - packet_data_offset;
    if (transfer_received + payload_length > transfer_capacity) {
        reset_transfer(true);
        return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
    }
    if (payload_length > 0) {
        memcpy(transfer_buffer + transfer_received, packet_data + packet_data_offset, payload_length);
        transfer_received += payload_length;
    }
    taskENTER_CRITICAL(&ble_status_lock);
    ble_status.received_bytes = transfer_received;
    taskEXIT_CRITICAL(&ble_status_lock);

    if (transfer_received == transfer_capacity) {
        const esp_err_t result = openpencil_content_write(transfer_buffer, transfer_capacity);
        if (result != ESP_OK) {
            ESP_LOGE(TAG, "BLE content commit failed: %s", esp_err_to_name(result));
            reset_transfer(true);
            return BLE_ATT_ERR_UNLIKELY;
        }
        heap_caps_free(transfer_buffer);
        transfer_buffer = NULL;
        taskENTER_CRITICAL(&ble_status_lock);
        ble_status.receiving = false;
        ble_status.completed = true;
        ble_status.received_bytes = transfer_capacity;
        taskEXIT_CRITICAL(&ble_status_lock);
        ESP_LOGI(TAG, "BLE content received: %u bytes", (unsigned)transfer_capacity);
        xTaskCreate(content_reboot_task, "ble_content_reboot", 2048, NULL, 1, NULL);
    }
    return 0;
}

static int transfer_access(uint16_t conn_handle, uint16_t attr_handle,
                           struct ble_gatt_access_ctxt *ctxt, void *arg)
{
    (void)conn_handle;
    (void)attr_handle;
    (void)arg;
    if (ctxt->op != BLE_GATT_ACCESS_OP_WRITE_CHR) return BLE_ATT_ERR_UNLIKELY;
    return receive_chunk(ctxt->om);
}

static int status_access(uint16_t conn_handle, uint16_t attr_handle,
                         struct ble_gatt_access_ctxt *ctxt, void *arg)
{
    (void)conn_handle;
    (void)attr_handle;
    (void)arg;
    if (ctxt->op != BLE_GATT_ACCESS_OP_READ_CHR) return BLE_ATT_ERR_UNLIKELY;
    openpencil_ble_status_t status;
    openpencil_ble_server_get_status(&status);
    uint8_t payload[17] = {0};
    payload[0] = status.connected;
    payload[1] = status.paired;
    payload[2] = status.receiving;
    payload[3] = status.completed;
    payload[4] = status.failed;
    memcpy(payload + 5, &status.received_bytes, sizeof(uint32_t));
    memcpy(payload + 9, &status.total_bytes, sizeof(uint32_t));
    // Expose the base-firmware content mode so the browser can reject a
    // Frame/Prototype mismatch before sending a multi-megabyte payload.
    payload[13] = openpencil_content_firmware_mode();
    return os_mbuf_append(ctxt->om, payload, 14) == 0 ? 0 : BLE_ATT_ERR_INSUFFICIENT_RES;
}

static const struct ble_gatt_svc_def services[] = {
    {
        .type = BLE_GATT_SVC_TYPE_PRIMARY,
        .uuid = OPENPENCIL_BLE_SERVICE_UUID,
        .characteristics = (struct ble_gatt_chr_def[]) {
            {
                .uuid = OPENPENCIL_BLE_TRANSFER_UUID,
                .access_cb = transfer_access,
                .val_handle = &transfer_value_handle,
                .flags = BLE_GATT_CHR_F_WRITE | BLE_GATT_CHR_F_WRITE_NO_RSP
#if CONFIG_OPENPENCIL_BLE_REQUIRE_PAIRING
                         | BLE_GATT_CHR_F_WRITE_ENC
#endif
                ,
            },
            {
                .uuid = OPENPENCIL_BLE_STATUS_UUID,
                .access_cb = status_access,
                .val_handle = &status_value_handle,
                .flags = BLE_GATT_CHR_F_READ
#if CONFIG_OPENPENCIL_BLE_REQUIRE_PAIRING
                         | BLE_GATT_CHR_F_READ_ENC
#endif
                ,
            },
            {0}
        },
    },
    {0}
};

static void advertise(void)
{
    struct ble_hs_adv_fields fields = {0};
    fields.flags = BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP;
    fields.uuids128 = &openpencil_ble_service_uuid;
    fields.num_uuids128 = 1;
    fields.uuids128_is_complete = 1;
    fields.tx_pwr_lvl_is_present = 1;
    fields.tx_pwr_lvl = 0;
    fields.appearance_is_present = 1;
    fields.appearance = 0x0080;
    fields.le_role_is_present = 1;
    fields.le_role = 0x01;
    const int fields_result = ble_gap_adv_set_fields(&fields);
    if (fields_result != 0) {
        ESP_LOGE(TAG, "BLE advertisement fields failed: %d", fields_result);
        return;
    }

    struct ble_hs_adv_fields response_fields = {0};
    response_fields.name = (uint8_t *)OPENPENCIL_BLE_DEVICE_NAME;
    response_fields.name_len = strlen(OPENPENCIL_BLE_DEVICE_NAME);
    response_fields.name_is_complete = 1;
    const int response_result = ble_gap_adv_rsp_set_fields(&response_fields);
    if (response_result != 0) {
        ESP_LOGE(TAG, "BLE scan response fields failed: %d", response_result);
        return;
    }

    struct ble_gap_adv_params params = {0};
    params.conn_mode = BLE_GAP_CONN_MODE_UND;
    params.disc_mode = BLE_GAP_DISC_MODE_GEN;
    params.itvl_min = BLE_GAP_ADV_FAST_INTERVAL1_MIN;
    params.itvl_max = BLE_GAP_ADV_FAST_INTERVAL1_MAX;
    const int advertise_result = ble_gap_adv_start(own_address_type, NULL, BLE_HS_FOREVER, &params, ble_gap_event, NULL);
    if (advertise_result != 0) {
        ESP_LOGE(TAG, "BLE advertising start failed: %d", advertise_result);
    } else {
        ESP_LOGI(TAG, "BLE advertising as %s", OPENPENCIL_BLE_DEVICE_NAME);
    }
}

static void advertise_retry_task(void *param)
{
    (void)param;
    vTaskDelay(pdMS_TO_TICKS(250));
    advertise();
    vTaskDelete(NULL);
}

static int ble_gap_event(struct ble_gap_event *event, void *arg)
{
    (void)arg;
    switch (event->type) {
    case BLE_GAP_EVENT_CONNECT:
        if (event->connect.status == 0) {
            ESP_LOGI(TAG, "BLE client connected, handle=%u", event->connect.conn_handle);
            connection_handle = event->connect.conn_handle;
            taskENTER_CRITICAL(&ble_status_lock);
            ble_status.connected = true;
            ble_status.failed = false;
            ble_status.completed = false;
            taskEXIT_CRITICAL(&ble_status_lock);
        } else {
            ESP_LOGW(TAG, "BLE connection failed, status=%d", event->connect.status);
            advertise();
        }
        break;
    case BLE_GAP_EVENT_DISCONNECT:
        ESP_LOGW(TAG, "BLE client disconnected, reason=%d", event->disconnect.reason);
        connection_handle = BLE_HS_CONN_HANDLE_NONE;
        taskENTER_CRITICAL(&ble_status_lock);
        ble_status.connected = false;
        ble_status.paired = false;
        taskEXIT_CRITICAL(&ble_status_lock);
        if (xTaskCreate(advertise_retry_task, "ble_adv_retry", 3072, NULL, 5, NULL) != pdPASS) {
            advertise();
        }
        break;
    case BLE_GAP_EVENT_ENC_CHANGE:
        taskENTER_CRITICAL(&ble_status_lock);
        ble_status.paired = event->enc_change.status == 0;
        taskEXIT_CRITICAL(&ble_status_lock);
        if (event->enc_change.status == 0) {
            ESP_LOGI(TAG, "BLE link encrypted and bonded");
        } else {
            ESP_LOGW(TAG, "BLE link encryption failed, status=%d", event->enc_change.status);
        }
        break;
    case BLE_GAP_EVENT_REPEAT_PAIRING: {
        struct ble_gap_conn_desc descriptor;
        const int find_result = ble_gap_conn_find(event->repeat_pairing.conn_handle, &descriptor);
        if (find_result != 0) {
            ESP_LOGE(TAG, "BLE repeat pairing lookup failed: %d", find_result);
            return find_result;
        }
        ble_store_util_delete_peer(&descriptor.peer_id_addr);
        ESP_LOGI(TAG, "BLE stale bond removed; retrying pairing");
        return BLE_GAP_REPEAT_PAIRING_RETRY;
    }
    case BLE_GAP_EVENT_ADV_COMPLETE:
        advertise();
        break;
    default:
        break;
    }
    return 0;
}

static void on_sync(void)
{
    if (ble_hs_id_infer_auto(0, &own_address_type) != 0) return;
    advertise();
}

static void ble_host_task(void *param)
{
    (void)param;
    nimble_port_run();
    nimble_port_freertos_deinit();
}

esp_err_t openpencil_ble_server_start(void)
{
    memset(&ble_status, 0, sizeof(ble_status));
    esp_err_t nvs_result = nvs_flash_init();
    if (nvs_result == ESP_ERR_NVS_NO_FREE_PAGES || nvs_result == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_RETURN_ON_ERROR(nvs_flash_erase(), TAG, "erase NVS failed");
        nvs_result = nvs_flash_init();
    }
    ESP_RETURN_ON_ERROR(nvs_result, TAG, "initialize NVS failed");
    ESP_RETURN_ON_ERROR(nimble_port_init(), TAG, "initialize NimBLE failed");
    ble_hs_cfg.sync_cb = on_sync;
    ble_hs_cfg.store_status_cb = ble_store_util_status_rr;
#if CONFIG_OPENPENCIL_BLE_REQUIRE_PAIRING
    ble_hs_cfg.sm_bonding = 1;
    ble_hs_cfg.sm_mitm = 0;
    ble_hs_cfg.sm_sc = 1;
    ble_hs_cfg.sm_io_cap = BLE_HS_IO_NO_INPUT_OUTPUT;
    ble_hs_cfg.sm_our_key_dist = BLE_SM_PAIR_KEY_DIST_ENC;
    ble_hs_cfg.sm_their_key_dist = BLE_SM_PAIR_KEY_DIST_ENC;
#else
    ble_hs_cfg.sm_bonding = 0;
    ble_hs_cfg.sm_mitm = 0;
    ble_hs_cfg.sm_sc = 0;
    ble_hs_cfg.sm_io_cap = BLE_HS_IO_NO_INPUT_OUTPUT;
    ble_hs_cfg.sm_our_key_dist = 0;
    ble_hs_cfg.sm_their_key_dist = 0;
#endif
    ble_store_config_init();
    ble_svc_gap_init();
    ble_svc_gatt_init();
    ble_svc_gap_device_name_set(OPENPENCIL_BLE_DEVICE_NAME);
    ESP_RETURN_ON_FALSE(ble_gatts_count_cfg(services) == 0, ESP_FAIL, TAG, "count BLE services failed");
    ESP_RETURN_ON_FALSE(ble_gatts_add_svcs(services) == 0, ESP_FAIL, TAG, "add BLE services failed");
    nimble_port_freertos_init(ble_host_task);
    ESP_LOGI(TAG, "BLE server ready: %s", OPENPENCIL_BLE_DEVICE_NAME);
    return ESP_OK;
}

