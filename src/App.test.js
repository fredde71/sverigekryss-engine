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
    cropArea: defaultCropArea,
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
