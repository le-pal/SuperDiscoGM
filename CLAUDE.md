# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

Pre-implementation: this repo currently holds the functional specification (`doc/`) and a static visual mockup (`maquette/`) for **SuperDiscoGM**, a virtual game-master (JDR) app. There is no application code, build system, or test suite yet — no commands to run.

## Working with the maquette (`maquette/`)

- Plain static HTML/CSS, no build step. Open any `.html` file directly in a browser (`file://`) — pages link to each other with relative paths and share `maquette/css/style.css`.
- `maquette/css/style.css` is the single design system: CSS custom properties on `:root` (colors, spacing, radii) reused across every page — extend the palette there rather than hardcoding new colors inline.
- Per-player identity color: each player has one fixed accent (`--p1`…`--p4`) applied consistently to both the avatar background and the message bubble border (`.msg.p1`, `.msg.p2`, ...) — that border is how a message is identified at a glance. The MJ-IA uses a separate `--mj` color, never one of the player slots.
- `ecran-partie.html` has two demo-only controls (viewer switcher, ambiance switcher) wired by the inline `<script>` at the bottom of the file. They exist only to demonstrate two product behaviors on one static page — per-viewer message visibility for the private "party split" channel, and a preview of the anticipated location-based ambiance theming — and are explicitly *not* real product UI (a real user never sees a "view as" dropdown); the on-page caption says so.
- Ambiance theming works by overriding CSS custom properties on `.partie-shell[data-ambiance="..."]` (grotte/jungle/ville) — only the "world/MJ" colors shift; player identity colors never change.

## Working with the spec (`doc/`)

- Entry point is `doc/index.md`. The functional spec is split by domain ("lot") under `doc/admin/`, `doc/scenario/`, `doc/partie/`, `doc/technique/`, each with a `spec.md` (decided state) and a `questions.md` (open + resolved questions log). `doc/roadmap.md` holds the V1→V4 plan.
- Every question has a single globally-unique ID (`Q01`, `Q02`, ...) even though questions live in different files by domain — never reuse or renumber an existing ID; continue the global sequence with the next free number regardless of which domain file it lands in.
- `questions.md` status markers: `[ ]` open, `[x]` resolved. A resolved question keeps its full original text plus a `→ **Décision : ...**` line stating what was decided and why.
- `spec.md` statements are tagged with the deciding question ID in backticks (e.g. `` `[Q19]` ``); anything not yet decided is written as `` `TBD [Qxx]` `` pointing at the open question — never left silently unstated or assumed.
