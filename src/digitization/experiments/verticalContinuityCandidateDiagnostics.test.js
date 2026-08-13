import fs from "fs";
import { createVerticalProjection } from "../analysis/Projection";
import { findLineCandidates } from "../analysis/LineCandidate";
import { createProjectionProfileSummary } from "../detection/projectionDiagnostics";
import { createDigitizationExperimentBenchmark } from "./digitizationExperimentBenchmark";
import { createDigitizationDatasetRunner } from "./dataset/digitizationDatasetRunner";
import {
  createVerticalContinuityCandidateDiagnostics,
  verticalContinuityCandidateDiagnosticsExperiment
} from "./verticalContinuityCandidateDiagnostics";
import { createVerticalContinuityEvidence } from "./verticalContinuityDiagnostics";

test("exposes the registry experiment contract", () => {
  expect(verticalContinuityCandidateDiagnosticsExperiment).toEqual({
    id: "vertical-continuity-candidate-diagnostics",
    description: "Compare vertical line candidates from raw and local-continuity projections at the existing coverage threshold.",
    run: expect.any(Function)
  });
  expect(Object.isFrozen(verticalContinuityCandidateDiagnosticsExperiment)).toBe(true);
});

test("uses only BinaryImage and ignores analysis context", () => {
  const binaryImage = createBinaryImage({
    width: 5,
    height: 10,
    darkPixels: createVerticalPixels(2, 10)
  });
  const context = new Proxy({}, {
    get() {
      throw new Error("analysis context must not be read");
    }
  });

  expect(() => verticalContinuityCandidateDiagnosticsExperiment.run(
    binaryImage,
    context
  )).not.toThrow();
});

test("reads accessor-backed BinaryImage data exactly once with identical diagnostics", () => {
  const plainBinaryImage = createBinaryImage({
    width: 8,
    height: 20,
    darkPixels: Array.from({ length: 20 }, (_, y) => [
      y % 2 === 0 ? 3 : 4,
      y
    ])
  });
  const accessor = createAccessorBackedBinaryImage(plainBinaryImage);

  const expected = createVerticalContinuityCandidateDiagnostics(plainBinaryImage);
  const actual = createVerticalContinuityCandidateDiagnostics(accessor.binaryImage);

  expect(accessor.getReadCount()).toBe(1);
  expect(actual).toEqual(expected);
});

test("allows the benchmark to continue after accessor-backed candidate diagnostics", async () => {
  const plainBinaryImage = createBinaryImage({
    width: 8,
    height: 20,
    darkPixels: createVerticalPixels(3, 20)
  });
  const accessor = createAccessorBackedBinaryImage(plainBinaryImage);
  const laterExperiment = {
    id: "later-experiment",
    description: "Runs after candidate diagnostics",
    run: jest.fn(() => ({ type: "later-diagnostics" }))
  };
  const runBenchmark = createDigitizationExperimentBenchmark({
    listExperiments: () => [
      verticalContinuityCandidateDiagnosticsExperiment,
      laterExperiment
    ],
    now: createIncrementingClock()
  });

  const benchmark = await runBenchmark(accessor.binaryImage, {});

  expect(accessor.getReadCount()).toBe(1);
  expect(laterExperiment.run).toHaveBeenCalledTimes(1);
  expect(benchmark.experiments.map(experiment => ({
    id: experiment.id,
    success: experiment.success
  }))).toEqual([
    {
      id: "vertical-continuity-candidate-diagnostics",
      success: true
    },
    {
      id: "later-experiment",
      success: true
    }
  ]);
});

test("completes the dataset path with an accessor-backed production BinaryImage", async () => {
  const plainBinaryImage = createBinaryImage({
    width: 8,
    height: 20,
    darkPixels: createVerticalPixels(3, 20)
  });
  const accessor = createAccessorBackedBinaryImage(plainBinaryImage);
  const gridDetection = {
    geometry: null,
    confidence: "missing-grid-geometry",
    diagnostics: []
  };
  const productionResult = {
    context: {
      binaryImage: accessor.binaryImage,
      projections: {
        vertical: createVerticalProjection(plainBinaryImage)
      },
      gridDetection
    },
    gridDetection,
    diagnostics: []
  };
  const runDataset = createDigitizationDatasetRunner({
    runProduction: jest.fn(async () => productionResult)
  });

  const result = await runDataset({
    datasetId: "accessor-regression",
    items: [{ id: "item-1" }],
    prepareInput: async () => ({
      source: { id: "rendered-page" },
      readImageData: jest.fn()
    })
  });

  expect(result.inventory).toEqual({
    totalItemCount: 1,
    completedItemCount: 1,
    failedItemCount: 0
  });
  expect(result.items[0].status).toBe("completed");
  const candidateBenchmark = result.items[0].comparison.result.benchmark.experiments
    .find(experiment => (
      experiment.id === "vertical-continuity-candidate-diagnostics"
    ));

  expect(candidateBenchmark.success).toBe(true);
  expect(result.items[0].observationReport.result.observations.available).toEqual(
    expect.arrayContaining([
      {
        experimentId: "vertical-continuity-candidate-diagnostics",
        category: "candidate-count-comparison",
        observationId: "vertical-candidate-count-relation",
        value: "equal-candidate-count"
      }
    ])
  );
});

