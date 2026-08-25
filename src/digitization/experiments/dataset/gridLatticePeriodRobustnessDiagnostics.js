import {
  createGridLatticePeriodicityDiagnostics
} from "./gridLatticePeriodicityDiagnostics";

const REPORT_VERSION = 1;
export const DEFAULT_NORMALIZED_RESIDUAL_TOLERANCE = 0.05;

export function createGridLatticePeriodRobustnessDiagnostics({
  datasetReport,
  groundTruth,
  normalizedResidualTolerance = DEFAULT_NORMALIZED_RESIDUAL_TOLERANCE
} = {}) {
  validateTolerance(normalizedResidualTolerance);

  const periodicity = createGridLatticePeriodicityDiagnostics({
    datasetReport,
    groundTruth
  });
  const items = periodicity.items.map(item => createItemDiagnostics(
    item,
    normalizedResidualTolerance
  ));
  const axes = items.flatMap(item => (
    item.lattices.flatMap(lattice => [lattice.horizontal, lattice.vertical])
  ));

  return deepFreeze({
    type: "grid-lattice-period-robustness-diagnostics",
    version: REPORT_VERSION,
    datasetId: periodicity.datasetId,
    status: "complete",
    observationPolicy: {
      source: "grid-lattice-periodicity-diagnostics",
      normalizedResidual: "absolute-residual-divided-by-candidate-spacing",
      normalizedResidualTolerance,
      toleranceComparison: "less-than-or-equal",
      oneXSupport:
        "nearest-integer-multiple-is-one-and-normalized-residual-is-within-tolerance",
      familyRelation: "exact-positive-integer-spacing-ratio",
      familyEquivalence:
        "all-corresponding-normalized-residual-deltas-within-tolerance",
      primitiveSupport:
        "spacing-and-anchor-residuals-within-tolerance-with-one-x-support-and-no-equivalent-larger-period",
      identification:
        "exactly-one-tolerance-supported-primitive-candidate",
      axesEvaluatedIndependently: true,
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
      identifiedAxisCount: axes.filter(axis => (
        axis.primitiveIdentification.status === "identified"
      )).length,
      ambiguousAxisCount: axes.filter(axis => (
        axis.primitiveIdentification.status === "ambiguous"
      )).length,
      unavailableAxisCount: axes.filter(axis => (
        axis.primitiveIdentification.status === "unavailable"
      )).length
    },
    items,
    unmatchedAnnotations: cloneValue(periodicity.unmatchedAnnotations)
  });
}

function createItemDiagnostics(item, tolerance) {
  return {
    itemId: item.itemId,
    filename: item.filename,
    status: item.status,
    reasons: cloneValue(item.reasons),
    groundTruthStatus: item.groundTruthStatus,
    lattices: item.lattices.map(lattice => (
      createLatticeDiagnostics(lattice, tolerance)
    ))
  };
}

