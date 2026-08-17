import { createGridGroundTruth } from "./gridGroundTruth";
import { createShadowGridValidationReport } from "./shadowGridValidationReport";

test("associates annotations by exact item ID, verifies filename and preserves dataset order", () => {
  const datasetReport = createDatasetReport({
    items: [
      createDatasetItem({ id: "item-b", filename: "b.pdf" }),
      createDatasetItem({ id: "item-a", filename: "a.pdf" }),
      createDatasetItem({ id: "item-c", filename: "actual-c.pdf" })
    ]
  });
  const groundTruth = createGroundTruth([
    createAnnotation({ itemId: "item-a", filename: "a.pdf" }),
    createAnnotation({ itemId: "item-c", filename: "expected-c.pdf" }),
    createAnnotation({ itemId: "not-in-dataset", filename: "extra.pdf" })
  ]);
  const report = createShadowGridValidationReport({ datasetReport, groundTruth });

  expect(report.items.map(item => item.itemId)).toEqual([
    "item-b",
    "item-a",
    "item-c"
  ]);
  expect(report.items[0]).toEqual(expect.objectContaining({
    status: "unavailable",
    reasons: ["ground-truth-annotation-unavailable"]
  }));
  expect(report.items[1].status).toBe("compared");
  expect(report.items[2]).toEqual(expect.objectContaining({
    status: "unavailable",
    reasons: ["filename-mismatch"],
    comparisons: []
  }));
  expect(report.unmatchedAnnotations).toEqual([
    {
      itemId: "not-in-dataset",
      filename: "extra.pdf",
      reason: "dataset-item-not-found"
    }
  ]);
});

test("normalizes region-local candidates and geometry without changing raw observations", () => {
  const gridAnalysis = createGridAnalysis({
    regionId: "offset-region",
    regionBounds: { top: 100, left: 50, width: 100, height: 80 },
    horizontal: [0, 10, 20],
    vertical: [0, 15, 30],
    geometry: {
      status: "available",
      rows: 2,
      cols: 2,
      bounds: { top: 0, left: 0, width: 30, height: 20 }
    }
  });
  const datasetReport = createDatasetReport({
    items: [createDatasetItem({ gridAnalyses: [gridAnalysis] })]
  });
  const groundTruth = createGroundTruth([
    createAnnotation({
      horizontal: [100, 110, 120],
      vertical: [50, 65, 80]
    })
  ]);
  const report = createShadowGridValidationReport({ datasetReport, groundTruth });
  const item = report.items[0];
  const comparison = item.comparisons[0];
  const raw = item.observations.shadowGrid.providers[0].gridAnalyses[0];

  expect(raw.candidatePositions).toEqual({
    horizontal: [0, 10, 20],
    vertical: [0, 15, 30]
  });
  expect(raw.geometry.bounds).toEqual({ top: 0, left: 0, width: 30, height: 20 });
  expect(comparison.normalizedObservation).toEqual({
    coordinateSpace: "rendered-binary-image-pixels",
    candidatePositions: {
      horizontal: [100, 110, 120],
      vertical: [50, 65, 80]
    },
    geometry: {
      status: "available",
      rows: 2,
      cols: 2,
      bounds: { top: 100, left: 50, width: 30, height: 20 }
    }
  });
  expect(comparison.horizontalLines.exact).toBe(true);
  expect(comparison.verticalLines.exact).toBe(true);
  expect(comparison.bounds.exact).toBe(true);
  expect(comparison.rows).toEqual({
    status: "compared",
    equality: "exact-numeric-equality",
    expected: 2,
    observed: 2,
    delta: 0,
    exact: true
  });
  expect(comparison.cols.exact).toBe(true);
});

test("reports exact matches, missing lines and extra lines in source order", () => {
  const report = createReport({
    annotation: createAnnotation({ horizontal: [10, 20, 30] }),
    gridAnalysis: createGridAnalysis({
      horizontal: [10, 21, 30, 40],
      vertical: [5, 15, 25]
    })
  });
  const lines = report.items[0].comparisons[0].horizontalLines;

  expect(lines.exact).toBe(false);
  expect(lines.exactMatches).toEqual([
    { expectedIndex: 0, observedIndex: 0, position: 10 },
    { expectedIndex: 2, observedIndex: 2, position: 30 }
  ]);
  expect(lines.missingExpected).toEqual([
    { expectedIndex: 1, position: 20 }
  ]);
  expect(lines.extraObserved).toEqual([
    { observedIndex: 1, position: 21 },
    { observedIndex: 3, position: 40 }
  ]);
});

