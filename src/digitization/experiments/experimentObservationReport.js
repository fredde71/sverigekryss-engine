const REPORT_VERSION = 1;
const STRUCTURAL_SCORE_MEANING = "experimental-structural-score-not-calibrated-probability";

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
