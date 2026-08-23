import fs from "fs";
import { createGridGroundTruth } from "./gridGroundTruth";
import {
  createGridBoundsLatticeExtensionValidationReport
} from "./gridBoundsLatticeExtensionValidationReport";

test("compares an exact lattice-extension bounds observation", () => {
  const report = createReport();
  const comparison = readObservations(report)[0];

  expect(comparison).toMatchObject({
    observationIndex: 0,
    observationId: "extension-a",
    status: "compared",
    proposedBounds: {
      coordinateSpace: "rendered-binary-image-pixels",
      value: { top: 100, left: 50, width: 20, height: 20 }
    },
    groundTruthBounds: { top: 100, left: 50, width: 20, height: 20 },
    deltas: {
      status: "compared",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0
    },
    exactBoundMatch: {
      status: "compared",
      exact: true
    },
    inferredOuterIntervals: { top: 1, left: 2, right: 3, bottom: 4 },
    spacingUsed: { horizontal: 10, vertical: 10 }
  });
  expect(report.inventory).toMatchObject({
    totalObservationCount: 1,
    comparedObservationCount: 1,
    exactBoundsMatchCount: 1
  });
});

test("records signed edge, size and half-pixel deltas", () => {
  const observation = createObservation({
    bounds: { top: -0.5, left: 1, width: 18.5, height: 21 }
  });
  const comparison = readObservations(createReport({
    observations: [observation]
  }))[0];

  expect(comparison.proposedBounds.value).toEqual({
    top: 99.5,
    left: 51,
    width: 18.5,
    height: 21
  });
  expect(comparison.deltas).toEqual({
    status: "compared",
    equality: "exact-numeric-equality",
    top: -0.5,
    left: 1,
    right: -0.5,
    bottom: 0.5,
    width: -1.5,
    height: 1
  });
  expect(comparison.exactBoundMatch.exact).toBe(false);
});

test("normalizes axis-specific offset and scale before comparison", () => {
  const comparison = readObservations(createReport({
    transform: { offsetX: 30, offsetY: 60, scaleX: 2, scaleY: 4 },
    observationBounds: { top: 10, left: 10, width: 10, height: 5 },
    groundTruthBounds: { top: 100, left: 50, width: 20, height: 20 }
  }))[0];

  expect(comparison.rawLocalObservation.bounds).toEqual({
    top: 10,
    left: 10,
    width: 10,
    height: 5
  });
  expect(comparison.proposedBounds.value).toEqual({
    top: 100,
    left: 50,
    width: 20,
    height: 20
  });
  expect(comparison.exactBoundMatch.exact).toBe(true);
});

test("validates a factored envelope product without materializing combinations", () => {
  const item = createDatasetItem({
    providers: [createProvider("provider", [createFactoredRegion()])]
  });
  const report = createGridBoundsLatticeExtensionValidationReport({
    datasetReport: createDatasetReport([item]),
    groundTruth: createGroundTruth([
      createAnnotation(
        "item-a",
        "a.pdf",
        { top: 100, left: 50, width: 20, height: 30 }
      )
    ])
  });
  const product = report.items[0].providers[0].regions[0].envelopeProduct;

  expect(product).toMatchObject({
    status: "compared",
    representation: "factored-axis-extension-product",
    cartesianProduct: {
      totalCombinationCount: 2,
      possibleEnvelopeCount: 1,
      materializedEnvelopeCount: 0
    },
    comparedCombinationCount: 1,
    exactBoundsMatchCombinationCount: 1
  });
  expect(product.axes.horizontal.interpretations[0].extensionStates)
    .toEqual([
      expect.objectContaining({
        extensionIndex: 0,
        normalizedStart: 100,
        normalizedEnd: 120,
        exact: false
      }),
      expect.objectContaining({
        extensionIndex: 1,
        normalizedStart: 100,
        normalizedEnd: 130,
        exact: true
      })
    ]);
  expect(report.inventory).toMatchObject({
    totalObservationCount: 0,
    totalFactoredCombinationCount: 1,
    comparedFactoredCombinationCount: 1,
    exactBoundsMatchCount: 1
  });
});

