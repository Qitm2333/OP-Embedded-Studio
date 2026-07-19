#pragma once

#if __has_include("generated_prototype_runtime.h")
#include "generated_prototype_runtime.h"
#else
#define OPENPENCIL_PROTOTYPE_ENABLED 0
#define OPENPENCIL_PROTOTYPE_NAME "none"
#define OPENPENCIL_PROTOTYPE_STATE_COUNT 0
#define OPENPENCIL_PROTOTYPE_INITIAL_STATE 0
#define OPENPENCIL_PROTOTYPE_TRANSITION_COUNT 0
static const char *const openpencil_state_names[1] = {"none"};
static const openpencil_transition_t openpencil_transitions[1] = {{0, 0, 0}};
#endif
