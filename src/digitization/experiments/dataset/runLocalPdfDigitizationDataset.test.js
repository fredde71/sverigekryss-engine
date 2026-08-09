import fs from "fs";
import { createLocalPdfDigitizationDatasetEntryPoint } from "./runLocalPdfDigitizationDataset";

jest.mock("./pdfDatasetAdapter", () => ({
  preparePdfDatasetInput: jest.fn()
}));

test.each(["development", "test"])(
  "allows the %s environment and delegates exactly once",
  async environment => {
    const runnerResult = { type: "digitization-dataset-run" };
    const runDataset = jest.fn(async () => runnerResult);
    const prepareInput = jest.fn();
    const readEnvironment = jest.fn(() => environment);
    const runEntryPoint = createLocalPdfDigitizationDatasetEntryPoint({
      runDataset,
      prepareInput,
      readEnvironment
    });
    const items = [{ id: "item", input: { kind: "pdf", file: {} } }];
    const productionOptions = { threshold: 90 };

    const result = await runEntryPoint({
      datasetId: "dataset",
      items,
      productionOptions
    });

    expect(readEnvironment).toHaveBeenCalledTimes(1);
    expect(runDataset).toHaveBeenCalledTimes(1);
    expect(runDataset).toHaveBeenCalledWith({
      datasetId: "dataset",
      items,
      prepareInput,
      productionOptions
    });
    expect(result).toBe(runnerResult);
    expect(prepareInput).not.toHaveBeenCalled();
  }
);

test.each([
  "production",
  undefined,
  "staging",
  "unknown"
])("rejects the %s environment before accessing dataset inputs", async environment => {
  const file = {};
  Object.defineProperty(file, "arrayBuffer", {
    get() {
      throw new Error("PDF file must not be accessed");
    }
  });
  const items = [{
    id: "item",
    input: {
      kind: "pdf",
      file
    }
  }];
  const runDataset = jest.fn();
  const prepareInput = jest.fn();
  const runEntryPoint = createLocalPdfDigitizationDatasetEntryPoint({
    runDataset,
    prepareInput,
    readEnvironment: () => environment
  });

  await expect(runEntryPoint({
    datasetId: "dataset",
    items
  })).rejects.toThrow(
    "Local PDF digitization datasets are available only in development"
  );
  expect(runDataset).not.toHaveBeenCalled();
  expect(prepareInput).not.toHaveBeenCalled();
});

test("runs the environment guard before downstream dataset validation", async () => {
  const runDataset = jest.fn(() => {
    throw new Error("items must be an array");
  });
  const runEntryPoint = createLocalPdfDigitizationDatasetEntryPoint({
    runDataset,
    prepareInput: jest.fn(),
    readEnvironment: () => "production"
  });

  await expect(runEntryPoint({
    datasetId: "dataset",
    items: null
  })).rejects.toThrow(
    "Local PDF digitization datasets are available only in development"
  );
  expect(runDataset).not.toHaveBeenCalled();
});

test("forwards the exact adapter, dataset ID, item array and production options", async () => {
  const runnerResult = { status: "completed" };
  const runDataset = jest.fn(async () => runnerResult);
  const prepareInput = jest.fn();
  const runEntryPoint = createDevelopmentEntryPoint({
    runDataset,
    prepareInput
  });
  const firstMetadata = Object.freeze({ filename: "z-last.pdf" });
  const secondMetadata = Object.freeze({ filename: "a-first.pdf" });
  const items = Object.freeze([
    Object.freeze({ id: "third", input: {}, metadata: firstMetadata }),
    Object.freeze({ id: "first", input: {}, metadata: secondMetadata })
  ]);
  const productionOptions = Object.freeze({
    experimentalDiagnostics: Object.freeze({ verticalLineMask: false })
  });

  const result = await runEntryPoint({
    datasetId: "unchanged-dataset-id",
    items,
    productionOptions
  });
  const invocation = runDataset.mock.calls[0][0];

  expect(invocation.datasetId).toBe("unchanged-dataset-id");
  expect(invocation.items).toBe(items);
  expect(invocation.items[0]).toBe(items[0]);
  expect(invocation.items[1]).toBe(items[1]);
  expect(invocation.items.map(item => item.id)).toEqual(["third", "first"]);
  expect(invocation.items[0].metadata).toBe(firstMetadata);
  expect(invocation.items[1].metadata).toBe(secondMetadata);
  expect(invocation.prepareInput).toBe(prepareInput);
  expect(invocation.productionOptions).toBe(productionOptions);
  expect(result).toBe(runnerResult);
});

