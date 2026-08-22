import {
  reconstructUniformOrthogonalLattice
} from "../analysis/reconstruction/UniformOrthogonalLatticeStrategy";

const ALLOWED_ENVIRONMENTS = new Set(["development", "test"]);
const SOURCE_EXPERIMENT_ID = "shadow-grid-analysis-diagnostics";

export const SHADOW_GRID_RECONSTRUCTION_PARAMETERS = Object.freeze({
  strategyId: "uniform-orthogonal-lattice",
  minimumObservedCandidatesPerAxis: 2,
  permittedIntervalCount: Object.freeze({ minimum: 1, maximum: 100 }),
  permittedCellSpacing: Object.freeze({ minimum: 1, maximum: 500 }),
  maximumSkippedIntervalsBetweenCandidates: 25,
  maximumConsecutiveInferredLines: 25,
  maximumInferredLineFraction: 0.9,
  candidateAlignmentTolerancePx: 1,
  boundsAlignmentTolerancePx: 1,
  positionQuantum: 0.5,
  maximumHypothesisCount: 100
});

export const shadowGridReconstructionDiagnosticsExperiment = Object.freeze({
  id: "shadow-grid-reconstruction-diagnostics",
  description: "Adapt completed shadow GridAnalysis observations into development-only grid reconstruction diagnostics.",
  run(_binaryImage, _context, execution) {
    return runShadowGridReconstructionDiagnostics(
      execution?.getSuccessfulDiagnostics?.(SOURCE_EXPERIMENT_ID) ?? null
    );
  }
});

export function createShadowGridReconstructionDiagnosticsRunner({
  reconstruct = reconstructUniformOrthogonalLattice,
  parameters = SHADOW_GRID_RECONSTRUCTION_PARAMETERS,
  readEnvironment = () => process.env.NODE_ENV
} = {}) {
  validateDependency(reconstruct, "reconstruct");
  validateDependency(readEnvironment, "readEnvironment");
  const stableParameters = freezeValue(cloneValue(parameters));

  return function run(shadowGridAnalysis) {
    assertDevelopmentEnvironment(readEnvironment());

    if (
      !shadowGridAnalysis
      || shadowGridAnalysis.type !== "shadow-grid-analysis-diagnostics"
      || !Array.isArray(shadowGridAnalysis.providers)
    ) {
      return freezeValue({
        type: "shadow-grid-reconstruction-diagnostics",
        version: 1,
        status: "unavailable",
        sourceExperimentId: SOURCE_EXPERIMENT_ID,
        reason: "shadow-grid-analysis-diagnostics-unavailable",
        rawShadowGridAnalysis: cloneValue(shadowGridAnalysis),
        providers: []
      });
    }

    const providers = shadowGridAnalysis.providers.map(provider => (
      reconstructProvider(provider, {
        reconstruct,
        parameters: stableParameters
      })
    ));

    return freezeValue({
      type: "shadow-grid-reconstruction-diagnostics",
      version: 1,
      status: "complete",
      sourceExperimentId: SOURCE_EXPERIMENT_ID,
      reason: null,
      rawShadowGridAnalysis: cloneValue(shadowGridAnalysis),
      providers
    });
  };
}

export const runShadowGridReconstructionDiagnostics =
  createShadowGridReconstructionDiagnosticsRunner();

function reconstructProvider(provider, dependencies) {
  const result = {
    id: provider?.id,
    description: provider?.description,
    status: provider?.status,
    regionCount: provider?.regionCount,
    reason: cloneValue(provider?.reason ?? null),
    reconstructions: []
  };

  if (provider?.status !== "available") {
    return result;
  }

  const gridAnalyses = Array.isArray(provider.gridAnalyses)
    ? provider.gridAnalyses
    : [];

  for (const gridAnalysis of gridAnalyses) {
    result.reconstructions.push(reconstructRegion(
      provider.id,
      gridAnalysis,
      dependencies
    ));
  }

  return result;
}

