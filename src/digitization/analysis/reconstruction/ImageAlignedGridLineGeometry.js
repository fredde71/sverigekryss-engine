import {
  cloneDeterministicValue,
  deepFreeze,
  validateDeterministicObject
} from "./GridLatticeModelSupport";

const AXES = ["horizontal", "vertical"];

export function createImageAlignedGridLineGeometry({
  id,
  gridLattice,
  selectedAxisCandidates,
  selectedCandidateReference = null,
  coordinateSystem,
  provenance = {}
} = {}) {
  validateDeterministicObject(provenance, "provenance");

  if (!gridLattice || gridLattice.status !== "available") {
    return createUnavailableGeometry({
      id: id ?? "image-aligned-grid-line-geometry-unavailable",
      coordinateSystem: coordinateSystem ?? null,
      selectedCandidateReference,
      provenance,
      reason: "selected-grid-lattice-unavailable"
    });
  }

  const artifactId = id ?? `image-aligned-${gridLattice.id}`;
  const sourceCoordinateSystem = coordinateSystem ?? gridLattice.coordinateSystem;
  validateDeterministicObject(sourceCoordinateSystem, "coordinateSystem");
  validateDeterministicObject(
    selectedAxisCandidates,
    "selectedAxisCandidates"
  );

  const axes = Object.fromEntries(AXES.map(axis => [
    axis,
    createAxisGeometry({
      axis,
      axisCandidate: selectedAxisCandidates[axis],
      expectedLineCount: readExpectedLineCount(gridLattice, axis)
    })
  ]));
  const status = combineAxisStatuses(axes);
  const reasons = AXES.flatMap(axis => axes[axis].reasons.map(reason => (
    `${axis}:${reason}`
  )));

  return deepFreeze({
    type: "image-aligned-grid-line-geometry",
    version: 1,
    id: artifactId,
    status,
    coordinateSystem: cloneDeterministicValue(sourceCoordinateSystem),
    gridDimensions: cloneDeterministicValue(gridLattice.gridDimensions),
    selectedCandidateReference: cloneDeterministicValue(
      selectedCandidateReference
    ),
    axes,
    provenance: {
      source: "selected-grid-lattice-axis-candidate-assignments",
      gridLatticeId: gridLattice.id,
      selectedCandidateReference: cloneDeterministicValue(
        selectedCandidateReference
      ),
      supplied: cloneDeterministicValue(provenance)
    },
    diagnostics: [{
      code: "observed-anchors-preserved-with-bounded-linear-interpolation",
      leadingAndTrailingPolicy: "unavailable-without-extrapolation"
    }],
    reasons
  });
}

function createAxisGeometry({ axis, axisCandidate, expectedLineCount }) {
  if (!axisCandidate || !Array.isArray(axisCandidate.assignments)) {
    return createUnavailableAxis(axis, "selected-axis-candidate-unavailable");
  }
  if (
    axisCandidate.axis !== axis
    || axisCandidate.lineCount !== expectedLineCount
    || axisCandidate.intervalCount !== expectedLineCount - 1
  ) {
    return createUnavailableAxis(axis, "selected-axis-candidate-incompatible");
  }

  const observedAnchors = axisCandidate.assignments.map((assignment, order) => ({
    order,
    anchorOrder: assignment.anchorOrder,
    latticeIndex: assignment.latticeIndex,
    observedPosition: assignment.observedPosition,
    modeledPosition: assignment.modeledPosition,
    residual: assignment.residual,
    withinCandidateExtent: assignment.withinCandidateExtent,
    evidenceReference: null
  }));
  const usableAnchors = observedAnchors.filter(anchor => (
    anchor.withinCandidateExtent === true
    && Number.isInteger(anchor.latticeIndex)
    && anchor.latticeIndex >= 0
    && anchor.latticeIndex < expectedLineCount
    && Number.isFinite(anchor.observedPosition)
  ));
  const anchorsByIndex = new Map();
  let conflictingAssignment = false;

  usableAnchors.forEach(anchor => {
    const existing = anchorsByIndex.get(anchor.latticeIndex);
    if (existing && existing.observedPosition !== anchor.observedPosition) {
      conflictingAssignment = true;
      return;
    }
    if (!existing) {
      anchorsByIndex.set(anchor.latticeIndex, anchor);
    }
  });

  if (conflictingAssignment) {
    return deepFreeze({
      ...createUnavailableAxis(axis, "conflicting-observed-anchor-assignments"),
      status: "ambiguous",
      selectedAxisCandidateReference: createAxisCandidateReference(axisCandidate),
      observedAnchors: cloneDeterministicValue(observedAnchors),
      provenance: createAxisProvenance(axisCandidate)
    });
  }

  const orderedUsableAnchors = Array.from(anchorsByIndex.values()).sort(
    (left, right) => left.latticeIndex - right.latticeIndex
      || left.order - right.order
  );
  const linePositions = Array.from(
    { length: expectedLineCount },
    (_value, latticeIndex) => createLinePosition({
      latticeIndex,
      anchorsByIndex,
      orderedUsableAnchors
    })
  );
  const observedCount = linePositions.filter(
    value => value.status === "observed"
  ).length;
  const interpolatedCount = linePositions.filter(
    value => value.status === "interpolated"
  ).length;
  const unavailableCount = linePositions.filter(
    value => value.status === "unavailable"
  ).length;
  const reasons = [];
  if (usableAnchors.length === 0) {
    reasons.push("observed-anchor-assignments-unavailable");
  }
  if (unavailableCount > 0) {
    reasons.push("leading-or-trailing-line-positions-unavailable");
  }

  return deepFreeze({
    status: unavailableCount === 0
      ? "available"
      : observedCount + interpolatedCount > 0 ? "partial" : "unavailable",
    axis,
    selectedAxisCandidateReference: createAxisCandidateReference(axisCandidate),
    lineCount: expectedLineCount,
    observedAnchors: cloneDeterministicValue(observedAnchors),
    linePositions,
    observedCount,
    interpolatedCount,
    unavailableCount,
    provenance: createAxisProvenance(axisCandidate),
    diagnostics: [{
      code: "axis-image-aligned-line-positions",
      observedAnchorCount: usableAnchors.length,
      sourceAssignmentCount: observedAnchors.length
    }],
    reasons
  });
}

