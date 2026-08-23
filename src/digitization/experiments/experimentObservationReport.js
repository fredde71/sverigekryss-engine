const REPORT_VERSION = 1;
const STRUCTURAL_SCORE_MEANING = "experimental-structural-score-not-calibrated-probability";
const VERTICAL_CANDIDATE_COVERAGE_RATIOS = Object.freeze([
  0.7,
  0.75,
  0.8,
  0.85,
  0.9
]);

const RAW_PROJECTION_DEFINITIONS = Object.freeze([
  {
    field: "length",
    observationId: "raw-length",
    comparableKey: "vertical-projection.raw.length",
    label: "Raw vertical projection length"
  },
  {
    field: "maxStrength",
    observationId: "raw-max-strength",
    comparableKey: "vertical-projection.raw.max-strength",
    label: "Raw vertical projection maximum"
  },
  {
    field: "meanStrength",
    observationId: "raw-mean-strength",
    comparableKey: "vertical-projection.raw.mean-strength",
    label: "Raw vertical projection mean"
  },
  {
    field: "medianStrength",
    observationId: "raw-median-strength",
    comparableKey: "vertical-projection.raw.median-strength",
    label: "Raw vertical projection median"
  },
  {
    field: "runCount",
    observationId: "raw-run-count",
    comparableKey: "vertical-projection.raw.run-count",
    label: "Raw vertical projection run count"
  }
]);

const OBSERVATION_EXTRACTORS = Object.freeze({
  "vertical-line-mask-projection-comparison": extractVerticalLineMaskObservations,
  "vertical-continuity-projection-comparison": extractVerticalContinuityObservations,
  "vertical-continuity-candidate-comparison": extractVerticalContinuityCandidateObservations,
  "vertical-candidate-coverage-threshold-observation": extractVerticalCandidateCoverageThresholdObservations,
  "vertical-span-relative-coverage-observation": extractVerticalSpanRelativeCoverageObservations,
  "shadow-analysis-region-observations": extractShadowAnalysisRegionObservations,
  "shadow-grid-analysis-diagnostics": extractShadowGridAnalysisObservations,
  "shadow-grid-bounds-observation-diagnostics": extractShadowGridBoundsObservations,
  "shadow-grid-reconstruction-diagnostics": extractShadowGridReconstructionObservations,
  "shadow-grid-bounds-lattice-extension-diagnostics": extractShadowGridBoundsLatticeExtensionObservations,
  "grid-confidence-diagnostics": extractGridConfidenceObservations
});

export function createExperimentObservationReport({
  production,
  benchmark
} = {}) {
  if (!production) {
    throw new Error("production is required");
  }

  if (!Array.isArray(benchmark?.experiments)) {
    throw new Error("benchmark.experiments must be an array");
  }

  const successful = [];
  const failures = [];
  const visualizationExperiments = [];
  const availableObservations = [];
  const unavailableObservations = [];
  const structuralObservations = [];
  let visualizationCount = 0;

  for (const experiment of benchmark.experiments) {
    if (experiment?.success === true) {
      successful.push(createExecutionEntry(experiment));

      const visualizations = extractVisualizationInventory(experiment.diagnostics);

      if (visualizations.length > 0) {
        visualizationCount += visualizations.length;
        visualizationExperiments.push({
          experimentId: experiment.id,
          visualizations
        });
      }

      const extractor = OBSERVATION_EXTRACTORS[experiment.diagnostics?.type];

      if (extractor) {
        const extracted = extractor(experiment.id, experiment.diagnostics);
        availableObservations.push(...extracted.available);
        unavailableObservations.push(...extracted.unavailable);

        if (extracted.structuralEvidence) {
          structuralObservations.push(extracted.structuralEvidence);
        }
      }
    } else {
      failures.push({
        ...createExecutionEntry(experiment),
        diagnostic: cloneValue(experiment?.diagnostics)
      });
    }
  }

  return {
    type: "digitization-experiment-observation-report",
    version: REPORT_VERSION,
    status: "complete",
    production: createProductionObservation(production),
    execution: {
      totalExperimentCount: benchmark.experiments.length,
      successful,
      failures
    },
    visualizations: {
      totalCount: visualizationCount,
      experiments: visualizationExperiments
    },
    observations: {
      available: availableObservations.map(stripInternalObservationFields),
      unavailable: unavailableObservations
    },
    comparisons: createComparisons(availableObservations),
    structuralEvidence: createStructuralEvidence(structuralObservations)
  };
}

function createProductionObservation(production) {
  const gridDetection = production.gridDetection;
  const geometry = gridDetection?.geometry;

  return {
    confidence: hasOwn(gridDetection, "confidence")
      ? {
        status: "available",
        value: gridDetection.confidence
      }
      : {
        status: "unavailable",
        value: null
      },
    geometry: geometry
      ? {
        status: "available",
        rows: hasOwn(geometry, "rows") ? geometry.rows : null,
        cols: hasOwn(geometry, "cols") ? geometry.cols : null,
        bounds: cloneValue(geometry.bounds),
        horizontalLineCount: Array.isArray(geometry.horizontalLines)
          ? geometry.horizontalLines.length
          : null,
        verticalLineCount: Array.isArray(geometry.verticalLines)
          ? geometry.verticalLines.length
          : null
      }
      : {
        status: "unavailable",
        rows: null,
        cols: null,
        bounds: null,
        horizontalLineCount: null,
        verticalLineCount: null
      }
  };
}

