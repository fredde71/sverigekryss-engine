# SYSTEM_OVERVIEW.md

## Projekt

Sverigekryss Engine

Målet är att skapa en webbaserad motor för Sverigekrysset där:

- Layouten är konstant mellan utgåvor
- Innehållet (bilder och ledtrådar) varierar
- Editor används för att definiera template
- Play används för att lösa korsordet
- Samma template ska kunna återanvändas vecka efter vecka

Plattformens vision:

"Från en PDF till ett färdigpublicerat digitalt korsord med så lite manuellt arbete som möjligt."

Plattformen omfattar digitalisering, AI-stöd, publicering, automatisering och statistik.

Wordex hanterar redan kundportal, kundmappar och distribution.

Sverigekryss Engine fokuserar därför på AI-assisterad produktion och digitalisering:

- import av färdiga PDF:er och bildunderlag
- redaktörsstyrd markering av korsordets digitala struktur
- publicerbara digitala templates
- spelbar Runtime
- framtida automation kring produktion, publicering och statistik

---

# Huvudsystem

Systemet består av följande subsystem:

## Digitization

Ansvarar för tekniska analyssteg som kan ge redaktören förslag inför manuell digitalisering.

Digitization är separat från:

- Template Lifecycle
- Editor UI
- Runtime
- API/backend
- persistence

Aktuellt implementerat digitization-steg:

- AnalysisContext
- context-stöd i gridDetectionEngine
- imageGridDetectionEngine
- DigitizationEngine
- DigitizationRunner
- DigitizationJob
- ren analyskedja för RGBA-bilder:
  - BinaryImage
  - Projection
  - LineCandidate
  - GridGeometry
  - GridDetection
- AnalysisRegion-scoped GridAnalysis
- produktionsägd evidens för GridLattice-rekonstruktion
- primitive-period-evidens och source-neutral factored bounds
- GridLatticeReconstructionPipeline
- separata domänresultat för GridLattice och OuterVisualExtent
- GridLatticeEditorProposal som gräns till Editor

Projection validerar BinaryImage-dimensioner, datalängd och binära pixelvärden innan rad- eller kolumnprojektion skapas.

Projection-resultat är `Uint32Array` för att undvika 16-bitars overflow i större bilder.

LineCandidate validerar projektioner, `axisLength` och `minCoverageRatio` innan kandidater beräknas.

GridDetection klonar och djupfryser geometri och diagnostics så att detektionens resultat inte kan muteras via senare ändringar i indata.

AnalysisContext är ett immutabelt tekniskt arbetsobjekt för analyskedjan.

AnalysisContext äger inte:

- Template-shape
- UI-state
- backend state
- OCR-resultat
- persistence

Typed arrays i AnalysisContext lagras som defensiva interna kopior.

Typed-array-fält exponeras som nya defensiva kopior vid läsning så att standardbeteenden som instanceof, ArrayBuffer.isView, iteratorer, slice och subarray fungerar utan att context kan muteras.

gridDetectionEngine är enda bron mellan teknisk GridDetection och DigitizationSuggestion-domänobjektet.

imageGridDetectionEngine:

- läser ImageData exakt en gång via injicerad readImageData
- behandlar pixeldata som read-only
- binariserar RGBA med explicit threshold
- hanterar alfa genom att kompositera transparenta pixlar över vit bakgrund före threshold
- bygger AnalysisContext stegvis genom tillgänglig analyskedja
- skapar DigitizationSuggestion endast när GridDetection har godkänd geometri
- returnerar diagnostics och tom suggestions-lista när grid saknas

DigitizationEngine:

- orkestrerar ett DigitizationJob genom imageGridDetectionEngine
- bevarar diagnostics, GridDetection och DigitizationSuggestion-lista från analysflödet
- bygger normaliserad produktionsägd rekonstruktionsevidens utan experiment-, dataset-, validerings- eller Ground Truth-beroenden
- kör GridLatticeReconstructionPipeline och exponerar resultatet till applikationsorkestreringen
- returnerar ett deterministiskt, immutabelt körresultat

DigitizationRunner:

