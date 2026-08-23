import fs from "fs";
import { createOuterLineCenterObservation } from "../analysis/OuterLineCenterObservation";
import { createDigitizationExperimentBenchmark } from "./digitizationExperimentBenchmark";
import { createExperimentObservationReport } from "./experimentObservationReport";
import {
  createShadowOuterLineCenterNeighborhoodDiagnosticsRunner,
  shadowOuterLineCenterNeighborhoodDiagnosticsExperiment
} from "./shadowOuterLineCenterNeighborhoodDiagnostics";

test.each(["production", undefined, "preview"])(
  "rejects %p before accessing source or DocumentAnalysis evidence",
  environment => {
    const run = createRunner(environment);
    const unreadable = new Proxy({}, {
      get() {
        throw new Error("development evidence must not be read");
      }
    });

    expect(() => run({
      outerLineCenterObservations: unreadable,
      documentAnalysis: unreadable
    })).toThrow(
      "Shadow outer line center neighborhoods are available only in development or test"
    );
  }
);

test.each(["development", "test"])("runs in %s", environment => {
  const result = createRunner(environment)(createInput());

  expect(result).toMatchObject({
    type: "shadow-outer-line-center-neighborhood-diagnostics",
    status: "complete"
  });
});

test("reads a parent-image halo beyond AnalysisRegion while staying inside the document", () => {
  const result = createRunner()(createInput());
  const observation = readObservation(result);

  expect(observation.edges.top.neighborhoodObservationExtent).toEqual({
    coordinateSpace: "parent-binary-image",
    bounds: { top: 0, left: 2, width: 8, height: 8 },
    normalRadius: 4,
    acceptedCenterInParentBinaryImage: 3,
    analysisRegionBounds: { top: 3, left: 2, width: 8, height: 6 },
    clippedToDocumentBounds: true
  });
  expect(observation.edges.bottom.neighborhoodObservationExtent.bounds)
    .toEqual({ top: 4, left: 2, width: 8, height: 8 });
  expect(observation.edges.left.neighborhoodObservationExtent.bounds)
    .toEqual({ top: 3, left: 0, width: 7, height: 6 });
  expect(observation.edges.right.neighborhoodObservationExtent.bounds)
    .toEqual({ top: 3, left: 5, width: 7, height: 6 });
});

test("preserves accepted local centers exactly in top, bottom, left, right order", () => {
  const source = createSourceDiagnostics({
    centers: { top: 0.5, bottom: 5, left: 0, right: 7.5 }
  });
  const result = createRunner()({
    ...createInput(),
    outerLineCenterObservations: source
  });
  const edges = readObservation(result).edges;

  expect(Object.keys(edges)).toEqual(["top", "bottom", "left", "right"]);
  expect(Object.values(edges).map(edge => edge.acceptedCandidateCenter))
    .toEqual([0.5, 5, 0, 7.5]);
  expect(edges.top.projectionEvidence.acceptedCenterInParentBinaryImage)
    .toBe(3.5);
  expect(edges.right.projectionEvidence.acceptedCenterInParentBinaryImage)
    .toBe(9.5);
});

test("records deterministic projections, continuity and nearby maxima without selecting one", () => {
  const run = createRunner();
  const input = createInput();
  const first = run(input);
  const second = run(input);
  const top = readObservation(first).edges.top;

  expect(top.projectionEvidence).toEqual({
    axis: "horizontal",
    coordinateSpace: "parent-binary-image",
    acceptedCenterInParentBinaryImage: 3,
    positions: [0, 1, 2, 3, 4, 5, 6, 7],
    values: [0, 8, 0, 8, 2, 2, 2, 2],
    nearbyLineCenterCandidates: [
      {
        start: 1,
        end: 1,
        position: 1,
        localPosition: -2,
        projectionValue: 8,
        signedOffsetFromAcceptedCenter: -2
      },
      {
        start: 3,
        end: 3,
        position: 3,
        localPosition: 0,
        projectionValue: 8,
        signedOffsetFromAcceptedCenter: 0
      }
    ]
  });
  expect(top.continuityObservations[1]).toEqual({
    position: 1,
    signedOffsetFromAcceptedCenter: -2,
    blackPixelCount: 8,
    longestContinuousBlackRun: 8
  });
  expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  expect(JSON.stringify(first)).not.toMatch(
    /"(score|confidence|rank|ranking|recommendation|selected|preferred|refined)"\s*:/i
  );
});

