import fs from "fs";
import path from "path";
import { createGridLatticeEvidence } from "./GridLatticeEvidence";
import {
  generateGridLatticeCandidates
} from "./GridLatticeCandidateGeneration";

test("generates one deterministic rectangular GridLatticeCandidate", () => {
  const evidence = createGridLatticeEvidence(createEvidenceInput());
  const result = generateGridLatticeCandidates({
    evidence,
    primitivePeriodEvidence: createPrimitivePeriodEvidence()
  });

  expect(result).toMatchObject({
    type: "grid-lattice-candidate-generation",
    version: 1,
    status: "available",
    evidenceId: "evidence-001",
    primitivePeriodEvidenceId: "primitive-period-evidence-001"
  });
  expect(result.candidates).toHaveLength(1);
  expect(result.candidates[0]).toMatchObject({
    type: "grid-lattice-candidate",
    status: "available",
    gridDimensions: { rows: 2, cols: 3 },
    axes: {
      horizontal: {
        origin: 10,
        period: 10,
        intervalCount: 2,
        lineCount: 3,
        boundsResidual: 0
      },
      vertical: {
        origin: 5,
        period: 10,
        intervalCount: 3,
        lineCount: 4,
        boundsResidual: 0
      }
    }
  });
});

test("derives non-square row and column counts from bounds and periods", () => {
  const input = createEvidenceInput();
  input.boundsObservation.bounds = { top: 4, left: 8, width: 49, height: 21 };
  const periods = createPrimitivePeriodEvidence();
  periods.axes.horizontal.candidates[0].period = 7;
  periods.axes.vertical.candidates[0].period = 7;

  const result = generateGridLatticeCandidates({
    evidence: createGridLatticeEvidence(input),
    primitivePeriodEvidence: periods
  });

  expect(result.candidates).toHaveLength(1);
  expect(result.candidates[0].gridDimensions).toEqual({ rows: 3, cols: 7 });
  expect(result.candidates[0].axes.horizontal.origin).toBe(4);
  expect(result.candidates[0].axes.vertical.origin).toBe(8);
});

test("preserves adjacent interval-count interpretations instead of choosing one", () => {
  const input = createEvidenceInput();
  input.boundsObservation.bounds.height = 25;

  const result = generateGridLatticeCandidates({
    evidence: createGridLatticeEvidence(input),
    primitivePeriodEvidence: createPrimitivePeriodEvidence()
  });

  expect(result.status).toBe("ambiguous");
  expect(result.axisCandidates.horizontal.map(candidate => ({
    intervalCount: candidate.intervalCount,
    boundsResidual: candidate.boundsResidual
  }))).toEqual([
    { intervalCount: 2, boundsResidual: -5 },
    { intervalCount: 3, boundsResidual: 5 }
  ]);
  expect(result.candidates.map(candidate => candidate.gridDimensions)).toEqual([
    { rows: 2, cols: 3 },
    { rows: 3, cols: 3 }
  ]);
});

test("combines horizontal and vertical candidates in deterministic rectangular order", () => {
  const periods = createPrimitivePeriodEvidence();
  periods.status = "ambiguous";
  periods.axes.horizontal = createPeriodAxis("horizontal", [10, 5]);
  periods.axes.vertical = createPeriodAxis("vertical", [10, 15]);

  const result = generateGridLatticeCandidates({
    evidence: createGridLatticeEvidence(createEvidenceInput()),
    primitivePeriodEvidence: periods
  });

  expect(result.status).toBe("ambiguous");
  expect(result.axisCandidates.horizontal.map(value => value.period)).toEqual([10, 5]);
  expect(result.axisCandidates.vertical.map(value => value.period)).toEqual([10, 15]);
  expect(result.candidates.map(candidate => [
    candidate.axes.horizontal.period,
    candidate.axes.horizontal.intervalCount,
    candidate.axes.vertical.period,
    candidate.axes.vertical.intervalCount
  ])).toEqual([
    [10, 2, 10, 3],
    [10, 2, 15, 2],
    [5, 4, 10, 3],
    [5, 4, 15, 2]
  ]);
});

