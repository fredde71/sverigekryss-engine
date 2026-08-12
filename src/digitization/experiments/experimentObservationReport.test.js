import { createExperimentObservationReport } from "./experimentObservationReport";

test("inventories successful experiments in benchmark order", () => {
  const report = createReport([
    createSuccessfulExperiment("first", { type: "unknown-diagnostics" }),
    createSuccessfulExperiment("second", { type: "unknown-diagnostics" }),
    createSuccessfulExperiment("third", { type: "unknown-diagnostics" })
  ]);

  expect(report.execution).toEqual({
    totalExperimentCount: 3,
    successful: [
      { id: "first", description: "Experiment first", durationMs: 1 },
      { id: "second", description: "Experiment second", durationMs: 1 },
      { id: "third", description: "Experiment third", durationMs: 1 }
    ],
    failures: []
  });
});

test("isolates failures while retaining later successful experiments", () => {
  const report = createReport([
    createSuccessfulExperiment("before", createProjectionDiagnostics()),
    {
      id: "failed",
      description: "Experiment failed",
      durationMs: 2,
      success: false,
      diagnostics: {
        type: "digitization-experiment-failure",
        name: "Error",
        message: "synthetic failure",
        visualizations: [createVisualization("must-not-appear", "binary-mask")]
      }
    },
    createSuccessfulExperiment("after", createProjectionDiagnostics())
  ]);

  expect(report.execution.successful.map(experiment => experiment.id)).toEqual([
    "before",
    "after"
  ]);
  expect(report.execution.failures).toEqual([
    {
      id: "failed",
      description: "Experiment failed",
      durationMs: 2,
      diagnostic: {
        type: "digitization-experiment-failure",
        name: "Error",
        message: "synthetic failure",
        visualizations: [createVisualization("must-not-appear", "binary-mask")]
      }
    }
  ]);
  expect(report.visualizations.experiments).not.toEqual(expect.arrayContaining([
    expect.objectContaining({ experimentId: "failed" })
  ]));
  expect(report.comparisons.every(comparison => (
    comparison.sources.every(source => source.experimentId !== "failed")
  ))).toBe(true);
});

test("inventories visualizations without copying visualization data", () => {
  const diagnosticsWithVisualizations = {
    type: "unknown-diagnostics",
    visualizations: [
      {
        ...createVisualization("projection", "vertical-projection"),
        data: {
          largeValues: [1, 2, 3]
        }
      },
      createVisualization("overlay", "grid-overlay")
    ]
  };
  const report = createReport([
    createSuccessfulExperiment("none", { type: "unknown-diagnostics" }),
    createSuccessfulExperiment("visual", diagnosticsWithVisualizations)
  ]);

  expect(report.visualizations).toEqual({
    totalCount: 2,
    experiments: [
      {
        experimentId: "visual",
        visualizations: [
          {
            id: "projection",
            title: "Visualization projection",
            type: "vertical-projection"
          },
          {
            id: "overlay",
            title: "Visualization overlay",
            type: "grid-overlay"
          }
        ]
      }
    ]
  });
  expect(JSON.stringify(report.visualizations)).not.toContain("largeValues");
});

test("preserves unsupported visualization types as objective inventory", () => {
  const report = createReport([
    createSuccessfulExperiment("future", {
      type: "unknown-diagnostics",
      visualizations: [createVisualization("candidate-view", "candidate-lines")]
    })
  ]);

  expect(report.visualizations.experiments[0].visualizations[0]).toEqual({
    id: "candidate-view",
    title: "Visualization candidate-view",
    type: "candidate-lines"
  });
});

test("extracts four vertical continuity candidate-count observations", () => {
  const report = createReport([
    createSuccessfulExperiment("continuity-candidates", {
      type: "vertical-continuity-candidate-comparison",
      raw: {
        candidateCount: 1
      },
      continuity: {
        candidateCount: 3
      },
      comparison: {
        candidateCountDelta: 2,
        relation: "additional-candidates-observed"
      }
    })
  ]);

  expect(report.observations).toEqual({
    available: [
      {
        experimentId: "continuity-candidates",
        category: "candidate-count",
        observationId: "raw-vertical-candidate-count",
        value: 1
      },
      {
        experimentId: "continuity-candidates",
        category: "candidate-count",
        observationId: "continuity-vertical-candidate-count",
        value: 3
      },
      {
        experimentId: "continuity-candidates",
        category: "candidate-count-comparison",
        observationId: "vertical-candidate-count-delta",
        value: 2
      },
      {
        experimentId: "continuity-candidates",
        category: "candidate-count-comparison",
        observationId: "vertical-candidate-count-relation",
        value: "additional-candidates-observed"
      }
    ],
    unavailable: []
  });
  expect(report.comparisons).toEqual([]);
});

