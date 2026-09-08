const DEFAULT_NEIGHBORHOOD_RADIUS = 1;

export function createGridLineIntersectionObservations({
  lineObservations,
  binaryImage = null,
  neighborhoodRadius = DEFAULT_NEIGHBORHOOD_RADIUS
} = {}) {
  validateLineObservations(lineObservations);
  validateNonNegativeInteger(neighborhoodRadius, "neighborhoodRadius");

  const horizontal = lineObservations.axes.horizontal.observations;
  const vertical = lineObservations.axes.vertical.observations;
  const imageAvailable = isCompatibleBinaryImage(binaryImage);
  const coordinateSpace = readSharedCoordinateSpace(horizontal, vertical);
  const pairs = [];

  horizontal.forEach((horizontalObservation, horizontalOrder) => {
    vertical.forEach((verticalObservation, verticalOrder) => {
      pairs.push(createIntersectionObservation({
        horizontalObservation,
        verticalObservation,
        horizontalOrder,
        verticalOrder,
        binaryImage,
        imageAvailable,
        coordinateSpace,
        neighborhoodRadius
      }));
    });
  });

  const availableCount = pairs.filter(value => value.status === "available")
    .length;
  const partialCount = pairs.filter(value => value.status === "partial")
    .length;
  const unavailableCount = pairs.length - availableCount - partialCount;

  return deepFreeze({
    type: "grid-line-intersection-observation-set",
    version: 1,
    status: !imageAvailable
      ? "unavailable"
      : unavailableCount === pairs.length && pairs.length > 0
      ? "unavailable"
      : unavailableCount > 0 || partialCount > 0
        ? "partial"
        : "available",
    coordinateSpace,
    analysisRegionProvenance:
      lineObservations.analysisRegionProvenance ?? null,
    parameters: {
      neighborhoodRadius,
      neighborhoodBasis: "projection-peak-run-rectangle"
    },
    sourceObservationCounts: {
      horizontal: horizontal.length,
      vertical: vertical.length
    },
    pairCount: pairs.length,
    pairs,
    evidenceInventory: {
      available: availableCount,
      partial: partialCount,
      unavailable: unavailableCount,
      strokePresent: pairs.filter(
        value => value.strokeEvidence.present === true
      ).length,
      strokeMissing: pairs.filter(
        value => value.strokeEvidence.present === false
      ).length
    },
    diagnostics: [{
      code: "grid-line-intersections-are-non-authoritative",
      currentCandidateAdmissionBehavior: "unchanged"
    }],
    reasons: imageAvailable ? [] : ["binary-image-unavailable"]
  });
}

function createIntersectionObservation({
  horizontalObservation,
  verticalObservation,
  horizontalOrder,
  verticalOrder,
  binaryImage,
  imageAvailable,
  coordinateSpace,
  neighborhoodRadius
}) {
  const reasons = [];
  if (!imageAvailable) {
    reasons.push("binary-image-unavailable");
  }
  if (coordinateSpace === null) {
    reasons.push("coordinate-space-mismatch");
  }
  if (!hasRunGeometry(horizontalObservation)) {
    reasons.push("horizontal-run-geometry-unavailable");
  }
  if (!hasRunGeometry(verticalObservation)) {
    reasons.push("vertical-run-geometry-unavailable");
  }

  const requestedBounds = reasons.length === 0
    ? createRequestedBounds({
      horizontalObservation,
      verticalObservation,
      neighborhoodRadius
    })
    : null;
  const measurement = requestedBounds
    ? measureNeighborhood(binaryImage, requestedBounds)
    : createUnavailableMeasurement(reasons);
  const status = measurement.status;

  return deepFreeze({
    type: "grid-line-intersection-observation",
    version: 1,
    id: `grid-line-intersection-${horizontalObservation.id}-${verticalObservation.id}`,
    status,
    crossing: {
      x: verticalObservation.center,
      y: horizontalObservation.center
    },
    orderedCrossingPosition: {
      alongHorizontal: {
        order: verticalOrder,
        position: verticalObservation.center
      },
      alongVertical: {
        order: horizontalOrder,
        position: horizontalObservation.center
      }
    },
    sourceObservationReferences: {
      horizontal: horizontalObservation.id,
      vertical: verticalObservation.id
    },
    coordinateSpace,
    provenanceReferences: {
      analysisRegionId:
        horizontalObservation.analysisRegionProvenance?.id ?? null,
      horizontalObservationId: horizontalObservation.id,
      verticalObservationId: verticalObservation.id
    },
    strokeEvidence: measurement,
    reasons: Array.from(new Set([...reasons, ...measurement.reasons]))
  });
}