test("keeps the candidate coverage ratio exactly at 80 percent", () => {
  const diagnostics = createVerticalContinuityCandidateDiagnostics(
    createBinaryImage({ width: 4, height: 10 })
  );

  expect(diagnostics.parameters.candidateCoverageRatio).toBe(0.8);
});

test("reports equal candidate counts for a continuous vertical line", () => {
  const diagnostics = createVerticalContinuityCandidateDiagnostics(
    createBinaryImage({
      width: 7,
      height: 20,
      darkPixels: createVerticalPixels(3, 20)
    })
  );

  expect(diagnostics.raw.candidateCount).toBe(1);
  expect(diagnostics.continuity.candidateCount).toBe(1);
  expect(diagnostics.comparison).toEqual({
    candidateCountDelta: 0,
    relation: "equal-candidate-count"
  });
});

test("observes additional continuity candidates for a horizontally jittered line", () => {
  const binaryImage = createBinaryImage({
    width: 8,
    height: 20,
    darkPixels: Array.from({ length: 20 }, (_, y) => [
      y % 2 === 0 ? 3 : 4,
      y
    ])
  });
  const diagnostics = createVerticalContinuityCandidateDiagnostics(binaryImage);

  expect(diagnostics.raw.candidateCount).toBe(0);
  expect(diagnostics.continuity.candidateCount).toBe(1);
  expect(diagnostics.comparison).toEqual({
    candidateCountDelta: 1,
    relation: "additional-candidates-observed"
  });
});

test("observes fewer candidates when nearby raw lines merge in continuity evidence", () => {
  const diagnostics = createVerticalContinuityCandidateDiagnostics(
    createBinaryImage({
      width: 7,
      height: 20,
      darkPixels: [
        ...createVerticalPixels(1, 20),
        ...createVerticalPixels(3, 20)
      ]
    })
  );

  expect(diagnostics.raw.candidateCount).toBe(2);
  expect(diagnostics.continuity.candidateCount).toBe(1);
  expect(diagnostics.comparison).toEqual({
    candidateCountDelta: -1,
    relation: "fewer-candidates-observed"
  });
});

test("returns measured zero-candidate diagnostics for an empty image", () => {
  const diagnostics = createVerticalContinuityCandidateDiagnostics(
    createBinaryImage({ width: 7, height: 20 })
  );

  expect(diagnostics).toEqual(expect.objectContaining({
    type: "vertical-continuity-candidate-comparison",
    status: "measured",
    axis: "vertical",
    hypothesisKey: "interrupted-vertical-rules-under-counted"
  }));
  expect(diagnostics.raw.candidateCount).toBe(0);
  expect(diagnostics.continuity.candidateCount).toBe(0);
  expect(diagnostics.comparison.relation).toBe("equal-candidate-count");
});

test("does not turn horizontal ink or sparse unaligned noise into candidates", () => {
  const horizontal = Array.from({ length: 12 }, (_, x) => [x, 10]);
  const noise = [[1, 1], [4, 4], [8, 7], [10, 15]];
  const diagnostics = createVerticalContinuityCandidateDiagnostics(
    createBinaryImage({
      width: 12,
      height: 20,
      darkPixels: [...horizontal, ...noise]
    })
  );

  expect(diagnostics.raw.candidateCount).toBe(0);
  expect(diagnostics.continuity.candidateCount).toBe(0);
});

test("preserves deterministic candidate order and the existing candidate shape", () => {
  const diagnostics = createVerticalContinuityCandidateDiagnostics(
    createBinaryImage({
      width: 10,
      height: 20,
      darkPixels: [
        ...createVerticalPixels(1, 20),
        ...createVerticalPixels(7, 20)
      ]
    })
  );

  expect(diagnostics.raw.candidates).toEqual([
    {
      axis: "vertical",
      start: 1,
      end: 1,
      position: 1,
      thickness: 1,
      strength: 20,
      averageStrength: 20
    },
    {
      axis: "vertical",
      start: 7,
      end: 7,
      position: 7,
      thickness: 1,
      strength: 20,
      averageStrength: 20
    }
  ]);
  expect(diagnostics.continuity.candidates.map(candidate => candidate.position)).toEqual([
    1,
    7
  ]);
});

