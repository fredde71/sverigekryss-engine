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
    { intervalCount: 3, spacing: 20 / 3 },
    { intervalCount: 4, spacing: 5 }
  ]);
  expect(result.gridHypotheses).toHaveLength(16);
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
    compatibleHypothesisCount: 4,
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

test("adds rejection diagnostics without changing reconstruction behavior", () => {
  const result = reconstructUniformOrthogonalLattice(createInput({
    horizontalPositions: [0, 10, 20],
    verticalPositions: [0, 13, 20],
    bounds: { top: 0, left: 0, width: 20, height: 20 },
    intervals: { minimum: 2, maximum: 2 },
    parameterOverrides: { candidateAlignmentTolerancePx: 1 }
  }));

  expect(projectReconstructionBehavior(result)).toEqual({
    status: "partial",
    axisStatuses: {
      horizontal: "available",
      vertical: "unavailable"
    },
    axisHypotheses: {
      horizontal: [{
        id: "horizontal-uniform-intervals-2",
        intervalCount: 2,
        linePositions: [0, 10, 20],
        candidateLineIndexes: [0, 1, 2]
      }],
      vertical: []
    },
    gridHypotheses: [],
    reasons: [{
      code: "no-compatible-lattice",
      axis: "vertical",
      observedCandidateCount: 3
    }]
  });
});

test("records candidate gaps, interpretations, assignments and exact residuals", () => {
  const result = reconstructUniformOrthogonalLattice(createInput({
    horizontalPositions: [20, 0, 9.5],
    verticalPositions: [0, 10, 20],
    bounds: { top: 0, left: 0, width: 20, height: 20 },
    intervals: { minimum: 2, maximum: 2 },
    parameterOverrides: { candidateAlignmentTolerancePx: 0.5 }
  }));
  const diagnostic = getAxisDiagnostic(result, "horizontal");

  expect(diagnostic.candidatePositions).toEqual([20, 0, 9.5]);
  expect(diagnostic.candidateGaps).toEqual([
    {
      fromCandidateIndex: 1,
      toCandidateIndex: 2,
      fromPosition: 0,
      toPosition: 9.5,
      gap: 9.5
    },
    {
      fromCandidateIndex: 2,
      toCandidateIndex: 0,
      fromPosition: 9.5,
      toPosition: 20,
      gap: 10.5
    }
  ]);
  expect(diagnostic).toMatchObject({
    totalAttemptedInterpretations: 1,
    totalRejectedInterpretations: 0,
    totalSurvivingHypotheses: 1
  });
  expect(diagnostic.interpretations[0]).toMatchObject({
    intervalCount: 2,
    derivedSpacing: 10,
    status: "survived",
    boundCompatibility: {
      status: "compatible",
      startResidual: 0,
      endResidual: 0
    },
    quantumCompatibility: { status: "compatible" },
    inferredLineCount: 0,
    longestInferredRun: 0,
    inferredLineFraction: 0,
    rejectionReasons: []
  });
  expect(diagnostic.interpretations[0].candidateAssignmentAttempts.map(
    attempt => attempt.residual
  )).toEqual([0, 0, -0.5]);
  expect(diagnostic.interpretations[0].skippedIntervalCounts).toEqual([
    {
      fromCandidateIndex: 1,
      toCandidateIndex: 2,
      fromLineIndex: 0,
      toLineIndex: 1,
      skippedIntervalCount: 0
    },
    {
      fromCandidateIndex: 2,
      toCandidateIndex: 0,
      fromLineIndex: 1,
      toLineIndex: 2,
      skippedIntervalCount: 0
    }
  ]);
});

