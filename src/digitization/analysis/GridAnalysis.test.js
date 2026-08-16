import fs from "fs";
import {
  createHorizontalProjection,
  createVerticalProjection
} from "./Projection";
import { findLineCandidates } from "./LineCandidate";
import { buildGridGeometry } from "./GridGeometry";
import {
  createDocumentAnalysis,
  mapBinaryImageGeometryToDocument
} from "./DocumentAnalysis";
import { createCompatibilityAnalysisRegion } from "./AnalysisRegion";
import { createGridAnalysis } from "./GridAnalysis";
import { createGridDetection } from "../detection/GridDetection";
import { detectGridFromImageSource } from "../detection/imageGridDetectionEngine";

test("compatibility region produces byte-identical projections and candidates", async () => {
  const documentAnalysis = createDocumentAnalysis({
    imageData: createGridImage()
  });
  const region = createCompatibilityAnalysisRegion(documentAnalysis);
  const binaryImage = documentAnalysis.binaryImage;
  const expectedProjections = {
    horizontal: createHorizontalProjection(binaryImage),
    vertical: createVerticalProjection(binaryImage)
  };
  const expectedCandidates = {
    horizontal: findLineCandidates(expectedProjections.horizontal, {
      axis: "horizontal",
      axisLength: binaryImage.width
    }),
    vertical: findLineCandidates(expectedProjections.vertical, {
      axis: "vertical",
      axisLength: binaryImage.height
    })
  };
  const analysis = await createGridAnalysis({ analysisRegion: region });

  expect(analysis.analysisRegionId).toBe("compatibility-full-binary-image");
  expect(analysis.analysisDimensions).toEqual({ width: 5, height: 5 });
  expect(analysis.projections).toEqual(expectedProjections);
  expect(new Uint8Array(analysis.projections.horizontal.buffer)).toEqual(
    new Uint8Array(expectedProjections.horizontal.buffer)
  );
  expect(new Uint8Array(analysis.projections.vertical.buffer)).toEqual(
    new Uint8Array(expectedProjections.vertical.buffer)
  );
  expect(analysis.lineCandidates).toEqual(expectedCandidates);
  expect(analysis.lineCandidates.horizontal.map(candidate => candidate.position))
    .toEqual([0, 2, 4]);
  expect(analysis.lineCandidates.vertical.map(candidate => candidate.position))
    .toEqual([0, 2, 4]);
});

test("compatibility region produces identical geometry and diagnostics", async () => {
  const documentAnalysis = createDocumentAnalysis({
    imageData: createGridImage()
  });
  const region = createCompatibilityAnalysisRegion(documentAnalysis);
  const analysis = await createGridAnalysis({ analysisRegion: region });
  const expectedGeometry = buildGridGeometry({
    horizontalCandidates: analysis.lineCandidates.horizontal,
    verticalCandidates: analysis.lineCandidates.vertical
  });

  expect(analysis.gridGeometry).toEqual(expectedGeometry);
  expect(analysis.gridGeometry).toEqual({
    bounds: { top: 0, left: 0, width: 4, height: 4 },
    horizontalLines: [0, 2, 4],
    verticalLines: [0, 2, 4],
    rows: 2,
    cols: 2
  });
  expect(analysis.diagnostics).toEqual(expect.arrayContaining([
    {
      type: "candidate-counts",
      axis: "horizontal",
      acceptedCount: 3,
      rejectedCount: 2,
      totalCount: 5
    },
    {
      type: "candidate-counts",
      axis: "vertical",
      acceptedCount: 3,
      rejectedCount: 2,
      totalCount: 5
    },
    {
      type: "spacing-consistency",
      axis: "horizontal",
      status: "measured",
      consistency: 1,
      min: 2,
      max: 2,
      average: 2
    },
    {
      type: "spacing-consistency",
      axis: "vertical",
      status: "measured",
      consistency: 1,
      min: 2,
      max: 2,
      average: 2
    },
    {
      type: "pre-rejection-bounds",
      bounds: { top: 0, left: 0, width: 4, height: 4 }
    },
    {
      type: "rejection-reasons",
      reasons: []
    },
    {
      type: "acceptance-status",
      accepted: true
    }
  ]));
  expect(analysis.diagnostics.some(diagnostic => (
    diagnostic.type === "analysis-region"
    || diagnostic.type === "document-analysis"
  ))).toBe(false);
});

