import fs from "fs";
import { createDigitizationExperimentBenchmark } from "./digitizationExperimentBenchmark";
import { createDigitizationExperimentComparison } from "./digitizationExperimentComparison";
import { createExperimentObservationReport } from "./experimentObservationReport";
import { createDigitizationDatasetRunner } from "./dataset/digitizationDatasetRunner";
import {
  runShadowGridBoundsObservationDiagnostics
} from "./shadowGridBoundsObservationDiagnostics";
import {
  createShadowOuterLineCenterObservationDiagnosticsRunner,
  shadowOuterLineCenterObservationDiagnosticsExperiment
} from "./shadowOuterLineCenterObservationDiagnostics";

test.each(["production", undefined, "preview"])(
  "rejects %p before reading shadow evidence",
  environment => {
    const run = createRunner(environment);
    const source = new Proxy({}, {
      get() {
        throw new Error("shadow evidence must not be read");
      }
    });

    expect(() => run(source)).toThrow(
      "Shadow outer line center observations are available only in development or test"
    );
  }
);

test.each(["development", "test"])("runs in %s", environment => {
  const result = createRunner(environment)({
    shadowGridAnalysis: createGridDiagnostics([]),
    gridBoundsObservations: createBoundsDiagnostics([])
  });

  expect(result).toMatchObject({ status: "complete", providers: [] });
});

test("preserves exact accepted candidate centers in fixed edge order", () => {
  const sources = createSources({
    geometryBounds: { top: 2.5, left: 1, width: 30.5, height: 40 }
  });
  const result = createRunner()(sources);
  const observation = readObservation(result);

  expect(Object.keys(observation.edges)).toEqual([
    "top",
    "bottom",
    "left",
    "right"
  ]);
  expect(Object.fromEntries(Object.entries(observation.edges).map(
    ([edge, value]) => [edge, value.acceptedCandidateCenter]
  ))).toEqual({
    top: 2.5,
    bottom: 42.5,
    left: 1,
    right: 31.5
  });
  expect(Object.values(observation.edges).map(edge => edge.status))
    .toEqual(["partial", "partial", "partial", "partial"]);
});

test("preserves coordinates, provenance and evidence references", () => {
  const sources = createSources();
  const observation = readObservation(createRunner()(sources));

  expect(observation.coordinateSystem).toEqual(
    sources.gridBoundsObservations.providers[0].boundsObservations[0]
      .boundsObservation.coordinateSystem
  );
  expect(observation.provenance).toEqual({
    source: "shadow-outer-line-center-observation-diagnostics",
    providerId: "provider-a",
    regionId: "region-a",
    method: "preserve-accepted-outer-candidate-centers"
  });
  expect(observation.edges.top.evidenceReferences).toEqual([
    {
      experimentId: "shadow-grid-bounds-observation-diagnostics",
      artifactType: "grid-bounds-observation",
      source: "sourceAcceptedCandidateEnvelope",
      edge: "top",
      providerId: "provider-a",
      regionId: "region-a"
    },
    {
      experimentId: "shadow-grid-analysis-diagnostics",
      source: "candidatePositions",
      axis: "horizontal",
      candidateIndex: 0,
      providerId: "provider-a",
      regionId: "region-a"
    }
  ]);
});

test("reports partial evidence without inventing unavailable measurements", () => {
  const observation = readObservation(createRunner()(createSources()));
  const top = observation.edges.top;

  expect(top).toMatchObject({
    status: "partial",
    acceptedCandidateCenter: 0,
    candidateRunGeometry: null,
    projectionEvidence: null,
    continuityObservations: [],
    neighborhoodObservationExtent: null,
    diagnostics: [{
      candidateCenterAvailable: true,
      candidateRunGeometryAvailable: false,
      projectionEvidenceAvailable: false,
      continuityEvidenceAvailable: false,
      neighborhoodObservationExtentAvailable: false
    }]
  });
  expect(top.reasons.map(reason => reason.code)).toEqual([
    "candidate-run-geometry-unavailable",
    "projection-evidence-unavailable",
    "continuity-evidence-unavailable",
    "neighborhood-observation-extent-unavailable"
  ]);
});

