## Why

README gained a "Why" section explaining OpenPencil's motivation (Figma closing CDP access, supply chain problem, open-source alternative). The docs landing page, comparison page, and features page don't reflect this narrative. The docs still present OpenPencil generically as "AI-native design editor" without the motivation story.

## What Changes

- Update `docs/index.md` landing page hero tagline and features to incorporate the motivation narrative (open source, Figma-compatible, AI-native, fully local, programmable)
- Update `docs/guide/comparison.md` intro to reference the motivation (why an alternative matters)
- Update `docs/guide/features.md` to add a "Why OpenPencil" section at the top, derived from README
- Update `docs/user-guide/index.md` intro to align with the motivation messaging

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `vitepress-docs`: Landing page hero/features and comparison intro updated to reflect the README motivation section
- `userdoc-articles`: User guide landing page intro updated with motivation messaging

## Impact

- `docs/index.md` — hero text and feature cards
- `docs/guide/comparison.md` — intro paragraph
- `docs/guide/features.md` — new intro section
- `docs/user-guide/index.md` — intro text
- No code changes, no dependency changes
