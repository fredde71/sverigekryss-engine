import { createGridGroundTruth } from "./gridGroundTruth";
import {
  createHumanAnnotationBiasDiagnostics
} from "./humanAnnotationBiasDiagnostics";

test("reports Ground Truth minus observed offsets in fixed edge and geometry order", () => {
  const report = createHumanAnnotationBiasDiagnostics(createInputs());
  const edges = readRegion(report).edges;
  const top = edges[0];

  expect(edges.map(edge => edge.edge)).toEqual([
    "top",
    "bottom",
    "left",
    "right"
  ]);
  expect(top.geometricObservations.map(observation => observation.id)).toEqual([
    "first-qualifying-position",
    "last-qualifying-position",
    "run-midpoint",
    "plateau-midpoint",
    "weighted-centroid"
  ]);
  expect(top.geometricObservations).toEqual([
    compared("first-qualifying-position", "First qualifying position", 9, 10),
    compared("last-qualifying-position", "Last qualifying position", 11, 10),
    compared("run-midpoint", "Run midpoint", 10, 10),
    compared("plateau-midpoint", "Plateau midpoint", 9.5, 10),
    compared("weighted-centroid", "Projection-weighted centroid", 10.25, 10)
  ]);
});

test("describes factual annotation relationships to qualifying runs", () => {
  const edges = readRegion(
    createHumanAnnotationBiasDiagnostics(createInputs())
  ).edges;

  expect(edges[0].annotationRelationshipToQualifyingRun).toMatchObject({
    status: "observed",
    relationship: "inside-qualifying-run",
    qualifyingRunCount: 1,
    matchingRunIndexes: [0],
    firstQualifyingPosition: 9,
    lastQualifyingPosition: 11
  });
  expect(edges[1].annotationRelationshipToQualifyingRun).toMatchObject({
    relationship: "between-qualifying-runs",
    qualifyingRunCount: 2,
    matchingRunIndexes: []
  });
  expect(edges[2].annotationRelationshipToQualifyingRun.relationship)
    .toBe("before-qualifying-runs");
  expect(edges[3].annotationRelationshipToQualifyingRun.relationship)
    .toBe("after-qualifying-runs");
});

test("reports nearest qualifying positions and preserves exact ties", () => {
  const [top, bottom, left] = readRegion(
    createHumanAnnotationBiasDiagnostics(createInputs())
  ).edges;

  expect(top.nearestQualifyingPosition).toEqual({
    status: "observed",
    minimumAbsoluteOffset: 0,
    positions: [{
      position: 10,
      signedOffset: 0,
      absoluteOffset: 0,
      exactMatch: true
    }],
    tie: false,
    reason: null
  });
  expect(bottom.nearestQualifyingPosition).toEqual({
    status: "tied",
    minimumAbsoluteOffset: 1,
    positions: [
      { position: 29, signedOffset: 1, absoluteOffset: 1, exactMatch: false },
      { position: 31, signedOffset: -1, absoluteOffset: 1, exactMatch: false }
    ],
    tie: true,
    reason: null
  });
  expect(left.nearestQualifyingPosition.positions[0]).toEqual({
    position: 6,
    signedOffset: -1,
    absoluteOffset: 1,
    exactMatch: false
  });
});

test("preserves half-pixel offsets and exact matches factually", () => {
  const top = readRegion(
    createHumanAnnotationBiasDiagnostics(createInputs())
  ).edges[0];

  expect(top.geometricObservations[2]).toMatchObject({
    signedOffset: 0,
    absoluteOffset: 0,
    exactMatch: true
  });
  expect(top.geometricObservations[3]).toMatchObject({
    signedOffset: 0.5,
    absoluteOffset: 0.5,
    exactMatch: false
  });
  expect(top.geometricObservations[4]).toMatchObject({
    signedOffset: -0.25,
    absoluteOffset: 0.25,
    exactMatch: false
  });
});

