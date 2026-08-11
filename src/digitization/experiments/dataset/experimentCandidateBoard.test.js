import { createExperimentCandidateBoard } from "./experimentCandidateBoard";

test.each([
  null,
  undefined,
  {},
  { type: "other" },
  createAnalysisSummary({ failureReasons: null }),
  createAnalysisSummary({ experimentObservations: null }),
  createAnalysisSummary({ recurringPatterns: null })
])("requires a digitization dataset analysis summary", value => {
  expect(() => createExperimentCandidateBoard(value)).toThrow(
    "Digitization dataset analysis summary is required"
  );
});

test("creates the exact empty candidate board", () => {
  expect(createExperimentCandidateBoard(createAnalysisSummary())).toEqual({
    type: "experiment-candidate-board",
    version: 1,
    dataset: {
      datasetId: "local-pdfs",
      itemCount: 12
    },
    candidates: []
  });
});

test("does not create candidates from completion, grid totals or confidence inventories", () => {
  const summary = createAnalysisSummary();
  summary.sections.completion = {
    completedCount: 1,
    incompleteCount: 99
  };
  summary.sections.gridDetection = {
    detectedCount: 1,
    notDetectedCount: 99
  };
  summary.sections.productionConfidence = {
    values: [{ value: "missing-grid", itemCount: 99 }]
  };

  expect(createExperimentCandidateBoard(summary).candidates).toEqual([]);
});

test("creates a production failure candidate with exact first-party evidence", () => {
  const reason = failureReason({
    label: "insufficient-candidates (horizontal)",
    reason: {
      code: "insufficient-candidates",
      axis: "horizontal",
      candidateCount: 1,
      minimumCount: 2
    },
    itemCount: 3,
    itemIds: ["item-7", "item-2", "item-9"]
  });
  const candidate = createExperimentCandidateBoard(createAnalysisSummary({
    failureReasons: [reason]
  })).candidates[0];

  expect(candidate).toEqual({
    id: "candidate-001",
    title: "Production failure: insufficient-candidates (horizontal)",
    evidence: {
      source: "production-failure-reason",
      pattern: reason.reason,
      itemCount: 3,
      itemIds: ["item-7", "item-2", "item-9"]
    },
    affectedExperiments: [],
    affectedProductionArea: "line-candidate-detection",
    hypothesis: "The recorded insufficient-candidates pattern may be associated with production grid-detection failures for the listed items."
  });
});

test("creates a frequent experiment observation candidate", () => {
  const candidate = createExperimentCandidateBoard(createAnalysisSummary({
    experimentObservations: [experimentObservation({
      experimentId: "vertical-continuity",
      category: "projection",
      observationId: "raw-length",
      value: 1200,
      itemCount: 4,
      itemIds: ["item-4", "item-1"]
    })]
  })).candidates[0];

  expect(candidate).toEqual({
    id: "candidate-001",
    title: "Experiment observation: raw-length",
    evidence: {
      source: "frequent-experiment-observation",
      pattern: {
        category: "projection",
        observationId: "raw-length",
        value: 1200
      },
      itemCount: 4,
      itemIds: ["item-4", "item-1"]
    },
    affectedExperiments: ["vertical-continuity"],
    affectedProductionArea: "projection-analysis",
    hypothesis: "The repeated raw-length observation may indicate behavior shared by the affected experiment outputs."
  });
});

test("creates a recurring diagnostic pattern candidate", () => {
  const candidate = createExperimentCandidateBoard(createAnalysisSummary({
    recurringPatterns: [recurringPattern({
      diagnosticType: "spacing-consistency",
      observation: {
        axis: "vertical",
        status: "insufficient-candidates"
      },
      itemCount: 5,
      itemIds: ["item-5", "item-3"]
    })]
  })).candidates[0];

  expect(candidate).toEqual({
    id: "candidate-001",
    title: "Recurring diagnostic: spacing-consistency",
    evidence: {
      source: "recurring-diagnostic-pattern",
      pattern: {
        diagnosticType: "spacing-consistency",
        observation: {
          axis: "vertical",
          status: "insufficient-candidates"
        }
      },
      itemCount: 5,
      itemIds: ["item-5", "item-3"]
    },
    affectedExperiments: [],
    affectedProductionArea: "grid-spacing-analysis",
    hypothesis: "The recurring spacing-consistency pattern may be associated with undetected production grids for the listed items."
  });
});

