import {
  createGridLatticeGeometryDiagnostics
} from "./gridLatticeGeometryDiagnostics";

const REPORT_VERSION = 1;

export function createGridLatticePeriodicityDiagnostics({
  datasetReport,
  groundTruth
} = {}) {
  const geometryReport = createGridLatticeGeometryDiagnostics({
    datasetReport,
    groundTruth
  });
  const items = geometryReport.items.map(createItemDiagnostics);
  const axes = items.flatMap(item => (
    item.lattices.flatMap(lattice => [lattice.horizontal, lattice.vertical])
  ));

  return deepFreeze({
    type: "grid-lattice-periodicity-diagnostics",
    version: REPORT_VERSION,
    datasetId: geometryReport.datasetId,
    status: "complete",
    observationPolicy: {
      candidateDerivation:
        "each-observed-adjacent-spacing-divided-by-ordered-positive-integers",
      maximumMultiple:
        "number-of-observed-adjacent-spacings-on-the-axis",
      nearestMultiple: "nearest-positive-integer-lowest-on-tie",
      equality: "exact-numeric-equality",
      residual: "observed-spacing-minus-candidate-spacing-times-multiple",
      anchorResidual:
        "observed-position-offset-from-first-anchor-minus-candidate-spacing-times-multiple",
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
      availableAxisCount: axes.filter(axis => axis.status === "available").length,
      unavailableAxisCount: axes.filter(axis => axis.status === "unavailable").length,
      candidateFundamentalSpacingCount: axes.reduce(
        (count, axis) => count + axis.candidateFundamentalSpacings.length,
        0
      )
    },
    items,
    unmatchedAnnotations: cloneValue(geometryReport.unmatchedAnnotations)
  });
}

function createItemDiagnostics(item) {
  return {
    itemId: item.itemId,
    filename: item.filename,
    status: item.lattices.length === 0
      ? "unavailable"
      : item.lattices.every(lattice => lattice.status === "available")
        ? "available"
        : "partial",
    reasons: cloneValue(item.reasons),
    groundTruthStatus: item.groundTruthStatus,
    lattices: item.lattices.map(lattice => createLatticeDiagnostics(lattice))
  };
}

function createLatticeDiagnostics(lattice) {
  const horizontal = createAxisDiagnostics(lattice.horizontalLattice);
  const vertical = createAxisDiagnostics(lattice.verticalLattice);

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
  if (axis?.status !== "compared") {
    return createUnavailableAxis(axis?.reason || "axis-observations-unavailable");
  }

  const observedLinePositions = axis.observedLinePositions.slice();
  const observedAdjacentSpacings = cloneValue(axis.adjacentSpacings);
  const spacingValues = observedAdjacentSpacings.map(entry => entry.spacing);

  if (spacingValues.length === 0 || spacingValues.some(spacing => spacing <= 0)) {
    return {
      ...createUnavailableAxis("positive-adjacent-spacing-unavailable"),
      axis: axis.axis,
      observedLinePositions,
      observedAdjacentSpacings
    };
  }

  const maximumMultiple = spacingValues.length;
  const candidates = deriveCandidateFundamentals({
    observedAdjacentSpacings,
    observedLinePositions,
    maximumMultiple
  });
  const groundTruthPositions =
    axis.relationToGroundTruth?.groundTruthLinePositions;
  const groundTruthValidation = Array.isArray(groundTruthPositions)
    ? createGroundTruthValidation({
      groundTruthPositions,
      candidates
    })
    : {
      status: "unavailable",
      reason: "ground-truth-line-positions-unavailable",
      groundTruthLinePositions: [],
      groundTruthAdjacentSpacings: [],
      candidateRelations: []
    };

  return {
    axis: axis.axis,
    status: "available",
    observedLinePositions,
    observedAdjacentSpacings,
    candidateEnumeration: {
      status: "complete",
      maximumMultiple,
      sourceSpacingCount: spacingValues.length,
      duplicateCandidateCount: candidates.duplicateCount
    },
    candidateFundamentalSpacings: candidates.values,
    groundTruthValidation
  };
}

function deriveCandidateFundamentals({
  observedAdjacentSpacings,
  observedLinePositions,
  maximumMultiple
}) {
  const values = [];
  const seen = new Set();
  let duplicateCount = 0;

  observedAdjacentSpacings.forEach((spacing, spacingIndex) => {
    for (let divisor = 1; divisor <= maximumMultiple; divisor++) {
      const fundamentalSpacing = spacing.spacing / divisor;
      const key = numberKey(fundamentalSpacing);

      if (seen.has(key)) {
        duplicateCount++;
        continue;
      }

      seen.add(key);
      const spacingRelations = observedAdjacentSpacings.map(entry => (
        createSpacingRelation(entry, fundamentalSpacing)
      ));
      const residuals = spacingRelations.map(relation => relation.residual);
      const anchorRelations = createAnchorRelations(
        observedLinePositions,
        fundamentalSpacing
      );

      values.push({
        candidateIndex: values.length,
        fundamentalSpacing,
        source: {
          adjacentSpacingIndex: spacingIndex,
          spacing: spacing.spacing,
          integerDivisor: divisor
        },
        spacingRelations,
        explainedSpacingCount: spacingRelations.filter(
          relation => relation.explained
        ).length,
        unexplainedSpacingCount: spacingRelations.filter(
          relation => !relation.explained
        ).length,
        residualStatistics: createResidualStatistics(residuals),
        anchorConsistency: {
          status: "observed",
          anchorPosition: observedLinePositions[0],
          relations: anchorRelations,
          consistent: anchorRelations.every(relation => relation.residual === 0)
        }
      });
    }
  });

  return { values, duplicateCount };
}

