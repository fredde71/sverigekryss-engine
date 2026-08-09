import {
  createDigitizationDatasetReportDownloader,
  createDigitizationDatasetReportExport
} from "./digitizationDatasetReportExport";

test("serializes the completed dataset result directly with deterministic formatting", () => {
  const datasetResult = deepFreeze(createDatasetResult());

  const first = createDigitizationDatasetReportExport(datasetResult);
  const second = createDigitizationDatasetReportExport(datasetResult);

  expect(second).toEqual(first);
  expect(first.mimeType).toBe("application/json");
  expect(first.contents).toBe(`${JSON.stringify(datasetResult, null, 2)}\n`);
  expect(first.contents.endsWith("\n")).toBe(true);
  expect(first.contents.endsWith("\n\n")).toBe(false);
  expect(JSON.parse(first.contents)).toEqual(JSON.parse(JSON.stringify(datasetResult)));
  expect(Object.isFrozen(datasetResult)).toBe(true);
});

test("preserves item, experiment and metadata order without interpretation", () => {
  const datasetResult = createDatasetResult({
    items: [
      {
        id: "z-last",
        metadata: {
          labels: ["second", "first"]
        },
        comparison: {
          result: {
            benchmark: {
              experiments: [
                { id: "experiment-b", success: false },
                { id: "experiment-a", success: true }
              ]
            }
          }
        }
      },
      {
        id: "a-first",
        metadata: {
          filename: "first.pdf"
        }
      }
    ]
  });

  const parsed = JSON.parse(
    createDigitizationDatasetReportExport(datasetResult).contents
  );

  expect(parsed.items.map(item => item.id)).toEqual(["z-last", "a-first"]);
  expect(parsed.items[0].metadata.labels).toEqual(["second", "first"]);
  expect(
    parsed.items[0].comparison.result.benchmark.experiments.map(experiment => (
      experiment.id
    ))
  ).toEqual(["experiment-b", "experiment-a"]);
});

test("preserves existing downstream scores but adds no export analysis", () => {
  const datasetResult = createDatasetResult({
    items: [{
      id: "item",
      observationReport: {
        result: {
          structuralEvidence: {
            maximumObservedScore: 0.75
          }
        }
      }
    }]
  });
  const artifact = createDigitizationDatasetReportExport(datasetResult);
  const parsed = JSON.parse(artifact.contents);

  expect(parsed.items[0].observationReport.result.structuralEvidence).toEqual({
    maximumObservedScore: 0.75
  });
  expect(Object.keys(parsed)).toEqual(Object.keys(datasetResult));
  expect(artifact).not.toHaveProperty("summary");
  expect(artifact).not.toHaveProperty("score");
  expect(artifact).not.toHaveProperty("ranking");
  expect(artifact).not.toHaveProperty("exportedAt");
  expect(artifact).not.toHaveProperty("timestamp");
});

test.each([
  null,
  undefined,
  {},
  { type: "other", status: "completed" },
  { type: "digitization-dataset-run", status: "pending" },
  { type: "digitization-dataset-run", status: "failed" }
])("rejects values that are not completed dataset-runner results", value => {
  expect(() => createDigitizationDatasetReportExport(value)).toThrow(
    "Completed digitization dataset result is required"
  );
});

test.each([
  ["TT Real / August 2026", "digitization-dataset-tt-real-august-2026-v1.json"],
  ["  Dataset_Name.01  ", "digitization-dataset-dataset_name.01-v1.json"],
  ["***", "digitization-dataset-v1.json"],
  [undefined, "digitization-dataset-v1.json"]
])("creates a deterministic safe filename for dataset ID %s", (datasetId, expected) => {
  const result = createDatasetResult({ datasetId });

  expect(createDigitizationDatasetReportExport(result).fileName).toBe(expected);
  expect(JSON.parse(
    createDigitizationDatasetReportExport(result).contents
  ).datasetId).toBe(datasetId);
});

test("uses the dataset result version in the filename", () => {
  const result = createDatasetResult({ version: 7 });

  expect(createDigitizationDatasetReportExport(result).fileName).toBe(
    "digitization-dataset-tt-real-crosswords-v7.json"
  );
});

test("propagates circular-reference and BigInt serialization failures", () => {
  const circular = createDatasetResult();
  circular.self = circular;

  expect(() => createDigitizationDatasetReportExport(circular)).toThrow();
  expect(() => createDigitizationDatasetReportExport(createDatasetResult({
    unsupported: BigInt(1)
  }))).toThrow();
});