test.each([
  ["insufficient-candidates", "line-candidate-detection"],
  ["geometry-build-failed", "grid-geometry-construction"],
  ["missing-grid-geometry-without-rejection-reason", "grid-geometry-detection"],
  ["grid-detection-unavailable", "grid-detection"],
  ["production-stage-failure", "production-execution"]
])("classifies the %s production failure area", (code, expectedArea) => {
  const board = createExperimentCandidateBoard(createAnalysisSummary({
    failureReasons: [failureReason({ reason: { code } })]
  }));

  expect(board.candidates[0].affectedProductionArea).toBe(expectedArea);
});

test.each([
  ["candidate-counts", "line-candidate-detection"],
  ["spacing-consistency", "grid-spacing-analysis"],
  ["acceptance-status", "grid-acceptance"],
  ["rejection-reason", "grid-rejection"],
  ["pre-rejection-bounds", "grid-bounds-detection"]
])("classifies the %s recurring diagnostic area", (diagnosticType, expectedArea) => {
  const board = createExperimentCandidateBoard(createAnalysisSummary({
    recurringPatterns: [recurringPattern({ diagnosticType })]
  }));

  expect(board.candidates[0].affectedProductionArea).toBe(expectedArea);
});

test.each(["projection", "processed-projection"])(
  "classifies the %s observation category",
  category => {
    const board = createExperimentCandidateBoard(createAnalysisSummary({
      experimentObservations: [experimentObservation({ category })]
    }));

    expect(board.candidates[0].affectedProductionArea).toBe("projection-analysis");
  }
);

test.each([
  {
    failureReasons: [failureReason({ reason: { code: "unknown-failure" } })]
  },
  {
    experimentObservations: [experimentObservation({ category: "unknown-category" })]
  },
  {
    recurringPatterns: [recurringPattern({ diagnosticType: "unknown-diagnostic" })]
  }
])("uses the neutral grid-detection area for unknown classifications", overrides => {
  const candidate = createExperimentCandidateBoard(
    createAnalysisSummary(overrides)
  ).candidates[0];

  expect(candidate.affectedProductionArea).toBe("grid-detection");
});

test("preserves fixed source order, supplied order and item IDs", () => {
  const board = createExperimentCandidateBoard(createAnalysisSummary({
    failureReasons: [
      failureReason({ label: "failure-z", reason: { code: "z" }, itemCount: 1 }),
      failureReason({ label: "failure-a", reason: { code: "a" }, itemCount: 99 })
    ],
    experimentObservations: [
      experimentObservation({ observationId: "observation-z", itemCount: 1 }),
      experimentObservation({ observationId: "observation-a", itemCount: 99 })
    ],
    recurringPatterns: [
      recurringPattern({
        diagnosticType: "pattern-z",
        itemCount: 1,
        itemIds: ["item-z", "item-a"]
      }),
      recurringPattern({ diagnosticType: "pattern-a", itemCount: 99 })
    ]
  }));

  expect(board.candidates.map(candidate => candidate.id)).toEqual([
    "candidate-001",
    "candidate-002",
    "candidate-003",
    "candidate-004",
    "candidate-005",
    "candidate-006"
  ]);
  expect(board.candidates.map(candidate => candidate.title)).toEqual([
    "Production failure: failure-z",
    "Production failure: failure-a",
    "Experiment observation: observation-z",
    "Experiment observation: observation-a",
    "Recurring diagnostic: pattern-z",
    "Recurring diagnostic: pattern-a"
  ]);
  expect(board.candidates[4].evidence.itemIds).toEqual(["item-z", "item-a"]);
});

test("deduplicates structurally identical source patterns regardless of key order", () => {
  const first = failureReason({
    label: "first label",
    reason: { code: "same", axis: "vertical" },
    itemCount: 1,
    itemIds: ["first-item"]
  });
  const duplicate = failureReason({
    label: "duplicate label",
    reason: { axis: "vertical", code: "same" },
    itemCount: 50,
    itemIds: ["duplicate-item"]
  });
  const board = createExperimentCandidateBoard(createAnalysisSummary({
    failureReasons: [first, duplicate]
  }));

  expect(board.candidates).toHaveLength(1);
  expect(board.candidates[0].title).toBe("Production failure: first label");
  expect(board.candidates[0].evidence.itemCount).toBe(1);
  expect(board.candidates[0].evidence.itemIds).toEqual(["first-item"]);
});

