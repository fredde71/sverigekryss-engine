# CURRENT_STATE.md

## Projektstatus

Projekt: Sverigekryss Engine

Senast uppdaterad:

Efter slutförd Epic 1 runtime ownership-migrering, första Epic 2 TemplateCanvas-steg, slutförd Epic 3 Editor interaction/UI ownership och första Template Lifecycle-steg.

---

# Senaste verifierade milstolpe

Epic 1 – Build Runtime är slutförd.

App.js äger inte längre runtime state, runtime interaction/navigation eller runtime grid/cell-rendering.

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

RuntimeLayer äger:

- runtime state
- input handling
- click handling
- keyboard handling
- focus movement
- active line
- runtime grid/cell-rendering

TemplateCanvas äger:

- delad template presentation shell
- bakgrundsbild/canvas för Editor och Runtime
- overlay-yta där Editor eller Runtime monteras

TemplateCanvas äger inte:

- Editor-beteende
- Runtime-beteende
- state, navigation eller workflow

App.js äger fortsatt:

- applikationsskal
- mode-val
- workflow
- template state och template-livscykel för nuvarande implementation
- gridArea state
- cellTypes state
- montering av Runtime i TemplateCanvas
- val av Editor eller Runtime

Bakgrund/canvas har flyttats till TemplateCanvas eftersom detta är delad template-presentation, inte RuntimeSession-beteende.

EditorWorkspace äger nu:

- editor composition boundary
- montering av EditorViewport
- montering av EditorLayer
- koppling mellan EditorViewport och EditorLayer
- editor-only state
- activeTool state
- pendingRows state
- pendingCols state

App.js monterar inte längre editor-komponenter direkt.

App.js äger fortsatt template state och application workflow.

EditorToolbar äger nu:

- editor toolbar rendering
- cell type buttons
- create grid controls

Nya grids initierar cellTypes som array:

- Array(pendingRows * pendingCols).fill("empty")

EditorViewport äger nu:

- editor grid placement interaction
- move/resize drag mode
- musbaserad gridförflyttning och resize
- tangentbordsstyrd gridförflyttning och resize
- cell click mapping
- cell type updates baserat på activeTool

EditorLayer äger nu:

- EditorGrid-rendering
- editor overlay controls för move/resize

App.js renderar inte längre EditorGrid direkt.

Duplicerad EditorGrid-rendering har tagits bort.

Ingen visuell styling ändrades; endast den dubbla renderingen togs bort.

Runtime ownership ändrades inte i dessa Editor-steg.

Epic 3 Editor interaction/UI ownership är slutförd.

Template state ligger kvar i App.js till kommande Template Lifecycle-arbete.

Template Lifecycle äger nu:

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

Persistence Platform frontend äger nu:

- publish API communication via templateApi
- backend load API communication via templateApi
- shared backend base URL configuration

Persistence Platform är ett first-class subsystem.

Persistence Platform äger nu:

- frontend API communication för loadBackendTemplate och publishBackendTemplate
- backend API endpoints för publish och load
- filbaserad backend-lagring i backend/templates
- filbaserad backend-assetlagring i backend/uploads
- repository-normalisering för backend source, dependency manifests och runtime data ignores

Persistence Platform äger inte:

- Template shape
- Template-normalisering
- Editor-beteende
- Runtime-beteende
- App workflow

Persistence lagrar Templates men definierar inte Template shape.

App.js är fortsatt workflow orchestrator.

Runtime och Editor äger inte persistence.

Framtida Persistence extension points:

- storage adapters
- backend validation
- API configuration
- persistence regression tests

Test Foundation har påbörjats.

Template Lifecycle har nu automated unit tests för:

- createTemplate canonical Template v1 creation
- createTemplate cellTypes-normalisering till rows * cols
- normalizeTemplate defaults och cellTypes-normalisering
- exkludering av runtime/editor session state

Den obsolete CRA default App.test.js-testen är ersatt.

Verifierat:

- 4 tests pass using existing Jest setup

Persistence frontend API har nu automated integration tests för:

- loadBackendTemplate backend URL usage
- loadBackendTemplate normalized Template output
- publishBackendTemplate request contract
- publishBackendTemplate parsed backend JSON response

fetch och response.json mockas.

normalizeTemplate körs fortsatt real.

Verifierat:

- total automated tests: 7

Template Lifecycle äger nu template file export.

App.js delegerar export-beteende till templateExport.

Export skapar fortfarande canonical Template v1.

JSON import använder nu normalizeTemplate.

Template Lifecycle äger nu JSON template parsing and normalization.

App.js delegerar import-beteende till templateImport.

App.js äger fortfarande Template state application.

