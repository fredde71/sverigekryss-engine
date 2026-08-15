import fs from "fs";
import {
  createHorizontalProjection,
  createVerticalProjection
} from "../analysis/Projection";
import { findLineCandidates } from "../analysis/LineCandidate";
import { createProjectionProfileSummary } from "../detection/projectionDiagnostics";
import { createDigitizationExperimentBenchmark } from "./digitizationExperimentBenchmark";
import { createDigitizationDatasetRunner } from "./dataset/digitizationDatasetRunner";
import {
  createVerticalSpanRelativeCoverageDiagnostics,
  verticalSpanRelativeCoverageDiagnosticsExperiment
} from "./verticalSpanRelativeCoverageDiagnostics";

test("exposes the BinaryImage-only experiment contract", () => {
  expect(verticalSpanRelativeCoverageDiagnosticsExperiment).toEqual({
    id: "vertical-span-relative-coverage-diagnostics",
    description: "Compare full-page and horizontally observed span-relative vertical candidate coverage.",
    run: expect.any(Function)
  });
  expect(Object.isFrozen(verticalSpanRelativeCoverageDiagnosticsExperiment)).toBe(true);

  const context = new Proxy({}, {
    get() {
      throw new Error("analysis context must not be read");
    }
  });

  expect(() => verticalSpanRelativeCoverageDiagnosticsExperiment.run(
    createGridSpanImage(),
    context
  )).not.toThrow();
});

test("observes vertical candidates inside a horizontal-evidence span but not across the full page", () => {
  const diagnostics = createVerticalSpanRelativeCoverageDiagnostics(
    createGridSpanImage()
  );

  expect(diagnostics).toEqual(expect.objectContaining({
    type: "vertical-span-relative-coverage-observation",
    status: "measured",
    axis: "vertical",
    parameters: {
      candidateCoverageRatio: 0.8,
      spanMethod: "outermost-horizontal-candidate-runs"
    }
  }));
  expect(diagnostics.spanObservation).toEqual({
    status: "measured",
    method: "outermost-horizontal-candidate-runs",
    boundaryEvidence: {
      candidateCount: 2,
      candidatePositions: [20, 79]
    },
    top: 20,
    bottom: 79,
    length: 60
  });
  expect(diagnostics.fullPage).toMatchObject({
    denominator: { top: 0, bottom: 99, length: 100 },
    minimumStrength: 80,
    strongestEvidence: {
      position: 2,
      strength: 60,
      coverageRatio: 0.6
    },
    candidateCount: 0,
    candidatePositions: []
  });
  expect(diagnostics.spanRelative).toMatchObject({
    denominator: { top: 20, bottom: 79, length: 60 },
    minimumStrength: 48,
    strongestEvidence: {
      position: 2,
      strength: 60,
      coverageRatio: 1
    },
    candidateCount: 2,
    candidatePositions: [2, 6]
  });
});

test("uses outermost qualifying horizontal run boundaries including thickness", () => {
  const binaryImage = createBinaryImage({
    width: 10,
    height: 100,
    darkPixels: [
      ...createHorizontalPixels(20, 8),
      ...createHorizontalPixels(21, 8),
      ...createHorizontalPixels(50, 8),
      ...createHorizontalPixels(78, 8),
      ...createHorizontalPixels(79, 8)
    ]
  });
  const diagnostics = createVerticalSpanRelativeCoverageDiagnostics(binaryImage);

  expect(diagnostics.spanObservation).toEqual({
    status: "measured",
    method: "outermost-horizontal-candidate-runs",
    boundaryEvidence: {
      candidateCount: 3,
      candidatePositions: [20.5, 50, 78.5]
    },
    top: 20,
    bottom: 79,
    length: 60
  });
});

test("builds a genuinely row-restricted projection that excludes outside ink", () => {
  const outsideInk = [
    ...createVerticalPixelsBetween(9, 0, 29),
    ...createVerticalPixelsBetween(9, 70, 99)
  ];
  const binaryImage = createBinaryImage({
    width: 10,
    height: 100,
    darkPixels: [
      ...createHorizontalPixels(30, 8),
      ...createHorizontalPixels(69, 8),
      ...outsideInk
    ]
  });
  const diagnostics = createVerticalSpanRelativeCoverageDiagnostics(binaryImage);

  expect(diagnostics.fullPage.strongestEvidence).toEqual({
    position: 9,
    strength: 60,
    coverageRatio: 0.6
  });
  expect(diagnostics.spanRelative.strongestEvidence).toEqual({
    position: 0,
    strength: 2,
    coverageRatio: 0.05
  });
});

