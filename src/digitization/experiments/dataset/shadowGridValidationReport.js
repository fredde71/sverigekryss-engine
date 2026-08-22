const REPORT_VERSION = 1;
const SHADOW_GRID_EXPERIMENT_ID = "shadow-grid-analysis-diagnostics";
const RUNTIME_FIELDS = new Set([
  "binaryImage",
  "imageData",
  "canvas",
  "source",
  "projection",
  "projections",
  "lineCandidates"
]);

export function createShadowGridValidationReport({
  datasetReport,
  groundTruth
} = {}) {
  validateInputs(datasetReport, groundTruth);

  const annotationsByItemId = new Map(
    groundTruth.annotations.map(annotation => [annotation.itemId, annotation])
  );
  const datasetItemIds = new Set(datasetReport.items.map(item => item.id));
  const items = datasetReport.items.map(item => createItemValidation({
    item,
    annotation: annotationsByItemId.get(item.id) ?? null
  }));
  const unmatchedAnnotations = groundTruth.annotations
    .filter(annotation => !datasetItemIds.has(annotation.itemId))
    .map(annotation => ({
      itemId: annotation.itemId,
      filename: annotation.filename,
      reason: "dataset-item-not-found"
    }));
  const comparedItemCount = items.filter(item => item.status === "compared").length;
  const partialItemCount = items.filter(item => item.status === "partial").length;

  return {
    type: "shadow-grid-validation-report",
    version: REPORT_VERSION,
    datasetId: datasetReport.datasetRun.datasetId,
    status: "complete",
    comparisonPolicy: {
      equality: "exact-numeric-equality",
      coordinateDelta: "observed-minus-expected",
      tolerancePx: null,
      nearestObservation: "independent-nearest-neighbor",
      nearestTieBreak: "lowest-source-index",
      interpretation: "none"
    },
    inventory: {
      totalDatasetItemCount: items.length,
      annotatedItemCount: items.filter(item => (
        item.observations.groundTruth.status === "available"
      )).length,
      comparedItemCount,
      partialItemCount,
      unavailableItemCount: items.length - comparedItemCount - partialItemCount,
      unmatchedAnnotationCount: unmatchedAnnotations.length
    },
    items,
    unmatchedAnnotations
  };
}

function createItemValidation({ item, annotation }) {
  const filename = typeof item?.metadata?.filename === "string"
    ? item.metadata.filename
    : null;
  const shadowResult = extractShadowGridResult(item);
  const observations = {
    groundTruth: annotation
      ? {
        status: "available",
        value: cloneCompact(annotation)
      }
      : {
        status: "unavailable",
        value: null,
        reason: "ground-truth-annotation-unavailable"
      },
    shadowGrid: shadowResult.status === "available"
      ? {
        status: "available",
        providers: cloneCompact(shadowResult.providers)
      }
      : {
        status: "unavailable",
        providers: [],
        reason: shadowResult.reason
      }
  };
  const base = {
    itemId: item?.id,
    filename,
    status: "unavailable",
    reasons: [],
    observations,
    comparisons: []
  };

  if (!annotation) {
    base.reasons.push("ground-truth-annotation-unavailable");
    return base;
  }

  if (filename === null) {
    base.reasons.push("dataset-filename-unavailable");
    return base;
  }

  if (filename !== annotation.filename) {
    base.reasons.push("filename-mismatch");
    return base;
  }

  if (shadowResult.status !== "available") {
    base.reasons.push(shadowResult.reason);
    return base;
  }

  for (const provider of shadowResult.providers) {
    if (provider?.status !== "available") {
      base.reasons.push(createProviderReason(provider));
      continue;
    }

    const gridAnalyses = Array.isArray(provider.gridAnalyses)
      ? provider.gridAnalyses
      : [];

    for (const gridAnalysis of gridAnalyses) {
      base.comparisons.push(createRegionComparison({
        provider,
        gridAnalysis,
        annotation
      }));
    }
  }

  const completedCount = base.comparisons.filter(comparison => (
    comparison.status === "compared" || comparison.status === "partial"
  )).length;

  if (completedCount === 0) {
    base.reasons.push("shadow-grid-comparison-unavailable");
    return base;
  }

  const hasUnavailable = base.comparisons.some(comparison => (
    comparison.status !== "compared"
  )) || base.reasons.length > 0;

  base.status = hasUnavailable ? "partial" : "compared";
  return base;
}

