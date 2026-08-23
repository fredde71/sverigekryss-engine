import fs from "fs";
import { createDigitizationExperimentBenchmark } from "./digitizationExperimentBenchmark";
import { createDigitizationExperimentComparison } from "./digitizationExperimentComparison";
import { createExperimentObservationReport } from "./experimentObservationReport";
import { createDigitizationDatasetRunner } from "./dataset/digitizationDatasetRunner";
import {
  adaptShadowGridAnalysis,
  createShadowGridReconstructionDiagnosticsRunner,
  shadowGridReconstructionDiagnosticsExperiment
} from "./shadowGridReconstructionDiagnostics";

test.each(["production", undefined, "preview"])(
  "rejects %p before reading Phase 4 observations",
  environment => {
    const reconstruct = jest.fn();
    const run = createShadowGridReconstructionDiagnosticsRunner({
      reconstruct,
      readEnvironment: () => environment
    });
    const observations = new Proxy({}, {
      get() {
        throw new Error("observations must not be read");
      }
    });

    expect(() => run(observations)).toThrow(
      "Shadow grid reconstruction is available only in development or test"
    );
    expect(reconstruct).not.toHaveBeenCalled();
  }
);

test("adapts Phase 4 candidates, bounds, spacing and coordinates exactly", () => {
  const gridAnalysis = createGridAnalysisObservation({
    regionId: "region-a",
    regionBounds: { top: 100, left: 25, width: 200, height: 150 },
    horizontalPositions: [0.5, 10.5, 20.5],
    verticalPositions: [5, 15, 25],
    geometryBounds: { top: 0.5, left: 5, width: 20, height: 20 },
    spacingDiagnostics: [
      { type: "spacing-consistency", axis: "horizontal", average: 10 },
      { type: "spacing-consistency", axis: "vertical", average: 10 },
      { type: "spacing-note", status: "observed" }
    ]
  });
  const parameters = createParameters({
    permittedIntervalCount: { minimum: 2, maximum: 2 }
  });
  const adapted = adaptShadowGridAnalysis({
    providerId: "provider-a",
    gridAnalysis,
    parameters
  });

  expect(adapted.input.candidateEvidence).toEqual({
    analysisRegionId: "region-a",
    acceptancePolicy: {
      source: "shadow-grid-analysis-diagnostics",
      parameters: {
        providerId: "provider-a",
        gridAnalysisStatus: "measured"
      }
    },
    horizontal: [
      { axis: "horizontal", position: 0.5, sourceIndex: 0 },
      { axis: "horizontal", position: 10.5, sourceIndex: 1 },
      { axis: "horizontal", position: 20.5, sourceIndex: 2 }
    ],
    vertical: [
      { axis: "vertical", position: 5, sourceIndex: 0 },
      { axis: "vertical", position: 15, sourceIndex: 1 },
      { axis: "vertical", position: 25, sourceIndex: 2 }
    ]
  });
  expect(adapted.input.observedBounds).toEqual({
    status: "available",
    coordinateSpace: "analysis-region-local",
    semantics: "accepted-candidate-envelope",
    value: { top: 0.5, left: 5, width: 20, height: 20 },
    provenance: {
      source: "phase-4-shadow-grid-geometry",
      derivation: "outermost-accepted-horizontal-and-vertical-candidate-positions"
    },
    components: {
      top: {
        status: "observed",
        provenance: "accepted-horizontal-candidate-envelope"
      },
      left: {
        status: "observed",
        provenance: "accepted-vertical-candidate-envelope"
      },
      width: {
        status: "observed",
        provenance: "accepted-vertical-candidate-envelope"
      },
      height: {
        status: "observed",
        provenance: "accepted-horizontal-candidate-envelope"
      }
    }
  });
  expect(adapted.input.spacingEvidence).toEqual({
    horizontal: [
      { type: "spacing-consistency", axis: "horizontal", average: 10 }
    ],
    vertical: [
      { type: "spacing-consistency", axis: "vertical", average: 10 }
    ],
    unassigned: [{ type: "spacing-note", status: "observed" }]
  });
  expect(adapted.input.coordinateSystem).toEqual({
    space: "analysis-region-local",
    origin: "top-left",
    xDirection: "right",
    yDirection: "down",
    linePosition: "visual-line-center",
    localToBinaryImage: {
      offsetX: 25,
      offsetY: 100,
      scaleX: 1,
      scaleY: 1
    },
    provenance: {
      source: "shadow-grid-analysis-diagnostics",
      providerId: "provider-a",
      regionId: "region-a",
      regionBounds: { top: 100, left: 25, width: 200, height: 150 },
      relationship: "analysis-region-local-to-rendered-binary-image"
    }
  });
  expect(adapted.input.parameters).toEqual(parameters);
});