test("preserves dataset, provider, region and ambiguous observation order", () => {
  const firstItem = createDatasetItem({
    id: "item-b",
    filename: "b.pdf",
    providers: [
      createProvider("provider-z", [
        createRegion("region-z", [
          createObservation({ id: "observation-z" }),
          createObservation({ id: "observation-a" })
        ], "ambiguous"),
        createRegion("region-a", [createObservation({ id: "observation-m" })])
      ]),
      createProvider("provider-a", [
        createRegion("region-only", [createObservation({ id: "observation-x" })])
      ])
    ]
  });
  const secondItem = createDatasetItem({
    id: "item-a",
    filename: "a.pdf"
  });
  const report = createGridBoundsLatticeExtensionValidationReport({
    datasetReport: createDatasetReport([firstItem, secondItem]),
    groundTruth: createGroundTruth([
      createAnnotation("item-a", "a.pdf"),
      createAnnotation("item-b", "b.pdf")
    ])
  });

  expect(report.items.map(item => item.itemId)).toEqual(["item-b", "item-a"]);
  expect(report.items[0].providers.map(provider => provider.providerId))
    .toEqual(["provider-z", "provider-a"]);
  expect(report.items[0].providers[0].regions.map(region => region.regionId))
    .toEqual(["region-z", "region-a"]);
  expect(report.items[0].providers[0].regions[0].experimentResultStatus)
    .toBe("ambiguous");
  expect(report.items[0].providers[0].regions[0].observations.map(
    observation => observation.observationId
  )).toEqual(["observation-z", "observation-a"]);
});

test("preserves provenance for every independently compared observation", () => {
  const observations = [
    createObservation({ id: "first", hypothesisId: "grid-h1-v1" }),
    createObservation({ id: "second", hypothesisId: "grid-h2-v2" })
  ];
  const compared = readObservations(createReport({ observations }));

  expect(compared.map(observation => observation.sourceProvenance.observation))
    .toEqual([
      {
        source: "shadow-grid-reconstruction-diagnostics",
        gridHypothesisId: "grid-h1-v1"
      },
      {
        source: "shadow-grid-reconstruction-diagnostics",
        gridHypothesisId: "grid-h2-v2"
      }
    ]);
  expect(compared.map(observation => observation.rawLocalObservation.id))
    .toEqual(["first", "second"]);
});

test("represents missing Ground Truth without dropping experiment observations", () => {
  const report = createGridBoundsLatticeExtensionValidationReport({
    datasetReport: createDatasetReport([createDatasetItem()]),
    groundTruth: createGroundTruth([])
  });
  const comparison = readObservations(report)[0];

  expect(report.items[0]).toMatchObject({
    status: "unavailable",
    reasons: ["ground-truth-annotation-unavailable"],
    groundTruth: {
      status: "unavailable",
      reason: "ground-truth-annotation-unavailable"
    }
  });
  expect(comparison).toMatchObject({
    observationId: "extension-a",
    status: "unavailable",
    reason: "ground-truth-annotation-unavailable",
    groundTruthBounds: null,
    exactBoundMatch: { status: "unavailable", exact: null }
  });
  expect(comparison.rawLocalObservation.bounds).toEqual({
    top: 0,
    left: 0,
    width: 20,
    height: 20
  });
});

test("represents unavailable experiment and unavailable region results", () => {
  const missingExperiment = createDatasetItem();
  missingExperiment.comparison.result.benchmark.experiments = [];
  const unavailableRegion = createDatasetItem({
    id: "item-b",
    filename: "b.pdf",
    providers: [createProvider("provider", [
      createRegion("region", [], "unavailable")
    ])]
  });
  const report = createGridBoundsLatticeExtensionValidationReport({
    datasetReport: createDatasetReport([missingExperiment, unavailableRegion]),
    groundTruth: createGroundTruth([
      createAnnotation("item-a", "a.pdf"),
      createAnnotation("item-b", "b.pdf")
    ])
  });

  expect(report.items[0]).toMatchObject({
    status: "unavailable",
    reasons: ["grid-bounds-lattice-extension-experiment-unavailable"],
    experiment: {
      status: "unavailable",
      reason: "grid-bounds-lattice-extension-experiment-unavailable"
    }
  });
  expect(report.items[1].providers[0].regions[0]).toMatchObject({
    experimentResultStatus: "unavailable",
    status: "unavailable",
    reason: "no-compatible-lattice-extension-observation",
    observations: []
  });
});

