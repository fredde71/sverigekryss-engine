import { createGridGroundTruth } from "./gridGroundTruth";
import {
  createOuterLineCenterGeometryValidationReport
} from "./outerLineCenterGeometryValidationReport";

test("compares six factual geometric definitions for every edge in fixed order", () => {
  const report = createOuterLineCenterGeometryValidationReport(createInputs());
  const edges = readRegion(report).edges;
  const top = edges[0];

  expect(edges.map(edge => edge.edge)).toEqual([
    "top",
    "bottom",
    "left",
    "right"
  ]);
  expect(top.definitions.map(definition => definition.id)).toEqual([
    "accepted-center",
    "run-midpoint",
    "plateau-midpoint",
    "weighted-centroid",
    "first-qualifying-position",
    "last-qualifying-position"
  ]);
  expect(top.definitions).toEqual([
    comparedDefinition("accepted-center", "Accepted center", 11, 10, 1),
    comparedDefinition("run-midpoint", "Run midpoint", 10, 10, 0),
    comparedDefinition("plateau-midpoint", "Plateau midpoint", 9.5, 10, -0.5),
    comparedDefinition(
      "weighted-centroid",
      "Projection-weighted centroid",
      10.25,
      10,
      0.25
    ),
    comparedDefinition(
      "first-qualifying-position",
      "First qualifying position",
      9,
      10,
      -1
    ),
    comparedDefinition(
      "last-qualifying-position",
      "Last qualifying position",
      12,
      10,
      2
    )
  ]);
});

test("reports factual closest definitions and preserves exact ties", () => {
  const report = createOuterLineCenterGeometryValidationReport(createInputs());
  const [top, bottom, left] = readRegion(report).edges;

  expect(top.closestGeometricDefinitionObservation).toEqual({
    status: "observed",
    minimumAbsoluteDelta: 0,
    definitions: [{
      id: "run-midpoint",
      title: "Run midpoint",
      observedPosition: 10,
      signedDelta: 0,
      absoluteDelta: 0,
      exactMatch: true
    }],
    tie: false,
    meaning: "validation-observation-only"
  });
  expect(bottom.closestGeometricDefinitionObservation).toEqual({
    status: "tied",
    minimumAbsoluteDelta: 0,
    definitions: [
      expect.objectContaining({ id: "accepted-center", exactMatch: true }),
      expect.objectContaining({ id: "run-midpoint", exactMatch: true }),
      expect.objectContaining({ id: "plateau-midpoint", exactMatch: true }),
      expect.objectContaining({ id: "weighted-centroid", exactMatch: true })
    ],
    tie: true,
    meaning: "validation-observation-only"
  });
  expect(left.closestGeometricDefinitionObservation).toEqual({
    status: "observed",
    minimumAbsoluteDelta: 0,
    definitions: [expect.objectContaining({
      id: "weighted-centroid",
      observedPosition: 5,
      exactMatch: true
    })],
    tie: false,
    meaning: "validation-observation-only"
  });
});

test("preserves signed, absolute, exact and half-pixel comparisons", () => {
  const top = readRegion(
    createOuterLineCenterGeometryValidationReport(createInputs())
  ).edges[0];

  expect(top.definitions[0]).toMatchObject({
    signedDelta: 1,
    absoluteDelta: 1,
    exactMatch: false
  });
  expect(top.definitions[1]).toMatchObject({
    signedDelta: 0,
    absoluteDelta: 0,
    exactMatch: true
  });
  expect(top.definitions[2]).toMatchObject({
    signedDelta: -0.5,
    absoluteDelta: 0.5,
    exactMatch: false
  });
});

test("preserves ambiguous and unavailable geometry without inventing comparisons", () => {
  const report = createOuterLineCenterGeometryValidationReport(createInputs());
  const left = readRegion(report).edges[2];
  const right = readRegion(report).edges[3];

  expect(left).toMatchObject({
    status: "partial",
    observationStatus: "ambiguous",
    geometryStatus: "ambiguous",
    reason: "some-geometric-definition-positions-unavailable"
  });
  expect(left.definitions[1]).toMatchObject({
    id: "run-midpoint",
    status: "unavailable",
    observedPosition: null,
    signedDelta: null,
    absoluteDelta: null,
    exactMatch: null,
    reason: "geometric-definition-position-unavailable"
  });
  expect(right).toMatchObject({
    status: "unavailable",
    observationStatus: "unavailable",
    geometryStatus: "unavailable",
    reason: "geometric-definition-positions-unavailable"
  });
  expect(right.closestGeometricDefinitionObservation).toEqual({
    status: "unavailable",
    minimumAbsoluteDelta: null,
    definitions: [],
    tie: null,
    meaning: "validation-observation-only"
  });
});

