import { createDigitizationDatasetRunner } from "./digitizationDatasetRunner";
import { createPdfDatasetAdapter } from "./pdfDatasetAdapter";

jest.mock("pdfjs-dist", () => ({
  getDocument: jest.fn()
}));

test("reproduces the upload PDF lifecycle with page 1 and render scale 2", async () => {
  const harness = createHarness();
  const prepared = await harness.prepare(createPdfItem());

  expect(harness.calls).toEqual([
    "arrayBuffer",
    "getDocument",
    "getPage:1",
    "getViewport:2",
    "createElement:canvas",
    "getContext:2d",
    "render",
    "getDocumentSize"
  ]);
  expect(harness.file.arrayBuffer).toHaveBeenCalledTimes(1);
  expect(harness.getDocument).toHaveBeenCalledTimes(1);
  expect(harness.getDocument).toHaveBeenCalledWith({
    data: harness.arrayBuffer
  });
  expect(harness.pdf.getPage).toHaveBeenCalledTimes(1);
  expect(harness.pdf.getPage).toHaveBeenCalledWith(1);
  expect(harness.page.getViewport).toHaveBeenCalledWith({ scale: 2 });
  expect(harness.page.render).toHaveBeenCalledWith({
    canvasContext: harness.context,
    viewport: harness.viewport
  });
  expect(harness.canvas.width).toBe(harness.viewport.width);
  expect(harness.canvas.height).toBe(harness.viewport.height);
  expect(harness.getDocumentSize).toHaveBeenCalledWith({
    width: harness.viewport.width,
    height: harness.viewport.height
  });
  expect(prepared).toEqual({
    source: harness.canvas,
    readImageData: harness.readImageData,
    productionOptions: {
      documentSize: harness.documentSize
    }
  });
  expect(prepared.source).toBe(harness.canvas);
  expect(prepared.readImageData).toBe(harness.readImageData);
  expect(prepared.productionOptions.documentSize).toBe(harness.documentSize);
});

test("waits for page rendering before returning prepared input", async () => {
  const render = createDeferred();
  const harness = createHarness({ renderPromise: render.promise });
  let settled = false;
  const preparation = harness.prepare(createPdfItem()).then(result => {
    settled = true;
    return result;
  });

  await flushPromises();
  expect(harness.page.render).toHaveBeenCalledTimes(1);
  expect(settled).toBe(false);
  expect(harness.getDocumentSize).not.toHaveBeenCalled();

  render.resolve();
  const prepared = await preparation;

  expect(settled).toBe(true);
  expect(prepared.source).toBe(harness.canvas);
});

test("does not create a data URL or invoke readImageData", async () => {
  const harness = createHarness();

  await expect(harness.prepare(createPdfItem())).resolves.toMatchObject({
    source: harness.canvas
  });

  expect(harness.canvas.toDataURL).not.toHaveBeenCalled();
  expect(harness.readImageData).not.toHaveBeenCalled();
});

test("returns only the dataset-runner preparation contract", async () => {
  const harness = createHarness();
  const prepared = await harness.prepare(createPdfItem());

  expect(Object.keys(prepared)).toEqual([
    "source",
    "readImageData",
    "productionOptions"
  ]);
  expect(Object.keys(prepared.productionOptions)).toEqual(["documentSize"]);
  expect(findObjectKeys(prepared.productionOptions)).not.toEqual(expect.arrayContaining([
    "threshold",
    "cropArea",
    "gridArea",
    "confidence",
    "benchmark",
    "diagnostics"
  ]));
});

test("accepts an explicit page 1 request but rejects every other page", async () => {
  const acceptedHarness = createHarness();
  const rejectedHarness = createHarness();

  await expect(acceptedHarness.prepare(createPdfItem({ pageNumber: 1 }))).resolves.toBeDefined();
  await expect(rejectedHarness.prepare(createPdfItem({ pageNumber: 2 }))).rejects.toThrow(
    "PDF dataset adapter supports page 1 only"
  );
  expect(rejectedHarness.file.arrayBuffer).not.toHaveBeenCalled();
  expect(rejectedHarness.getDocument).not.toHaveBeenCalled();
});

test("requests only the first page of a multi-page PDF", async () => {
  const harness = createHarness();
  harness.pdf.numPages = 5;

  await harness.prepare(createPdfItem());

  expect(harness.pdf.getPage.mock.calls).toEqual([[1]]);
});

