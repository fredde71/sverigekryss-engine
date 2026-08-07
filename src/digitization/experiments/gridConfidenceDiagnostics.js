const SCORE_MEANING = "experimental-structural-score-not-calibrated-probability";
const REQUIRED_FACTOR_IDS = Object.freeze([
  "geometry-integrity",
  "spacing-consistency",
  "cell-aspect-observation"
]);

export const gridConfidenceDiagnosticsExperiment = Object.freeze({
  id: "grid-confidence-diagnostics",
  description: "Measure how strongly production grid geometry and diagnostics resemble a regular crossword grid.",
  run(_binaryImage, context = {}) {
    return createGridConfidenceDiagnostics({
      gridDetection: context.gridDetection
    });
  }
});

export function createGridConfidenceDiagnostics({ gridDetection } = {}) {
  const geometry = gridDetection?.geometry;
  const diagnostics = Array.isArray(gridDetection?.diagnostics)
    ? gridDetection.diagnostics
    : [];
  const observations = createObservations(gridDetection, diagnostics);

  if (!geometry) {
    return createResult({
      status: "unavailable",
      score: null,
      factors: [
        createUnavailableFactor("geometry-integrity", true, "detected-geometry-unavailable"),
        createUnavailableFactor("spacing-consistency", true, "detected-geometry-unavailable"),
        createUnavailableFactor("cell-aspect-observation", true, "detected-geometry-unavailable"),
        createUnavailableFactor("candidate-selectivity", false, "detected-geometry-unavailable")
      ],
      observations
    });
  }

  const factors = [
    createGeometryIntegrityFactor(geometry),
    createSpacingConsistencyFactor(diagnostics),
    createCellAspectObservationFactor(diagnostics),
    createCandidateSelectivityFactor(diagnostics)
  ];
  const requiredFactors = factors.filter(factor => factor.includedInOverall);
  const measuredRequiredFactors = requiredFactors.filter(factor => (
    factor.status === "measured"
  ));
  const hasEveryRequiredFactor = measuredRequiredFactors.length
    === REQUIRED_FACTOR_IDS.length;
  const score = hasEveryRequiredFactor
    ? clampRatio(
      measuredRequiredFactors.reduce((sum, factor) => sum + factor.score, 0)
      / REQUIRED_FACTOR_IDS.length
    )
    : null;

  return createResult({
    status: hasEveryRequiredFactor ? "measured" : "partial",
    score,
    factors,
    observations
  });
}

function createResult({
  status,
  score,
  factors,
  observations
}) {
  const measuredRequiredFactorCount = factors.filter(factor => (
    factor.includedInOverall && factor.status === "measured"
  )).length;

  return {
    type: "grid-confidence-diagnostics",
    status,
    score,
    scoreMeaning: SCORE_MEANING,
    coverage: {
      requiredFactorCount: REQUIRED_FACTOR_IDS.length,
      measuredRequiredFactorCount,
      ratio: measuredRequiredFactorCount / REQUIRED_FACTOR_IDS.length
    },
    factors,
    observations
  };
}

function createGeometryIntegrityFactor(geometry) {
  if (!hasGeometryFields(geometry)) {
    return createUnavailableFactor(
      "geometry-integrity",
      true,
      "required-geometry-fields-unavailable"
    );
  }

  const {
    horizontalLines,
    verticalLines,
    rows,
    cols,
    bounds
  } = geometry;
  const checks = [
    createCheck(
      "horizontal-lines-increasing",
      areFiniteStrictlyIncreasingLines(horizontalLines)
    ),
    createCheck(
      "vertical-lines-increasing",
      areFiniteStrictlyIncreasingLines(verticalLines)
    ),
    createCheck(
      "row-count-agreement",
      Number.isInteger(rows) && rows > 0 && rows === horizontalLines.length - 1
    ),
    createCheck(
      "column-count-agreement",
      Number.isInteger(cols) && cols > 0 && cols === verticalLines.length - 1
    ),
    createCheck(
      "positive-bounds",
      hasFinitePositiveBounds(bounds)
    ),
    createCheck(
      "horizontal-bounds-agreement",
      boundsAgree(
        bounds.top,
        bounds.top + bounds.height,
        horizontalLines[0],
        horizontalLines[horizontalLines.length - 1]
      )
    ),
    createCheck(
      "vertical-bounds-agreement",
      boundsAgree(
        bounds.left,
        bounds.left + bounds.width,
        verticalLines[0],
        verticalLines[verticalLines.length - 1]
      )
    )
  ];
  const passedCheckCount = checks.filter(check => check.passed).length;

  return {
    id: "geometry-integrity",
    status: "measured",
    score: passedCheckCount / checks.length,
    includedInOverall: true,
    measurements: {
      passedCheckCount,
      totalCheckCount: checks.length,
      checks
    }
  };
}

