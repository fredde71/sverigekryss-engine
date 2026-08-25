import { createGridGroundTruth } from "./gridGroundTruth";
import {
  createGridLatticeGeometryDiagnostics
} from "./gridLatticeGeometryDiagnostics";

test("reports exact horizontal, vertical and complete grid lattice observations", () => {
  const report = createGridLatticeGeometryDiagnostics(createInputs());
  const lattice = readLattice(report);

  expect(lattice.horizontalLattice.observedLinePositions).toEqual([100, 110, 120]);
  expect(lattice.horizontalLattice.lineCount).toBe(3);
  expect(lattice.horizontalLattice.adjacentSpacings).toEqual([
    {
      fromLineIndex: 0,
      toLineIndex: 1,
      fromPosition: 100,
      toPosition: 110,
      spacing: 10
    },
    {
      fromLineIndex: 1,
      toLineIndex: 2,
      fromPosition: 110,
      toPosition: 120,
      spacing: 10
    }
  ]);
  expect(lattice.horizontalLattice.spacingStatistics).toEqual({
    status: "observed",
    count: 2,
    minimum: 10,
    maximum: 10,
    mean: 10,
    median: 10,
    range: 0,
    allEqual: true,
    reason: null
  });
  expect(lattice.verticalLattice.observedLinePositions).toEqual([50, 65, 80]);
  expect(lattice.verticalLattice.spacingStatistics.allEqual).toBe(true);
  expect(lattice.gridLattice).toMatchObject({
    status: "compared",
    rowCount: { observed: 2, groundTruth: 2, delta: 0, exact: true },
    columnCount: { observed: 2, groundTruth: 2, delta: 0, exact: true },
    latticeCompleteness: {
      status: "compared",
      complete: true,
      horizontalComplete: true,
      verticalComplete: true
    },
    spacingConsistency: {
      horizontalAdjacentSpacingsEqual: true,
      verticalAdjacentSpacingsEqual: true,
      bothAxesInternallyConsistent: true,
      horizontalSpacingsMatchGroundTruth: true,
      verticalSpacingsMatchGroundTruth: true
    }
  });
  expect(lattice.gridLattice.edgeConsistency.top).toMatchObject({
    observed: 100,
    groundTruth: 100,
    delta: 0,
    absoluteDelta: 0,
    exact: true
  });
});

test("reports missing and extra observed lines without interpolation or snapping", () => {
  const report = createGridLatticeGeometryDiagnostics(createInputs({
    regionBounds: { top: 0, left: 0, width: 100, height: 100 },
    horizontal: [10, 21, 30, 40],
    vertical: [5, 15, 25],
    annotation: createAnnotation({
      horizontal: [10, 20, 30],
      vertical: [5, 15, 25]
    })
  }));
  const lattice = readLattice(report);

  expect(lattice.horizontalLattice.spacingStatistics).toMatchObject({
    count: 3,
    minimum: 9,
    maximum: 11,
    mean: 10,
    median: 10,
    range: 2,
    allEqual: false
  });
  expect(lattice.horizontalLattice.relationToGroundTruth).toMatchObject({
    exactLinePositions: false,
    lineCountDelta: 1,
    missingObservedLines: [{ expectedIndex: 1, position: 20 }],
    extraObservedLines: [
      { observedIndex: 1, position: 21 },
      { observedIndex: 3, position: 40 }
    ]
  });
  expect(lattice.gridLattice.rowCount).toMatchObject({
    observed: 3,
    groundTruth: 2,
    delta: 1,
    exact: false
  });
  expect(lattice.gridLattice.latticeCompleteness).toEqual({
    status: "compared",
    complete: false,
    horizontalComplete: false,
    verticalComplete: true
  });
  expect(lattice.gridLattice.missingObservedLines.horizontal).toEqual([
    { expectedIndex: 1, position: 20 }
  ]);
  expect(lattice.gridLattice.extraObservedLines.horizontal).toHaveLength(2);
  expect(lattice.gridLattice.edgeConsistency.bottom).toMatchObject({
    observed: 40,
    groundTruth: 30,
    delta: 10,
    exact: false
  });
  expect(report.observationPolicy.interpolation).toBe("none");
  expect(report.observationPolicy.snapping).toBe("none");
});

