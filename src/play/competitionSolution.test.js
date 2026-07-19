import { buildCompetitionSolution } from "./competitionSolution";

test("builds a complete competition word ordered by number", () => {
  expect(buildCompetitionSolution({
    template: {
      competitionCells: [
        { number: 3, index: 8 },
        { number: 1, index: 2 },
        { number: 2, index: 4 },
        { number: 6, index: 10 },
        { number: 5, index: 7 },
        { number: 4, index: 6 }
      ]
    },
    answers: {
      2: "K",
      4: "O",
      8: "R",
      6: "S",
      7: "E",
      10: "T"
    }
  })).toBe("KORSET");
});

test("leaves blank positions for partially completed competition cells", () => {
  expect(buildCompetitionSolution({
    template: {
      competitionCells: [
        { number: 1, index: 1 },
        { number: 2, index: 2 },
        { number: 3, index: 3 }
      ]
    },
    answers: {
      1: "A",
      3: "C"
    }
  })).toBe("A C   ");
});

test("returns blanks when competition cells are missing", () => {
  expect(buildCompetitionSolution({
    template: {},
    answers: {
      1: "A"
    }
  })).toBe("      ");
});

test("can read competition numbers from cell metadata", () => {
  expect(buildCompetitionSolution({
    template: {
      cellTypes: [
        "write",
        { type: "write", competitionNumber: 2 },
        { type: "write", competitionNumber: 1 }
      ]
    },
    answers: {
      1: "B",
      2: "A"
    }
  })).toBe("AB    ");
});
