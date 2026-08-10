const ANALYSIS_SUMMARY_VERSION = 1;

export function createDatasetAnalysisSummary({
  datasetReport,
  failureReport
} = {}) {
  validateReports(datasetReport, failureReport);

  const itemCount = datasetReport.items.length;
  const completedCount = datasetReport.items.filter(item => (
    item?.status === "completed"
  )).length;
  const outcomes = failureReport.production.outcomes;
  const failureReasons = failureReport.production.failureReasons;
  const confidence = failureReport.production.confidence;
  const recurringPatterns = failureReport.recurringDiagnosticPatterns.patterns;
  const frequentObservations = findFrequentExperimentObservations(datasetReport.items);

  return {
    type: "digitization-dataset-analysis-summary",
    version: ANALYSIS_SUMMARY_VERSION,
    dataset: {
      datasetId: datasetReport.datasetRun.datasetId,
      itemCount
    },
    sections: {
      completion: {
        summary: `${completedCount} of ${itemCount} ${pluralize(itemCount, "puzzle", "puzzles")} completed.`,
        totalCount: itemCount,
        completedCount,
        incompleteCount: itemCount - completedCount
      },
      gridDetection: {
        summary: createGridDetectionSummary(outcomes.detectedCount, itemCount),
        detectedCount: outcomes.detectedCount,
        notDetectedCount: outcomes.notDetectedCount,
        productionFailedCount: outcomes.productionFailedCount,
        productionNotRunCount: outcomes.productionNotRunCount,
        unavailableCount: outcomes.unavailableCount
      },
      productionFailureReasons: {
        summary: createFailureReasonSummary(
          failureReasons.groups.length,
          failureReasons.affectedItemCount
        ),
        affectedItemCount: failureReasons.affectedItemCount,
        reasons: failureReasons.groups.map(group => ({
          id: group.id,
          label: createFailureReasonLabel(group.reason),
          reason: cloneValue(group.reason),
          itemCount: group.itemCount,
          itemIds: group.itemIds.slice()
        }))
      },
      productionConfidence: {
        summary: createConfidenceSummary(
          confidence.values.length,
          confidence.availableItemCount
        ),
        availableItemCount: confidence.availableItemCount,
        unavailableItemCount: confidence.unavailableItemCount,
        values: confidence.values.map(group => ({
          label: stableJson(group.value),
          value: cloneValue(group.value),
          itemCount: group.itemCount,
          itemIds: group.itemIds.slice()
        })),
        unavailableItemIds: confidence.unavailableItemIds.slice()
      },
      frequentExperimentObservations: {
        summary: createFrequentObservationSummary(frequentObservations),
        maximumItemCount: frequentObservations.maximumItemCount,
        observations: frequentObservations.observations
      },
      recurringDiagnosticPatterns: {
        summary: createRecurringPatternSummary(recurringPatterns.length),
        patterns: recurringPatterns.map(cloneValue)
      }
    }
  };
}

function validateReports(datasetReport, failureReport) {
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

  if (
    !failureReport
    || typeof failureReport !== "object"
    || failureReport.type !== "grid-detection-failure-report"
    || !failureReport.dataset
    || !failureReport.production?.outcomes
    || !Array.isArray(failureReport.production.outcomes.items)
    || !failureReport.production?.failureReasons
    || !Array.isArray(failureReport.production.failureReasons.groups)
    || !failureReport.production?.confidence
    || !Array.isArray(failureReport.production.confidence.values)
    || !Array.isArray(failureReport.production.confidence.unavailableItemIds)
    || !Array.isArray(failureReport.recurringDiagnosticPatterns?.patterns)
  ) {
    throw new Error("Grid detection failure report is required");
  }

  if (datasetReport.datasetRun.datasetId !== failureReport.dataset.datasetId) {
    throw new Error("Dataset report IDs must match");
  }

  if (
    datasetReport.items.length !== failureReport.dataset.itemCount
    || datasetReport.items.length !== failureReport.production.outcomes.items.length
  ) {
    throw new Error("Dataset report item counts must match");
  }

  for (let index = 0; index < datasetReport.items.length; index++) {
    if (
      datasetReport.items[index]?.id
      !== failureReport.production.outcomes.items[index]?.id
    ) {
      throw new Error("Dataset report item IDs and order must match");
    }
  }
}

