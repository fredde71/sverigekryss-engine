const AXES = Object.freeze(["horizontal", "vertical"]);
const DEFAULT_WHOLE_AXIS_COVERAGE_RATIO = 0.8;
const DEFAULT_NEIGHBORHOOD_RADIUS = 1;

export function createGridLineObservations({
  projections,
  binaryImage = null,
  analysisRegion = null,
  wholeAxisCoverageRatio = DEFAULT_WHOLE_AXIS_COVERAGE_RATIO,
  neighborhoodRadius = DEFAULT_NEIGHBORHOOD_RADIUS
} = {}) {
  validateProjections(projections);
  validateRatio(wholeAxisCoverageRatio, "wholeAxisCoverageRatio");
  validateNonNegativeInteger(neighborhoodRadius, "neighborhoodRadius");

  const provenance = createAnalysisRegionProvenance(analysisRegion);
  const axes = Object.fromEntries(AXES.map(axis => {
    const projection = projections[axis];
    const axisLength = readTangentialAxisLength({
      axis,
      binaryImage,
      analysisRegion
    });
    return [axis, createAxisObservations({
      axis,
      projection,
      axisLength,
      binaryImage,
      wholeAxisCoverageRatio,
      neighborhoodRadius,
      provenance
    })];
  }));

  return deepFreeze({
    type: "grid-line-observation-set",
    version: 1,
    status: AXES.every(axis => axes[axis].status === "available")
      ? "available"
      : "partial",
    coordinateSpace: "analysis-region-local",
    analysisRegionProvenance: provenance,
    parameters: {
      wholeAxisCoverageRatio,
      neighborhoodRadius,
      peakDefinition: "positive-local-maximum-plateau"
    },
    axes,
    diagnostics: [{
      code: "grid-line-observations-are-non-authoritative",
      currentCandidateAdmissionBehavior: "unchanged"
    }],
    reasons: AXES.flatMap(axis => axes[axis].reasons.map(
      reason => `${axis}:${reason}`
    ))
  });
}

function createAxisObservations({
  axis,
  projection,
  axisLength,
  binaryImage,
  wholeAxisCoverageRatio,
  neighborhoodRadius,
  provenance
}) {
  const minimumStrength = Number.isInteger(axisLength) && axisLength > 0
    ? Math.max(1, Math.ceil(axisLength * wholeAxisCoverageRatio))
    : null;
  const peakRuns = findPositiveLocalMaximumPlateaus(projection);
  const observations = peakRuns.map((run, sourceOrder) => (
    createObservation({
      axis,
      run,
      sourceOrder,
      projection,
      axisLength,
      minimumStrength,
      binaryImage,
      wholeAxisCoverageRatio,
      neighborhoodRadius,
      provenance
    })
  ));
  const reasons = minimumStrength === null
    ? ["whole-axis-length-unavailable"]
    : [];

  return {
    status: reasons.length === 0 ? "available" : "partial",
    axis,
    projectionLength: projection.length,
    wholeAxisLength: axisLength,
    minimumStrength,
    observations,
    reasons
  };
}

function createObservation({
  axis,
  run,
  sourceOrder,
  projection,
  axisLength,
  minimumStrength,
  binaryImage,
  wholeAxisCoverageRatio,
  neighborhoodRadius,
  provenance
}) {
  const thickness = run.end - run.start + 1;
  const center = run.start + ((thickness - 1) / 2);
  const neighborhood = createProjectionNeighborhood({
    projection,
    run,
    radius: neighborhoodRadius
  });
  const continuity = createTangentialContinuity({
    binaryImage,
    axis,
    run
  });
  const coverageAvailable = Number.isInteger(axisLength) && axisLength > 0;
  const coverageRatio = coverageAvailable
    ? run.strength / axisLength
    : null;
  const wholeAxisRuleSatisfied = minimumStrength === null
    ? null
    : run.strength >= minimumStrength;
  const reasons = [
    ...neighborhood.reasons,
    ...continuity.reasons
  ];
  if (!coverageAvailable) {
    reasons.push("whole-axis-length-unavailable");
  }

  return deepFreeze({
    type: "grid-line-observation",
    version: 1,
    id: `grid-line-observation-${axis}-${String(sourceOrder + 1).padStart(4, "0")}`,
    status: reasons.length === 0 ? "available" : "partial",
    sourceOrder,
    axis,
    position: center,
    center,
    projectionStrength: run.strength,
    coverageRatio,
    runStart: run.start,
    runEnd: run.end,
    thickness,
    neighboringProjectionSamples: neighborhood.samples,
    neighboringProjectionStatus: neighborhood.status,
    tangentialContinuity: continuity,
    longestContinuousTangentialRun: continuity.longestContinuousRun,
    segmentCount: continuity.segmentCount,
    coordinateSpace: "analysis-region-local",
    analysisRegionProvenance: provenance,
    wholeAxisRule: {
      coverageRatio: wholeAxisCoverageRatio,
      axisLength,
      minimumStrength,
      satisfied: wholeAxisRuleSatisfied
    },
    evidenceAvailability: {
      projection: "available",
      coverage: coverageAvailable ? "available" : "unavailable",
      neighborhood: neighborhood.status,
      tangentialContinuity: continuity.status
    },
    reasons
  });
}

