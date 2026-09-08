import { createGridLineObservations } from "./GridLineObservation";

test("preserves admitted and interrupted line peaks without making admission decisions", () => {
  const binaryImage = createBinaryImage();
  const result = createGridLineObservations({
    projections: {
      horizontal: new Uint32Array([0, 10, 0, 0, 0, 7, 0]),
      vertical: new Uint32Array(10)
    },
    binaryImage,
    analysisRegion: createAnalysisRegion(binaryImage)
  });

  expect(result).toMatchObject({
    type: "grid-line-observation-set",
    version: 1,
    status: "available",
    coordinateSpace: "analysis-region-local",
    parameters: {
      wholeAxisCoverageRatio: 0.8,
      neighborhoodRadius: 1,
      peakDefinition: "positive-local-maximum-plateau"
    }
  });
  expect(result.axes.horizontal.minimumStrength).toBe(8);
  expect(result.axes.horizontal.observations).toHaveLength(2);
  expect(result.axes.horizontal.observations[0]).toMatchObject({
    axis: "horizontal",
    position: 1,
    center: 1,
    projectionStrength: 10,
    coverageRatio: 1,
    runStart: 1,
    runEnd: 1,
    thickness: 1,
    longestContinuousTangentialRun: 10,
    segmentCount: 1,
    wholeAxisRule: {
      coverageRatio: 0.8,
      axisLength: 10,
      minimumStrength: 8,
      satisfied: true
    }
  });
  expect(result.axes.horizontal.observations[1]).toMatchObject({
    position: 5,
    projectionStrength: 7,
    coverageRatio: 0.7,
    longestContinuousTangentialRun: 3,
    segmentCount: 3,
    wholeAxisRule: {
      satisfied: false
    }
  });
  expect(result.axes.horizontal.observations[1]).not.toHaveProperty(
    "admissionStatus"
  );
});

test("preserves peak geometry and neighboring projection samples exactly", () => {
  const binaryImage = createBinaryImage();
  const result = createGridLineObservations({
    projections: {
      horizontal: [1, 4, 4, 2, 0, 7, 0],
      vertical: new Uint32Array(10)
    },
    binaryImage,
    analysisRegion: createAnalysisRegion(binaryImage)
  });
  const plateau = result.axes.horizontal.observations[0];

  expect(plateau).toMatchObject({
    position: 1.5,
    center: 1.5,
    projectionStrength: 4,
    coverageRatio: 0.4,
    runStart: 1,
    runEnd: 2,
    thickness: 2
  });
  expect(plateau.neighboringProjectionSamples).toEqual([
    {
      position: 0,
      offsetFromCenter: -1.5,
      projectionStrength: 1,
      withinPeakRun: false
    },
    {
      position: 1,
      offsetFromCenter: -0.5,
      projectionStrength: 4,
      withinPeakRun: true
    },
    {
      position: 2,
      offsetFromCenter: 0.5,
      projectionStrength: 4,
      withinPeakRun: true
    },
    {
      position: 3,
      offsetFromCenter: 1.5,
      projectionStrength: 2,
      withinPeakRun: false
    }
  ]);
  expect(plateau.tangentialContinuity.runSamples.map(value => value.position))
    .toEqual([1, 2]);
});

test("represents unavailable continuity evidence explicitly", () => {
  const result = createGridLineObservations({
    projections: {
      horizontal: [0, 7, 0],
      vertical: [0, 6, 0, 0]
    },
    analysisRegion: {
      id: "region-without-runtime-image",
      regionType: "observed-analysis-region",
      bounds: { top: 3, left: 4, width: 10, height: 8 },
      coordinateRelationship: {
        type: "translation",
        localToBinaryImage: {
          offsetX: 4,
          offsetY: 3,
          scaleX: 1,
          scaleY: 1
        }
      }
    }
  });
  const observation = result.axes.horizontal.observations[0];

  expect(observation.status).toBe("partial");
  expect(observation.tangentialContinuity).toEqual({
    status: "unavailable",
    measurementPosition: null,
    longestContinuousRun: null,
    segmentCount: null,
    runSamples: [],
    reasons: ["binary-image-unavailable"]
  });
  expect(observation.evidenceAvailability).toMatchObject({
    projection: "available",
    coverage: "available",
    tangentialContinuity: "unavailable"
  });
  expect(observation.reasons).toContain("binary-image-unavailable");
});

test("preserves provenance, deterministic ordering and input immutability", () => {
  const binaryImage = deepFreeze(createBinaryImage());
  const analysisRegion = deepFreeze(createAnalysisRegion(binaryImage));
  const projections = deepFreeze({
    horizontal: [0, 10, 0, 7, 0],
    vertical: [0, 7, 0, 10, 0, 6, 0, 0, 0, 0]
  });
  const before = JSON.stringify({ analysisRegion, projections });

  const first = createGridLineObservations({
    projections,
    binaryImage,
    analysisRegion
  });
  const second = createGridLineObservations({
    projections,
    binaryImage,
    analysisRegion
  });

  expect(second).toEqual(first);
  expect(first.axes.horizontal.observations.map(value => value.position))
    .toEqual([1, 3]);
  expect(first.axes.vertical.observations.map(value => value.position))
    .toEqual([1, 3, 5]);
  expect(first.analysisRegionProvenance).toEqual({
    id: analysisRegion.id,
    regionType: analysisRegion.regionType,
    bounds: analysisRegion.bounds,
    coordinateRelationship: analysisRegion.coordinateRelationship
  });
  expect(first.axes.horizontal.observations[0].analysisRegionProvenance)
    .toBe(first.analysisRegionProvenance);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.axes.horizontal.observations)).toBe(true);
  expect(JSON.stringify({ analysisRegion, projections })).toBe(before);
});

function createBinaryImage() {
  const width = 10;
  const height = 7;
  const data = new Uint8Array(width * height);
  for (let x = 0; x < width; x++) {
    data[(1 * width) + x] = 1;
  }
  [0, 1, 2, 4, 5, 6, 8].forEach(x => {
    data[(5 * width) + x] = 1;
  });
  return { width, height, data };
}

function createAnalysisRegion(binaryImage) {
  return {
    type: "analysis-region",
    version: 1,
    id: "region-001",
    status: "measured",
    regionType: "observed-analysis-region",
    bounds: { top: 100, left: 20, width: 10, height: 7 },
    binaryImage,
    coordinateRelationship: {
      type: "translation",
      localToBinaryImage: {
        offsetX: 20,
        offsetY: 100,
        scaleX: 1,
        scaleY: 1
      }
    }
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  if (ArrayBuffer.isView(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