test("uses accepted candidate positions when envelope evidence is unavailable", () => {
  const sources = createSources({
    geometryBounds: null,
    horizontalPositions: [3.5, 40],
    verticalPositions: [7]
  });
  const observation = readObservation(createRunner()(sources));

  expect(observation.edges.top).toMatchObject({
    status: "partial",
    acceptedCandidateCenter: 3.5
  });
  expect(observation.edges.bottom).toMatchObject({
    status: "partial",
    acceptedCandidateCenter: 40
  });
  expect(observation.edges.left).toMatchObject({
    status: "unavailable",
    acceptedCandidateCenter: null,
    reasons: [{ code: "accepted-outer-candidate-center-unavailable" }]
  });
  expect(observation.edges.right.status).toBe("unavailable");
});

test("preserves provider and region ordering deterministically", () => {
  const first = createSources();
  const second = createSources({ providerId: "provider-b", regionId: "region-b" });
  const input = {
    shadowGridAnalysis: createGridDiagnostics([
      first.shadowGridAnalysis.providers[0],
      second.shadowGridAnalysis.providers[0]
    ]),
    gridBoundsObservations: createBoundsDiagnostics([
      first.gridBoundsObservations.providers[0],
      second.gridBoundsObservations.providers[0]
    ])
  };
  const run = createRunner();
  const result = run(input);

  expect(result.providers.map(provider => provider.id))
    .toEqual(["provider-a", "provider-b"]);
  expect(result.providers.map(provider => (
    provider.outerLineCenterObservations[0].regionId
  ))).toEqual(["region-a", "region-b"]);
  expect(JSON.stringify(run(input))).toBe(JSON.stringify(result));
});

test("extracts compact edge observations through benchmark and report", async () => {
  const sources = createSources();
  const benchmark = await createDigitizationExperimentBenchmark({
    listExperiments: () => [
      fixtureExperiment(
        "shadow-grid-analysis-diagnostics",
        sources.shadowGridAnalysis
      ),
      fixtureExperiment(
        "shadow-grid-bounds-observation-diagnostics",
        sources.gridBoundsObservations
      ),
      shadowOuterLineCenterObservationDiagnosticsExperiment
    ],
    now: () => 1
  })({});
  const report = createExperimentObservationReport({
    production: { gridDetection: { confidence: 0.5 } },
    benchmark
  });

  expect(report.observations.available).toEqual(expect.arrayContaining([
    {
      experimentId: "shadow-outer-line-center-observation-diagnostics",
      category: "shadow-outer-line-center-observation",
      observationId:
        "provider.provider-a.region.region-a.edge.top.accepted-candidate-center",
      value: 0
    },
    {
      experimentId: "shadow-outer-line-center-observation-diagnostics",
      category: "shadow-outer-line-center-observation",
      observationId:
        "provider.provider-a.region.region-a.edge.right.status",
      value: "partial"
    }
  ]));
});

test("flows through dataset execution without changing production", async () => {
  const sources = createSources();
  const productionResult = {
    gridDetection: { confidence: 0.4 },
    context: { binaryImage: { runtime: true } }
  };
  const runProduction = jest.fn(async () => productionResult);
  const runBenchmark = createDigitizationExperimentBenchmark({
    listExperiments: () => [
      fixtureExperiment(
        "shadow-grid-analysis-diagnostics",
        sources.shadowGridAnalysis
      ),
      fixtureExperiment(
        "shadow-grid-bounds-observation-diagnostics",
        sources.gridBoundsObservations
      ),
      shadowOuterLineCenterObservationDiagnosticsExperiment
    ],
    now: () => 1
  });
  const runDataset = createDigitizationDatasetRunner({
    runProduction,
    runComparison: createDigitizationExperimentComparison({ runBenchmark }),
    createObservationReport: createExperimentObservationReport
  });
  const result = await runDataset({
    datasetId: "outer-line-center-phase-2",
    items: [{ id: "item-a", metadata: { filename: "a.pdf" } }],
    prepareInput: async () => ({ source: {}, readImageData: jest.fn() })
  });

  expect(runProduction).toHaveBeenCalledTimes(1);
  expect(result.items[0].production.result).toBe(productionResult);
  expect(result.items[0].status).toBe("completed");
});

