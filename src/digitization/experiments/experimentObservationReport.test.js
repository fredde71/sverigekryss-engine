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

test("extracts ordered candidate counts and positions for every coverage ratio", () => {
  const report = createReport([
    createSuccessfulExperiment(
      "thresholds",
      createCandidateCoverageThresholdDiagnostics()
    )
  ]);

  expect(report.observations.unavailable).toEqual([]);
  expect(report.observations.available).toHaveLength(20);
  expect(report.observations.available.map(observation => (
    observation.observationId
  ))).toEqual([
    "raw-vertical-candidate-count-at-coverage-0.70",
    "raw-vertical-candidate-positions-at-coverage-0.70",
    "continuity-vertical-candidate-count-at-coverage-0.70",
    "continuity-vertical-candidate-positions-at-coverage-0.70",
    "raw-vertical-candidate-count-at-coverage-0.75",
    "raw-vertical-candidate-positions-at-coverage-0.75",
    "continuity-vertical-candidate-count-at-coverage-0.75",
    "continuity-vertical-candidate-positions-at-coverage-0.75",
    "raw-vertical-candidate-count-at-coverage-0.80",
    "raw-vertical-candidate-positions-at-coverage-0.80",
    "continuity-vertical-candidate-count-at-coverage-0.80",
    "continuity-vertical-candidate-positions-at-coverage-0.80",
    "raw-vertical-candidate-count-at-coverage-0.85",
    "raw-vertical-candidate-positions-at-coverage-0.85",
    "continuity-vertical-candidate-count-at-coverage-0.85",
    "continuity-vertical-candidate-positions-at-coverage-0.85",
    "raw-vertical-candidate-count-at-coverage-0.90",
    "raw-vertical-candidate-positions-at-coverage-0.90",
    "continuity-vertical-candidate-count-at-coverage-0.90",
    "continuity-vertical-candidate-positions-at-coverage-0.90"
  ]);
  expect(report.observations.available).toEqual(expect.arrayContaining([
    {
      experimentId: "thresholds",
      category: "candidate-threshold-observation",
      observationId: "raw-vertical-candidate-count-at-coverage-0.80",
      value: 3
    },
    {
      experimentId: "thresholds",
      category: "candidate-threshold-observation",
      observationId: "raw-vertical-candidate-positions-at-coverage-0.80",
      value: [9, 13, 17]
    }
  ]));
  expect(report.comparisons).toEqual([]);
});

test("keeps empty threshold candidate positions available", () => {
  const diagnostics = createCandidateCoverageThresholdDiagnostics();
  diagnostics.observations.forEach(observation => {
    observation.raw.candidateCount = 0;
    observation.raw.candidatePositions = [];
    observation.continuity.candidateCount = 0;
    observation.continuity.candidatePositions = [];
  });
  const report = createReport([
    createSuccessfulExperiment("thresholds", diagnostics)
  ]);

  expect(report.observations.unavailable).toEqual([]);
  expect(report.observations.available).toHaveLength(20);
  expect(report.observations.available.filter(observation => (
    observation.observationId.includes("positions")
  )).every(observation => (
    Array.isArray(observation.value) && observation.value.length === 0
  ))).toBe(true);
});

test("reports malformed or missing threshold observations as unavailable", () => {
  const diagnostics = createCandidateCoverageThresholdDiagnostics();
  diagnostics.observations[0].raw.candidateCount = null;
  diagnostics.observations[0].raw.candidatePositions = [1, NaN];
  diagnostics.observations = diagnostics.observations.filter(observation => (
    observation.candidateCoverageRatio !== 0.75
  ));
  const report = createReport([
    createSuccessfulExperiment("thresholds", diagnostics)
  ]);

  expect(report.observations.unavailable).toEqual(expect.arrayContaining([
    {
      experimentId: "thresholds",
      category: "candidate-threshold-observation",
      observationId: "raw-vertical-candidate-count-at-coverage-0.70",
      reason: "value-unavailable"
    },
    {
      experimentId: "thresholds",
      category: "candidate-threshold-observation",
      observationId: "raw-vertical-candidate-positions-at-coverage-0.70",
      reason: "value-unavailable"
    },
    {
      experimentId: "thresholds",
      category: "candidate-threshold-observation",
      observationId: "continuity-vertical-candidate-count-at-coverage-0.75",
      reason: "value-unavailable"
    }
  ]));
  expect(report.observations.unavailable).toHaveLength(6);
});