test("verifies filename and preserves unmatched annotations", () => {
  const report = createGridBoundsLatticeExtensionValidationReport({
    datasetReport: createDatasetReport([createDatasetItem()]),
    groundTruth: createGroundTruth([
      createAnnotation("item-a", "different.pdf"),
      createAnnotation("missing-item", "missing.pdf")
    ])
  });

  expect(report.items[0].reasons).toContain("filename-mismatch");
  expect(readObservations(report)[0]).toMatchObject({
    status: "unavailable",
    reason: "filename-mismatch"
  });
  expect(report.unmatchedAnnotations).toEqual([{
    itemId: "missing-item",
    filename: "missing.pdf",
    reason: "dataset-item-not-found"
  }]);
});

test("is deterministic, immutable and does not mutate frozen inputs", () => {
  const datasetReport = deepFreeze(createDatasetReport([createDatasetItem()]));
  const groundTruth = createGroundTruth([createAnnotation()]);
  const datasetSnapshot = JSON.stringify(datasetReport);
  const first = createGridBoundsLatticeExtensionValidationReport({
    datasetReport,
    groundTruth
  });
  const second = createGridBoundsLatticeExtensionValidationReport({
    datasetReport,
    groundTruth
  });

  expect(second).toEqual(first);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(readObservations(first)[0])).toBe(true);
  expect(JSON.stringify(datasetReport)).toBe(datasetSnapshot);
});

test("has no Ground Truth inference, runtime access, or evaluation fields", () => {
  const report = createReport();
  const serialized = JSON.stringify(report);
  const source = fs.readFileSync(
    require.resolve("./gridBoundsLatticeExtensionValidationReport"),
    "utf8"
  );

  expect(serialized).not.toMatch(
    /"(score|confidence|rank|ranking|recommendation|selected|preferred)"\s*:/i
  );
  expect(serialized).not.toMatch(
    /binaryImage|imageData|canvas|projections|lineCandidates|Uint8Array/
  );
  expect(source).not.toMatch(/detectGrid|analyzeGrid|reconstructUniform/);
});

test("rejects mismatched dataset identities", () => {
  expect(() => createGridBoundsLatticeExtensionValidationReport({
    datasetReport: createDatasetReport([createDatasetItem()]),
    groundTruth: createGridGroundTruth({
      datasetId: "other-dataset",
      annotations: []
    })
  })).toThrow(
    "Dataset report and ground truth datasetId must match exactly"
  );
});

function createReport({
  observations,
  transform,
  observationBounds,
  groundTruthBounds
} = {}) {
  const item = createDatasetItem({
    providers: [createProvider("provider", [createRegion(
      "region",
      observations ?? [createObservation({ bounds: observationBounds })],
      (observations?.length ?? 1) > 1 ? "ambiguous" : "available",
      transform
    )])]
  });

  return createGridBoundsLatticeExtensionValidationReport({
    datasetReport: createDatasetReport([item]),
    groundTruth: createGroundTruth([
      createAnnotation("item-a", "a.pdf", groundTruthBounds)
    ])
  });
}

function createDatasetReport(items) {
  return {
    type: "digitization-dataset-report",
    version: 1,
    datasetRun: { datasetId: "tt-bounds" },
    items
  };
}

function createDatasetItem({
  id = "item-a",
  filename = "a.pdf",
  providers = [createProvider()]
} = {}) {
  return {
    id,
    metadata: { filename },
    comparison: {
      status: "completed",
      result: {
        benchmark: {
          experiments: [{
            id: "shadow-grid-bounds-lattice-extension-diagnostics",
            success: true,
            diagnostics: {
              type: "shadow-grid-bounds-lattice-extension-diagnostics",
              version: 1,
              status: "complete",
              providers
            }
          }]
        }
      }
    }
  };
}

function createProvider(
  id = "provider",
  regions = [createRegion()]
) {
  return {
    id,
    status: "available",
    boundsObservations: regions
  };
}

