import {
  createGridLineObservations
} from "../analysis/GridLineObservation";
import {
  createGridLineIntersectionObservations
} from "../analysis/GridLineIntersectionObservation";
import {
  createHorizontalProjection,
  createVerticalProjection
} from "../analysis/Projection";

const ALLOWED_ENVIRONMENTS = new Set(["development", "test"]);
const AXES = Object.freeze(["horizontal", "vertical"]);

export const orderedGridLineIntersectionStructureDiagnosticsExperiment =
  Object.freeze({
    id: "ordered-grid-line-intersection-structure-diagnostics",
    description: "Observe ordered repeated orthogonal crossing structure without classifying or admitting grid lines.",
    run(binaryImage, context = {}) {
      return createOrderedGridLineIntersectionStructureExperiment({
        binaryImage,
        analysisContext: context
      });
    }
  });

export function createOrderedGridLineIntersectionStructureExperiment({
  binaryImage,
  analysisContext = {},
  readEnvironment = () => process.env.NODE_ENV
} = {}) {
  assertDevelopmentEnvironment(readEnvironment());
  const stableBinaryImage = snapshotBinaryImage(binaryImage);
  const projections = snapshotProjections(
    analysisContext.projections,
    stableBinaryImage
  );
  const lineObservations = createGridLineObservations({
    projections,
    binaryImage: stableBinaryImage,
    analysisRegion: createAnalysisRegionEvidence({
      binaryImage: stableBinaryImage,
      coordinateProvenance: analysisContext.coordinateProvenance
    })
  });
  const intersectionObservations = createGridLineIntersectionObservations({
    lineObservations,
    binaryImage: stableBinaryImage
  });

  return createOrderedGridLineIntersectionStructureDiagnostics({
    lineObservations,
    intersectionObservations,
    readEnvironment
  });
}

export function createOrderedGridLineIntersectionStructureDiagnostics({
  lineObservations,
  intersectionObservations,
  readEnvironment = () => process.env.NODE_ENV
} = {}) {
  assertDevelopmentEnvironment(readEnvironment());
  validateArtifacts(lineObservations, intersectionObservations);
  const pairsByReferences = new Map(intersectionObservations.pairs.map(pair => [
    createPairKey(
      pair.sourceObservationReferences.horizontal,
      pair.sourceObservationReferences.vertical
    ),
    pair
  ]));
  const axes = Object.fromEntries(AXES.map(axis => [
    axis,
    createAxisStructure({
      axis,
      lineObservations,
      pairsByReferences
    })
  ]));

  return freezeValue({
    type: "ordered-grid-line-intersection-structure-diagnostics",
    version: 1,
    status: intersectionObservations.status,
    coordinateSpace: lineObservations.coordinateSpace,
    analysisRegionProvenance:
      lineObservations.analysisRegionProvenance ?? null,
    sourceArtifacts: {
      lineObservations: {
        type: lineObservations.type,
        version: lineObservations.version,
        status: lineObservations.status
      },
      intersectionObservations: {
        type: intersectionObservations.type,
        version: intersectionObservations.version,
        status: intersectionObservations.status,
        pairCount: intersectionObservations.pairCount
      }
    },
    representation: "factored-ordered-perpendicular-observation-sequences",
    axes,
    diagnostics: [{
      code: "ordered-crossing-structure-is-observational",
      admissionChanged: false,
      classificationApplied: false,
      groundTruthAccessed: false
    }],
    reasons: cloneValue(intersectionObservations.reasons ?? [])
  });
}

