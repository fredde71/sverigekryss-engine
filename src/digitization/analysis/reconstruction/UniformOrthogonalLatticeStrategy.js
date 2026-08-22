import { createGridReconstruction } from "./GridReconstruction";

export const UNIFORM_ORTHOGONAL_LATTICE_STRATEGY_ID =
  "uniform-orthogonal-lattice";

export const UniformOrthogonalLatticeStrategy = Object.freeze({
  id: UNIFORM_ORTHOGONAL_LATTICE_STRATEGY_ID,
  reconstruct: reconstructUniformOrthogonalLattice
});

export function reconstructUniformOrthogonalLattice({
  candidateEvidence,
  observedBounds,
  spacingEvidence,
  coordinateSystem,
  parameters
} = {}) {
  validateStrategyParameters(parameters);

  const horizontal = reconstructAxis({
    axis: "horizontal",
    candidates: candidateEvidence?.horizontal,
    bounds: resolveAxisBounds(observedBounds, "horizontal"),
    parameters
  });
  const vertical = reconstructAxis({
    axis: "vertical",
    candidates: candidateEvidence?.vertical,
    bounds: resolveAxisBounds(observedBounds, "vertical"),
    parameters
  });
  const assembled = assembleGridResult(horizontal, vertical, parameters);

  return createGridReconstruction({
    candidateEvidence,
    observedBounds,
    spacingEvidence,
    coordinateSystem,
    parameters,
    status: assembled.status,
    assumptions: [
      {
        id: "uniform-orthogonal-lattice",
        status: "applied"
      },
      {
        id: "observed-bounds-are-outer-line-centers",
        status: "applied"
      },
      {
        id: "axes-reconstructed-independently",
        status: "applied"
      }
    ],
    axes: {
      horizontal: horizontal.result,
      vertical: vertical.result
    },
    gridHypotheses: assembled.gridHypotheses,
    diagnostics: [
      createStrategyDiagnostic(horizontal, vertical, assembled)
    ],
    reasons: assembled.reasons
  });
}

function reconstructAxis({ axis, candidates, bounds, parameters }) {
  if (!bounds) {
    return unavailableAxis(axis, "axis-bounds-unavailable", 0);
  }

  if (!Array.isArray(candidates)) {
    return unavailableAxis(axis, "candidate-evidence-invalid", 0);
  }

  if (candidates.length < parameters.minimumObservedCandidatesPerAxis) {
    return unavailableAxis(
      axis,
      "insufficient-observed-candidates",
      candidates.length
    );
  }

  const compatible = [];

  for (
    let intervalCount = parameters.permittedIntervalCount.minimum;
    intervalCount <= parameters.permittedIntervalCount.maximum;
    intervalCount += 1
  ) {
    const hypothesis = createCompatibleAxisHypothesis({
      axis,
      candidates,
      bounds,
      intervalCount,
      parameters
    });

    if (hypothesis) {
      compatible.push(hypothesis);
    }
  }

  if (compatible.length === 0) {
    return unavailableAxis(axis, "no-compatible-lattice", candidates.length);
  }

  if (compatible.length > parameters.maximumHypothesisCount) {
    return {
      compatibleCount: compatible.length,
      overflow: true,
      reason: {
        code: "axis-hypothesis-limit-exceeded",
        axis,
        compatibleHypothesisCount: compatible.length,
        maximumHypothesisCount: parameters.maximumHypothesisCount
      },
      result: {
        status: "unavailable",
        hypotheses: []
      }
    };
  }

  return {
    compatibleCount: compatible.length,
    overflow: false,
    reason: compatible.length > 1
      ? {
        code: "multiple-compatible-axis-hypotheses",
        axis,
        compatibleHypothesisCount: compatible.length
      }
      : null,
    result: {
      status: compatible.length === 1 ? "available" : "ambiguous",
      hypotheses: compatible
    }
  };
}

