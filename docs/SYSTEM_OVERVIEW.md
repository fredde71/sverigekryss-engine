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

Editor interaction/UI ownership är slutförd.

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

Template state ligger kvar i App.js tills Template Lifecycle-subsystemet tar över.

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

## Template v1

Template representerar ett digitaliserat tryckt korsord.

Systemet digitaliserar befintliga tryckta korsord.

Systemet skapar inte korsord.

Obligatoriska fält:

- crosswordId
- rows
- cols
- cellTypes
- gridArea
- imageSrc

cellTypes är en array med exakt:

rows * cols

poster.

metadata är valfritt.

Template äger inte runtime state eller editor session state.

Editor modifierar Template.

Runtime konsumerar Template.

Persistence lagrar Template.

App.js orkestrerar endast.

Template Lifecycle äger:

- createTemplate
- normalizeTemplate
- templateExport
- templateImport
- templateApi
- canonical Template v1 construction
- canonical Template v1 input handling
- canonical Template v1 file export
- JSON template parsing and normalization
- backend template loading and normalization
- cellTypes-normalisering till array med längden rows * cols

Template Lifecycle äger template file export.

App.js delegerar export-beteende till templateExport.

Export skapar fortfarande canonical Template v1.

JSON import använder normalizeTemplate.

Template Lifecycle äger JSON template parsing and normalization.

App.js delegerar import-beteende till templateImport.

App.js äger fortsatt Template state application.

Importerade templates återställer canonical Template v1-fält när de finns.

Template Lifecycle äger backend template loading and normalization.

App.js delegerar backend load till templateApi.

App.js är fortsatt application orchestrator och applicerar Template state.

Laddade backend-templates återställer canonical Template v1-fält när de finns, inklusive crosswordId.

Play.jsx använder normalizeTemplate för backend-laddade templates.

TemplateCanvas och RuntimeLayer får normalized Template data i public play.

Backend error handling är oförändrad i detta steg.

App.js, publish och Runtime ownership är oförändrade i detta steg.

Backend contract och Runtime behavior är oförändrade i detta steg.

Publish är oförändrat.

State ownership är oförändrat.

URL data load är fortfarande oförändrad.

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