function extractShadowGridResult(item) {
  if (item?.comparison?.status !== "completed") {
    return {
      status: "unavailable",
      providers: [],
      reason: `dataset-comparison-${item?.comparison?.status || "unavailable"}`
    };
  }

  const experiments = item.comparison.result?.benchmark?.experiments;

  if (!Array.isArray(experiments)) {
    return {
      status: "unavailable",
      providers: [],
      reason: "benchmark-experiments-unavailable"
    };
  }

  const experiment = experiments.find(candidate => (
    candidate?.id === SHADOW_GRID_EXPERIMENT_ID
  ));

  if (!experiment) {
    return {
      status: "unavailable",
      providers: [],
      reason: "shadow-grid-analysis-experiment-unavailable"
    };
  }

  if (experiment.success !== true) {
    return {
      status: "unavailable",
      providers: [],
      reason: "shadow-grid-analysis-experiment-failed"
    };
  }

  if (!Array.isArray(experiment.diagnostics?.providers)) {
    return {
      status: "unavailable",
      providers: [],
      reason: "shadow-grid-analysis-providers-unavailable"
    };
  }

  return {
    status: "available",
    providers: experiment.diagnostics.providers
  };
}

function createRegionComparison({
  provider,
  gridAnalysis,
  annotation
}) {
  const identity = {
    providerId: provider.id,
    regionId: gridAnalysis?.regionId
  };

  if (gridAnalysis?.status === "failed") {
    return {
      ...identity,
      status: "unavailable",
      reason: normalizeFailureReason(gridAnalysis.error),
      normalizedObservation: null,
      bounds: createUnavailableComparison("shadow-grid-analysis-failed"),
      horizontalLines: createUnavailableComparison("shadow-grid-analysis-failed"),
      verticalLines: createUnavailableComparison("shadow-grid-analysis-failed"),
      rows: createUnavailableComparison("shadow-grid-analysis-failed"),
      cols: createUnavailableComparison("shadow-grid-analysis-failed")
    };
  }

  const normalized = normalizeRegionObservation(gridAnalysis);

  if (normalized.status === "unavailable") {
    return {
      ...identity,
      status: "unavailable",
      reason: normalized.reason,
      normalizedObservation: null,
      bounds: createUnavailableComparison(normalized.reason),
      horizontalLines: createUnavailableComparison(normalized.reason),
      verticalLines: createUnavailableComparison(normalized.reason),
      rows: createUnavailableComparison(normalized.reason),
      cols: createUnavailableComparison(normalized.reason)
    };
  }

  const horizontalLines = Array.isArray(normalized.value.candidatePositions.horizontal)
    ? compareLinePositions(
      annotation.horizontalLinePositions,
      normalized.value.candidatePositions.horizontal
    )
    : createUnavailableComparison("horizontal-candidate-positions-unavailable");
  const verticalLines = Array.isArray(normalized.value.candidatePositions.vertical)
    ? compareLinePositions(
      annotation.verticalLinePositions,
      normalized.value.candidatePositions.vertical
    )
    : createUnavailableComparison("vertical-candidate-positions-unavailable");
  const geometry = normalized.value.geometry;
  const geometryAvailable = geometry?.status === "available";
  const linesAvailable = horizontalLines.status === "compared"
    && verticalLines.status === "compared";
  const fullyComparable = geometryAvailable && linesAvailable;

  return {
    ...identity,
    status: fullyComparable ? "compared" : "partial",
    reason: fullyComparable
      ? null
      : !geometryAvailable
        ? "shadow-geometry-unavailable"
        : "shadow-candidate-positions-unavailable",
    normalizedObservation: normalized.value,
    bounds: geometryAvailable
      ? compareBounds(annotation.gridBounds, geometry.bounds)
      : createUnavailableComparison("shadow-geometry-unavailable"),
    horizontalLines,
    verticalLines,
    rows: geometryAvailable
      ? compareScalar(annotation.rows, geometry.rows)
      : createUnavailableComparison("shadow-geometry-unavailable"),
    cols: geometryAvailable
      ? compareScalar(annotation.cols, geometry.cols)
      : createUnavailableComparison("shadow-geometry-unavailable")
  };
}

function normalizeRegionObservation(gridAnalysis) {
  const regionBounds = gridAnalysis?.regionBounds;

  if (
    !regionBounds
    || !Number.isFinite(regionBounds.top)
    || !Number.isFinite(regionBounds.left)
  ) {
    return {
      status: "unavailable",
      reason: "region-coordinate-offset-unavailable",
      value: null
    };
  }

  const horizontal = Array.isArray(gridAnalysis?.candidatePositions?.horizontal)
    ? gridAnalysis.candidatePositions.horizontal.map(position => (
      position + regionBounds.top
    ))
    : null;
  const vertical = Array.isArray(gridAnalysis?.candidatePositions?.vertical)
    ? gridAnalysis.candidatePositions.vertical.map(position => (
      position + regionBounds.left
    ))
    : null;
  const geometry = gridAnalysis?.geometry;

  return {
    status: "available",
    value: {
      coordinateSpace: "rendered-binary-image-pixels",
      candidatePositions: {
        horizontal,
        vertical
      },
      geometry: geometry?.status === "available" && geometry.bounds
        ? {
          status: "available",
          rows: geometry.rows,
          cols: geometry.cols,
          bounds: {
            top: geometry.bounds.top + regionBounds.top,
            left: geometry.bounds.left + regionBounds.left,
            width: geometry.bounds.width,
            height: geometry.bounds.height
          }
        }
        : {
          status: "unavailable",
          rows: null,
          cols: null,
          bounds: null,
          rejectionReasons: cloneCompact(gridAnalysis?.rejectionReasons ?? [])
        }
    }
  };
}

