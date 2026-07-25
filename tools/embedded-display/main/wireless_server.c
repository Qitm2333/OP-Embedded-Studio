#include "wireless_server.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "esp_check.h"
#include "esp_heap_caps.h"
#include "esp_http_server.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_wifi.h"
#include "nvs.h"
#include "nvs_flash.h"
#include "wireless_content.h"
#if CONFIG_OPENPENCIL_WIFI_LIVE_PREVIEW
#include "wireless_preview.h"
#endif

static const char *TAG = "wireless_server";
static httpd_handle_t server;
static esp_netif_t *access_point_netif;
static esp_netif_t *station_netif;
static openpencil_wireless_status_t wireless_status;
static uint8_t content_receive_buffer[16384];
static portMUX_TYPE wireless_status_lock = portMUX_INITIALIZER_UNLOCKED;

static void reboot_task(void *arg);

void openpencil_wireless_server_get_status(openpencil_wireless_status_t *status)
{
    if (!status) return;
    taskENTER_CRITICAL(&wireless_status_lock);
    *status = wireless_status;
    taskEXIT_CRITICAL(&wireless_status_lock);
}

static bool json_string_field(const char *json,
                              const char *key,
                              char *destination,
                              size_t destination_size)
{
    char needle[48];
    const int needle_length = snprintf(needle, sizeof(needle), "\"%s\"", key);
    if (needle_length <= 0 || (size_t)needle_length >= sizeof(needle)) return false;

    const char *cursor = strstr(json, needle);
    if (!cursor) return false;
    cursor += needle_length;
    while (*cursor == ' ' || *cursor == '\t' || *cursor == '\r' || *cursor == '\n') cursor++;
    if (*cursor++ != ':') return false;
    while (*cursor == ' ' || *cursor == '\t' || *cursor == '\r' || *cursor == '\n') cursor++;
    if (*cursor++ != '"') return false;

    size_t length = 0;
    while (*cursor && *cursor != '"') {
        if (*cursor == '\\') {
            cursor++;
            if (!*cursor) return false;
            if (*cursor == '"' || *cursor == '\\' || *cursor == '/') {
                if (length + 1 >= destination_size) return false;
                destination[length++] = *cursor++;
            } else {
                return false;
            }
        } else {
            if ((unsigned char)*cursor < 0x20 || length + 1 >= destination_size) return false;
            destination[length++] = *cursor++;
        }
    }
    if (*cursor != '"') return false;
    destination[length] = '\0';
    return true;
}

