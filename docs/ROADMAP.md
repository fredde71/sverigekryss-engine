# ROADMAP.md

## Syfte

Detta dokument beskriver prioriterad utvecklingsordning för projektet.

Ordningen är viktig.

Subsystem med högre prioritet ska färdigställas innan nya subsystem introduceras.

---

# Produktgenerationer

Roadmapen organiseras i fyra produktgenerationer.

Generationerna beskriver den långsiktiga produktordningen.

De detaljerade faserna längre ned beskriver aktuell implementation och verifierad status.

## Aktivt fokus: Product Readiness / V1

Musikkryss produktionsimport och Play-flöde är genomfört och browser-verifierat:

- plattformen växlar mellan `Sverigekryss` och `Musikkryss`
- varje korsordstyp har en självständig Editor-session för dokument, Template,
  redigerbart state, Digitization, zoom och scroll
- typbyte bevarar den inaktiva sessionen och en oanvänd session är blank
- asynkrona Digitization-resultat återförs endast till ursprungssessionen
- det nuvarande katalogägda återkommande formatet har 9 × 10-grid, normaliserad
  geometri samt 59 skrivbara och 31 hållbara svarta celler; plattformen antar
  inte dessa dimensioner globalt och katalogen kan utökas med andra format
- topologin ger 13 numrerade startceller och 15 automatiskt härledda svar,
  unikt identifierade av nummer och riktning
- varje svar äger egen ordnad `answerPath` och redigerbar `contentSequence`
- Musikkryss Editor stödjer Intro och separat innehåll för varje riktningssvar
- Edit/Play-växling bevarar Musikkryss-sessionen
- Musikkryss Play återanvänder gemensam `PlaySurface`/`RuntimeLayer`, visar
  riktningssvar, markerar och navigerar hela svaret samt delar bokstäver i korsningar
- Musikkryss Play-presentationen är responsiv med 650 px maximal desktopbredd
- infrastruktur, backend-, publicerings- och runtime-gränser är fortsatt gemensamma
- source-neutral veckoinnehållsimport matchar exakt på `number + direction`,
  använder formatägda svarsvägar och validerar fullständighet, manus,
  lösningslängder och korsningar utan att ändra dokument/grid/session
- producent-Excel är den första filadaptern och går genom samma preview,
  diagnostik och explicita godkännande som framtida adaptrar
- godkänd import initierar katalogformatet i en blank session eller bevarar ett
  kompatibelt uppladdat dokument/grid och applicerar innehållet atomiskt
- importerad metadata, intro, manus och lösningar är fortsatt redigerbar
  Template-/sessionsdata; producenten skapar innehållet och Wordex verifierar,
  kan redigera, förhandsgranskar och publicerar
- Editor redigerar samtliga importerade issue-fält, intro, riktningsmanus och
  kanoniska lösningar utan fortsatt Excelberoende; gemensam validering visar
  längdfel och korsningskonflikter och återställer Help/Facit-giltighet efter
  korrigering utan att ändra formatägda svarsvägar
- Musikkryss Editor och image-free Play renderar formatets explicita geometri,
  numrerade startceller, skrivbara celler och svarta celler
- vald svarsväg, fokuserad cell, nedtoning, skrivnavigation och korsande
  bokstavsstate är verifierade i Play
- kanoniska lösningar bevaras i ett immutabelt publiceringssnapshot men tas bort
  ur Solve-projektionen; Help/Facit aktiveras explicit och kräver en separat
  ogissningsbar capability-token
- publicering visar först endast Lösarlänken; `Publicera facit` aktiverar senare
  Facit-/hjälplänken och dess kontroller för en bokstav, valt svar och hela facit
- provider-oberoende `SpeechGenerationRequest` och `SpokenAudioReference` är
  implementerade för Musikkryss-intro och riktningssvar
- deterministiska, versionsbundna fingerprints gör genererad audio `stale` när
  manus, locale eller provider-neutral voice profile ändras
