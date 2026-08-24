import fs from "fs";
import { createDigitizationExperimentBenchmark } from "./digitizationExperimentBenchmark";
import { createExperimentObservationReport } from "./experimentObservationReport";
import {
  createShadowOuterLineCenterGeometryDiagnosticsRunner,
  shadowOuterLineCenterGeometryDiagnosticsExperiment
} from "./shadowOuterLineCenterGeometryDiagnostics";

test.each(["production", undefined, "preview"])(
  "rejects %p before reading neighborhood or BinaryImage evidence",
  environment => {
    const unreadable = new Proxy({}, {
      get() {
        throw new Error("development evidence must not be read");
      }
    });

    expect(() => createRunner(environment)({
      neighborhoodDiagnostics: unreadable,
      binaryImage: unreadable
    })).toThrow(
      "Shadow outer line center geometry diagnostics are available only in development or test"
    );
  }
);

test.each(["development", "test"])("runs in %s", environment => {
  expect(createRunner(environment)(createInput())).toMatchObject({
    type: "shadow-outer-line-center-geometry-diagnostics",
    status: "complete"
  });
});

test("derives deterministic contiguous run and projection plateau geometry", () => {
  const run = createRunner();
  const input = createInput();
  const first = run(input);
  const second = run(input);
  const top = readEdge(first, "top");

  expect(top.geometryStatus).toBe("available");
  expect(top.geometry.contiguousStrongOrFullLineRun).toEqual({
    start: { position: 1, signedOffsetFromAcceptedCenter: -1 },
    end: { position: 2, signedOffsetFromAcceptedCenter: 0 },
    thickness: 2,
    midpoint: { position: 1.5, signedOffsetFromAcceptedCenter: -0.5 }
  });
  expect(top.geometry.projectionPlateau).toEqual({
    start: { position: 1, signedOffsetFromAcceptedCenter: -1 },
    end: { position: 2, signedOffsetFromAcceptedCenter: 0 },
    width: 2,
    midpoint: { position: 1.5, signedOffsetFromAcceptedCenter: -0.5 },
    projectionValue: 6
  });
  expect(top.geometry.projectionWeightedCentroid).toEqual({
    position: 1.5,
    signedOffsetFromAcceptedCenter: -0.5
  });
  expect(top.geometry.firstStrongOrFullContinuityPosition).toEqual({
    position: 1,
    signedOffsetFromAcceptedCenter: -1
  });
  expect(top.geometry.lastStrongOrFullContinuityPosition).toEqual({
    position: 2,
    signedOffsetFromAcceptedCenter: 0
  });
  expect(JSON.stringify(second)).toBe(JSON.stringify(first));
});

test("observes thick lines and half-pixel geometric midpoints", () => {
  const result = createRunner()(createInput());
  const top = readEdge(result, "top");
  const bottom = readEdge(result, "bottom");

  expect(top.geometry.contiguousStrongOrFullLineRun.midpoint.position).toBe(1.5);
  expect(bottom.geometry.contiguousStrongOrFullLineRun).toEqual({
    start: { position: 21, signedOffsetFromAcceptedCenter: -1 },
    end: { position: 23, signedOffsetFromAcceptedCenter: 1 },
    thickness: 3,
    midpoint: { position: 22, signedOffsetFromAcceptedCenter: 0 }
  });
  expect(bottom.geometry.projectionPlateau.width).toBe(3);
});

test("records a projection-weighted centroid for asymmetric evidence", () => {
  const binaryImage = createEmptyBinaryImage();

  setRowPixels(binaryImage, 0, 1, 1);
  setRowPixels(binaryImage, 1, 1, 2);
  setRowPixels(binaryImage, 2, 1, 4);
  const input = createInput({ binaryImage });
  const top = readEdge(createRunner()(input), "top");

  expect(top.geometry.projectionWeightedCentroid.position)
    .toBeCloseTo(10 / 7, 12);
  expect(top.geometry.projectionWeightedCentroid.signedOffsetFromAcceptedCenter)
    .toBeCloseTo((10 / 7) - 2, 12);
  expect(top.geometry.contiguousStrongOrFullLineRun.midpoint.position).toBe(2);
  expect(top.rawProjectionSamples).toEqual([
    { position: 0, value: 1 },
    { position: 1, value: 2 },
    { position: 2, value: 4 },
    { position: 3, value: 0 },
    { position: 4, value: 0 }
  ]);
});

