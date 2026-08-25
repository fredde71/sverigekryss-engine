import { createGridGroundTruth } from "./gridGroundTruth";
import {
  createGridLatticePeriodicityDiagnostics
} from "./gridLatticePeriodicityDiagnostics";

test("reports deterministic periodicity candidates and exact spacing residuals", () => {
  const report = createGridLatticePeriodicityDiagnostics(createInputs());
  const horizontal = readLattice(report).horizontal;

  expect(horizontal.observedAdjacentSpacings.map(entry => entry.spacing)).toEqual([
    10,
    20
  ]);
  expect(horizontal.candidateFundamentalSpacings.map(candidate => (
    candidate.fundamentalSpacing
  ))).toEqual([10, 5, 20]);

  const tenPixelCandidate = horizontal.candidateFundamentalSpacings[0];
  expect(tenPixelCandidate.spacingRelations).toEqual([
    expect.objectContaining({
      observedSpacing: 10,
      nearestIntegerMultiple: 1,
      residual: 0,
      explained: true
    }),
    expect.objectContaining({
      observedSpacing: 20,
      nearestIntegerMultiple: 2,
      residual: 0,
      explained: true
    })
  ]);
  expect(tenPixelCandidate.explainedSpacingCount).toBe(2);
  expect(tenPixelCandidate.unexplainedSpacingCount).toBe(0);
  expect(tenPixelCandidate.residualStatistics).toEqual({
    status: "available",
    count: 2,
    minimum: 0,
    maximum: 0,
    maximumAbsolute: 0,
    averageAbsolute: 0,
    medianAbsolute: 0,
    rms: 0
  });
  expect(tenPixelCandidate.anchorConsistency).toEqual({
    status: "observed",
    anchorPosition: 100,
    consistent: true,
    relations: [
      expect.objectContaining({ observedPosition: 100, residual: 0 }),
      expect.objectContaining({ observedPosition: 110, residual: 0 }),
      expect.objectContaining({ observedPosition: 130, residual: 0 })
    ]
  });
});

test("keeps horizontal and vertical candidate spaces independent", () => {
  const report = createGridLatticePeriodicityDiagnostics(createInputs());
  const lattice = readLattice(report);

  expect(lattice.horizontal.candidateFundamentalSpacings[0].fundamentalSpacing)
    .toBe(10);
  expect(lattice.vertical.candidateFundamentalSpacings[0].fundamentalSpacing)
    .toBe(15);
  expect(report.observationPolicy.axesEvaluatedIndependently).toBe(true);
  expect(report).not.toHaveProperty("sharedSpacing");
});

test("attaches Ground Truth validation after preserving observed candidates", () => {
  const report = createGridLatticePeriodicityDiagnostics(createInputs());
  const horizontal = readLattice(report).horizontal;
  const validation = horizontal.groundTruthValidation;

  expect(validation.groundTruthAdjacentSpacings.map(entry => entry.spacing)).toEqual([
    10,
    10,
    10
  ]);
  expect(validation.candidateRelations[0]).toEqual(expect.objectContaining({
    candidateIndex: 0,
    fundamentalSpacing: 10,
    compatibleWithConfirmedLattice: true
  }));
  expect(validation.candidateRelations[0].groundTruthSpacingRelations.every(
    relation => relation.residual === 0
  )).toBe(true);

  const changedGroundTruth = createInputs({
    groundTruthHorizontal: [100, 112, 124, 136]
  });
  const changed = createGridLatticePeriodicityDiagnostics(changedGroundTruth);
  const changedHorizontal = readLattice(changed).horizontal;

  expect(changedHorizontal.observedLinePositions).toEqual(
    horizontal.observedLinePositions
  );
  expect(changedHorizontal.observedAdjacentSpacings).toEqual(
    horizontal.observedAdjacentSpacings
  );
  expect(changedHorizontal.candidateFundamentalSpacings.map(stripValidationFree))
    .toEqual(horizontal.candidateFundamentalSpacings.map(stripValidationFree));
  expect(changedHorizontal.groundTruthValidation.candidateRelations[0]
    .compatibleWithConfirmedLattice).toBe(false);
});

test("reports unexplained spacings and signed residuals factually", () => {
  const report = createGridLatticePeriodicityDiagnostics(createInputs({
    observedHorizontal: [0, 10, 25, 36],
    regionTop: 100,
    groundTruthHorizontal: [100, 110, 120, 130]
  }));
  const candidate = readLattice(report).horizontal
    .candidateFundamentalSpacings[0];

  expect(candidate.fundamentalSpacing).toBe(10);
  expect(candidate.spacingRelations.map(relation => relation.residual)).toEqual([
    0,
    5,
    1
  ]);
  expect(candidate.explainedSpacingCount).toBe(1);
  expect(candidate.unexplainedSpacingCount).toBe(2);
  expect(candidate.residualStatistics.maximumAbsolute).toBe(5);
  expect(candidate.anchorConsistency.consistent).toBe(false);
});