- provider-neutrala audioreferenser kan bevaras i Template; providerdata och
  secrets ingår inte i Template, App, Runtime eller Play
- valfri provider-neutral `speechText` låter intro och svar ha en separat naturlig
  uppläsning utan att ändra visningstext; fingerprints följer den effektiva
  uppläsningstexten och gör tidigare audio stale när den ändras
- backend `SpeechGenerationService`, ElevenLabs-adapter och endpoints för intro
  respektive riktningssvar är implementerade ovanpå samma request-/referenskontrakt
- genererade MP3-assets är separata, immutabla och fingerprint-återanvändbara;
  providerproveniens och konfiguration stannar server-side och providerfel loggas
  sanerat utan att exponeras publikt

Det registrerade formatet väljs utan filnamnslogik. `Ladda referenskryss` är
fortsatt endast en explicit utvecklings-/demofunktion och referensarbetsboken är
en development-/manuell verifieringsfixture, inte runtime-standard eller del av
produktionspubliceringen.

Nästa Musikkryss speech-milstolpe är provider-neutral Editor-orkestrering för
explicit generering och applicering av aktuella audioreferenser, följt av
Play-uppspelning. Batchgenerering, automatisk uppspelning och slutlig
röstvals-UX är ännu inte implementerade. Slutlig UX-polering är senarelagd.

V1-arbetsflödet är browser-testat end-to-end:

```text
PDF → Digitization → Editor → svarsvägar/tävlingsceller
    → publish → genererad länk → Browser/Play
```

Grid Reconstruction → Editor är slutförd och verifierad:

- production Digitization rekonstruerar `GridLattice` från produktionsägd evidens
- verifierad Wordex-källa rekonstrueras som 25 × 25
- `GridLattice.extent` behåller semantiken modellerad yttre linjecentrumgeometri
- `OuterVisualExtent` är separat synligt yttre avtryck
- `GridFormatGeometry` tillför återanvändbar normaliserad intern linjegeometri och väljs från accepterade indexerade ankare utan filnamnslogik
- Editor-förslaget kombinerar rader/kolumner från `GridLattice`, `gridArea` från `OuterVisualExtent` och formatets explicita linjepositioner i dokumentkoordinater
- `EditorWorkspace` äger redigerbart state och `EditorGrid` renderar explicita linjepositioner när de finns
- Grid V1 använder stabil global `GridLattice`-placering; pixelperfekt sammanfall med varje tryckt linje är inte ett V1-krav
- manuell finjustering i Editor är avsiktligt V1-beteende
- manuellt/uniformt grid-beteende finns kvar när explicita linjepositioner saknas
- `App.js` är fortsatt en tunn orkestrator
- Digitization Lab, Ground Truth, dataset, experiment och validering är inte produktionsberoenden

V1 Template/Editor/Runtime är verifierat:

- blank Editor-start och konsekvent reset av dokument-, grid-, zoom- och viewport-state mellan uppladdningar
- Template-ägda explicita grid-linjepositioner delas av Editor och Runtime; uniform legacy-fallback finns kvar
- Template-ägda ordnade `answerPaths` stödjer enkelledtråd, två separata dubbelledtrådsvägar och svängande svar
- gemensam `clueSelection` styr full active-line-markering och skrivnavigation; topologisk fallback finns kvar
- Editor författar, visar, sparar, ändrar och rensar svarsvägar
- Tävlingsruta gör vid behov en tom cell skrivbar, öppnar position 1–6 och bevarar `{ index, position }`
- backend bevarar Template-data och template-load använder `no-store`
- publicerad länk använder samma `PlaySurface`/`RuntimeLayer` som lokal Play

V1-status är komplett end-to-end workflow proven. Aktivt fokus är produktberedskap och effektivisering av författningsflödet utan arkitekturförändring. Arbetsflödet fungerar, men författningshastigheten behöver optimeras. Avancerad automatisk cell- och ledtrådsklassificering är senarelagt bortom V1.

