import { runDigitizationExperimentBenchmark } from "./digitizationExperimentBenchmark";

export function createDigitizationExperimentComparison({
  runBenchmark = runDigitizationExperimentBenchmark
} = {}) {
  return async function runComparison({
    productionResult,
    binaryImage,
    analysisContext
  } = {}) {
    if (!productionResult) {
      throw new Error("productionResult is required");
    }

    const benchmark = await runBenchmark(binaryImage, analysisContext);

    return {
      production: productionResult,
      benchmark
    };
  };
}

export const runDigitizationExperimentComparison = createDigitizationExperimentComparison();
