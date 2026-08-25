import {
  createShadowGridValidationReport
} from "./shadowGridValidationReport";

const REPORT_VERSION = 1;

export function createGridLatticeGeometryDiagnostics({
  datasetReport,
  groundTruth
} = {}) {
  const shadowValidation = createShadowGridValidationReport({
    datasetReport,
    groundTruth
  });
  const items = shadowValidation.items.map(createItemDiagnostics);
  const lattices = items.flatMap(item => item.lattices);

  return deepFreeze({
    type: "grid-lattice-geometry-diagnostics",
    version: REPORT_VERSION,
    datasetId: shadowValidation.datasetId,
    status: "complete",
    observationPolicy: {
      equality: "exact-numeric-equality",
      coordinateSpace: "rendered-binary-image-pixels",
      coordinateDelta: "observed-minus-ground-truth",
      spacing: "adjacent-line-position-difference",
      spacingConsistency: "all-adjacent-spacings-exactly-equal",
      latticeCompleteness:
        "no-missing-or-extra-observed-lines-relative-to-ground-truth",
      interpolation: "none",
      snapping: "none",
      interpretation: "validation-observation-only"
    },
    inventory: {
      totalDatasetItemCount: items.length,
      annotatedItemCount: items.filter(item => (
        item.groundTruthStatus === "available"
      )).length,
      latticeObservationCount: lattices.length,
      comparedLatticeCount: lattices.filter(lattice => (
        lattice.status === "compared"
      )).length,
      partialLatticeCount: lattices.filter(lattice => (
        lattice.status === "partial"
      )).length,
      unavailableLatticeCount: lattices.filter(lattice => (
        lattice.status === "unavailable"
      )).length,
      unmatchedAnnotationCount: shadowValidation.unmatchedAnnotations.length
    },
    items,
    unmatchedAnnotations: cloneValue(shadowValidation.unmatchedAnnotations)
  });
}

function createItemDiagnostics(item) {
  const annotation = item.observations.groundTruth.value;
  const lattices = item.comparisons.map(comparison => (
    createLatticeDiagnostics({ comparison, annotation })
  ));

  return {
    itemId: item.itemId,
    filename: item.filename,
    status: lattices.length === 0
      ? "unavailable"
      : lattices.every(lattice => lattice.status === "compared")
        && item.reasons.length === 0
        ? "compared"
        : "partial",
    reasons: cloneValue(item.reasons),
    groundTruthStatus: item.observations.groundTruth.status,
    shadowGridStatus: item.observations.shadowGrid.status,
    lattices
  };
}

function createLatticeDiagnostics({ comparison, annotation }) {
  const normalized = comparison.normalizedObservation;

  if (!normalized || !annotation) {
    return {
      providerId: comparison.providerId,
      regionId: comparison.regionId,
      status: "unavailable",
      reason: comparison.reason || "lattice-observation-unavailable",
      coordinateSpace: null,
      horizontalLattice: createUnavailableAxis("horizontal-lattice-unavailable"),
      verticalLattice: createUnavailableAxis("vertical-lattice-unavailable"),
      gridLattice: createUnavailableGrid("grid-lattice-unavailable")
    };
  }

  const horizontal = createAxisDiagnostics({
    axis: "horizontal",
    observedPositions: normalized.candidatePositions.horizontal,
    groundTruthPositions: annotation.horizontalLinePositions,
    lineComparison: comparison.horizontalLines
  });
  const vertical = createAxisDiagnostics({
    axis: "vertical",
    observedPositions: normalized.candidatePositions.vertical,
    groundTruthPositions: annotation.verticalLinePositions,
    lineComparison: comparison.verticalLines
  });
  const grid = createGridDiagnostics({
    horizontal,
    vertical,
    annotation
  });
  const bothAxesCompared = horizontal.status === "compared"
    && vertical.status === "compared";

  return {
    providerId: comparison.providerId,
    regionId: comparison.regionId,
    status: bothAxesCompared ? "compared" : "partial",
    reason: bothAxesCompared ? null : "one-or-more-lattice-axes-unavailable",
    coordinateSpace: normalized.coordinateSpace,
    sourceGeometry: cloneValue(normalized.geometry),
    horizontalLattice: horizontal,
    verticalLattice: vertical,
    gridLattice: grid
  };
}

