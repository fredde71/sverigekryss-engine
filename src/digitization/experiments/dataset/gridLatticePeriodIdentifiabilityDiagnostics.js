import {
  createGridLatticePeriodicityDiagnostics
} from "./gridLatticePeriodicityDiagnostics";

const REPORT_VERSION = 1;

export function createGridLatticePeriodIdentifiabilityDiagnostics({
  datasetReport,
  groundTruth
} = {}) {
  const periodicity = createGridLatticePeriodicityDiagnostics({
    datasetReport,
    groundTruth
  });
  const items = periodicity.items.map(createItemDiagnostics);
  const axes = items.flatMap(item => (
    item.lattices.flatMap(lattice => [lattice.horizontal, lattice.vertical])
  ));

  return deepFreeze({
    type: "grid-lattice-period-identifiability-diagnostics",
    version: REPORT_VERSION,
    datasetId: periodicity.datasetId,
    status: "complete",
    observationPolicy: {
      source: "grid-lattice-periodicity-diagnostics",
      residualEquivalence:
        "exact-signed-spacing-and-anchor-residual-sequence-equality",
      familyRelation: "exact-positive-integer-spacing-ratio",
      oneXSupport:
        "nearest-integer-multiple-is-one-and-spacing-residual-is-zero",
      primitiveSupport:
        "all-spacing-and-anchor-residuals-zero-with-one-x-support-and-no-equivalent-larger-period",
      identification:
        "exactly-one-observation-supported-primitive-candidate",
      equality: "exact-numeric-equality",
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
        axis.identifiability.status === "identified"
      )).length,
      ambiguousAxisCount: axes.filter(axis => (
        axis.identifiability.status === "ambiguous"
      )).length,
      unavailableAxisCount: axes.filter(axis => (
        axis.identifiability.status === "unavailable"
      )).length
    },
    items,
    unmatchedAnnotations: cloneValue(periodicity.unmatchedAnnotations)
  });
}

function createItemDiagnostics(item) {
  return {
    itemId: item.itemId,
    filename: item.filename,
    status: item.status,
    reasons: cloneValue(item.reasons),
    groundTruthStatus: item.groundTruthStatus,
    lattices: item.lattices.map(createLatticeDiagnostics)
  };
}

