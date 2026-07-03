# Domain Model

## Purpose

This document defines the core domain objects of the crossword platform.

The goal is to clearly separate responsibilities between the different parts of the system.

Architecture decisions should always follow this document.

---

# Core Domain Objects

## 1. Template

Represents a published crossword template.

A Template contains no runtime state.

### Owns

- crosswordId
- rows
- cols
- cellTypes
- imageSrc
- gridArea

### Does NOT own

- answers
- activeCell
- direction
- inputRefs

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