test("preserves provider and region order and invokes reconstruction once per available region", () => {
  const reconstructionResults = [
    createReconstructionResult("available"),
    createReconstructionResult("partial"),
    createReconstructionResult("ambiguous")
  ];
  const reconstruct = jest.fn(() => reconstructionResults.shift());
  const source = createShadowGridAnalysis([
    createProvider("provider-a", "available", [
      createGridAnalysisObservation({ regionId: "a-1" }),
      createGridAnalysisObservation({ regionId: "a-2" })
    ]),
    createProvider("provider-b", "available", [
      createGridAnalysisObservation({ regionId: "b-1" })
    ])
  ]);
  const run = createRunner({ reconstruct });
  const result = run(source);

  expect(reconstruct).toHaveBeenCalledTimes(3);
  expect(result.providers.map(provider => provider.id)).toEqual([
    "provider-a",
    "provider-b"
  ]);
  expect(result.providers[0].reconstructions.map(region => region.regionId))
    .toEqual(["a-1", "a-2"]);
  expect(result.providers[1].reconstructions.map(region => region.regionId))
    .toEqual(["b-1"]);
  expect(result.providers.flatMap(provider => provider.reconstructions).map(
    region => region.reconstructionStatus
  )).toEqual(["available", "partial", "ambiguous"]);
});

test("skips unavailable and ambiguous providers without reconstruction", () => {
  const reconstruct = jest.fn();
  const source = createShadowGridAnalysis([
    createProvider("unavailable", "unavailable", [
      createGridAnalysisObservation({ regionId: "not-run-a" })
    ], "no-region"),
    createProvider("ambiguous", "ambiguous", [
      createGridAnalysisObservation({ regionId: "not-run-b" })
    ], "multiple-regions")
  ]);
  const result = createRunner({ reconstruct })(source);

  expect(reconstruct).not.toHaveBeenCalled();
  expect(result.providers).toEqual([
    {
      id: "unavailable",
      description: "Provider unavailable",
      status: "unavailable",
      regionCount: 1,
      reason: "no-region",
      reconstructions: []
    },
    {
      id: "ambiguous",
      description: "Provider ambiguous",
      status: "ambiguous",
      regionCount: 1,
      reason: "multiple-regions",
      reconstructions: []
    }
  ]);
});

test("preserves the complete raw Phase 4 observation separately and immutably", () => {
  const source = deepFreeze(createShadowGridAnalysis([
    createProvider("provider", "available", [
      createGridAnalysisObservation({ regionId: "region" })
    ])
  ]));
  const before = JSON.stringify(source);
  const result = createRunner({
    reconstruct: () => createReconstructionResult("unavailable")
  })(source);

  expect(result.rawShadowGridAnalysis).toEqual(source);
  expect(result.rawShadowGridAnalysis).not.toBe(source);
  expect(result.providers[0]).not.toHaveProperty("gridAnalyses");
  expect(JSON.stringify(source)).toBe(before);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.rawShadowGridAnalysis.providers[0])).toBe(true);
});