test("reports deterministic candidate residual statistics and histogram", () => {
  const result = reconstructUniformOrthogonalLattice(createInput({
    horizontalPositions: [0, 10.25, 19.5, 30],
    verticalPositions: [0, 10, 20, 30],
    bounds: { top: 0, left: 0, width: 30, height: 30 },
    intervals: { minimum: 3, maximum: 3 },
    parameterOverrides: { candidateAlignmentTolerancePx: 0.5 }
  }));
  const axis = getAxisDiagnostic(result, "horizontal");
  const diagnostic = axis.interpretations[0];

  expect(diagnostic).toMatchObject({
    assignedCandidateCount: 4,
    rejectedCandidateCount: 0,
    maximumAbsoluteResidual: 0.5,
    averageAbsoluteResidual: 0.1875,
    medianAbsoluteResidual: 0.125,
    RMSResidual: Math.sqrt(0.078125),
    firstFailingCandidate: null
  });
  expect(diagnostic.candidateResiduals).toEqual([
    {
      candidateIndex: 0,
      observedPosition: 0,
      modeledPosition: 0,
      residual: 0,
      absoluteResidual: 0,
      assignmentStatus: "assigned"
    },
    {
      candidateIndex: 1,
      observedPosition: 10.25,
      modeledPosition: 10,
      residual: 0.25,
      absoluteResidual: 0.25,
      assignmentStatus: "assigned"
    },
    {
      candidateIndex: 2,
      observedPosition: 19.5,
      modeledPosition: 20,
      residual: -0.5,
      absoluteResidual: 0.5,
      assignmentStatus: "assigned"
    },
    {
      candidateIndex: 3,
      observedPosition: 30,
      modeledPosition: 30,
      residual: 0,
      absoluteResidual: 0,
      assignmentStatus: "assigned"
    }
  ]);
  expect(diagnostic.residualHistogram).toEqual([
    { label: "<=0.25", minimumExclusive: null, maximumInclusive: 0.25, count: 3 },
    { label: "<=0.50", minimumExclusive: 0.25, maximumInclusive: 0.5, count: 1 },
    { label: "<=0.75", minimumExclusive: 0.5, maximumInclusive: 0.75, count: 0 },
    { label: "<=1.00", minimumExclusive: 0.75, maximumInclusive: 1, count: 0 },
    { label: "<=1.25", minimumExclusive: 1, maximumInclusive: 1.25, count: 0 },
    { label: "<=1.50", minimumExclusive: 1.25, maximumInclusive: 1.5, count: 0 },
    { label: "<=2.00", minimumExclusive: 1.5, maximumInclusive: 2, count: 0 }
  ]);
  expect(axis).toMatchObject({
    lowestMaximumResidual: 0.5,
    lowestRMSResidual: Math.sqrt(0.078125),
    lowestAverageResidual: 0.1875,
    highestAssignedCandidateCount: 4
  });
});

test("reports the first alignment failure and every candidate residual", () => {
  const result = reconstructUniformOrthogonalLattice(createInput({
    horizontalPositions: [0, 11.25, 20],
    verticalPositions: [0, 10, 20],
    bounds: { top: 0, left: 0, width: 20, height: 20 },
    intervals: { minimum: 2, maximum: 2 },
    parameterOverrides: { candidateAlignmentTolerancePx: 1 }
  }));
  const diagnostic = getAxisDiagnostic(result, "horizontal").interpretations[0];

  expect(diagnostic).toMatchObject({
    assignedCandidateCount: 1,
    rejectedCandidateCount: 1,
    maximumAbsoluteResidual: 1.25,
    averageAbsoluteResidual: 1.25 / 3,
    medianAbsoluteResidual: 0,
    RMSResidual: Math.sqrt((1.25 * 1.25) / 3),
    firstFailingCandidate: {
      candidateIndex: 1,
      observedPosition: 11.25,
      modeledPosition: 10,
      residual: 1.25,
      absoluteResidual: 1.25,
      tolerance: 1,
      marginOverTolerance: 0.25
    }
  });
  expect(diagnostic.candidateResiduals.map(candidate => ({
    observedPosition: candidate.observedPosition,
    modeledPosition: candidate.modeledPosition,
    residual: candidate.residual,
    absoluteResidual: candidate.absoluteResidual,
    assignmentStatus: candidate.assignmentStatus
  }))).toEqual([
    {
      observedPosition: 0,
      modeledPosition: 0,
      residual: 0,
      absoluteResidual: 0,
      assignmentStatus: "assigned"
    },
    {
      observedPosition: 11.25,
      modeledPosition: 10,
      residual: 1.25,
      absoluteResidual: 1.25,
      assignmentStatus: "rejected"
    },
    {
      observedPosition: 20,
      modeledPosition: 20,
      residual: 0,
      absoluteResidual: 0,
      assignmentStatus: "not-assessed"
    }
  ]);
});

