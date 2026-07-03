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

Editor + Runtime

Prioritet:

Hög

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

# Fas 5 – Plattform

## 11. Backend

Mål:

Central lagring.

Ownership:

Backend

Prioritet:

Låg

---

## 12. API

Mål:

Kommunikation mellan frontend och backend.

Ownership:

Backend

Prioritet:

Låg

---

## 13. Användarhantering

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