function createLinePosition({
  latticeIndex,
  anchorsByIndex,
  orderedUsableAnchors
}) {
  const observed = anchorsByIndex.get(latticeIndex);
  if (observed) {
    return {
      latticeIndex,
      position: observed.observedPosition,
      status: "observed",
      evidenceReferences: observed.evidenceReference
        ? [observed.evidenceReference]
        : [],
      interpolation: null
    };
  }

  const previous = findPreviousAnchor(orderedUsableAnchors, latticeIndex);
  const next = findNextAnchor(orderedUsableAnchors, latticeIndex);
  if (!previous || !next) {
    return {
      latticeIndex,
      position: null,
      status: "unavailable",
      evidenceReferences: [],
      interpolation: null
    };
  }

  const ratio = (latticeIndex - previous.latticeIndex)
    / (next.latticeIndex - previous.latticeIndex);
  return {
    latticeIndex,
    position: previous.observedPosition
      + ratio * (next.observedPosition - previous.observedPosition),
    status: "interpolated",
    evidenceReferences: [previous, next]
      .map(anchor => anchor.evidenceReference)
      .filter(Boolean),
    interpolation: {
      startLatticeIndex: previous.latticeIndex,
      startObservedPosition: previous.observedPosition,
      endLatticeIndex: next.latticeIndex,
      endObservedPosition: next.observedPosition
    }
  };
}

function findPreviousAnchor(anchors, latticeIndex) {
  let result = null;
  for (const anchor of anchors) {
    if (anchor.latticeIndex >= latticeIndex) {
      break;
    }
    result = anchor;
  }
  return result;
}

function findNextAnchor(anchors, latticeIndex) {
  return anchors.find(anchor => anchor.latticeIndex > latticeIndex) ?? null;
}

function createAxisCandidateReference(candidate) {
  return {
    id: candidate.id,
    axis: candidate.axis,
    axisBoundsId: candidate.axisBoundsId ?? null,
    intervalCount: candidate.intervalCount,
    lineCount: candidate.lineCount,
    primitivePeriodCandidateId:
      candidate.provenance?.primitivePeriodCandidateId ?? null
  };
}

function createAxisProvenance(candidate) {
  return {
    source: "selected-axis-candidate-assignments",
    axisCandidateId: candidate.id,
    evidenceReferences: cloneDeterministicValue(
      candidate.evidenceReferences ?? []
    ),
    axisCandidate: cloneDeterministicValue(candidate.provenance ?? {})
  };
}

function readExpectedLineCount(gridLattice, axis) {
  const intervalCount = axis === "horizontal"
    ? gridLattice.gridDimensions?.rows
    : gridLattice.gridDimensions?.cols;
  if (!Number.isInteger(intervalCount) || intervalCount < 1) {
    throw new Error(`GridLattice ${axis} interval count is invalid`);
  }
  return intervalCount + 1;
}

function combineAxisStatuses(axes) {
  const statuses = AXES.map(axis => axes[axis].status);
  if (statuses.includes("ambiguous")) {
    return "ambiguous";
  }
  if (statuses.every(status => status === "available")) {
    return "available";
  }
  if (statuses.every(status => status === "unavailable")) {
    return "unavailable";
  }
  return "partial";
}

function createUnavailableAxis(axis, reason) {
  return deepFreeze({
    status: "unavailable",
    axis,
    selectedAxisCandidateReference: null,
    lineCount: 0,
    observedAnchors: [],
    linePositions: [],
    observedCount: 0,
    interpolatedCount: 0,
    unavailableCount: 0,
    provenance: null,
    diagnostics: [],
    reasons: [reason]
  });
}

function createUnavailableGeometry({
  id,
  coordinateSystem,
  selectedCandidateReference,
  provenance,
  reason
}) {
  const axes = Object.fromEntries(AXES.map(axis => [
    axis,
    createUnavailableAxis(axis, reason)
  ]));
  return deepFreeze({
    type: "image-aligned-grid-line-geometry",
    version: 1,
    id,
    status: "unavailable",
    coordinateSystem: coordinateSystem
      ? cloneDeterministicValue(coordinateSystem)
      : null,
    gridDimensions: null,
    selectedCandidateReference: cloneDeterministicValue(
      selectedCandidateReference
    ),
    axes,
    provenance: {
      source: "selected-grid-lattice-axis-candidate-assignments",
      supplied: cloneDeterministicValue(provenance)
    },
    diagnostics: [],
    reasons: [reason]
  });
}
