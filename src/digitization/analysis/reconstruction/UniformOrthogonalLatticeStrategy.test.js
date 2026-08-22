import fs from "fs";
import {
  UniformOrthogonalLatticeStrategy,
  reconstructUniformOrthogonalLattice
} from "./UniformOrthogonalLatticeStrategy";

test("reconstructs a complete observed grid", () => {
  const result = reconstructUniformOrthogonalLattice(createInput({
    horizontalPositions: [0, 10, 20],
    verticalPositions: [5, 15, 25],
    bounds: { top: 0, left: 5, width: 20, height: 20 },
    intervals: { minimum: 2, maximum: 2 }
  }));

  expect(result.status).toBe("available");
  expect(result.gridHypotheses).toHaveLength(1);
  expect(result.gridHypotheses[0]).toMatchObject({
    rows: 2,
    cols: 2,
    bounds: { top: 0, left: 5, width: 20, height: 20 }
  });
  expect(result.axes.horizontal.hypotheses[0].lines.every(line => (
    line.evidence.status === "observed-aligned"
  ))).toBe(true);
  expect(result.axes.vertical.hypotheses[0].candidateAssignments).toEqual([
    { candidateIndex: 0, lineIndex: 0, observedPosition: 5, linePosition: 5, delta: 0 },
    { candidateIndex: 1, lineIndex: 1, observedPosition: 15, linePosition: 15, delta: 0 },
    { candidateIndex: 2, lineIndex: 2, observedPosition: 25, linePosition: 25, delta: 0 }
  ]);
});

test("reconstructs sparse candidates whose gaps span multiple intervals", () => {
  const result = reconstructUniformOrthogonalLattice(createInput({
    horizontalPositions: [0, 20, 40],
    verticalPositions: [0, 20, 40],
    bounds: { top: 0, left: 0, width: 40, height: 40 },
    intervals: { minimum: 4, maximum: 4 },
    parameterOverrides: {
      maximumSkippedIntervalsBetweenCandidates: 1,
      maximumConsecutiveInferredLines: 1,
      maximumInferredLineFraction: 0.5
    }
  }));

  expect(result.status).toBe("available");
  expect(result.axes.horizontal.hypotheses[0].lines.map(line => ({
    position: line.position,
    status: line.evidence.status
  }))).toEqual([
    { position: 0, status: "observed-aligned" },
    { position: 10, status: "inferred" },
    { position: 20, status: "observed-aligned" },
    { position: 30, status: "inferred" },
    { position: 40, status: "observed-aligned" }
  ]);
  expect(result.axes.horizontal.hypotheses[0].candidateAssignments.map(
    assignment => assignment.lineIndex
  )).toEqual([0, 2, 4]);
});

test("uses independent bounds when the first and last candidates are missing", () => {
  const result = reconstructUniformOrthogonalLattice(createInput({
    horizontalPositions: [10, 20],
    verticalPositions: [15, 25],
    bounds: { top: 0, left: 5, width: 30, height: 30 },
    intervals: { minimum: 3, maximum: 3 },
    parameterOverrides: {
      maximumConsecutiveInferredLines: 1,
      maximumInferredLineFraction: 0.5
    }
  }));

  expect(result.status).toBe("available");
  expect(result.axes.horizontal.hypotheses[0].lines.map(line => line.position))
    .toEqual([0, 10, 20, 30]);
  expect(result.axes.horizontal.hypotheses[0].lines.map(line => line.evidence.status))
    .toEqual(["inferred", "observed-aligned", "observed-aligned", "inferred"]);
  expect(result.axes.vertical.hypotheses[0].lines.map(line => line.position))
    .toEqual([5, 15, 25, 35]);
});

test("supports non-25x25 grids and different axis spacing", () => {
  const input = createInput({
    horizontalPositions: [2, 12, 22, 32],
    verticalPositions: [5, 12, 19, 26, 33],
    bounds: { top: 2, left: 5, width: 28, height: 30 },
    intervals: { minimum: 3, maximum: 4 }
  });
  input.parameters.positionQuantum = 1;
  const result = reconstructUniformOrthogonalLattice(input);

  expect(result.status).toBe("available");
  expect(result.gridHypotheses[0]).toMatchObject({ rows: 3, cols: 4 });
  expect(result.axes.horizontal.hypotheses[0].spacing).toBe(10);
  expect(result.axes.vertical.hypotheses[0].spacing).toBe(7);
});

