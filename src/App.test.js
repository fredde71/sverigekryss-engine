import {
  createTemplate,
  normalizeTemplate
} from "./template/templateModel";

const requiredTemplateFields = [
  "crosswordId",
  "crosswordType",
  "rows",
  "cols",
  "cellTypes",
  "documentSize",
  "gridArea",
  "cropArea",
  "imageSrc",
  "metadata"
];

const defaultCropArea = {
  top: 0,
  left: 0,
  width: 1200,
  height: 1200
};

const defaultDocumentSize = {
  width: 1200,
  height: 1200
};

const sessionFields = [
  "answers",
  "activeCell",
  "direction",
  "inputRefs",
  "activeTool",
  "pendingRows",
  "pendingCols",
  "dragState",
  "resizeState"
];

test("createTemplate returns canonical Template v1 fields", () => {
  const template = createTemplate({
    crosswordId: "TT-2026-0001",
    rows: 2,
    cols: 3,
    cellTypes: ["write", "blocked"],
    gridArea: {
      top: 1,
      left: 2,
      width: 300,
      height: 200
    },
    documentSize: defaultDocumentSize,
    cropArea: defaultCropArea,
    imageSrc: "/grid.png",
    metadata: {
      title: "Test puzzle"
    }
  });

  expect(Object.keys(template)).toEqual(requiredTemplateFields);
  expect(template).toMatchObject({
    crosswordId: "TT-2026-0001",
    crosswordType: "sverigekryss",
    rows: 2,
    cols: 3,
    documentSize: defaultDocumentSize,
    gridArea: {
      top: 1,
      left: 2,
      width: 300,
      height: 200
    },
    imageSrc: "/grid.png",
    metadata: {
      title: "Test puzzle"
    }
  });
});

test("Template preserves Musikkryss editor content", () => {
  const template = createTemplate({
    crosswordId: "MUSIK-2026-0001",
    crosswordType: "musikkryss",
    rows: 2,
    cols: 2,
    cellTypes: Array(4).fill("write"),
    gridArea: {},
    imageSrc: "",
    musikkryss: {
      introScript: "Intro",
      clues: [{
        number: 1,
        contentSequence: [{ type: "text", text: "Första ledtråden" }]
      }]
    }
  });

  expect(template.crosswordType).toBe("musikkryss");
  expect(template.musikkryss.introScript).toBe("Intro");
  expect(template.musikkryss.clues).toHaveLength(13);
  expect(template.musikkryss.clues[0].contentSequence[0].text)
    .toBe("Första ledtråden");
});

test("legacy Template defaults to Sverigekryss without Musikkryss content", () => {
  const template = normalizeTemplate({
    crosswordId: "TT-LEGACY",
    rows: 1,
    cols: 1,
    cellTypes: ["write"],
    gridArea: {},
    imageSrc: ""
  });

  expect(template.crosswordType).toBe("sverigekryss");
  expect(template).not.toHaveProperty("musikkryss");
});

test("createTemplate includes default documentSize", () => {
  const template = createTemplate({
    crosswordId: "TT-2026-0001",
    rows: 1,
    cols: 1,
    cellTypes: ["write"],
    gridArea: {},
    imageSrc: ""
  });

  expect(template.documentSize).toEqual(defaultDocumentSize);
});

test("createTemplate preserves provided documentSize", () => {
  const documentSize = {
    width: 1200,
    height: 1697
  };

  const template = createTemplate({
    crosswordId: "TT-2026-0001",
    rows: 1,
    cols: 1,
    cellTypes: ["write"],
    documentSize,
    gridArea: {},
    imageSrc: ""
  });

  expect(template.documentSize).toEqual(documentSize);
});

test("createTemplate includes default cropArea", () => {
  const template = createTemplate({
    crosswordId: "TT-2026-0001",
    rows: 1,
    cols: 1,
    cellTypes: ["write"],
    gridArea: {},
    imageSrc: ""
  });

  expect(template.cropArea).toEqual(defaultCropArea);
});

test("createTemplate preserves provided cropArea", () => {
  const cropArea = {
    top: 100,
    left: 120,
    width: 800,
    height: 900
  };

  const template = createTemplate({
    crosswordId: "TT-2026-0001",
    rows: 1,
    cols: 1,
    cellTypes: ["write"],
    gridArea: {},
    cropArea,
    imageSrc: ""
  });

  expect(template.cropArea).toEqual(cropArea);
});

test("createTemplate normalizes cellTypes to rows times cols", () => {
  const template = createTemplate({
    crosswordId: "TT-2026-0001",
    rows: 2,
    cols: 3,
    cellTypes: ["write", "blocked"],
    gridArea: {},
    imageSrc: ""
  });

  expect(template.cellTypes).toEqual([
    "write",
    "blocked",
    "empty",
    "empty",
    "empty",
    "empty"
  ]);
});

