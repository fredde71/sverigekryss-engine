# DEVELOPMENT_RULES.md

## Syfte

Detta dokument är projektets konstitution.

Alla förändringar i systemet ska följa dessa regler oavsett om arbetet utförs av människa, AI eller en kombination.

Reglerna är överordnade enskilda implementationer, optimeringar och buggrättningar.

---

# Working Principles

- Ownership before implementation.
- One ownership package per commit.
- Verify before changing.
- Architecture drives implementation.
- Documentation follows architectural milestones.
- Generalize only after the second proven use case.
- Protect the domain; let implementation evolve.

---

# Grundprinciper

## 0. Systemet digitaliserar, det genererar inte korsord

Systemet får aldrig generera korsordsinnehåll.

Alla korsord kommer från färdiga PDF:er eller motsvarande färdiga tryckunderlag.

Systemet digitaliserar endast befintliga korsord genom att redaktören markerar strukturen:

- skrivbara rutor
- spärrrutor
- bildytor
- dubbelcellsledtrådar
- tävlingsrutor
- crop och gridplacering
- övrig metadata som behövs för publicering

AI får endast fungera som assistent för redaktören.

AI-stöd får hjälpa till att tolka, föreslå, kontrollera eller automatisera redaktörens arbete.

AI får inte ersätta den färdiga PDF:en som källa till korsordets innehåll.

---

## 1. Vi bygger produkt, inte prototyp

Alla förändringar ska göras med långsiktig förvaltning i åtanke.

Temporära lösningar, nödlösningar och lokala patchar ska undvikas.

---

## 2. Subsystem före funktioner

Innan en förändring görs ska det vara tydligt vilket subsystem som påverkas.

Exempel:

- Editor
- Runtime
- Engine
- Components
- Persistence
- API

Funktioner implementeras inom subsystem.

Subsystem får aldrig skapas som en konsekvens av en enskild funktion.

---

## 3. Ownership före implementation

Innan kod ändras ska följande vara tydligt:

- Vem äger ansvaret?
- Vilken komponent eller modul ansvarar för beteendet?
- Var ska logiken leva långsiktigt?

Kod får inte placeras där den råkar fungera.

Kod ska placeras där ansvaret hör hemma.

---

## 4. Grundorsak före symptom

Buggar ska analyseras innan de åtgärdas.

Vi åtgärdar orsaken till felet.

Vi åtgärdar inte endast det synliga symptomet.

---

## 5. En verifierad förändring i taget

Endast en logisk förändring får göras mellan två verifieringar.

Efter varje förändring ska systemet testas.

Först därefter får nästa förändring genomföras.

---

## 6. Ingen oplanerad optimering

Kod får inte optimeras utan tydlig arkitektonisk motivering.

Refactoring ska vara kopplad till:

- ownership
- subsystemgränser
- underhållbarhet
- arkitektur

---

## 7. App.js ska reduceras över tid

App.js är orchestrator.

Ansvar ska flyttas till respektive subsystem.

---

## 8. Dokumentation före nästa subsystem

När en större milstolpe uppnås ska dokumentationen uppdateras innan nästa större subsystemarbete påbörjas.

---

# PRE-FLIGHT CHECK

Innan någon kodändring föreslås ska följande besvaras:

1. Vilket subsystem arbetar vi i?
2. Vilket ownership påverkas?
3. Är problemet grundorsak eller symptom?
4. Vilken regel motiverar förändringen?
5. Är detta exakt en förändring?
6. Hur verifieras förändringen?

Om någon punkt saknar svar ska ingen kodändring föreslås.

---

# Arbetsmetod

Analys

↓

Beslut

↓

En förändring

↓

Verifiering

↓

Dokumentation

↓

Nästa förändring

Denna ordning får inte brytas.

# GENOMFÖRANDE VID VARJE STEG

Varje kodändring ska inledas med:

Mapp:
Fil:
Subsystem:
Mål:

--------------------------------

Verifiering ska alltid beskriva:

✓ Kompilerar
✓ Editor
✓ Play
✓ Browser

--------------------------------

Dokumentation

Efter verifiering ska det beslutas om:

- Ingen dokumentation
eller
- Uppdatera CURRENT_STATE.md

Detta beslut ska fattas innan nästa förändring påbörjas.

--------------------------------

Subsystemprincip