`260727-KOPSVK-SK-0-0-webb.pdf` kvarstår som en isolerad visuell outlier. Den ska inte ensam styra generell Grid-arkitektur eller documentspecifik produktlogik.

Forskning om image-aligned linjegeometri, avbrutna interna linjer, projection ridges, fragment tracks och lattice-conditioned evidence är dokumenterad men senarelagd till efter V1. Den forskningen ändrar inte Grid V1:s produktionsbeteende, och Ground Truth förblir valideringsdata.

## Generation 1

Mål:

Stabil Version 1 för digitalisering, publicering och spel.

Omfattar:

- Editor
- Player
- Competition
- Storage
- Publishing

## Generation 2

Mål:

Minska manuellt redaktörsarbete med AI-stöd och automation.

Omfattar:

- AI-assisted editor
- Automation

## Generation 3

Mål:

Stöd för ljudbaserade korsordsformat.

Omfattar:

- Music crossword
- AI text-to-speech
- Audio playback
- Listening statistics

## Generation 4

Mål:

Full publiceringsautomation och uppföljning över flera publiceringsytor.

Omfattar:

- Publication automation
- Publication IDs
- Metadata
- Statistics
- Multi-publication workflow

---

# Fas 1 – Stabilisering

Mål:

Verifiera att Editor och Runtime fungerar konsekvent efter subsystemseparationen.

---

## 1. PDF-import i Editor

Status:

Ej fungerande.

Problem:

PDF-filer kan inte väljas vid import.

Ownership:

Editor

Prioritet:

Hög

---

## 2. Browser/Publiceringsläge

Status:

Runtime ownership migrerad.

Mål:

Verifiera att samma beteende som i lokal Play fungerar efter publicering.

Ownership:

Runtime

Prioritet:

Hög

Verifierat beslut:

RuntimeLayer är subsystemgräns för Runtime.

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

RuntimeLayer äger runtime state, interaction/navigation, active line och runtime grid/cell-rendering.

App.js väljer mode och monterar RuntimeLayer.

TemplateCanvas äger delad bakgrund/canvas/overlay-yta som template presentation shell.

TemplateCanvas äger inte Editor- eller Runtime-beteende.

---

## 3. Template-livscykel

Mål:

Verifiera hela flödet:

PDF

↓

Editor

↓

Template

↓

Play

↓

Publicering

Ownership:

Template Lifecycle

Prioritet:

Hög

Beslut:

Template v1 representerar ett digitaliserat tryckt korsord.

Obligatoriska fält:

- crosswordId
- rows
- cols
- cellTypes
- gridArea
- imageSrc

cellTypes är en array med längden rows * cols.

metadata är valfritt.

Template innehåller ingen runtime state och ingen editor session state.

Editor modifierar Template.

Runtime konsumerar Template.

Persistence lagrar Template.

App.js orkestrerar endast.

Första Template Lifecycle-steg är genomfört:

- createTemplate finns
- createTemplate bygger canonical Template v1
- cellTypes normaliseras till array med längden rows * cols
- exportTemplate använder canonical Template creation

Andra Template Lifecycle-steg är genomfört:

- normalizeTemplate finns
- normalizeTemplate hanterar canonical Template v1 input
- JSON import använder normalizeTemplate
- importerade templates återställer canonical Template v1-fält när de finns

Oförändrat i detta steg:

- backend load
- Play.jsx
- URL data load

Tredje Template Lifecycle-steg är genomfört:

- App.js backend load använder normalizeTemplate
- laddade backend-templates återställer canonical Template v1-fält när de finns
- crosswordId återställs från laddad template eller route id

Oförändrat i detta steg:

- publish
- import
- Runtime
- Play.jsx

Fjärde Template Lifecycle-steg är genomfört:

- Play.jsx använder normalizeTemplate för backend-laddade templates
- TemplateCanvas får normalized Template data i public play
- RuntimeLayer får normalized Template data i public play
- backend error handling är oförändrad

Oförändrat i detta steg:

- App.js
- publish
- Runtime ownership

