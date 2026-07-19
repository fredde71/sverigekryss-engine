# Project Handover

Last Updated: 2026-07-01

---

# Current Goal

Build a production-ready platform for creating and solving Swedish-style crossword puzzles.

The current focus is architecture before feature expansion.

---

# Current Epic

## Epic 1 – Build Runtime

### Goal

Runtime must become a completely independent subsystem.

When Epic 1 is finished:

- App.js contains no runtime logic.
- RuntimeLayer owns all runtime state.
- RuntimeLayer owns runtime rendering.
- RuntimeLayer owns runtime interaction.
- Play mode works identically before and after the migration.

---

# Current Status

Completed

- RuntimeLayer introduced
- Play Mode migrated to RuntimeLayer
- Runtime functioning again
- App ownership of inputRefs removed
- Unused Runtime imports removed from App

In Progress

- Runtime ownership separation

Remaining

- Runtime calculations
- Runtime event handlers
- Runtime state
- Runtime rendering boundary
- Runtime share/session model

---

# Current Architecture

Subsystems

- App
- Editor
- Runtime
- Engine
- Components
- Backend

Ownership is documented in:

docs/DOMAIN_MODEL.md

---

# Development Method

We work in small verified steps.

Workflow:

1. Verify
2. Ownership
3. Migration
4. Test
5. Commit

Never mix cleanup with ownership changes.

---

# Architecture Principles

- Architecture before implementation.
- Move responsibilities before moving code.
- Every state has exactly one owner.
- Components should have a single responsibility.
- App orchestrates but should not contain subsystem logic.

---

# Open Decisions

- Final Runtime public API
- RuntimeSession model
- Share-link architecture
- Editor ownership migration
- API layer separation

---

# Next Task

Epic 1

Ownership Package

Runtime Calculations

Verify that App no longer owns:

- activeCells
- getActiveCells

If verified:

Move this ownership package.

---

# Known Issues

Current functional regressions (to be addressed after ownership migration):

- Active line highlighting
- Double clue behavior

These are intentionally postponed until Runtime ownership is complete.

---

# Notes

This project is developed with:

- ChatGPT as technical architect
- Codex as implementation agent
- GitHub as source of truth
- VS Code as development environment