function createLatticeDiagnostics(lattice, tolerance) {
  const horizontal = createAxisDiagnostics(lattice.horizontal, tolerance);
  const vertical = createAxisDiagnostics(lattice.vertical, tolerance);

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

function createAxisDiagnostics(axis, tolerance) {
  if (axis?.status !== "available") {
    return createUnavailableAxis(axis?.axis, axis?.reason, tolerance);
  }

  const sourceCandidates = axis.candidateFundamentalSpacings;
  const normalizedCandidates = sourceCandidates.map(normalizeCandidate);
  const candidates = normalizedCandidates.map((candidate, candidateIndex) => (
    createCandidateDiagnostics({
      candidate,
      candidateIndex,
      candidates: normalizedCandidates,
      tolerance
    })
  ));
  const supported = candidates.filter(candidate => (
    candidate.primitiveCandidateSupport.status === "supported"
  ));
  const primitiveIdentification = supported.length === 1
    ? {
      status: "identified",
      reason: null,
      selectedPrimitiveCandidateIndex: supported[0].candidateIndex,
      selectedPrimitiveSpacing: supported[0].fundamentalSpacing,
      toleranceSupportedCandidateIndexes: [supported[0].candidateIndex]
    }
    : supported.length > 1
      ? {
        status: "ambiguous",
        reason: "multiple-tolerance-supported-primitive-candidates",
        selectedPrimitiveCandidateIndex: null,
        selectedPrimitiveSpacing: null,
        toleranceSupportedCandidateIndexes: supported.map(candidate => (
          candidate.candidateIndex
        ))
      }
      : {
        status: "unavailable",
        reason: "tolerance-supported-primitive-candidate-unavailable",
        selectedPrimitiveCandidateIndex: null,
        selectedPrimitiveSpacing: null,
        toleranceSupportedCandidateIndexes: []
      };

  return {
    axis: axis.axis,
    status: "available",
    normalizedResidualTolerance: tolerance,
    observedLinePositions: axis.observedLinePositions.slice(),
    observedAdjacentSpacings: cloneValue(axis.observedAdjacentSpacings),
    candidates,
    primitiveIdentification,
    groundTruthValidation: createGroundTruthValidation({
      primitiveIdentification,
      sourceValidation: axis.groundTruthValidation,
      tolerance
    })
  };
}

function normalizeCandidate(candidate) {
  const spacingResiduals = candidate.spacingRelations.map(relation => ({
    absoluteResidual: readAbsoluteResidual(relation),
    normalizedResidual: readAbsoluteResidual(relation)
      / candidate.fundamentalSpacing,
    nearestIntegerMultiple: relation.nearestIntegerMultiple
  }));
  const anchorResiduals = candidate.anchorConsistency.relations.map(relation => ({
    absoluteResidual: readAbsoluteResidual(relation),
    normalizedResidual: readAbsoluteResidual(relation)
      / candidate.fundamentalSpacing,
    nearestIntegerMultiple: relation.nearestIntegerMultiple,
    lineIndex: relation.lineIndex,
    observedPosition: relation.observedPosition
  }));

  return {
    source: candidate,
    fundamentalSpacing: candidate.fundamentalSpacing,
    spacingResiduals,
    anchorResiduals,
    normalizedResidualSequence: [
      ...spacingResiduals.map(residual => residual.normalizedResidual),
      ...anchorResiduals.map(residual => residual.normalizedResidual)
    ]
  };
}

function createCandidateDiagnostics({
  candidate,
  candidateIndex,
  candidates,
  tolerance
}) {
  const oneXIndexes = candidate.spacingResiduals.flatMap((residual, index) => (
    residual.nearestIntegerMultiple === 1
    && residual.normalizedResidual <= tolerance
      ? [index]
      : []
  ));
  const multiples = candidate.spacingResiduals.map(residual => (
    residual.nearestIntegerMultiple
  ));
  const familyRelations = candidates.flatMap((other, otherIndex) => {
    if (otherIndex === candidateIndex) {
      return [];
    }

    const relation = createFamilyRelation(candidate, other);
    if (!relation) {
      return [];
    }

    const separation = createCandidateFamilySeparation(candidate, other);
    return [{
      candidateIndex: otherIndex,
      fundamentalSpacing: other.fundamentalSpacing,
      ...relation,
      candidateFamilySeparation: {
        ...separation,
        equivalentUnderTolerance:
          separation.maximumNormalizedResidualDelta <= tolerance,
        separatedBeyondTolerance:
          separation.maximumNormalizedResidualDelta > tolerance
      }
    }];
  });
  const equivalentRelations = familyRelations.filter(relation => (
    relation.candidateFamilySeparation.equivalentUnderTolerance
  ));
  const equivalentLarger = equivalentRelations.filter(relation => (
    relation.relation === "candidate-is-integer-divisor-of-related-candidate"
  ));
  const equivalentSmaller = equivalentRelations.filter(relation => (
    relation.relation === "candidate-is-integer-multiple-of-related-candidate"
  ));
  const spacingWithinTolerance = candidate.spacingResiduals.every(residual => (
    residual.normalizedResidual <= tolerance
  ));
  const anchorsWithinTolerance = candidate.anchorResiduals.every(residual => (
    residual.normalizedResidual <= tolerance
  ));
  const supportStatus = !spacingWithinTolerance || !anchorsWithinTolerance
    ? "outside-normalized-residual-tolerance"
    : oneXIndexes.length === 0
      ? equivalentLarger.length > 0
        ? "explainable-as-integer-divisor-under-tolerance"
        : equivalentSmaller.length > 0
          ? "explainable-as-integer-multiple-under-tolerance"
          : "one-x-support-unavailable-under-tolerance"
      : equivalentLarger.length > 0
        ? "explainable-as-integer-divisor-under-tolerance"
        : "supported";
  const allAbsoluteResiduals = [
    ...candidate.spacingResiduals.map(residual => residual.absoluteResidual),
    ...candidate.anchorResiduals.map(residual => residual.absoluteResidual)
  ];
  const allNormalizedResiduals = candidate.normalizedResidualSequence;
  const stableAnchorIndexes = candidate.anchorResiduals.flatMap(
    (residual, index) => residual.normalizedResidual <= tolerance ? [index] : []
  );

  return {
    candidateIndex,
    fundamentalSpacing: candidate.fundamentalSpacing,
    source: cloneValue(candidate.source.source),
    absoluteResidualStatistics: createStatistics(allAbsoluteResiduals),
    normalizedResidualStatistics: createStatistics(allNormalizedResiduals),
    observedOneXSupportUnderTolerance: {
      count: oneXIndexes.length,
      observedSpacingIndexes: oneXIndexes,
      normalizedResidualTolerance: tolerance
    },
    minimumObservedIntegerMultiple: multiples.length > 0
      ? Math.min(...multiples)
      : null,
    maximumObservedIntegerMultiple: multiples.length > 0
      ? Math.max(...multiples)
      : null,
    familyRelations,
    equivalentCandidateFamily: {
      candidateIndexes: [
        candidateIndex,
        ...equivalentRelations.map(relation => relation.candidateIndex)
      ],
      normalizedResidualTolerance: tolerance
    },
    primitiveCandidateSupport: {
      status: supportStatus,
      spacingResidualsWithinTolerance: spacingWithinTolerance,
      anchorResidualsWithinTolerance: anchorsWithinTolerance,
      explainableAsDivisorOfCandidateIndexes: equivalentLarger.map(
        relation => relation.candidateIndex
      ),
      explainableAsMultipleOfCandidateIndexes: equivalentSmaller.map(
        relation => relation.candidateIndex
      )
    },
    anchorStability: {
      status: candidate.anchorResiduals.length > 0 ? "observed" : "unavailable",
      normalizedResidualTolerance: tolerance,
      stableAnchorCount: stableAnchorIndexes.length,
      unstableAnchorCount:
        candidate.anchorResiduals.length - stableAnchorIndexes.length,
      stableAnchorIndexes,
      residuals: candidate.anchorResiduals.map(residual => ({
        anchorIndex: residual.lineIndex,
        observedPosition: residual.observedPosition,
        latticeIndex: residual.nearestIntegerMultiple,
        absoluteResidual: residual.absoluteResidual,
        normalizedResidual: residual.normalizedResidual,
        withinTolerance: residual.normalizedResidual <= tolerance
      })),
      stableAcrossObservedAnchors:
        candidate.anchorResiduals.length > 0
        && stableAnchorIndexes.length === candidate.anchorResiduals.length
    }
  };
}

function createCandidateFamilySeparation(candidate, other) {
  const deltas = candidate.normalizedResidualSequence.map((value, index) => (
    Math.abs(value - other.normalizedResidualSequence[index])
  ));
  const statistics = createStatistics(deltas);

  return {
    comparedResidualCount: deltas.length,
    maximumNormalizedResidualDelta: statistics.maximum,
    averageNormalizedResidualDelta: statistics.mean,
    rmsNormalizedResidualDelta: statistics.rms
  };
}

function createFamilyRelation(candidate, other) {
  const otherOverCandidate = other.fundamentalSpacing
    / candidate.fundamentalSpacing;

  if (Number.isInteger(otherOverCandidate) && otherOverCandidate > 1) {
    return {
      relation: "candidate-is-integer-divisor-of-related-candidate",
      harmonicSubharmonicRelation:
        "candidate-frequency-is-integer-harmonic-of-related-frequency",
      integerFactor: otherOverCandidate
    };
  }

  const candidateOverOther = candidate.fundamentalSpacing
    / other.fundamentalSpacing;

  if (Number.isInteger(candidateOverOther) && candidateOverOther > 1) {
    return {
      relation: "candidate-is-integer-multiple-of-related-candidate",
      harmonicSubharmonicRelation:
        "candidate-frequency-is-integer-subharmonic-of-related-frequency",
      integerFactor: candidateOverOther
    };
  }

  return null;
}

function createGroundTruthValidation({
  primitiveIdentification,
  sourceValidation,
  tolerance
}) {
  if (sourceValidation?.status !== "compared") {
    return {
      status: "unavailable",
      reason: sourceValidation?.reason
        || "ground-truth-periodicity-validation-unavailable",
      groundTruthAdjacentSpacings: [],
      candidateRelations: [],
      selectedPrimitiveRelation: null
    };
  }

  const candidateRelations = sourceValidation.candidateRelations.map(relation => {
    const normalizedResiduals = relation.groundTruthSpacingRelations.map(
      spacing => readAbsoluteResidual(spacing) / relation.fundamentalSpacing
    );

    return {
      candidateIndex: relation.candidateIndex,
      fundamentalSpacing: relation.fundamentalSpacing,
      groundTruthSpacingRelations: relation.groundTruthSpacingRelations.map(
        (spacing, index) => ({
          ...cloneValue(spacing),
          normalizedResidual: normalizedResiduals[index],
          withinTolerance: normalizedResiduals[index] <= tolerance
        })
      ),
      normalizedResidualStatistics: createStatistics(normalizedResiduals),
      compatibleWithConfirmedLattice:
        normalizedResiduals.length > 0
        && normalizedResiduals.every(residual => residual <= tolerance)
    };
  });
  const selectedPrimitiveRelation =
    primitiveIdentification.status === "identified"
      ? cloneValue(candidateRelations.find(relation => (
        relation.candidateIndex
        === primitiveIdentification.selectedPrimitiveCandidateIndex
      )) ?? null)
      : null;

  return {
    status: "compared",
    reason: primitiveIdentification.status === "identified"
      ? null
      : "selected-primitive-candidate-unavailable",
    normalizedResidualTolerance: tolerance,
    groundTruthAdjacentSpacings: cloneValue(
      sourceValidation.groundTruthAdjacentSpacings
    ),
    candidateRelations,
    selectedPrimitiveRelation
  };
}

function createStatistics(values) {
  if (values.length === 0) {
    return {
      status: "unavailable",
      count: 0,
      minimum: null,
      maximum: null,
      mean: null,
      median: null,
      rms: null
    };
  }

  const sorted = values.slice().sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);

  return {
    status: "available",
    count: values.length,
    minimum: sorted[0],
    maximum: sorted[sorted.length - 1],
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    median: sorted.length % 2 === 1
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2,
    rms: Math.sqrt(
      values.reduce((sum, value) => sum + value * value, 0) / values.length
    )
  };
}

function createUnavailableAxis(axis, reason, tolerance) {
  return {
    axis: axis ?? null,
    status: "unavailable",
    reason: reason || "periodicity-observations-unavailable",
    normalizedResidualTolerance: tolerance,
    observedLinePositions: [],
    observedAdjacentSpacings: [],
    candidates: [],
    primitiveIdentification: {
      status: "unavailable",
      reason: "periodicity-observations-unavailable",
      selectedPrimitiveCandidateIndex: null,
      selectedPrimitiveSpacing: null,
      toleranceSupportedCandidateIndexes: []
    },
    groundTruthValidation: {
      status: "unavailable",
      reason: "periodicity-observations-unavailable",
      groundTruthAdjacentSpacings: [],
      candidateRelations: [],
      selectedPrimitiveRelation: null
    }
  };
}

function readAbsoluteResidual(relation) {
  return Number.isFinite(relation?.absoluteResidual)
    ? relation.absoluteResidual
    : Math.abs(relation?.residual);
}

function validateTolerance(value) {
  if (!Number.isFinite(value) || value <= 0 || value >= 1) {
    throw new Error(
      "normalizedResidualTolerance must be a finite number greater than 0 and less than 1"
    );
  }
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
