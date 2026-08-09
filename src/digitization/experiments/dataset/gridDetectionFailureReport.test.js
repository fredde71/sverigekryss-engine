import { createGridDetectionFailureReport } from "./gridDetectionFailureReport";

test.each([
  null,
  undefined,
  {},
  { type: "digitization-dataset-run" },
  createDatasetReport({ datasetRun: { type: "other", status: "completed" } }),
  createDatasetReport({ datasetRun: { type: "digitization-dataset-run", status: "pending" } }),
  createDatasetReport({ items: null })
])("requires a completed digitization dataset report", value => {
  expect(() => createGridDetectionFailureReport(value)).toThrow(
    "Completed digitization dataset report is required"
  );
});

test("reports an empty dataset without inventing observations", () => {
  const report = createGridDetectionFailureReport(createDatasetReport());

  expect(report).toEqual({
    type: "grid-detection-failure-report",
    version: 1,
    dataset: {
      datasetId: "local-pdfs",
      datasetRunVersion: 1,
      datasetReportVersion: 1,
      itemCount: 0
    },
    production: {
      outcomes: {
        detectedCount: 0,
        notDetectedCount: 0,
        productionFailedCount: 0,
        productionNotRunCount: 0,
        unavailableCount: 0,
        items: []
      },
      failureReasons: {
        affectedItemCount: 0,
        groups: []
      },
      confidence: {
        availableItemCount: 0,
        unavailableItemCount: 0,
        values: [],
        unavailableItemIds: []
      }
    },
    experiments: {
      itemCountWithBenchmark: 0,
      itemCountWithoutBenchmark: 0,
      experiments: []
    },
    recurringDiagnosticPatterns: {
      patterns: []
    }
  });
});

test("summarizes mixed production outcomes in dataset order", () => {
  const input = createDatasetReport({
    items: [
      createItem({ id: "detected" }),
      createItem({ id: "missing", gridDetection: createGridDetection({ geometry: null }) }),
      createItem({
        id: "failed",
        production: failedStage("production failed")
      }),
      createItem({
        id: "not-run",
        production: { status: "not-run", reason: "preparation-failed" }
      }),
      createItem({ id: "unavailable", production: { status: "pending" } })
    ]
  });
  const outcomes = createGridDetectionFailureReport(input).production.outcomes;

  expect(outcomes).toMatchObject({
    detectedCount: 1,
    notDetectedCount: 1,
    productionFailedCount: 1,
    productionNotRunCount: 1,
    unavailableCount: 1
  });
  expect(outcomes.items.map(item => [item.id, item.outcome])).toEqual([
    ["detected", "detected"],
    ["missing", "not-detected"],
    ["failed", "production-failed"],
    ["not-run", "production-not-run"],
    ["unavailable", "unavailable"]
  ]);
});

test("groups identical rejection reasons and preserves first-observed order", () => {
  const horizontal = rejectionReason("horizontal", 1);
  const vertical = rejectionReason("vertical", 0);
  const report = createGridDetectionFailureReport(createDatasetReport({
    items: [
      createMissingItem("first", [horizontal, horizontal, vertical]),
      createMissingItem("second", [horizontal])
    ]
  }));

  expect(report.production.failureReasons).toEqual({
    affectedItemCount: 2,
    groups: [
      {
        id: "failure-reason-1",
        reason: {
          code: "insufficient-candidates",
          axis: "horizontal",
          candidateCount: 1,
          minimumCount: 2
        },
        itemCount: 2,
        itemIds: ["first", "second"]
      },
      {
        id: "failure-reason-2",
        reason: {
          code: "insufficient-candidates",
          axis: "vertical",
          candidateCount: 0,
          minimumCount: 2
        },
        itemCount: 1,
        itemIds: ["first"]
      }
    ]
  });
  expect(report.production.outcomes.items[0].failureReasonIds).toEqual([
    "failure-reason-1",
    "failure-reason-2"
  ]);
});

test("flattens explicit reason arrays without reinterpreting them", () => {
  const report = createGridDetectionFailureReport(createDatasetReport({
    items: [createMissingItem("item", [{
      type: "rejection-reasons",
      reasons: [{ code: "geometry-build-failed" }]
    }])]
  }));

  expect(report.production.failureReasons.groups[0].reason).toEqual({
    code: "geometry-build-failed"
  });
});

test("records missing geometry without an explicit rejection reason", () => {
  const report = createGridDetectionFailureReport(createDatasetReport({
    items: [createMissingItem("item")]
  }));

  expect(report.production.failureReasons.groups[0].reason).toEqual({
    code: "missing-grid-geometry-without-rejection-reason"
  });
});

