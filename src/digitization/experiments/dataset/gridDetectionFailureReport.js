const FAILURE_REPORT_VERSION = 1;

const DIAGNOSTIC_PATTERN_EXTRACTORS = Object.freeze({
  "candidate-counts": extractCandidateCountPattern,
  "spacing-consistency": extractSpacingPattern,
  "acceptance-status": extractAcceptancePattern,
  "rejection-reason": extractRejectionPattern,
  "pre-rejection-bounds": extractBoundsAvailabilityPattern
});

export function createGridDetectionFailureReport(datasetReport) {
  validateDatasetReport(datasetReport);

  const failureGroups = [];
  const failureGroupsByKey = new Map();
  const confidenceGroups = [];
  const confidenceGroupsByKey = new Map();
  const unavailableConfidenceItemIds = [];
  const experimentGroups = [];
  const experimentGroupsById = new Map();
  const diagnosticPatternGroups = [];
  const diagnosticPatternGroupsByKey = new Map();
  const outcomeItems = [];
  const outcomeCounts = {
    detectedCount: 0,
    notDetectedCount: 0,
    productionFailedCount: 0,
    productionNotRunCount: 0,
    unavailableCount: 0
  };
  let itemCountWithBenchmark = 0;

  for (const item of datasetReport.items) {
    const productionObservation = observeProduction(item);
    const failureReasonIds = [];

    outcomeCounts[productionObservation.countKey] += 1;

    for (const reason of productionObservation.failureReasons) {
      const group = addFailureReason({
        reason,
        item,
        groups: failureGroups,
        groupsByKey: failureGroupsByKey
      });

      failureReasonIds.push(group.id);
    }

    if (productionObservation.confidence.status === "available") {
      addConfidenceValue({
        value: productionObservation.confidence.value,
        item,
        groups: confidenceGroups,
        groupsByKey: confidenceGroupsByKey
      });
    } else {
      unavailableConfidenceItemIds.push(item?.id);
    }

    outcomeItems.push({
      id: item?.id,
      index: item?.index,
      metadata: cloneValue(item?.metadata ?? {}),
      itemStatus: item?.status,
      productionStatus: item?.production?.status,
      outcome: productionObservation.outcome,
      confidence: cloneValue(productionObservation.confidence),
      failureReasonIds
    });

    if (productionObservation.outcome === "not-detected") {
      collectDiagnosticPatterns({
        diagnostics: productionObservation.gridDetection.diagnostics,
        item,
        groups: diagnosticPatternGroups,
        groupsByKey: diagnosticPatternGroupsByKey
      });
    }

    const experiments = item?.comparison?.status === "completed"
      ? item.comparison.result?.benchmark?.experiments
      : null;

    if (Array.isArray(experiments)) {
      itemCountWithBenchmark += 1;
      collectExperimentExecutions({
        experiments,
        item,
        groups: experimentGroups,
        groupsById: experimentGroupsById
      });
    }
  }

  return {
    type: "grid-detection-failure-report",
    version: FAILURE_REPORT_VERSION,
    dataset: {
      datasetId: datasetReport.datasetRun.datasetId,
      datasetRunVersion: datasetReport.datasetRun.version,
      datasetReportVersion: datasetReport.version,
      itemCount: datasetReport.items.length
    },
    production: {
      outcomes: {
        ...outcomeCounts,
        items: outcomeItems
      },
      failureReasons: {
        affectedItemCount: outcomeItems.filter(item => (
          item.failureReasonIds.length > 0
        )).length,
        groups: failureGroups.map(group => ({
          id: group.id,
          reason: cloneValue(group.reason),
          itemCount: group.itemIds.length,
          itemIds: group.itemIds.slice()
        }))
      },
      confidence: {
        availableItemCount: confidenceGroups.reduce(
          (count, group) => count + group.itemIds.length,
          0
        ),
        unavailableItemCount: unavailableConfidenceItemIds.length,
        values: confidenceGroups.map(group => ({
          value: cloneValue(group.value),
          itemCount: group.itemIds.length,
          itemIds: group.itemIds.slice()
        })),
        unavailableItemIds: unavailableConfidenceItemIds.slice()
      }
    },
    experiments: {
      itemCountWithBenchmark,
      itemCountWithoutBenchmark: datasetReport.items.length - itemCountWithBenchmark,
      experiments: experimentGroups.map(group => ({
        id: group.id,
        description: group.description,
        executionCount: group.successfulItemIds.length + group.failedItemIds.length,
        successCount: group.successfulItemIds.length,
        failureCount: group.failedItemIds.length,
        successRate: calculateRate(
          group.successfulItemIds.length,
          group.successfulItemIds.length + group.failedItemIds.length
        ),
        successfulItemIds: group.successfulItemIds.slice(),
        failedItemIds: group.failedItemIds.slice()
      }))
    },
    recurringDiagnosticPatterns: {
      patterns: diagnosticPatternGroups
        .filter(group => group.itemIds.length >= 2)
        .map((group, index) => ({
          id: `diagnostic-pattern-${index + 1}`,
          diagnosticType: group.diagnosticType,
          observation: cloneValue(group.observation),
          itemCount: group.itemIds.length,
          itemIds: group.itemIds.slice()
        }))
    }
  };
}

