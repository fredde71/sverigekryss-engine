import {
  createDigitizationDatasetReportDownloader,
  createDigitizationDatasetReportExport,
  createDigitizationDatasetReportProjection
} from "./digitizationDatasetReportExport";

test("serializes a deterministic compact report projection", () => {
  const datasetResult = deepFreeze(createDatasetResult({
    items: [createCompletedItem()]
  }));

  const first = createDigitizationDatasetReportExport(datasetResult);
  const second = createDigitizationDatasetReportExport(datasetResult);
  const projection = createDigitizationDatasetReportProjection(datasetResult);

  expect(second).toEqual(first);
  expect(first.mimeType).toBe("application/json");
  expect(first.contents).toBe(`${JSON.stringify(projection, null, 2)}\n`);
  expect(first.contents.endsWith("\n")).toBe(true);
  expect(first.contents.endsWith("\n\n")).toBe(false);
  expect(projection).toEqual(createDigitizationDatasetReportProjection(datasetResult));
  expect(Object.isFrozen(datasetResult)).toBe(true);
});

test("preserves item, experiment and metadata order without interpretation", () => {
  const datasetResult = createDatasetResult({
    items: [
      createCompletedItem({
        id: "z-last",
        metadata: {
          labels: ["second", "first"]
        },
        comparison: {
          status: "completed",
          result: {
            production: { mustNotBeExported: true },
            benchmark: {
              experiments: [
                createExperiment({ id: "experiment-b", success: false }),
                createExperiment({ id: "experiment-a", success: true })
              ]
            }
          }
        }
      }),
      createCompletedItem({
        id: "a-first",
        metadata: {
          filename: "first.pdf"
        }
      })
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
  expect(parsed.items[0].comparison.result).not.toHaveProperty("production");
});

test("preserves production grid detection and compact review diagnostics", () => {
  const geometry = {
    rows: 2,
    cols: 2,
    bounds: { top: 10, left: 20, width: 40, height: 40 },
    horizontalLines: [10, 30, 50],
    verticalLines: [20, 40, 60]
  };
  const productionDiagnostic = {
    type: "spacing-consistency",
    axis: "vertical",
    status: "measured",
    consistency: 0.95
  };
  const datasetResult = createDatasetResult({
    items: [createCompletedItem({
      production: {
        status: "completed",
        result: createRuntimeProductionResult({
          gridDetection: {
            geometry,
            confidence: "production-confidence-verbatim",
            diagnostics: [productionDiagnostic]
          }
        })
      }
    })]
  });
  const production = createDigitizationDatasetReportProjection(datasetResult)
    .items[0].production.result;

  expect(production).toEqual({
    gridDetection: {
      geometry,
      confidence: "production-confidence-verbatim",
      diagnostics: [productionDiagnostic]
    }
  });
});

test("never reads or exports runtime production payloads", () => {
  const productionResult = createRuntimeProductionResult();

  for (const field of ["context", "suggestions", "diagnostics"]) {
    Object.defineProperty(productionResult, field, {
      enumerable: true,
      get() {
        throw new Error(`${field} must not be read`);
      }
    });
  }

  const projection = createDigitizationDatasetReportProjection(createDatasetResult({
    items: [createCompletedItem({
      production: {
        status: "completed",
        result: productionResult
      },
      comparison: {
        status: "completed",
        result: {
          production: productionResult,
          benchmark: { experiments: [] }
        }
      }
    })]
  }));
  const serialized = JSON.stringify(projection);

  expect(serialized).not.toMatch(/imageData|binaryImage|projections|suggestions|canvas/);
  expect(projection.items[0].comparison.result).not.toHaveProperty("production");
});

test("preserves benchmark diagnostics and visualization metadata without values", () => {
  const diagnostics = {
    type: "vertical-continuity-projection-comparison",
    preprocessing: { method: "local-vertical-continuity" },
    raw: { length: 3, maxStrength: 10 },
    rawVerticalProjection: [3, 10, 2],
    visualizations: [{
      id: "vertical-projection",
      title: "Vertical Projection",
      type: "vertical-projection",
      data: {
        axis: "vertical",
        axisLength: 100,
        length: 3,
        series: [{
          id: "raw",
          title: "Raw",
          values: [3, 10, 2]
        }]
      }
    }]
  };
  const item = createCompletedItem({
    comparison: {
      status: "completed",
      result: {
        production: { duplicate: true },
        benchmark: {
          experiments: [createExperiment({ diagnostics })]
        }
      }
    }
  });
  const experiment = createDigitizationDatasetReportProjection(
    createDatasetResult({ items: [item] })
  ).items[0].comparison.result.benchmark.experiments[0];

  expect(experiment).toEqual({
    id: "vertical-continuity",
    description: "Continuity diagnostics",
    durationMs: 12.5,
    success: true,
    diagnostics: {
      type: "vertical-continuity-projection-comparison",
      preprocessing: { method: "local-vertical-continuity" },
      raw: { length: 3, maxStrength: 10 },
      visualizations: [{
        id: "vertical-projection",
        title: "Vertical Projection",
        type: "vertical-projection",
        data: {
          axis: "vertical",
          axisLength: 100,
          length: 3,
          series: [{ id: "raw", title: "Raw" }]
        }
      }]
    }
  });
  expect(JSON.stringify(experiment)).not.toContain("values");
  expect(experiment.diagnostics).not.toHaveProperty("rawVerticalProjection");
});

test("exports compact shadow GridAnalysis observations without runtime BinaryImage payloads", () => {
  const shadowDiagnostics = {
    type: "shadow-grid-analysis-diagnostics",
    version: 1,
    status: "complete",
    providers: [
      {
        id: "outer-span",
        status: "available",
        regionCount: 1,
        gridAnalyses: [
          {
            regionId: "outer-span-001",
            regionBounds: { top: 10, left: 0, width: 100, height: 80 },
            regionDimensions: { width: 100, height: 80 },
            status: "completed",
            gridAnalysisStatus: "measured",
            durationMs: 2,
            candidateCounts: { horizontal: 3, vertical: 4 },
            candidatePositions: {
              horizontal: [0, 40, 79],
              vertical: [2, 32, 62, 92]
            },
            spacingDiagnostics: [],
            geometry: {
              status: "available",
              rows: 2,
              cols: 3,
              bounds: { top: 0, left: 2, width: 90, height: 79 }
            },
            rejectionReasons: [],
            binaryImage: {
              width: 100,
              height: 80,
              data: new Uint8Array(8000)
            },
            projections: {
              horizontal: new Uint32Array(80),
              vertical: new Uint32Array(100)
            }
          }
        ]
      }
    ]
  };
  const projection = createDigitizationDatasetReportProjection(
    createDatasetResult({
      items: [createCompletedItem({
        comparison: {
          status: "completed",
          result: {
            production: createRuntimeProductionResult(),
            benchmark: {
              experiments: [createExperiment({
                id: "shadow-grid-analysis-diagnostics",
                diagnostics: shadowDiagnostics
              })]
            }
          }
        }
      })]
    })
  );
  const diagnostics = projection.items[0].comparison.result.benchmark
    .experiments[0].diagnostics;
  const serialized = JSON.stringify(diagnostics);

  expect(diagnostics.providers[0].gridAnalyses[0]).toEqual({
    regionId: "outer-span-001",
    regionBounds: { top: 10, left: 0, width: 100, height: 80 },
    regionDimensions: { width: 100, height: 80 },
    status: "completed",
    gridAnalysisStatus: "measured",
    durationMs: 2,
    candidateCounts: { horizontal: 3, vertical: 4 },
    candidatePositions: {
      horizontal: [0, 40, 79],
      vertical: [2, 32, 62, 92]
    },
    spacingDiagnostics: [],
    geometry: {
      status: "available",
      rows: 2,
      cols: 3,
      bounds: { top: 0, left: 2, width: 90, height: 79 }
    },
    rejectionReasons: []
  });
  expect(serialized).not.toMatch(/binaryImage|projections|Uint8Array|Uint32Array/);
});

test("preserves normalized experiment failures exactly", () => {
  const failure = {
    type: "digitization-experiment-failure",
    name: "Error",
    message: "synthetic failure"
  };
  const item = createCompletedItem({
    comparison: {
      status: "completed",
      result: {
        production: createRuntimeProductionResult(),
        benchmark: {
          experiments: [createExperiment({
            id: "failed-experiment",
            description: "Failure fixture",
            durationMs: 3,
            success: false,
            diagnostics: failure
          })]
        }
      }
    }
  });
  const experiment = createDigitizationDatasetReportProjection(
    createDatasetResult({ items: [item] })
  ).items[0].comparison.result.benchmark.experiments[0];

  expect(experiment).toEqual({
    id: "failed-experiment",
    description: "Failure fixture",
    durationMs: 3,
    success: false,
    diagnostics: failure
  });
});

test("output size does not depend on excluded runtime or visualization arrays", () => {
  const small = createPayloadHeavyDatasetResult(1);
  const large = createPayloadHeavyDatasetResult(10000);

  const smallContents = createDigitizationDatasetReportExport(small).contents;
  const largeContents = createDigitizationDatasetReportExport(large).contents;

  expect(largeContents).toBe(smallContents);
  expect(largeContents).not.toContain("987654321");
});

test("preserves observation reports and existing observations without export analysis", () => {
  const observationReport = {
    type: "digitization-experiment-observation-report",
    version: 1,
    structuralEvidence: {
      maximumObservedScore: 0.75
    }
  };
  const projection = createDigitizationDatasetReportProjection(createDatasetResult({
    items: [createCompletedItem({
      observationReport: {
        status: "completed",
        result: observationReport
      }
    })]
  }));

  expect(projection.items[0].observationReport.result).toEqual(observationReport);
  expect(projection).not.toHaveProperty("summary");
  expect(projection).not.toHaveProperty("score");
  expect(projection).not.toHaveProperty("ranking");
  expect(projection).not.toHaveProperty("winner");
  expect(projection).not.toHaveProperty("recommendation");
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
  ).datasetRun.datasetId).toBe(datasetId);
});

test("uses the dataset result version in the filename", () => {
  const result = createDatasetResult({ version: 7 });

  expect(createDigitizationDatasetReportExport(result).fileName).toBe(
    "digitization-dataset-tt-real-crosswords-v7.json"
  );
});

test("preserves failed and not-run stages without inventing results", () => {
  const projection = createDigitizationDatasetReportProjection(createDatasetResult({
    items: [{
      id: "failed",
      index: 0,
      metadata: { filename: "failed.pdf" },
      status: "failed",
      preparation: { status: "completed" },
      production: {
        status: "failed",
        error: { name: "Error", message: "production failed" }
      },
      comparison: { status: "not-run", reason: "production-failed" },
      observationReport: { status: "not-run", reason: "production-failed" }
    }]
  }));

  expect(projection.items[0]).toEqual({
    id: "failed",
    index: 0,
    metadata: { filename: "failed.pdf" },
    status: "failed",
    preparation: { status: "completed" },
    production: {
      status: "failed",
      error: { name: "Error", message: "production failed" }
    },
    comparison: { status: "not-run", reason: "production-failed" },
    observationReport: { status: "not-run", reason: "production-failed" }
  });
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

function createCompletedItem(overrides = {}) {
  return {
    id: "item-1",
    index: 0,
    metadata: { filename: "crossword.pdf" },
    status: "completed",
    preparation: { status: "completed" },
    production: {
      status: "completed",
      result: createRuntimeProductionResult()
    },
    comparison: {
      status: "completed",
      result: {
        production: createRuntimeProductionResult(),
        benchmark: { experiments: [] }
      }
    },
    observationReport: {
      status: "completed",
      result: {
        type: "digitization-experiment-observation-report",
        version: 1
      }
    },
    ...overrides
  };
}

function createRuntimeProductionResult(overrides = {}) {
  return {
    context: {
      imageData: {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([0, 0, 0, 255])
      },
      binaryImage: {
        width: 1,
        height: 1,
        data: new Uint8Array([1])
      },
      projections: {
        horizontal: new Uint32Array([1]),
        vertical: new Uint32Array([1])
      }
    },
    gridDetection: {
      geometry: null,
      confidence: "missing-grid-geometry",
      diagnostics: []
    },
    suggestions: [],
    diagnostics: [],
    ...overrides
  };
}

function createExperiment(overrides = {}) {
  return {
    id: "vertical-continuity",
    description: "Continuity diagnostics",
    durationMs: 12.5,
    success: true,
    diagnostics: {
      type: "vertical-continuity-projection-comparison"
    },
    ...overrides
  };
}

function createPayloadHeavyDatasetResult(payloadLength) {
  const runtimeValues = new Uint8Array(payloadLength);
  runtimeValues.fill(1);
  const visualizationValues = new Array(payloadLength).fill(987654321);
  const productionResult = createRuntimeProductionResult({
    context: {
      imageData: { data: runtimeValues },
      binaryImage: { data: runtimeValues },
      projections: {
        horizontal: runtimeValues,
        vertical: runtimeValues
      }
    }
  });

  return createDatasetResult({
    items: [createCompletedItem({
      production: {
        status: "completed",
        result: productionResult
      },
      comparison: {
        status: "completed",
        result: {
          production: productionResult,
          benchmark: {
            experiments: [createExperiment({
              diagnostics: {
                type: "vertical-continuity-projection-comparison",
                visualizations: [{
                  id: "vertical-projection",
                  title: "Vertical Projection",
                  type: "vertical-projection",
                  data: {
                    axis: "vertical",
                    axisLength: 100,
                    length: 100,
                    series: [{
                      id: "raw",
                      title: "Raw",
                      values: visualizationValues
                    }]
                  }
                }]
              }
            })]
          }
        }
      }
    })]
  });
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

  if (ArrayBuffer.isView(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
