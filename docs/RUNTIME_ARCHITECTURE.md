# RUNTIME_ARCHITECTURE.md

## Syfte

Detta dokument beskriver den aktiva runtime-arkitekturen.

Runtime ansvarar för att rendera och köra ett färdigt korsord.

---

# Aktiv Runtime Pipeline

App.js

↓

TemplateCanvas

↓

RuntimeLayer

↓

RuntimeGrid

↓

RuntimeCell

↓

PlayCell

---

# Runtime Ownership

## App.js

Ansvarar för:

- orchestration
- mode-val
- koppling mellan subsystem

App.js ska inte äga runtime state, runtime interaction/navigation eller runtime cell/grid-rendering.

App.js äger fortsatt mode/workflow och monterar RuntimeLayer i TemplateCanvas.

---

## TemplateCanvas

Ansvarar för:

- delad template presentation shell
- bakgrundsbild/canvas för Editor och Runtime
- overlay-yta där Runtime eller Editor renderas

TemplateCanvas äger inte:

- runtime state
- runtime interaction/navigation
- runtime cell/grid-rendering
- editor-specifikt beteende

Framtida Editor-ownership är separat från TemplateCanvas.

---

## RuntimeLayer

Ansvarar för:

- runtime state
- input handling
- click handling
- keyboard handling
- focus movement
- active line
- runtime grid/cell-rendering

RuntimeLayer äger RuntimeSession-beteende internt.

---

# Framtida Plattformflöden

Runtime är en del av en större Puzzle Platform.

Framtida AI-, publicerings- och statistikflöden ska kopplas runt Runtime utan att Runtime äger dessa ansvar.

Övergripande riktning:

- AI-assisted editor hjälper redaktören före publicering
- Publication workflow skapar och hanterar publiceringsinstanser
- Public Play använder publicerad Template-data för spelupplevelsen
- Submission och Competition-flöden kan samla in tävlingsbidrag
- Statistics samlas per Publication

Runtime ska fortsatt fokusera på spelupplevelsen:

- rendera ett publicerat korsord
- hantera inmatning och navigation
- exponera spelinteraktion för omgivande play-ytor när det behövs

Runtime ska inte äga:

- AI-tolkning
- publiceringsmetadata
- publicationId
- distributionslogik
- statistiklagring

---

## RuntimeGrid

Ansvarar för:

- grid-layout i Runtime
- placering av RuntimeCell i rader och kolumner

---

## RuntimeCell

Ansvarar för runtime-semantik.

RuntimeCell avgör hur olika typer av celler ska renderas.

Exempel:

- write
- double
- blocked
- image

RuntimeCell är bryggan mellan data och rendering.

---

## PlayCell

Ansvarar för:

- visuell representation
- användarinteraktion
- input-element

PlayCell ska inte äga korsordslogik.

---

# Runtime Celltyper

## image

Ansvar:

- upptar geometri
- inte skrivbar

---

## blocked

Ansvar:

- upptar geometri
- inte skrivbar

---

## double

Ansvar:

- ledtrådscell
- riktningshantering

---

## write

Ansvar:

- skrivbar cell
- lösningsyta

---

# Viktiga arkitekturfynd

## Geometriproblem

Tidigare renderades image-celler som:

return null

Detta skapade divergens mellan Editor och Runtime.

Lösning:

Alla celltyper måste uppta korrekt geometri.

---

## RuntimeCell-kontrakt

Kritisk bugg:

RuntimeCell fick inte:

type={type}

från App.js.

Konsekvens:

- write fungerade inte
- double fungerade inte
- blocked fungerade inte korrekt
- runtime-semantiken bröts

Lösning:

RuntimeCell-kontraktet återställdes genom att skicka type vidare från App.js.

---

# Verifierad status

Fungerar:

- write
- double
- blocked
- navigation
- riktningshantering
- active line
- editor/runtime-synk

Epic 1 runtime ownership är slutförd:

- App.js äger inte runtime state
- App.js äger inte runtime interaction/navigation
- App.js äger inte runtime cell/grid-rendering under RuntimeLayer
- RuntimeLayer äger runtime state, interaction/navigation, active line och runtime grid/cell-rendering

---

# Framtida arbete

- tydligare ownership mellan RuntimeCell och PlayCell
- fortsatt App.js-separation utanför Runtime ownership
- flytta editor-specifikt ägarskap till Editor-subsystemet
