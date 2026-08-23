import fs from "fs";
import { createGridBoundsObservation } from "../analysis/GridBoundsObservation";
import { createDigitizationExperimentBenchmark } from "./digitizationExperimentBenchmark";
import { createDigitizationExperimentComparison } from "./digitizationExperimentComparison";
import { createExperimentObservationReport } from "./experimentObservationReport";
import { createDigitizationDatasetRunner } from "./dataset/digitizationDatasetRunner";
import {
  createShadowGridBoundsLatticeExtensionDiagnosticsRunner,
  shadowGridBoundsLatticeExtensionDiagnosticsExperiment
} from "./shadowGridBoundsLatticeExtensionDiagnostics";

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
      "Shadow grid bounds lattice extension is available only in development or test"
    );
  }
);

test("preserves the accepted-candidate envelope and records one compatible extension", () => {
  const sources = createSources({
    dimensions: { width: 21, height: 31 }
  });
  const result = createRunner()(sources);
  const artifact = readArtifact(result);

  expect(artifact.status).toBe("available");
  expect(artifact.sourceAcceptedCandidateEnvelope).toEqual(
    sources.gridBoundsObservations.providers[0]
      .boundsObservations[0].boundsObservation
      .sourceAcceptedCandidateEnvelope
  );
  expect(artifact.observations).toHaveLength(1);
  expect(artifact.observations[0]).toMatchObject({
    bounds: { top: 0, left: 0, width: 20, height: 30 },
    inferredOuterIntervals: {
      top: 0,
      bottom: 1,
      left: 0,
      right: 0
    },
    spacingUsed: { horizontal: 10, vertical: 10 },
    candidateAlignmentResiduals: {
      horizontal: [
        {
          candidateIndex: 0,
          observedPosition: 0,
          modeledPosition: 0,
          residual: 0,
          absoluteResidual: 0
        },
        {
          candidateIndex: 1,
          observedPosition: 20,
          modeledPosition: 20,
          residual: 0,
          absoluteResidual: 0
        }
      ],
      vertical: expect.any(Array)
    }
  });
});

test("preserves provenance and existing alignment residuals", () => {
  const result = createRunner()(createSources({
    dimensions: { width: 21, height: 31 },
    horizontalResiduals: [0.5, -0.5]
  }));
  const observation = readArtifact(result).observations[0];

  expect(observation.provenance).toEqual({
    source: "shadow-grid-reconstruction-diagnostics",
    providerId: "provider-a",
    regionId: "region-a",
    gridHypothesisId: "grid-h-v",
    horizontalHypothesisId: "h",
    verticalHypothesisId: "v"
  });
  expect(observation.candidateAlignmentResiduals.horizontal).toEqual([
    {
      candidateIndex: 0,
      observedPosition: 0.5,
      modeledPosition: 0,
      residual: 0.5,
      absoluteResidual: 0.5
    },
    {
      candidateIndex: 1,
      observedPosition: 19.5,
      modeledPosition: 20,
      residual: -0.5,
      absoluteResidual: 0.5
    }
  ]);
  expect(observation.evidenceReferences).toEqual([
    {
      type: "accepted-candidate-envelope",
      bounds: { top: 0, left: 0, width: 20, height: 20 }
    },
    { type: "uniform-lattice-grid-hypothesis", id: "grid-h-v" }
  ]);
});