test("createTemplate preserves valid competitionCells sorted by position", () => {
  const template = createTemplate({
    crosswordId: "TT-2026-0001",
    rows: 3,
    cols: 3,
    cellTypes: Array(9).fill("write"),
    gridArea: {},
    imageSrc: "",
    competitionCells: [
      { index: 8, position: 3 },
      { index: 1, position: 1 },
      { index: 4, position: 2 }
    ]
  });

  expect(template.competitionCells).toEqual([
    { index: 1, position: 1 },
    { index: 4, position: 2 },
    { index: 8, position: 3 }
  ]);
});

test("competitionCells removes invalid entries", () => {
  const template = normalizeTemplate({
    crosswordId: "TT-2026-0001",
    rows: 3,
    cols: 3,
    cellTypes: Array(9).fill("write"),
    gridArea: {},
    imageSrc: "",
    competitionCells: [
      { index: 2, position: 1 },
      { index: -1, position: 2 },
      { index: 3, position: 7 },
      { index: 4.5, position: 3 },
      { index: 5, position: "x" },
      null
    ]
  });

  expect(template.competitionCells).toEqual([
    { index: 2, position: 1 }
  ]);
});

test("competitionCells handles duplicates deterministically", () => {
  const template = normalizeTemplate({
    crosswordId: "TT-2026-0001",
    rows: 3,
    cols: 3,
    cellTypes: Array(9).fill("write"),
    gridArea: {},
    imageSrc: "",
    competitionCells: [
      { index: 2, position: 2 },
      { index: 3, position: 2 },
      { index: 2, position: 3 },
      { index: 4, position: 1 }
    ]
  });

  expect(template.competitionCells).toEqual([
    { index: 4, position: 1 },
    { index: 2, position: 2 }
  ]);
});

test("legacy Template without competitionCells remains unchanged", () => {
  const template = normalizeTemplate({
    crosswordId: "TT-2026-0002",
    rows: 1,
    cols: 1,
    cellTypes: ["write"],
    gridArea: {},
    imageSrc: ""
  });

  expect(template).not.toHaveProperty("competitionCells");
});

test("Template preserves one ordered turning answer path for a single clue", () => {
  const template = createTemplate({
    crosswordId: "TT-2026-0003",
    rows: 3,
    cols: 3,
    cellTypes: [
      "blocked", "write", "write",
      "empty", "empty", "write",
      "empty", "write", "write"
    ],
    gridArea: {},
    imageSrc: "",
    answerPaths: [{
      clueIndex: 0,
      paths: [{
        direction: "across",
        cellIndexes: [1, 2, 5, 8, 7]
      }]
    }]
  });

  expect(template.answerPaths).toEqual([{
    clueIndex: 0,
    paths: [{
      direction: "across",
      cellIndexes: [1, 2, 5, 8, 7]
    }]
  }]);
});

test("Template preserves two paths for a double clue and rejects a second single path", () => {
  const base = {
    crosswordId: "TT-2026-0004",
    rows: 3,
    cols: 3,
    gridArea: {},
    imageSrc: ""
  };
  const doubleTemplate = normalizeTemplate({
    ...base,
    cellTypes: [
      "double", "write", "write",
      "write", "empty", "empty",
      "write", "empty", "empty"
    ],
    answerPaths: [{
      clueIndex: 0,
      paths: [
        { direction: "across", cellIndexes: [1, 2] },
        { direction: "down", cellIndexes: [3, 6] }
      ]
    }]
  });
  const singleTemplate = normalizeTemplate({
    ...base,
    cellTypes: [
      "blocked", "write", "write",
      "write", "empty", "empty",
      "write", "empty", "empty"
    ],
    answerPaths: [{
      clueIndex: 0,
      paths: [
        { direction: "across", cellIndexes: [1, 2] },
        { direction: "down", cellIndexes: [3, 6] }
      ]
    }]
  });

  expect(doubleTemplate.answerPaths[0].paths).toHaveLength(2);
  expect(singleTemplate.answerPaths[0].paths).toEqual([
    { direction: "across", cellIndexes: [1, 2] }
  ]);
});

test("legacy Template without answerPaths remains unchanged", () => {
  const template = normalizeTemplate({
    crosswordId: "TT-2026-0002",
    rows: 1,
    cols: 1,
    cellTypes: ["blocked"],
    gridArea: {},
    imageSrc: ""
  });

  expect(template).not.toHaveProperty("answerPaths");
});

test("Template preserves complete explicit grid-line positions", () => {
  const horizontalLinePositions = [10, 40, 90];
  const verticalLinePositions = [20, 55, 120];
  const template = createTemplate({
    crosswordId: "TT-2026-0005",
    rows: 2,
    cols: 2,
    cellTypes: Array(4).fill("write"),
    gridArea: { top: 10, left: 20, width: 100, height: 80 },
    imageSrc: "",
    horizontalLinePositions,
    verticalLinePositions
  });

  expect(template.horizontalLinePositions).toEqual([10, 40, 90]);
  expect(template.verticalLinePositions).toEqual([20, 55, 120]);
  expect(template.horizontalLinePositions).not.toBe(horizontalLinePositions);
  expect(template.verticalLinePositions).not.toBe(verticalLinePositions);
});