test("preserves half-pixel positions and exact signed residuals", () => {
  const result = reconstructUniformOrthogonalLattice(createInput({
    horizontalPositions: [0.5, 10.5, 20],
    verticalPositions: [5.5, 15, 25.5],
    bounds: { top: 0.5, left: 5.5, width: 20, height: 20 },
    intervals: { minimum: 2, maximum: 2 },
    parameterOverrides: { candidateAlignmentTolerancePx: 0.5 }
  }));

  expect(result.status).toBe("available");
  expect(result.axes.horizontal.hypotheses[0].lines.map(line => line.position))
    .toEqual([0.5, 10.5, 20.5]);
  expect(result.axes.horizontal.hypotheses[0].candidateAssignments.map(
    assignment => assignment.delta
  )).toEqual([0, 0, -0.5]);
  expect(result.axes.vertical.hypotheses[0].candidateAssignments.map(
    assignment => assignment.delta
  )).toEqual([0, -0.5, 0]);
});

test("returns partial when exactly one axis can be reconstructed", () => {
  const result = reconstructUniformOrthogonalLattice(createInput({
    horizontalPositions: [0, 10, 20],
    verticalPositions: [0],
    bounds: { top: 0, left: 0, width: 20, height: 20 },
    intervals: { minimum: 2, maximum: 2 }
  }));

  expect(result).toMatchObject({
    status: "partial",
    axes: {
      horizontal: { status: "available" },
      vertical: { status: "unavailable", hypotheses: [] }
    },
    gridHypotheses: [],
    reasons: [{ code: "insufficient-observed-candidates", axis: "vertical" }]
  });
});

test("keeps bounds-only evidence unavailable", () => {
  const result = reconstructUniformOrthogonalLattice(createInput({
    horizontalPositions: [],
    verticalPositions: [],
    bounds: { top: 0, left: 0, width: 100, height: 100 },
    intervals: { minimum: 1, maximum: 10 }
  }));

  expect(result.status).toBe("unavailable");
  expect(result.axes.horizontal.hypotheses).toEqual([]);
  expect(result.axes.vertical.hypotheses).toEqual([]);
  expect(result.reasons.map(reason => reason.code)).toEqual([
    "insufficient-observed-candidates",
    "insufficient-observed-candidates"
  ]);
});

test("reports contradictory candidate evidence as unavailable", () => {
  const result = reconstructUniformOrthogonalLattice(createInput({
    horizontalPositions: [0, 13, 20],
    verticalPositions: [0, 10, 20],
    bounds: { top: 0, left: 0, width: 20, height: 20 },
    intervals: { minimum: 2, maximum: 2 },
    parameterOverrides: { candidateAlignmentTolerancePx: 1 }
  }));

  expect(result.status).toBe("partial");
  expect(result.axes.horizontal).toEqual({
    status: "unavailable",
    hypotheses: []
  });
  expect(result.reasons).toEqual([{
    code: "no-compatible-lattice",
    axis: "horizontal",
    observedCandidateCount: 3
  }]);
});

test("preserves every valid spacing and count variant in canonical order", () => {
  const result = reconstructUniformOrthogonalLattice(createInput({
    horizontalPositions: [0, 20],
    verticalPositions: [0, 20],
    bounds: { top: 0, left: 0, width: 20, height: 20 },
    intervals: { minimum: 1, maximum: 4 },
    parameterOverrides: {
      maximumSkippedIntervalsBetweenCandidates: 3,
      maximumConsecutiveInferredLines: 3,
      maximumInferredLineFraction: 0.6,
      maximumHypothesisCount: 20
    }
  }));

  expect(result.status).toBe("ambiguous");
  expect(result.axes.horizontal.hypotheses.map(hypothesis => ({
    intervalCount: hypothesis.intervalCount,
    spacing: hypothesis.spacing
  }))).toEqual([
    { intervalCount: 1, spacing: 20 },
    { intervalCount: 2, spacing: 10 },
    { intervalCount: 4, spacing: 5 }
  ]);
  expect(result.gridHypotheses).toHaveLength(9);
  expect(result).not.toHaveProperty("selectedHypothesis");
});

