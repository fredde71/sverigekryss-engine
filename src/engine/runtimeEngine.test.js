import { getActiveCells } from "./activeLine";
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
    for (const type of ["blocked", "image", "double"]) {
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
      rows: 2
    }))).toEqual([1, 2]);
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
      rows: 3
    }))).toEqual([3, 6]);
  });

  test("normal active lines stop at blocked image and double cells", () => {
    const cellTypes = [
      "blocked", "write", "write", "double",
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