function createExecutionEntry(experiment) {
  return {
    id: experiment?.id,
    description: experiment?.description,
    durationMs: experiment?.durationMs
  };
}

function extractVisualizationInventory(diagnostics) {
  if (!Array.isArray(diagnostics?.visualizations)) {
    return [];
  }

  return diagnostics.visualizations.map(visualization => ({
    id: visualization?.id,
    title: visualization?.title,
    type: visualization?.type
  }));
}

function extractVerticalLineMaskObservations(experimentId, diagnostics) {
  return {
    ...extractProjectionObservations(experimentId, diagnostics, {
      processedProfiles: [
        {
          profile: "mask",
          namespace: "vertical-line-mask"
        }
      ]
    }),
    structuralEvidence: null
  };
}

function extractVerticalContinuityObservations(experimentId, diagnostics) {
  return {
    ...extractProjectionObservations(experimentId, diagnostics, {
      processedProfiles: [
        {
          profile: "scores",
          namespace: "vertical-continuity-scores"
        },
        {
          profile: "mask",
          namespace: "vertical-continuity-mask"
        }
      ]
    }),
    structuralEvidence: null
  };
}

function extractVerticalContinuityCandidateObservations(experimentId, diagnostics) {
  const definitions = [
    {
      category: "candidate-count",
      observationId: "raw-vertical-candidate-count",
      value: diagnostics.raw?.candidateCount,
      isAvailable: Number.isFinite(diagnostics.raw?.candidateCount)
    },
    {
      category: "candidate-count",
      observationId: "continuity-vertical-candidate-count",
      value: diagnostics.continuity?.candidateCount,
      isAvailable: Number.isFinite(diagnostics.continuity?.candidateCount)
    },
    {
      category: "candidate-count-comparison",
      observationId: "vertical-candidate-count-delta",
      value: diagnostics.comparison?.candidateCountDelta,
      isAvailable: Number.isFinite(diagnostics.comparison?.candidateCountDelta)
    },
    {
      category: "candidate-count-comparison",
      observationId: "vertical-candidate-count-relation",
      value: diagnostics.comparison?.relation,
      isAvailable: typeof diagnostics.comparison?.relation === "string"
    }
  ];
  const available = [];
  const unavailable = [];

  for (const definition of definitions) {
    if (definition.isAvailable) {
      available.push({
        experimentId,
        category: definition.category,
        observationId: definition.observationId,
        value: definition.value
      });
    } else {
      unavailable.push({
        experimentId,
        category: definition.category,
        observationId: definition.observationId,
        reason: "value-unavailable"
      });
    }
  }

  return {
    available,
    unavailable,
    structuralEvidence: null
  };
}

function extractVerticalCandidateCoverageThresholdObservations(
  experimentId,
  diagnostics
) {
  const available = [];
  const unavailable = [];
  const observations = Array.isArray(diagnostics.observations)
    ? diagnostics.observations
    : [];

  for (const ratio of VERTICAL_CANDIDATE_COVERAGE_RATIOS) {
    const observation = observations.find(candidate => (
      candidate?.candidateCoverageRatio === ratio
    ));
    const ratioLabel = ratio.toFixed(2);

    extractCandidateThresholdValue({
      experimentId,
      observationId: `raw-vertical-candidate-count-at-coverage-${ratioLabel}`,
      value: observation?.raw?.candidateCount,
      isAvailable: Number.isFinite(observation?.raw?.candidateCount),
      available,
      unavailable
    });
    extractCandidateThresholdValue({
      experimentId,
      observationId: `raw-vertical-candidate-positions-at-coverage-${ratioLabel}`,
      value: observation?.raw?.candidatePositions,
      isAvailable: isFiniteNumberArray(observation?.raw?.candidatePositions),
      available,
      unavailable
    });
    extractCandidateThresholdValue({
      experimentId,
      observationId: `continuity-vertical-candidate-count-at-coverage-${ratioLabel}`,
      value: observation?.continuity?.candidateCount,
      isAvailable: Number.isFinite(observation?.continuity?.candidateCount),
      available,
      unavailable
    });
    extractCandidateThresholdValue({
      experimentId,
      observationId: `continuity-vertical-candidate-positions-at-coverage-${ratioLabel}`,
      value: observation?.continuity?.candidatePositions,
      isAvailable: isFiniteNumberArray(
        observation?.continuity?.candidatePositions
      ),
      available,
      unavailable
    });
  }

  return {
    available,
    unavailable,
    structuralEvidence: null
  };
}

function extractCandidateThresholdValue({
  experimentId,
  observationId,
  value,
  isAvailable,
  available,
  unavailable
}) {
  if (isAvailable) {
    available.push({
      experimentId,
      category: "candidate-threshold-observation",
      observationId,
      value: Array.isArray(value) ? value.slice() : value
    });
  } else {
    unavailable.push({
      experimentId,
      category: "candidate-threshold-observation",
      observationId,
      reason: "value-unavailable"
    });
  }
}

