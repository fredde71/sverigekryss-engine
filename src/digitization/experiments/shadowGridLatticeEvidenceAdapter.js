const ALLOWED_ENVIRONMENTS = new Set(["development", "test"]);
const SOURCE_EXPERIMENT_ID = "shadow-grid-reconstruction-diagnostics";
const STRATEGY_DIAGNOSTIC_TYPE = "uniform-orthogonal-lattice-strategy";

export function createShadowGridLatticeEvidenceAdapter({
  readEnvironment = () => process.env.NODE_ENV
} = {}) {
  validateDependency(readEnvironment, "readEnvironment");

  return function adapt(shadowGridReconstruction) {
    assertDevelopmentEnvironment(readEnvironment());

    if (
      shadowGridReconstruction?.type !== SOURCE_EXPERIMENT_ID
      || !Array.isArray(shadowGridReconstruction.providers)
    ) {
      return freezeValue({
        type: "shadow-grid-lattice-evidence",
        version: 1,
        status: "unavailable",
        sourceExperimentId: SOURCE_EXPERIMENT_ID,
        reason: "shadow-grid-reconstruction-diagnostics-unavailable",
        providers: []
      });
    }

    return freezeValue({
      type: "shadow-grid-lattice-evidence",
      version: 1,
      status: "complete",
      sourceExperimentId: SOURCE_EXPERIMENT_ID,
      reason: null,
      providers: shadowGridReconstruction.providers.map(adaptProvider)
    });
  };
}

export const adaptShadowGridLatticeEvidence =
  createShadowGridLatticeEvidenceAdapter();

function adaptProvider(provider) {
  const result = {
    id: provider?.id,
    description: provider?.description,
    status: provider?.status,
    regionCount: provider?.regionCount,
    reason: cloneValue(provider?.reason ?? null),
    regions: []
  };

  if (provider?.status !== "available") {
    return result;
  }

  const regions = Array.isArray(provider.reconstructions)
    ? provider.reconstructions
    : [];

  result.regions = regions.map(adaptRegion);
  return result;
}

function adaptRegion(region) {
  const reconstruction = region?.reconstruction;
  const strategyDiagnostic = Array.isArray(reconstruction?.diagnostics)
    ? reconstruction.diagnostics.find(diagnostic => (
      diagnostic?.type === STRATEGY_DIAGNOSTIC_TYPE
    ))
    : null;
  const base = {
    providerId: region?.providerId,
    regionId: region?.regionId,
    executionStatus: region?.status ?? null,
    reconstructionStatus: region?.reconstructionStatus ?? null,
    status: "unavailable",
    reason: null,
    coordinateProvenance: cloneValue(region?.coordinateProvenance ?? null),
    parameters: cloneValue(reconstruction?.parameters ?? null),
    axes: {
      horizontal: unavailableAxis("horizontal"),
      vertical: unavailableAxis("vertical")
    }
  };

  if (region?.status !== "completed" || !strategyDiagnostic?.axes) {
    base.reason = region?.status !== "completed"
      ? normalizeReason(region?.error, "shadow-reconstruction-region-failed")
      : "uniform-lattice-strategy-diagnostics-unavailable";
    return base;
  }

  base.status = "available";
  base.axes = {
    horizontal: adaptAxis(
      "horizontal",
      strategyDiagnostic.axes.horizontal,
      region
    ),
    vertical: adaptAxis(
      "vertical",
      strategyDiagnostic.axes.vertical,
      region
    )
  };
  return base;
}

function adaptAxis(axis, diagnostic, region) {
  const interpretations = Array.isArray(diagnostic?.interpretations)
    ? diagnostic.interpretations
    : [];

  return {
    axis,
    status: diagnostic?.status ?? "unavailable",
    candidatePositions: cloneValue(diagnostic?.candidatePositions ?? []),
    candidateGaps: cloneValue(diagnostic?.candidateGaps ?? []),
    observedBounds: cloneValue(diagnostic?.observedBounds ?? null),
    interpretations: interpretations.map((interpretation, index) => ({
      interpretationIndex: index,
      intervalCount: interpretation?.intervalCount,
      derivedSpacing: interpretation?.derivedSpacing,
      modeledLatticePositions: extractModeledPositions(interpretation),
      candidateResiduals: cloneValue(
        interpretation?.candidateResiduals ?? []
      ),
      candidateAssignments: cloneValue(
        interpretation?.candidateAssignmentAttempts ?? []
      ),
      interpretationStatus: interpretation?.status ?? "rejected",
      rejectionReasons: cloneValue(
        interpretation?.rejectionReasons ?? []
      ),
      inferredLineDiagnostics: {
        inferredLineCount: finiteOrNull(interpretation?.inferredLineCount),
        longestInferredRun: finiteOrNull(interpretation?.longestInferredRun),
        inferredLineFraction: finiteOrNull(
          interpretation?.inferredLineFraction
        ),
        skippedIntervalCounts: cloneValue(
          interpretation?.skippedIntervalCounts ?? []
        )
      },
      provenance: {
        source: SOURCE_EXPERIMENT_ID,
        strategyDiagnosticType: STRATEGY_DIAGNOSTIC_TYPE,
        providerId: region?.providerId,
        regionId: region?.regionId,
        axis,
        interpretationIndex: index
      }
    }))
  };
}

function extractModeledPositions(interpretation) {
  const representations = interpretation?.quantumCompatibility?.representations;

  if (!Array.isArray(representations)) {
    return [];
  }

  return representations.map(representation => representation?.modeledPosition);
}

function unavailableAxis(axis) {
  return {
    axis,
    status: "unavailable",
    candidatePositions: [],
    candidateGaps: [],
    observedBounds: null,
    interpretations: []
  };
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
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

function assertDevelopmentEnvironment(environment) {
  if (!ALLOWED_ENVIRONMENTS.has(environment)) {
    throw new Error(
      "Shadow grid lattice evidence is available only in development or test"
    );
  }
}

function validateDependency(value, name) {
  if (typeof value !== "function") {
    throw new Error(`${name} must be a function`);
  }
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
