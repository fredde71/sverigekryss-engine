import fs from "fs";
import { createGridGroundTruth } from "./gridGroundTruth";
import {
  createGridReconstructionValidationReport
} from "./gridReconstructionValidationReport";

test("compares an exact reconstructed grid without changing its local observation", () => {
  const reconstruction = createReconstruction({
    coordinateTransform: {
      offsetX: 50,
      offsetY: 100,
      scaleX: 1,
      scaleY: 1
    }
  });
  const report = createReport({ reconstruction });
  const region = report.items[0].providers[0].regions[0];
  const variant = region.variants[0];

  expect(region.rawLocalReconstruction).toEqual(reconstruction);
  expect(region.rawLocalReconstruction.gridHypotheses[0].lines.horizontal.map(
    line => line.position
  )).toEqual([0, 10, 20]);
  expect(variant.normalizedComparisonInput).toEqual(expect.objectContaining({
    coordinateSpace: "rendered-binary-image-pixels",
    bounds: { top: 100, left: 50, width: 20, height: 20 },
    rows: 2,
    cols: 2,
    horizontalLinePositions: [100, 110, 120],
    verticalLinePositions: [50, 60, 70]
  }));
  expect(variant.exact).toBe(true);
  expect(variant.bounds.exact).toBe(true);
  expect(variant.horizontalLines.exact).toBe(true);
  expect(variant.verticalLines.exact).toBe(true);
  expect(variant.rows.exact).toBe(true);
  expect(variant.cols.exact).toBe(true);
});

test("compares accepted-candidate envelope bounds with ground truth", () => {
  const reconstruction = createReconstruction();
  reconstruction.observations.observedBounds = {
    status: "available",
    coordinateSpace: "analysis-region-local",
    semantics: "accepted-candidate-envelope",
    value: { top: 0, left: 0, width: 20, height: 20 },
    provenance: {
      source: "phase-4-shadow-grid-geometry",
      derivation: "outermost-accepted-horizontal-and-vertical-candidate-positions"
    }
  };
  const report = createReport({ reconstruction });
  const region = report.items[0].providers[0].regions[0];
  const variant = region.variants[0];

  expect(region.rawLocalReconstruction.observations.observedBounds)
    .toEqual({
      ...reconstruction.observations.observedBounds,
      provenance: {
        derivation:
          "outermost-accepted-horizontal-and-vertical-candidate-positions"
      }
    });
  expect(variant.normalizedComparisonInput.bounds).toEqual({
    top: 100,
    left: 50,
    width: 20,
    height: 20
  });
  expect(variant.bounds.exact).toBe(true);
});

test("reports missing and extra reconstructed lines in source order", () => {
  const reconstruction = createReconstruction({
    horizontal: [0, 11, 20, 30],
    vertical: [0, 10, 21],
    bounds: { top: 0, left: 0, width: 21, height: 30 }
  });
  const variant = createReport({ reconstruction })
    .items[0].providers[0].regions[0].variants[0];

  expect(variant.horizontalLines.exactMatches).toEqual([
    { expectedIndex: 0, observedIndex: 0, position: 100 },
    { expectedIndex: 2, observedIndex: 2, position: 120 }
  ]);
  expect(variant.horizontalLines.missingExpected).toEqual([
    { expectedIndex: 1, position: 110 }
  ]);
  expect(variant.horizontalLines.extraObserved).toEqual([
    { observedIndex: 1, position: 111 },
    { observedIndex: 3, position: 130 }
  ]);
  expect(variant.verticalLines.missingExpected).toEqual([
    { expectedIndex: 2, position: 70 }
  ]);
  expect(variant.verticalLines.extraObserved).toEqual([
    { observedIndex: 2, position: 71 }
  ]);
});