test("records positive, negative, zero and half-pixel nearest deltas with deterministic ties", () => {
  const report = createReport({
    annotation: createAnnotation({
      horizontal: [10, 20, 30],
      vertical: [5, 15, 25]
    }),
    gridAnalysis: createGridAnalysis({
      horizontal: [9.5, 10.5, 21, 30],
      vertical: [4.5, 15, 25.5]
    })
  });
  const comparison = report.items[0].comparisons[0];

  expect(comparison.horizontalLines.nearestObservedByExpected).toEqual([
    {
      expectedIndex: 0,
      expectedPosition: 10,
      observedIndex: 0,
      observedPosition: 9.5,
      delta: -0.5
    },
    {
      expectedIndex: 1,
      expectedPosition: 20,
      observedIndex: 2,
      observedPosition: 21,
      delta: 1
    },
    {
      expectedIndex: 2,
      expectedPosition: 30,
      observedIndex: 3,
      observedPosition: 30,
      delta: 0
    }
  ]);
  expect(comparison.verticalLines.nearestObservedByExpected.map(entry => entry.delta))
    .toEqual([-0.5, 0, 0.5]);
  expect(comparison.horizontalLines.nearestExpectedByObserved[1]).toEqual({
    observedIndex: 1,
    observedPosition: 10.5,
    expectedIndex: 0,
    expectedPosition: 10,
    delta: 0.5
  });
  expect(report.comparisonPolicy.tolerancePx).toBeNull();
});

test("reports ordered bounds component and row/column deltas", () => {
  const report = createReport({
    annotation: createAnnotation(),
    gridAnalysis: createGridAnalysis({
      geometry: {
        status: "available",
        rows: 3,
        cols: 1,
        bounds: { top: 11, left: 4.5, width: 21, height: 18 }
      }
    })
  });
  const comparison = report.items[0].comparisons[0];

  expect(comparison.bounds).toEqual({
    status: "compared",
    equality: "exact-numeric-equality",
    exact: false,
    components: [
      { name: "top", expected: 10, observed: 11, delta: 1, exact: false },
      { name: "left", expected: 5, observed: 4.5, delta: -0.5, exact: false },
      { name: "width", expected: 20, observed: 21, delta: 1, exact: false },
      { name: "height", expected: 20, observed: 18, delta: -2, exact: false }
    ]
  });
  expect(comparison.rows).toEqual(expect.objectContaining({
    expected: 2,
    observed: 3,
    delta: 1,
    exact: false
  }));
  expect(comparison.cols).toEqual(expect.objectContaining({
    expected: 2,
    observed: 1,
    delta: -1,
    exact: false
  }));
});

test("compares candidate lines when geometry is unavailable", () => {
  const report = createReport({
    annotation: createAnnotation(),
    gridAnalysis: createGridAnalysis({
      geometry: {
        status: "unavailable",
        rows: null,
        cols: null,
        bounds: null
      },
      rejectionReasons: [{ code: "geometry-build-failed" }]
    })
  });
  const item = report.items[0];
  const comparison = item.comparisons[0];

  expect(item.status).toBe("partial");
  expect(comparison.status).toBe("partial");
  expect(comparison.horizontalLines.status).toBe("compared");
  expect(comparison.verticalLines.status).toBe("compared");
  expect(comparison.bounds).toEqual({
    status: "unavailable",
    reason: "shadow-geometry-unavailable"
  });
  expect(comparison.rows.status).toBe("unavailable");
  expect(comparison.normalizedObservation.geometry).toEqual({
    status: "unavailable",
    rows: null,
    cols: null,
    bounds: null,
    rejectionReasons: [{ code: "geometry-build-failed" }]
  });
});

test("preserves provider and region order and isolates unavailable providers and failures", () => {
  const providers = [
    createProvider({ id: "unavailable", status: "unavailable", reason: "no-region" }),
    createProvider({
      id: "first",
      gridAnalyses: [
        createGridAnalysis({ regionId: "first-a" }),
        createGridAnalysis({
          regionId: "first-b",
          status: "failed",
          error: { name: "Error", message: "region failed" }
        })
      ]
    }),
    createProvider({
      id: "second",
      gridAnalyses: [createGridAnalysis({ regionId: "second-a" })]
    })
  ];
  const report = createReport({ providers });
  const item = report.items[0];

  expect(item.observations.shadowGrid.providers.map(provider => provider.id)).toEqual([
    "unavailable",
    "first",
    "second"
  ]);
  expect(item.comparisons.map(comparison => comparison.regionId)).toEqual([
    "first-a",
    "first-b",
    "second-a"
  ]);
  expect(item.comparisons[1]).toEqual(expect.objectContaining({
    status: "unavailable",
    reason: "region failed"
  }));
  expect(item.reasons).toContain("provider.unavailable.no-region");
});

test("is deterministic, leaves frozen inputs untouched and emits no evaluation contract", () => {
  const datasetReport = deepFreeze(createDatasetReport());
  const groundTruth = createGroundTruth([createAnnotation()]);
  const first = createShadowGridValidationReport({ datasetReport, groundTruth });
  const second = createShadowGridValidationReport({ datasetReport, groundTruth });
  const forbidden = new Set([
    "score",
    "rank",
    "ranking",
    "recommendation",
    "preferredRegion",
    "selectedRegion",
    "automaticAcceptance",
    "accepted"
  ]);

  expect(second).toEqual(first);
  expect(Object.isFrozen(datasetReport)).toBe(true);
  expect(Object.isFrozen(groundTruth)).toBe(true);
  expect(findObjectKeys(first).filter(key => forbidden.has(key))).toEqual([]);
});