Femte Template Lifecycle-steg är genomfört:

- templateExport finns
- Template Lifecycle äger template file export
- App.js delegerar export-beteende till templateExport
- export skapar fortsatt canonical Template v1

Oförändrat i detta steg:

- import
- publish
- Runtime
- state ownership

Sjätte Template Lifecycle-steg är genomfört:

- templateImport finns
- Template Lifecycle äger JSON template parsing and normalization
- App.js delegerar import-beteende till templateImport
- App.js äger fortsatt Template state application

Oförändrat i detta steg:

- Runtime
- publish
- backend
- state ownership

Sjunde Template Lifecycle-steg är genomfört:

- templateApi finns
- Template Lifecycle äger backend template loading and normalization
- App.js delegerar backend load till templateApi
- App.js är fortsatt application orchestrator och applicerar Template state

Oförändrat i detta steg:

- backend contract
- Runtime behavior
- publish
- state ownership

Första Persistence Platform frontend-steg är genomfört:

- publishBackendTemplate finns i templateApi
- Persistence Platform frontend äger publish API communication
- App.js delegerar publish HTTP communication till templateApi
- App.js äger fortsatt publish validation, payload construction och workflow orchestration
- publish API avvisar non-OK backend responses
- backend error text bevaras när den finns
- App.js visar tydlig feedback för network och backend publish failures
- successful publish URL feedback är oförändrat

Persistence frontend integration är genomförd:

- persistenceConfig finns med shared backend base URL
- templateApi använder shared backend base URL för load och publish
- Play.jsx laddar public play templates via loadBackendTemplate
- Publish visar success feedback med public play URL
- App.js behåller editor workflow öppet efter publish

Första Deployment Platform configuration package är genomfört:

- frontend backend URL är konfigurerbar via REACT_APP_BACKEND_BASE_URL
- backend port är konfigurerbar via PORT
- public asset/backend URL är konfigurerbar via PUBLIC_BACKEND_BASE_URL
- lokala defaults är oförändrade
- .env.example files dokumenterar required variables
- backend storage directories är konfigurerbara via TEMPLATE_STORAGE_DIR och UPLOAD_STORAGE_DIR
- lokala storage defaults är backend/templates och backend/uploads
- production kan använda persistent disk paths som /var/data/templates och /var/data/uploads
- backend skapar storage directories vid startup
- API routes, payloads, image URLs, CORS, frontend, Template shape, Runtime och deployment provider är oförändrade
- docs/DEPLOYMENT.md dokumenterar manual Render Version 1 deployment

Oförändrat i detta steg:

- backend contract
- payload shape
- image handling
- storage paths
- error behavior
- Template canonicalization
- state ownership

---

# Fas 2 – Arkitekturstädning

Mål:

Minska komplexiteten och göra systemet enklare att vidareutveckla.

---

## 4. Fortsatt App.js-separation

Mål:

Flytta kvarvarande ansvar från App.js till rätt subsystem.

Exempel:

- Editor-semantik
- Template/canvas-presentation
- State-relaterad shell-logik

Ownership:

Arkitektur

Prioritet:

Hög

Status:

Runtime ownership är slutförd inom Epic 1.

Första TemplateCanvas-steget är genomfört:

- delad canvas/background/overlay-yta ägs av TemplateCanvas
- App.js äger fortsatt mode/workflow
- framtida Editor-ownership är separat

Första Editor ownership-steget är genomfört:

- EditorViewport äger editor grid placement interaction
- App.js äger fortsatt gridArea state och workflow
- Runtime ownership ändrades inte

Andra Editor ownership-steget är genomfört:

- EditorViewport äger cell click mapping och cell type updates
- App.js äger fortsatt activeTool och cellTypes state
- toolbar ownership är oförändrat
- Runtime ownership ändrades inte

Tredje Editor ownership-steget är genomfört:

- EditorLayer äger EditorGrid-rendering
- App.js renderar inte längre EditorGrid direkt
- duplicerad EditorGrid-rendering togs bort
- ingen visuell styling ändrades