test("preserves candidate-run geometry and coordinate provenance when available", () => {
  const source = createSourceDiagnostics({ topComplete: true });
  const observation = readObservation(createRunner()({
    ...createInput(),
    outerLineCenterObservations: source
  }));

  expect(observation.edges.top.candidateRunGeometry).toEqual({
    start: 0,
    end: 1,
    thickness: 2
  });
  expect(observation.edges.top.status).toBe("available");
  expect(observation.edges.top.provenance).toMatchObject({
    acceptedCenterCoordinateSpace: "analysis-region-local",
    observedCoordinateSpace: "parent-binary-image",
    localToBinaryImage: {
      offsetX: 2,
      offsetY: 3,
      scaleX: 1,
      scaleY: 1
    }
  });
  expect(observation.edges.top.evidenceReferences).toEqual(expect.arrayContaining([
    expect.objectContaining({ evidence: "parent-binary-image-neighborhood" })
  ]));
});

test("reports partial and unavailable evidence explicitly", () => {
  const source = createSourceDiagnostics({
    centers: { top: 0, bottom: null, left: 0, right: 7 }
  });
  const observation = readObservation(createRunner()({
    ...createInput(),
    outerLineCenterObservations: source
  }));

  expect(observation.edges.top).toMatchObject({
    status: "partial",
    acceptedCandidateCenter: 0,
    reasons: [{ code: "candidate-run-geometry-unavailable" }]
  });
  expect(observation.edges.bottom).toMatchObject({
    status: "unavailable",
    acceptedCandidateCenter: null,
    projectionEvidence: null,
    continuityObservations: [],
    neighborhoodObservationExtent: null,
    reasons: [{ code: "accepted-candidate-center-unavailable" }]
  });
});

test("preserves provider and region ordering", () => {
  const sourceA = createSourceProvider("provider-a", "region-a");
  const sourceB = createSourceProvider("provider-b", "region-b");
  const result = createRunner()({
    ...createInput(),
    outerLineCenterObservations: createSourceRoot([sourceA, sourceB])
  });

  expect(result.providers.map(provider => provider.id))
    .toEqual(["provider-a", "provider-b"]);
  expect(result.providers.map(provider => (
    provider.neighborhoodObservations[0].regionId
  ))).toEqual(["region-a", "region-b"]);
});

test("adds compact neighborhood evidence to the Observation Report", async () => {
  const input = createInput();
  const benchmark = await createDigitizationExperimentBenchmark({
    listExperiments: () => [
      fixtureExperiment(
        "shadow-outer-line-center-observation-diagnostics",
        input.outerLineCenterObservations
      ),
      shadowOuterLineCenterNeighborhoodDiagnosticsExperiment
    ],
    now: () => 1
  })(input.documentAnalysis.binaryImage);
  const report = createExperimentObservationReport({
    production: { gridDetection: {} },
    benchmark
  });
  const top = report.observations.available.find(observation => (
    observation.observationId.endsWith("edge.top.neighborhood-evidence")
  ));

  expect(top).toMatchObject({
    experimentId: "shadow-outer-line-center-neighborhood-diagnostics",
    category: "shadow-outer-line-center-neighborhood",
    value: {
      acceptedCandidateCenter: 0,
      neighborhoodBounds: { top: 0, left: 2, width: 8, height: 8 },
      projectionValues: [0, 8, 0, 8, 2, 2, 2, 2]
    }
  });
  expect(top.value).not.toHaveProperty("sourceObservation");
});

test("does not access Ground Truth or enter production orchestration", () => {
  const source = fs.readFileSync(
    require.resolve("./shadowOuterLineCenterNeighborhoodDiagnostics"),
    "utf8"
  );
  const production = fs.readFileSync(
    require.resolve("../detection/imageGridDetectionOrchestrator"),
    "utf8"
  );

  expect(source).not.toMatch(/groundTruth|grid-ground-truth/i);
  expect(source).not.toMatch(/detectGrid|analyzeGrid|reconstructUniform/);
  expect(production).not.toMatch(/NeighborhoodDiagnostics/);
});

test("does not mutate frozen source or BinaryImage evidence", () => {
  const input = createInput();
  const frozenSource = deepFreeze(input.outerLineCenterObservations);
  const beforeData = Array.from(input.documentAnalysis.binaryImage.data);
  const result = createRunner()({
    ...input,
    outerLineCenterObservations: frozenSource
  });

  expect(Array.from(input.documentAnalysis.binaryImage.data)).toEqual(beforeData);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(readObservation(result))).toBe(true);
});