test("preserves all disjoint geometric descriptions as ambiguous", () => {
  const binaryImage = createEmptyBinaryImage();

  setRowPixels(binaryImage, 0, 1, 6);
  setRowPixels(binaryImage, 4, 1, 6);
  const top = readEdge(
    createRunner()(createInput({ binaryImage })),
    "top"
  );

  expect(top.status).toBe("ambiguous");
  expect(top.geometryStatus).toBe("ambiguous");
  expect(top.geometry.contiguousStrongOrFullLineRuns).toHaveLength(2);
  expect(top.geometry.contiguousStrongOrFullLineRun).toBeNull();
  expect(top.geometry.maximumProjectionPlateaus).toHaveLength(2);
  expect(top.geometry.projectionPlateau).toBeNull();
  expect(top.reasons).toEqual([{
    code: "multiple-geometric-descriptions-observed"
  }]);
});

test("represents unavailable geometry without inventing positions", () => {
  const result = createRunner()(createInput({
    binaryImage: createEmptyBinaryImage(),
    unavailableRight: true
  }));
  const top = readEdge(result, "top");
  const right = readEdge(result, "right");

  expect(top).toMatchObject({
    status: "unavailable",
    geometryStatus: "unavailable",
    acceptedCandidateCenter: 0,
    reasons: [{ code: "positive-projection-evidence-unavailable" }]
  });
  expect(top.geometry).toMatchObject({
    contiguousStrongOrFullLineRuns: [],
    contiguousStrongOrFullLineRun: null,
    projectionWeightedCentroid: null
  });
  expect(right).toMatchObject({
    status: "unavailable",
    acceptedCandidateCenter: null,
    acceptedCenterInParentBinaryImage: null,
    reasons: [{ code: "accepted-candidate-center-unavailable" }]
  });
});

test("preserves exact accepted centers, edge order, provenance and transforms", () => {
  const input = createInput({ acceptedTopLocalCenter: 0.5 });
  const observation = readObservation(createRunner()(input));
  const top = observation.edges.top;

  expect(Object.keys(observation.edges)).toEqual([
    "top",
    "bottom",
    "left",
    "right"
  ]);
  expect(top.acceptedCandidateCenter).toBe(0.5);
  expect(top.acceptedCenterInParentBinaryImage).toBe(2);
  expect(top.coordinateTransform).toEqual({
    offsetX: 2,
    offsetY: 2,
    scaleX: 1,
    scaleY: 1
  });
  expect(top.candidateRunGeometry).toEqual({
    start: 1,
    end: 2,
    thickness: 2
  });
  expect(top.candidateRunProvenance).toEqual({
    provenance: { source: "neighborhood-fixture", edge: "top" },
    evidenceReferences: [{ source: "candidate-run", edge: "top" }]
  });
  expect(top.diagnostics[0].sourceProjectionMatchesParentBinaryImage).toBe(true);
});

test("preserves source partial state without hiding available geometry", () => {
  const input = createInput();
  const topSource = readSourceEdge(input, "top");

  topSource.status = "partial";
  topSource.reasons = [{ code: "candidate-run-geometry-unavailable" }];
  topSource.candidateRunGeometry = null;
  const top = readEdge(createRunner()(input), "top");

  expect(top.status).toBe("partial");
  expect(top.geometryStatus).toBe("available");
  expect(top.geometry.contiguousStrongOrFullLineRun).not.toBeNull();
  expect(top.reasons).toEqual([{
    code: "source-neighborhood-partial"
  }]);
});