test.each([
  [null, "PDF dataset item is required"],
  [{ id: "item" }, "PDF dataset item input is required"],
  [{ id: "item", input: { kind: "image" } }, 'PDF dataset item input kind must be "pdf"'],
  [{ id: "item", input: { kind: "pdf" } }, "PDF file is required"],
  [{ id: "item", input: { kind: "pdf", file: {} } }, "PDF file arrayBuffer is required"]
])("rejects invalid item input before reading PDF bytes", async (item, message) => {
  const harness = createHarness();

  await expect(harness.adapter(item)).rejects.toThrow(message);
  expect(harness.file.arrayBuffer).not.toHaveBeenCalled();
  expect(harness.getDocument).not.toHaveBeenCalled();
});

test("rejects a non-PDF MIME type before reading bytes", async () => {
  const harness = createHarness({ fileType: "image/png" });

  await expect(harness.prepare(createPdfItem())).rejects.toThrow(
    "PDF file type must be application/pdf"
  );
  expect(harness.file.arrayBuffer).not.toHaveBeenCalled();
  expect(harness.getDocument).not.toHaveBeenCalled();
});

test("accepts an empty local-file MIME type when explicitly used as a PDF item", async () => {
  const harness = createHarness({ fileType: "" });

  await expect(harness.prepare(createPdfItem())).resolves.toBeDefined();
  expect(harness.getDocument).toHaveBeenCalledTimes(1);
});

test("rejects invalid and empty array buffers before PDF.js loading", async () => {
  const invalidHarness = createHarness({ arrayBuffer: new Uint8Array([1]) });
  const emptyHarness = createHarness({ arrayBuffer: new ArrayBuffer(0) });

  await expect(invalidHarness.prepare(createPdfItem())).rejects.toThrow(
    "PDF file arrayBuffer must return an ArrayBuffer"
  );
  await expect(emptyHarness.prepare(createPdfItem())).rejects.toThrow(
    "PDF file must not be empty"
  );
  expect(invalidHarness.getDocument).not.toHaveBeenCalled();
  expect(emptyHarness.getDocument).not.toHaveBeenCalled();
});

test("adds stable context to local file read failures", async () => {
  const harness = createHarness({
    readError: new Error("permission denied")
  });

  await expect(harness.prepare(createPdfItem())).rejects.toThrow(
    "Failed to read PDF file: permission denied"
  );
  expect(harness.getDocument).not.toHaveBeenCalled();
});

test("isolates synchronous and asynchronous PDF loading failures", async () => {
  const syncHarness = createHarness({
    getDocumentError: new Error("sync load failure")
  });

  await expect(syncHarness.prepare(createPdfItem())).rejects.toThrow(
    "Failed to load PDF: sync load failure"
  );

  const asyncHarness = createHarness({
    loadingPromise: createRejectedThenable(new Error("async load failure"))
  });
  await expect(asyncHarness.prepare(createPdfItem())).rejects.toThrow(
    "Failed to load PDF: async load failure"
  );
  expect(syncHarness.pdf.getPage).not.toHaveBeenCalled();
  expect(asyncHarness.pdf.getPage).not.toHaveBeenCalled();
});

test("requires PDF.js loading and rendering task promises", async () => {
  const loadingHarness = createHarness({ missingLoadingPromise: true });
  const renderingHarness = createHarness({ missingRenderPromise: true });

  await expect(loadingHarness.prepare(createPdfItem())).rejects.toThrow(
    "PDF loading task promise is required"
  );
  await expect(renderingHarness.prepare(createPdfItem())).rejects.toThrow(
    "PDF render task promise is required"
  );
  expect(renderingHarness.getDocumentSize).not.toHaveBeenCalled();
});

test("does not retry another page when page 1 fails", async () => {
  const harness = createHarness({
    pageError: new Error("page unavailable")
  });

  await expect(harness.prepare(createPdfItem())).rejects.toThrow(
    "Failed to load PDF page 1: page unavailable"
  );
  expect(harness.pdf.getPage.mock.calls).toEqual([[1]]);
  expect(harness.page.getViewport).not.toHaveBeenCalled();
  expect(harness.page.render).not.toHaveBeenCalled();
});

