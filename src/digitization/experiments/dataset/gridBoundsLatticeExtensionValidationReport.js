const REPORT_VERSION = 1;
const EXPERIMENT_ID =
  "shadow-grid-bounds-lattice-extension-diagnostics";
const RUNTIME_FIELDS = new Set([
  "binaryImage",
  "imageData",
  "canvas",
  "projection",
  "projections",
  "lineCandidates"
]);

export function createGridBoundsLatticeExtensionValidationReport({
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
  const comparisons = items.flatMap(item => item.providers.flatMap(provider => (
    provider.regions.flatMap(region => region.observations)
  )));

  return deepFreeze({
    type: "grid-bounds-lattice-extension-validation-report",
    version: REPORT_VERSION,
    datasetId: datasetReport.datasetRun.datasetId,
    status: "complete",
    comparisonPolicy: {
      equality: "exact-numeric-equality",
      coordinateDelta: "observed-minus-expected",
      tolerancePx: null,
      interpretation: "none"
    },
    inventory: {
      totalDatasetItemCount: items.length,
      annotatedItemCount: items.filter(item => (
        item.groundTruth.status === "available"
      )).length,
      experimentItemCount: items.filter(item => (
        item.experiment.status === "available"
      )).length,
      totalObservationCount: comparisons.length,
      comparedObservationCount: comparisons.filter(comparison => (
        comparison.status === "compared"
      )).length,
      exactBoundsMatchCount: comparisons.filter(comparison => (
        comparison.exactBoundMatch?.exact === true
      )).length,
      unavailableItemCount: items.filter(item => (
        item.status === "unavailable"
      )).length,
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
  const experiment = extractExperiment(item);
  const comparisonUnavailableReason = !annotation
    ? "ground-truth-annotation-unavailable"
    : filename === null
      ? "dataset-filename-unavailable"
      : filename !== annotation.filename
        ? "filename-mismatch"
        : null;
  const result = {
    itemId: item?.id,
    filename,
    status: "unavailable",
    reasons: [],
    groundTruth: annotation
      ? {
        status: "available",
        annotation: cloneCompact(annotation)
      }
      : {
        status: "unavailable",
        annotation: null,
        reason: "ground-truth-annotation-unavailable"
      },
    experiment: experiment.status === "available"
      ? {
        status: "available",
        experimentId: EXPERIMENT_ID,
        diagnosticStatus: experiment.diagnostics.status,
        reason: cloneCompact(experiment.diagnostics.reason ?? null)
      }
      : {
        status: "unavailable",
        experimentId: EXPERIMENT_ID,
        diagnosticStatus: null,
        reason: experiment.reason
      },
    providers: []
  };

  if (comparisonUnavailableReason) {
    result.reasons.push(comparisonUnavailableReason);
  }

  if (experiment.status !== "available") {
    result.reasons.push(experiment.reason);
    return result;
  }

  result.providers = experiment.diagnostics.providers.map(provider => (
    createProviderValidation({
      provider,
      annotation,
      comparisonUnavailableReason
    })
  ));

  const regions = result.providers.flatMap(provider => provider.regions);
  const observations = regions.flatMap(region => region.observations);

  if (observations.length === 0) {
    result.reasons.push("lattice-extension-bounds-observations-unavailable");
  }

  const hasUnavailable = result.providers.some(provider => (
    provider.status !== "available"
  )) || regions.some(region => region.status !== "compared")
    || observations.some(observation => observation.status !== "compared");

  result.status = observations.length === 0 || comparisonUnavailableReason
    ? "unavailable"
    : hasUnavailable
      ? "partial"
      : "compared";
  return result;
}

function createProviderValidation({
  provider,
  annotation,
  comparisonUnavailableReason
}) {
  const result = {
    providerId: provider?.id,
    providerStatus: provider?.status ?? null,
    status: provider?.status === "available" ? "available" : "unavailable",
    reason: provider?.status === "available"
      ? null
      : normalizeReason(provider?.reason, "provider-unavailable"),
    regions: []
  };

  if (provider?.status !== "available") {
    return result;
  }

  const regions = Array.isArray(provider.boundsObservations)
    ? provider.boundsObservations
    : [];

  result.regions = regions.map(region => createRegionValidation({
    providerId: provider.id,
    region,
    annotation,
    comparisonUnavailableReason
  }));
  return result;
}

function createRegionValidation({
  providerId,
  region,
  annotation,
  comparisonUnavailableReason
}) {
  const artifact = region?.boundsObservation;
  const result = {
    providerId,
    regionId: region?.regionId,
    executionStatus: region?.status ?? null,
    experimentResultStatus: artifact?.status ?? null,
    status: "unavailable",
    reason: null,
    coordinateSystem: cloneCompact(artifact?.coordinateSystem ?? null),
    sourceAcceptedCandidateEnvelope: cloneCompact(
      artifact?.sourceAcceptedCandidateEnvelope ?? null
    ),
    experimentProvenance: cloneCompact(artifact?.provenance ?? null),
    observations: []
  };

  if (region?.status !== "completed") {
    result.reason = normalizeReason(
      region?.error,
      "lattice-extension-experiment-region-failed"
    );
    return result;
  }

  if (!artifact || !Array.isArray(artifact.observations)) {
    result.reason = "grid-bounds-observation-artifact-unavailable";
    return result;
  }

  if (!hasCoordinateTransform(artifact.coordinateSystem)) {
    result.reason = "grid-bounds-coordinate-system-unavailable";
    return result;
  }

  result.observations = artifact.observations.map((observation, index) => (
    createObservationValidation({
      observation,
      observationIndex: index,
      coordinateSystem: artifact.coordinateSystem,
      annotation,
      comparisonUnavailableReason
    })
  ));

  if (result.observations.length === 0) {
    result.reason = normalizeReason(
      artifact.reasons?.[0]?.code ?? artifact.reasons?.[0],
      `lattice-extension-result-${artifact.status || "unavailable"}`
    );
    return result;
  }

  result.status = comparisonUnavailableReason ? "unavailable" : "compared";
  result.reason = comparisonUnavailableReason;
  return result;
}

function createObservationValidation({
  observation,
  observationIndex,
  coordinateSystem,
  annotation,
  comparisonUnavailableReason
}) {
  const rawLocalObservation = cloneCompact(observation);
  const normalizedProposedBounds = normalizeBounds(
    observation?.bounds,
    coordinateSystem.localToBinaryImage
  );
  const base = {
    observationIndex,
    observationId: observation?.id ?? null,
    experimentObservationStatus: observation?.status ?? null,
    status: "unavailable",
    reason: null,
    rawLocalObservation,
    proposedBounds: {
      coordinateSpace: "rendered-binary-image-pixels",
      value: normalizedProposedBounds
    },
    groundTruthBounds: annotation
      ? cloneCompact(annotation.gridBounds)
      : null,
    deltas: createUnavailableBoundsDeltas(comparisonUnavailableReason),
    exactBoundMatch: {
      status: "unavailable",
      equality: "exact-numeric-equality",
      exact: null,
      reason: comparisonUnavailableReason
    },
    inferredOuterIntervals: cloneCompact(
      observation?.inferredOuterIntervals ?? null
    ),
    spacingUsed: cloneCompact(observation?.spacingUsed ?? null),
    sourceProvenance: {
      observation: cloneCompact(observation?.provenance ?? null),
      evidenceReferences: cloneCompact(
        observation?.evidenceReferences ?? []
      ),
      assumptions: cloneCompact(observation?.assumptions ?? []),
      reasons: cloneCompact(observation?.reasons ?? [])
    }
  };

  if (comparisonUnavailableReason) {
    base.reason = comparisonUnavailableReason;
    return base;
  }

  if (!hasFiniteBounds(normalizedProposedBounds)) {
    base.reason = "proposed-bounds-unavailable";
    base.deltas = createUnavailableBoundsDeltas(base.reason);
    base.exactBoundMatch.reason = base.reason;
    return base;
  }

  const deltas = compareBoundsEdges(
    annotation.gridBounds,
    normalizedProposedBounds
  );

  base.status = "compared";
  base.reason = null;
  base.deltas = deltas;
  base.exactBoundMatch = {
    status: "compared",
    equality: "exact-numeric-equality",
    exact: [
      deltas.top,
      deltas.left,
      deltas.right,
      deltas.bottom,
      deltas.width,
      deltas.height
    ].every(value => value === 0),
    reason: null
  };
  return base;
}

function compareBoundsEdges(expected, observed) {
  const expectedRight = expected.left + expected.width;
  const expectedBottom = expected.top + expected.height;
  const observedRight = observed.left + observed.width;
  const observedBottom = observed.top + observed.height;

  return {
    status: "compared",
    equality: "exact-numeric-equality",
    top: observed.top - expected.top,
    left: observed.left - expected.left,
    right: observedRight - expectedRight,
    bottom: observedBottom - expectedBottom,
    width: observed.width - expected.width,
    height: observed.height - expected.height
  };
}

function createUnavailableBoundsDeltas(reason) {
  return {
    status: "unavailable",
    reason: reason || "comparison-unavailable",
    top: null,
    left: null,
    right: null,
    bottom: null,
    width: null,
    height: null
  };
}

function normalizeBounds(bounds, transform) {
  if (!hasFiniteBounds(bounds)) {
    return null;
  }

  return {
    top: transform.offsetY + (bounds.top * transform.scaleY),
    left: transform.offsetX + (bounds.left * transform.scaleX),
    width: bounds.width * transform.scaleX,
    height: bounds.height * transform.scaleY
  };
}

function extractExperiment(item) {
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
    candidate?.id === EXPERIMENT_ID
  ));

  if (!experiment) {
    return {
      status: "unavailable",
      diagnostics: null,
      reason: "grid-bounds-lattice-extension-experiment-unavailable"
    };
  }

  if (experiment.success !== true) {
    return {
      status: "unavailable",
      diagnostics: null,
      reason: "grid-bounds-lattice-extension-experiment-failed"
    };
  }

  if (!Array.isArray(experiment.diagnostics?.providers)) {
    return {
      status: "unavailable",
      diagnostics: null,
      reason: "grid-bounds-lattice-extension-providers-unavailable"
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

function hasFiniteBounds(bounds) {
  return Boolean(bounds)
    && Number.isFinite(bounds.top)
    && Number.isFinite(bounds.left)
    && Number.isFinite(bounds.width)
    && bounds.width > 0
    && Number.isFinite(bounds.height)
    && bounds.height > 0;
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
    throw new Error(
      "Dataset report and ground truth datasetId must match exactly"
    );
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
