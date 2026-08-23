import {
  createGridBoundsObservation
} from "../analysis/GridBoundsObservation";
import {
  adaptShadowGridLatticeEvidence
} from "./shadowGridLatticeEvidenceAdapter";

const ALLOWED_ENVIRONMENTS = new Set(["development", "test"]);
const GRID_ANALYSIS_EXPERIMENT_ID = "shadow-grid-analysis-diagnostics";
const BOUNDS_OBSERVATION_EXPERIMENT_ID =
  "shadow-grid-bounds-observation-diagnostics";
const RECONSTRUCTION_EXPERIMENT_ID =
  "shadow-grid-reconstruction-diagnostics";

export const shadowGridBoundsLatticeExtensionDiagnosticsExperiment =
  Object.freeze({
    id: "shadow-grid-bounds-lattice-extension-diagnostics",
    description: "Observe development-only outer grid bounds obtained by extending existing uniform-lattice evidence beyond accepted-candidate envelopes.",
    run(_binaryImage, _context, execution) {
      return runShadowGridBoundsLatticeExtensionDiagnostics({
        shadowGridAnalysis: execution?.getSuccessfulDiagnostics?.(
          GRID_ANALYSIS_EXPERIMENT_ID
        ) ?? null,
        gridBoundsObservations: execution?.getSuccessfulDiagnostics?.(
          BOUNDS_OBSERVATION_EXPERIMENT_ID
        ) ?? null,
        shadowGridReconstruction: execution?.getSuccessfulDiagnostics?.(
          RECONSTRUCTION_EXPERIMENT_ID
        ) ?? null
      });
    }
  });

export function createShadowGridBoundsLatticeExtensionDiagnosticsRunner({
  createObservation = createGridBoundsObservation,
  adaptLatticeEvidence = adaptShadowGridLatticeEvidence,
  readEnvironment = () => process.env.NODE_ENV
} = {}) {
  validateDependency(createObservation, "createObservation");
  validateDependency(adaptLatticeEvidence, "adaptLatticeEvidence");
  validateDependency(readEnvironment, "readEnvironment");

  return function run(input = {}) {
    assertDevelopmentEnvironment(readEnvironment());
    const {
      shadowGridAnalysis,
      gridBoundsObservations,
      shadowGridReconstruction
    } = input;

    const sourceFailure = validateSources({
      shadowGridAnalysis,
      gridBoundsObservations,
      shadowGridReconstruction
    });

    if (sourceFailure) {
      return freezeValue({
        type: "shadow-grid-bounds-lattice-extension-diagnostics",
        version: 1,
        status: "unavailable",
        sourceExperimentIds: sourceExperimentIds(),
        reason: sourceFailure,
        providers: []
      });
    }

    const latticeEvidence = adaptLatticeEvidence(shadowGridReconstruction);

    const providers = gridBoundsObservations.providers.map(provider => (
      extendProvider(provider, {
        shadowGridAnalysis,
        latticeEvidence,
        createObservation
      })
    ));

    return freezeValue({
      type: "shadow-grid-bounds-lattice-extension-diagnostics",
      version: 1,
      status: "complete",
      sourceExperimentIds: sourceExperimentIds(),
      reason: null,
      providers
    });
  };
}

export const runShadowGridBoundsLatticeExtensionDiagnostics =
  createShadowGridBoundsLatticeExtensionDiagnosticsRunner();

function extendProvider(boundsProvider, dependencies) {
  const providerId = boundsProvider?.id;
  const gridProvider = findProvider(
    dependencies.shadowGridAnalysis,
    providerId
  );
  const latticeProvider = findProvider(
    dependencies.latticeEvidence,
    providerId
  );
  const result = {
    id: providerId,
    description: boundsProvider?.description,
    status: boundsProvider?.status,
    regionCount: boundsProvider?.regionCount,
    reason: cloneValue(boundsProvider?.reason ?? null),
    boundsObservations: []
  };

  if (boundsProvider?.status !== "available") {
    return result;
  }

  const regions = Array.isArray(boundsProvider.boundsObservations)
    ? boundsProvider.boundsObservations
    : [];

  for (const region of regions) {
    result.boundsObservations.push(extendRegion({
      providerId,
      boundsRegion: region,
      gridAnalysis: findRegion(gridProvider?.gridAnalyses, region?.regionId),
      latticeEvidenceRegion: findRegion(
        latticeProvider?.regions,
        region?.regionId
      ),
      createObservation: dependencies.createObservation
    }));
  }

  return result;
}