test("records positive, negative, zero and half-pixel nearest deltas", () => {
  const reconstruction = createReconstruction({
    horizontal: [-0.5, 11, 20],
    vertical: [0.5, 10, 19.5],
    bounds: { top: -0.5, left: 0.5, width: 19, height: 20.5 }
  });
  const variant = createReport({ reconstruction })
    .items[0].providers[0].regions[0].variants[0];

  expect(variant.horizontalLines.nearestObservedByExpected.map(entry => entry.delta))
    .toEqual([-0.5, 1, 0]);
  expect(variant.verticalLines.nearestObservedByExpected.map(entry => entry.delta))
    .toEqual([0.5, 0, -0.5]);
  expect(variant.bounds.components.map(component => component.delta))
    .toEqual([-0.5, 0.5, -1, 0.5]);
});

test("normalizes positions and bounds through axis-specific scale and offset", () => {
  const reconstruction = createReconstruction({
    horizontal: [0, 5, 10],
    vertical: [0, 5, 10],
    bounds: { top: 0, left: 0, width: 10, height: 10 },
    coordinateTransform: {
      offsetX: 50,
      offsetY: 100,
      scaleX: 2,
      scaleY: 2
    }
  });
  const variant = createReport({ reconstruction })
    .items[0].providers[0].regions[0].variants[0];

  expect(variant.normalizedComparisonInput.horizontalLinePositions)
    .toEqual([100, 110, 120]);
  expect(variant.normalizedComparisonInput.verticalLinePositions)
    .toEqual([50, 60, 70]);
  expect(variant.normalizedComparisonInput.bounds).toEqual({
    top: 100,
    left: 50,
    width: 20,
    height: 20
  });
  expect(variant.exact).toBe(true);
});

test("preserves dataset, provider, region and variant order", () => {
  const firstVariants = [
    createGridHypothesis("variant-z"),
    createGridHypothesis("variant-a")
  ];
  const secondVariants = [createGridHypothesis("variant-m")];
  const datasetReport = createDatasetReport({
    items: [
      createDatasetItem({
        id: "item-b",
        filename: "b.pdf",
        providers: [
          createProvider("provider-z", [
            createRegion("region-z", createReconstruction({
              gridHypotheses: firstVariants,
              status: "ambiguous"
            })),
            createRegion("region-a", createReconstruction({
              gridHypotheses: secondVariants
            }))
          ]),
          createProvider("provider-a", [
            createRegion("region-m", createReconstruction())
          ])
        ]
      }),
      createDatasetItem({
        id: "item-a",
        filename: "a.pdf",
        providers: [createProvider("provider-only", [
          createRegion("region-only", createReconstruction())
        ])]
      })
    ]
  });
  const groundTruth = createGroundTruth([
    createAnnotation({ itemId: "item-a", filename: "a.pdf" }),
    createAnnotation({ itemId: "item-b", filename: "b.pdf" })
  ]);
  const report = createGridReconstructionValidationReport({
    datasetReport,
    groundTruth
  });

  expect(report.items.map(item => item.itemId)).toEqual(["item-b", "item-a"]);
  expect(report.items[0].providers.map(provider => provider.providerId))
    .toEqual(["provider-z", "provider-a"]);
  expect(report.items[0].providers[0].regions.map(region => region.regionId))
    .toEqual(["region-z", "region-a"]);
  expect(report.items[0].providers[0].regions[0].variants.map(
    variant => variant.variantId
  )).toEqual(["variant-z", "variant-a"]);
});

test("compares every variant from an ambiguous reconstruction", () => {
  const variants = [
    createGridHypothesis("intervals-2", {
      horizontal: [0, 10, 20],
      vertical: [0, 10, 20]
    }),
    createGridHypothesis("intervals-4", {
      horizontal: [0, 5, 10, 15, 20],
      vertical: [0, 5, 10, 15, 20]
    })
  ];
  const reconstruction = createReconstruction({
    status: "ambiguous",
    gridHypotheses: variants
  });
  const compared = createReport({ reconstruction })
    .items[0].providers[0].regions[0].variants;

  expect(compared.map(variant => variant.variantId)).toEqual([
    "intervals-2",
    "intervals-4"
  ]);
  expect(compared.map(variant => variant.exact)).toEqual([true, false]);
  expect(compared[1].rows).toEqual(expect.objectContaining({
    expected: 2,
    observed: 4,
    delta: 2,
    exact: false
  }));
  expect(compared[1]).not.toHaveProperty("preferred");
});