test("preserves deterministic half-pixel candidate positions", () => {
  const binaryImage = createBinaryImage({
    width: 10,
    height: 100,
    darkPixels: [
      ...createHorizontalPixels(20, 8),
      ...createHorizontalPixels(79, 8),
      ...createVerticalPixelsBetween(2, 20, 79),
      ...createVerticalPixelsBetween(3, 20, 79),
      ...createVerticalPixelsBetween(7, 20, 79)
    ]
  });
  const diagnostics = createVerticalSpanRelativeCoverageDiagnostics(binaryImage);

  expect(diagnostics.spanRelative.candidatePositions).toEqual([2.5, 7]);
});

test("reports equal candidate positions when vertical evidence covers the full page", () => {
  const binaryImage = createBinaryImage({
    width: 10,
    height: 100,
    darkPixels: [
      ...createHorizontalPixels(20, 8),
      ...createHorizontalPixels(79, 8),
      ...createVerticalPixelsBetween(2, 0, 99),
      ...createVerticalPixelsBetween(6, 0, 99)
    ]
  });
  const diagnostics = createVerticalSpanRelativeCoverageDiagnostics(binaryImage);

  expect(diagnostics.fullPage.candidatePositions).toEqual([2, 6]);
  expect(diagnostics.spanRelative.candidatePositions).toEqual([2, 6]);
});

test.each([
  {
    label: "no horizontal candidates",
    darkPixels: []
  },
  {
    label: "one horizontal candidate",
    darkPixels: createHorizontalPixels(20, 8)
  }
])("keeps full-page evidence measured when there are $label", ({ darkPixels }) => {
  const diagnostics = createVerticalSpanRelativeCoverageDiagnostics(
    createBinaryImage({ width: 10, height: 100, darkPixels })
  );

  expect(diagnostics.status).toBe("partial");
  expect(diagnostics.spanObservation).toMatchObject({
    status: "unavailable",
    reason: "fewer-than-two-horizontal-candidates",
    top: null,
    bottom: null,
    length: null
  });
  expect(diagnostics.fullPage.status).toBe("measured");
  expect(diagnostics.spanRelative).toEqual({
    status: "unavailable",
    reason: "observed-span-unavailable",
    denominator: null,
    minimumStrength: null,
    profile: null,
    strongestEvidence: null,
    candidateCount: null,
    candidatePositions: null
  });
});

test("uses the existing projection, summary and candidate helpers exactly", () => {
  const binaryImage = createGridSpanImage();
  const horizontalProjection = createHorizontalProjection(binaryImage);
  const horizontalCandidates = findLineCandidates(horizontalProjection, {
    axis: "horizontal",
    axisLength: 10,
    minCoverageRatio: 0.8
  });
  const fullProjection = createVerticalProjection(binaryImage);
  const restrictedImage = {
    width: 10,
    height: 60,
    data: binaryImage.data.subarray(20 * 10, 80 * 10)
  };
  const restrictedProjection = createVerticalProjection(restrictedImage);
  const diagnostics = createVerticalSpanRelativeCoverageDiagnostics(binaryImage);

  expect(diagnostics.spanObservation.boundaryEvidence.candidatePositions).toEqual(
    horizontalCandidates.map(candidate => candidate.position)
  );
  expect(diagnostics.fullPage.profile).toEqual(createProjectionProfileSummary({
    projection: fullProjection,
    axisLength: 100
  }));
  expect(diagnostics.spanRelative.profile).toEqual(createProjectionProfileSummary({
    projection: restrictedProjection,
    axisLength: 60
  }));
  expect(diagnostics.fullPage.candidatePositions).toEqual(
    findLineCandidates(fullProjection, {
      axis: "vertical",
      axisLength: 100,
      minCoverageRatio: 0.8
    }).map(candidate => candidate.position)
  );
  expect(diagnostics.spanRelative.candidatePositions).toEqual(
    findLineCandidates(restrictedProjection, {
      axis: "vertical",
      axisLength: 60,
      minCoverageRatio: 0.8
    }).map(candidate => candidate.position)
  );
});

