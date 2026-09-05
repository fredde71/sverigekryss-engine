import { createOuterVisualExtent } from "./OuterVisualExtent";

test("creates the visible footprint from factual outer continuity positions", () => {
  const observation = createObservation();
  const result = createOuterVisualExtent({
    outerLineGeometryObservation: observation
  });

  expect(result).toMatchObject({
    type: "outer-visual-extent",
    version: 1,
    id: "outer-visual-extent:region-a",
    status: "available",
    coordinateSpace: "analysis-region-local",
    semantics: "observed-visible-outer-footprint",
    bounds: { top: 9, left: 19, width: 202, height: 102 },
    edges: {
      top: {
        position: 9,
        definition: "firstStrongOrFullContinuityPosition"
      },
      bottom: {
        position: 111,
        definition: "lastStrongOrFullContinuityPosition"
      },
      left: {
        position: 19,
        definition: "firstStrongOrFullContinuityPosition"
      },
      right: {
        position: 221,
        definition: "lastStrongOrFullContinuityPosition"
      }
    }
  });
  expect(result.coordinateSystem).toEqual(observation.coordinateSystem);
  expect(result.provenance.source).toEqual(observation.provenance);
  expect(result.evidenceReferences).toEqual(observation.evidenceReferences);
});

test("preserves partial and ambiguous source semantics", () => {
  const partial = createObservation();
  partial.edges.top.status = "partial";
  expect(createOuterVisualExtent({
    outerLineGeometryObservation: partial
  }).status).toBe("partial");

  const ambiguous = createObservation();
  ambiguous.edges.right.geometryStatus = "ambiguous";
  const result = createOuterVisualExtent({
    outerLineGeometryObservation: ambiguous
  });
  expect(result.status).toBe("ambiguous");
  expect(result.bounds).toEqual({
    top: 9,
    left: 19,
    width: 202,
    height: 102
  });
});

test("does not fabricate an extent from missing geometry or transforms", () => {
  const missingEdge = createObservation();
  missingEdge.edges.left.geometry.firstStrongOrFullContinuityPosition = null;
  expect(createOuterVisualExtent({
    outerLineGeometryObservation: missingEdge
  })).toMatchObject({
    status: "unavailable",
    bounds: null,
    reasons: ["left-visual-edge-unavailable"]
  });

  const missingTransform = createObservation();
  delete missingTransform.coordinateSystem.binaryImageToDocument;
  expect(createOuterVisualExtent({
    outerLineGeometryObservation: missingTransform
  })).toMatchObject({
    status: "available",
    coordinateSystem: expect.not.objectContaining({
      binaryImageToDocument: expect.anything()
    })
  });
});

test("is deterministic, deeply immutable and does not mutate its input", () => {
  const observation = deepFreeze(createObservation());
  const before = JSON.stringify(observation);
  const first = createOuterVisualExtent({
    outerLineGeometryObservation: observation
  });
  const second = createOuterVisualExtent({
    outerLineGeometryObservation: observation
  });

  expect(second).toEqual(first);
  expect(JSON.stringify(observation)).toBe(before);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.edges.top)).toBe(true);
  expect(Object.isFrozen(first.coordinateSystem.localToBinaryImage)).toBe(true);
});

function createObservation() {
  const coordinateSystem = {
    space: "analysis-region-local",
    unit: "pixel",
    origin: "top-left",
    xDirection: "right",
    yDirection: "down",
    linePosition: "visual-line-center",
    localToBinaryImage: {
      offsetX: 5,
      offsetY: 7,
      scaleX: 1,
      scaleY: 1
    },
    binaryImageToDocument: { scaleX: 0.5, scaleY: 0.25 }
  };
  return {
    type: "outer-line-center-geometry-observation",
    version: 1,
    analysisRegionId: "region-a",
    coordinateSystem,
    edges: {
      top: createEdge("top", 9, 12),
      bottom: createEdge("bottom", 108, 111),
      left: createEdge("left", 19, 22),
      right: createEdge("right", 218, 221)
    },
    provenance: { source: "outer-line-geometry-fixture" },
    evidenceReferences: [{ artifactType: "grid-analysis", id: "grid-a" }]
  };
}

function createEdge(edge, first, last) {
  return {
    edge,
    status: "available",
    geometryStatus: "available",
    geometry: {
      firstStrongOrFullContinuityPosition: { position: first },
      lastStrongOrFullContinuityPosition: { position: last }
    },
    candidateRunProvenance: {
      evidenceReferences: [{ edge, source: "candidate-run" }]
    },
    provenance: { edge, source: "outer-line-neighborhood" }
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