- är en tunn körningsadapter för ett eller flera DigitizationJob
- kör flera jobb i angiven ordning
- äger inte analyslogik

Verifierad produktionskedja:

```text
DigitizationEngine
  → GridLatticeReconstructionPipeline
  → selected GridLattice
  → OuterVisualExtent
  → GridLatticeEditorProposal
  → EditorWorkspace
  → EditorGrid
```

`GridLattice.extent` representerar modellerad yttre linjecentrumgeometri. `OuterVisualExtent` representerar separat det observerade synliga yttre avtrycket. Editor-förslaget kombinerar rader/kolumner och explicita linjepositioner från `GridLattice` med `gridArea` från `OuterVisualExtent`; koordinatproveniens bevaras genom gränsen.

Den verifierade Wordex-källan rekonstrueras som 25 × 25 och når Editor som ett redigerbart förslag. Digitization Lab är development-only och separat från produktionskedjan. Ground Truth, valideringsrapporter, dataset och experiment är inte produktionsberoenden.

OCR, API/backend/persistence-koppling samt avancerad automatisk cell- och ledtrådsklassificering är inte implementerade i detta steg.

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
- crop movement mode
- crop resize mode
- atomisk applicering och fortsatt ägarskap av GridLattice-baserade Editor-förslag

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
- crop drag interaction
- crop resize interaction
- cell click mapping
- cell type updates baserat på activeTool

EditorLayer äger:

- EditorGrid-rendering
- editor overlay controls för move/resize
- cropArea-rendering som distinct editor overlay
- crop movement start från crop move affordance
- crop resize start från crop resize affordance

EditorGrid renderar explicita rekonstruerade horisontella och vertikala linjepositioner när de finns i Editor-state. När sådana positioner saknas bevaras befintlig manuell och uniform grid-rendering.

App.js renderar inte längre EditorGrid direkt.

Duplicerad EditorGrid-rendering har tagits bort utan visuell stylingändring.

App.js äger fortsatt:

- workflow
- template state
- application workflow
- tunn orkestrering från Digitization-resultat via GridLatticeEditorProposal till EditorWorkspace

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

Public Play använder responsive TemplateCanvas-skalning.

TemplateCanvas behåller intern source coordinate system på 1200x1200.

I public responsive mode skalar image och Runtime overlay tillsammans.

Editor behavior är oförändrat.

Runtime logic och gridArea shape är oförändrade.

PlayCell styling är oförändrad eftersom nuvarande canvas-skalning är tillräcklig i detta steg.

Planned Version 1 capability:

- Puzzle Crop / Source Crop
- Public Play should show only the crossword area, not the full PDF page
- cropArea är canonical Template v1-data
- cropArea använder original 1200x1200 source coordinates
- missing cropArea defaultar till full canvas
- legacy Templates är fortsatt kompatibla
- cropArea är separat från gridArea
- gridArea är fortsatt separat och oförändrad
- Template Lifecycle äger cropArea data
- App.js äger cropArea med canonical full-canvas default tills Template state flyttas
- cropArea deltar i import, export, publish och backend load state flow
- Editor definierar och justerar cropArea
- EditorWorkspace äger crop movement mode
- EditorWorkspace äger crop resize mode
- EditorViewport äger crop drag interaction
- EditorViewport äger crop resize interaction
- EditorLayer renderar cropArea som distinct editor overlay
- EditorLayer startar crop movement från crop move affordance
- EditorLayer startar crop resize från crop resize affordance
- crop movement uppdaterar endast cropArea top/left
- crop width/height är oförändrade
- crop movement clamped till 1200x1200 source surface
- crop resize uppdaterar endast cropArea width/height
- crop resize behåller cropArea top/left oförändrade
- crop resize clamped mellan minimum editor size och 1200x1200 source surface
- crop move och grid editing fortsätter fungera oberoende
- Puzzle Crop Version 1 är functionally complete
- TemplateCanvas renderar cropArea som visible viewport
- intern source surface är fortsatt 1200x1200
- image och overlay översätts tillsammans i en delad surface
- responsive scaling använder cropped aspect ratio
- RuntimeLayer och gridArea semantics är oförändrade
- Runtime är omedvetet om source-page cropping
- ingen Editor, TemplateCanvas, Runtime, backend eller visual crop behavior ändrades i domain-model foundation
- TemplateCanvas rendering, Runtime, gridArea semantics och backend contract är oförändrade i cropArea state plumbing
- grid overlay behavior är oförändrat i Editor crop overlay package
- gridArea och existing grid interaction är oförändrade i crop move interaction package
- Runtime, TemplateCanvas, persistence och App ownership är oförändrade i Editor crop overlay, crop move och crop resize interaction packages
- manual verification bekräftade crop, alignment, input, direction och responsive behavior

