import {
  createGridLatticePeriodRobustnessDiagnostics
} from "./gridLatticePeriodRobustnessDiagnostics";
import {
  createGridLatticePeriodToleranceSensitivityDiagnostics,
  DEFAULT_NORMALIZED_RESIDUAL_TOLERANCE_LEVELS
} from "./gridLatticePeriodToleranceSensitivityDiagnostics";

jest.mock("./gridLatticePeriodRobustnessDiagnostics", () => ({
  createGridLatticePeriodRobustnessDiagnostics: jest.fn()
}));

beforeEach(() => {
  createGridLatticePeriodRobustnessDiagnostics.mockReset();
  createGridLatticePeriodRobustnessDiagnostics.mockImplementation(({
    normalizedResidualTolerance
  }) => createRobustnessReport(normalizedResidualTolerance));
});

test("evaluates the deterministic tolerance sweep in exact order", () => {
  const report = createGridLatticePeriodToleranceSensitivityDiagnostics({
    datasetReport: { id: "dataset" },
    groundTruth: { id: "ground-truth" }
  });

  expect(report.toleranceLevels).toEqual([
    0.01,
    0.02,
    0.03,
    0.04,
    0.05,
    0.075,
    0.1
  ]);
  expect(createGridLatticePeriodRobustnessDiagnostics.mock.calls.map(
    ([input]) => input
  )).toEqual(report.toleranceLevels.map(normalizedResidualTolerance => ({
    datasetReport: { id: "dataset" },
    groundTruth: { id: "ground-truth" },
    normalizedResidualTolerance
  })));
  expect(readAxis(report).toleranceSweep.map(entry => entry.tolerance)).toEqual(
    report.toleranceLevels
  );
});

test("reports first identification and its contiguous stability envelope", () => {
  const axis = readAxis(
    createGridLatticePeriodToleranceSensitivityDiagnostics()
  );

  expect(axis.firstIdentification).toEqual({
    status: "available",
    reason: null,
    tolerance: 0.02,
    candidateIndex: 0,
    spacing: 10
  });
  expect(axis.stabilityEnvelope).toEqual({
    status: "available",
    reason: null,
    candidateIndex: 0,
    spacing: 10,
    startTolerance: 0.02,
    endTolerance: 0.05,
    evaluatedTolerances: [0.02, 0.03, 0.04, 0.05],
    stableThroughLastEvaluatedTolerance: false,
    firstDifferentState: {
      tolerance: 0.075,
      status: "ambiguous",
      reason: "multiple-tolerance-supported-primitive-candidates",
      selectedPrimitiveCandidateIndex: null,
      selectedPrimitiveSpacing: null,
      toleranceSupportedCandidates: [
        { candidateIndex: 0, spacing: 10 },
        { candidateIndex: 1, spacing: 5 }
      ]
    }
  });
});

test("reports first ambiguity and competing candidate identities", () => {
  const axis = readAxis(
    createGridLatticePeriodToleranceSensitivityDiagnostics()
  );

  expect(axis.firstAmbiguity).toEqual({
    status: "available",
    reason: null,
    tolerance: 0.075,
    competingCandidates: [
      { candidateIndex: 0, spacing: 10 },
      { candidateIndex: 1, spacing: 5 }
    ]
  });
});

test("reports every adjacent candidate identity change", () => {
  const changes = readAxis(
    createGridLatticePeriodToleranceSensitivityDiagnostics()
  ).candidateIdentityChanges;

  expect(changes.map(change => [
    change.fromTolerance,
    change.toTolerance,
    change.from.status,
    change.to.status,
    change.to.candidateIndex
  ])).toEqual([
    [0.01, 0.02, "unavailable", "identified", 0],
    [0.05, 0.075, "identified", "ambiguous", null],
    [0.075, 0.1, "ambiguous", "identified", 1]
  ]);
});

test("validates first identification and the full envelope after selection", () => {
  const validation = readAxis(
    createGridLatticePeriodToleranceSensitivityDiagnostics()
  ).groundTruthValidation;

  expect(validation.status).toBe("compared");
  expect(validation.firstIdentifiedPrimitiveRelation).toEqual(
    expect.objectContaining({
      candidateIndex: 0,
      fundamentalSpacing: 10,
      matchesConfirmedLatticeScale: true,
      normalizedResidualStatistics: { maximum: 0.015 },
      compatibleWithConfirmedLattice: true
    })
  );
  expect(validation.firstIdentifiedPrimitiveRelation
    .groundTruthSpacingRelations[0]).toEqual({
      nearestIntegerMultiple: 1,
      normalizedResidual: 0.015,
      withinTolerance: true
    });
  expect(validation.stabilityEnvelopeRelations.map(entry => (
    entry.tolerance
  ))).toEqual([0.02, 0.03, 0.04, 0.05]);
  expect(validation.fullStabilityEnvelopeCompatibleWithConfirmedLattice)
    .toBe(true);
});

test("Ground Truth validation cannot change sweep identification", () => {
  const first = createGridLatticePeriodToleranceSensitivityDiagnostics();
  createGridLatticePeriodRobustnessDiagnostics.mockImplementation(({
    normalizedResidualTolerance
  }) => createRobustnessReport(normalizedResidualTolerance, {
    groundTruthCompatible: false,
    nearestIntegerMultiple: 2
  }));
  const changed = createGridLatticePeriodToleranceSensitivityDiagnostics();

  expect(readAxis(changed).toleranceSweep).toEqual(readAxis(first).toleranceSweep);
  expect(readAxis(changed).firstIdentification).toEqual(
    readAxis(first).firstIdentification
  );
  expect(readAxis(changed).stabilityEnvelope).toEqual(
    readAxis(first).stabilityEnvelope
  );
  expect(readAxis(changed).groundTruthValidation
    .firstIdentifiedPrimitiveRelation.matchesConfirmedLatticeScale).toBe(false);
  expect(readAxis(changed).groundTruthValidation
    .fullStabilityEnvelopeCompatibleWithConfirmedLattice).toBe(false);
});

