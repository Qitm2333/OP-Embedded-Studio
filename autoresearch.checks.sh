#!/bin/bash
set -euo pipefail
bun run test:unit 2>&1 | tail -5
bun run lint 2>&1 | tail -3