function isFiniteNumberArray(value) {
  return Array.isArray(value) && value.every(Number.isFinite);
}

function extractVerticalSpanRelativeCoverageObservations(
  experimentId,
  diagnostics
) {
  const span = diagnostics.spanObservation;
  const fullPage = diagnostics.fullPage;
  const spanRelative = diagnostics.spanRelative;
  const definitions = [
    createNumberObservationDefinition(
      "horizontal-boundary-candidate-count",
      span?.boundaryEvidence?.candidateCount
    ),
    createNumberArrayObservationDefinition(
      "horizontal-boundary-candidate-positions",
      span?.boundaryEvidence?.candidatePositions
    ),
    createNumberObservationDefinition(
      "observed-vertical-span-top",
      span?.top,
      span?.reason
    ),
    createNumberObservationDefinition(
      "observed-vertical-span-bottom",
      span?.bottom,
      span?.reason
    ),
    createNumberObservationDefinition(
      "observed-vertical-span-length",
      span?.length,
      span?.reason
    ),
    createNumberObservationDefinition(
      "full-page-vertical-coverage-denominator",
      fullPage?.denominator?.length
    ),
    createNumberObservationDefinition(
      "full-page-vertical-minimum-strength",
      fullPage?.minimumStrength
    ),
    createNumberObservationDefinition(
      "full-page-strongest-vertical-strength",
      fullPage?.strongestEvidence?.strength
    ),
    createNumberObservationDefinition(
      "full-page-maximum-observed-vertical-coverage",
      fullPage?.strongestEvidence?.coverageRatio
    ),
    createNumberObservationDefinition(
      "full-page-vertical-candidate-count",
      fullPage?.candidateCount
    ),
    createNumberArrayObservationDefinition(
      "full-page-vertical-candidate-positions",
      fullPage?.candidatePositions
    ),
    createNumberObservationDefinition(
      "span-relative-vertical-coverage-denominator",
      spanRelative?.denominator?.length,
      spanRelative?.reason
    ),
    createNumberObservationDefinition(
      "span-relative-vertical-minimum-strength",
      spanRelative?.minimumStrength,
      spanRelative?.reason
    ),
    createNumberObservationDefinition(
      "span-relative-strongest-vertical-strength",
      spanRelative?.strongestEvidence?.strength,
      spanRelative?.reason
    ),
    createNumberObservationDefinition(
      "span-relative-maximum-observed-vertical-coverage",
      spanRelative?.strongestEvidence?.coverageRatio,
      spanRelative?.reason
    ),
    createNumberObservationDefinition(
      "span-relative-vertical-candidate-count",
      spanRelative?.candidateCount,
      spanRelative?.reason
    ),
    createNumberArrayObservationDefinition(
      "span-relative-vertical-candidate-positions",
      spanRelative?.candidatePositions,
      spanRelative?.reason
    )
  ];
  const available = [];
  const unavailable = [];

  for (const definition of definitions) {
    if (definition.isAvailable) {
      available.push({
        experimentId,
        category: "span-relative-candidate-observation",
        observationId: definition.observationId,
        value: Array.isArray(definition.value)
          ? definition.value.slice()
          : definition.value
      });
    } else {
      unavailable.push({
        experimentId,
        category: "span-relative-candidate-observation",
        observationId: definition.observationId,
        reason: definition.reason || "value-unavailable"
      });
    }
  }

  return {
    available,
    unavailable,
    structuralEvidence: null
  };
}

function createNumberObservationDefinition(observationId, value, reason) {
  return {
    observationId,
    value,
    reason,
    isAvailable: Number.isFinite(value)
  };
}

function createNumberArrayObservationDefinition(observationId, value, reason) {
  return {
    observationId,
    value,
    reason,
    isAvailable: isFiniteNumberArray(value)
  };
}

function extractShadowAnalysisRegionObservations(experimentId, diagnostics) {
  const available = [];
  const unavailable = [];
  const providers = Array.isArray(diagnostics.providers)
    ? diagnostics.providers
    : [];

  for (const provider of providers) {
    const providerNamespace = `provider.${provider?.id || "unknown"}`;

    available.push({
      experimentId,
      category: "analysis-region-provider",
      observationId: `${providerNamespace}.status`,
      value: provider?.status ?? null
    });

    if (Number.isInteger(provider?.regionCount) && provider.regionCount >= 0) {
      available.push({
        experimentId,
        category: "analysis-region-provider",
        observationId: `${providerNamespace}.region-count`,
        value: provider.regionCount
      });
    } else {
      unavailable.push({
        experimentId,
        category: "analysis-region-provider",
        observationId: `${providerNamespace}.region-count`,
        reason: "value-unavailable"
      });
    }

    if (provider?.provenance && typeof provider.provenance === "object") {
      available.push({
        experimentId,
        category: "analysis-region-provenance",
        observationId: `${providerNamespace}.provenance`,
        value: cloneValue(provider.provenance)
      });
    }

    const regions = Array.isArray(provider?.regions) ? provider.regions : [];

    regions.forEach((region, index) => {
      const regionNamespace = `${providerNamespace}.region.${index}`;

      extractShadowRegionValue({
        experimentId,
        observationId: `${regionNamespace}.bounds`,
        value: region?.bounds,
        available,
        unavailable
      });
      extractShadowRegionValue({
        experimentId,
        observationId: `${regionNamespace}.dimensions`,
        value: region?.dimensions,
        available,
        unavailable
      });
      extractShadowRegionValue({
        experimentId,
        observationId: `${regionNamespace}.provenance`,
        value: region?.provenance,
        available,
        unavailable,
        category: "analysis-region-provenance"
      });
    });

    if (["unavailable", "ambiguous", "failed"].includes(provider?.status)) {
      unavailable.push({
        experimentId,
        category: "analysis-region-provider",
        observationId: `${providerNamespace}.reason`,
        reason: normalizeObservationReason(provider?.reason)
      });
    }
  }

  return {
    available,
    unavailable,
    structuralEvidence: null
  };
}