test("preserves observed anchors, assignments, residuals and source provenance", () => {
  const input = createEvidenceInput();
  input.axes.horizontal.positions = [10.5, 19, 30];
  const periods = createPrimitivePeriodEvidence();

  const result = generateGridLatticeCandidates({
    evidence: createGridLatticeEvidence(input),
    primitivePeriodEvidence: periods
  });
  const horizontal = result.candidates[0].axes.horizontal;

  expect(horizontal.assignments).toEqual([
    {
      anchorOrder: 0,
      observedPosition: 10.5,
      latticeIndex: 0,
      modeledPosition: 10,
      residual: 0.5,
      withinCandidateExtent: true
    },
    {
      anchorOrder: 1,
      observedPosition: 19,
      latticeIndex: 1,
      modeledPosition: 20,
      residual: -1,
      withinCandidateExtent: true
    },
    {
      anchorOrder: 2,
      observedPosition: 30,
      latticeIndex: 2,
      modeledPosition: 30,
      residual: 0,
      withinCandidateExtent: true
    }
  ]);
  expect(result.candidates[0].provenance).toEqual(expect.objectContaining({
    gridLatticeEvidence: { source: "synthetic-grid-evidence" },
    primitivePeriodEvidence: { source: "synthetic-period-evidence" },
    horizontalAxisCandidate: expect.objectContaining({
      primitivePeriodCandidateId: "horizontal-period-001"
    }),
    verticalAxisCandidate: expect.objectContaining({
      primitivePeriodCandidateId: "vertical-period-001"
    })
  }));
});

test.each([
  ["unavailable GridLatticeEvidence", ({ input }) => {
    input.status = "unavailable";
    input.reasons = ["not-observed"];
  }, "grid-lattice-evidence-unavailable"],
  ["partial outer bounds", ({ input }) => {
    input.boundsObservation.status = "partial";
  }, "outer-bounds-unavailable"],
  ["unavailable primitive periods", ({ periods }) => {
    periods.status = "unavailable";
    periods.axes.horizontal = createUnavailablePeriodAxis("horizontal");
    periods.axes.vertical = createUnavailablePeriodAxis("vertical");
  }, "primitive-period-evidence-unavailable"],
  ["missing horizontal anchors", ({ input }) => {
    input.axes.horizontal.status = "unavailable";
    input.axes.horizontal.positions = [];
  }, "horizontal-axis-candidates-unavailable"],
  ["missing vertical periods", ({ periods }) => {
    periods.status = "partial";
    periods.axes.vertical = createUnavailablePeriodAxis("vertical");
  }, "vertical-axis-candidates-unavailable"]
])("returns unavailable without inventing candidates for %s", (
  _label,
  mutate,
  expectedReason
) => {
  const input = createEvidenceInput();
  const periods = createPrimitivePeriodEvidence();
  mutate({ input, periods });

  const result = generateGridLatticeCandidates({
    evidence: createGridLatticeEvidence(input),
    primitivePeriodEvidence: periods
  });

  expect(result.status).toBe("unavailable");
  expect(result.candidates).toEqual([]);
  expect(result.reasons).toContain(expectedReason);
});

test("is deterministic, input-immutable and returns deeply frozen artifacts", () => {
  const evidence = createGridLatticeEvidence(createEvidenceInput());
  const periods = deepFreeze(createPrimitivePeriodEvidence());
  const before = JSON.stringify({ evidence, periods });

  const first = generateGridLatticeCandidates({
    evidence,
    primitivePeriodEvidence: periods
  });
  const second = generateGridLatticeCandidates({
    evidence,
    primitivePeriodEvidence: periods
  });

  expect(JSON.stringify({ evidence, periods })).toBe(before);
  expect(second).toEqual(first);
  expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.axisCandidates.horizontal[0])).toBe(true);
  expect(Object.isFrozen(first.candidates[0].gridDimensions)).toBe(true);
  expect(Object.isFrozen(first.candidates[0].provenance)).toBe(true);
});

