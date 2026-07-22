#include "co5300_panel.h"

#include "driver/spi_master.h"
#include "esp_lcd_co5300.h"
#include "esp_lcd_panel_vendor.h"
#include "display_presenter.h"

#define CO5300_SPI_HOST SPI2_HOST
#if CONFIG_OPENPENCIL_WIFI_LIVE_PREVIEW
// Realtime preview prioritizes a complete TE-synchronized frame over peak
// throughput. The lower clock gives Wi-Fi and PSRAM DMA more scheduling margin.
#define CO5300_PCLK_HZ (10 * 1000 * 1000)
#else
#define CO5300_PCLK_HZ (30 * 1000 * 1000)
#endif
#define CO5300_CS_GPIO 12
#define CO5300_PCLK_GPIO 38
#define CO5300_DATA0_GPIO 4
#define CO5300_DATA1_GPIO 5
#define CO5300_DATA2_GPIO 6
#define CO5300_DATA3_GPIO 7
#define CO5300_RESET_GPIO 1

static const co5300_lcd_init_cmd_t co5300_init_cmds[] = {
    {0xFE, (uint8_t[]){0x20}, 1, 0},
    {0x19, (uint8_t[]){0x10}, 1, 0},
    {0x1C, (uint8_t[]){0xA0}, 1, 0},
    {0xFE, (uint8_t[]){0x00}, 1, 0},
    {0xC4, (uint8_t[]){0x80}, 1, 0},
    {0x3A, (uint8_t[]){0x55}, 1, 0},
    {0x35, (uint8_t[]){0x00}, 1, 0},
    {0x53, (uint8_t[]){0x20}, 1, 0},
    {0x51, (uint8_t[]){0xFF}, 1, 0},
    {0x63, (uint8_t[]){0xFF}, 1, 0},
    {0x2A, (uint8_t[]){0x00, 0x06, 0x01, 0xD7}, 4, 0},
    {0x2B, (uint8_t[]){0x00, 0x00, 0x01, 0xD1}, 4, 600},
    {0x11, NULL, 0, 600},
    {0x29, NULL, 0, 0},
};

esp_err_t example_co5300_new_panel(int max_transfer_sz,
                                   esp_lcd_panel_io_handle_t *ret_io,
                                   esp_lcd_panel_handle_t *ret_panel)
{
    const spi_bus_config_t bus_config = CO5300_PANEL_BUS_QSPI_CONFIG(
        CO5300_PCLK_GPIO,
        CO5300_DATA0_GPIO,
        CO5300_DATA1_GPIO,
        CO5300_DATA2_GPIO,
        CO5300_DATA3_GPIO,
        max_transfer_sz);
    ESP_ERROR_CHECK(spi_bus_initialize(CO5300_SPI_HOST, &bus_config, SPI_DMA_CH_AUTO));

    esp_lcd_panel_io_spi_config_t io_config =
        CO5300_PANEL_IO_QSPI_CONFIG(CO5300_CS_GPIO, NULL, NULL);
    io_config.pclk_hz = CO5300_PCLK_HZ;
    io_config.trans_queue_depth = 10;
    io_config.on_color_trans_done = openpencil_display_presenter_on_color_done;

    co5300_vendor_config_t vendor_config = {
        .init_cmds = co5300_init_cmds,
        .init_cmds_size = sizeof(co5300_init_cmds) / sizeof(co5300_init_cmds[0]),
        .flags = {
            .use_qspi_interface = 1,
        },
    };

    esp_lcd_panel_io_handle_t io_handle = NULL;
    ESP_ERROR_CHECK(esp_lcd_new_panel_io_spi(
        (esp_lcd_spi_bus_handle_t)CO5300_SPI_HOST,
        &io_config,
        &io_handle));

    const esp_lcd_panel_dev_config_t panel_config = {
        .reset_gpio_num = CO5300_RESET_GPIO,
        .rgb_ele_order = LCD_RGB_ELEMENT_ORDER_RGB,
        .bits_per_pixel = 16,
        .vendor_config = &vendor_config,
    };

    esp_lcd_panel_handle_t panel_handle = NULL;
    ESP_ERROR_CHECK(esp_lcd_new_panel_co5300(io_handle, &panel_config, &panel_handle));
    ESP_ERROR_CHECK(esp_lcd_panel_set_gap(panel_handle, 6, 0));
    ESP_ERROR_CHECK(esp_lcd_panel_reset(panel_handle));
    ESP_ERROR_CHECK(esp_lcd_panel_init(panel_handle));
    ESP_ERROR_CHECK(esp_lcd_panel_disp_on_off(panel_handle, true));

    if (ret_io) *ret_io = io_handle;
    if (ret_panel) *ret_panel = panel_handle;
    return ESP_OK;
}