test("keeps residual observations unavailable before candidate assignment", () => {
  const result = reconstructUniformOrthogonalLattice(createInput({
    parameterOverrides: {
      permittedCellSpacing: { minimum: 11, maximum: 100 }
    }
  }));
  const axis = getAxisDiagnostic(result, "horizontal");
  const diagnostic = axis.interpretations[0];

  expect(diagnostic).toMatchObject({
    assignedCandidateCount: 0,
    rejectedCandidateCount: 0,
    maximumAbsoluteResidual: null,
    averageAbsoluteResidual: null,
    medianAbsoluteResidual: null,
    RMSResidual: null,
    firstFailingCandidate: null
  });
  expect(diagnostic.candidateResiduals).toEqual([
    expect.objectContaining({ observedPosition: 0, assignmentStatus: "not-assessed" }),
    expect.objectContaining({ observedPosition: 10, assignmentStatus: "not-assessed" }),
    expect.objectContaining({ observedPosition: 20, assignmentStatus: "not-assessed" })
  ]);
  expect(diagnostic.candidateResiduals.every(candidate => (
    candidate.modeledPosition === null
    && candidate.residual === null
    && candidate.absoluteResidual === null
  ))).toBe(true);
  expect(diagnostic.residualHistogram.every(bucket => bucket.count === 0)).toBe(true);
  expect(axis).toMatchObject({
    lowestMaximumResidual: null,
    lowestRMSResidual: null,
    lowestAverageResidual: null,
    highestAssignedCandidateCount: null
  });
});

test("summarizes residual extrema without identifying an interpretation", () => {
  const result = reconstructUniformOrthogonalLattice(createInput({
    horizontalPositions: [0, 9.6, 20],
    verticalPositions: [0, 9.6, 20],
    bounds: { top: 0, left: 0, width: 20, height: 20 },
    intervals: { minimum: 1, maximum: 4 },
    parameterOverrides: {
      candidateAlignmentTolerancePx: 5,
      maximumSkippedIntervalsBetweenCandidates: 3,
      maximumConsecutiveInferredLines: 3,
      maximumInferredLineFraction: 0.6,
      maximumHypothesisCount: 20
    }
  }));
  const axis = getAxisDiagnostic(result, "horizontal");
  const assessed = axis.interpretations.filter(
    interpretation => interpretation.maximumAbsoluteResidual !== null
  );

  expect(axis.lowestMaximumResidual).toBe(Math.min(...assessed.map(
    interpretation => interpretation.maximumAbsoluteResidual
  )));
  expect(axis.lowestRMSResidual).toBe(Math.min(...assessed.map(
    interpretation => interpretation.RMSResidual
  )));
  expect(axis.lowestAverageResidual).toBe(Math.min(...assessed.map(
    interpretation => interpretation.averageAbsoluteResidual
  )));
  expect(axis.highestAssignedCandidateCount).toBe(Math.max(...assessed.map(
    interpretation => interpretation.assignedCandidateCount
  )));
  expect(axis).not.toHaveProperty("selectedInterpretation");
  expect(axis).not.toHaveProperty("preferredInterpretation");
});

