import fs from "fs";
import { detectGridFromImageSource } from "./imageGridDetectionEngine";
import {
  createImageGridDetectionOrchestrator,
  runImageGridDetection
} from "./imageGridDetectionOrchestrator";

test("sequences every production stage exactly once with exact references", async () => {
  const calls = [];
  const source = { id: "ordered-source" };
  const options = { productionToken: "unchanged" };
  const imageData = createImageData(2, 2);
  const binaryImage = {
    width: 2,
    height: 2,
    data: new Uint8Array([1, 0, 0, 1])
  };
  const documentAnalysis = {
    type: "document-analysis",
    version: 1,
    imageData,
    binaryImage,
    coordinateRelationship: {
      type: "axis-aligned-scale",
      binaryImageToDocument: {
        scaleX: 2,
        scaleY: 3
      }
    }
  };
  const analysisRegion = {
    id: "compatibility-full-binary-image",
    regionType: "compatibility",
    binaryImage,
    coordinateRelationship: {
      type: "identity",
      localToBinaryImage: {
        offsetX: 0,
        offsetY: 0,
        scaleX: 1,
        scaleY: 1
      }
    }
  };
  const localGeometry = createGeometry();
  const normalizedGeometry = {
    ...localGeometry,
    bounds: { top: 10, left: 20, width: 40, height: 40 }
  };
  const gridAnalysis = createGridAnalysisResult(localGeometry);
  const readImageData = jest.fn(async receivedSource => {
    calls.push("read-image-data");
    expect(receivedSource).toBe(source);
    return imageData;
  });
  const analyzeDocument = jest.fn(input => {
    calls.push("document-analysis");
    expect(input.imageData).toBe(imageData);
    expect(input.options).toBe(options);
    return documentAnalysis;
  });
  const createProductionRegion = jest.fn(input => {
    calls.push("analysis-region");
    expect(input).toBe(documentAnalysis);
    return analysisRegion;
  });
  const analyzeGrid = jest.fn(async input => {
    calls.push("grid-analysis");
    expect(input.analysisRegion).toBe(analysisRegion);
    expect(input.options).toBe(options);
    return gridAnalysis;
  });
  const normalizeGeometry = jest.fn((document, geometry) => {
    calls.push("coordinate-normalization");
    expect(document).toBe(documentAnalysis);
    expect(geometry).toBe(localGeometry);
    return normalizedGeometry;
  });
  const run = createImageGridDetectionOrchestrator({
    analyzeDocument,
    createProductionRegion,
    analyzeGrid,
    normalizeGeometry
  });

  const result = await run({ source, options, readImageData });

  expect(calls).toEqual([
    "read-image-data",
    "document-analysis",
    "analysis-region",
    "grid-analysis",
    "coordinate-normalization"
  ]);
  expect(readImageData).toHaveBeenCalledTimes(1);
  expect(analyzeDocument).toHaveBeenCalledTimes(1);
  expect(createProductionRegion).toHaveBeenCalledTimes(1);
  expect(analyzeGrid).toHaveBeenCalledTimes(1);
  expect(normalizeGeometry).toHaveBeenCalledTimes(1);
  expect(result.context.gridGeometry).toEqual(normalizedGeometry);
  expect(result.context.coordinateProvenance).toEqual({
    type: "digitization-coordinate-provenance",
    version: 1,
    spaces: {
      local: "analysis-region-local",
      binaryImage: "binary-image-pixels",
      document: "document"
    },
    analysisRegion: {
      id: "compatibility-full-binary-image",
      regionType: "compatibility",
      relationshipType: "identity",
      localToBinaryImage:
        analysisRegion.coordinateRelationship.localToBinaryImage,
      owner: "analysis-region"
    },
    documentAnalysis: {
      type: "document-analysis",
      version: 1,
      relationshipType: "axis-aligned-scale",
      binaryImageToDocument:
        documentAnalysis.coordinateRelationship.binaryImageToDocument,
      owner: "document-analysis"
    }
  });
  expect(result.gridDetection).toEqual({
    geometry: normalizedGeometry,
    confidence: "detected",
    diagnostics: gridAnalysis.diagnostics
  });
  expect(result.suggestions).toEqual([
    {
      sourceId: "ordered-source",
      grid: normalizedGeometry,
      confidence: "detected",
      diagnostics: gridAnalysis.diagnostics
    }
  ]);
  expect(result.diagnostics).toEqual(gridAnalysis.diagnostics);
});

