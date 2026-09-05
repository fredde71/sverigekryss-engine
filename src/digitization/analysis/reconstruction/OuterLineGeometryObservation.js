const EDGE_ORDER = Object.freeze(["top", "bottom", "left", "right"]);
export const OUTER_LINE_GEOMETRY_NEIGHBORHOOD_RADIUS = 4;

export function createOuterLineGeometryObservation({
  parentBinaryImage,
  analysisRegion,
  lineCandidates,
  coordinateSystem,
  neighborhoodRadius = OUTER_LINE_GEOMETRY_NEIGHBORHOOD_RADIUS,
  provenance = {}
} = {}) {
  const binaryImage = snapshotBinaryImage(parentBinaryImage);
  validateAnalysisRegion(analysisRegion);
  validateCoordinateSystem(coordinateSystem);
  validateNeighborhoodRadius(neighborhoodRadius);

  const edges = Object.fromEntries(EDGE_ORDER.map(edge => {
    const candidate = readOuterCandidate(lineCandidates, edge);
    const sourceEdge = createNeighborhoodEdge({
      edge,
      candidate,
      binaryImage,
      analysisRegion,
      neighborhoodRadius
    });

    return [edge, observeOuterLineGeometryEdge({
      edge,
      sourceEdge,
      coordinateSystem,
      binaryImage,
      provenance: {
        source: provenance.source ?? "production-digitization-analysis",
        providerId: provenance.providerId ?? null,
        regionId: analysisRegion.id,
        edge,
        method: "factual-boundary-neighborhood-geometry"
      },
      positionTransform: createParentToLocalTransform(
        analysisRegion.coordinateRelationship.localToBinaryImage,
        edge
      ),
      includeObservationSpaceCenter: true
    })];
  }));

  return freezeValue({
    type: "outer-line-center-geometry-observation",
    version: 1,
    analysisRegionId: analysisRegion.id,
    coordinateSystem: cloneValue(coordinateSystem),
    edgeOrder: EDGE_ORDER.slice(),
    edges,
    provenance: {
      ...cloneValue(provenance),
      method: "factual-boundary-neighborhood-geometry"
    },
    assumptions: [{
      id: "accepted-candidate-center-remains-unchanged",
      status: "applied"
    }],
    evidenceReferences: [{
      artifactType: "grid-analysis",
      analysisRegionId: analysisRegion.id,
      evidence: "accepted-outer-candidates-and-parent-binary-image-neighborhood"
    }]
  });
}

