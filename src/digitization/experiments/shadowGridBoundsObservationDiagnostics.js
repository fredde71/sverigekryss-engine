import {
  createGridBoundsObservation
} from "../analysis/GridBoundsObservation";

const ALLOWED_ENVIRONMENTS = new Set(["development", "test"]);
const SOURCE_EXPERIMENT_ID = "shadow-grid-analysis-diagnostics";
const OUTER_BOUNDS_UNAVAILABLE_REASON =
  "outer-grid-line-center-envelope-not-established";

export const shadowGridBoundsObservationDiagnosticsExperiment = Object.freeze({
  id: "shadow-grid-bounds-observation-diagnostics",
  description: "Preserve Phase 4 accepted-candidate envelopes as development-only GridBoundsObservation artifacts without inferring outer grid bounds.",
  run(_binaryImage, _context, execution) {
    return runShadowGridBoundsObservationDiagnostics(
      execution?.getSuccessfulDiagnostics?.(SOURCE_EXPERIMENT_ID) ?? null
    );
  }
});

export function createShadowGridBoundsObservationDiagnosticsRunner({
  createObservation = createGridBoundsObservation,
  readEnvironment = () => process.env.NODE_ENV
} = {}) {
  validateDependency(createObservation, "createObservation");
  validateDependency(readEnvironment, "readEnvironment");

  return function run(shadowGridAnalysis) {
    assertDevelopmentEnvironment(readEnvironment());

    if (
      !shadowGridAnalysis
      || shadowGridAnalysis.type !== "shadow-grid-analysis-diagnostics"
      || !Array.isArray(shadowGridAnalysis.providers)
    ) {
      return freezeValue({
        type: "shadow-grid-bounds-observation-diagnostics",
        version: 1,
        status: "unavailable",
        sourceExperimentId: SOURCE_EXPERIMENT_ID,
        reason: "shadow-grid-analysis-diagnostics-unavailable",
        providers: []
      });
    }

    const providers = shadowGridAnalysis.providers.map(provider => (
      observeProvider(provider, createObservation)
    ));

    return freezeValue({
      type: "shadow-grid-bounds-observation-diagnostics",
      version: 1,
      status: "complete",
      sourceExperimentId: SOURCE_EXPERIMENT_ID,
      reason: null,
      providers
    });
  };
}

export const runShadowGridBoundsObservationDiagnostics =
  createShadowGridBoundsObservationDiagnosticsRunner();

function observeProvider(provider, createObservation) {
  const result = {
    id: provider?.id,
    description: provider?.description,
    status: provider?.status,
    regionCount: provider?.regionCount,
    reason: cloneValue(provider?.reason ?? null),
    boundsObservations: []
  };

  if (provider?.status !== "available") {
    return result;
  }

  const gridAnalyses = Array.isArray(provider.gridAnalyses)
    ? provider.gridAnalyses
    : [];

  for (const gridAnalysis of gridAnalyses) {
    result.boundsObservations.push(observeRegion(
      provider.id,
      gridAnalysis,
      createObservation
    ));
  }

  return result;
}

function observeRegion(providerId, gridAnalysis, createObservation) {
  const regionId = gridAnalysis?.regionId;
  const coordinateSystem = createCoordinateSystem(
    providerId,
    regionId,
    gridAnalysis?.regionBounds
  );
  const sourceEnvelope = createSourceEnvelope(gridAnalysis);

  try {
    const boundsObservation = createObservation({
      analysisRegionId: regionId,
      status: "unavailable",
      sourceAcceptedCandidateEnvelope: sourceEnvelope,
      coordinateSystem,
      provenance: {
        source: SOURCE_EXPERIMENT_ID,
        providerId,
        regionId,
        method: "phase-2-shadow-plumbing-no-bounds-inference"
      },
      observations: [],
      reasons: [{ code: OUTER_BOUNDS_UNAVAILABLE_REASON }],
      diagnostics: [{
        type: "grid-bounds-observation-shadow-plumbing",
        status: "unavailable",
        reason: OUTER_BOUNDS_UNAVAILABLE_REASON
      }]
    });

    return {
      providerId,
      regionId,
      status: "completed",
      boundsObservation,
      error: null
    };
  } catch (error) {
    return {
      providerId,
      regionId,
      status: "failed",
      boundsObservation: null,
      error: normalizeError(error)
    };
  }
}

function createSourceEnvelope(gridAnalysis) {
  const bounds = gridAnalysis?.geometry?.bounds;
  const provenance = {
    source: "phase-4-shadow-grid-geometry",
    derivation: "outermost-accepted-horizontal-and-vertical-candidate-positions"
  };

  if (
    gridAnalysis?.geometry?.status !== "available"
    || !hasFiniteBounds(bounds)
  ) {
    return {
      status: "unavailable",
      semantics: "accepted-candidate-envelope",
      coordinateSpace: "analysis-region-local",
      bounds: null,
      reason: "accepted-candidate-envelope-unavailable",
      provenance
    };
  }

  return {
    status: "available",
    semantics: "accepted-candidate-envelope",
    coordinateSpace: "analysis-region-local",
    bounds: cloneValue(bounds),
    provenance
  };
}

function createCoordinateSystem(providerId, regionId, regionBounds) {
  return {
    space: "analysis-region-local",
    origin: "top-left",
    xDirection: "right",
    yDirection: "down",
    linePosition: "visual-line-center",
    localToBinaryImage: {
      offsetX: finiteOrZero(regionBounds?.left),
      offsetY: finiteOrZero(regionBounds?.top),
      scaleX: 1,
      scaleY: 1
    },
    provenance: {
      source: SOURCE_EXPERIMENT_ID,
      providerId,
      regionId,
      regionBounds: cloneValue(regionBounds ?? null),
      relationship: "analysis-region-local-to-rendered-binary-image"
    }
  };
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

function finiteOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}

function assertDevelopmentEnvironment(environment) {
  if (!ALLOWED_ENVIRONMENTS.has(environment)) {
    throw new Error(
      "Shadow grid bounds observations are available only in development or test"
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
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(freezeValue);
  return Object.freeze(value);
}
