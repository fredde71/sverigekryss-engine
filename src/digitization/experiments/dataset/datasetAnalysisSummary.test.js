import { createDatasetAnalysisSummary } from "./datasetAnalysisSummary";

test.each([
  {},
  { datasetReport: null, failureReport: createFailureReport() },
  {
    datasetReport: createDatasetReport({
      datasetRun: { type: "digitization-dataset-run", status: "pending" }
    }),
    failureReport: createFailureReport()
  }
])("requires a completed digitization dataset report", input => {
  expect(() => createDatasetAnalysisSummary(input)).toThrow(
    "Completed digitization dataset report is required"
  );
});

test.each([
  null,
  {},
  { type: "other" }
])("requires a grid detection failure report", failureReport => {
  expect(() => createDatasetAnalysisSummary({
    datasetReport: createDatasetReport(),
    failureReport
  })).toThrow("Grid detection failure report is required");
});

test("rejects reports with different dataset IDs", () => {
  expect(() => createDatasetAnalysisSummary({
    datasetReport: createDatasetReport(),
    failureReport: createFailureReport({ datasetId: "different" })
  })).toThrow("Dataset report IDs must match");
});

test("rejects reports with different item counts", () => {
  const items = [createItem("one")];

  expect(() => createDatasetAnalysisSummary({
    datasetReport: createDatasetReport({ items }),
    failureReport: createFailureReport({
      itemCount: 2,
      outcomeItems: [createOutcomeItem("one"), createOutcomeItem("two")]
    })
  })).toThrow("Dataset report item counts must match");
});

test("rejects different item identities or ordering", () => {
  const items = [createItem("one"), createItem("two")];

  expect(() => createDatasetAnalysisSummary({
    datasetReport: createDatasetReport({ items }),
    failureReport: createFailureReport({
      itemCount: 2,
      outcomeItems: [createOutcomeItem("two"), createOutcomeItem("one")]
    })
  })).toThrow("Dataset report item IDs and order must match");
});

test("creates the exact empty dataset summary", () => {
  const summary = createDatasetAnalysisSummary({
    datasetReport: createDatasetReport(),
    failureReport: createFailureReport()
  });

  expect(summary).toEqual({
    type: "digitization-dataset-analysis-summary",
    version: 1,
    dataset: {
      datasetId: "local-pdfs",
      itemCount: 0
    },
    sections: {
      completion: {
        summary: "0 of 0 puzzles completed.",
        totalCount: 0,
        completedCount: 0,
        incompleteCount: 0
      },
      gridDetection: {
        summary: "0 of 0 production grids were detected.",
        detectedCount: 0,
        notDetectedCount: 0,
        productionFailedCount: 0,
        productionNotRunCount: 0,
        unavailableCount: 0
      },
      productionFailureReasons: {
        summary: "No production failure reasons were recorded.",
        affectedItemCount: 0,
        reasons: []
      },
      productionConfidence: {
        summary: "No production confidence values were recorded.",
        availableItemCount: 0,
        unavailableItemCount: 0,
        values: [],
        unavailableItemIds: []
      },
      frequentExperimentObservations: {
        summary: "No available experiment observations were recorded.",
        maximumItemCount: null,
        observations: []
      },
      recurringDiagnosticPatterns: {
        summary: "No recurring production diagnostic patterns were recorded.",
        patterns: []
      }
    }
  });
});

test("counts only completed puzzle items", () => {
  const items = [
    createItem("completed", { status: "completed" }),
    createItem("failed", { status: "failed" }),
    createItem("pending", { status: "pending" })
  ];
  const summary = summarize({ items });

  expect(summary.sections.completion).toEqual({
    summary: "1 of 3 puzzles completed.",
    totalCount: 3,
    completedCount: 1,
    incompleteCount: 2
  });
});

