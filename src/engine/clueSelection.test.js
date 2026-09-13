import { resolveClueSelection } from "./clueSelection";

test("resolves a horizontal single clue with its answer start", () => {
  expect(resolveClueSelection({
    currentIndex: 0,
    currentDirection: "down",
    rows: 2,
    cols: 4,
    cellTypes: [
      "blocked", "write", "write", "write",
      "empty", "empty", "empty", "empty"
    ]
  })).toEqual({
    clueIndex: 0,
    clueType: "blocked",
    direction: "across",
    answerStartIndex: 1,
    answerLength: 3,
    answerCellIndexes: [1, 2, 3]
  });
});

test("resolves a vertical single clue with its answer start", () => {
  expect(resolveClueSelection({
    currentIndex: 0,
    currentDirection: "across",
    rows: 3,
    cols: 3,
    cellTypes: [
      "blocked", "empty", "empty",
      "write", "empty", "empty",
      "write", "empty", "empty"
    ]
  })).toEqual({
    clueIndex: 0,
    clueType: "blocked",
    direction: "down",
    answerStartIndex: 3,
    answerLength: 2,
    answerCellIndexes: [3, 6]
  });
});

test("ignores an unrelated longer row above and resolves the supported answer start", () => {
  expect(resolveClueSelection({
    currentIndex: 6,
    currentDirection: "across",
    rows: 4,
    cols: 5,
    cellTypes: [
      "write", "write", "write", "write", "write",
      "empty", "blocked", "empty", "empty", "empty",
      "empty", "write", "empty", "empty", "empty",
      "empty", "write", "empty", "empty", "empty"
    ]
  })).toEqual({
    clueIndex: 6,
    clueType: "blocked",
    direction: "down",
    answerStartIndex: 11,
    answerLength: 2,
    answerCellIndexes: [11, 16]
  });
});

test("double clues toggle between the two supported answer starts", () => {
  const input = {
    currentIndex: 0,
    rows: 3,
    cols: 3,
    cellTypes: [
      "double", "write", "write",
      "write", "empty", "empty",
      "write", "empty", "empty"
    ]
  };

  expect(resolveClueSelection({
    ...input,
    currentDirection: "across"
  })).toMatchObject({
    direction: "down",
    answerStartIndex: 3,
    answerLength: 2
  });
  expect(resolveClueSelection({
    ...input,
    currentDirection: "down"
  })).toMatchObject({
    direction: "across",
    answerStartIndex: 1,
    answerLength: 2
  });
});

test("returns no selection when a clue has no supported answer start", () => {
  expect(resolveClueSelection({
    currentIndex: 0,
    currentDirection: "across",
    rows: 2,
    cols: 2,
    cellTypes: ["blocked", "empty", "empty", "write"]
  })).toBeNull();
});

test("resolves an explicit ordered turning path before topology inference", () => {
  expect(resolveClueSelection({
    currentIndex: 0,
    currentDirection: "down",
    rows: 3,
    cols: 3,
    cellTypes: [
      "blocked", "write", "write",
      "write", "write", "write",
      "write", "write", "write"
    ],
    answerPaths: [{
      clueIndex: 0,
      paths: [{
        direction: "across",
        cellIndexes: [1, 2, 5, 8, 7]
      }]
    }]
  })).toEqual({
    clueIndex: 0,
    clueType: "blocked",
    direction: "across",
    answerStartIndex: 1,
    answerLength: 5,
    answerCellIndexes: [1, 2, 5, 8, 7]
  });
});

test("explicit double paths preserve across down toggling", () => {
  const input = {
    currentIndex: 0,
    rows: 3,
    cols: 3,
    cellTypes: [
      "double", "write", "write",
      "write", "write", "write",
      "write", "write", "write"
    ],
    answerPaths: [{
      clueIndex: 0,
      paths: [
        { direction: "across", cellIndexes: [1, 2, 5] },
        { direction: "down", cellIndexes: [3, 6, 7] }
      ]
    }]
  };

  expect(resolveClueSelection({
    ...input,
    currentDirection: "across"
  })).toMatchObject({
    direction: "down",
    answerCellIndexes: [3, 6, 7]
  });
  expect(resolveClueSelection({
    ...input,
    currentDirection: "down"
  })).toMatchObject({
    direction: "across",
    answerCellIndexes: [1, 2, 5]
  });
});
