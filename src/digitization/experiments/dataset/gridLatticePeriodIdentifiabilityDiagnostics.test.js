import {
  createGridLatticePeriodicityDiagnostics
} from "./gridLatticePeriodicityDiagnostics";
import {
  createGridLatticePeriodIdentifiabilityDiagnostics
} from "./gridLatticePeriodIdentifiabilityDiagnostics";

jest.mock("./gridLatticePeriodicityDiagnostics", () => ({
  createGridLatticePeriodicityDiagnostics: jest.fn()
}));

beforeEach(() => {
  createGridLatticePeriodicityDiagnostics.mockReset();
  createGridLatticePeriodicityDiagnostics.mockReturnValue(createPeriodicity());
});

test("identifies one residual-supported primitive candidate without Ground Truth selection", () => {
  const report = createGridLatticePeriodIdentifiabilityDiagnostics({
    datasetReport: { id: "dataset-input" },
    groundTruth: { id: "validation-input" }
  });
  const horizontal = readLattice(report).horizontal;

  expect(createGridLatticePeriodicityDiagnostics).toHaveBeenCalledWith({
    datasetReport: { id: "dataset-input" },
    groundTruth: { id: "validation-input" }
  });
  expect(horizontal.identifiability).toEqual({
    status: "identified",
    reason: null,
    identifiedPrimitiveCandidateIndex: 0,
    identifiedPrimitiveSpacing: 10,
    observationSupportedCandidateIndexes: [0]
  });
  expect(horizontal.candidates[0].observedOneXSpacingSupport).toEqual({
    count: 1,
    observedSpacingIndexes: [0]
  });
  expect(horizontal.candidates[0].minimumObservedIntegerMultiple).toBe(1);
  expect(horizontal.candidates[0].maximumObservedIntegerMultiple).toBe(2);
});

test("reports harmonic and subharmonic family relations factually", () => {
  const horizontal = readLattice(
    createGridLatticePeriodIdentifiabilityDiagnostics()
  ).horizontal;
  const ten = horizontal.candidates[0];
  const five = horizontal.candidates[1];

  expect(ten.familyRelations).toEqual([
    {
      candidateIndex: 1,
      fundamentalSpacing: 5,
      relation: "candidate-is-integer-multiple-of-related-candidate",
      harmonicSubharmonicRelation:
        "candidate-frequency-is-integer-subharmonic-of-related-frequency",
      integerFactor: 2,
      residualBehavior: "equivalent"
    },
    {
      candidateIndex: 2,
      fundamentalSpacing: 20,
      relation: "candidate-is-integer-divisor-of-related-candidate",
      harmonicSubharmonicRelation:
        "candidate-frequency-is-integer-harmonic-of-related-frequency",
      integerFactor: 2,
      residualBehavior: "different"
    }
  ]);
  expect(ten.equivalentCandidateFamily.candidateIndexes).toEqual([0, 1]);
  expect(five.primitiveObservation).toEqual(expect.objectContaining({
    status: "explainable-as-integer-divisor",
    explainableAsDivisorOfCandidateIndexes: [0]
  }));
});

test("preserves deterministic anchor-index progression", () => {
  const progression = readLattice(
    createGridLatticePeriodIdentifiabilityDiagnostics()
  ).horizontal.candidates[0].anchorIndexProgression;

  expect(progression).toEqual([
    expect.objectContaining({
      anchorIndex: 0,
      latticeIndex: 0,
      latticeIndexDelta: null,
      residual: 0
    }),
    expect.objectContaining({
      anchorIndex: 1,
      latticeIndex: 1,
      latticeIndexDelta: 1,
      residual: 0
    }),
    expect.objectContaining({
      anchorIndex: 2,
      latticeIndex: 3,
      latticeIndexDelta: 2,
      residual: 0
    })
  ]);
});