function createAxisDiagnostics({
  axis,
  observedPositions,
  groundTruthPositions,
  lineComparison
}) {
  if (!Array.isArray(observedPositions) || lineComparison?.status !== "compared") {
    return createUnavailableAxis(`${axis}-line-positions-unavailable`);
  }

  const observed = observedPositions.slice();
  const expected = groundTruthPositions.slice();
  const observedSpacings = createAdjacentSpacings(observed);
  const groundTruthSpacings = createAdjacentSpacings(expected);
  const observedSpacingValues = observedSpacings.map(entry => entry.spacing);
  const groundTruthSpacingValues = groundTruthSpacings.map(entry => entry.spacing);

  return {
    axis,
    status: "compared",
    observedLinePositions: observed,
    lineCount: observed.length,
    adjacentSpacings: observedSpacings,
    spacingStatistics: createSpacingStatistics(observedSpacingValues),
    relationToGroundTruth: {
      status: "compared",
      groundTruthLinePositions: expected,
      groundTruthLineCount: expected.length,
      lineCountDelta: observed.length - expected.length,
      exactLinePositions: lineComparison.exact,
      exactMatches: cloneValue(lineComparison.exactMatches),
      missingObservedLines: cloneValue(lineComparison.missingExpected),
      extraObservedLines: cloneValue(lineComparison.extraObserved),
      nearestObservedByGroundTruth: cloneValue(
        lineComparison.nearestObservedByExpected
      ),
      nearestGroundTruthByObserved: cloneValue(
        lineComparison.nearestExpectedByObserved
      ),
      groundTruthAdjacentSpacings: groundTruthSpacings,
      exactAdjacentSpacings: arraysEqual(
        observedSpacingValues,
        groundTruthSpacingValues
      )
    }
  };
}

function createGridDiagnostics({ horizontal, vertical, annotation }) {
  if (horizontal.status !== "compared" || vertical.status !== "compared") {
    return createUnavailableGrid("one-or-more-lattice-axes-unavailable");
  }

  const observedRows = Math.max(0, horizontal.lineCount - 1);
  const observedCols = Math.max(0, vertical.lineCount - 1);
  const horizontalExact = horizontal.relationToGroundTruth.exactLinePositions;
  const verticalExact = vertical.relationToGroundTruth.exactLinePositions;

  return {
    status: "compared",
    rowCount: createCountComparison(observedRows, annotation.rows),
    columnCount: createCountComparison(observedCols, annotation.cols),
    latticeCompleteness: {
      status: "compared",
      complete: horizontalExact && verticalExact,
      horizontalComplete: horizontalExact,
      verticalComplete: verticalExact
    },
    missingObservedLines: {
      horizontal: cloneValue(
        horizontal.relationToGroundTruth.missingObservedLines
      ),
      vertical: cloneValue(vertical.relationToGroundTruth.missingObservedLines)
    },
    extraObservedLines: {
      horizontal: cloneValue(
        horizontal.relationToGroundTruth.extraObservedLines
      ),
      vertical: cloneValue(vertical.relationToGroundTruth.extraObservedLines)
    },
    spacingConsistency: {
      status: "observed",
      horizontalAdjacentSpacingsEqual:
        horizontal.spacingStatistics.allEqual,
      verticalAdjacentSpacingsEqual: vertical.spacingStatistics.allEqual,
      bothAxesInternallyConsistent:
        horizontal.spacingStatistics.allEqual
        && vertical.spacingStatistics.allEqual,
      horizontalSpacingsMatchGroundTruth:
        horizontal.relationToGroundTruth.exactAdjacentSpacings,
      verticalSpacingsMatchGroundTruth:
        vertical.relationToGroundTruth.exactAdjacentSpacings
    },
    edgeConsistency: {
      status: "compared",
      top: compareEdge(
        firstOrNull(horizontal.observedLinePositions),
        firstOrNull(annotation.horizontalLinePositions)
      ),
      bottom: compareEdge(
        lastOrNull(horizontal.observedLinePositions),
        lastOrNull(annotation.horizontalLinePositions)
      ),
      left: compareEdge(
        firstOrNull(vertical.observedLinePositions),
        firstOrNull(annotation.verticalLinePositions)
      ),
      right: compareEdge(
        lastOrNull(vertical.observedLinePositions),
        lastOrNull(annotation.verticalLinePositions)
      )
    }
  };
}