test("represents unavailable geometry and qualifying evidence explicitly", () => {
  const inputs = createInputs();
  const right = readSourceRegion(inputs).observation.edges.right;

  right.geometry = unavailableGeometry();
  const edge = readRegion(
    createHumanAnnotationBiasDiagnostics(inputs)
  ).edges[3];

  expect(edge.status).toBe("unavailable");
  expect(edge.geometricObservations.every(observation => (
    observation.status === "unavailable"
  ))).toBe(true);
  expect(edge.annotationRelationshipToQualifyingRun).toMatchObject({
    status: "unavailable",
    relationship: null,
    reason: "qualifying-run-unavailable"
  });
  expect(edge.nearestQualifyingPosition).toMatchObject({
    status: "unavailable",
    positions: [],
    reason: "qualifying-positions-unavailable"
  });
});

test("preserves provider, region, raw observation and unmatched annotation order", () => {
  const inputs = createInputs();
  const experiment = readExperiment(inputs.datasetReport.items[0]);

  experiment.diagnostics.providers.push(createProvider("provider-b", "region-b"));
  inputs.groundTruth = createGroundTruth([
    createAnnotation("item-a", "a.pdf"),
    createAnnotation("item-extra", "extra.pdf")
  ]);
  const report = createHumanAnnotationBiasDiagnostics(inputs);

  expect(report.items[0].providers.map(provider => provider.providerId)).toEqual([
    "provider-a",
    "provider-b"
  ]);
  expect(report.items[0].providers.map(provider => provider.regions[0].regionId))
    .toEqual(["region-a", "region-b"]);
  expect(readRegion(report).edges[0].rawGeometryObservation).toMatchObject({
    acceptedCenterInParentBinaryImage: 10,
    provenance: { source: "phase-5", edge: "top" }
  });
  expect(report.unmatchedAnnotations).toEqual([{
    itemId: "item-extra",
    filename: "extra.pdf",
    reason: "dataset-item-not-found"
  }]);
});

test("is deterministic, immutable, does not access runtime images and adds no decisions", () => {
  const inputs = createInputs();
  const top = readSourceRegion(inputs).observation.edges.top;

  Object.defineProperty(top, "binaryImage", {
    enumerable: false,
    get() {
      throw new Error("runtime image must not be accessed");
    }
  });
  deepFreeze(inputs);
  const first = createHumanAnnotationBiasDiagnostics(inputs);
  const second = createHumanAnnotationBiasDiagnostics(inputs);

  expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.items[0])).toBe(true);
  expect(JSON.stringify(first)).not.toMatch(
    /"(score|confidence|rank|ranking|recommendation|selected|preferred|winner)"\s*:/i
  );
});