static void add_cors(httpd_req_t *request)
{
    httpd_resp_set_hdr(request, "Access-Control-Allow-Origin", "*");
    httpd_resp_set_hdr(request, "Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    httpd_resp_set_hdr(request, "Access-Control-Allow-Headers", "Content-Type");
}

static esp_err_t options_handler(httpd_req_t *request)
{
    add_cors(request);
    return httpd_resp_send(request, NULL, 0);
}

static esp_err_t send_json(httpd_req_t *request, const char *json)
{
    add_cors(request);
    httpd_resp_set_type(request, "application/json");
    return httpd_resp_send(request, json, HTTPD_RESP_USE_STRLEN);
}

static esp_err_t device_handler(httpd_req_t *request)
{
    openpencil_wireless_status_t status = {0};
    openpencil_wireless_server_get_status(&status);
    const openpencil_content_header_t *content = openpencil_content_header();
    char response[512];
    snprintf(response, sizeof(response),
             "{\"ok\":true,\"wirelessContent\":%s,\"livePreview\":%s,\"width\":%u,\"height\":%u,\"connected\":%s,\"ip\":\"%s\",\"apIp\":\"%s\"}",
             content ? "true" : "false",
#if CONFIG_OPENPENCIL_WIFI_LIVE_PREVIEW
             "true",
#else
             "false",
#endif
             (unsigned)CONFIG_EXAMPLE_LCD_H_RES,
             (unsigned)CONFIG_EXAMPLE_LCD_V_RES,
             status.station_connected ? "true" : "false",
             status.ip,
             status.ap_ip);
    return send_json(request, response);
}

#if !CONFIG_OPENPENCIL_WIFI_LIVE_PREVIEW
static esp_err_t content_handler(httpd_req_t *request)
{
    if (request->content_len < (int)sizeof(openpencil_content_header_t) ||
        (size_t)request->content_len > openpencil_content_capacity()) {
        httpd_resp_send_err(request, HTTPD_400_BAD_REQUEST, "invalid content length");
        return ESP_OK;
    }

    openpencil_content_header_t header = {0};
    size_t header_received = 0;
    while (header_received < sizeof(header)) {
        const int read = httpd_req_recv(
            request, (char *)&header + header_received, sizeof(header) - header_received);
        if (read <= 0) {
            httpd_resp_send_err(request, HTTPD_408_REQ_TIMEOUT, "content header timeout");
            return ESP_OK;
        }
        header_received += (size_t)read;
    }

    esp_err_t result = openpencil_content_write_begin(
        &header, (size_t)request->content_len);
    if (result != ESP_OK) {
        httpd_resp_send_err(request, HTTPD_400_BAD_REQUEST, esp_err_to_name(result));
        return ESP_OK;
    }

    size_t payload_received = 0;
    while (payload_received < header.payload_bytes) {
        const size_t remaining = header.payload_bytes - payload_received;
        const size_t requested = remaining < sizeof(content_receive_buffer) ? remaining : sizeof(content_receive_buffer);
        const int read = httpd_req_recv(request, (char *)content_receive_buffer, requested);
        if (read <= 0) {
            openpencil_content_write_abort();
            httpd_resp_send_err(request, HTTPD_408_REQ_TIMEOUT, "content body timeout");
            return ESP_OK;
        }
        result = openpencil_content_write_chunk(payload_received, content_receive_buffer, (size_t)read);
        if (result != ESP_OK) {
            openpencil_content_write_abort();
            httpd_resp_send_err(request, HTTPD_500_INTERNAL_SERVER_ERROR, esp_err_to_name(result));
            return ESP_OK;
        }
        payload_received += (size_t)read;
    }

    result = openpencil_content_write_finish();
    if (result != ESP_OK) {
        ESP_LOGE(TAG, "content update failed: %s", esp_err_to_name(result));
        httpd_resp_send_err(request, HTTPD_400_BAD_REQUEST, esp_err_to_name(result));
        return ESP_OK;
    }
    const esp_err_t response_result = send_json(
        request, "{\"ok\":true,\"message\":\"content updated; device restarting\"}");
    xTaskCreate(reboot_task, "content_reboot", 2048, NULL, 1, NULL);
    return response_result;
}
#endif

static void reboot_task(void *arg)
{
    vTaskDelay(pdMS_TO_TICKS(500));
    esp_restart();
}

#if CONFIG_OPENPENCIL_WIFI_LIVE_PREVIEW
static esp_err_t preview_frame_handler(httpd_req_t *request)
{
    if (request->content_len <= 0 || request->content_len > 1024 * 1024) {
        httpd_resp_send_err(request, HTTPD_400_BAD_REQUEST, "invalid preview length");
        return ESP_OK;
    }
    const size_t length = (size_t)request->content_len;
    uint8_t *body = heap_caps_malloc(length, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (!body) body = malloc(length);
    if (!body) {
        httpd_resp_send_err(request, HTTPD_500_INTERNAL_SERVER_ERROR, "not enough memory");
        return ESP_OK;
    }

    size_t received = 0;
    while (received < length) {
        const int read = httpd_req_recv(request, (char *)body + received, length - received);
        if (read <= 0) {
            free(body);
            httpd_resp_send_err(request, HTTPD_408_REQ_TIMEOUT, "preview body timeout");
            return ESP_OK;
        }
        received += (size_t)read;
    }

    const esp_err_t result = openpencil_wireless_preview_apply(body, length);
    free(body);
    if (result != ESP_OK) {
        ESP_LOGE(TAG, "live preview failed: %s", esp_err_to_name(result));
        httpd_resp_send_err(request, HTTPD_400_BAD_REQUEST, esp_err_to_name(result));
        return ESP_OK;
    }
    return send_json(request, "{\"ok\":true,\"message\":\"preview updated\"}");
}

static esp_err_t preview_stop_handler(httpd_req_t *request)
{
    const esp_err_t result = openpencil_wireless_preview_stop();
    if (result != ESP_OK) {
        httpd_resp_send_err(request, HTTPD_500_INTERNAL_SERVER_ERROR, esp_err_to_name(result));
        return ESP_OK;
    }
    return send_json(request, "{\"ok\":true,\"message\":\"preview stopped\"}");
}
#endif

static esp_err_t wifi_handler(httpd_req_t *request)
{
    if (request->content_len <= 0 || request->content_len > 512) {
        httpd_resp_send_err(request, HTTPD_400_BAD_REQUEST, "invalid wifi payload");
        return ESP_OK;
    }
    char body[513] = {0};
    const int received = httpd_req_recv(request, body, request->content_len);
    if (received <= 0) {
        httpd_resp_send_err(request, HTTPD_408_REQ_TIMEOUT, "request body timeout");
        return ESP_OK;
    }
    char ssid[sizeof(((wifi_config_t *)0)->sta.ssid)] = {0};
    char password[sizeof(((wifi_config_t *)0)->sta.password)] = {0};
    if (!json_string_field(body, "ssid", ssid, sizeof(ssid)) ||
        !json_string_field(body, "password", password, sizeof(password)) ||
        ssid[0] == '\0') {
        httpd_resp_send_err(request, HTTPD_400_BAD_REQUEST, "ssid and password are required");
        return ESP_OK;
    }

    nvs_handle_t handle;
    esp_err_t result = nvs_open("wireless", NVS_READWRITE, &handle);
    if (result == ESP_OK) {
        result = nvs_set_str(handle, "ssid", ssid);
        if (result == ESP_OK) result = nvs_set_str(handle, "password", password);
        if (result == ESP_OK) result = nvs_commit(handle);
        nvs_close(handle);
    }
    if (result != ESP_OK) {
        httpd_resp_send_err(request, HTTPD_500_INTERNAL_SERVER_ERROR, esp_err_to_name(result));
        return ESP_OK;
    }
    send_json(request, "{\"ok\":true,\"message\":\"wifi credentials saved; device restarting\"}");
    xTaskCreate(reboot_task, "wifi_reboot", 2048, NULL, 1, NULL);
    return ESP_OK;
}

static void wifi_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data)
{
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        if (wireless_status.station_configured) esp_wifi_connect();
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        taskENTER_CRITICAL(&wireless_status_lock);
        wireless_status.station_connected = false;
        wireless_status.ip[0] = '\0';
        taskEXIT_CRITICAL(&wireless_status_lock);
        ESP_LOGW(TAG, "station disconnected; retrying");
        if (wireless_status.station_configured) esp_wifi_connect();
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        const ip_event_got_ip_t *event = event_data;
        taskENTER_CRITICAL(&wireless_status_lock);
        wireless_status.station_connected = true;
        snprintf(wireless_status.ip, sizeof(wireless_status.ip), IPSTR, IP2STR(&event->ip_info.ip));
        taskEXIT_CRITICAL(&wireless_status_lock);
        ESP_LOGI(TAG, "station ready at " IPSTR, IP2STR(&event->ip_info.ip));
    }
}

