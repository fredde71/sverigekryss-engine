import { getActiveCells } from "./activeLine";
import { resolveClueSelection } from "./clueSelection";
import {
  getDirection,
  getArrowNextIndex,
  getNextCell
} from "./navigation";
import { normalizeInputValue } from "./input";

function asArray(set) {
  return Array.from(set).sort((a, b) => a - b);
}

describe("normalizeInputValue", () => {
  test("uppercases and limits input to one character", () => {
    expect(normalizeInputValue("a")).toBe("A");
    expect(normalizeInputValue("åland")).toBe("Å");
    expect(normalizeInputValue("")).toBe("");
  });
});

describe("getDirection", () => {
  test("returns toggle when both right and down cells are writable", () => {
    const cellTypes = [
      "double", "write",
      "write", "blocked"
    ];

    expect(getDirection({
      currentIndex: 0,
      cols: 2,
      rows: 2,
      cellTypes
    })).toBe("toggle");
  });

  test("single-clue direction and answer start are resolved together", () => {
    const cellTypes = [
      "blocked", "write", "write", "write",
      "write", "blocked", "blocked", "blocked",
      "blocked", "blocked", "blocked", "blocked"
    ];

    expect(resolveClueSelection({
      currentIndex: 0,
      currentDirection: "across",
      cols: 4,
      rows: 3,
      cellTypes
    })).toEqual({
      clueIndex: 0,
      clueType: "blocked",
      direction: "across",
      answerStartIndex: 1,
      answerLength: 3,
      answerCellIndexes: [1, 2, 3]
    });

    expect(resolveClueSelection({
      currentIndex: 0,
      currentDirection: "across",
      cols: 4,
      rows: 3,
      cellTypes: [
        "blocked", "write", "blocked", "blocked",
        "write", "empty", "empty", "empty",
        "write", "empty", "empty", "empty"
      ]
    })).toEqual({
      clueIndex: 0,
      clueType: "blocked",
      direction: "down",
      answerStartIndex: 4,
      answerLength: 2,
      answerCellIndexes: [4, 8]
    });
  });

  test("returns across when only the right cell is writable", () => {
    const cellTypes = [
      "double", "write",
      "blocked", "blocked"
    ];

    expect(getDirection({
      currentIndex: 0,
      cols: 2,
      rows: 2,
      cellTypes
    })).toBe("across");
  });

  test("returns down when only the down cell is writable", () => {
    const cellTypes = [
      "double", "blocked",
      "write", "blocked"
    ];

    expect(getDirection({
      currentIndex: 0,
      cols: 2,
      rows: 2,
      cellTypes
    })).toBe("down");
  });

  test("returns null when no adjacent writable direction exists", () => {
    const cellTypes = [
      "double", "blocked",
      "image", "write"
    ];

    expect(getDirection({
      currentIndex: 0,
      cols: 2,
      rows: 2,
      cellTypes
    })).toBeNull();
  });
});

describe("getNextCell", () => {
  test("follows an explicit ordered path through a turn", () => {
    const clueSelection = {
      answerCellIndexes: [1, 2, 5, 8, 7]
    };

    expect(getNextCell({
      currentIndex: 2,
      direction: "across",
      cols: 3,
      rows: 3,
      cellTypes: Array(9).fill("write"),
      clueSelection
    })).toBe(5);
    expect(getNextCell({
      currentIndex: 8,
      direction: "across",
      cols: 3,
      rows: 3,
      cellTypes: Array(9).fill("write"),
      clueSelection
    })).toBe(7);
  });

  test("advances across into a writable cell", () => {
    expect(getNextCell({
      currentIndex: 0,
      direction: "across",
      cols: 3,
      rows: 2,
      cellTypes: [
        "write", "write", "blocked",
        "write", "write", "write"
      ]
    })).toBe(1);
  });

  test("stops across at row boundary", () => {
    expect(getNextCell({
      currentIndex: 2,
      direction: "across",
      cols: 3,
      rows: 2,
      cellTypes: Array(6).fill("write")
    })).toBeUndefined();
  });

  test("stops across before non-writable cells", () => {
    for (const type of ["blocked", "image", "double", "empty"]) {
      expect(getNextCell({
        currentIndex: 0,
        direction: "across",
        cols: 3,
        rows: 2,
        cellTypes: [
          "write", type, "write",
          "write", "write", "write"
        ]
      })).toBeUndefined();
    }
  });

  test("advances down into a writable cell and stops at boundaries or non-writable cells", () => {
    expect(getNextCell({
      currentIndex: 0,
      direction: "down",
      cols: 3,
      rows: 2,
      cellTypes: [
        "write", "write", "write",
        "write", "blocked", "write"
      ]
    })).toBe(3);

    expect(getNextCell({
      currentIndex: 3,
      direction: "down",
      cols: 3,
      rows: 2,
      cellTypes: Array(6).fill("write")
    })).toBeUndefined();

    expect(getNextCell({
      currentIndex: 1,
      direction: "down",
      cols: 3,
      rows: 2,
      cellTypes: [
        "write", "write", "write",
        "write", "double", "write"
      ]
    })).toBeUndefined();
  });
});

