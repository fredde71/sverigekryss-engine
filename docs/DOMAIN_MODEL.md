# Domain Model

## Purpose

This document defines the core domain objects of the crossword platform.

The goal is to clearly separate responsibilities between the different parts of the system.

Architecture decisions should always follow this document.

---

# Core Domain Objects

## 1. Template

A Template represents a digitized printed puzzle.

The platform digitalizes existing printed puzzles.

The platform does not create puzzles.

A Template is the canonical digital representation of the printed source.

A Template contains no runtime state.

### Template v1 required fields

- crosswordId
- rows
- cols
- cellTypes
- gridArea
- imageSrc

### Field rules

cellTypes must be an array with exactly:

rows * cols

entries.

Each entry represents the cell type at that grid index.

Supported v1 cell types:

- image
- blocked
- double
- write
- empty

gridArea represents the placement of the interactive grid over the digitized printed puzzle image.

imageSrc references the digitized printed puzzle image.

### Optional fields

- metadata

metadata may contain descriptive or operational information such as title, publisher, issue date, source filename, creation time, update time, or notes.

metadata must not be required for Runtime.

### Does NOT own

- answers
- activeCell
- direction
- inputRefs
- activeTool
- pendingRows
- pendingCols
- dragState
- resizeState

### Lifecycle ownership

Editor modifies Template.

Runtime consumes Template.

Persistence stores Template.

App orchestrates only.

### Template Lifecycle helper

Template Lifecycle owns canonical Template v1 construction.

createTemplate constructs Template v1 objects.

createTemplate normalizes cellTypes to an array with length:

rows * cols

exportTemplate uses createTemplate for canonical Template export.

normalizeTemplate handles canonical Template v1 input.

normalizeTemplate preserves:

- crosswordId
- rows
- cols
- cellTypes
- gridArea
- imageSrc
- metadata

JSON import uses normalizeTemplate.

Imported templates restore canonical Template v1 fields when present.

App.js backend load uses normalizeTemplate.

Loaded backend templates restore canonical Template v1 fields when present, including crosswordId.

Play.jsx uses normalizeTemplate for backend-loaded templates.

TemplateCanvas and RuntimeLayer receive normalized Template data in public play.

Backend error handling is unchanged in this step.

App.js, publish, and Runtime ownership are unchanged in this step.

URL data load is still unchanged.

---

## 2. RuntimeSession

Represents one user solving one crossword.

Created when a crossword is opened.

Destroyed when the session ends.

### Owns

- answers
- activeCell
- direction
- inputRefs

Future candidates

- elapsedTime
- completedWords
- mistakes
- score

---

## 3. EditorSession

Represents the editor while building a crossword.

### Owns

- activeTool
- pendingRows
- pendingCols
- dragState
- resizeState

Future candidates

- zoom
- selection
- undo
- redo

---

## 4. Puzzle (Future)

Represents the complete crossword product.

### Owns

- title
- publisher
- publishDate
- clues
- metadata
- template

---

# Container Responsibilities

## App

Responsibilities

- Application shell
- Routing
- Chooses Editor or Runtime
- Coordinates high-level workflow

App must not contain runtime logic.

---

## Editor

Responsibilities

- Build templates
- Upload images/PDF
- Grid editing
- Publishing

Editor owns EditorSession.

---

## Runtime

Responsibilities

- Solve crossword
- Input handling
- Navigation
- Active line
- Runtime rendering

Runtime owns RuntimeSession.

---

## Engine

Responsibilities

Pure business logic only.

Examples

- navigation
- activeLine
- input normalization
- grid utilities

Engine contains no React state.

---

## Components

Reusable UI components only.

Components contain no crossword business logic.

---

# Ownership Rule

Every piece of state has exactly one owner.

No state may have multiple owners.

Communication between containers must happen through explicit interfaces.

---

# Public Runtime API

Long-term goal

```jsx
<RuntimeLayer template={template} />
```

RuntimeLayer owns all runtime state internally.

---

# Public Editor API

Long-term goal

```jsx
<EditorLayer template={template} />
```

EditorLayer owns all editor state internally.

---

# Guiding Principle

We move responsibilities before we move code.

The architecture defines the implementation.

The implementation must never define the architecture.

No implementation details are allowed in this document.