function createCompatibleAxisHypothesis({
  axis,
  candidates,
  bounds,
  intervalCount,
  parameters
}) {
  const spacing = (bounds.end - bounds.start) / intervalCount;

  if (
    spacing < parameters.permittedCellSpacing.minimum
    || spacing > parameters.permittedCellSpacing.maximum
  ) {
    return null;
  }

  const linePositions = createLinePositions(
    bounds.start,
    bounds.end,
    intervalCount,
    parameters.positionQuantum
  );

  if (!linePositions) {
    return null;
  }

  const assignments = assignCandidates(
    candidates,
    linePositions,
    parameters.candidateAlignmentTolerancePx
  );

  if (!assignments || !candidateGapsArePermitted(
    assignments,
    parameters.maximumSkippedIntervalsBetweenCandidates
  )) {
    return null;
  }

  const assignedByLineIndex = new Map(
    assignments.map(assignment => [assignment.lineIndex, assignment])
  );
  const lines = linePositions.map((position, index) => {
    const assignment = assignedByLineIndex.get(index);

    return {
      index,
      position,
      evidence: assignment
        ? {
          status: "observed-aligned",
          candidateIndex: assignment.candidateIndex,
          observedPosition: assignment.observedPosition,
          delta: assignment.delta
        }
        : {
          status: "inferred",
          candidateIndex: null,
          observedPosition: null,
          delta: null
        }
    };
  });
  const inferredLineCount = lines.filter(line => (
    line.evidence.status === "inferred"
  )).length;
  const maximumInferredRun = findMaximumInferredRun(lines);
  const inferredLineFraction = inferredLineCount / lines.length;

  if (
    maximumInferredRun > parameters.maximumConsecutiveInferredLines
    || inferredLineFraction > parameters.maximumInferredLineFraction
  ) {
    return null;
  }

  const id = `${axis}-uniform-intervals-${intervalCount}`;

  return {
    id,
    intervalCount,
    origin: linePositions[0],
    spacing,
    lines,
    candidateAssignments: assignments.map(assignment => ({
      candidateIndex: assignment.candidateIndex,
      lineIndex: assignment.lineIndex,
      observedPosition: assignment.observedPosition,
      linePosition: assignment.linePosition,
      delta: assignment.delta
    })),
    diagnostics: [
      {
        type: "uniform-axis-lattice",
        axis,
        intervalCount,
        observedLineCount: assignments.length,
        inferredLineCount,
        inferredLineFraction,
        maximumInferredRun,
        bounds: {
          start: bounds.start,
          end: bounds.end
        }
      }
    ]
  };
}

function createLinePositions(start, end, intervalCount, positionQuantum) {
  const spacing = (end - start) / intervalCount;
  const positions = [];

  for (let index = 0; index <= intervalCount; index += 1) {
    const unquantized = index === intervalCount
      ? end
      : start + (spacing * index);
    const quantizedPosition = positionQuantum === null
      ? unquantized
      : quantize(unquantized, positionQuantum);
    const roundingMargin = Number.EPSILON * Math.max(
      1,
      Math.abs(unquantized),
      Math.abs(quantizedPosition)
    ) * 16;

    if (
      positionQuantum !== null
      && Math.abs(quantizedPosition - unquantized) > roundingMargin
    ) {
      return null;
    }

    const position = index === 0
      ? start
      : index === intervalCount
        ? end
        : quantizedPosition;

    if (position < start || position > end) {
      return null;
    }

    if (positions.length > 0 && position <= positions[positions.length - 1]) {
      return null;
    }

    positions.push(position);
  }

  return positions;
}

function assignCandidates(candidates, linePositions, tolerance) {
  const assignments = [];
  const occupiedLines = new Set();

  for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
    const candidate = candidates[candidateIndex];
    let nearestLineIndex = 0;
    let nearestDistance = Math.abs(candidate.position - linePositions[0]);

    for (let lineIndex = 1; lineIndex < linePositions.length; lineIndex += 1) {
      const distance = Math.abs(candidate.position - linePositions[lineIndex]);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestLineIndex = lineIndex;
      }
    }

    if (nearestDistance > tolerance || occupiedLines.has(nearestLineIndex)) {
      return null;
    }

    occupiedLines.add(nearestLineIndex);
    const linePosition = linePositions[nearestLineIndex];

    assignments.push({
      candidateIndex,
      lineIndex: nearestLineIndex,
      observedPosition: candidate.position,
      linePosition,
      delta: candidate.position - linePosition
    });
  }

  return assignments;
}

function candidateGapsArePermitted(assignments, maximumSkippedIntervals) {
  const ordered = [...assignments].sort((left, right) => (
    left.lineIndex - right.lineIndex || left.candidateIndex - right.candidateIndex
  ));

  for (let index = 1; index < ordered.length; index += 1) {
    const skipped = ordered[index].lineIndex - ordered[index - 1].lineIndex - 1;

    if (skipped > maximumSkippedIntervals) {
      return false;
    }
  }

  return true;
}

function findMaximumInferredRun(lines) {
  let current = 0;
  let maximum = 0;

  for (const line of lines) {
    if (line.evidence.status === "inferred") {
      current += 1;
      maximum = Math.max(maximum, current);
    } else {
      current = 0;
    }
  }

  return maximum;
}