test("reports unavailable candidate observations without guessing values", () => {
  const report = createReport([
    createSuccessfulExperiment("continuity-candidates", {
      type: "vertical-continuity-candidate-comparison"
    })
  ]);

  expect(report.observations.available).toEqual([]);
  expect(report.observations.unavailable).toEqual([
    {
      experimentId: "continuity-candidates",
      category: "candidate-count",
      observationId: "raw-vertical-candidate-count",
      reason: "value-unavailable"
    },
    {
      experimentId: "continuity-candidates",
      category: "candidate-count",
      observationId: "continuity-vertical-candidate-count",
      reason: "value-unavailable"
    },
    {
      experimentId: "continuity-candidates",
      category: "candidate-count-comparison",
      observationId: "vertical-candidate-count-delta",
      reason: "value-unavailable"
    },
    {
      experimentId: "continuity-candidates",
      category: "candidate-count-comparison",
      observationId: "vertical-candidate-count-relation",
      reason: "value-unavailable"
    }
  ]);
});

test("reports exact agreement for comparable raw projection observations", () => {
  const report = createReport([
    createSuccessfulExperiment(
      "line-mask",
      createProjectionDiagnostics("vertical-line-mask-projection-comparison")
    ),
    createSuccessfulExperiment(
      "continuity",
      createProjectionDiagnostics("vertical-continuity-projection-comparison")
    )
  ]);
  const comparison = getComparison(
    report,
    "vertical-projection.raw.max-strength"
  );

  expect(comparison).toEqual({
    observationKey: "vertical-projection.raw.max-strength",
    label: "Raw vertical projection maximum",
    valueType: "number",
    equality: {
      method: "exact"
    },
    status: "agreement",
    sources: [
      { experimentId: "line-mask", value: 10 },
      { experimentId: "continuity", value: 10 }
    ],
    distinctObservations: [
      {
        value: 10,
        experimentIds: ["line-mask", "continuity"]
      }
    ],
    independence: "not-assessed"
  });
});

test("reports raw projection disagreement without preferring either source", () => {
  const first = createProjectionDiagnostics(
    "vertical-line-mask-projection-comparison"
  );
  const second = createProjectionDiagnostics(
    "vertical-continuity-projection-comparison"
  );
  second.raw.maxStrength = 8;
  const report = createReport([
    createSuccessfulExperiment("first", first),
    createSuccessfulExperiment("second", second)
  ]);
  const comparison = getComparison(
    report,
    "vertical-projection.raw.max-strength"
  );

  expect(comparison.status).toBe("disagreement");
  expect(comparison.sources).toEqual([
    { experimentId: "first", value: 10 },
    { experimentId: "second", value: 8 }
  ]);
  expect(comparison.distinctObservations).toEqual([
    { value: 10, experimentIds: ["first"] },
    { value: 8, experimentIds: ["second"] }
  ]);
});

test("does not compare semantically different mask observations", () => {
  const lineMask = createProjectionDiagnostics(
    "vertical-line-mask-projection-comparison"
  );
  const continuity = createProjectionDiagnostics(
    "vertical-continuity-projection-comparison"
  );
  lineMask.mask.maxStrength = 9;
  continuity.mask.maxStrength = 2;
  const report = createReport([
    createSuccessfulExperiment("line-mask", lineMask),
    createSuccessfulExperiment("continuity", continuity)
  ]);

  expect(report.comparisons.some(comparison => (
    comparison.observationKey.includes("mask")
  ))).toBe(false);
  expect(report.observations.available).toEqual(expect.arrayContaining([
    expect.objectContaining({
      experimentId: "line-mask",
      observationId: "vertical-line-mask.maxStrength",
      value: 9
    }),
    expect.objectContaining({
      experimentId: "continuity",
      observationId: "vertical-continuity-mask.maxStrength",
      value: 2
    })
  ]));
});

test("marks a lone comparable source as insufficient observations", () => {
  const report = createReport([
    createSuccessfulExperiment("only", createProjectionDiagnostics())
  ]);

  expect(getComparison(
    report,
    "vertical-projection.raw.max-strength"
  ).status).toBe("insufficient-observations");
});

