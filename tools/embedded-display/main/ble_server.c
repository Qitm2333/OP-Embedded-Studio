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
#include "host/ble_esp_gap.h"
#include "host/ble_store.h"
#include "nimble/nimble_port.h"
#include "nimble/nimble_port_freertos.h"
#include "os/os_mbuf.h"
#include "nvs_flash.h"
#include "services/gap/ble_svc_gap.h"
#include "services/gatt/ble_svc_gatt.h"
#include "wireless_content.h"

static const char *TAG = "ble_server";

#define OPENPENCIL_BLE_DEVICE_NAME "OP Embedded BLE"
#define OPENPENCIL_BLE_DATA_LENGTH_OCTETS 251
#define OPENPENCIL_BLE_DATA_LENGTH_TIME_US 2120
#define OPENPENCIL_BLE_CONN_INTERVAL_MIN 6
#define OPENPENCIL_BLE_CONN_INTERVAL_MAX 12
#define OPENPENCIL_BLE_SUPERVISION_TIMEOUT 400
#define OPENPENCIL_BLE_STATUS_NOTIFY_STEP (12 * 1024)
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
static bool transfer_stream_started;
static uint8_t transfer_header[sizeof(openpencil_content_header_t)];
static size_t transfer_header_received;
static size_t transfer_capacity;
static size_t transfer_received;
static size_t last_notified_received;
static bool status_notify_enabled;
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
static void tune_connection_task(void *param);
static int ble_gap_event(struct ble_gap_event *event, void *arg);

static size_t encode_status_payload(uint8_t payload[14])
{
    openpencil_ble_status_t status;
    openpencil_ble_server_get_status(&status);
    memset(payload, 0, 14);
    payload[0] = status.connected;
    payload[1] = status.paired;
    payload[2] = status.receiving;
    payload[3] = status.completed;
    payload[4] = status.failed;
    memcpy(payload + 5, &status.received_bytes, sizeof(uint32_t));
    memcpy(payload + 9, &status.total_bytes, sizeof(uint32_t));
    payload[13] = openpencil_content_firmware_mode();
    return 14;
}

static void notify_status(bool force)
{
    if (!status_notify_enabled || connection_handle == BLE_HS_CONN_HANDLE_NONE) return;

    openpencil_ble_status_t status;
    openpencil_ble_server_get_status(&status);
    if (!force && status.received_bytes < last_notified_received + OPENPENCIL_BLE_STATUS_NOTIFY_STEP) return;

    uint8_t payload[14];
    const size_t payload_length = encode_status_payload(payload);
    struct os_mbuf *om = ble_hs_mbuf_from_flat(payload, payload_length);
    if (!om) return;

    const int result = ble_gatts_notify_custom(connection_handle, status_value_handle, om);
    if (result == 0) {
        last_notified_received = status.received_bytes;
    } else {
        ESP_LOGW(TAG, "BLE status notification failed: %d", result);
    }
}

void openpencil_ble_server_get_status(openpencil_ble_status_t *status)
{
    if (!status) return;
    taskENTER_CRITICAL(&ble_status_lock);
    *status = ble_status;
    taskEXIT_CRITICAL(&ble_status_lock);
}