test("does not fabricate coordinate transforms when owners omit them", async () => {
  const imageData = createImageData(1, 1);
  const binaryImage = {
    width: 1,
    height: 1,
    data: new Uint8Array([0])
  };
  const run = createImageGridDetectionOrchestrator({
    analyzeDocument: () => ({ imageData, binaryImage }),
    createProductionRegion: () => ({
      id: "compatibility-full-binary-image",
      regionType: "compatibility",
      binaryImage
    }),
    analyzeGrid: async () => createGridAnalysisResult(null),
    normalizeGeometry: () => null
  });

  const result = await run({
    source: { id: "missing-coordinate-transforms" },
    readImageData: async () => imageData
  });

  expect(result.context.coordinateProvenance).toMatchObject({
    analysisRegion: {
      relationshipType: null,
      localToBinaryImage: null,
      owner: "analysis-region"
    },
    documentAnalysis: {
      relationshipType: null,
      binaryImageToDocument: null,
      owner: "document-analysis"
    }
  });
});

test("rejects an AnalysisRegion that is not owned by production", async () => {
  const alternativeRegion = {
    id: "experimental-region",
    regionType: "experimental",
    binaryImage: {
      width: 1,
      height: 1,
      data: new Uint8Array([0])
    }
  };
  const analyzeGrid = jest.fn();
  const normalizeGeometry = jest.fn();
  const run = createImageGridDetectionOrchestrator({
    analyzeDocument: () => ({
      imageData: createImageData(1, 1),
      binaryImage: alternativeRegion.binaryImage
    }),
    createProductionRegion: () => alternativeRegion,
    analyzeGrid,
    normalizeGeometry
  });

  await expect(run({
    source: { id: "source" },
    readImageData: async () => createImageData(1, 1)
  })).rejects.toThrow("Production requires a production-owned AnalysisRegion");
  expect(analyzeGrid).not.toHaveBeenCalled();
  expect(normalizeGeometry).not.toHaveBeenCalled();
});

test("uses the horizontal outer-span region for the Wordex regression fixture", async () => {
  const imageData = createWordexRegressionImage();
  const result = await detectGridFromImageSource({
    source: { id: "wordex-production-regression" },
    options: {
      documentSize: { width: 20, height: 42 }
    },
    readImageData: async () => imageData
  });

  expect(result.context.coordinateProvenance.analysisRegion).toEqual({
    id: "production-horizontal-outer-span-001",
    regionType: "production-analysis-region",
    relationshipType: "translation",
    localToBinaryImage: {
      offsetX: 0,
      offsetY: 5,
      scaleX: 1,
      scaleY: 1
    },
    owner: "analysis-region"
  });
  expect(result.context.binaryImage).toMatchObject({
    width: 10,
    height: 11
  });
  expect(result.context.documentBinaryImage).toMatchObject({
    width: 10,
    height: 21
  });
  expect(result.context.documentBinaryImage).not.toBe(
    result.context.binaryImage
  );
  expect(Array.from(result.context.projections.vertical)).toEqual([
    3, 3, 11, 3, 3, 11, 3, 3, 11, 3
  ]);
  expect(result.context.lineCandidates.vertical.map(candidate => (
    candidate.position
  ))).toEqual([2, 5, 8]);
  expect(result.gridDetection.geometry).toEqual({
    bounds: { top: 10, left: 4, width: 12, height: 20 },
    horizontalLines: [10, 20, 30],
    verticalLines: [4, 10, 16],
    rows: 2,
    cols: 2
  });
});

test("falls back to unchanged full-page analysis without a restricted region", async () => {
  const imageData = createImageData(6, 9);
  const result = await detectGridFromImageSource({
    source: { id: "no-horizontal-span" },
    readImageData: async () => imageData
  });

  expect(result.context.coordinateProvenance.analysisRegion).toMatchObject({
    id: "compatibility-full-binary-image",
    regionType: "compatibility",
    relationshipType: "identity",
    localToBinaryImage: {
      offsetX: 0,
      offsetY: 0,
      scaleX: 1,
      scaleY: 1
    }
  });
  expect(result.context.binaryImage).toMatchObject({ width: 6, height: 9 });
  expect(result.gridDetection.geometry).toBeNull();
});

test("does not read or accept experiment, benchmark or comparison results", async () => {
  const binaryImage = {
    width: 1,
    height: 1,
    data: new Uint8Array([0])
  };
  const run = createImageGridDetectionOrchestrator({
    analyzeDocument: () => ({
      imageData: createImageData(1, 1),
      binaryImage
    }),
    createProductionRegion: () => ({
      id: "compatibility-full-binary-image",
      regionType: "compatibility",
      binaryImage
    }),
    analyzeGrid: async () => createGridAnalysisResult(null),
    normalizeGeometry: () => null
  });
  const request = {
    source: { id: "no-experiment-input" },
    readImageData: async () => createImageData(1, 1)
  };

  for (const field of [
    "experimentResult",
    "benchmark",
    "comparison",
    "analysisRegion"
  ]) {
    Object.defineProperty(request, field, {
      get() {
        throw new Error(`${field} must not be read`);
      }
    });
  }

  const result = await run(request);

  expect(result.gridDetection).toEqual({
    geometry: null,
    confidence: "missing-grid-geometry",
    diagnostics: [{ type: "synthetic-grid-diagnostic" }]
  });
  expect(result.suggestions).toEqual([]);
});