test("represents multiple supported primitive observations as ambiguous", () => {
  const source = createPeriodicity();
  source.items[0].lattices[0].horizontal.candidateFundamentalSpacings = [
    createCandidate({ spacing: 10, multiples: [1, 2] }),
    createCandidate({ spacing: 12, multiples: [1, 2] })
  ];
  source.items[0].lattices[0].horizontal.groundTruthValidation
    .candidateRelations = createGroundTruthRelations([10, 12]);
  createGridLatticePeriodicityDiagnostics.mockReturnValue(source);

  const horizontal = readLattice(
    createGridLatticePeriodIdentifiabilityDiagnostics()
  ).horizontal;

  expect(horizontal.identifiability).toEqual({
    status: "ambiguous",
    reason: "multiple-observation-supported-primitive-candidates",
    identifiedPrimitiveCandidateIndex: null,
    identifiedPrimitiveSpacing: null,
    observationSupportedCandidateIndexes: [0, 1]
  });
  expect(horizontal.groundTruthValidation.identifiedPrimitiveRelation).toBeNull();
});

test("validates the identified candidate against Ground Truth afterward", () => {
  const horizontal = readLattice(
    createGridLatticePeriodIdentifiabilityDiagnostics()
  ).horizontal;

  expect(horizontal.groundTruthValidation).toEqual(expect.objectContaining({
    status: "compared",
    groundTruthAdjacentSpacings: [
      { spacing: 10 },
      { spacing: 10 }
    ],
    identifiedPrimitiveRelation: expect.objectContaining({
      candidateIndex: 0,
      fundamentalSpacing: 10,
      compatibleWithConfirmedLattice: true,
      residualStatistics: expect.objectContaining({
        maximumAbsolute: 0,
        rms: 0
      })
    })
  }));

  const changed = createPeriodicity();
  changed.items[0].lattices[0].horizontal.groundTruthValidation = {
    status: "compared",
    groundTruthAdjacentSpacings: [{ spacing: 12 }],
    candidateRelations: createGroundTruthRelations([10, 5, 20], false)
  };
  createGridLatticePeriodicityDiagnostics.mockReturnValue(changed);
  const changedHorizontal = readLattice(
    createGridLatticePeriodIdentifiabilityDiagnostics()
  ).horizontal;

  expect(changedHorizontal.candidates).toEqual(horizontal.candidates);
  expect(changedHorizontal.identifiability).toEqual(horizontal.identifiability);
  expect(changedHorizontal.groundTruthValidation.identifiedPrimitiveRelation
    .compatibleWithConfirmedLattice).toBe(false);
});

test("keeps axes independent and preserves provider and region order", () => {
  const source = createPeriodicity();
  source.items[0].lattices.push({
    ...source.items[0].lattices[0],
    providerId: "provider-b",
    regionId: "region-b"
  });
  createGridLatticePeriodicityDiagnostics.mockReturnValue(source);

  const report = createGridLatticePeriodIdentifiabilityDiagnostics();

  expect(report.items[0].lattices.map(lattice => [
    lattice.providerId,
    lattice.regionId
  ])).toEqual([
    ["provider-a", "region-a"],
    ["provider-b", "region-b"]
  ]);
  expect(readLattice(report).horizontal.identifiability.identifiedPrimitiveSpacing)
    .toBe(10);
  expect(readLattice(report).vertical.identifiability.identifiedPrimitiveSpacing)
    .toBe(15);
  expect(report.observationPolicy.axesEvaluatedIndependently).toBe(true);
});

test("preserves unavailable axes", () => {
  const source = createPeriodicity();
  source.items[0].lattices[0].horizontal = {
    axis: "horizontal",
    status: "unavailable",
    reason: "adjacent-spacing-unavailable",
    candidateFundamentalSpacings: []
  };
  createGridLatticePeriodicityDiagnostics.mockReturnValue(source);

  const horizontal = readLattice(
    createGridLatticePeriodIdentifiabilityDiagnostics()
  ).horizontal;

  expect(horizontal.status).toBe("unavailable");
  expect(horizontal.identifiability.status).toBe("unavailable");
  expect(horizontal.candidates).toEqual([]);
});

test("is deterministic, immutable and contains no evaluative fields", () => {
  const source = deepFreeze(createPeriodicity());
  createGridLatticePeriodicityDiagnostics.mockReturnValue(source);
  const before = JSON.stringify(source);
  const first = createGridLatticePeriodIdentifiabilityDiagnostics();
  const second = createGridLatticePeriodIdentifiabilityDiagnostics();

  expect(second).toEqual(first);
  expect(JSON.stringify(source)).toBe(before);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(readLattice(first).horizontal.candidates[0]
    .familyRelations)).toBe(true);
  expectForbiddenFieldsAbsent(first);
});

