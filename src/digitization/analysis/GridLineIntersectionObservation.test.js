import {
  createGridLineIntersectionObservations
} from "./GridLineIntersectionObservation";
import { createGridLineObservations } from "./GridLineObservation";
import {
  createHorizontalProjection,
  createVerticalProjection
} from "./Projection";

test("records factual stroke evidence at a real orthogonal crossing", () => {
  const binaryImage = createCrossingBinaryImage();
  const lineObservations = createObservations(binaryImage);
  const result = createGridLineIntersectionObservations({
    lineObservations,
    binaryImage,
    neighborhoodRadius: 0
  });
  const crossing = result.pairs.find(value => (
    value.crossing.x === 3 && value.crossing.y === 2
  ));

  expect(crossing).toMatchObject({
    status: "available",
    crossing: { x: 3, y: 2 },
    orderedCrossingPosition: {
      alongHorizontal: { position: 3 },
      alongVertical: { position: 2 }
    },
    coordinateSpace: "analysis-region-local",
    strokeEvidence: {
      status: "available",
      present: true,
      requestedBounds: { left: 3, right: 3, top: 2, bottom: 2 },
      bounds: { left: 3, right: 3, top: 2, bottom: 2 },
      clipped: false,
      blackPixelCount: 1,
      sampledPixelCount: 1,
      reasons: []
    }
  });
  expect(crossing).not.toHaveProperty("score");
  expect(crossing).not.toHaveProperty("confidence");
  expect(crossing).not.toHaveProperty("admissionStatus");
});

test("records missing stroke evidence without rejecting either line observation", () => {
  const binaryImage = {
    width: 5,
    height: 5,
    data: new Uint8Array(25)
  };
  binaryImage.data[(1 * 5) + 0] = 1;
  binaryImage.data[(1 * 5) + 1] = 1;
  binaryImage.data[(3 * 5) + 3] = 1;
  binaryImage.data[(4 * 5) + 3] = 1;
  const lineObservations = createObservationSet({
    horizontal: [createObservation("horizontal", "h-1", 1, 0)],
    vertical: [createObservation("vertical", "v-1", 3, 0)]
  });

  const result = createGridLineIntersectionObservations({
    lineObservations,
    binaryImage,
    neighborhoodRadius: 0
  });

  expect(result.pairs).toHaveLength(1);
  expect(result.pairs[0].strokeEvidence).toMatchObject({
    status: "available",
    present: false,
    blackPixelCount: 0,
    sampledPixelCount: 1
  });
  expect(result.diagnostics).toEqual([{
    code: "grid-line-intersections-are-non-authoritative",
    currentCandidateAdmissionBehavior: "unchanged"
  }]);
});

test("preserves horizontal-major deterministic crossing order", () => {
  const binaryImage = createCrossingBinaryImage();
  const lineObservations = createObservationSet({
    horizontal: [
      createObservation("horizontal", "h-1", 1, 0),
      createObservation("horizontal", "h-2", 4, 1)
    ],
    vertical: [
      createObservation("vertical", "v-1", 0, 0),
      createObservation("vertical", "v-2", 3, 1)
    ]
  });

  const first = createGridLineIntersectionObservations({
    lineObservations,
    binaryImage,
    neighborhoodRadius: 0
  });
  const second = createGridLineIntersectionObservations({
    lineObservations,
    binaryImage,
    neighborhoodRadius: 0
  });

  expect(second).toEqual(first);
  expect(first.pairs.map(value => [
    value.sourceObservationReferences.horizontal,
    value.sourceObservationReferences.vertical
  ])).toEqual([
    ["h-1", "v-1"],
    ["h-1", "v-2"],
    ["h-2", "v-1"],
    ["h-2", "v-2"]
  ]);
  expect(first.pairs.map(value => value.orderedCrossingPosition)).toEqual([
    {
      alongHorizontal: { order: 0, position: 0 },
      alongVertical: { order: 0, position: 1 }
    },
    {
      alongHorizontal: { order: 1, position: 3 },
      alongVertical: { order: 0, position: 1 }
    },
    {
      alongHorizontal: { order: 0, position: 0 },
      alongVertical: { order: 1, position: 4 }
    },
    {
      alongHorizontal: { order: 1, position: 3 },
      alongVertical: { order: 1, position: 4 }
    }
  ]);
});

test("does not mutate inputs and deeply freezes the observation artifact", () => {
  const binaryImage = createCrossingBinaryImage();
  const lineObservations = createObservations(binaryImage);
  const beforeData = Array.from(binaryImage.data);
  const beforeObservations = JSON.stringify(lineObservations);

  const result = createGridLineIntersectionObservations({
    lineObservations,
    binaryImage
  });

  expect(Array.from(binaryImage.data)).toEqual(beforeData);
  expect(JSON.stringify(lineObservations)).toBe(beforeObservations);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.pairs)).toBe(true);
  expect(Object.isFrozen(result.pairs[0].strokeEvidence)).toBe(true);
  expect(result.analysisRegionProvenance)
    .toBe(lineObservations.analysisRegionProvenance);
});

test("makes unavailable crossing measurements explicit", () => {
  const lineObservations = createObservationSet({
    horizontal: [createObservation("horizontal", "h-1", 1, 0)],
    vertical: [createObservation("vertical", "v-1", 3, 0)]
  });

  const result = createGridLineIntersectionObservations({
    lineObservations
  });

  expect(result.status).toBe("unavailable");
  expect(result.pairs[0]).toMatchObject({
    status: "unavailable",
    strokeEvidence: {
      status: "unavailable",
      present: null,
      reasons: ["binary-image-unavailable"]
    },
    reasons: ["binary-image-unavailable"]
  });
});

function createCrossingBinaryImage() {
  const width = 5;
  const height = 5;
  const data = new Uint8Array(width * height);
  for (let x = 0; x < width; x++) {
    data[(2 * width) + x] = 1;
  }
  for (let y = 0; y < height; y++) {
    data[(y * width) + 3] = 1;
  }
  return { width, height, data };
}

function createObservations(binaryImage) {
  return createGridLineObservations({
    projections: {
      horizontal: createHorizontalProjection(binaryImage),
      vertical: createVerticalProjection(binaryImage)
    },
    binaryImage,
    analysisRegion: {
      id: "region-001",
      regionType: "observed-analysis-region",
      bounds: {
        top: 10,
        left: 20,
        width: binaryImage.width,
        height: binaryImage.height
      },
      coordinateRelationship: {
        type: "translation",
        localToBinaryImage: {
          offsetX: 20,
          offsetY: 10,
          scaleX: 1,
          scaleY: 1
        }
      }
    }
  });
}

function createObservationSet({ horizontal, vertical }) {
  return deepFreeze({
    type: "grid-line-observation-set",
    version: 1,
    coordinateSpace: "analysis-region-local",
    analysisRegionProvenance: {
      id: "region-001",
      regionType: "observed-analysis-region"
    },
    axes: {
      horizontal: { observations: horizontal },
      vertical: { observations: vertical }
    }
  });
}

function createObservation(axis, id, center, sourceOrder) {
  return {
    id,
    axis,
    sourceOrder,
    center,
    runStart: center,
    runEnd: center,
    coordinateSpace: "analysis-region-local",
    analysisRegionProvenance: { id: "region-001" }
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