test("copies production outcome counts without recomputing detection", () => {
  const items = [createItem("one"), createItem("two"), createItem("three")];
  const summary = summarize({
    items,
    outcomeCounts: {
      detectedCount: 1,
      notDetectedCount: 1,
      productionFailedCount: 1,
      productionNotRunCount: 0,
      unavailableCount: 0
    }
  });

  expect(summary.sections.gridDetection).toEqual({
    summary: "1 of 3 production grids were detected.",
    detectedCount: 1,
    notDetectedCount: 1,
    productionFailedCount: 1,
    productionNotRunCount: 0,
    unavailableCount: 0
  });
});

test("preserves failure reasons and produces deterministic labels", () => {
  const items = [createItem("one"), createItem("two")];
  const groups = [
    {
      id: "failure-reason-1",
      reason: {
        code: "insufficient-candidates",
        axis: "horizontal",
        candidateCount: 1,
        minimumCount: 2
      },
      itemCount: 2,
      itemIds: ["one", "two"]
    },
    {
      id: "failure-reason-2",
      reason: {
        code: "production-stage-failure",
        errorName: "TypeError",
        errorMessage: "cannot render"
      },
      itemCount: 1,
      itemIds: ["two"]
    },
    {
      id: "failure-reason-3",
      reason: { code: "geometry-build-failed" },
      itemCount: 1,
      itemIds: ["one"]
    }
  ];
  const section = summarize({
    items,
    failureReasons: { affectedItemCount: 2, groups }
  }).sections.productionFailureReasons;

  expect(section.summary).toBe(
    "3 distinct production failure reasons affected 2 puzzles."
  );
  expect(section.reasons.map(reason => reason.label)).toEqual([
    "insufficient-candidates (horizontal)",
    "production-stage-failure: TypeError: cannot render",
    "geometry-build-failed"
  ]);
  expect(section.reasons.map(reason => reason.reason)).toEqual(
    groups.map(group => group.reason)
  );
  expect(section.reasons.map(reason => reason.itemIds)).toEqual([
    ["one", "two"],
    ["two"],
    ["one"]
  ]);
});

test("preserves confidence values and creates stable JSON labels", () => {
  const items = [createItem("one"), createItem("two"), createItem("three")];
  const confidence = {
    availableItemCount: 2,
    unavailableItemCount: 1,
    values: [
      { value: "detected", itemCount: 1, itemIds: ["one"] },
      {
        value: { z: 2, a: { y: 1, b: 0 } },
        itemCount: 1,
        itemIds: ["two"]
      },
      { value: null, itemCount: 0, itemIds: [] }
    ],
    unavailableItemIds: ["three"]
  };
  const section = summarize({ items, confidence }).sections.productionConfidence;

  expect(section.summary).toBe(
    "3 production confidence values occurred across 2 puzzles."
  );
  expect(section.values.map(group => group.label)).toEqual([
    "\"detected\"",
    "{\"a\":{\"b\":0,\"y\":1},\"z\":2}",
    "null"
  ]);
  expect(section.values.map(group => group.value)).toEqual(
    confidence.values.map(group => group.value)
  );
  expect(section.unavailableItemIds).toEqual(["three"]);
});

test("groups exact experiment observations across distinct items", () => {
  const repeated = observation("experiment-a", "raw-length", 1200);
  const items = [
    createItem("one", { observations: [repeated, repeated] }),
    createItem("two", { observations: [repeated] }),
    createItem("three", {
      observations: [observation("experiment-a", "raw-length", 1300)]
    })
  ];
  const section = summarize({ items }).sections.frequentExperimentObservations;

  expect(section).toEqual({
    summary: "1 experiment observation had the maximum frequency of 2 puzzles.",
    maximumItemCount: 2,
    observations: [{
      experimentId: "experiment-a",
      category: "projection",
      observationId: "raw-length",
      value: 1200,
      itemCount: 2,
      itemIds: ["one", "two"]
    }]
  });
});

