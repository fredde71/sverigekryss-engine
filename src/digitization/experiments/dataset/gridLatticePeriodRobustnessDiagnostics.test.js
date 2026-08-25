import {
  createGridLatticePeriodicityDiagnostics
} from "./gridLatticePeriodicityDiagnostics";
import {
  createGridLatticePeriodRobustnessDiagnostics,
  DEFAULT_NORMALIZED_RESIDUAL_TOLERANCE
} from "./gridLatticePeriodRobustnessDiagnostics";

jest.mock("./gridLatticePeriodicityDiagnostics", () => ({
  createGridLatticePeriodicityDiagnostics: jest.fn()
}));

beforeEach(() => {
  createGridLatticePeriodicityDiagnostics.mockReset();
  createGridLatticePeriodicityDiagnostics.mockReturnValue(createPeriodicity());
});

test("uses non-zero normalized residual tolerance to support a primitive period", () => {
  const report = createGridLatticePeriodRobustnessDiagnostics();
  const horizontal = readLattice(report).horizontal;
  const candidate = horizontal.candidates[0];

  expect(report.observationPolicy.normalizedResidualTolerance).toBe(0.05);
  expect(candidate.fundamentalSpacing).toBe(10);
  expect(candidate.normalizedResidualStatistics.maximum).toBeCloseTo(0.04);
  expect(candidate.absoluteResidualStatistics).toEqual(expect.objectContaining({
    count: 5,
    maximum: 0.4,
    mean: 0.32
  }));
  expect(candidate.primitiveCandidateSupport).toEqual(expect.objectContaining({
    status: "supported",
    spacingResidualsWithinTolerance: true,
    anchorResidualsWithinTolerance: true
  }));
  expect(horizontal.primitiveIdentification).toEqual({
    status: "identified",
    reason: null,
    selectedPrimitiveCandidateIndex: 0,
    selectedPrimitiveSpacing: 10,
    toleranceSupportedCandidateIndexes: [0]
  });
  expect(candidate.absoluteResidualStatistics.maximum).toBeGreaterThan(0);
});

test("reports 1x support, integer multiples and anchor stability under tolerance", () => {
  const candidate = readLattice(
    createGridLatticePeriodRobustnessDiagnostics()
  ).horizontal.candidates[0];

  expect(candidate.observedOneXSupportUnderTolerance).toEqual({
    count: 1,
    observedSpacingIndexes: [0],
    normalizedResidualTolerance: 0.05
  });
  expect(candidate.minimumObservedIntegerMultiple).toBe(1);
  expect(candidate.maximumObservedIntegerMultiple).toBe(2);
  expect(candidate.anchorStability).toEqual(expect.objectContaining({
    status: "observed",
    stableAnchorCount: 3,
    unstableAnchorCount: 0,
    stableAnchorIndexes: [0, 1, 2],
    stableAcrossObservedAnchors: true
  }));
  expect(candidate.anchorStability.residuals[1]).toEqual(expect.objectContaining({
    absoluteResidual: 0.4,
    normalizedResidual: 0.04,
    withinTolerance: true
  }));
});

test("reports equivalent harmonic families and their residual separation", () => {
  const horizontal = readLattice(
    createGridLatticePeriodRobustnessDiagnostics()
  ).horizontal;
  const ten = horizontal.candidates[0];
  const five = horizontal.candidates[1];

  expect(ten.familyRelations[0]).toEqual(expect.objectContaining({
    candidateIndex: 1,
    fundamentalSpacing: 5,
    relation: "candidate-is-integer-multiple-of-related-candidate",
    harmonicSubharmonicRelation:
      "candidate-frequency-is-integer-subharmonic-of-related-frequency",
    integerFactor: 2,
    candidateFamilySeparation: expect.objectContaining({
      maximumNormalizedResidualDelta: 0,
      equivalentUnderTolerance: true,
      separatedBeyondTolerance: false
    })
  }));
  expect(ten.equivalentCandidateFamily.candidateIndexes).toEqual([0, 1]);
  expect(five.primitiveCandidateSupport).toEqual(expect.objectContaining({
    status: "explainable-as-integer-divisor-under-tolerance",
    explainableAsDivisorOfCandidateIndexes: [0]
  }));
});