test("does not read BinaryImage, Ground Truth or production orchestration", () => {
  expect(() => shadowOuterLineCenterObservationDiagnosticsExperiment.run(
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
    require.resolve("./shadowOuterLineCenterObservationDiagnostics"),
    "utf8"
  );
  const production = fs.readFileSync(
    require.resolve("../detection/imageGridDetectionOrchestrator"),
    "utf8"
  );

  expect(source).not.toMatch(/groundTruth|grid-ground-truth/i);
  expect(source).not.toMatch(/detectGrid|analyzeGrid|reconstructUniform/);
  expect(production).not.toMatch(/OuterLineCenter/);
});

test("does not mutate frozen evidence or add evaluation fields", () => {
  const sources = deepFreeze(createSources());
  const before = JSON.stringify(sources);
  const result = createRunner()(sources);

  expect(JSON.stringify(sources)).toBe(before);
  expect(Object.isFrozen(result)).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(
    /"(score|confidence|rank|ranking|recommendation|selected|preferred)"\s*:/i
  );
});

function createRunner(environment) {
  const resolvedEnvironment = arguments.length === 0 ? "test" : environment;

  return createShadowOuterLineCenterObservationDiagnosticsRunner({
    readEnvironment: () => resolvedEnvironment
  });
}

function createSources({
  providerId = "provider-a",
  regionId = "region-a",
  geometryBounds = { top: 0, left: 2, width: 30, height: 40 },
  horizontalPositions = [0, 20, 40],
  verticalPositions = [2, 17, 32]
} = {}) {
  const gridAnalysis = {
    providerId,
    regionId,
    regionBounds: { top: 287, left: 50, width: 100, height: 80 },
    regionDimensions: { width: 100, height: 80 },
    status: "completed",
    gridAnalysisStatus: geometryBounds ? "measured" : "unavailable",
    candidateCounts: {
      horizontal: horizontalPositions.length,
      vertical: verticalPositions.length
    },
    candidatePositions: {
      horizontal: horizontalPositions,
      vertical: verticalPositions
    },
    spacingDiagnostics: [],
    geometry: geometryBounds
      ? { status: "available", rows: 2, cols: 2, bounds: geometryBounds }
      : { status: "unavailable", rows: null, cols: null, bounds: null },
    rejectionReasons: [],
    error: null
  };
  const gridProvider = {
    id: providerId,
    description: `Provider ${providerId}`,
    status: "available",
    regionCount: 1,
    reason: null,
    gridAnalyses: [gridAnalysis]
  };
  const shadowGridAnalysis = createGridDiagnostics([gridProvider]);
  const gridBoundsObservations = runShadowGridBoundsObservationDiagnostics(
    shadowGridAnalysis
  );

  return { shadowGridAnalysis, gridBoundsObservations };
}

function createGridDiagnostics(providers) {
  return {
    type: "shadow-grid-analysis-diagnostics",
    version: 1,
    status: "complete",
    providers
  };
}

function createBoundsDiagnostics(providers) {
  return {
    type: "shadow-grid-bounds-observation-diagnostics",
    version: 1,
    status: "complete",
    sourceExperimentId: "shadow-grid-analysis-diagnostics",
    reason: null,
    providers
  };
}

function readObservation(result) {
  return result.providers[0].outerLineCenterObservations[0].observation;
}

function fixtureExperiment(id, diagnostics) {
  return {
    id,
    description: `${id} fixture`,
    run: () => diagnostics
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
