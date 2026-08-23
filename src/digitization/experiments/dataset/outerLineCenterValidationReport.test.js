import { createGridGroundTruth } from "./gridGroundTruth";
import {
  createOuterLineCenterValidationReport
} from "./outerLineCenterValidationReport";

test("compares all four edges independently in deterministic order", () => {
  const report = createOuterLineCenterValidationReport(createInputs());
  const edges = readRegion(report).edges;

  expect(edges.map(edge => edge.edge)).toEqual([
    "top",
    "bottom",
    "left",
    "right"
  ]);
  expect(edges[0]).toMatchObject({
    edge: "top",
    status: "partial",
    acceptedCenter: {
      analysisRegionLocal: 1,
      parentBinaryImage: 11
    },
    groundTruthCenter: 10,
    acceptedCenterDelta: {
      signed: 1,
      absolute: 1,
      exact: false
    },
    anyObservedCandidateCloserThanAcceptedCenter: true,
    anyObservedCandidateExactlyMatchesGroundTruth: true
  });
  expect(edges[1]).toMatchObject({
    edge: "bottom",
    acceptedCenterDelta: { signed: 0, absolute: 0, exact: true },
    anyObservedCandidateCloserThanAcceptedCenter: false,
    anyObservedCandidateExactlyMatchesGroundTruth: true
  });
  expect(edges[2]).toMatchObject({
    edge: "left",
    acceptedCenterDelta: { signed: -1, absolute: 1, exact: false },
    anyObservedCandidateCloserThanAcceptedCenter: true,
    anyObservedCandidateExactlyMatchesGroundTruth: false
  });
  expect(edges[3]).toMatchObject({
    edge: "right",
    status: "unavailable",
    acceptedCenter: {
      analysisRegionLocal: null,
      parentBinaryImage: null
    },
    groundTruthCenter: 25,
    acceptedCenterDelta: null,
    observedNearbyCenterCandidates: [],
    anyObservedCandidateCloserThanAcceptedCenter: null,
    anyObservedCandidateExactlyMatchesGroundTruth: null
  });
});

test("preserves every candidate, source order, offsets and signed/absolute deltas", () => {
  const top = readRegion(
    createOuterLineCenterValidationReport(createInputs())
  ).edges[0];

  expect(top.observedNearbyCenterCandidates).toEqual([
    {
      sourceIndex: 0,
      observedPosition: 12,
      localPosition: 2,
      start: 12,
      end: 12,
      projectionValue: 4,
      signedOffsetFromAcceptedCenter: 1,
      delta: { signed: 2, absolute: 2, exact: false }
    },
    {
      sourceIndex: 1,
      observedPosition: 9.5,
      localPosition: -0.5,
      start: 9,
      end: 10,
      projectionValue: 8,
      signedOffsetFromAcceptedCenter: -1.5,
      delta: { signed: -0.5, absolute: 0.5, exact: false }
    },
    {
      sourceIndex: 2,
      observedPosition: 10,
      localPosition: 0,
      start: 10,
      end: 10,
      projectionValue: 9,
      signedOffsetFromAcceptedCenter: -1,
      delta: { signed: 0, absolute: 0, exact: true }
    }
  ]);
});

test("preserves raw projection, continuity, evidence references and provenance separately", () => {
  const top = readRegion(
    createOuterLineCenterValidationReport(createInputs())
  ).edges[0];

  expect(top.rawObservation).toMatchObject({
    projectionEvidence: {
      positions: [9, 10, 11, 12],
      values: [2, 9, 3, 4]
    },
    continuityObservations: [
      { position: 10, longestContinuousBlackRun: 9 }
    ],
    provenance: {
      source: "shadow-outer-line-center-neighborhood-diagnostics",
      edge: "top"
    },
    evidenceReferences: [
      { artifactType: "document-analysis", evidence: "parent-binary-image-neighborhood" }
    ]
  });
  expect(top.rawObservation.projectionEvidence.nearbyLineCenterCandidates)
    .toHaveLength(3);
});