test("reports unavailable identification without inventing an envelope", () => {
  createGridLatticePeriodRobustnessDiagnostics.mockImplementation(({
    normalizedResidualTolerance
  }) => createRobustnessReport(normalizedResidualTolerance, {
    alwaysUnavailable: true
  }));

  const axis = readAxis(
    createGridLatticePeriodToleranceSensitivityDiagnostics()
  );

  expect(axis.firstIdentification.status).toBe("unavailable");
  expect(axis.stabilityEnvelope).toEqual(expect.objectContaining({
    status: "unavailable",
    evaluatedTolerances: []
  }));
  expect(axis.groundTruthValidation).toEqual(expect.objectContaining({
    status: "unavailable",
    firstIdentifiedPrimitiveRelation: null,
    fullStabilityEnvelopeCompatibleWithConfirmedLattice: null
  }));
});

test("accepts only a non-empty strictly increasing non-zero tolerance sweep", () => {
  expect(() => createGridLatticePeriodToleranceSensitivityDiagnostics({
    toleranceLevels: []
  })).toThrow("non-empty array");
  expect(() => createGridLatticePeriodToleranceSensitivityDiagnostics({
    toleranceLevels: [0, 0.1]
  })).toThrow("greater than 0 and less than 1");
  expect(() => createGridLatticePeriodToleranceSensitivityDiagnostics({
    toleranceLevels: [0.05, 0.05]
  })).toThrow("strictly increasing");
  expect(() => createGridLatticePeriodToleranceSensitivityDiagnostics({
    toleranceLevels: [0.1, 0.05]
  })).toThrow("strictly increasing");
});

test("preserves ordering and produces deterministic immutable output", () => {
  const first = createGridLatticePeriodToleranceSensitivityDiagnostics();
  const second = createGridLatticePeriodToleranceSensitivityDiagnostics();

  expect(second).toEqual(first);
  expect(first.items.map(item => item.itemId)).toEqual(["item-a"]);
  expect(first.items[0].lattices.map(lattice => [
    lattice.providerId,
    lattice.regionId
  ])).toEqual([["provider-a", "region-a"]]);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(readAxis(first).toleranceSweep)).toBe(true);
  expect(DEFAULT_NORMALIZED_RESIDUAL_TOLERANCE_LEVELS).toEqual(
    first.toleranceLevels
  );
});

function createRobustnessReport(tolerance, {
  groundTruthCompatible = true,
  nearestIntegerMultiple = 1,
  alwaysUnavailable = false
} = {}) {
  const identification = alwaysUnavailable
    ? createIdentification("unavailable", null, [])
    : tolerance < 0.02
      ? createIdentification("unavailable", null, [])
      : tolerance < 0.075
        ? createIdentification("identified", 0, [0])
        : tolerance === 0.075
          ? createIdentification("ambiguous", null, [0, 1])
          : createIdentification("identified", 1, [1]);
  const selectedIndex = identification.selectedPrimitiveCandidateIndex;
  const selectedRelation = selectedIndex === null
    ? null
    : createGroundTruthRelation({
      candidateIndex: selectedIndex,
      spacing: selectedIndex === 0 ? 10 : 5,
      tolerance,
      compatible: groundTruthCompatible,
      nearestIntegerMultiple
    });
  const axis = {
    axis: "horizontal",
    status: "available",
    candidates: [
      { candidateIndex: 0, fundamentalSpacing: 10 },
      { candidateIndex: 1, fundamentalSpacing: 5 }
    ],
    primitiveIdentification: identification,
    groundTruthValidation: {
      status: "compared",
      selectedPrimitiveRelation: selectedRelation
    }
  };

  return {
    type: "grid-lattice-period-robustness-diagnostics",
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
        horizontal: axis,
        vertical: {
          ...axis,
          axis: "vertical"
        }
      }]
    }],
    unmatchedAnnotations: []
  };
}

function createIdentification(status, selectedIndex, supportedIndexes) {
  return {
    status,
    reason: status === "identified"
      ? null
      : status === "ambiguous"
        ? "multiple-tolerance-supported-primitive-candidates"
        : "tolerance-supported-primitive-candidate-unavailable",
    selectedPrimitiveCandidateIndex: selectedIndex,
    selectedPrimitiveSpacing: selectedIndex === null
      ? null
      : selectedIndex === 0 ? 10 : 5,
    toleranceSupportedCandidateIndexes: supportedIndexes
  };
}

function createGroundTruthRelation({
  candidateIndex,
  spacing,
  tolerance,
  compatible,
  nearestIntegerMultiple
}) {
  return {
    candidateIndex,
    fundamentalSpacing: spacing,
    groundTruthSpacingRelations: [{
      nearestIntegerMultiple,
      normalizedResidual: 0.015,
      withinTolerance: 0.015 <= tolerance
    }],
    normalizedResidualStatistics: { maximum: 0.015 },
    compatibleWithConfirmedLattice: compatible && 0.015 <= tolerance
  };
}

function readAxis(report) {
  return report.items[0].lattices[0].horizontal;
}