function extractShadowRegionValue({
  experimentId,
  observationId,
  value,
  available,
  unavailable,
  category = "analysis-region"
}) {
  if (value && typeof value === "object") {
    available.push({
      experimentId,
      category,
      observationId,
      value: cloneValue(value)
    });
  } else {
    unavailable.push({
      experimentId,
      category,
      observationId,
      reason: "value-unavailable"
    });
  }
}

function normalizeObservationReason(reason) {
  if (typeof reason === "string") {
    return reason;
  }

  if (reason && typeof reason.message === "string") {
    return reason.message;
  }

  return "reason-unavailable";
}

function extractShadowGridAnalysisObservations(experimentId, diagnostics) {
  const available = [];
  const unavailable = [];
  const providers = Array.isArray(diagnostics.providers)
    ? diagnostics.providers
    : [];

  for (const provider of providers) {
    const providerNamespace = `provider.${provider?.id || "unknown"}`;

    addShadowGridObservation({
      experimentId,
      observationId: `${providerNamespace}.status`,
      value: provider?.status,
      isAvailable: typeof provider?.status === "string",
      available,
      unavailable
    });
    addShadowGridObservation({
      experimentId,
      observationId: `${providerNamespace}.region-count`,
      value: provider?.regionCount,
      isAvailable: Number.isInteger(provider?.regionCount)
        && provider.regionCount >= 0,
      available,
      unavailable
    });

    if (["unavailable", "ambiguous", "failed"].includes(provider?.status)) {
      unavailable.push({
        experimentId,
        category: "shadow-grid-analysis",
        observationId: `${providerNamespace}.reason`,
        reason: normalizeObservationReason(provider?.reason)
      });
    }

    const gridAnalyses = Array.isArray(provider?.gridAnalyses)
      ? provider.gridAnalyses
      : [];

    for (const gridAnalysis of gridAnalyses) {
      extractShadowGridRegionObservations({
        experimentId,
        providerNamespace,
        gridAnalysis,
        available,
        unavailable
      });
    }
  }

  return {
    available,
    unavailable,
    structuralEvidence: null
  };
}

function extractShadowGridRegionObservations({
  experimentId,
  providerNamespace,
  gridAnalysis,
  available,
  unavailable
}) {
  const regionNamespace = `${providerNamespace}.region.${gridAnalysis?.regionId || "unknown"}`;
  const definitions = [
    ["bounds", gridAnalysis?.regionBounds, isObjectValue(gridAnalysis?.regionBounds)],
    ["dimensions", gridAnalysis?.regionDimensions, isObjectValue(gridAnalysis?.regionDimensions)],
    ["execution-status", gridAnalysis?.status, typeof gridAnalysis?.status === "string"],
    ["grid-analysis-status", gridAnalysis?.gridAnalysisStatus, typeof gridAnalysis?.gridAnalysisStatus === "string"],
    ["duration-ms", gridAnalysis?.durationMs, Number.isFinite(gridAnalysis?.durationMs)],
    ["horizontal-candidate-count", gridAnalysis?.candidateCounts?.horizontal, Number.isFinite(gridAnalysis?.candidateCounts?.horizontal)],
    ["vertical-candidate-count", gridAnalysis?.candidateCounts?.vertical, Number.isFinite(gridAnalysis?.candidateCounts?.vertical)],
    ["horizontal-candidate-positions", gridAnalysis?.candidatePositions?.horizontal, isFiniteNumberArray(gridAnalysis?.candidatePositions?.horizontal)],
    ["vertical-candidate-positions", gridAnalysis?.candidatePositions?.vertical, isFiniteNumberArray(gridAnalysis?.candidatePositions?.vertical)],
    ["spacing-diagnostics", gridAnalysis?.spacingDiagnostics, Array.isArray(gridAnalysis?.spacingDiagnostics)],
    ["geometry-status", gridAnalysis?.geometry?.status, typeof gridAnalysis?.geometry?.status === "string"]
  ];

  for (const [observationSuffix, value, isAvailable] of definitions) {
    addShadowGridObservation({
      experimentId,
      observationId: `${regionNamespace}.${observationSuffix}`,
      value,
      isAvailable,
      available,
      unavailable
    });
  }

  if (gridAnalysis?.geometry?.status === "available") {
    for (const [observationSuffix, value, isAvailable] of [
      ["geometry-rows", gridAnalysis.geometry.rows, Number.isFinite(gridAnalysis.geometry.rows)],
      ["geometry-cols", gridAnalysis.geometry.cols, Number.isFinite(gridAnalysis.geometry.cols)],
      ["geometry-bounds", gridAnalysis.geometry.bounds, isObjectValue(gridAnalysis.geometry.bounds)]
    ]) {
      addShadowGridObservation({
        experimentId,
        observationId: `${regionNamespace}.${observationSuffix}`,
        value,
        isAvailable,
        available,
        unavailable
      });
    }
  } else {
    addShadowGridObservation({
      experimentId,
      observationId: `${regionNamespace}.rejection-reasons`,
      value: gridAnalysis?.rejectionReasons,
      isAvailable: Array.isArray(gridAnalysis?.rejectionReasons),
      available,
      unavailable
    });
  }

  if (gridAnalysis?.status === "failed") {
    unavailable.push({
      experimentId,
      category: "shadow-grid-analysis",
      observationId: `${regionNamespace}.failure`,
      reason: normalizeObservationReason(gridAnalysis?.error)
    });
  }
}