test.each([
  {
    code: "spacing-out-of-range",
    positions: [0, 10, 20],
    bounds: { top: 0, left: 0, width: 20, height: 20 },
    overrides: { permittedCellSpacing: { minimum: 11, maximum: 100 } }
  },
  {
    code: "candidate-alignment-failed",
    positions: [0, 13, 20],
    bounds: { top: 0, left: 0, width: 20, height: 20 },
    overrides: { candidateAlignmentTolerancePx: 1 }
  },
  {
    code: "interval-count-incompatible",
    positions: [0, 0.5, 20],
    bounds: { top: 0, left: 0, width: 20, height: 20 },
    overrides: { candidateAlignmentTolerancePx: 1 }
  },
  {
    code: "skipped-interval-limit-exceeded",
    positions: [0, 40],
    bounds: { top: 0, left: 0, width: 40, height: 40 },
    intervals: { minimum: 4, maximum: 4 },
    overrides: {
      maximumSkippedIntervalsBetweenCandidates: 2,
      maximumConsecutiveInferredLines: 3,
      maximumInferredLineFraction: 1
    }
  },
  {
    code: "consecutive-inference-limit-exceeded",
    positions: [0, 40],
    bounds: { top: 0, left: 0, width: 40, height: 40 },
    intervals: { minimum: 4, maximum: 4 },
    overrides: {
      maximumSkippedIntervalsBetweenCandidates: 3,
      maximumConsecutiveInferredLines: 2,
      maximumInferredLineFraction: 1
    }
  },
  {
    code: "inferred-fraction-limit-exceeded",
    positions: [0, 40],
    bounds: { top: 0, left: 0, width: 40, height: 40 },
    intervals: { minimum: 4, maximum: 4 },
    overrides: {
      maximumSkippedIntervalsBetweenCandidates: 3,
      maximumConsecutiveInferredLines: 3,
      maximumInferredLineFraction: 0.5
    }
  }
])("exposes the $code rejection path", ({
  code,
  positions,
  bounds,
  intervals = { minimum: 2, maximum: 2 },
  overrides = {}
}) => {
  const result = reconstructUniformOrthogonalLattice(createInput({
    horizontalPositions: positions,
    verticalPositions: positions,
    bounds,
    intervals,
    parameterOverrides: overrides
  }));
  const diagnostic = getAxisDiagnostic(result, "horizontal");

  expect(diagnostic.totalAttemptedInterpretations).toBe(1);
  expect(diagnostic.totalRejectedInterpretations).toBe(1);
  expect(diagnostic.totalSurvivingHypotheses).toBe(0);
  expect(diagnostic.interpretations[0].rejectionReasons.map(
    reason => reason.code
  )).toContain(code);
});

test("preserves enumeration order and accounts for every interpretation", () => {
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
  const diagnostic = getAxisDiagnostic(result, "horizontal");

  expect(diagnostic.interpretations.map(value => value.intervalCount))
    .toEqual([1, 2, 3, 4]);
  expect(diagnostic.interpretations.map(value => value.status))
    .toEqual(["survived", "survived", "survived", "survived"]);
  expect(diagnostic).toMatchObject({
    totalAttemptedInterpretations: 4,
    totalRejectedInterpretations: 0,
    totalSurvivingHypotheses: 4
  });
});

test("keeps a non-quantum lattice continuous and records its representation", () => {
  const positions = [0, 20 / 3, 40 / 3, 20];
  const result = reconstructUniformOrthogonalLattice(createInput({
    horizontalPositions: positions,
    verticalPositions: positions,
    bounds: { top: 0, left: 0, width: 20, height: 20 },
    intervals: { minimum: 3, maximum: 3 }
  }));
  const hypothesis = result.axes.horizontal.hypotheses[0];
  const diagnostic = getAxisDiagnostic(result, "horizontal").interpretations[0];

  expect(result.status).toBe("available");
  expect(hypothesis.lines.map(line => line.position)).toEqual(positions);
  expect(hypothesis.lines.map(line => ({
    modeledPosition: line.modeledPosition,
    quantizedPosition: line.quantizedPosition,
    representationResidual: line.representationResidual
  }))).toEqual([
    { modeledPosition: 0, quantizedPosition: 0, representationResidual: 0 },
    {
      modeledPosition: 20 / 3,
      quantizedPosition: 6.5,
      representationResidual: 6.5 - (20 / 3)
    },
    {
      modeledPosition: 40 / 3,
      quantizedPosition: 13.5,
      representationResidual: 13.5 - (40 / 3)
    },
    { modeledPosition: 20, quantizedPosition: 20, representationResidual: 0 }
  ]);
  expect(hypothesis.candidateAssignments.map(assignment => assignment.delta))
    .toEqual([0, 0, 0, 0]);
  expect(diagnostic.quantumCompatibility).toMatchObject({
    status: "incompatible",
    incompatibleLineIndex: 1,
    unquantizedPosition: 20 / 3,
    quantizedPosition: 6.5,
    residual: 6.5 - (20 / 3)
  });
  expect(diagnostic.rejectionReasons).toEqual([]);
  expect(diagnostic.candidateAssignmentAttempts).toHaveLength(4);
});

