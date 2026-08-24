const ALLOWED_ENVIRONMENTS = new Set(["development", "test"]);
const SOURCE_EXPERIMENT_ID =
  "shadow-outer-line-center-neighborhood-diagnostics";
const EDGE_ORDER = Object.freeze(["top", "bottom", "left", "right"]);

export const shadowOuterLineCenterGeometryDiagnosticsExperiment =
  Object.freeze({
    id: "shadow-outer-line-center-geometry-diagnostics",
    description: "Observe factual geometric descriptions of accepted outer-line neighborhoods without choosing a new center.",
    run(binaryImage, _context, execution) {
      return runShadowOuterLineCenterGeometryDiagnostics({
        neighborhoodDiagnostics:
          execution?.getSuccessfulDiagnostics?.(SOURCE_EXPERIMENT_ID) ?? null,
        binaryImage
      });
    }
  });

export function createShadowOuterLineCenterGeometryDiagnosticsRunner({
  readEnvironment = () => process.env.NODE_ENV
} = {}) {
  validateDependency(readEnvironment, "readEnvironment");

  return function run(input = {}) {
    assertDevelopmentEnvironment(readEnvironment());
    const source = input.neighborhoodDiagnostics;

    if (
      source?.type !== SOURCE_EXPERIMENT_ID
      || !Array.isArray(source.providers)
    ) {
      return freezeValue({
        type: "shadow-outer-line-center-geometry-diagnostics",
        version: 1,
        status: "unavailable",
        sourceExperimentId: SOURCE_EXPERIMENT_ID,
        reason: "outer-line-center-neighborhood-diagnostics-unavailable",
        providers: []
      });
    }

    const binaryImage = snapshotBinaryImage(input.binaryImage);
    const providers = source.providers.map(provider => observeProvider(
      provider,
      binaryImage
    ));

    return freezeValue({
      type: "shadow-outer-line-center-geometry-diagnostics",
      version: 1,
      status: "complete",
      sourceExperimentId: SOURCE_EXPERIMENT_ID,
      reason: null,
      binaryImageDimensions: {
        width: binaryImage.width,
        height: binaryImage.height
      },
      providers
    });
  };
}

export const runShadowOuterLineCenterGeometryDiagnostics =
  createShadowOuterLineCenterGeometryDiagnosticsRunner();

function observeProvider(provider, binaryImage) {
  const result = {
    id: provider?.id,
    description: provider?.description,
    status: provider?.status,
    regionCount: provider?.regionCount,
    reason: cloneValue(provider?.reason ?? null),
    geometryObservations: []
  };

  if (provider?.status !== "available") {
    return result;
  }

  const regions = Array.isArray(provider.neighborhoodObservations)
    ? provider.neighborhoodObservations
    : [];

  result.geometryObservations = regions.map(region => observeRegion(
    provider.id,
    region,
    binaryImage
  ));
  return result;
}

function observeRegion(providerId, region, binaryImage) {
  const sourceObservation = region?.observation;
  const regionId = region?.regionId;

  if (region?.status !== "completed" || !sourceObservation?.edges) {
    return {
      providerId,
      regionId,
      status: "unavailable",
      reason: normalizeReason(
        region?.error ?? region?.reason,
        "outer-line-center-neighborhood-observation-unavailable"
      ),
      observation: null,
      error: null
    };
  }

  try {
    const edges = EDGE_ORDER.reduce((result, edge) => {
      result[edge] = observeEdge({
        edge,
        sourceEdge: sourceObservation.edges[edge],
        coordinateSystem: sourceObservation.coordinateSystem,
        binaryImage,
        providerId,
        regionId
      });
      return result;
    }, {});

    return {
      providerId,
      regionId,
      status: "completed",
      reason: null,
      observation: {
        type: "outer-line-center-geometry-observation",
        version: 1,
        analysisRegionId: sourceObservation.analysisRegionId,
        coordinateSystem: cloneValue(sourceObservation.coordinateSystem),
        edgeOrder: EDGE_ORDER.slice(),
        edges,
        provenance: {
          source: "shadow-outer-line-center-geometry-diagnostics",
          sourceExperimentId: SOURCE_EXPERIMENT_ID,
          providerId,
          regionId,
          method: "factual-boundary-neighborhood-geometry"
        },
        assumptions: [{
          id: "accepted-candidate-center-remains-unchanged",
          status: "applied"
        }],
        evidenceReferences: [{
          experimentId: SOURCE_EXPERIMENT_ID,
          providerId,
          regionId
        }]
      },
      error: null
    };
  } catch (error) {
    return {
      providerId,
      regionId,
      status: "failed",
      reason: null,
      observation: null,
      error: normalizeError(error)
    };
  }
}

