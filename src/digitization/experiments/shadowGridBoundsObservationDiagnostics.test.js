import fs from "fs";
import { createDigitizationExperimentBenchmark } from "./digitizationExperimentBenchmark";
import { createDigitizationExperimentComparison } from "./digitizationExperimentComparison";
import { createExperimentObservationReport } from "./experimentObservationReport";
import { createDigitizationDatasetRunner } from "./dataset/digitizationDatasetRunner";
import {
  createShadowGridBoundsObservationDiagnosticsRunner,
  shadowGridBoundsObservationDiagnosticsExperiment
} from "./shadowGridBoundsObservationDiagnostics";

test.each(["production", undefined, "preview"])(
  "rejects %p before reading Phase 4 observations",
  environment => {
    const createObservation = jest.fn();
    const run = createShadowGridBoundsObservationDiagnosticsRunner({
      createObservation,
      readEnvironment: () => environment
    });
    const source = new Proxy({}, {
      get() {
        throw new Error("source must not be read");
      }
    });

    expect(() => run(source)).toThrow(
      "Shadow grid bounds observations are available only in development or test"
    );
    expect(createObservation).not.toHaveBeenCalled();
  }
);

test.each(["development", "test"])(
  "runs in the %s environment",
  environment => {
    const result = createRunner({ environment })(createShadowGridAnalysis([]));

    expect(result).toMatchObject({ status: "complete", providers: [] });
  }
);

test("preserves the exact source envelope, coordinates and provenance", () => {
  const sourceBounds = { top: 0.5, left: 5, width: 20.5, height: 30 };
  const regionBounds = { top: 100, left: 25, width: 200, height: 150 };
  const result = createRunner()(createShadowGridAnalysis([
    createProvider("provider-a", [createGridAnalysis({
      regionId: "region-a",
      regionBounds,
      geometryBounds: sourceBounds
    })])
  ]));
  const artifact = result.providers[0].boundsObservations[0].boundsObservation;

  expect(artifact.sourceAcceptedCandidateEnvelope).toEqual({
    status: "available",
    semantics: "accepted-candidate-envelope",
    coordinateSpace: "analysis-region-local",
    bounds: sourceBounds,
    provenance: {
      source: "phase-4-shadow-grid-geometry",
      derivation: "outermost-accepted-horizontal-and-vertical-candidate-positions"
    }
  });
  expect(artifact.coordinateSystem).toEqual({
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
      regionBounds,
      relationship: "analysis-region-local-to-rendered-binary-image"
    }
  });
});

test("explicitly records that no outer-grid envelope is established", () => {
  const result = createRunner()(createShadowGridAnalysis([
    createProvider("provider", [createGridAnalysis()])
  ]));
  const artifact = result.providers[0].boundsObservations[0].boundsObservation;

  expect(artifact).toMatchObject({
    type: "grid-bounds-observation",
    version: 1,
    status: "unavailable",
    observations: [],
    reasons: [{
      code: "outer-grid-line-center-envelope-not-established"
    }],
    diagnostics: [{
      type: "grid-bounds-observation-shadow-plumbing",
      status: "unavailable",
      reason: "outer-grid-line-center-envelope-not-established"
    }]
  });
  expect(artifact).not.toHaveProperty("selectedObservation");
  expect(artifact).not.toHaveProperty("preferredObservation");
});

test("preserves provider and region order deterministically", () => {
  const source = createShadowGridAnalysis([
    createProvider("provider-z", [
      createGridAnalysis({ regionId: "region-z" }),
      createGridAnalysis({ regionId: "region-a" })
    ]),
    createProvider("provider-a", [
      createGridAnalysis({ regionId: "region-m" })
    ])
  ]);
  const run = createRunner();
  const first = run(source);
  const second = run(source);

  expect(first.providers.map(provider => provider.id))
    .toEqual(["provider-z", "provider-a"]);
  expect(first.providers[0].boundsObservations.map(region => region.regionId))
    .toEqual(["region-z", "region-a"]);
  expect(first.providers[1].boundsObservations.map(region => region.regionId))
    .toEqual(["region-m"]);
  expect(JSON.stringify(second)).toBe(JSON.stringify(first));
});

test("preserves unavailable accepted-candidate evidence explicitly", () => {
  const result = createRunner()(createShadowGridAnalysis([
    createProvider("provider", [createGridAnalysis({ geometryBounds: null })])
  ]));
  const artifact = result.providers[0].boundsObservations[0].boundsObservation;

  expect(artifact.sourceAcceptedCandidateEnvelope).toEqual({
    status: "unavailable",
    semantics: "accepted-candidate-envelope",
    coordinateSpace: "analysis-region-local",
    bounds: null,
    reason: "accepted-candidate-envelope-unavailable",
    provenance: {
      source: "phase-4-shadow-grid-geometry",
      derivation: "outermost-accepted-horizontal-and-vertical-candidate-positions"
    }
  });
  expect(artifact.status).toBe("unavailable");
  expect(artifact.observations).toEqual([]);
});