test("extracts ordered full-page and span-relative coverage observations", () => {
  const report = createReport([
    createSuccessfulExperiment(
      "span-relative",
      createSpanRelativeCoverageDiagnostics()
    )
  ]);

  expect(report.observations.unavailable).toEqual([]);
  expect(report.observations.available.map(observation => (
    observation.observationId
  ))).toEqual([
    "horizontal-boundary-candidate-count",
    "horizontal-boundary-candidate-positions",
    "observed-vertical-span-top",
    "observed-vertical-span-bottom",
    "observed-vertical-span-length",
    "full-page-vertical-coverage-denominator",
    "full-page-vertical-minimum-strength",
    "full-page-strongest-vertical-strength",
    "full-page-maximum-observed-vertical-coverage",
    "full-page-vertical-candidate-count",
    "full-page-vertical-candidate-positions",
    "span-relative-vertical-coverage-denominator",
    "span-relative-vertical-minimum-strength",
    "span-relative-strongest-vertical-strength",
    "span-relative-maximum-observed-vertical-coverage",
    "span-relative-vertical-candidate-count",
    "span-relative-vertical-candidate-positions"
  ]);
  expect(report.observations.available).toEqual(expect.arrayContaining([
    {
      experimentId: "span-relative",
      category: "span-relative-candidate-observation",
      observationId: "full-page-maximum-observed-vertical-coverage",
      value: 0.6
    },
    {
      experimentId: "span-relative",
      category: "span-relative-candidate-observation",
      observationId: "span-relative-vertical-candidate-positions",
      value: [2, 6]
    }
  ]));
  expect(report.comparisons).toEqual([]);
});

test("keeps measured empty candidate positions available for span coverage", () => {
  const diagnostics = createSpanRelativeCoverageDiagnostics();
  diagnostics.fullPage.candidateCount = 0;
  diagnostics.fullPage.candidatePositions = [];
  diagnostics.spanRelative.candidateCount = 0;
  diagnostics.spanRelative.candidatePositions = [];
  const report = createReport([
    createSuccessfulExperiment("span-relative", diagnostics)
  ]);

  expect(report.observations.unavailable).toEqual([]);
  expect(report.observations.available).toEqual(expect.arrayContaining([
    expect.objectContaining({
      observationId: "full-page-vertical-candidate-positions",
      value: []
    }),
    expect.objectContaining({
      observationId: "span-relative-vertical-candidate-positions",
      value: []
    })
  ]));
});

