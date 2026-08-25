import {
  createGridLatticePeriodRobustnessDiagnostics
} from "./gridLatticePeriodRobustnessDiagnostics";

const REPORT_VERSION = 1;
export const DEFAULT_NORMALIZED_RESIDUAL_TOLERANCE_LEVELS = Object.freeze([
  0.01,
  0.02,
  0.03,
  0.04,
  0.05,
  0.075,
  0.1
]);

export function createGridLatticePeriodToleranceSensitivityDiagnostics({
  datasetReport,
  groundTruth,
  toleranceLevels = DEFAULT_NORMALIZED_RESIDUAL_TOLERANCE_LEVELS
} = {}) {
  validateToleranceLevels(toleranceLevels);
  const levels = toleranceLevels.slice();
  const sweeps = levels.map(normalizedResidualTolerance => (
    createGridLatticePeriodRobustnessDiagnostics({
      datasetReport,
      groundTruth,
      normalizedResidualTolerance
    })
  ));
  const first = sweeps[0];
  const items = first.items.map((item, itemIndex) => (
    createItemDiagnostics({ item, itemIndex, sweeps, levels })
  ));
  const axes = items.flatMap(item => (
    item.lattices.flatMap(lattice => [lattice.horizontal, lattice.vertical])
  ));

  return deepFreeze({
    type: "grid-lattice-period-tolerance-sensitivity-diagnostics",
    version: REPORT_VERSION,
    datasetId: first.datasetId,
    status: "complete",
    observationPolicy: {
      source: "grid-lattice-period-robustness-diagnostics",
      toleranceLevels: levels,
      toleranceOrder: "strictly-increasing",
      stabilityInterval: "contiguous-evaluated-tolerance-levels-inclusive",
      identityChange:
        "adjacent-evaluated-level-identification-state-or-candidate-change",
      axesEvaluatedIndependently: true,
      productionTolerance: "not-selected",
      interpolation: "none",
      snapping: "none",
      groundTruthUsage: "post-diagnostic-validation-only",
      interpretation: "observation-only"
    },
    inventory: {
      totalDatasetItemCount: items.length,
      latticeObservationCount: items.reduce(
        (count, item) => count + item.lattices.length,
        0
      ),
      axisCount: axes.length,
      axisWithIdentificationCount: axes.filter(axis => (
        axis.firstIdentification.status === "available"
      )).length,
      axisWithoutIdentificationCount: axes.filter(axis => (
        axis.firstIdentification.status === "unavailable"
      )).length
    },
    toleranceLevels: levels,
    items,
    unmatchedAnnotations: cloneValue(first.unmatchedAnnotations)
  });
}

function createItemDiagnostics({ item, itemIndex, sweeps, levels }) {
  return {
    itemId: item.itemId,
    filename: item.filename,
    status: item.status,
    reasons: cloneValue(item.reasons),
    groundTruthStatus: item.groundTruthStatus,
    lattices: item.lattices.map((lattice, latticeIndex) => (
      createLatticeDiagnostics({
        lattice,
        itemIndex,
        latticeIndex,
        sweeps,
        levels
      })
    ))
  };
}

function createLatticeDiagnostics({
  lattice,
  itemIndex,
  latticeIndex,
  sweeps,
  levels
}) {
  const horizontal = createAxisDiagnostics({
    axisName: "horizontal",
    itemIndex,
    latticeIndex,
    sweeps,
    levels
  });
  const vertical = createAxisDiagnostics({
    axisName: "vertical",
    itemIndex,
    latticeIndex,
    sweeps,
    levels
  });

  return {
    providerId: lattice.providerId,
    regionId: lattice.regionId,
    status: horizontal.status === "available" && vertical.status === "available"
      ? "available"
      : horizontal.status === "unavailable" && vertical.status === "unavailable"
        ? "unavailable"
        : "partial",
    coordinateSpace: lattice.coordinateSpace,
    horizontal,
    vertical
  };
}

