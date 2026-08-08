import { createDigitizationDatasetRunner } from "./digitizationDatasetRunner";

test("runs each lifecycle stage in order and preserves exact result references", async () => {
  const calls = [];
  const source = { id: "prepared-source" };
  const binaryImage = { width: 1, height: 1, data: new Uint8Array([1]) };
  const analysisContext = { binaryImage };
  const productionResult = { context: analysisContext, gridDetection: {} };
  const comparisonResult = { production: productionResult, benchmark: { experiments: [] } };
  const reportResult = { type: "report" };
  const prepareInput = jest.fn(async item => {
    calls.push(`prepare:${item.id}`);
    return { source, readImageData: jest.fn() };
  });
  const runProduction = jest.fn(async () => {
    calls.push("production");
    return productionResult;
  });
  const runComparison = jest.fn(async () => {
    calls.push("comparison");
    return comparisonResult;
  });
  const createObservationReport = jest.fn(() => {
    calls.push("report");
    return reportResult;
  });
  const runDataset = createDigitizationDatasetRunner({
    runProduction,
    runComparison,
    createObservationReport
  });

  const result = await runDataset({
    datasetId: "dataset",
    items: [{ id: "item", metadata: { publisher: "TT" } }],
    prepareInput
  });

  expect(calls).toEqual(["prepare:item", "production", "comparison", "report"]);
  expect(runProduction).toHaveBeenCalledTimes(1);
  expect(runComparison).toHaveBeenCalledWith({
    productionResult,
    binaryImage,
    analysisContext
  });
  expect(createObservationReport).toHaveBeenCalledWith(comparisonResult);
  expect(result.items[0].production.result).toBe(productionResult);
  expect(result.items[0].comparison.result).toBe(comparisonResult);
  expect(result.items[0].observationReport.result).toBe(reportResult);
  expect(result.items[0].metadata).toEqual({ publisher: "TT" });
});

test("executes items sequentially and preserves input order", async () => {
  const firstPreparation = createDeferred();
  const calls = [];
  const runDataset = createRunner({
    runProduction: jest.fn(async ({ source }) => {
      calls.push(`production:${source.id}`);
      return createProductionResult(source.id);
    }),
    runComparison: jest.fn(async ({ productionResult }) => {
      calls.push(`comparison:${productionResult.id}`);
      return createComparisonResult(productionResult);
    }),
    createObservationReport: jest.fn(comparison => {
      calls.push(`report:${comparison.production.id}`);
      return { id: comparison.production.id };
    })
  });
  const runPromise = runDataset({
    datasetId: "ordered",
    items: [{ id: "first" }, { id: "second" }],
    prepareInput: jest.fn(item => {
      calls.push(`prepare:${item.id}`);

      if (item.id === "first") {
        return firstPreparation.promise;
      }

      return createPreparedInput(item.id);
    })
  });

  await Promise.resolve();
  expect(calls).toEqual(["prepare:first"]);

  firstPreparation.resolve(createPreparedInput("first"));
  const result = await runPromise;

  expect(calls).toEqual([
    "prepare:first",
    "production:first",
    "comparison:first",
    "report:first",
    "prepare:second",
    "production:second",
    "comparison:second",
    "report:second"
  ]);
  expect(result.items.map(item => item.id)).toEqual(["first", "second"]);
  expect(result.items.map(item => item.index)).toEqual([0, 1]);
});

test("isolates preparation failures and continues with later items", async () => {
  const runProduction = jest.fn(async ({ source }) => createProductionResult(source.id));
  const runDataset = createRunner({ runProduction });
  const result = await runDataset({
    items: [{ id: "broken" }, { id: "later" }],
    prepareInput: jest.fn(async item => {
      if (item.id === "broken") {
        throw new TypeError("cannot prepare input");
      }

      return createPreparedInput(item.id);
    })
  });

  expect(result.items[0]).toMatchObject({
    id: "broken",
    status: "failed",
    preparation: {
      status: "failed",
      error: {
        name: "TypeError",
        message: "cannot prepare input"
      }
    },
    production: { status: "not-run", reason: "preparation-failed" },
    comparison: { status: "not-run", reason: "preparation-failed" },
    observationReport: { status: "not-run", reason: "preparation-failed" }
  });
  expect(result.items[1].status).toBe("completed");
  expect(runProduction).toHaveBeenCalledTimes(1);
  expect(result.inventory).toEqual({
    totalItemCount: 2,
    completedItemCount: 1,
    failedItemCount: 1
  });
});

