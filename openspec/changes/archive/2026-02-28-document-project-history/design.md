## Context

OpenPencil is an open-source Figma alternative with 92 commits of development history (2026-02-27 to 2026-02-28). The project has a detailed PLAN.md (1565 lines) covering architecture, tools, phases, and validation criteria — but no structured specs tracking. The openspec/ directory was just initialized and is empty.

The git history shows work spanning PLAN.md Phases 1-3 (core engine, editor UI, file format/import) with partial progress on later phases. We need to retroactively create baseline specs and assess documentation tooling.

## Goals / Non-Goals

**Goals:**
- Create baseline openspec specs for all 19 implemented capabilities identified from git history
- Document planned-but-unimplemented capabilities from PLAN.md as future specs with status markers
- Provide a VitePress readiness assessment
- Establish the openspec specs/ directory as the living source of truth going forward

**Non-Goals:**
- Implementing any new features or code changes
- Setting up VitePress or any documentation generation tooling
- Creating specs for capabilities from figma-use that haven't been ported yet
- Writing design system documentation or API docs

## Decisions

### 1. Spec organization: one file per capability (flat structure)

Each capability gets `openspec/specs/<capability-name>/spec.md`. No nesting by phase or module — capabilities are cross-cutting and may span multiple source directories.

**Why:** Matches openspec convention. Flat structure is easier to discover and prevents debates about categorization hierarchy.

### 2. Implemented vs planned: status field in spec header

Each spec includes a `status` field: `implemented`, `partial`, or `planned`. This lets us track what exists in code vs what's only in PLAN.md.

**Why:** We need to clearly distinguish "this works today" from "this is the vision". Avoids confusion when reading specs.

### 3. Git commit mapping: reference commits in spec scenarios

Each spec's scenarios reference the git commits that implemented them. This creates traceability from spec → code history.

**Why:** Makes it possible to understand when a capability was added and what changed. Critical for a retroactive documentation effort.

### 4. VitePress assessment: included as a standalone report, not a spec

The VitePress evaluation is a one-time assessment, not an ongoing capability. It goes into the change's design artifacts, not into openspec/specs/.

**Why:** A spec describes system behavior. "Do we have VitePress?" is an assessment question, not a capability.

## Risks / Trade-offs

- **Spec drift from code** → Mitigation: specs describe observable behavior and capabilities, not implementation details. They should stay accurate even as internals change.
- **Retroactive specs may miss edge cases** → Mitigation: focus on what git commits prove was implemented. Don't speculate about undocumented behavior.
- **Large number of specs to create at once** → Mitigation: each spec is focused and concise. Scenarios reference commits rather than rewriting commit messages.

## VitePress Assessment

**Finding: No VitePress artifacts exist in the project.**

Evidence:
- No `vitepress` dependency in package.json or bun.lock
- No `docs/` directory
- No `.vitepress/` configuration directory
- No documentation generation scripts in package.json
- No references to VitePress or documentation generation in PLAN.md, README.md, or any source files
- PLAN.md Phase 6 mentions "documentation" as a deliverable but does not specify VitePress or any specific documentation tooling

**Current documentation state:**
- `README.md` — project overview, features, tech stack, getting started, project structure (concise, well-written)
- `PLAN.md` — comprehensive 1565-line design document covering architecture, tools, phases, validation (serves as both design doc and roadmap)
- No API documentation, no user guides, no developer guides beyond README

**Recommendation:** VitePress would be a natural fit for this project when documentation becomes a priority (Phase 6). The content from PLAN.md could be restructured into VitePress pages. However, there is currently zero infrastructure for it — it would need to be built from scratch.