test.each([
  ["zero period", periods => {
    periods.axes.horizontal.candidates[0].period = 0;
  }],
  ["duplicate period IDs", periods => {
    periods.axes.horizontal.status = "ambiguous";
    periods.axes.horizontal.candidates.push({
      ...periods.axes.horizontal.candidates[0]
    });
  }],
  ["available axis with multiple periods", periods => {
    periods.axes.horizontal.candidates.push(createPeriodCandidate("horizontal", 2, 5));
  }],
  ["ambiguous axis with one period", periods => {
    periods.axes.horizontal.status = "ambiguous";
  }],
  ["unavailable axis with a period", periods => {
    periods.axes.horizontal.status = "unavailable";
  }],
  ["forbidden score", periods => {
    periods.axes.horizontal.candidates[0].provenance.score = 1;
  }],
  ["forbidden selection", periods => {
    periods.axes.horizontal.candidates[0].provenance.selectedCandidate = true;
  }]
])("rejects invalid primitive-period evidence: %s", (_label, mutate) => {
  const periods = createPrimitivePeriodEvidence();
  mutate(periods);

  expect(() => generateGridLatticeCandidates({
    evidence: createGridLatticeEvidence(createEvidenceInput()),
    primitivePeriodEvidence: periods
  })).toThrow();
});

test("contains no Ground Truth, production, scoring, ranking or selection dependency", () => {
  const result = generateGridLatticeCandidates({
    evidence: createGridLatticeEvidence(createEvidenceInput()),
    primitivePeriodEvidence: createPrimitivePeriodEvidence()
  });
  const forbiddenKeys = [
    "score",
    "confidence",
    "rank",
    "ranking",
    "recommendation",
    "selection",
    "selectedCandidate",
    "preferredCandidate",
    "groundTruth"
  ];
  expect(collectKeys(result)).not.toEqual(expect.arrayContaining(forbiddenKeys));

  const source = fs.readFileSync(
    path.join(
      path.dirname(require.resolve("./GridLatticeCandidateGeneration")),
      "GridLatticeCandidateGeneration.js"
    ),
    "utf8"
  );
  expect(source).not.toMatch(/GroundTruth|detectGrid|GridAnalysis|experiments\//);
});

function createEvidenceInput() {
  return {
    id: "evidence-001",
    status: "available",
    coordinateSystem: {
      space: "analysis-region-local",
      unit: "pixel",
      origin: "top-left",
      xDirection: "right",
      yDirection: "down",
      linePosition: "visual-line-center"
    },
    axes: {
      horizontal: createEvidenceAxis("horizontal", [10, 20, 30]),
      vertical: createEvidenceAxis("vertical", [5, 15, 25, 35])
    },
    boundsObservation: {
      status: "available",
      semantics: "outer-line-center-envelope",
      coordinateSpace: "analysis-region-local",
      bounds: { top: 10, left: 5, width: 30, height: 20 },
      provenance: { source: "confirmed-outer-bounds-observation" },
      evidenceReferences: ["bounds:001"]
    },
    provenance: { source: "synthetic-grid-evidence" },
    evidenceReferences: ["anchors:horizontal", "anchors:vertical"],
    diagnostics: [],
    reasons: []
  };
}

function createEvidenceAxis(axis, positions) {
  return {
    status: "available",
    axis,
    positions,
    spacingObservations: [],
    evidenceReferences: [`anchors:${axis}`],
    diagnostics: []
  };
}

function createPrimitivePeriodEvidence() {
  return {
    id: "primitive-period-evidence-001",
    status: "available",
    axes: {
      horizontal: createPeriodAxis("horizontal", [10]),
      vertical: createPeriodAxis("vertical", [10])
    },
    evidenceReferences: ["periodicity:001"],
    provenance: { source: "synthetic-period-evidence" }
  };
}

function createPeriodAxis(axis, periods) {
  return {
    axis,
    status: periods.length === 1 ? "available" : "ambiguous",
    candidates: periods.map((period, index) => (
      createPeriodCandidate(axis, index + 1, period)
    )),
    reasons: []
  };
}

function createPeriodCandidate(axis, index, period) {
  return {
    id: `${axis}-period-${String(index).padStart(3, "0")}`,
    period,
    evidenceReferences: [`periodicity:${axis}:${index}`],
    provenance: { source: "primitive-period-observation", sourceOrder: index - 1 }
  };
}

function createUnavailablePeriodAxis(axis) {
  return {
    axis,
    status: "unavailable",
    candidates: [],
    reasons: ["primitive-period-unavailable"]
  };
}

function collectKeys(value, keys = []) {
  if (Array.isArray(value)) {
    value.forEach(entry => collectKeys(entry, keys));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, entry]) => {
      keys.push(key);
      collectKeys(entry, keys);
    });
  }
  return keys;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