function observeEdge({
  edge,
  sourceEdge,
  coordinateSystem,
  binaryImage,
  providerId,
  regionId
}) {
  const acceptedLocalCenter = sourceEdge?.acceptedCandidateCenter;
  const projection = sourceEdge?.projectionEvidence;
  const extent = sourceEdge?.neighborhoodObservationExtent;
  const acceptedParentCenter = projection?.acceptedCenterInParentBinaryImage;
  const rawProjectionSamples = createRawProjectionSamples(projection);
  const base = {
    edge,
    status: "unavailable",
    geometryStatus: "unavailable",
    acceptedCandidateCenter: Number.isFinite(acceptedLocalCenter)
      ? acceptedLocalCenter
      : null,
    acceptedCenterInParentBinaryImage: Number.isFinite(acceptedParentCenter)
      ? acceptedParentCenter
      : null,
    rawProjectionSamples,
    continuityObservations: cloneValue(
      sourceEdge?.continuityObservations ?? []
    ),
    candidateRunGeometry: cloneValue(
      sourceEdge?.candidateRunGeometry ?? null
    ),
    candidateRunProvenance: {
      provenance: cloneValue(sourceEdge?.provenance ?? null),
      evidenceReferences: cloneValue(sourceEdge?.evidenceReferences ?? [])
    },
    neighborhoodObservationExtent: cloneValue(extent ?? null),
    coordinateTransform: cloneValue(
      coordinateSystem?.localToBinaryImage ?? null
    ),
    geometry: unavailableGeometry(),
    diagnostics: [],
    provenance: {
      source: "shadow-outer-line-center-geometry-diagnostics",
      sourceExperimentId: SOURCE_EXPERIMENT_ID,
      providerId,
      regionId,
      edge
    },
    reasons: []
  };

  if (!Number.isFinite(acceptedLocalCenter)) {
    base.reasons.push({ code: "accepted-candidate-center-unavailable" });
    return base;
  }

  if (!Number.isFinite(acceptedParentCenter)) {
    base.reasons.push({ code: "accepted-parent-center-unavailable" });
    return base;
  }

  if (!hasFiniteBounds(extent?.bounds)) {
    base.reasons.push({ code: "neighborhood-bounds-unavailable" });
    return base;
  }

  if (rawProjectionSamples.length === 0) {
    base.reasons.push({ code: "projection-samples-unavailable" });
    return base;
  }

  const axis = isHorizontalEdge(edge) ? "horizontal" : "vertical";
  const parentSamples = readParentSamples(binaryImage, extent.bounds, axis);
  const continuity = Array.isArray(sourceEdge?.continuityObservations)
    ? sourceEdge.continuityObservations
    : [];
  const geometry = createGeometry({
    projectionSamples: parentSamples,
    continuity,
    acceptedCenter: acceptedParentCenter,
    tangentialLength: axis === "horizontal"
      ? extent.bounds.width
      : extent.bounds.height
  });
  const projectionAgreement = compareSamples(
    rawProjectionSamples,
    parentSamples
  );

  base.geometry = geometry.value;
  base.geometryStatus = geometry.status;
  base.diagnostics = [{
    type: "outer-line-center-geometry-source-evidence",
    parentBinaryImageSampleCount: parentSamples.length,
    sourceProjectionSampleCount: rawProjectionSamples.length,
    sourceProjectionMatchesParentBinaryImage: projectionAgreement
  }];
  base.reasons = geometry.reasons;

  if (geometry.status === "unavailable") {
    base.status = "unavailable";
  } else if (geometry.status === "ambiguous") {
    base.status = "ambiguous";
  } else if (sourceEdge?.status !== "available") {
    base.status = "partial";
    base.reasons = [
      ...base.reasons,
      { code: `source-neighborhood-${sourceEdge?.status || "partial"}` }
    ];
  } else {
    base.status = "available";
  }

  return base;
}