test("Template omits incomplete or invalid explicit grid-line geometry", () => {
  const template = normalizeTemplate({
    crosswordId: "TT-2026-0005",
    rows: 2,
    cols: 2,
    cellTypes: Array(4).fill("write"),
    gridArea: { top: 10, left: 20, width: 100, height: 80 },
    imageSrc: "",
    horizontalLinePositions: [10, 40, 90],
    verticalLinePositions: [20, 20, 120]
  });

  expect(template).not.toHaveProperty("horizontalLinePositions");
  expect(template).not.toHaveProperty("verticalLinePositions");
});

test("legacy Template without explicit grid-line positions remains unchanged", () => {
  const template = normalizeTemplate({
    crosswordId: "TT-2026-0005",
    rows: 1,
    cols: 1,
    cellTypes: ["write"],
    gridArea: {},
    imageSrc: ""
  });

  expect(template).not.toHaveProperty("horizontalLinePositions");
  expect(template).not.toHaveProperty("verticalLinePositions");
});

test("normalizeTemplate applies defaults and normalizes cellTypes", () => {
  const template = normalizeTemplate({
    cellTypes: {
      0: "double",
      2: "write"
    }
  }, {
    crosswordId: "TT-2026-0002",
    rows: 2,
    cols: 2,
    gridArea: {
      top: 10,
      left: 20,
      width: 400,
      height: 400
    },
    documentSize: {
      width: 1200,
      height: 1697
    },
    cropArea: {
      top: 5,
      left: 6,
      width: 700,
      height: 800
    },
    imageSrc: "/fallback.png",
    metadata: {
      source: "defaults"
    }
  });

  expect(template).toEqual({
    crosswordId: "TT-2026-0002",
    crosswordType: "sverigekryss",
    rows: 2,
    cols: 2,
    cellTypes: [
      "double",
      "empty",
      "write",
      "empty"
    ],
    gridArea: {
      top: 10,
      left: 20,
      width: 400,
      height: 400
    },
    documentSize: {
      width: 1200,
      height: 1697
    },
    cropArea: {
      top: 5,
      left: 6,
      width: 700,
      height: 800
    },
    imageSrc: "/fallback.png",
    metadata: {
      source: "defaults"
    }
  });
});

test("normalizeTemplate preserves provided documentSize", () => {
  const documentSize = {
    width: 1200,
    height: 900
  };

  const template = normalizeTemplate({
    crosswordId: "TT-2026-0002",
    rows: 1,
    cols: 1,
    cellTypes: ["write"],
    documentSize,
    gridArea: {},
    imageSrc: ""
  });

  expect(template.documentSize).toEqual(documentSize);
});

test("legacy Template without documentSize receives default documentSize", () => {
  const template = normalizeTemplate({
    crosswordId: "TT-2026-0002",
    rows: 1,
    cols: 1,
    cellTypes: ["write"],
    gridArea: {},
    imageSrc: ""
  });

  expect(template.documentSize).toEqual(defaultDocumentSize);
});

test("missing cropArea defaults to full documentSize", () => {
  const template = createTemplate({
    crosswordId: "TT-2026-0001",
    rows: 1,
    cols: 1,
    cellTypes: ["write"],
    documentSize: {
      width: 1200,
      height: 1697
    },
    gridArea: {},
    imageSrc: ""
  });

  expect(template.cropArea).toEqual({
    top: 0,
    left: 0,
    width: 1200,
    height: 1697
  });
});

test("normalizeTemplate preserves provided cropArea", () => {
  const cropArea = {
    top: 12,
    left: 34,
    width: 900,
    height: 1000
  };

  const template = normalizeTemplate({
    crosswordId: "TT-2026-0002",
    rows: 1,
    cols: 1,
    cellTypes: ["write"],
    gridArea: {},
    cropArea,
    imageSrc: ""
  });

  expect(template.cropArea).toEqual(cropArea);
});

test("legacy Template without cropArea receives full-canvas default", () => {
  const template = normalizeTemplate({
    crosswordId: "TT-2026-0002",
    rows: 1,
    cols: 1,
    cellTypes: ["write"],
    gridArea: {},
    imageSrc: ""
  });

  expect(template.cropArea).toEqual(defaultCropArea);
});

test("runtime and editor session fields are not included in template output", () => {
  const template = createTemplate({
    crosswordId: "TT-2026-0001",
    rows: 1,
    cols: 1,
    cellTypes: ["write"],
    gridArea: {},
    imageSrc: "",
    answers: {
      0: "A"
    },
    activeCell: 0,
    direction: "across",
    inputRefs: [],
    activeTool: "write",
    pendingRows: 25,
    pendingCols: 25,
    dragState: {
      isDragging: true
    },
    resizeState: {
      isResizing: true
    }
  });

  for (const field of sessionFields) {
    expect(template).not.toHaveProperty(field);
  }
});