function createAdjacentSpacings(positions) {
  const spacings = [];

  for (let index = 1; index < positions.length; index++) {
    spacings.push({
      fromLineIndex: index - 1,
      toLineIndex: index,
      fromPosition: positions[index - 1],
      toPosition: positions[index],
      spacing: positions[index] - positions[index - 1]
    });
  }

  return spacings;
}

function createSpacingStatistics(spacings) {
  if (spacings.length === 0) {
    return {
      status: "unavailable",
      count: 0,
      minimum: null,
      maximum: null,
      mean: null,
      median: null,
      range: null,
      allEqual: null,
      reason: "adjacent-spacing-unavailable"
    };
  }

  const sorted = spacings.slice().sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
  const minimum = sorted[0];
  const maximum = sorted[sorted.length - 1];

  return {
    status: "observed",
    count: spacings.length,
    minimum,
    maximum,
    mean: spacings.reduce((sum, spacing) => sum + spacing, 0)
      / spacings.length,
    median,
    range: maximum - minimum,
    allEqual: spacings.every(spacing => spacing === spacings[0]),
    reason: null
  };
}

function createCountComparison(observed, groundTruth) {
  return {
    status: "compared",
    observed,
    groundTruth,
    delta: observed - groundTruth,
    exact: observed === groundTruth,
    derivation: "observed-line-count-minus-one"
  };
}

function compareEdge(observed, groundTruth) {
  if (!Number.isFinite(observed) || !Number.isFinite(groundTruth)) {
    return {
      status: "unavailable",
      observed: Number.isFinite(observed) ? observed : null,
      groundTruth: Number.isFinite(groundTruth) ? groundTruth : null,
      delta: null,
      absoluteDelta: null,
      exact: null,
      reason: "edge-position-unavailable"
    };
  }

  const delta = observed - groundTruth;

  return {
    status: "compared",
    observed,
    groundTruth,
    delta,
    absoluteDelta: Math.abs(delta),
    exact: delta === 0,
    reason: null
  };
}

function createUnavailableAxis(reason) {
  return {
    axis: null,
    status: "unavailable",
    observedLinePositions: [],
    lineCount: null,
    adjacentSpacings: [],
    spacingStatistics: {
      status: "unavailable",
      count: 0,
      minimum: null,
      maximum: null,
      mean: null,
      median: null,
      range: null,
      allEqual: null,
      reason
    },
    relationToGroundTruth: {
      status: "unavailable",
      reason
    }
  };
}

function createUnavailableGrid(reason) {
  return {
    status: "unavailable",
    reason,
    rowCount: null,
    columnCount: null,
    latticeCompleteness: null,
    missingObservedLines: null,
    extraObservedLines: null,
    spacingConsistency: null,
    edgeConsistency: null
  };
}

function arraysEqual(first, second) {
  return first.length === second.length
    && first.every((value, index) => value === second[index]);
}

function firstOrNull(values) {
  return values.length > 0 ? values[0] : null;
}

function lastOrNull(values) {
  return values.length > 0 ? values[values.length - 1] : null;
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const clone = {};

  for (const key of Object.keys(value)) {
    clone[key] = cloneValue(value[key]);
  }

  return clone;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
