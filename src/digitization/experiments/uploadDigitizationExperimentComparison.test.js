import { runUploadDigitizationExperimentComparison } from "./uploadDigitizationExperimentComparison";

test("passes the exact production result and its analysis values to comparison", async () => {
  const binaryImage = createBinaryImage();
  const analysisContext = {
    binaryImage,
    marker: "production-analysis-context"
  };
  const productionResult = {
    context: analysisContext,
    gridDetection: {
      confidence: "detected"
    },
    diagnostics: []
  };
  const comparisonResult = {
    production: productionResult,
    benchmark: {
      experiments: []
    }
  };
  const runComparison = jest.fn(async () => comparisonResult);

  const state = await runUploadDigitizationExperimentComparison(
    productionResult,
    { runComparison }
  );

  expect(runComparison).toHaveBeenCalledTimes(1);
  expect(runComparison).toHaveBeenCalledWith({
    productionResult,
    binaryImage,
    analysisContext
  });
  expect(state).toEqual({
    status: "completed",
    result: comparisonResult
  });
  expect(state.result).toBe(comparisonResult);
  expect(state.result.production).toBe(productionResult);
});

test("captures comparison failure without changing the production result", async () => {
  const productionResult = {
    context: {
      binaryImage: createBinaryImage()
    },
    gridDetection: {
      confidence: "detected",
      diagnostics: []
    },
    diagnostics: []
  };
  const productionSnapshot = {
    context: productionResult.context,
    gridDetection: productionResult.gridDetection,
    diagnostics: productionResult.diagnostics
  };
  const error = new Error("comparison failed");

  const state = await runUploadDigitizationExperimentComparison(
    productionResult,
    {
      runComparison: async () => {
        throw error;
      }
    }
  );

  expect(state).toEqual({
    status: "failed",
    error
  });
  expect(productionResult.context).toBe(productionSnapshot.context);
  expect(productionResult.gridDetection).toBe(productionSnapshot.gridDetection);
  expect(productionResult.diagnostics).toBe(productionSnapshot.diagnostics);
});

function createBinaryImage() {
  return {
    width: 2,
    height: 2,
    data: new Uint8Array([0, 1, 1, 0])
  };
}
