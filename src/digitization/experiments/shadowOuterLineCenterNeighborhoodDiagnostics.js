import {
  createOuterLineCenterObservation
} from "../analysis/OuterLineCenterObservation";

const ALLOWED_ENVIRONMENTS = new Set(["development", "test"]);
const SOURCE_EXPERIMENT_ID =
  "shadow-outer-line-center-observation-diagnostics";
const EDGE_ORDER = Object.freeze(["top", "bottom", "left", "right"]);

export const OUTER_LINE_CENTER_NEIGHBORHOOD_RADIUS = 4;

export const shadowOuterLineCenterNeighborhoodDiagnosticsExperiment =
  Object.freeze({
    id: "shadow-outer-line-center-neighborhood-diagnostics",
    description: "Observe development-only parent-image neighborhoods around accepted outer line centers without refining them.",
    run(binaryImage, _context, execution) {
      return runShadowOuterLineCenterNeighborhoodDiagnostics({
        outerLineCenterObservations:
          execution?.getSuccessfulDiagnostics?.(SOURCE_EXPERIMENT_ID) ?? null,
        binaryImage
      });
    }
  });

export function createShadowOuterLineCenterNeighborhoodDiagnosticsRunner({
  createObservation = createOuterLineCenterObservation,
  readEnvironment = () => process.env.NODE_ENV,
  neighborhoodRadius = OUTER_LINE_CENTER_NEIGHBORHOOD_RADIUS
} = {}) {
  validateDependency(createObservation, "createObservation");
  validateDependency(readEnvironment, "readEnvironment");
  validateNeighborhoodRadius(neighborhoodRadius);

  return function run(input = {}) {
    assertDevelopmentEnvironment(readEnvironment());
    const source = input.outerLineCenterObservations;

    if (
      source?.type !== SOURCE_EXPERIMENT_ID
      || !Array.isArray(source.providers)
    ) {
      return freezeValue({
        type: "shadow-outer-line-center-neighborhood-diagnostics",
        version: 1,
        status: "unavailable",
        sourceExperimentId: SOURCE_EXPERIMENT_ID,
        reason: "outer-line-center-observations-unavailable",
        neighborhoodRadius,
        providers: []
      });
    }

    const documentAnalysis = input.documentAnalysis
      ?? createDocumentAnalysisEvidence(input.binaryImage);
    const binaryImage = snapshotDocumentBinaryImage(documentAnalysis);
    const providers = source.providers.map(provider => observeProvider({
      provider,
      documentAnalysis,
      binaryImage,
      createObservation,
      neighborhoodRadius
    }));

    return freezeValue({
      type: "shadow-outer-line-center-neighborhood-diagnostics",
      version: 1,
      status: "complete",
      sourceExperimentId: SOURCE_EXPERIMENT_ID,
      reason: null,
      neighborhoodRadius,
      documentAnalysis: {
        type: documentAnalysis.type,
        status: documentAnalysis.status,
        binaryImageDimensions: {
          width: binaryImage.width,
          height: binaryImage.height
        },
        coordinateRelationship: cloneValue(
          documentAnalysis.coordinateRelationship ?? null
        )
      },
      providers
    });
  };
}

export const runShadowOuterLineCenterNeighborhoodDiagnostics =
  createShadowOuterLineCenterNeighborhoodDiagnosticsRunner();

function observeProvider({
  provider,
  documentAnalysis,
  binaryImage,
  createObservation,
  neighborhoodRadius
}) {
  const regions = Array.isArray(provider?.outerLineCenterObservations)
    ? provider.outerLineCenterObservations
    : [];
  const result = {
    id: provider?.id,
    description: provider?.description,
    status: provider?.status,
    regionCount: provider?.regionCount,
    reason: cloneValue(provider?.reason ?? null),
    neighborhoodObservations: []
  };

  if (provider?.status !== "available") {
    return result;
  }

  result.neighborhoodObservations = regions.map(region => observeRegion({
    providerId: provider.id,
    region,
    documentAnalysis,
    binaryImage,
    createObservation,
    neighborhoodRadius
  }));
  return result;
}