test.each(["development", "test"])(
  "downloads the exact export artifact in the %s environment",
  environment => {
    const datasetResult = createDatasetResult();
    const artifact = {
      fileName: "dataset.json",
      mimeType: "application/json",
      contents: "{\"result\":true}\n"
    };
    const harness = createDownloadHarness({
      environment,
      artifact
    });

    const result = harness.download(datasetResult);

    expect(result).toBe(artifact);
    expect(harness.createExport).toHaveBeenCalledTimes(1);
    expect(harness.createExport).toHaveBeenCalledWith(datasetResult);
    expect(harness.BlobCtor).toHaveBeenCalledTimes(1);
    expect(harness.BlobCtor).toHaveBeenCalledWith(
      [artifact.contents],
      { type: artifact.mimeType }
    );
    expect(harness.urlApi.createObjectURL).toHaveBeenCalledWith(harness.blob);
    expect(harness.documentRef.createElement).toHaveBeenCalledWith("a");
    expect(harness.anchor.href).toBe(harness.objectUrl);
    expect(harness.anchor.download).toBe(artifact.fileName);
    expect(harness.anchor.click).toHaveBeenCalledTimes(1);
    expect(harness.urlApi.revokeObjectURL).toHaveBeenCalledWith(harness.objectUrl);
  }
);

test.each(["production", undefined, "staging", "unknown"])(
  "rejects %s before creating export or browser download resources",
  environment => {
    const harness = createDownloadHarness({ environment });

    expect(() => harness.download(createDatasetResult())).toThrow(
      "Digitization dataset report downloads are available only in development"
    );
    expect(harness.createExport).not.toHaveBeenCalled();
    expect(harness.BlobCtor).not.toHaveBeenCalled();
    expect(harness.documentRef.createElement).not.toHaveBeenCalled();
    expect(harness.urlApi.createObjectURL).not.toHaveBeenCalled();
  }
);

test("revokes the object URL when clicking the download anchor fails", () => {
  const clickError = new Error("download blocked");
  const harness = createDownloadHarness({ clickError });

  expect(() => harness.download(createDatasetResult())).toThrow(clickError);
  expect(harness.urlApi.revokeObjectURL).toHaveBeenCalledTimes(1);
  expect(harness.urlApi.revokeObjectURL).toHaveBeenCalledWith(harness.objectUrl);
});

test("does not revoke an object URL that was never created", () => {
  const harness = createDownloadHarness({
    createObjectUrlError: new Error("URL creation failed")
  });

  expect(() => harness.download(createDatasetResult())).toThrow("URL creation failed");
  expect(harness.urlApi.revokeObjectURL).not.toHaveBeenCalled();
});

test("validates download dependencies only after the environment guard", () => {
  const productionDownload = createDigitizationDatasetReportDownloader({
    createExport: null,
    readEnvironment: () => "production",
    documentRef: null,
    urlApi: null,
    BlobCtor: null
  });

  expect(() => productionDownload(createDatasetResult())).toThrow(
    "Digitization dataset report downloads are available only in development"
  );

  expect(() => createDigitizationDatasetReportDownloader({
    createExport: null,
    readEnvironment: () => "development"
  })(createDatasetResult())).toThrow("createExport must be a function");
});

test("does not use storage, fetch or logging while downloading", () => {
  const localStorageSpy = jest.spyOn(Storage.prototype, "setItem");
  const sessionStorageSpy = jest.spyOn(window.sessionStorage, "setItem");
  const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({});
  const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  const harness = createDownloadHarness();

  try {
    harness.download(createDatasetResult());
    expect(localStorageSpy).not.toHaveBeenCalled();
    expect(sessionStorageSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  } finally {
    localStorageSpy.mockRestore();
    sessionStorageSpy.mockRestore();
    fetchSpy.mockRestore();
    consoleSpy.mockRestore();
  }
});

function createDatasetResult(overrides = {}) {
  return {
    type: "digitization-dataset-run",
    version: 1,
    datasetId: "TT Real Crosswords",
    status: "completed",
    inventory: {
      totalItemCount: 0,
      completedItemCount: 0,
      failedItemCount: 0
    },
    items: [],
    ...overrides
  };
}

function createDownloadHarness(options = {}) {
  const environment = Object.prototype.hasOwnProperty.call(options, "environment")
    ? options.environment
    : "development";
  const artifact = options.artifact || {
    fileName: "dataset.json",
    mimeType: "application/json",
    contents: "{}\n"
  };
  const {
    clickError,
    createObjectUrlError
  } = options;
  const blob = { type: "blob" };
  const BlobCtor = jest.fn(() => blob);
  const objectUrl = "blob:dataset-report";
  const anchor = {
    href: "",
    download: "",
    click: jest.fn(() => {
      if (clickError) {
        throw clickError;
      }
    })
  };
  const documentRef = {
    createElement: jest.fn(() => anchor)
  };
  const urlApi = {
    createObjectURL: jest.fn(() => {
      if (createObjectUrlError) {
        throw createObjectUrlError;
      }

      return objectUrl;
    }),
    revokeObjectURL: jest.fn()
  };
  const createExport = jest.fn(() => artifact);
  const download = createDigitizationDatasetReportDownloader({
    createExport,
    readEnvironment: () => environment,
    documentRef,
    urlApi,
    BlobCtor
  });

  return {
    blob,
    BlobCtor,
    objectUrl,
    anchor,
    documentRef,
    urlApi,
    createExport,
    download
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
