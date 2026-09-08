import {
  createLatticeConditionedGridLineEvidenceDiagnostics
} from "./latticeConditionedGridLineEvidenceDiagnostics";
import {
  createProjectionRidgeFragmentDiagnostics
} from "./projectionRidgeFragmentDiagnostics";

test("queries every modeled lattice index and preserves strong anchors", () => {
  const result = createDiagnostics();

  expect(result).toMatchObject({
    type: "lattice-conditioned-grid-line-evidence-diagnostics",
    version: 1,
    status: "complete"
  });
  expect(result.axes.horizontal.latticeQueries.map(value => ({
    index: value.latticeIndex,
    position: value.modeledPosition,
    state: value.supportState
  }))).toEqual([
    { index: 0, position: 0, state: "strong-observed-anchor" },
    { index: 1, position: 2, state: "weak-supporting-image-evidence" },
    { index: 2, position: 4, state: "strong-observed-anchor" }
  ]);
});

test("classifies nonzero evidence as weak and zero evidence as absent", () => {
  const result = createDiagnostics();
  const vertical = result.axes.vertical.latticeQueries;

  expect(vertical.map(value => value.supportState)).toEqual([
    "strong-observed-anchor",
    "no-supporting-image-evidence",
    "strong-observed-anchor"
  ]);
  expect(vertical[1].sampledPositions.map(value => ({
    position: value.position,
    projection: value.rawProjectionValue
  }))).toEqual([
    { position: 2, projection: 0 },
    { position: 3, projection: 0 },
    { position: 4, projection: 0 }
  ]);
});

test("uses adjacent lattice midpoints as deterministic non-lattice controls", () => {
  const result = createDiagnostics();

  expect(result.axes.horizontal.nonLatticeQueries.map(value => ({
    between: value.betweenLatticeIndexes,
    position: value.modeledPosition,
    state: value.supportState
  }))).toEqual([
    { between: [0, 1], position: 1, state: "weak-supporting-image-evidence" },
    { between: [1, 2], position: 3, state: "weak-supporting-image-evidence" }
  ]);
  expect(result.axes.horizontal.inventory).toMatchObject({
    latticePositionCount: 3,
    strongObservedAnchorCount: 2,
    weakSupportingImageEvidenceCount: 1,
    nonLatticeControlCount: 2,
    nonLatticeWeakSupportCount: 2
  });
});

test("keeps unavailable or ambiguous reconstruction explicit", () => {
  const result = createLatticeConditionedGridLineEvidenceDiagnostics({
    reconstructionResult: {
      type: "grid-lattice-reconstruction-result",
      version: 1,
      status: "ambiguous",
      lattice: null
    },
    ridgeDiagnostics: createRidgeDiagnostics(),
    readEnvironment: () => "test"
  });

  expect(result).toMatchObject({
    status: "unavailable",
    reasons: ["available-grid-lattice-reconstruction-required"],
    axes: {
      horizontal: { status: "unavailable", latticeQueries: [] },
      vertical: { status: "unavailable", latticeQueries: [] }
    }
  });
});

test("is deterministic, immutable, and contains no admission decision", () => {
  const reconstructionResult = createReconstructionResult();
  const ridgeDiagnostics = createRidgeDiagnostics();
  const beforeReconstruction = JSON.stringify(reconstructionResult);
  const beforeRidge = JSON.stringify(ridgeDiagnostics);
  const first = createLatticeConditionedGridLineEvidenceDiagnostics({
    reconstructionResult,
    ridgeDiagnostics,
    readEnvironment: () => "test"
  });
  const second = createLatticeConditionedGridLineEvidenceDiagnostics({
    reconstructionResult,
    ridgeDiagnostics,
    readEnvironment: () => "test"
  });

  expect(second).toEqual(first);
  expect(JSON.stringify(reconstructionResult)).toBe(beforeReconstruction);
  expect(JSON.stringify(ridgeDiagnostics)).toBe(beforeRidge);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.axes.horizontal.latticeQueries)).toBe(true);
  expect(JSON.stringify(first)).not.toMatch(
    /"(score|confidence|admissionDecision|recommendation|selection)"\s*:/
  );
});

test("is development and test only", () => {
  expect(() => createLatticeConditionedGridLineEvidenceDiagnostics({
    reconstructionResult: createReconstructionResult(),
    ridgeDiagnostics: createRidgeDiagnostics(),
    readEnvironment: () => "production"
  })).toThrow(
    "Lattice-conditioned grid-line evidence diagnostics are available only in development or test"
  );
});

function createDiagnostics() {
  return createLatticeConditionedGridLineEvidenceDiagnostics({
    reconstructionResult: createReconstructionResult(),
    ridgeDiagnostics: createRidgeDiagnostics(),
    readEnvironment: () => "test"
  });
}

function createReconstructionResult() {
  return {
    type: "grid-lattice-reconstruction-result",
    version: 1,
    status: "available",
    lattice: {
      id: "lattice-001",
      status: "available",
      coordinateSystem: { space: "analysis-region-local" },
      axes: {
        horizontal: { positions: [0, 2, 4] },
        vertical: { positions: [1, 3, 5] }
      }
    },
    imageAlignedGridLineGeometry: {
      axes: {
        horizontal: {
          linePositions: [
            { latticeIndex: 0, status: "observed" },
            { latticeIndex: 1, status: "interpolated" },
            { latticeIndex: 2, status: "observed" }
          ]
        },
        vertical: {
          linePositions: [
            { latticeIndex: 0, status: "observed" },
            { latticeIndex: 1, status: "interpolated" },
            { latticeIndex: 2, status: "observed" }
          ]
        }
      }
    }
  };
}

function createRidgeDiagnostics() {
  return createProjectionRidgeFragmentDiagnostics({
    binaryImage: {
      width: 6,
      height: 5,
      data: new Uint8Array([
        1, 0, 0, 0, 0, 1,
        1, 0, 0, 0, 0, 1,
        1, 1, 0, 0, 0, 1,
        1, 0, 0, 0, 0, 1,
        1, 0, 0, 0, 0, 1
      ])
    },
    readEnvironment: () => "test"
  });
}
