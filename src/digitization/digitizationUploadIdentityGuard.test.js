import { runDigitizationUploadWithIdentity } from "./digitizationUploadIdentityGuard";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function createHarness() {
  let currentUploadId = 0;
  let productionState = null;
  let comparisonState = null;

  const startUpload = ({ production, comparison }) => {
    const uploadId = ++currentUploadId;

    const completion = runDigitizationUploadWithIdentity({
      uploadId,
      isCurrentUpload: (candidateUploadId) => candidateUploadId === currentUploadId,
      runProduction: () => production,
      runComparison: comparison
        ? (productionResult) => comparison(productionResult)
        : null,
      onPending: () => {
        productionState = { status: "pending" };
        comparisonState = null;
      },
      onProductionCompleted: (result) => {
        productionState = { status: "completed", result };
      },
      onProductionFailed: (error) => {
        productionState = { status: "failed", error };
      },
      onComparisonCompleted: (result) => {
        comparisonState = result;
      },
      onComparisonFailed: (error) => {
        comparisonState = { status: "failed", error };
      }
    });

    return completion;
  };

  return {
    startUpload,
    getProductionState: () => productionState,
    getComparisonState: () => comparisonState
  };
}

test("two uploads finishing out of order keep the newest result", async () => {
  const harness = createHarness();
  const firstProduction = deferred();
  const secondProduction = deferred();
  const firstCompletion = harness.startUpload({
    production: firstProduction.promise,
    comparison: async (production) => ({ status: "completed", production })
  });
  const secondCompletion = harness.startUpload({
    production: secondProduction.promise,
    comparison: async (production) => ({ status: "completed", production })
  });

  const secondResult = { id: "second" };
  secondProduction.resolve(secondResult);
  await secondCompletion;
  firstProduction.resolve({ id: "first" });
  await firstCompletion;

  expect(harness.getProductionState()).toEqual({
    status: "completed",
    result: secondResult
  });
  expect(harness.getComparisonState()).toEqual({
    status: "completed",
    production: secondResult
  });
});

test("stale production completion is ignored and does not start comparison", async () => {
  const harness = createHarness();
  const firstProduction = deferred();
  const firstComparison = jest.fn();
  const firstCompletion = harness.startUpload({
    production: firstProduction.promise,
    comparison: firstComparison
  });
  const secondProduction = deferred();
  const secondCompletion = harness.startUpload({
    production: secondProduction.promise,
    comparison: async (production) => ({ status: "completed", production })
  });

  firstProduction.resolve({ id: "first" });
  await firstCompletion;

  expect(firstComparison).not.toHaveBeenCalled();
  expect(harness.getProductionState()).toEqual({ status: "pending" });

  secondProduction.resolve({ id: "second" });
  await secondCompletion;
});

test("stale comparison completion is ignored", async () => {
  const harness = createHarness();
  const firstComparison = deferred();
  const firstResult = { id: "first" };
  const firstCompletion = harness.startUpload({
    production: Promise.resolve(firstResult),
    comparison: () => firstComparison.promise
  });
  await Promise.resolve();

  const secondResult = { id: "second" };
  const secondCompletion = harness.startUpload({
    production: Promise.resolve(secondResult),
    comparison: async (production) => ({ status: "completed", production })
  });
  await secondCompletion;

  firstComparison.resolve({ status: "completed", production: firstResult });
  await firstCompletion;

  expect(harness.getComparisonState()).toEqual({
    status: "completed",
    production: secondResult
  });
});

test("newest upload always wins while an older comparison remains pending", async () => {
  const harness = createHarness();
  const firstComparison = deferred();
  const firstCompletion = harness.startUpload({
    production: Promise.resolve({ id: "first" }),
    comparison: () => firstComparison.promise
  });
  await Promise.resolve();

  const secondResult = { id: "second" };
  const secondCompletion = harness.startUpload({
    production: Promise.resolve(secondResult),
    comparison: async (production) => ({ status: "completed", production })
  });

  firstComparison.resolve({ status: "completed", production: { id: "first" } });
  await Promise.all([firstCompletion, secondCompletion]);

  expect(harness.getProductionState().result).toBe(secondResult);
  expect(harness.getComparisonState().production).toBe(secondResult);
});

test("single upload still commits production before comparison", async () => {
  const harness = createHarness();
  const productionResult = { id: "only" };
  const observedProductionStates = [];

  await harness.startUpload({
    production: Promise.resolve(productionResult),
    comparison: async (production) => {
      observedProductionStates.push(harness.getProductionState());
      return { status: "completed", production };
    }
  });

  expect(observedProductionStates).toEqual([{
    status: "completed",
    result: productionResult
  }]);
  expect(harness.getProductionState().result).toBe(productionResult);
  expect(harness.getComparisonState().production).toBe(productionResult);
});