describe("getArrowNextIndex", () => {
  test("handles arrow keys", () => {
    expect(getArrowNextIndex({
      currentIndex: 4,
      key: "ArrowRight",
      cols: 3
    })).toBe(5);

    expect(getArrowNextIndex({
      currentIndex: 4,
      key: "ArrowLeft",
      cols: 3
    })).toBe(3);

    expect(getArrowNextIndex({
      currentIndex: 4,
      key: "ArrowDown",
      cols: 3
    })).toBe(7);

    expect(getArrowNextIndex({
      currentIndex: 4,
      key: "ArrowUp",
      cols: 3
    })).toBe(1);
  });

  test("returns null for unknown keys", () => {
    expect(getArrowNextIndex({
      currentIndex: 4,
      key: "Enter",
      cols: 3
    })).toBeNull();
  });
});

describe("getActiveCells", () => {
  test("uses the exact explicit path including direction changes", () => {
    const cellTypes = [
      "blocked", "write", "write",
      "empty", "empty", "write",
      "empty", "write", "write"
    ];
    const clueSelection = resolveClueSelection({
      currentIndex: 0,
      currentDirection: "down",
      cellTypes,
      cols: 3,
      rows: 3,
      answerPaths: [{
        clueIndex: 0,
        paths: [{
          direction: "across",
          cellIndexes: [1, 2, 5, 8, 7]
        }]
      }]
    });

    expect(asArray(getActiveCells({
      activeCell: 0,
      direction: "across",
      cellTypes,
      cols: 3,
      rows: 3,
      clueSelection
    }))).toEqual([1, 2, 5, 7, 8]);
  });

  test("excludes double clue cells and highlights only writable cells across", () => {
    const cellTypes = [
      "double", "write", "write", "blocked",
      "empty", "write", "image", "write"
    ];

    expect(asArray(getActiveCells({
      activeCell: 0,
      direction: "across",
      cellTypes,
      cols: 4,
      rows: 2,
      clueSelection: resolveClueSelection({
        currentIndex: 0,
        currentDirection: "down",
        cellTypes,
        cols: 4,
        rows: 2
      })
    }))).toEqual([1, 2]);
  });

  test("excludes simple clue blocked cells and highlights only writable cells across", () => {
    const cellTypes = [
      "blocked", "write", "write", "empty",
      "write", "write", "image", "write"
    ];

    expect(asArray(getActiveCells({
      activeCell: 0,
      direction: "across",
      cellTypes,
      cols: 4,
      rows: 2,
      clueSelection: resolveClueSelection({
        currentIndex: 0,
        currentDirection: "across",
        cellTypes,
        cols: 4,
        rows: 2
      })
    }))).toEqual([1, 2]);
  });

  test("uses the TT-2026-0002 blocked clue anchor instead of the longer row above", () => {
    const rows = 25;
    const cols = 25;
    const cellTypes = Array(rows * cols).fill("empty");

    [
      277,
      278,
      279,
      280,
      281,
      282,
      300,
      301,
      302,
      304,
      305,
      306,
      328,
      329
    ].forEach(index => {
      cellTypes[index] = "write";
    });

    cellTypes[303] = "blocked";
    cellTypes[307] = "double";

    expect(asArray(getActiveCells({
      activeCell: 303,
      direction: "across",
      cellTypes,
      cols,
      rows,
      clueSelection: resolveClueSelection({
        currentIndex: 303,
        currentDirection: "across",
        cellTypes,
        cols,
        rows
      })
    }))).toEqual([304, 305, 306]);
  });

  test("excludes double clue cells and highlights only writable cells down", () => {
    const cellTypes = [
      "double", "write", "write",
      "write", "blocked", "write",
      "write", "write", "double"
    ];

    expect(asArray(getActiveCells({
      activeCell: 0,
      direction: "down",
      cellTypes,
      cols: 3,
      rows: 3,
      clueSelection: resolveClueSelection({
        currentIndex: 0,
        currentDirection: "across",
        cellTypes,
        cols: 3,
        rows: 3
      })
    }))).toEqual([3, 6]);
  });

  test("normal active lines stop at blocked image double and empty cells", () => {
    const cellTypes = [
      "blocked", "write", "write", "empty",
      "image", "write", "write", "write"
    ];

    expect(asArray(getActiveCells({
      activeCell: 2,
      direction: "across",
      cellTypes,
      cols: 4,
      rows: 2
    }))).toEqual([1, 2]);

    expect(asArray(getActiveCells({
      activeCell: 2,
      direction: "down",
      cellTypes,
      cols: 4,
      rows: 2
    }))).toEqual([2, 6]);
  });
});
