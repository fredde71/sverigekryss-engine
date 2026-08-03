import { runDigitizationExperimentComparison } from "./digitizationExperimentComparison";

export async function runUploadDigitizationExperimentComparison(
  productionResult,
  {
    runComparison = runDigitizationExperimentComparison
  } = {}
) {
  try {
    const result = await runComparison({
      productionResult,
      binaryImage: productionResult.context.binaryImage,
      analysisContext: productionResult.context
    });

    return {
      status: "completed",
      result
    };
  } catch (error) {
    return {
      status: "failed",
      error
    };
  }
}
