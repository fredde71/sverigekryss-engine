import {
  createHorizontalProjection,
  createVerticalProjection
} from "../analysis/Projection";

const ALLOWED_ENVIRONMENTS = new Set(["development", "test"]);
const AXES = Object.freeze(["horizontal", "vertical"]);

export const projectionRidgeFragmentDiagnosticsExperiment = Object.freeze({
  id: "projection-ridge-fragment-diagnostics",
  description: "Observe projection and collinear stroke-fragment evidence at every axis position before local-maximum extraction.",
  run(binaryImage, context = {}) {
    return createProjectionRidgeFragmentDiagnostics({
      binaryImage,
      analysisContext: context
    });
  }
});

export function createProjectionRidgeFragmentDiagnostics({
  binaryImage,
  analysisContext = {},
  readEnvironment = () => process.env.NODE_ENV
} = {}) {
  assertDevelopmentEnvironment(readEnvironment());
  const snapshot = snapshotBinaryImage(binaryImage);
  const projections = {
    horizontal: createHorizontalProjection(snapshot),
    vertical: createVerticalProjection(snapshot)
  };
  const axes = Object.fromEntries(AXES.map(axis => [
    axis,
    createAxisEvidence({ axis, binaryImage: snapshot, projection: projections[axis] })
  ]));

  return freezeValue({
    type: "projection-ridge-fragment-diagnostics",
    version: 1,
    status: "complete",
    coordinateSpace: "analysis-region-local",
    analysisRegionProvenance: cloneValue(
      analysisContext.coordinateProvenance?.analysisRegion ?? null
    ),
    extractionBoundary: {
      input: "analysis-region-binary-image",
      output: "per-axis-position-fragment-observations",
      occursBefore: "positive-local-maximum-plateau-extraction"
    },
    axes,
    diagnostics: [{
      code: "projection-ridge-fragment-evidence-is-observational",
      localMaximumRequired: false,
      candidateCreated: false,
      admissionChanged: false,
      classificationApplied: false,
      groundTruthAccessed: false
    }],
    reasons: []
  });
}

function createAxisEvidence({ axis, binaryImage, projection }) {
  const positionCount = axis === "horizontal"
    ? binaryImage.height
    : binaryImage.width;
  const tangentialLength = axis === "horizontal"
    ? binaryImage.width
    : binaryImage.height;
  const segmentsByPosition = Array.from(
    { length: positionCount },
    (_value, position) => readSegments(binaryImage, axis, position)
  );
  const positions = segmentsByPosition.map((segments, position) => ({
    position,
    rawProjectionValue: projection[position],
    orderedTangentialStrokeSegments: segments.map(segment => ({ ...segment })),
    fragmentDistribution: createFragmentDistribution(
      segments,
      tangentialLength
    ),
    adjacentPersistence: {
      previous: createAdjacentPersistence(
        segments,
        segmentsByPosition[position - 1],
        -1,
        position
      ),
      next: createAdjacentPersistence(
        segments,
        segmentsByPosition[position + 1],
        1,
        position
      )
    }
  }));

  return {
    status: "available",
    axis,
    positionCount,
    tangentialLength,
    positions,
    reasons: []
  };
}

function readSegments(binaryImage, axis, position) {
  const tangentialLength = axis === "horizontal"
    ? binaryImage.width
    : binaryImage.height;
  const segments = [];
  let start = null;

  for (let tangent = 0; tangent <= tangentialLength; tangent++) {
    const black = tangent < tangentialLength
      && readPixel(binaryImage, axis, position, tangent) === 1;
    if (black && start === null) {
      start = tangent;
    }
    if (!black && start !== null) {
      segments.push({
        start,
        end: tangent - 1,
        length: tangent - start
      });
      start = null;
    }
  }

  return segments;
}

function readPixel(binaryImage, axis, position, tangent) {
  const x = axis === "horizontal" ? tangent : position;
  const y = axis === "horizontal" ? position : tangent;
  return binaryImage.data[(y * binaryImage.width) + x];
}

