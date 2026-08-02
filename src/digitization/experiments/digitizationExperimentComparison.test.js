import fs from "fs";
import path from "path";
import { createDigitizationExperimentBenchmark } from "./digitizationExperimentBenchmark";
import {
  createDigitizationExperimentComparison,
  runDigitizationExperimentComparison
} from "./digitizationExperimentComparison";

test("preserves the exact production result and nested production references", async () => {
  const productionResult = createProductionResult();
  const benchmark = {
    experiments: []
  };
  const runComparison = createDigitizationExperimentComparison({
    runBenchmark: async () => benchmark
  });

  const result = await runComparison({
    productionResult,
    binaryImage: createBinaryImage(),
    analysisContext: productionResult.context
  });

  expect(result.production).toBe(productionResult);
  expect(result.production.gridDetection).toBe(productionResult.gridDetection);
  expect(result.production.diagnostics).toBe(productionResult.diagnostics);
});

test("requires a production result before starting the benchmark", async () => {
  const runBenchmark = jest.fn(async () => ({
    experiments: []
  }));
  const runComparison = createDigitizationExperimentComparison({
    runBenchmark
  });

  await expect(runComparison({
    binaryImage: createBinaryImage(),
    analysisContext: {}
  })).rejects.toThrow("productionResult is required");
  expect(runBenchmark).not.toHaveBeenCalled();
});

test("passes supplied experiment inputs to the benchmark and preserves its exact result", async () => {
  const benchmark = {
    experiments: [
      {
        id: "synthetic",
        description: "Synthetic experiment",
        durationMs: 2,
        success: true,
        diagnostics: {
          type: "synthetic-diagnostic"
        }
      }
    ]
  };
  const runBenchmark = jest.fn(async () => benchmark);
  const binaryImage = createBinaryImage();
  const analysisContext = {
    marker: "analysis-context"
  };
  const runComparison = createDigitizationExperimentComparison({
    runBenchmark
  });

  const result = await runComparison({
    productionResult: createProductionResult(),
    binaryImage,
    analysisContext
  });

  expect(runBenchmark).toHaveBeenCalledTimes(1);
  expect(runBenchmark).toHaveBeenCalledWith(binaryImage, analysisContext);
  expect(result.benchmark).toBe(benchmark);
});

test("keeps experiment failures isolated without changing production", async () => {
  const productionResult = createProductionResult();
  const laterRun = jest.fn(() => ({ type: "later-diagnostic" }));
  const runBenchmark = createDigitizationExperimentBenchmark({
    listExperiments: () => [
      {
        id: "failing",
        description: "Failing experiment",
        run() {
          throw new Error("synthetic experiment failure");
        }
      },
      {
        id: "later",
        description: "Later experiment",
        run: laterRun
      }
    ],
    now: () => 4
  });
  const runComparison = createDigitizationExperimentComparison({
    runBenchmark
  });

  const result = await runComparison({
    productionResult,
    binaryImage: createBinaryImage(),
    analysisContext: productionResult.context
  });

  expect(result.production).toBe(productionResult);
  expect(result.benchmark.experiments).toEqual([
    {
      id: "failing",
      description: "Failing experiment",
      durationMs: 0,
      success: false,
      diagnostics: {
        type: "digitization-experiment-failure",
        name: "Error",
        message: "synthetic experiment failure"
      }
    },
    {
      id: "later",
      description: "Later experiment",
      durationMs: 0,
      success: true,
      diagnostics: {
        type: "later-diagnostic"
      }
    }
  ]);
  expect(laterRun).toHaveBeenCalledTimes(1);
});

test("returns a deterministic combined structure", async () => {
  const productionResult = createProductionResult();
  const benchmark = {
    experiments: []
  };
  const runComparison = createDigitizationExperimentComparison({
    runBenchmark: async () => benchmark
  });
  const input = {
    productionResult,
    binaryImage: createBinaryImage(),
    analysisContext: productionResult.context
  };

  const first = await runComparison(input);
  const second = await runComparison(input);

  expect(first).toEqual({
    production: productionResult,
    benchmark
  });
  expect(second).toEqual(first);
});

test("does not import or reference production detection", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "digitizationExperimentComparison.js"),
    "utf8"
  );

  expect(source).not.toContain("gridDetectionEngine");
  expect(source).not.toContain("imageGridDetectionEngine");
  expect(source).not.toContain("detectGridFromAnalysisContext");
  expect(source).not.toContain("detectGridFromImageSource");
  expect(source).not.toContain("createGridDetection");
});

test("default comparison runs the existing benchmark", async () => {
  const productionResult = createProductionResult();
  const binaryImage = createBinaryImage();
  const analysisContext = {
    ...productionResult.context,
    projections: {
      vertical: new Uint32Array([0, 0, 5, 0, 0])
    },
    options: {
      windowHeight: 3
    }
  };

  const result = await runDigitizationExperimentComparison({
    productionResult,
    binaryImage,
    analysisContext
  });

  expect(result.production).toBe(productionResult);
  expect(result.benchmark.experiments.length).toBeGreaterThan(0);
  expect(result.benchmark.experiments.every(experiment => (
    typeof experiment.success === "boolean"
  ))).toBe(true);
});

function createProductionResult() {
  const diagnostics = [
    {
      type: "production-diagnostic"
    }
  ];
  const gridDetection = {
    geometry: {
      rows: 2,
      cols: 2
    },
    confidence: "detected",
    diagnostics
  };

  return {
    context: {
      marker: "production-context"
    },
    gridDetection,
    diagnostics,
    suggestions: []
  };
}

function createBinaryImage() {
  return {
    width: 5,
    height: 5,
    data: new Uint8Array([
      0, 0, 1, 0, 0,
      0, 0, 1, 0, 0,
      1, 1, 1, 1, 1,
      0, 0, 1, 0, 0,
      0, 0, 1, 0, 0
    ])
  };
}
