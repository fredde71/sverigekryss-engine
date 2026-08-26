import { createGridLatticeEvidence } from "../../analysis/reconstruction/GridLatticeEvidence";
import {
  generateGridLatticeCandidates
} from "../../analysis/reconstruction/GridLatticeCandidateGeneration";
import {
  fuseGridLatticeCandidateEvidence
} from "../../analysis/reconstruction/GridLatticeEvidenceFusion";
import {
  selectGridLatticeCandidate
} from "../../analysis/reconstruction/GridLatticeCandidateSelection";
import {
  createGridLatticeReconstructionResult
} from "../../analysis/reconstruction/GridLatticeReconstructionResult";
import {
  createGridLatticeReconstructionValidationReport,
  createGridLatticeReconstructionValidationReportFactory
} from "./gridLatticeReconstructionValidationReport";

test("runs the complete reconstruction chain before exact Ground Truth validation", () => {
  const report = createGridLatticeReconstructionValidationReport({
    datasetReport: createDatasetReport(),
    groundTruth: createGroundTruth()
  });
  const observation = report.items[0].reconstructions[0];

  expect(observation.reconstruction.pipeline).toEqual({
    candidateGeneration: { status: "available", candidateCount: 1 },
    evidenceFusion: { status: "available", confidenceArtifactCount: 1 },
    candidateSelection: {
      status: "selected",
      selectedCandidateId: "grid-lattice-candidate-001",
      competingCandidateIds: [],
      ambiguousCandidateIds: []
    },
    reconstructionResult: {
      status: "available",
      sourceCandidateId: "grid-lattice-candidate-001"
    }
  });
  expect(observation.reconstruction.selectedRows).toBe(2);
  expect(observation.reconstruction.selectedCols).toBe(3);
  expect(observation.reconstruction.horizontalLinePositions).toEqual([
    100, 110, 120
  ]);
  expect(observation.reconstruction.verticalLinePositions).toEqual([
    50, 60, 70, 80
  ]);
  expect(observation.validation.exactDimensionMatch).toBe(true);
  expect(observation.validation.horizontalLines.exact).toBe(true);
  expect(observation.validation.verticalLines.exact).toBe(true);
  expect(observation.validation.linePositionError).toEqual({
    status: "available",
    sampleCount: 7,
    maximumAbsoluteError: 0,
    rmsError: 0
  });
});

test("reports signed, absolute, zero and half-pixel line deltas", () => {
  const groundTruth = createGroundTruth({
    horizontal: [99.5, 110, 120.5],
    vertical: [50, 60.5, 69.5, 80]
  });
  const report = createGridLatticeReconstructionValidationReport({
    datasetReport: createDatasetReport(),
    groundTruth
  });
  const validation = report.items[0].reconstructions[0].validation;

  expect(validation.horizontalLines.perExpectedLine.map(value => ({
    signedDelta: value.signedDelta,
    absoluteDelta: value.absoluteDelta,
    exactMatch: value.exactMatch
  }))).toEqual([
    { signedDelta: 0.5, absoluteDelta: 0.5, exactMatch: false },
    { signedDelta: 0, absoluteDelta: 0, exactMatch: true },
    { signedDelta: -0.5, absoluteDelta: 0.5, exactMatch: false }
  ]);
  expect(validation.verticalLines.perExpectedLine.map(value => (
    value.signedDelta
  ))).toEqual([0, -0.5, 0.5, 0]);
  expect(validation.linePositionError.maximumAbsoluteError).toBe(0.5);
  expect(validation.linePositionError.rmsError).toBeCloseTo(
    Math.sqrt(1 / 7)
  );
});