function createFragmentDistribution(segments, tangentialLength) {
  const totalStrokeLength = segments.reduce(
    (total, segment) => total + segment.length,
    0
  );
  const first = segments[0] ?? null;
  const last = segments[segments.length - 1] ?? null;
  const interSegmentGaps = segments.slice(1).map((segment, index) => {
    const previous = segments[index];
    return {
      start: previous.end + 1,
      end: segment.start - 1,
      length: segment.start - previous.end - 1
    };
  });

  return {
    segmentCount: segments.length,
    totalStrokeLength,
    longestSegmentLength: segments.reduce(
      (maximum, segment) => Math.max(maximum, segment.length),
      0
    ),
    firstStrokePosition: first?.start ?? null,
    lastStrokePosition: last?.end ?? null,
    occupiedSpanLength: first && last ? last.end - first.start + 1 : 0,
    leadingBlankLength: first?.start ?? tangentialLength,
    trailingBlankLength: last ? tangentialLength - last.end - 1 : tangentialLength,
    interSegmentGaps
  };
}

function createAdjacentPersistence(current, adjacent, offset, position) {
  if (!adjacent) {
    return {
      status: "unavailable",
      adjacentOffset: offset,
      adjacentPosition: null,
      currentSegmentCount: current.length,
      adjacentSegmentCount: null,
      overlappingCurrentSegmentCount: null,
      overlappingAdjacentSegmentCount: null,
      overlapSpanLength: null,
      currentStrokeLengthWithAdjacentSupport: null,
      currentStrokeSupportRatio: null,
      exactSegmentMatchCount: null,
      reasons: ["adjacent-axis-position-outside-analysis-region"]
    };
  }

  const overlaps = [];
  const currentIndexes = new Set();
  const adjacentIndexes = new Set();
  let currentIndex = 0;
  let adjacentIndex = 0;

  while (currentIndex < current.length && adjacentIndex < adjacent.length) {
    const currentSegment = current[currentIndex];
    const adjacentSegment = adjacent[adjacentIndex];
    const start = Math.max(currentSegment.start, adjacentSegment.start);
    const end = Math.min(currentSegment.end, adjacentSegment.end);
    if (start <= end) {
      overlaps.push({
        currentSegmentIndex: currentIndex,
        adjacentSegmentIndex: adjacentIndex,
        start,
        end,
        length: end - start + 1
      });
      currentIndexes.add(currentIndex);
      adjacentIndexes.add(adjacentIndex);
    }
    if (currentSegment.end <= adjacentSegment.end) {
      currentIndex += 1;
    } else {
      adjacentIndex += 1;
    }
  }

  const currentStrokeLength = current.reduce(
    (total, segment) => total + segment.length,
    0
  );
  const overlapSpanLength = overlaps.reduce(
    (total, overlap) => total + overlap.length,
    0
  );

  return {
    status: "available",
    adjacentOffset: offset,
    adjacentPosition: position + offset,
    currentSegmentCount: current.length,
    adjacentSegmentCount: adjacent.length,
    overlappingCurrentSegmentCount: currentIndexes.size,
    overlappingAdjacentSegmentCount: adjacentIndexes.size,
    overlapSpanLength,
    currentStrokeLengthWithAdjacentSupport: overlapSpanLength,
    currentStrokeSupportRatio: currentStrokeLength === 0
      ? null
      : overlapSpanLength / currentStrokeLength,
    exactSegmentMatchCount: overlaps.filter(overlap => {
      const currentSegment = current[overlap.currentSegmentIndex];
      const adjacentSegment = adjacent[overlap.adjacentSegmentIndex];
      return currentSegment.start === adjacentSegment.start
        && currentSegment.end === adjacentSegment.end;
    }).length,
    overlaps,
    reasons: []
  };
}

function snapshotBinaryImage(binaryImage) {
  const width = binaryImage?.width;
  const height = binaryImage?.height;
  const data = binaryImage?.data;
  if (
    !Number.isInteger(width)
    || width <= 0
    || !Number.isInteger(height)
    || height <= 0
    || !data
    || data.length !== width * height
  ) {
    throw new Error("A compatible BinaryImage is required");
  }
  return {
    width,
    height,
    data: Uint8Array.from(data)
  };
}

function assertDevelopmentEnvironment(environment) {
  if (!ALLOWED_ENVIRONMENTS.has(environment)) {
    throw new Error(
      "Projection ridge fragment diagnostics are available only in development or test"
    );
  }
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(
      ([key, entry]) => [key, cloneValue(entry)]
    ));
  }
  return value;
}

function freezeValue(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(freezeValue);
  return Object.freeze(value);
}
