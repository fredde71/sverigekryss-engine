import { createGridFormatGeometryCatalog } from "./GridFormatGeometryCatalog";
import { selectGridFormatGeometry } from "./GridFormatGeometrySelection";

test("selects the uniquely closest compatible format from indexed anchors", () => {
  const input = createSelectionInput();
  const result = selectGridFormatGeometry(input);

  expect(result.status).toBe("selected");
  expect(result.selectedFormatId).toBe("nonuniform-2x2");
  expect(result.competingFormatIds).toEqual(["nonuniform-2x2"]);
  expect(result.normalizedAnchorEvidence.axes).toBeUndefined();
  expect(result.normalizedAnchorEvidence.horizontal.anchors.map(anchor => (
    anchor.normalizedPosition
  ))).toEqual([0, 0.4, 1]);
  expect(result.evaluations.map(evaluation => evaluation.formatId)).toEqual([
    "uniform-2x2",
    "nonuniform-2x2"
  ]);
  expect(result.evaluations[1].maximumAbsoluteNormalizedResidual).toBe(0);
  expect(result.decisionPolicy.exactTiesRemainAmbiguous).toBe(true);
});

test("preserves exact ties as ambiguous without catalog-order selection", () => {
  const input = createSelectionInput();
  input.catalog = createCatalog([
    createFormat("same-a", 0.4, 0.6),
    createFormat("same-b", 0.4, 0.6)
  ]);

  const result = selectGridFormatGeometry(input);

  expect(result.status).toBe("ambiguous");
  expect(result.selectedFormat).toBeNull();
  expect(result.competingFormatIds).toEqual(["same-a", "same-b"]);
  expect(result.reasons).toEqual(["grid-format-geometry-evidence-ambiguous"]);
});

test("reports unavailable when outer or interior indexed evidence is missing", () => {
  const input = createSelectionInput();
  input.acceptedIndexedAnchors.vertical = [
    { latticeIndex: 0, observedPosition: 20 },
    { latticeIndex: 2, observedPosition: 220 }
  ];

  const result = selectGridFormatGeometry(input);

  expect(result.status).toBe("unavailable");
  expect(result.selectedFormat).toBeNull();
  expect(result.evaluations).toEqual([]);
  expect(result.reasons).toEqual(["vertical-anchor-evidence-unavailable"]);
});

test("reports unavailable when no catalog geometry has compatible dimensions", () => {
  const input = createSelectionInput();
  input.gridDimensions = { rows: 3, cols: 2 };
  input.acceptedIndexedAnchors.horizontal = [
    { latticeIndex: 0, observedPosition: 10 },
    { latticeIndex: 1, observedPosition: 40 },
    { latticeIndex: 3, observedPosition: 110 }
  ];

  const result = selectGridFormatGeometry(input);

  expect(result.status).toBe("unavailable");
  expect(result.reasons).toEqual([
    "compatible-grid-format-geometry-unavailable"
  ]);
});

test("selection is deterministic, immutable and does not mutate inputs", () => {
  const input = createSelectionInput();
  const snapshot = JSON.parse(JSON.stringify(input));

  const first = selectGridFormatGeometry(input);
  const second = selectGridFormatGeometry(input);

  expect(first).toEqual(second);
  expect(input).toEqual(snapshot);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.evaluations[0].axes.horizontal.observations)).toBe(true);
  expect(Object.isFrozen(first.selectedFormat)).toBe(true);
});

test("rejects unordered, duplicate and out-of-range anchor indexes", () => {
  const input = createSelectionInput();
  input.acceptedIndexedAnchors.horizontal = [
    { latticeIndex: 0, observedPosition: 10 },
    { latticeIndex: 2, observedPosition: 110 },
    { latticeIndex: 1, observedPosition: 60 }
  ];

  expect(() => selectGridFormatGeometry(input)).toThrow("indexes must increase");
});

test.each([
  [
    "260720",
    [[0, 1.5], [7, 399], [8, 456], [15, 852], [16, 909], [17, 965], [18, 1022], [23, 1305], [24, 1361], [25, 1419.5]],
    [[0, 85.5], [10, 652], [11, 709], [13, 822], [15, 935], [16, 992], [17, 1048], [18, 1105], [19, 1161], [20, 1218], [22, 1331], [24, 1444], [25, 1502]]
  ],
  [
    "260727",
    [[0, 1.5], [7, 399], [8, 456], [15, 852], [16, 909], [17, 965], [25, 1419.5]],
    [[0, 85.5], [11, 709], [13, 822], [15, 935], [16, 992], [17, 1048], [24, 1444], [25, 1502]]
  ],
  [
    "260803",
    [[0, 1.5], [7, 399], [8, 456], [11, 626], [15, 852], [16, 909], [17, 965], [25, 1419.5]],
    [[0, 85.5], [11, 709], [13, 822], [15, 935], [16, 992], [17, 1048], [18, 1105], [19, 1161], [24, 1444], [25, 1502]]
  ]
])("selects the promoted format for Lab reconstruction anchors from %s", (
  _issue,
  horizontal,
  vertical
) => {
  const result = selectGridFormatGeometry({
    gridDimensions: { rows: 25, cols: 25 },
    acceptedIndexedAnchors: {
      horizontal: horizontal.map(([latticeIndex, observedPosition]) => ({
        latticeIndex,
        observedPosition
      })),
      vertical: vertical.map(([latticeIndex, observedPosition]) => ({
        latticeIndex,
        observedPosition
      }))
    }
  });

  expect(result.status).toBe("selected");
  expect(result.selectedFormatId).toBe("grid-format-25x25-v1");
});

function createSelectionInput() {
  return {
    gridDimensions: { rows: 2, cols: 2 },
    acceptedIndexedAnchors: {
      horizontal: [
        { latticeIndex: 0, observedPosition: 10 },
        { latticeIndex: 1, observedPosition: 50 },
        { latticeIndex: 2, observedPosition: 110 }
      ],
      vertical: [
        { latticeIndex: 0, observedPosition: 20 },
        { latticeIndex: 1, observedPosition: 140 },
        { latticeIndex: 2, observedPosition: 220 }
      ]
    },
    catalog: createCatalog([
      createFormat("uniform-2x2", 0.5, 0.5),
      createFormat("nonuniform-2x2", 0.4, 0.6)
    ])
  };
}

function createCatalog(formats) {
  return createGridFormatGeometryCatalog({
    id: "test-grid-format-catalog",
    formats
  });
}

function createFormat(id, horizontalMiddle, verticalMiddle) {
  return {
    id,
    gridDimensions: { rows: 2, cols: 2 },
    axes: {
      horizontal: {
        normalizedLinePositions: [0, horizontalMiddle, 1]
      },
      vertical: {
        normalizedLinePositions: [0, verticalMiddle, 1]
      }
    },
    provenance: { source: "test-catalog" }
  };
}