test.each([
  [{ width: 0, height: 100 }, "zero width"],
  [{ width: -1, height: 100 }, "negative width"],
  [{ width: Number.NaN, height: 100 }, "NaN width"],
  [{ width: 100, height: Number.POSITIVE_INFINITY }, "infinite height"]
])("rejects invalid viewport dimensions: %s", async (viewport) => {
  const harness = createHarness({ viewport });

  await expect(harness.prepare(createPdfItem())).rejects.toThrow(
    "PDF page viewport dimensions must be positive numbers"
  );
  expect(harness.documentRef.createElement).not.toHaveBeenCalled();
  expect(harness.page.render).not.toHaveBeenCalled();
});

test("requires a canvas 2D context that can supply production image data", async () => {
  const missingContext = createHarness({ context: null });
  const missingReader = createHarness({ context: {} });

  await expect(missingContext.prepare(createPdfItem())).rejects.toThrow(
    "Canvas 2D context with getImageData is required"
  );
  await expect(missingReader.prepare(createPdfItem())).rejects.toThrow(
    "Canvas 2D context with getImageData is required"
  );
  expect(missingContext.page.render).not.toHaveBeenCalled();
  expect(missingReader.page.render).not.toHaveBeenCalled();
});

test("stops preparation when page rendering rejects", async () => {
  const harness = createHarness({
    renderPromise: createRejectedThenable(new Error("render failed"))
  });

  await expect(harness.prepare(createPdfItem())).rejects.toThrow(
    "Failed to render PDF page 1: render failed"
  );
  expect(harness.getDocumentSize).not.toHaveBeenCalled();
});

test.each([
  null,
  { width: 0, height: 100 },
  { width: 100, height: Number.NaN }
])("rejects invalid document sizes without substituting defaults", async documentSize => {
  const harness = createHarness({ documentSize });

  await expect(harness.prepare(createPdfItem())).rejects.toThrow(
    "PDF documentSize must contain positive dimensions"
  );
});

test("validates factory dependencies before reading any item", () => {
  const valid = createHarnessDependencies();

  expect(() => createPdfDatasetAdapter({
    ...valid,
    getDocument: null
  })).toThrow("getDocument must be a function");
  expect(() => createPdfDatasetAdapter({
    ...valid,
    readImageData: null
  })).toThrow("readImageData must be a function");
  expect(() => createPdfDatasetAdapter({
    ...valid,
    getDocumentSize: null
  })).toThrow("getDocumentSize must be a function");
  expect(() => createPdfDatasetAdapter({
    ...valid,
    documentRef: null
  })).toThrow("document.createElement is required");
});

test("treats frozen dataset input as read-only", async () => {
  const harness = createHarness();
  const item = deepFreeze(createPdfItem({
    metadata: {
      publisher: "TT"
    }
  }));
  const snapshot = JSON.stringify({
    id: item.id,
    input: {
      kind: item.input.kind,
      pageNumber: item.input.pageNumber
    },
    metadata: item.metadata
  });

  await harness.prepare(item);

  expect(JSON.stringify({
    id: item.id,
    input: {
      kind: item.input.kind,
      pageNumber: item.input.pageNumber
    },
    metadata: item.metadata
  })).toBe(snapshot);
  expect(Object.isFrozen(item)).toBe(true);
  expect(Object.isFrozen(item.input)).toBe(true);
});

test("is deterministic with deterministic PDF and canvas dependencies", async () => {
  const harness = createHarness();
  const item = createPdfItem();

  const first = await harness.prepare(item);
  const second = await harness.prepare(item);

  expect(second).toEqual(first);
  expect(harness.pdf.getPage.mock.calls).toEqual([[1], [1]]);
  expect(harness.page.getViewport.mock.calls).toEqual([
    [{ scale: 2 }],
    [{ scale: 2 }]
  ]);
});

test("integrates directly with the dataset-runner prepareInput boundary", async () => {
  const harness = createHarness();
  const productionResult = {
    context: {
      binaryImage: { width: 1, height: 1, data: [1] }
    },
    gridDetection: {}
  };
  const runProduction = jest.fn(async () => productionResult);
  const comparisonResult = {
    production: productionResult,
    benchmark: { experiments: [] }
  };
  const runDataset = createDigitizationDatasetRunner({
    runProduction,
    runComparison: jest.fn(async () => comparisonResult),
    createObservationReport: jest.fn(() => ({ type: "report" }))
  });

  const result = await runDataset({
    datasetId: "pdf-dataset",
    items: [createPdfItem()],
    prepareInput: harness.prepare
  });

  expect(result.items[0].status).toBe("completed");
  expect(runProduction).toHaveBeenCalledWith({
    source: harness.canvas,
    readImageData: harness.readImageData,
    options: {
      documentSize: harness.documentSize
    }
  });
});