test("preserves every compatible observation in deterministic order", () => {
  const sources = createSources({
    bounds: { top: 10, left: 20, width: 20, height: 20 },
    dimensions: { width: 61, height: 41 }
  });
  const run = createRunner();
  const first = run(sources);
  const second = run(sources);
  const artifact = readArtifact(first);

  expect(artifact.status).toBe("ambiguous");
  expect(artifact.observations).toHaveLength(15);
  expect(artifact.observations.map(observation => (
    observation.inferredOuterIntervals
  ))).toEqual([
    { top: 0, bottom: 0, left: 0, right: 1 },
    { top: 0, bottom: 0, left: 1, right: 0 },
    { top: 0, bottom: 0, left: 1, right: 1 },
    { top: 0, bottom: 1, left: 0, right: 0 },
    { top: 0, bottom: 1, left: 0, right: 1 },
    { top: 0, bottom: 1, left: 1, right: 0 },
    { top: 0, bottom: 1, left: 1, right: 1 },
    { top: 1, bottom: 0, left: 0, right: 0 },
    { top: 1, bottom: 0, left: 0, right: 1 },
    { top: 1, bottom: 0, left: 1, right: 0 },
    { top: 1, bottom: 0, left: 1, right: 1 },
    { top: 1, bottom: 1, left: 0, right: 0 },
    { top: 1, bottom: 1, left: 0, right: 1 },
    { top: 1, bottom: 1, left: 1, right: 0 },
    { top: 1, bottom: 1, left: 1, right: 1 }
  ]);
  expect(JSON.stringify(second)).toBe(JSON.stringify(first));
});

test("reports unavailable when no compatible outward extension exists", () => {
  const result = createRunner()(createSources({
    dimensions: { width: 21, height: 21 }
  }));
  const artifact = readArtifact(result);

  expect(artifact.status).toBe("unavailable");
  expect(artifact.observations).toEqual([]);
  expect(artifact.reasons).toEqual([
    { code: "no-compatible-lattice-extension-observation" }
  ]);
});

test("preserves provider and region order", () => {
  const sources = createSources({ dimensions: { width: 21, height: 31 } });
  const secondProvider = clone(sources.gridBoundsObservations.providers[0]);

  secondProvider.id = "provider-b";
  secondProvider.boundsObservations[0].providerId = "provider-b";
  secondProvider.boundsObservations[0].boundsObservation =
    createBoundsArtifact("provider-b", "region-b");
  secondProvider.boundsObservations[0].regionId = "region-b";
  sources.gridBoundsObservations.providers.push(secondProvider);
  sources.shadowGridAnalysis.providers.push(createGridProvider(
    "provider-b",
    "region-b",
    { width: 21, height: 31 }
  ));
  sources.shadowGridReconstruction.providers.push(createReconstructionProvider(
    "provider-b",
    "region-b"
  ));

  const result = createRunner()(sources);

  expect(result.providers.map(provider => provider.id))
    .toEqual(["provider-a", "provider-b"]);
  expect(result.providers.map(provider => (
    provider.boundsObservations[0].regionId
  ))).toEqual(["region-a", "region-b"]);
});

test("flows through benchmark and compact Observation Report extraction", async () => {
  const sources = createSources({ dimensions: { width: 21, height: 31 } });
  const sourceExperiments = [
    fixtureExperiment(
      "shadow-grid-analysis-diagnostics",
      sources.shadowGridAnalysis
    ),
    fixtureExperiment(
      "shadow-grid-bounds-observation-diagnostics",
      sources.gridBoundsObservations
    ),
    fixtureExperiment(
      "shadow-grid-reconstruction-diagnostics",
      sources.shadowGridReconstruction
    ),
    shadowGridBoundsLatticeExtensionDiagnosticsExperiment
  ];
  const runBenchmark = createDigitizationExperimentBenchmark({
    listExperiments: () => sourceExperiments,
    now: () => 1
  });
  const benchmark = await runBenchmark({});
  const report = createExperimentObservationReport({
    production: { gridDetection: { confidence: 0.5 } },
    benchmark
  });

  expect(benchmark.experiments[3]).toMatchObject({
    id: "shadow-grid-bounds-lattice-extension-diagnostics",
    success: true,
    diagnostics: { status: "complete" }
  });
  expect(report.observations.available).toEqual(expect.arrayContaining([
    {
      experimentId: "shadow-grid-bounds-lattice-extension-diagnostics",
      category: "shadow-grid-bounds-lattice-extension",
      observationId:
        "provider.provider-a.region.region-a.compatible-observation-count",
      value: 1
    },
    {
      experimentId: "shadow-grid-bounds-lattice-extension-diagnostics",
      category: "shadow-grid-bounds-lattice-extension",
      observationId:
        "provider.provider-a.region.region-a.observation.0.bounds",
      value: { top: 0, left: 0, width: 20, height: 30 }
    }
  ]));
});