test("Observation Report extracts compact bounds observations", async () => {
  const phase4 = createShadowGridAnalysis([
    createProvider("provider", [createGridAnalysis({ regionId: "region" })])
  ]);
  const runBenchmark = createDigitizationExperimentBenchmark({
    listExperiments: () => [
      {
        id: "shadow-grid-analysis-diagnostics",
        description: "Phase 4 fixture",
        run: () => phase4
      },
      shadowGridBoundsObservationDiagnosticsExperiment
    ],
    now: () => 1
  });
  const benchmark = await runBenchmark({});
  const report = createExperimentObservationReport({
    production: { gridDetection: { confidence: 0.5 } },
    benchmark
  });

  expect(report.observations.available).toEqual(expect.arrayContaining([
    {
      experimentId: "shadow-grid-bounds-observation-diagnostics",
      category: "shadow-grid-bounds-observation",
      observationId: "provider.provider.region.region.bounds-observation-provenance",
      value: {
        source: "shadow-grid-analysis-diagnostics",
        providerId: "provider",
        regionId: "region",
        method: "phase-2-shadow-plumbing-no-bounds-inference"
      }
    },
    {
      experimentId: "shadow-grid-bounds-observation-diagnostics",
      category: "shadow-grid-bounds-observation",
      observationId: "provider.provider.region.region.source-envelope-bounds",
      value: { top: 0, left: 0, width: 20, height: 20 }
    },
    {
      experimentId: "shadow-grid-bounds-observation-diagnostics",
      category: "shadow-grid-bounds-observation",
      observationId: "provider.provider.region.region.outer-grid-observation-count",
      value: 0
    }
  ]));
  expect(report.observations.unavailable).toEqual(expect.arrayContaining([
    {
      experimentId: "shadow-grid-bounds-observation-diagnostics",
      category: "shadow-grid-bounds-observation",
      observationId: "provider.provider.region.region.outer-grid-envelope",
      reason: "outer-grid-line-center-envelope-not-established"
    }
  ]));
  const extracted = report.observations.available.filter(observation => (
    observation.experimentId
      === "shadow-grid-bounds-observation-diagnostics"
  ));
  expect(JSON.stringify(extracted)).not.toMatch(/rawShadowGridAnalysis|gridAnalyses/);
});

test("flows through dataset execution without changing production", async () => {
  const productionResult = {
    gridDetection: { confidence: 0.5, diagnostics: [] },
    context: { binaryImage: { marker: "runtime-reference" } }
  };
  const runProduction = jest.fn(async () => productionResult);
  const phase4 = createShadowGridAnalysis([
    createProvider("provider", [createGridAnalysis()])
  ]);
  const runBenchmark = createDigitizationExperimentBenchmark({
    listExperiments: () => [
      {
        id: "shadow-grid-analysis-diagnostics",
        description: "Phase 4 fixture",
        run: () => phase4
      },
      shadowGridBoundsObservationDiagnosticsExperiment
    ],
    now: () => 1
  });
  const runDataset = createDigitizationDatasetRunner({
    runProduction,
    runComparison: createDigitizationExperimentComparison({ runBenchmark }),
    createObservationReport: createExperimentObservationReport
  });
  const result = await runDataset({
    datasetId: "grid-bounds-phase-2",
    items: [{ id: "item-1", metadata: { filename: "one.pdf" } }],
    prepareInput: async () => ({
      source: { type: "fixture" },
      readImageData: jest.fn()
    })
  });

  expect(runProduction).toHaveBeenCalledTimes(1);
  expect(result.items[0].production.result).toBe(productionResult);
  expect(result.items[0].observationReport.result.observations.unavailable)
    .toEqual(expect.arrayContaining([
      expect.objectContaining({
        experimentId: "shadow-grid-bounds-observation-diagnostics",
        observationId: "provider.provider.region.region.outer-grid-envelope"
      })
    ]));
});

test("does not access runtime images, production detection or Ground Truth", () => {
  expect(() => shadowGridBoundsObservationDiagnosticsExperiment.run(
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
    require.resolve("./shadowGridBoundsObservationDiagnostics"),
    "utf8"
  );
  const productionSource = fs.readFileSync(
    require.resolve("../detection/imageGridDetectionOrchestrator"),
    "utf8"
  );

  expect(source).not.toMatch(/groundTruth|grid-ground-truth/i);
  expect(source).not.toMatch(/detectGridFromImageSource|createGridDetection/);
  expect(productionSource).not.toMatch(/GridBoundsObservation/);
});

function createRunner({ environment = "test" } = {}) {
  return createShadowGridBoundsObservationDiagnosticsRunner({
    readEnvironment: () => environment
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

function createProvider(id, gridAnalyses, status = "available") {
  return {
    id,
    description: `Provider ${id}`,
    status,
    regionCount: gridAnalyses.length,
    reason: null,
    gridAnalyses
  };
}

function createGridAnalysis({
  regionId = "region",
  regionBounds = { top: 10, left: 20, width: 100, height: 80 },
  geometryBounds = { top: 0, left: 0, width: 20, height: 20 }
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
    candidateCounts: { horizontal: 3, vertical: 3 },
    candidatePositions: {
      horizontal: [0, 10, 20],
      vertical: [0, 10, 20]
    },
    spacingDiagnostics: [],
    geometry: geometryBounds
      ? {
        status: "available",
        rows: 2,
        cols: 2,
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