function addShadowGridObservation({
  experimentId,
  observationId,
  value,
  isAvailable,
  available,
  unavailable
}) {
  if (isAvailable) {
    available.push({
      experimentId,
      category: "shadow-grid-analysis",
      observationId,
      value: cloneValue(value)
    });
  } else {
    unavailable.push({
      experimentId,
      category: "shadow-grid-analysis",
      observationId,
      reason: "value-unavailable"
    });
  }
}

function extractShadowGridReconstructionObservations(experimentId, diagnostics) {
  const available = [];
  const unavailable = [];
  const providers = Array.isArray(diagnostics.providers)
    ? diagnostics.providers
    : [];

  if (diagnostics.status !== "complete") {
    unavailable.push({
      experimentId,
      category: "shadow-grid-reconstruction",
      observationId: "source",
      reason: normalizeObservationReason(diagnostics.reason)
    });
  }

  for (const provider of providers) {
    const providerNamespace = `provider.${provider?.id || "unknown"}`;

    available.push({
      experimentId,
      category: "shadow-grid-reconstruction",
      observationId: `${providerNamespace}.status`,
      value: provider?.status
    });

    if (provider?.status !== "available") {
      unavailable.push({
        experimentId,
        category: "shadow-grid-reconstruction",
        observationId: `${providerNamespace}.reconstruction`,
        reason: normalizeObservationReason(provider?.reason)
      });
      continue;
    }

    const reconstructions = Array.isArray(provider?.reconstructions)
      ? provider.reconstructions
      : [];

    for (const region of reconstructions) {
      const regionNamespace = `${providerNamespace}.region.${region?.regionId || "unknown"}`;

      for (const [suffix, value, isAvailable] of [
        ["execution-status", region?.status, typeof region?.status === "string"],
        ["reconstruction-status", region?.reconstructionStatus, typeof region?.reconstructionStatus === "string"],
        ["coordinate-provenance", region?.coordinateProvenance, isObjectValue(region?.coordinateProvenance)],
        ["reconstruction", region?.reconstruction, isObjectValue(region?.reconstruction)]
      ]) {
        if (isAvailable) {
          available.push({
            experimentId,
            category: "shadow-grid-reconstruction",
            observationId: `${regionNamespace}.${suffix}`,
            value: cloneValue(value)
          });
        } else {
          unavailable.push({
            experimentId,
            category: "shadow-grid-reconstruction",
            observationId: `${regionNamespace}.${suffix}`,
            reason: normalizeObservationReason(region?.error)
          });
        }
      }
    }
  }

  return { available, unavailable, structuralEvidence: null };
}

