#!/bin/bash
set -euo pipefail

# Compare gold-preview.fig import against Figma Plugin API ground truth.
# Outputs METRIC lines for the autoresearch dashboard.

FIXTURE=tests/fixtures/gold-preview.fig

# Run the comparison script
bun run autoresearch-compare.ts "$FIXTURE" 2>/dev/null