function assembleGridResult(horizontal, vertical, parameters) {
  const horizontalAvailable = horizontal.result.status !== "unavailable";
  const verticalAvailable = vertical.result.status !== "unavailable";

  if (!horizontalAvailable && !verticalAvailable) {
    return {
      status: "unavailable",
      gridHypotheses: [],
      reasons: [horizontal.reason, vertical.reason]
    };
  }

  if (horizontalAvailable !== verticalAvailable) {
    return {
      status: "partial",
      gridHypotheses: [],
      reasons: [horizontalAvailable ? vertical.reason : horizontal.reason]
    };
  }

  const combinationCount = (
    horizontal.result.hypotheses.length * vertical.result.hypotheses.length
  );

  if (combinationCount > parameters.maximumHypothesisCount) {
    return {
      status: "ambiguous",
      gridHypotheses: [],
      reasons: [{
        code: "grid-hypothesis-limit-exceeded",
        compatibleHypothesisCount: combinationCount,
        maximumHypothesisCount: parameters.maximumHypothesisCount
      }]
    };
  }

  const gridHypotheses = [];

  for (const horizontalHypothesis of horizontal.result.hypotheses) {
    for (const verticalHypothesis of vertical.result.hypotheses) {
      gridHypotheses.push(createGridHypothesis(
        horizontalHypothesis,
        verticalHypothesis
      ));
    }
  }

  if (gridHypotheses.length === 1) {
    return { status: "available", gridHypotheses, reasons: [] };
  }

  return {
    status: "ambiguous",
    gridHypotheses,
    reasons: [
      {
        code: "multiple-compatible-grid-hypotheses",
        compatibleHypothesisCount: gridHypotheses.length
      }
    ]
  };
}

function createGridHypothesis(horizontal, vertical) {
  return {
    id: `grid-${horizontal.id}-${vertical.id}`,
    horizontalHypothesisId: horizontal.id,
    verticalHypothesisId: vertical.id,
    rows: horizontal.intervalCount,
    cols: vertical.intervalCount,
    bounds: {
      top: horizontal.lines[0].position,
      left: vertical.lines[0].position,
      width: vertical.lines[vertical.lines.length - 1].position
        - vertical.lines[0].position,
      height: horizontal.lines[horizontal.lines.length - 1].position
        - horizontal.lines[0].position
    },
    lines: {
      horizontal: horizontal.lines,
      vertical: vertical.lines
    },
    candidateAssignments: {
      horizontal: horizontal.candidateAssignments,
      vertical: vertical.candidateAssignments
    },
    diagnostics: [
      {
        type: "uniform-orthogonal-grid-lattice",
        rows: horizontal.intervalCount,
        cols: vertical.intervalCount
      }
    ]
  };
}

function resolveAxisBounds(observedBounds, axis) {
  const value = observedBounds?.value;

  if (!value) {
    return null;
  }

  const start = axis === "horizontal" ? value.top : value.left;
  const extent = axis === "horizontal" ? value.height : value.width;

  if (!Number.isFinite(start) || !Number.isFinite(extent) || extent <= 0) {
    return null;
  }

  return { start, end: start + extent };
}

function unavailableAxis(axis, code, observedCandidateCount) {
  return {
    compatibleCount: 0,
    overflow: false,
    reason: { code, axis, observedCandidateCount },
    result: { status: "unavailable", hypotheses: [] }
  };
}

function createStrategyDiagnostic(horizontal, vertical, assembled) {
  return {
    type: "uniform-orthogonal-lattice-strategy",
    status: assembled.status,
    axes: {
      horizontal: {
        status: horizontal.result.status,
        compatibleHypothesisCount: horizontal.compatibleCount,
        hypothesisLimitExceeded: horizontal.overflow
      },
      vertical: {
        status: vertical.result.status,
        compatibleHypothesisCount: vertical.compatibleCount,
        hypothesisLimitExceeded: vertical.overflow
      }
    }
  };
}

function validateStrategyParameters(parameters) {
  if (parameters?.strategyId !== UNIFORM_ORTHOGONAL_LATTICE_STRATEGY_ID) {
    throw new Error(
      `parameters.strategyId must equal ${UNIFORM_ORTHOGONAL_LATTICE_STRATEGY_ID}`
    );
  }
}

function quantize(value, quantum) {
  const quantized = Math.round(value / quantum) * quantum;
  return Object.is(quantized, -0) ? 0 : quantized;
}