test("enforces consecutive and total inferred-line limits", () => {
  const input = createInput({
    horizontalPositions: [0, 40],
    verticalPositions: [0, 10, 20, 30, 40],
    bounds: { top: 0, left: 0, width: 40, height: 40 },
    intervals: { minimum: 4, maximum: 4 },
    parameterOverrides: {
      maximumSkippedIntervalsBetweenCandidates: 3,
      maximumConsecutiveInferredLines: 2,
      maximumInferredLineFraction: 1
    }
  });
  const consecutiveResult = reconstructUniformOrthogonalLattice(input);

  expect(consecutiveResult.status).toBe("partial");
  expect(consecutiveResult.axes.horizontal.status).toBe("unavailable");

  input.parameters.maximumConsecutiveInferredLines = 3;
  input.parameters.maximumInferredLineFraction = 0.5;
  const fractionResult = reconstructUniformOrthogonalLattice(input);

  expect(fractionResult.status).toBe("partial");
  expect(fractionResult.axes.horizontal.status).toBe("unavailable");
});

test("reports hypothesis-limit overflow without returning a truncated subset", () => {
  const result = reconstructUniformOrthogonalLattice(createInput({
    horizontalPositions: [0, 20],
    verticalPositions: [0, 10, 20],
    bounds: { top: 0, left: 0, width: 20, height: 20 },
    intervals: { minimum: 1, maximum: 4 },
    parameterOverrides: {
      maximumSkippedIntervalsBetweenCandidates: 3,
      maximumConsecutiveInferredLines: 3,
      maximumInferredLineFraction: 0.6,
      maximumHypothesisCount: 2
    }
  }));

  expect(result.status).toBe("partial");
  expect(result.axes.horizontal).toEqual({
    status: "unavailable",
    hypotheses: []
  });
  expect(result.reasons).toEqual([{
    code: "axis-hypothesis-limit-exceeded",
    axis: "horizontal",
    compatibleHypothesisCount: 3,
    maximumHypothesisCount: 2
  }]);
});

test("does not truncate a grid Cartesian product that exceeds the limit", () => {
  const result = reconstructUniformOrthogonalLattice(createInput({
    horizontalPositions: [0, 20],
    verticalPositions: [0, 20],
    bounds: { top: 0, left: 0, width: 20, height: 20 },
    intervals: { minimum: 1, maximum: 2 },
    parameterOverrides: {
      maximumSkippedIntervalsBetweenCandidates: 1,
      maximumConsecutiveInferredLines: 1,
      maximumInferredLineFraction: 0.34,
      maximumHypothesisCount: 2
    }
  }));

  expect(result.status).toBe("ambiguous");
  expect(result.axes.horizontal.hypotheses).toHaveLength(2);
  expect(result.axes.vertical.hypotheses).toHaveLength(2);
  expect(result.gridHypotheses).toEqual([]);
  expect(result.reasons).toEqual([{
    code: "grid-hypothesis-limit-exceeded",
    compatibleHypothesisCount: 4,
    maximumHypothesisCount: 2
  }]);
});

test("preserves raw candidate source order while using deterministic assignments", () => {
  const input = createInput({
    horizontalPositions: [20, 0, 10],
    verticalPositions: [20, 0, 10],
    bounds: { top: 0, left: 0, width: 20, height: 20 },
    intervals: { minimum: 2, maximum: 2 }
  });
  const result = reconstructUniformOrthogonalLattice(input);

  expect(result.observations.rawCandidates.horizontal.map(candidate => candidate.position))
    .toEqual([20, 0, 10]);
  expect(result.axes.horizontal.hypotheses[0].candidateAssignments.map(
    assignment => [assignment.candidateIndex, assignment.lineIndex]
  )).toEqual([[0, 2], [1, 0], [2, 1]]);
});

test("accepts frozen inputs, does not mutate them, and returns immutable output", () => {
  const input = deepFreeze(createInput({
    horizontalPositions: [0, 10, 20],
    verticalPositions: [0, 10, 20],
    bounds: { top: 0, left: 0, width: 20, height: 20 },
    intervals: { minimum: 2, maximum: 2 }
  }));
  const before = JSON.stringify(input);
  const result = reconstructUniformOrthogonalLattice(input);

  expect(JSON.stringify(input)).toBe(before);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.axes.horizontal.hypotheses[0].lines)).toBe(true);
});

test("is deterministic across repeated execution", () => {
  const input = createInput({
    horizontalPositions: [0, 20],
    verticalPositions: [0, 20],
    bounds: { top: 0, left: 0, width: 20, height: 20 },
    intervals: { minimum: 1, maximum: 4 },
    parameterOverrides: {
      maximumSkippedIntervalsBetweenCandidates: 3,
      maximumConsecutiveInferredLines: 3,
      maximumInferredLineFraction: 0.6,
      maximumHypothesisCount: 20
    }
  });

  expect(JSON.stringify(reconstructUniformOrthogonalLattice(input)))
    .toBe(JSON.stringify(reconstructUniformOrthogonalLattice(input)));
});