test("preserves all maximum-frequency ties in first-observed order", () => {
  const first = observation("experiment-b", "raw-length", 100);
  const second = observation("experiment-a", "raw-run-count", 4);
  const items = [
    createItem("one", { observations: [first, second] }),
    createItem("two", { observations: [first, second] })
  ];
  const section = summarize({ items }).sections.frequentExperimentObservations;

  expect(section.summary).toBe(
    "2 experiment observations shared the maximum frequency of 2 puzzles."
  );
  expect(section.observations.map(value => value.experimentId)).toEqual([
    "experiment-b",
    "experiment-a"
  ]);
  expect(section.observations.map(value => value.observationId)).toEqual([
    "raw-length",
    "raw-run-count"
  ]);
});

test("ignores unavailable and incomplete observation reports", () => {
  const items = [
    createItem("unavailable", {
      observations: null,
      observationStatus: "completed"
    }),
    createItem("failed", {
      observations: [observation("experiment", "ignored", 1)],
      observationStatus: "failed"
    })
  ];

  expect(
    summarize({ items }).sections.frequentExperimentObservations
  ).toEqual({
    summary: "No available experiment observations were recorded.",
    maximumItemCount: null,
    observations: []
  });
});

test("copies recurring diagnostic patterns exactly and preserves order", () => {
  const items = [createItem("one"), createItem("two")];
  const patterns = [
    {
      id: "diagnostic-pattern-2",
      diagnosticType: "spacing-consistency",
      observation: { axis: "vertical", status: "insufficient-candidates" },
      itemCount: 2,
      itemIds: ["one", "two"]
    },
    {
      id: "diagnostic-pattern-1",
      diagnosticType: "acceptance-status",
      observation: { accepted: false },
      itemCount: 2,
      itemIds: ["one", "two"]
    }
  ];
  const section = summarize({ items, patterns }).sections.recurringDiagnosticPatterns;

  expect(section.summary).toBe(
    "2 recurring production diagnostic patterns were recorded."
  );
  expect(section.patterns).toEqual(patterns);
  expect(section.patterns).not.toBe(patterns);
});

test("uses singular human-readable sentence templates", () => {
  const items = [createItem("one")];
  const summary = summarize({
    items,
    outcomeCounts: {
      detectedCount: 1,
      notDetectedCount: 0,
      productionFailedCount: 0,
      productionNotRunCount: 0,
      unavailableCount: 0
    },
    failureReasons: {
      affectedItemCount: 1,
      groups: [{
        id: "failure-reason-1",
        reason: { code: "geometry-build-failed" },
        itemCount: 1,
        itemIds: ["one"]
      }]
    },
    confidence: {
      availableItemCount: 1,
      unavailableItemCount: 0,
      values: [{ value: "detected", itemCount: 1, itemIds: ["one"] }],
      unavailableItemIds: []
    },
    patterns: [{
      id: "diagnostic-pattern-1",
      diagnosticType: "acceptance-status",
      observation: { accepted: false },
      itemCount: 1,
      itemIds: ["one"]
    }]
  });

  expect(summary.sections.completion.summary).toBe("1 of 1 puzzle completed.");
  expect(summary.sections.gridDetection.summary).toBe(
    "1 of 1 production grid was detected."
  );
  expect(summary.sections.productionFailureReasons.summary).toBe(
    "1 distinct production failure reason affected 1 puzzle."
  );
  expect(summary.sections.productionConfidence.summary).toBe(
    "1 production confidence value occurred across 1 puzzle."
  );
  expect(summary.sections.recurringDiagnosticPatterns.summary).toBe(
    "1 recurring production diagnostic pattern was recorded."
  );
});

test("is deterministic and leaves frozen reports untouched", () => {
  const items = [createItem("one", {
    observations: [observation("experiment", "raw-length", { z: 2, a: 1 })]
  })];
  const datasetReport = deepFreeze(createDatasetReport({ items }));
  const failureReport = deepFreeze(createFailureReport({
    itemCount: 1,
    outcomeItems: [createOutcomeItem("one")]
  }));
  const datasetSnapshot = JSON.stringify(datasetReport);
  const failureSnapshot = JSON.stringify(failureReport);

  const first = createDatasetAnalysisSummary({ datasetReport, failureReport });
  const second = createDatasetAnalysisSummary({ datasetReport, failureReport });

  expect(second).toEqual(first);
  expect(JSON.stringify(datasetReport)).toBe(datasetSnapshot);
  expect(JSON.stringify(failureReport)).toBe(failureSnapshot);
});

