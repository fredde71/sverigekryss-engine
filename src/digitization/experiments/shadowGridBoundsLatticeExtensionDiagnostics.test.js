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

test("preserves the accepted-candidate envelope and factors extensions", () => {
  const sources = createSources({
    dimensions: { width: 21, height: 31 }
  });
  const result = createRunner()(sources);
  const artifact = readArtifact(result);

  const product = readProduct(result);

  expect(artifact.status).toBe("unavailable");
  expect(artifact.sourceAcceptedCandidateEnvelope).toEqual(
    sources.gridBoundsObservations.providers[0]
      .boundsObservations[0].boundsObservation
      .sourceAcceptedCandidateEnvelope
  );
  expect(artifact.observations).toEqual([]);
  expect(product).toMatchObject({
    status: "available",
    representation: "factored-axis-extension-product",
    cartesianProduct: {
      horizontalExtensionStateCount: 2,
      verticalExtensionStateCount: 1,
      totalCombinationCount: 2,
      unextendedCombinationCount: 1,
      possibleEnvelopeCount: 1,
      materializedEnvelopeCount: 0
    }
  });
  expect(product.axes.horizontal.interpretations[0].extensionStates).toEqual([
    {
      extensionIndex: 0,
      inferredBefore: 0,
      inferredAfter: 0,
      proposedStart: 0,
      proposedEnd: 20
    },
    {
      extensionIndex: 1,
      inferredBefore: 0,
      inferredAfter: 1,
      proposedStart: 0,
      proposedEnd: 30
    }
  ]);
});

test("references source interpretation evidence without cloning it per product", () => {
  const sources = createSources({
    dimensions: { width: 21, height: 31 },
    horizontalResiduals: [0.5, -0.5]
  });
  const product = readProduct(createRunner()(sources));
  const horizontal = product.axes.horizontal.interpretations[0];

  expect(horizontal.interpretationReference).toEqual({
    source: "shadow-grid-reconstruction-diagnostics",
    diagnosticType: "uniform-orthogonal-lattice-strategy",
    providerId: "provider-a",
    regionId: "region-a",
    axis: "horizontal",
    interpretationIndex: 0,
    intervalCount: 2
  });
  expect(horizontal).not.toHaveProperty("candidateResiduals");
  expect(sources.shadowGridReconstruction.providers[0].reconstructions[0]
    .reconstruction.diagnostics[0].axes.horizontal.interpretations[0]
    .candidateResiduals[0].residual).toBe(0.5);
});

test("evaluates rejected pre-admission evidence without admitting it", () => {
  const sources = createSources({ dimensions: { width: 21, height: 31 } });
  const reconstruction = sources.shadowGridReconstruction.providers[0]
    .reconstructions[0].reconstruction;
  const before = clone(reconstruction);
  const product = readProduct(createRunner()(sources));

  expect(reconstruction.gridHypotheses).toEqual([]);
  expect(product.axes.horizontal.interpretations[0].interpretationStatus)
    .toBe("rejected");
  expect(product.axes.vertical.interpretations[0].interpretationStatus)
    .toBe("rejected");
  expect(reconstruction).toEqual(before);
});

test("preserves pre-admission interpretation order in extension observations", () => {
  const sources = createSources({ dimensions: { width: 21, height: 31 } });
  const horizontal = sources.shadowGridReconstruction.providers[0]
    .reconstructions[0].reconstruction.diagnostics[0].axes.horizontal;
  horizontal.interpretations.push(createAxisInterpretation(
    horizontal.observedBounds.start,
    horizontal.observedBounds.end,
    4,
    [0, 0]
  ));

  const interpretations = readProduct(createRunner()(sources))
    .axes.horizontal.interpretations;

  expect(interpretations.map(interpretation => ({
    interpretationIndex:
      interpretation.interpretationReference.interpretationIndex,
    intervalCount: interpretation.interpretationReference.intervalCount
  }))).toEqual([
    { interpretationIndex: 0, intervalCount: 2 },
    { interpretationIndex: 1, intervalCount: 4 }
  ]);
});

test("preserves interpretations with unavailable extension evidence", () => {
  const sources = createSources({ dimensions: { width: 21, height: 31 } });
  const horizontal = sources.shadowGridReconstruction.providers[0]
    .reconstructions[0].reconstruction.diagnostics[0].axes.horizontal;
  const unavailable = createAxisInterpretation(0, 20, 1, [0, 0]);

  unavailable.quantumCompatibility.representations = [];
  unavailable.rejectionReasons = [{ code: "spacing-out-of-range" }];
  horizontal.interpretations.unshift(unavailable);

  const interpretations = readProduct(createRunner()(sources))
    .axes.horizontal.interpretations;

  expect(interpretations).toHaveLength(2);
  expect(interpretations.map(item => ({
    index: item.interpretationReference.interpretationIndex,
    intervalCount: item.interpretationReference.intervalCount,
    extensionStatus: item.extensionStatus,
    extensionStateCount: item.extensionStates.length
  }))).toEqual([
    {
      index: 0,
      intervalCount: 1,
      extensionStatus: "unavailable",
      extensionStateCount: 0
    },
    {
      index: 1,
      intervalCount: 2,
      extensionStatus: "available",
      extensionStateCount: 2
    }
  ]);
});

