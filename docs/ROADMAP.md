# ROADMAP.md

## Syfte

Detta dokument beskriver prioriterad utvecklingsordning för projektet.

Ordningen är viktig.

Subsystem med högre prioritet ska färdigställas innan nya subsystem introduceras.

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

---

## 8. Återladdning av template

Mål:

Öppna tidigare skapade templates.

Ownership:

Persistence

Prioritet:

Hög

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

Ownership:

Runtime / TemplateCanvas

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