function createAxisStructure({
  axis,
  lineObservations,
  pairsByReferences
}) {
  const perpendicularAxis = axis === "horizontal"
    ? "vertical"
    : "horizontal";
  const observations = lineObservations.axes[axis].observations;
  const perpendicular = lineObservations.axes[perpendicularAxis].observations;
  const perpendicularObservations = perpendicular.map((value, order) => ({
    order,
    observationId: value.id,
    position: value.position,
    wholeAxisRuleSatisfied: value.wholeAxisRule.satisfied
  }));
  const structures = observations.map(observation => {
    const orderedCrossings = perpendicular.map((perpendicularValue, order) => {
      const horizontalId = axis === "horizontal"
        ? observation.id
        : perpendicularValue.id;
      const verticalId = axis === "vertical"
        ? observation.id
        : perpendicularValue.id;
      const pair = pairsByReferences.get(createPairKey(
        horizontalId,
        verticalId
      ));

      return {
        order,
        intersectionObservationId: pair?.id ?? null,
        perpendicularObservationId: perpendicularValue.id,
        positionAlongLine: perpendicularValue.position,
        status: pair?.status ?? "unavailable",
        strokeEvidencePresent: pair?.strokeEvidence?.present ?? null,
        reasons: cloneValue(pair?.reasons ?? [
          "intersection-observation-unavailable"
        ])
      };
    });

    return {
      observationId: observation.id,
      sourceOrder: observation.sourceOrder,
      axis,
      position: observation.position,
      wholeAxisRuleSatisfied: observation.wholeAxisRule.satisfied,
      orderedCrossings,
      structureMeasurements: createStructureMeasurements(
        orderedCrossings,
        perpendicularObservations
      ),
      provenanceReferences: {
        lineObservationId: observation.id,
        analysisRegionId:
          observation.analysisRegionProvenance?.id ?? null
      }
    };
  });

  return {
    status: "available",
    axis,
    perpendicularAxis,
    perpendicularObservations,
    observationCount: structures.length,
    observations: structures
  };
}

function createStructureMeasurements(
  orderedCrossings,
  perpendicularObservations
) {
  const all = summarizeSequence(orderedCrossings);
  const admittedOrders = new Set(perpendicularObservations
    .filter(value => value.wholeAxisRuleSatisfied === true)
    .map(value => value.order));
  const currentRuleSatisfiedPerpendicular = summarizeSequence(
    orderedCrossings.filter(value => admittedOrders.has(value.order))
  );

  return {
    allPerpendicularObservations: all,
    currentRuleSatisfiedPerpendicular
  };
}

function summarizeSequence(crossings) {
  const present = crossings.filter(
    value => value.strokeEvidencePresent === true
  );
  const missing = crossings.filter(
    value => value.strokeEvidencePresent === false
  );
  const unavailable = crossings.filter(
    value => value.strokeEvidencePresent === null
  );
  const adjacentPresentGaps = present.slice(1).map((value, index) => ({
    fromOrder: present[index].order,
    toOrder: value.order,
    fromPosition: present[index].positionAlongLine,
    toPosition: value.positionAlongLine,
    gap: value.positionAlongLine - present[index].positionAlongLine
  }));
  const exactGapGroups = createExactGapGroups(adjacentPresentGaps);

  return {
    crossingCount: crossings.length,
    presentCount: present.length,
    missingCount: missing.length,
    unavailableCount: unavailable.length,
    presentRatio: finiteRatio(
      present.length,
      present.length + missing.length
    ),
    presentPositions: present.map(value => value.positionAlongLine),
    missingPositions: missing.map(value => value.positionAlongLine),
    presenceRuns: createPresenceRuns(crossings),
    adjacentPresentGaps,
    exactGapGroups,
    repeatedExactGapCount: exactGapGroups
      .filter(value => value.occurrenceCount > 1)
      .reduce((total, value) => total + value.occurrenceCount, 0),
    longestEqualGapRun: createLongestEqualGapRun(adjacentPresentGaps),
    spacingStatistics: createSpacingStatistics(
      adjacentPresentGaps.map(value => value.gap)
    )
  };
}

function createPresenceRuns(crossings) {
  const runs = [];
  let current = null;

  crossings.forEach(crossing => {
    const state = crossing.strokeEvidencePresent === true
      ? "present"
      : crossing.strokeEvidencePresent === false ? "missing" : "unavailable";
    if (current?.state === state) {
      current.endOrder = crossing.order;
      current.endPosition = crossing.positionAlongLine;
      current.length += 1;
      return;
    }
    current = {
      state,
      startOrder: crossing.order,
      endOrder: crossing.order,
      startPosition: crossing.positionAlongLine,
      endPosition: crossing.positionAlongLine,
      length: 1
    };
    runs.push(current);
  });

  return runs;
}

