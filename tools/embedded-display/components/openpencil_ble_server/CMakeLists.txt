idf_component_register(
    SRCS "../../main/ble_server.c"
    INCLUDE_DIRS "../../main"
    PRIV_REQUIRES main bt esp_partition esp_timer
)