test("reports the maximum structural observation without reordering sources", () => {
  const report = createReport([
    createSuccessfulExperiment("lower", createGridConfidenceDiagnostics(0.7)),
    createSuccessfulExperiment("higher", createGridConfidenceDiagnostics(0.9))
  ]);

  expect(report.structuralEvidence).toMatchObject({
    status: "observed",
    maximumObservedScore: 0.9,
    sourcesAtMaximum: ["higher"],
    observations: [
      {
        experimentId: "lower",
        score: 0.7,
        status: "measured",
        scoreMeaning: STRUCTURAL_SCORE_MEANING
      },
      {
        experimentId: "higher",
        score: 0.9,
        status: "measured",
        scoreMeaning: STRUCTURAL_SCORE_MEANING
      }
    ],
    interpretation: "none"
  });
  expect(report.execution.successful.map(experiment => experiment.id)).toEqual([
    "lower",
    "higher"
  ]);
});

test("preserves benchmark order for every source tied at the structural maximum", () => {
  const report = createReport([
    createSuccessfulExperiment("first-max", createGridConfidenceDiagnostics(0.9)),
    createSuccessfulExperiment("middle", createGridConfidenceDiagnostics(0.8)),
    createSuccessfulExperiment("last-max", createGridConfidenceDiagnostics(0.9))
  ]);

  expect(report.structuralEvidence.maximumObservedScore).toBe(0.9);
  expect(report.structuralEvidence.sourcesAtMaximum).toEqual([
    "first-max",
    "last-max"
  ]);
  expect(report.structuralEvidence.observations.map(observation => (
    observation.experimentId
  ))).toEqual(["first-max", "middle", "last-max"]);
});

test("records partial structural evidence and unavailable factors without a maximum", () => {
  const diagnostics = createGridConfidenceDiagnostics(null, {
    status: "partial",
    factors: [
      {
        id: "spacing-consistency",
        status: "unavailable",
        score: null,
        includedInOverall: true,
        reason: "vertical-spacing-consistency-diagnostic-unavailable",
        measurements: null
      }
    ]
  });
  const report = createReport([
    createSuccessfulExperiment("partial", diagnostics)
  ]);

  expect(report.structuralEvidence).toMatchObject({
    status: "unavailable",
    maximumObservedScore: null,
    sourcesAtMaximum: [],
    observations: [
      {
        experimentId: "partial",
        score: null,
        status: "partial",
        scoreMeaning: STRUCTURAL_SCORE_MEANING
      }
    ]
  });
  expect(report.observations.unavailable).toEqual(expect.arrayContaining([
    {
      experimentId: "partial",
      category: "structural-evidence",
      observationId: "overall",
      reason: "structural-score-partial"
    },
    {
      experimentId: "partial",
      category: "structural-evidence",
      observationId: "spacing-consistency",
      reason: "vertical-spacing-consistency-diagnostic-unavailable"
    }
  ]));
});

test("preserves candidate selectivity exclusion metadata", () => {
  const diagnostics = createGridConfidenceDiagnostics(1, {
    factors: [
      {
        id: "candidate-selectivity",
        status: "measured",
        score: 0.25,
        includedInOverall: false
      }
    ]
  });
  const report = createReport([
    createSuccessfulExperiment("confidence", diagnostics)
  ]);

  expect(report.observations.available).toEqual(expect.arrayContaining([
    expect.objectContaining({
      experimentId: "confidence",
      observationId: "candidate-selectivity",
      value: 0.25,
      includedInOverall: false
    })
  ]));
});

test("preserves production confidence verbatim and reports missing geometry", () => {
  const confidence = {
    token: "publisher-confidence-token"
  };
  const production = {
    gridDetection: {
      geometry: null,
      confidence
    }
  };
  const report = createExperimentObservationReport({
    production,
    benchmark: {
      experiments: []
    }
  });

  expect(report.production.confidence).toEqual({
    status: "available",
    value: confidence
  });
  expect(report.production.confidence.value).toBe(confidence);
  expect(report.production.geometry).toEqual({
    status: "unavailable",
    rows: null,
    cols: null,
    bounds: null,
    horizontalLineCount: null,
    verticalLineCount: null
  });
});

test("returns a complete deterministic empty report", () => {
  const report = createReport([]);

  expect(report).toEqual({
    type: "digitization-experiment-observation-report",
    version: 1,
    status: "complete",
    production: createExpectedProductionObservation(),
    execution: {
      totalExperimentCount: 0,
      successful: [],
      failures: []
    },
    visualizations: {
      totalCount: 0,
      experiments: []
    },
    observations: {
      available: [],
      unavailable: []
    },
    comparisons: [],
    structuralEvidence: {
      status: "unavailable",
      scoreMeaning: STRUCTURAL_SCORE_MEANING,
      scale: {
        minimum: 0,
        maximum: 1
      },
      maximumObservedScore: null,
      sourcesAtMaximum: [],
      observations: [],
      interpretation: "none"
    }
  });
});