test.each([
  "read-image-data",
  "document-analysis",
  "analysis-region",
  "grid-analysis",
  "coordinate-normalization"
])("propagates the exact %s failure and stops later stages", async failureStage => {
  const error = new TypeError(`${failureStage} failed`);
  const calls = [];
  const imageData = createImageData(1, 1);
  const binaryImage = {
    width: 1,
    height: 1,
    data: new Uint8Array([0])
  };
  const documentAnalysis = { imageData, binaryImage };
  const analysisRegion = {
    id: "compatibility-full-binary-image",
    regionType: "compatibility",
    binaryImage
  };
  const mark = (stage, value) => {
    calls.push(stage);

    if (failureStage === stage) {
      throw error;
    }

    return value;
  };
  const run = createImageGridDetectionOrchestrator({
    analyzeDocument: () => mark("document-analysis", documentAnalysis),
    createProductionRegion: () => mark("analysis-region", analysisRegion),
    analyzeGrid: async () => mark(
      "grid-analysis",
      createGridAnalysisResult(null)
    ),
    normalizeGeometry: () => mark("coordinate-normalization", null)
  });
  const readImageData = async () => mark("read-image-data", imageData);
  let receivedError;

  try {
    await run({ source: { id: "failure" }, readImageData });
  } catch (caught) {
    receivedError = caught;
  }

  const expectedOrder = [
    "read-image-data",
    "document-analysis",
    "analysis-region",
    "grid-analysis",
    "coordinate-normalization"
  ];
  const failureIndex = expectedOrder.indexOf(failureStage);

  expect(receivedError).toBe(error);
  expect(calls).toEqual(expectedOrder.slice(0, failureIndex + 1));
});

test("the extracted production orchestrator remains byte-equivalent to the public engine", async () => {
  const source = { id: "equivalence" };
  const options = {
    documentSize: {
      width: 10,
      height: 20
    }
  };
  const firstImage = createGridImage();
  const secondImage = createGridImage();
  const direct = await runImageGridDetection({
    source,
    options,
    readImageData: async () => firstImage
  });
  const publicResult = await detectGridFromImageSource({
    source,
    options,
    readImageData: async () => secondImage
  });

  expect(publicResult).toEqual(direct);
  expect(JSON.stringify(publicResult)).toBe(JSON.stringify(direct));
  expect(publicResult.gridDetection.confidence).toBe("detected");
  expect(publicResult.suggestions).toEqual(direct.suggestions);
  expect(publicResult.diagnostics).toEqual(direct.diagnostics);
});

test("keeps orchestration independent of development experiment frameworks", () => {
  const source = fs.readFileSync(
    require.resolve("./imageGridDetectionOrchestrator"),
    "utf8"
  );

  expect(source).not.toMatch(/experiments|benchmark|comparison|dataset/i);
  expect(source).not.toMatch(/verticalSpan|verticalContinuity|candidateCoverage/i);
});

test.each([
  ["analyzeDocument", { analyzeDocument: null }],
  ["createProductionRegion", { createProductionRegion: null }],
  ["analyzeGrid", { analyzeGrid: null }],
  ["normalizeGeometry", { normalizeGeometry: null }]
])("validates the %s dependency", (name, dependencies) => {
  expect(() => createImageGridDetectionOrchestrator(dependencies)).toThrow(
    `${name} must be a function`
  );
});

function createGridAnalysisResult(gridGeometry) {
  return {
    gridGeometry,
    projections: {
      horizontal: new Uint32Array([1]),
      vertical: new Uint32Array([1])
    },
    lineCandidates: {
      horizontal: [],
      vertical: []
    },
    diagnostics: [
      {
        type: "synthetic-grid-diagnostic"
      }
    ]
  };
}

function createGeometry() {
  return {
    bounds: { top: 0, left: 0, width: 2, height: 2 },
    horizontalLines: [0, 2],
    verticalLines: [0, 2],
    rows: 1,
    cols: 1
  };
}

function createGridImage() {
  const width = 5;
  const height = 5;
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = ((y * width) + x) * 4;
      const value = [0, 2, 4].includes(y) || [0, 2, 4].includes(x)
        ? 0
        : 255;

      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }

  return { width, height, data };
}

function createWordexRegressionImage() {
  const width = 10;
  const height = 21;
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = ((y * width) + x) * 4;
      const insideVerticalLine = y >= 5
        && y <= 15
        && [2, 5, 8].includes(x);
      const value = [5, 10, 15].includes(y) || insideVerticalLine
        ? 0
        : 255;

      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }

  return { width, height, data };
}

function createImageData(width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(255);

  return { width, height, data };
}
