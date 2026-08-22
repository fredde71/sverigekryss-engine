import {
  compareBounds,
  compareLinePositions,
  compareScalar,
  createUnavailableComparison
} from "./shadowGridValidationReport";

const REPORT_VERSION = 1;
const RECONSTRUCTION_EXPERIMENT_ID =
  "shadow-grid-reconstruction-diagnostics";
const RUNTIME_FIELDS = new Set([
  "binaryImage",
  "imageData",
  "canvas",
  "source",
  "projection",
  "projections",
  "lineCandidates"
]);

export function createGridReconstructionValidationReport({
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
  const variants = items.flatMap(item => item.providers.flatMap(provider => (
    provider.regions.flatMap(region => region.variants)
  )));

  return deepFreeze({
    type: "grid-reconstruction-validation-report",
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
      reconstructionExperimentItemCount: items.filter(item => (
        item.observations.shadowGridReconstruction.status === "available"
      )).length,
      totalVariantCount: variants.length,
      comparedVariantCount: variants.filter(variant => (
        variant.status === "compared"
      )).length,
      exactVariantCount: variants.filter(variant => variant.exact === true).length,
      unavailableItemCount: items.filter(item => item.status === "unavailable").length,
      unmatchedAnnotationCount: unmatchedAnnotations.length
    },
    items,
    unmatchedAnnotations
  });
}

function createItemValidation({ item, annotation }) {
  const filename = typeof item?.metadata?.filename === "string"
    ? item.metadata.filename
    : null;
  const reconstructionResult = extractReconstructionResult(item);
  const base = {
    itemId: item?.id,
    filename,
    status: "unavailable",
    reasons: [],
    observations: {
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
      shadowGridReconstruction: reconstructionResult.status === "available"
        ? {
          status: "available",
          value: cloneCompact(reconstructionResult.diagnostics)
        }
        : {
          status: "unavailable",
          value: null,
          reason: reconstructionResult.reason
        }
    },
    providers: []
  };

  const comparisonUnavailableReason = !annotation
    ? "ground-truth-annotation-unavailable"
    : filename === null
      ? "dataset-filename-unavailable"
      : filename !== annotation.filename
        ? "filename-mismatch"
        : null;

  if (comparisonUnavailableReason) {
    base.reasons.push(comparisonUnavailableReason);
  }

  if (reconstructionResult.status !== "available") {
    base.reasons.push(reconstructionResult.reason);
    return base;
  }

  base.providers = reconstructionResult.diagnostics.providers.map(provider => (
    createProviderValidation(
      provider,
      annotation,
      comparisonUnavailableReason
    )
  ));

  const regions = base.providers.flatMap(provider => provider.regions);
  const variants = regions.flatMap(region => region.variants);

  if (variants.length === 0) {
    base.reasons.push("reconstruction-grid-variants-unavailable");
  }

  const hasUnavailable = base.providers.some(provider => (
    provider.status !== "available"
  )) || regions.some(region => region.status !== "compared");

  base.status = variants.length === 0 || comparisonUnavailableReason
    ? "unavailable"
    : hasUnavailable
      ? "partial"
      : "compared";
  return base;
}

function createProviderValidation(provider, annotation, comparisonUnavailableReason) {
  const result = {
    providerId: provider?.id,
    status: provider?.status === "available" ? "available" : "unavailable",
    providerStatus: provider?.status ?? null,
    reason: provider?.status === "available"
      ? null
      : normalizeReason(provider?.reason, "provider-unavailable"),
    regions: []
  };

  if (provider?.status !== "available") {
    return result;
  }

  const reconstructions = Array.isArray(provider.reconstructions)
    ? provider.reconstructions
    : [];

  result.regions = reconstructions.map(region => (
    createRegionValidation(
      provider.id,
      region,
      annotation,
      comparisonUnavailableReason
    )
  ));
  return result;
}