esp_err_t openpencil_wireless_server_start(void)
{
    esp_err_t result = nvs_flash_init();
    if (result == ESP_ERR_NVS_NO_FREE_PAGES || result == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        result = nvs_flash_init();
    }
    ESP_RETURN_ON_ERROR(result, TAG, "initialize NVS failed");
    ESP_RETURN_ON_ERROR(esp_netif_init(), TAG, "initialize network interface failed");
    ESP_RETURN_ON_ERROR(esp_event_loop_create_default(), TAG, "create event loop failed");

    station_netif = esp_netif_create_default_wifi_sta();
#if CONFIG_OPENPENCIL_SETUP_ACCESS_POINT
    access_point_netif = esp_netif_create_default_wifi_ap();
#endif
    ESP_RETURN_ON_FALSE(station_netif, ESP_ERR_NO_MEM, TAG, "create station netif failed");
#if CONFIG_OPENPENCIL_SETUP_ACCESS_POINT
    ESP_RETURN_ON_FALSE(access_point_netif, ESP_ERR_NO_MEM, TAG, "create access point netif failed");
#endif

    wifi_init_config_t config = WIFI_INIT_CONFIG_DEFAULT();
    ESP_RETURN_ON_ERROR(esp_wifi_init(&config), TAG, "initialize WiFi failed");
    ESP_RETURN_ON_ERROR(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL), TAG, "register WiFi handler failed");
    ESP_RETURN_ON_ERROR(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler, NULL), TAG, "register IP handler failed");

    wifi_config_t ap_config = {0};
#if CONFIG_OPENPENCIL_SETUP_ACCESS_POINT
    strcpy((char *)ap_config.ap.ssid, "OP-Embedded-Setup");
    strcpy((char *)ap_config.ap.password, "opembedded");
    ap_config.ap.ssid_len = strlen((char *)ap_config.ap.ssid);
    ap_config.ap.channel = 1;
    ap_config.ap.max_connection = 2;
    ap_config.ap.authmode = WIFI_AUTH_WPA2_PSK;