test("is deterministic and leaves deeply frozen inputs untouched", () => {
  const input = deepFreeze({
    production: createProduction(),
    benchmark: {
      experiments: [
        createSuccessfulExperiment("projection", createProjectionDiagnostics()),
        createSuccessfulExperiment("confidence", createGridConfidenceDiagnostics(0.8))
      ]
    }
  });
  const snapshot = JSON.stringify(input);

  const first = createExperimentObservationReport(input);
  const second = createExperimentObservationReport(input);

  expect(second).toEqual(first);
  expect(JSON.stringify(input)).toBe(snapshot);
  expect(Object.isFrozen(input.production)).toBe(true);
  expect(Object.isFrozen(input.benchmark)).toBe(true);
  expect(Object.isFrozen(input.benchmark.experiments)).toBe(true);
});

test("produces no ranking, selection or recommendation contract", () => {
  const report = createReport([
    createSuccessfulExperiment("one", createGridConfidenceDiagnostics(0.7)),
    createSuccessfulExperiment("two", createGridConfidenceDiagnostics(0.9))
  ]);
  const forbiddenKeys = new Set([
    "rank",
    "ranking",
    "winner",
    "best",
    "recommended",
    "recommendation",
    "productionAction",
    "selectedExperiment"
  ]);

  expect(findObjectKeys(report).filter(key => forbiddenKeys.has(key))).toEqual([]);
});

test("requires an existing production result and benchmark experiment array", () => {
  expect(() => createExperimentObservationReport({
    benchmark: {
      experiments: []
    }
  })).toThrow("production is required");
  expect(() => createExperimentObservationReport({
    production: createProduction(),
    benchmark: {}
  })).toThrow("benchmark.experiments must be an array");
});

const STRUCTURAL_SCORE_MEANING = "experimental-structural-score-not-calibrated-probability";

function createReport(experiments) {
  return createExperimentObservationReport({
    production: createProduction(),
    benchmark: {
      experiments
    }
  });
}

function createProduction() {
  return {
    gridDetection: {
      confidence: "detected",
      geometry: {
        rows: 2,
        cols: 3,
        bounds: {
          top: 1,
          left: 2,
          width: 30,
          height: 20
        },
        horizontalLines: [1, 11, 21],
        verticalLines: [2, 12, 22, 32]
      }
    }
  };
}

function createExpectedProductionObservation() {
  return {
    confidence: {
      status: "available",
      value: "detected"
    },
    geometry: {
      status: "available",
      rows: 2,
      cols: 3,
      bounds: {
        top: 1,
        left: 2,
        width: 30,
        height: 20
      },
      horizontalLineCount: 3,
      verticalLineCount: 4
    }
  };
}

function createSuccessfulExperiment(id, diagnostics) {
  return {
    id,
    description: `Experiment ${id}`,
    durationMs: 1,
    success: true,
    diagnostics
  };
}

function createVisualization(id, type) {
  return {
    id,
    title: `Visualization ${id}`,
    type,
    data: {
      values: [1, 2, 3]
    }
  };
}

function createProjectionDiagnostics(
  type = "vertical-line-mask-projection-comparison"
) {
  return {
    type,
    raw: {
      length: 4,
      maxStrength: 10,
      meanStrength: 4,
      medianStrength: 3,
      runCount: 2
    },
    scores: {
      length: 4,
      maxStrength: 8,
      meanStrength: 3,
      medianStrength: 2,
      runCount: 2
    },
    mask: {
      length: 4,
      maxStrength: 7,
      meanStrength: 2,
      medianStrength: 1,
      runCount: 1
    }
  };
}

function createGridConfidenceDiagnostics(score, overrides = {}) {
  return {
    type: "grid-confidence-diagnostics",
    status: "measured",
    score,
    scoreMeaning: STRUCTURAL_SCORE_MEANING,
    factors: [],
    ...overrides
  };
}

function getComparison(report, observationKey) {
  return report.comparisons.find(comparison => (
    comparison.observationKey === observationKey
  ));
}

function findObjectKeys(value) {
  if (Array.isArray(value)) {
    return value.flatMap(findObjectKeys);
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => [
    key,
    ...findObjectKeys(nestedValue)
  ]);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
