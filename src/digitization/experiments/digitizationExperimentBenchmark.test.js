import {
  createDigitizationExperimentBenchmark,
  runDigitizationExperimentBenchmark
} from "./digitizationExperimentBenchmark";
import { listDigitizationExperiments } from "./digitizationExperimentRegistry";

test("runs every registered experiment", async () => {
  const binaryImage = createBinaryImage();
  const context = {
    options: {
      windowHeight: 3
    }
  };
  const result = await runDigitizationExperimentBenchmark(binaryImage, context);
  const registeredExperiments = listDigitizationExperiments();

  expect(result.experiments).toHaveLength(registeredExperiments.length);
  expect(result.experiments.map(experiment => experiment.id)).toEqual(
    registeredExperiments.map(experiment => experiment.id)
  );

  result.experiments.forEach((experiment, index) => {
    expect(experiment).toEqual({
      id: registeredExperiments[index].id,
      description: registeredExperiments[index].description,
      durationMs: expect.any(Number),
      success: true,
      diagnostics: expect.any(Object)
    });
    expect(experiment.durationMs).toBeGreaterThanOrEqual(0);
  });
});

test("preserves registry ordering deterministically", async () => {
  const experiments = [
    createExperiment("second"),
    createExperiment("first"),
    createExperiment("third")
  ];
  const runBenchmark = createDigitizationExperimentBenchmark({
    listExperiments: () => experiments,
    now: () => 1
  });

  const firstRun = await runBenchmark(createBinaryImage());
  const secondRun = await runBenchmark(createBinaryImage());

  expect(firstRun.experiments.map(experiment => experiment.id)).toEqual([
    "second",
    "first",
    "third"
  ]);
  expect(secondRun).toEqual(firstRun);
});

test("isolates a failed experiment and continues with later experiments", async () => {
  const laterRun = jest.fn(() => ({ type: "later-diagnostic" }));
  const runBenchmark = createDigitizationExperimentBenchmark({
    listExperiments: () => [
      createExperiment("before"),
      createExperiment("failing", () => {
        throw new TypeError("synthetic failure");
      }),
      createExperiment("after", laterRun)
    ],
    now: () => 5
  });

  const result = await runBenchmark(createBinaryImage());

  expect(result.experiments).toEqual([
    {
      id: "before",
      description: "Experiment before",
      durationMs: 0,
      success: true,
      diagnostics: {
        type: "before-diagnostic"
      }
    },
    {
      id: "failing",
      description: "Experiment failing",
      durationMs: 0,
      success: false,
      diagnostics: {
        type: "digitization-experiment-failure",
        name: "TypeError",
        message: "synthetic failure"
      }
    },
    {
      id: "after",
      description: "Experiment after",
      durationMs: 0,
      success: true,
      diagnostics: {
        type: "later-diagnostic"
      }
    }
  ]);
  expect(laterRun).toHaveBeenCalledTimes(1);
});

test("isolates a rejected experiment promise and continues with later experiments", async () => {
  const laterRun = jest.fn(() => ({ type: "later-async-diagnostic" }));
  const runBenchmark = createDigitizationExperimentBenchmark({
    listExperiments: () => [
      createExperiment(
        "rejecting",
        () => Promise.reject(new Error("synthetic async failure"))
      ),
      createExperiment("after-rejection", laterRun)
    ],
    now: () => 8
  });

  const result = await runBenchmark(createBinaryImage());

  expect(result.experiments).toEqual([
    {
      id: "rejecting",
      description: "Experiment rejecting",
      durationMs: 0,
      success: false,
      diagnostics: {
        type: "digitization-experiment-failure",
        name: "Error",
        message: "synthetic async failure"
      }
    },
    {
      id: "after-rejection",
      description: "Experiment after-rejection",
      durationMs: 0,
      success: true,
      diagnostics: {
        type: "later-async-diagnostic"
      }
    }
  ]);
  expect(laterRun).toHaveBeenCalledTimes(1);
});

test("preserves the exact diagnostic object returned by a successful experiment", async () => {
  const diagnostics = {
    type: "reference-diagnostic",
    nested: {
      retained: true
    }
  };
  const runBenchmark = createDigitizationExperimentBenchmark({
    listExperiments: () => [
      createExperiment("reference", () => diagnostics)
    ],
    now: () => 3
  });

  const result = await runBenchmark(createBinaryImage());

  expect(result.experiments[0].diagnostics).toBe(diagnostics);
  expect(diagnostics).toEqual({
    type: "reference-diagnostic",
    nested: {
      retained: true
    }
  });
});

test("exposes prior successful diagnostics without changing existing arguments", async () => {
  const binaryImage = createBinaryImage();
  const context = { source: "exact-context" };
  const firstDiagnostics = { type: "first-diagnostic" };
  const laterRun = jest.fn((_binaryImage, _context, execution) => ({
    type: "dependent-diagnostic",
    source: execution.getSuccessfulDiagnostics("first"),
    missing: execution.getSuccessfulDiagnostics("missing")
  }));
  const runBenchmark = createDigitizationExperimentBenchmark({
    listExperiments: () => [
      createExperiment("first", () => firstDiagnostics),
      createExperiment("later", laterRun)
    ],
    now: () => 1
  });

  const result = await runBenchmark(binaryImage, context);

  expect(laterRun.mock.calls[0][0]).toBe(binaryImage);
  expect(laterRun.mock.calls[0][1]).toBe(context);
  expect(laterRun.mock.calls[0][2]).toEqual(expect.objectContaining({
    getSuccessfulDiagnostics: expect.any(Function)
  }));
  expect(result.experiments[1].diagnostics).toEqual({
    type: "dependent-diagnostic",
    source: firstDiagnostics,
    missing: null
  });
});

test("measures each experiment independently", async () => {
  const timeValues = [10, 12.5, 20, 27.25];
  const now = jest.fn(() => timeValues.shift());
  const runBenchmark = createDigitizationExperimentBenchmark({
    listExperiments: () => [
      createExperiment("one"),
      createExperiment("two", async () => ({ type: "async-diagnostic" }))
    ],
    now
  });

  const result = await runBenchmark(createBinaryImage());

  expect(result.experiments.map(experiment => experiment.durationMs)).toEqual([
    2.5,
    7.25
  ]);
  expect(now).toHaveBeenCalledTimes(4);
});

test("returns an empty result for an empty registry", async () => {
  const now = jest.fn(() => 1);
  const runBenchmark = createDigitizationExperimentBenchmark({
    listExperiments: () => [],
    now
  });

  await expect(runBenchmark(createBinaryImage())).resolves.toEqual({
    experiments: []
  });
  expect(now).not.toHaveBeenCalled();
});

function createExperiment(id, run = () => ({ type: `${id}-diagnostic` })) {
  return {
    id,
    description: `Experiment ${id}`,
    run
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