function createHarness(options = {}) {
  const calls = [];
  const arrayBuffer = hasOwn(options, "arrayBuffer")
    ? options.arrayBuffer
    : new ArrayBuffer(8);
  const context = hasOwn(options, "context")
    ? options.context
    : { getImageData: jest.fn() };
  const canvas = {
    width: 0,
    height: 0,
    getContext: jest.fn(type => {
      calls.push(`getContext:${type}`);
      return context;
    }),
    toDataURL: jest.fn(() => {
      throw new Error("data URLs are not part of dataset preparation");
    })
  };
  const viewport = options.viewport || {
    width: 1000,
    height: 1400,
    id: "viewport"
  };
  const renderTask = options.missingRenderPromise
    ? {}
    : {
      promise: hasOwn(options, "renderPromise")
        ? options.renderPromise
        : Promise.resolve()
    };
  const page = {
    getViewport: jest.fn(({ scale }) => {
      calls.push(`getViewport:${scale}`);
      return viewport;
    }),
    render: jest.fn(() => {
      calls.push("render");
      return renderTask;
    })
  };
  const pdf = {
    getPage: jest.fn(pageNumber => {
      calls.push(`getPage:${pageNumber}`);

      if (options.pageError) {
        return Promise.reject(options.pageError);
      }

      return Promise.resolve(page);
    })
  };
  const loadingTask = options.missingLoadingPromise
    ? {}
    : {
      promise: hasOwn(options, "loadingPromise")
        ? options.loadingPromise
        : Promise.resolve(pdf)
    };
  const getDocument = jest.fn(() => {
    calls.push("getDocument");

    if (options.getDocumentError) {
      throw options.getDocumentError;
    }

    return loadingTask;
  });
  const documentRef = {
    createElement: jest.fn(tagName => {
      calls.push(`createElement:${tagName}`);
      return canvas;
    })
  };
  const readImageData = jest.fn();
  const documentSize = hasOwn(options, "documentSize")
    ? options.documentSize
    : { width: 1200, height: 1680 };
  const getDocumentSize = jest.fn(() => {
    calls.push("getDocumentSize");
    return documentSize;
  });
  const file = {
    name: "crossword.pdf",
    type: hasOwn(options, "fileType") ? options.fileType : "application/pdf",
    arrayBuffer: jest.fn(() => {
      calls.push("arrayBuffer");

      if (options.readError) {
        return Promise.reject(options.readError);
      }

      return Promise.resolve(arrayBuffer);
    })
  };
  const adapter = createPdfDatasetAdapter({
    getDocument,
    documentRef,
    readImageData,
    getDocumentSize
  });
  const prepare = item => adapter({
    ...item,
    input: item?.input?.kind === "pdf" && !hasOwn(item.input, "file")
      ? {
        ...item.input,
        file
      }
      : item?.input
  });

  return {
    calls,
    arrayBuffer,
    context,
    canvas,
    viewport,
    page,
    pdf,
    getDocument,
    documentRef,
    readImageData,
    documentSize,
    getDocumentSize,
    file,
    adapter,
    prepare
  };
}

function createHarnessDependencies() {
  return {
    getDocument: jest.fn(),
    documentRef: {
      createElement: jest.fn()
    },
    readImageData: jest.fn(),
    getDocumentSize: jest.fn()
  };
}

function createPdfItem(overrides = {}) {
  const harnessFile = overrides.file;

  return {
    id: overrides.id || "pdf-item",
    input: {
      kind: "pdf",
      ...(overrides.pageNumber === undefined
        ? {}
        : { pageNumber: overrides.pageNumber }),
      ...(harnessFile === undefined
        ? {}
        : { file: harnessFile })
    },
    ...(overrides.metadata === undefined
      ? {}
      : { metadata: overrides.metadata })
  };
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function createRejectedThenable(error) {
  return {
    then(_resolve, reject) {
      reject(error);
    }
  };
}

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0));
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

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}