function createSpacingConsistencyFactor(diagnostics) {
  const resolved = resolveAxisDiagnostics(diagnostics, "spacing-consistency");

  if (!resolved.available) {
    return createUnavailableFactor(
      "spacing-consistency",
      true,
      resolved.reason
    );
  }

  const horizontal = resolved.horizontal;
  const vertical = resolved.vertical;

  if (
    horizontal.status !== "measured"
    || vertical.status !== "measured"
    || !Number.isFinite(horizontal.consistency)
    || !Number.isFinite(vertical.consistency)
  ) {
    return createUnavailableFactor(
      "spacing-consistency",
      true,
      "measured-spacing-consistency-unavailable"
    );
  }

  const horizontalConsistency = clampRatio(horizontal.consistency);
  const verticalConsistency = clampRatio(vertical.consistency);

  return {
    id: "spacing-consistency",
    status: "measured",
    score: Math.sqrt(horizontalConsistency * verticalConsistency),
    includedInOverall: true,
    measurements: {
      horizontal: horizontalConsistency,
      vertical: verticalConsistency,
      combination: "geometric-mean"
    }
  };
}

function createCellAspectObservationFactor(diagnostics) {
  const resolved = resolveAxisDiagnostics(diagnostics, "spacing-consistency");

  if (!resolved.available) {
    return createUnavailableFactor(
      "cell-aspect-observation",
      true,
      resolved.reason
    );
  }

  const horizontalAverage = resolved.horizontal.average;
  const verticalAverage = resolved.vertical.average;

  if (
    resolved.horizontal.status !== "measured"
    || resolved.vertical.status !== "measured"
    || !Number.isFinite(horizontalAverage)
    || !Number.isFinite(verticalAverage)
    || horizontalAverage <= 0
    || verticalAverage <= 0
  ) {
    return createUnavailableFactor(
      "cell-aspect-observation",
      true,
      "positive-average-spacing-unavailable"
    );
  }

  const ratio = Math.min(horizontalAverage, verticalAverage)
    / Math.max(horizontalAverage, verticalAverage);

  return {
    id: "cell-aspect-observation",
    status: "measured",
    score: ratio,
    includedInOverall: true,
    measurements: {
      horizontalAverageSpacing: horizontalAverage,
      verticalAverageSpacing: verticalAverage,
      ratio
    }
  };
}

function createCandidateSelectivityFactor(diagnostics) {
  const resolved = resolveAxisDiagnostics(diagnostics, "candidate-counts");

  if (!resolved.available) {
    return createUnavailableFactor(
      "candidate-selectivity",
      false,
      resolved.reason
    );
  }

  if (
    !hasValidCandidateCounts(resolved.horizontal)
    || !hasValidCandidateCounts(resolved.vertical)
  ) {
    return createUnavailableFactor(
      "candidate-selectivity",
      false,
      "valid-candidate-counts-unavailable"
    );
  }

  const horizontalRatio = clampRatio(
    resolved.horizontal.acceptedCount / resolved.horizontal.totalCount
  );
  const verticalRatio = clampRatio(
    resolved.vertical.acceptedCount / resolved.vertical.totalCount
  );

  return {
    id: "candidate-selectivity",
    status: "measured",
    score: Math.sqrt(horizontalRatio * verticalRatio),
    includedInOverall: false,
    measurements: {
      horizontal: createCandidateMeasurements(resolved.horizontal, horizontalRatio),
      vertical: createCandidateMeasurements(resolved.vertical, verticalRatio),
      combination: "geometric-mean"
    }
  };
}

function createCandidateMeasurements(diagnostic, acceptedRatio) {
  return {
    acceptedCount: diagnostic.acceptedCount,
    rejectedCount: diagnostic.rejectedCount,
    totalCount: diagnostic.totalCount,
    acceptedRatio
  };
}

function createUnavailableFactor(id, includedInOverall, reason) {
  return {
    id,
    status: "unavailable",
    score: null,
    includedInOverall,
    reason,
    measurements: null
  };
}

function createObservations(gridDetection, diagnostics) {
  const geometry = gridDetection?.geometry;

  return {
    productionConfidence: hasOwn(gridDetection, "confidence")
      ? gridDetection.confidence
      : null,
    acceptance: resolveAcceptance(diagnostics),
    rejectionReasons: resolveRejectionReasons(diagnostics),
    geometry: geometry
      ? {
        rows: geometry.rows,
        cols: geometry.cols,
        bounds: cloneValue(geometry.bounds),
        horizontalLineCount: Array.isArray(geometry.horizontalLines)
          ? geometry.horizontalLines.length
          : null,
        verticalLineCount: Array.isArray(geometry.verticalLines)
          ? geometry.verticalLines.length
          : null
      }
      : null,
    preRejectionBounds: resolvePreRejectionBounds(diagnostics)
  };
}