test("separates candidate families when normalized residual behavior differs", () => {
  const source = createPeriodicity();
  source.items[0].lattices[0].horizontal.candidateFundamentalSpacings[1] =
    createCandidate({
      spacing: 5,
      multiples: [2, 4],
      spacingResiduals: [0.5, 0.5],
      anchorResiduals: [0, 0.5, 0.5]
    });
  createGridLatticePeriodicityDiagnostics.mockReturnValue(source);

  const relation = readLattice(
    createGridLatticePeriodRobustnessDiagnostics()
  ).horizontal.candidates[0].familyRelations[0];

  expect(relation.candidateFamilySeparation).toEqual(expect.objectContaining({
    maximumNormalizedResidualDelta: 0.060000000000000005,
    equivalentUnderTolerance: false,
    separatedBeyondTolerance: true
  }));
});

test("reports ambiguity when multiple non-family candidates have tolerance support", () => {
  const source = createPeriodicity();
  source.items[0].lattices[0].horizontal.candidateFundamentalSpacings = [
    createCandidate({
      spacing: 10,
      multiples: [1, 2],
      spacingResiduals: [0.4, 0.4],
      anchorResiduals: [0, 0.4, 0.4]
    }),
    createCandidate({
      spacing: 12,
      multiples: [1, 2],
      spacingResiduals: [0.4, 0.4],
      anchorResiduals: [0, 0.4, 0.4]
    })
  ];
  source.items[0].lattices[0].horizontal.groundTruthValidation
    .candidateRelations = createGroundTruthRelations([10, 12]);
  createGridLatticePeriodicityDiagnostics.mockReturnValue(source);

  const identification = readLattice(
    createGridLatticePeriodRobustnessDiagnostics()
  ).horizontal.primitiveIdentification;

  expect(identification).toEqual({
    status: "ambiguous",
    reason: "multiple-tolerance-supported-primitive-candidates",
    selectedPrimitiveCandidateIndex: null,
    selectedPrimitiveSpacing: null,
    toleranceSupportedCandidateIndexes: [0, 1]
  });
});

test("a stricter positive tolerance can make primitive support unavailable", () => {
  const horizontal = readLattice(
    createGridLatticePeriodRobustnessDiagnostics({
      normalizedResidualTolerance: 0.03
    })
  ).horizontal;

  expect(horizontal.primitiveIdentification.status).toBe("unavailable");
  expect(horizontal.candidates[0].primitiveCandidateSupport.status).toBe(
    "outside-normalized-residual-tolerance"
  );
  expect(() => createGridLatticePeriodRobustnessDiagnostics({
    normalizedResidualTolerance: 0
  })).toThrow("greater than 0 and less than 1");
});

test("validates the selected primitive against Ground Truth afterward", () => {
  const horizontal = readLattice(
    createGridLatticePeriodRobustnessDiagnostics()
  ).horizontal;

  expect(horizontal.groundTruthValidation.selectedPrimitiveRelation).toEqual(
    expect.objectContaining({
      candidateIndex: 0,
      fundamentalSpacing: 10,
      normalizedResidualStatistics: expect.objectContaining({
        maximum: 0.04
      }),
      compatibleWithConfirmedLattice: true
    })
  );
  expect(horizontal.groundTruthValidation.selectedPrimitiveRelation
    .groundTruthSpacingRelations[0]).toEqual(expect.objectContaining({
      normalizedResidual: 0.04,
      withinTolerance: true
    }));

  const changed = createPeriodicity({ groundTruthResidual: 0.6 });
  createGridLatticePeriodicityDiagnostics.mockReturnValue(changed);
  const changedHorizontal = readLattice(
    createGridLatticePeriodRobustnessDiagnostics()
  ).horizontal;

  expect(changedHorizontal.candidates).toEqual(horizontal.candidates);
  expect(changedHorizontal.primitiveIdentification).toEqual(
    horizontal.primitiveIdentification
  );
  expect(changedHorizontal.groundTruthValidation.selectedPrimitiveRelation
    .compatibleWithConfirmedLattice).toBe(false);
});