function reconstructRegion(providerId, gridAnalysis, {
  reconstruct,
  parameters
}) {
  const adaptation = adaptShadowGridAnalysis({
    providerId,
    gridAnalysis,
    parameters
  });

  try {
    const reconstruction = reconstruct(adaptation.input);

    return {
      providerId,
      regionId: gridAnalysis?.regionId,
      status: "completed",
      reconstructionStatus: reconstruction.status,
      coordinateProvenance: adaptation.coordinateProvenance,
      reconstruction,
      error: null
    };
  } catch (error) {
    return {
      providerId,
      regionId: gridAnalysis?.regionId,
      status: "failed",
      reconstructionStatus: "unavailable",
      coordinateProvenance: adaptation.coordinateProvenance,
      reconstruction: null,
      error: normalizeError(error)
    };
  }
}

export function adaptShadowGridAnalysis({
  providerId,
  gridAnalysis,
  parameters = SHADOW_GRID_RECONSTRUCTION_PARAMETERS
} = {}) {
  const regionId = gridAnalysis?.regionId;
  const regionBounds = gridAnalysis?.regionBounds;
  const horizontalPositions = positionsOrEmpty(
    gridAnalysis?.candidatePositions?.horizontal
  );
  const verticalPositions = positionsOrEmpty(
    gridAnalysis?.candidatePositions?.vertical
  );
  const spacingDiagnostics = Array.isArray(gridAnalysis?.spacingDiagnostics)
    ? gridAnalysis.spacingDiagnostics
    : [];
  const coordinateProvenance = {
    source: SOURCE_EXPERIMENT_ID,
    providerId,
    regionId,
    regionBounds: cloneValue(regionBounds ?? null),
    relationship: "analysis-region-local-to-rendered-binary-image"
  };

  return freezeValue({
    coordinateProvenance,
    input: {
      candidateEvidence: {
        analysisRegionId: regionId,
        acceptancePolicy: {
          source: SOURCE_EXPERIMENT_ID,
          parameters: {
            providerId,
            gridAnalysisStatus: gridAnalysis?.gridAnalysisStatus ?? null
          }
        },
        horizontal: horizontalPositions.map((position, sourceIndex) => ({
          axis: "horizontal",
          position,
          sourceIndex
        })),
        vertical: verticalPositions.map((position, sourceIndex) => ({
          axis: "vertical",
          position,
          sourceIndex
        }))
      },
      observedBounds: adaptObservedBounds(gridAnalysis),
      spacingEvidence: {
        horizontal: spacingDiagnostics
          .filter(diagnostic => diagnostic?.axis === "horizontal")
          .map(cloneValue),
        vertical: spacingDiagnostics
          .filter(diagnostic => diagnostic?.axis === "vertical")
          .map(cloneValue),
        unassigned: spacingDiagnostics
          .filter(diagnostic => !["horizontal", "vertical"].includes(diagnostic?.axis))
          .map(cloneValue)
      },
      coordinateSystem: {
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
        provenance: coordinateProvenance
      },
      parameters: cloneValue(parameters)
    }
  });
}

function adaptObservedBounds(gridAnalysis) {
  const bounds = gridAnalysis?.geometry?.bounds;

  if (
    gridAnalysis?.geometry?.status !== "available"
    || !hasFiniteBounds(bounds)
  ) {
    return {
      status: "unavailable",
      coordinateSpace: "analysis-region-local",
      semantics: "outer-line-center-envelope",
      value: null,
      reason: "phase-4-grid-bounds-unavailable"
    };
  }

  return {
    status: "available",
    coordinateSpace: "analysis-region-local",
    semantics: "outer-line-center-envelope",
    value: cloneValue(bounds),
    components: {
      top: { status: "observed", provenance: "phase-4-shadow-grid-geometry" },
      left: { status: "observed", provenance: "phase-4-shadow-grid-geometry" },
      width: { status: "observed", provenance: "phase-4-shadow-grid-geometry" },
      height: { status: "observed", provenance: "phase-4-shadow-grid-geometry" }
    }
  };
}

function positionsOrEmpty(value) {
  return Array.isArray(value)
    ? value.slice()
    : [];
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
      "Shadow grid reconstruction is available only in development or test"
    );
  }
}

function normalizeError(error) {
  return {
    name: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error)
  };
}

function validateDependency(dependency, name) {
  if (typeof dependency !== "function") {
    throw new Error(`${name} must be a function`);
  }
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, cloneValue(nested)])
    );
  }

  return value;
}

function freezeValue(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(freezeValue);
  return Object.freeze(value);
}
