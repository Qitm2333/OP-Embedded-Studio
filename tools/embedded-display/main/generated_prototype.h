#pragma once

#include <stdint.h>

typedef enum {
    OPENPENCIL_EVENT_SCREEN_CLICK = 0,
    OPENPENCIL_EVENT_SCREEN_LONG_PRESS,
    OPENPENCIL_EVENT_SCREEN_DOUBLE_CLICK,
    OPENPENCIL_EVENT_SCREEN_TRIPLE_CLICK,
    OPENPENCIL_EVENT_BOOT_CLICK,
    OPENPENCIL_EVENT_BOOT_LONG_PRESS,
} openpencil_input_event_t;

typedef struct {
    uint8_t from_state;
    uint8_t event;
    uint8_t to_state;
} openpencil_transition_t;

#if __has_include("generated_prototype_user.h")
#include "generated_prototype_user.h"
#else
#define OPENPENCIL_PROTOTYPE_ENABLED 0
#define OPENPENCIL_PROTOTYPE_NAME "none"
#define OPENPENCIL_PROTOTYPE_STATE_COUNT 0
#define OPENPENCIL_PROTOTYPE_INITIAL_STATE 0
#define OPENPENCIL_PROTOTYPE_TRANSITION_COUNT 0
static const char *const openpencil_state_names[1] = {"none"};
static const openpencil_transition_t openpencil_transitions[1] = {{0, 0, 0}};
#endif