test("preserves independent axes, ordering, unavailable states and immutability", () => {
  const source = createPeriodicity();
  source.items[0].lattices.push({
    ...source.items[0].lattices[0],
    providerId: "provider-b",
    regionId: "region-b",
    horizontal: {
      axis: "horizontal",
      status: "unavailable",
      reason: "spacing-unavailable",
      candidateFundamentalSpacings: []
    }
  });
  const frozen = deepFreeze(source);
  createGridLatticePeriodicityDiagnostics.mockReturnValue(frozen);
  const before = JSON.stringify(frozen);
  const first = createGridLatticePeriodRobustnessDiagnostics();
  const second = createGridLatticePeriodRobustnessDiagnostics();

  expect(first.items[0].lattices.map(lattice => [
    lattice.providerId,
    lattice.regionId
  ])).toEqual([
    ["provider-a", "region-a"],
    ["provider-b", "region-b"]
  ]);
  expect(first.items[0].lattices[0].vertical.primitiveIdentification
    .selectedPrimitiveSpacing).toBe(15);
  expect(first.items[0].lattices[1].horizontal.status).toBe("unavailable");
  expect(second).toEqual(first);
  expect(JSON.stringify(frozen)).toBe(before);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(readLattice(first).horizontal.candidates[0]
    .familyRelations)).toBe(true);
});

function createPeriodicity({ groundTruthResidual = 0.4 } = {}) {
  const horizontalCandidates = [
    createCandidate({
      spacing: 10,
      multiples: [1, 2],
      spacingResiduals: [0.4, 0.4],
      anchorResiduals: [0, 0.4, 0.4]
    }),
    createCandidate({
      spacing: 5,
      multiples: [2, 4],
      spacingResiduals: [0.2, 0.2],
      anchorResiduals: [0, 0.2, 0.2]
    }),
    createCandidate({
      spacing: 20,
      multiples: [1, 1],
      spacingResiduals: [9, 1],
      anchorResiduals: [0, 9, 1]
    })
  ];
  const verticalCandidates = [
    createCandidate({
      spacing: 15,
      multiples: [1, 1],
      spacingResiduals: [0.3, 0.3],
      anchorResiduals: [0, 0.3, 0.3]
    })
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
          positions: [100, 110.4, 130.4],
          spacings: [10.4, 20],
          candidates: horizontalCandidates,
          groundTruthResidual
        }),
        vertical: createAxis({
          axis: "vertical",
          positions: [50, 65.3, 80.3],
          spacings: [15.3, 15],
          candidates: verticalCandidates,
          groundTruthResidual: 0.3
        })
      }]
    }],
    unmatchedAnnotations: []
  };
}

function createAxis({
  axis,
  positions,
  spacings,
  candidates,
  groundTruthResidual
}) {
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
      groundTruthAdjacentSpacings: [{ spacing: candidates[0].fundamentalSpacing }],
      candidateRelations: createGroundTruthRelations(
        candidates.map(candidate => candidate.fundamentalSpacing),
        groundTruthResidual
      )
    }
  };
}

function createCandidate({
  spacing,
  multiples,
  spacingResiduals,
  anchorResiduals
}) {
  return {
    fundamentalSpacing: spacing,
    source: { adjacentSpacingIndex: 0, spacing, integerDivisor: 1 },
    spacingRelations: multiples.map((multiple, index) => ({
      nearestIntegerMultiple: multiple,
      residual: spacingResiduals[index],
      absoluteResidual: Math.abs(spacingResiduals[index])
    })),
    anchorConsistency: {
      relations: anchorResiduals.map((residual, index) => ({
        lineIndex: index,
        observedPosition: index === 0 ? 0 : index === 1 ? 10.4 : 30.4,
        nearestIntegerMultiple: index === 0
          ? 0
          : multiples.slice(0, index).reduce((sum, value) => sum + value, 0),
        residual,
        absoluteResidual: Math.abs(residual)
      }))
    }
  };
}

function createGroundTruthRelations(spacings, residual = 0.4) {
  return spacings.map((spacing, candidateIndex) => ({
    candidateIndex,
    fundamentalSpacing: spacing,
    groundTruthSpacingRelations: [{
      observedSpacing: spacing + residual,
      nearestIntegerMultiple: 1,
      residual,
      absoluteResidual: Math.abs(residual)
    }]
  }));
}

function readLattice(report) {
  return report.items[0].lattices[0];
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

test("default tolerance is explicitly non-zero", () => {
  expect(DEFAULT_NORMALIZED_RESIDUAL_TOLERANCE).toBeGreaterThan(0);
});