test("keeps raw geometry and provenance separate from Ground Truth comparisons", () => {
  const top = readRegion(
    createOuterLineCenterGeometryValidationReport(createInputs())
  ).edges[0];

  expect(top.rawGeometryObservation).toMatchObject({
    status: "available",
    geometryStatus: "available",
    acceptedCandidateCenter: 1,
    acceptedCenterInParentBinaryImage: 11,
    candidateRunGeometry: { start: 9, end: 11, thickness: 3 },
    candidateRunProvenance: {
      provenance: { source: "phase-5-fixture", edge: "top" },
      evidenceReferences: [{ source: "parent-binary-image" }]
    },
    coordinateTransform: {
      offsetX: 3,
      offsetY: 10,
      scaleX: 1,
      scaleY: 1
    },
    provenance: { source: "phase-5-fixture", edge: "top" }
  });
  expect(top.rawGeometryObservation).not.toHaveProperty("groundTruthCenter");
});

test("preserves dataset, provider, region and unmatched annotation order", () => {
  const first = createDatasetItem("item-a", "a.pdf");
  const second = createDatasetItem("item-b", "b.pdf");

  readExperiment(first).diagnostics.providers.push(
    createProvider("provider-b", "region-b")
  );
  const report = createOuterLineCenterGeometryValidationReport({
    datasetReport: createDatasetReport([first, second]),
    groundTruth: createGroundTruth([
      createAnnotation("item-a", "a.pdf"),
      createAnnotation("item-b", "b.pdf"),
      createAnnotation("item-c", "c.pdf")
    ])
  });

  expect(report.items.map(item => item.itemId)).toEqual(["item-a", "item-b"]);
  expect(report.items[0].providers.map(provider => provider.providerId))
    .toEqual(["provider-a", "provider-b"]);
  expect(report.items[0].providers.map(provider => provider.regions[0].regionId))
    .toEqual(["region-a", "region-b"]);
  expect(report.unmatchedAnnotations).toEqual([{
    itemId: "item-c",
    filename: "c.pdf",
    reason: "dataset-item-not-found"
  }]);
});

test("represents missing Ground Truth, filename mismatch and experiment failure", () => {
  const missing = createDatasetItem("missing", "missing.pdf");
  const failed = createDatasetItem("failed", "failed.pdf", false);
  const report = createOuterLineCenterGeometryValidationReport({
    datasetReport: createDatasetReport([missing, failed]),
    groundTruth: createGroundTruth([
      createAnnotation("failed", "other.pdf")
    ])
  });

  expect(report.items[0]).toMatchObject({
    status: "unavailable",
    reasons: ["ground-truth-annotation-unavailable"]
  });
  expect(report.items[1]).toMatchObject({
    status: "unavailable",
    reasons: [
      "filename-mismatch",
      "outer-line-center-geometry-experiment-failed"
    ]
  });
});

test("is deterministic, immutable, ignores runtime images and adds no decision fields", () => {
  const inputs = createInputs();
  const top = readExperiment(inputs.datasetReport.items[0]).diagnostics.providers[0]
    .geometryObservations[0].observation.edges.top;

  Object.defineProperty(top, "binaryImage", {
    enumerable: true,
    get() {
      throw new Error("runtime BinaryImage must not be accessed");
    }
  });
  const first = createOuterLineCenterGeometryValidationReport(inputs);
  const second = createOuterLineCenterGeometryValidationReport(inputs);

  expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.items[0])).toBe(true);
  expect(JSON.stringify(first)).not.toMatch(
    /"(score|confidence|rank|ranking|recommendation|selected|preferred|winner)"\s*:/i
  );
});

test("validates input contracts and exact dataset association", () => {
  expect(() => createOuterLineCenterGeometryValidationReport()).toThrow(
    "Version 1 digitization dataset report is required"
  );
  expect(() => createOuterLineCenterGeometryValidationReport({
    datasetReport: createDatasetReport([]),
    groundTruth: createGroundTruth([], "other")
  })).toThrow("datasetId must match exactly");
});

function createInputs() {
  return {
    datasetReport: createDatasetReport([
      createDatasetItem("item-a", "a.pdf")
    ]),
    groundTruth: createGroundTruth([
      createAnnotation("item-a", "a.pdf")
    ])
  };
}

function createDatasetReport(items) {
  return {
    type: "digitization-dataset-report",
    version: 1,
    datasetRun: { datasetId: "tt-dataset" },
    items
  };
}

function createDatasetItem(itemId, filename, success = true) {
  return {
    id: itemId,
    metadata: { filename },
    comparison: {
      status: "completed",
      result: {
        benchmark: {
          experiments: [{
            id: "shadow-outer-line-center-geometry-diagnostics",
            description: "fixture",
            durationMs: 1,
            success,
            diagnostics: success
              ? {
                type: "shadow-outer-line-center-geometry-diagnostics",
                version: 1,
                status: "complete",
                providers: [createProvider("provider-a", "region-a")]
              }
              : { type: "digitization-experiment-failure" }
          }]
        }
      }
    }
  };
}

function createProvider(providerId, regionId) {
  return {
    id: providerId,
    status: "available",
    regionCount: 1,
    reason: null,
    geometryObservations: [{
      providerId,
      regionId,
      status: "completed",
      reason: null,
      observation: createGeometryObservation(regionId),
      error: null
    }]
  };
}