test("forwards an empty dataset without replacing its item array", async () => {
  const emptyItems = Object.freeze([]);
  const runnerResult = {
    type: "digitization-dataset-run",
    items: []
  };
  const runDataset = jest.fn(async () => runnerResult);
  const runEntryPoint = createDevelopmentEntryPoint({ runDataset });

  const result = await runEntryPoint({
    datasetId: "empty",
    items: emptyItems
  });

  expect(runDataset).toHaveBeenCalledTimes(1);
  expect(runDataset.mock.calls[0][0]).toMatchObject({
    datasetId: "empty",
    items: emptyItems,
    productionOptions: undefined
  });
  expect(runDataset.mock.calls[0][0].items).toBe(emptyItems);
  expect(result).toBe(runnerResult);
});

test("uses an empty array only when items are omitted", async () => {
  const runDataset = jest.fn(async () => ({ items: [] }));
  const runEntryPoint = createDevelopmentEntryPoint({ runDataset });

  await runEntryPoint({ datasetId: "omitted-items" });

  expect(runDataset.mock.calls[0][0].items).toEqual([]);
});

test("propagates synchronous and asynchronous dataset-runner failures unchanged", async () => {
  const synchronousError = new TypeError("synchronous runner failure");
  const synchronousEntryPoint = createDevelopmentEntryPoint({
    runDataset: jest.fn(() => {
      throw synchronousError;
    })
  });

  await expect(synchronousEntryPoint({ items: [] })).rejects.toBe(synchronousError);

  const asynchronousError = new Error("asynchronous runner failure");
  const asynchronousEntryPoint = createDevelopmentEntryPoint({
    runDataset: jest.fn(() => Promise.reject(asynchronousError))
  });

  await expect(asynchronousEntryPoint({ items: [] })).rejects.toBe(asynchronousError);
});

test("returns downstream observations without evaluation or aggregation", async () => {
  const runnerResult = {
    type: "digitization-dataset-run",
    version: 1,
    items: [
      {
        id: "one",
        observationReport: {
          result: {
            structuralEvidence: {
              maximumObservedScore: 0.8
            }
          }
        }
      },
      {
        id: "two",
        comparison: {
          result: {
            benchmark: {
              experiments: [{ id: "experiment", success: false }]
            }
          }
        }
      }
    ]
  };
  const runEntryPoint = createDevelopmentEntryPoint({
    runDataset: jest.fn(async () => runnerResult)
  });

  const result = await runEntryPoint({ items: [] });

  expect(result).toBe(runnerResult);
  expect(Object.keys(result)).toEqual(["type", "version", "items"]);
  expect(result).not.toHaveProperty("summary");
  expect(result).not.toHaveProperty("ranking");
  expect(result).not.toHaveProperty("recommendation");
  expect(result).not.toHaveProperty("datasetComparison");
});

test("does not persist, download, fetch or log dataset results", async () => {
  const localStorageSpy = jest.spyOn(Storage.prototype, "setItem");
  const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({});
  const originalCreateObjectUrl = URL.createObjectURL;
  const createObjectUrlSpy = jest.fn(() => "blob:test");
  URL.createObjectURL = createObjectUrlSpy;
  const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  const runnerResult = { type: "digitization-dataset-run" };
  const runEntryPoint = createDevelopmentEntryPoint({
    runDataset: jest.fn(async () => runnerResult)
  });

  try {
    expect(await runEntryPoint({ items: [] })).toBe(runnerResult);
    expect(localStorageSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(createObjectUrlSpy).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  } finally {
    localStorageSpy.mockRestore();
    fetchSpy.mockRestore();
    if (originalCreateObjectUrl === undefined) {
      delete URL.createObjectURL;
    } else {
      URL.createObjectURL = originalCreateObjectUrl;
    }
    consoleSpy.mockRestore();
  }
});

test("imports only the existing dataset runner and PDF adapter", () => {
  const source = fs.readFileSync(
    require.resolve("./runLocalPdfDigitizationDataset"),
    "utf8"
  );
  const imports = source.match(/^import .*;$/gm) || [];

  expect(imports).toHaveLength(2);
  expect(source).toContain('from "./digitizationDatasetRunner"');
  expect(source).toContain('from "./pdfDatasetAdapter"');
  expect(source).not.toMatch(/pdfjs-dist|getDocument|getPage|getViewport/);
  expect(source).not.toMatch(/createElement\s*\(\s*["']canvas/);
  expect(source).not.toMatch(/readBrowserImageData|getDocumentSizeForDimensions/);
  expect(source).not.toMatch(/detectGridFromImageSource|runDigitizationExperimentComparison/);
  expect(source).not.toMatch(/createExperimentObservationReport|localStorage|fetch\s*\(/);
});

function createDevelopmentEntryPoint({
  runDataset = jest.fn(async () => ({ type: "digitization-dataset-run" })),
  prepareInput = jest.fn()
} = {}) {
  return createLocalPdfDigitizationDatasetEntryPoint({
    runDataset,
    prepareInput,
    readEnvironment: () => "development"
  });
}
