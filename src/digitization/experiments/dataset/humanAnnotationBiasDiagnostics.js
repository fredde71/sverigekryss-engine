import {
  createOuterLineCenterGeometryValidationReport
} from "./outerLineCenterGeometryValidationReport";

const REPORT_VERSION = 1;
const EDGE_ORDER = Object.freeze(["top", "bottom", "left", "right"]);
const OBSERVATION_ORDER = Object.freeze([
  Object.freeze({
    id: "first-qualifying-position",
    title: "First qualifying position",
    path: "geometry.firstStrongOrFullContinuityPosition.position"
  }),
  Object.freeze({
    id: "last-qualifying-position",
    title: "Last qualifying position",
    path: "geometry.lastStrongOrFullContinuityPosition.position"
  }),
  Object.freeze({
    id: "run-midpoint",
    title: "Run midpoint",
    path: "geometry.contiguousStrongOrFullLineRun.midpoint.position"
  }),
  Object.freeze({
    id: "plateau-midpoint",
    title: "Plateau midpoint",
    path: "geometry.projectionPlateau.midpoint.position"
  }),
  Object.freeze({
    id: "weighted-centroid",
    title: "Projection-weighted centroid",
    path: "geometry.projectionWeightedCentroid.position"
  })
]);

export function createHumanAnnotationBiasDiagnostics({
  datasetReport,
  groundTruth
} = {}) {
  const geometryValidation = createOuterLineCenterGeometryValidationReport({
    datasetReport,
    groundTruth
  });
  const items = geometryValidation.items.map(createItemDiagnostics);
  const edges = items.flatMap(item => item.providers.flatMap(provider => (
    provider.regions.flatMap(region => region.edges)
  )));
  const observations = edges.flatMap(edge => edge.geometricObservations);

  return deepFreeze({
    type: "outer-line-center-human-annotation-bias-diagnostics",
    version: REPORT_VERSION,
    datasetId: geometryValidation.datasetId,
    status: "complete",
    observationPolicy: {
      signedOffset: "ground-truth-minus-observed",
      equality: "exact-numeric-equality",
      tolerancePx: null,
      edgeOrder: EDGE_ORDER.slice(),
      observationOrder: OBSERVATION_ORDER.map(observation => observation.id),
      nearestQualifyingPosition:
        "minimum-absolute-offset-with-all-exact-ties-preserved",
      interpretation: "validation-observation-only"
    },
    inventory: {
      totalDatasetItemCount: items.length,
      annotatedItemCount: items.filter(item => (
        item.groundTruth.status === "available"
      )).length,
      comparedEdgeCount: edges.filter(edge => edge.status === "compared").length,
      partialEdgeCount: edges.filter(edge => edge.status === "partial").length,
      unavailableEdgeCount: edges.filter(edge => (
        edge.status === "unavailable"
      )).length,
      comparedObservationCount: observations.filter(observation => (
        observation.status === "compared"
      )).length,
      unavailableObservationCount: observations.filter(observation => (
        observation.status === "unavailable"
      )).length,
      unmatchedAnnotationCount: geometryValidation.unmatchedAnnotations.length
    },
    items,
    unmatchedAnnotations: cloneValue(geometryValidation.unmatchedAnnotations)
  });
}

function createItemDiagnostics(item) {
  return {
    itemId: item.itemId,
    filename: item.filename,
    status: item.status,
    reasons: cloneValue(item.reasons),
    groundTruth: cloneValue(item.groundTruth),
    experiment: cloneValue(item.experiment),
    providers: item.providers.map(createProviderDiagnostics)
  };
}

function createProviderDiagnostics(provider) {
  return {
    providerId: provider.providerId,
    providerStatus: provider.providerStatus,
    status: provider.status,
    reason: cloneValue(provider.reason),
    regions: provider.regions.map(createRegionDiagnostics)
  };
}

function createRegionDiagnostics(region) {
  return {
    providerId: region.providerId,
    regionId: region.regionId,
    executionStatus: region.executionStatus,
    observationStatus: region.observationStatus,
    status: region.status,
    reason: cloneValue(region.reason),
    coordinateSystem: cloneValue(region.coordinateSystem),
    provenance: cloneValue(region.provenance),
    edges: region.edges.map(createEdgeDiagnostics)
  };
}

function createEdgeDiagnostics(edge) {
  const raw = edge.rawGeometryObservation;
  const groundTruthPosition = finiteOrNull(edge.groundTruthCenter);
  const observationsById = new Map(
    edge.definitions.map(definition => [definition.id, definition])
  );
  const geometricObservations = OBSERVATION_ORDER.map(observation => (
    createGeometricObservation({
      definition: observationsById.get(observation.id),
      observation,
      groundTruthPosition
    })
  ));
  const qualifyingPositions = readQualifyingPositions(raw);
  const qualifyingRuns = readQualifyingRuns(raw);
  const annotationRelationship = createAnnotationRelationship({
    groundTruthPosition,
    qualifyingRuns
  });
  const nearestQualifyingPosition = createNearestQualifyingPosition({
    groundTruthPosition,
    qualifyingPositions
  });
  const comparedCount = geometricObservations.filter(observation => (
    observation.status === "compared"
  )).length;

  return {
    edge: edge.edge,
    status: groundTruthPosition === null || comparedCount === 0
      ? "unavailable"
      : comparedCount === geometricObservations.length
        && annotationRelationship.status === "observed"
        && nearestQualifyingPosition.status !== "unavailable"
          ? "compared"
          : "partial",
    reason: createEdgeReason({
      groundTruthPosition,
      comparedCount,
      expectedCount: geometricObservations.length,
      annotationRelationship,
      nearestQualifyingPosition
    }),
    groundTruthPosition,
    geometricObservations,
    annotationRelationshipToQualifyingRun: annotationRelationship,
    nearestQualifyingPosition,
    rawGeometryObservation: cloneValue(raw)
  };
}