test("treats an invalid prepared source as an isolated preparation failure", async () => {
  const runProduction = jest.fn(async ({ source }) => createProductionResult(source.id));
  const runDataset = createRunner({ runProduction });
  const result = await runDataset({
    items: [{ id: "missing-source" }, { id: "valid" }],
    prepareInput: jest.fn(async item => (
      item.id === "missing-source"
        ? { readImageData: jest.fn() }
        : createPreparedInput(item.id)
    ))
  });

  expect(result.items[0].preparation).toEqual({
    status: "failed",
    error: {
      name: "Error",
      message: "Prepared input source is required"
    }
  });
  expect(result.items[1].status).toBe("completed");
  expect(runProduction).toHaveBeenCalledTimes(1);
});

test("isolates production failures without running later stages for that item", async () => {
  const runComparison = jest.fn(async ({ productionResult }) => (
    createComparisonResult(productionResult)
  ));
  const createObservationReport = jest.fn(() => ({ type: "report" }));
  const runDataset = createRunner({
    runProduction: jest.fn(async ({ source }) => {
      if (source.id === "broken") {
        throw new Error("production failed");
      }

      return createProductionResult(source.id);
    }),
    runComparison,
    createObservationReport
  });
  const result = await runStandardItems(runDataset);

  expect(result.items[0]).toMatchObject({
    status: "failed",
    production: {
      status: "failed",
      error: { name: "Error", message: "production failed" }
    },
    comparison: { status: "not-run", reason: "production-failed" },
    observationReport: { status: "not-run", reason: "production-failed" }
  });
  expect(result.items[1].status).toBe("completed");
  expect(runComparison).toHaveBeenCalledTimes(1);
  expect(createObservationReport).toHaveBeenCalledTimes(1);
});

test("isolates comparison failures while preserving production", async () => {
  const productions = [];
  const createObservationReport = jest.fn(() => ({ type: "report" }));
  const runDataset = createRunner({
    runProduction: jest.fn(async ({ source }) => {
      const result = createProductionResult(source.id);
      productions.push(result);
      return result;
    }),
    runComparison: jest.fn(async ({ productionResult }) => {
      if (productionResult.id === "broken") {
        throw new Error("comparison failed");
      }

      return createComparisonResult(productionResult);
    }),
    createObservationReport
  });
  const result = await runStandardItems(runDataset);

  expect(result.items[0].production.result).toBe(productions[0]);
  expect(result.items[0].comparison).toEqual({
    status: "failed",
    error: { name: "Error", message: "comparison failed" }
  });
  expect(result.items[0].observationReport).toEqual({
    status: "not-run",
    reason: "comparison-failed"
  });
  expect(result.items[1].status).toBe("completed");
  expect(createObservationReport).toHaveBeenCalledTimes(1);
});

test("isolates synchronous and asynchronous observation-report failures", async () => {
  const report = jest.fn(comparison => {
    if (comparison.production.id === "sync") {
      throw new Error("sync report failure");
    }

    if (comparison.production.id === "async") {
      return Promise.reject(new Error("async report failure"));
    }

    return { type: "report" };
  });
  const runDataset = createRunner({ createObservationReport: report });
  const result = await runDataset({
    items: [{ id: "sync" }, { id: "async" }, { id: "later" }],
    prepareInput: item => createPreparedInput(item.id)
  });

  expect(result.items[0].observationReport.error.message).toBe("sync report failure");
  expect(result.items[1].observationReport.error.message).toBe("async report failure");
  expect(result.items[2].status).toBe("completed");
  expect(result.items[0].production.status).toBe("completed");
  expect(result.items[0].comparison.status).toBe("completed");
});

test("runs production exactly once when a downstream stage fails", async () => {
  const runProduction = jest.fn(async () => createProductionResult("item"));
  const runDataset = createRunner({
    runProduction,
    runComparison: jest.fn(async () => {
      throw new Error("stop after production");
    })
  });

  await runDataset({
    items: [{ id: "item" }],
    prepareInput: item => createPreparedInput(item.id)
  });

  expect(runProduction).toHaveBeenCalledTimes(1);
});

