# RUNTIME_ARCHITECTURE.md

## Syfte

Detta dokument beskriver den aktiva runtime-arkitekturen.

Runtime ansvarar för att rendera och köra ett färdigt korsord.

---

# Aktiv Runtime Pipeline

App.js (lokal Play) / Play.jsx (publicerad Browser)

↓

PlaySurface

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

Public Browser använder samma kedja genom `Play.jsx` och `PlaySurface`; det finns ingen separat clue- eller grid-runtime för publicerade länkar.

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
- gemensam clue selection för enkel- och dubbelledtrådar
- användning av explicit Template-ägd answer path när den finns

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

När Template innehåller ett komplett par `horizontalLinePositions` och `verticalLinePositions` placerar RuntimeGrid cellerna från dessa explicita dokumentkoordinater. Editor och Runtime använder därmed samma persistenta geometri. Templates utan explicita positioner behåller den uniforma grid-fallbacken.

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

## Clue selection och answer paths

`clueSelection` i Engine löser riktning, svarstart och hela svarscellssekvensen som en gemensam ren operation.

- enkelledtråd väljer sin enda explicita eller topologiskt härledda svarsväg
- dubbelledtråd växlar deterministiskt mellan två vägar
- explicit `answerPath` kan svänga och styr både markering och skrivnavigation
- äldre Templates utan `answerPaths` använder fortsatt rak topologisk inferens

RuntimeLayer äger valt clue/runtime-state. Template äger endast den beständiga ordnade sökvägen.

## Competition submission

`competitionCells` är Template-data med formen `{ index, position }`. Runtime ändrar inte denna metadata. `PlaySurface` och `buildCompetitionSolution` använder positionerna 1–6 för att skapa lösningen som skickas genom submission-flödet.

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
- explicita gemensamma grid-linjepositioner med uniform legacy-fallback
- enkel- och dubbelledtrådar med full active-line-markering
- Template-ägda svängande answer paths
- publicerad Browser/Play genom samma RuntimeLayer-pipeline

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
