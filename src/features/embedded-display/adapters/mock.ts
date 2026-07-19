import type { EmbeddedDisplayProfile, EmbeddedDisplayVariable } from '../model/types'

export const MOCK_DISPLAY_PROFILES: EmbeddedDisplayProfile[] = [
  {
    id: 'st7789_qs130tab1005a',
    name: 'QS130TAB1005A',
    controller: 'ST7789',
    resolution: { width: 240, height: 240 },
    interface: '4-wire SPI',
    backgroundColor: '#F5F5F5',
    description: '13-inch square TFT panel',
    verified: true
  },
  {
    id: 'st7735s_lb090r_if03',
    name: 'LB090R-IF03',
    controller: 'ST7735',
    resolution: { width: 128, height: 128 },
    interface: '4-wire SPI',
    backgroundColor: '#F5F5F5',
    description: 'Compact square TFT panel',
    verified: false
  },
  {
    id: 'gc9d01n_gvh099wq010b_a0',
    name: 'GVH099WQ010B-A0',
    controller: 'GC9D01N',
    resolution: { width: 160, height: 160 },
    interface: '4-wire SPI',
    backgroundColor: '#F5F5F5',
    description: 'Round 0.99-inch TFT panel',
    verified: false
  }
]

export const MOCK_DISPLAY_VARIABLES: EmbeddedDisplayVariable[] = []