test("preserves item, provider, region and axis order", () => {
  const inputs = createInputs();
  const secondProvider = createProvider("provider-b", [
    createGridAnalysis({ regionId: "region-b" }),
    createGridAnalysis({ regionId: "region-c" })
  ]);
  inputs.datasetReport.items[0].comparison.result.benchmark.experiments[0]
    .diagnostics.providers.push(secondProvider);

  const report = createGridLatticePeriodicityDiagnostics(inputs);

  expect(report.items.map(item => item.itemId)).toEqual(["item-a"]);
  expect(report.items[0].lattices.map(lattice => [
    lattice.providerId,
    lattice.regionId
  ])).toEqual([
    ["provider-a", "region-a"],
    ["provider-b", "region-b"],
    ["provider-b", "region-c"]
  ]);
  expect(Object.keys(report.items[0].lattices[0]).slice(-2)).toEqual([
    "horizontal",
    "vertical"
  ]);
});

test("is deterministic, immutable and contains no evaluative contract fields", () => {
  const inputs = deepFreeze(createInputs());
  const before = JSON.stringify(inputs);
  const first = createGridLatticePeriodicityDiagnostics(inputs);
  const second = createGridLatticePeriodicityDiagnostics(inputs);

  expect(second).toEqual(first);
  expect(JSON.stringify(inputs)).toBe(before);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(readLattice(first).horizontal
    .candidateFundamentalSpacings[0].spacingRelations)).toBe(true);
  expectForbiddenFieldsAbsent(first);
});

function createInputs({
  observedHorizontal = [0, 10, 30],
  observedVertical = [0, 15, 30],
  groundTruthHorizontal = [100, 110, 120, 130],
  groundTruthVertical = [50, 65, 80],
  regionTop = 100,
  regionLeft = 50
} = {}) {
  const annotation = createAnnotation({
    horizontal: groundTruthHorizontal,
    vertical: groundTruthVertical
  });

  return {
    datasetReport: {
      type: "digitization-dataset-report",
      version: 1,
      datasetRun: { datasetId: "tt-dataset" },
      items: [createDatasetItem({
        providers: [createProvider("provider-a", [createGridAnalysis({
          regionBounds: { top: regionTop, left: regionLeft, width: 100, height: 80 },
          horizontal: observedHorizontal,
          vertical: observedVertical
        })])]
      })]
    },
    groundTruth: createGridGroundTruth({
      datasetId: "tt-dataset",
      annotations: [annotation]
    })
  };
}

function createDatasetItem({ providers }) {
  return {
    id: "item-a",
    metadata: { filename: "a.pdf" },
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
  return { id, status: "available", reason: null, gridAnalyses };
}

function createGridAnalysis({
  regionId = "region-a",
  regionBounds = { top: 100, left: 50, width: 100, height: 80 },
  horizontal = [0, 10, 30],
  vertical = [0, 15, 30]
} = {}) {
  return {
    regionId,
    regionBounds,
    status: "completed",
    candidatePositions: { horizontal, vertical },
    geometry: {
      status: "available",
      rows: horizontal.length - 1,
      cols: vertical.length - 1,
      bounds: {
        top: horizontal[0],
        left: vertical[0],
        width: vertical[vertical.length - 1] - vertical[0],
        height: horizontal[horizontal.length - 1] - horizontal[0]
      }
    },
    rejectionReasons: []
  };
}

function createAnnotation({ horizontal, vertical }) {
  return {
    itemId: "item-a",
    filename: "a.pdf",
    document: { width: 300, height: 300 },
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

function readLattice(report) {
  return report.items[0].lattices[0];
}

function stripValidationFree(candidate) {
  return candidate;
}

function expectForbiddenFieldsAbsent(value) {
  const forbidden = new Set([
    "score",
    "confidence",
    "rank",
    "ranking",
    "recommendation",
    "selected",
    "selection",
    "preferred"
  ]);

  function visit(current) {
    if (!current || typeof current !== "object") {
      return;
    }

    Object.entries(current).forEach(([key, entry]) => {
      expect(forbidden.has(key)).toBe(false);
      visit(entry);
    });
  }

  visit(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
