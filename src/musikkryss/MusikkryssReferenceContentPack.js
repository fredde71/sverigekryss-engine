import {
  MUSIKKRYSS_FIXED_FORMAT,
  normalizeMusikkryssContent
} from "./MusikkryssFormat";
import { createTemplateSolutionIndex } from "../template/templateSolutions";

const INTRO_SCRIPT = `Välkommen till Musikkrysset!

I dag blir det en musikalisk resa med rock, pop, instrument och några små
utflykter i radiohistorien.

Du får femton frågor. Några nummer har både ett vågrätt och ett lodrätt svar,
så lyssna noga på både nummer och riktning.

Du kan när som helst gå tillbaka till en tidigare fråga.

Då kör vi. Vi börjar högst upp i krysset med nummer ett.`;

const REFERENCE_ANSWERS = Object.freeze({
  "1:across": answer("HAMMERED", `Vi börjar tungt. Motörhead, med Lemmy Kilmister i spetsen, gav 2002 ut ett
album med bland annat låtarna Walk a Crooked Mile och Brave New World.
Vad heter albumet? Vi söker den engelska titeln på åtta bokstäver.
Svaret ska in på ett vågrätt.`),
  "1:down": answer("HÅRDROCK", `Vi stannar kvar bland distade gitarrer. Deep Purple, AC/DC och Motörhead
förknippas alla med en tyngre form av rockmusik. Vilken musikgenre söker vi?
Åtta bokstäver. Svaret ska in på ett lodrätt.`),
  "2:down": answer("METALLICA", `Nu söker vi ett amerikanskt metalband. Bandet bildades i början av 1980-talet
och har gjort låtar som Enter Sandman, Nothing Else Matters och Master of
Puppets. Vad heter bandet? Nio bokstäver. Svaret ska in på två lodrätt.`),
  "3:down": answer("EBONY", `Paul McCartney och Stevie Wonder fick en stor hit tillsammans 1982 med
Ebony and Ivory. Titeln anspelar på de svarta och vita tangenterna på ett piano.
Vi söker det första ordet i låttiteln. Fem bokstäver.
Svaret ska in på tre lodrätt.`),
  "4:down": answer("EGO", `Den svenska artisten Agnes släppte 2025 en singel om att lägga jaget åt sidan
och släppa kontrollen. Titeln består av bara tre bokstäver. Vad heter låten?
Svaret ska in på fyra lodrätt.`),
  "5:down": answer("GITARRER", `Nu blir det instrument. Akustiska, elektriska, tolvsträngade och klassiska.
Eric Clapton, Jimi Hendrix och Mark Knopfler har alla gjort sig berömda med
olika varianter av samma instrument. Vi söker instrumentet i plural.
Åtta bokstäver. Svaret ska in på fem lodrätt.`),
  "6:across": answer("OBOIST", `Vi lämnar rockscenen och går in i orkestern. En oboe är ett träblåsinstrument
med dubbelt rörblad. Vad kallas personen som spelar oboe?
Sex bokstäver. Svaret ska in på sex vågrätt.`),
  "7:across": answer("RALLY", `Lite svensk radiohistoria. Under slutet av 1990-talet och början av 2000-talet
sändes ett populärt humorprogram i P3 med bland andra Anna Mannheimer och
Peter Apelgren. Programmet blev känt för sketcher, parodier och egna versioner
av kända låtar. Vad hette programmet? Fem bokstäver.
Svaret ska in på sju vågrätt.`),
  "8:across": answer("AMOR", `Nu tar vi hjälp av spanskan och latinet. Det här fyrbokstavsordet betyder
kärlek och förekommer flitigt i musik, från operor och visor till moderna
poplåtar. Vilket ord söker vi? Fyra bokstäver.
Svaret ska in på åtta vågrätt.`),
  "8:down": answer("ADELE", `Från kärlek till en artist som har sjungit mycket om just kärlek och relationer.
Den brittiska sångerskan bakom Hello, Someone Like You, Rolling in the Deep
och Easy on Me använder sitt förnamn som artistnamn. Vad heter hon?
Fem bokstäver. Svaret ska in på åtta lodrätt.`),
  "9:across": answer("CHINESE", `Nu tillbaka till rocken. Guns N' Roses gav 2008 ut det efterlängtade albumet
Chinese Democracy. Vi söker det första ordet i albumtiteln.
Sju bokstäver. Svaret ska in på nio vågrätt.`),
  "10:down": answer("EKO", `När ett ljud studsar mot en yta och kommer tillbaka kan vi höra samma ljud
en gång till. Fenomenet används också som effekt i musikproduktion.
Vad kallas det på svenska? Tre bokstäver.
Svaret ska in på tio lodrätt.`),
  "11:across": answer("RE", `Nu blir det musikteori. I solmisation känner vi igen serien do, re, mi, fa,
sol, la och ti. Vilken stavelse kommer direkt efter do?
Två bokstäver. Svaret ska in på elva vågrätt.`),
  "12:across": answer("LP", `Före streamingens tid var vinylskivan ett självklart sätt att ge ut ett helt
album. Den större vinylskivan som normalt spelas med trettiotre och en tredjedels
varv per minut brukar betecknas med två bokstäver. Vilka?
Svaret ska in på tolv vågrätt.`),
  "13:across": answer("ABOVE", `Vi avslutar elektroniskt. Den brittiska trancegruppen Above & Beyond består
av Jono Grant, Tony McGuinness och Paavo Siljamäki.
Vi söker det första ordet i gruppnamnet. Fem bokstäver.
Svaret ska in på tretton vågrätt.`)
});

const REFERENCE_CONTENT = createReferenceContent();
const REFERENCE_VALIDATION = createTemplateSolutionIndex({
  crosswordType: "musikkryss",
  cellTypes: MUSIKKRYSS_FIXED_FORMAT.cellTopology.map(cell => (
    cell === "writable" ? "write" : "empty"
  )),
  musikkryss: REFERENCE_CONTENT
});

if (REFERENCE_VALIDATION.completenessStatus !== "complete") {
  throw new Error("Invalid Musikkryss reference content pack");
}

export function createMusikkryssReferenceContent() {
  return normalizeMusikkryssContent(REFERENCE_CONTENT);
}

export function getMusikkryssReferenceContentValidation() {
  return REFERENCE_VALIDATION;
}

function createReferenceContent() {
  const content = normalizeMusikkryssContent({
    introScript: INTRO_SCRIPT,
    answers: MUSIKKRYSS_FIXED_FORMAT.answerDefinitions.map(definition => {
      const id = `${definition.number}:${definition.direction}`;
      const reference = REFERENCE_ANSWERS[id];
      if (!reference) throw new Error(`Missing reference answer ${id}`);

      return {
        number: definition.number,
        direction: definition.direction,
        answerPath: [...definition.answerPath],
        solution: reference.solution,
        contentSequence: [{ type: "text", text: reference.script }]
      };
    })
  });

  return deepFreeze(content);
}

function answer(solution, script) {
  return Object.freeze({ solution, script });
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