function createRegion(
  regionId = "region",
  observations = [createObservation()],
  artifactStatus = "available",
  transform = { offsetX: 50, offsetY: 100, scaleX: 1, scaleY: 1 }
) {
  return {
    providerId: "provider",
    regionId,
    status: "completed",
    boundsObservation: {
      type: "grid-bounds-observation",
      version: 1,
      status: artifactStatus,
      coordinateSystem: {
        space: "analysis-region-local",
        localToBinaryImage: transform
      },
      provenance: {
        source: "shadow-grid-bounds-lattice-extension-diagnostics"
      },
      sourceAcceptedCandidateEnvelope: {
        status: "available",
        semantics: "accepted-candidate-envelope",
        bounds: { top: 0, left: 0, width: 10, height: 10 }
      },
      observations,
      reasons: observations.length === 0
        ? [{ code: "no-compatible-lattice-extension-observation" }]
        : artifactStatus === "ambiguous"
          ? [{ code: "multiple-compatible-lattice-extension-observations" }]
          : [{ code: "single-compatible-lattice-extension-observation" }]
    },
    error: null
  };
}

function createFactoredRegion() {
  const region = createRegion("region", [], "unavailable");

  region.boundsObservation.reasons = [{
    code: "outer-grid-envelope-product-preserved-without-materialization"
  }];
  region.boundsObservation.diagnostics = [{
    type: "uniform-lattice-outer-grid-envelope-product",
    version: 1,
    status: "available",
    representation: "factored-axis-extension-product",
    coordinateSpace: "analysis-region-local",
    sourceAcceptedCandidateEnvelope: {
      top: 0,
      left: 0,
      width: 20,
      height: 20
    },
    axes: {
      horizontal: createFactoredAxis("horizontal", [
        { before: 0, after: 0, start: 0, end: 20 },
        { before: 0, after: 1, start: 0, end: 30 }
      ]),
      vertical: createFactoredAxis("vertical", [
        { before: 0, after: 0, start: 0, end: 20 }
      ])
    },
    cartesianProduct: {
      horizontalExtensionStateCount: 2,
      verticalExtensionStateCount: 1,
      totalCombinationCount: 2,
      unextendedCombinationCount: 1,
      possibleEnvelopeCount: 1,
      materializedEnvelopeCount: 0
    },
    provenance: { source: "shadow-grid-lattice-evidence" },
    assumptions: [],
    reasons: [{
      code: "lattice-extension-product-preserved-without-materialization"
    }]
  }];
  return region;
}

function createFactoredAxis(axis, states) {
  return {
    axis,
    interpretationCount: 1,
    extensionStateCount: states.length,
    interpretations: [{
      interpretationReference: {
        source: "shadow-grid-reconstruction-diagnostics",
        axis,
        interpretationIndex: 0,
        intervalCount: 2
      },
      interpretationStatus: "rejected",
      extensionStatus: "available",
      reason: null,
      spacing: 10,
      sourceStart: 0,
      sourceEnd: 20,
      extensionStates: states.map((state, extensionIndex) => ({
        extensionIndex,
        inferredBefore: state.before,
        inferredAfter: state.after,
        proposedStart: state.start,
        proposedEnd: state.end
      }))
    }]
  };
}

function createObservation({
  id = "extension-a",
  bounds = { top: 0, left: 0, width: 20, height: 20 },
  hypothesisId = "grid-h-v"
} = {}) {
  return {
    id,
    status: "available",
    semantics: "outer-grid-line-center-envelope",
    coordinateSpace: "analysis-region-local",
    bounds,
    inferredOuterIntervals: { top: 1, left: 2, right: 3, bottom: 4 },
    spacingUsed: { horizontal: 10, vertical: 10 },
    provenance: {
      source: "shadow-grid-reconstruction-diagnostics",
      gridHypothesisId: hypothesisId
    },
    evidenceReferences: [{ type: "uniform-lattice-grid-hypothesis", id: hypothesisId }],
    assumptions: [{ id: "uniform-lattice-continues", status: "applied" }],
    reasons: [{ code: "lattice-extension-compatible" }],
    diagnostics: []
  };
}

function createGroundTruth(annotations) {
  return createGridGroundTruth({
    datasetId: "tt-bounds",
    annotations
  });
}

function createAnnotation(
  itemId = "item-a",
  filename = "a.pdf",
  gridBounds = { top: 100, left: 50, width: 20, height: 20 }
) {
  return {
    itemId,
    filename,
    document: { width: 500, height: 700 },
    gridBounds,
    horizontalLinePositions: [gridBounds.top, gridBounds.top + gridBounds.height],
    verticalLinePositions: [gridBounds.left, gridBounds.left + gridBounds.width],
    rows: 1,
    cols: 1,
    annotation: { status: "human-confirmed" }
  };
}

function readObservations(report) {
  return report.items[0].providers[0].regions[0].observations;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