test("normalizes an accepted local center when its recorded parent position is absent", () => {
  const inputs = createInputs();
  const edge = readFixtureEdge(inputs.datasetReport, "left");

  delete edge.projectionEvidence.acceptedCenterInParentBinaryImage;
  const left = readRegion(
    createOuterLineCenterValidationReport(inputs)
  ).edges[2];

  expect(left.acceptedCenter).toEqual({
    analysisRegionLocal: 1,
    parentBinaryImage: 4
  });
  expect(left.acceptedCenterDelta).toEqual({
    signed: -1,
    absolute: 1,
    exact: false
  });
});

test("preserves partial and unavailable experiment states", () => {
  const inputs = createInputs();
  const provider = readExperiment(inputs.datasetReport).diagnostics.providers[0];

  provider.neighborhoodObservations.push({
    providerId: "provider-a",
    regionId: "region-unavailable",
    status: "unavailable",
    observation: null,
    reason: "source-observation-unavailable",
    error: null
  });
  const report = createOuterLineCenterValidationReport(inputs);

  expect(report.items[0].status).toBe("partial");
  expect(report.items[0].providers[0].regions[1]).toMatchObject({
    regionId: "region-unavailable",
    status: "unavailable",
    reason: "source-observation-unavailable",
    edges: []
  });
  expect(report.inventory.partialEdgeCount).toBe(2);
  expect(report.inventory.unavailableEdgeCount).toBe(1);
});

test("represents missing annotations, filename mismatch and failed experiments", () => {
  const inputs = createInputs();

  inputs.datasetReport.items.push(createDatasetItem({
    itemId: "missing-ground-truth",
    filename: "missing.pdf"
  }));
  inputs.datasetReport.items.push(createDatasetItem({
    itemId: "failed",
    filename: "failed.pdf",
    success: false
  }));
  inputs.groundTruth = createGroundTruth([
    createAnnotation(),
    createAnnotation({ itemId: "failed", filename: "other.pdf" })
  ]);
  const report = createOuterLineCenterValidationReport(inputs);

  expect(report.items[1]).toMatchObject({
    status: "unavailable",
    reasons: ["ground-truth-annotation-unavailable"]
  });
  expect(report.items[2]).toMatchObject({
    status: "unavailable",
    reasons: [
      "filename-mismatch",
      "outer-line-center-neighborhood-experiment-failed"
    ]
  });
});

test("preserves dataset/provider/region ordering and unmatched annotations", () => {
  const first = createDatasetItem({ itemId: "item-a", filename: "a.pdf" });
  const second = createDatasetItem({ itemId: "item-b", filename: "b.pdf" });
  const providers = first.comparison.result.benchmark.experiments[0]
    .diagnostics.providers;

  providers.push(createProvider("provider-b", "region-b"));
  const inputs = {
    datasetReport: createDatasetReport([first, second]),
    groundTruth: createGroundTruth([
      createAnnotation({ itemId: "item-a", filename: "a.pdf" }),
      createAnnotation({ itemId: "item-b", filename: "b.pdf" }),
      createAnnotation({ itemId: "item-c", filename: "c.pdf" })
    ])
  };
  const report = createOuterLineCenterValidationReport(inputs);

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

test("is deterministic, immutable, ignores runtime images and adds no evaluation fields", () => {
  const inputs = createInputs();
  const edge = readFixtureEdge(inputs.datasetReport, "top");

  Object.defineProperty(edge, "binaryImage", {
    enumerable: true,
    get() {
      throw new Error("runtime BinaryImage must not be accessed");
    }
  });
  const frozenGroundTruth = deepFreeze(inputs.groundTruth);
  const first = createOuterLineCenterValidationReport({
    datasetReport: inputs.datasetReport,
    groundTruth: frozenGroundTruth
  });
  const second = createOuterLineCenterValidationReport({
    datasetReport: inputs.datasetReport,
    groundTruth: frozenGroundTruth
  });

  expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.items[0])).toBe(true);
  expect(JSON.stringify(first)).not.toMatch(
    /"(score|confidence|rank|ranking|recommendation|selected|preferred|refined)"\s*:/i
  );
});

test("validates report and Ground Truth identity", () => {
  expect(() => createOuterLineCenterValidationReport()).toThrow(
    "Version 1 digitization dataset report is required"
  );
  expect(() => createOuterLineCenterValidationReport({
    datasetReport: createDatasetReport([]),
    groundTruth: createGroundTruth([], "other-dataset")
  })).toThrow("datasetId must match exactly");
});