function createRunner(environment) {
  const resolvedEnvironment = arguments.length === 0 ? "test" : environment;

  return createShadowOuterLineCenterNeighborhoodDiagnosticsRunner({
    readEnvironment: () => resolvedEnvironment
  });
}

function createInput() {
  const binaryImage = createBinaryImage();

  return {
    outerLineCenterObservations: createSourceDiagnostics(),
    documentAnalysis: {
      type: "document-analysis",
      version: 1,
      status: "measured",
      binaryImage,
      dimensions: {
        binaryImage: { width: binaryImage.width, height: binaryImage.height }
      },
      coordinateRelationship: { type: "identity" },
      diagnostics: []
    }
  };
}

function createBinaryImage() {
  const width = 12;
  const height = 12;
  const data = new Uint8Array(width * height);

  for (let x = 2; x <= 9; x++) {
    data[(1 * width) + x] = 1;
    data[(3 * width) + x] = 1;
    data[(8 * width) + x] = 1;
  }

  for (let y = 3; y <= 8; y++) {
    data[(y * width) + 2] = 1;
    data[(y * width) + 9] = 1;
  }

  return { width, height, data };
}

function createSourceDiagnostics(options = {}) {
  return createSourceRoot([createSourceProvider(
    "provider-a",
    "region-a",
    options
  )]);
}

function createSourceRoot(providers) {
  return {
    type: "shadow-outer-line-center-observation-diagnostics",
    version: 1,
    status: "complete",
    sourceExperimentIds: [],
    reason: null,
    providers
  };
}

function createSourceProvider(providerId, regionId, options = {}) {
  return {
    id: providerId,
    description: `Provider ${providerId}`,
    status: "available",
    regionCount: 1,
    reason: null,
    outerLineCenterObservations: [{
      providerId,
      regionId,
      status: "completed",
      observation: createSourceObservation(regionId, options),
      error: null
    }]
  };
}

function createSourceObservation(regionId, {
  centers = { top: 0, bottom: 5, left: 0, right: 7 },
  topComplete = false
} = {}) {
  const coordinateSystem = {
    space: "analysis-region-local",
    origin: "top-left",
    xDirection: "right",
    yDirection: "down",
    linePosition: "visual-line-center",
    localToBinaryImage: {
      offsetX: 2,
      offsetY: 3,
      scaleX: 1,
      scaleY: 1
    },
    provenance: {
      regionBounds: { top: 3, left: 2, width: 8, height: 6 }
    }
  };
  const edges = Object.fromEntries(
    ["top", "bottom", "left", "right"].map(edge => [
      edge,
      createSourceEdge(edge, centers[edge], topComplete && edge === "top")
    ])
  );

  return createOuterLineCenterObservation({
    analysisRegionId: regionId,
    coordinateSystem,
    edges,
    provenance: { source: "phase-2-fixture" },
    assumptions: [],
    diagnostics: [],
    evidenceReferences: []
  });
}

function createSourceEdge(edge, center, complete) {
  if (!Number.isFinite(center)) {
    return {
      edge,
      status: "unavailable",
      acceptedCandidateCenter: null,
      candidateRunGeometry: null,
      projectionEvidence: null,
      continuityObservations: [],
      neighborhoodObservationExtent: null,
      provenance: { source: "fixture" },
      assumptions: [],
      diagnostics: [],
      evidenceReferences: [],
      reasons: [{ code: "center-unavailable" }]
    };
  }

  return {
    edge,
    status: complete ? "available" : "partial",
    acceptedCandidateCenter: center,
    candidateRunGeometry: complete
      ? { start: 0, end: 1, thickness: 2 }
      : null,
    projectionEvidence: complete ? { values: [1] } : null,
    continuityObservations: complete ? [{ position: center }] : [],
    neighborhoodObservationExtent: complete
      ? { bounds: { top: 0, left: 0, width: 1, height: 1 } }
      : null,
    provenance: { source: "fixture" },
    assumptions: [],
    diagnostics: [],
    evidenceReferences: [{ source: "fixture", edge }],
    reasons: complete ? [] : [{ code: "phase-2-evidence-partial" }]
  };
}

function readObservation(result) {
  return result.providers[0].neighborhoodObservations[0].observation;
}

function fixtureExperiment(id, diagnostics) {
  return { id, description: `${id} fixture`, run: () => diagnostics };
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
