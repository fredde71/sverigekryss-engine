const ALLOWED_ENVIRONMENTS = new Set(["development", "test"]);
const AXES = Object.freeze(["horizontal", "vertical"]);

export function createLatticeConditionedGridLineEvidenceDiagnostics({
  reconstructionResult,
  ridgeDiagnostics,
  readEnvironment = () => process.env.NODE_ENV
} = {}) {
  assertDevelopmentEnvironment(readEnvironment());
  const unavailableReason = validateInputs(
    reconstructionResult,
    ridgeDiagnostics
  );
  if (unavailableReason) {
    return freezeValue({
      type: "lattice-conditioned-grid-line-evidence-diagnostics",
      version: 1,
      status: "unavailable",
      coordinateSpace: null,
      sourceArtifacts: createSourceReferences(
        reconstructionResult,
        ridgeDiagnostics
      ),
      axes: createUnavailableAxes(unavailableReason),
      diagnostics: [createObservationalDiagnostic()],
      reasons: [unavailableReason]
    });
  }

  const lattice = reconstructionResult.lattice;
  const alignedGeometry = reconstructionResult.imageAlignedGridLineGeometry;
  const axes = Object.fromEntries(AXES.map(axis => [
    axis,
    createAxisQueries({
      axis,
      latticeAxis: lattice.axes[axis],
      alignedAxis: alignedGeometry?.axes?.[axis] ?? null,
      ridgeAxis: ridgeDiagnostics.axes[axis]
    })
  ]));

  return freezeValue({
    type: "lattice-conditioned-grid-line-evidence-diagnostics",
    version: 1,
    status: "complete",
    coordinateSpace: lattice.coordinateSystem.space,
    sourceArtifacts: createSourceReferences(
      reconstructionResult,
      ridgeDiagnostics
    ),
    queryPolicy: {
      modeledPositionSource: "selected-grid-lattice",
      strongAnchorSource: "selected-axis-candidate-observed-assignment",
      imageEvidenceSource: "pre-local-maximum-projection-ridge-fragments",
      integerSampleNeighborhood: "positions-within-one-pixel-of-modeled-position",
      weakSupportPredicate: "non-zero-raw-projection-at-any-sampled-position",
      nonLatticeControlPosition: "adjacent-modeled-position-midpoint"
    },
    axes,
    diagnostics: [createObservationalDiagnostic()],
    reasons: []
  });
}

function createAxisQueries({ axis, latticeAxis, alignedAxis, ridgeAxis }) {
  const observedIndexes = new Set(
    Array.isArray(alignedAxis?.linePositions)
      ? alignedAxis.linePositions
        .filter(value => value.status === "observed")
        .map(value => value.latticeIndex)
      : []
  );
  const latticeQueries = latticeAxis.positions.map((position, latticeIndex) => (
    createQuery({
      id: `${axis}-lattice-query-${String(latticeIndex).padStart(4, "0")}`,
      queryType: "lattice-index",
      axis,
      position,
      latticeIndex,
      strongObservedAnchor: observedIndexes.has(latticeIndex),
      ridgeAxis
    })
  ));
  const nonLatticeQueries = latticeAxis.positions.slice(1).map(
    (position, index) => createQuery({
      id: `${axis}-non-lattice-control-${String(index).padStart(4, "0")}`,
      queryType: "adjacent-lattice-midpoint-control",
      axis,
      position: (latticeAxis.positions[index] + position) / 2,
      latticeIndex: null,
      betweenLatticeIndexes: [index, index + 1],
      strongObservedAnchor: false,
      ridgeAxis
    })
  );

  return {
    status: "available",
    axis,
    latticeQueries,
    nonLatticeQueries,
    inventory: {
      latticePositionCount: latticeQueries.length,
      strongObservedAnchorCount: countState(
        latticeQueries,
        "strong-observed-anchor"
      ),
      weakSupportingImageEvidenceCount: countState(
        latticeQueries,
        "weak-supporting-image-evidence"
      ),
      noSupportingImageEvidenceCount: countState(
        latticeQueries,
        "no-supporting-image-evidence"
      ),
      unresolvedCount: countState(latticeQueries, "unresolved"),
      nonLatticeControlCount: nonLatticeQueries.length,
      nonLatticeWeakSupportCount: countState(
        nonLatticeQueries,
        "weak-supporting-image-evidence"
      ),
      nonLatticeNoSupportCount: countState(
        nonLatticeQueries,
        "no-supporting-image-evidence"
      ),
      nonLatticeUnresolvedCount: countState(
        nonLatticeQueries,
        "unresolved"
      )
    },
    reasons: []
  };
}