test("flows through the dataset pipeline without interpreting production", async () => {
  const sources = createSources({ dimensions: { width: 21, height: 31 } });
  const productionResult = {
    gridDetection: { confidence: 0.4 },
    context: { binaryImage: { runtime: true } }
  };
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
      fixtureExperiment(
        "shadow-grid-reconstruction-diagnostics",
        sources.shadowGridReconstruction
      ),
      shadowGridBoundsLatticeExtensionDiagnosticsExperiment
    ],
    now: () => 1
  });
  const runDataset = createDigitizationDatasetRunner({
    runProduction: async () => productionResult,
    runComparison: createDigitizationExperimentComparison({ runBenchmark }),
    createObservationReport: createExperimentObservationReport
  });
  const result = await runDataset({
    datasetId: "bounds-extension",
    items: [{ id: "item-a", metadata: { filename: "a.pdf" } }],
    prepareInput: async () => ({ source: {}, readImageData: jest.fn() })
  });

  expect(result.items[0].production.result).toBe(productionResult);
  expect(result.items[0].comparison.result.benchmark.experiments[3])
    .toMatchObject({
      id: "shadow-grid-bounds-lattice-extension-diagnostics",
      success: true,
      diagnostics: { status: "complete" }
    });
  expect(result.items[0].observationReport.result.observations.available)
    .toEqual(expect.arrayContaining([
      expect.objectContaining({
        experimentId: "shadow-grid-bounds-lattice-extension-diagnostics",
        observationId:
          "provider.provider-a.region.region-a.compatible-observation-count",
        value: 1
      })
    ]));
});