test("reuses existing projection summaries and candidate semantics", () => {
  const binaryImage = createBinaryImage({
    width: 7,
    height: 20,
    darkPixels: createVerticalPixels(3, 20)
  });
  const rawProjection = createVerticalProjection(binaryImage);
  const evidence = createVerticalContinuityEvidence(binaryImage);
  const continuityProjection = createVerticalProjection(evidence.mask);
  const diagnostics = createVerticalContinuityCandidateDiagnostics(binaryImage);
  const options = {
    axis: "vertical",
    axisLength: 20,
    minCoverageRatio: 0.8
  };

  expect(diagnostics.raw.profile).toEqual(createProjectionProfileSummary({
    projection: rawProjection,
    axisLength: 20
  }));
  expect(diagnostics.continuity.profile).toEqual(createProjectionProfileSummary({
    projection: continuityProjection,
    axisLength: 20
  }));
  expect(diagnostics.raw.candidates).toEqual(findLineCandidates(rawProjection, options));
  expect(diagnostics.continuity.candidates).toEqual(
    findLineCandidates(continuityProjection, options)
  );
});

test("creates the existing vertical-projection visualization with deterministic series", () => {
  const binaryImage = createBinaryImage({
    width: 6,
    height: 20,
    darkPixels: createVerticalPixels(2, 20)
  });
  const diagnostics = createVerticalContinuityCandidateDiagnostics(binaryImage);
  const visualization = diagnostics.visualizations[0];

  expect(visualization).toEqual({
    id: "vertical-candidate-projections",
    title: "Vertical Candidate Projections",
    type: "vertical-projection",
    data: {
      axis: "vertical",
      axisLength: 20,
      length: 6,
      series: [
        {
          id: "raw",
          title: "Raw",
          values: Array.from(createVerticalProjection(binaryImage))
        },
        {
          id: "continuity-mask",
          title: "Continuity mask",
          values: expect.any(Array)
        }
      ]
    }
  });
  visualization.data.series[0].values[2] = 0;
  expect(binaryImage.data[2]).toBe(1);
});

test("is deterministic and does not mutate frozen BinaryImage input", () => {
  const binaryImage = createBinaryImage({
    width: 8,
    height: 20,
    darkPixels: Array.from({ length: 20 }, (_, y) => [y % 2 ? 4 : 3, y])
  });
  const snapshot = new Uint8Array(binaryImage.data);
  Object.freeze(binaryImage);

  const first = createVerticalContinuityCandidateDiagnostics(binaryImage);
  const second = createVerticalContinuityCandidateDiagnostics(binaryImage);

  expect(second).toEqual(first);
  expect(binaryImage.data).toEqual(snapshot);
});

test.each([
  { width: 0, height: 2, data: new Uint8Array(0) },
  { width: 2, height: 0, data: new Uint8Array(0) },
  { width: 2, height: 2, data: new Uint8Array(3) },
  { width: 1, height: 1, data: new Uint8Array([2]) }
])("rejects invalid BinaryImage input", binaryImage => {
  expect(() => createVerticalContinuityCandidateDiagnostics(binaryImage)).toThrow();
});

test("introduces no geometry, confidence, evaluation or selection fields", () => {
  const diagnostics = createVerticalContinuityCandidateDiagnostics(
    createBinaryImage({ width: 5, height: 10 })
  );
  const forbidden = new Set([
    "geometry",
    "gridGeometry",
    "confidence",
    "score",
    "recommendation",
    "selectedExperiment",
    "selection"
  ]);

  expect(collectKeys(diagnostics).filter(key => forbidden.has(key))).toEqual([]);
});

test("does not import or call a production detector", () => {
  const source = fs.readFileSync(
    require.resolve("./verticalContinuityCandidateDiagnostics"),
    "utf8"
  );

  expect(source).not.toMatch(/imageGridDetectionEngine|gridDetectionEngine/);
  expect(source).not.toMatch(/detectGrid|createGridDetection|buildGridGeometry/);
});

function createBinaryImage({ width, height, darkPixels = [] }) {
  const data = new Uint8Array(width * height);

  for (const [x, y] of darkPixels) {
    data[(y * width) + x] = 1;
  }

  return { width, height, data };
}

function createVerticalPixels(x, height) {
  return Array.from({ length: height }, (_, y) => [x, y]);
}

function createAccessorBackedBinaryImage(binaryImage) {
  const snapshot = new Uint8Array(binaryImage.data);
  let readCount = 0;

  return {
    binaryImage: {
      width: binaryImage.width,
      height: binaryImage.height,
      get data() {
        readCount += 1;
        return new Uint8Array(snapshot);
      }
    },
    getReadCount: () => readCount
  };
}

function createIncrementingClock() {
  let value = 0;

  return () => {
    value += 1;
    return value;
  };
}

function collectKeys(value) {
  if (Array.isArray(value)) {
    return value.flatMap(collectKeys);
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, nested]) => [
    key,
    ...collectKeys(nested)
  ]);
}