test("reads accessor-backed BinaryImage data exactly once with identical output", () => {
  const plainBinaryImage = createGridSpanImage();
  const accessor = createAccessorBackedBinaryImage(plainBinaryImage);

  const expected = createVerticalSpanRelativeCoverageDiagnostics(plainBinaryImage);
  const actual = createVerticalSpanRelativeCoverageDiagnostics(
    accessor.binaryImage
  );

  expect(accessor.getReadCount()).toBe(1);
  expect(actual).toEqual(expected);
});

test("is deterministic and does not mutate frozen input", () => {
  const binaryImage = createGridSpanImage();
  const snapshot = new Uint8Array(binaryImage.data);
  Object.freeze(binaryImage);

  const first = createVerticalSpanRelativeCoverageDiagnostics(binaryImage);
  const second = createVerticalSpanRelativeCoverageDiagnostics(binaryImage);

  expect(second).toEqual(first);
  expect(binaryImage.data).toEqual(snapshot);
});

test("allows benchmark and dataset execution to continue", async () => {
  const laterExperiment = {
    id: "later",
    description: "Later experiment",
    run: jest.fn(() => ({ type: "later-diagnostics" }))
  };
  const runBenchmark = createDigitizationExperimentBenchmark({
    listExperiments: () => [
      verticalSpanRelativeCoverageDiagnosticsExperiment,
      laterExperiment
    ],
    now: createIncrementingClock()
  });
  const binaryImage = createGridSpanImage();
  const gridDetection = {
    geometry: null,
    confidence: "missing-grid-geometry",
    diagnostics: []
  };
  const productionResult = {
    context: { binaryImage, gridDetection },
    gridDetection,
    diagnostics: []
  };
  const runDataset = createDigitizationDatasetRunner({
    runProduction: async () => productionResult,
    runComparison: async ({ productionResult: production, analysisContext }) => ({
      production,
      benchmark: await runBenchmark(analysisContext.binaryImage, analysisContext)
    })
  });

  const result = await runDataset({
    datasetId: "span-relative",
    items: [{ id: "item-1" }],
    prepareInput: async () => ({
      source: { id: "source" },
      readImageData: jest.fn()
    })
  });

  expect(result.items[0].status).toBe("completed");
  expect(result.items[0].comparison.result.benchmark.experiments.map(
    experiment => ({ id: experiment.id, success: experiment.success })
  )).toEqual([
    { id: "vertical-span-relative-coverage-diagnostics", success: true },
    { id: "later", success: true }
  ]);
  expect(laterExperiment.run).toHaveBeenCalledTimes(1);
});

test("contains no production, geometry, evaluation or selection fields", () => {
  const diagnostics = createVerticalSpanRelativeCoverageDiagnostics(
    createGridSpanImage()
  );
  const forbidden = new Set([
    "production",
    "gridDetection",
    "geometry",
    "gridGeometry",
    "confidence",
    "score",
    "recommendation",
    "preferredThreshold",
    "selectedSpan",
    "conclusion",
    "visualizations"
  ]);

  expect(collectKeys(diagnostics).filter(key => forbidden.has(key))).toEqual([]);
});

test("does not import production detection or geometry code", () => {
  const source = fs.readFileSync(
    require.resolve("./verticalSpanRelativeCoverageDiagnostics"),
    "utf8"
  );

  expect(source).not.toMatch(/imageGridDetectionEngine|gridDetectionEngine/);
  expect(source).not.toMatch(/GridGeometry|detectGrid|createGridDetection/);
});

function createGridSpanImage() {
  return createBinaryImage({
    width: 10,
    height: 100,
    darkPixels: [
      ...createHorizontalPixels(20, 8),
      ...createHorizontalPixels(79, 8),
      ...createVerticalPixelsBetween(2, 20, 79),
      ...createVerticalPixelsBetween(6, 20, 79)
    ]
  });
}

function createBinaryImage({ width, height, darkPixels = [] }) {
  const data = new Uint8Array(width * height);

  for (const [x, y] of darkPixels) {
    data[(y * width) + x] = 1;
  }

  return { width, height, data };
}

function createHorizontalPixels(y, width) {
  return Array.from({ length: width }, (_, x) => [x, y]);
}

function createVerticalPixelsBetween(x, top, bottom) {
  return Array.from({ length: bottom - top + 1 }, (_, index) => [x, top + index]);
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