test("preserves half-pixel spacing statistics and exact Ground Truth relations", () => {
  const report = createGridLatticeGeometryDiagnostics(createInputs({
    regionBounds: { top: 0, left: 0, width: 100, height: 100 },
    horizontal: [10, 20.5, 30],
    vertical: [5, 15, 25],
    annotation: createAnnotation({
      horizontal: [10, 20, 30],
      vertical: [5, 15, 25]
    })
  }));
  const horizontal = readLattice(report).horizontalLattice;

  expect(horizontal.adjacentSpacings.map(entry => entry.spacing)).toEqual([
    10.5,
    9.5
  ]);
  expect(horizontal.spacingStatistics).toMatchObject({
    minimum: 9.5,
    maximum: 10.5,
    mean: 10,
    median: 10,
    range: 1,
    allEqual: false
  });
  expect(horizontal.relationToGroundTruth.nearestObservedByGroundTruth[1])
    .toMatchObject({ observedPosition: 20.5, delta: 0.5 });
});

test("uses normalized parent coordinates and remains available without shadow geometry", () => {
  const inputs = createInputs({ geometryStatus: "unavailable" });
  const lattice = readLattice(
    createGridLatticeGeometryDiagnostics(inputs)
  );

  expect(lattice.coordinateSpace).toBe("rendered-binary-image-pixels");
  expect(lattice.horizontalLattice.observedLinePositions).toEqual([100, 110, 120]);
  expect(lattice.verticalLattice.observedLinePositions).toEqual([50, 65, 80]);
  expect(lattice.sourceGeometry).toMatchObject({
    status: "unavailable",
    rows: null,
    cols: null,
    bounds: null
  });
  expect(lattice.gridLattice.status).toBe("compared");
});

test("preserves dataset, provider and region ordering", () => {
  const itemA = createDatasetItem({
    id: "item-a",
    filename: "a.pdf",
    providers: [
      createProvider("provider-a", [
        createGridAnalysis({ regionId: "region-a" }),
        createGridAnalysis({ regionId: "region-b" })
      ]),
      createProvider("provider-b", [
        createGridAnalysis({ regionId: "region-c" })
      ])
    ]
  });
  const itemB = createDatasetItem({ id: "item-b", filename: "b.pdf" });
  const report = createGridLatticeGeometryDiagnostics({
    datasetReport: createDatasetReport([itemA, itemB]),
    groundTruth: createGroundTruth([
      createAnnotation({ itemId: "item-a", filename: "a.pdf" }),
      createAnnotation({ itemId: "item-b", filename: "b.pdf" })
    ])
  });

  expect(report.items.map(item => item.itemId)).toEqual(["item-a", "item-b"]);
  expect(report.items[0].lattices.map(lattice => [
    lattice.providerId,
    lattice.regionId
  ])).toEqual([
    ["provider-a", "region-a"],
    ["provider-a", "region-b"],
    ["provider-b", "region-c"]
  ]);
});

test("represents missing Ground Truth and failed shadow observations explicitly", () => {
  const missing = createDatasetItem({ id: "missing", filename: "missing.pdf" });
  const failed = createDatasetItem({
    id: "failed",
    filename: "failed.pdf",
    providers: [createProvider("provider-a", [{
      regionId: "failed-region",
      status: "failed",
      error: { name: "Error", message: "region failed" }
    }])]
  });
  const report = createGridLatticeGeometryDiagnostics({
    datasetReport: createDatasetReport([missing, failed]),
    groundTruth: createGroundTruth([
      createAnnotation({ itemId: "failed", filename: "failed.pdf" })
    ])
  });

  expect(report.items[0]).toMatchObject({
    status: "unavailable",
    reasons: ["ground-truth-annotation-unavailable"],
    lattices: []
  });
  expect(report.items[1].lattices[0]).toMatchObject({
    status: "unavailable",
    reason: "region failed"
  });
});

