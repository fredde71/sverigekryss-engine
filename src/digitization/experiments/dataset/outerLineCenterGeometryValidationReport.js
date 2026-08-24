const REPORT_VERSION = 1;
const EXPERIMENT_ID = "shadow-outer-line-center-geometry-diagnostics";
const EDGE_ORDER = Object.freeze(["top", "bottom", "left", "right"]);
const DEFINITION_ORDER = Object.freeze([
  Object.freeze({
    id: "accepted-center",
    title: "Accepted center",
    readPosition: edge => edge?.acceptedCenterInParentBinaryImage,
    sourcePath: "acceptedCenterInParentBinaryImage"
  }),
  Object.freeze({
    id: "run-midpoint",
    title: "Run midpoint",
    readPosition: edge => (
      edge?.geometry?.contiguousStrongOrFullLineRun?.midpoint?.position
    ),
    sourcePath: "geometry.contiguousStrongOrFullLineRun.midpoint.position"
  }),
  Object.freeze({
    id: "plateau-midpoint",
    title: "Plateau midpoint",
    readPosition: edge => edge?.geometry?.projectionPlateau?.midpoint?.position,
    sourcePath: "geometry.projectionPlateau.midpoint.position"
  }),
  Object.freeze({
    id: "weighted-centroid",
    title: "Projection-weighted centroid",
    readPosition: edge => edge?.geometry?.projectionWeightedCentroid?.position,
    sourcePath: "geometry.projectionWeightedCentroid.position"
  }),
  Object.freeze({
    id: "first-qualifying-position",
    title: "First qualifying position",
    readPosition: edge => (
      edge?.geometry?.firstStrongOrFullContinuityPosition?.position
    ),
    sourcePath: "geometry.firstStrongOrFullContinuityPosition.position"
  }),
  Object.freeze({
    id: "last-qualifying-position",
    title: "Last qualifying position",
    readPosition: edge => (
      edge?.geometry?.lastStrongOrFullContinuityPosition?.position
    ),
    sourcePath: "geometry.lastStrongOrFullContinuityPosition.position"
  })
]);