function createAxisDiagnostics({
  axisName,
  itemIndex,
  latticeIndex,
  sweeps,
  levels
}) {
  const sourceAxes = sweeps.map(sweep => (
    sweep.items?.[itemIndex]?.lattices?.[latticeIndex]?.[axisName] ?? null
  ));
  const firstAxis = sourceAxes[0];

  if (firstAxis?.status !== "available") {
    return createUnavailableAxis(axisName, firstAxis?.reason, levels);
  }

  const toleranceSweep = sourceAxes.map((axis, index) => (
    createToleranceObservation(axis, levels[index])
  ));
  const firstIdentifiedIndex = toleranceSweep.findIndex(observation => (
    observation.status === "identified"
  ));
  const firstAmbiguousIndex = toleranceSweep.findIndex(observation => (
    observation.status === "ambiguous"
  ));
  const firstIdentification = firstIdentifiedIndex === -1
    ? {
      status: "unavailable",
      reason: "primitive-identification-unavailable-across-tolerance-sweep",
      tolerance: null,
      candidateIndex: null,
      spacing: null
    }
    : {
      status: "available",
      reason: null,
      tolerance: levels[firstIdentifiedIndex],
      candidateIndex:
        toleranceSweep[firstIdentifiedIndex].selectedPrimitiveCandidateIndex,
      spacing: toleranceSweep[firstIdentifiedIndex].selectedPrimitiveSpacing
    };
  const stabilityEnvelope = createStabilityEnvelope({
    toleranceSweep,
    levels,
    firstIdentifiedIndex
  });
  const firstAmbiguity = firstAmbiguousIndex === -1
    ? {
      status: "unavailable",
      reason: "ambiguity-unavailable-across-tolerance-sweep",
      tolerance: null,
      competingCandidates: []
    }
    : {
      status: "available",
      reason: null,
      tolerance: levels[firstAmbiguousIndex],
      competingCandidates:
        toleranceSweep[firstAmbiguousIndex].toleranceSupportedCandidates
    };

  return {
    axis: axisName,
    status: "available",
    toleranceLevels: levels.slice(),
    toleranceSweep,
    firstIdentification,
    stabilityEnvelope,
    firstAmbiguity,
    candidateIdentityChanges: createIdentityChanges(toleranceSweep),
    groundTruthValidation: createGroundTruthValidation({
      sourceAxes,
      firstIdentifiedIndex,
      stabilityEnvelope
    })
  };
}

function createToleranceObservation(axis, tolerance) {
  if (axis?.status !== "available") {
    return {
      tolerance,
      status: "unavailable",
      reason: axis?.reason || "axis-robustness-diagnostics-unavailable",
      selectedPrimitiveCandidateIndex: null,
      selectedPrimitiveSpacing: null,
      toleranceSupportedCandidates: []
    };
  }

  const identification = axis.primitiveIdentification;
  const supportedCandidates = identification.toleranceSupportedCandidateIndexes
    .map(candidateIndex => ({
      candidateIndex,
      spacing: axis.candidates[candidateIndex]?.fundamentalSpacing ?? null
    }));

  return {
    tolerance,
    status: identification.status,
    reason: identification.reason,
    selectedPrimitiveCandidateIndex:
      identification.selectedPrimitiveCandidateIndex,
    selectedPrimitiveSpacing: identification.selectedPrimitiveSpacing,
    toleranceSupportedCandidates: supportedCandidates
  };
}

function createStabilityEnvelope({
  toleranceSweep,
  levels,
  firstIdentifiedIndex
}) {
  if (firstIdentifiedIndex === -1) {
    return {
      status: "unavailable",
      reason: "primitive-identification-unavailable-across-tolerance-sweep",
      candidateIndex: null,
      spacing: null,
      startTolerance: null,
      endTolerance: null,
      evaluatedTolerances: [],
      stableThroughLastEvaluatedTolerance: false,
      firstDifferentState: null
    };
  }

  const first = toleranceSweep[firstIdentifiedIndex];
  let endIndex = firstIdentifiedIndex;

  while (
    endIndex + 1 < toleranceSweep.length
    && toleranceSweep[endIndex + 1].status === "identified"
    && toleranceSweep[endIndex + 1].selectedPrimitiveCandidateIndex
      === first.selectedPrimitiveCandidateIndex
  ) {
    endIndex++;
  }

  return {
    status: "available",
    reason: null,
    candidateIndex: first.selectedPrimitiveCandidateIndex,
    spacing: first.selectedPrimitiveSpacing,
    startTolerance: levels[firstIdentifiedIndex],
    endTolerance: levels[endIndex],
    evaluatedTolerances: levels.slice(firstIdentifiedIndex, endIndex + 1),
    stableThroughLastEvaluatedTolerance: endIndex === levels.length - 1,
    firstDifferentState: endIndex === levels.length - 1
      ? null
      : cloneValue(toleranceSweep[endIndex + 1])
  };
}

function createIdentityChanges(toleranceSweep) {
  const changes = [];

  for (let index = 1; index < toleranceSweep.length; index++) {
    const previous = toleranceSweep[index - 1];
    const current = toleranceSweep[index];

    if (identityKey(previous) !== identityKey(current)) {
      changes.push({
        fromTolerance: previous.tolerance,
        toTolerance: current.tolerance,
        from: createIdentity(previous),
        to: createIdentity(current)
      });
    }
  }

  return changes;
}

