import {
  createImageAlignedGridLineGeometry
} from "./ImageAlignedGridLineGeometry";

test("preserves observed anchors and interpolates only bounded interior indices", () => {
  const input = createInput();
  const latticeBefore = JSON.stringify(input.gridLattice);
  const candidatesBefore = JSON.stringify(input.selectedAxisCandidates);

  const result = createImageAlignedGridLineGeometry(input);

  expect(result).toMatchObject({
    type: "image-aligned-grid-line-geometry",
    version: 1,
    id: "image-aligned-lattice-1",
    status: "available",
    gridDimensions: { rows: 4, cols: 3 }
  });
  expect(readPositions(result.axes.horizontal)).toEqual([
    10, 20.5, 31, 40.5, 50
  ]);
  expect(readStatuses(result.axes.horizontal)).toEqual([
    "observed", "interpolated", "observed", "interpolated", "observed"
  ]);
  expect(result.axes.horizontal).toMatchObject({
    observedCount: 3,
    interpolatedCount: 2,
    unavailableCount: 0
  });
  expect(result.axes.horizontal.observedAnchors.map(anchor => ({
    latticeIndex: anchor.latticeIndex,
    observedPosition: anchor.observedPosition
  }))).toEqual([
    { latticeIndex: 0, observedPosition: 10 },
    { latticeIndex: 2, observedPosition: 31 },
    { latticeIndex: 4, observedPosition: 50 }
  ]);
  expect(result.axes.horizontal.linePositions[1].interpolation).toEqual({
    startLatticeIndex: 0,
    startObservedPosition: 10,
    endLatticeIndex: 2,
    endObservedPosition: 31
  });
  expect(result.coordinateSystem).toEqual(input.coordinateSystem);
  expect(result.axes.horizontal.selectedAxisCandidateReference).toMatchObject({
    id: "horizontal-axis-candidate",
    intervalCount: 4
  });
  expect(JSON.stringify(input.gridLattice)).toBe(latticeBefore);
  expect(JSON.stringify(input.selectedAxisCandidates)).toBe(candidatesBefore);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.axes.horizontal.linePositions)).toBe(true);
});

test("leaves unsupported leading and trailing indices unavailable", () => {
  const input = createInput();
  input.selectedAxisCandidates.horizontal.assignments = [
    createAssignment(1, 20),
    createAssignment(3, 41)
  ];

  const result = createImageAlignedGridLineGeometry(input);

  expect(result.status).toBe("partial");
  expect(result.axes.horizontal.status).toBe("partial");
  expect(readPositions(result.axes.horizontal)).toEqual([
    null, 20, 30.5, 41, null
  ]);
  expect(readStatuses(result.axes.horizontal)).toEqual([
    "unavailable", "observed", "interpolated", "observed", "unavailable"
  ]);
  expect(result.axes.horizontal.reasons).toEqual([
    "leading-or-trailing-line-positions-unavailable"
  ]);
});

test("represents conflicting assignments explicitly as ambiguous", () => {
  const input = createInput();
  input.selectedAxisCandidates.horizontal.assignments = [
    createAssignment(0, 10),
    createAssignment(0, 10.5),
    createAssignment(4, 50)
  ];

  const result = createImageAlignedGridLineGeometry(input);

  expect(result.status).toBe("ambiguous");
  expect(result.axes.horizontal).toMatchObject({
    status: "ambiguous",
    reasons: ["conflicting-observed-anchor-assignments"]
  });
  expect(result.axes.horizontal.observedAnchors).toHaveLength(3);
});

test("is deterministic and leaves the mathematical GridLattice unchanged", () => {
  const input = deepFreeze(createInput());
  const before = JSON.stringify(input);

  const first = createImageAlignedGridLineGeometry(input);
  const second = createImageAlignedGridLineGeometry(input);

  expect(second).toEqual(first);
  expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  expect(JSON.stringify(input)).toBe(before);
  expect(input.gridLattice.axes.horizontal.positions).toEqual([
    10, 20, 30, 40, 50
  ]);
});

function createInput() {
  const coordinateSystem = {
    space: "analysis-region-local",
    unit: "pixel",
    origin: "top-left",
    xDirection: "right",
    yDirection: "down",
    linePosition: "visual-line-center",
    localToBinaryImage: {
      offsetX: 2,
      offsetY: 3,
      scaleX: 1,
      scaleY: 1
    },
    binaryImageToDocument: { scaleX: 0.5, scaleY: 0.5 }
  };
  return {
    gridLattice: {
      type: "grid-lattice",
      id: "lattice-1",
      status: "available",
      coordinateSystem,
      gridDimensions: { rows: 4, cols: 3 },
      axes: {
        horizontal: { positions: [10, 20, 30, 40, 50] },
        vertical: { positions: [5, 15, 25, 35] }
      }
    },
    selectedAxisCandidates: {
      horizontal: createAxisCandidate(
        "horizontal",
        4,
        [createAssignment(0, 10), createAssignment(2, 31), createAssignment(4, 50)]
      ),
      vertical: createAxisCandidate(
        "vertical",
        3,
        [createAssignment(0, 5), createAssignment(3, 35)]
      )
    },
    selectedCandidateReference: { candidateId: "candidate-1" },
    coordinateSystem,
    provenance: { source: "focused-test" }
  };
}

function createAxisCandidate(axis, intervalCount, assignments) {
  return {
    id: `${axis}-axis-candidate`,
    status: "available",
    axis,
    intervalCount,
    lineCount: intervalCount + 1,
    axisBoundsId: `${axis}-bounds`,
    assignments,
    evidenceReferences: [`anchors:${axis}`],
    provenance: {
      primitivePeriodCandidateId: `${axis}-period`,
      source: "focused-test"
    }
  };
}

function createAssignment(latticeIndex, observedPosition) {
  return {
    anchorOrder: latticeIndex,
    latticeIndex,
    observedPosition,
    modeledPosition: latticeIndex * 10 + 10,
    residual: observedPosition - (latticeIndex * 10 + 10),
    withinCandidateExtent: true
  };
}

function readPositions(axis) {
  return axis.linePositions.map(value => value.position);
}

function readStatuses(axis) {
  return axis.linePositions.map(value => value.status);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