function extractShadowGridBoundsObservations(experimentId, diagnostics) {
  const available = [];
  const unavailable = [];
  const providers = Array.isArray(diagnostics.providers)
    ? diagnostics.providers
    : [];

  if (diagnostics.status !== "complete") {
    unavailable.push({
      experimentId,
      category: "shadow-grid-bounds-observation",
      observationId: "source",
      reason: normalizeObservationReason(diagnostics.reason)
    });
  }

  for (const provider of providers) {
    const providerNamespace = `provider.${provider?.id || "unknown"}`;

    addShadowGridBoundsObservation({
      experimentId,
      observationId: `${providerNamespace}.status`,
      value: provider?.status,
      isAvailable: typeof provider?.status === "string",
      available,
      unavailable
    });
    addShadowGridBoundsObservation({
      experimentId,
      observationId: `${providerNamespace}.region-count`,
      value: provider?.regionCount,
      isAvailable: Number.isInteger(provider?.regionCount)
        && provider.regionCount >= 0,
      available,
      unavailable
    });

    const regions = Array.isArray(provider?.boundsObservations)
      ? provider.boundsObservations
      : [];

    for (const region of regions) {
      const regionNamespace = `${providerNamespace}.region.${region?.regionId || "unknown"}`;
      const observation = region?.boundsObservation;

      addShadowGridBoundsObservation({
        experimentId,
        observationId: `${regionNamespace}.execution-status`,
        value: region?.status,
        isAvailable: typeof region?.status === "string",
        available,
        unavailable
      });
      addShadowGridBoundsObservation({
        experimentId,
        observationId: `${regionNamespace}.bounds-observation-status`,
        value: observation?.status,
        isAvailable: typeof observation?.status === "string",
        available,
        unavailable
      });
      addShadowGridBoundsObservation({
        experimentId,
        observationId: `${regionNamespace}.bounds-observation-provenance`,
        value: observation?.provenance,
        isAvailable: isObjectValue(observation?.provenance),
        available,
        unavailable
      });
      addShadowGridBoundsObservation({
        experimentId,
        observationId: `${regionNamespace}.source-envelope-status`,
        value: observation?.sourceAcceptedCandidateEnvelope?.status,
        isAvailable: typeof observation?.sourceAcceptedCandidateEnvelope?.status
          === "string",
        available,
        unavailable
      });
      addShadowGridBoundsObservation({
        experimentId,
        observationId: `${regionNamespace}.source-envelope-bounds`,
        value: observation?.sourceAcceptedCandidateEnvelope?.bounds,
        isAvailable: isObjectValue(
          observation?.sourceAcceptedCandidateEnvelope?.bounds
        ),
        available,
        unavailable
      });
      addShadowGridBoundsObservation({
        experimentId,
        observationId: `${regionNamespace}.source-envelope-provenance`,
        value: observation?.sourceAcceptedCandidateEnvelope?.provenance,
        isAvailable: isObjectValue(
          observation?.sourceAcceptedCandidateEnvelope?.provenance
        ),
        available,
        unavailable
      });
      addShadowGridBoundsObservation({
        experimentId,
        observationId: `${regionNamespace}.coordinate-system`,
        value: observation?.coordinateSystem,
        isAvailable: isObjectValue(observation?.coordinateSystem),
        available,
        unavailable
      });
      addShadowGridBoundsObservation({
        experimentId,
        observationId: `${regionNamespace}.outer-grid-observation-count`,
        value: Array.isArray(observation?.observations)
          ? observation.observations.length
          : null,
        isAvailable: Array.isArray(observation?.observations),
        available,
        unavailable
      });

      if (observation?.status === "unavailable") {
        unavailable.push({
          experimentId,
          category: "shadow-grid-bounds-observation",
          observationId: `${regionNamespace}.outer-grid-envelope`,
          reason: normalizeObservationReason(
            observation?.reasons?.[0]?.code ?? observation?.reasons?.[0]
          )
        });
      }
    }
  }

  return { available, unavailable, structuralEvidence: null };
}

function addShadowGridBoundsObservation({
  experimentId,
  observationId,
  value,
  isAvailable,
  available,
  unavailable
}) {
  if (isAvailable) {
    available.push({
      experimentId,
      category: "shadow-grid-bounds-observation",
      observationId,
      value: cloneValue(value)
    });
  } else {
    unavailable.push({
      experimentId,
      category: "shadow-grid-bounds-observation",
      observationId,
      reason: "value-unavailable"
    });
  }
}