test("keeps reconstruction variants in deterministic strategy order", () => {
  const parameters = createParameters({
    permittedIntervalCount: { minimum: 1, maximum: 4 },
    maximumSkippedIntervalsBetweenCandidates: 3,
    maximumConsecutiveInferredLines: 3,
    maximumInferredLineFraction: 0.6,
    maximumHypothesisCount: 20
  });
  const source = createShadowGridAnalysis([
    createProvider("provider", "available", [
      createGridAnalysisObservation({
        regionId: "region",
        horizontalPositions: [0, 20],
        verticalPositions: [0, 20],
        geometryBounds: { top: 0, left: 0, width: 20, height: 20 }
      })
    ])
  ]);
  const run = createShadowGridReconstructionDiagnosticsRunner({
    parameters,
    readEnvironment: () => "test"
  });
  const first = run(source);
  const second = run(source);
  const reconstruction = first.providers[0].reconstructions[0].reconstruction;

  expect(reconstruction.status).toBe("ambiguous");
  expect(reconstruction.axes.horizontal.hypotheses.map(
    hypothesis => hypothesis.intervalCount
  )).toEqual([1, 2, 3, 4]);
  expect(reconstruction.axes.vertical.hypotheses.map(
    hypothesis => hypothesis.intervalCount
  )).toEqual([1, 2, 3, 4]);
  expect(reconstruction.observations.observedBounds).toMatchObject({
    semantics: "accepted-candidate-envelope",
    value: { top: 0, left: 0, width: 20, height: 20 },
    provenance: {
      source: "phase-4-shadow-grid-geometry",
      derivation: "outermost-accepted-horizontal-and-vertical-candidate-positions"
    }
  });
  expect(reconstruction.assumptions).toContainEqual({
    id: "observed-bounds-are-accepted-candidate-envelope",
    status: "applied"
  });
  expect(reconstruction.assumptions).not.toContainEqual({
    id: "observed-bounds-are-outer-line-centers",
    status: "applied"
  });
  expect(JSON.stringify(second)).toBe(JSON.stringify(first));
});

test("benchmark consumes the existing Phase 4 result without rerunning analysis", async () => {
  const phase4 = createShadowGridAnalysis([
    createProvider("provider", "available", [
      createGridAnalysisObservation({ regionId: "region" })
    ])
  ]);
  const phase4Run = jest.fn(() => phase4);
  const reconstruct = jest.fn(() => createReconstructionResult("available"));
  const reconstructionExperiment = {
    ...shadowGridReconstructionDiagnosticsExperiment,
    run(_binaryImage, _context, execution) {
      return createRunner({ reconstruct })(
        execution.getSuccessfulDiagnostics("shadow-grid-analysis-diagnostics")
      );
    }
  };
  const runBenchmark = createDigitizationExperimentBenchmark({
    listExperiments: () => [
      {
        id: "shadow-grid-analysis-diagnostics",
        description: "Existing Phase 4 observations",
        run: phase4Run
      },
      reconstructionExperiment
    ],
    now: () => 1
  });

  const benchmark = await runBenchmark(new Proxy({}, {
    get() {
      throw new Error("BinaryImage must not be accessed by the fixture");
    }
  }));

  expect(phase4Run).toHaveBeenCalledTimes(1);
  expect(reconstruct).toHaveBeenCalledTimes(1);
  expect(benchmark.experiments[1]).toEqual(expect.objectContaining({
    id: "shadow-grid-reconstruction-diagnostics",
    success: true,
    diagnostics: expect.objectContaining({
      type: "shadow-grid-reconstruction-diagnostics"
    })
  }));
});

