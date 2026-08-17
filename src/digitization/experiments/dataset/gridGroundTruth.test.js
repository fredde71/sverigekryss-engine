import {
  createGridGroundTruth,
  createGridGroundTruthExport,
  GRID_GROUND_TRUTH_COORDINATE_POLICY
} from "./gridGroundTruth";

test("creates deterministic immutable version 1 grid ground truth", () => {
  const input = {
    datasetId: "tt-validation",
    annotations: [
      createAnnotation({ itemId: "item-002", filename: "two.pdf" }),
      createAnnotation({ itemId: "item-001", filename: "one.pdf" })
    ]
  };
  const snapshot = JSON.stringify(input);
  const first = createGridGroundTruth(input);
  const second = createGridGroundTruth(input);

  expect(first).toEqual({
    type: "digitization-grid-ground-truth",
    version: 1,
    datasetId: "tt-validation",
    coordinatePolicy: GRID_GROUND_TRUTH_COORDINATE_POLICY,
    annotations: input.annotations
  });
  expect(second).toEqual(first);
  expect(first.annotations.map(annotation => annotation.itemId)).toEqual([
    "item-002",
    "item-001"
  ]);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.annotations)).toBe(true);
  expect(Object.isFrozen(first.annotations[0].gridBounds)).toBe(true);
  expect(JSON.stringify(input)).toBe(snapshot);
  expect(first.annotations[0]).not.toBe(input.annotations[0]);
});

test.each([
  [{ datasetId: "" }, "datasetId must be a non-empty string"],
  [{ datasetId: "dataset", annotations: [createAnnotation({ itemId: "" })] }, "itemId must be a non-empty string"],
  [{ datasetId: "dataset", annotations: [createAnnotation({ filename: " " })] }, "filename must be a non-empty string"]
])("rejects invalid identifiers and filenames", (overrides, message) => {
  expect(() => createGridGroundTruth(overrides)).toThrow(message);
});

test("rejects duplicate item IDs without reordering annotations", () => {
  expect(() => createGridGroundTruth({
    datasetId: "dataset",
    annotations: [
      createAnnotation({ itemId: "duplicate", filename: "one.pdf" }),
      createAnnotation({ itemId: "duplicate", filename: "two.pdf" })
    ]
  })).toThrow("Duplicate ground-truth itemId: duplicate");
});

test.each([
  [[10, 9, 20], "strictly increasing"],
  [[10, 10, 20], "strictly increasing"],
  [[10, Number.NaN, 20], "finite integer or half-pixel"],
  [[10, Number.POSITIVE_INFINITY, 20], "finite integer or half-pixel"],
  [[10, 10.25, 20], "finite integer or half-pixel"]
])("rejects invalid line positions %p", (positions, message) => {
  expect(() => createGridGroundTruth({
    datasetId: "dataset",
    annotations: [createAnnotation({ horizontalLinePositions: positions })]
  })).toThrow(message);
});

test("accepts integer and half-pixel coordinates", () => {
  const annotation = createAnnotation({
    horizontalLinePositions: [10.5, 20, 30.5],
    verticalLinePositions: [5, 15.5, 25],
    gridBounds: {
      top: 10.5,
      left: 5,
      width: 20,
      height: 20
    }
  });

  expect(createGridGroundTruth({
    datasetId: "dataset",
    annotations: [annotation]
  }).annotations[0]).toEqual(annotation);
});

test.each([
  [{ rows: 3 }, "rows must equal the number of line intervals"],
  [{ cols: 1 }, "cols must equal the number of line intervals"]
])("rejects row or column count mismatch", (overrides, message) => {
  expect(() => createGridGroundTruth({
    datasetId: "dataset",
    annotations: [createAnnotation(overrides)]
  })).toThrow(message);
});

test("rejects bounds that differ from the outer line-center envelope", () => {
  expect(() => createGridGroundTruth({
    datasetId: "dataset",
    annotations: [createAnnotation({
      gridBounds: { top: 11, left: 5, width: 20, height: 20 }
    })]
  })).toThrow("gridBounds must equal the outer line-center envelope");
});

test("rejects timestamps and unconfirmed annotation metadata", () => {
  expect(() => createGridGroundTruth({
    datasetId: "dataset",
    annotations: [createAnnotation({
      annotation: {
        status: "human-confirmed",
        createdAt: "2026-01-01"
      }
    })]
  })).toThrow("must not contain timestamps");

  expect(() => createGridGroundTruth({
    datasetId: "dataset",
    annotations: [createAnnotation({
      annotation: { status: "draft" }
    })]
  })).toThrow("annotation.status must be human-confirmed");
});

test("requires the explicit page 1 scale 2 rendered-image coordinate policy", () => {
  expect(() => createGridGroundTruth({
    datasetId: "dataset",
    coordinatePolicy: {
      ...GRID_GROUND_TRUTH_COORDINATE_POLICY,
      renderScale: 1
    },
    annotations: []
  })).toThrow("coordinatePolicy.renderScale must equal 2");
});

test("exports deterministic two-space JSON with exactly one trailing newline", () => {
  const groundTruth = createGridGroundTruth({
    datasetId: "TT Validation",
    annotations: [createAnnotation()]
  });
  const first = createGridGroundTruthExport(groundTruth);
  const second = createGridGroundTruthExport(groundTruth);

  expect(second).toEqual(first);
  expect(first).toEqual({
    fileName: "digitization-grid-ground-truth-tt-validation-v1.json",
    mimeType: "application/json",
    contents: `${JSON.stringify(groundTruth, null, 2)}\n`
  });
  expect(first.contents.endsWith("\n")).toBe(true);
  expect(first.contents.endsWith("\n\n")).toBe(false);
});

function createAnnotation(overrides = {}) {
  const horizontalLinePositions = overrides.horizontalLinePositions
    ?? [10, 20, 30];
  const verticalLinePositions = overrides.verticalLinePositions
    ?? [5, 15, 25];

  return {
    itemId: "item-001",
    filename: "one.pdf",
    document: { width: 100, height: 120 },
    gridBounds: {
      top: horizontalLinePositions[0],
      left: verticalLinePositions[0],
      width: verticalLinePositions[verticalLinePositions.length - 1]
        - verticalLinePositions[0],
      height: horizontalLinePositions[horizontalLinePositions.length - 1]
        - horizontalLinePositions[0]
    },
    horizontalLinePositions,
    verticalLinePositions,
    rows: horizontalLinePositions.length - 1,
    cols: verticalLinePositions.length - 1,
    annotation: {
      status: "human-confirmed",
      method: "visual-line-handles",
      interpolationUsedForDraft: true
    },
    ...overrides
  };
}