function validateDatasetReport(datasetReport) {
  if (
    !datasetReport
    || typeof datasetReport !== "object"
    || datasetReport.type !== "digitization-dataset-report"
    || datasetReport.datasetRun?.type !== "digitization-dataset-run"
    || datasetReport.datasetRun?.status !== "completed"
    || !Array.isArray(datasetReport.items)
  ) {
    throw new Error("Completed digitization dataset report is required");
  }
}

function observeProduction(item) {
  const stage = item?.production;

  if (stage?.status === "failed") {
    return {
      outcome: "production-failed",
      countKey: "productionFailedCount",
      confidence: unavailableConfidence(),
      failureReasons: [{
        code: "production-stage-failure",
        errorName: stage.error?.name,
        errorMessage: stage.error?.message
      }],
      gridDetection: null
    };
  }

  if (stage?.status === "not-run") {
    return {
      outcome: "production-not-run",
      countKey: "productionNotRunCount",
      confidence: unavailableConfidence(),
      failureReasons: [],
      gridDetection: null
    };
  }

  if (stage?.status !== "completed") {
    return unavailableProductionObservation();
  }

  const gridDetection = stage.result?.gridDetection;

  if (!gridDetection || typeof gridDetection !== "object") {
    return {
      ...unavailableProductionObservation(),
      failureReasons: [{ code: "grid-detection-unavailable" }]
    };
  }

  const confidence = hasOwn(gridDetection, "confidence")
    && gridDetection.confidence !== undefined
    ? {
      status: "available",
      value: cloneValue(gridDetection.confidence)
    }
    : unavailableConfidence();
  const diagnostics = Array.isArray(gridDetection.diagnostics)
    ? gridDetection.diagnostics
    : [];

  if (gridDetection.geometry) {
    return {
      outcome: "detected",
      countKey: "detectedCount",
      confidence,
      failureReasons: [],
      gridDetection: {
        diagnostics
      }
    };
  }

  const failureReasons = extractFailureReasons(diagnostics);

  return {
    outcome: "not-detected",
    countKey: "notDetectedCount",
    confidence,
    failureReasons: failureReasons.length > 0
      ? failureReasons
      : [{ code: "missing-grid-geometry-without-rejection-reason" }],
    gridDetection: {
      diagnostics
    }
  };
}

function unavailableProductionObservation() {
  return {
    outcome: "unavailable",
    countKey: "unavailableCount",
    confidence: unavailableConfidence(),
    failureReasons: [],
    gridDetection: null
  };
}

function unavailableConfidence() {
  return {
    status: "unavailable",
    value: null
  };
}