test("Observation Report receives compact shadow reconstruction observations", () => {
  const diagnostics = createRunner({
    reconstruct: () => createReconstructionResult("available")
  })(createShadowGridAnalysis([
    createProvider("provider", "available", [
      createGridAnalysisObservation({ regionId: "region" })
    ])
  ]));
  const report = createExperimentObservationReport({
    production: { gridDetection: { confidence: 0.42 } },
    benchmark: {
      experiments: [{
        id: "shadow-grid-reconstruction-diagnostics",
        description: "Shadow reconstruction",
        durationMs: 1,
        success: true,
        diagnostics
      }]
    }
  });

  expect(report.observations.available).toEqual(expect.arrayContaining([
    {
      experimentId: "shadow-grid-reconstruction-diagnostics",
      category: "shadow-grid-reconstruction",
      observationId: "provider.provider.region.region.reconstruction-status",
      value: "available"
    },
    {
      experimentId: "shadow-grid-reconstruction-diagnostics",
      category: "shadow-grid-reconstruction",
      observationId: "provider.provider.region.region.reconstruction",
      value: createReconstructionResult("available")
    }
  ]));
});

test("flows through comparison and dataset observation without rerunning production", async () => {
  const binaryImage = { marker: "runtime-image-reference" };
  const productionResult = {
    gridDetection: { confidence: 0.5, diagnostics: [] },
    context: { binaryImage }
  };
  const runProduction = jest.fn(async () => productionResult);
  const phase4Run = jest.fn(() => createShadowGridAnalysis([
    createProvider("provider", "available", [
      createGridAnalysisObservation({ regionId: "region" })
    ])
  ]));
  const reconstruct = jest.fn(() => createReconstructionResult("available"));
  const runBenchmark = createDigitizationExperimentBenchmark({
    listExperiments: () => [
      {
        id: "shadow-grid-analysis-diagnostics",
        description: "Existing Phase 4 observations",
        run: phase4Run
      },
      {
        ...shadowGridReconstructionDiagnosticsExperiment,
        run(_binaryImage, _context, execution) {
          return createRunner({ reconstruct })(
            execution.getSuccessfulDiagnostics("shadow-grid-analysis-diagnostics")
          );
        }
      }
    ],
    now: () => 1
  });
  const runDataset = createDigitizationDatasetRunner({
    runProduction,
    runComparison: createDigitizationExperimentComparison({ runBenchmark }),
    createObservationReport: createExperimentObservationReport
  });

  const result = await runDataset({
    datasetId: "phase-3-reconstruction",
    items: [{ id: "item-1", metadata: { filename: "one.pdf" } }],
    prepareInput: async () => ({
      source: { type: "synthetic-source" },
      readImageData: jest.fn()
    })
  });

  expect(runProduction).toHaveBeenCalledTimes(1);
  expect(phase4Run).toHaveBeenCalledTimes(1);
  expect(reconstruct).toHaveBeenCalledTimes(1);
  expect(result.items[0].observationReport.result.observations.available)
    .toEqual(expect.arrayContaining([
      expect.objectContaining({
        experimentId: "shadow-grid-reconstruction-diagnostics",
        category: "shadow-grid-reconstruction",
        observationId: "provider.provider.region.region.reconstruction-status",
        value: "available"
      })
    ]));
});