function extendRegion({
  providerId,
  boundsRegion,
  gridAnalysis,
  latticeEvidenceRegion,
  createObservation
}) {
  const source = boundsRegion?.boundsObservation;
  const regionId = boundsRegion?.regionId;

  if (!source) {
    return failedRegion(
      providerId,
      regionId,
      "grid-bounds-observation-unavailable"
    );
  }

  try {
    const observations = enumerateOuterBoundsObservations({
      providerId,
      regionId,
      source,
      gridAnalysis,
      latticeEvidenceRegion
    });
    const state = resolveObservationState(observations);
    const boundsObservation = createObservation({
      analysisRegionId: source.analysisRegionId,
      status: state.status,
      sourceAcceptedCandidateEnvelope:
        source.sourceAcceptedCandidateEnvelope,
      coordinateSystem: source.coordinateSystem,
      provenance: {
        source: "shadow-grid-bounds-lattice-extension-diagnostics",
        providerId,
        regionId,
        method: "extend-existing-uniform-lattice-within-analysis-region",
        sourceGridBoundsObservation: {
          type: source.type,
          version: source.version
        },
        sourceReconstructionExperimentId: RECONSTRUCTION_EXPERIMENT_ID,
        latticeEvidenceAdapterType: "shadow-grid-lattice-evidence"
      },
      observations,
      reasons: state.reasons,
      diagnostics: [{
        type: "uniform-lattice-outer-grid-envelope-observation",
        status: state.status,
        compatibleObservationCount: observations.length,
        sourceCandidateEnvelopePreserved: true
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

function enumerateOuterBoundsObservations({
  providerId,
  regionId,
  source,
  gridAnalysis,
  latticeEvidenceRegion
}) {
  const envelope = source.sourceAcceptedCandidateEnvelope;

  if (
    envelope?.status !== "available"
    || !hasFiniteBounds(envelope.bounds)
    || !hasFiniteDimensions(gridAnalysis?.regionDimensions)
    || latticeEvidenceRegion?.status !== "available"
  ) {
    return [];
  }

  const parameters = latticeEvidenceRegion.parameters;
  const observations = [];
  const horizontalEvidence = createAxisEvidenceExtensions({
    axisEvidence: latticeEvidenceRegion.axes?.horizontal,
    sourceStart: envelope.bounds.top,
    sourceEnd: envelope.bounds.top + envelope.bounds.height,
    domainEnd: gridAnalysis.regionDimensions.height - 1,
    parameters
  });
  const verticalEvidence = createAxisEvidenceExtensions({
    axisEvidence: latticeEvidenceRegion.axes?.vertical,
    sourceStart: envelope.bounds.left,
    sourceEnd: envelope.bounds.left + envelope.bounds.width,
    domainEnd: gridAnalysis.regionDimensions.width - 1,
    parameters
  });

  for (const horizontal of horizontalEvidence) {
    for (const vertical of verticalEvidence) {
      for (const horizontalExtension of horizontal.extensions) {
        for (const verticalExtension of vertical.extensions) {
          const counts = {
            top: horizontalExtension.before,
            bottom: horizontalExtension.after,
            left: verticalExtension.before,
            right: verticalExtension.after
          };

          if (Object.values(counts).every(count => count === 0)) {
            continue;
          }

          const top = horizontal.start
            - (counts.top * horizontal.spacing);
          const bottom = horizontal.end
            + (counts.bottom * horizontal.spacing);
          const left = vertical.start
            - (counts.left * vertical.spacing);
          const right = vertical.end
            + (counts.right * vertical.spacing);
          const observationIndex = observations.length;

          observations.push({
          id: `lattice-extension-${observationIndex}`,
          status: "available",
          semantics: "outer-grid-line-center-envelope",
          coordinateSpace: source.coordinateSystem.space,
          bounds: {
            top,
            left,
            width: right - left,
            height: bottom - top
          },
          inferredOuterIntervals: counts,
          spacingUsed: {
            horizontal: horizontal.spacing,
            vertical: vertical.spacing
          },
          candidateAlignmentResiduals: {
            horizontal: horizontal.residuals,
            vertical: vertical.residuals
          },
          reconstructionLatticeEvidence: {
            horizontal: cloneValue(horizontal.interpretation),
            vertical: cloneValue(vertical.interpretation)
          },
          provenance: {
            source: "shadow-grid-lattice-evidence",
            providerId,
            regionId,
            horizontalInterpretationIndex:
              horizontal.interpretation.interpretationIndex,
            verticalInterpretationIndex:
              vertical.interpretation.interpretationIndex
          },
          evidenceReferences: [
            {
              type: "accepted-candidate-envelope",
              bounds: cloneValue(envelope.bounds)
            },
            {
              type: "uniform-lattice-axis-interpretation",
              axis: "horizontal",
              interpretationIndex:
                horizontal.interpretation.interpretationIndex,
              interpretationStatus:
                horizontal.interpretation.interpretationStatus
            },
            {
              type: "uniform-lattice-axis-interpretation",
              axis: "vertical",
              interpretationIndex:
                vertical.interpretation.interpretationIndex,
              interpretationStatus:
                vertical.interpretation.interpretationStatus
            }
          ],
          assumptions: [
            {
              id: "uniform-lattice-continues-beyond-accepted-candidate-envelope",
              status: "applied"
            },
            {
              id: "analysis-region-limits-outer-extension",
              status: "applied"
            },
            {
              id: "pre-admission-reconstruction-evidence-remains-unadmitted",
              status: "applied"
            }
          ],
          reasons: [{
            code: "lattice-extension-observed-from-pre-admission-axis-evidence"
          }],
          diagnostics: [{
            type: "uniform-lattice-outer-extension",
            horizontal: {
              spacing: horizontal.spacing,
              interpretationIndex:
                horizontal.interpretation.interpretationIndex,
              interpretationStatus:
                horizontal.interpretation.interpretationStatus,
              inferredBefore: counts.top,
              inferredAfter: counts.bottom
            },
            vertical: {
              spacing: vertical.spacing,
              interpretationIndex:
                vertical.interpretation.interpretationIndex,
              interpretationStatus:
                vertical.interpretation.interpretationStatus,
              inferredBefore: counts.left,
              inferredAfter: counts.right
            }
          }]
          });
        }
      }
    }
  }

  return observations;
}

function createAxisEvidenceExtensions({
  axisEvidence,
  sourceStart,
  sourceEnd,
  domainEnd,
  parameters
}) {
  if (!Array.isArray(axisEvidence?.interpretations)) {
    return [];
  }

  return axisEvidence.interpretations.map(interpretation => (
    createAxisExtensions({
      axis: axisEvidence.axis,
      interpretation,
      sourceStart,
      sourceEnd,
      domainEnd,
      parameters
    })
  )).filter(Boolean);
}

function createAxisExtensions({
  axis,
  interpretation,
  sourceStart,
  sourceEnd,
  domainEnd,
  parameters
}) {
  const positions = interpretation?.modeledLatticePositions;

  if (
    !Array.isArray(positions)
    || positions.length < 2
    || !Number.isFinite(sourceStart)
    || !Number.isFinite(sourceEnd)
    || !Number.isFinite(domainEnd)
    || sourceStart < 0
    || sourceEnd > domainEnd
  ) {
    return null;
  }

  const start = positions[0];
  const end = positions[positions.length - 1];
  const spacing = interpretation?.derivedSpacing;

  if (
    !Number.isFinite(start)
    || !Number.isFinite(end)
    || !Number.isFinite(spacing)
    || spacing <= 0
    || start !== sourceStart
    || end !== sourceEnd
    || positions.some((position, index) => (
      !Number.isFinite(position)
      || (index > 0 && position <= positions[index - 1])
    ))
  ) {
    return null;
  }

  const maximumRun = parameters?.maximumConsecutiveInferredLines;
  const maximumFraction = parameters?.maximumInferredLineFraction;

  if (
    !Number.isInteger(maximumRun)
    || maximumRun < 0
    || !Number.isFinite(maximumFraction)
    || maximumFraction < 0
    || maximumFraction > 1
  ) {
    return null;
  }

  const maximumBefore = Math.min(
    maximumRun,
    Math.floor(start / spacing)
  );
  const maximumAfter = Math.min(
    maximumRun,
    Math.floor((domainEnd - end) / spacing)
  );
  const existingInferredCount = Number.isFinite(
    interpretation?.inferredLineDiagnostics?.inferredLineCount
  )
    ? interpretation.inferredLineDiagnostics.inferredLineCount
    : 0;
  const extensions = [];

  for (let before = 0; before <= maximumBefore; before += 1) {
    for (let after = 0; after <= maximumAfter; after += 1) {
      const extendedLineCount = positions.length + before + after;
      const inferredLineCount = existingInferredCount + before + after;

      if ((inferredLineCount / extendedLineCount) <= maximumFraction) {
        extensions.push({ before, after });
      }
    }
  }

  return {
    axis,
    start,
    end,
    spacing,
    residuals: cloneValue(interpretation.candidateResiduals ?? []),
    interpretation,
    extensions
  };
}

function resolveObservationState(observations) {
  if (observations.length === 0) {
    return {
      status: "unavailable",
      reasons: [{
        code: "no-compatible-lattice-extension-observation"
      }]
    };
  }

  if (observations.length === 1) {
    return {
      status: "available",
      reasons: [{
        code: "single-compatible-lattice-extension-observation"
      }]
    };
  }

  return {
    status: "ambiguous",
    reasons: [{
      code: "multiple-compatible-lattice-extension-observations",
      compatibleObservationCount: observations.length
    }]
  };
}

function validateSources({
  shadowGridAnalysis,
  gridBoundsObservations,
  shadowGridReconstruction
}) {
  if (shadowGridAnalysis?.type !== GRID_ANALYSIS_EXPERIMENT_ID) {
    return "shadow-grid-analysis-diagnostics-unavailable";
  }

  if (
    gridBoundsObservations?.type
      !== "shadow-grid-bounds-observation-diagnostics"
    || !Array.isArray(gridBoundsObservations.providers)
  ) {
    return "shadow-grid-bounds-observation-diagnostics-unavailable";
  }

  if (
    shadowGridReconstruction?.type
      !== "shadow-grid-reconstruction-diagnostics"
    || !Array.isArray(shadowGridReconstruction.providers)
  ) {
    return "shadow-grid-reconstruction-diagnostics-unavailable";
  }

  return null;
}

function sourceExperimentIds() {
  return [
    GRID_ANALYSIS_EXPERIMENT_ID,
    BOUNDS_OBSERVATION_EXPERIMENT_ID,
    RECONSTRUCTION_EXPERIMENT_ID
  ];
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
    boundsObservation: null,
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

function hasFiniteDimensions(dimensions) {
  return Boolean(dimensions)
    && Number.isFinite(dimensions.width)
    && dimensions.width > 0
    && Number.isFinite(dimensions.height)
    && dimensions.height > 0;
}

function assertDevelopmentEnvironment(environment) {
  if (!ALLOWED_ENVIRONMENTS.has(environment)) {
    throw new Error(
      "Shadow grid bounds lattice extension is available only in development or test"
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