function createGeometry({
  projectionSamples,
  continuity,
  acceptedCenter,
  tangentialLength
}) {
  const positiveSamples = projectionSamples.filter(sample => sample.value > 0);

  if (positiveSamples.length === 0) {
    return {
      status: "unavailable",
      value: unavailableGeometry(),
      reasons: [{ code: "positive-projection-evidence-unavailable" }]
    };
  }

  const maximumProjectionValue = Math.max(
    ...positiveSamples.map(sample => sample.value)
  );
  const observedPositions = new Set(
    projectionSamples.map(sample => sample.position)
  );
  const fullContinuityPositions = continuity
    .filter(observation => (
      Number.isFinite(observation?.position)
      && observedPositions.has(observation.position)
      && observation.longestContinuousBlackRun === tangentialLength
    ))
    .map(observation => observation.position);
  const strongestProjectionPositions = projectionSamples
    .filter(sample => sample.value === maximumProjectionValue)
    .map(sample => sample.position);
  const strongOrFullPositions = uniqueSortedPositions([
    ...strongestProjectionPositions,
    ...fullContinuityPositions
  ]);
  const strongOrFullRuns = createPositionRuns(
    strongOrFullPositions,
    acceptedCenter
  );
  const maximumProjectionPlateaus = createPositionRuns(
    strongestProjectionPositions,
    acceptedCenter,
    maximumProjectionValue
  ).map(run => ({
    start: run.start,
    end: run.end,
    width: run.thickness,
    midpoint: run.midpoint,
    projectionValue: maximumProjectionValue
  }));
  const projectionWeightTotal = projectionSamples.reduce(
    (sum, sample) => sum + sample.value,
    0
  );
  const centroidPosition = projectionSamples.reduce(
    (sum, sample) => sum + (sample.position * sample.value),
    0
  ) / projectionWeightTotal;
  const centroid = derivedPosition(centroidPosition, acceptedCenter);
  const firstPosition = strongOrFullPositions[0];
  const lastPosition = strongOrFullPositions[
    strongOrFullPositions.length - 1
  ];
  const ambiguous = strongOrFullRuns.length !== 1
    || maximumProjectionPlateaus.length !== 1;

  return {
    status: ambiguous ? "ambiguous" : "available",
    value: {
      qualification: {
        fullContinuityMeaning:
          "longest-continuous-black-run-equals-neighborhood-tangential-length",
        strongProjectionMeaning:
          "maximum-positive-projection-value-in-observed-neighborhood",
        tangentialLength,
        maximumProjectionValue,
        fullContinuityPositions,
        strongestProjectionPositions
      },
      contiguousStrongOrFullLineRuns: strongOrFullRuns,
      contiguousStrongOrFullLineRun: strongOrFullRuns.length === 1
        ? strongOrFullRuns[0]
        : null,
      maximumProjectionPlateaus,
      projectionPlateau: maximumProjectionPlateaus.length === 1
        ? maximumProjectionPlateaus[0]
        : null,
      projectionWeightedCentroid: centroid,
      firstStrongOrFullContinuityPosition: derivedPosition(
        firstPosition,
        acceptedCenter
      ),
      lastStrongOrFullContinuityPosition: derivedPosition(
        lastPosition,
        acceptedCenter
      )
    },
    reasons: ambiguous
      ? [{ code: "multiple-geometric-descriptions-observed" }]
      : []
  };
}

function createPositionRuns(positions, acceptedCenter, projectionValue) {
  if (positions.length === 0) {
    return [];
  }

  const runs = [];
  let start = positions[0];
  let end = start;

  for (let index = 1; index <= positions.length; index++) {
    const position = positions[index];

    if (position === end + 1) {
      end = position;
      continue;
    }

    const midpoint = start + ((end - start) / 2);
    const run = {
      start: derivedPosition(start, acceptedCenter),
      end: derivedPosition(end, acceptedCenter),
      thickness: end - start + 1,
      midpoint: derivedPosition(midpoint, acceptedCenter)
    };

    if (projectionValue !== undefined) {
      run.projectionValue = projectionValue;
    }

    runs.push(run);
    start = position;
    end = position;
  }

  return runs;
}