Fjärde Editor ownership-steget är genomfört:

- EditorWorkspace äger editor composition
- App.js monterar inte längre editor-komponenter direkt
- App.js äger fortsatt editor state och toolbar
- Runtime ownership ändrades inte

Femte Editor ownership-steget är genomfört:

- EditorWorkspace äger editor-only state
- EditorToolbar äger editor toolbar rendering
- App.js äger fortsatt template state och application workflow
- nya grids initierar cellTypes som array
- Runtime ownership ändrades inte

Editor interaction/UI ownership är därmed slutförd.

Template state ligger kvar i App.js tills Template Lifecycle.

Kvarvarande App.js-arbete ska inte flytta runtime state tillbaka till App.js.

---

## 5. RuntimeCell-separation

Mål:

Förtydliga ansvar mellan:

- RuntimeCell
- PlayCell

Ownership:

Runtime

Prioritet:

Medel

---

## 6. Beroendeanalys av inaktiva subsystem

Komponenter:

- RuntimeLayer
- CrosswordRenderer

Mål:

Avgöra om de kan tas bort eller återanvändas.

Ownership:

Arkitektur

Prioritet:

Medel

---

# Fas 3 – Persistence

Persistence Platform är ett first-class subsystem.

Syfte:

Lagra, läsa och publicera Template-data och tillhörande persistenta assets.

Ansvar:

- frontend API communication med backend persistence API
- backend API endpoints för publish och load
- filbaserad lagring av publicerade templates
- filbaserad lagring av uppladdade/publicerade assets

Frontend API:

- loadBackendTemplate(id)
- publishBackendTemplate(template)

Backend API:

- GET /
- POST /api/publish
- GET /api/crossword/:id
- GET /uploads/...

Persistence lagrar Templates men definierar inte Template shape.

Template Lifecycle definierar Template v1-formen.

App.js är fortsatt workflow orchestrator.

Runtime och Editor äger inte persistence.

Framtida extension points:

- storage adapters
- backend validation
- API configuration
- persistence regression tests

## 7. Template-lagring

Mål:

Spara:

- Grid
- Celltyper
- GridArea
- Metadata

Ownership:

Persistence

Prioritet:

Hög

Status:

Backend repository-normalisering är genomförd.

Backend source och dependency manifests är tracked.

Runtime persistence data i backend/templates och backend/uploads ignoreras.

Mapparna behålls med .gitkeep.

---

# Fas 3.5 – Test Foundation

## Template Lifecycle unit tests

Status:

Genomfört.

Test Foundation har första automated unit test package.

Täckning:

- createTemplate canonical Template v1 creation
- createTemplate cellTypes-normalisering till rows * cols
- normalizeTemplate defaults och cellTypes-normalisering
- runtime/editor session state exkluderas från Template output

Den obsolete CRA default App.test.js-testen är ersatt.

Verifiering:

- 4 tests pass using existing Jest setup

---

## Persistence frontend API integration tests

Status:

Genomfört.

Täckning:

- loadBackendTemplate contract
- publishBackendTemplate contract
- backend URL usage
- template normalization
- publish request contract

fetch mockas.

normalizeTemplate körs fortsatt real.

Verifiering:

- total automated tests: 7

---

## Runtime engine unit tests

Status:

Genomfört.

Täckning:

- input normalization
- navigation och direction behavior
- boundaries och non-writable cells
- active line behavior
- double clue behavior
- grid movement
- keyboard navigation

Verifiering:

- moveGridArea är skyddad
- getArrowNextIndex är skyddad
- total automated tests: 24

---

## 8. Återladdning av template

Mål:

Öppna tidigare skapade templates.

Ownership:

Persistence

Prioritet:

Hög

Status:

loadBackendTemplate finns i frontend API.

Backend load API communication går via templateApi.

App.js applicerar fortfarande Template state och workflow.

Production error handling:

