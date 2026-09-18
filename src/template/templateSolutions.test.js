import { createMusikkryssTemplate } from "../musikkryss/MusikkryssTemplateInitializer";
import { createTemplate } from "./templateModel";
import {
  createTemplateSolutionIndex,
  stripTemplateSolutions
} from "./templateSolutions";

test("Sverigekryss stores canonical solutions on its existing answer paths", () => {
  const template = createSverigekryssTemplate({
    firstSolution: "AB",
    crossingSolution: "AXY"
  });
  const index = createTemplateSolutionIndex(template);

  expect(template.answerPaths[0].paths[0].solution).toBe("AB");
  expect(template.answerPaths[1].paths[0].solution).toBe("AXY");
  expect(index).toMatchObject({
    status: "available",
    completenessStatus: "complete",
    cellLetters: {
      1: "A",
      2: "B",
      4: "X",
      7: "Y"
    }
  });
  expect(index.entries[0].answerRef).toEqual({
    type: "sverigekryss-clue-answer",
    clueIndex: 0,
    direction: "across"
  });
});

test("Musikkryss directional answers preserve solutions consistent at crossings", () => {
  const template = createMusikkryssWithOneCrossing({
    across: "ABCDEFGH",
    down: "AIJKLMNO"
  });
  const index = createTemplateSolutionIndex(template);

  expect(index.status).toBe("available");
  expect(index.entries).toHaveLength(2);
  expect(index.cellLetters[0]).toBe("A");
  expect(index.cellLetters[1]).toBe("B");
  expect(index.cellLetters[10]).toBe("I");
});

test("Musikkryss preserves crossing conflicts for authoring but marks them inconsistent", () => {
  const template = createMusikkryssWithOneCrossing({
    across: "ABCDEFGH",
    down: "ZIJKLMNO"
  });
  const index = createTemplateSolutionIndex(template);

  expect(template.musikkryss.answers.find(answer => (
    answer.number === 1 && answer.direction === "down"
  )).solution).toBe("ZIJKLMNO");
  expect(index.status).toBe("inconsistent");
  expect(index.completenessStatus).toBe("inconsistent");
  expect(index.conflicts).toHaveLength(1);
});

test("incomplete solutions remain durable authoring state but are not complete", () => {
  const template = createSverigekryssTemplate({
    firstSolution: "A",
    crossingSolution: "AXY"
  });
  const index = createTemplateSolutionIndex(template);

  expect(template.answerPaths[0].paths[0].solution).toBe("A");
  expect(index.entries).toHaveLength(1);
  expect(index.completenessStatus).toBe("partial");
  expect(index.expectedAnswerCount).toBe(2);
  expect(index.solutionAnswerCount).toBe(1);
});

test("topology fallback answers keep help completeness unavailable", () => {
  const template = createTemplate({
    crosswordId: "TT-FALLBACK-SOLUTION",
    rows: 1,
    cols: 3,
    cellTypes: ["blocked", "write", "write"],
    documentSize: { width: 300, height: 100 },
    gridArea: { top: 0, left: 0, width: 300, height: 100 },
    imageSrc: ""
  });
  const index = createTemplateSolutionIndex(template);

  expect(index.completenessStatus).toBe("unavailable");
  expect(index.expectedAnswerCount).toBe(1);
  expect(index.missingAnswerPathCount).toBe(1);
});

test("solve projection removes solutions without mutating Template paths", () => {
  const template = createSverigekryssTemplate({
    firstSolution: "AB",
    crossingSolution: "AXY"
  });
  const projected = stripTemplateSolutions(template);

  expect(projected.answerPaths[0].paths[0]).not.toHaveProperty("solution");
  expect(template.answerPaths[0].paths[0].solution).toBe("AB");
});

function createSverigekryssTemplate({ firstSolution, crossingSolution }) {
  return createTemplate({
    crosswordId: "TT-SOLUTION-1",
    crosswordType: "sverigekryss",
    rows: 3,
    cols: 3,
    cellTypes: [
      "blocked", "write", "write",
      "blocked", "write", "empty",
      "empty", "write", "empty"
    ],
    documentSize: { width: 300, height: 300 },
    gridArea: { top: 0, left: 0, width: 300, height: 300 },
    imageSrc: "",
    answerPaths: [
      {
        clueIndex: 0,
        paths: [{
          direction: "across",
          cellIndexes: [1, 2],
          solution: firstSolution
        }]
      },
      {
        clueIndex: 3,
        paths: [{
          direction: "down",
          cellIndexes: [1, 4, 7],
          solution: crossingSolution
        }]
      }
    ]
  });
}

function createMusikkryssWithOneCrossing({ across, down }) {
  const template = createMusikkryssTemplate({
    crosswordId: "MUSIK-SOLUTION-1",
    documentSize: { width: 490, height: 540 },
    imageSrc: ""
  });
  const answers = template.musikkryss.answers.map(answer => {
    const id = `${answer.number}:${answer.direction}`;
    const solution = id === "1:across"
      ? across
      : id === "1:down"
        ? down
        : null;

    return {
      ...answer,
      ...(solution ? { solution } : {})
    };
  });

  return createTemplate({
    ...template,
    musikkryss: {
      ...template.musikkryss,
      answers
    }
  });
}