test("preserves observed-aligned and inferred line provenance", () => {
  const hypothesis = createGridHypothesis("mixed-evidence", {
    horizontal: [0, 10, 20],
    vertical: [0, 10, 20],
    horizontalEvidence: ["observed-aligned", "inferred", "observed-aligned"],
    verticalEvidence: ["inferred", "observed-aligned", "inferred"]
  });
  const reconstruction = createReconstruction({ gridHypotheses: [hypothesis] });
  const variant = createReport({ reconstruction })
    .items[0].providers[0].regions[0].variants[0];

  expect(variant.lineEvidenceInventory.horizontal).toMatchObject({
    observedAlignedCount: 2,
    inferredCount: 1
  });
  expect(variant.lineEvidenceInventory.horizontal.observedAligned.map(
    line => line.lineIndex
  )).toEqual([0, 2]);
  expect(variant.lineEvidenceInventory.horizontal.inferred.map(
    line => line.lineIndex
  )).toEqual([1]);
  expect(variant.lineEvidenceInventory.vertical).toMatchObject({
    observedAlignedCount: 1,
    inferredCount: 2
  });
  expect(variant.normalizedComparisonInput.horizontalLines[1].evidence)
    .toEqual(createEvidence("inferred", 1, 10));
});

test.each(["unavailable", "partial"])(
  "records a %s reconstruction without inventing variants",
  status => {
    const reconstruction = createReconstruction({
      status,
      gridHypotheses: []
    });
    const report = createReport({ reconstruction });
    const item = report.items[0];
    const region = item.providers[0].regions[0];

    expect(item.status).toBe("unavailable");
    expect(region).toMatchObject({
      status: "unavailable",
      reconstructionStatus: status,
      reason: `grid-reconstruction-${status}`,
      variants: []
    });
    expect(region.rawLocalReconstruction.status).toBe(status);
  }
);

test("preserves unavailable and ambiguous provider states without comparisons", () => {
  const datasetReport = createDatasetReport({
    items: [createDatasetItem({
      providers: [
        createProvider("unavailable", [], "unavailable", "no-region"),
        createProvider("ambiguous", [], "ambiguous", "multiple-regions")
      ]
    })]
  });
  const report = createGridReconstructionValidationReport({
    datasetReport,
    groundTruth: createGroundTruth([createAnnotation()])
  });

  expect(report.items[0].providers).toEqual([
    {
      providerId: "unavailable",
      status: "unavailable",
      providerStatus: "unavailable",
      reason: "no-region",
      regions: []
    },
    {
      providerId: "ambiguous",
      status: "unavailable",
      providerStatus: "ambiguous",
      reason: "multiple-regions",
      regions: []
    }
  ]);
});

test("ground-truth availability and filename mismatch never remove variants", () => {
  const datasetReport = createDatasetReport({
    items: [
      createDatasetItem({ id: "unannotated", filename: "unannotated.pdf" }),
      createDatasetItem({ id: "mismatch", filename: "actual.pdf" })
    ]
  });
  const groundTruth = createGroundTruth([
    createAnnotation({ itemId: "mismatch", filename: "expected.pdf" })
  ]);
  const report = createGridReconstructionValidationReport({
    datasetReport,
    groundTruth
  });

  expect(report.items.map(item => item.providers[0].regions[0].variants.map(
    variant => variant.variantId
  ))).toEqual([["variant-001"], ["variant-001"]]);
  expect(report.items[0].providers[0].regions[0].variants[0]).toMatchObject({
    status: "unavailable",
    reason: "ground-truth-annotation-unavailable",
    exact: null,
    horizontalLines: {
      status: "unavailable",
      reason: "ground-truth-annotation-unavailable"
    }
  });
  expect(report.items[1].providers[0].regions[0].variants[0]).toMatchObject({
    status: "unavailable",
    reason: "filename-mismatch",
    exact: null,
    bounds: { status: "unavailable", reason: "filename-mismatch" }
  });
});

