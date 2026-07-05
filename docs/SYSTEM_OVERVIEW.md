# SYSTEM_OVERVIEW.md

## Projekt

Sverigekryss Engine

Målet är att skapa en webbaserad motor för Sverigekrysset där:

- Layouten är konstant mellan utgåvor
- Innehållet (bilder och ledtrådar) varierar
- Editor används för att definiera template
- Play används för att lösa korsordet
- Samma template ska kunna återanvändas vecka efter vecka

---

# Huvudsystem

Systemet består av följande subsystem:

## Editor

Ansvarar för:

- Import av korsordsunderlag
- Gridpositionering
- Gridstorlek
- Markering av celltyper
- Template-definition

EditorWorkspace äger editor composition:

- montering av EditorViewport
- montering av EditorLayer
- composition boundary för Editor-subsystemet
- editor-only state
- activeTool state
- pendingRows state
- pendingCols state

App.js monterar inte längre editor-komponenter direkt.

EditorToolbar äger:

- editor toolbar rendering
- cell type buttons
- create grid controls

Nya grids initierar cellTypes som array med empty-celler.

EditorViewport äger editor grid placement interaction:

- move/resize-drag
- musbaserad gridförflyttning och resize
- tangentbordsstyrd gridförflyttning och resize
- cell click mapping
- cell type updates baserat på activeTool

EditorLayer äger:

- EditorGrid-rendering
- editor overlay controls för move/resize

App.js renderar inte längre EditorGrid direkt.

Duplicerad EditorGrid-rendering har tagits bort utan visuell stylingändring.

App.js äger fortsatt:

- gridArea state
- cellTypes state
- workflow
- template state
- application workflow

Runtime ownership påverkas inte av EditorWorkspace.

Celltyper:

- image
- blocked
- double
- write

---

## Runtime

Ansvarar för:

- Visning av färdigt korsord
- Inmatning av svar
- Navigation
- Aktiv rad/kolumn
- Lösningsupplevelsen

RuntimeLayer äger runtime state, interaction/navigation, active line och runtime grid/cell-rendering.

Aktiv runtime-pipeline:

App.js
↓
RuntimeLayer
↓
RuntimeGrid
↓
RuntimeCell
↓
PlayCell

---

## TemplateCanvas

Ansvarar för delad template-presentation:

- canvas/surface för korsordet
- bakgrundsbild
- overlay-yta där Editor eller Runtime monteras

TemplateCanvas äger inte:

- Editor-beteende
- Runtime-beteende
- mode/workflow

App.js väljer fortsatt workflow och monterar rätt subsystem i TemplateCanvas.

Framtida Editor-ownership är separat från TemplateCanvas.

---

## Engine

Ansvarar för gemensam logik som inte ska ligga i UI-komponenter.

Exempel:

- navigation
- activeLine
- gridArea
- input-normalisering

---

## Shared Components

Shared Components contain reusable UI building blocks.

Responsibilities:

- Shared visual components
- Reusable UI elements
- No crossword business logic

Examples:

- PlayCell
- EditCell
- GridCell

Subsystem-specific components belong inside their respective subsystem:

- Editor components → `src/editor`
- Runtime components → `src/runtime`

---

# Arkitekturprinciper

## App.js är orchestrator

App.js ska koordinera subsystem.

Affärslogik ska successivt flyttas till respektive subsystem.

App.js väljer mode och monterar Editor eller Runtime.

TemplateCanvas äger delad template presentation shell:

- bakgrundsbild
- canvas
- placering av Editor/Runtime-overlay

Detta är inte RuntimeSession-beteende.

App.js äger fortsatt:

- mode-val
- workflow
- koppling mellan subsystem

Framtida separat arbete:

- flytta kvarvarande editor-specifikt ägarskap till Editor-subsystemet.

Runtime ownership påverkas inte av Editor ownership-steg.

---

## Editor och Runtime använder samma modell

Editor definierar:

- grid
- celltyper
- template

Runtime konsumerar samma data.

Det får aldrig finnas separata definitioner av korsordets struktur.

---

## En källa till sanningen

Systemet ska alltid ha:

- ett grid
- en uppsättning celltyper
- en template-definition

Dessa ska delas mellan Editor och Runtime.

---

# Dokumentation

Projektets officiella dokumentation:

- DEVELOPMENT_RULES.md
- SYSTEM_OVERVIEW.md
- RUNTIME_ARCHITECTURE.md
- CURRENT_STATE.md
- ROADMAP.md

Dessa dokument ska hållas uppdaterade när större milstolpar uppnås.

## Application Layer

The Application layer is responsible for:

- Application startup
- Routing
- High-level workflow
- Choosing between Editor and Runtime

The Application layer must not contain editor or runtime business logic.
