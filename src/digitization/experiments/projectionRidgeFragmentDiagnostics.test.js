import {
  createProjectionRidgeFragmentDiagnostics
} from "./projectionRidgeFragmentDiagnostics";

test("preserves every axis position before local-maximum extraction", () => {
  const binaryImage = createBinaryImage();
  const result = createProjectionRidgeFragmentDiagnostics({
    binaryImage,
    readEnvironment: () => "test"
  });

  expect(result).toMatchObject({
    type: "projection-ridge-fragment-diagnostics",
    version: 1,
    status: "complete",
    coordinateSpace: "analysis-region-local",
    extractionBoundary: {
      occursBefore: "positive-local-maximum-plateau-extraction"
    }
  });
  expect(result.axes.horizontal.positions.map(value => value.position))
    .toEqual([0, 1, 2, 3, 4]);
  expect(result.axes.vertical.positions.map(value => value.position))
    .toEqual([0, 1, 2, 3, 4, 5, 6]);
  expect(result.diagnostics[0]).toMatchObject({
    localMaximumRequired: false,
    candidateCreated: false,
    admissionChanged: false,
    groundTruthAccessed: false
  });
});

test("preserves raw projections and ordered tangential fragments exactly", () => {
  const result = createProjectionRidgeFragmentDiagnostics({
    binaryImage: createBinaryImage(),
    readEnvironment: () => "development"
  });
  const interrupted = result.axes.horizontal.positions[2];

  expect(interrupted).toMatchObject({
    rawProjectionValue: 4,
    orderedTangentialStrokeSegments: [
      { start: 0, end: 1, length: 2 },
      { start: 4, end: 5, length: 2 }
    ],
    fragmentDistribution: {
      segmentCount: 2,
      totalStrokeLength: 4,
      longestSegmentLength: 2,
      firstStrokePosition: 0,
      lastStrokePosition: 5,
      occupiedSpanLength: 6,
      leadingBlankLength: 0,
      trailingBlankLength: 1,
      interSegmentGaps: [{ start: 2, end: 3, length: 2 }]
    }
  });
});

test("records factual fragment persistence across adjacent axis positions", () => {
  const result = createProjectionRidgeFragmentDiagnostics({
    binaryImage: createBinaryImage(),
    readEnvironment: () => "test"
  });
  const position = result.axes.horizontal.positions[2];

  expect(position.adjacentPersistence.previous).toMatchObject({
    status: "available",
    adjacentOffset: -1,
    currentSegmentCount: 2,
    adjacentSegmentCount: 3,
    overlappingCurrentSegmentCount: 2,
    overlappingAdjacentSegmentCount: 2,
    overlapSpanLength: 3,
    currentStrokeLengthWithAdjacentSupport: 3,
    currentStrokeSupportRatio: 0.75
  });
  expect(position.adjacentPersistence.next).toMatchObject({
    status: "available",
    adjacentOffset: 1,
    overlapSpanLength: 0,
    currentStrokeSupportRatio: 0
  });
  expect(result.axes.horizontal.positions[0].adjacentPersistence.previous)
    .toMatchObject({
      status: "unavailable",
      reasons: ["adjacent-axis-position-outside-analysis-region"]
    });
});

test("is deterministic, immutable, and leaves input untouched", () => {
  const binaryImage = createBinaryImage();
  const before = Array.from(binaryImage.data);
  const input = Object.freeze({
    width: binaryImage.width,
    height: binaryImage.height,
    data: binaryImage.data
  });
  const first = createProjectionRidgeFragmentDiagnostics({
    binaryImage: input,
    readEnvironment: () => "test"
  });
  const second = createProjectionRidgeFragmentDiagnostics({
    binaryImage: input,
    readEnvironment: () => "test"
  });

  expect(second).toEqual(first);
  expect(Array.from(binaryImage.data)).toEqual(before);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.axes.horizontal.positions)).toBe(true);
  expect(Object.isFrozen(
    first.axes.horizontal.positions[2].orderedTangentialStrokeSegments
  )).toBe(true);
  expect(JSON.stringify(first)).not.toMatch(
    /"(score|confidence|admissionDecision|recommendation|selection)"\s*:/
  );
});

test("is development and test only", () => {
  expect(() => createProjectionRidgeFragmentDiagnostics({
    binaryImage: createBinaryImage(),
    readEnvironment: () => "production"
  })).toThrow(
    "Projection ridge fragment diagnostics are available only in development or test"
  );
});

function createBinaryImage() {
  const rows = [
    [0, 0, 0, 0, 0, 0, 0],
    [1, 1, 0, 1, 0, 1, 0],
    [1, 1, 0, 0, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 0, 0]
  ];
  return {
    width: rows[0].length,
    height: rows.length,
    data: new Uint8Array(rows.flat())
  };
}