function createRequestedBounds({
  horizontalObservation,
  verticalObservation,
  neighborhoodRadius
}) {
  return {
    left: verticalObservation.runStart - neighborhoodRadius,
    right: verticalObservation.runEnd + neighborhoodRadius,
    top: horizontalObservation.runStart - neighborhoodRadius,
    bottom: horizontalObservation.runEnd + neighborhoodRadius
  };
}

function measureNeighborhood(binaryImage, requestedBounds) {
  const bounds = {
    left: Math.max(0, requestedBounds.left),
    right: Math.min(binaryImage.width - 1, requestedBounds.right),
    top: Math.max(0, requestedBounds.top),
    bottom: Math.min(binaryImage.height - 1, requestedBounds.bottom)
  };
  const clipped = bounds.left !== requestedBounds.left
    || bounds.right !== requestedBounds.right
    || bounds.top !== requestedBounds.top
    || bounds.bottom !== requestedBounds.bottom;

  if (bounds.left > bounds.right || bounds.top > bounds.bottom) {
    return createUnavailableMeasurement(["crossing-outside-binary-image"]);
  }

  let blackPixelCount = 0;
  for (let y = bounds.top; y <= bounds.bottom; y++) {
    for (let x = bounds.left; x <= bounds.right; x++) {
      if (binaryImage.data[(y * binaryImage.width) + x] === 1) {
        blackPixelCount += 1;
      }
    }
  }
  const sampledPixelCount = (bounds.right - bounds.left + 1)
    * (bounds.bottom - bounds.top + 1);

  return {
    status: clipped ? "partial" : "available",
    present: blackPixelCount > 0,
    requestedBounds,
    bounds,
    clipped,
    blackPixelCount,
    sampledPixelCount,
    reasons: clipped ? ["crossing-neighborhood-clipped"] : []
  };
}

function createUnavailableMeasurement(reasons) {
  return {
    status: "unavailable",
    present: null,
    requestedBounds: null,
    bounds: null,
    clipped: null,
    blackPixelCount: null,
    sampledPixelCount: null,
    reasons: [...reasons]
  };
}

function readSharedCoordinateSpace(horizontal, vertical) {
  const coordinateSpaces = [...horizontal, ...vertical]
    .map(value => value.coordinateSpace)
    .filter(value => typeof value === "string");
  if (coordinateSpaces.length === 0) {
    return null;
  }
  return coordinateSpaces.every(value => value === coordinateSpaces[0])
    ? coordinateSpaces[0]
    : null;
}

function hasRunGeometry(observation) {
  return Number.isInteger(observation?.runStart)
    && Number.isInteger(observation?.runEnd)
    && observation.runStart >= 0
    && observation.runEnd >= observation.runStart;
}

function validateLineObservations(lineObservations) {
  if (
    lineObservations?.type !== "grid-line-observation-set"
    || !Array.isArray(lineObservations?.axes?.horizontal?.observations)
    || !Array.isArray(lineObservations?.axes?.vertical?.observations)
  ) {
    throw new Error("GridLineObservation set is required");
  }
}

function isCompatibleBinaryImage(binaryImage) {
  return Boolean(
    Number.isInteger(binaryImage?.width)
    && binaryImage.width > 0
    && Number.isInteger(binaryImage?.height)
    && binaryImage.height > 0
    && binaryImage.data
    && binaryImage.data.length === binaryImage.width * binaryImage.height
  );
}

function validateNonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
}

function deepFreeze(value) {
  if (
    !value
    || typeof value !== "object"
    || ArrayBuffer.isView(value)
    || Object.isFrozen(value)
  ) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
