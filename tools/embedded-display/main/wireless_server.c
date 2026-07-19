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

static const char *TAG = "wireless_server";
static httpd_handle_t server;
static esp_netif_t *access_point_netif;
static esp_netif_t *station_netif;

static void reboot_task(void *arg);

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
    esp_netif_ip_info_t ip = {0};
    esp_netif_ip_info_t ap_ip = {0};
    if (station_netif) esp_netif_get_ip_info(station_netif, &ip);
    if (access_point_netif) esp_netif_get_ip_info(access_point_netif, &ap_ip);
    const openpencil_content_header_t *content = openpencil_content_header();
    char response[512];
    snprintf(response, sizeof(response),
             "{\"ok\":true,\"wirelessContent\":%s,\"width\":%u,\"height\":%u,\"ip\":\"%u.%u.%u.%u\",\"apIp\":\"%u.%u.%u.%u\"}",
             content ? "true" : "false",
             (unsigned)CONFIG_EXAMPLE_LCD_H_RES,
             (unsigned)CONFIG_EXAMPLE_LCD_V_RES,
             IP2STR(&ip.ip),
             IP2STR(&ap_ip.ip));
    return send_json(request, response);
}

static esp_err_t content_handler(httpd_req_t *request)
{
    if (request->content_len <= 0 || request->content_len > 5 * 1024 * 1024) {
        httpd_resp_send_err(request, HTTPD_400_BAD_REQUEST, "invalid content length");
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
            httpd_resp_send_err(request, HTTPD_408_REQ_TIMEOUT, "request body timeout");
            return ESP_OK;
        }
        received += (size_t)read;
    }

    const esp_err_t result = openpencil_content_write(body, length);
    free(body);
    if (result != ESP_OK) {
        ESP_LOGE(TAG, "content update failed: %s", esp_err_to_name(result));
        httpd_resp_send_err(request, HTTPD_400_BAD_REQUEST, esp_err_to_name(result));
        return ESP_OK;
    }
    const esp_err_t response_result = send_json(request, "{\"ok\":true,\"message\":\"content updated; device restarting\"}");
    xTaskCreate(reboot_task, "content_reboot", 2048, NULL, 1, NULL);
    return response_result;
}

static void reboot_task(void *arg)
{
    vTaskDelay(pdMS_TO_TICKS(500));
    esp_restart();
}

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
        esp_wifi_connect();
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        ESP_LOGW(TAG, "station disconnected; retrying");
        esp_wifi_connect();
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        const ip_event_got_ip_t *event = event_data;
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

    access_point_netif = esp_netif_create_default_wifi_ap();
    station_netif = esp_netif_create_default_wifi_sta();
    ESP_RETURN_ON_FALSE(access_point_netif && station_netif, ESP_ERR_NO_MEM, TAG, "create netif failed");

    wifi_init_config_t config = WIFI_INIT_CONFIG_DEFAULT();
    ESP_RETURN_ON_ERROR(esp_wifi_init(&config), TAG, "initialize WiFi failed");
    ESP_RETURN_ON_ERROR(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL), TAG, "register WiFi handler failed");
    ESP_RETURN_ON_ERROR(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler, NULL), TAG, "register IP handler failed");

    wifi_config_t ap_config = {0};
    strcpy((char *)ap_config.ap.ssid, "OpenPencil-Setup");
    strcpy((char *)ap_config.ap.password, "openpencil");
    ap_config.ap.ssid_len = strlen((char *)ap_config.ap.ssid);
    ap_config.ap.channel = 1;
    ap_config.ap.max_connection = 2;
    ap_config.ap.authmode = WIFI_AUTH_WPA2_PSK;

    wifi_config_t sta_config = {0};
    nvs_handle_t handle;
    if (nvs_open("wireless", NVS_READONLY, &handle) == ESP_OK) {
        size_t ssid_size = sizeof(sta_config.sta.ssid);
        size_t password_size = sizeof(sta_config.sta.password);
        nvs_get_str(handle, "ssid", (char *)sta_config.sta.ssid, &ssid_size);
        nvs_get_str(handle, "password", (char *)sta_config.sta.password, &password_size);
        nvs_close(handle);
    }

    ESP_RETURN_ON_ERROR(esp_wifi_set_mode(WIFI_MODE_APSTA), TAG, "set WiFi mode failed");
    ESP_RETURN_ON_ERROR(esp_wifi_set_config(WIFI_IF_AP, &ap_config), TAG, "set AP config failed");
    ESP_RETURN_ON_ERROR(esp_wifi_set_config(WIFI_IF_STA, &sta_config), TAG, "set station config failed");
    ESP_RETURN_ON_ERROR(esp_wifi_start(), TAG, "start WiFi failed");

    httpd_config_t server_config = HTTPD_DEFAULT_CONFIG();
    ESP_RETURN_ON_ERROR(httpd_start(&server, &server_config), TAG, "start HTTP server failed");
    httpd_uri_t device_uri = {.uri = "/api/device", .method = HTTP_GET, .handler = device_handler};
    httpd_uri_t content_uri = {.uri = "/api/content", .method = HTTP_POST, .handler = content_handler};
    httpd_uri_t wifi_uri = {.uri = "/api/wifi", .method = HTTP_POST, .handler = wifi_handler};
    httpd_uri_t content_options_uri = {.uri = "/api/content", .method = HTTP_OPTIONS, .handler = options_handler};
    httpd_uri_t wifi_options_uri = {.uri = "/api/wifi", .method = HTTP_OPTIONS, .handler = options_handler};
    httpd_register_uri_handler(server, &device_uri);
    httpd_register_uri_handler(server, &content_uri);
    httpd_register_uri_handler(server, &wifi_uri);
    httpd_register_uri_handler(server, &content_options_uri);
    httpd_register_uri_handler(server, &wifi_options_uri);
    ESP_LOGI(TAG, "wireless content server ready; setup AP OpenPencil-Setup / openpencil");
    return ESP_OK;
}