function createGroundTruthValidation({
  sourceAxes,
  firstIdentifiedIndex,
  stabilityEnvelope
}) {
  if (firstIdentifiedIndex === -1) {
    return {
      status: "unavailable",
      reason: "selected-primitive-candidate-unavailable",
      firstIdentifiedPrimitiveRelation: null,
      stabilityEnvelopeRelations: [],
      fullStabilityEnvelopeCompatibleWithConfirmedLattice: null
    };
  }

  const firstAxis = sourceAxes[firstIdentifiedIndex];
  const firstRelation = firstAxis.groundTruthValidation
    ?.selectedPrimitiveRelation ?? null;
  const startIndex = firstIdentifiedIndex;
  const endIndex = startIndex
    + stabilityEnvelope.evaluatedTolerances.length - 1;
  const stabilityEnvelopeRelations = sourceAxes
    .slice(startIndex, endIndex + 1)
    .map((axis, offset) => ({
      tolerance: stabilityEnvelope.evaluatedTolerances[offset],
      relation: cloneValue(
        axis.groundTruthValidation?.selectedPrimitiveRelation ?? null
      )
    }));
  const firstSpacingRelations = firstRelation?.groundTruthSpacingRelations ?? [];
  const matchesConfirmedLatticeScale = firstSpacingRelations.length > 0
    && firstSpacingRelations.every(relation => (
      relation.nearestIntegerMultiple === 1 && relation.withinTolerance
    ));

  return {
    status: firstRelation ? "compared" : "unavailable",
    reason: firstRelation ? null : "ground-truth-relation-unavailable",
    firstIdentifiedPrimitiveRelation: firstRelation
      ? {
        ...cloneValue(firstRelation),
        matchesConfirmedLatticeScale
      }
      : null,
    stabilityEnvelopeRelations,
    fullStabilityEnvelopeCompatibleWithConfirmedLattice:
      stabilityEnvelopeRelations.length > 0
      && stabilityEnvelopeRelations.every(entry => (
        entry.relation?.compatibleWithConfirmedLattice === true
      ))
  };
}

function createIdentity(observation) {
  return {
    status: observation.status,
    candidateIndex: observation.selectedPrimitiveCandidateIndex,
    spacing: observation.selectedPrimitiveSpacing,
    competingCandidateIndexes: observation.toleranceSupportedCandidates.map(
      candidate => candidate.candidateIndex
    )
  };
}

function identityKey(observation) {
  return JSON.stringify(createIdentity(observation));
}

function createUnavailableAxis(axis, reason, levels) {
  return {
    axis,
    status: "unavailable",
    reason: reason || "axis-robustness-diagnostics-unavailable",
    toleranceLevels: levels.slice(),
    toleranceSweep: levels.map(tolerance => ({
      tolerance,
      status: "unavailable",
      reason: reason || "axis-robustness-diagnostics-unavailable",
      selectedPrimitiveCandidateIndex: null,
      selectedPrimitiveSpacing: null,
      toleranceSupportedCandidates: []
    })),
    firstIdentification: {
      status: "unavailable",
      reason: "primitive-identification-unavailable-across-tolerance-sweep",
      tolerance: null,
      candidateIndex: null,
      spacing: null
    },
    stabilityEnvelope: {
      status: "unavailable",
      reason: "primitive-identification-unavailable-across-tolerance-sweep",
      candidateIndex: null,
      spacing: null,
      startTolerance: null,
      endTolerance: null,
      evaluatedTolerances: [],
      stableThroughLastEvaluatedTolerance: false,
      firstDifferentState: null
    },
    firstAmbiguity: {
      status: "unavailable",
      reason: "ambiguity-unavailable-across-tolerance-sweep",
      tolerance: null,
      competingCandidates: []
    },
    candidateIdentityChanges: [],
    groundTruthValidation: {
      status: "unavailable",
      reason: "selected-primitive-candidate-unavailable",
      firstIdentifiedPrimitiveRelation: null,
      stabilityEnvelopeRelations: [],
      fullStabilityEnvelopeCompatibleWithConfirmedLattice: null
    }
  };
}

function validateToleranceLevels(levels) {
  if (!Array.isArray(levels) || levels.length === 0) {
    throw new Error("toleranceLevels must be a non-empty array");
  }

  levels.forEach((level, index) => {
    if (!Number.isFinite(level) || level <= 0 || level >= 1) {
      throw new Error(
        "toleranceLevels must contain finite numbers greater than 0 and less than 1"
      );
    }

    if (index > 0 && level <= levels[index - 1]) {
      throw new Error("toleranceLevels must be strictly increasing");
    }
  });
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)])
    );
  }

  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
