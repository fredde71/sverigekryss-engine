import {
  createOuterLineCenterObservation
} from "../analysis/OuterLineCenterObservation";

const ALLOWED_ENVIRONMENTS = new Set(["development", "test"]);
const GRID_ANALYSIS_EXPERIMENT_ID = "shadow-grid-analysis-diagnostics";
const GRID_BOUNDS_EXPERIMENT_ID =
  "shadow-grid-bounds-observation-diagnostics";
const EDGE_ORDER = Object.freeze(["top", "bottom", "left", "right"]);

export const shadowOuterLineCenterObservationDiagnosticsExperiment =
  Object.freeze({
    id: "shadow-outer-line-center-observation-diagnostics",
    description: "Preserve development-only evidence for accepted outer line centers without refining or moving them.",
    run(_binaryImage, _context, execution) {
      return runShadowOuterLineCenterObservationDiagnostics({
        shadowGridAnalysis: execution?.getSuccessfulDiagnostics?.(
          GRID_ANALYSIS_EXPERIMENT_ID
        ) ?? null,
        gridBoundsObservations: execution?.getSuccessfulDiagnostics?.(
          GRID_BOUNDS_EXPERIMENT_ID
        ) ?? null
      });
    }
  });

export function createShadowOuterLineCenterObservationDiagnosticsRunner({
  createObservation = createOuterLineCenterObservation,
  readEnvironment = () => process.env.NODE_ENV
} = {}) {
  validateDependency(createObservation, "createObservation");
  validateDependency(readEnvironment, "readEnvironment");

  return function run(input = {}) {
    assertDevelopmentEnvironment(readEnvironment());
    const sourceFailure = validateSources(input);

    if (sourceFailure) {
      return freezeValue({
        type: "shadow-outer-line-center-observation-diagnostics",
        version: 1,
        status: "unavailable",
        sourceExperimentIds: sourceExperimentIds(),
        reason: sourceFailure,
        providers: []
      });
    }

    const providers = input.gridBoundsObservations.providers.map(provider => (
      observeProvider(provider, input.shadowGridAnalysis, createObservation)
    ));

    return freezeValue({
      type: "shadow-outer-line-center-observation-diagnostics",
      version: 1,
      status: "complete",
      sourceExperimentIds: sourceExperimentIds(),
      reason: null,
      providers
    });
  };
}

export const runShadowOuterLineCenterObservationDiagnostics =
  createShadowOuterLineCenterObservationDiagnosticsRunner();

function observeProvider(boundsProvider, shadowGridAnalysis, createObservation) {
  const providerId = boundsProvider?.id;
  const gridProvider = findProvider(shadowGridAnalysis, providerId);
  const result = {
    id: providerId,
    description: boundsProvider?.description,
    status: boundsProvider?.status,
    regionCount: boundsProvider?.regionCount,
    reason: cloneValue(boundsProvider?.reason ?? null),
    outerLineCenterObservations: []
  };

  if (boundsProvider?.status !== "available") {
    return result;
  }

  const regions = Array.isArray(boundsProvider.boundsObservations)
    ? boundsProvider.boundsObservations
    : [];

  result.outerLineCenterObservations = regions.map(boundsRegion => (
    observeRegion({
      providerId,
      boundsRegion,
      gridAnalysis: findRegion(
        gridProvider?.gridAnalyses,
        boundsRegion?.regionId
      ),
      createObservation
    })
  ));
  return result;
}

function observeRegion({
  providerId,
  boundsRegion,
  gridAnalysis,
  createObservation
}) {
  const regionId = boundsRegion?.regionId;
  const boundsObservation = boundsRegion?.boundsObservation;

  if (!boundsObservation?.coordinateSystem) {
    return failedRegion(
      providerId,
      regionId,
      "grid-bounds-coordinate-system-unavailable"
    );
  }

  try {
    const centers = readAcceptedCenters(boundsObservation, gridAnalysis);
    const edges = EDGE_ORDER.reduce((result, edge) => {
      result[edge] = createEdgeObservation({
        edge,
        center: centers[edge],
        providerId,
        regionId,
        boundsObservation,
        gridAnalysis
      });
      return result;
    }, {});
    const observation = createObservation({
      analysisRegionId: regionId,
      coordinateSystem: boundsObservation.coordinateSystem,
      edges,
      provenance: {
        source: "shadow-outer-line-center-observation-diagnostics",
        providerId,
        regionId,
        method: "preserve-accepted-outer-candidate-centers"
      },
      assumptions: [{
        id: "accepted-candidate-centers-remain-unchanged",
        status: "applied"
      }],
      diagnostics: [{
        type: "outer-line-center-shadow-plumbing",
        edgeStatuses: EDGE_ORDER.map(edge => ({
          edge,
          status: edges[edge].status
        }))
      }],
      evidenceReferences: [
        {
          experimentId: GRID_ANALYSIS_EXPERIMENT_ID,
          providerId,
          regionId
        },
        {
          experimentId: GRID_BOUNDS_EXPERIMENT_ID,
          providerId,
          regionId
        }
      ]
    });

    return {
      providerId,
      regionId,
      status: "completed",
      observation,
      error: null
    };
  } catch (error) {
    return {
      providerId,
      regionId,
      status: "failed",
      observation: null,
      error: normalizeError(error)
    };
  }
}