export function observeOuterLineGeometryEdge({
  edge,
  sourceEdge,
  coordinateSystem,
  binaryImage: sourceBinaryImage,
  provenance,
  positionTransform = value => value,
  includeObservationSpaceCenter = false
}) {
  const binaryImage = snapshotBinaryImage(sourceBinaryImage);
  const acceptedLocalCenter = sourceEdge?.acceptedCandidateCenter;
  const projection = sourceEdge?.projectionEvidence;
  const extent = sourceEdge?.neighborhoodObservationExtent;
  const acceptedParentCenter = projection?.acceptedCenterInParentBinaryImage;
  const rawProjectionSamples = createRawProjectionSamples(projection);
  const acceptedObservationCenter = Number.isFinite(acceptedParentCenter)
    ? positionTransform(acceptedParentCenter)
    : null;
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
    provenance: cloneValue(provenance ?? null),
    reasons: []
  };

  if (includeObservationSpaceCenter) {
    base.acceptedCenterInObservationSpace = acceptedObservationCenter;
  }

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
    acceptedCenter: acceptedObservationCenter,
    tangentialLength: axis === "horizontal"
      ? extent.bounds.width
      : extent.bounds.height,
    positionTransform
  });

  base.geometry = geometry.value;
  base.geometryStatus = geometry.status;
  base.diagnostics = [{
    type: "outer-line-center-geometry-source-evidence",
    parentBinaryImageSampleCount: parentSamples.length,
    sourceProjectionSampleCount: rawProjectionSamples.length,
    sourceProjectionMatchesParentBinaryImage: compareSamples(
      rawProjectionSamples,
      parentSamples
    )
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

function createNeighborhoodEdge({
  edge,
  candidate,
  binaryImage,
  analysisRegion,
  neighborhoodRadius
}) {
  if (!candidate || !Number.isFinite(candidate.position)) {
    return {
      edge,
      status: "unavailable",
      acceptedCandidateCenter: null,
      candidateRunGeometry: null,
      projectionEvidence: null,
      continuityObservations: [],
      neighborhoodObservationExtent: null,
      provenance: { source: "production-grid-analysis", edge },
      evidenceReferences: [],
      reasons: [{ code: "accepted-candidate-center-unavailable" }]
    };
  }

  const axis = isHorizontalEdge(edge) ? "horizontal" : "vertical";
  const transform = analysisRegion.coordinateRelationship.localToBinaryImage;
  const parentCenter = axis === "horizontal"
    ? transform.offsetY + candidate.position * transform.scaleY
    : transform.offsetX + candidate.position * transform.scaleX;
  const regionBounds = normalizeRegionBounds(analysisRegion.bounds, binaryImage);
  const extent = createNeighborhoodExtent({
    axis,
    parentCenter,
    regionBounds,
    binaryImage,
    neighborhoodRadius
  });
  const samples = readNeighborhoodSamples(binaryImage, extent, axis);

  return {
    edge,
    status: "available",
    acceptedCandidateCenter: candidate.position,
    candidateRunGeometry: createCandidateRunGeometry(candidate),
    projectionEvidence: {
      axis,
      coordinateSpace: "parent-binary-image",
      acceptedCenterInParentBinaryImage: parentCenter,
      positions: samples.map(sample => sample.position),
      values: samples.map(sample => sample.projectionValue)
    },
    continuityObservations: samples.map(sample => ({
      position: sample.position,
      signedOffsetFromAcceptedCenter: sample.position - parentCenter,
      blackPixelCount: sample.projectionValue,
      longestContinuousBlackRun: sample.longestContinuousBlackRun
    })),
    neighborhoodObservationExtent: extent,
    provenance: {
      source: "production-grid-analysis",
      axis,
      edge,
      acceptedCenterCoordinateSpace: "analysis-region-local",
      observedCoordinateSpace: "parent-binary-image",
      localToBinaryImage: cloneValue(transform)
    },
    evidenceReferences: [{
      artifactType: "grid-analysis",
      source: "accepted-line-candidate",
      axis,
      edge
    }],
    reasons: []
  };
}

function createCandidateRunGeometry(candidate) {
  if (!Number.isFinite(candidate.start) || !Number.isFinite(candidate.end)) {
    return null;
  }
  return {
    start: candidate.start,
    end: candidate.end,
    thickness: Number.isFinite(candidate.thickness)
      ? candidate.thickness
      : candidate.end - candidate.start + 1
  };
}

function createGeometry({
  projectionSamples,
  continuity,
  acceptedCenter,
  tangentialLength,
  positionTransform
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
  const parentFullContinuityPositions = continuity
    .filter(observation => (
      Number.isFinite(observation?.position)
      && observedPositions.has(observation.position)
      && observation.longestContinuousBlackRun === tangentialLength
    ))
    .map(observation => observation.position);
  const parentStrongestProjectionPositions = projectionSamples
    .filter(sample => sample.value === maximumProjectionValue)
    .map(sample => sample.position);
  const parentStrongOrFullPositions = uniqueSortedPositions([
    ...parentStrongestProjectionPositions,
    ...parentFullContinuityPositions
  ]);
  const strongOrFullRuns = createPositionRuns(
    parentStrongOrFullPositions,
    acceptedCenter,
    undefined,
    positionTransform
  );
  const maximumProjectionPlateaus = createPositionRuns(
    parentStrongestProjectionPositions,
    acceptedCenter,
    maximumProjectionValue,
    positionTransform
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
  const parentCentroid = projectionSamples.reduce(
    (sum, sample) => sum + sample.position * sample.value,
    0
  ) / projectionWeightTotal;
  const centroid = derivedPosition(
    positionTransform(parentCentroid),
    acceptedCenter
  );
  const firstPosition = positionTransform(parentStrongOrFullPositions[0]);
  const lastPosition = positionTransform(
    parentStrongOrFullPositions[parentStrongOrFullPositions.length - 1]
  );
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
        fullContinuityPositions: parentFullContinuityPositions.map(
          positionTransform
        ),
        strongestProjectionPositions: parentStrongestProjectionPositions.map(
          positionTransform
        )
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

function createPositionRuns(
  positions,
  acceptedCenter,
  projectionValue,
  positionTransform
) {
  if (positions.length === 0) return [];
  const runs = [];
  let start = positions[0];
  let end = start;

  for (let index = 1; index <= positions.length; index++) {
    const position = positions[index];
    if (position === end + 1) {
      end = position;
      continue;
    }
    const run = {
      start: derivedPosition(positionTransform(start), acceptedCenter),
      end: derivedPosition(positionTransform(end), acceptedCenter),
      thickness: end - start + 1,
      midpoint: derivedPosition(
        positionTransform(start + ((end - start) / 2)),
        acceptedCenter
      )
    };
    if (projectionValue !== undefined) run.projectionValue = projectionValue;
    runs.push(run);
    start = position;
    end = position;
  }
  return runs;
}

function createNeighborhoodExtent({
  axis,
  parentCenter,
  regionBounds,
  binaryImage,
  neighborhoodRadius
}) {
  const normalStart = Math.max(0, Math.floor(parentCenter - neighborhoodRadius));
  const normalEnd = Math.min(
    axis === "horizontal" ? binaryImage.height - 1 : binaryImage.width - 1,
    Math.ceil(parentCenter + neighborhoodRadius)
  );
  const left = axis === "horizontal" ? regionBounds.left : normalStart;
  const right = axis === "horizontal" ? regionBounds.right : normalEnd;
  const top = axis === "horizontal" ? normalStart : regionBounds.top;
  const bottom = axis === "horizontal" ? normalEnd : regionBounds.bottom;

  return {
    coordinateSpace: "parent-binary-image",
    bounds: {
      top,
      left,
      width: right - left + 1,
      height: bottom - top + 1
    },
    normalRadius: neighborhoodRadius,
    acceptedCenterInParentBinaryImage: parentCenter,
    analysisRegionBounds: {
      top: regionBounds.top,
      left: regionBounds.left,
      width: regionBounds.right - regionBounds.left + 1,
      height: regionBounds.bottom - regionBounds.top + 1
    },
    clippedToDocumentBounds: normalStart !== Math.floor(parentCenter - neighborhoodRadius)
      || normalEnd !== Math.ceil(parentCenter + neighborhoodRadius)
  };
}

function readNeighborhoodSamples(binaryImage, extent, axis) {
  const bounds = extent.bounds;
  const normalStart = axis === "horizontal" ? bounds.top : bounds.left;
  const normalLength = axis === "horizontal" ? bounds.height : bounds.width;
  const samples = [];

  for (let normalOffset = 0; normalOffset < normalLength; normalOffset++) {
    const position = normalStart + normalOffset;
    let projectionValue = 0;
    let longestContinuousBlackRun = 0;
    let currentRun = 0;
    const tangentialLength = axis === "horizontal" ? bounds.width : bounds.height;

    for (let tangentOffset = 0; tangentOffset < tangentialLength; tangentOffset++) {
      const x = axis === "horizontal" ? bounds.left + tangentOffset : position;
      const y = axis === "horizontal" ? position : bounds.top + tangentOffset;
      const value = binaryImage.data[(y * binaryImage.width) + x] === 1 ? 1 : 0;
      projectionValue += value;
      currentRun = value === 1 ? currentRun + 1 : 0;
      longestContinuousBlackRun = Math.max(longestContinuousBlackRun, currentRun);
    }
    samples.push({ position, projectionValue, longestContinuousBlackRun });
  }
  return samples;
}

function readParentSamples(binaryImage, bounds, axis) {
  return readNeighborhoodSamples(binaryImage, { bounds }, axis).map(sample => ({
    position: sample.position,
    value: sample.projectionValue
  }));
}

function normalizeRegionBounds(bounds, binaryImage) {
  const left = clamp(Math.floor(bounds.left), 0, binaryImage.width - 1);
  const top = clamp(Math.floor(bounds.top), 0, binaryImage.height - 1);
  return {
    left,
    top,
    right: clamp(Math.ceil(bounds.left + bounds.width) - 1, left, binaryImage.width - 1),
    bottom: clamp(Math.ceil(bounds.top + bounds.height) - 1, top, binaryImage.height - 1)
  };
}

function readOuterCandidate(lineCandidates, edge) {
  const axis = isHorizontalEdge(edge) ? "horizontal" : "vertical";
  const candidates = Array.isArray(lineCandidates?.[axis])
    ? lineCandidates[axis]
    : [];
  if (candidates.length < 2) return null;
  return edge === "top" || edge === "left"
    ? candidates[0]
    : candidates[candidates.length - 1];
}

function createParentToLocalTransform(transform, edge) {
  const horizontal = isHorizontalEdge(edge);
  const offset = horizontal ? transform.offsetY : transform.offsetX;
  const scale = horizontal ? transform.scaleY : transform.scaleX;
  return position => (position - offset) / scale;
}

function createRawProjectionSamples(projection) {
  const positions = projection?.positions;
  const values = projection?.values;
  if (!Array.isArray(positions) || !Array.isArray(values)) return [];
  const samples = [];
  for (let index = 0; index < Math.min(positions.length, values.length); index++) {
    if (Number.isFinite(positions[index]) && Number.isFinite(values[index])) {
      samples.push({ position: positions[index], value: values[index] });
    }
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

function derivedPosition(position, acceptedCenter) {
  return {
    position,
    signedOffsetFromAcceptedCenter: position - acceptedCenter
  };
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

function validateAnalysisRegion(region) {
  const transform = region?.coordinateRelationship?.localToBinaryImage;
  if (
    typeof region?.id !== "string"
    || !hasFiniteBounds(region?.bounds)
    || !transform
    || ["offsetX", "offsetY", "scaleX", "scaleY"].some(
      field => !Number.isFinite(transform[field])
    )
    || transform.scaleX <= 0
    || transform.scaleY <= 0
  ) {
    throw new Error("AnalysisRegion coordinate evidence is required");
  }
}

function validateCoordinateSystem(value) {
  if (!value || typeof value !== "object" || typeof value.space !== "string") {
    throw new Error("Outer-line geometry coordinate system is required");
  }
}

function validateNeighborhoodRadius(value) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("neighborhoodRadius must be a positive integer");
  }
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

function hasFiniteBounds(bounds) {
  return Boolean(bounds)
    && Number.isFinite(bounds.top)
    && Number.isFinite(bounds.left)
    && Number.isFinite(bounds.width)
    && bounds.width > 0
    && Number.isFinite(bounds.height)
    && bounds.height > 0;
}

function isHorizontalEdge(edge) {
  return edge === "top" || edge === "bottom";
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((clone, key) => {
    clone[key] = cloneValue(value[key]);
    return clone;
  }, {});
}

function freezeValue(value) {
  if (!value || typeof value !== "object" || ArrayBuffer.isView(value) || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(freezeValue);
  return Object.freeze(value);
}
