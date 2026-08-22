import { listDigitizationExperiments } from "./digitizationExperimentRegistry";

export function createDigitizationExperimentBenchmark({
  listExperiments = listDigitizationExperiments,
  now = readCurrentTime
} = {}) {
  return async function runBenchmark(binaryImage, context = {}) {
    const experiments = listExperiments();
    const results = [];

    for (const experiment of experiments) {
      const startTime = now();

      try {
        const diagnostics = await experiment.run(
          binaryImage,
          context,
          createExperimentExecutionContext(results)
        );

        results.push({
          id: experiment.id,
          description: experiment.description,
          durationMs: now() - startTime,
          success: true,
          diagnostics
        });
      } catch (error) {
        results.push({
          id: experiment.id,
          description: experiment.description,
          durationMs: now() - startTime,
          success: false,
          diagnostics: createFailureDiagnostic(error)
        });
      }
    }

    return {
      experiments: results
    };
  };
}

function createExperimentExecutionContext(results) {
  const completedResults = results.slice();

  return Object.freeze({
    getSuccessfulDiagnostics(experimentId) {
      const result = completedResults.find(experiment => (
        experiment.id === experimentId && experiment.success === true
      ));

      return result?.diagnostics ?? null;
    }
  });
}

export const runDigitizationExperimentBenchmark = createDigitizationExperimentBenchmark();

function readCurrentTime() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
}

function createFailureDiagnostic(error) {
  return {
    type: "digitization-experiment-failure",
    name: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error)
  };
}