function createPeriodicity() {
  const horizontalCandidates = [
    createCandidate({ spacing: 10, multiples: [1, 2] }),
    createCandidate({ spacing: 5, multiples: [2, 4] }),
    createCandidate({ spacing: 20, multiples: [1, 1], residuals: [-10, 0] })
  ];
  const verticalCandidates = [
    createCandidate({ spacing: 15, multiples: [1, 1] })
  ];

  return {
    type: "grid-lattice-periodicity-diagnostics",
    version: 1,
    datasetId: "tt-dataset",
    status: "complete",
    items: [{
      itemId: "item-a",
      filename: "a.pdf",
      status: "available",
      reasons: [],
      groundTruthStatus: "available",
      lattices: [{
        providerId: "provider-a",
        regionId: "region-a",
        status: "available",
        coordinateSpace: "rendered-binary-image-pixels",
        horizontal: createAxis({
          axis: "horizontal",
          positions: [100, 110, 130],
          spacings: [10, 20],
          candidates: horizontalCandidates,
          groundTruthSpacings: [10, 10]
        }),
        vertical: createAxis({
          axis: "vertical",
          positions: [50, 65, 80],
          spacings: [15, 15],
          candidates: verticalCandidates,
          groundTruthSpacings: [15, 15]
        })
      }]
    }],
    unmatchedAnnotations: []
  };
}

function createAxis({ axis, positions, spacings, candidates, groundTruthSpacings }) {
  return {
    axis,
    status: "available",
    observedLinePositions: positions,
    observedAdjacentSpacings: spacings.map((spacing, index) => ({
      fromLineIndex: index,
      toLineIndex: index + 1,
      spacing
    })),
    candidateFundamentalSpacings: candidates,
    groundTruthValidation: {
      status: "compared",
      groundTruthAdjacentSpacings: groundTruthSpacings.map(spacing => ({ spacing })),
      candidateRelations: createGroundTruthRelations(
        candidates.map(candidate => candidate.fundamentalSpacing)
      )
    }
  };
}

function createCandidate({ spacing, multiples, residuals = multiples.map(() => 0) }) {
  const cumulativeMultiples = multiples.reduce((values, multiple) => [
    ...values,
    values[values.length - 1] + multiple
  ], [0]);
  const cumulativeResiduals = residuals.reduce((values, residual) => [
    ...values,
    values[values.length - 1] + residual
  ], [0]);

  return {
    candidateIndex: 0,
    fundamentalSpacing: spacing,
    source: { adjacentSpacingIndex: 0, spacing, integerDivisor: 1 },
    spacingRelations: multiples.map((multiple, index) => ({
      nearestIntegerMultiple: multiple,
      residual: residuals[index]
    })),
    residualStatistics: {
      status: "available",
      maximumAbsolute: Math.max(...residuals.map(Math.abs)),
      averageAbsolute: residuals.reduce((sum, value) => sum + Math.abs(value), 0)
        / residuals.length,
      rms: Math.sqrt(
        residuals.reduce((sum, value) => sum + value * value, 0)
        / residuals.length
      )
    },
    anchorConsistency: {
      relations: cumulativeMultiples.map((multiple, index) => ({
        lineIndex: index,
        observedPosition: index === 0 ? 0 : index === 1 ? 10 : 30,
        nearestIntegerMultiple: multiple,
        residual: cumulativeResiduals[index],
        absoluteResidual: Math.abs(cumulativeResiduals[index])
      }))
    }
  };
}

function createGroundTruthRelations(spacings, compatible = true) {
  return spacings.map((spacing, candidateIndex) => ({
    candidateIndex,
    fundamentalSpacing: spacing,
    groundTruthSpacingRelations: [{
      observedSpacing: compatible ? spacing : 12,
      nearestIntegerMultiple: 1,
      residual: compatible ? 0 : 12 - spacing
    }],
    residualStatistics: {
      status: "available",
      maximumAbsolute: compatible ? 0 : Math.abs(12 - spacing),
      rms: compatible ? 0 : Math.abs(12 - spacing)
    },
    compatibleWithConfirmedLattice: compatible
  }));
}

function readLattice(report) {
  return report.items[0].lattices[0];
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