static void reset_transfer(bool failed)
{
    if (transfer_stream_started) openpencil_content_write_abort();
    transfer_stream_started = false;
    transfer_header_received = 0;
    transfer_capacity = 0;
    transfer_received = 0;
    last_notified_received = 0;
    taskENTER_CRITICAL(&ble_status_lock);
    ble_status.receiving = false;
    ble_status.failed = failed;
    ble_status.received_bytes = 0;
    ble_status.total_bytes = 0;
    taskEXIT_CRITICAL(&ble_status_lock);
    notify_status(true);
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
#if CONFIG_OPENPENCIL_SEQUENCE_PLAYBACK
    } else if (header->mode == OPENPENCIL_CONTENT_MODE_SEQUENCE) {
        const size_t minimum_payload = sizeof(openpencil_sequence_content_header_t) +
                                       (size_t)header->frame_count *
                                           sizeof(openpencil_sequence_resource_t);
        if (header->frame_count < 2 || header->payload_bytes <= minimum_payload) return false;
#endif
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
    const size_t confirmed_offset = transfer_stream_started ? transfer_received : transfer_header_received;
    if (packet_offset != confirmed_offset) {
        // A status read can race with packets already queued by the browser.
        // Accept fully duplicated packets, but never append data after a gap.
        if (packet_offset < confirmed_offset && packet_offset + packet_length <= confirmed_offset) return 0;
        return BLE_ATT_ERR_INVALID_OFFSET;
    }

    size_t packet_data_offset = 0;
    if (!transfer_stream_started) {
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
        if (!validate_header(header, &transfer_capacity) ||
            transfer_capacity > openpencil_content_capacity() ||
            openpencil_content_write_begin(header, transfer_capacity) != ESP_OK) {
            reset_transfer(true);
            return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
        }
        transfer_stream_started = true;
        transfer_received = sizeof(transfer_header);
        transfer_header_received = 0;
        taskENTER_CRITICAL(&ble_status_lock);
        ble_status.received_bytes = transfer_received;
        ble_status.total_bytes = transfer_capacity;
        taskEXIT_CRITICAL(&ble_status_lock);
        notify_status(true);
    }

    const size_t payload_length = packet_length - packet_data_offset;
    if (transfer_received + payload_length > transfer_capacity) {
        reset_transfer(true);
        return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
    }
    if (payload_length > 0) {
        const esp_err_t write_result = openpencil_content_write_chunk(
            transfer_received - sizeof(transfer_header),
            packet_data + packet_data_offset,
            payload_length);
        if (write_result != ESP_OK) {
            ESP_LOGE(TAG, "BLE content stream failed: %s", esp_err_to_name(write_result));
            reset_transfer(true);
            return BLE_ATT_ERR_UNLIKELY;
        }
        transfer_received += payload_length;
    }
    taskENTER_CRITICAL(&ble_status_lock);
    ble_status.received_bytes = transfer_received;
    taskEXIT_CRITICAL(&ble_status_lock);
    notify_status(false);

    if (transfer_received == transfer_capacity) {
        const esp_err_t result = openpencil_content_write_finish();
        if (result != ESP_OK) {
            ESP_LOGE(TAG, "BLE content commit failed: %s", esp_err_to_name(result));
            reset_transfer(true);
            return BLE_ATT_ERR_UNLIKELY;
        }
        transfer_stream_started = false;
        taskENTER_CRITICAL(&ble_status_lock);
        ble_status.receiving = false;
        ble_status.completed = true;
        ble_status.received_bytes = transfer_capacity;
        taskEXIT_CRITICAL(&ble_status_lock);
        notify_status(true);
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
    uint8_t payload[14];
    const size_t payload_length = encode_status_payload(payload);
    return os_mbuf_append(ctxt->om, payload, payload_length) == 0 ? 0 : BLE_ATT_ERR_INSUFFICIENT_RES;
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
                .flags = BLE_GATT_CHR_F_READ | BLE_GATT_CHR_F_NOTIFY
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

static void tune_connection_task(void *param)
{
    const uint16_t handle = (uint16_t)(uintptr_t)param;
    vTaskDelay(pdMS_TO_TICKS(150));
    if (connection_handle != handle) {
        vTaskDelete(NULL);
        return;
    }

    int result = ble_hs_hci_util_set_data_len(
        handle, OPENPENCIL_BLE_DATA_LENGTH_OCTETS, OPENPENCIL_BLE_DATA_LENGTH_TIME_US);
    if (result != 0) ESP_LOGW(TAG, "BLE data length request rejected: %d", result);

    vTaskDelay(pdMS_TO_TICKS(100));
    if (connection_handle != handle) {
        vTaskDelete(NULL);
        return;
    }
    result = ble_gap_set_prefered_le_phy(
        handle, BLE_GAP_LE_PHY_2M_MASK, BLE_GAP_LE_PHY_2M_MASK, BLE_GAP_LE_PHY_CODED_ANY);
    if (result != 0) ESP_LOGW(TAG, "BLE 2M PHY request rejected: %d", result);

    vTaskDelay(pdMS_TO_TICKS(100));
    if (connection_handle == handle) {
        const struct ble_gap_upd_params params = {
            .itvl_min = OPENPENCIL_BLE_CONN_INTERVAL_MIN,
            .itvl_max = OPENPENCIL_BLE_CONN_INTERVAL_MAX,
            .latency = 0,
            .supervision_timeout = OPENPENCIL_BLE_SUPERVISION_TIMEOUT,
            .min_ce_len = 0,
            .max_ce_len = 0,
        };
        result = ble_gap_update_params(handle, &params);
        if (result != 0) ESP_LOGW(TAG, "BLE connection interval request rejected: %d", result);
    }
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
            if (xTaskCreate(tune_connection_task, "ble_link_tune", 3072,
                            (void *)(uintptr_t)connection_handle, 5, NULL) != pdPASS) {
                ESP_LOGW(TAG, "BLE link tuning task could not start");
            }
        } else {
            ESP_LOGW(TAG, "BLE connection failed, status=%d", event->connect.status);
            advertise();
        }
        break;
    case BLE_GAP_EVENT_DISCONNECT:
        ESP_LOGW(TAG, "BLE client disconnected, reason=%d", event->disconnect.reason);
        connection_handle = BLE_HS_CONN_HANDLE_NONE;
        status_notify_enabled = false;
        last_notified_received = 0;
        taskENTER_CRITICAL(&ble_status_lock);
        ble_status.connected = false;
        ble_status.paired = false;
        taskEXIT_CRITICAL(&ble_status_lock);
        if (xTaskCreate(advertise_retry_task, "ble_adv_retry", 3072, NULL, 5, NULL) != pdPASS) {
            advertise();
        }
        break;
    case BLE_GAP_EVENT_SUBSCRIBE:
        if (event->subscribe.attr_handle == status_value_handle) {
            status_notify_enabled = event->subscribe.cur_notify != 0;
            last_notified_received = 0;
            ESP_LOGI(TAG, "BLE status notifications: %s", status_notify_enabled ? "enabled" : "disabled");
            notify_status(true);
        }
        break;
    case BLE_GAP_EVENT_CONN_UPDATE: {
        struct ble_gap_conn_desc descriptor;
        if (event->conn_update.status == 0 &&
            ble_gap_conn_find(event->conn_update.conn_handle, &descriptor) == 0) {
            ESP_LOGI(TAG, "BLE connection interval: %.2f ms, latency=%u, timeout=%u ms",
                     descriptor.conn_itvl * 1.25, descriptor.conn_latency,
                     descriptor.supervision_timeout * 10);
        } else {
            ESP_LOGW(TAG, "BLE connection update failed: %d", event->conn_update.status);
        }
        break;
    }
    case BLE_GAP_EVENT_MTU:
        ESP_LOGI(TAG, "BLE ATT MTU negotiated: %u", event->mtu.value);
        break;
    case BLE_GAP_EVENT_PHY_UPDATE_COMPLETE:
        ESP_LOGI(TAG, "BLE PHY update: status=%d tx=%u rx=%u", event->phy_updated.status,
                 event->phy_updated.tx_phy, event->phy_updated.rx_phy);
        break;
    case BLE_GAP_EVENT_DATA_LEN_CHG:
        ESP_LOGI(TAG, "BLE data length: tx=%u/%u us rx=%u/%u us",
                 event->data_len_chg.max_tx_octets, event->data_len_chg.max_tx_time,
                 event->data_len_chg.max_rx_octets, event->data_len_chg.max_rx_time);
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
    const int phy_result = ble_gap_set_prefered_default_le_phy(
        BLE_GAP_LE_PHY_2M_MASK, BLE_GAP_LE_PHY_2M_MASK);
    if (phy_result != 0) ESP_LOGW(TAG, "BLE default 2M PHY preference rejected: %d", phy_result);
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