test("retains benchmark experiment failures as completed collected results", async () => {
  const productionResult = createProductionResult("item");
  const comparisonResult = {
    production: productionResult,
    benchmark: {
      experiments: [{ id: "failed-experiment", success: false }]
    }
  };
  const createObservationReport = jest.fn(() => ({ type: "report" }));
  const runDataset = createRunner({
    runProduction: jest.fn(async () => productionResult),
    runComparison: jest.fn(async () => comparisonResult),
    createObservationReport
  });
  const result = await runDataset({
    items: [{ id: "item" }],
    prepareInput: item => createPreparedInput(item.id)
  });

  expect(result.items[0].status).toBe("completed");
  expect(result.items[0].comparison.result).toBe(comparisonResult);
  expect(createObservationReport).toHaveBeenCalledWith(comparisonResult);
});

test("validates unique non-empty item IDs before executing any item", async () => {
  const prepareInput = jest.fn();
  const runProduction = jest.fn();
  const runDataset = createRunner({ runProduction });

  await expect(runDataset({
    items: [{ id: "duplicate" }, { id: "duplicate" }],
    prepareInput
  })).rejects.toThrow("Duplicate dataset item id: duplicate");
  await expect(runDataset({
    items: [{ id: "" }],
    prepareInput
  })).rejects.toThrow("Dataset item id must be a non-empty string");
  expect(prepareInput).not.toHaveBeenCalled();
  expect(runProduction).not.toHaveBeenCalled();
});

test("returns a versioned empty dataset result", async () => {
  const result = await createRunner()({
    datasetId: "empty",
    items: [],
    prepareInput: jest.fn()
  });

  expect(result).toEqual({
    type: "digitization-dataset-run",
    version: 1,
    datasetId: "empty",
    status: "completed",
    inventory: {
      totalItemCount: 0,
      completedItemCount: 0,
      failedItemCount: 0
    },
    items: []
  });
});

test("forwards production options without adding detection settings", async () => {
  const readImageData = jest.fn();
  const itemReadImageData = jest.fn();
  const runProduction = jest.fn(async () => createProductionResult("item"));
  const runDataset = createRunner({ runProduction });

  await runDataset({
    items: [{
      id: "item",
      productionOptions: {
        threshold: 120,
        itemOnly: true
      }
    }],
    productionOptions: {
      threshold: 80,
      globalOnly: true
    },
    readImageData,
    prepareInput: async () => ({
      source: { id: "source" },
      readImageData: itemReadImageData,
      productionOptions: {
        documentSize: { width: 1200, height: 1697 }
      }
    })
  });

  expect(runProduction).toHaveBeenCalledWith({
    source: { id: "source" },
    options: {
      threshold: 120,
      globalOnly: true,
      itemOnly: true,
      documentSize: { width: 1200, height: 1697 }
    },
    readImageData: itemReadImageData
  });
  expect(readImageData).not.toHaveBeenCalled();
});

test("uses the shared image reader when preparation does not provide one", async () => {
  const readImageData = jest.fn();
  const runProduction = jest.fn(async () => createProductionResult("item"));
  const runDataset = createRunner({ runProduction });

  await runDataset({
    items: [{ id: "item" }],
    readImageData,
    prepareInput: async () => ({ source: { id: "source" } })
  });

  expect(runProduction.mock.calls[0][0].readImageData).toBe(readImageData);
});

test("does not mutate deeply frozen input and copies metadata", async () => {
  const input = deepFreeze({
    datasetId: "frozen",
    items: [{
      id: "item",
      input: { kind: "prepared-source" },
      metadata: { publisher: "TT", labels: ["real"] },
      productionOptions: { threshold: 90 }
    }],
    productionOptions: { global: true }
  });
  const snapshot = JSON.stringify(input);
  const runDataset = createRunner();
  const result = await runDataset({
    ...input,
    prepareInput: item => createPreparedInput(item.id)
  });

  expect(JSON.stringify(input)).toBe(snapshot);
  expect(result.items[0].metadata).toEqual(input.items[0].metadata);
  expect(result.items[0].metadata).not.toBe(input.items[0].metadata);
  expect(result.items[0].metadata.labels).not.toBe(input.items[0].metadata.labels);
});