- Persistence load respekterar non-OK backend responses
- 404/error JSON normaliseras inte till Template
- Public Play visar tydligt load error state
- successful TemplateCanvas -> RuntimeLayer flow är oförändrat
- optional `answerPaths`, `competitionCells` och explicita linjepositioner normaliseras och bevaras genom import, export, publish och backend reload
- legacy templates utan de valfria fälten förblir kompatibla
- Browser/Play använder färsk backend-data genom explicit `no-store`

---

# Fas 4 – Produktfunktioner

## 9. Template-bibliotek

Mål:

Hantera flera korsord.

Ownership:

Editor

Prioritet:

Medel

---

## 10. Export/Import

Mål:

Dela templates mellan miljöer.

Ownership:

Persistence

Prioritet:

Medel

---

## 11. Responsive Public Runtime

Mål:

Public Play ska fungera på:

- mobil
- tablet
- desktop

Strategi:

Editor är desktop-first för produktionsarbete.

Public Play måste stödja mobil och tablet.

Responsive Public Runtime är ett Version 1.0-krav.

Responsive-arbete ska inte blandas med Template Lifecycle eller Editor ownership changes.

Första Responsive Public Runtime-steget är genomfört:

- Public Play använder responsive TemplateCanvas-skalning
- internal coordinate system är fortsatt 1200x1200
- image och Runtime overlay skalar tillsammans
- Editor behavior är oförändrat
- Runtime logic och gridArea shape är oförändrade
- PlayCell styling är oförändrad eftersom nuvarande scaling är tillräcklig

Ownership:

Runtime / TemplateCanvas

Prioritet:

Hög inför Version 1.0

---

## 12. Puzzle Crop / Source Crop

Mål:

Public Play ska visa endast korsordsytan, inte hela PDF-sidan.

Beslut:

- cropArea är separat från gridArea
- Template Lifecycle äger cropArea data
- Editor definierar och justerar cropArea
- TemplateCanvas renderar cropArea som visible viewport
- intern source surface är fortsatt 1200x1200
- image och overlay översätts tillsammans i en delad surface
- responsive scaling använder cropped aspect ratio
- RuntimeLayer och gridArea semantics är oförändrade
- Runtime är omedvetet om source-page cropping

Status:

Domain-model foundation, första TemplateCanvas crop-rendering package, cropArea state plumbing, Editor crop overlay package, crop move interaction package och crop resize interaction package är genomförda.

- cropArea är nu canonical Template v1-data
- cropArea använder original 1200x1200 source coordinates
- missing cropArea defaultar till full canvas
- legacy Templates är fortsatt kompatibla
- App.js äger cropArea med canonical full-canvas default tills Template state flyttas
- cropArea deltar i import, export, publish och backend load state flow
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
- gridArea är fortsatt separat och oförändrad
- grid overlay behavior är oförändrat
- existing grid interaction är oförändrad
- crop move och grid editing fortsätter fungera oberoende
- Puzzle Crop Version 1 är functionally complete
- TemplateCanvas rendering, Runtime, gridArea semantics och backend contract är oförändrade
- Runtime, TemplateCanvas, persistence och App ownership är oförändrade
- manual verification bekräftade crop, alignment, input, direction och responsive behavior

Ownership:

Template Lifecycle / Editor / TemplateCanvas

Prioritet:

Hög inför Version 1.0

---

# Fas 5 – Plattform

## 12. Backend

Mål:

Central lagring.

Ownership:

Backend

Prioritet:

Låg

---

## 13. API

Mål:

Kommunikation mellan frontend och backend.

Ownership:

Backend

Prioritet:

Låg

---

## 14. Användarhantering

Mål:

Inloggning och rättigheter.

Ownership:

Plattform

Prioritet:

Låg

---

# Arbetsregel

Innan nästa punkt påbörjas ska föregående punkt vara:

- analyserad
- implementerad
- verifierad
- dokumenterad

Ingen ny funktion får hoppa före en högre prioriterad punkt utan uttryckligt beslut.