test("reports missing and extra reconstructed lines and dimension mismatch", () => {
  const groundTruth = createGroundTruth({
    horizontal: [100, 105, 110, 120],
    vertical: [50, 60, 80]
  });
  const report = createGridLatticeReconstructionValidationReport({
    datasetReport: createDatasetReport(),
    groundTruth
  });
  const validation = report.items[0].reconstructions[0].validation;

  expect(validation.exactDimensionMatch).toBe(false);
  expect(validation.rows).toEqual({
    groundTruth: 3,
    reconstructed: 2,
    delta: -1,
    exact: false
  });
  expect(validation.cols.delta).toBe(1);
  expect(validation.missingReconstructedLines.horizontal).toEqual([
    { expectedIndex: 1, position: 105 }
  ]);
  expect(validation.extraReconstructedLines.vertical).toEqual([
    { observedIndex: 2, position: 70 }
  ]);
});

test("normalizes local bounds, anchors and periods into rendered coordinates", () => {
  const report = createGridLatticeReconstructionValidationReport({
    datasetReport: createDatasetReport({
      transform: { offsetX: 40, offsetY: 80, scaleX: 2, scaleY: 2 },
      horizontal: [10, 15, 20],
      vertical: [5, 10, 15, 20],
      bounds: { top: 10, left: 5, width: 15, height: 10 },
      horizontalPeriod: 5,
      verticalPeriod: 5
    }),
    groundTruth: createGroundTruth({
      horizontal: [100, 110, 120],
      vertical: [50, 60, 70, 80]
    })
  });
  const reconstruction = report.items[0].reconstructions[0].reconstruction;

  expect(reconstruction.horizontalLinePositions).toEqual([100, 110, 120]);
  expect(reconstruction.verticalLinePositions).toEqual([50, 60, 70, 80]);
  expect(reconstruction.coordinateSystem.space).toBe(
    "rendered-binary-image-pixels"
  );
});

test("preserves provider, region and bounds-observation order", () => {
  const datasetReport = createDatasetReport();
  const diagnostics = datasetReport.items[0].comparison.result.benchmark.experiments;
  diagnostics.forEach(experiment => {
    if (experiment.id === "shadow-grid-analysis-diagnostics") {
      experiment.diagnostics.providers[0].gridAnalyses.push(
        clone(experiment.diagnostics.providers[0].gridAnalyses[0], {
          regionId: "region-b"
        })
      );
    }
    if (experiment.id === "shadow-grid-reconstruction-diagnostics") {
      experiment.diagnostics.providers[0].reconstructions.push(
        clone(experiment.diagnostics.providers[0].reconstructions[0], {
          regionId: "region-b"
        })
      );
    }
    if (experiment.id === "shadow-outer-line-center-geometry-diagnostics") {
      const first = experiment.diagnostics.providers[0].geometryObservations[0];
      first.observation.edges.top.geometry.projectionWeightedCentroid = {
        position: first.observation.edges.top.acceptedCenterInParentBinaryImage + 1
      };
      experiment.diagnostics.providers[0].geometryObservations.push(
        clone(first, { regionId: "region-b" })
      );
    }
  });

  const report = createGridLatticeReconstructionValidationReport({
    datasetReport,
    groundTruth: createGroundTruth()
  });

  expect(report.items[0].reconstructions.map(value => [
    value.providerId,
    value.regionId,
    value.boundsObservationIndex
  ])).toEqual([
    ["provider-a", "region-a", 0],
    ["provider-a", "region-a", 1],
    ["provider-a", "region-b", 0],
    ["provider-a", "region-b", 1]
  ]);
});

test("keeps incomplete projected outer geometry explicitly unavailable", () => {
  const datasetReport = createDatasetReport();
  const geometry = findExperiment(
    datasetReport,
    "shadow-outer-line-center-geometry-diagnostics"
  );
  geometry.providers[0].geometryObservations[0].observation.edges.right
    .acceptedCenterInParentBinaryImage = null;

  const report = createGridLatticeReconstructionValidationReport({
    datasetReport,
    groundTruth: createGroundTruth()
  });
  const observation = report.items[0].reconstructions[0];

  expect(observation.reconstruction.status).toBe("unavailable");
  expect(observation.reconstruction.pipeline).toBeNull();
  expect(observation.validation).toMatchObject({
    status: "unavailable",
    reason: "grid-lattice-reconstruction-unavailable"
  });
});