App.js väljer fortsatt workflow och monterar rätt subsystem i TemplateCanvas.

Framtida Editor-ownership är separat från TemplateCanvas.

---

## Persistence Platform

Ansvarar för att lagra, läsa och publicera Template-data och tillhörande persistenta assets.

Frontend API:

- loadBackendTemplate(id)
- publishBackendTemplate(template)

Backend API:

- GET /
- POST /api/publish
- GET /api/crossword/:id
- GET /uploads/...

Backend använder filbaserad lagring:

- backend/templates för publicerade Template JSON-filer
- backend/uploads för publicerade bilduppladdningar

Deployment configuration:

- frontend backend URL konfigureras via REACT_APP_BACKEND_BASE_URL
- backend port konfigureras via PORT
- public asset/backend URL konfigureras via PUBLIC_BACKEND_BASE_URL
- lokala defaults är oförändrade
- .env.example och backend/.env.example dokumenterar required variables
- backend storage directories konfigureras via TEMPLATE_STORAGE_DIR och UPLOAD_STORAGE_DIR
- lokala storage defaults är backend/templates och backend/uploads
- production kan använda persistent disk paths som /var/data/templates och /var/data/uploads
- backend skapar storage directories vid startup
- API routes, payloads, image URLs, CORS, frontend, Template shape, Runtime och provider är oförändrade
- docs/DEPLOYMENT.md dokumenterar manual Render Version 1 deployment

Persistence Platform äger:

- frontend HTTP communication med backend persistence API
- backend endpoints för publish och load
- filbaserad lagring av templates och uppladdade assets
- runtime persistence directories som repository-normaliserade mappar

Persistence Platform äger inte:

- Template shape
- Template-normalisering
- Editor-beteende
- Runtime-beteende
- App workflow

Template Lifecycle definierar Template v1-formen.

Persistence lagrar Templates men definierar inte Template shape.

App.js är fortsatt workflow orchestrator.

Runtime och Editor äger inte persistence.

Framtida extension points:

- storage adapters
- backend validation
- API configuration
- persistence regression tests

---

## Engine

Ansvarar för gemensam logik som inte ska ligga i UI-komponenter.

Exempel:

- navigation
- activeLine
- gridArea
- input-normalisering

Automated unit coverage protects Engine pure functions, including grid movement and keyboard navigation.

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

Persistence Platform frontend äger:

- publish API communication via templateApi
- backend load API communication via templateApi
- shared backend base URL configuration

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

Play.jsx delegerar backend template load till loadBackendTemplate i templateApi.

TemplateCanvas och RuntimeLayer får normalized Template data i public play.

Persistence load respekterar non-OK backend responses innan Template-normalisering.

404/error JSON normaliseras inte till Template.

Public Play visar ett tydligt load error state när backend template load misslyckas.

Successful TemplateCanvas -> RuntimeLayer flow är oförändrat.

App.js delegerar publish HTTP communication till templateApi.

Publish API avvisar non-OK backend responses.

Backend error text bevaras när den finns.

App.js visar tydlig feedback för network och backend publish failures.

App.js äger fortsatt:

- publish validation
- publish payload construction
- publish workflow orchestration
- publish success feedback med public play URL

Successful publish URL feedback är oförändrat.

Runtime ownership är oförändrad i detta steg.

Backend contract och Runtime behavior är oförändrade i detta steg.

Publish workflow är oförändrat.

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