Ett subsystem ska migreras färdigt innan buggrättning inom subsystemet påbörjas.

Observationer får dokumenteras.

Åtgärder skjuts upp tills subsystemet är färdigmigrerat.

--------------------------------

Definition av färdigmigrerat subsystem

Ett subsystem är färdigt när:

✓ Migreringen är klar
✓ Verifieringen är genomförd
✓ Ingen regression finns
✓ Dokumentationen är uppdaterad

9. Befintlig projektstruktur före nya artefakter

Innan nya mappar, dokument eller arkitektur föreslås ska det verifieras om projektet redan innehåller en motsvarande struktur.

Befintliga artefakter ska återanvändas och utvecklas före nya skapas.

Sverigekryss Engine – Development Rules
1. Ett steg i taget

Vi genomför endast en logisk förändring åt gången. Varje steg ska kunna testas och verifieras innan vi går vidare.

2. Ingen gissning

Vi ändrar aldrig kod baserat på antaganden. Om något är oklart analyserar vi kodbasen först.

3. Verifiera före ändring

Innan vi flyttar, tar bort eller skriver om kod verifierar vi:

används komponenten?
vem äger ansvaret?
finns det redan en implementation?
är detta rätt lager för logiken?
4. Single Responsibility Principle

Varje komponent ska ha ett tydligt ansvar.

Exempel:

RuntimeLayer = runtime-logik
RuntimeCell = en spelruta
PlayCell = input-komponent
RuntimeGrid = grid-layout
RuntimeViewport = viewport
5. Containers före funktioner

När ny funktionalitet ska utvecklas frågar vi först:

Vilken container ska äga detta?

Inte:

Var kan vi få plats med denna kod?

6. Ingen duplicerad logik

Om samma logik finns på flera ställen ska den slås ihop till en gemensam implementation.

7. App.js ska vara tunn

App.js ska endast koordinera applikationen. Affärslogik ska flyttas till Editor-, Runtime- eller Engine-lagren.

8. Analys före implementation

Vid större förändringar gör vi alltid:

Arkitekturanalys
Beslut
Implementation
Test
Commit
9. Sprintbaserat arbetssätt

Varje arbetspass börjar med en liten sprintplan där endast ett fåtal tydliga mål prioriteras.

10. Commit ofta

När ett steg är verifierat görs en commit innan nästa större förändring påbörjas.

En regel jag skulle vilja lägga till

Det finns en regel som jag tror är minst lika viktig som de andra, eftersom den beskriver hur vi samarbetar:

11. Tydliga roller

Produktägaren (du):

beskriver hur produkten ska fungera,
prioriterar funktioner,
testar resultatet.

Arkitekten (jag):

analyserar kodbasen,
planerar nästa steg,
ansvarar för den tekniska riktningen,
ser till att arkitekturen hålls ren.

Codex:

används som analys- och implementeringsverktyg,
fattar inga egna arkitekturbeslut.

Regel 12 – Arkitekturanalys före större refaktorering

Innan större strukturella förändringar genomförs ska hela det berörda området analyseras. Analysen används som beslutsunderlag, men ersätter inte verifiering.

Det är exakt det vi gjorde nu.

Regel 13 – Verifiera innan borttagning

Ingen fil, komponent eller funktion tas bort enbart för att den verkar oanvänd. Användning ska verifieras innan borttagning.

Det här är en av de vanligaste orsakerna till buggar i större projekt.

Jag vill också lägga till ett arbetssätt

När vi använder Codex ska vi använda det i tre tydliga roller.

1. Analytiker

Codex analyserar projektet.

Exempel:

"Analysera Runtime."

2. Assistent

Codex genomför kodändringar enligt våra beslut.

3. Revisor

Efter en refaktorering kan vi fråga:

Finns det fortfarande dubblerad runtime-kod?

eller

Finns det oanvänd kod kvar?

Det tycker jag är ett väldigt smart sätt att använda verktyget.

En sprint får bara ha ett tekniskt mål.
Om en ändring leder till nya möjligheter (t.ex. rensa imports eller ta bort död kod), ska de planeras som en egen sprint efter att den första ändringen är verifierad och committad.

Regel 14 – Inga tomma wrappers

En container får inte vara monterad om dess enda syfte är ett annat läge (Edit eller Runtime). Att bara gömma innehållet räcker inte – själva containern ska också avmonteras.
