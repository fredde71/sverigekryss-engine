import { createVerticalProjection } from "../analysis/Projection";
import {
  getDigitizationExperiment,
  listDigitizationExperiments,
  runDigitizationExperiment
} from "./digitizationExperimentRegistry";
import { createVerticalContinuityProjectionComparison } from "./verticalContinuityDiagnostics";
import { createVerticalContinuityCandidateDiagnostics } from "./verticalContinuityCandidateDiagnostics";
import { createVerticalCandidateCoverageThresholdDiagnostics } from "./verticalCandidateCoverageThresholdDiagnostics";
import { createVerticalSpanRelativeCoverageDiagnostics } from "./verticalSpanRelativeCoverageDiagnostics";
import { createVerticalLineMaskProjectionComparison } from "./verticalLineMaskDiagnostics";
import { createShadowAnalysisRegionDiagnostics } from "./shadowAnalysisRegionDiagnostics";
import { runShadowGridAnalysisDiagnostics } from "./shadowGridAnalysisDiagnostics";

test("lists registered digitization experiments with their public contract", () => {
  const experiments = listDigitizationExperiments();

  expect(experiments.map(experiment => experiment.id)).toEqual([
    "vertical-line-mask-diagnostics",
    "vertical-continuity-diagnostics",
    "vertical-continuity-candidate-diagnostics",
    "vertical-candidate-coverage-threshold-diagnostics",
    "vertical-span-relative-coverage-diagnostics",
    "shadow-analysis-region-observations",
    "shadow-grid-analysis-diagnostics",
    "grid-confidence-diagnostics"
  ]);

  for (const experiment of experiments) {
    expect(experiment).toEqual(expect.objectContaining({
      id: expect.any(String),
      description: expect.any(String),
      run: expect.any(Function)
    }));
    expect(Object.isFrozen(experiment)).toBe(true);
  }

  experiments.pop();
  expect(listDigitizationExperiments()).toHaveLength(8);
});

test("looks up experiment metadata without executing the experiment", () => {
  expect(getDigitizationExperiment("vertical-continuity-diagnostics")).toEqual(
    expect.objectContaining({
      id: "vertical-continuity-diagnostics",
      description: expect.any(String),
      run: expect.any(Function)
    })
  );
  expect(getDigitizationExperiment("not-registered")).toBeNull();
});

test("looks up and runs each registered experiment without changing its existing output", async () => {
  const binaryImage = createBinaryImage({
    width: 6,
    height: 6,
    darkPixels: [
      [2, 0],
      [2, 1],
      [2, 2],
      [2, 3],
      [2, 4],
      [2, 5],
      [5, 1]
    ]
  });
  const rawVerticalProjection = createVerticalProjection(binaryImage);

  expect(runDigitizationExperiment(
    "vertical-line-mask-diagnostics",
    binaryImage,
    { rawVerticalProjection }
  )).toEqual(createVerticalLineMaskProjectionComparison({
    binaryImage,
    rawVerticalProjection
  }));

  const options = {
    windowHeight: 5,
    horizontalRadius: 0,
    minContinuityRatio: 0.8
  };

  expect(runDigitizationExperiment(
    "vertical-continuity-diagnostics",
    binaryImage,
    {
      projections: {
        vertical: rawVerticalProjection
      },
      options
    }
  )).toEqual(createVerticalContinuityProjectionComparison({
    binaryImage,
    rawVerticalProjection,
    options
  }));

  expect(runDigitizationExperiment(
    "vertical-continuity-candidate-diagnostics",
    binaryImage,
    new Proxy({}, {
      get() {
        throw new Error("context must not be read");
      }
    })
  )).toEqual(createVerticalContinuityCandidateDiagnostics(binaryImage));

  expect(runDigitizationExperiment(
    "vertical-candidate-coverage-threshold-diagnostics",
    binaryImage,
    new Proxy({}, {
      get() {
        throw new Error("context must not be read");
      }
    })
  )).toEqual(createVerticalCandidateCoverageThresholdDiagnostics(binaryImage));

  expect(runDigitizationExperiment(
    "vertical-span-relative-coverage-diagnostics",
    binaryImage,
    new Proxy({}, {
      get() {
        throw new Error("context must not be read");
      }
    })
  )).toEqual(createVerticalSpanRelativeCoverageDiagnostics(binaryImage));

  expect(runDigitizationExperiment(
    "shadow-analysis-region-observations",
    binaryImage,
    new Proxy({}, {
      get() {
        throw new Error("context must not be read");
      }
    })
  )).toEqual(createShadowAnalysisRegionDiagnostics(binaryImage));

  await expect(runDigitizationExperiment(
    "shadow-grid-analysis-diagnostics",
    binaryImage,
    new Proxy({}, {
      get() {
        throw new Error("context must not be read");
      }
    })
  )).resolves.toEqual(expect.objectContaining({
    type: "shadow-grid-analysis-diagnostics",
    version: 1,
    status: "complete",
    providers: expect.any(Array)
  }));

  await expect(runShadowGridAnalysisDiagnostics(binaryImage)).resolves.toEqual(
    expect.objectContaining({
      type: "shadow-grid-analysis-diagnostics",
      providers: expect.any(Array)
    })
  );
});

test("rejects an unknown experiment id", () => {
  const binaryImage = createBinaryImage({
    width: 1,
    height: 1,
    darkPixels: []
  });

  expect(() => runDigitizationExperiment(
    "not-registered",
    binaryImage
  )).toThrow("Unknown digitization experiment: not-registered");
});

test("executes every registered experiment deterministically without mutating input", async () => {
  const binaryImage = createBinaryImage({
    width: 7,
    height: 9,
    darkPixels: [
      [2, 0],
      [2, 1],
      [3, 2],
      [3, 3],
      [3, 4],
      [3, 5],
      [2, 6],
      [2, 7],
      [2, 8],
      [6, 4]
    ]
  });
  const sourceSnapshot = new Uint8Array(binaryImage.data);

  for (const experiment of listDigitizationExperiments()) {
    const first = await runDigitizationExperiment(experiment.id, binaryImage);
    const second = await runDigitizationExperiment(experiment.id, binaryImage);

    expect(removeDurations(second)).toEqual(removeDurations(first));
  }

  expect(binaryImage.data).toEqual(sourceSnapshot);
});

function createBinaryImage({
  width,
  height,
  darkPixels
}) {
  const data = new Uint8Array(width * height);

  for (const [x, y] of darkPixels) {
    data[(y * width) + x] = 1;
  }

  return {
    width,
    height,
    data
  };
}

function removeDurations(value) {
  if (Array.isArray(value)) {
    return value.map(removeDurations);
  }

  if (!value || typeof value !== "object" || ArrayBuffer.isView(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "durationMs")
      .map(([key, nestedValue]) => [key, removeDurations(nestedValue)])
  );
}