function findPositiveLocalMaximumPlateaus(projection) {
  const runs = [];
  let index = 0;

  while (index < projection.length) {
    const strength = projection[index];
    let end = index;
    while (end + 1 < projection.length && projection[end + 1] === strength) {
      end += 1;
    }

    const before = index === 0 ? null : projection[index - 1];
    const after = end === projection.length - 1
      ? null
      : projection[end + 1];
    const notLowerThanNeighbors = (before === null || strength >= before)
      && (after === null || strength >= after);
    const strictlyHigherOnOneSide = (before === null || strength > before)
      || (after === null || strength > after);

    if (strength > 0 && notLowerThanNeighbors && strictlyHigherOnOneSide) {
      runs.push({ start: index, end, strength });
    }
    index = end + 1;
  }

  return runs;
}

function createProjectionNeighborhood({ projection, run, radius }) {
  const requestedStart = run.start - radius;
  const requestedEnd = run.end + radius;
  const start = Math.max(0, requestedStart);
  const end = Math.min(projection.length - 1, requestedEnd);
  const reasons = [];
  if (start !== requestedStart) {
    reasons.push("projection-neighborhood-clipped-at-start");
  }
  if (end !== requestedEnd) {
    reasons.push("projection-neighborhood-clipped-at-end");
  }

  return {
    status: reasons.length === 0 ? "available" : "partial",
    samples: Array.from({ length: end - start + 1 }, (_value, offset) => {
      const position = start + offset;
      return {
        position,
        offsetFromCenter: position - (
          run.start + ((run.end - run.start) / 2)
        ),
        projectionStrength: projection[position],
        withinPeakRun: position >= run.start && position <= run.end
      };
    }),
    reasons
  };
}

function createTangentialContinuity({ binaryImage, axis, run }) {
  if (!isCompatibleBinaryImage(binaryImage)) {
    return {
      status: "unavailable",
      measurementPosition: null,
      longestContinuousRun: null,
      segmentCount: null,
      runSamples: [],
      reasons: ["binary-image-unavailable"]
    };
  }

  const normalLimit = axis === "horizontal"
    ? binaryImage.height
    : binaryImage.width;
  if (run.start < 0 || run.end >= normalLimit) {
    return {
      status: "unavailable",
      measurementPosition: null,
      longestContinuousRun: null,
      segmentCount: null,
      runSamples: [],
      reasons: ["peak-run-outside-binary-image"]
    };
  }

  const runSamples = Array.from(
    { length: run.end - run.start + 1 },
    (_value, offset) => measureTangentialContinuity(
      binaryImage,
      axis,
      run.start + offset
    )
  );
  const representative = runSamples.reduce((current, sample) => {
    if (
      current === null
      || sample.longestContinuousRun > current.longestContinuousRun
      || (
        sample.longestContinuousRun === current.longestContinuousRun
        && sample.segmentCount < current.segmentCount
      )
    ) {
      return sample;
    }
    return current;
  }, null);

  return {
    status: "available",
    measurementPosition: representative.position,
    longestContinuousRun: representative.longestContinuousRun,
    segmentCount: representative.segmentCount,
    runSamples,
    reasons: []
  };
}

function measureTangentialContinuity(binaryImage, axis, position) {
  const length = axis === "horizontal"
    ? binaryImage.width
    : binaryImage.height;
  let longestContinuousRun = 0;
  let currentRun = 0;
  let segmentCount = 0;
  let insideSegment = false;

  for (let tangent = 0; tangent < length; tangent++) {
    const x = axis === "horizontal" ? tangent : position;
    const y = axis === "horizontal" ? position : tangent;
    const black = binaryImage.data[(y * binaryImage.width) + x] === 1;
    if (black) {
      currentRun += 1;
      longestContinuousRun = Math.max(longestContinuousRun, currentRun);
      if (!insideSegment) {
        segmentCount += 1;
        insideSegment = true;
      }
    } else {
      currentRun = 0;
      insideSegment = false;
    }
  }

  return {
    position,
    longestContinuousRun,
    segmentCount
  };
}

function readTangentialAxisLength({ axis, binaryImage, analysisRegion }) {
  if (isCompatibleBinaryImage(binaryImage)) {
    return axis === "horizontal" ? binaryImage.width : binaryImage.height;
  }
  const width = analysisRegion?.bounds?.width;
  const height = analysisRegion?.bounds?.height;
  const value = axis === "horizontal" ? width : height;
  return Number.isInteger(value) && value > 0 ? value : null;
}

function createAnalysisRegionProvenance(analysisRegion) {
  return deepFreeze({
    id: typeof analysisRegion?.id === "string" ? analysisRegion.id : null,
    regionType: typeof analysisRegion?.regionType === "string"
      ? analysisRegion.regionType
      : null,
    bounds: cloneJsonValue(analysisRegion?.bounds ?? null),
    coordinateRelationship: cloneJsonValue(
      analysisRegion?.coordinateRelationship ?? null
    )
  });
}

function validateProjections(projections) {
  if (!projections || typeof projections !== "object") {
    throw new Error("Grid line projections are required");
  }
  AXES.forEach(axis => {
    const projection = projections[axis];
    if (!projection || typeof projection.length !== "number") {
      throw new Error(`${axis} projection is required`);
    }
    for (let index = 0; index < projection.length; index++) {
      if (!Number.isFinite(projection[index]) || projection[index] < 0) {
        throw new Error(`${axis} projection values must be finite and non-negative`);
      }
    }
  });
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

function validateRatio(value, name) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be between zero and one`);
  }
}

function validateNonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
}

function cloneJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneJsonValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(
      ([key, entry]) => [key, cloneJsonValue(entry)]
    ));
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