test("preserves normalized production-stage failures", () => {
  const report = createGridDetectionFailureReport(createDatasetReport({
    items: [createItem({
      id: "failed",
      production: {
        status: "failed",
        error: { name: "TypeError", message: "cannot render" }
      }
    })]
  }));

  expect(report.production.failureReasons.groups[0]).toEqual({
    id: "failure-reason-1",
    reason: {
      code: "production-stage-failure",
      errorName: "TypeError",
      errorMessage: "cannot render"
    },
    itemCount: 1,
    itemIds: ["failed"]
  });
});

test("preserves exact confidence values and reports unavailable evidence", () => {
  const report = createGridDetectionFailureReport(createDatasetReport({
    items: [
      createItem({ id: "string", confidence: "detected" }),
      createItem({ id: "number-a", confidence: 0.5 }),
      createItem({ id: "number-b", confidence: 0.5 }),
      createItem({ id: "object", confidence: { source: "production" } }),
      createItem({ id: "null", confidence: null }),
      createItem({ id: "unavailable", includeConfidence: false })
    ]
  }));

  expect(report.production.confidence).toEqual({
    availableItemCount: 5,
    unavailableItemCount: 1,
    values: [
      { value: "detected", itemCount: 1, itemIds: ["string"] },
      { value: 0.5, itemCount: 2, itemIds: ["number-a", "number-b"] },
      { value: { source: "production" }, itemCount: 1, itemIds: ["object"] },
      { value: null, itemCount: 1, itemIds: ["null"] }
    ],
    unavailableItemIds: ["unavailable"]
  });
});

test("summarizes experiment executions without reordering by rate", () => {
  const report = createGridDetectionFailureReport(createDatasetReport({
    items: [
      createItem({
        id: "first",
        experiments: [
          experiment("experiment-b", false),
          experiment("experiment-a", true)
        ]
      }),
      createItem({
        id: "second",
        experiments: [
          experiment("experiment-b", true),
          experiment("experiment-a", true)
        ]
      })
    ]
  }));

  expect(report.experiments).toEqual({
    itemCountWithBenchmark: 2,
    itemCountWithoutBenchmark: 0,
    experiments: [
      {
        id: "experiment-b",
        description: "experiment-b description",
        executionCount: 2,
        successCount: 1,
        failureCount: 1,
        successRate: 0.5,
        successfulItemIds: ["second"],
        failedItemIds: ["first"]
      },
      {
        id: "experiment-a",
        description: "experiment-a description",
        executionCount: 2,
        successCount: 2,
        failureCount: 0,
        successRate: 1,
        successfulItemIds: ["first", "second"],
        failedItemIds: []
      }
    ]
  });
});

test("tracks items without completed benchmarks without creating failures", () => {
  const report = createGridDetectionFailureReport(createDatasetReport({
    items: [
      createItem({ id: "with", experiments: [] }),
      createItem({
        id: "without",
        comparison: { status: "failed", error: { name: "Error", message: "failed" } }
      })
    ]
  }));

  expect(report.experiments).toEqual({
    itemCountWithBenchmark: 1,
    itemCountWithoutBenchmark: 1,
    experiments: []
  });
});

test("reports recurring exact diagnostic patterns on failed detections", () => {
  const repeated = {
    type: "candidate-counts",
    axis: "vertical",
    acceptedCount: 1,
    rejectedCount: 3,
    totalCount: 4
  };
  const report = createGridDetectionFailureReport(createDatasetReport({
    items: [
      createMissingItem("first", [repeated]),
      createMissingItem("second", [repeated]),
      createMissingItem("third", [{
        ...repeated,
        axis: "horizontal"
      }])
    ]
  }));

  expect(report.recurringDiagnosticPatterns.patterns).toEqual([{
    id: "diagnostic-pattern-1",
    diagnosticType: "candidate-counts",
    observation: {
      axis: "vertical",
      acceptedCount: 1,
      rejectedCount: 3,
      totalCount: 4
    },
    itemCount: 2,
    itemIds: ["first", "second"]
  }]);
});

test("keeps diagnostic types and exact spacing measurements separate", () => {
  const report = createGridDetectionFailureReport(createDatasetReport({
    items: [
      createMissingItem("one", [spacingDiagnostic(0.9)]),
      createMissingItem("two", [spacingDiagnostic(0.8)]),
      createMissingItem("three", [{
        type: "unsupported-diagnostic",
        axis: "vertical",
        status: "measured",
        consistency: 0.9
      }])
    ]
  }));

  expect(report.recurringDiagnosticPatterns.patterns).toEqual([]);
});