function createGeometryObservation(regionId) {
  return {
    type: "outer-line-center-geometry-observation",
    version: 1,
    analysisRegionId: regionId,
    coordinateSystem: {
      space: "analysis-region-local",
      localToBinaryImage: {
        offsetX: 3,
        offsetY: 10,
        scaleX: 1,
        scaleY: 1
      }
    },
    edges: {
      top: createEdge({
        edge: "top",
        acceptedLocal: 1,
        acceptedParent: 11,
        runMidpoint: 10,
        plateauMidpoint: 9.5,
        centroid: 10.25,
        first: 9,
        last: 12
      }),
      bottom: createEdge({
        edge: "bottom",
        acceptedLocal: 20,
        acceptedParent: 30,
        runMidpoint: 30,
        plateauMidpoint: 30,
        centroid: 30,
        first: 29,
        last: 31
      }),
      left: createEdge({
        edge: "left",
        status: "ambiguous",
        geometryStatus: "ambiguous",
        acceptedLocal: 1,
        acceptedParent: 4,
        runMidpoint: null,
        plateauMidpoint: null,
        centroid: 5,
        first: 4,
        last: 6
      }),
      right: createEdge({
        edge: "right",
        status: "unavailable",
        geometryStatus: "unavailable",
        acceptedLocal: null,
        acceptedParent: null,
        runMidpoint: null,
        plateauMidpoint: null,
        centroid: null,
        first: null,
        last: null
      })
    },
    provenance: { source: "phase-5-fixture" }
  };
}

function createEdge({
  edge,
  status = "available",
  geometryStatus = "available",
  acceptedLocal,
  acceptedParent,
  runMidpoint,
  plateauMidpoint,
  centroid,
  first,
  last
}) {
  return {
    edge,
    status,
    geometryStatus,
    acceptedCandidateCenter: acceptedLocal,
    acceptedCenterInParentBinaryImage: acceptedParent,
    rawProjectionSamples: [],
    continuityObservations: [],
    candidateRunGeometry: Number.isFinite(runMidpoint)
      ? { start: runMidpoint - 1, end: runMidpoint + 1, thickness: 3 }
      : null,
    candidateRunProvenance: {
      provenance: { source: "phase-5-fixture", edge },
      evidenceReferences: [{ source: "parent-binary-image" }]
    },
    coordinateTransform: {
      offsetX: 3,
      offsetY: 10,
      scaleX: 1,
      scaleY: 1
    },
    geometry: {
      contiguousStrongOrFullLineRun: Number.isFinite(runMidpoint)
        ? { midpoint: { position: runMidpoint } }
        : null,
      projectionPlateau: Number.isFinite(plateauMidpoint)
        ? { midpoint: { position: plateauMidpoint } }
        : null,
      projectionWeightedCentroid: Number.isFinite(centroid)
        ? { position: centroid }
        : null,
      firstStrongOrFullContinuityPosition: Number.isFinite(first)
        ? { position: first }
        : null,
      lastStrongOrFullContinuityPosition: Number.isFinite(last)
        ? { position: last }
        : null
    },
    diagnostics: [],
    provenance: { source: "phase-5-fixture", edge },
    reasons: status === "available" ? [] : [{ code: `${status}-geometry` }]
  };
}

function comparedDefinition(id, title, observed, expected, signedDelta) {
  const sourcePaths = {
    "accepted-center": "acceptedCenterInParentBinaryImage",
    "run-midpoint":
      "geometry.contiguousStrongOrFullLineRun.midpoint.position",
    "plateau-midpoint": "geometry.projectionPlateau.midpoint.position",
    "weighted-centroid": "geometry.projectionWeightedCentroid.position",
    "first-qualifying-position":
      "geometry.firstStrongOrFullContinuityPosition.position",
    "last-qualifying-position":
      "geometry.lastStrongOrFullContinuityPosition.position"
  };

  return {
    id,
    title,
    status: "compared",
    observedPosition: observed,
    groundTruthPosition: expected,
    signedDelta,
    absoluteDelta: Math.abs(signedDelta),
    exactMatch: signedDelta === 0,
    source: {
      experimentId: "shadow-outer-line-center-geometry-diagnostics",
      path: sourcePaths[id]
    },
    reason: null
  };
}

function createGroundTruth(annotations, datasetId = "tt-dataset") {
  return createGridGroundTruth({ datasetId, annotations });
}

function createAnnotation(itemId, filename) {
  return {
    itemId,
    filename,
    document: { width: 100, height: 100 },
    gridBounds: { top: 10, left: 5, width: 20, height: 20 },
    horizontalLinePositions: [10, 20, 30],
    verticalLinePositions: [5, 15, 25],
    rows: 2,
    cols: 2,
    annotation: { status: "human-confirmed" }
  };
}

function readExperiment(item) {
  return item.comparison.result.benchmark.experiments[0];
}

function readRegion(report) {
  return report.items[0].providers[0].regions[0];
}
