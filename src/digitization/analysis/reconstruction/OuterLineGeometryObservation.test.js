import {
  createOuterLineGeometryObservation
} from "./OuterLineGeometryObservation";
import {
  createGridLatticeFactoredBoundsEvidence
} from "./GridLatticeFactoredBoundsEvidence";

test("observes factual outer-line geometry in AnalysisRegion coordinates", () => {
  const input = createInput();
  const observation = createOuterLineGeometryObservation(input);

  expect(observation.edgeOrder).toEqual(["top", "bottom", "left", "right"]);
  expect(observation.coordinateSystem).toEqual(input.coordinateSystem);
  expect(observation.edges.top).toMatchObject({
    status: "available",
    acceptedCandidateCenter: 0,
    acceptedCenterInObservationSpace: 0,
    acceptedCenterInParentBinaryImage: 4,
    candidateRunGeometry: { start: 0, end: 0, thickness: 1 },
    geometry: {
      contiguousStrongOrFullLineRun: {
        start: { position: -1, signedOffsetFromAcceptedCenter: -1 },
        end: { position: 0, signedOffsetFromAcceptedCenter: 0 },
        thickness: 2,
        midpoint: {
          position: -0.5,
          signedOffsetFromAcceptedCenter: -0.5
        }
      },
      projectionPlateau: {
        midpoint: {
          position: -0.5,
          signedOffsetFromAcceptedCenter: -0.5
        }
      },
      firstStrongOrFullContinuityPosition: {
        position: -1,
        signedOffsetFromAcceptedCenter: -1
      },
      lastStrongOrFullContinuityPosition: {
        position: 0,
        signedOffsetFromAcceptedCenter: 0
      }
    }
  });
  expect(observation.edges.bottom.geometry.projectionPlateau.midpoint.position)
    .toBe(8.5);
  expect(observation.edges.left.geometry.projectionPlateau.midpoint.position)
    .toBe(-0.5);
  expect(observation.edges.right.geometry.projectionPlateau.midpoint.position)
    .toBe(8.5);
  expect(observation.edges.top.geometry.projectionWeightedCentroid.position)
    .toBeGreaterThan(-1);
});

test("preserves coordinate provenance and supports non-identity transforms", () => {
  const input = createInput({
    analysisRegion: {
      type: "analysis-region",
      version: 1,
      id: "region-scaled",
      status: "measured",
      bounds: { top: 4, left: 4, width: 9, height: 9 },
      coordinateRelationship: {
        type: "axis-aligned",
        localToBinaryImage: {
          offsetX: 4,
          offsetY: 4,
          scaleX: 2,
          scaleY: 2
        }
      }
    },
    lineCandidates: {
      horizontal: [candidate(0), candidate(4)],
      vertical: [candidate(0), candidate(4)]
    }
  });
  const observation = createOuterLineGeometryObservation(input);

  expect(observation.coordinateSystem.localToBinaryImage).toBeDefined();
  expect(observation.edges.top.acceptedCenterInParentBinaryImage).toBe(4);
  expect(observation.edges.top.acceptedCenterInObservationSpace).toBe(0);
  expect(observation.edges.bottom.acceptedCenterInParentBinaryImage).toBe(12);
  expect(observation.provenance).toMatchObject({
    source: "production-test",
    method: "factual-boundary-neighborhood-geometry"
  });
});

test("keeps missing outer candidates explicitly unavailable without bounds fabrication", () => {
  const input = createInput({
    lineCandidates: {
      horizontal: [candidate(0)],
      vertical: [candidate(0), candidate(8)]
    }
  });
  const observation = createOuterLineGeometryObservation(input);
  const bounds = createGridLatticeFactoredBoundsEvidence({
    source: { type: "production-outer-line-geometry-evidence", version: 1 },
    sourceId: "production-outer-line-geometry-evidence",
    coordinateSystem: input.coordinateSystem,
    providers: [{
      id: "production-grid-analysis",
      status: "available",
      regions: [{
        providerId: "production-grid-analysis",
        regionId: input.analysisRegion.id,
        status: "completed",
        observation
      }]
    }]
  });

  expect(observation.edges.top.status).toBe("unavailable");
  expect(observation.edges.bottom.status).toBe("unavailable");
  expect(observation.edges.top.geometry.contiguousStrongOrFullLineRuns)
    .toEqual([]);
  expect(bounds.status).toBe("unavailable");
  expect(bounds.boundsCandidateCount).toBe(0);
});

test("is deterministic, deeply immutable and does not mutate its inputs", () => {
  const input = createInput();
  const pixelsBefore = Array.from(input.parentBinaryImage.data);
  const candidatesBefore = JSON.stringify(input.lineCandidates);
  deepFreeze(input.analysisRegion);
  deepFreeze(input.lineCandidates);
  deepFreeze(input.coordinateSystem);

  const first = createOuterLineGeometryObservation(input);
  const second = createOuterLineGeometryObservation(input);

  expect(second).toEqual(first);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.edges.top.geometry)).toBe(true);
  expect(Array.from(input.parentBinaryImage.data)).toEqual(pixelsBefore);
  expect(JSON.stringify(input.lineCandidates)).toBe(candidatesBefore);
});

function createInput(overrides = {}) {
  const parentBinaryImage = createBinaryImage();
  const analysisRegion = overrides.analysisRegion ?? {
    type: "analysis-region",
    version: 1,
    id: "region-001",
    status: "measured",
    bounds: { top: 4, left: 4, width: 9, height: 9 },
    coordinateRelationship: {
      type: "translation",
      localToBinaryImage: {
        offsetX: 4,
        offsetY: 4,
        scaleX: 1,
        scaleY: 1
      }
    }
  };
  const coordinateSystem = overrides.coordinateSystem ?? {
    space: "analysis-region-local",
    unit: "pixel",
    localToBinaryImage: analysisRegion.coordinateRelationship.localToBinaryImage,
    binaryImageToDocument: { scaleX: 0.5, scaleY: 0.5 }
  };

  return {
    parentBinaryImage,
    analysisRegion,
    lineCandidates: overrides.lineCandidates ?? {
      horizontal: [candidate(0), candidate(8)],
      vertical: [candidate(0), candidate(8)]
    },
    coordinateSystem,
    provenance: { source: "production-test", providerId: "provider-001" }
  };
}

function createBinaryImage() {
  const width = 17;
  const height = 17;
  const data = new Uint8Array(width * height);

  [3, 4, 12, 13].forEach(y => {
    for (let x = 4; x <= 12; x++) data[(y * width) + x] = 1;
  });
  [3, 4, 12, 13].forEach(x => {
    for (let y = 4; y <= 12; y++) data[(y * width) + x] = 1;
  });
  return { width, height, data };
}

function candidate(position) {
  return {
    position,
    start: position,
    end: position,
    thickness: 1,
    strength: 5,
    averageStrength: 5
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