export function compareLinePositions(expected, observed) {
  const usedObservedIndices = new Set();
  const exactMatches = [];
  const missingExpected = [];

  expected.forEach((position, expectedIndex) => {
    const observedIndex = observed.findIndex((candidate, index) => (
      !usedObservedIndices.has(index) && candidate === position
    ));

    if (observedIndex === -1) {
      missingExpected.push({ expectedIndex, position });
      return;
    }

    usedObservedIndices.add(observedIndex);
    exactMatches.push({ expectedIndex, observedIndex, position });
  });

  const extraObserved = observed.flatMap((position, observedIndex) => (
    usedObservedIndices.has(observedIndex)
      ? []
      : [{ observedIndex, position }]
  ));

  return {
    status: "compared",
    equality: "exact-numeric-equality",
    exact: missingExpected.length === 0 && extraObserved.length === 0,
    exactMatches,
    missingExpected,
    extraObserved,
    nearestObservedByExpected: expected.map((expectedPosition, expectedIndex) => {
      const nearest = findNearest(expectedPosition, observed);

      return {
        expectedIndex,
        expectedPosition,
        observedIndex: nearest.index,
        observedPosition: nearest.value,
        delta: nearest.value === null ? null : nearest.value - expectedPosition
      };
    }),
    nearestExpectedByObserved: observed.map((observedPosition, observedIndex) => {
      const nearest = findNearest(observedPosition, expected);

      return {
        observedIndex,
        observedPosition,
        expectedIndex: nearest.index,
        expectedPosition: nearest.value,
        delta: nearest.value === null ? null : observedPosition - nearest.value
      };
    })
  };
}

function findNearest(position, candidates) {
  let nearestIndex = null;
  let nearestValue = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  candidates.forEach((candidate, index) => {
    const distance = Math.abs(candidate - position);

    if (distance < nearestDistance) {
      nearestIndex = index;
      nearestValue = candidate;
      nearestDistance = distance;
    }
  });

  return {
    index: nearestIndex,
    value: nearestValue
  };
}

export function compareBounds(expected, observed) {
  const components = ["top", "left", "width", "height"].map(name => ({
    name,
    expected: expected[name],
    observed: observed?.[name] ?? null,
    delta: Number.isFinite(observed?.[name])
      ? observed[name] - expected[name]
      : null,
    exact: observed?.[name] === expected[name]
  }));

  return {
    status: "compared",
    equality: "exact-numeric-equality",
    exact: components.every(component => component.exact),
    components
  };
}

export function compareScalar(expected, observed) {
  return {
    status: "compared",
    equality: "exact-numeric-equality",
    expected,
    observed: Number.isFinite(observed) ? observed : null,
    delta: Number.isFinite(observed) ? observed - expected : null,
    exact: observed === expected
  };
}

export function createUnavailableComparison(reason) {
  return {
    status: "unavailable",
    reason
  };
}

function createProviderReason(provider) {
  const suffix = typeof provider?.reason === "string"
    ? provider.reason
    : provider?.status || "unavailable";

  return `provider.${provider?.id || "unknown"}.${suffix}`;
}

function normalizeFailureReason(error) {
  if (typeof error?.message === "string") {
    return error.message;
  }

  return "shadow-grid-analysis-failed";
}

function validateInputs(datasetReport, groundTruth) {
  if (
    !datasetReport
    || datasetReport.type !== "digitization-dataset-report"
    || datasetReport.version !== 1
    || !Array.isArray(datasetReport.items)
  ) {
    throw new Error("Version 1 digitization dataset report is required");
  }

  if (
    !groundTruth
    || groundTruth.type !== "digitization-grid-ground-truth"
    || groundTruth.version !== 1
    || !Array.isArray(groundTruth.annotations)
  ) {
    throw new Error("Version 1 digitization grid ground truth is required");
  }

  if (datasetReport.datasetRun?.datasetId !== groundTruth.datasetId) {
    throw new Error("Dataset report and ground truth datasetId must match exactly");
  }
}

function cloneCompact(value) {
  if (Array.isArray(value)) {
    return value.map(cloneCompact);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  if (ArrayBuffer.isView(value)) {
    return undefined;
  }

  const clone = {};

  for (const key of Object.keys(value)) {
    if (RUNTIME_FIELDS.has(key)) {
      continue;
    }

    const nested = cloneCompact(value[key]);

    if (nested !== undefined) {
      clone[key] = nested;
    }
  }

  return clone;
}