test("does not access BinaryImage, Ground Truth or production orchestration", () => {
  expect(() => shadowGridBoundsLatticeExtensionDiagnosticsExperiment.run(
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
    require.resolve("./shadowGridBoundsLatticeExtensionDiagnostics"),
    "utf8"
  );
  const production = fs.readFileSync(
    require.resolve("../detection/imageGridDetectionOrchestrator"),
    "utf8"
  );

  expect(source).not.toMatch(/groundTruth|grid-ground-truth/i);
  expect(source).not.toMatch(/detectGrid|analyzeGrid|reconstructUniform/);
  expect(production).not.toMatch(/LatticeExtension/);
});

test("does not mutate frozen source evidence or add evaluation fields", () => {
  const sources = deepFreeze(createSources({
    dimensions: { width: 21, height: 31 }
  }));
  const snapshot = JSON.stringify(sources);
  const result = createRunner()(sources);

  expect(JSON.stringify(sources)).toBe(snapshot);
  expect(JSON.stringify(result)).not.toMatch(
    /"(score|confidence|rank|ranking|recommendation|selected|preferred)"\s*:/i
  );
});

function createRunner(environment) {
  const resolvedEnvironment = arguments.length === 0 ? "test" : environment;

  return createShadowGridBoundsLatticeExtensionDiagnosticsRunner({
    readEnvironment: () => resolvedEnvironment
  });
}

function createSources({
  bounds = { top: 0, left: 0, width: 20, height: 20 },
  dimensions = { width: 21, height: 31 },
  horizontalResiduals = [0, 0]
} = {}) {
  const artifact = createBoundsArtifact(
    "provider-a",
    "region-a",
    bounds
  );

  return {
    shadowGridAnalysis: {
      type: "shadow-grid-analysis-diagnostics",
      version: 1,
      status: "complete",
      providers: [createGridProvider(
        "provider-a",
        "region-a",
        dimensions
      )]
    },
    gridBoundsObservations: {
      type: "shadow-grid-bounds-observation-diagnostics",
      version: 1,
      status: "complete",
      providers: [{
        id: "provider-a",
        description: "Provider A",
        status: "available",
        regionCount: 1,
        reason: null,
        boundsObservations: [{
          providerId: "provider-a",
          regionId: "region-a",
          status: "completed",
          boundsObservation: artifact,
          error: null
        }]
      }]
    },
    shadowGridReconstruction: {
      type: "shadow-grid-reconstruction-diagnostics",
      version: 1,
      status: "complete",
      providers: [createReconstructionProvider(
        "provider-a",
        "region-a",
        bounds,
        horizontalResiduals
      )]
    }
  };
}

function createBoundsArtifact(
  providerId,
  regionId,
  bounds = { top: 0, left: 0, width: 20, height: 20 }
) {
  return createGridBoundsObservation({
    analysisRegionId: regionId,
    status: "unavailable",
    sourceAcceptedCandidateEnvelope: {
      status: "available",
      semantics: "accepted-candidate-envelope",
      coordinateSpace: "analysis-region-local",
      bounds,
      provenance: { source: "phase-4-shadow-grid-geometry" }
    },
    coordinateSystem: {
      space: "analysis-region-local",
      origin: "top-left",
      xDirection: "right",
      yDirection: "down",
      linePosition: "visual-line-center",
      localToBinaryImage: {
        offsetX: 100,
        offsetY: 200,
        scaleX: 1,
        scaleY: 1
      },
      provenance: { providerId, regionId }
    },
    provenance: { providerId, regionId },
    observations: [],
    reasons: [{
      code: "outer-grid-line-center-envelope-not-established"
    }],
    diagnostics: []
  });
}

function createGridProvider(providerId, regionId, dimensions) {
  return {
    id: providerId,
    status: "available",
    gridAnalyses: [{
      providerId,
      regionId,
      regionDimensions: dimensions
    }]
  };
}

function createReconstructionProvider(
  providerId,
  regionId,
  bounds = { top: 0, left: 0, width: 20, height: 20 },
  horizontalResiduals = [0, 0]
) {
  return {
    id: providerId,
    status: "available",
    reconstructions: [{
      providerId,
      regionId,
      status: "completed",
      reconstructionStatus: "available",
      reconstruction: {
        parameters: {
          maximumConsecutiveInferredLines: 1,
          maximumInferredLineFraction: 1
        },
        gridHypotheses: [createGridHypothesis(
          bounds,
          horizontalResiduals
        )]
      }
    }]
  };
}

function createGridHypothesis(bounds, horizontalResiduals) {
  const horizontalPositions = [bounds.top, bounds.top + 10, bounds.top + 20];
  const verticalPositions = [bounds.left, bounds.left + 10, bounds.left + 20];

  return {
    id: "grid-h-v",
    horizontalHypothesisId: "h",
    verticalHypothesisId: "v",
    lines: {
      horizontal: createLines(horizontalPositions),
      vertical: createLines(verticalPositions)
    },
    candidateAssignments: {
      horizontal: [
        createAssignment(0, horizontalPositions[0], horizontalResiduals[0]),
        createAssignment(1, horizontalPositions[2], horizontalResiduals[1])
      ],
      vertical: [
        createAssignment(0, verticalPositions[0], 0),
        createAssignment(1, verticalPositions[2], 0)
      ]
    }
  };
}

function createLines(positions) {
  return positions.map((position, index) => ({
    index,
    position,
    evidence: {
      status: index === 1 ? "inferred" : "observed-aligned"
    }
  }));
}

function createAssignment(candidateIndex, linePosition, delta) {
  return {
    candidateIndex,
    lineIndex: candidateIndex === 0 ? 0 : 2,
    observedPosition: linePosition + delta,
    linePosition,
    delta
  };
}

function readArtifact(result) {
  return result.providers[0].boundsObservations[0].boundsObservation;
}

function fixtureExperiment(id, diagnostics) {
  return {
    id,
    description: `${id} fixture`,
    run: () => diagnostics
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
