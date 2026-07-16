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

### Persistence Platform

Persistence Platform is a first-class subsystem.

Persistence stores Templates but does not define Template shape.

Template Lifecycle defines canonical Template v1 shape.

Persistence Platform owns durable storage and backend communication for Templates and persisted assets.

Frontend API:

- loadBackendTemplate(id)
- publishBackendTemplate(template)

Backend API:

- GET /
- POST /api/publish
- GET /api/crossword/:id
- GET /uploads/...

File-based backend storage:

- backend/templates stores published Template JSON files
- backend/uploads stores published image assets

Deployment configuration:

- frontend backend URL is configurable through REACT_APP_BACKEND_BASE_URL
- backend port is configurable through PORT
- public asset/backend URL is configurable through PUBLIC_BACKEND_BASE_URL
- local defaults remain unchanged
- .env.example and backend/.env.example document required variables
- storage, CORS, routes, payloads, Runtime, and deployment provider are unchanged

Persistence Platform does not own:

- Template shape
- Template normalization
- Editor behavior
- Runtime behavior
- App workflow

App.js remains the workflow orchestrator.

Runtime and Editor do not own persistence.

Future extension points:

- storage adapters
- backend validation
- API configuration
- persistence regression tests

### Template Lifecycle helper

Template Lifecycle owns canonical Template v1 construction.

createTemplate constructs Template v1 objects.

createTemplate normalizes cellTypes to an array with length:

rows * cols

exportTemplate uses createTemplate for canonical Template export.

templateExport owns Template file export behavior.

App.js delegates export behavior to templateExport.

Export still creates canonical Template v1.

templateImport owns JSON template parsing and normalization.

App.js delegates import behavior to templateImport.

App.js still owns Template state application.

templateApi owns backend template loading and normalization.

App.js delegates backend load to templateApi.

App.js remains the application orchestrator and applies Template state.

Persistence Platform frontend owns publish API communication through templateApi.

Persistence Platform frontend owns shared backend base URL configuration.

App.js delegates publish HTTP communication to templateApi.

Publish API rejects non-OK backend responses.

Backend error text is preserved when available.

App.js shows clear feedback for network and backend publish failures.

App.js still owns publish validation, payload construction, and workflow orchestration.

App.js shows publish success feedback with the public play URL.

Successful publish URL feedback is unchanged.

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

Loaded backend templates restore canonical Template v1 fields when present, including crosswordId.

Play.jsx delegates backend template loading to loadBackendTemplate in templateApi.

TemplateCanvas and RuntimeLayer receive normalized Template data in public play.

Persistence load respects non-OK backend responses before Template normalization.

404/error JSON is not normalized into a Template.

Public Play shows a clear load error state when backend template loading fails.

Successful TemplateCanvas -> RuntimeLayer flow is unchanged.

Runtime ownership is unchanged in this step.

Backend contract and Runtime behavior are unchanged in this step.

Publish workflow is unchanged.

State ownership is unchanged.

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