test("never accesses production or runtime image fields", () => {
  const item = createItem("one");

  for (const field of [
    "production",
    "context",
    "imageData",
    "binaryImage",
    "canvas",
    "projections"
  ]) {
    Object.defineProperty(item, field, {
      enumerable: true,
      get() {
        throw new Error(`${field} must not be accessed`);
      }
    });
  }

  expect(() => summarize({ items: [item] })).not.toThrow();
});

test("introduces no scoring, ranking, selection or recommendation contract", () => {
  const summary = summarize({
    items: [createItem("one", {
      observations: [observation("experiment", "raw-length", 100)]
    })]
  });
  const keys = collectKeys(summary);

  expect(keys).not.toEqual(expect.arrayContaining([
    "rank",
    "ranking",
    "winner",
    "best",
    "recommendation",
    "selectedExperiment",
    "score"
  ]));
});

function summarize({
  items = [],
  outcomeCounts,
  failureReasons,
  confidence,
  patterns
} = {}) {
  return createDatasetAnalysisSummary({
    datasetReport: createDatasetReport({ items }),
    failureReport: createFailureReport({
      itemCount: items.length,
      outcomeItems: items.map(item => createOutcomeItem(item.id)),
      outcomeCounts: outcomeCounts ?? {
        detectedCount: items.length,
        notDetectedCount: 0,
        productionFailedCount: 0,
        productionNotRunCount: 0,
        unavailableCount: 0
      },
      failureReasons,
      confidence,
      patterns
    })
  });
}

function createDatasetReport(overrides = {}) {
  return {
    type: "digitization-dataset-report",
    version: 1,
    datasetRun: {
      type: "digitization-dataset-run",
      version: 1,
      datasetId: "local-pdfs",
      status: "completed"
    },
    items: [],
    ...overrides
  };
}

function createFailureReport({
  datasetId = "local-pdfs",
  itemCount = 0,
  outcomeItems = [],
  outcomeCounts = {},
  failureReasons = {
    affectedItemCount: 0,
    groups: []
  },
  confidence = {
    availableItemCount: 0,
    unavailableItemCount: itemCount,
    values: [],
    unavailableItemIds: outcomeItems.map(item => item.id)
  },
  patterns = []
} = {}) {
  return {
    type: "grid-detection-failure-report",
    version: 1,
    dataset: {
      datasetId,
      datasetRunVersion: 1,
      datasetReportVersion: 1,
      itemCount
    },
    production: {
      outcomes: {
        detectedCount: 0,
        notDetectedCount: 0,
        productionFailedCount: 0,
        productionNotRunCount: 0,
        unavailableCount: 0,
        ...outcomeCounts,
        items: outcomeItems
      },
      failureReasons,
      confidence
    },
    experiments: {
      itemCountWithBenchmark: 0,
      itemCountWithoutBenchmark: itemCount,
      experiments: []
    },
    recurringDiagnosticPatterns: {
      patterns
    }
  };
}

function createItem(id, {
  status = "completed",
  observations = [],
  observationStatus = "completed"
} = {}) {
  return {
    id,
    index: 0,
    metadata: { filename: `${id}.pdf` },
    status,
    observationReport: {
      status: observationStatus,
      result: {
        observations: {
          available: observations
        }
      }
    }
  };
}

function createOutcomeItem(id) {
  return {
    id,
    outcome: "detected"
  };
}

function observation(experimentId, observationId, value) {
  return {
    experimentId,
    category: "projection",
    observationId,
    value
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function collectKeys(value) {
  if (Array.isArray(value)) {
    return value.flatMap(collectKeys);
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return [
    ...Object.keys(value),
    ...Object.values(value).flatMap(collectKeys)
  ];
}