function createGeometricObservation({
  definition,
  observation,
  groundTruthPosition
}) {
  const observedPosition = finiteOrNull(definition?.observedPosition);
  const result = {
    id: observation.id,
    title: observation.title,
    status: "unavailable",
    groundTruthPosition,
    observedPosition,
    signedOffset: null,
    absoluteOffset: null,
    exactMatch: null,
    source: {
      experimentId: "shadow-outer-line-center-geometry-diagnostics",
      path: observation.path
    },
    reason: null
  };

  if (groundTruthPosition === null) {
    result.reason = "ground-truth-edge-position-unavailable";
    return result;
  }

  if (observedPosition === null) {
    result.reason = "geometric-position-unavailable";
    return result;
  }

  const signedOffset = groundTruthPosition - observedPosition;

  result.status = "compared";
  result.signedOffset = signedOffset;
  result.absoluteOffset = Math.abs(signedOffset);
  result.exactMatch = signedOffset === 0;
  return result;
}

function createAnnotationRelationship({ groundTruthPosition, qualifyingRuns }) {
  const base = {
    status: "unavailable",
    relationship: null,
    qualifyingRunCount: qualifyingRuns.length,
    matchingRunIndexes: [],
    firstQualifyingPosition: qualifyingRuns.length > 0
      ? qualifyingRuns[0].start
      : null,
    lastQualifyingPosition: qualifyingRuns.length > 0
      ? qualifyingRuns[qualifyingRuns.length - 1].end
      : null,
    reason: null
  };

  if (groundTruthPosition === null) {
    base.reason = "ground-truth-edge-position-unavailable";
    return base;
  }

  if (qualifyingRuns.length === 0) {
    base.reason = "qualifying-run-unavailable";
    return base;
  }

  const matchingRunIndexes = qualifyingRuns.reduce((indexes, run, index) => {
    if (groundTruthPosition >= run.start && groundTruthPosition <= run.end) {
      indexes.push(index);
    }
    return indexes;
  }, []);
  const first = base.firstQualifyingPosition;
  const last = base.lastQualifyingPosition;

  base.status = "observed";
  base.matchingRunIndexes = matchingRunIndexes;

  if (groundTruthPosition < first) {
    base.relationship = "before-qualifying-runs";
  } else if (groundTruthPosition > last) {
    base.relationship = "after-qualifying-runs";
  } else if (matchingRunIndexes.length === 0) {
    base.relationship = "between-qualifying-runs";
  } else {
    const run = qualifyingRuns[matchingRunIndexes[0]];

    if (run.start === run.end && groundTruthPosition === run.start) {
      base.relationship = "at-single-position-qualifying-run";
    } else if (groundTruthPosition === run.start) {
      base.relationship = "at-qualifying-run-start";
    } else if (groundTruthPosition === run.end) {
      base.relationship = "at-qualifying-run-end";
    } else {
      base.relationship = "inside-qualifying-run";
    }
  }

  return base;
}

function createNearestQualifyingPosition({
  groundTruthPosition,
  qualifyingPositions
}) {
  const base = {
    status: "unavailable",
    minimumAbsoluteOffset: null,
    positions: [],
    tie: null,
    reason: null
  };

  if (groundTruthPosition === null) {
    base.reason = "ground-truth-edge-position-unavailable";
    return base;
  }

  if (qualifyingPositions.length === 0) {
    base.reason = "qualifying-positions-unavailable";
    return base;
  }

  const compared = qualifyingPositions.map(position => {
    const signedOffset = groundTruthPosition - position;

    return {
      position,
      signedOffset,
      absoluteOffset: Math.abs(signedOffset),
      exactMatch: signedOffset === 0
    };
  });
  const minimumAbsoluteOffset = Math.min(
    ...compared.map(position => position.absoluteOffset)
  );
  const positions = compared.filter(position => (
    position.absoluteOffset === minimumAbsoluteOffset
  ));

  base.status = positions.length > 1 ? "tied" : "observed";
  base.minimumAbsoluteOffset = minimumAbsoluteOffset;
  base.positions = positions;
  base.tie = positions.length > 1;
  return base;
}

function readQualifyingPositions(raw) {
  const qualification = raw?.geometry?.qualification;
  const positions = [
    ...(Array.isArray(qualification?.fullContinuityPositions)
      ? qualification.fullContinuityPositions
      : []),
    ...(Array.isArray(qualification?.strongestProjectionPositions)
      ? qualification.strongestProjectionPositions
      : [])
  ].filter(Number.isFinite);

  return [...new Set(positions)].sort((first, second) => first - second);
}

function readQualifyingRuns(raw) {
  const runs = raw?.geometry?.contiguousStrongOrFullLineRuns;

  if (!Array.isArray(runs)) {
    return [];
  }

  return runs.flatMap(run => {
    const start = finiteOrNull(run?.start?.position);
    const end = finiteOrNull(run?.end?.position);

    return start === null || end === null ? [] : [{ start, end }];
  });
}

function createEdgeReason({
  groundTruthPosition,
  comparedCount,
  expectedCount,
  annotationRelationship,
  nearestQualifyingPosition
}) {
  if (groundTruthPosition === null) {
    return "ground-truth-edge-position-unavailable";
  }

  if (comparedCount === 0) {
    return "geometric-positions-unavailable";
  }

  if (
    comparedCount !== expectedCount
    || annotationRelationship.status === "unavailable"
    || nearestQualifyingPosition.status === "unavailable"
  ) {
    return "some-human-annotation-bias-observations-unavailable";
  }

  return null;
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
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
