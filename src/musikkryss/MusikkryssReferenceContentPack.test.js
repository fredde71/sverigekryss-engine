import { createMusikkryssTemplate } from "./MusikkryssTemplateInitializer";
import {
  createMusikkryssReferenceContent,
  getMusikkryssReferenceContentValidation
} from "./MusikkryssReferenceContentPack";
import {
  createTemplateSolutionIndex,
  hasCompleteTemplateSolutions,
  stripTemplateSolutions
} from "../template/templateSolutions";
import { createTemplate } from "../template/templateModel";

test("reference pack is opt-in and future templates remain empty", () => {
  const first = createMusikkryssTemplate({
    crosswordId: "MUSIK-EMPTY-1",
    documentSize: { width: 490, height: 540 }
  });
  const reference = createMusikkryssReferenceContent();
  const second = createMusikkryssTemplate({
    crosswordId: "MUSIK-EMPTY-2",
    documentSize: { width: 490, height: 540 }
  });

  expect(first.musikkryss.introScript).toBe("");
  expect(second.musikkryss.introScript).toBe("");
  expect(second.musikkryss.answers.every(answer => (
    !Object.hasOwn(answer, "solution")
    && answer.contentSequence[0].text === ""
  ))).toBe(true);
  expect(reference.introScript).toContain("Välkommen till Musikkrysset!");
});

test("reference pack loads all scripts and canonical solutions on fixed paths", () => {
  const content = createMusikkryssReferenceContent();

  expect(content.answers).toHaveLength(15);
  expect(content.answers.every(answer => (
    answer.contentSequence.length === 1
    && answer.contentSequence[0].type === "text"
    && answer.contentSequence[0].text.length > 0
    && Array.from(answer.solution).length === answer.answerPath.length
  ))).toBe(true);
  expect(findAnswer(content, 1, "across").solution).toBe("HAMMERED");
  expect(findAnswer(content, 1, "down").solution).toBe("HÅRDROCK");
  expect(findAnswer(content, 13, "across").solution).toBe("ABOVE");
});

test("reference solutions are crossing-consistent and help-complete", () => {
  const content = createMusikkryssReferenceContent();
  const template = {
    ...createMusikkryssTemplate({
      crosswordId: "MUSIK-REFERENCE-1",
      documentSize: { width: 490, height: 540 }
    }),
    musikkryss: content
  };
  const index = createTemplateSolutionIndex(template);

  expect(getMusikkryssReferenceContentValidation().completenessStatus)
    .toBe("complete");
  expect(index.completenessStatus).toBe("complete");
  expect(index.conflicts).toEqual([]);
  expect(index.solutionAnswerCount).toBe(15);
  expect(hasCompleteTemplateSolutions(template)).toBe(true);
});

test("reference scripts and solutions persist through Template normalization", () => {
  const base = createMusikkryssTemplate({
    crosswordId: "MUSIK-REFERENCE-PERSIST",
    documentSize: { width: 490, height: 540 }
  });
  const reference = createMusikkryssReferenceContent();
  const persisted = createTemplate(JSON.parse(JSON.stringify({
    ...base,
    musikkryss: reference
  })));

  expect(persisted.musikkryss.introScript).toBe(reference.introScript);
  expect(persisted.musikkryss.answers.map(answer => answer.solution))
    .toEqual(reference.answers.map(answer => answer.solution));
  expect(persisted.musikkryss.answers.map(answer => (
    answer.contentSequence[0].text
  ))).toEqual(reference.answers.map(answer => answer.contentSequence[0].text));
});

test("solve projection strips every reference solution", () => {
  const content = createMusikkryssReferenceContent();
  const solveTemplate = stripTemplateSolutions({
    crosswordType: "musikkryss",
    musikkryss: content
  });

  expect(solveTemplate.musikkryss.answers.every(answer => (
    !Object.hasOwn(answer, "solution")
  ))).toBe(true);
  expect(content.answers.every(answer => Object.hasOwn(answer, "solution")))
    .toBe(true);
});

function findAnswer(content, number, direction) {
  return content.answers.find(answer => (
    answer.number === number && answer.direction === direction
  ));
}