function createGroundTruthValidation({ groundTruthPositions, candidates }) {
  const adjacent = createAdjacentSpacings(groundTruthPositions);

  return {
    status: adjacent.length > 0 ? "compared" : "unavailable",
    reason: adjacent.length > 0 ? null : "ground-truth-adjacent-spacing-unavailable",
    groundTruthLinePositions: groundTruthPositions.slice(),
    groundTruthAdjacentSpacings: adjacent,
    candidateRelations: candidates.values.map(candidate => {
      const spacingRelations = adjacent.map(entry => (
        createSpacingRelation(entry, candidate.fundamentalSpacing)
      ));
      const anchorRelations = createAnchorRelations(
        groundTruthPositions,
        candidate.fundamentalSpacing
      );

      return {
        candidateIndex: candidate.candidateIndex,
        fundamentalSpacing: candidate.fundamentalSpacing,
        groundTruthSpacingRelations: spacingRelations,
        residualStatistics: createResidualStatistics(
          spacingRelations.map(relation => relation.residual)
        ),
        groundTruthAnchorRelations: anchorRelations,
        compatibleWithConfirmedLattice:
          spacingRelations.length > 0
          && spacingRelations.every(relation => relation.residual === 0)
          && anchorRelations.every(relation => relation.residual === 0)
      };
    })
  };
}

function createSpacingRelation(spacing, fundamentalSpacing) {
  const multiple = nearestPositiveInteger(spacing.spacing / fundamentalSpacing);
  const modeledSpacing = fundamentalSpacing * multiple;
  const residual = normalizeZero(spacing.spacing - modeledSpacing);

  return {
    fromLineIndex: spacing.fromLineIndex,
    toLineIndex: spacing.toLineIndex,
    observedSpacing: spacing.spacing,
    nearestIntegerMultiple: multiple,
    modeledSpacing,
    residual,
    absoluteResidual: Math.abs(residual),
    explained: residual === 0
  };
}

function createAnchorRelations(positions, fundamentalSpacing) {
  if (positions.length === 0) {
    return [];
  }

  const anchor = positions[0];

  return positions.map((position, lineIndex) => {
    const offset = position - anchor;
    const multiple = lineIndex === 0
      ? 0
      : nearestPositiveInteger(offset / fundamentalSpacing);
    const modeledOffset = fundamentalSpacing * multiple;
    const residual = normalizeZero(offset - modeledOffset);

    return {
      lineIndex,
      observedPosition: position,
      offsetFromAnchor: offset,
      nearestIntegerMultiple: multiple,
      modeledPosition: anchor + modeledOffset,
      residual,
      absoluteResidual: Math.abs(residual)
    };
  });
}

function createAdjacentSpacings(positions) {
  const spacings = [];

  for (let index = 1; index < positions.length; index++) {
    spacings.push({
      fromLineIndex: index - 1,
      toLineIndex: index,
      fromPosition: positions[index - 1],
      toPosition: positions[index],
      spacing: positions[index] - positions[index - 1]
    });
  }

  return spacings;
}

function createResidualStatistics(residuals) {
  if (residuals.length === 0) {
    return {
      status: "unavailable",
      count: 0,
      minimum: null,
      maximum: null,
      maximumAbsolute: null,
      averageAbsolute: null,
      medianAbsolute: null,
      rms: null
    };
  }

  const absolute = residuals.map(Math.abs).sort((a, b) => a - b);
  const middle = Math.floor(absolute.length / 2);
  const median = absolute.length % 2 === 1
    ? absolute[middle]
    : (absolute[middle - 1] + absolute[middle]) / 2;

  return {
    status: "available",
    count: residuals.length,
    minimum: Math.min(...residuals),
    maximum: Math.max(...residuals),
    maximumAbsolute: absolute[absolute.length - 1],
    averageAbsolute: absolute.reduce((sum, value) => sum + value, 0)
      / absolute.length,
    medianAbsolute: median,
    rms: Math.sqrt(
      residuals.reduce((sum, value) => sum + value * value, 0)
      / residuals.length
    )
  };
}

function nearestPositiveInteger(value) {
  const lower = Math.max(1, Math.floor(value));
  const upper = Math.max(1, Math.ceil(value));
  const lowerDistance = Math.abs(value - lower);
  const upperDistance = Math.abs(value - upper);

  return lowerDistance <= upperDistance ? lower : upper;
}

function createUnavailableAxis(reason) {
  return {
    axis: null,
    status: "unavailable",
    reason,
    observedLinePositions: [],
    observedAdjacentSpacings: [],
    candidateEnumeration: {
      status: "unavailable",
      maximumMultiple: null,
      sourceSpacingCount: 0,
      duplicateCandidateCount: 0
    },
    candidateFundamentalSpacings: [],
    groundTruthValidation: {
      status: "unavailable",
      reason: "axis-observations-unavailable",
      groundTruthLinePositions: [],
      groundTruthAdjacentSpacings: [],
      candidateRelations: []
    }
  };
}

function numberKey(value) {
  return Object.is(value, -0) ? "0" : String(value);
}

function normalizeZero(value) {
  return Object.is(value, -0) ? 0 : value;
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