function findFrequentExperimentObservations(items) {
  const groups = [];
  const groupsByKey = new Map();

  for (const item of items) {
    const available = item?.observationReport?.status === "completed"
      ? item.observationReport.result?.observations?.available
      : null;

    if (!Array.isArray(available)) {
      continue;
    }

    const itemObservationKeys = new Set();

    for (const observation of available) {
      const identity = {
        experimentId: observation?.experimentId,
        category: observation?.category,
        observationId: observation?.observationId,
        value: cloneValue(observation?.value)
      };
      const key = stableJson(identity);

      if (itemObservationKeys.has(key)) {
        continue;
      }

      itemObservationKeys.add(key);

      let group = groupsByKey.get(key);

      if (!group) {
        group = {
          ...identity,
          itemIds: []
        };
        groups.push(group);
        groupsByKey.set(key, group);
      }

      group.itemIds.push(item?.id);
    }
  }

  if (groups.length === 0) {
    return {
      maximumItemCount: null,
      observations: []
    };
  }

  const maximumItemCount = Math.max(...groups.map(group => group.itemIds.length));

  return {
    maximumItemCount,
    observations: groups
      .filter(group => group.itemIds.length === maximumItemCount)
      .map(group => ({
        experimentId: group.experimentId,
        category: group.category,
        observationId: group.observationId,
        value: cloneValue(group.value),
        itemCount: group.itemIds.length,
        itemIds: group.itemIds.slice()
      }))
  };
}

function createGridDetectionSummary(detectedCount, itemCount) {
  const noun = pluralize(itemCount, "production grid", "production grids");
  const verb = itemCount === 1 ? "was" : "were";

  return `${detectedCount} of ${itemCount} ${noun} ${verb} detected.`;
}

function createFailureReasonSummary(reasonCount, affectedItemCount) {
  if (reasonCount === 0) {
    return "No production failure reasons were recorded.";
  }

  return `${reasonCount} distinct production ${pluralize(
    reasonCount,
    "failure reason",
    "failure reasons"
  )} affected ${affectedItemCount} ${pluralize(
    affectedItemCount,
    "puzzle",
    "puzzles"
  )}.`;
}

function createConfidenceSummary(valueCount, availableItemCount) {
  if (valueCount === 0) {
    return "No production confidence values were recorded.";
  }

  return `${valueCount} production ${pluralize(
    valueCount,
    "confidence value",
    "confidence values"
  )} occurred across ${availableItemCount} ${pluralize(
    availableItemCount,
    "puzzle",
    "puzzles"
  )}.`;
}

function createFrequentObservationSummary({
  maximumItemCount,
  observations
}) {
  if (maximumItemCount === null) {
    return "No available experiment observations were recorded.";
  }

  const observationCount = observations.length;
  const verb = observationCount === 1 ? "had" : "shared";

  return `${observationCount} experiment ${pluralize(
    observationCount,
    "observation",
    "observations"
  )} ${verb} the maximum frequency of ${maximumItemCount} ${pluralize(
    maximumItemCount,
    "puzzle",
    "puzzles"
  )}.`;
}

function createRecurringPatternSummary(patternCount) {
  if (patternCount === 0) {
    return "No recurring production diagnostic patterns were recorded.";
  }

  const verb = patternCount === 1 ? "was" : "were";

  return `${patternCount} recurring production diagnostic ${pluralize(
    patternCount,
    "pattern",
    "patterns"
  )} ${verb} recorded.`;
}

function createFailureReasonLabel(reason) {
  if (reason?.code === "production-stage-failure") {
    const errorParts = [reason.errorName, reason.errorMessage]
      .filter(value => value !== undefined && value !== null && value !== "");

    return errorParts.length > 0
      ? `${reason.code}: ${errorParts.join(": ")}`
      : reason.code;
  }

  if (reason?.axis !== undefined) {
    return `${reason.code} (${reason.axis})`;
  }

  return String(reason?.code);
}

function pluralize(count, singular, plural) {
  return count === 1 ? singular : plural;
}

function stableJson(value) {
  return JSON.stringify(sortObjectKeys(value));
}

function sortObjectKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, sortObjectKeys(value[key])])
    );
  }

  return value;
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