test("compatibility region preserves rejection reasons exactly", async () => {
  const documentAnalysis = createDocumentAnalysis({
    imageData: createImageData({ width: 5, height: 5 })
  });
  const analysis = await createGridAnalysis({
    analysisRegion: createCompatibilityAnalysisRegion(documentAnalysis)
  });

  expect(analysis.gridGeometry).toBeNull();
  expect(analysis.diagnostics.filter(diagnostic => (
    diagnostic.type === "rejection-reason"
  ))).toEqual([
    {
      type: "rejection-reason",
      code: "insufficient-candidates",
      axis: "horizontal",
      candidateCount: 0,
      minimumCount: 2
    },
    {
      type: "rejection-reason",
      code: "insufficient-candidates",
      axis: "vertical",
      candidateCount: 0,
      minimumCount: 2
    }
  ]);
  expect(analysis.diagnostics.at(-1)).toEqual({
    type: "acceptance-status",
    accepted: false
  });
});

test("production orchestration preserves the exact public result contract", async () => {
  const source = { id: "phase-one-grid" };
  const imageData = createGridImage();
  const options = {
    documentSize: {
      width: 10,
      height: 20
    }
  };
  const readImageData = jest.fn(async () => imageData);
  const documentAnalysis = createDocumentAnalysis({ imageData, options });
  const region = createCompatibilityAnalysisRegion(documentAnalysis);
  const gridAnalysis = await createGridAnalysis({
    analysisRegion: region,
    options
  });
  const expectedGeometry = mapBinaryImageGeometryToDocument(
    documentAnalysis,
    gridAnalysis.gridGeometry
  );
  const expectedDetection = createGridDetection({
    geometry: expectedGeometry,
    confidence: "detected",
    diagnostics: gridAnalysis.diagnostics
  });

  const result = await detectGridFromImageSource({
    source,
    options,
    readImageData
  });

  expect(readImageData).toHaveBeenCalledTimes(1);
  expect(Object.keys(result)).toEqual([
    "context",
    "gridDetection",
    "suggestions",
    "diagnostics"
  ]);
  expect(result.context.projections).toEqual(gridAnalysis.projections);
  expect(result.context.lineCandidates).toEqual(gridAnalysis.lineCandidates);
  expect(result.context.gridGeometry).toEqual(expectedGeometry);
  expect(result.gridDetection).toEqual(expectedDetection);
  expect(JSON.stringify(result.gridDetection)).toBe(
    JSON.stringify(expectedDetection)
  );
  expect(result.diagnostics).toEqual(expectedDetection.diagnostics);
  expect(result.suggestions).toHaveLength(1);
  expect(result.suggestions[0]).toMatchObject({
    sourceId: "phase-one-grid",
    grid: expectedGeometry,
    confidence: "detected",
    diagnostics: expectedDetection.diagnostics
  });
  expect(result).not.toHaveProperty("documentAnalysis");
  expect(result).not.toHaveProperty("analysisRegion");
  expect(result).not.toHaveProperty("gridAnalysis");
});

test("GridAnalysis consumes only an explicit AnalysisRegion", async () => {
  await expect(createGridAnalysis()).rejects.toThrow(
    "Measured AnalysisRegion is required"
  );

  const source = fs.readFileSync(require.resolve("./GridAnalysis"), "utf8");
  expect(source).not.toMatch(/thresholdRgbaImage|readImageData|documentSize/);
  expect(source).not.toMatch(/detectGridFromImageSource|createGridDetection/);
});

function createGridImage() {
  return createImageData({
    width: 5,
    height: 5,
    darkRows: [0, 2, 4],
    darkCols: [0, 2, 4]
  });
}

function createImageData({
  width,
  height,
  darkRows = [],
  darkCols = []
}) {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = ((y * width) + x) * 4;
      const value = darkRows.includes(y) || darkCols.includes(x) ? 0 : 255;

      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }

  return { width, height, data };
}
