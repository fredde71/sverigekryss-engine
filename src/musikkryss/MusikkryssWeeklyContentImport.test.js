import { createMusikkryssReferenceContent } from "./MusikkryssReferenceContentPack";
import { MUSIKKRYSS_FIXED_FORMAT } from "./MusikkryssFormat";
import { importMusikkryssWeeklyContent } from "./MusikkryssWeeklyContentImport";

test("imports one complete valid weekly issue in format answer order", () => {
  const input = createValidImport();

  const result = importMusikkryssWeeklyContent(input);

  expect(result).toMatchObject({
    type: "musikkryss-weekly-content-import-result",
    version: 1,
    status: "valid",
    formatId: MUSIKKRYSS_FIXED_FORMAT.id,
    diagnostics: {
      status: "valid",
      expectedAnswerCount: 15,
      receivedAnswerCount: 15,
      normalizedAnswerCount: 15,
      entries: []
    }
  });
  expect(result.content.issue).toEqual(input.issue);
  expect(result.content.answers.map(answer => answerKey(answer)))
    .toEqual(MUSIKKRYSS_FIXED_FORMAT.answerDefinitions.map(answerKey));
  expect(Object.isFrozen(result)).toBe(true);
});

test("rejects a missing answer without silently filling it", () => {
  const input = createValidImport();
  const missing = input.answers.pop();

  const result = importMusikkryssWeeklyContent(input);

  expectInvalid(result, "missing-answer");
  expect(result.diagnostics.entries).toContainEqual(expect.objectContaining({
    answerRef: {
      number: missing.number,
      direction: missing.direction
    }
  }));
});

test("rejects a duplicate answer", () => {
  const input = createValidImport();
  input.answers.push(clone(input.answers[0]));

  expectInvalid(importMusikkryssWeeklyContent(input), "duplicate-answer");
});

test("rejects an unexpected answer", () => {
  const input = createValidImport();
  input.answers.push({
    number: 99,
    direction: "across",
    contentSequence: [{ type: "text", text: "Okänd fråga" }],
    solution: "X"
  });

  expectInvalid(importMusikkryssWeeklyContent(input), "unexpected-answer");
});

test("rejects an empty answer script", () => {
  const input = createValidImport();
  input.answers[0].contentSequence[0].text = "   ";

  expectInvalid(importMusikkryssWeeklyContent(input), "empty-script");
});

test("rejects a solution whose length differs from its format path", () => {
  const input = createValidImport();
  input.answers[0].solution = `${input.answers[0].solution}X`;

  const result = importMusikkryssWeeklyContent(input);

  expectInvalid(result, "solution-length-mismatch");
  expect(result.diagnostics.entries).toContainEqual(expect.objectContaining({
    code: "solution-length-mismatch",
    details: {
      expectedLength: 8,
      actualLength: 9
    }
  }));
});

test("rejects conflicting letters at crossings", () => {
  const input = createValidImport();
  const answer = input.answers.find(candidate => (
    candidate.number === 1 && candidate.direction === "down"
  ));
  answer.solution = `X${Array.from(answer.solution).slice(1).join("")}`;

  expectInvalid(importMusikkryssWeeklyContent(input), "crossing-conflict");
});

test("always derives answer paths from the selected format", () => {
  const input = createValidImport();
  input.answers.reverse();

  const result = importMusikkryssWeeklyContent(input);

  expect(result.status).toBe("valid");
  result.content.answers.forEach((answer, index) => {
    expect(answer.answerPath).toEqual(
      MUSIKKRYSS_FIXED_FORMAT.answerDefinitions[index].answerPath
    );
  });
  expect(input.answers.every(answer => !Object.hasOwn(answer, "answerPath")))
    .toBe(true);
});

test("preserves provider-neutral speechText separately from display text", () => {
  const input = createValidImport();
  input.answers[0].contentSequence[0].speechText = "Anpassad uppläsning";

  const result = importMusikkryssWeeklyContent(input);

  expect(result.status).toBe("valid");
  expect(result.content.answers[0].contentSequence[0]).toEqual({
    type: "text",
    text: input.answers[0].contentSequence[0].text,
    speechText: "Anpassad uppläsning"
  });
});

test("does not mutate import input or external session document and grid state", () => {
  const input = deepFreeze(createValidImport());
  const session = {
    imageSrc: "weekly.pdf",
    rows: 9,
    cols: 10,
    gridArea: { top: 10, left: 20, width: 900, height: 810 },
    cellTypes: Array(90).fill("write")
  };
  const sessionBefore = clone(session);
  const inputBefore = clone(input);

  const result = importMusikkryssWeeklyContent(input);

  expect(result.status).toBe("valid");
  expect(input).toEqual(inputBefore);
  expect(session).toEqual(sessionBefore);
  expect(result.content).not.toHaveProperty("rows");
  expect(result.content).not.toHaveProperty("cols");
  expect(result.content).not.toHaveProperty("gridArea");
  expect(result.content).not.toHaveProperty("cellTypes");
});

function createValidImport() {
  const reference = createMusikkryssReferenceContent();

  return {
    type: "musikkryss-weekly-content",
    version: 1,
    formatId: MUSIKKRYSS_FIXED_FORMAT.id,
    issue: {
      crosswordId: "MUSIK-2026-38",
      title: "Musikkrysset vecka 38",
      issueNumber: "38",
      publishWeek: "2026-W38",
      publishDate: "2026-09-19",
      producerReference: "PRODUCER-2026-38"
    },
    introScript: reference.introScript,
    answers: reference.answers.map(answer => ({
      number: answer.number,
      direction: answer.direction,
      contentSequence: answer.contentSequence.map(entry => ({ ...entry })),
      solution: answer.solution
    }))
  };
}

function expectInvalid(result, code) {
  expect(result.status).toBe("invalid");
  expect(result.content).toBeNull();
  expect(result.diagnostics.status).toBe("invalid");
  expect(result.diagnostics.entries.map(entry => entry.code)).toContain(code);
}

function answerKey(answer) {
  return `${answer.number}:${answer.direction}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
