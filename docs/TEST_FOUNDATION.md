# Test Foundation

## Purpose

This document identifies the critical end-to-end workflows that should become automated regression tests.

The first priority is protecting demo-critical behavior and the ownership boundaries established by the Runtime, TemplateCanvas, Editor, and Template Lifecycle work.

---

# Implemented Test Packages

## Template Lifecycle Unit Tests

Status:

Implemented.

Coverage:

- createTemplate returns canonical Template v1 fields
- createTemplate normalizes cellTypes to rows * cols
- normalizeTemplate applies defaults and normalizes cellTypes
- runtime/editor session fields are excluded from Template output

The obsolete CRA default App.test.js test was replaced.

Verification:

- 4 tests pass using the existing CRA/Jest setup

---

## Persistence Frontend API Integration Tests

Status:

Implemented.

Coverage:

- loadBackendTemplate uses the configured backend URL
- loadBackendTemplate returns normalized Template data
- publishBackendTemplate posts the unchanged payload
- publishBackendTemplate returns parsed backend JSON

fetch and response.json are mocked.

normalizeTemplate remains real.

Verification:

- total automated tests: 7

---

## Runtime Engine Unit Tests

Status:

Implemented.

Coverage:

- input normalization
- navigation and direction behavior
- boundary handling
- active line behavior
- double clue behavior
- grid movement
- keyboard navigation

Runtime engine logic now has automated unit coverage.

Verification:

- moveGridArea is protected
- getArrowNextIndex is protected
- total automated tests: 24

---

# Demo-Critical Subset

These workflows must be prioritized first for automated coverage:

- Upload image/PDF
- Create grid
- Mark cells
- Publish with crosswordId
- Open public play page
- Runtime play interaction

---

# Responsive Strategy

Editor is desktop-first for production work.

Public Play must support mobile and tablet.

Responsive Public Runtime is a Version 1.0 requirement.

Responsive work must not be mixed with Template Lifecycle or Editor ownership changes.

First responsive package:

- Public Play uses responsive TemplateCanvas scaling
- internal coordinate system remains 1200x1200
- image and Runtime overlay scale together
- Editor behavior is unchanged
- Runtime logic and gridArea shape are unchanged
- PlayCell styling is unchanged because current scaling is sufficient

---

# Top 10 E2E Regression Workflows

## 1. Create New Editor Grid

Demo-critical: yes

Purpose:

Verify editor-only toolbar state and grid creation.

Expected outcome:

Entering rows and cols, then creating a grid, updates the visible editor grid and initializes all cells as `empty`.

Subsystems covered:

- EditorWorkspace
- EditorToolbar
- EditorLayer
- EditorGrid
- App.js template state

## 2. Mark Cell Types In Editor

Demo-critical: yes

Purpose:

Ensure editor cell marking remains owned by EditorViewport and correctly updates Template state.

Expected outcome:

Selecting `image`, `blocked`, `double`, `write`, or `empty`, then clicking cells, visually marks the correct cell type.

Subsystems covered:

- EditorToolbar
- EditorViewport
- EditorLayer
- EditorGrid
- App.js template state

## 3. Move And Resize Grid Overlay

Demo-critical: no

Purpose:

Protect editor grid placement interaction after ownership moves.

Expected outcome:

Move and resize controls update `gridArea`, and the overlay remains aligned on the template image.

Subsystems covered:

- EditorViewport
- EditorLayer
- TemplateCanvas
- App.js template state

## 4. Upload Printed Puzzle Image Or PDF

Demo-critical: yes

Purpose:

Verify that a digitized printed puzzle source can be loaded into the template presentation shell.

Expected outcome:

An uploaded image or the first page of an uploaded PDF appears as the TemplateCanvas background.

Subsystems covered:

- App.js upload flow
- TemplateCanvas
- PDF upload flow
- Template image state

## 5. Export Canonical Template

Demo-critical: no

Purpose:

Protect canonical Template v1 creation.

Expected outcome:

Exported JSON includes `crosswordId`, `rows`, `cols`, `gridArea`, `imageSrc`, and `cellTypes` as an array of length `rows * cols`.

The exported Template contains no runtime state and no editor session state.

Subsystems covered:

- templateModel.createTemplate
- App.js export flow
- Template Lifecycle

## 6. Import Template Into Editor

Demo-critical: no

Purpose:

Ensure existing digitized templates still load for editing.

Expected outcome:

Imported template restores the background image, grid placement, and cell markings without crashing.

Subsystems covered:

- App.js import flow
- TemplateCanvas
- EditorWorkspace
- EditorLayer

## 7. Publish Validation Without Crossword ID

Demo-critical: no

Purpose:

Prevent failed backend calls and protect the publish user experience.

Expected outcome:

Clicking Publish with a blank `crosswordId` shows a clear message and does not call `/api/publish`.

Subsystems covered:

- App.js publish workflow
- Template Lifecycle boundary

## 8. Publish Template With Crossword ID

Demo-critical: yes

Purpose:

Verify the persistence path works with the current backend contract.

Expected outcome:

Publishing with a non-empty `crosswordId` sends `POST /api/publish`, receives a success response, and stores JSON with the expected Template fields.

Subsystems covered:

- App.js publish workflow
- Backend persistence
- Template model shape

## 9. Open Public Play Page

Demo-critical: yes

Purpose:

Protect public rendering of published templates.

Expected outcome:

Opening `/play/:id` loads the saved template, renders the printed puzzle image through TemplateCanvas, and overlays runtime cells correctly.

Subsystems covered:

- Play.jsx
- Backend load endpoint
- TemplateCanvas
- RuntimeLayer

## 10. Runtime Play Interaction

Demo-critical: yes

Purpose:

Protect Runtime ownership behavior and the solving experience.

Expected outcome:

Clicking write cells selects the active line.

Typing fills answers and advances focus.

Double clue cells select direction but are not writable.

Blocked and image cells are not interactive.

Subsystems covered:

- RuntimeLayer
- RuntimeGrid
- RuntimeCell
- PlayCell
- engine/navigation
- engine/activeLine
- engine/input