test("extracts compact geometry through benchmark and Observation Report", async () => {
  const input = createInput();
  const benchmark = await createDigitizationExperimentBenchmark({
    listExperiments: () => [
      fixtureExperiment(
        "shadow-outer-line-center-neighborhood-diagnostics",
        input.neighborhoodDiagnostics
      ),
      shadowOuterLineCenterGeometryDiagnosticsExperiment
    ],
    now: () => 1
  })(input.binaryImage);
  const report = createExperimentObservationReport({
    production: { gridDetection: {} },
    benchmark
  });
  const top = report.observations.available.find(observation => (
    observation.observationId.endsWith("edge.top.geometry")
  ));

  expect(top).toMatchObject({
    experimentId: "shadow-outer-line-center-geometry-diagnostics",
    category: "shadow-outer-line-center-geometry",
    value: {
      status: "available",
      geometryStatus: "available",
      acceptedCandidateCenter: 0,
      acceptedCenterInParentBinaryImage: 2,
      geometry: {
        contiguousStrongOrFullLineRun: {
          thickness: 2
        }
      }
    }
  });
  expect(top.value).not.toHaveProperty("rawProjectionSamples");
  expect(top.value).not.toHaveProperty("continuityObservations");
});

test("does not mutate inputs or add selection, ranking, scoring or refinement fields", () => {
  const input = createInput();
  const before = JSON.stringify(input.neighborhoodDiagnostics);
  const result = createRunner()(input);

  expect(JSON.stringify(input.neighborhoodDiagnostics)).toBe(before);
  expect(Object.isFrozen(result)).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(
    /"(score|confidence|rank|ranking|recommendation|selected|preferred|refined|refinement)"\s*:/i
  );
});

test("does not access Ground Truth or production orchestration", () => {
  const source = fs.readFileSync(
    require.resolve("./shadowOuterLineCenterGeometryDiagnostics"),
    "utf8"
  );
  const production = fs.readFileSync(
    require.resolve("../detection/imageGridDetectionOrchestrator"),
    "utf8"
  );

  expect(source).not.toMatch(/groundTruth|grid-ground-truth/i);
  expect(source).not.toMatch(/detectGrid|analyzeGrid|reconstructUniform/);
  expect(production).not.toMatch(/OuterLineCenterGeometry/);
});

function createRunner(environment) {
  const resolvedEnvironment = arguments.length === 0 ? "test" : environment;

  return createShadowOuterLineCenterGeometryDiagnosticsRunner({
    readEnvironment: () => resolvedEnvironment
  });
}

function createInput({
  binaryImage = createDefaultBinaryImage(),
  acceptedTopLocalCenter = 0,
  unavailableRight = false
} = {}) {
  const coordinateSystem = {
    space: "analysis-region-local",
    origin: "top-left",
    xDirection: "right",
    yDirection: "down",
    linePosition: "visual-line-center",
    localToBinaryImage: {
      offsetX: 2,
      offsetY: 2,
      scaleX: 1,
      scaleY: 1
    }
  };
  const edges = {
    top: createSourceEdge({
      binaryImage,
      edge: "top",
      localCenter: acceptedTopLocalCenter,
      parentCenter: 2,
      bounds: { top: 0, left: 1, width: 6, height: 5 }
    }),
    bottom: createSourceEdge({
      binaryImage,
      edge: "bottom",
      localCenter: 20,
      parentCenter: 22,
      bounds: { top: 20, left: 1, width: 6, height: 5 }
    }),
    left: createSourceEdge({
      binaryImage,
      edge: "left",
      localCenter: 10,
      parentCenter: 12,
      bounds: { top: 1, left: 10, width: 5, height: 6 }
    }),
    right: unavailableRight
      ? createUnavailableEdge("right")
      : createSourceEdge({
        binaryImage,
        edge: "right",
        localCenter: 20,
        parentCenter: 22,
        bounds: { top: 1, left: 20, width: 5, height: 6 }
      })
  };
  const observation = {
    type: "outer-line-center-observation",
    version: 1,
    analysisRegionId: "region-a",
    coordinateSystem,
    edges,
    provenance: { source: "neighborhood-fixture" }
  };

  return {
    binaryImage,
    neighborhoodDiagnostics: {
      type: "shadow-outer-line-center-neighborhood-diagnostics",
      version: 1,
      status: "complete",
      providers: [{
        id: "provider-a",
        description: "Provider A",
        status: "available",
        regionCount: 1,
        reason: null,
        neighborhoodObservations: [{
          providerId: "provider-a",
          regionId: "region-a",
          status: "completed",
          observation,
          error: null
        }]
      }]
    }
  };
}

