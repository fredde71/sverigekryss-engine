import {
  createEmptyMusikkryssContent,
  MUSIKKRYSS_FIXED_FORMAT,
  normalizeMusikkryssContent
} from "./MusikkryssFormat";

test("defines the recurring 10 by 9 geometry and topology", () => {
  expect(MUSIKKRYSS_FIXED_FORMAT.gridDimensions).toEqual({ rows: 9, cols: 10 });
  expect(MUSIKKRYSS_FIXED_FORMAT.gridGeometry.axes.horizontal.normalizedLinePositions)
    .toEqual(Array.from({ length: 10 }, (_, index) => index / 9));
  expect(MUSIKKRYSS_FIXED_FORMAT.gridGeometry.axes.vertical.normalizedLinePositions)
    .toEqual(Array.from({ length: 11 }, (_, index) => index / 10));
  expect(MUSIKKRYSS_FIXED_FORMAT.normalizedDocumentGridArea).toEqual({
    top: 30 / 540,
    left: 20 / 490,
    width: 450 / 490,
    height: 405 / 540
  });
  expect(MUSIKKRYSS_FIXED_FORMAT.cellTopology).toHaveLength(90);
  expect(topologyRows(MUSIKKRYSS_FIXED_FORMAT.cellTopology)).toEqual([
    "WWWWWWWWNW",
    "WNWNWNWNNW",
    "WNWNWWWWWW",
    "WNWNWNNNNW",
    "WWWWWNWWWW",
    "WNWNNNWNNW",
    "WWWWWWWNWW",
    "WNWNWNWWNW",
    "NNWWWWWNNN"
  ]);
  expect(MUSIKKRYSS_FIXED_FORMAT.cellTopology.filter(
    value => value === "writable"
  )).toHaveLength(59);
  expect(MUSIKKRYSS_FIXED_FORMAT.cellTopology.filter(
    value => value === "non-writable"
  )).toHaveLength(31);
});

test("derives thirteen numbered starts and every directional answer", () => {
  expect(MUSIKKRYSS_FIXED_FORMAT.clueNumbers).toEqual([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13
  ]);
  expect(MUSIKKRYSS_FIXED_FORMAT.numberedStartCells).toEqual([
    { number: 1, cellIndex: 0, directions: ["across", "down"] },
    { number: 2, cellIndex: 2, directions: ["down"] },
    { number: 3, cellIndex: 4, directions: ["down"] },
    { number: 4, cellIndex: 6, directions: ["down"] },
    { number: 5, cellIndex: 9, directions: ["down"] },
    { number: 6, cellIndex: 24, directions: ["across"] },
    { number: 7, cellIndex: 40, directions: ["across"] },
    { number: 8, cellIndex: 46, directions: ["across", "down"] },
    { number: 9, cellIndex: 60, directions: ["across"] },
    { number: 10, cellIndex: 64, directions: ["down"] },
    { number: 11, cellIndex: 68, directions: ["across"] },
    { number: 12, cellIndex: 76, directions: ["across"] },
    { number: 13, cellIndex: 82, directions: ["across"] }
  ]);
  expect(MUSIKKRYSS_FIXED_FORMAT.answerDefinitions).toHaveLength(15);
  expect(findAnswer(1, "across").answerPath).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  expect(findAnswer(1, "down").answerPath).toEqual([0, 10, 20, 30, 40, 50, 60, 70]);
  expect(findAnswer(8, "across").answerPath).toEqual([46, 47, 48, 49]);
  expect(findAnswer(8, "down").answerPath).toEqual([46, 56, 66, 76, 86]);
  expect(Object.isFrozen(MUSIKKRYSS_FIXED_FORMAT.clueNumbers)).toBe(true);
  expect(Object.isFrozen(MUSIKKRYSS_FIXED_FORMAT.cellTopology)).toBe(true);
});

test("creates independent empty authoring content for the fixed format", () => {
  const first = createEmptyMusikkryssContent();
  const second = createEmptyMusikkryssContent();

  first.answers[0].contentSequence[0].text = "Ändrad";
  first.answers[0].answerPath.push(89);

  expect(second.answers[0].contentSequence[0].text).toBe("");
  expect(second.answers[0]).toEqual(expect.objectContaining({
    number: 1,
    direction: "across",
    answerPath: [0, 1, 2, 3, 4, 5, 6, 7]
  }));
  expect(second.answers).toHaveLength(15);
});

test("normalizes content independently by number and direction without mutation", () => {
  const input = {
    formatId: "ignored-format",
    introScript: "Välkommen",
    answers: [
      {
        number: 1,
        direction: "across",
        contentSequence: [{ type: "text", text: "Vågrät text" }]
      },
      {
        number: 1,
        direction: "down",
        contentSequence: [{ type: "text", text: "Lodrät text" }]
      }
    ]
  };
  const before = JSON.stringify(input);

  const result = normalizeMusikkryssContent(input);

  expect(result.formatId).toBe(MUSIKKRYSS_FIXED_FORMAT.id);
  expect(result.introScript).toBe("Välkommen");
  expect(result.answers).toHaveLength(15);
  expect(result.answers[0].contentSequence[0].text).toBe("Vågrät text");
  expect(result.answers[1].contentSequence[0].text).toBe("Lodrät text");
  expect(result.answers[0].answerPath).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  expect(result.answers[1].answerPath).toEqual([0, 10, 20, 30, 40, 50, 60, 70]);
  expect(JSON.stringify(input)).toBe(before);
});

test("uses topology-derived paths instead of authored path input", () => {
  const result = normalizeMusikkryssContent({
    answers: [{
      number: 8,
      direction: "down",
      answerPath: [0, 1]
    }]
  });

  expect(result.answers.find(answer => (
    answer.number === 8 && answer.direction === "down"
  ))).toEqual(expect.objectContaining({
    number: 8,
    direction: "down",
    answerPath: [46, 56, 66, 76, 86]
  }));
});

function findAnswer(number, direction) {
  return MUSIKKRYSS_FIXED_FORMAT.answerDefinitions.find(answer => (
    answer.number === number && answer.direction === direction
  ));
}

function topologyRows(topology) {
  return Array.from({ length: 9 }, (_, row) => (
    topology
      .slice(row * 10, row * 10 + 10)
      .map(value => value === "writable" ? "W" : "N")
      .join("")
  ));
}