function createInputs() {
  return {
    datasetReport: createDatasetReport([
      createDatasetItem({ itemId: "item-a", filename: "a.pdf" })
    ]),
    groundTruth: createGroundTruth([createAnnotation()])
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

function createDatasetItem({
  itemId,
  filename,
  success = true
}) {
  return {
    id: itemId,
    metadata: { filename },
    comparison: {
      status: "completed",
      result: {
        benchmark: {
          experiments: [{
            id: "shadow-outer-line-center-neighborhood-diagnostics",
            description: "fixture",
            durationMs: 1,
            success,
            diagnostics: success
              ? {
                type: "shadow-outer-line-center-neighborhood-diagnostics",
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
    neighborhoodObservations: [{
      providerId,
      regionId,
      status: "completed",
      observation: createNeighborhoodObservation(regionId),
      error: null
    }]
  };
}

function createNeighborhoodObservation(regionId) {
  return {
    type: "outer-line-center-observation",
    version: 1,
    analysisRegionId: regionId,
    coordinateSystem: {
      space: "analysis-region-local",
      origin: "top-left",
      xDirection: "right",
      yDirection: "down",
      linePosition: "visual-line-center",
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
        status: "partial",
        localCenter: 1,
        parentCenter: 11,
        candidates: [
          createCandidate(12, 2, 1, 4),
          createCandidate(9.5, -0.5, -1.5, 8, 9, 10),
          createCandidate(10, 0, -1, 9)
        ]
      }),
      bottom: createEdge({
        edge: "bottom",
        status: "available",
        localCenter: 20,
        parentCenter: 30,
        candidates: [createCandidate(30, 20, 0, 9)]
      }),
      left: createEdge({
        edge: "left",
        status: "partial",
        localCenter: 1,
        parentCenter: 4,
        candidates: [createCandidate(4.5, 1.5, 0.5, 7)]
      }),
      right: createEdge({
        edge: "right",
        status: "unavailable",
        localCenter: null,
        parentCenter: null,
        candidates: null
      })
    },
    provenance: { source: "fixture" }
  };
}

function createEdge({
  edge,
  status,
  localCenter,
  parentCenter,
  candidates
}) {
  const available = Number.isFinite(localCenter);

  return {
    edge,
    status,
    acceptedCandidateCenter: localCenter,
    candidateRunGeometry: available ? { start: 0, end: 1 } : null,
    projectionEvidence: Array.isArray(candidates)
      ? {
        acceptedCenterInParentBinaryImage: parentCenter,
        positions: [9, 10, 11, 12],
        values: [2, 9, 3, 4],
        nearbyLineCenterCandidates: candidates
      }
      : null,
    continuityObservations: available
      ? [{ position: 10, longestContinuousBlackRun: 9 }]
      : [],
    neighborhoodObservationExtent: available
      ? { bounds: { top: 6, left: 3, width: 9, height: 9 } }
      : null,
    provenance: {
      source: "shadow-outer-line-center-neighborhood-diagnostics",
      edge
    },
    assumptions: [],
    diagnostics: [],
    evidenceReferences: available
      ? [{
        artifactType: "document-analysis",
        evidence: "parent-binary-image-neighborhood"
      }]
      : [],
    reasons: status === "available"
      ? []
      : [{ code: available ? "candidate-run-partial" : "center-unavailable" }]
  };
}

function createCandidate(
  position,
  localPosition,
  signedOffsetFromAcceptedCenter,
  projectionValue,
  start = position,
  end = position
) {
  return {
    start,
    end,
    position,
    localPosition,
    projectionValue,
    signedOffsetFromAcceptedCenter
  };
}

function createGroundTruth(annotations, datasetId = "tt-dataset") {
  return createGridGroundTruth({ datasetId, annotations });
}

function createAnnotation({
  itemId = "item-a",
  filename = "a.pdf"
} = {}) {
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

function readExperiment(datasetReport) {
  return datasetReport.items[0].comparison.result.benchmark.experiments[0];
}

function readFixtureEdge(datasetReport, edge) {
  return readExperiment(datasetReport).diagnostics.providers[0]
    .neighborhoodObservations[0].observation.edges[edge];
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