function extractShadowGridBoundsLatticeExtensionObservations(
  experimentId,
  diagnostics
) {
  const available = [];
  const unavailable = [];
  const providers = Array.isArray(diagnostics.providers)
    ? diagnostics.providers
    : [];

  if (diagnostics.status !== "complete") {
    unavailable.push({
      experimentId,
      category: "shadow-grid-bounds-lattice-extension",
      observationId: "source",
      reason: normalizeObservationReason(diagnostics.reason)
    });
  }

  for (const provider of providers) {
    const providerNamespace = `provider.${provider?.id || "unknown"}`;

    addLatticeExtensionReportObservation({
      experimentId,
      observationId: `${providerNamespace}.status`,
      value: provider?.status,
      isAvailable: typeof provider?.status === "string",
      available,
      unavailable
    });

    const regions = Array.isArray(provider?.boundsObservations)
      ? provider.boundsObservations
      : [];

    for (const region of regions) {
      const regionNamespace = `${providerNamespace}.region.${region?.regionId || "unknown"}`;
      const artifact = region?.boundsObservation;
      const observations = Array.isArray(artifact?.observations)
        ? artifact.observations
        : [];
      const envelopeProduct = Array.isArray(artifact?.diagnostics)
        ? artifact.diagnostics.find(diagnostic => (
          diagnostic?.type
            === "uniform-lattice-outer-grid-envelope-product"
        )) ?? null
        : null;

      addLatticeExtensionReportObservation({
        experimentId,
        observationId: `${regionNamespace}.status`,
        value: artifact?.status,
        isAvailable: typeof artifact?.status === "string",
        available,
        unavailable
      });
      addLatticeExtensionReportObservation({
        experimentId,
        observationId: `${regionNamespace}.source-candidate-envelope`,
        value: artifact?.sourceAcceptedCandidateEnvelope,
        isAvailable: isObjectValue(
          artifact?.sourceAcceptedCandidateEnvelope
        ),
        available,
        unavailable
      });
      addLatticeExtensionReportObservation({
        experimentId,
        observationId: `${regionNamespace}.compatible-observation-count`,
        value: observations.length,
        isAvailable: Array.isArray(artifact?.observations),
        available,
        unavailable
      });

      if (envelopeProduct) {
        for (const [suffix, value] of [
          ["product.status", envelopeProduct.status],
          ["product.representation", envelopeProduct.representation],
          ["product.cartesian-counts", envelopeProduct.cartesianProduct]
        ]) {
          addLatticeExtensionReportObservation({
            experimentId,
            observationId: `${regionNamespace}.${suffix}`,
            value,
            isAvailable: value !== null && value !== undefined,
            available,
            unavailable
          });
        }

        for (const axis of ["horizontal", "vertical"]) {
          const axisEvidence = envelopeProduct.axes?.[axis];
          const interpretations = Array.isArray(axisEvidence?.interpretations)
            ? axisEvidence.interpretations
            : [];

          addLatticeExtensionReportObservation({
            experimentId,
            observationId:
              `${regionNamespace}.product.${axis}.interpretation-count`,
            value: axisEvidence?.interpretationCount,
            isAvailable: Number.isInteger(axisEvidence?.interpretationCount),
            available,
            unavailable
          });
          addLatticeExtensionReportObservation({
            experimentId,
            observationId:
              `${regionNamespace}.product.${axis}.extension-state-count`,
            value: axisEvidence?.extensionStateCount,
            isAvailable: Number.isInteger(axisEvidence?.extensionStateCount),
            available,
            unavailable
          });

          interpretations.forEach((interpretation, index) => {
            addLatticeExtensionReportObservation({
              experimentId,
              observationId:
                `${regionNamespace}.product.${axis}.interpretation.${index}`,
              value: {
                interpretationReference:
                  interpretation.interpretationReference,
                interpretationStatus: interpretation.interpretationStatus,
                extensionStatus: interpretation.extensionStatus,
                extensionStateCount: Array.isArray(
                  interpretation.extensionStates
                )
                  ? interpretation.extensionStates.length
                  : 0
              },
              isAvailable: true,
              available,
              unavailable
            });
          });
        }
      }

      observations.forEach((observation, index) => {
        const observationNamespace = `${regionNamespace}.observation.${index}`;

        for (const [suffix, value, isAvailable] of [
          ["id", observation?.id, typeof observation?.id === "string"],
          ["bounds", observation?.bounds, isObjectValue(observation?.bounds)],
          ["inferred-outer-intervals", observation?.inferredOuterIntervals, isObjectValue(observation?.inferredOuterIntervals)],
          ["spacing-used", observation?.spacingUsed, isObjectValue(observation?.spacingUsed)],
          ["provenance", observation?.provenance, isObjectValue(observation?.provenance)],
          ["reasons", observation?.reasons, Array.isArray(observation?.reasons)]
        ]) {
          addLatticeExtensionReportObservation({
            experimentId,
            observationId: `${observationNamespace}.${suffix}`,
            value,
            isAvailable,
            available,
            unavailable
          });
        }
      });

      if (artifact?.status === "unavailable" || region?.status === "failed") {
        unavailable.push({
          experimentId,
          category: "shadow-grid-bounds-lattice-extension",
          observationId: `${regionNamespace}.outer-grid-envelope`,
          reason: normalizeObservationReason(
            artifact?.reasons?.[0]?.code
              ?? region?.error
          )
        });
      }
    }
  }

  return { available, unavailable, structuralEvidence: null };
}

function addLatticeExtensionReportObservation({
  experimentId,
  observationId,
  value,
  isAvailable,
  available,
  unavailable
}) {
  if (isAvailable) {
    available.push({
      experimentId,
      category: "shadow-grid-bounds-lattice-extension",
      observationId,
      value: cloneValue(value)
    });
  } else {
    unavailable.push({
      experimentId,
      category: "shadow-grid-bounds-lattice-extension",
      observationId,
      reason: "value-unavailable"
    });
  }
}