test("is deterministic, accepts frozen inputs, freezes output and does not mutate", () => {
  const datasetReport = deepFreeze(createDatasetReport());
  const groundTruth = createGroundTruth([createAnnotation()]);
  const beforeDataset = JSON.stringify(datasetReport);
  const beforeGroundTruth = JSON.stringify(groundTruth);
  const first = createGridReconstructionValidationReport({
    datasetReport,
    groundTruth
  });
  const second = createGridReconstructionValidationReport({
    datasetReport,
    groundTruth
  });

  expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  expect(JSON.stringify(datasetReport)).toBe(beforeDataset);
  expect(JSON.stringify(groundTruth)).toBe(beforeGroundTruth);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.items[0].providers[0].regions[0].variants[0]))
    .toBe(true);
});

test("never reads or exports runtime image fields", () => {
  const reconstruction = createReconstruction();

  for (const field of [
    "binaryImage",
    "imageData",
    "canvas",
    "projection",
    "projections",
    "lineCandidates"
  ]) {
    Object.defineProperty(reconstruction, field, {
      enumerable: true,
      get() {
        throw new Error(`${field} must not be read`);
      }
    });
  }

  expect(() => createReport({ reconstruction })).not.toThrow();

  const source = fs.readFileSync(
    require.resolve("./gridReconstructionValidationReport"),
    "utf8"
  );
  expect(source).not.toMatch(
    /detectGridFromImageSource|createGridAnalysis|findLineCandidates|reconstructUniformOrthogonalLattice/
  );
  expect(source).not.toMatch(
    /from\s+["'][^"']*BinaryImage|createBinaryImage\(|\.run\(groundTruth/
  );
});

test("contains no scoring, ranking, recommendation or selection fields", () => {
  const report = createReport();
  const keys = collectKeys(report).map(normalizeKey);

  expect(keys).not.toEqual(expect.arrayContaining([
    "score",
    "confidence",
    "rank",
    "ranking",
    "recommendation",
    "selection",
    "selectedvariant",
    "preferredvariant",
    "winner",
    "best"
  ]));
});

function createReport({ reconstruction = createReconstruction() } = {}) {
  return createGridReconstructionValidationReport({
    datasetReport: createDatasetReport({
      items: [createDatasetItem({
        providers: [createProvider("provider", [
          createRegion("region", reconstruction)
        ])]
      })]
    }),
    groundTruth: createGroundTruth([createAnnotation()])
  });
}

function createDatasetReport({ items = [createDatasetItem()] } = {}) {
  return {
    type: "digitization-dataset-report",
    version: 1,
    datasetRun: {
      type: "digitization-dataset-run",
      version: 1,
      datasetId: "tt-reconstruction-validation",
      status: "completed"
    },
    items
  };
}

function createDatasetItem({
  id = "item-001",
  filename = "one.pdf",
  providers = [createProvider("provider", [
    createRegion("region", createReconstruction())
  ])]
} = {}) {
  return {
    id,
    metadata: { filename },
    comparison: {
      status: "completed",
      result: {
        benchmark: {
          experiments: [{
            id: "shadow-grid-reconstruction-diagnostics",
            description: "Shadow reconstruction",
            durationMs: 1,
            success: true,
            diagnostics: {
              type: "shadow-grid-reconstruction-diagnostics",
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
  id,
  reconstructions,
  status = "available",
  reason = null
) {
  return {
    id,
    description: `Provider ${id}`,
    status,
    regionCount: reconstructions.length,
    reason,
    reconstructions
  };
}

function createRegion(regionId, reconstruction) {
  return {
    providerId: "provider",
    regionId,
    status: "completed",
    reconstructionStatus: reconstruction.status,
    coordinateProvenance: {
      source: "shadow-grid-analysis-diagnostics",
      providerId: "provider",
      regionId,
      regionBounds: { top: 100, left: 50, width: 20, height: 20 },
      relationship: "analysis-region-local-to-rendered-binary-image"
    },
    reconstruction,
    error: null
  };
}

function createReconstruction({
  status = "available",
  horizontal = [0, 10, 20],
  vertical = [0, 10, 20],
  bounds = { top: 0, left: 0, width: 20, height: 20 },
  coordinateTransform = {
    offsetX: 50,
    offsetY: 100,
    scaleX: 1,
    scaleY: 1
  },
  gridHypotheses
} = {}) {
  const hypotheses = gridHypotheses ?? [createGridHypothesis("variant-001", {
    horizontal,
    vertical,
    bounds
  })];

  return {
    type: "grid-reconstruction",
    version: 1,
    status,
    analysisRegionId: "region",
    coordinateSystem: {
      space: "analysis-region-local",
      origin: "top-left",
      xDirection: "right",
      yDirection: "down",
      linePosition: "visual-line-center",
      localToBinaryImage: coordinateTransform
    },
    observations: {
      rawCandidates: { horizontal: [], vertical: [] },
      candidateAcceptancePolicy: {},
      observedBounds: {},
      spacingEvidence: { horizontal: [], vertical: [] }
    },
    parameters: { strategyId: "uniform-orthogonal-lattice" },
    assumptions: [],
    axes: {
      horizontal: { status, hypotheses: [] },
      vertical: { status, hypotheses: [] }
    },
    gridHypotheses: hypotheses,
    diagnostics: [],
    reasons: status === "available" ? [] : [{ code: `${status}-fixture` }]
  };
}

function createGridHypothesis(id, {
  horizontal = [0, 10, 20],
  vertical = [0, 10, 20],
  bounds = {
    top: horizontal[0],
    left: vertical[0],
    width: vertical[vertical.length - 1] - vertical[0],
    height: horizontal[horizontal.length - 1] - horizontal[0]
  },
  horizontalEvidence,
  verticalEvidence
} = {}) {
  return {
    id,
    horizontalHypothesisId: `${id}-horizontal`,
    verticalHypothesisId: `${id}-vertical`,
    rows: horizontal.length - 1,
    cols: vertical.length - 1,
    bounds,
    lines: {
      horizontal: horizontal.map((position, index) => ({
        index,
        position,
        evidence: createEvidence(
          horizontalEvidence?.[index] ?? "observed-aligned",
          index,
          position
        )
      })),
      vertical: vertical.map((position, index) => ({
        index,
        position,
        evidence: createEvidence(
          verticalEvidence?.[index] ?? "observed-aligned",
          index,
          position
        )
      }))
    },
    candidateAssignments: { horizontal: [], vertical: [] },
    diagnostics: []
  };
}

function createEvidence(status, candidateIndex, observedPosition) {
  return status === "inferred"
    ? {
      status,
      candidateIndex: null,
      observedPosition: null,
      delta: null
    }
    : {
      status,
      candidateIndex,
      observedPosition,
      delta: 0
    };
}

function createGroundTruth(annotations) {
  return createGridGroundTruth({
    datasetId: "tt-reconstruction-validation",
    annotations
  });
}

function createAnnotation({
  itemId = "item-001",
  filename = "one.pdf"
} = {}) {
  return {
    itemId,
    filename,
    document: { width: 200, height: 300 },
    gridBounds: { top: 100, left: 50, width: 20, height: 20 },
    horizontalLinePositions: [100, 110, 120],
    verticalLinePositions: [50, 60, 70],
    rows: 2,
    cols: 2,
    annotation: { status: "human-confirmed" }
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