test("keeps full-page observations available when span evidence is unavailable", () => {
  const diagnostics = createSpanRelativeCoverageDiagnostics();
  diagnostics.status = "partial";
  diagnostics.spanObservation = {
    status: "unavailable",
    method: "outermost-horizontal-candidate-runs",
    reason: "fewer-than-two-horizontal-candidates",
    boundaryEvidence: {
      candidateCount: 1,
      candidatePositions: [20]
    },
    top: null,
    bottom: null,
    length: null
  };
  diagnostics.spanRelative = {
    status: "unavailable",
    reason: "observed-span-unavailable",
    denominator: null,
    minimumStrength: null,
    profile: null,
    strongestEvidence: null,
    candidateCount: null,
    candidatePositions: null
  };
  const report = createReport([
    createSuccessfulExperiment("span-relative", diagnostics)
  ]);

  expect(report.observations.available.map(observation => (
    observation.observationId
  ))).toEqual([
    "horizontal-boundary-candidate-count",
    "horizontal-boundary-candidate-positions",
    "full-page-vertical-coverage-denominator",
    "full-page-vertical-minimum-strength",
    "full-page-strongest-vertical-strength",
    "full-page-maximum-observed-vertical-coverage",
    "full-page-vertical-candidate-count",
    "full-page-vertical-candidate-positions"
  ]);
  expect(report.observations.unavailable).toHaveLength(9);
  expect(report.observations.unavailable).toEqual(expect.arrayContaining([
    {
      experimentId: "span-relative",
      category: "span-relative-candidate-observation",
      observationId: "observed-vertical-span-length",
      reason: "fewer-than-two-horizontal-candidates"
    },
    {
      experimentId: "span-relative",
      category: "span-relative-candidate-observation",
      observationId: "span-relative-vertical-candidate-count",
      reason: "observed-span-unavailable"
    }
  ]));
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

test("extracts ordered shadow provider status, regions and provenance", () => {
  const provenance = {
    source: "horizontal-image-evidence",
    method: "outermost-horizontal-candidate-runs",
    candidateCoverageRatio: 0.8
  };
  const report = createReport([
    createSuccessfulExperiment("shadow-regions", {
      type: "shadow-analysis-region-observations",
      providers: [
        {
          id: "horizontal-outer-span",
          status: "available",
          regionCount: 1,
          regions: [
            {
              bounds: { top: 20, left: 0, width: 100, height: 80 },
              dimensions: { width: 100, height: 80 },
              provenance
            }
          ],
          provenance,
          reason: null
        },
        {
          id: "synthetic-ambiguous",
          status: "ambiguous",
          regionCount: 2,
          regions: [],
          provenance: { source: "synthetic" },
          reason: "multiple-observed-spans"
        }
      ]
    })
  ]);

  expect(report.observations.available).toEqual([
    {
      experimentId: "shadow-regions",
      category: "analysis-region-provider",
      observationId: "provider.horizontal-outer-span.status",
      value: "available"
    },
    {
      experimentId: "shadow-regions",
      category: "analysis-region-provider",
      observationId: "provider.horizontal-outer-span.region-count",
      value: 1
    },
    {
      experimentId: "shadow-regions",
      category: "analysis-region-provenance",
      observationId: "provider.horizontal-outer-span.provenance",
      value: provenance
    },
    {
      experimentId: "shadow-regions",
      category: "analysis-region",
      observationId: "provider.horizontal-outer-span.region.0.bounds",
      value: { top: 20, left: 0, width: 100, height: 80 }
    },
    {
      experimentId: "shadow-regions",
      category: "analysis-region",
      observationId: "provider.horizontal-outer-span.region.0.dimensions",
      value: { width: 100, height: 80 }
    },
    {
      experimentId: "shadow-regions",
      category: "analysis-region-provenance",
      observationId: "provider.horizontal-outer-span.region.0.provenance",
      value: provenance
    },
    {
      experimentId: "shadow-regions",
      category: "analysis-region-provider",
      observationId: "provider.synthetic-ambiguous.status",
      value: "ambiguous"
    },
    {
      experimentId: "shadow-regions",
      category: "analysis-region-provider",
      observationId: "provider.synthetic-ambiguous.region-count",
      value: 2
    },
    {
      experimentId: "shadow-regions",
      category: "analysis-region-provenance",
      observationId: "provider.synthetic-ambiguous.provenance",
      value: { source: "synthetic" }
    }
  ]);
  expect(report.observations.unavailable).toEqual([
    {
      experimentId: "shadow-regions",
      category: "analysis-region-provider",
      observationId: "provider.synthetic-ambiguous.reason",
      reason: "multiple-observed-spans"
    }
  ]);
  expect(report.comparisons).toEqual([]);
  expect(report.structuralEvidence.observations).toEqual([]);
});

test("extracts compact ordered shadow GridAnalysis observations without runtime payloads", () => {
  const report = createReport([
    createSuccessfulExperiment("shadow-grid", {
      type: "shadow-grid-analysis-diagnostics",
      providers: [
        {
          id: "outer-span",
          status: "available",
          regionCount: 1,
          reason: null,
          gridAnalyses: [
            {
              regionId: "outer-span-001",
              regionBounds: { top: 10, left: 0, width: 100, height: 80 },
              regionDimensions: { width: 100, height: 80 },
              status: "completed",
              gridAnalysisStatus: "measured",
              durationMs: 2.5,
              candidateCounts: { horizontal: 3, vertical: 4 },
              candidatePositions: {
                horizontal: [0, 40, 79],
                vertical: [2, 32, 62, 92]
              },
              spacingDiagnostics: [
                {
                  type: "spacing-consistency",
                  axis: "vertical",
                  status: "measured",
                  consistency: 1
                }
              ],
              geometry: {
                status: "available",
                rows: 2,
                cols: 3,
                bounds: { top: 0, left: 2, width: 90, height: 79 }
              },
              rejectionReasons: [],
              binaryImage: { mustNotBeExtracted: true },
              projections: { mustNotBeExtracted: true }
            }
          ]
        }
      ]
    })
  ]);
  const observations = report.observations.available;

  expect(observations.map(observation => observation.observationId)).toEqual([
    "provider.outer-span.status",
    "provider.outer-span.region-count",
    "provider.outer-span.region.outer-span-001.bounds",
    "provider.outer-span.region.outer-span-001.dimensions",
    "provider.outer-span.region.outer-span-001.execution-status",
    "provider.outer-span.region.outer-span-001.grid-analysis-status",
    "provider.outer-span.region.outer-span-001.duration-ms",
    "provider.outer-span.region.outer-span-001.horizontal-candidate-count",
    "provider.outer-span.region.outer-span-001.vertical-candidate-count",
    "provider.outer-span.region.outer-span-001.horizontal-candidate-positions",
    "provider.outer-span.region.outer-span-001.vertical-candidate-positions",
    "provider.outer-span.region.outer-span-001.spacing-diagnostics",
    "provider.outer-span.region.outer-span-001.geometry-status",
    "provider.outer-span.region.outer-span-001.geometry-rows",
    "provider.outer-span.region.outer-span-001.geometry-cols",
    "provider.outer-span.region.outer-span-001.geometry-bounds"
  ]);
  expect(observations.find(observation => (
    observation.observationId.endsWith("vertical-candidate-positions")
  )).value).toEqual([2, 32, 62, 92]);
  expect(observations.find(observation => (
    observation.observationId.endsWith("geometry-bounds")
  )).value).toEqual({ top: 0, left: 2, width: 90, height: 79 });
  expect(JSON.stringify(report)).not.toMatch(/binaryImage|projections|mustNotBeExtracted/);
  expect(report.comparisons).toEqual([]);
});

test("preserves shadow GridAnalysis rejection and failure observations", () => {
  const report = createReport([
    createSuccessfulExperiment("shadow-grid", {
      type: "shadow-grid-analysis-diagnostics",
      providers: [
        {
          id: "outer-span",
          status: "available",
          regionCount: 1,
          gridAnalyses: [
            {
              regionId: "failed-region",
              regionBounds: { top: 0, left: 0, width: 10, height: 10 },
              regionDimensions: { width: 10, height: 10 },
              status: "failed",
              gridAnalysisStatus: "failed",
              durationMs: 1,
              candidateCounts: { horizontal: null, vertical: null },
              candidatePositions: { horizontal: null, vertical: null },
              spacingDiagnostics: [],
              geometry: { status: "unavailable" },
              rejectionReasons: [],
              error: { name: "Error", message: "synthetic failure" }
            }
          ]
        },
        {
          id: "ambiguous",
          status: "ambiguous",
          regionCount: 2,
          reason: "multiple-regions",
          gridAnalyses: []
        }
      ]
    })
  ]);

  expect(report.observations.available).toEqual(expect.arrayContaining([
    expect.objectContaining({
      observationId: "provider.outer-span.region.failed-region.rejection-reasons",
      value: []
    }),
    expect.objectContaining({
      observationId: "provider.ambiguous.status",
      value: "ambiguous"
    })
  ]));
  expect(report.observations.unavailable).toEqual(expect.arrayContaining([
    {
      experimentId: "shadow-grid",
      category: "shadow-grid-analysis",
      observationId: "provider.outer-span.region.failed-region.failure",
      reason: "synthetic failure"
    },
    {
      experimentId: "shadow-grid",
      category: "shadow-grid-analysis",
      observationId: "provider.ambiguous.reason",
      reason: "multiple-regions"
    }
  ]));
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

function createCandidateCoverageThresholdDiagnostics() {
  const counts = [5, 4, 3, 2, 1];
  const positions = [1, 5, 9, 13, 17];

  return {
    type: "vertical-candidate-coverage-threshold-observation",
    observations: [0.7, 0.75, 0.8, 0.85, 0.9].map((ratio, index) => ({
      candidateCoverageRatio: ratio,
      raw: {
        candidateCount: counts[index],
        candidatePositions: positions.slice(index)
      },
      continuity: {
        candidateCount: counts[index] + 1,
        candidatePositions: [0, ...positions.slice(index)]
      }
    }))
  };
}

function createSpanRelativeCoverageDiagnostics() {
  return {
    type: "vertical-span-relative-coverage-observation",
    status: "measured",
    spanObservation: {
      status: "measured",
      boundaryEvidence: {
        candidateCount: 2,
        candidatePositions: [20, 79]
      },
      top: 20,
      bottom: 79,
      length: 60
    },
    fullPage: {
      denominator: { top: 0, bottom: 99, length: 100 },
      minimumStrength: 80,
      strongestEvidence: {
        position: 2,
        strength: 60,
        coverageRatio: 0.6
      },
      candidateCount: 0,
      candidatePositions: []
    },
    spanRelative: {
      denominator: { top: 20, bottom: 79, length: 60 },
      minimumStrength: 48,
      strongestEvidence: {
        position: 2,
        strength: 60,
        coverageRatio: 1
      },
      candidateCount: 2,
      candidatePositions: [2, 6]
    }
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