test("preserves the exact Cartesian count without materializing combinations", () => {
  const sources = createSources({
    bounds: { top: 10, left: 20, width: 20, height: 20 },
    dimensions: { width: 61, height: 41 }
  });
  const run = createRunner();
  const first = run(sources);
  const second = run(sources);
  const artifact = readArtifact(first);
  const product = readProduct(first);

  expect(artifact.observations).toEqual([]);
  expect(product.cartesianProduct).toEqual({
    horizontalExtensionStateCount: 4,
    verticalExtensionStateCount: 4,
    totalCombinationCount: 16,
    unextendedCombinationCount: 1,
    possibleEnvelopeCount: 15,
    materializedEnvelopeCount: 0
  });
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
        "provider.provider-a.region.region-a.product.cartesian-counts",
      value: {
        horizontalExtensionStateCount: 2,
        verticalExtensionStateCount: 1,
        totalCombinationCount: 2,
        unextendedCombinationCount: 1,
        possibleEnvelopeCount: 1,
        materializedEnvelopeCount: 0
      }
    },
    {
      experimentId: "shadow-grid-bounds-lattice-extension-diagnostics",
      category: "shadow-grid-bounds-lattice-extension",
      observationId:
        "provider.provider-a.region.region-a.product.horizontal.interpretation-count",
      value: 1
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
  const product = result.items[0].comparison.result.benchmark.experiments[3]
    .diagnostics.providers[0].boundsObservations[0].boundsObservation
    .diagnostics[0];

  expect(result.items[0].status).toBe("completed");
  expect(product.cartesianProduct).toMatchObject({
    totalCombinationCount: 2,
    possibleEnvelopeCount: 1,
    materializedEnvelopeCount: 0
  });
  expect(result.items[0].observationReport.result.observations.available)
    .toEqual(expect.arrayContaining([
      expect.objectContaining({
        experimentId: "shadow-grid-bounds-lattice-extension-diagnostics",
        observationId:
          "provider.provider-a.region.region-a.product.cartesian-counts",
        value: expect.objectContaining({
          possibleEnvelopeCount: 1,
          materializedEnvelopeCount: 0
        })
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
        gridHypotheses: [],
        diagnostics: [{
          type: "uniform-orthogonal-lattice-strategy",
          status: "unavailable",
          axes: {
            horizontal: createAxisDiagnostic(
              "horizontal",
              bounds.top,
              bounds.top + bounds.height,
              horizontalResiduals
            ),
            vertical: createAxisDiagnostic(
              "vertical",
              bounds.left,
              bounds.left + bounds.width,
              [0, 0]
            )
          }
        }]
      }
    }]
  };
}

function createAxisDiagnostic(axis, start, end, residuals) {
  return {
    status: "unavailable",
    candidatePositions: [start + residuals[0], end + residuals[1]],
    candidateGaps: [end - start + residuals[1] - residuals[0]],
    observedBounds: { start, end },
    interpretations: [createAxisInterpretation(start, end, 2, residuals)],
    axis
  };
}

function createAxisInterpretation(start, end, intervalCount, residuals) {
  const spacing = (end - start) / intervalCount;
  const positions = Array.from(
    { length: intervalCount + 1 },
    (_value, index) => start + (index * spacing)
  );
  return {
      intervalCount,
      derivedSpacing: spacing,
      status: "rejected",
      quantumCompatibility: {
        representations: positions.map((modeledPosition, lineIndex) => ({
          lineIndex,
          modeledPosition,
          quantizedPosition: modeledPosition,
          residual: 0,
          status: "compatible"
        }))
      },
      candidateResiduals: [
        createCandidateResidual(0, start, residuals[0]),
        createCandidateResidual(1, end, residuals[1])
      ],
      candidateAssignmentAttempts: [
        createAssignmentAttempt(0, start, residuals[0]),
        createAssignmentAttempt(
          1,
          end,
          residuals[1],
          intervalCount
        )
      ],
      rejectionReasons: [{ code: "candidate-alignment-failed" }],
      inferredLineCount: 1,
      longestInferredRun: 1,
      inferredLineFraction: 1 / 3,
      skippedIntervalCounts: []
  };
}

function createCandidateResidual(candidateIndex, modeledPosition, residual) {
  return {
    candidateIndex,
    observedPosition: modeledPosition + residual,
    modeledPosition,
    residual,
    absoluteResidual: Math.abs(residual),
    assignmentStatus: "assigned"
  };
}

function createAssignmentAttempt(
  candidateIndex,
  linePosition,
  residual,
  endLineIndex = 2
) {
  return {
    candidateIndex,
    candidatePosition: linePosition + residual,
    lineIndex: candidateIndex === 0 ? 0 : endLineIndex,
    linePosition,
    residual,
    absoluteResidual: Math.abs(residual),
    tolerancePx: 1,
    status: "assigned"
  };
}

function readArtifact(result) {
  return result.providers[0].boundsObservations[0].boundsObservation;
}

function readProduct(result) {
  return readArtifact(result).diagnostics.find(diagnostic => (
    diagnostic.type === "uniform-lattice-outer-grid-envelope-product"
  ));
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