test("validates strategy id through the explicit parameters contract", () => {
  const input = createInput();
  input.parameters.strategyId = "another-strategy";

  expect(() => reconstructUniformOrthogonalLattice(input))
    .toThrow("parameters.strategyId must equal uniform-orthogonal-lattice");
});

test("exposes a stable strategy object", () => {
  expect(UniformOrthogonalLatticeStrategy).toEqual({
    id: "uniform-orthogonal-lattice",
    reconstruct: reconstructUniformOrthogonalLattice
  });
  expect(Object.isFrozen(UniformOrthogonalLatticeStrategy)).toBe(true);
});

test("contains no evaluation fields or ground-truth/runtime dependencies", () => {
  const result = reconstructUniformOrthogonalLattice(createInput());
  const normalizedKeys = collectKeys(result).map(normalizeKey);

  expect(normalizedKeys).not.toEqual(expect.arrayContaining([
    "score",
    "confidence",
    "rank",
    "ranking",
    "recommendation",
    "selection",
    "selectedhypothesis",
    "preferredhypothesis"
  ]));

  const source = fs.readFileSync(
    require.resolve("./UniformOrthogonalLatticeStrategy"),
    "utf8"
  );
  expect(source).not.toMatch(/groundTruth|grid-ground-truth/i);
  expect(source).not.toMatch(/BinaryImage|findLineCandidates|GridAnalysis/);
});

function createInput({
  horizontalPositions = [0, 10, 20],
  verticalPositions = [0, 10, 20],
  bounds = { top: 0, left: 0, width: 20, height: 20 },
  intervals = { minimum: 2, maximum: 2 },
  parameterOverrides = {}
} = {}) {
  return {
    candidateEvidence: {
      analysisRegionId: "synthetic-region",
      acceptancePolicy: {
        source: "synthetic-candidate-evidence",
        parameters: { fixture: true }
      },
      horizontal: horizontalPositions.map((position, index) => (
        createCandidate("horizontal", position, index)
      )),
      vertical: verticalPositions.map((position, index) => (
        createCandidate("vertical", position, index)
      ))
    },
    observedBounds: {
      status: "available",
      coordinateSpace: "analysis-region-local",
      semantics: "outer-line-center-envelope",
      value: bounds,
      components: {
        top: { status: "observed", provenance: "synthetic-bounds" },
        left: { status: "observed", provenance: "synthetic-bounds" },
        width: { status: "observed", provenance: "synthetic-bounds" },
        height: { status: "observed", provenance: "synthetic-bounds" }
      }
    },
    spacingEvidence: {
      horizontal: [{ type: "synthetic-spacing", values: [10] }],
      vertical: [{ type: "synthetic-spacing", values: [10] }]
    },
    coordinateSystem: {
      space: "analysis-region-local",
      origin: "top-left",
      xDirection: "right",
      yDirection: "down",
      linePosition: "visual-line-center",
      localToBinaryImage: {
        offsetX: 100,
        offsetY: 200,
        scaleX: 1,
        scaleY: 1
      }
    },
    parameters: {
      strategyId: "uniform-orthogonal-lattice",
      minimumObservedCandidatesPerAxis: 2,
      permittedIntervalCount: intervals,
      permittedCellSpacing: { minimum: 1, maximum: 100 },
      maximumSkippedIntervalsBetweenCandidates: 10,
      maximumConsecutiveInferredLines: 10,
      maximumInferredLineFraction: 0.9,
      candidateAlignmentTolerancePx: 0,
      boundsAlignmentTolerancePx: 0,
      positionQuantum: 0.5,
      maximumHypothesisCount: 100,
      ...parameterOverrides
    }
  };
}

function createCandidate(axis, position, sourceIndex) {
  return {
    axis,
    position,
    start: position - 0.5,
    end: position + 0.5,
    thickness: 1,
    strength: 100,
    sourceIndex
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function collectKeys(value) {
  if (Array.isArray(value)) {
    return value.flatMap(collectKeys);
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, nested]) => [
    key,
    ...collectKeys(nested)
  ]);
}

function normalizeKey(key) {
  return key.replace(/[-_]/g, "").toLowerCase();
}