test("validates the existing dataset and Ground Truth association", () => {
  expect(() => createHumanAnnotationBiasDiagnostics()).toThrow(
    "Version 1 digitization dataset report is required"
  );
  expect(() => createHumanAnnotationBiasDiagnostics({
    datasetReport: createDatasetReport([]),
    groundTruth: createGroundTruth([], "other-dataset")
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

function createDatasetItem(id, filename) {
  return {
    id,
    metadata: { filename },
    comparison: {
      status: "completed",
      result: {
        benchmark: {
          experiments: [{
            id: "shadow-outer-line-center-geometry-diagnostics",
            description: "fixture",
            durationMs: 1,
            success: true,
            diagnostics: {
              type: "shadow-outer-line-center-geometry-diagnostics",
              version: 1,
              status: "complete",
              providers: [createProvider("provider-a", "region-a")]
            }
          }]
        }
      }
    }
  };
}

function createProvider(id, regionId) {
  return {
    id,
    status: "available",
    reason: null,
    geometryObservations: [{
      providerId: id,
      regionId,
      status: "completed",
      reason: null,
      observation: {
        type: "outer-line-center-geometry-observation",
        version: 1,
        coordinateSystem: {
          space: "parent-binary-image",
          localToBinaryImage: {
            offsetX: 0,
            offsetY: 0,
            scaleX: 1,
            scaleY: 1
          }
        },
        provenance: { source: "phase-5" },
        edges: {
          top: createEdge("top", 10, [9, 10, 11], [[9, 11]], {
            run: 10,
            plateau: 9.5,
            centroid: 10.25
          }),
          bottom: createEdge("bottom", 30, [29, 31], [[29, 29], [31, 31]], {
            run: 30,
            plateau: 30,
            centroid: 30
          }),
          left: createEdge("left", 5, [6, 7], [[6, 7]], {
            run: 6.5,
            plateau: 6,
            centroid: 6.25
          }),
          right: createEdge("right", 25, [23, 24], [[23, 24]], {
            run: 23.5,
            plateau: 24,
            centroid: 23.75
          })
        }
      },
      error: null
    }]
  };
}

function createEdge(edge, acceptedCenter, positions, runs, geometry) {
  return {
    edge,
    status: "available",
    geometryStatus: "available",
    acceptedCandidateCenter: acceptedCenter,
    acceptedCenterInParentBinaryImage: acceptedCenter,
    rawProjectionSamples: positions.map(position => ({ position, value: 10 })),
    continuityObservations: positions.map(position => ({
      position,
      longestContinuousBlackRun: 20
    })),
    candidateRunGeometry: null,
    candidateRunProvenance: { evidenceReferences: [] },
    coordinateTransform: {
      offsetX: 0,
      offsetY: 0,
      scaleX: 1,
      scaleY: 1
    },
    geometry: {
      qualification: {
        fullContinuityPositions: positions,
        strongestProjectionPositions: positions
      },
      contiguousStrongOrFullLineRuns: runs.map(([start, end]) => ({
        start: { position: start },
        end: { position: end },
        midpoint: { position: start + ((end - start) / 2) }
      })),
      contiguousStrongOrFullLineRun: {
        midpoint: { position: geometry.run }
      },
      projectionPlateau: { midpoint: { position: geometry.plateau } },
      projectionWeightedCentroid: { position: geometry.centroid },
      firstStrongOrFullContinuityPosition: { position: positions[0] },
      lastStrongOrFullContinuityPosition: {
        position: positions[positions.length - 1]
      }
    },
    provenance: { source: "phase-5", edge },
    diagnostics: [],
    reasons: []
  };
}

function unavailableGeometry() {
  return {
    qualification: null,
    contiguousStrongOrFullLineRuns: [],
    contiguousStrongOrFullLineRun: null,
    maximumProjectionPlateaus: [],
    projectionPlateau: null,
    projectionWeightedCentroid: null,
    firstStrongOrFullContinuityPosition: null,
    lastStrongOrFullContinuityPosition: null
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

function compared(id, title, observedPosition, groundTruthPosition) {
  const paths = {
    "first-qualifying-position":
      "geometry.firstStrongOrFullContinuityPosition.position",
    "last-qualifying-position":
      "geometry.lastStrongOrFullContinuityPosition.position",
    "run-midpoint": "geometry.contiguousStrongOrFullLineRun.midpoint.position",
    "plateau-midpoint": "geometry.projectionPlateau.midpoint.position",
    "weighted-centroid": "geometry.projectionWeightedCentroid.position"
  };
  const signedOffset = groundTruthPosition - observedPosition;

  return {
    id,
    title,
    status: "compared",
    groundTruthPosition,
    observedPosition,
    signedOffset,
    absoluteOffset: Math.abs(signedOffset),
    exactMatch: signedOffset === 0,
    source: {
      experimentId: "shadow-outer-line-center-geometry-diagnostics",
      path: paths[id]
    },
    reason: null
  };
}

function readExperiment(item) {
  return item.comparison.result.benchmark.experiments[0];
}

function readSourceRegion(inputs) {
  return readExperiment(inputs.datasetReport.items[0])
    .diagnostics.providers[0].geometryObservations[0];
}

function readRegion(report) {
  return report.items[0].providers[0].regions[0];
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