test("does not access BinaryImage, production detection, GridAnalysis or ground truth", () => {
  expect(() => shadowGridReconstructionDiagnosticsExperiment.run(
    new Proxy({}, {
      get() {
        throw new Error("BinaryImage must not be read");
      }
    }),
    new Proxy({}, {
      get() {
        throw new Error("context must not be read");
      }
    }),
    { getSuccessfulDiagnostics: () => null }
  )).not.toThrow();

  const source = fs.readFileSync(
    require.resolve("./shadowGridReconstructionDiagnostics"),
    "utf8"
  );
  const productionSource = fs.readFileSync(
    require.resolve("../detection/imageGridDetectionOrchestrator"),
    "utf8"
  );

  expect(source).not.toMatch(
    /from\s+["'][^"']*(BinaryImage|GridAnalysis)|createGridAnalysis\(|findLineCandidates\(/
  );
  expect(source).not.toMatch(/groundTruth|grid-ground-truth/i);
  expect(source).not.toMatch(/detectGridFromImageSource|createGridDetection/);
  expect(productionSource).not.toMatch(/reconstructUniformOrthogonalLattice/);
});

test("contains no evaluation, recommendation or automatic-selection fields", () => {
  const result = createRunner({
    reconstruct: () => createReconstructionResult("ambiguous")
  })(createShadowGridAnalysis([
    createProvider("provider", "available", [
      createGridAnalysisObservation({ regionId: "region" })
    ])
  ]));
  const keys = collectKeys(result).map(normalizeKey);

  expect(keys).not.toEqual(expect.arrayContaining([
    "score",
    "confidence",
    "rank",
    "ranking",
    "recommendation",
    "selection",
    "selectedhypothesis",
    "preferredhypothesis",
    "selectedregion",
    "preferredregion"
  ]));
});

function createRunner({ reconstruct }) {
  return createShadowGridReconstructionDiagnosticsRunner({
    reconstruct,
    parameters: createParameters(),
    readEnvironment: () => "test"
  });
}

function createShadowGridAnalysis(providers) {
  return {
    type: "shadow-grid-analysis-diagnostics",
    version: 1,
    status: "complete",
    providers
  };
}

function createProvider(id, status, gridAnalyses, reason = null) {
  return {
    id,
    description: `Provider ${id}`,
    status,
    regionCount: gridAnalyses.length,
    reason,
    gridAnalyses
  };
}

function createGridAnalysisObservation({
  regionId = "region",
  regionBounds = { top: 10, left: 20, width: 20, height: 20 },
  horizontalPositions = [0, 10, 20],
  verticalPositions = [0, 10, 20],
  geometryBounds = { top: 0, left: 0, width: 20, height: 20 },
  spacingDiagnostics = []
} = {}) {
  return {
    providerId: "provider",
    regionId,
    regionBounds,
    regionDimensions: {
      width: regionBounds.width,
      height: regionBounds.height
    },
    status: "completed",
    gridAnalysisStatus: "measured",
    durationMs: 1,
    candidateCounts: {
      horizontal: horizontalPositions.length,
      vertical: verticalPositions.length
    },
    candidatePositions: {
      horizontal: horizontalPositions,
      vertical: verticalPositions
    },
    spacingDiagnostics,
    geometry: geometryBounds
      ? {
        status: "available",
        rows: horizontalPositions.length - 1,
        cols: verticalPositions.length - 1,
        bounds: geometryBounds
      }
      : {
        status: "unavailable",
        rows: null,
        cols: null,
        bounds: null
      },
    rejectionReasons: [],
    error: null
  };
}

function createParameters(overrides = {}) {
  return {
    strategyId: "uniform-orthogonal-lattice",
    minimumObservedCandidatesPerAxis: 2,
    permittedIntervalCount: { minimum: 2, maximum: 2 },
    permittedCellSpacing: { minimum: 1, maximum: 100 },
    maximumSkippedIntervalsBetweenCandidates: 10,
    maximumConsecutiveInferredLines: 10,
    maximumInferredLineFraction: 0.9,
    candidateAlignmentTolerancePx: 1,
    boundsAlignmentTolerancePx: 1,
    positionQuantum: 0.5,
    maximumHypothesisCount: 100,
    ...overrides
  };
}

function createReconstructionResult(status) {
  return {
    type: "grid-reconstruction",
    version: 1,
    status,
    axes: {
      horizontal: { status, hypotheses: [] },
      vertical: { status, hypotheses: [] }
    },
    gridHypotheses: [],
    diagnostics: [],
    reasons: status === "available" ? [] : [{ code: `${status}-fixture` }]
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

  return Object.entries(value).flatMap(([key, nested]) => [
    key,
    ...collectKeys(nested)
  ]);
}

function normalizeKey(key) {
  return key.replace(/[-_]/g, "").toLowerCase();
}
