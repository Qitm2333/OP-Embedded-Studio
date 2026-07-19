idf_component_register(
    SRCS "../../main/wireless_server.c"
    INCLUDE_DIRS "../../main"
    PRIV_REQUIRES main esp_wifi esp_event esp_netif nvs_flash esp_http_server
)
