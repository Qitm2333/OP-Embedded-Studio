## Context

The README now has a "Why" section with 5 bullet points: open source, Figma-compatible, AI-native, fully local, programmable. The docs site doesn't reflect this messaging.

## Goals / Non-Goals

**Goals:**
- Bring the motivation narrative from README into the docs site's key pages
- Consistent messaging across landing, features, comparison, and user guide

**Non-Goals:**
- Rewriting existing feature documentation
- Adding new feature coverage
- Changing the site structure

## Decisions

**Landing page**: Update hero tagline to "Figma-compatible, AI-first, fully local" (matches README). Update feature cards to emphasize the 5 pillars.

**Features page**: Add a brief "Why OpenPencil" intro section before the feature list, derived from README's Why section. Keep concise — 2-3 sentences max, not a copy of the full README section.

**Comparison page**: Add a motivation paragraph to the intro explaining why architectural comparison matters (open vs closed platform).

**User guide**: Light touch — update intro to mention "open-source, Figma-compatible" positioning.

## Risks / Trade-offs

- [Drift] README and docs could diverge again → docs reference the same narrative, not copy it