export function createOuterLineCenterGeometryValidationReport({
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
  const definitions = edges.flatMap(edge => edge.definitions);

  return deepFreeze({
    type: "outer-line-center-geometry-ground-truth-validation-report",
    version: REPORT_VERSION,
    datasetId: datasetReport.datasetRun.datasetId,
    status: "complete",
    comparisonPolicy: {
      equality: "exact-numeric-equality",
      coordinateDelta: "observed-minus-expected",
      tolerancePx: null,
      edgeOrder: EDGE_ORDER.slice(),
      definitionOrder: DEFINITION_ORDER.map(definition => definition.id),
      closestMeaning:
        "minimum-absolute-ground-truth-delta-with-all-exact-ties-preserved",
      interpretation: "validation-observation-only"
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
      comparedDefinitionCount: definitions.filter(definition => (
        definition.status === "compared"
      )).length,
      unavailableDefinitionCount: definitions.filter(definition => (
        definition.status === "unavailable"
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
    result.reasons.push("outer-line-center-geometry-observations-unavailable");
  }

  if (comparisonUnavailableReason || edges.length === 0) {
    return result;
  }

  result.status = result.providers.some(provider => (
    provider.status !== "available"
  )) || regions.some(region => region.status !== "compared")
    || edges.some(edge => edge.status !== "compared")
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

  const regions = Array.isArray(provider.geometryObservations)
    ? provider.geometryObservations
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
      "outer-line-center-geometry-region-unavailable"
    );
    return result;
  }

  if (!observation?.edges) {
    result.reason = "outer-line-center-geometry-artifact-unavailable";
    return result;
  }

  result.edges = EDGE_ORDER.map(edge => createEdgeValidation({
    edge,
    edgeObservation: observation.edges[edge],
    groundTruthCenter: annotation ? readGroundTruthCenter(annotation, edge) : null,
    comparisonUnavailableReason
  }));

  if (comparisonUnavailableReason) {
    result.reason = comparisonUnavailableReason;
    return result;
  }

  result.status = result.edges.every(edge => edge.status === "compared")
    ? "compared"
    : result.edges.some(edge => edge.status !== "unavailable")
      ? "partial"
      : "unavailable";
  return result;
}

function createEdgeValidation({
  edge,
  edgeObservation,
  groundTruthCenter,
  comparisonUnavailableReason
}) {
  const definitions = DEFINITION_ORDER.map(definition => (
    createDefinitionComparison({
      definition,
      edgeObservation,
      groundTruthCenter,
      comparisonUnavailableReason
    })
  ));
  const comparedDefinitions = definitions.filter(definition => (
    definition.status === "compared"
  ));
  const closest = createClosestObservation(comparedDefinitions);
  const base = {
    edge,
    status: "unavailable",
    reason: null,
    observationStatus: edgeObservation?.status ?? "unavailable",
    geometryStatus: edgeObservation?.geometryStatus ?? "unavailable",
    groundTruthCenter: Number.isFinite(groundTruthCenter)
      ? groundTruthCenter
      : null,
    definitions,
    closestGeometricDefinitionObservation: closest,
    rawGeometryObservation: createRawGeometryObservation(edgeObservation)
  };

  if (comparisonUnavailableReason) {
    base.reason = comparisonUnavailableReason;
    return base;
  }

  if (!Number.isFinite(groundTruthCenter)) {
    base.reason = "ground-truth-edge-center-unavailable";
    return base;
  }

  if (comparedDefinitions.length === 0) {
    base.reason = "geometric-definition-positions-unavailable";
    return base;
  }

  if (
    comparedDefinitions.length === definitions.length
    && edgeObservation?.status === "available"
  ) {
    base.status = "compared";
  } else {
    base.status = "partial";
    base.reason = comparedDefinitions.length !== definitions.length
      ? "some-geometric-definition-positions-unavailable"
      : `source-geometry-${edgeObservation?.status || "partial"}`;
  }

  return base;
}

function createDefinitionComparison({
  definition,
  edgeObservation,
  groundTruthCenter,
  comparisonUnavailableReason
}) {
  const observedPosition = definition.readPosition(edgeObservation);
  const result = {
    id: definition.id,
    title: definition.title,
    status: "unavailable",
    observedPosition: Number.isFinite(observedPosition)
      ? observedPosition
      : null,
    groundTruthPosition: Number.isFinite(groundTruthCenter)
      ? groundTruthCenter
      : null,
    signedDelta: null,
    absoluteDelta: null,
    exactMatch: null,
    source: {
      experimentId: EXPERIMENT_ID,
      path: definition.sourcePath
    },
    reason: null
  };

  if (comparisonUnavailableReason) {
    result.reason = comparisonUnavailableReason;
    return result;
  }

  if (!Number.isFinite(groundTruthCenter)) {
    result.reason = "ground-truth-edge-center-unavailable";
    return result;
  }

  if (!Number.isFinite(observedPosition)) {
    result.reason = "geometric-definition-position-unavailable";
    return result;
  }

  const signedDelta = observedPosition - groundTruthCenter;

  result.status = "compared";
  result.signedDelta = signedDelta;
  result.absoluteDelta = Math.abs(signedDelta);
  result.exactMatch = signedDelta === 0;
  return result;
}

function createClosestObservation(comparedDefinitions) {
  if (comparedDefinitions.length === 0) {
    return {
      status: "unavailable",
      minimumAbsoluteDelta: null,
      definitions: [],
      tie: null,
      meaning: "validation-observation-only"
    };
  }

  const minimumAbsoluteDelta = Math.min(
    ...comparedDefinitions.map(definition => definition.absoluteDelta)
  );
  const definitions = comparedDefinitions
    .filter(definition => definition.absoluteDelta === minimumAbsoluteDelta)
    .map(definition => ({
      id: definition.id,
      title: definition.title,
      observedPosition: definition.observedPosition,
      signedDelta: definition.signedDelta,
      absoluteDelta: definition.absoluteDelta,
      exactMatch: definition.exactMatch
    }));

  return {
    status: definitions.length > 1 ? "tied" : "observed",
    minimumAbsoluteDelta,
    definitions,
    tie: definitions.length > 1,
    meaning: "validation-observation-only"
  };
}

function createRawGeometryObservation(edgeObservation) {
  if (!edgeObservation) {
    return null;
  }

  return {
    status: edgeObservation.status ?? null,
    geometryStatus: edgeObservation.geometryStatus ?? null,
    acceptedCandidateCenter: finiteOrNull(
      edgeObservation.acceptedCandidateCenter
    ),
    acceptedCenterInParentBinaryImage: finiteOrNull(
      edgeObservation.acceptedCenterInParentBinaryImage
    ),
    rawProjectionSamples: cloneValue(
      edgeObservation.rawProjectionSamples ?? []
    ),
    continuityObservations: cloneValue(
      edgeObservation.continuityObservations ?? []
    ),
    geometry: cloneValue(edgeObservation.geometry ?? null),
    candidateRunGeometry: cloneValue(
      edgeObservation.candidateRunGeometry ?? null
    ),
    candidateRunProvenance: cloneValue(
      edgeObservation.candidateRunProvenance ?? null
    ),
    coordinateTransform: cloneValue(edgeObservation.coordinateTransform ?? null),
    provenance: cloneValue(edgeObservation.provenance ?? null),
    diagnostics: cloneValue(edgeObservation.diagnostics ?? []),
    reasons: cloneValue(edgeObservation.reasons ?? [])
  };
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
    return unavailableExperiment(
      `dataset-comparison-${item?.comparison?.status || "unavailable"}`
    );
  }

  const experiments = item.comparison.result?.benchmark?.experiments;

  if (!Array.isArray(experiments)) {
    return unavailableExperiment("benchmark-experiments-unavailable");
  }

  const experiment = experiments.find(candidate => candidate?.id === EXPERIMENT_ID);

  if (!experiment) {
    return unavailableExperiment(
      "outer-line-center-geometry-experiment-unavailable"
    );
  }

  if (experiment.success !== true) {
    return unavailableExperiment("outer-line-center-geometry-experiment-failed");
  }

  if (!Array.isArray(experiment.diagnostics?.providers)) {
    return unavailableExperiment(
      "outer-line-center-geometry-providers-unavailable"
    );
  }

  return {
    status: "available",
    diagnostics: experiment.diagnostics,
    reason: null
  };
}

function unavailableExperiment(reason) {
  return { status: "unavailable", diagnostics: null, reason };
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

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
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