function observeRegion({
  providerId,
  region,
  documentAnalysis,
  binaryImage,
  createObservation,
  neighborhoodRadius
}) {
  const sourceObservation = region?.observation;
  const regionId = region?.regionId;

  if (region?.status !== "completed" || !sourceObservation) {
    return unavailableRegion(
      providerId,
      regionId,
      "outer-line-center-observation-unavailable"
    );
  }

  try {
    const edges = EDGE_ORDER.reduce((result, edge) => {
      result[edge] = observeEdge({
        edge,
        sourceEdge: sourceObservation.edges?.[edge],
        coordinateSystem: sourceObservation.coordinateSystem,
        binaryImage,
        neighborhoodRadius,
        providerId,
        regionId
      });
      return result;
    }, {});
    const observation = createObservation({
      analysisRegionId: sourceObservation.analysisRegionId,
      coordinateSystem: sourceObservation.coordinateSystem,
      edges,
      provenance: {
        source: "shadow-outer-line-center-neighborhood-diagnostics",
        sourceExperimentId: SOURCE_EXPERIMENT_ID,
        providerId,
        regionId,
        documentAnalysisType: documentAnalysis.type,
        method: "read-only-parent-binary-image-boundary-neighborhood"
      },
      assumptions: [{
        id: "accepted-candidate-center-remains-unchanged",
        status: "applied"
      }],
      diagnostics: [{
        type: "outer-line-center-boundary-neighborhood-observation",
        neighborhoodRadius,
        edgeOrder: EDGE_ORDER.slice()
      }],
      evidenceReferences: [
        {
          experimentId: SOURCE_EXPERIMENT_ID,
          providerId,
          regionId
        },
        {
          artifactType: "document-analysis",
          evidence: "parent-binary-image"
        }
      ]
    });

    return {
      providerId,
      regionId,
      status: "completed",
      sourceObservation,
      observation,
      error: null
    };
  } catch (error) {
    return {
      providerId,
      regionId,
      status: "failed",
      sourceObservation,
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
  neighborhoodRadius,
  providerId,
  regionId
}) {
  const acceptedCenter = sourceEdge?.acceptedCandidateCenter;

  if (!Number.isFinite(acceptedCenter)) {
    return {
      edge,
      status: "unavailable",
      acceptedCandidateCenter: null,
      candidateRunGeometry: cloneValue(sourceEdge?.candidateRunGeometry ?? null),
      projectionEvidence: null,
      continuityObservations: [],
      neighborhoodObservationExtent: null,
      provenance: createEdgeProvenance({ edge, providerId, regionId }),
      assumptions: preserveCenterAssumptions(),
      diagnostics: [{
        type: "outer-line-center-boundary-neighborhood-evidence",
        status: "unavailable",
        reason: "accepted-candidate-center-unavailable"
      }],
      evidenceReferences: cloneValue(sourceEdge?.evidenceReferences ?? []),
      reasons: [{ code: "accepted-candidate-center-unavailable" }]
    };
  }

  const axis = isHorizontalEdge(edge) ? "horizontal" : "vertical";
  const transform = coordinateSystem.localToBinaryImage;
  const parentCenter = axis === "horizontal"
    ? transform.offsetY + (acceptedCenter * transform.scaleY)
    : transform.offsetX + (acceptedCenter * transform.scaleX);
  const regionBounds = readRegionBounds(coordinateSystem, binaryImage);
  const extent = createNeighborhoodExtent({
    axis,
    parentCenter,
    regionBounds,
    binaryImage,
    neighborhoodRadius
  });
  const samples = readNeighborhoodSamples(binaryImage, extent, axis);
  const nearbyCandidates = findLocalMaxima(samples, parentCenter, axis, transform);
  const projectionEvidence = {
    axis,
    coordinateSpace: "parent-binary-image",
    acceptedCenterInParentBinaryImage: parentCenter,
    positions: samples.map(sample => sample.position),
    values: samples.map(sample => sample.projectionValue),
    nearbyLineCenterCandidates: nearbyCandidates
  };
  const continuityObservations = samples.map(sample => ({
    position: sample.position,
    signedOffsetFromAcceptedCenter: sample.position - parentCenter,
    blackPixelCount: sample.projectionValue,
    longestContinuousBlackRun: sample.longestContinuousBlackRun
  }));
  const reasons = [];

  if (sourceEdge?.candidateRunGeometry == null) {
    reasons.push({ code: "candidate-run-geometry-unavailable" });
  }

  if (!regionBounds.fromCoordinateProvenance) {
    reasons.push({ code: "analysis-region-bounds-unavailable" });
  }

  return {
    edge,
    status: reasons.length === 0 ? "available" : "partial",
    acceptedCandidateCenter: acceptedCenter,
    candidateRunGeometry: cloneValue(sourceEdge?.candidateRunGeometry ?? null),
    projectionEvidence,
    continuityObservations,
    neighborhoodObservationExtent: extent,
    provenance: {
      ...createEdgeProvenance({ edge, providerId, regionId }),
      axis,
      acceptedCenterCoordinateSpace: coordinateSystem.space,
      observedCoordinateSpace: "parent-binary-image",
      localToBinaryImage: cloneValue(transform)
    },
    assumptions: preserveCenterAssumptions(),
    diagnostics: [{
      type: "outer-line-center-boundary-neighborhood-evidence",
      status: "measured",
      projectionSampleCount: samples.length,
      nearbyLineCenterCandidateCount: nearbyCandidates.length,
      candidateRunGeometryAvailable: sourceEdge?.candidateRunGeometry != null
    }],
    evidenceReferences: [
      ...cloneValue(sourceEdge?.evidenceReferences ?? []),
      {
        artifactType: "document-analysis",
        evidence: "parent-binary-image-neighborhood",
        providerId,
        regionId,
        edge
      }
    ],
    reasons
  };
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
  const left = axis === "horizontal"
    ? regionBounds.left
    : normalStart;
  const right = axis === "horizontal"
    ? regionBounds.right
    : normalEnd;
  const top = axis === "horizontal"
    ? normalStart
    : regionBounds.top;
  const bottom = axis === "horizontal"
    ? normalEnd
    : regionBounds.bottom;

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
  const samples = [];
  const normalStart = axis === "horizontal" ? bounds.top : bounds.left;
  const normalLength = axis === "horizontal" ? bounds.height : bounds.width;

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
      longestContinuousBlackRun = Math.max(
        longestContinuousBlackRun,
        currentRun
      );
    }

    samples.push({ position, projectionValue, longestContinuousBlackRun });
  }

  return samples;
}