test("is deterministic, immutable, avoids runtime images and decision fields", () => {
  const inputs = createInputs();
  const gridAnalysis = readGridAnalysis(inputs.datasetReport.items[0]);

  Object.defineProperty(gridAnalysis, "binaryImage", {
    enumerable: true,
    get() {
      throw new Error("runtime BinaryImage must not be accessed");
    }
  });
  const first = createGridLatticeGeometryDiagnostics(inputs);
  const second = createGridLatticeGeometryDiagnostics(inputs);

  expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.items[0].lattices[0])).toBe(true);
  expect(JSON.stringify(first)).not.toMatch(
    /"(score|confidence|rank|ranking|recommendation|selected|preferred|winner)"\s*:/i
  );

  const frozenInputs = createInputs();
  deepFreeze(frozenInputs);
  expect(() => createGridLatticeGeometryDiagnostics(frozenInputs)).not.toThrow();
});

test("validates existing dataset and Ground Truth contracts", () => {
  expect(() => createGridLatticeGeometryDiagnostics()).toThrow(
    "Version 1 digitization dataset report is required"
  );
  expect(() => createGridLatticeGeometryDiagnostics({
    datasetReport: createDatasetReport([]),
    groundTruth: createGroundTruth([], "other-dataset")
  })).toThrow("datasetId must match exactly");
});

function createInputs({
  regionBounds = { top: 100, left: 50, width: 100, height: 80 },
  horizontal = [0, 10, 20],
  vertical = [0, 15, 30],
  geometryStatus = "available",
  annotation = createAnnotation()
} = {}) {
  return {
    datasetReport: createDatasetReport([
      createDatasetItem({
        providers: [createProvider("provider-a", [createGridAnalysis({
          regionBounds,
          horizontal,
          vertical,
          geometryStatus
        })])]
      })
    ]),
    groundTruth: createGroundTruth([annotation])
  };
}

function createDatasetReport(items) {
  return {
    type: "digitization-dataset-report",
    version: 1,
    datasetRun: { datasetId: "tt-dataset" },
    items
  };
}

function createDatasetItem({
  id = "item-a",
  filename = "a.pdf",
  providers = [createProvider("provider-a", [createGridAnalysis()])]
} = {}) {
  return {
    id,
    metadata: { filename },
    comparison: {
      status: "completed",
      result: {
        benchmark: {
          experiments: [{
            id: "shadow-grid-analysis-diagnostics",
            description: "fixture",
            durationMs: 1,
            success: true,
            diagnostics: {
              type: "shadow-grid-analysis-diagnostics",
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

function createProvider(id, gridAnalyses) {
  return {
    id,
    status: "available",
    reason: null,
    gridAnalyses
  };
}

function createGridAnalysis({
  regionId = "region-a",
  regionBounds = { top: 100, left: 50, width: 100, height: 80 },
  horizontal = [0, 10, 20],
  vertical = [0, 15, 30],
  geometryStatus = "available"
} = {}) {
  return {
    regionId,
    regionBounds,
    status: "completed",
    candidatePositions: { horizontal, vertical },
    geometry: geometryStatus === "available"
      ? {
        status: "available",
        rows: horizontal.length - 1,
        cols: vertical.length - 1,
        bounds: {
          top: horizontal[0],
          left: vertical[0],
          width: vertical[vertical.length - 1] - vertical[0],
          height: horizontal[horizontal.length - 1] - horizontal[0]
        }
      }
      : {
        status: "unavailable",
        rows: null,
        cols: null,
        bounds: null
      },
    rejectionReasons: geometryStatus === "available"
      ? []
      : [{ code: "geometry-unavailable" }]
  };
}

function createAnnotation({
  itemId = "item-a",
  filename = "a.pdf",
  horizontal = [100, 110, 120],
  vertical = [50, 65, 80]
} = {}) {
  return {
    itemId,
    filename,
    document: { width: 200, height: 200 },
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
    annotation: { status: "human-confirmed" }
  };
}

function createGroundTruth(annotations, datasetId = "tt-dataset") {
  return createGridGroundTruth({ datasetId, annotations });
}

function readLattice(report) {
  return report.items[0].lattices[0];
}

function readGridAnalysis(item) {
  return item.comparison.result.benchmark.experiments[0]
    .diagnostics.providers[0].gridAnalyses[0];
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
