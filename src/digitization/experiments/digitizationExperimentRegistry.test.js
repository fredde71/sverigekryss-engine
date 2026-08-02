import { createVerticalProjection } from "../analysis/Projection";
import {
  getDigitizationExperiment,
  listDigitizationExperiments,
  runDigitizationExperiment
} from "./digitizationExperimentRegistry";
import { createVerticalContinuityProjectionComparison } from "./verticalContinuityDiagnostics";
import { createVerticalLineMaskProjectionComparison } from "./verticalLineMaskDiagnostics";

test("lists registered digitization experiments with their public contract", () => {
  const experiments = listDigitizationExperiments();

  expect(experiments.map(experiment => experiment.id)).toEqual([
    "vertical-line-mask-diagnostics",
    "vertical-continuity-diagnostics"
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
  expect(listDigitizationExperiments()).toHaveLength(2);
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

test("looks up and runs each registered experiment without changing its existing output", () => {
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

test("executes every registered experiment deterministically without mutating input", () => {
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
    const first = runDigitizationExperiment(experiment.id, binaryImage);
    const second = runDigitizationExperiment(experiment.id, binaryImage);

    expect(second).toEqual(first);
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