function createRegionValidation(
  providerId,
  region,
  annotation,
  comparisonUnavailableReason
) {
  const rawLocalReconstruction = cloneCompact(region?.reconstruction ?? null);
  const identity = {
    providerId,
    regionId: region?.regionId,
    executionStatus: region?.status ?? null,
    reconstructionStatus: region?.reconstructionStatus ?? null,
    coordinateProvenance: cloneCompact(region?.coordinateProvenance ?? null),
    rawLocalReconstruction,
    status: "unavailable",
    reason: null,
    variants: []
  };

  if (region?.status !== "completed") {
    identity.reason = normalizeReason(
      region?.error,
      "shadow-reconstruction-execution-failed"
    );
    return identity;
  }

  const reconstruction = region?.reconstruction;

  if (!reconstruction || !Array.isArray(reconstruction.gridHypotheses)) {
    identity.reason = "grid-reconstruction-unavailable";
    return identity;
  }

  if (reconstruction.gridHypotheses.length === 0) {
    identity.reason = `grid-reconstruction-${reconstruction.status || "unavailable"}`;
    return identity;
  }

  const coordinateSystem = reconstruction.coordinateSystem;

  if (!hasCoordinateTransform(coordinateSystem)) {
    identity.reason = "reconstruction-coordinate-system-unavailable";
    return identity;
  }

  identity.variants = reconstruction.gridHypotheses.map(hypothesis => (
    createVariantValidation({
      hypothesis,
      coordinateSystem,
      annotation,
      comparisonUnavailableReason
    })
  ));
  identity.status = comparisonUnavailableReason ? "unavailable" : "compared";
  identity.reason = comparisonUnavailableReason;
  return identity;
}

function createVariantValidation({
  hypothesis,
  coordinateSystem,
  annotation,
  comparisonUnavailableReason
}) {
  const normalized = normalizeGridHypothesis(hypothesis, coordinateSystem);

  if (comparisonUnavailableReason) {
    return {
      variantId: hypothesis.id,
      horizontalHypothesisId: hypothesis.horizontalHypothesisId,
      verticalHypothesisId: hypothesis.verticalHypothesisId,
      status: "unavailable",
      reason: comparisonUnavailableReason,
      rawLocalObservation: cloneCompact(hypothesis),
      normalizedComparisonInput: normalized,
      bounds: createUnavailableComparison(comparisonUnavailableReason),
      horizontalLines: createUnavailableComparison(comparisonUnavailableReason),
      verticalLines: createUnavailableComparison(comparisonUnavailableReason),
      rows: createUnavailableComparison(comparisonUnavailableReason),
      cols: createUnavailableComparison(comparisonUnavailableReason),
      exact: null,
      lineEvidenceInventory: {
        horizontal: createLineEvidenceInventory(normalized.horizontalLines),
        vertical: createLineEvidenceInventory(normalized.verticalLines)
      }
    };
  }

  const horizontalLines = compareLinePositions(
    annotation.horizontalLinePositions,
    normalized.horizontalLinePositions
  );
  const verticalLines = compareLinePositions(
    annotation.verticalLinePositions,
    normalized.verticalLinePositions
  );
  const bounds = compareBounds(annotation.gridBounds, normalized.bounds);
  const rows = compareScalar(annotation.rows, normalized.rows);
  const cols = compareScalar(annotation.cols, normalized.cols);

  return {
    variantId: hypothesis.id,
    horizontalHypothesisId: hypothesis.horizontalHypothesisId,
    verticalHypothesisId: hypothesis.verticalHypothesisId,
    status: "compared",
    rawLocalObservation: cloneCompact(hypothesis),
    normalizedComparisonInput: normalized,
    bounds,
    horizontalLines,
    verticalLines,
    rows,
    cols,
    exact: bounds.exact
      && horizontalLines.exact
      && verticalLines.exact
      && rows.exact
      && cols.exact,
    lineEvidenceInventory: {
      horizontal: createLineEvidenceInventory(normalized.horizontalLines),
      vertical: createLineEvidenceInventory(normalized.verticalLines)
    }
  };
}

