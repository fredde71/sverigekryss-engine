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
  const diagnostic = createAxisDiagnostic(axis, candidates, bounds);

  if (!bounds) {
    return unavailableAxis(
      axis,
      "axis-bounds-unavailable",
      0,
      diagnostic
    );
  }

  if (!Array.isArray(candidates)) {
    return unavailableAxis(axis, "candidate-evidence-invalid", 0, diagnostic);
  }

  if (candidates.length < parameters.minimumObservedCandidatesPerAxis) {
    return unavailableAxis(
      axis,
      "insufficient-observed-candidates",
      candidates.length,
      diagnostic
    );
  }

  const compatible = [];

  for (
    let intervalCount = parameters.permittedIntervalCount.minimum;
    intervalCount <= parameters.permittedIntervalCount.maximum;
    intervalCount += 1
  ) {
    const interpretation = evaluateAxisInterpretation({
      axis,
      candidates,
      bounds,
      intervalCount,
      parameters
    });

    diagnostic.interpretations.push(interpretation.diagnostic);

    if (interpretation.hypothesis) {
      compatible.push(interpretation.hypothesis);
    }
  }

  diagnostic.totalAttemptedInterpretations = diagnostic.interpretations.length;
  diagnostic.totalRejectedInterpretations = diagnostic.interpretations.filter(
    interpretation => interpretation.status === "rejected"
  ).length;
  diagnostic.totalSurvivingHypotheses = compatible.length;
  applyAxisResidualSummary(diagnostic);

  if (compatible.length === 0) {
    return unavailableAxis(
      axis,
      "no-compatible-lattice",
      candidates.length,
      diagnostic
    );
  }

  if (compatible.length > parameters.maximumHypothesisCount) {
    return {
      compatibleCount: compatible.length,
      overflow: true,
      diagnostic,
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
    diagnostic,
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

function evaluateAxisInterpretation({
  axis,
  candidates,
  bounds,
  intervalCount,
  parameters
}) {
  const spacing = (bounds.end - bounds.start) / intervalCount;
  const diagnostic = createInterpretationDiagnostic({
    intervalCount,
    spacing,
    bounds,
    parameters,
    candidates
  });

  if (
    spacing < parameters.permittedCellSpacing.minimum
    || spacing > parameters.permittedCellSpacing.maximum
  ) {
    diagnostic.rejectionReasons.push({
      code: "spacing-out-of-range",
      spacing,
      minimum: parameters.permittedCellSpacing.minimum,
      maximum: parameters.permittedCellSpacing.maximum
    });
    return rejectInterpretation(diagnostic);
  }

  const linePositionResult = createLinePositions(
    bounds.start,
    bounds.end,
    intervalCount,
    parameters.positionQuantum,
    parameters.boundsAlignmentTolerancePx
  );
  diagnostic.quantumCompatibility = linePositionResult.quantumCompatibility;
  diagnostic.boundCompatibility = linePositionResult.boundCompatibility;

  if (!linePositionResult.positions) {
    diagnostic.rejectionReasons.push(...linePositionResult.rejectionReasons);
    return rejectInterpretation(diagnostic);
  }

  const linePositions = linePositionResult.positions;
  const lineRepresentations = linePositionResult.representations;

  const assignmentResult = assignCandidates(
    candidates,
    linePositions,
    parameters.candidateAlignmentTolerancePx
  );
  diagnostic.candidateAssignmentAttempts = assignmentResult.attempts;
  applyCandidateResidualDiagnostics({
    diagnostic,
    candidates,
    linePositions,
    tolerance: parameters.candidateAlignmentTolerancePx,
    attempts: assignmentResult.attempts,
    rejectionReasons: assignmentResult.rejectionReasons
  });

  if (!assignmentResult.assignments) {
    diagnostic.rejectionReasons.push(...assignmentResult.rejectionReasons);
    return rejectInterpretation(diagnostic);
  }

  const assignments = assignmentResult.assignments;
  const skippedIntervalResult = inspectSkippedIntervals(
    assignments,
    parameters.maximumSkippedIntervalsBetweenCandidates
  );
  diagnostic.skippedIntervalCounts = skippedIntervalResult.counts;

  const assignedByLineIndex = new Map(
    assignments.map(assignment => [assignment.lineIndex, assignment])
  );
  const lines = linePositions.map((position, index) => {
    const assignment = assignedByLineIndex.get(index);
    const representation = lineRepresentations[index];

    return {
      index,
      position,
      modeledPosition: position,
      quantizedPosition: representation.quantizedPosition,
      representationResidual: representation.residual,
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
  diagnostic.inferredLineCount = inferredLineCount;
  diagnostic.longestInferredRun = maximumInferredRun;
  diagnostic.inferredLineFraction = inferredLineFraction;

  if (!skippedIntervalResult.permitted) {
    diagnostic.rejectionReasons.push(...skippedIntervalResult.rejectionReasons);
    return rejectInterpretation(diagnostic);
  }

  if (maximumInferredRun > parameters.maximumConsecutiveInferredLines) {
    diagnostic.rejectionReasons.push({
      code: "consecutive-inference-limit-exceeded",
      longestInferredRun: maximumInferredRun,
      maximumConsecutiveInferredLines:
        parameters.maximumConsecutiveInferredLines
    });
  }

  if (inferredLineFraction > parameters.maximumInferredLineFraction) {
    diagnostic.rejectionReasons.push({
      code: "inferred-fraction-limit-exceeded",
      inferredLineFraction,
      maximumInferredLineFraction: parameters.maximumInferredLineFraction
    });
  }

  if (diagnostic.rejectionReasons.length > 0) {
    return rejectInterpretation(diagnostic);
  }

  const id = `${axis}-uniform-intervals-${intervalCount}`;

  diagnostic.status = "survived";

  return {
    diagnostic,
    hypothesis: {
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
    }
  };
}

function createLinePositions(
  start,
  end,
  intervalCount,
  positionQuantum,
  boundsAlignmentTolerancePx
) {
  const spacing = (end - start) / intervalCount;
  const positions = [];
  const quantumCompatibility = {
    status: "compatible",
    positionQuantum,
    incompatibleLineIndex: null,
    unquantizedPosition: null,
    quantizedPosition: null,
    residual: null,
    representations: []
  };
  const boundCompatibility = {
    status: "compatible",
    start,
    end,
    reconstructedStart: start,
    reconstructedEnd: end,
    startResidual: 0,
    endResidual: 0,
    tolerancePx: boundsAlignmentTolerancePx
  };

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

    const residual = quantizedPosition - unquantized;
    const exactlyRepresentable = (
      positionQuantum === null
      || Math.abs(residual) <= roundingMargin
    );
    const representation = {
      lineIndex: index,
      modeledPosition: unquantized,
      quantizedPosition,
      residual,
      status: exactlyRepresentable
        ? "exactly-representable"
        : "not-exactly-representable"
    };

    quantumCompatibility.representations.push(representation);

    if (
      positionQuantum !== null
      && !exactlyRepresentable
      && quantumCompatibility.status === "compatible"
    ) {
      quantumCompatibility.status = "incompatible";
      quantumCompatibility.incompatibleLineIndex = index;
      quantumCompatibility.unquantizedPosition = unquantized;
      quantumCompatibility.quantizedPosition = quantizedPosition;
      quantumCompatibility.residual = residual;
    }

    const position = index === 0
      ? start
      : index === intervalCount
        ? end
        : unquantized;

    if (position < start || position > end) {
      return incompatibleIntervalCount({
        index,
        position,
        reason: "line-outside-declared-bounds",
        quantumCompatibility,
        boundCompatibility
      });
    }

    if (positions.length > 0 && position <= positions[positions.length - 1]) {
      return incompatibleIntervalCount({
        index,
        position,
        reason: "line-positions-not-strictly-increasing",
        quantumCompatibility,
        boundCompatibility
      });
    }

    positions.push(position);
  }

  return {
    positions,
    representations: quantumCompatibility.representations,
    quantumCompatibility,
    boundCompatibility,
    rejectionReasons: []
  };
}

function assignCandidates(candidates, linePositions, tolerance) {
  const assignments = [];
  const attempts = [];
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

    const linePosition = linePositions[nearestLineIndex];
    const delta = candidate.position - linePosition;
    const occupied = occupiedLines.has(nearestLineIndex);
    const aligned = nearestDistance <= tolerance;
    const attempt = {
      candidateIndex,
      candidatePosition: candidate.position,
      lineIndex: nearestLineIndex,
      linePosition,
      residual: delta,
      absoluteResidual: nearestDistance,
      tolerancePx: tolerance,
      status: aligned && !occupied ? "assigned" : "rejected"
    };

    attempts.push(attempt);

    if (!aligned) {
      return {
        assignments: null,
        attempts,
        rejectionReasons: [{
          code: "candidate-alignment-failed",
          candidateIndex,
          candidatePosition: candidate.position,
          lineIndex: nearestLineIndex,
          linePosition,
          residual: delta,
          absoluteResidual: nearestDistance,
          tolerancePx: tolerance
        }]
      };
    }

    if (occupied) {
      return {
        assignments: null,
        attempts,
        rejectionReasons: [{
          code: "interval-count-incompatible",
          candidateIndex,
          candidatePosition: candidate.position,
          lineIndex: nearestLineIndex,
          reason: "multiple-candidates-assigned-to-one-line"
        }]
      };
    }

    occupiedLines.add(nearestLineIndex);

    assignments.push({
      candidateIndex,
      lineIndex: nearestLineIndex,
      observedPosition: candidate.position,
      linePosition,
      delta
    });
  }

  return { assignments, attempts, rejectionReasons: [] };
}

const RESIDUAL_HISTOGRAM_BOUNDS = Object.freeze([
  0.25,
  0.5,
  0.75,
  1,
  1.25,
  1.5,
  2
]);

function applyCandidateResidualDiagnostics({
  diagnostic,
  candidates,
  linePositions,
  tolerance,
  attempts,
  rejectionReasons
}) {
  const attemptsByCandidateIndex = new Map(
    attempts.map(attempt => [attempt.candidateIndex, attempt])
  );
  const candidateResiduals = candidates.map((candidate, candidateIndex) => {
    const nearest = findNearestModeledPosition(candidate.position, linePositions);
    const attempt = attemptsByCandidateIndex.get(candidateIndex);

    return {
      candidateIndex,
      observedPosition: candidate.position,
      modeledPosition: nearest.modeledPosition,
      residual: nearest.residual,
      absoluteResidual: nearest.absoluteResidual,
      assignmentStatus: attempt?.status ?? "not-assessed"
    };
  });
  const absoluteResiduals = candidateResiduals.map(
    candidate => candidate.absoluteResidual
  );
  const assignedCandidateCount = candidateResiduals.filter(
    candidate => candidate.assignmentStatus === "assigned"
  ).length;
  const rejectedCandidateCount = candidateResiduals.filter(
    candidate => candidate.assignmentStatus === "rejected"
  ).length;
  const alignmentFailure = rejectionReasons.find(
    reason => reason.code === "candidate-alignment-failed"
  );

  diagnostic.assignedCandidateCount = assignedCandidateCount;
  diagnostic.rejectedCandidateCount = rejectedCandidateCount;
  diagnostic.maximumAbsoluteResidual = Math.max(...absoluteResiduals);
  diagnostic.averageAbsoluteResidual = average(absoluteResiduals);
  diagnostic.medianAbsoluteResidual = median(absoluteResiduals);
  diagnostic.RMSResidual = rootMeanSquare(absoluteResiduals);
  diagnostic.candidateResiduals = candidateResiduals;
  diagnostic.residualHistogram = createResidualHistogram(absoluteResiduals);
  diagnostic.firstFailingCandidate = alignmentFailure
    ? {
      candidateIndex: alignmentFailure.candidateIndex,
      observedPosition: alignmentFailure.candidatePosition,
      modeledPosition: alignmentFailure.linePosition,
      residual: alignmentFailure.residual,
      absoluteResidual: alignmentFailure.absoluteResidual,
      tolerance,
      marginOverTolerance: alignmentFailure.absoluteResidual - tolerance
    }
    : null;
}

function findNearestModeledPosition(observedPosition, linePositions) {
  let lineIndex = 0;
  let absoluteResidual = Math.abs(observedPosition - linePositions[0]);

  for (let index = 1; index < linePositions.length; index += 1) {
    const distance = Math.abs(observedPosition - linePositions[index]);

    if (distance < absoluteResidual) {
      lineIndex = index;
      absoluteResidual = distance;
    }
  }

  const modeledPosition = linePositions[lineIndex];

  return {
    modeledPosition,
    residual: observedPosition - modeledPosition,
    absoluteResidual
  };
}

function createResidualHistogram(absoluteResiduals) {
  return RESIDUAL_HISTOGRAM_BOUNDS.map((maximumInclusive, index) => ({
    label: `<=${maximumInclusive.toFixed(2)}`,
    minimumExclusive: index === 0
      ? null
      : RESIDUAL_HISTOGRAM_BOUNDS[index - 1],
    maximumInclusive,
    count: absoluteResiduals.filter(value => (
      value <= maximumInclusive
      && (index === 0 || value > RESIDUAL_HISTOGRAM_BOUNDS[index - 1])
    )).length
  }));
}

function average(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values) {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);

  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
}

function rootMeanSquare(values) {
  return Math.sqrt(
    values.reduce((total, value) => total + (value * value), 0) / values.length
  );
}

function inspectSkippedIntervals(assignments, maximumSkippedIntervals) {
  const ordered = [...assignments].sort((left, right) => (
    left.lineIndex - right.lineIndex || left.candidateIndex - right.candidateIndex
  ));
  const counts = [];
  const rejectionReasons = [];

  for (let index = 1; index < ordered.length; index += 1) {
    const skipped = ordered[index].lineIndex - ordered[index - 1].lineIndex - 1;
    const count = {
      fromCandidateIndex: ordered[index - 1].candidateIndex,
      toCandidateIndex: ordered[index].candidateIndex,
      fromLineIndex: ordered[index - 1].lineIndex,
      toLineIndex: ordered[index].lineIndex,
      skippedIntervalCount: skipped
    };

    counts.push(count);

    if (skipped > maximumSkippedIntervals) {
      rejectionReasons.push({
        code: "skipped-interval-limit-exceeded",
        ...count,
        maximumSkippedIntervalsBetweenCandidates: maximumSkippedIntervals
      });
    }
  }

  return {
    permitted: rejectionReasons.length === 0,
    counts,
    rejectionReasons
  };
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

function createAxisDiagnostic(axis, candidates, bounds) {
  const orderedCandidates = Array.isArray(candidates)
    ? candidates
      .map((candidate, candidateIndex) => ({
        candidateIndex,
        position: candidate?.position
      }))
      .filter(candidate => Number.isFinite(candidate.position))
      .sort((left, right) => (
        left.position - right.position
        || left.candidateIndex - right.candidateIndex
      ))
    : [];
  const candidateGaps = [];

  for (let index = 1; index < orderedCandidates.length; index += 1) {
    candidateGaps.push({
      fromCandidateIndex: orderedCandidates[index - 1].candidateIndex,
      toCandidateIndex: orderedCandidates[index].candidateIndex,
      fromPosition: orderedCandidates[index - 1].position,
      toPosition: orderedCandidates[index].position,
      gap: orderedCandidates[index].position
        - orderedCandidates[index - 1].position
    });
  }

  return {
    axis,
    candidatePositions: Array.isArray(candidates)
      ? candidates.map(candidate => candidate?.position)
      : [],
    candidateGaps,
    observedBounds: bounds
      ? { start: bounds.start, end: bounds.end }
      : null,
    totalAttemptedInterpretations: 0,
    totalRejectedInterpretations: 0,
    totalSurvivingHypotheses: 0,
    lowestMaximumResidual: null,
    lowestRMSResidual: null,
    lowestAverageResidual: null,
    highestAssignedCandidateCount: null,
    interpretations: []
  };
}

function applyAxisResidualSummary(diagnostic) {
  const assessed = diagnostic.interpretations.filter(
    interpretation => interpretation.maximumAbsoluteResidual !== null
  );

  if (assessed.length === 0) {
    return;
  }

  diagnostic.lowestMaximumResidual = Math.min(...assessed.map(
    interpretation => interpretation.maximumAbsoluteResidual
  ));
  diagnostic.lowestRMSResidual = Math.min(...assessed.map(
    interpretation => interpretation.RMSResidual
  ));
  diagnostic.lowestAverageResidual = Math.min(...assessed.map(
    interpretation => interpretation.averageAbsoluteResidual
  ));
  diagnostic.highestAssignedCandidateCount = Math.max(...assessed.map(
    interpretation => interpretation.assignedCandidateCount
  ));
}

function createInterpretationDiagnostic({
  intervalCount,
  spacing,
  bounds,
  parameters,
  candidates
}) {
  return {
    intervalCount,
    derivedSpacing: spacing,
    status: "rejected",
    boundCompatibility: {
      status: "not-assessed",
      start: bounds.start,
      end: bounds.end,
      reconstructedStart: null,
      reconstructedEnd: null,
      startResidual: null,
      endResidual: null,
      tolerancePx: parameters.boundsAlignmentTolerancePx
    },
    quantumCompatibility: {
      status: "not-assessed",
      positionQuantum: parameters.positionQuantum,
      incompatibleLineIndex: null,
      unquantizedPosition: null,
      quantizedPosition: null,
      residual: null,
      representations: []
    },
    candidateAssignmentAttempts: [],
    assignedCandidateCount: 0,
    rejectedCandidateCount: 0,
    maximumAbsoluteResidual: null,
    averageAbsoluteResidual: null,
    medianAbsoluteResidual: null,
    RMSResidual: null,
    candidateResiduals: candidates.map((candidate, candidateIndex) => ({
      candidateIndex,
      observedPosition: candidate.position,
      modeledPosition: null,
      residual: null,
      absoluteResidual: null,
      assignmentStatus: "not-assessed"
    })),
    residualHistogram: createResidualHistogram([]),
    firstFailingCandidate: null,
    skippedIntervalCounts: [],
    inferredLineCount: null,
    longestInferredRun: null,
    inferredLineFraction: null,
    rejectionReasons: []
  };
}

function rejectInterpretation(diagnostic) {
  diagnostic.status = "rejected";
  return { diagnostic, hypothesis: null };
}

function incompatibleIntervalCount({
  index,
  position,
  reason,
  quantumCompatibility,
  boundCompatibility
}) {
  return {
    positions: null,
    quantumCompatibility,
    boundCompatibility,
    rejectionReasons: [{
      code: "interval-count-incompatible",
      lineIndex: index,
      position,
      reason
    }]
  };
}

function unavailableAxis(axis, code, observedCandidateCount, diagnostic) {
  return {
    compatibleCount: 0,
    overflow: false,
    diagnostic,
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
        hypothesisLimitExceeded: horizontal.overflow,
        candidatePositions: horizontal.diagnostic.candidatePositions,
        candidateGaps: horizontal.diagnostic.candidateGaps,
        observedBounds: horizontal.diagnostic.observedBounds,
        totalAttemptedInterpretations:
          horizontal.diagnostic.totalAttemptedInterpretations,
        totalRejectedInterpretations:
          horizontal.diagnostic.totalRejectedInterpretations,
        totalSurvivingHypotheses:
          horizontal.diagnostic.totalSurvivingHypotheses,
        lowestMaximumResidual:
          horizontal.diagnostic.lowestMaximumResidual,
        lowestRMSResidual:
          horizontal.diagnostic.lowestRMSResidual,
        lowestAverageResidual:
          horizontal.diagnostic.lowestAverageResidual,
        highestAssignedCandidateCount:
          horizontal.diagnostic.highestAssignedCandidateCount,
        interpretations: horizontal.diagnostic.interpretations
      },
      vertical: {
        status: vertical.result.status,
        compatibleHypothesisCount: vertical.compatibleCount,
        hypothesisLimitExceeded: vertical.overflow,
        candidatePositions: vertical.diagnostic.candidatePositions,
        candidateGaps: vertical.diagnostic.candidateGaps,
        observedBounds: vertical.diagnostic.observedBounds,
        totalAttemptedInterpretations:
          vertical.diagnostic.totalAttemptedInterpretations,
        totalRejectedInterpretations:
          vertical.diagnostic.totalRejectedInterpretations,
        totalSurvivingHypotheses:
          vertical.diagnostic.totalSurvivingHypotheses,
        lowestMaximumResidual:
          vertical.diagnostic.lowestMaximumResidual,
        lowestRMSResidual:
          vertical.diagnostic.lowestRMSResidual,
        lowestAverageResidual:
          vertical.diagnostic.lowestAverageResidual,
        highestAssignedCandidateCount:
          vertical.diagnostic.highestAssignedCandidateCount,
        interpretations: vertical.diagnostic.interpretations
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