function readAcceptedCenters(boundsObservation, gridAnalysis) {
  const envelope = boundsObservation?.sourceAcceptedCandidateEnvelope;

  if (envelope?.status === "available" && hasFiniteBounds(envelope.bounds)) {
    return {
      top: envelope.bounds.top,
      bottom: envelope.bounds.top + envelope.bounds.height,
      left: envelope.bounds.left,
      right: envelope.bounds.left + envelope.bounds.width
    };
  }

  return {
    top: readOuterCandidatePosition(gridAnalysis, "horizontal", "first"),
    bottom: readOuterCandidatePosition(gridAnalysis, "horizontal", "last"),
    left: readOuterCandidatePosition(gridAnalysis, "vertical", "first"),
    right: readOuterCandidatePosition(gridAnalysis, "vertical", "last")
  };
}

function readOuterCandidatePosition(gridAnalysis, axis, end) {
  const positions = gridAnalysis?.candidatePositions?.[axis];

  if (!Array.isArray(positions) || positions.length < 2) {
    return null;
  }

  const position = end === "first" ? positions[0] : positions[positions.length - 1];
  return Number.isFinite(position) ? position : null;
}

function createEdgeObservation({
  edge,
  center,
  providerId,
  regionId,
  boundsObservation,
  gridAnalysis
}) {
  const axis = edge === "top" || edge === "bottom"
    ? "horizontal"
    : "vertical";
  const candidatePositions = Array.isArray(
    gridAnalysis?.candidatePositions?.[axis]
  )
    ? gridAnalysis.candidatePositions[axis]
    : [];
  const candidateIndex = findCandidateIndex(candidatePositions, center);
  const centerAvailable = Number.isFinite(center);
  const reasons = centerAvailable
    ? [
      { code: "candidate-run-geometry-unavailable" },
      { code: "projection-evidence-unavailable" },
      { code: "continuity-evidence-unavailable" },
      { code: "neighborhood-observation-extent-unavailable" }
    ]
    : [{ code: "accepted-outer-candidate-center-unavailable" }];

  return {
    edge,
    status: centerAvailable ? "partial" : "unavailable",
    acceptedCandidateCenter: centerAvailable ? center : null,
    candidateRunGeometry: null,
    projectionEvidence: null,
    continuityObservations: [],
    neighborhoodObservationExtent: null,
    provenance: {
      source: centerAvailable
        ? "accepted-candidate-envelope"
        : "shadow-grid-analysis-diagnostics",
      providerId,
      regionId,
      axis,
      edge
    },
    assumptions: [{
      id: "accepted-candidate-center-is-observed-not-refined",
      status: "applied"
    }],
    diagnostics: [{
      type: "outer-line-center-edge-evidence-availability",
      candidateCenterAvailable: centerAvailable,
      candidateRunGeometryAvailable: false,
      projectionEvidenceAvailable: false,
      continuityEvidenceAvailable: false,
      neighborhoodObservationExtentAvailable: false
    }],
    evidenceReferences: createEdgeEvidenceReferences({
      edge,
      axis,
      candidateIndex,
      providerId,
      regionId,
      boundsObservation
    }),
    reasons
  };
}

function createEdgeEvidenceReferences({
  edge,
  axis,
  candidateIndex,
  providerId,
  regionId,
  boundsObservation
}) {
  const references = [{
    experimentId: GRID_BOUNDS_EXPERIMENT_ID,
    artifactType: boundsObservation.type,
    source: "sourceAcceptedCandidateEnvelope",
    edge,
    providerId,
    regionId
  }];

  if (candidateIndex !== null) {
    references.push({
      experimentId: GRID_ANALYSIS_EXPERIMENT_ID,
      source: "candidatePositions",
      axis,
      candidateIndex,
      providerId,
      regionId
    });
  }

  return references;
}

function findCandidateIndex(positions, center) {
  const index = positions.findIndex(position => position === center);
  return index >= 0 ? index : null;
}

function validateSources({ shadowGridAnalysis, gridBoundsObservations }) {
  if (
    shadowGridAnalysis?.type !== GRID_ANALYSIS_EXPERIMENT_ID
    || !Array.isArray(shadowGridAnalysis.providers)
  ) {
    return "shadow-grid-analysis-diagnostics-unavailable";
  }

  if (
    gridBoundsObservations?.type !== GRID_BOUNDS_EXPERIMENT_ID
    || !Array.isArray(gridBoundsObservations.providers)
  ) {
    return "shadow-grid-bounds-observation-diagnostics-unavailable";
  }

  return null;
}

function sourceExperimentIds() {
  return [GRID_ANALYSIS_EXPERIMENT_ID, GRID_BOUNDS_EXPERIMENT_ID];
}

function findProvider(diagnostics, providerId) {
  return diagnostics?.providers?.find(provider => provider?.id === providerId)
    ?? null;
}

function findRegion(regions, regionId) {
  return Array.isArray(regions)
    ? regions.find(region => region?.regionId === regionId) ?? null
    : null;
}

function failedRegion(providerId, regionId, message) {
  return {
    providerId,
    regionId,
    status: "failed",
    observation: null,
    error: { name: "Error", message }
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

function assertDevelopmentEnvironment(environment) {
  if (!ALLOWED_ENVIRONMENTS.has(environment)) {
    throw new Error(
      "Shadow outer line center observations are available only in development or test"
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
