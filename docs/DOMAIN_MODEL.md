# Domain Model

## Purpose

This document defines the core domain objects of the crossword platform.

The goal is to clearly separate responsibilities between the different parts of the system.

Architecture decisions should always follow this document.

---

# Core Domain Objects

## 1. Crossword

A Crossword represents one finished crossword as a domain object.

The crossword content originates from a completed printed puzzle source.

The platform does not generate Crossword content.

A Crossword can have one or more Publications.

Model:

Crossword

↓

Publication(s)

## 2. Publication

A Publication represents one publishing instance of a Crossword.

One Crossword can be published in several newspapers, groups, weeks or channels.

Each Publication owns publication-specific operational data:

- publicationId
- tidning
- grupp
- publiceringsdatum
- publiceringsvecka
- status
- URL
- statistik

Statistics are stored per Publication, not per Crossword.

This allows the same Crossword to be reused or distributed in several contexts while preserving separate publication status, public URL and reporting.

## 3. Template

A Template represents a digitized printed puzzle.

The platform digitalizes existing printed puzzles.

The platform does not create puzzles.

A Template is the canonical digital representation of the printed source.

A Template contains no runtime state.

### Template v1 required fields

- crosswordId
- crosswordType
- rows
- cols
- cellTypes
- gridArea
- cropArea
- imageSrc

### Field rules

`crosswordType` är `sverigekryss` eller `musikkryss`. Äldre Template-data utan
fältet normaliseras till `sverigekryss`.

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

gridArea represents the placement of the interactive grid over the rendered puzzle surface.

cropArea is canonical Template v1 data.

cropArea represents the source-page crop used to show only the crossword area from the digitized printed source.

cropArea is stored in the original 1200x1200 source coordinate space.

When cropArea is missing, Template Lifecycle defaults it to the full canvas:

- top: 0
- left: 0
- width: 1200
- height: 1200

Legacy Templates without cropArea remain compatible.

cropArea is separate from gridArea:

- cropArea defines which part of the source page is visible
- gridArea defines where the interactive grid sits on the rendered puzzle surface

Template Lifecycle owns cropArea data.

Editor will define and adjust cropArea.

TemplateCanvas will render the cropped surface.

Runtime remains unaware of source-page cropping.

No Editor, TemplateCanvas, Runtime, backend, or visual crop behavior changed when cropArea became canonical Template data.

imageSrc references the digitized printed puzzle image.

Template may also persist shared grid geometry:

- horizontalLinePositions
- verticalLinePositions

The fields form one optional pair. A complete pair contains `rows + 1` and `cols + 1` finite, strictly increasing positions in document coordinates. Editor and Runtime consume the same positions. Legacy Templates without them retain uniform grid subdivision.

Template may persist ordered answer paths:

- `answerPaths[].clueIndex`
- `answerPaths[].paths[].direction`
- `answerPaths[].paths[].cellIndexes`

Each path is an ordered list of writable cell indexes and may change geometric direction. A `blocked` single-clue cell owns at most one path. A `double` clue cell owns at most two paths, one per direction slot. Runtime uses an explicit path when present and preserves topology-based straight-path inference for legacy Templates.

Template may persist competition positions as:

```text
competitionCells[] = { index, position }
```

`index` identifies a writable cell and `position` identifies one of the competition answer positions 1–6. Competition solution assembly consumes this mapping without changing cell type semantics.

En Template med `crosswordType: "musikkryss"` kan dessutom innehålla:

- `musikkryss.formatId`
- `musikkryss.introScript`
- `musikkryss.answers[].number`
- `musikkryss.answers[].direction`
- `musikkryss.answers[].answerPath`
- `musikkryss.answers[].contentSequence`
- `musikkryss.answers[].solution`

Ett Musikkryss-svar identifieras unikt av `number + direction`, där riktningen är
`across` eller `down`. Samma tryckta nummer kan därför äga både ett vågrätt och
ett lodrätt svar. Varje svar äger sin egen ordnade lista av skrivbara cellindex
och sin egen content sequence. Det fasta 10 × 9-formatet har 13 numrerade
startceller och 15 svar; svarsvägarna härleds deterministiskt från formatets
skrivbara/icke-skrivbara topologi och författas inte manuellt.

Den nuvarande content sequence består av redigerbar text. Runtime konsumerar
`musikkryss.answers` genom delad Play/Runtime-infrastruktur. Audio,
intro-uppspelning och AI-röst ingår ännu inte i domänbeteendet.

### MusikkryssFormat

`MusikkryssFormat` är en immutabel, återanvändbar formatdefinition och äger:

- format-ID och version
- 9 × 10 grid-dimensioner för det nuvarande formatet
- normaliserad dokumentplacering och linjegeometri
- fast skrivbar/icke-skrivbar celltopologi
- numrerade startceller
- topologiskt härledda riktningssvar och deras ordnade paths

`MusikkryssFormatCatalog` väljer format utan filnamnslogik.
`MusikkryssTemplateInitializer` kopierar vald formatstruktur till en ny
Musikkryss-Template och materialiserar grid/linjer mot uppladdningens
dokumentdimensioner. Formatet är generellt katalogiserat för framtida format;
den offline-källa som användes för att bekräfta nuvarande format är inte ett
runtime-beroende.

### MusikkryssWeeklyContentImport