function createQuery({
  id,
  queryType,
  axis,
  position,
  latticeIndex,
  betweenLatticeIndexes = null,
  strongObservedAnchor,
  ridgeAxis
}) {
  const sampledPositions = readSampledPositions(
    axis,
    position,
    ridgeAxis.positions
  );
  const available = Number.isFinite(position) && sampledPositions.length > 0;
  const hasImageEvidence = available && sampledPositions.some(
    sample => sample.rawProjectionValue > 0
  );
  const supportState = !available
    ? "unresolved"
    : strongObservedAnchor
      ? "strong-observed-anchor"
      : hasImageEvidence
        ? "weak-supporting-image-evidence"
        : "no-supporting-image-evidence";

  return {
    id,
    queryType,
    axis,
    latticeIndex,
    betweenLatticeIndexes,
    modeledPosition: position,
    supportState,
    strongObservedAnchor,
    sampledPositions,
    reasons: available ? [] : ["modeled-position-outside-ridge-evidence"]
  };
}

function readSampledPositions(axis, position, positions) {
  if (!Number.isFinite(position) || positions.length === 0) {
    return [];
  }
  const start = Math.max(0, Math.ceil(position - 1));
  const end = Math.min(positions.length - 1, Math.floor(position + 1));
  if (start > end) {
    return [];
  }
  return positions.slice(start, end + 1).map(value => ({
    position: value.position,
    offsetFromModeledPosition: value.position - position,
    rawProjectionValue: value.rawProjectionValue,
    segmentCount: value.fragmentDistribution.segmentCount,
    totalStrokeLength: value.fragmentDistribution.totalStrokeLength,
    longestSegmentLength: value.fragmentDistribution.longestSegmentLength,
    sourcePositionReference: axisPositionReference(axis, value.position)
  }));
}

function axisPositionReference(axis, position) {
  return `projection-ridge-position-${axis}-${String(position).padStart(6, "0")}`;
}

function countState(queries, state) {
  return queries.filter(value => value.supportState === state).length;
}

function validateInputs(reconstructionResult, ridgeDiagnostics) {
  if (
    reconstructionResult?.type !== "grid-lattice-reconstruction-result"
    || reconstructionResult.status !== "available"
    || reconstructionResult.lattice?.status !== "available"
  ) {
    return "available-grid-lattice-reconstruction-required";
  }
  if (
    ridgeDiagnostics?.type !== "projection-ridge-fragment-diagnostics"
    || ridgeDiagnostics.status !== "complete"
  ) {
    return "projection-ridge-fragment-diagnostics-required";
  }
  if (AXES.some(axis => (
    !Array.isArray(reconstructionResult.lattice.axes?.[axis]?.positions)
    || !Array.isArray(ridgeDiagnostics.axes?.[axis]?.positions)
  ))) {
    return "axis-evidence-unavailable";
  }
  return null;
}

function createSourceReferences(reconstructionResult, ridgeDiagnostics) {
  return {
    reconstruction: {
      type: reconstructionResult?.type ?? null,
      version: reconstructionResult?.version ?? null,
      status: reconstructionResult?.status ?? "unavailable",
      latticeId: reconstructionResult?.lattice?.id ?? null
    },
    ridgeFragments: {
      type: ridgeDiagnostics?.type ?? null,
      version: ridgeDiagnostics?.version ?? null,
      status: ridgeDiagnostics?.status ?? "unavailable"
    }
  };
}

function createUnavailableAxes(reason) {
  return Object.fromEntries(AXES.map(axis => [axis, {
    status: "unavailable",
    axis,
    latticeQueries: [],
    nonLatticeQueries: [],
    inventory: null,
    reasons: [reason]
  }]));
}

function createObservationalDiagnostic() {
  return {
    code: "lattice-conditioned-image-evidence-is-observational",
    candidateCreated: false,
    admissionChanged: false,
    reconstructionChanged: false,
    groundTruthAccessed: false
  };
}

function assertDevelopmentEnvironment(environment) {
  if (!ALLOWED_ENVIRONMENTS.has(environment)) {
    throw new Error(
      "Lattice-conditioned grid-line evidence diagnostics are available only in development or test"
    );
  }
}

function freezeValue(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(freezeValue);
  return Object.freeze(value);
}