test("Ground Truth is not read until reconstruction has completed", () => {
  let reconstructionCompleted = false;
  const groundTruth = createGroundTruth();
  const guarded = {
    type: groundTruth.type,
    version: groundTruth.version,
    datasetId: groundTruth.datasetId,
    get annotations() {
      if (!reconstructionCompleted) {
        throw new Error("Ground Truth read before reconstruction");
      }
      return groundTruth.annotations;
    }
  };
  const createReconstruction = jest.fn(input => {
    const result = createGridLatticeReconstructionResult(input);
    reconstructionCompleted = true;
    return result;
  });
  const createReport = createGridLatticeReconstructionValidationReportFactory({
    createEvidence: createGridLatticeEvidence,
    generateCandidates: generateGridLatticeCandidates,
    fuseEvidence: fuseGridLatticeCandidateEvidence,
    selectCandidate: selectGridLatticeCandidate,
    createReconstruction
  });

  expect(() => createReport({
    datasetReport: createDatasetReport(),
    groundTruth: guarded
  })).not.toThrow();
  expect(createReconstruction).toHaveBeenCalledTimes(1);
});

test("Ground Truth changes validation only and never reconstruction", () => {
  const datasetReport = createDatasetReport();
  const first = createGridLatticeReconstructionValidationReport({
    datasetReport,
    groundTruth: createGroundTruth()
  });
  const second = createGridLatticeReconstructionValidationReport({
    datasetReport,
    groundTruth: createGroundTruth({
      horizontal: [99.5, 110, 120.5],
      vertical: [49.5, 60, 70, 80.5]
    })
  });

  expect(first.items[0].reconstructions[0].reconstruction).toEqual(
    second.items[0].reconstructions[0].reconstruction
  );
  expect(first.items[0].reconstructions[0].validation).not.toEqual(
    second.items[0].reconstructions[0].validation
  );
});

test("is deterministic, immutable and does not read runtime images", () => {
  const datasetReport = createDatasetReport();
  Object.defineProperty(datasetReport.items[0], "binaryImage", {
    enumerable: false,
    get() {
      throw new Error("runtime image accessed");
    }
  });
  const frozenGroundTruth = deepFreeze(createGroundTruth());
  const beforeDataset = JSON.stringify(datasetReport);
  const beforeGroundTruth = JSON.stringify(frozenGroundTruth);

  const first = createGridLatticeReconstructionValidationReport({
    datasetReport,
    groundTruth: frozenGroundTruth
  });
  const second = createGridLatticeReconstructionValidationReport({
    datasetReport,
    groundTruth: frozenGroundTruth
  });

  expect(first).toEqual(second);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.items[0].reconstructions[0])).toBe(true);
  expect(JSON.stringify(datasetReport)).toBe(beforeDataset);
  expect(JSON.stringify(frozenGroundTruth)).toBe(beforeGroundTruth);
});