test("is deterministic with deterministic dependencies", async () => {
  const runDataset = createRunner();
  const input = deepFreeze({
    datasetId: "repeatable",
    items: [{ id: "one" }, { id: "two" }]
  });
  const execute = () => runDataset({
    ...input,
    prepareInput: item => createPreparedInput(item.id)
  });

  expect(await execute()).toEqual(await execute());
});

test("normalizes thrown values to deterministic name and message only", async () => {
  const runDataset = createRunner();
  const result = await runDataset({
    items: [{ id: "item" }],
    prepareInput: async () => {
      throw "plain failure";
    }
  });

  expect(result.items[0].preparation.error).toEqual({
    name: "Error",
    message: "plain failure"
  });
});

test("adds no dataset evaluation, ranking, timestamp or duration fields", async () => {
  const result = await createRunner()({
    items: [{ id: "item" }],
    prepareInput: item => createPreparedInput(item.id)
  });
  const ownedResult = {
    ...result,
    items: result.items.map(item => ({
      id: item.id,
      index: item.index,
      metadata: item.metadata,
      status: item.status,
      preparation: omitResult(item.preparation),
      production: omitResult(item.production),
      comparison: omitResult(item.comparison),
      observationReport: omitResult(item.observationReport)
    }))
  };
  const forbidden = new Set([
    "score",
    "rank",
    "ranking",
    "winner",
    "best",
    "recommendation",
    "selectedExperiment",
    "datasetComparison",
    "timestamp",
    "durationMs"
  ]);

  expect(findObjectKeys(ownedResult).filter(key => forbidden.has(key))).toEqual([]);
});

test("keeps PDF decoding at the preparation adapter boundary", async () => {
  const pdfDescriptor = {
    kind: "pdf",
    path: "/fixtures/crossword.pdf",
    pageNumber: 1
  };
  const renderedSource = { kind: "rendered-page", id: "page-1" };
  const prepareInput = jest.fn(async item => {
    expect(item.input).toBe(pdfDescriptor);
    return {
      source: renderedSource,
      readImageData: jest.fn(),
      productionOptions: {
        documentSize: { width: 1200, height: 1697 }
      }
    };
  });
  const runProduction = jest.fn(async () => createProductionResult("pdf"));
  const runDataset = createRunner({ runProduction });

  await runDataset({
    items: [{ id: "pdf", input: pdfDescriptor }],
    prepareInput
  });

  expect(prepareInput).toHaveBeenCalledTimes(1);
  expect(runProduction).toHaveBeenCalledTimes(1);
  expect(runProduction.mock.calls[0][0].source).toBe(renderedSource);
  expect(runProduction.mock.calls[0][0].source).not.toBe(pdfDescriptor);
});

function createRunner(overrides = {}) {
  return createDigitizationDatasetRunner({
    runProduction: overrides.runProduction || jest.fn(async ({ source }) => (
      createProductionResult(source.id)
    )),
    runComparison: overrides.runComparison || jest.fn(async ({ productionResult }) => (
      createComparisonResult(productionResult)
    )),
    createObservationReport: overrides.createObservationReport || jest.fn(comparison => ({
      type: "report",
      productionId: comparison.production.id
    }))
  });
}

function createPreparedInput(id) {
  return {
    source: { id },
    readImageData: jest.fn()
  };
}

function createProductionResult(id) {
  const binaryImage = {
    width: 1,
    height: 1,
    data: [1]
  };

  return {
    id,
    context: {
      binaryImage
    },
    gridDetection: {
      geometry: null
    }
  };
}

function createComparisonResult(productionResult) {
  return {
    production: productionResult,
    benchmark: {
      experiments: []
    }
  };
}

function runStandardItems(runDataset) {
  return runDataset({
    items: [{ id: "broken" }, { id: "later" }],
    prepareInput: item => createPreparedInput(item.id)
  });
}

function createDeferred() {
  let resolve;
  const promise = new Promise(resolvePromise => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function omitResult(stage) {
  const copy = { ...stage };
  delete copy.result;
  return copy;
}

function findObjectKeys(value) {
  if (Array.isArray(value)) {
    return value.flatMap(findObjectKeys);
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => [
    key,
    ...findObjectKeys(nestedValue)
  ]);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