function createLatticeDiagnostics(lattice) {
  const horizontal = createAxisDiagnostics(lattice.horizontal);
  const vertical = createAxisDiagnostics(lattice.vertical);

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

function createAxisDiagnostics(axis) {
  if (axis?.status !== "available") {
    return createUnavailableAxis(axis?.axis, axis?.reason);
  }

  const sourceCandidates = axis.candidateFundamentalSpacings;
  const candidates = sourceCandidates.map((candidate, candidateIndex) => (
    createCandidateDiagnostics({
      candidate,
      candidateIndex,
      candidates: sourceCandidates
    })
  ));
  const supported = candidates.filter(candidate => (
    candidate.primitiveObservation.status === "supported"
  ));
  const identifiability = supported.length === 1
    ? {
      status: "identified",
      reason: null,
      identifiedPrimitiveCandidateIndex: supported[0].candidateIndex,
      identifiedPrimitiveSpacing: supported[0].fundamentalSpacing,
      observationSupportedCandidateIndexes: [supported[0].candidateIndex]
    }
    : supported.length > 1
      ? {
        status: "ambiguous",
        reason: "multiple-observation-supported-primitive-candidates",
        identifiedPrimitiveCandidateIndex: null,
        identifiedPrimitiveSpacing: null,
        observationSupportedCandidateIndexes: supported.map(candidate => (
          candidate.candidateIndex
        ))
      }
      : {
        status: "unavailable",
        reason: "observation-supported-primitive-candidate-unavailable",
        identifiedPrimitiveCandidateIndex: null,
        identifiedPrimitiveSpacing: null,
        observationSupportedCandidateIndexes: []
      };

  return {
    axis: axis.axis,
    status: "available",
    observedLinePositions: axis.observedLinePositions.slice(),
    observedAdjacentSpacings: cloneValue(axis.observedAdjacentSpacings),
    candidates,
    identifiability,
    groundTruthValidation: createGroundTruthValidation({
      identifiability,
      sourceValidation: axis.groundTruthValidation
    })
  };
}

function createCandidateDiagnostics({ candidate, candidateIndex, candidates }) {
  const spacingRelations = candidate.spacingRelations;
  const oneXIndexes = spacingRelations.flatMap((relation, spacingIndex) => (
    relation.nearestIntegerMultiple === 1 && relation.residual === 0
      ? [spacingIndex]
      : []
  ));
  const multiples = spacingRelations.map(relation => (
    relation.nearestIntegerMultiple
  ));
  const familyRelations = candidates.flatMap((other, otherIndex) => {
    if (otherIndex === candidateIndex) {
      return [];
    }

    const relation = createFamilyRelation(candidate, other);
    return relation ? [{
      candidateIndex: otherIndex,
      fundamentalSpacing: other.fundamentalSpacing,
      ...relation,
      residualBehavior: residualBehaviorEqual(candidate, other)
        ? "equivalent"
        : "different"
    }] : [];
  });
  const equivalentCandidateIndexes = candidates.flatMap((other, otherIndex) => (
    otherIndex !== candidateIndex && residualBehaviorEqual(candidate, other)
      ? [otherIndex]
      : []
  ));
  const equivalentLarger = familyRelations.filter(relation => (
    relation.residualBehavior === "equivalent"
    && relation.relation === "candidate-is-integer-divisor-of-related-candidate"
  ));
  const equivalentSmaller = familyRelations.filter(relation => (
    relation.residualBehavior === "equivalent"
    && relation.relation === "candidate-is-integer-multiple-of-related-candidate"
  ));
  const allResidualsZero = spacingRelations.every(relation => (
    relation.residual === 0
  )) && candidate.anchorConsistency.relations.every(relation => (
    relation.residual === 0
  ));
  const primitiveStatus = !allResidualsZero
    ? "not-supported-by-residuals"
    : oneXIndexes.length === 0
      ? equivalentLarger.length > 0
        ? "explainable-as-integer-divisor"
        : equivalentSmaller.length > 0
          ? "explainable-as-integer-multiple"
          : "one-x-support-unavailable"
      : equivalentLarger.length > 0
        ? "explainable-as-integer-divisor"
        : "supported";

  return {
    candidateIndex,
    fundamentalSpacing: candidate.fundamentalSpacing,
    source: cloneValue(candidate.source),
    observedOneXSpacingSupport: {
      count: oneXIndexes.length,
      observedSpacingIndexes: oneXIndexes
    },
    minimumObservedIntegerMultiple: multiples.length > 0
      ? Math.min(...multiples)
      : null,
    maximumObservedIntegerMultiple: multiples.length > 0
      ? Math.max(...multiples)
      : null,
    residualStatistics: cloneValue(candidate.residualStatistics),
    anchorIndexProgression: candidate.anchorConsistency.relations.map(
      (relation, index, relations) => ({
        anchorIndex: relation.lineIndex,
        observedPosition: relation.observedPosition,
        latticeIndex: relation.nearestIntegerMultiple,
        latticeIndexDelta: index === 0
          ? null
          : relation.nearestIntegerMultiple
            - relations[index - 1].nearestIntegerMultiple,
        residual: relation.residual,
        absoluteResidual: relation.absoluteResidual
      })
    ),
    familyRelations,
    equivalentCandidateFamily: {
      candidateIndexes: [candidateIndex, ...equivalentCandidateIndexes],
      residualBehavior: "exact-signed-residual-sequence"
    },
    primitiveObservation: {
      status: primitiveStatus,
      allObservedResidualsZero: allResidualsZero,
      explainableAsDivisorOfCandidateIndexes: equivalentLarger.map(
        relation => relation.candidateIndex
      ),
      explainableAsMultipleOfCandidateIndexes: equivalentSmaller.map(
        relation => relation.candidateIndex
      )
    }
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

function residualBehaviorEqual(first, second) {
  const firstSpacing = first.spacingRelations.map(relation => relation.residual);
  const secondSpacing = second.spacingRelations.map(relation => relation.residual);
  const firstAnchors = first.anchorConsistency.relations.map(
    relation => relation.residual
  );
  const secondAnchors = second.anchorConsistency.relations.map(
    relation => relation.residual
  );

  return arraysEqual(firstSpacing, secondSpacing)
    && arraysEqual(firstAnchors, secondAnchors);
}

function createGroundTruthValidation({
  identifiability,
  sourceValidation
}) {
  if (sourceValidation?.status !== "compared") {
    return {
      status: "unavailable",
      reason: sourceValidation?.reason
        || "ground-truth-periodicity-validation-unavailable",
      groundTruthAdjacentSpacings: [],
      candidateRelations: [],
      identifiedPrimitiveRelation: null
    };
  }

  const candidateRelations = sourceValidation.candidateRelations.map(
    relation => ({
      candidateIndex: relation.candidateIndex,
      fundamentalSpacing: relation.fundamentalSpacing,
      groundTruthSpacingRelations: cloneValue(
        relation.groundTruthSpacingRelations
      ),
      residualStatistics: cloneValue(relation.residualStatistics),
      compatibleWithConfirmedLattice:
        relation.compatibleWithConfirmedLattice
    })
  );
  const identifiedPrimitiveRelation = identifiability.status === "identified"
    ? cloneValue(candidateRelations.find(relation => (
      relation.candidateIndex
      === identifiability.identifiedPrimitiveCandidateIndex
    )) ?? null)
    : null;

  return {
    status: "compared",
    reason: identifiability.status === "identified"
      ? null
      : "identified-primitive-candidate-unavailable",
    groundTruthAdjacentSpacings: cloneValue(
      sourceValidation.groundTruthAdjacentSpacings
    ),
    candidateRelations,
    identifiedPrimitiveRelation
  };
}

function createUnavailableAxis(axis, reason) {
  return {
    axis: axis ?? null,
    status: "unavailable",
    reason: reason || "periodicity-observations-unavailable",
    observedLinePositions: [],
    observedAdjacentSpacings: [],
    candidates: [],
    identifiability: {
      status: "unavailable",
      reason: "periodicity-observations-unavailable",
      identifiedPrimitiveCandidateIndex: null,
      identifiedPrimitiveSpacing: null,
      observationSupportedCandidateIndexes: []
    },
    groundTruthValidation: {
      status: "unavailable",
      reason: "periodicity-observations-unavailable",
      groundTruthAdjacentSpacings: [],
      candidateRelations: [],
      identifiedPrimitiveRelation: null
    }
  };
}

function arraysEqual(first, second) {
  return first.length === second.length
    && first.every((value, index) => value === second[index]);
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