function isObjectValue(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function extractProjectionObservations(experimentId, diagnostics, {
  processedProfiles
}) {
  const available = [];
  const unavailable = [];

  for (const definition of RAW_PROJECTION_DEFINITIONS) {
    const value = diagnostics.raw?.[definition.field];

    if (Number.isFinite(value)) {
      available.push({
        experimentId,
        category: "projection",
        observationId: definition.observationId,
        value,
        comparableKey: definition.comparableKey,
        comparisonLabel: definition.label
      });
    } else {
      unavailable.push({
        experimentId,
        category: "projection",
        observationId: definition.observationId,
        reason: "value-unavailable"
      });
    }
  }

  for (const {
    profile,
    namespace
  } of processedProfiles) {
    extractNonComparableProfileObservations({
      experimentId,
      profile: diagnostics[profile],
      namespace,
      available,
      unavailable
    });
  }

  return {
    available,
    unavailable
  };
}

function extractNonComparableProfileObservations({
  experimentId,
  profile,
  namespace,
  available,
  unavailable
}) {
  for (const definition of RAW_PROJECTION_DEFINITIONS) {
    const observationId = `${namespace}.${definition.field}`;
    const value = profile?.[definition.field];

    if (Number.isFinite(value)) {
      available.push({
        experimentId,
        category: "processed-projection",
        observationId,
        value
      });
    } else {
      unavailable.push({
        experimentId,
        category: "processed-projection",
        observationId,
        reason: "value-unavailable"
      });
    }
  }
}

function extractGridConfidenceObservations(experimentId, diagnostics) {
  const available = [];
  const unavailable = [];
  const factors = Array.isArray(diagnostics.factors) ? diagnostics.factors : [];

  if (
    diagnostics.status === "measured"
    && Number.isFinite(diagnostics.score)
    && diagnostics.score >= 0
    && diagnostics.score <= 1
    && diagnostics.scoreMeaning === STRUCTURAL_SCORE_MEANING
  ) {
    available.push({
      experimentId,
      category: "structural-evidence",
      observationId: "overall",
      value: diagnostics.score,
      scale: {
        minimum: 0,
        maximum: 1
      },
      scoreMeaning: diagnostics.scoreMeaning
    });
  } else {
    unavailable.push({
      experimentId,
      category: "structural-evidence",
      observationId: "overall",
      reason: diagnostics.status === "measured"
        ? "valid-structural-score-unavailable"
        : `structural-score-${diagnostics.status || "unavailable"}`
    });
  }

  for (const factor of factors) {
    if (
      factor?.status === "measured"
      && Number.isFinite(factor.score)
      && factor.score >= 0
      && factor.score <= 1
    ) {
      available.push({
        experimentId,
        category: "structural-evidence",
        observationId: factor.id,
        value: factor.score,
        scale: {
          minimum: 0,
          maximum: 1
        },
        includedInOverall: factor.includedInOverall === true
      });
    } else {
      unavailable.push({
        experimentId,
        category: "structural-evidence",
        observationId: factor?.id || "unknown-factor",
        reason: factor?.reason || "factor-unavailable"
      });
    }
  }

  return {
    available,
    unavailable,
    structuralEvidence: {
      experimentId,
      score: diagnostics.status === "measured" && Number.isFinite(diagnostics.score)
        ? diagnostics.score
        : null,
      status: diagnostics.status || "unavailable",
      scoreMeaning: diagnostics.scoreMeaning || null
    }
  };
}

function stripInternalObservationFields(observation) {
  const publicObservation = { ...observation };
  delete publicObservation.comparableKey;
  delete publicObservation.comparisonLabel;

  return publicObservation;
}

function createComparisons(observations) {
  const grouped = new Map();

  for (const observation of observations) {
    if (!observation.comparableKey) {
      continue;
    }

    if (!grouped.has(observation.comparableKey)) {
      grouped.set(observation.comparableKey, {
        label: observation.comparisonLabel,
        observations: []
      });
    }

    grouped.get(observation.comparableKey).observations.push(observation);
  }

  return Array.from(grouped.entries()).map(([observationKey, group]) => {
    const sources = group.observations.map(observation => ({
      experimentId: observation.experimentId,
      value: observation.value
    }));
    const distinctObservations = createDistinctObservations(sources);

    return {
      observationKey,
      label: group.label,
      valueType: "number",
      equality: {
        method: "exact"
      },
      status: sources.length < 2
        ? "insufficient-observations"
        : distinctObservations.length === 1
          ? "agreement"
          : "disagreement",
      sources,
      distinctObservations,
      independence: "not-assessed"
    };
  });
}

function createDistinctObservations(sources) {
  const distinct = [];

  for (const source of sources) {
    let observation = distinct.find(candidate => candidate.value === source.value);

    if (!observation) {
      observation = {
        value: source.value,
        experimentIds: []
      };
      distinct.push(observation);
    }

    observation.experimentIds.push(source.experimentId);
  }

  return distinct;
}

function createStructuralEvidence(observations) {
  const eligible = observations.filter(observation => (
    observation.status === "measured"
    && observation.scoreMeaning === STRUCTURAL_SCORE_MEANING
    && Number.isFinite(observation.score)
    && observation.score >= 0
    && observation.score <= 1
  ));
  const maximumObservedScore = eligible.length > 0
    ? Math.max(...eligible.map(observation => observation.score))
    : null;

  return {
    status: maximumObservedScore === null ? "unavailable" : "observed",
    scoreMeaning: STRUCTURAL_SCORE_MEANING,
    scale: {
      minimum: 0,
      maximum: 1
    },
    maximumObservedScore,
    sourcesAtMaximum: maximumObservedScore === null
      ? []
      : eligible
        .filter(observation => observation.score === maximumObservedScore)
        .map(observation => observation.experimentId),
    observations: observations.map(cloneValue),
    interpretation: "none"
  };
}

function hasOwn(value, key) {
  return value !== null
    && typeof value === "object"
    && Object.prototype.hasOwnProperty.call(value, key);
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, cloneValue(nestedValue)])
    );
  }

  return value;
}