test("keeps different observation values as separate candidates", () => {
  const board = createExperimentCandidateBoard(createAnalysisSummary({
    experimentObservations: [
      experimentObservation({ observationId: "raw-length", value: 100 }),
      experimentObservation({ observationId: "raw-length", value: 200 })
    ]
  }));

  expect(board.candidates).toHaveLength(2);
  expect(board.candidates.map(candidate => candidate.evidence.pattern.value)).toEqual([
    100,
    200
  ]);
});

test("keeps structurally equal patterns from different sources separate", () => {
  const sharedPattern = {
    diagnosticType: "custom",
    observation: { state: "same" }
  };
  const board = createExperimentCandidateBoard(createAnalysisSummary({
    failureReasons: [failureReason({
      label: "custom",
      reason: sharedPattern
    })],
    recurringPatterns: [recurringPattern(sharedPattern)]
  }));

  expect(board.candidates).toHaveLength(2);
  expect(board.candidates.map(candidate => candidate.evidence.source)).toEqual([
    "production-failure-reason",
    "recurring-diagnostic-pattern"
  ]);
});

test("is deterministic and leaves a deeply frozen summary untouched", () => {
  const summary = deepFreeze(createAnalysisSummary({
    failureReasons: [failureReason()],
    experimentObservations: [experimentObservation()],
    recurringPatterns: [recurringPattern()]
  }));
  const snapshot = JSON.stringify(summary);

  const first = createExperimentCandidateBoard(summary);
  const second = createExperimentCandidateBoard(summary);

  expect(second).toEqual(first);
  expect(JSON.stringify(summary)).toBe(snapshot);
  expect(Object.isFrozen(summary)).toBe(true);
});

test("never accesses runtime or production payload fields", () => {
  const summary = createAnalysisSummary({
    failureReasons: [failureReason()]
  });

  for (const field of [
    "productionResult",
    "context",
    "imageData",
    "binaryImage",
    "projections",
    "canvas",
    "suggestions"
  ]) {
    Object.defineProperty(summary, field, {
      enumerable: true,
      get() {
        throw new Error(`${field} must not be accessed`);
      }
    });
  }

  expect(() => createExperimentCandidateBoard(summary)).not.toThrow();
});

test("introduces no evaluation or implementation contract", () => {
  const board = createExperimentCandidateBoard(createAnalysisSummary({
    failureReasons: [failureReason()],
    experimentObservations: [experimentObservation()],
    recurringPatterns: [recurringPattern()]
  }));
  const keys = collectKeys(board);
  const text = JSON.stringify(board);

  expect(keys).not.toEqual(expect.arrayContaining([
    "priority",
    "rank",
    "ranking",
    "score",
    "winner",
    "best",
    "recommendation",
    "selectedExperiment",
    "implementation"
  ]));
  expect(board.candidates.map(candidate => candidate.hypothesis).join(" ")).not.toMatch(
    /implement|replace|change|add|remove|use|preferred|stronger|important/i
  );
  expect(text).not.toMatch(/"priority"|"rank"|"score"|"recommendation"/i);
});

function createAnalysisSummary({
  failureReasons = [],
  experimentObservations = [],
  recurringPatterns = []
} = {}) {
  return {
    type: "digitization-dataset-analysis-summary",
    version: 1,
    dataset: {
      datasetId: "local-pdfs",
      itemCount: 12
    },
    sections: {
      completion: {},
      gridDetection: {},
      productionFailureReasons: {
        reasons: failureReasons
      },
      productionConfidence: {},
      frequentExperimentObservations: {
        observations: experimentObservations
      },
      recurringDiagnosticPatterns: {
        patterns: recurringPatterns
      }
    }
  };
}

function failureReason({
  label = "geometry-build-failed",
  reason = { code: "geometry-build-failed" },
  itemCount = 2,
  itemIds = ["item-2", "item-1"]
} = {}) {
  return {
    id: "failure-reason",
    label,
    reason,
    itemCount,
    itemIds
  };
}

function experimentObservation({
  experimentId = "vertical-continuity",
  category = "projection",
  observationId = "raw-length",
  value = 1200,
  itemCount = 2,
  itemIds = ["item-2", "item-1"]
} = {}) {
  return {
    experimentId,
    category,
    observationId,
    value,
    itemCount,
    itemIds
  };
}

function recurringPattern({
  diagnosticType = "candidate-counts",
  observation = { axis: "vertical", acceptedCount: 1 },
  itemCount = 2,
  itemIds = ["item-2", "item-1"]
} = {}) {
  return {
    id: "diagnostic-pattern",
    diagnosticType,
    observation,
    itemCount,
    itemIds
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