#endif

    wifi_config_t sta_config = {0};
    nvs_handle_t handle;
    if (nvs_open("wireless", NVS_READONLY, &handle) == ESP_OK) {
        size_t ssid_size = sizeof(sta_config.sta.ssid);
        size_t password_size = sizeof(sta_config.sta.password);
        nvs_get_str(handle, "ssid", (char *)sta_config.sta.ssid, &ssid_size);
        nvs_get_str(handle, "password", (char *)sta_config.sta.password, &password_size);
        nvs_close(handle);
    }

    taskENTER_CRITICAL(&wireless_status_lock);
    memset(&wireless_status, 0, sizeof(wireless_status));
    wireless_status.station_configured = sta_config.sta.ssid[0] != '\0';
    strlcpy(wireless_status.ssid, (const char *)sta_config.sta.ssid, sizeof(wireless_status.ssid));
    strlcpy(wireless_status.password, (const char *)sta_config.sta.password, sizeof(wireless_status.password));
    taskEXIT_CRITICAL(&wireless_status_lock);

#if CONFIG_OPENPENCIL_SETUP_ACCESS_POINT
    ESP_RETURN_ON_ERROR(esp_wifi_set_mode(WIFI_MODE_APSTA), TAG, "set WiFi mode failed");
    ESP_RETURN_ON_ERROR(esp_wifi_set_config(WIFI_IF_AP, &ap_config), TAG, "set AP config failed");
#else
    ESP_RETURN_ON_ERROR(esp_wifi_set_mode(WIFI_MODE_STA), TAG, "set WiFi mode failed");
#endif
    ESP_RETURN_ON_ERROR(esp_wifi_set_config(WIFI_IF_STA, &sta_config), TAG, "set station config failed");
    ESP_RETURN_ON_ERROR(esp_wifi_start(), TAG, "start WiFi failed");

#if CONFIG_OPENPENCIL_SETUP_ACCESS_POINT
    esp_netif_ip_info_t ap_ip = {0};
    if (esp_netif_get_ip_info(access_point_netif, &ap_ip) == ESP_OK) {
        taskENTER_CRITICAL(&wireless_status_lock);
        snprintf(wireless_status.ap_ip, sizeof(wireless_status.ap_ip), IPSTR, IP2STR(&ap_ip.ip));
        taskEXIT_CRITICAL(&wireless_status_lock);
    }
#endif

    httpd_config_t server_config = HTTPD_DEFAULT_CONFIG();
    ESP_RETURN_ON_ERROR(httpd_start(&server, &server_config), TAG, "start HTTP server failed");
    httpd_uri_t device_uri = {.uri = "/api/device", .method = HTTP_GET, .handler = device_handler};
    httpd_uri_t wifi_uri = {.uri = "/api/wifi", .method = HTTP_POST, .handler = wifi_handler};
    httpd_uri_t wifi_options_uri = {.uri = "/api/wifi", .method = HTTP_OPTIONS, .handler = options_handler};
    httpd_register_uri_handler(server, &device_uri);
    httpd_register_uri_handler(server, &wifi_uri);
    httpd_register_uri_handler(server, &wifi_options_uri);
#if CONFIG_OPENPENCIL_WIFI_LIVE_PREVIEW
    httpd_uri_t preview_uri = {.uri = "/api/preview/frame", .method = HTTP_POST, .handler = preview_frame_handler};
    httpd_uri_t preview_stop_uri = {.uri = "/api/preview/stop", .method = HTTP_POST, .handler = preview_stop_handler};
    httpd_uri_t preview_options_uri = {.uri = "/api/preview/frame", .method = HTTP_OPTIONS, .handler = options_handler};
    httpd_uri_t preview_stop_options_uri = {.uri = "/api/preview/stop", .method = HTTP_OPTIONS, .handler = options_handler};
    httpd_register_uri_handler(server, &preview_uri);
    httpd_register_uri_handler(server, &preview_stop_uri);
    httpd_register_uri_handler(server, &preview_options_uri);
    httpd_register_uri_handler(server, &preview_stop_options_uri);
#else
    httpd_uri_t content_uri = {.uri = "/api/content", .method = HTTP_POST, .handler = content_handler};
    httpd_uri_t content_options_uri = {.uri = "/api/content", .method = HTTP_OPTIONS, .handler = options_handler};
    httpd_register_uri_handler(server, &content_uri);
    httpd_register_uri_handler(server, &content_options_uri);
#endif
#if CONFIG_OPENPENCIL_SETUP_ACCESS_POINT
    ESP_LOGI(TAG, "wireless content server ready; setup AP OP-Embedded-Setup / opembedded");
#else
    ESP_LOGI(TAG, "LAN content server ready; station SSID: %s", wireless_status.ssid);
#endif
    return ESP_OK;
}