function createExactGapGroups(gaps) {
  const groups = new Map();
  gaps.forEach((gap, sourceIndex) => {
    const key = String(gap.gap);
    if (!groups.has(key)) {
      groups.set(key, {
        gap: gap.gap,
        occurrenceCount: 0,
        sourceIndexes: []
      });
    }
    const group = groups.get(key);
    group.occurrenceCount += 1;
    group.sourceIndexes.push(sourceIndex);
  });
  return Array.from(groups.values());
}

function createLongestEqualGapRun(gaps) {
  if (gaps.length === 0) {
    return {
      gap: null,
      startIndex: null,
      endIndex: null,
      length: 0
    };
  }
  let best = {
    gap: gaps[0].gap,
    startIndex: 0,
    endIndex: 0,
    length: 1
  };
  let current = { ...best };
  for (let index = 1; index < gaps.length; index++) {
    if (gaps[index].gap === current.gap) {
      current.endIndex = index;
      current.length += 1;
    } else {
      current = {
        gap: gaps[index].gap,
        startIndex: index,
        endIndex: index,
        length: 1
      };
    }
    if (current.length > best.length) {
      best = { ...current };
    }
  }
  return best;
}

function createSpacingStatistics(values) {
  if (values.length === 0) {
    return {
      count: 0,
      minimum: null,
      maximum: null,
      mean: null,
      median: null
    };
  }
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
  return {
    count: values.length,
    minimum: sorted[0],
    maximum: sorted[sorted.length - 1],
    mean: values.reduce((total, value) => total + value, 0) / values.length,
    median
  };
}

function validateArtifacts(lineObservations, intersectionObservations) {
  if (lineObservations?.type !== "grid-line-observation-set") {
    throw new Error("GridLineObservation set is required");
  }
  if (
    intersectionObservations?.type
      !== "grid-line-intersection-observation-set"
    || !Array.isArray(intersectionObservations.pairs)
  ) {
    throw new Error("GridLineIntersectionObservation set is required");
  }
}

function createPairKey(horizontalId, verticalId) {
  return `${horizontalId}\u0000${verticalId}`;
}

function snapshotProjections(source, binaryImage) {
  return {
    horizontal: source?.horizontal
      ? Array.from(source.horizontal)
      : Array.from(createHorizontalProjection(binaryImage)),
    vertical: source?.vertical
      ? Array.from(source.vertical)
      : Array.from(createVerticalProjection(binaryImage))
  };
}

function createAnalysisRegionEvidence({ binaryImage, coordinateProvenance }) {
  const source = coordinateProvenance?.analysisRegion;
  const transform = source?.localToBinaryImage ?? null;
  return {
    id: source?.id ?? null,
    regionType: source?.regionType ?? null,
    bounds: {
      top: transform?.offsetY ?? 0,
      left: transform?.offsetX ?? 0,
      width: binaryImage.width,
      height: binaryImage.height
    },
    coordinateRelationship: {
      type: source?.relationshipType ?? null,
      localToBinaryImage: cloneValue(transform)
    }
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
    throw new Error("BinaryImage is required");
  }
  return { width, height, data };
}

function finiteRatio(value, total) {
  return Number.isFinite(value) && Number.isFinite(total) && total > 0
    ? value / total
    : null;
}

function assertDevelopmentEnvironment(environment) {
  if (!ALLOWED_ENVIRONMENTS.has(environment)) {
    throw new Error(
      "Ordered grid-line intersection diagnostics are available only in development or test"
    );
  }
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(
      ([key, nested]) => [key, cloneValue(nested)]
    ));
  }
  return value;
}

function freezeValue(value) {
  if (
    !value
    || typeof value !== "object"
    || ArrayBuffer.isView(value)
    || Object.isFrozen(value)
  ) {
    return value;
  }
  Object.values(value).forEach(freezeValue);
  return Object.freeze(value);
}
