# RUNTIME_ARCHITECTURE.md

## Syfte

Detta dokument beskriver den aktiva runtime-arkitekturen.

Runtime ansvarar för att rendera och köra ett färdigt korsord.

---

# Aktiv Runtime Pipeline

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

# Runtime Ownership

## App.js

Ansvarar för:

- orchestration
- mode-val
- koppling mellan subsystem
- delad template presentation shell
- bakgrundsbild/canvas för Editor och Runtime

App.js ska inte äga runtime state, runtime interaction/navigation eller runtime cell/grid-rendering.

Bakgrund/canvas ligger kvar i App.js tills vidare eftersom det är delad template-presentation.

Framtida kandidat:

- neutral TemplateCanvas/PuzzleCanvas för delad template/canvas-presentation.

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
- neutral TemplateCanvas/PuzzleCanvas för delad template/canvas-presentation
- fortsatt App.js-separation utanför Runtime ownership
