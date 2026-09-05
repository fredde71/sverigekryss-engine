import {
  observeOuterLineGeometryEdge
} from "../analysis/reconstruction/OuterLineGeometryObservation";

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
  return observeOuterLineGeometryEdge({
    edge,
    sourceEdge,
    coordinateSystem,
    binaryImage,
    provenance: {
      source: "shadow-outer-line-center-geometry-diagnostics",
      sourceExperimentId: SOURCE_EXPERIMENT_ID,
      providerId,
      regionId,
      edge
    }
  });
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
