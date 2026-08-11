const CANDIDATE_BOARD_VERSION = 1;

const FAILURE_AREA_BY_CODE = Object.freeze({
  "insufficient-candidates": "line-candidate-detection",
  "geometry-build-failed": "grid-geometry-construction",
  "missing-grid-geometry-without-rejection-reason": "grid-geometry-detection",
  "grid-detection-unavailable": "grid-detection",
  "production-stage-failure": "production-execution"
});

const DIAGNOSTIC_AREA_BY_TYPE = Object.freeze({
  "candidate-counts": "line-candidate-detection",
  "spacing-consistency": "grid-spacing-analysis",
  "acceptance-status": "grid-acceptance",
  "rejection-reason": "grid-rejection",
  "pre-rejection-bounds": "grid-bounds-detection"
});

const OBSERVATION_AREA_BY_CATEGORY = Object.freeze({
  projection: "projection-analysis",
  "processed-projection": "projection-analysis"
});

export function createExperimentCandidateBoard(analysisSummary) {
  validateAnalysisSummary(analysisSummary);

  const candidates = [];
  const patternKeys = new Set();
  const sections = analysisSummary.sections;

  collectCandidates({
    entries: sections.productionFailureReasons.reasons,
    source: "production-failure-reason",
    candidates,
    patternKeys,
    createCandidate: createFailureReasonCandidate
  });
  collectCandidates({
    entries: sections.frequentExperimentObservations.observations,
    source: "frequent-experiment-observation",
    candidates,
    patternKeys,
    createCandidate: createExperimentObservationCandidate
  });
  collectCandidates({
    entries: sections.recurringDiagnosticPatterns.patterns,
    source: "recurring-diagnostic-pattern",
    candidates,
    patternKeys,
    createCandidate: createRecurringDiagnosticCandidate
  });

  return {
    type: "experiment-candidate-board",
    version: CANDIDATE_BOARD_VERSION,
    dataset: {
      datasetId: analysisSummary.dataset.datasetId,
      itemCount: analysisSummary.dataset.itemCount
    },
    candidates: candidates.map((candidate, index) => ({
      id: `candidate-${String(index + 1).padStart(3, "0")}`,
      ...candidate
    }))
  };
}

function validateAnalysisSummary(analysisSummary) {
  if (
    !analysisSummary
    || typeof analysisSummary !== "object"
    || analysisSummary.type !== "digitization-dataset-analysis-summary"
    || !analysisSummary.dataset
    || !Array.isArray(analysisSummary.sections?.productionFailureReasons?.reasons)
    || !Array.isArray(
      analysisSummary.sections?.frequentExperimentObservations?.observations
    )
    || !Array.isArray(
      analysisSummary.sections?.recurringDiagnosticPatterns?.patterns
    )
  ) {
    throw new Error("Digitization dataset analysis summary is required");
  }
}

function collectCandidates({
  entries,
  source,
  candidates,
  patternKeys,
  createCandidate
}) {
  for (const entry of entries) {
    const candidate = createCandidate(entry);
    const key = stableSerialize({
      source,
      pattern: candidate.evidence.pattern
    });

    if (patternKeys.has(key)) {
      continue;
    }

    patternKeys.add(key);
    candidates.push(candidate);
  }
}

function createFailureReasonCandidate(entry) {
  const reason = cloneValue(entry?.reason ?? {});
  const code = reason.code;

  return {
    title: `Production failure: ${entry?.label}`,
    evidence: {
      source: "production-failure-reason",
      pattern: reason,
      itemCount: entry?.itemCount,
      itemIds: cloneArray(entry?.itemIds)
    },
    affectedExperiments: [],
    affectedProductionArea: FAILURE_AREA_BY_CODE[code] ?? "grid-detection",
    hypothesis: `The recorded ${code} pattern may be associated with production grid-detection failures for the listed items.`
  };
}

function createExperimentObservationCandidate(observation) {
  const observationId = observation?.observationId;

  return {
    title: `Experiment observation: ${observationId}`,
    evidence: {
      source: "frequent-experiment-observation",
      pattern: {
        category: observation?.category,
        observationId,
        value: cloneValue(observation?.value)
      },
      itemCount: observation?.itemCount,
      itemIds: cloneArray(observation?.itemIds)
    },
    affectedExperiments: [observation?.experimentId],
    affectedProductionArea:
      OBSERVATION_AREA_BY_CATEGORY[observation?.category] ?? "grid-detection",
    hypothesis: `The repeated ${observationId} observation may indicate behavior shared by the affected experiment outputs.`
  };
}

function createRecurringDiagnosticCandidate(pattern) {
  const diagnosticType = pattern?.diagnosticType;

  return {
    title: `Recurring diagnostic: ${diagnosticType}`,
    evidence: {
      source: "recurring-diagnostic-pattern",
      pattern: {
        diagnosticType,
        observation: cloneValue(pattern?.observation)
      },
      itemCount: pattern?.itemCount,
      itemIds: cloneArray(pattern?.itemIds)
    },
    affectedExperiments: [],
    affectedProductionArea:
      DIAGNOSTIC_AREA_BY_TYPE[diagnosticType] ?? "grid-detection",
    hypothesis: `The recurring ${diagnosticType} pattern may be associated with undetected production grids for the listed items.`
  };
}

function cloneArray(value) {
  return Array.isArray(value) ? value.map(cloneValue) : [];
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
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
