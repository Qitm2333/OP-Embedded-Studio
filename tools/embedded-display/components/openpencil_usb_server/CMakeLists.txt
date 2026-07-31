idf_component_register(
    SRCS "../../main/usb_content_server.c"
    INCLUDE_DIRS "../../main"
    PRIV_REQUIRES main esp_driver_usb_serial_jtag esp_rom
)