function createDefaultBinaryImage() {
  const binaryImage = createEmptyBinaryImage();

  for (const y of [1, 2]) {
    setRowPixels(binaryImage, y, 1, 6);
  }

  for (const y of [21, 22, 23]) {
    setRowPixels(binaryImage, y, 1, 6);
  }

  for (const x of [11, 12]) {
    setColumnPixels(binaryImage, x, 1, 6);
  }

  for (const x of [21, 22]) {
    setColumnPixels(binaryImage, x, 1, 6);
  }

  return binaryImage;
}

function createEmptyBinaryImage() {
  return {
    width: 30,
    height: 30,
    data: new Uint8Array(30 * 30)
  };
}

function setRowPixels(binaryImage, y, startX, count) {
  for (let offset = 0; offset < count; offset++) {
    binaryImage.data[(y * binaryImage.width) + startX + offset] = 1;
  }
}

function setColumnPixels(binaryImage, x, startY, count) {
  for (let offset = 0; offset < count; offset++) {
    binaryImage.data[((startY + offset) * binaryImage.width) + x] = 1;
  }
}

function createSourceEdge({
  binaryImage,
  edge,
  localCenter,
  parentCenter,
  bounds
}) {
  const horizontal = edge === "top" || edge === "bottom";
  const normalStart = horizontal ? bounds.top : bounds.left;
  const normalLength = horizontal ? bounds.height : bounds.width;
  const tangentialLength = horizontal ? bounds.width : bounds.height;
  const positions = [];
  const values = [];
  const continuityObservations = [];

  for (let normalOffset = 0; normalOffset < normalLength; normalOffset++) {
    const position = normalStart + normalOffset;
    let value = 0;
    let currentRun = 0;
    let longestRun = 0;

    for (let tangentOffset = 0; tangentOffset < tangentialLength; tangentOffset++) {
      const x = horizontal ? bounds.left + tangentOffset : position;
      const y = horizontal ? position : bounds.top + tangentOffset;
      const pixel = binaryImage.data[(y * binaryImage.width) + x] === 1 ? 1 : 0;

      value += pixel;
      currentRun = pixel ? currentRun + 1 : 0;
      longestRun = Math.max(longestRun, currentRun);
    }

    positions.push(position);
    values.push(value);
    continuityObservations.push({
      position,
      signedOffsetFromAcceptedCenter: position - parentCenter,
      blackPixelCount: value,
      longestContinuousBlackRun: longestRun
    });
  }

  return {
    edge,
    status: "available",
    acceptedCandidateCenter: localCenter,
    candidateRunGeometry: {
      start: positions.find(position => values[position - normalStart] > 0),
      end: positions.slice().reverse().find(
        position => values[position - normalStart] > 0
      ),
      thickness: values.filter(value => value > 0).length
    },
    projectionEvidence: {
      axis: horizontal ? "horizontal" : "vertical",
      coordinateSpace: "parent-binary-image",
      acceptedCenterInParentBinaryImage: parentCenter,
      positions,
      values,
      nearbyLineCenterCandidates: []
    },
    continuityObservations,
    neighborhoodObservationExtent: {
      coordinateSpace: "parent-binary-image",
      bounds
    },
    provenance: { source: "neighborhood-fixture", edge },
    assumptions: [],
    diagnostics: [],
    evidenceReferences: [{ source: "candidate-run", edge }],
    reasons: []
  };
}

function createUnavailableEdge(edge) {
  return {
    edge,
    status: "unavailable",
    acceptedCandidateCenter: null,
    candidateRunGeometry: null,
    projectionEvidence: null,
    continuityObservations: [],
    neighborhoodObservationExtent: null,
    provenance: { source: "neighborhood-fixture", edge },
    assumptions: [],
    diagnostics: [],
    evidenceReferences: [],
    reasons: [{ code: "center-unavailable" }]
  };
}

function readObservation(result) {
  return result.providers[0].geometryObservations[0].observation;
}

function readEdge(result, edge) {
  return readObservation(result).edges[edge];
}

function readSourceEdge(input, edge) {
  return input.neighborhoodDiagnostics.providers[0]
    .neighborhoodObservations[0].observation.edges[edge];
}

function fixtureExperiment(id, diagnostics) {
  return { id, description: `${id} fixture`, run: () => diagnostics };
}