function extractFailureReasons(diagnostics) {
  const reasons = [];
  const reasonKeys = new Set();

  for (const diagnostic of diagnostics) {
    const candidates = [];

    if (diagnostic?.type === "rejection-reason") {
      candidates.push(diagnostic);
    }

    if (Array.isArray(diagnostic?.reasons)) {
      candidates.push(...diagnostic.reasons);
    }

    for (const candidate of candidates) {
      const reason = normalizeRejectionReason(candidate);
      const key = stableSerialize(reason);

      if (!reasonKeys.has(key)) {
        reasonKeys.add(key);
        reasons.push(reason);
      }
    }
  }

  return reasons;
}

function normalizeRejectionReason(reason) {
  return copyDefinedFields(reason, [
    "code",
    "axis",
    "candidateCount",
    "minimumCount"
  ]);
}

function addFailureReason({
  reason,
  item,
  groups,
  groupsByKey
}) {
  const key = stableSerialize(reason);
  let group = groupsByKey.get(key);

  if (!group) {
    group = {
      id: `failure-reason-${groups.length + 1}`,
      reason: cloneValue(reason),
      itemIds: []
    };
    groups.push(group);
    groupsByKey.set(key, group);
  }

  addUnique(group.itemIds, item?.id);
  return group;
}

function addConfidenceValue({
  value,
  item,
  groups,
  groupsByKey
}) {
  const key = stableSerialize(value);
  let group = groupsByKey.get(key);

  if (!group) {
    group = {
      value: cloneValue(value),
      itemIds: []
    };
    groups.push(group);
    groupsByKey.set(key, group);
  }

  addUnique(group.itemIds, item?.id);
}

function collectExperimentExecutions({
  experiments,
  item,
  groups,
  groupsById
}) {
  for (const experiment of experiments) {
    let group = groupsById.get(experiment?.id);

    if (!group) {
      group = {
        id: experiment?.id,
        description: experiment?.description,
        successfulItemIds: [],
        failedItemIds: []
      };
      groups.push(group);
      groupsById.set(experiment?.id, group);
    }

    if (experiment?.success === true) {
      group.successfulItemIds.push(item?.id);
    } else {
      group.failedItemIds.push(item?.id);
    }
  }
}

function collectDiagnosticPatterns({
  diagnostics,
  item,
  groups,
  groupsByKey
}) {
  for (const diagnostic of diagnostics) {
    const extractor = DIAGNOSTIC_PATTERN_EXTRACTORS[diagnostic?.type];

    if (!extractor) {
      continue;
    }

    const observation = extractor(diagnostic);
    const key = stableSerialize({
      diagnosticType: diagnostic.type,
      observation
    });
    let group = groupsByKey.get(key);

    if (!group) {
      group = {
        diagnosticType: diagnostic.type,
        observation,
        itemIds: []
      };
      groups.push(group);
      groupsByKey.set(key, group);
    }

    addUnique(group.itemIds, item?.id);
  }
}

function extractCandidateCountPattern(diagnostic) {
  return copyDefinedFields(diagnostic, [
    "axis",
    "acceptedCount",
    "rejectedCount",
    "totalCount"
  ]);
}

function extractSpacingPattern(diagnostic) {
  return copyDefinedFields(diagnostic, [
    "axis",
    "status",
    "consistency",
    "min",
    "max",
    "average"
  ]);
}

function extractAcceptancePattern(diagnostic) {
  return copyDefinedFields(diagnostic, ["accepted"]);
}

function extractRejectionPattern(diagnostic) {
  return normalizeRejectionReason(diagnostic);
}

function extractBoundsAvailabilityPattern(diagnostic) {
  return {
    boundsStatus: diagnostic?.bounds
      ? "available"
      : "unavailable"
  };
}

function copyDefinedFields(source, fields) {
  const result = {};

  for (const field of fields) {
    if (hasOwn(source, field) && source[field] !== undefined) {
      result[field] = cloneValue(source[field]);
    }
  }

  return result;
}

function calculateRate(value, total) {
  return total > 0 ? value / total : null;
}

function addUnique(values, value) {
  if (!values.includes(value)) {
    values.push(value);
  }
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

function hasOwn(value, key) {
  return value !== null
    && value !== undefined
    && Object.prototype.hasOwnProperty.call(value, key);
}