`MusikkryssWeeklyContentImport` äger validering och normalisering av ett levererat
veckoinnehåll. Kontraktet innehåller:

- `formatId`
- issue-metadata (`crosswordId`, titel, nummer, publiceringsvecka/-datum och
  producentreferens)
- `introScript`
- ett svar per `number + direction`, med textbaserad `contentSequence` och
  kanonisk `solution`

Kontraktet innehåller inte topologi, geometri eller svarsvägar. Dessa hämtas
alltid från valt `MusikkryssFormat`. Importen avvisar saknade, duplicerade och
oväntade svar, tomma manus, ogiltiga lösningslängder och konflikter i korsande
celler. Ett giltigt resultat innehåller normaliserat issue-innehåll i formatets
deterministiska svarsordning; ett ogiltigt resultat innehåller `content: null`
och explicit diagnostik. Operationen är ren och får inte mutera Template,
dokument, grid eller Editor-session.

Excel, CSV och JSON är endast transport-/parseradaptrar in i detta kontrakt.
Den explicita referenspacken är utvecklingsdata och är inte ett standardvärde
för framtida Musikkryss-issues.

### Canonical solutions and publication access

Kanoniska lösningar ägs av Template: Musikkryss lagrar dem per riktningssvar och
Sverigekryss per befintlig svarsväg. Ett gemensamt lösningsindex validerar längd,
kompletthet och gemensamma bokstäver i korsningar.

En `Publication` refererar ett immutabelt crossword snapshot. Solve-access får en
projektion där kanoniska lösningar är borttagna. Help-access kräver både explicit
aktivering efter publicering och en separat ogissningsbar `helpAccessToken`;
saknad eller felaktig token beter sig som Solve. Help/reveal-state är Runtime-data
och muterar inte snapshot eller Template.

### Optional fields

- competitionCells
- answerPaths
- horizontalLinePositions and verticalLinePositions
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
- backend storage directories are configurable through TEMPLATE_STORAGE_DIR and UPLOAD_STORAGE_DIR
- local storage defaults remain backend/templates and backend/uploads
- production can use persistent disk paths such as /var/data/templates and /var/data/uploads
- backend creates storage directories at startup
- API routes, payloads, image URLs, CORS, frontend, Template shape, Runtime, and deployment provider are unchanged

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

Template reloads explicitly bypass browser/proxy caches. The frontend requests `cache: no-store`, and the backend responds with `Cache-Control: no-store`, so published Browser/Play receives the latest persisted Template.

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

## Grid Reconstruction Geometry

`GridLattice` is the selected mathematical and topological reconstruction. It owns dimensions, lattice origins, periods, modeled line-center positions, and modeled outer line-center extent.

`OuterVisualExtent` is independent observed geometry for the visible outer footprint of the printed grid.

`GridFormatGeometry` is reusable normalized internal line geometry for one grid format. It is independent of a specific uploaded document. Production selects a compatible catalog entry deterministically from accepted indexed anchors; document position and scale continue to come from the current upload through `OuterVisualExtent`.

`GridLatticeEditorProposal` is the Digitization-to-Editor boundary. It combines:

- rows and columns from `GridLattice`
- grid area from `OuterVisualExtent`
- explicit line positions from selected `GridFormatGeometry`, mapped into document coordinates
- mathematical `GridLattice` line positions as the safe fallback when format selection is unavailable or ambiguous

Digitization owns reconstruction and coordinate provenance. Editor owns application and subsequent manual editing of the proposal. `App.js` only orchestrates the handoff.

---

## Digitization Dataset Item

A Digitization Dataset is an ordered collection of independently identified dataset items.

Each dataset item owns the association between its item ID and any available:

- source document
- human-confirmed Ground Truth
- production, experiment, observation, and validation diagnostics

These artifacts may be created independently, but they must retain the exact dataset item identity and source filename. Human-confirmed Ground Truth belongs to one specific dataset item; it is not shared Ground Truth for the dataset as a whole.

A dataset-level Ground Truth artifact is the deterministic, ordered collection and export boundary for per-item annotations. It does not change their per-item ownership.

Multi-document annotation is the canonical workflow. A developer selects one dataset item as the active annotation target, loads its source document, and confirms its Ground Truth independently before moving to another item. Draft geometry, including geometry copied from another item, remains unconfirmed and is not Ground Truth until explicitly confirmed for the active item.

---

## 2. RuntimeSession

Represents one user solving one crossword.

Created when a crossword is opened.

Destroyed when the session ends.

### Owns

- answers
- activeCell
- direction
- clueSelection
- inputRefs

Future candidates

- elapsedTime
- completedWords
- mistakes
- score

---

## 3. EditorSession

Represents the editor while building a crossword.

Editor sessions are keyed by `crosswordType`. Sverigekryss and Musikkryss own
independent sessions, and switching the active type does not mutate the inactive
session. An unused session starts without an active document.

### Owns

- activeTool
- pendingRows
- pendingCols
- dragState
- resizeState
- answer-path authoring selection and draft state
- competition-cell assignment selection
- document lifecycle reset state
- zoom
- scroll
- uploaded document/image and filename
- document size and crop
- Template/editable state
- grid/editor state
- Digitization result and proposal

Asynchronous upload and Digitization completion belongs to the session where
the operation originated.

Future candidates

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