function resolveAxisDiagnostics(diagnostics, type) {
  const horizontalMatches = diagnostics.filter(diagnostic => (
    diagnostic?.type === type && diagnostic.axis === "horizontal"
  ));
  const verticalMatches = diagnostics.filter(diagnostic => (
    diagnostic?.type === type && diagnostic.axis === "vertical"
  ));

  if (horizontalMatches.length !== 1) {
    return {
      available: false,
      reason: horizontalMatches.length === 0
        ? `horizontal-${type}-diagnostic-unavailable`
        : `horizontal-${type}-diagnostic-ambiguous`
    };
  }

  if (verticalMatches.length !== 1) {
    return {
      available: false,
      reason: verticalMatches.length === 0
        ? `vertical-${type}-diagnostic-unavailable`
        : `vertical-${type}-diagnostic-ambiguous`
    };
  }

  return {
    available: true,
    horizontal: horizontalMatches[0],
    vertical: verticalMatches[0]
  };
}

function resolveAcceptance(diagnostics) {
  const matches = diagnostics.filter(diagnostic => (
    diagnostic?.type === "acceptance-status"
    && typeof diagnostic.accepted === "boolean"
  ));

  return matches.length === 1 ? matches[0].accepted : null;
}

function resolveRejectionReasons(diagnostics) {
  const reasons = [];

  for (const diagnostic of diagnostics) {
    if (diagnostic?.type === "rejection-reasons" && Array.isArray(diagnostic.reasons)) {
      reasons.push(...diagnostic.reasons.map(cloneValue));
    }

    if (diagnostic?.type === "rejection-reason") {
      const reason = cloneValue(diagnostic);
      delete reason.type;
      reasons.push(reason);
    }
  }

  return reasons;
}

function resolvePreRejectionBounds(diagnostics) {
  const matches = diagnostics.filter(diagnostic => (
    diagnostic?.type === "pre-rejection-bounds"
  ));

  return matches.length === 1 ? cloneValue(matches[0].bounds) : null;
}

function hasGeometryFields(geometry) {
  return Array.isArray(geometry?.horizontalLines)
    && Array.isArray(geometry?.verticalLines)
    && hasOwn(geometry, "rows")
    && hasOwn(geometry, "cols")
    && geometry.bounds !== null
    && typeof geometry.bounds === "object"
    && hasOwn(geometry.bounds, "top")
    && hasOwn(geometry.bounds, "left")
    && hasOwn(geometry.bounds, "width")
    && hasOwn(geometry.bounds, "height");
}

function areFiniteStrictlyIncreasingLines(lines) {
  if (lines.length < 2 || !lines.every(Number.isFinite)) {
    return false;
  }

  for (let index = 1; index < lines.length; index++) {
    if (lines[index] <= lines[index - 1]) {
      return false;
    }
  }

  return true;
}

function hasFinitePositiveBounds(bounds) {
  return Number.isFinite(bounds.top)
    && Number.isFinite(bounds.left)
    && Number.isFinite(bounds.width)
    && Number.isFinite(bounds.height)
    && bounds.width > 0
    && bounds.height > 0;
}

function boundsAgree(boundsStart, boundsEnd, lineStart, lineEnd) {
  return approximatelyEqual(boundsStart, lineStart)
    && approximatelyEqual(boundsEnd, lineEnd);
}

function approximatelyEqual(first, second) {
  if (!Number.isFinite(first) || !Number.isFinite(second)) {
    return false;
  }

  const tolerance = Math.max(
    1e-6,
    Math.max(Math.abs(first), Math.abs(second)) * 1e-9
  );

  return Math.abs(first - second) <= tolerance;
}

function hasValidCandidateCounts(diagnostic) {
  return Number.isInteger(diagnostic.acceptedCount)
    && diagnostic.acceptedCount >= 0
    && Number.isInteger(diagnostic.rejectedCount)
    && diagnostic.rejectedCount >= 0
    && Number.isInteger(diagnostic.totalCount)
    && diagnostic.totalCount > 0
    && diagnostic.acceptedCount + diagnostic.rejectedCount === diagnostic.totalCount;
}

function createCheck(id, passed) {
  return {
    id,
    passed
  };
}

function clampRatio(value) {
  return Math.max(0, Math.min(1, value));
}

function hasOwn(value, key) {
  return value !== null
    && typeof value === "object"
    && Object.prototype.hasOwnProperty.call(value, key);
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, cloneValue(nestedValue)])
    );
  }

  return value;
}
