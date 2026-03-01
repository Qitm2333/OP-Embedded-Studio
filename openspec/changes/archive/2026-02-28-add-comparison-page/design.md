## Context

`COMPARISON.md` in the project root contains an in-depth OpenPencil vs Penpot comparison: architecture, rendering, data model, layout engine, file format, state management, DX, performance. 10 sections, summary table. Not linked from docs.

## Goals / Non-Goals

**Goals:**
- Make comparison accessible in the VitePress docs under Guide section
- Preserve all content and formatting from the source

**Non-Goals:**
- No rewriting or restructuring the comparison content
- No removal of root `COMPARISON.md`
- No new pages beyond comparison

## Decisions

### Place after Tech Stack in Guide sidebar
The comparison is an architectural evaluation document. It logically follows Tech Stack (which explains choices) with Comparison (which justifies them against alternatives).

### Copy content, adapt title for docs context
The root file title is "Open Pencil vs Penpot: Architecture & Performance Comparison". For docs, keep content identical but ensure VitePress compatibility (code blocks, tables).

## Risks / Trade-offs

- [Content drift] Root COMPARISON.md and docs copy may diverge → acceptable, docs is the living version