test("never reads runtime image payload fields", () => {
  const gridAnalysis = createGridAnalysis();

  for (const field of ["binaryImage", "imageData", "canvas", "projections", "lineCandidates"]) {
    Object.defineProperty(gridAnalysis, field, {
      enumerable: true,
      get() {
        throw new Error(`${field} must not be read`);
      }
    });
  }

  const datasetReport = createDatasetReport({
    items: [createDatasetItem({ gridAnalyses: [gridAnalysis] })]
  });

  expect(() => createShadowGridValidationReport({
    datasetReport,
    groundTruth: createGroundTruth([createAnnotation()])
  })).not.toThrow();
});

test("rejects mismatched dataset identities", () => {
  expect(() => createShadowGridValidationReport({
    datasetReport: createDatasetReport(),
    groundTruth: createGridGroundTruth({
      datasetId: "other-dataset",
      annotations: []
    })
  })).toThrow("datasetId must match exactly");
});

function createReport({
  annotation = createAnnotation(),
  gridAnalysis = createGridAnalysis(),
  providers = null
} = {}) {
  return createShadowGridValidationReport({
    datasetReport: createDatasetReport({
      items: [createDatasetItem({
        providers: providers ?? [createProvider({ gridAnalyses: [gridAnalysis] })]
      })]
    }),
    groundTruth: createGroundTruth([annotation])
  });
}

function createGroundTruth(annotations) {
  return createGridGroundTruth({
    datasetId: "dataset",
    annotations
  });
}

function createAnnotation({
  itemId = "item-001",
  filename = "one.pdf",
  horizontal = [10, 20, 30],
  vertical = [5, 15, 25]
} = {}) {
  return {
    itemId,
    filename,
    document: { width: 100, height: 120 },
    gridBounds: {
      top: horizontal[0],
      left: vertical[0],
      width: vertical[vertical.length - 1] - vertical[0],
      height: horizontal[horizontal.length - 1] - horizontal[0]
    },
    horizontalLinePositions: horizontal,
    verticalLinePositions: vertical,
    rows: horizontal.length - 1,
    cols: vertical.length - 1,
    annotation: {
      status: "human-confirmed",
      method: "visual-line-handles",
      interpolationUsedForDraft: true
    }
  };
}

function createDatasetReport({ items = [createDatasetItem()] } = {}) {
  return {
    type: "digitization-dataset-report",
    version: 1,
    datasetRun: {
      type: "digitization-dataset-run",
      version: 1,
      datasetId: "dataset",
      status: "completed",
      inventory: {
        totalItemCount: items.length,
        completedItemCount: items.length,
        failedItemCount: 0
      }
    },
    items
  };
}

function createDatasetItem({
  id = "item-001",
  filename = "one.pdf",
  providers = [createProvider()],
  gridAnalyses
} = {}) {
  const resolvedProviders = gridAnalyses
    ? [createProvider({ gridAnalyses })]
    : providers;

  return {
    id,
    index: 0,
    metadata: { filename },
    status: "completed",
    preparation: { status: "completed" },
    production: { status: "completed", result: { gridDetection: {} } },
    comparison: {
      status: "completed",
      result: {
        benchmark: {
          experiments: [
            {
              id: "shadow-grid-analysis-diagnostics",
              description: "Shadow GridAnalysis",
              durationMs: 1,
              success: true,
              diagnostics: {
                type: "shadow-grid-analysis-diagnostics",
                version: 1,
                status: "complete",
                providers: resolvedProviders
              }
            }
          ]
        }
      }
    },
    observationReport: { status: "completed", result: {} }
  };
}

function createProvider({
  id = "horizontal-outer-span",
  status = "available",
  reason = null,
  gridAnalyses = [createGridAnalysis()]
} = {}) {
  return {
    id,
    description: `Provider ${id}`,
    status,
    regionCount: gridAnalyses.length,
    reason,
    gridAnalyses
  };
}

function createGridAnalysis({
  regionId = "region-001",
  regionBounds = { top: 0, left: 0, width: 100, height: 120 },
  horizontal = [10, 20, 30],
  vertical = [5, 15, 25],
  geometry = {
    status: "available",
    rows: 2,
    cols: 2,
    bounds: { top: 10, left: 5, width: 20, height: 20 }
  },
  rejectionReasons = [],
  status = "completed",
  error = null
} = {}) {
  return {
    providerId: "horizontal-outer-span",
    regionId,
    regionBounds,
    regionDimensions: {
      width: regionBounds.width,
      height: regionBounds.height
    },
    status,
    gridAnalysisStatus: status === "failed" ? "failed" : "measured",
    durationMs: 1,
    candidateCounts: {
      horizontal: horizontal.length,
      vertical: vertical.length
    },
    candidatePositions: { horizontal, vertical },
    spacingDiagnostics: [],
    geometry,
    rejectionReasons,
    error
  };
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