function derivedPosition(position, acceptedCenter) {
  return {
    position,
    signedOffsetFromAcceptedCenter: position - acceptedCenter
  };
}

function createRawProjectionSamples(projection) {
  const positions = projection?.positions;
  const values = projection?.values;

  if (!Array.isArray(positions) || !Array.isArray(values)) {
    return [];
  }

  const length = Math.min(positions.length, values.length);
  const samples = [];

  for (let index = 0; index < length; index++) {
    if (Number.isFinite(positions[index]) && Number.isFinite(values[index])) {
      samples.push({
        position: positions[index],
        value: values[index]
      });
    }
  }

  return samples;
}

function readParentSamples(binaryImage, bounds, axis) {
  const normalStart = axis === "horizontal" ? bounds.top : bounds.left;
  const normalLength = axis === "horizontal" ? bounds.height : bounds.width;
  const tangentialLength = axis === "horizontal" ? bounds.width : bounds.height;
  const samples = [];

  for (let normalOffset = 0; normalOffset < normalLength; normalOffset++) {
    const position = normalStart + normalOffset;
    let value = 0;

    for (let tangentOffset = 0; tangentOffset < tangentialLength; tangentOffset++) {
      const x = axis === "horizontal"
        ? bounds.left + tangentOffset
        : position;
      const y = axis === "horizontal"
        ? position
        : bounds.top + tangentOffset;

      if (
        x >= 0
        && x < binaryImage.width
        && y >= 0
        && y < binaryImage.height
        && binaryImage.data[(y * binaryImage.width) + x] === 1
      ) {
        value += 1;
      }
    }

    samples.push({ position, value });
  }

  return samples;
}

function compareSamples(source, observed) {
  return source.length === observed.length
    && source.every((sample, index) => (
      sample.position === observed[index].position
      && sample.value === observed[index].value
    ));
}

function uniqueSortedPositions(positions) {
  return [...new Set(positions)].sort((first, second) => first - second);
}

function unavailableGeometry() {
  return {
    qualification: null,
    contiguousStrongOrFullLineRuns: [],
    contiguousStrongOrFullLineRun: null,
    maximumProjectionPlateaus: [],
    projectionPlateau: null,
    projectionWeightedCentroid: null,
    firstStrongOrFullContinuityPosition: null,
    lastStrongOrFullContinuityPosition: null
  };
}

function isHorizontalEdge(edge) {
  return edge === "top" || edge === "bottom";
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

function snapshotBinaryImage(source) {
  const width = source?.width;
  const height = source?.height;
  const data = source?.data;

  if (
    !Number.isInteger(width)
    || width <= 0
    || !Number.isInteger(height)
    || height <= 0
    || !data
    || data.length < width * height
  ) {
    throw new Error("Parent BinaryImage is required");
  }

  return { width, height, data };
}

function assertDevelopmentEnvironment(environment) {
  if (!ALLOWED_ENVIRONMENTS.has(environment)) {
    throw new Error(
      "Shadow outer line center geometry diagnostics are available only in development or test"
    );
  }
}

function validateDependency(value, name) {
  if (typeof value !== "function") {
    throw new Error(`${name} must be a function`);
  }
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

function normalizeError(error) {
  return {
    name: typeof error?.name === "string" ? error.name : "Error",
    message: typeof error?.message === "string"
      ? error.message
      : String(error)
  };
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.keys(value).sort().reduce((clone, key) => {
    clone[key] = cloneValue(value[key]);
    return clone;
  }, {});
}

function freezeValue(value) {
  if (
    !value
    || typeof value !== "object"
    || ArrayBuffer.isView(value)
    || Object.isFrozen(value)
  ) {
    return value;
  }

  Object.values(value).forEach(freezeValue);
  return Object.freeze(value);
}
