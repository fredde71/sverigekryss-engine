import {
  createTemplate,
  normalizeTemplate
} from "./template/templateModel";

const requiredTemplateFields = [
  "crosswordId",
  "rows",
  "cols",
  "cellTypes",
  "gridArea",
  "imageSrc",
  "metadata"
];

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
    imageSrc: "/grid.png",
    metadata: {
      title: "Test puzzle"
    }
  });

  expect(Object.keys(template)).toEqual(requiredTemplateFields);
  expect(template).toMatchObject({
    crosswordId: "TT-2026-0001",
    rows: 2,
    cols: 3,
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
    imageSrc: "/fallback.png",
    metadata: {
      source: "defaults"
    }
  });

  expect(template).toEqual({
    crosswordId: "TT-2026-0002",
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
    imageSrc: "/fallback.png",
    metadata: {
      source: "defaults"
    }
  });
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