Importerade templates återställer canonical Template v1-fält när de finns:

- crosswordId
- rows
- cols
- cellTypes
- gridArea
- imageSrc
- metadata

Template Lifecycle äger nu backend template loading and normalization.

App.js delegerar backend load till templateApi.

App.js är fortsatt application orchestrator och applicerar Template state.

Laddade backend-templates återställer canonical Template v1-fält när de finns, inklusive crosswordId.

Play.jsx delegerar nu backend template load till loadBackendTemplate i templateApi.

TemplateCanvas och RuntimeLayer får normalized Template data i public play.

Backend error handling är oförändrad i detta steg.

App.js delegerar publish HTTP communication till templateApi.

App.js äger fortfarande:

- publish validation
- publish payload construction
- publish workflow orchestration
- publish success feedback med public play URL

Runtime ownership är oförändrad i detta steg.

Backend contract och Runtime behavior är oförändrade i detta steg.

Publish workflow är oförändrat.

State ownership är oförändrat.

URL data load är fortfarande oförändrad.

Framtida separat ownership-kandidat:

- fortsatt Template Lifecycle för fler template-vägar, en i taget

Verifierat:

- Editor fungerar
- Play fungerar
- Runtime fungerar
- Navigation fungerar
- Riktningshantering fungerar
- Double clue fungerar
- Write fungerar
- Blocked fungerar

---

# Viktigaste arkitekturfynd

## RuntimeCell-kontrakt

Kritisk bugg identifierad:

RuntimeCell fick inte:

type={type}

från App.js.

Konsekvens:

- Runtime kunde inte tolka celltyper korrekt.
- Play fungerade inte korrekt.

Lösning:

type skickas nu vidare till RuntimeCell.

Resultat:

Editor och Play fungerar igen.

---

# Aktuellt subsystem

Runtime ownership / App.js-separation

---

# Senaste verifiering

## PDF-upload

Verifierad fungerande.

Upload Image accepterar:

- PDF
- PNG
- JPG

Tidigare misstänkt fel visade sig bero på att:

Import Template är avsedd för:

- .json

och inte för PDF-filer.

Ingen kodändring krävdes.

## Browser/Publiceringsläge

Verifiering genomförd.

Browser-versionen använder inte samma runtime-pipeline som lokal Play.

Lokal Play:

App.js
↓
RuntimeViewport
↓
RuntimeGrid
↓
RuntimeCell
↓
PlayCell

Browser Play:

Play.jsx
↓
RuntimeLayer
↓
CrosswordRenderer

Projektet innehåller därför två parallella runtime-implementationer.

Detta förklarar sannolikt varför browser-versionen uppvisar annat beteende än lokal Play.

Ingen kodändring genomförd.
Endast verifiering utförd.

Verifierat:

Browser-versionen använder fortfarande
RuntimeLayer + CrosswordRenderer.

CrosswordRenderer innehåller en äldre runtime-motor.

Den saknar:

- direction
- active line
- navigation
- RuntimeCell-pipeline

Detta förklarar skillnaden mellan lokal Play och browser Play.

## Browser/Publiceringsläge

Verifiering genomförd.

Browser-versionen använder inte samma runtime-pipeline som lokal Play.

Lokal Play:

App.js
↓
RuntimeViewport
↓
RuntimeGrid
↓
RuntimeCell
↓
PlayCell

Browser Play:

Play.jsx
↓
RuntimeLayer
↓
CrosswordRenderer
↓
PlayCell

CrosswordRenderer innehåller en äldre runtime-motor.

Verifierat saknas:

- active line
- direction-hantering
- navigation
- RuntimeCell-pipeline

Detta förklarar skillnaden mellan lokal Play och browser Play.

Beslut:

Målet är att migrera browser-versionen till samma runtime-pipeline som lokal Play.

Ingen kodändring genomförd ännu.
Endast verifiering och arkitekturbeslut.

Migreringssteg 1 verifierat.

CrosswordRenderer ersatt med RuntimeGrid i RuntimeLayer.

Projektet kompilerar.

Grid-overlay renderas fortfarande korrekt ovanpå korsordsbilden.

Verifierat att Browser Runtime kan använda RuntimeGrid utan CrosswordRenderer-logik.

Migreringssteg 2 verifierat.

Browser Runtime renderar nu RuntimeGrid med samtliga RuntimeCells baserat på cellTypes från template.

CrosswordRenderer används inte längre för rendering av gridceller.

Editor Mode och Lokal Play fungerar oförändrat.

Browser Runtime saknar fortfarande write-logik, navigation, direction och active line.

Migreringssteg 3 verifierat.

