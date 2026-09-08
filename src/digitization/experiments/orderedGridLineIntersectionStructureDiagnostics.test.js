import {
  createOrderedGridLineIntersectionStructureDiagnostics,
  createOrderedGridLineIntersectionStructureExperiment
} from "./orderedGridLineIntersectionStructureDiagnostics";
import {
  createGridLineObservations
} from "../analysis/GridLineObservation";
import {
  createGridLineIntersectionObservations
} from "../analysis/GridLineIntersectionObservation";

test("preserves ordered crossings and repeated exact gap observations", () => {
  const input = createEvidence();
  const result = createOrderedGridLineIntersectionStructureDiagnostics({
    ...input,
    readEnvironment: () => "test"
  });
  const complete = result.axes.horizontal.observations[0];
  const interrupted = result.axes.horizontal.observations[1];

  expect(result).toMatchObject({
    type: "ordered-grid-line-intersection-structure-diagnostics",
    version: 1,
    status: "available",
    representation: "factored-ordered-perpendicular-observation-sequences"
  });
  expect(result.axes.horizontal.perpendicularObservations.map(value => ({
    order: value.order,
    position: value.position
  }))).toEqual([
    { order: 0, position: 1 },
    { order: 1, position: 3 },
    { order: 2, position: 5 }
  ]);
  expect(complete.orderedCrossings.map(value => ({
    order: value.order,
    position: value.positionAlongLine,
    present: value.strokeEvidencePresent
  }))).toEqual([
    { order: 0, position: 1, present: true },
    { order: 1, position: 3, present: true },
    { order: 2, position: 5, present: true }
  ]);
  expect(complete.structureMeasurements.allPerpendicularObservations)
    .toMatchObject({
      presentPositions: [1, 3, 5],
      missingPositions: [],
      repeatedExactGapCount: 2,
      longestEqualGapRun: {
        gap: 2,
        startIndex: 0,
        endIndex: 1,
        length: 2
      },
      spacingStatistics: {
        count: 2,
        minimum: 2,
        maximum: 2,
        mean: 2,
        median: 2
      }
    });
  expect(interrupted.structureMeasurements.allPerpendicularObservations)
    .toMatchObject({
      presentPositions: [1, 5],
      missingPositions: [3],
      repeatedExactGapCount: 0,
      longestEqualGapRun: { gap: 4, length: 1 }
    });
});

test("preserves deterministic order and immutable inputs", () => {
  const input = createEvidence();
  const beforeLines = JSON.stringify(input.lineObservations);
  const beforeIntersections = JSON.stringify(input.intersectionObservations);

  const first = createOrderedGridLineIntersectionStructureDiagnostics({
    ...input,
    readEnvironment: () => "development"
  });
  const second = createOrderedGridLineIntersectionStructureDiagnostics({
    ...input,
    readEnvironment: () => "development"
  });

  expect(second).toEqual(first);
  expect(JSON.stringify(input.lineObservations)).toBe(beforeLines);
  expect(JSON.stringify(input.intersectionObservations))
    .toBe(beforeIntersections);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.axes.horizontal.observations)).toBe(true);
  expect(Object.isFrozen(
    first.axes.horizontal.observations[0].orderedCrossings
  )).toBe(true);
  expect(JSON.stringify(first)).not.toMatch(
    /"(score|confidence|classification|admissionDecision|recommendation|selection)"\s*:/
  );
});

test("keeps unavailable intersection evidence explicit", () => {
  const input = createEvidence({ includeBinaryImage: false });
  const result = createOrderedGridLineIntersectionStructureDiagnostics({
    ...input,
    readEnvironment: () => "test"
  });
  const sequence = result.axes.horizontal.observations[0];

  expect(result.status).toBe("unavailable");
  expect(sequence.orderedCrossings.every(
    value => value.status === "unavailable"
      && value.strokeEvidencePresent === null
  )).toBe(true);
  expect(sequence.structureMeasurements.allPerpendicularObservations)
    .toMatchObject({
      presentCount: 0,
      missingCount: 0,
      unavailableCount: 3,
      presentRatio: null
    });
});

test("experiment wrapper is development-only and derives source artifacts", () => {
  const binaryImage = createBinaryImage();
  const result = createOrderedGridLineIntersectionStructureExperiment({
    binaryImage,
    readEnvironment: () => "test"
  });

  expect(result.sourceArtifacts).toMatchObject({
    lineObservations: { type: "grid-line-observation-set" },
    intersectionObservations: {
      type: "grid-line-intersection-observation-set",
      pairCount: expect.any(Number)
    }
  });
  expect(() => createOrderedGridLineIntersectionStructureExperiment({
    binaryImage,
    readEnvironment: () => "production"
  })).toThrow(
    "Ordered grid-line intersection diagnostics are available only in development or test"
  );
});

function createEvidence({ includeBinaryImage = true } = {}) {
  const binaryImage = createBinaryImage();
  const lineObservations = createGridLineObservations({
    projections: {
      horizontal: [0, 3, 0, 0, 0, 2, 0],
      vertical: [0, 2, 0, 1, 0, 2, 0]
    },
    binaryImage,
    analysisRegion: {
      id: "test-region",
      regionType: "observed-analysis-region",
      bounds: { top: 0, left: 0, width: 7, height: 7 },
      coordinateRelationship: {
        type: "identity",
        localToBinaryImage: {
          offsetX: 0,
          offsetY: 0,
          scaleX: 1,
          scaleY: 1
        }
      }
    }
  });
  const intersectionObservations =
    createGridLineIntersectionObservations({
      lineObservations,
      binaryImage: includeBinaryImage ? binaryImage : null,
      neighborhoodRadius: 0
    });
  return { lineObservations, intersectionObservations };
}

function createBinaryImage() {
  const width = 7;
  const height = 7;
  const data = new Uint8Array(width * height);
  [[1, 1], [3, 1], [5, 1], [1, 5], [5, 5]].forEach(([x, y]) => {
    data[(y * width) + x] = 1;
  });
  return { width, height, data };
}