function normalizeGridHypothesis(hypothesis, coordinateSystem) {
  const transform = coordinateSystem.localToBinaryImage;
  const horizontalLines = hypothesis.lines.horizontal.map(line => (
    normalizeLine(line, "horizontal", transform)
  ));
  const verticalLines = hypothesis.lines.vertical.map(line => (
    normalizeLine(line, "vertical", transform)
  ));

  return {
    coordinateSpace: "rendered-binary-image-pixels",
    coordinateTransform: cloneCompact(transform),
    bounds: {
      top: transform.offsetY + (hypothesis.bounds.top * transform.scaleY),
      left: transform.offsetX + (hypothesis.bounds.left * transform.scaleX),
      width: hypothesis.bounds.width * transform.scaleX,
      height: hypothesis.bounds.height * transform.scaleY
    },
    rows: hypothesis.rows,
    cols: hypothesis.cols,
    horizontalLinePositions: horizontalLines.map(line => line.position),
    verticalLinePositions: verticalLines.map(line => line.position),
    horizontalLines,
    verticalLines
  };
}

function normalizeLine(line, axis, transform) {
  const isHorizontal = axis === "horizontal";
  const offset = isHorizontal ? transform.offsetY : transform.offsetX;
  const scale = isHorizontal ? transform.scaleY : transform.scaleX;
  const evidence = cloneCompact(line.evidence);

  return {
    index: line.index,
    localPosition: line.position,
    position: offset + (line.position * scale),
    evidence,
    normalizedObservedPosition: Number.isFinite(line.evidence?.observedPosition)
      ? offset + (line.evidence.observedPosition * scale)
      : null
  };
}

function createLineEvidenceInventory(lines) {
  const observedAligned = [];
  const inferred = [];

  for (const line of lines) {
    const entry = {
      lineIndex: line.index,
      localPosition: line.localPosition,
      position: line.position,
      evidence: cloneCompact(line.evidence),
      normalizedObservedPosition: line.normalizedObservedPosition
    };

    if (line.evidence?.status === "observed-aligned") {
      observedAligned.push(entry);
    } else if (line.evidence?.status === "inferred") {
      inferred.push(entry);
    }
  }

  return {
    observedAlignedCount: observedAligned.length,
    inferredCount: inferred.length,
    observedAligned,
    inferred
  };
}

function extractReconstructionResult(item) {
  if (item?.comparison?.status !== "completed") {
    return {
      status: "unavailable",
      diagnostics: null,
      reason: `dataset-comparison-${item?.comparison?.status || "unavailable"}`
    };
  }

  const experiments = item.comparison.result?.benchmark?.experiments;

  if (!Array.isArray(experiments)) {
    return {
      status: "unavailable",
      diagnostics: null,
      reason: "benchmark-experiments-unavailable"
    };
  }

  const experiment = experiments.find(candidate => (
    candidate?.id === RECONSTRUCTION_EXPERIMENT_ID
  ));

  if (!experiment) {
    return {
      status: "unavailable",
      diagnostics: null,
      reason: "shadow-grid-reconstruction-experiment-unavailable"
    };
  }

  if (experiment.success !== true) {
    return {
      status: "unavailable",
      diagnostics: null,
      reason: "shadow-grid-reconstruction-experiment-failed"
    };
  }

  if (!Array.isArray(experiment.diagnostics?.providers)) {
    return {
      status: "unavailable",
      diagnostics: null,
      reason: "shadow-grid-reconstruction-providers-unavailable"
    };
  }

  return {
    status: "available",
    diagnostics: experiment.diagnostics,
    reason: null
  };
}

function hasCoordinateTransform(coordinateSystem) {
  const transform = coordinateSystem?.localToBinaryImage;

  return Boolean(transform)
    && Number.isFinite(transform.offsetX)
    && Number.isFinite(transform.offsetY)
    && Number.isFinite(transform.scaleX)
    && transform.scaleX > 0
    && Number.isFinite(transform.scaleY)
    && transform.scaleY > 0;
}

function normalizeReason(value, fallback) {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (typeof value?.message === "string" && value.message.length > 0) {
    return value.message;
  }

  return fallback;
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

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
