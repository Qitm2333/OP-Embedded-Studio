#pragma once

#include <stdbool.h>

#include "esp_err.h"
#include "generated_prototype.h"

/** Initialize physical inputs used by the generated prototype runtime. */
esp_err_t openpencil_input_init(void);

/** Enable delayed click aggregation only for states that use double/triple click. */
void openpencil_input_set_screen_multi_click(bool enabled);

/** Poll once and return a completed high-level gesture when available. */
bool openpencil_input_poll(openpencil_input_event_t *event);