test("reports supported recurring categorical patterns in first-observed order", () => {
  const diagnostics = [
    { type: "acceptance-status", accepted: false },
    { type: "pre-rejection-bounds", bounds: null }
  ];
  const report = createGridDetectionFailureReport(createDatasetReport({
    items: [
      createMissingItem("one", diagnostics),
      createMissingItem("two", diagnostics)
    ]
  }));

  expect(report.recurringDiagnosticPatterns.patterns.map(pattern => ({
    diagnosticType: pattern.diagnosticType,
    observation: pattern.observation
  }))).toEqual([
    {
      diagnosticType: "acceptance-status",
      observation: { accepted: false }
    },
    {
      diagnosticType: "pre-rejection-bounds",
      observation: { boundsStatus: "unavailable" }
    }
  ]);
});

test("does not infer recurring failure patterns from detected items", () => {
  const diagnostic = { type: "acceptance-status", accepted: true };
  const report = createGridDetectionFailureReport(createDatasetReport({
    items: [
      createItem({ id: "one", diagnostics: [diagnostic] }),
      createItem({ id: "two", diagnostics: [diagnostic] })
    ]
  }));

  expect(report.recurringDiagnosticPatterns.patterns).toEqual([]);
});

test("is deterministic and leaves frozen input untouched", () => {
  const input = deepFreeze(createDatasetReport({
    items: [createMissingItem("frozen", [spacingDiagnostic(0.9)])]
  }));
  const snapshot = JSON.stringify(input);

  const first = createGridDetectionFailureReport(input);
  const second = createGridDetectionFailureReport(input);

  expect(second).toEqual(first);
  expect(JSON.stringify(input)).toBe(snapshot);
  expect(Object.isFrozen(input)).toBe(true);
});

test("never accesses runtime image or production context fields", () => {
  const productionResult = {
    gridDetection: createGridDetection()
  };

  for (const field of [
    "context",
    "imageData",
    "binaryImage",
    "projections",
    "suggestions"
  ]) {
    Object.defineProperty(productionResult, field, {
      enumerable: true,
      get() {
        throw new Error(`${field} must not be accessed`);
      }
    });
  }

  expect(() => createGridDetectionFailureReport(createDatasetReport({
    items: [createItem({
      production: { status: "completed", result: productionResult }
    })]
  }))).not.toThrow();
});

test("introduces no ranking, recommendation or selection contract", () => {
  const report = createGridDetectionFailureReport(createDatasetReport({
    items: [createMissingItem("item")]
  }));
  const keys = collectKeys(report);

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

function createItem({
  id = "item",
  index = 0,
  metadata = { filename: `${id}.pdf` },
  status = "completed",
  production,
  gridDetection,
  confidence = "detected",
  includeConfidence = true,
  diagnostics = [],
  comparison,
  experiments = []
} = {}) {
  const resolvedGridDetection = gridDetection ?? createGridDetection({
    confidence,
    includeConfidence,
    diagnostics
  });

  return {
    id,
    index,
    metadata,
    status,
    preparation: { status: "completed" },
    production: production ?? {
      status: "completed",
      result: {
        gridDetection: resolvedGridDetection
      }
    },
    comparison: comparison ?? {
      status: "completed",
      result: {
        benchmark: { experiments }
      }
    },
    observationReport: { status: "completed", result: {} }
  };
}

function createGridDetection({
  geometry = {
    rows: 1,
    cols: 1,
    bounds: { top: 0, left: 0, width: 10, height: 10 },
    horizontalLines: [0, 10],
    verticalLines: [0, 10]
  },
  confidence = "detected",
  includeConfidence = true,
  diagnostics = []
} = {}) {
  const result = {
    geometry,
    diagnostics
  };

  if (includeConfidence) {
    result.confidence = confidence;
  }

  return result;
}

function createMissingItem(id, diagnostics = []) {
  return createItem({
    id,
    gridDetection: createGridDetection({
      geometry: null,
      confidence: "missing-grid-geometry",
      diagnostics
    })
  });
}

function rejectionReason(axis, candidateCount) {
  return {
    type: "rejection-reason",
    code: "insufficient-candidates",
    axis,
    candidateCount,
    minimumCount: 2
  };
}

function spacingDiagnostic(consistency) {
  return {
    type: "spacing-consistency",
    axis: "vertical",
    status: "measured",
    consistency,
    min: 9,
    max: 11,
    average: 10
  };
}

function experiment(id, success) {
  return {
    id,
    description: `${id} description`,
    durationMs: 1,
    success,
    diagnostics: {}
  };
}

function failedStage(message) {
  return {
    status: "failed",
    error: { name: "Error", message }
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