Browser Runtime skickar nu value till RuntimeCell.

Editor Mode och Lokal Play fungerar oförändrat.

Ingen regression observerad.

Browser Runtime saknar fortfarande:

- onChange
- onClick
- navigation
- direction
- active line

Migreringssteg 4 verifierat.

Browser Runtime skickar nu onClick till RuntimeCell.

Rutor kan markeras/klickas i browser-läget.

Ingen textinmatning fungerar ännu.

Navigation, direction och active line saknas fortfarande.

Editor Mode och Lokal Play fungerar fortsatt utan regression.

Migreringssteg 5 verifierat.

Browser Runtime skickar nu onChange till RuntimeCell.

Text kan matas in i browser-läget.

Klick och textinmatning fungerar.

Navigation, direction och active line saknas fortfarande.

Editor Mode och Lokal Play fungerar fortsatt utan regression.

Migreringssteg 6 verifierat.

Browser Runtime stödjer nu klick och textinmatning.

Samtliga celltyper behandlas fortfarande som write-celler.

Typstyrd rendering från App.js har ännu inte migrerats.

Konsekvens:
- blocked kan skrivas i
- image kan skrivas i
- double beter sig som write 

Verifierat att Browser Runtime nu stödjer klick och textinmatning.

Tidigare antagande om att RuntimeLayer inte kördes avfärdat.

Browser Runtime exekverar RuntimeLayer-koden.

Kvarvarande arbete:
- blocked
- image
- double
- direction
- active line
- navigation

Verifierat att Browser Runtime mottar blocked-celler från template-data.

17 blocked-celler identifierades vid laddning.

Problemet ligger inte i template-data utan i renderings- eller interaktionslagret.

Ny verifiering.

Browser Runtime uppvisar ökande positionsavvikelse längre ned i korsordet.

Markör och klickyta driver från den visuella rutan.

Symptom:
- blocked verkar skrivbar
- image verkar skrivbar
- double fungerar inte korrekt
- fokus hamnar delvis utanför ruta

Misstanke:
Grid-overlay och bakgrundsbild skalar inte identiskt i Browser Runtime.

Grid-alignment måste verifieras innan fortsatt migrering av cellbehörigheter och navigation.

Migreringskartläggning genomförd.

Browser Runtime innehåller redan:

- answers
- activeCell
- direction
- inputRefs

samt runtime-funktionerna:

- getDirection
- getNextCell
- getArrowNextIndex
- focusNextInput
- getActiveCells
- normalizeInputValue

Kvarvarande migrering består huvudsakligen av att koppla in funktionerna i renderingen.

Ingen ytterligare felsökning ska ske innan migreringen är komplett.

Migreringssteg verifierat.

Browser Runtime använder nu:

- onKeyDown
- getArrowNextIndex
- focusNextInput

Piltangentsnavigation är inkopplad.

Observation:
Fokusflytt fungerar men uppvisar avvikelser efter flera steg.
Ingen felsökning genomförd eftersom migreringen ännu inte är färdig.

Migreringssteg verifierat.

Browser Runtime använder nu:

- getNextCell()
- focusNextInput()

Automatisk fokusflytt efter inmatning fungerar.

Ingen regression observerad i Editor eller Play.

Migreringssteg verifierat.

Browser Runtime skickar nu activeCells-information till RuntimeCell via isActive.

Ingen funktionell förändring ännu.
Detta steg förbereder active line-renderingen.

Ingen regression observerad.

Subsystem: Active Cell Rendering

Status: Färdigmigrerat.

Verifierad kedja:

RuntimeLayer
→ RuntimeCell
→ PlayCell
→ input

Följande props används nu genom hela kedjan:

- value
- onChange
- onClick
- onFocus
- onKeyDown
- inputRef
- dataIndex
- isActive
- maxLength

Ingen regression observerad.

---

# Verifierat fungerande

## Editor

- Grid rendering
- Grid flyttning
- Grid storlek
- PDF-upload
- Image-markering
- Blocked-markering
- Double-markering
- Write-markering
- Växling mellan verktyg

## Runtime

- Renderering
- Input
- Navigation
- Active line
- Double clue
- Write
- Blocked

---

# Nästa steg

1. Uppdatera dokumentation efter Epic 1
2. Besluta om neutral TemplateCanvas/PuzzleCanvas
3. Template-livscykel
4. Persistence för templates
5. Browser/publicering
6. Backend/API

---

# Viktig regel

Innan ny kodändring:

Läs:

- DEVELOPMENT_RULES.md
- SYSTEM_OVERVIEW.md
- RUNTIME_ARCHITECTURE.md

och genomför Pre-Flight Check.