test("uses continuous modeled positions for candidate-alignment rejection", () => {
  const result = reconstructUniformOrthogonalLattice(createInput({
    horizontalPositions: [0, 6.5, 40 / 3, 20],
    verticalPositions: [0, 20 / 3, 40 / 3, 20],
    bounds: { top: 0, left: 0, width: 20, height: 20 },
    intervals: { minimum: 3, maximum: 3 },
    parameterOverrides: { candidateAlignmentTolerancePx: 0 }
  }));
  const diagnostic = getAxisDiagnostic(result, "horizontal").interpretations[0];

  expect(result.status).toBe("partial");
  expect(diagnostic.quantumCompatibility.status).toBe("incompatible");
  expect(diagnostic.rejectionReasons.map(reason => reason.code))
    .toEqual(["candidate-alignment-failed"]);
  expect(diagnostic.candidateAssignmentAttempts[1]).toMatchObject({
    candidatePosition: 6.5,
    linePosition: 20 / 3,
    residual: 6.5 - (20 / 3),
    status: "rejected"
  });
});

test("keeps unavailable bounds unavailable before lattice enumeration", () => {
  const input = createInput();
  input.observedBounds = {
    ...input.observedBounds,
    status: "partial",
    value: {
      ...input.observedBounds.value,
      top: null,
      height: null
    }
  };
  const result = reconstructUniformOrthogonalLattice(input);

  expect(result.status).toBe("partial");
  expect(result.axes.horizontal).toEqual({
    status: "unavailable",
    hypotheses: []
  });
  expect(result.reasons).toEqual([{
    code: "axis-bounds-unavailable",
    axis: "horizontal",
    observedCandidateCount: 0
  }]);
  expect(getAxisDiagnostic(result, "horizontal")).toMatchObject({
    observedBounds: null,
    totalAttemptedInterpretations: 0,
    totalRejectedInterpretations: 0,
    totalSurvivingHypotheses: 0
  });
});

test("keeps exact-quantum lattice positions mathematically unchanged", () => {
  const result = reconstructUniformOrthogonalLattice(createInput());
  const lines = result.axes.horizontal.hypotheses[0].lines;
  const diagnostic = getAxisDiagnostic(result, "horizontal").interpretations[0];

  expect(lines.map(line => line.position)).toEqual([0, 10, 20]);
  expect(lines.map(line => line.modeledPosition)).toEqual([0, 10, 20]);
  expect(lines.map(line => line.quantizedPosition)).toEqual([0, 10, 20]);
  expect(lines.map(line => line.representationResidual)).toEqual([0, 0, 0]);
  expect(diagnostic.quantumCompatibility.status).toBe("compatible");
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

function getAxisDiagnostic(result, axis) {
  return result.diagnostics.find(diagnostic => (
    diagnostic.type === "uniform-orthogonal-lattice-strategy"
  )).axes[axis];
}

function projectReconstructionBehavior(result) {
  return {
    status: result.status,
    axisStatuses: {
      horizontal: result.axes.horizontal.status,
      vertical: result.axes.vertical.status
    },
    axisHypotheses: {
      horizontal: result.axes.horizontal.hypotheses.map(projectAxisHypothesis),
      vertical: result.axes.vertical.hypotheses.map(projectAxisHypothesis)
    },
    gridHypotheses: result.gridHypotheses,
    reasons: result.reasons
  };
}

function projectAxisHypothesis(hypothesis) {
  return {
    id: hypothesis.id,
    intervalCount: hypothesis.intervalCount,
    linePositions: hypothesis.lines.map(line => line.position),
    candidateLineIndexes: hypothesis.candidateAssignments.map(
      assignment => assignment.lineIndex
    )
  };
}