function findLocalMaxima(samples, acceptedCenter, axis, transform) {
  const candidates = [];
  let index = 0;

  while (index < samples.length) {
    const startIndex = index;
    const value = samples[index].projectionValue;

    while (
      index + 1 < samples.length
      && samples[index + 1].projectionValue === value
    ) {
      index += 1;
    }

    const endIndex = index;
    const previousValue = startIndex === 0
      ? -Infinity
      : samples[startIndex - 1].projectionValue;
    const nextValue = endIndex === samples.length - 1
      ? -Infinity
      : samples[endIndex + 1].projectionValue;

    if (value > 0 && value >= previousValue && value >= nextValue) {
      const start = samples[startIndex].position;
      const end = samples[endIndex].position;
      const position = start + ((end - start) / 2);
      const scale = axis === "horizontal" ? transform.scaleY : transform.scaleX;
      const offset = axis === "horizontal" ? transform.offsetY : transform.offsetX;

      candidates.push({
        start,
        end,
        position,
        localPosition: (position - offset) / scale,
        projectionValue: value,
        signedOffsetFromAcceptedCenter: position - acceptedCenter
      });
    }

    index += 1;
  }

  return candidates;
}

function readRegionBounds(coordinateSystem, binaryImage) {
  const recorded = coordinateSystem?.provenance?.regionBounds;

  if (hasFiniteBounds(recorded)) {
    const left = clamp(Math.floor(recorded.left), 0, binaryImage.width - 1);
    const top = clamp(Math.floor(recorded.top), 0, binaryImage.height - 1);
    const right = clamp(
      Math.ceil(recorded.left + recorded.width) - 1,
      left,
      binaryImage.width - 1
    );
    const bottom = clamp(
      Math.ceil(recorded.top + recorded.height) - 1,
      top,
      binaryImage.height - 1
    );

    return { top, left, right, bottom, fromCoordinateProvenance: true };
  }

  return {
    top: 0,
    left: 0,
    right: binaryImage.width - 1,
    bottom: binaryImage.height - 1,
    fromCoordinateProvenance: false
  };
}

function createDocumentAnalysisEvidence(binaryImage) {
  return {
    type: "document-analysis",
    version: 1,
    status: "measured",
    binaryImage,
    dimensions: {
      binaryImage: {
        width: binaryImage?.width,
        height: binaryImage?.height
      }
    },
    coordinateRelationship: { type: "identity" },
    diagnostics: []
  };
}

function snapshotDocumentBinaryImage(documentAnalysis) {
  if (
    documentAnalysis?.type !== "document-analysis"
    || documentAnalysis?.status !== "measured"
    || !documentAnalysis.binaryImage
  ) {
    throw new Error("Measured DocumentAnalysis is required");
  }

  const source = documentAnalysis.binaryImage;
  const width = source.width;
  const height = source.height;
  const data = source.data;

  if (
    !Number.isInteger(width)
    || width <= 0
    || !Number.isInteger(height)
    || height <= 0
    || !data
    || data.length < width * height
  ) {
    throw new Error("DocumentAnalysis BinaryImage is invalid");
  }

  return { width, height, data };
}

function createEdgeProvenance({ edge, providerId, regionId }) {
  return {
    source: "shadow-outer-line-center-neighborhood-diagnostics",
    providerId,
    regionId,
    edge
  };
}

function preserveCenterAssumptions() {
  return [{
    id: "accepted-candidate-center-is-observed-not-refined",
    status: "applied"
  }];
}

function unavailableRegion(providerId, regionId, reason) {
  return {
    providerId,
    regionId,
    status: "unavailable",
    sourceObservation: null,
    observation: null,
    reason,
    error: null
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

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function validateNeighborhoodRadius(value) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("neighborhoodRadius must be a positive integer");
  }
}

function assertDevelopmentEnvironment(environment) {
  if (!ALLOWED_ENVIRONMENTS.has(environment)) {
    throw new Error(
      "Shadow outer line center neighborhoods are available only in development or test"
    );
  }
}

function validateDependency(value, name) {
  if (typeof value !== "function") {
    throw new Error(`${name} must be a function`);
  }
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