function createDatasetReport({
  transform = { offsetX: 50, offsetY: 100, scaleX: 1, scaleY: 1 },
  horizontal = [0, 10, 20],
  vertical = [0, 10, 20, 30],
  bounds = { top: 0, left: 0, width: 30, height: 20 },
  horizontalPeriod = 10,
  verticalPeriod = 10
} = {}) {
  return {
    type: "digitization-dataset-report",
    version: 1,
    datasetRun: { datasetId: "tt-dataset" },
    items: [{
      id: "item-001",
      metadata: { filename: "tt-001.pdf" },
      comparison: {
        result: {
          benchmark: {
            experiments: [
              successfulExperiment("shadow-grid-analysis-diagnostics", {
                type: "shadow-grid-analysis-diagnostics",
                providers: [{
                  id: "provider-a",
                  status: "available",
                  gridAnalyses: [{
                    providerId: "provider-a",
                    regionId: "region-a",
                    regionBounds: {
                      top: transform.offsetY,
                      left: transform.offsetX,
                      width: 200,
                      height: 200
                    },
                    candidatePositions: { horizontal, vertical },
                    spacingDiagnostics: []
                  }]
                }]
              }),
              successfulExperiment("shadow-grid-reconstruction-diagnostics", {
                type: "shadow-grid-reconstruction-diagnostics",
                providers: [{
                  id: "provider-a",
                  status: "available",
                  reconstructions: [{
                    providerId: "provider-a",
                    regionId: "region-a",
                    status: "completed",
                    reconstruction: {
                      diagnostics: [{
                        type: "uniform-orthogonal-lattice-strategy",
                        axes: {
                          horizontal: {
                            interpretations: [interpretation(horizontalPeriod)]
                          },
                          vertical: {
                            interpretations: [interpretation(verticalPeriod)]
                          }
                        }
                      }]
                    }
                  }]
                }]
              }),
              successfulExperiment(
                "shadow-outer-line-center-geometry-diagnostics",
                {
                  type: "shadow-outer-line-center-geometry-diagnostics",
                  version: 1,
                  status: "complete",
                  providers: [{
                    id: "provider-a",
                    status: "available",
                    geometryObservations: [{
                      providerId: "provider-a",
                      regionId: "region-a",
                      status: "completed",
                      observation: {
                        type: "outer-line-center-geometry-observation",
                        version: 1,
                        coordinateSystem: {
                          space: "analysis-region-local",
                          localToBinaryImage: transform
                        },
                        edges: createGeometryEdges({ bounds, transform }),
                        provenance: {
                          source: "synthetic-outer-line-geometry",
                          providerId: "provider-a",
                          regionId: "region-a"
                        }
                      }
                    }]
                  }]
                }
              )
            ]
          }
        }
      }
    }]
  };
}

function createGeometryEdges({ bounds, transform }) {
  const top = transform.offsetY + bounds.top * transform.scaleY;
  const bottom = transform.offsetY
    + (bounds.top + bounds.height) * transform.scaleY;
  const left = transform.offsetX + bounds.left * transform.scaleX;
  const right = transform.offsetX
    + (bounds.left + bounds.width) * transform.scaleX;

  return {
    top: createGeometryEdge("top", top),
    bottom: createGeometryEdge("bottom", bottom),
    left: createGeometryEdge("left", left),
    right: createGeometryEdge("right", right)
  };
}

function createGeometryEdge(edge, acceptedCenter) {
  return {
    edge,
    status: "available",
    acceptedCenterInParentBinaryImage: acceptedCenter,
    geometry: {
      contiguousStrongOrFullLineRuns: [],
      maximumProjectionPlateaus: [],
      projectionWeightedCentroid: null,
      firstStrongOrFullContinuityPosition: null,
      lastStrongOrFullContinuityPosition: null
    },
    provenance: { source: "synthetic-outer-line-edge", edge }
  };
}

function interpretation(derivedSpacing) {
  return {
    status: "rejected",
    intervalCount: 2,
    derivedSpacing,
    rejectionReasons: ["candidate-alignment-failed"]
  };
}

function successfulExperiment(id, diagnostics) {
  return { id, success: true, diagnostics };
}

function createGroundTruth({
  horizontal = [100, 110, 120],
  vertical = [50, 60, 70, 80]
} = {}) {
  return {
    type: "digitization-grid-ground-truth",
    version: 1,
    datasetId: "tt-dataset",
    annotations: [{
      itemId: "item-001",
      filename: "tt-001.pdf",
      document: { width: 500, height: 700 },
      bounds: {
        top: horizontal[0],
        left: vertical[0],
        width: vertical[vertical.length - 1] - vertical[0],
        height: horizontal[horizontal.length - 1] - horizontal[0]
      },
      horizontalLinePositions: horizontal,
      verticalLinePositions: vertical,
      rows: horizontal.length - 1,
      cols: vertical.length - 1,
      metadata: { confirmedByHuman: true }
    }]
  };
}

function findExperiment(report, id) {
  return report.items[0].comparison.result.benchmark.experiments.find(
    experiment => experiment.id === id
  ).diagnostics;
}

function clone(value, overrides) {
  return { ...JSON.parse(JSON.stringify(value)), ...overrides };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
