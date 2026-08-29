import fs from "fs";
import path from "path";
import { createGridLatticeEvidence } from "./GridLatticeEvidence";
import {
  generateGridLatticeCandidates
} from "./GridLatticeCandidateGeneration";

test("represents one deterministic rectangular candidate by axis references", () => {
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
  expect(result.candidateSpace).toEqual({
    representation: "cartesian-product-by-reference",
    combinationOrder: "horizontal-major-vertical-minor",
    horizontalAxisCandidateIds: ["horizontal-period-001-intervals-2"],
    verticalAxisCandidateIds: ["vertical-period-001-intervals-3"],
    exactCandidateCount: 1,
    eagerlyMaterializedCandidateCount: 0
  });
  expect(result.boundsSpace).toMatchObject({
    representation: "factored-axis-bounds",
    source: "grid-lattice-evidence-bounds-observation",
    status: "available",
    combinationOrder: "horizontal-major-vertical-minor",
    horizontalAxisBoundsIds: ["horizontal-bounds-001"],
    verticalAxisBoundsIds: ["vertical-bounds-001"],
    exactBoundsCombinationCount: 1,
    eagerlyMaterializedRectangularBoundsCount: 0,
    provenance: { source: "confirmed-outer-bounds-observation" },
    reasons: []
  });
  expect(result.boundsSpace.axisBounds).toMatchObject({
    horizontal: [{ id: "horizontal-bounds-001", start: 10, end: 30 }],
    vertical: [{ id: "vertical-bounds-001", start: 5, end: 35 }]
  });
  expect(Object.getOwnPropertyDescriptor(result, "candidates").get)
    .toEqual(expect.any(Function));
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
  expect(result.candidateSpace).toEqual({
    representation: "cartesian-product-by-reference",
    combinationOrder: "horizontal-major-vertical-minor",
    horizontalAxisCandidateIds: result.axisCandidates.horizontal.map(
      value => value.id
    ),
    verticalAxisCandidateIds: result.axisCandidates.vertical.map(
      value => value.id
    ),
    exactCandidateCount: 4,
    eagerlyMaterializedCandidateCount: 0
  });
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

test("preserves realistic Cartesian cardinality without storing reference pairs", () => {
  const periods = createPrimitivePeriodEvidence();
  periods.status = "ambiguous";
  periods.axes.horizontal = createPeriodAxis("horizontal", [10, 5, 4, 2]);
  periods.axes.vertical = createPeriodAxis("vertical", [10, 6, 5, 3]);

  const result = generateGridLatticeCandidates({
    evidence: createGridLatticeEvidence(createEvidenceInput()),
    primitivePeriodEvidence: periods
  });

  expect(result.axisCandidates.horizontal).toHaveLength(4);
  expect(result.axisCandidates.vertical).toHaveLength(4);
  expect(result.candidateSpace.exactCandidateCount).toBe(16);
  expect(result.candidateSpace.eagerlyMaterializedCandidateCount).toBe(0);
  expect(result.candidateSpace).not.toHaveProperty("candidatePairs");
  expect(result.candidateSpace).not.toHaveProperty("rectangularCandidates");
});

test("generates axis candidates directly from ambiguous factored bounds", () => {
  const input = createEvidenceInput();
  input.boundsObservation = createUnavailableBoundsObservation();
  const factoredBounds = createFactoredBounds({
    horizontal: [[10, 30], [11, 31]],
    vertical: [[5, 35], [6, 36], [7, 37]]
  });

  const result = generateGridLatticeCandidates({
    evidence: createGridLatticeEvidence(input),
    primitivePeriodEvidence: createPrimitivePeriodEvidence(),
    factoredBounds
  });

  expect(result.status).toBe("ambiguous");
  expect(result.boundsSpace).toMatchObject({
    status: "ambiguous",
    horizontalAxisBoundsIds: ["horizontal-bounds-001", "horizontal-bounds-002"],
    verticalAxisBoundsIds: [
      "vertical-bounds-001",
      "vertical-bounds-002",
      "vertical-bounds-003"
    ],
    exactBoundsCombinationCount: 6,
    eagerlyMaterializedRectangularBoundsCount: 0
  });
  expect(result.boundsSpace.axisBounds.horizontal[1]).toEqual(
    factoredBounds.axisBounds.horizontal[1]
  );
  expect(result.boundsSpace.axisBounds.horizontal[1]).toMatchObject({
    startAlternative: {
      interpretationId: "horizontal-start-interpretation-002",
      position: 11
    },
    endAlternative: {
      interpretationId: "horizontal-end-interpretation-002",
      position: 31
    },
    provenance: {
      source: "synthetic-factored-bounds",
      sourceOrder: 1
    }
  });
  expect(result.axisCandidates.horizontal.map(value => [
    value.id,
    value.axisBoundsId,
    value.origin,
    value.intervalCount
  ])).toEqual([
    [
      "horizontal-bounds-001-period-001-intervals-2",
      "horizontal-bounds-001",
      10,
      2
    ],
    [
      "horizontal-bounds-002-period-001-intervals-2",
      "horizontal-bounds-002",
      11,
      2
    ]
  ]);
  expect(result.axisCandidates.vertical.map(value => value.origin)).toEqual([
    5, 6, 7
  ]);
  expect(result.candidateSpace.exactCandidateCount).toBe(6);
  expect(result.candidateSpace.eagerlyMaterializedCandidateCount).toBe(0);
});

test("keeps each bounds interpretation paired only with same-axis evidence", () => {
  const input = createEvidenceInput();
  input.boundsObservation = createUnavailableBoundsObservation();
  input.axes.horizontal.positions = [10, 20, 30];
  input.axes.vertical.positions = [5, 15, 25, 35];
  const factoredBounds = createFactoredBounds({
    horizontal: [[10, 30], [12, 32]],
    vertical: [[5, 35], [8, 38]]
  });

  const result = generateGridLatticeCandidates({
    evidence: createGridLatticeEvidence(input),
    primitivePeriodEvidence: createPrimitivePeriodEvidence(),
    factoredBounds
  });

  expect(result.axisCandidates.horizontal[1]).toMatchObject({
    axisBoundsId: "horizontal-bounds-002",
    assignments: [
      { observedPosition: 10, modeledPosition: 12, residual: -2 },
      { observedPosition: 20, modeledPosition: 22, residual: -2 },
      { observedPosition: 30, modeledPosition: 32, residual: -2 }
    ],
    provenance: {
      axisBoundsOrder: 1,
      axisBounds: {
        source: "synthetic-factored-bounds",
        axis: "horizontal",
        sourceOrder: 1
      }
    }
  });
  expect(result.axisCandidates.vertical[1]).toMatchObject({
    axisBoundsId: "vertical-bounds-002",
    assignments: [
      { observedPosition: 5, modeledPosition: 8, residual: -3 },
      { observedPosition: 15, modeledPosition: 18, residual: -3 },
      { observedPosition: 25, modeledPosition: 28, residual: -3 },
      { observedPosition: 35, modeledPosition: 38, residual: -3 }
    ]
  });
});

test("preserves large factored bounds cardinality without rectangular bounds", () => {
  const input = createEvidenceInput();
  input.boundsObservation = createUnavailableBoundsObservation();
  const horizontal = Array.from(
    { length: 36 },
    (_value, index) => [10 + index, 30 + index]
  );
  const vertical = Array.from(
    { length: 36 },
    (_value, index) => [5 + index, 35 + index]
  );

  const result = generateGridLatticeCandidates({
    evidence: createGridLatticeEvidence(input),
    primitivePeriodEvidence: createPrimitivePeriodEvidence(),
    factoredBounds: createFactoredBounds({ horizontal, vertical })
  });

  expect(result.axisCandidates.horizontal).toHaveLength(36);
  expect(result.axisCandidates.vertical).toHaveLength(36);
  expect(result.boundsSpace.exactBoundsCombinationCount).toBe(1296);
  expect(result.boundsSpace.eagerlyMaterializedRectangularBoundsCount).toBe(0);
  expect(result.candidateSpace.exactCandidateCount).toBe(1296);
  expect(result.candidateSpace.eagerlyMaterializedCandidateCount).toBe(0);
  expect(result.boundsSpace).not.toHaveProperty("boundsCombinations");
});

test("rejects inconsistent factored bounds references", () => {
  const factoredBounds = createFactoredBounds({
    horizontal: [[10, 30], [11, 31]],
    vertical: [[5, 35]]
  });
  factoredBounds.rectangularCombinationSpace.horizontalAxisBoundsIds.reverse();

  expect(() => generateGridLatticeCandidates({
    evidence: createGridLatticeEvidence(createEvidenceInput()),
    primitivePeriodEvidence: createPrimitivePeriodEvidence(),
    factoredBounds
  })).toThrow("factoredBounds rectangular combination space is invalid");
});

test("keeps factored bounds deterministic, immutable and deeply frozen", () => {
  const input = createEvidenceInput();
  input.boundsObservation = createUnavailableBoundsObservation();
  const evidence = createGridLatticeEvidence(input);
  const periods = deepFreeze(createPrimitivePeriodEvidence());
  const factoredBounds = deepFreeze(createFactoredBounds({
    horizontal: [[10, 30], [11, 31]],
    vertical: [[5, 35], [6, 36]]
  }));
  const before = JSON.stringify({ evidence, periods, factoredBounds });

  const first = generateGridLatticeCandidates({
    evidence,
    primitivePeriodEvidence: periods,
    factoredBounds
  });
  const second = generateGridLatticeCandidates({
    evidence,
    primitivePeriodEvidence: periods,
    factoredBounds
  });

  expect(second).toEqual(first);
  expect(JSON.stringify({ evidence, periods, factoredBounds })).toBe(before);
  expect(Object.isFrozen(first.boundsSpace)).toBe(true);
  expect(Object.isFrozen(first.boundsSpace.axisBounds.horizontal[0])).toBe(true);
  expect(Object.isFrozen(first.axisCandidates.horizontal[0])).toBe(true);
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
  expect(Object.isFrozen(first.candidateSpace)).toBe(true);
  expect(Object.isFrozen(first.candidateSpace.horizontalAxisCandidateIds))
    .toBe(true);
  expect(Object.isFrozen(first.candidates[0].gridDimensions)).toBe(true);
  expect(Object.isFrozen(first.candidates[0].provenance)).toBe(true);
});

test("snapshots provenance before on-demand compatibility materialization", () => {
  const evidence = createGridLatticeEvidence(createEvidenceInput());
  const periods = createPrimitivePeriodEvidence();
  const result = generateGridLatticeCandidates({
    evidence,
    primitivePeriodEvidence: periods
  });

  periods.provenance.source = "changed-after-generation";
  periods.axes.horizontal.candidates[0].provenance.source = "changed-source";

  expect(result.candidates[0].provenance).toEqual(expect.objectContaining({
    primitivePeriodEvidence: { source: "synthetic-period-evidence" },
    horizontalAxisCandidate: expect.objectContaining({
      source: {
        source: "primitive-period-observation",
        sourceOrder: 0
      }
    })
  }));
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

function createUnavailableBoundsObservation() {
  return {
    status: "unavailable",
    semantics: "outer-line-center-envelope",
    coordinateSpace: "analysis-region-local",
    bounds: null,
    provenance: { source: "single-bounds-unavailable" },
    evidenceReferences: []
  };
}

function createFactoredBounds({ horizontal, vertical }) {
  const axisBounds = {
    horizontal: horizontal.map((bounds, index) => (
      createAxisBounds("horizontal", bounds, index)
    )),
    vertical: vertical.map((bounds, index) => (
      createAxisBounds("vertical", bounds, index)
    ))
  };
  const exactCombinationCount = horizontal.length * vertical.length;
  return {
    status: exactCombinationCount === 0
      ? "unavailable"
      : exactCombinationCount === 1
        ? "available"
        : "ambiguous",
    coordinateSystem: {
      space: "analysis-region-local",
      unit: "pixel",
      origin: "top-left",
      xDirection: "right",
      yDirection: "down",
      linePosition: "visual-line-center"
    },
    axisBounds,
    rectangularCombinationSpace: {
      representation: "cartesian-product-by-reference",
      combinationOrder: "horizontal-major-vertical-minor",
      horizontalAxisBoundsIds: axisBounds.horizontal.map(value => value.id),
      verticalAxisBoundsIds: axisBounds.vertical.map(value => value.id),
      exactCombinationCount,
      materializedCombinationCount: 0
    },
    provenance: { source: "synthetic-factored-bounds" },
    reasons: exactCombinationCount === 0 ? ["bounds-unavailable"] : []
  };
}

function createAxisBounds(axis, [start, end], index) {
  return {
    id: `${axis}-bounds-${String(index + 1).padStart(3, "0")}`,
    axis,
    start,
    end,
    startAlternative: {
      interpretationId:
        `${axis}-start-interpretation-${String(index + 1).padStart(3, "0")}`,
      sourceIndex: index,
      position: start
    },
    endAlternative: {
      interpretationId:
        `${axis}-end-interpretation-${String(index + 1).padStart(3, "0")}`,
      sourceIndex: index,
      position: end
    },
    coordinateSystem: {
      space: "analysis-region-local"
    },
    evidenceReferences: [`bounds:${axis}:${index}`],
    provenance: {
      source: "synthetic-factored-bounds",
      axis,
      sourceOrder: index
    }
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
