const REPORT_VERSION = 1;
const EXPERIMENT_ID =
  "shadow-outer-line-center-neighborhood-diagnostics";
const EDGE_ORDER = Object.freeze(["top", "bottom", "left", "right"]);

export function createOuterLineCenterValidationReport({
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
  const edges = items.flatMap(item => item.providers.flatMap(provider => (
    provider.regions.flatMap(region => region.edges)
  )));

  return deepFreeze({
    type: "outer-line-center-ground-truth-validation-report",
    version: REPORT_VERSION,
    datasetId: datasetReport.datasetRun.datasetId,
    status: "complete",
    comparisonPolicy: {
      equality: "exact-numeric-equality",
      coordinateDelta: "observed-minus-expected",
      tolerancePx: null,
      candidateOrder: "source-order",
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
      comparedEdgeCount: edges.filter(edge => edge.status === "compared").length,
      partialEdgeCount: edges.filter(edge => edge.status === "partial").length,
      unavailableEdgeCount: edges.filter(edge => (
        edge.status === "unavailable"
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
        annotation: cloneValue(annotation)
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
        reason: cloneValue(experiment.diagnostics.reason ?? null)
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
  const edges = regions.flatMap(region => region.edges);

  if (regions.length === 0) {
    result.reasons.push("outer-line-center-neighborhood-observations-unavailable");
  }

  if (comparisonUnavailableReason || edges.length === 0) {
    return result;
  }

  const hasUnavailable = result.providers.some(provider => (
    provider.status !== "available"
  )) || regions.some(region => region.status === "unavailable")
    || edges.some(edge => edge.status === "unavailable");
  const hasPartial = regions.some(region => region.status === "partial")
    || edges.some(edge => edge.status === "partial");

  result.status = hasUnavailable || hasPartial ? "partial" : "compared";
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

  const regions = Array.isArray(provider.neighborhoodObservations)
    ? provider.neighborhoodObservations
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
  const observation = region?.observation;
  const result = {
    providerId,
    regionId: region?.regionId,
    executionStatus: region?.status ?? null,
    observationStatus: observation ? "available" : "unavailable",
    status: "unavailable",
    reason: null,
    coordinateSystem: cloneValue(observation?.coordinateSystem ?? null),
    provenance: cloneValue(observation?.provenance ?? null),
    edges: []
  };

  if (region?.status !== "completed") {
    result.reason = normalizeReason(
      region?.error ?? region?.reason,
      "outer-line-center-neighborhood-region-unavailable"
    );
    return result;
  }

  if (!observation?.edges) {
    result.reason = "outer-line-center-neighborhood-artifact-unavailable";
    return result;
  }

  result.edges = EDGE_ORDER.map(edge => createEdgeValidation({
    edge,
    edgeObservation: observation.edges[edge],
    coordinateSystem: observation.coordinateSystem,
    groundTruthCenter: annotation ? readGroundTruthCenter(annotation, edge) : null,
    comparisonUnavailableReason
  }));

  if (comparisonUnavailableReason) {
    result.reason = comparisonUnavailableReason;
    return result;
  }

  result.status = result.edges.some(edge => edge.status === "unavailable")
    ? "partial"
    : result.edges.some(edge => edge.status === "partial")
      ? "partial"
      : "compared";
  return result;
}

function createEdgeValidation({
  edge,
  edgeObservation,
  coordinateSystem,
  groundTruthCenter,
  comparisonUnavailableReason
}) {
  const rawObservation = createRawObservation(edgeObservation);
  const acceptedLocalCenter = edgeObservation?.acceptedCandidateCenter;
  const acceptedParentCenter = readAcceptedParentCenter(
    edge,
    edgeObservation,
    coordinateSystem
  );
  const candidates = Array.isArray(
    edgeObservation?.projectionEvidence?.nearbyLineCenterCandidates
  )
    ? edgeObservation.projectionEvidence.nearbyLineCenterCandidates
    : [];
  const base = {
    edge,
    status: "unavailable",
    reason: null,
    observationStatus: edgeObservation?.status ?? "unavailable",
    acceptedCenter: {
      analysisRegionLocal: Number.isFinite(acceptedLocalCenter)
        ? acceptedLocalCenter
        : null,
      parentBinaryImage: Number.isFinite(acceptedParentCenter)
        ? acceptedParentCenter
        : null
    },
    groundTruthCenter: Number.isFinite(groundTruthCenter)
      ? groundTruthCenter
      : null,
    acceptedCenterDelta: null,
    observedNearbyCenterCandidates: [],
    anyObservedCandidateCloserThanAcceptedCenter: null,
    anyObservedCandidateExactlyMatchesGroundTruth: null,
    rawObservation
  };

  if (comparisonUnavailableReason) {
    base.reason = comparisonUnavailableReason;
    return base;
  }

  if (!Number.isFinite(groundTruthCenter)) {
    base.reason = "ground-truth-edge-center-unavailable";
    return base;
  }

  if (!Number.isFinite(acceptedParentCenter)) {
    base.reason = "accepted-center-unavailable";
    return base;
  }

  base.acceptedCenterDelta = comparePosition(
    acceptedParentCenter,
    groundTruthCenter
  );
  base.observedNearbyCenterCandidates = candidates.map((candidate, index) => (
    compareCandidate(candidate, index, groundTruthCenter)
  ));
  base.anyObservedCandidateCloserThanAcceptedCenter =
    base.observedNearbyCenterCandidates.some(candidate => (
      candidate.delta !== null
      && candidate.delta.absolute
        < base.acceptedCenterDelta.absolute
    ));
  base.anyObservedCandidateExactlyMatchesGroundTruth =
    base.observedNearbyCenterCandidates.some(candidate => (
      candidate.delta?.exact === true
    ));

  const sourceStatus = edgeObservation?.status;
  const candidateEvidenceAvailable = Array.isArray(
    edgeObservation?.projectionEvidence?.nearbyLineCenterCandidates
  );

  if (!candidateEvidenceAvailable) {
    base.status = "partial";
    base.reason = "nearby-center-candidate-evidence-unavailable";
  } else if (sourceStatus === "available") {
    base.status = "compared";
  } else {
    base.status = "partial";
    base.reason = normalizeReason(
      edgeObservation?.reasons?.[0],
      `outer-line-center-observation-${sourceStatus || "partial"}`
    );
  }

  return base;
}

function compareCandidate(candidate, sourceIndex, groundTruthCenter) {
  const position = Number.isFinite(candidate?.position)
    ? candidate.position
    : null;

  return {
    sourceIndex,
    observedPosition: position,
    localPosition: Number.isFinite(candidate?.localPosition)
      ? candidate.localPosition
      : null,
    start: Number.isFinite(candidate?.start) ? candidate.start : null,
    end: Number.isFinite(candidate?.end) ? candidate.end : null,
    projectionValue: Number.isFinite(candidate?.projectionValue)
      ? candidate.projectionValue
      : null,
    signedOffsetFromAcceptedCenter: Number.isFinite(
      candidate?.signedOffsetFromAcceptedCenter
    )
      ? candidate.signedOffsetFromAcceptedCenter
      : null,
    delta: position === null
      ? null
      : comparePosition(position, groundTruthCenter)
  };
}

function comparePosition(observed, expected) {
  const signed = observed - expected;

  return {
    signed,
    absolute: Math.abs(signed),
    exact: signed === 0
  };
}

function createRawObservation(edgeObservation) {
  if (!edgeObservation) {
    return null;
  }

  return {
    status: edgeObservation.status ?? null,
    acceptedCandidateCenter: Number.isFinite(
      edgeObservation.acceptedCandidateCenter
    )
      ? edgeObservation.acceptedCandidateCenter
      : null,
    candidateRunGeometry: cloneValue(
      edgeObservation.candidateRunGeometry ?? null
    ),
    projectionEvidence: cloneValue(edgeObservation.projectionEvidence ?? null),
    continuityObservations: cloneValue(
      edgeObservation.continuityObservations ?? []
    ),
    neighborhoodObservationExtent: cloneValue(
      edgeObservation.neighborhoodObservationExtent ?? null
    ),
    provenance: cloneValue(edgeObservation.provenance ?? null),
    evidenceReferences: cloneValue(edgeObservation.evidenceReferences ?? []),
    assumptions: cloneValue(edgeObservation.assumptions ?? []),
    diagnostics: cloneValue(edgeObservation.diagnostics ?? []),
    reasons: cloneValue(edgeObservation.reasons ?? [])
  };
}

function readAcceptedParentCenter(edge, edgeObservation, coordinateSystem) {
  const recorded =
    edgeObservation?.projectionEvidence?.acceptedCenterInParentBinaryImage;

  if (Number.isFinite(recorded)) {
    return recorded;
  }

  const local = edgeObservation?.acceptedCandidateCenter;
  const transform = coordinateSystem?.localToBinaryImage;

  if (!Number.isFinite(local) || !hasCoordinateTransform(transform)) {
    return null;
  }

  return edge === "top" || edge === "bottom"
    ? transform.offsetY + (local * transform.scaleY)
    : transform.offsetX + (local * transform.scaleX);
}

function readGroundTruthCenter(annotation, edge) {
  const positions = edge === "top" || edge === "bottom"
    ? annotation.horizontalLinePositions
    : annotation.verticalLinePositions;

  if (!Array.isArray(positions) || positions.length === 0) {
    return null;
  }

  return edge === "top" || edge === "left"
    ? positions[0]
    : positions[positions.length - 1];
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

  const experiment = experiments.find(candidate => candidate?.id === EXPERIMENT_ID);

  if (!experiment) {
    return {
      status: "unavailable",
      diagnostics: null,
      reason: "outer-line-center-neighborhood-experiment-unavailable"
    };
  }

  if (experiment.success !== true) {
    return {
      status: "unavailable",
      diagnostics: null,
      reason: "outer-line-center-neighborhood-experiment-failed"
    };
  }

  if (!Array.isArray(experiment.diagnostics?.providers)) {
    return {
      status: "unavailable",
      diagnostics: null,
      reason: "outer-line-center-neighborhood-providers-unavailable"
    };
  }

  return {
    status: "available",
    diagnostics: experiment.diagnostics,
    reason: null
  };
}

function hasCoordinateTransform(transform) {
  return Boolean(transform)
    && Number.isFinite(transform.offsetX)
    && Number.isFinite(transform.offsetY)
    && Number.isFinite(transform.scaleX)
    && transform.scaleX > 0
    && Number.isFinite(transform.scaleY)
    && transform.scaleY > 0;
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

function normalizeReason(value, fallback) {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (typeof value?.code === "string" && value.code.length > 0) {
    return value.code;
  }

  if (typeof value?.message === "string" && value.message.length > 0) {
    return value.message;
  }

  return fallback;
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  if (ArrayBuffer.isView(value)) {
    return undefined;
  }

  const clone = {};

  for (const key of Object.keys(value)) {
    const nested = cloneValue(value[key]);

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
