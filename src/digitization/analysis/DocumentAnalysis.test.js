import fs from "fs";
import { thresholdRgbaImage } from "./BinaryImage";
import {
  createDocumentAnalysis,
  mapBinaryImageGeometryToDocument,
  mapBinaryImagePointToDocument
} from "./DocumentAnalysis";

test("owns BinaryImage creation, dimensions and coordinate relationship", () => {
  const imageData = createImageData(2, 2, new Set(["0:0", "1:1"]));
  const expectedBinaryImage = thresholdRgbaImage(imageData);
  const analysis = createDocumentAnalysis({
    imageData,
    options: {
      documentSize: {
        width: 4,
        height: 8
      }
    }
  });

  expect(analysis).toMatchObject({
    type: "document-analysis",
    version: 1,
    status: "measured",
    imageData,
    dimensions: {
      document: { width: 4, height: 8 },
      imageData: { width: 2, height: 2 },
      binaryImage: { width: 2, height: 2 }
    },
    coordinateRelationship: {
      type: "axis-aligned-scale",
      binaryImageToDocument: {
        scaleX: 2,
        scaleY: 4
      }
    }
  });
  expect(analysis.binaryImage).toEqual(expectedBinaryImage);
  expect(Array.from(analysis.binaryImage.data)).toEqual([1, 0, 0, 1]);
  expect(analysis.diagnostics).toEqual([
    {
      type: "document-analysis",
      version: 1,
      status: "measured",
      dimensions: analysis.dimensions,
      coordinateRelationship: analysis.coordinateRelationship
    }
  ]);
});

test("preserves the existing document geometry normalization exactly", () => {
  const analysis = createDocumentAnalysis({
    imageData: createImageData(10, 10),
    options: {
      documentSize: {
        width: 5,
        height: 20
      }
    }
  });
  const geometry = {
    bounds: { top: 2, left: 1, width: 8, height: 6 },
    horizontalLines: [2, 4, 8],
    verticalLines: [1, 5, 9],
    rows: 2,
    cols: 2
  };

  expect(mapBinaryImageGeometryToDocument(analysis, geometry)).toEqual({
    bounds: { top: 4, left: 0.5, width: 4, height: 12 },
    horizontalLines: [4, 8, 16],
    verticalLines: [0.5, 2.5, 4.5],
    rows: 2,
    cols: 2
  });
  expect(mapBinaryImagePointToDocument(analysis, { x: 3, y: 4 })).toEqual({
    x: 1.5,
    y: 8
  });
  expect(mapBinaryImageGeometryToDocument(analysis, null)).toBeNull();
  expect(geometry.bounds).toEqual({ top: 2, left: 1, width: 8, height: 6 });
});

test("falls back to rendered dimensions exactly as production did", () => {
  const analysis = createDocumentAnalysis({
    imageData: createImageData(3, 7),
    options: {
      documentSize: {
        width: 0,
        height: NaN
      }
    }
  });

  expect(analysis.dimensions.document).toEqual({ width: 3, height: 7 });
  expect(analysis.coordinateRelationship.binaryImageToDocument).toEqual({
    scaleX: 1,
    scaleY: 1
  });
});

test("is deterministic, leaves ImageData unchanged and contains no grid analysis", () => {
  const imageData = createImageData(3, 3, new Set(["1:1"]));
  const pixels = Array.from(imageData.data);
  const first = createDocumentAnalysis({ imageData });
  const second = createDocumentAnalysis({ imageData });

  expect(second).toEqual(first);
  expect(Array.from(imageData.data)).toEqual(pixels);
  expect(collectKeys(first)).not.toEqual(expect.arrayContaining([
    "projections",
    "lineCandidates",
    "gridGeometry",
    "gridDetection"
  ]));

  const source = fs.readFileSync(require.resolve("./DocumentAnalysis"), "utf8");
  expect(source).not.toMatch(/findLineCandidates|buildGridGeometry/);
});

function createImageData(width, height, darkPixels = new Set()) {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = ((y * width) + x) * 4;
      const value = darkPixels.has(`${x}:${y}`) ? 0 : 255;

      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }

  return { width, height, data };
}

function collectKeys(value) {
  if (Array.isArray(value)) {
    return value.flatMap(collectKeys);
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, nested]) => [
    key,
    ...collectKeys(nested)
  ]);
}
